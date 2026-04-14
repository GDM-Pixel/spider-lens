import { Router } from 'express'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'
import { cacheKey, ttlForRange, remember, shouldBypass } from '../services/cache.js'

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

// Filtre User-Agent — gère la valeur spéciale '__googlebot__' (LIKE)
function getUaFilter(ua) {
  if (!ua) return { clause: '', params: [] }
  if (ua === '__googlebot__') return { clause: "AND user_agent LIKE '%Googlebot%'", params: [] }
  return { clause: 'AND user_agent = ?', params: [ua] }
}

// GET /api/stats/overview — KPIs globaux
router.get('/overview', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-overview', siteId, req.query)
  const ttl = ttlForRange(to)

  const result = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const { clause: uaWhere, params: uaParams } = getUaFilter(req.query.ua)

    const total = db.prepare(`
      SELECT COUNT(*) as cnt FROM log_entries WHERE timestamp BETWEEN ? AND ? ${sf} ${uaWhere}
    `).get(from, to, ...sp, ...uaParams)?.cnt || 0

    const byStatus = db.prepare(`
      SELECT
        SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as s2xx,
        SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) as s3xx,
        SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) as s4xx,
        SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) as s5xx
      FROM log_entries WHERE timestamp BETWEEN ? AND ? ${sf} ${uaWhere}
    `).get(from, to, ...sp, ...uaParams)

    const bots = db.prepare(`
      SELECT COUNT(*) as cnt FROM log_entries
      WHERE is_bot = 1 AND timestamp BETWEEN ? AND ? ${sf} ${uaWhere}
    `).get(from, to, ...sp, ...uaParams)?.cnt || 0

    const notFound = db.prepare(`
      SELECT COUNT(DISTINCT url) as cnt FROM log_entries
      WHERE status_code = 404 AND timestamp BETWEEN ? AND ? ${sf} ${uaWhere}
    `).get(from, to, ...sp, ...uaParams)?.cnt || 0

    return {
      total,
      humans: total - bots,
      bots,
      s2xx: byStatus?.s2xx || 0,
      s3xx: byStatus?.s3xx || 0,
      s4xx: byStatus?.s4xx || 0,
      s5xx: byStatus?.s5xx || 0,
      unique404: notFound,
      errorRate: total > 0 ? (((byStatus?.s4xx || 0) + (byStatus?.s5xx || 0)) / total * 100).toFixed(1) : 0,
    }
  })

  res.json(result)
})

// GET /api/stats/http-codes — évolution codes HTTP par jour
router.get('/http-codes', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-http-codes', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const { clause: uaWhere, params: uaParams } = getUaFilter(req.query.ua)

    return db.prepare(`
      SELECT
        date(timestamp) as day,
        SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as s2xx,
        SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) as s3xx,
        SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) as s4xx,
        SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) as s5xx
      FROM log_entries
      WHERE timestamp BETWEEN ? AND ? ${sf} ${uaWhere}
      GROUP BY day
      ORDER BY day ASC
    `).all(from, to, ...sp, ...uaParams)
  })

  res.json(rows)
})

// GET /api/stats/top-404 — top URLs en 404
router.get('/top-404', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-top-404', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const limit   = parseInt(req.query.limit || '20', 10)
    const sortBy  = ['hits','bot_hits','last_seen','url'].includes(req.query.sort) ? req.query.sort : 'hits'
    const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC'

    return db.prepare(`
      SELECT
        l.url,
        COUNT(*) as hits,
        SUM(CASE WHEN l.is_bot = 1 THEN 1 ELSE 0 END) as bot_hits,
        MAX(l.timestamp) as last_seen,
        ur.status_code as recheck_status,
        ur.final_url   as recheck_final_url,
        ur.checked_at  as recheck_checked_at
      FROM log_entries l
      LEFT JOIN url_rechecks ur ON ur.site_id = l.site_id AND ur.url = l.url
      WHERE l.status_code = 404 AND l.timestamp BETWEEN ? AND ? ${sf}
      GROUP BY l.url
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ?
    `).all(from, to, ...sp, limit)
  })

  res.json(rows)
})

// GET /api/stats/top-pages — pages les plus visitées
router.get('/top-pages', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-top-pages', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const limit   = parseInt(req.query.limit || '20', 10)
    const sortBy  = ['hits','bot_hits','human_hits','url'].includes(req.query.sort) ? req.query.sort : 'hits'
    const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC'

    return db.prepare(`
      SELECT
        url,
        COUNT(*) as hits,
        SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_hits,
        SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human_hits
      FROM log_entries
      WHERE status_code = 200 AND timestamp BETWEEN ? AND ? ${sf}
      GROUP BY url
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ?
    `).all(from, to, ...sp, limit)
  })

  res.json(rows)
})

