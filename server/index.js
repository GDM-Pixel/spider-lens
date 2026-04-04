import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

// ── Validation des secrets critiques ─────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.warn('[warn] GEMINI_API_KEY absente — l\'assistant IA sera désactivé.')
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET manquant ou trop court (minimum 32 caractères). Arrêt.')
  process.exit(1)
}
if (process.env.JWT_SECRET === 'spider-lens-dev-secret-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET utilise la valeur par défaut. Générez une clé unique : openssl rand -hex 32')
    process.exit(1)
  } else {
    console.warn('[warn] JWT_SECRET par défaut — à changer avant mise en production.')
  }
}
if (!process.env.ADMIN_PASS || process.env.ADMIN_PASS === 'spider-lens-change-me') {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] ADMIN_PASS par défaut détecté en production. Changez-le dans .env. Arrêt.')
    process.exit(1)
  } else {
    console.warn('[warn] ADMIN_PASS par défaut — à changer avant mise en production.')
  }
}

import { getDb, startRetentionCron } from './db/database.js'
import authRoutes from './routes/auth.js'
import statsRoutes from './routes/stats.js'
import alertRoutes from './routes/alerts.js'
import sitesRoutes from './routes/sites.js'
import networkRoutes from './routes/network.js'
import blocklistRoutes from './routes/blocklist.js'
import adminRoutes from './routes/admin.js'
import assistantRoutes from './routes/assistant.js'
import { startCron } from './services/cron.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// ── Middlewares ───────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production'

// ── Trust proxy (requis derrière Nginx) ──────────────────
if (isProd) app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // requis pour Tailwind inline styles
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
}))
app.use(cors({ origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : false }))
app.use(express.json())

// ── API Routes ───────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/sites', sitesRoutes)
app.use('/api/network', networkRoutes)
app.use('/api/blocklist', blocklistRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/assistant', assistantRoutes)

// ── Sanity check ─────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '0.7.0' }))

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(err.statusCode || 500).json(
    isProd
      ? { error: 'Internal server error' }
      : { error: err.message, stack: err.stack }
  )
})

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
    console.log(`[init] Utilisateur admin créé : "${username}" — changez le mot de passe dans Settings.`)
  }
}

// ── Démarrage ─────────────────────────────────────────────
ensureAdminUser()
startCron()
startRetentionCron()

app.listen(PORT, () => {
  console.log(`\n🕷️  Spider-Lens v0.7.0 — http://localhost:${PORT}`)
  console.log(`   Mode : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   DB   : ${process.env.DB_PATH || './spider-lens.db'}`)
  console.log(`   Logs : ${process.env.LOG_FILE_PATH || '(non configuré)'}`)
})
