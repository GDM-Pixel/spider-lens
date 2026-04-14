import { Router } from 'express'
import geoip from 'geoip-lite'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'
import { cacheKey, ttlForRange, remember, shouldBypass } from '../services/cache.js'

const router = Router()
router.use(requireAuth)

function geoLookup(ip) {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { country_code: null, country: 'Local', city: null }
  }
  const geo = geoip.lookup(ip)
  if (!geo) return { country_code: null, country: null, city: null }
  return {
    country_code: geo.country || null,
    country: geo.country || null,
    city: geo.city || null,
  }
}

function getDateRange(req) {
  const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to   = req.query.to   || new Date().toISOString().slice(0, 10)
  return { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }
}

function getSiteFilter(req) {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : null
  if (siteId) return { clause: 'AND site_id = ?', params: [siteId] }
  return { clause: '', params: [] }
}

// GET /api/network/ips — top IPs
router.get('/ips', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('network-ips', siteId, req.query)
  const ttl = ttlForRange(to)

  const result = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const botFilter = req.query.bot
    const search    = req.query.search
    const limit     = Math.min(parseInt(req.query.limit  || '100', 10), 1000)
    const offset    = parseInt(req.query.offset || '0', 10)
    const sortBy    = ['hits','bot_hits','human_hits','last_seen','bot_name','ip'].includes(req.query.sort) ? req.query.sort : 'hits'
    const sortDir   = req.query.dir === 'asc' ? 'ASC' : 'DESC'

    const botWhere    = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
    const searchWhere = search ? 'AND ip LIKE ?' : ''
    const searchParams = search ? [`%${search}%`] : []

    const where = `timestamp BETWEEN ? AND ? ${sf} ${botWhere} ${searchWhere}`
    const params = [from, to, ...sp, ...searchParams]

    const rows = db.prepare(`
      SELECT
        ip,
        COUNT(*)                                                  AS hits,
        SUM(CASE WHEN is_bot = 1  THEN 1 ELSE 0 END)             AS bot_hits,
        SUM(CASE WHEN is_bot = 0  THEN 1 ELSE 0 END)             AS human_hits,
        SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
        SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
        SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
        SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
        MAX(timestamp)                                            AS last_seen,
        MAX(CASE WHEN is_bot = 1 THEN bot_name END)               AS bot_name
      FROM log_entries
      WHERE ${where}
      GROUP BY ip
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    const total = db.prepare(`
      SELECT COUNT(DISTINCT ip) AS cnt FROM log_entries WHERE ${where}
    `).get(...params)?.cnt || 0

    const enriched = rows.map(r => ({ ...r, ...geoLookup(r.ip) }))

    return { rows: enriched, total, limit, offset }
  })

  res.json(result)
})

// GET /api/network/ips/:ip/urls — détail des URLs visitées par une IP
router.get('/ips/:ip/urls', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const ip = req.params.ip

  const rows = db.prepare(`
    SELECT
      url,
      status_code,
      COUNT(*)       AS hits,
      MAX(timestamp) AS last_seen
    FROM log_entries
    WHERE ip = ? AND timestamp BETWEEN ? AND ? ${sf}
    GROUP BY url, status_code
    ORDER BY hits DESC
    LIMIT 50
  `).all(ip, from, to, ...sp)

  res.json(rows)
})

// GET /api/network/ips/export — export CSV des IPs
router.get('/ips/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const botFilter = req.query.bot
  const search    = req.query.search

  const botWhere    = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
  const searchWhere = search ? 'AND ip LIKE ?' : ''
  const searchParams = search ? [`%${search}%`] : []
  const where = `timestamp BETWEEN ? AND ? ${sf} ${botWhere} ${searchWhere}`
  const params = [from, to, ...sp, ...searchParams]

  const rows = db.prepare(`
    SELECT
      ip,
      COUNT(*)                                                  AS hits,
      SUM(CASE WHEN is_bot = 1  THEN 1 ELSE 0 END)             AS bot_hits,
      SUM(CASE WHEN is_bot = 0  THEN 1 ELSE 0 END)             AS human_hits,
      SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
      SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
      MAX(timestamp)                                            AS last_seen,
      MAX(CASE WHEN is_bot = 1 THEN bot_name END)               AS bot_name
    FROM log_entries
    WHERE ${where}
    GROUP BY ip
    ORDER BY hits DESC
    LIMIT 10000
  `).all(...params)

  const header = 'Adresse IP,Pays,Ville,Hits totaux,Hits bots,Hits humains,2xx,4xx,5xx,Bot name,Dernière visite\n'
  const csv = rows.map(r => {
    const geo = geoLookup(r.ip)
    return [r.ip,
      geo.country || '',
      `"${(geo.city || '').replace(/"/g, '""')}"`,
      r.hits, r.bot_hits, r.human_hits, r.s2xx, r.s4xx, r.s5xx,
      `"${(r.bot_name || '').replace(/"/g, '""')}"`, r.last_seen].join(',')
  }).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-ips-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv)
})

