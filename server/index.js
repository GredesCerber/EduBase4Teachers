import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import { load as cheerioLoad } from 'cheerio'
import { db, initDb, findUserByEmail, createUser, findUserById, createMaterial, listMaterials, listMaterialsByUser, findMaterialById, deleteMaterialById, updateUserProfile, updateUserPassword, createMaterialFile, listFilesByMaterialIds, updateMaterial, findMaterialFileById, deleteMaterialFileById } from './db.js'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(morgan('dev'))
// Avoid 304 Not Modified on JSON responses which breaks client auth flow (Axios treats 304 as error)
app.set('etag', false)
// Ensure auth endpoints are never cached
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) {
    res.set('Cache-Control', 'no-store, private, max-age=0')
  }
  next()
})

initDb()

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' })
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body
    if (!email || !name || !password) return res.status(400).json({ message: 'Missing fields' })
    const existing = await findUserByEmail(email)
    if (existing) return res.status(409).json({ message: 'Email already in use' })
    const password_hash = await bcrypt.hash(password, 10)
    const user = await createUser({ email, name, password_hash })
    const token = signToken(user)
    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Missing fields' })
  const user = await findUserByEmail(email)
  if (!user) return res.status(401).json({ message: 'Неверный логин или пароль' })
    const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ message: 'Неверный логин или пароль' })
    const token = signToken(user)
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.sub)
    if (!user) return res.status(404).json({ message: 'Not found' })
    return res.json({ user })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Update profile (name/email)
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body
    if (!name || !email) return res.status(400).json({ message: 'Missing fields' })
    // If email is changing, ensure uniqueness
    const existing = await findUserByEmail(email)
    if (existing && existing.id !== req.user.sub) return res.status(409).json({ message: 'Email already in use' })
    await updateUserProfile(req.user.sub, { name: String(name), email: String(email) })
    const user = await findUserById(req.user.sub)
    return res.json({ user })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Change password (requires current password)
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' })
    if (String(newPassword).length < 6) return res.status(400).json({ message: 'Password too short' })
    const userFull = await findUserByEmail(req.user.email)
    if (!userFull) return res.status(404).json({ message: 'Not found' })
    const ok = await bcrypt.compare(String(currentPassword), userFull.password_hash)
    if (!ok) return res.status(401).json({ message: 'Неверный текущий пароль' })
    const password_hash = await bcrypt.hash(String(newPassword), 10)
    await updateUserPassword(req.user.sub, password_hash)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Simple in-memory cache for news
