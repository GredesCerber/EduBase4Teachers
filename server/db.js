import sqlite3 from 'sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function expandPath(p) {
  if (!p) return ''
  let out = String(p)
  // Expand Windows %VAR%
  out = out.replace(/%([^%]+)%/g, (_m, v) => process.env[String(v)] || _m)
  // Expand POSIX ${VAR}
  out = out.replace(/\${([^}]+)}/g, (_m, v) => process.env[String(v)] || _m)
  // Expand ~
  if (out.startsWith('~')) {
    out = path.join(os.homedir(), out.slice(1))
  }
  if (!path.isAbsolute(out)) {
    out = path.resolve(__dirname, out)
  }
  return out
}

const envDbPath = process.env.DB_PATH ? expandPath(process.env.DB_PATH) : null
const dbPath = envDbPath || path.join(__dirname, 'auth.db')
try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
} catch {}
sqlite3.verbose()
export const db = new sqlite3.Database(dbPath)

export function initDb() {
  db.serialize(() => {
    // Enforce foreign key constraints (needed for ON DELETE CASCADE)
    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA synchronous = NORMAL')
    db.run('PRAGMA foreign_keys = ON')
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`)
    db.run(`CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      link TEXT,
      file_url TEXT,
      file_name TEXT,
      size INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`)
  // Indexes for faster lookups
  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email))')
  db.run('CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at)')

    // Ensure description column exists for older DBs
    db.all(`PRAGMA table_info(materials)`, [], (err, rows) => {
      if (err) return
      const hasDesc = Array.isArray(rows) && rows.some((r) => r.name === 'description')
      if (!hasDesc) {
        db.run('ALTER TABLE materials ADD COLUMN description TEXT')
      }
      const hasViews = Array.isArray(rows) && rows.some((r) => r.name === 'views')
      if (!hasViews) {
        db.run('ALTER TABLE materials ADD COLUMN views INTEGER DEFAULT 0')
      }
      const hasDownloads = Array.isArray(rows) && rows.some((r) => r.name === 'downloads')
      if (!hasDownloads) {
        db.run('ALTER TABLE materials ADD COLUMN downloads INTEGER DEFAULT 0')
      }
    })

    // Ensure is_admin column exists for older DBs
    db.all(`PRAGMA table_info(users)`, [], (err, rows) => {
      if (err) return
      const hasIsAdmin = Array.isArray(rows) && rows.some((r) => r.name === 'is_admin')
      if (!hasIsAdmin) {
        db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0')
      }
    })

    // Files table for multiple attachments per material
    db.run(`CREATE TABLE IF NOT EXISTS material_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      is_main INTEGER DEFAULT 0,
      size INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    )`)
    // Index after table creation to avoid init errors
    db.run('CREATE INDEX IF NOT EXISTS idx_material_files_material_id ON material_files(material_id)')

    // Ensure is_main column exists for older DBs
    db.all(`PRAGMA table_info(material_files)`, [], (err, rows) => {
      if (err) return
      const hasIsMain = Array.isArray(rows) && rows.some((r) => r.name === 'is_main')
      if (!hasIsMain) {
        db.run('ALTER TABLE material_files ADD COLUMN is_main INTEGER DEFAULT 0')
      }
    })

    // Favorites table (server-side saved)
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, material_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    )`)

    // FTS5 virtual table for full-text search on title/description
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS materials_fts USING fts5(
      title, description, content='materials', content_rowid='id'
    )`)
    // Triggers to keep FTS index in sync
    db.run(`CREATE TRIGGER IF NOT EXISTS materials_ai AFTER INSERT ON materials BEGIN
      INSERT INTO materials_fts(rowid, title, description) VALUES (new.id, new.title, coalesce(new.description, ''));
    END`)
    db.run(`CREATE TRIGGER IF NOT EXISTS materials_ad AFTER DELETE ON materials BEGIN
      INSERT INTO materials_fts(materials_fts, rowid, title, description) VALUES('delete', old.id, old.title, coalesce(old.description, ''));
    END`)
    db.run(`CREATE TRIGGER IF NOT EXISTS materials_au AFTER UPDATE ON materials BEGIN
      INSERT INTO materials_fts(materials_fts, rowid, title, description) VALUES('delete', old.id, old.title, coalesce(old.description, ''));
      INSERT INTO materials_fts(rowid, title, description) VALUES (new.id, new.title, coalesce(new.description, ''));
    END`)
    // Initial populate if empty
    db.get('SELECT COUNT(1) AS cnt FROM materials_fts', [], (e2, r2) => {
      if (!e2 && r2 && Number(r2.cnt) === 0) {
        db.run(`INSERT INTO materials_fts(rowid, title, description)
                SELECT id, title, coalesce(description,'') FROM materials WHERE title IS NOT NULL`)
      }
    })

    // Forum tables
    db.run(`CREATE TABLE IF NOT EXISTS forum_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      posts_count INTEGER DEFAULT 0,
      last_post_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_forum_threads_last ON forum_threads(last_post_at DESC)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_forum_threads_user ON forum_threads(user_id)`)

    db.run(`CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id, created_at)`)

    db.run(`CREATE TABLE IF NOT EXISTS forum_post_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      size INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
    )`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_forum_post_files_post ON forum_post_files(post_id)`)

    db.run(`CREATE TABLE IF NOT EXISTS forum_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'like' | 'dislike' | 'emoji'
      emoji TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(post_id, user_id, type, emoji),
      FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_forum_reactions_post ON forum_reactions(post_id)`)

    // Likes for threads
    db.run(`CREATE TABLE IF NOT EXISTS forum_thread_likes (
      thread_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, user_id),
      FOREIGN KEY(thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_forum_thread_likes_thread ON forum_thread_likes(thread_id)`)
  })
}

