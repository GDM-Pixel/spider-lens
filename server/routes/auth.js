import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Rate limiter : 5 tentatives par 15 minutes par IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
})

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants manquants' })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

  if (!user) {
    return res.status(401).json({ error: 'Identifiants incorrects' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants incorrects' })
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, username: user.username })
})

// POST /api/auth/change-password (authentification requise)
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Champs manquants' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' })
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id)

  res.json({ success: true })
})

// POST /api/auth/change-username (authentification requise)
router.post('/change-username', requireAuth, (req, res) => {
  const { newUsername, currentPassword } = req.body

  if (!newUsername || !currentPassword) {
    return res.status(400).json({ error: 'Champs manquants' })
  }
  const trimmed = newUsername.trim()
  if (trimmed.length < 3) {
    return res.status(400).json({ error: "Le nom d'utilisateur doit faire au moins 3 caractères" })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(trimmed, user.id)
  if (existing) {
    return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris" })
  }

  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(trimmed, user.id)

  res.json({ success: true, username: trimmed })
})

export default router