let informCache = { ts: 0, data: [] }
const INFORM_URL = 'https://www.inform.kz/category/obrazovanie_s501'
// Scrape Inform.kz education category
app.get('/api/news/inform', async (_req, res) => {
  try {
    const now = Date.now()
    if (informCache.data.length && now - informCache.ts < 5 * 60 * 1000) {
      return res.json({ items: informCache.data, cached: true })
    }
    const response = await axios.get(INFORM_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EduBaseBot/1.0)' }, timeout: 10000 })
    const $ = cheerioLoad(response.data)

    const items = []

    function absolutize(u) {
      if (!u) return ''
      if (u.startsWith('//')) return `https:${u}`
      if (u.startsWith('/')) return `https://www.inform.kz${u}`
      return u
    }

    function pickFromSrcset(srcset) {
      try {
        // srcset: "url1 320w, url2 640w" → pick the largest (last)
        const parts = String(srcset).split(',').map((s) => s.trim()).filter(Boolean)
        if (!parts.length) return ''
        const last = parts[parts.length - 1].split(' ')[0]
        return last || ''
      } catch { return '' }
    }

    function extractImage(root) {
      const img = root.find('img').first()
      const pic = root.find('picture source').first()
      let src = img.attr('data-src') || img.attr('data-original') || img.attr('data-lazy-src') || img.attr('src') || ''
      if (!src) {
        const ss = pic.attr('srcset') || img.attr('srcset') || ''
        if (ss) src = pickFromSrcset(ss)
      }
      src = (src || '').trim()
      return absolutize(src)
    }

    function isLikelyAd({ root, title, href, image }) {
      const t = (title || '').toLowerCase()
      const h = (href || '').toLowerCase()
      const im = (image || '').toLowerCase()
      const cls = (root.attr('class') || '').toLowerCase()
      const text = (root.text() || '').toLowerCase()
      const adWords = ['реклама', 'на правах рекламы', 'promo', 'промо', 'реклам', 'sponsor', 'sponsored', 'adv', 'banner', 'adfox']
      if (adWords.some((w) => t.includes(w) || text.includes(w))) return true
      if (adWords.some((w) => cls.includes(w))) return true
      if (adWords.some((w) => h.includes(w))) return true
      if (adWords.some((w) => im.includes(w))) return true
      return false
    }

    // The site structure may change; try the most common containers
    $('.list-news__item, .news__item, article').each((_, el) => {
      const root = $(el)
      const linkEl = root.find('a').first()
      let href = linkEl.attr('href') || ''
      href = absolutize(href)
      const title = (linkEl.attr('title') || linkEl.text() || '').trim()
      const image = extractImage(root)
      const summary = (root.find('.list-news__desc, .news__desc, .article__desc, p').first().text() || '').trim()
      const dateText = (root.find('time').attr('datetime') || root.find('time').text() || '').trim()
      if (!title || !href) return
      if (isLikelyAd({ root, title, href, image })) return
      items.push({ title, url: href, image: image || null, summary: summary || null, publishedAt: dateText || null })
    })
    // Fallback: try another structure if none parsed
    if (!items.length) {
      $('a').each((_, el) => {
        const t = ($(el).attr('title') || $(el).text() || '').trim()
        let href = $(el).attr('href') || ''
        if (t && href && href.includes('/ru/')) {
          href = absolutize(href)
          const root = $(el).closest('article, .list-news__item, .news__item')
          const image = extractImage(root)
          if (!isLikelyAd({ root, title: t, href, image })) {
            items.push({ title: t, url: href, image: image || null, summary: null, publishedAt: null })
          }
        }
      })
    }
    informCache = { ts: now, data: items.slice(0, 20) }
    return res.json({ items: informCache.data, cached: false })
  } catch (e) {
    console.error('Inform.kz scrape error', e?.message)
    return res.status(502).json({ message: 'Failed to load news' })
  }
})

// Static for uploaded files
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
function expandPath(p) {
  if (!p) return ''
  let out = String(p)
  out = out.replace(/%([^%]+)%/g, (_m, v) => process.env[String(v)] || _m)
  out = out.replace(/\${([^}]+)}/g, (_m, v) => process.env[String(v)] || _m)
  if (out.startsWith('~')) out = path.join(process.env.HOME || process.env.USERPROFILE || '', out.slice(1))
  if (!path.isAbsolute(out)) out = path.resolve(__dirname, out)
  return out
}

const uploadsDir = process.env.UPLOADS_DIR ? expandPath(process.env.UPLOADS_DIR) : path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

