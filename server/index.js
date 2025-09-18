import express from 'express'
import morgan from 'morgan'
import compression from 'compression'
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
import { db, initDb, findUserByEmail, createUser, findUserById, createMaterial, listMaterialsByUser, listMaterialsFiltered, findMaterialById, deleteMaterialById, updateUserProfile, updateUserPassword, createMaterialFile, listFilesByMaterialIds, updateMaterial, findMaterialFileById, deleteMaterialFileById, addFavorite, removeFavorite, listFavoriteMaterialIds, incrementViews, incrementDownloads, getBasicStats, createForumThread, listForumThreads, getForumThread, createForumPost, addForumPostFile, listForumPosts, listForumFilesByPostIds, listForumReactionsByPostIds, toggleForumReaction, countThreadLikes, userLikedThread, toggleThreadLike } from './db.js'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

// Security and proxy sanity
app.disable('x-powered-by')
// If you use tunnels or reverse proxies in dev, this helps Express compute protocol/host correctly
app.set('trust proxy', true)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}
app.use(compression())
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

// Promote any existing users whose emails are in ADMIN_EMAILS/ADMIN_EMAIL at startup
function syncAdminEmails() {
  try {
    const adminList = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (!adminList.length) return
    const placeholders = adminList.map(() => '?').join(',')
    db.run(`UPDATE users SET is_admin = 1 WHERE lower(email) IN (${placeholders})`, adminList, function (err) {
      if (err) {
        console.error('Failed to sync admin emails:', err)
      } else if (typeof this?.changes === 'number' && this.changes > 0) {
        console.log(`Synced admin emails: promoted ${this.changes} user(s) to admin`)
      }
    })
  } catch (e) {
    console.error('Error during admin sync:', e)
  }
}

syncAdminEmails()

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' })
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

