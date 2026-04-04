import { GoogleGenerativeAI } from '@google/generative-ai'
import geoip from 'geoip-lite'
import { getDb } from '../db/database.js'

// ── Cache mémoire (TTL 5 min) ─────────────────────────────
const summaryCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────
function trunc(str, max = 80) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

function pct(value, total) {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function deltaStr(curr, prev) {
  if (!prev || !curr) return null
  const d = ((curr - prev) / prev) * 100
  return d >= 0 ? `+${Math.round(d)}%` : `${Math.round(d)}%`
}

// ── Construction du résumé compact ───────────────────────
export function buildSiteSummary(siteId) {
  const db = getDb()
  const sc = siteId != null ? 'AND site_id = ?' : ''
  const sp = siteId != null ? [siteId] : []

  const from = new Date(Date.now() - 30 * 86400000).toISOString()
  const to   = new Date().toISOString()

  // -- Overview global
  const overview = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
      SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
      SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
      SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sc}
  `).get(from, to, ...sp)

  const errorRate = overview.total > 0
    ? `${((( overview.s4xx + overview.s5xx) / overview.total) * 100).toFixed(1)}%`
    : '0%'

  // -- Top 5 pages 404
  const top404 = db.prepare(`
    SELECT url, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND status_code = 404 ${sc}
    GROUP BY url ORDER BY hits DESC LIMIT 5
  `).all(from, to, ...sp).map(r => ({ url: trunc(r.url), hits: r.hits }))

  // -- Top 5 pages visitées (humains, 200)
  const topPagesRaw = db.prepare(`
    SELECT
      url,
      COUNT(*) AS hits,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND status_code = 200 ${sc}
    GROUP BY url ORDER BY hits DESC LIMIT 5
  `).all(from, to, ...sp)
  const topPages = topPagesRaw.map(r => ({
    url: trunc(r.url),
    hits: r.hits,
    botPct: pct(r.bot_hits, r.hits),
  }))

  // -- Top 5 bots
  const topBots = db.prepare(`
    SELECT bot_name AS name, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND is_bot = 1 AND bot_name IS NOT NULL ${sc}
    GROUP BY bot_name ORDER BY hits DESC LIMIT 5
  `).all(from, to, ...sp).map(r => ({ name: r.name, hits: r.hits }))

  // -- TTFB
  const ttfbRaw = db.prepare(`
    SELECT
      ROUND(AVG(response_time_ms)) AS avg,
      COUNT(*) AS total,
      SUM(CASE WHEN response_time_ms > 800 THEN 1 ELSE 0 END) AS slow
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND response_time_ms IS NOT NULL ${sc}
  `).get(from, to, ...sp)

  const slowestUrl = db.prepare(`
    SELECT url, ROUND(AVG(response_time_ms)) AS avg_ms
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND response_time_ms IS NOT NULL ${sc}
    GROUP BY url HAVING COUNT(*) >= 3
    ORDER BY avg_ms DESC LIMIT 1
  `).get(from, to, ...sp)

  const ttfb = {
    avg: ttfbRaw?.avg ?? null,
    slowPct: ttfbRaw?.total > 0 ? pct(ttfbRaw.slow, ttfbRaw.total) : '0%',
    slowestUrl: slowestUrl ? trunc(slowestUrl.url) : null,
  }

  // -- Top pays (geoip sur top 500 IPs)
  const topIps = db.prepare(`
    SELECT ip, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sc}
    GROUP BY ip ORDER BY hits DESC LIMIT 500
  `).all(from, to, ...sp)

  const countryCounts = {}
  for (const row of topIps) {
    if (!row.ip) continue
    const geo = geoip.lookup(row.ip)
    const code = geo?.country || 'XX'
    countryCounts[code] = (countryCounts[code] || 0) + row.hits
  }
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, hits]) => ({ code, hits }))

  // -- Tendance hebdo : semaine précédente vs courante
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString()
  const prevStart = new Date(Date.now() - 14 * 86400000).toISOString()

  const currWeek = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors
    FROM log_entries WHERE timestamp BETWEEN ? AND ? ${sc}
  `).get(weekStart, to, ...sp)

  const prevWeek = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors
    FROM log_entries WHERE timestamp BETWEEN ? AND ? ${sc}
  `).get(prevStart, weekStart, ...sp)

  const weeklyTrend = {
    prevTotal: prevWeek?.total ?? 0,
    currTotal: currWeek?.total ?? 0,
    delta: deltaStr(currWeek?.total, prevWeek?.total),
    prevErrors: prevWeek?.errors ?? 0,
    currErrors: currWeek?.errors ?? 0,
    errorDelta: deltaStr(currWeek?.errors, prevWeek?.errors),
  }

  // -- Anomalies récentes (3 max)
  const recentAnomalies = db.prepare(`
    SELECT type, severity, DATE(detected_at) AS date
    FROM anomalies
    WHERE detected_at >= ? ${sc}
    ORDER BY detected_at DESC LIMIT 3
  `).all(from, ...sp).map(r => ({ type: r.type, severity: r.severity, date: r.date }))

  return {
    period: '30d',
    overview: {
      total: overview.total,
      humans: overview.humans,
      bots: overview.bots,
      s2xx: overview.s2xx,
      s3xx: overview.s3xx,
      s4xx: overview.s4xx,
      s5xx: overview.s5xx,
      errorRate,
    },
    top404,
    topPages,
    topBots,
    ttfb,
    topCountries,
    weeklyTrend,
    recentAnomalies,
  }
}

// ── Cache ──────────────────────────────────────────────────
export function getCachedSummary(siteId) {
  const key = `summary_${siteId ?? 'all'}`
  const cached = summaryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  const data = buildSiteSummary(siteId)
  summaryCache.set(key, { data, timestamp: Date.now() })
  return data
}

// ── System prompt ─────────────────────────────────────────
function getSystemPrompt(summary) {
  return `Tu es l'assistant SEO de Spider-Lens, un outil d'analyse de logs serveur.