// Multer config
function decodeAndSanitizeOriginal(name) {
  try {
    // Many browsers send filename in latin1; convert to utf8 to avoid mojibake (e.g., "Ð¡ÐÐ ...")
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    // Keep only the base name and replace Windows-illegal characters; allow Cyrillic/Kazakh letters
    const base = path.basename(decoded)
    return base.replace(/[<>:"/\\|?*]/g, '_')
  } catch {
    return path.basename(name)
  }
}
const allowedMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const stamp = Date.now()
    const original = decodeAndSanitizeOriginal(file.originalname)
    // Preserve (decoded) original name; prepend timestamp for uniqueness
    cb(null, `${stamp}_____${original}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.has(file.mimetype)) cb(null, true)
    else cb(new Error('Unsupported file type'))
  },
})

// Create material with optional file upload (auth required)
app.post('/api/materials', authMiddleware, (req, res) => {
  upload.array('file', 10)(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const files = Array.isArray(req.files) ? req.files : []
      const { title, subject, grade, type, link, description } = req.body
      if (!title || !subject || !grade || !type) return res.status(400).json({ message: 'Missing fields' })
      if (!files.length) return res.status(400).json({ message: 'Основной файл обязателен' })

      const base = `${req.protocol}://${req.get('host')}`
      const main = files[0]
      const originalName = decodeAndSanitizeOriginal(main.originalname)
      const created = await createMaterial({
        user_id: req.user.sub,
        title: String(title),
        subject: String(subject),
        grade: String(grade),
        type: String(type),
        description: description ? String(description) : null,
        link: link ? String(link) : null,
        file_url: `${base}/uploads/${main.filename}`,
        file_name: originalName,
        size: main.size,
        mime_type: main.mimetype,
      })
      // Save any remaining uploaded files as additional main files
      const extras = files.slice(1)
      for (const f of extras) {
        try {
          const name = decodeAndSanitizeOriginal(f.originalname)
          await createMaterialFile({ material_id: created.id, file_url: `${base}/uploads/${f.filename}`, file_name: name, is_main: 1, size: f.size, mime_type: f.mimetype })
        } catch (e) {
          console.warn('Failed to create extra attachment for material', created.id, e?.message)
        }
      }
      // Attach author for client convenience
      return res.status(201).json({ material: { ...created, author_name: req.user.name, author_id: req.user.sub } })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: 'Server error' })
    }
  })
})

// Public list of all materials
app.get('/api/materials', async (_req, res) => {
  try {
    const items = await listMaterials()
    const ids = items.map((m) => m.id)
    const files = await listFilesByMaterialIds(ids)
    const filesMap = files.reduce((acc, f) => {
      acc[f.material_id] = acc[f.material_id] || []
      acc[f.material_id].push(f)
      return acc
    }, {})
    const enriched = items.map((m) => ({ ...m, attachments: filesMap[m.id] || [] }))
    return res.json({ materials: enriched })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Authenticated list of materials for the current user
app.get('/api/materials/mine', authMiddleware, async (req, res) => {
  try {
    const items = await listMaterialsByUser(req.user.sub)
    const ids = items.map((m) => m.id)
    const files = await listFilesByMaterialIds(ids)
    const filesMap = files.reduce((acc, f) => {
      acc[f.material_id] = acc[f.material_id] || []
      acc[f.material_id].push(f)
      return acc
    }, {})
    const enriched = items.map((m) => ({ ...m, attachments: filesMap[m.id] || [] }))
    return res.json({ materials: enriched })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Delete a material completely (DB row + uploaded file). Only owner can delete.
app.delete('/api/materials/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

    // Remove file if exists
    if (mat.file_url) {
      const idx = String(mat.file_url).lastIndexOf('/uploads/')
      if (idx !== -1) {
        const rel = String(mat.file_url).slice(idx + '/uploads/'.length)
        // Prevent directory traversal
        const safeRel = path.basename(rel)
        const filePath = path.join(uploadsDir, safeRel)
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch (e) {
          console.warn('Failed to delete file:', filePath, e?.message)
        }
      }
    }

    // Remove attachment files if exist
    try {
      const attachments = await listFilesByMaterialIds([id])
      for (const f of attachments) {
        const idx2 = String(f.file_url).lastIndexOf('/uploads/')
        if (idx2 !== -1) {
          const rel2 = String(f.file_url).slice(idx2 + '/uploads/'.length)
          const safeRel2 = path.basename(rel2)
          const filePath2 = path.join(uploadsDir, safeRel2)
          if (fs.existsSync(filePath2)) {
            try { fs.unlinkSync(filePath2) } catch (e) { console.warn('Failed to delete attachment:', filePath2, e?.message) }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to cleanup attachments for material', id, e?.message)
    }

    const result = await deleteMaterialById(id)
    if (result.changes === 0) return res.status(404).json({ message: 'Not found' })
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Edit material fields (owner only)
app.put('/api/materials/:id', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const mat = await findMaterialById(id)
      if (!mat) return res.status(404).json({ message: 'Not found' })
      if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

      const { title, subject, grade, type, description, link } = req.body
      const fields = {}
      if (title !== undefined) fields.title = String(title)
      if (subject !== undefined) fields.subject = String(subject)
      if (grade !== undefined) fields.grade = String(grade)
      if (type !== undefined) fields.type = String(type)
      if (description !== undefined) fields.description = description === null ? null : String(description)
      if (link !== undefined) fields.link = link === null ? null : String(link)

      // Handle replacing main file
      const file = req.file
      if (file) {
        // Remove previous file from disk if existed
        if (mat.file_url) {
          const idx = String(mat.file_url).lastIndexOf('/uploads/')
          if (idx !== -1) {
            const rel = String(mat.file_url).slice(idx + '/uploads/'.length)
            const safeRel = path.basename(rel)
            const prevPath = path.join(uploadsDir, safeRel)
            try { if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath) } catch (e) { console.warn('Failed to delete old file:', prevPath, e?.message) }
          }
        }
        const base = `${req.protocol}://${req.get('host')}`
        const originalName = decodeAndSanitizeOriginal(file.originalname)
        fields.file_url = `${base}/uploads/${file.filename}`
        fields.file_name = originalName
        fields.size = file.size
        fields.mime_type = file.mimetype
      }

      await updateMaterial(id, fields)
      const after = await findMaterialById(id)
      return res.json({ material: after })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: 'Server error' })
    }
  })
})

// Upload additional files for a material (owner only)
app.post('/api/materials/:id/files', authMiddleware, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const mat = await findMaterialById(id)
      if (!mat) return res.status(404).json({ message: 'Not found' })
      if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
      const base = `${req.protocol}://${req.get('host')}`
      const result = []
      for (const f of req.files || []) {
        const originalName = decodeAndSanitizeOriginal(f.originalname)
        const row = await createMaterialFile({
          material_id: id,
          file_url: `${base}/uploads/${f.filename}`,
          file_name: originalName,
          size: f.size,
          mime_type: f.mimetype,
        })
        result.push(row)
      }
      return res.status(201).json({ files: result })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: 'Server error' })
    }
  })
})