// Optional auth: attach req.user if token is valid, otherwise continue silently
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return next()
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
  } catch {}
  next()
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
    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin } })
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
    // Auto-promote to admin if email is now in ADMIN_EMAILS
    try {
      const adminList = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      const shouldBeAdmin = adminList.includes(String(user.email).toLowerCase())
      if (shouldBeAdmin && !user.is_admin) {
        await new Promise((resolve, reject) => db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id], function (err) { if (err) reject(err); else resolve() }))
        user.is_admin = 1
      }
    } catch {}
    const token = signToken(user)
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.sub)
    if (!user) return res.status(404).json({ message: 'Not found' })
    // Auto-promote here as well so existing sessions reflect admin without re-login
    try {
      const adminList = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      const shouldBeAdmin = adminList.includes(String(user.email).toLowerCase())
      if (shouldBeAdmin && !user.is_admin) {
        await new Promise((resolve, reject) => db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id], function (err) { if (err) reject(err); else resolve() }))
        user.is_admin = 1
      }
    } catch {}
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
app.get('/api/stats', async (_req, res) => {
  try {
    const stats = await getBasicStats()
    res.json(stats)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Forum endpoints
// List threads
app.get('/api/forum/threads', optionalAuth, async (req, res) => {
  try {
    const { q = '', limit = 20, offset = 0, sort = 'new' } = req.query
    const safeSort = ['new','top','active'].includes(String(sort)) ? String(sort) : 'new'
    // Build orderBy SQL fragment
    let orderBy = 'datetime(coalesce(t.last_post_at, t.created_at)) DESC'
    if (safeSort === 'top') orderBy = 'likes_count DESC, datetime(coalesce(t.last_post_at, t.created_at)) DESC'
    if (safeSort === 'active') orderBy = 'datetime(coalesce(t.last_post_at, t.created_at)) DESC'
    // list with dynamic order; we inject the fragment by string replace in db layer call
    const items = await listForumThreads({ q, limit, offset, sort: safeSort })
    // If user authenticated, mark my_like
    const uid = req.user?.sub || null
    if (uid) {
      for (const t of items) {
        t.my_like = await new Promise((resolve) => db.get('SELECT 1 FROM forum_thread_likes WHERE thread_id = ? AND user_id = ?', [t.id, uid], (e, r) => resolve(!!r)))
      }
    }
    res.json({ threads: items })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create thread (auth)
app.post('/api/forum/threads', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body
    if (!title || String(title).trim().length < 3) return res.status(400).json({ message: 'Слишком короткий заголовок' })
    const th = await createForumThread({ user_id: req.user.sub, title: String(title).trim() })
    res.status(201).json({ thread: th })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get a thread with posts (optional auth to include my reactions)
app.get('/api/forum/threads/:id', optionalAuth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const thread = await getForumThread(id)
    if (!thread) return res.status(404).json({ message: 'Not found' })
  const posts = await listForumPosts(id, { limit: 200, offset: 0 })
    const postIds = posts.map((p) => p.id)
    const files = await listForumFilesByPostIds(postIds)
    const reactions = await listForumReactionsByPostIds(postIds)
    const groupedFiles = new Map()
    for (const f of files) {
      const arr = groupedFiles.get(f.post_id) || []
      arr.push(f)
      groupedFiles.set(f.post_id, arr)
    }
    const groupedReactions = new Map()
    for (const r of reactions) {
      const arr = groupedReactions.get(r.post_id) || []
      arr.push(r)
      groupedReactions.set(r.post_id, arr)
    }
    const userId = req.user?.sub || null
    const enriched = posts.map((p) => {
      const pf = groupedFiles.get(p.id) || []
      const pr = groupedReactions.get(p.id) || []
      const likes = pr.filter((r) => r.type === 'like').length
      const dislikes = pr.filter((r) => r.type === 'dislike').length
      const emojiCounts = {}
      for (const r of pr) if (r.type === 'emoji' && r.emoji) {
        emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1
      }
      const my = userId ? pr.filter((r) => r.user_id === userId).map((r) => ({ type: r.type, emoji: r.emoji || null })) : []
      return { ...p, files: pf, reactions: { likes, dislikes, emojis: emojiCounts, my } }
    })
    // Add likes meta for thread
    const likes = await countThreadLikes(id)
    const my_like = req.user?.sub ? await userLikedThread(id, req.user.sub) : false
    res.json({ thread: { ...thread, likes_count: likes, my_like }, posts: enriched })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Toggle like for a thread
app.post('/api/forum/threads/:id/like', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    await toggleThreadLike({ thread_id: id, user_id: req.user.sub })
    const likes = await countThreadLikes(id)
    const my_like = await userLikedThread(id, req.user.sub)
    res.json({ likes_count: likes, my_like })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Post a message with optional files (auth)
app.post('/api/forum/threads/:id/posts', authMiddleware, (req, res) => {
  forumUpload.array('files', 10)(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const content = String(req.body.content || '').trim()
      if (!content && (!req.files || !Array.isArray(req.files) || req.files.length === 0)) {
        return res.status(400).json({ message: 'Пустое сообщение' })
      }
      const post = await createForumPost({ thread_id: id, user_id: req.user.sub, content })
      const base = `${req.protocol}://${req.get('host')}`
      const files = Array.isArray(req.files) ? req.files : []
      for (const f of files) {
        try {
          const name = decodeAndSanitizeOriginal(f.originalname)
          await addForumPostFile({ post_id: post.id, file_url: `${base}/uploads/${f.filename}`, file_name: name, size: f.size, mime_type: f.mimetype })
        } catch {}
      }
      return res.status(201).json({ postId: post.id })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: 'Server error' })
    }
  })
})

// Toggle reaction for a post (auth)
app.post('/api/forum/posts/:id/react', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const { type, emoji } = req.body
    const allowed = ['like', 'dislike', 'emoji']
    if (!allowed.includes(String(type))) return res.status(400).json({ message: 'Invalid reaction' })
    await toggleForumReaction({ post_id: id, user_id: req.user.sub, type: String(type), emoji: emoji ? String(emoji) : null })
    // Return updated counts for this post
    const rs = await listForumReactionsByPostIds([id])
    const pr = rs.filter((r) => r.post_id === id)
    const likes = pr.filter((r) => r.type === 'like').length
    const dislikes = pr.filter((r) => r.type === 'dislike').length
    const emojiCounts = {}
    for (const r of pr) if (r.type === 'emoji' && r.emoji) {
      emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1
    }
    const my = pr.filter((r) => r.user_id === req.user.sub).map((r) => ({ type: r.type, emoji: r.emoji || null }))
    res.json({ reactions: { likes, dislikes, emojis: emojiCounts, my } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

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
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
    }
    const response = await axios.get(INFORM_URL, { headers: commonHeaders, timeout: 8000 })
    const $ = cheerioLoad(response.data)

    const items = []

    // Proxy helper to avoid hotlink restrictions on some images
    const proxify = (u) => {
      const s = String(u || '').trim()
      if (!s) return ''
      // Avoid double-proxying
      if (s.startsWith('/api/news/image')) return s
      return `/api/news/image?u=${encodeURIComponent(s)}`
    }

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
      let candidates = []
      // Common lazy attrs
      const imgSrc = img.attr('data-src') || img.attr('data-original') || img.attr('data-lazy-src') || img.attr('data-lazysrc') || img.attr('data-ll-src') || img.attr('src') || ''
      const imgSrcset = img.attr('data-srcset') || img.attr('data-lazy-srcset') || img.attr('srcset') || ''
      if (imgSrcset) candidates.push(pickFromSrcset(imgSrcset))
      if (imgSrc) candidates.push(imgSrc)
      // All <source> in <picture>
      root.find('picture source').each((_, s) => {
        const ss = (s.attribs && (s.attribs['data-srcset'] || s.attribs['srcset'])) || ''
        if (ss) candidates.push(pickFromSrcset(ss))
      })
      // Fallback: any element with background-image style
      const styleBg = (root.attr('style') || '').match(/background-image:\s*url\(['\"]?([^'\")]+)['\"]?\)/i)
      if (styleBg && styleBg[1]) candidates.push(styleBg[1])
      // Normalize and pick the first valid
      for (const c of candidates.map((x) => (x || '').trim()).filter(Boolean)) {
        const abs = absolutize(c)
        if (abs && !abs.startsWith('data:')) return abs
      }
      return ''
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
  items.push({ title, url: href, image: image ? proxify(image) : null, summary: summary || null, publishedAt: dateText || null })
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
            items.push({ title: t, url: href, image: image ? proxify(image) : null, summary: null, publishedAt: null })
          }
        }
      })
    }
    // Return quickly with basic items (no blocking on OG fetch)
    const initial = items.slice(0, 20)
    informCache = { ts: now, data: initial }
    // Kick off background enrichment of missing images
    try {
      const needOg = items.filter((it) => !it.image)
      async function mapLimit(arr, limit, fn) {
        const ret = []
        const executing = []
        for (const [i, item] of arr.entries()) {
          const p = Promise.resolve().then(() => fn(item, i))
          ret.push(p)
          if (limit > 0) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1))
            executing.push(e)
            if (executing.length >= limit) await Promise.race(executing)
          }
        }
        return Promise.all(ret)
      }
      if (needOg.length) {
        // Run after response is sent
        setImmediate(async () => {
          try {
            await mapLimit(needOg.slice(0, 20), 4, async (it) => {
              try {
                const page = await axios.get(it.url, { headers: commonHeaders, timeout: 10000 })
                const $$ = cheerioLoad(page.data)
                // Try multiple meta candidates
                let img =
                  $$('meta[property="og:image"]').attr('content') ||
                  $$('meta[name="twitter:image"]').attr('content') ||
                  $$('meta[itemprop="image"]').attr('content') ||
                  $$('link[rel="image_src"]').attr('href') ||
                  ''
                if (!img) {
                  // try first prominent article image or any image in content
                  const aimg = $$('article img').first().attr('src')
                    || $$('article img').first().attr('data-src')
                    || $$('img').first().attr('data-src')
                    || $$('img').first().attr('src')
                    || ''
                  img = aimg
                  if (!img) {
                    const ss = $$('article img').first().attr('data-srcset') || $$('article img').first().attr('srcset') || ''
                    if (ss) img = pickFromSrcset(ss)
                  }
                }
                img = (img || '').trim()
                if (img) {
                  const abs = absolutize(img)
                  if (abs && !abs.startsWith('data:')) it.image = proxify(abs)
                }
              } catch {}
            })
            // Update cache with enriched data (without resetting freshness window)
            informCache = { ts: Date.now(), data: items.slice(0, 20) }
          } catch {}
        })
      }
    } catch {}
    return res.json({ items: initial, cached: false })
  } catch (e) {
    console.error('Inform.kz scrape error', e?.message)
    // Graceful fallback: do not break UI – return cached (or empty) items
    const fallback = Array.isArray(informCache.data) ? informCache.data : []
    return res.status(200).json({ items: fallback, cached: true })
  }
})

