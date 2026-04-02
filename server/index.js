import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

import { getDb } from './db/database.js'
import authRoutes from './routes/auth.js'
import statsRoutes from './routes/stats.js'
import alertRoutes from './routes/alerts.js'
import sitesRoutes from './routes/sites.js'
import networkRoutes from './routes/network.js'
import blocklistRoutes from './routes/blocklist.js'
import { startCron } from './services/cron.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// ── Middlewares ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : false }))
app.use(express.json())

// ── API Routes ───────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/sites', sitesRoutes)
app.use('/api/network', networkRoutes)
app.use('/api/blocklist', blocklistRoutes)

// ── Sanity check ─────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '0.7.0' }))

// ── Serve frontend (production) ───────────────────────────
const clientDist = join(__dirname, '..', 'client', 'dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(clientDist, 'index.html'))
    }
  })
}

// ── Init DB + premier utilisateur ────────────────────────
function ensureAdminUser() {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get()
  if (!existing) {
    const username = process.env.ADMIN_USER || 'admin'
    const password = process.env.ADMIN_PASS || 'spider-lens-change-me'
    const hash = bcrypt.hashSync(password, 10)
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash)
    console.log(`[init] Utilisateur créé : ${username} / ${password}`)
    console.log('[init] ⚠️  Changez ce mot de passe dans Settings dès la première connexion !')
  }
}

// ── Démarrage ─────────────────────────────────────────────
ensureAdminUser()
startCron()

app.listen(PORT, () => {
  console.log(`\n🕷️  Spider-Lens v0.7.0 — http://localhost:${PORT}`)
  console.log(`   Mode : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   DB   : ${process.env.DB_PATH || './spider-lens.db'}`)
  console.log(`   Logs : ${process.env.LOG_FILE_PATH || '(non configuré)'}`)
})