// Upload additional MAIN files for a material (owner only) — does not replace existing main file
app.post('/api/materials/:id/mains', authMiddleware, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const mat = await findMaterialById(id)
      if (!mat) return res.status(404).json({ message: 'Not found' })
      if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
      const base = `${req.protocol}://${req.get('host')}`
      const result = []
      for (const f of req.files || []) {
        const originalName = decodeAndSanitizeOriginal(f.originalname)
        const row = await createMaterialFile({
          material_id: id,
          file_url: `${base}/uploads/${f.filename}`,
          file_name: originalName,
          is_main: 1,
          size: f.size,
          mime_type: f.mimetype,
        })
        result.push(row)
      }
      return res.status(201).json({ files: result })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: 'Server error' })
    }
  })
})

// Mark existing attachment as MAIN (owner only); does not demote others
app.post('/api/files/:id/mark-main', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await findMaterialFileById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    const mat = await findMaterialById(row.material_id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
    await updateMaterial(row.material_id, {}) // no-op to ensure id is valid
    // Set flag
    await new Promise((resolve, reject) => {
      db.run('UPDATE material_files SET is_main = 1 WHERE id = ?', [id], function (err) {
        if (err) return reject(err)
        resolve()
      })
    })
    const files = await listFilesByMaterialIds([row.material_id])
    return res.json({ ok: true, files })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// List files for a material
app.get('/api/materials/:id/files', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const files = await listFilesByMaterialIds([id])
    return res.json({ files })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Download individual attachment by file id
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await findMaterialFileById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    const idx = String(row.file_url).lastIndexOf('/uploads/')
    if (idx === -1) return res.status(400).json({ message: 'Invalid file path' })
    const rel = String(row.file_url).slice(idx + '/uploads/'.length)
    const safeRel = path.basename(rel)
    const filePath = path.join(uploadsDir, safeRel)
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' })
    return res.download(filePath, row.file_name)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Delete individual attachment file (owner only)
app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await findMaterialFileById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    const mat = await findMaterialById(row.material_id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

    // Enforce at least one file must remain for the material
    const allFiles = await listFilesByMaterialIds([row.material_id])
    const total = (mat.file_url ? 1 : 0) + allFiles.length
    if (total <= 1) {
      return res.status(400).json({ message: 'Должен остаться хотя бы один файл' })
    }

    // Try to remove physical file
    try {
      const idx = String(row.file_url).lastIndexOf('/uploads/')
      if (idx !== -1) {
        const rel = String(row.file_url).slice(idx + '/uploads/'.length)
        const safeRel = path.basename(rel)
        const filePath = path.join(uploadsDir, safeRel)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
    } catch (e) {
      console.warn('Failed to remove attachment file from disk', e?.message)
    }

    await deleteMaterialFileById(id)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Delete legacy main file of a material (owner only); requires at least one other file to remain
app.delete('/api/materials/:id/main', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
    if (!mat.file_url) return res.status(400).json({ message: 'Нет основного файла' })

    const others = await listFilesByMaterialIds([id])
    if (!others || others.length === 0) {
      return res.status(400).json({ message: 'Должен остаться хотя бы один файл' })
    }

    // Remove physical file
    try {
      const idx = String(mat.file_url).lastIndexOf('/uploads/')
      if (idx !== -1) {
        const rel = String(mat.file_url).slice(idx + '/uploads/'.length)
        const safeRel = path.basename(rel)
        const filePath = path.join(uploadsDir, safeRel)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
    } catch (e) {
      console.warn('Failed to remove main file from disk', e?.message)
    }

    // Null out main file fields
    await updateMaterial(id, { file_url: null, file_name: null, size: null, mime_type: null })
    const updated = await findMaterialById(id)
    const files = await listFilesByMaterialIds([id])
    return res.json({ ok: true, material: updated, files })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Promote an attachment to be the main file of a material (owner only)
app.post('/api/materials/:id/files/:fileId/make-main', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    if (mat.user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
    const row = await findMaterialFileById(fileId)
    if (!row || row.material_id !== id) return res.status(404).json({ message: 'File not found' })

    // Move current main to attachments (if exists)
    if (mat.file_url && mat.file_name) {
      try {
        await createMaterialFile({
          material_id: id,
          file_url: mat.file_url,
          file_name: mat.file_name,
          size: mat.size || null,
          mime_type: mat.mime_type || null,
        })
      } catch (e) {
        console.warn('Failed to archive previous main file', e?.message)
      }
    }

    // Update material to use the attachment as main
    await updateMaterial(id, {
      file_url: row.file_url,
      file_name: row.file_name,
      size: row.size || null,
      mime_type: row.mime_type || null,
    })
    // Remove the attachment row (now it's main)
    await deleteMaterialFileById(fileId)

    const updated = await findMaterialById(id)
    const files = await listFilesByMaterialIds([id])
    return res.json({ material: updated, files })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Download a material with the original filename
app.get('/api/materials/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    if (!mat.file_url || !mat.file_name) return res.status(400).json({ message: 'No file for this material' })

    const idx = String(mat.file_url).lastIndexOf('/uploads/')
    if (idx === -1) return res.status(400).json({ message: 'Invalid file path' })
    const rel = String(mat.file_url).slice(idx + '/uploads/'.length)
    const safeRel = path.basename(rel)
    const filePath = path.join(uploadsDir, safeRel)
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' })

    // Let Express set proper Content-Disposition with original name
    return res.download(filePath, mat.file_name)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Auth API listening on http://localhost:${PORT}`)
})

process.on('SIGINT', () => {
  db.close()
  process.exit(0)
})