Tu aides des utilisateurs qui ne sont pas forcément des experts techniques.

RÈGLES :
- Réponds toujours dans la langue utilisée par l'utilisateur
- Sois pédagogique : explique les termes techniques simplement, utilise des analogies
- Donne des recommandations concrètes et actionnables
- Si une information n'est pas dans les données disponibles, dis-le clairement
- Formate tes réponses en Markdown (titres, listes, gras)
- Sois concis : pas de blabla inutile, va droit au but

DONNÉES DU SITE (30 derniers jours) :
${JSON.stringify(summary, null, 0)}`
}

// ── Streaming vers SSE ─────────────────────────────────────
function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

export async function streamAnalysis(siteId, res) {
  const model = initGemini()
  if (!model) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' })
    return
  }

  const summary = getCachedSummary(siteId)
  const systemPrompt = getSystemPrompt(summary)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const result = await model.generateContentStream({
      systemInstruction: systemPrompt,
      contents: [{
        role: 'user',
        parts: [{ text: 'Analyse la santé SEO de ce site. Donne un **score sur 100**, liste les **3 problèmes principaux** et propose **3 recommandations prioritaires**. Sois pédagogique pour quelqu\'un qui découvre l\'analyse de logs.' }],
      }],
    })

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (e) {
    console.error('[aiAnalyzer] streamAnalysis error:', e.message)
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
}

export async function streamChat(siteId, messages, res) {
  const model = initGemini()
  if (!model) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' })
    return
  }

  const summary = getCachedSummary(siteId)
  const systemPrompt = getSystemPrompt(summary)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Construire l'historique pour Gemini (max 10 messages, format multi-turn)
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1]

  try {
    const chat = model.startChat({
      systemInstruction: systemPrompt,
      history,
    })

    const result = await chat.sendMessageStream(lastMessage.content)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (e) {
    console.error('[aiAnalyzer] streamChat error:', e.message)
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
}