// GET /api/network/top-countries — agrégation par pays (geoip en mémoire)
router.get('/top-countries', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const botFilter = req.query.bot
  const botWhere = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''

  // On récupère les IPs avec leur volume — on géolocalise en JS (pas en SQL)
  const rows = db.prepare(`
    SELECT ip, COUNT(*) AS hits,
           SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human_hits,
           SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sf} ${botWhere}
    GROUP BY ip
    ORDER BY hits DESC
    LIMIT 5000
  `).all(from, to, ...sp)

  // Agrégation par pays
  const countryMap = new Map()
  for (const row of rows) {
    const geo = geoLookup(row.ip)
    const key = geo.country_code || '__unknown'
    const label = geo.country || 'Inconnu'
    if (!countryMap.has(key)) {
      countryMap.set(key, { country_code: key === '__unknown' ? null : key, country: label, hits: 0, human_hits: 0, bot_hits: 0, ip_count: 0 })
    }
    const entry = countryMap.get(key)
    entry.hits       += row.hits
    entry.human_hits += row.human_hits
    entry.bot_hits   += row.bot_hits
    entry.ip_count   += 1
  }

  const result = [...countryMap.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 30)

  res.json(result)
})

// GET /api/network/user-agents/export — export CSV des UAs
router.get('/user-agents/export', (req, res) => {
  const db = getDb()
  const { from, to } = getDateRange(req)
  const { clause: sf, params: sp } = getSiteFilter(req)
  const botFilter = req.query.bot
  const search    = req.query.search

  const botWhere    = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
  const searchWhere = search ? 'AND user_agent LIKE ?' : ''
  const searchParams = search ? [`%${search}%`] : []
  const where = `timestamp BETWEEN ? AND ? AND user_agent IS NOT NULL ${sf} ${botWhere} ${searchWhere}`
  const params = [from, to, ...sp, ...searchParams]

  const rows = db.prepare(`
    SELECT
      user_agent,
      is_bot,
      MAX(bot_name)  AS bot_name,
      COUNT(*)       AS hits,
      MAX(timestamp) AS last_seen
    FROM log_entries
    WHERE ${where}
    GROUP BY user_agent, is_bot
    ORDER BY hits DESC
    LIMIT 10000
  `).all(...params)

  const header = 'User-Agent,Type,Nom du bot,Hits,Dernière visite\n'
  const csv = rows.map(r =>
    [`"${(r.user_agent || '').replace(/"/g, '""')}"`,
     r.is_bot ? 'bot' : 'humain',
     `"${(r.bot_name || '').replace(/"/g, '""')}"`,
     r.hits, r.last_seen].join(',')
  ).join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="spider-lens-user-agents-${from.slice(0,10)}-${to.slice(0,10)}.csv"`)
  res.send('\uFEFF' + header + csv)
})

// GET /api/network/user-agents — top user-agents
router.get('/user-agents', (req, res) => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : (req.user?.siteId || 0)
  const { from, to } = getDateRange(req)
  const bypass = shouldBypass(req)
  const key = cacheKey('network-user-agents', siteId, req.query)
  const ttl = ttlForRange(to)

  const result = remember(key, ttl, bypass, () => {
    const db = getDb()
    const { clause: sf, params: sp } = getSiteFilter(req)
    const botFilter = req.query.bot
    const search    = req.query.search
    const limit     = Math.min(parseInt(req.query.limit  || '100', 10), 1000)
    const offset    = parseInt(req.query.offset || '0', 10)
    const sortBy    = ['hits','last_seen','bot_name'].includes(req.query.sort) ? req.query.sort : 'hits'
    const sortDir   = req.query.dir === 'asc' ? 'ASC' : 'DESC'

    const botWhere    = botFilter !== undefined ? `AND is_bot = ${botFilter === '1' ? 1 : 0}` : ''
    const searchWhere = search ? 'AND user_agent LIKE ?' : ''
    const searchParams = search ? [`%${search}%`] : []

    const where = `timestamp BETWEEN ? AND ? AND user_agent IS NOT NULL ${sf} ${botWhere} ${searchWhere}`
    const params = [from, to, ...sp, ...searchParams]

    const rows = db.prepare(`
      SELECT
        user_agent,
        is_bot,
        MAX(bot_name)  AS bot_name,
        COUNT(*)       AS hits,
        MAX(timestamp) AS last_seen
      FROM log_entries
      WHERE ${where}
      GROUP BY user_agent, is_bot
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    const total = db.prepare(`
      SELECT COUNT(DISTINCT user_agent) AS cnt FROM log_entries WHERE ${where}
    `).get(...params)?.cnt || 0

    return { rows, total, limit, offset }
  })

  res.json(result)
})

export default router
