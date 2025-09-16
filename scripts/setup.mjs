import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.join(__dirname, '..')

function ensureFile(from, to) {
  try {
    if (!fs.existsSync(to) && fs.existsSync(from)) {
      fs.copyFileSync(from, to)
      console.log(`[setup] Created ${path.relative(root, to)} from example`)
    }
  } catch (e) {
    console.warn(`[setup] Failed to create ${to}:`, e?.message)
  }
}

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`[setup] Created directory ${path.relative(root, dir)}`)
    }
  } catch (e) {
    console.warn(`[setup] Failed to create directory ${dir}:`, e?.message)
  }
}

// Create frontend .env from example if missing
ensureFile(path.join(root, '.env.example'), path.join(root, '.env'))

// Create backend .env from example if missing
ensureFile(path.join(root, 'server', '.env.example'), path.join(root, 'server', '.env'))

// Ensure uploads directory exists
ensureDir(path.join(root, 'server', 'uploads'))

console.log('[setup] Done')