// Secure image proxy for news (to bypass hotlink restrictions)
app.get('/api/news/image', async (req, res) => {
  try {
    const u = String(req.query.u || '')
    if (!u) return res.status(400).end()
    let url
    try { url = new URL(u) } catch { return res.status(400).end() }
    const allowedHosts = new Set([
      'www.inform.kz', 'inform.kz',
      'static.inform.kz', 's.inform.kz',
      'cdn.inform.kz', 'img.inform.kz'
    ])
    if (!allowedHosts.has(url.hostname)) return res.status(403).end()
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.inform.kz/',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
    }
    const r = await axios.get(url.toString(), { headers, timeout: 10000, responseType: 'arraybuffer', validateStatus: (s) => s >= 200 && s < 400 })
    const ct = r.headers['content-type'] || 'image/jpeg'
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=1800, immutable')
    return res.send(Buffer.from(r.data))
  } catch (e) {
    return res.status(204).end()
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
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true }))

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

// Forum uploads: allow a broader, but still safe set of types
const allowedForumMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
])

const forumUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedForumMimes.has(file.mimetype)) return cb(null, true)
    // Allow some files that come as octet-stream based on extension
    if (file.mimetype === 'application/octet-stream') {
      const ext = String(file.originalname || '').toLowerCase().split('.').pop()
      const allowedExt = new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','txt','jpg','jpeg','png','gif','webp','zip','rar','7z'])
      if (ext && allowedExt.has(ext)) return cb(null, true)
    }
    return cb(new Error('Unsupported file type'))
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
app.get('/api/materials', async (req, res) => {
  try {
    const { q = '', subject = '', grade = '', type = '', limit = '20', offset = '0', sort = 'new', favorite } = req.query || {}
    // Normalize and clamp inputs to prevent abuse and reduce SQL injection surface
    const clamp = (n, min, max, d) => { const v = Number.isFinite(Number(n)) ? Number(n) : d; return Math.min(Math.max(v, min), max) }
    const norm = {
      q: String(q || '').slice(0, 200),
      subject: String(subject || '').slice(0, 100),
      grade: String(grade || '').slice(0, 100),
      type: String(type || '').slice(0, 100),
      limit: clamp(limit, 1, 100, 20),
      offset: clamp(offset, 0, 10000, 0),
      sort: ['new', 'popular', 'relevance'].includes(String(sort)) ? String(sort) : 'new',
    }
    const favoriteOfUserId = favorite && String(favorite) === '1' && req.headers.authorization ? (() => {
      try {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        if (!token) return null
        const payload = jwt.verify(token, JWT_SECRET)
        return payload?.sub || null
      } catch { return null }
    })() : null
    const items = await listMaterialsFiltered({ q: norm.q, subject: norm.subject, grade: norm.grade, type: norm.type, limit: norm.limit, offset: norm.offset, sort: norm.sort, favoriteOfUserId })
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

// Favorites endpoints
app.get('/api/materials/favorites', authMiddleware, async (req, res) => {
  try {
    // Reuse filtered list with favoriteOfUserId
    const items = await listMaterialsFiltered({ favoriteOfUserId: req.user.sub, limit: 100, offset: 0, sort: 'new' })
    const ids = items.map((m) => m.id)
    const files = await listFilesByMaterialIds(ids)
    const filesMap = files.reduce((acc, f) => { (acc[f.material_id] ||= []).push(f); return acc }, {})
    const enriched = items.map((m) => ({ ...m, attachments: filesMap[m.id] || [] }))
    return res.json({ materials: enriched })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/materials/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    await addFavorite(req.user.sub, id)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/materials/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    await removeFavorite(req.user.sub, id)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Views counter
app.post('/api/materials/:id/view', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
    await incrementViews(id)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Delete a material completely (DB row + uploaded file). Only owner or admin can delete.
app.delete('/api/materials/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })

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

// Edit material fields (owner or admin)
app.put('/api/materials/:id', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const mat = await findMaterialById(id)
      if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })

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

// Upload additional files for a material (owner or admin)
app.post('/api/materials/:id/files', authMiddleware, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const mat = await findMaterialById(id)
      if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })
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

// Upload additional MAIN files for a material (owner or admin) — does not replace existing main file
app.post('/api/materials/:id/mains', authMiddleware, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || 'Upload error' })
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
      const mat = await findMaterialById(id)
      if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })
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

// Mark existing attachment as MAIN (owner or admin); does not demote others
app.post('/api/files/:id/mark-main', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await findMaterialFileById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    const mat = await findMaterialById(row.material_id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })
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
    try { await incrementDownloads(row.material_id) } catch {}
    return res.download(filePath, row.file_name)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Delete individual attachment file (owner or admin)
app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const row = await findMaterialFileById(id)
    if (!row) return res.status(404).json({ message: 'Not found' })
    const mat = await findMaterialById(row.material_id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })

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

// Delete legacy main file of a material (owner or admin); requires at least one other file to remain
app.delete('/api/materials/:id/main', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })
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

// Promote an attachment to be the main file of a material (owner or admin)
app.post('/api/materials/:id/files/:fileId/make-main', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) return res.status(400).json({ message: 'Invalid id' })
    const mat = await findMaterialById(id)
    if (!mat) return res.status(404).json({ message: 'Not found' })
  if (mat.user_id !== req.user.sub && !req.user.is_admin) return res.status(403).json({ message: 'Forbidden' })
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
  try { await incrementDownloads(id) } catch {}

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

// Place 404 and error handlers at the very end so they don't shadow real routes
// Simple 404 for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

// Central error handler (keeps logs cleaner)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Server error' })
})