// GET /api/stats/bots — répartition des bots
router.get('/bots', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-bots', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)

    return db.prepare(`
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
  })

  res.json(rows)
})

// GET /api/stats/url-detail — drill-down URLs par code HTTP (sans enrichissement)
router.get('/url-detail', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-url-detail', siteId, req.query)
  const ttl = ttlForRange(to)

  const result = remember(key, ttl, bypass, () => {
    const db = getDb()

    // Filtres optionnels
    const statusFilter = req.query.status   // ex: "404" ou "4xx" ou "301"
    const botFilter    = req.query.bot      // "0" | "1" | undefined
    const search       = req.query.search   // recherche dans l'URL
    const limit        = Math.min(parseInt(req.query.limit  || '200', 10), 2000)
    const offset       = parseInt(req.query.offset || '0', 10)
    const sortBy       = ['hits','last_seen','url','status_code','bot_hits','human_hits'].includes(req.query.sort) ? req.query.sort : 'hits'
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
    const { clause: uaWhere, params: uaParams } = getUaFilter(req.query.ua)

    const where = `timestamp BETWEEN ? AND ? ${statusWhere} ${botWhere} ${searchWhere} ${ipWhere} ${uaWhere} ${sf}`
    const params = [from, to, ...statusParams, ...searchParams, ...ipParams, ...uaParams, ...sp]

    const rows = db.prepare(`
      SELECT
        l.url,
        l.status_code,
        COUNT(*)                                                AS hits,
        SUM(CASE WHEN l.is_bot = 1 THEN 1 ELSE 0 END)          AS bot_hits,
        SUM(CASE WHEN l.is_bot = 0 THEN 1 ELSE 0 END)          AS human_hits,
        MAX(l.timestamp)                                        AS last_seen,
        COUNT(*) OVER()                                         AS _total,
        CASE WHEN l.status_code = 404 THEN ur.status_code  ELSE NULL END AS recheck_status,
        CASE WHEN l.status_code = 404 THEN ur.final_url    ELSE NULL END AS recheck_final_url,
        CASE WHEN l.status_code = 404 THEN ur.checked_at   ELSE NULL END AS recheck_checked_at
      FROM log_entries l
      LEFT JOIN url_rechecks ur ON ur.site_id = l.site_id AND ur.url = l.url AND l.status_code = 404
      WHERE ${where}
      GROUP BY l.url, l.status_code
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    // Extraire _total de la première ligne, puis retirer de chaque row
    let total = 0
    if (rows.length > 0) {
      total = rows[0]._total
      rows.forEach(r => delete r._total)
    }

    return { rows, total, limit, offset }
  })

  res.json(result)
})

// GET /api/stats/url-detail/enrich — enrichissement top_ua et top_referrer pour une URL
router.get('/url-detail/enrich', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const url = req.query.url
  const statusCode = req.query.status ? parseInt(req.query.status, 10) : 200
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-url-enrich', siteId, req.query)
  const ttl = ttlForRange(to)

  if (!url) {
    return res.status(400).json({ error: 'url parameter required' })
  }

  const result = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const { clause: uaWhere, params: uaParams } = getUaFilter(req.query.ua)

    // Top UA
    const topUa = db.prepare(`
      SELECT user_agent FROM log_entries
      WHERE url = ? AND status_code = ? AND timestamp BETWEEN ? AND ? ${sf} ${uaWhere}
      GROUP BY user_agent
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `).get(url, statusCode, from, to, ...sp, ...uaParams)?.user_agent || null

    // Top referrer
    const topRef = db.prepare(`
      SELECT referrer FROM log_entries
      WHERE url = ? AND status_code = ? AND timestamp BETWEEN ? AND ? ${sf}
        AND referrer IS NOT NULL AND referrer != '-'
      GROUP BY referrer
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `).get(url, statusCode, from, to, ...sp)?.referrer || null

    return {
      url,
      status_code: statusCode,
      top_ua: topUa,
      top_referrer: topRef,
    }
  })

  res.json(result)
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
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-ttfb-overview', siteId, req.query)
  const ttl = ttlForRange(to)

  const result = remember(key, ttl, bypass, () => {
    const db = getDb()
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

    return {
      avg_ms:     Math.round(r.avg_ms || 0),
      min_ms:     r.min_ms || 0,
      max_ms:     r.max_ms || 0,
      total:      r.total || 0,
      slow_count: r.slow_count || 0,
      fast_count: r.fast_count || 0,
      ok_count:   r.ok_count || 0,
      warn_count: r.warn_count || 0,
      slow_pct:   r.total > 0 ? ((r.slow_count / r.total) * 100).toFixed(1) : 0,
    }
  })

  res.json(result)
})

