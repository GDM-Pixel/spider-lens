import { Router } from 'express'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/sites — liste des sites
router.get('/', (req, res) => {
  const db = getDb()
  const sites = db.prepare('SELECT * FROM sites ORDER BY created_at ASC').all()
  res.json(sites)
})

// POST /api/sites — créer un site
router.post('/', (req, res) => {
  const { name, log_file_path } = req.body
  if (!name?.trim() || !log_file_path?.trim()) {
    return res.status(400).json({ error: 'Nom et chemin du fichier log requis' })
  }

  const db = getDb()
  try {
    const result = db.prepare(
      'INSERT INTO sites (name, log_file_path) VALUES (?, ?)'
    ).run(name.trim(), log_file_path.trim())
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(site)
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Un site avec ce nom ou ce fichier log existe déjà' })
    }
    throw e
  }
})

// PUT /api/sites/:id — modifier un site
router.put('/:id', (req, res) => {
  const db = getDb()
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id)
  if (!site) return res.status(404).json({ error: 'Site introuvable' })

  const name         = req.body.name?.trim()         ?? site.name
  const log_file_path = req.body.log_file_path?.trim() ?? site.log_file_path
  const active       = req.body.active !== undefined  ? (req.body.active ? 1 : 0) : site.active

  try {
    db.prepare(
      'UPDATE sites SET name = ?, log_file_path = ?, active = ? WHERE id = ?'
    ).run(name, log_file_path, active, site.id)
    res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id))
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Un site avec ce nom ou ce fichier log existe déjà' })
    }
    throw e
  }
})

// DELETE /api/sites/:id — supprimer un site
router.delete('/:id', (req, res) => {
  const db = getDb()
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id)
  if (!site) return res.status(404).json({ error: 'Site introuvable' })

  // On ne supprime pas les log_entries (on les garde avec site_id pour l'historique)
  db.prepare('DELETE FROM sites WHERE id = ?').run(site.id)
  res.json({ success: true })
})

export default router
