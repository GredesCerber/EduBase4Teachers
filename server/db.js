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

    // Ensure description column exists for older DBs
    db.all(`PRAGMA table_info(materials)`, [], (err, rows) => {
      if (err) return
      const hasDesc = Array.isArray(rows) && rows.some((r) => r.name === 'description')
      if (!hasDesc) {
        db.run('ALTER TABLE materials ADD COLUMN description TEXT')
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

export function listMaterials() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT m.*, u.name AS author_name, u.id AS author_id
       FROM materials m
       JOIN users u ON u.id = m.user_id
       ORDER BY datetime(m.created_at) DESC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows))
    )
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

export function deleteFilesByMaterialId(material_id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM material_files WHERE material_id = ?', [material_id], function (err) {
      if (err) return reject(err)
      resolve({ changes: this.changes })
    })
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
