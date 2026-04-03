import { Router } from 'express'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Plage de dates par défaut : 30 derniers jours
function getDateRange(req) {
  const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to = req.query.to || new Date().toISOString().slice(0, 10)
  return { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }
}

// Filtre optionnel par site — retourne { clause, params }
function getSiteFilter(req) {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : null
  if (siteId) return { clause: 'AND site_id = ?', params: [siteId] }
  return { clause: '', params: [] }
}

// GET /api/stats/overview — KPIs globaux
router.get('/overview', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const total = db.prepare(`
    SELECT COUNT(*) as cnt FROM log_entries WHERE timestamp BETWEEN ? AND ? ${sf}
  `).get(from, to, ...sp)?.cnt || 0

  const byStatus = db.prepare(`
    SELECT
      SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as s2xx,
      SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) as s3xx,
      SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) as s4xx,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) as s5xx
    FROM log_entries WHERE timestamp BETWEEN ? AND ? ${sf}
  `).get(from, to, ...sp)

  const bots = db.prepare(`
    SELECT COUNT(*) as cnt FROM log_entries
    WHERE is_bot = 1 AND timestamp BETWEEN ? AND ? ${sf}
  `).get(from, to, ...sp)?.cnt || 0

  const notFound = db.prepare(`
    SELECT COUNT(DISTINCT url) as cnt FROM log_entries
    WHERE status_code = 404 AND timestamp BETWEEN ? AND ? ${sf}
  `).get(from, to, ...sp)?.cnt || 0

  res.json({
    total,
    humans: total - bots,
    bots,
    s2xx: byStatus?.s2xx || 0,
    s3xx: byStatus?.s3xx || 0,
    s4xx: byStatus?.s4xx || 0,
    s5xx: byStatus?.s5xx || 0,
    unique404: notFound,
    errorRate: total > 0 ? (((byStatus?.s4xx || 0) + (byStatus?.s5xx || 0)) / total * 100).toFixed(1) : 0,
  })
})

// GET /api/stats/http-codes — évolution codes HTTP par jour
router.get('/http-codes', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      date(timestamp) as day,
      SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as s2xx,
      SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) as s3xx,
      SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) as s4xx,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) as s5xx
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sf}
    GROUP BY day
    ORDER BY day ASC
  `).all(from, to, ...sp)

  res.json(rows)
})

// GET /api/stats/top-404 — top URLs en 404
router.get('/top-404', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const limit = parseInt(req.query.limit || '20', 10)

  const rows = db.prepare(`
    SELECT
      url,
      COUNT(*) as hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_hits,
      MAX(timestamp) as last_seen
    FROM log_entries
    WHERE status_code = 404 AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY url
    ORDER BY hits DESC
    LIMIT ?
  `).all(from, to, ...sp, limit)

  res.json(rows)
})

// GET /api/stats/top-pages — pages les plus visitées
router.get('/top-pages', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const limit = parseInt(req.query.limit || '20', 10)

  const rows = db.prepare(`
    SELECT
      url,
      COUNT(*) as hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_hits,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human_hits
    FROM log_entries
    WHERE status_code = 200 AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY url
    ORDER BY hits DESC
    LIMIT ?
  `).all(from, to, ...sp, limit)

  res.json(rows)
})

// GET /api/stats/bots — répartition des bots
router.get('/bots', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      COALESCE(bot_name, 'Humains') as name,
      COUNT(*) as hits,
      is_bot
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sf}
    GROUP BY bot_name, is_bot
    ORDER BY hits DESC
    LIMIT 20
  `).all(from, to, ...sp)

  res.json(rows)
})

