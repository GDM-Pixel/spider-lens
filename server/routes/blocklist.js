import { Router } from 'express'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/blocklist — liste paginée
router.get('/', (req, res) => {
  const db = getDb()
  const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 1000)
  const offset = parseInt(req.query.offset || '0', 10)
  const search = req.query.search

  const where        = search ? 'WHERE ip LIKE ?' : ''
  const searchParams = search ? [`%${search}%`]   : []

  const rows = db.prepare(`
    SELECT b.id, b.ip, b.reason, b.blocked_at, b.blocked_by, s.name AS site_name
    FROM ip_blocklist b
    LEFT JOIN sites s ON s.id = b.site_id
    ${where}
    ORDER BY b.blocked_at DESC
    LIMIT ? OFFSET ?
  `).all(...searchParams, limit, offset)

  const total = db.prepare(`
    SELECT COUNT(*) AS cnt FROM ip_blocklist ${where}
  `).get(...searchParams)?.cnt || 0

  res.json({ rows, total, limit, offset })
})

// POST /api/blocklist — ajouter une IP
router.post('/', (req, res) => {
  const { ip, reason, siteId } = req.body
  if (!ip || typeof ip !== 'string' || ip.trim().length === 0) {
    return res.status(400).json({ error: 'IP requise' })
  }

  const db = getDb()
  const username = req.user?.username || 'admin'

  try {
    db.prepare(`
      INSERT INTO ip_blocklist (ip, reason, site_id, blocked_by)
      VALUES (?, ?, ?, ?)
    `).run(ip.trim(), reason || null, siteId || null, username)

    const created = db.prepare('SELECT * FROM ip_blocklist WHERE ip = ?').get(ip.trim())
    res.status(201).json(created)
  } catch (e) {
    if (e.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Cette IP est déjà bloquée' })
    }
    throw e
  }
})

// DELETE /api/blocklist/:ip — débloquer
router.delete('/:ip', (req, res) => {
  const db = getDb()
  const ip = decodeURIComponent(req.params.ip)
  const result = db.prepare('DELETE FROM ip_blocklist WHERE ip = ?').run(ip)
  if (result.changes === 0) return res.status(404).json({ error: 'IP non trouvée' })
  res.json({ success: true })
})

// GET /api/blocklist/check/:ip — vérifie si une IP est bloquée
router.get('/check/:ip', (req, res) => {
  const db = getDb()
  const ip = decodeURIComponent(req.params.ip)
  const row = db.prepare('SELECT id FROM ip_blocklist WHERE ip = ?').get(ip)
  res.json({ blocked: !!row })
})

// GET /api/blocklist/export/nginx — règles nginx
router.get('/export/nginx', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT ip, reason FROM ip_blocklist ORDER BY blocked_at DESC').all()

  const lines = [
    '# Spider-Lens — Blocklist IPs (nginx)',
    `# Généré le ${new Date().toLocaleString('fr-FR')}`,
    `# ${rows.length} IP(s) bloquée(s)`,
    '',
    ...rows.map(r => `deny ${r.ip};${r.reason ? '  # ' + r.reason : ''}`),
    '',
    '# Placer ce fichier dans votre bloc server{} ou http{} nginx :',
    '# include /etc/nginx/blocklist.conf;',
  ]

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="spider-lens-blocklist.nginx.conf"')
  res.send(lines.join('\n'))
})

// GET /api/blocklist/export/apache — règles Apache
router.get('/export/apache', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT ip, reason FROM ip_blocklist ORDER BY blocked_at DESC').all()

  const lines = [
    '# Spider-Lens — Blocklist IPs (Apache)',
    `# Généré le ${new Date().toLocaleString('fr-FR')}`,
    `# ${rows.length} IP(s) bloquée(s)`,
    '',
    '<RequireAll>',
    '  Require all granted',
    ...rows.map(r => `  Require not ip ${r.ip}${r.reason ? '  # ' + r.reason : ''}`),
    '</RequireAll>',
    '',
    '# Placer ce bloc dans votre VirtualHost ou .htaccess Apache',
  ]

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="spider-lens-blocklist.apache.conf"')
  res.send(lines.join('\n'))
})

export default router