// GET /api/stats/ttfb/by-day — évolution TTFB moyen par jour
router.get('/ttfb/by-day', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-ttfb-by-day', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)

    return db.prepare(`
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
  })

  res.json(rows)
})

// GET /api/stats/ttfb/by-url — top URLs les plus lentes
router.get('/ttfb/by-url', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-ttfb-by-url', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const limit     = Math.min(parseInt(req.query.limit || '50', 10), 500)
    const threshold = parseInt(req.query.threshold || '0', 10)
    const sortBy    = { avg: 'avg_ms', max: 'max_ms', min: 'min_ms', hits: 'hits', last_seen: 'last_seen', url: 'url' }[req.query.sort] ?? 'avg_ms'
    const sortDir   = req.query.dir === 'asc' ? 'ASC' : 'DESC'
    const botFilter = req.query.bot
    const ipFilter  = req.query.ip

    const botWhere = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
    const ipWhere  = ipFilter ? 'AND ip = ?' : ''
    const ipParams = ipFilter ? [ipFilter] : []

    return db.prepare(`
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
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ?
    `).all(from, to, ...sp, ...ipParams, threshold, limit)
  })

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
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-timeline', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)

    return db.prepare(`
      SELECT
        strftime('%H', timestamp) as hour,
        strftime('%w', timestamp) as weekday,
        COUNT(*) as hits
      FROM log_entries
      WHERE timestamp BETWEEN ? AND ? ${sf}
      GROUP BY hour, weekday
      ORDER BY weekday, hour
    `).all(from, to, ...sp)
  })

  res.json(rows)
})

// GET /api/stats/weekly-trends — données agrégées par semaine sur N semaines (optimisé)
router.get('/weekly-trends', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-weekly-trends', siteId, req.query)
  // Pas de ttlForRange pour weekly-trends car elle n'a pas from/to query — TTL fixe 1h
  const ttl = 3600

  const results = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const weeks = Math.min(parseInt(req.query.weeks || '12', 10), 52)

    // Calcul du dimanche il y a 52 semaines (ou weeks-1 selon la config)
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - dayOfWeek)
    thisMonday.setHours(0, 0, 0, 0)

    // Date minimale : début de la semaine il y a (weeks-1) semaines
    const minDate = new Date(thisMonday)
    minDate.setDate(thisMonday.getDate() - (weeks - 1) * 7)
    const from = minDate.toISOString()

    // Date maximale : dimanche de cette semaine (23h59)
    const maxDate = new Date(thisMonday)
    maxDate.setDate(thisMonday.getDate() + 6)
    maxDate.setHours(23, 59, 59, 999)
    const to = maxDate.toISOString()

    // Une seule requête : GROUP BY semaine avec strftime('%Y-%W', timestamp)
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%W', timestamp) AS week_iso,
        MIN(date(timestamp)) AS week_start,
        MAX(date(timestamp)) AS week_end,
        COUNT(*) AS total,
        SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
        SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
        SUM(CASE WHEN bot_name = 'Googlebot' THEN 1 ELSE 0 END) AS googlebot,
        SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors,
        AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) AS avg_ttfb
      FROM log_entries
      WHERE timestamp BETWEEN ? AND ? ${sf}
      GROUP BY week_iso
      ORDER BY week_iso ASC
    `).all(from, to, ...sp)

    // Formater la réponse en reprenant le format original
    return rows.map(row => {
      const weekStart = new Date(row.week_start + 'T00:00:00Z')
      return {
        week: row.week_start,
        week_label: weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        total:     row.total     || 0,
        humans:    row.humans    || 0,
        bots:      row.bots      || 0,
        googlebot: row.googlebot || 0,
        errors:    row.errors    || 0,
        avg_ttfb:  row.avg_ttfb != null ? Math.round(row.avg_ttfb) : null,
      }
    })
  })

  res.json(results)
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

// GET /api/stats/top-user-agents — top UA distincts pour le filtre select
router.get('/top-user-agents', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('stats-top-user-agents', siteId, req.query)
  const ttl = ttlForRange(to)

  const rows = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)

    // Top 100 UA + toujours inclure les Googlebot même hors top
    const base = db.prepare(`
      SELECT user_agent, COUNT(*) as hits
      FROM log_entries
      WHERE user_agent IS NOT NULL AND user_agent != '-' AND timestamp BETWEEN ? AND ? ${sf}
      GROUP BY user_agent
      ORDER BY hits DESC
      LIMIT 100
    `).all(from, to, ...sp)

    const googlebotExtra = db.prepare(`
      SELECT user_agent, COUNT(*) as hits
      FROM log_entries
      WHERE user_agent IS NOT NULL AND user_agent LIKE '%Googlebot%'
        AND timestamp BETWEEN ? AND ? ${sf}
      GROUP BY user_agent
      ORDER BY hits DESC
    `).all(from, to, ...sp)

    // Fusionner sans doublons
    const seen = new Set(base.map(r => r.user_agent))
    for (const r of googlebotExtra) {
      if (!seen.has(r.user_agent)) base.push(r)
    }
    return base
  })

  res.json(rows)
})

export default router