// GET /api/stats/url-detail — drill-down URLs par code HTTP
router.get('/url-detail', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)

  // Filtres optionnels
  const statusFilter = req.query.status   // ex: "404" ou "4xx" ou "301"
  const botFilter    = req.query.bot      // "0" | "1" | undefined
  const search       = req.query.search   // recherche dans l'URL
  const limit        = Math.min(parseInt(req.query.limit  || '200', 10), 2000)
  const offset       = parseInt(req.query.offset || '0', 10)
  const sortBy       = ['hits','last_seen','url'].includes(req.query.sort) ? req.query.sort : 'hits'
  const sortDir      = req.query.dir === 'asc' ? 'ASC' : 'DESC'

  // Construction dynamique du WHERE sur status_code
  let statusWhere = ''
  let statusParams = []
  if (statusFilter) {
    if (/^\d{3}$/.test(statusFilter)) {
      // Code exact : 404, 301, 500…
      statusWhere = 'AND status_code = ?'
      statusParams = [parseInt(statusFilter, 10)]
    } else if (/^\dxx$/i.test(statusFilter)) {
      // Famille : 2xx, 3xx, 4xx, 5xx
      const base = parseInt(statusFilter[0], 10) * 100
      statusWhere = 'AND status_code BETWEEN ? AND ?'
      statusParams = [base, base + 99]
    }
  }

  const { clause: sf, params: sp } = getSiteFilter(req)
  const botWhere    = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
  const searchWhere = search ? 'AND url LIKE ?' : ''
  const searchParams = search ? [`%${search}%`] : []
  const ipFilter    = req.query.ip
  const ipWhere     = ipFilter ? 'AND ip = ?' : ''
  const ipParams    = ipFilter ? [ipFilter] : []

  const where = `timestamp BETWEEN ? AND ? ${statusWhere} ${botWhere} ${searchWhere} ${ipWhere} ${sf}`
  const params = [from, to, ...statusParams, ...searchParams, ...ipParams, ...sp]

  // Requête principale — agrégée par URL + status_code
  const rows = db.prepare(`
    SELECT
      url,
      status_code,
      COUNT(*)                                              AS hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)          AS bot_hits,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END)          AS human_hits,
      MAX(timestamp)                                        AS last_seen,
      (SELECT user_agent FROM log_entries le2
       WHERE le2.url = le.url AND le2.status_code = le.status_code
         AND le2.timestamp BETWEEN ? AND ? ${sf}
       GROUP BY user_agent ORDER BY COUNT(*) DESC LIMIT 1)  AS top_ua
    FROM log_entries le
    WHERE ${where}
    GROUP BY url, status_code
    ORDER BY ${sortBy} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(from, to, ...sp, ...params, limit, offset)

  // Total pour pagination
  const total = db.prepare(`
    SELECT COUNT(DISTINCT url || '|' || status_code) AS cnt
    FROM log_entries
    WHERE ${where}
  `).get(...params)?.cnt || 0

  res.json({ rows, total, limit, offset })
})

// GET /api/stats/url-detail/export — export CSV brut (sans pagination)
router.get('/url-detail/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const statusFilter = req.query.status
  const botFilter    = req.query.bot
  const search       = req.query.search

  let statusWhere = '', statusParams = []
  if (statusFilter) {
    if (/^\d{3}$/.test(statusFilter)) {
      statusWhere = 'AND status_code = ?'
      statusParams = [parseInt(statusFilter, 10)]
    } else if (/^\dxx$/i.test(statusFilter)) {
      const base = parseInt(statusFilter[0], 10) * 100
      statusWhere = 'AND status_code BETWEEN ? AND ?'
      statusParams = [base, base + 99]
    }
  }
  const botWhere    = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
  const searchWhere = search ? 'AND url LIKE ?' : ''
  const searchParams = search ? [`%${search}%`] : []
  const params = [from, to, ...statusParams, ...searchParams, ...sp]

  const rows = db.prepare(`
    SELECT
      url,
      status_code,
      COUNT(*)                                              AS hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)          AS bot_hits,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END)          AS human_hits,
      MAX(timestamp)                                        AS last_seen,
      (SELECT user_agent FROM log_entries le2
       WHERE le2.url = le.url AND le2.status_code = le.status_code
         AND le2.timestamp BETWEEN ? AND ? ${sf}
       GROUP BY user_agent ORDER BY COUNT(*) DESC LIMIT 1)  AS top_ua
    FROM log_entries le
    WHERE timestamp BETWEEN ? AND ? ${statusWhere} ${botWhere} ${searchWhere} ${sf}
    GROUP BY url, status_code
    ORDER BY hits DESC
    LIMIT 10000
  `).all(from, to, ...sp, ...params)

  // CSV
  const header = 'URL,Code HTTP,Hits,Bots,Humains,Dernière vue,User-Agent dominant\n'
  const csv = rows.map(r =>
    [r.url, r.status_code, r.hits, r.bot_hits, r.human_hits,
     r.last_seen, `"${(r.top_ua || '').replace(/"/g, '""')}"`].join(',')
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-export-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv) // BOM UTF-8 pour Excel
})