export function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    // Case-insensitive email lookup to avoid login issues due to casing
    db.get('SELECT * FROM users WHERE lower(email) = lower(?)', [String(email)], (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

export function createUser({ email, name, password_hash }) {
  return new Promise((resolve, reject) => {
    const created_at = new Date().toISOString()
    const normalizedEmail = String(email).trim().toLowerCase()
    // Determine admin by env var ADMIN_EMAILS (comma/semicolon/space separated)
    const adminList = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const is_admin = adminList.includes(normalizedEmail) ? 1 : 0
    db.run(
      'INSERT INTO users (email, name, is_admin, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [normalizedEmail, String(name), is_admin, password_hash, created_at],
      function (err) {
        if (err) reject(err)
        else resolve({ id: this.lastID, email: normalizedEmail, name: String(name), is_admin, password_hash, created_at })
      }
    )
  })
}

export function findUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, name, is_admin, created_at FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

export function createMaterial(data) {
  const {
    user_id,
    title,
    subject,
    grade,
    type,
    description = null,
    link = null,
    file_url = null,
    file_name = null,
    size = null,
    mime_type = null,
  } = data
  return new Promise((resolve, reject) => {
    const created_at = new Date().toISOString()
    db.run(
      `INSERT INTO materials (user_id, title, subject, grade, type, description, link, file_url, file_name, size, mime_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, title, subject, grade, type, description, link, file_url, file_name, size, mime_type, created_at],
      function (err) {
        if (err) return reject(err)
        resolve({
          id: this.lastID,
          user_id,
          title,
          subject,
          grade,
          type,
          description,
          link,
          file_url,
          file_name,
          size,
          mime_type,
          created_at,
        })
      }
    )
  })
}

// Forum helpers
export function createForumThread({ user_id, title }) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO forum_threads (user_id, title, posts_count, last_post_at, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?, ?)`,
      [user_id, String(title), now, now, now],
      function (err) {
        if (err) return reject(err)
        resolve({ id: this.lastID, user_id, title: String(title), posts_count: 0, last_post_at: now, created_at: now, updated_at: now })
      }
    )
  })
}

export function getForumThread(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT t.*, u.name AS author_name,
                   (SELECT COUNT(1) FROM forum_thread_likes l WHERE l.thread_id = t.id) AS likes_count
            FROM forum_threads t JOIN users u ON u.id = t.user_id WHERE t.id = ?`, [id], (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

export function listForumThreads({ q = '', limit = 20, offset = 0, sort = 'new' } = {}) {
  const clamp = (n, min, max, d) => {
    const v = Number.isFinite(Number(n)) ? Number(n) : d
    return Math.min(Math.max(v, min), max)
  }
    limit = clamp(limit, 1, 50, 20)
    offset = clamp(offset, 0, 10000, 0)
    const query = `%${String(q || '').toLowerCase()}%`
    let orderBy = 'datetime(coalesce(t.last_post_at, t.created_at)) DESC'
    if (sort === 'top') orderBy = 'likes_count DESC, datetime(coalesce(t.last_post_at, t.created_at)) DESC'
    if (sort === 'active') orderBy = 'datetime(coalesce(t.last_post_at, t.created_at)) DESC'
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT t.*, u.name AS author_name, COALESCE(lc.likes_count, 0) AS likes_count
       FROM forum_threads t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN (
         SELECT thread_id, COUNT(*) AS likes_count
         FROM forum_thread_likes
         GROUP BY thread_id
       ) lc ON lc.thread_id = t.id
       WHERE lower(t.title) LIKE ?
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [query, limit, offset],
      (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

export function countThreadLikes(thread_id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(1) AS cnt FROM forum_thread_likes WHERE thread_id = ?`, [thread_id], (err, row) => {
      if (err) reject(err)
      else resolve(Number(row?.cnt || 0))
    })
  })
}

