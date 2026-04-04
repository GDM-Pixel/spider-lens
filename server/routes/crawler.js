import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getDb } from '../db/database.js'
import { startCrawl, cancelCrawl, getCrawlStatus } from '../services/crawler.js'

const router = Router()
router.use(requireAuth)

// ── Sitemaps CRUD ─────────────────────────────────────────

// GET /api/crawler/:siteId/sitemaps
router.get('/:siteId/sitemaps', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })
  const db = getDb()
  const rows = db.prepare('SELECT id, url, created_at FROM site_sitemaps WHERE site_id = ? ORDER BY id ASC').all(siteId)
  res.json(rows)
})

// POST /api/crawler/:siteId/sitemaps
router.post('/:siteId/sitemaps', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })
  const { url } = req.body
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url requise' })

  // Validation basique de l'URL
  try { new URL(url) } catch { return res.status(400).json({ error: 'URL invalide' }) }

  const db = getDb()
  // Vérifier que le site existe
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId)
  if (!site) return res.status(404).json({ error: 'Site introuvable' })

  try {
    const result = db.prepare('INSERT INTO site_sitemaps (site_id, url) VALUES (?, ?)').run(siteId, url.trim())
    res.status(201).json({ id: result.lastInsertRowid, site_id: siteId, url: url.trim() })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce sitemap est déjà configuré pour ce site' })
    throw e
  }
})

// DELETE /api/crawler/:siteId/sitemaps/:id
router.delete('/:siteId/sitemaps/:id', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  const id     = parseInt(req.params.id)
  if (!siteId || !id) return res.status(400).json({ error: 'Paramètres invalides' })
  const db = getDb()
  const result = db.prepare('DELETE FROM site_sitemaps WHERE id = ? AND site_id = ?').run(id, siteId)
  if (!result.changes) return res.status(404).json({ error: 'Sitemap introuvable' })
  res.json({ success: true })
})

// ── Contrôle du crawl ─────────────────────────────────────

// POST /api/crawler/:siteId/start
router.post('/:siteId/start', async (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })

  const status = getCrawlStatus(siteId)
  if (status?.status === 'running' || status?.status === 'cancelling') {
    return res.status(409).json({ error: 'Un crawl est déjà en cours pour ce site' })
  }

  const { maxDepth, maxPages, delayMs } = req.body || {}

  try {
    const { runId } = await startCrawl(siteId, {
      maxDepth: maxDepth ? parseInt(maxDepth) : undefined,
      maxPages: maxPages ? parseInt(maxPages) : undefined,
      delayMs:  delayMs  ? parseInt(delayMs)  : undefined,
    })
    res.json({ runId, status: 'running' })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// POST /api/crawler/:siteId/cancel
router.post('/:siteId/cancel', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })
  const cancelled = cancelCrawl(siteId)
  if (!cancelled) return res.status(404).json({ error: 'Aucun crawl en cours pour ce site' })
  res.json({ success: true, status: 'cancelling' })
})

// GET /api/crawler/:siteId/status
router.get('/:siteId/status', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })
  const status = getCrawlStatus(siteId)
  res.json(status || { status: 'idle', pagesFound: 0, pagesCrawled: 0 })
})

// GET /api/crawler/:siteId/runs
router.get('/:siteId/runs', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })
  const db = getDb()
  const runs = db.prepare(`
    SELECT id, status, pages_found, pages_crawled, started_at, finished_at, error
    FROM crawl_runs WHERE site_id = ? ORDER BY id DESC LIMIT 10
  `).all(siteId)
  res.json(runs)
})

// ── Données crawlées ──────────────────────────────────────

// GET /api/crawler/:siteId/pages?page=1&limit=50&filter=missing_title|missing_h1|noindex|error
router.get('/:siteId/pages', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })

  const page  = Math.max(1, parseInt(req.query.page)  || 1)
  const limit = Math.min(200, parseInt(req.query.limit) || 50)
  const offset = (page - 1) * limit
  const filter = req.query.filter || ''

  let where = 'WHERE site_id = ?'
  const params = [siteId]

  if (filter === 'missing_title') { where += " AND (title IS NULL OR title = '')"; }
  else if (filter === 'missing_h1') { where += " AND (h1 IS NULL OR h1 = '')"; }
  else if (filter === 'noindex') { where += " AND meta_robots LIKE '%noindex%'"; }
  else if (filter === 'error') { where += ' AND error IS NOT NULL'; }

  const db = getDb()
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM crawled_pages ${where}`).get(...params).cnt
  const rows  = db.prepare(`SELECT url, status_code, title, h1, word_count, canonical, meta_robots, depth, source, error, crawled_at FROM crawled_pages ${where} ORDER BY depth ASC, url ASC LIMIT ? OFFSET ?`).all(...params, limit, offset)

  res.json({ total, page, limit, rows })
})

// GET /api/crawler/:siteId/summary
router.get('/:siteId/summary', (req, res) => {
  const siteId = parseInt(req.params.siteId)
  if (!siteId) return res.status(400).json({ error: 'siteId invalide' })

  const db = getDb()
  const total = db.prepare('SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ?').get(siteId).cnt

  if (total === 0) return res.json({ total: 0 })

  const missingTitle = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND (title IS NULL OR title = '')").get(siteId).cnt
  const missingH1    = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND (h1 IS NULL OR h1 = '')").get(siteId).cnt
  const noindex      = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND meta_robots LIKE '%noindex%'").get(siteId).cnt
  const errors       = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND error IS NOT NULL").get(siteId).cnt
  const avgWc        = db.prepare("SELECT ROUND(AVG(word_count)) as avg FROM crawled_pages WHERE site_id = ? AND word_count > 0").get(siteId)?.avg || 0
  const thinContent  = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND word_count > 0 AND word_count < 300").get(siteId).cnt
  const lastCrawl    = db.prepare("SELECT MAX(crawled_at) as dt FROM crawled_pages WHERE site_id = ?").get(siteId)?.dt

  res.json({ total, missingTitle, missingH1, noindex, errors, avgWordCount: avgWc, thinContent, lastCrawl })
})

export default router
