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
    db.run('PRAGMA foreign_keys = ON')
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
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
  db.run('CREATE INDEX IF NOT EXISTS idx_material_files_material_id ON material_files(material_id)')

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
    db.run(
      'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [normalizedEmail, String(name), password_hash, created_at],
      function (err) {
        if (err) reject(err)
        else resolve({ id: this.lastID, email: normalizedEmail, name: String(name), password_hash, created_at })
      }
    )
  })
}

export function findUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [id], (err, row) => {
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


export function listMaterialsFiltered({ q = '', subject = '', grade = '', type = '', limit = 20, offset = 0, sort = 'new', favoriteOfUserId = null } = {}) {
  const where = []
  const params = []
  let useFts = false
  if (subject) { where.push('m.subject = ?'); params.push(subject) }
  if (grade) { where.push('m.grade = ?'); params.push(grade) }
  if (type) { where.push('m.type = ?'); params.push(type) }
  if (q) { useFts = true }
  let joinFts = ''
  if (useFts) {
    joinFts = 'JOIN materials_fts f ON f.rowid = m.id AND f MATCH ?'
    params.unshift(`${q.replace(/"/g, '""')}*`)
  }
  if (favoriteOfUserId != null) {
    where.push('EXISTS (SELECT 1 FROM favorites fav WHERE fav.material_id = m.id AND fav.user_id = ?)')
    params.push(favoriteOfUserId)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  let orderBy = 'datetime(m.created_at) DESC'
  if (sort === 'popular') orderBy = 'm.downloads DESC, m.views DESC, datetime(m.created_at) DESC'
  // If FTS is used and sort is relevance (default when q provided), rank by bm25
  const selectRank = useFts ? ', bm25(f) AS rank' : ''
  if (useFts && (sort === 'relevance' || sort === 'new')) {
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
  const allParams = [...params, Number(limit), Number(offset)]
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
  if (!ids.length) return Promise.resolve([])
  const placeholders = ids.map(() => '?').join(',')
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM material_files WHERE material_id IN (${placeholders}) ORDER BY datetime(created_at) DESC`,
      ids,
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