// GET /api/stats/ttfb/overview — métriques TTFB globales
router.get('/ttfb/overview', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const threshold = parseInt(req.query.threshold || '1000', 10)

  const r = db.prepare(`
    SELECT
      AVG(response_time_ms)                                           AS avg_ms,
      MIN(response_time_ms)                                           AS min_ms,
      MAX(response_time_ms)                                           AS max_ms,
      COUNT(*)                                                        AS total,
      SUM(CASE WHEN response_time_ms > ? THEN 1 ELSE 0 END)          AS slow_count,
      SUM(CASE WHEN response_time_ms <= 200 THEN 1 ELSE 0 END)       AS fast_count,
      SUM(CASE WHEN response_time_ms BETWEEN 201 AND 800 THEN 1 ELSE 0 END) AS ok_count,
      SUM(CASE WHEN response_time_ms > 800 THEN 1 ELSE 0 END)        AS warn_count
    FROM log_entries
    WHERE response_time_ms IS NOT NULL
      AND status_code = 200
      AND timestamp BETWEEN ? AND ? ${sf}
  `).get(threshold, from, to, ...sp)

  res.json({
    avg_ms:     Math.round(r.avg_ms || 0),
    min_ms:     r.min_ms || 0,
    max_ms:     r.max_ms || 0,
    total:      r.total || 0,
    slow_count: r.slow_count || 0,
    fast_count: r.fast_count || 0,
    ok_count:   r.ok_count || 0,
    warn_count: r.warn_count || 0,
    slow_pct:   r.total > 0 ? ((r.slow_count / r.total) * 100).toFixed(1) : 0,
  })
})

// GET /api/stats/ttfb/by-day — évolution TTFB moyen par jour
router.get('/ttfb/by-day', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      date(timestamp)            AS day,
      ROUND(AVG(response_time_ms)) AS avg_ms,
      ROUND(MIN(response_time_ms)) AS min_ms,
      ROUND(MAX(response_time_ms)) AS max_ms,
      COUNT(*)                   AS requests
    FROM log_entries
    WHERE response_time_ms IS NOT NULL
      AND status_code = 200
      AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY day
    ORDER BY day ASC
  `).all(from, to, ...sp)

  res.json(rows)
})

// GET /api/stats/ttfb/by-url — top URLs les plus lentes
router.get('/ttfb/by-url', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const limit     = Math.min(parseInt(req.query.limit || '50', 10), 500)
  const threshold = parseInt(req.query.threshold || '0', 10)
  const sortBy    = req.query.sort === 'max' ? 'max_ms' : req.query.sort === 'hits' ? 'hits' : 'avg_ms'
  const botFilter = req.query.bot
  const ipFilter  = req.query.ip

  const botWhere = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
  const ipWhere  = ipFilter ? 'AND ip = ?' : ''
  const ipParams = ipFilter ? [ipFilter] : []

  const rows = db.prepare(`
    SELECT
      url,
      ROUND(AVG(response_time_ms))  AS avg_ms,
      ROUND(MIN(response_time_ms))  AS min_ms,
      ROUND(MAX(response_time_ms))  AS max_ms,
      COUNT(*)                      AS hits,
      MAX(timestamp)                AS last_seen
    FROM log_entries
    WHERE response_time_ms IS NOT NULL
      AND status_code = 200
      AND timestamp BETWEEN ? AND ? ${sf}
      ${botWhere}
      ${ipWhere}
    GROUP BY url
    HAVING avg_ms > ?
    ORDER BY ${sortBy} DESC
    LIMIT ?
  `).all(from, to, ...sp, ...ipParams, threshold, limit)

  res.json(rows)
})

// GET /api/stats/ttfb/by-url/export — export CSV TTFB
router.get('/ttfb/by-url/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const threshold = parseInt(req.query.threshold || '0', 10)
  const botFilter = req.query.bot
  const botWhere  = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''

  const rows = db.prepare(`
    SELECT
      url,
      ROUND(AVG(response_time_ms)) AS avg_ms,
      ROUND(MIN(response_time_ms)) AS min_ms,
      ROUND(MAX(response_time_ms)) AS max_ms,
      COUNT(*)                     AS hits,
      MAX(timestamp)               AS last_seen
    FROM log_entries
    WHERE response_time_ms IS NOT NULL
      AND status_code = 200
      AND timestamp BETWEEN ? AND ? ${sf}
      ${botWhere}
    GROUP BY url
    HAVING avg_ms > ?
    ORDER BY avg_ms DESC
    LIMIT 10000
  `).all(from, to, ...sp, threshold)

  const header = 'URL,TTFB moyen (ms),TTFB min (ms),TTFB max (ms),Requêtes,Dernière vue\n'
  const csv = rows.map(r =>
    [r.url, r.avg_ms, r.min_ms, r.max_ms, r.hits, r.last_seen].join(',')
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-ttfb-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv)
})

// GET /api/stats/timeline — activité horaire (heatmap)
router.get('/timeline', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      strftime('%H', timestamp) as hour,
      strftime('%w', timestamp) as weekday,
      COUNT(*) as hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sf}
    GROUP BY hour, weekday
    ORDER BY weekday, hour
  `).all(from, to, ...sp)

  res.json(rows)
})