export function userLikedThread(thread_id, user_id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT 1 FROM forum_thread_likes WHERE thread_id = ? AND user_id = ?`, [thread_id, user_id], (err, row) => {
      if (err) reject(err)
      else resolve(!!row)
    })
  })
}

export function toggleThreadLike({ thread_id, user_id }) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT 1 FROM forum_thread_likes WHERE thread_id = ? AND user_id = ?`, [thread_id, user_id], (err, row) => {
      if (err) return reject(err)
      const finish = () => resolve({ ok: true })
      if (row) {
        db.run(`DELETE FROM forum_thread_likes WHERE thread_id = ? AND user_id = ?`, [thread_id, user_id], (e2) => (e2 ? reject(e2) : finish()))
      } else {
        const now = new Date().toISOString()
        db.run(`INSERT INTO forum_thread_likes (thread_id, user_id, created_at) VALUES (?, ?, ?)`, [thread_id, user_id, now], (e3) => (e3 ? reject(e3) : finish()))
      }
    })
  })
}

export function createForumPost({ thread_id, user_id, content }) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO forum_posts (thread_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`,
      [thread_id, user_id, String(content || '').trim(), now],
      function (err) {
        if (err) return reject(err)
        const postId = this.lastID
        db.run(`UPDATE forum_threads SET posts_count = posts_count + 1, last_post_at = ?, updated_at = ? WHERE id = ?`, [now, now, thread_id])
        resolve({ id: postId, thread_id, user_id, content: String(content || '').trim(), created_at: now })
      }
    )
  })
}

export function addForumPostFile({ post_id, file_url, file_name, size, mime_type }) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO forum_post_files (post_id, file_url, file_name, size, mime_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [post_id, String(file_url), String(file_name), size || null, String(mime_type || '') || null, now],
      function (err) {
        if (err) reject(err)
        else resolve({ id: this.lastID, post_id, file_url, file_name, size, mime_type, created_at: now })
      }
    )
  })
}

export function listForumPosts(thread_id, { limit = 50, offset = 0 } = {}) {
  const clamp = (n, min, max, d) => {
    const v = Number.isFinite(Number(n)) ? Number(n) : d
    return Math.min(Math.max(v, min), max)
  }
  limit = clamp(limit, 1, 100, 50)
  offset = clamp(offset, 0, 10000, 0)
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT p.*, u.name AS author_name FROM forum_posts p JOIN users u ON u.id = p.user_id WHERE p.thread_id = ? ORDER BY datetime(p.created_at) ASC LIMIT ? OFFSET ?`,
      [thread_id, limit, offset],
      (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

export function listForumFilesByPostIds(ids) {
  const ph = ids.map(() => '?').join(',')
  return new Promise((resolve, reject) => {
    if (!ids.length) return resolve([])
    db.all(`SELECT * FROM forum_post_files WHERE post_id IN (${ph})`, ids, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

export function listForumReactionsByPostIds(ids) {
  const ph = ids.map(() => '?').join(',')
  return new Promise((resolve, reject) => {
    if (!ids.length) return resolve([])
    db.all(`SELECT * FROM forum_reactions WHERE post_id IN (${ph})`, ids, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

export function toggleForumReaction({ post_id, user_id, type, emoji = null }) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString()
    const keyEmoji = emoji ? String(emoji) : null
    // If same reaction exists → delete; else insert. Also ensure only one of like/dislike at a time.
    db.get(`SELECT id, type, emoji FROM forum_reactions WHERE post_id = ? AND user_id = ? AND type = ? AND (emoji IS ? OR emoji = ?)`, [post_id, user_id, String(type), keyEmoji, keyEmoji], (err, row) => {
      if (err) return reject(err)
      const finish = () => resolve({ ok: true })
      if (row) {
        db.run(`DELETE FROM forum_reactions WHERE id = ?`, [row.id], (e2) => (e2 ? reject(e2) : finish()))
      } else {
        const runInsert = () => db.run(
          `INSERT INTO forum_reactions (post_id, user_id, type, emoji, created_at) VALUES (?, ?, ?, ?, ?)`,
          [post_id, user_id, String(type), keyEmoji, now],
          (e3) => (e3 ? reject(e3) : finish())
        )
        if (type === 'like' || type === 'dislike') {
          db.run(`DELETE FROM forum_reactions WHERE post_id = ? AND user_id = ? AND (type = 'like' OR type = 'dislike')`, [post_id, user_id], (e4) => (e4 ? reject(e4) : runInsert()))
        } else {
          runInsert()
        }
      }
    })
  })
}


export function listMaterialsFiltered({ q = '', subject = '', grade = '', type = '', limit = 20, offset = 0, sort = 'new', favoriteOfUserId = null } = {}) {
  // Defensive coercion and clamping
  const clamp = (n, min, max, d) => {
    const v = Number.isFinite(Number(n)) ? Number(n) : d
    return Math.min(Math.max(v, min), max)
  }
  const safeLimit = clamp(limit, 1, 100, 20)
  const safeOffset = clamp(offset, 0, 10000, 0)
  const safeSort = ['new', 'popular', 'relevance'].includes(String(sort)) ? String(sort) : 'new'
  const safeSubject = String(subject || '').slice(0, 100)
  const safeGrade = String(grade || '').slice(0, 100)
  const safeType = String(type || '').slice(0, 100)

  // Sanitize FTS query to simple prefix matches on tokens: word* word*
  const sanitizeFtsQuery = (input) => {
    const s = String(input || '').normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 200)
    const tokens = s
      .split(/\s+/)
      .map(t => t.replace(/[^\p{L}\p{N}_-]+/gu, '')) // keep letters/numbers/_/-
      .filter(Boolean)
      .slice(0, 6)
    if (!tokens.length) return ''
    return tokens.map(t => `${t}*`).join(' ')
  }

  const where = []
  const params = []
  let useFts = false
  if (safeSubject) { where.push('m.subject = ?'); params.push(safeSubject) }
  if (safeGrade) { where.push('m.grade = ?'); params.push(safeGrade) }
  if (safeType) { where.push('m.type = ?'); params.push(safeType) }
  let joinFts = ''
  const ftsQuery = sanitizeFtsQuery(q)
  if (ftsQuery) { useFts = true }
  if (useFts) {
    joinFts = 'JOIN materials_fts f ON f.rowid = m.id AND f MATCH ?'
    params.unshift(ftsQuery)
  }
  if (favoriteOfUserId != null) {
    where.push('EXISTS (SELECT 1 FROM favorites fav WHERE fav.material_id = m.id AND fav.user_id = ?)')
    params.push(favoriteOfUserId)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  let orderBy = 'datetime(m.created_at) DESC'
  if (safeSort === 'popular') orderBy = 'm.downloads DESC, m.views DESC, datetime(m.created_at) DESC'
  // If FTS is used and sort is relevance (default when q provided), rank by bm25
  const selectRank = useFts ? ', bm25(f) AS rank' : ''
  if (useFts && (safeSort === 'relevance' || safeSort === 'new')) {
    orderBy = 'rank ASC, datetime(m.created_at) DESC'
  }
  const sql = `
    SELECT m.*, u.name AS author_name, u.id AS author_id${selectRank}
    FROM materials m
    JOIN users u ON u.id = m.user_id
    ${joinFts}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `
  const allParams = [...params, safeLimit, safeOffset]
  return new Promise((resolve, reject) => {
    db.all(sql, allParams, (err, rows) => (err ? reject(err) : resolve(rows)))
  })
}

export function getBasicStats() {
  return new Promise((resolve, reject) => {
    const out = { total: 0, topSubjects: [], topGrades: [], popular: [], latest: [] }
    db.get('SELECT COUNT(1) AS cnt FROM materials', [], (e, r) => {
      out.total = (!e && r) ? Number(r.cnt) : 0
      db.all('SELECT subject, COUNT(1) AS cnt FROM materials GROUP BY subject ORDER BY cnt DESC LIMIT 10', [], (e2, rows2) => {
        out.topSubjects = rows2 || []
        db.all('SELECT grade, COUNT(1) AS cnt FROM materials GROUP BY grade ORDER BY cnt DESC LIMIT 10', [], (e3, rows3) => {
          out.topGrades = rows3 || []
          db.all(`SELECT id, title, subject, grade, type, downloads, views, created_at FROM materials ORDER BY downloads DESC, views DESC LIMIT 10`, [], (e4, rows4) => {
            out.popular = rows4 || []
            db.all(`SELECT id, title, subject, grade, type, downloads, views, created_at FROM materials ORDER BY datetime(created_at) DESC LIMIT 10`, [], (e5, rows5) => {
              out.latest = rows5 || []
              resolve(out)
            })
          })
        })
      })
    })
  })
}

export function listMaterialsByUser(user_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT m.*, u.name AS author_name, u.id AS author_id
       FROM materials m
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ?
       ORDER BY datetime(m.created_at) DESC`,
      [user_id],
      (err, rows) => (err ? reject(err) : resolve(rows))
    )
  })
}

export function findMaterialById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM materials WHERE id = ?', [id], (err, row) => (err ? reject(err) : resolve(row)))
  })
}

export function deleteMaterialById(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM materials WHERE id = ?', [id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function updateUserProfile(id, { name, email }) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function updateUserPassword(id, password_hash) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function createMaterialFile({ material_id, file_url, file_name, is_main = 0, size = null, mime_type = null }) {
  return new Promise((resolve, reject) => {
    const created_at = new Date().toISOString()
    db.run(
      `INSERT INTO material_files (material_id, file_url, file_name, is_main, size, mime_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [material_id, file_url, file_name, is_main, size, mime_type, created_at],
      function (err) {
        if (err) return reject(err)
        resolve({ id: this.lastID, material_id, file_url, file_name, is_main, size, mime_type, created_at })
      }
    )
  })
}

export function listFilesByMaterialIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return Promise.resolve([])
  const nums = ids.map(Number).filter(Number.isFinite)
  if (!nums.length) return Promise.resolve([])
  const placeholders = nums.map(() => '?').join(',')
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM material_files WHERE material_id IN (${placeholders}) ORDER BY datetime(created_at) DESC`,
      nums,
      (err, rows) => (err ? reject(err) : resolve(rows))
    )
  })
}

export function findMaterialFileById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM material_files WHERE id = ?', [id], (err, row) => (err ? reject(err) : resolve(row)))
  })
}


export function deleteMaterialFileById(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM material_files WHERE id = ?', [id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function updateMaterial(id, fields) {
  const allowed = ['title', 'subject', 'grade', 'type', 'description', 'link', 'file_url', 'file_name', 'size', 'mime_type']
  const keys = Object.keys(fields).filter((k) => allowed.includes(k))
  if (keys.length === 0) return Promise.resolve({ changes: 0 })
  const setters = keys.map((k) => `${k} = ?`).join(', ')
  const values = keys.map((k) => fields[k])
  return new Promise((resolve, reject) => {
    db.run(`UPDATE materials SET ${setters} WHERE id = ?`, [...values, id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function addFavorite(user_id, material_id) {
  return new Promise((resolve, reject) => {
    const created_at = new Date().toISOString()
    db.run('INSERT OR IGNORE INTO favorites (user_id, material_id, created_at) VALUES (?, ?, ?)', [user_id, material_id, created_at], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function removeFavorite(user_id, material_id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM favorites WHERE user_id = ? AND material_id = ?', [user_id, material_id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function listFavoriteMaterialIds(user_id) {
  return new Promise((resolve, reject) => {
    db.all('SELECT material_id FROM favorites WHERE user_id = ? ORDER BY datetime(created_at) DESC', [user_id], (err, rows) => (err ? reject(err) : resolve(rows.map(r => r.material_id))) )
  })
}

export function incrementViews(material_id) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE materials SET views = coalesce(views,0) + 1 WHERE id = ?', [material_id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}

export function incrementDownloads(material_id) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE materials SET downloads = coalesce(downloads,0) + 1 WHERE id = ?', [material_id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
  })
}