// GET /api/stats/weekly-trends — données agrégées par semaine sur N semaines
router.get('/weekly-trends', (req, res) => {
  const db = getDb()
  const { clause: sf, params: sp } = getSiteFilter(req)
  const weeks = Math.min(parseInt(req.query.weeks || '12', 10), 52)

  // Génère les N dernières semaines (lundi → dimanche)
  const results = []
  const now = new Date()
  // Recule au lundi de la semaine courante
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - dayOfWeek)
  thisMonday.setHours(0, 0, 0, 0)

  for (let i = 0; i < weeks; i++) {
    const monday = new Date(thisMonday)
    monday.setDate(thisMonday.getDate() - i * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const from = monday.toISOString().replace('T', ' ').slice(0, 19)
    const to   = sunday.toISOString().replace('T', ' ').slice(0, 19)

    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
        SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
        SUM(CASE WHEN bot_name = 'Googlebot' THEN 1 ELSE 0 END) AS googlebot,
        SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors,
        AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) AS avg_ttfb
      FROM log_entries
      WHERE timestamp BETWEEN ? AND ? ${sf}
    `).get(from, to, ...sp)

    results.push({
      week: monday.toISOString().slice(0, 10),
      week_label: monday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      total:     row.total    || 0,
      humans:    row.humans   || 0,
      bots:      row.bots     || 0,
      googlebot: row.googlebot || 0,
      errors:    row.errors   || 0,
      avg_ttfb:  row.avg_ttfb != null ? Math.round(row.avg_ttfb) : null,
    })
  }

  res.json(results.reverse()) // chronologique
})

// GET /api/stats/top-404/export — export CSV des erreurs 404
router.get('/top-404/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      url,
      COUNT(*) as hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_hits,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human_hits,
      MAX(timestamp) as last_seen
    FROM log_entries
    WHERE status_code = 404 AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY url
    ORDER BY hits DESC
    LIMIT 10000
  `).all(from, to, ...sp)

  const header = 'URL,Hits totaux,Hits bots,Hits humains,Dernière vue\n'
  const csv = rows.map(r =>
    [`"${r.url.replace(/"/g, '""')}"`, r.hits, r.bot_hits, r.human_hits, r.last_seen].join(',')
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-404-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv)
})

// GET /api/stats/top-pages/export — export CSV des top pages
router.get('/top-pages/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      url,
      COUNT(*) as hits,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human_hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_hits
    FROM log_entries
    WHERE status_code = 200 AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY url
    ORDER BY hits DESC
    LIMIT 10000
  `).all(from, to, ...sp)

  const header = 'URL,Hits totaux,Hits humains,Hits bots\n'
  const csv = rows.map(r =>
    [`"${r.url.replace(/"/g, '""')}"`, r.hits, r.human_hits, r.bot_hits].join(',')
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-top-pages-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv)
})

// GET /api/stats/bots/export — export CSV des bots
router.get('/bots/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)

  const rows = db.prepare(`
    SELECT
      COALESCE(bot_name, 'Inconnu') as bot_name,
      COUNT(*) as hits,
      MAX(timestamp) as last_seen
    FROM log_entries
    WHERE is_bot = 1 AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY bot_name
    ORDER BY hits DESC
    LIMIT 10000
  `).all(from, to, ...sp)

  const header = 'Nom du bot,Hits,Dernière visite\n'
  const csv = rows.map(r =>
    [`"${(r.bot_name || '').replace(/"/g, '""')}"`, r.hits, r.last_seen].join(',')
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-bots-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv)
})

export default router
