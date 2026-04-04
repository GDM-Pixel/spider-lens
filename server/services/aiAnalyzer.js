import { GoogleGenerativeAI } from '@google/generative-ai'
import geoip from 'geoip-lite'
import { getDb } from '../db/database.js'

// ── Modèle Gemini ─────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'

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

  // Filtre UA : exclure uniquement les UA vides ou corrompus (bots qui se font passer pour humains)
  // Ne PAS filtrer par URL — les sites WordPress ont des URLs /wp-content, /wp-json légitimes
  const SCAN_UA_SQL = `(user_agent IS NOT NULL AND user_agent != '-' AND user_agent NOT LIKE '"%')`

  // URLs universellement suspectes (aucun site légitime ne les sert) — pour l'estimation des scans
  const SCAN_ONLY_URL_SQL = `(
    url LIKE '%wp-login%' OR url LIKE '%xmlrpc%'
    OR url LIKE '%.env%' OR url LIKE '%/.git%' OR url LIKE '%/phpmyadmin%'
    OR url LIKE '%wlwmanifest%' OR url LIKE '%/actuator%'
    OR url LIKE '%/info.php%'
  )`

  // -- Top 5 pages 404 humains réels (hors UA vides/corrompus — inclut URLs WP légitimes)
  const top404 = db.prepare(`
    SELECT url, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND status_code = 404 AND is_bot = 0
      AND ${SCAN_UA_SQL} ${sc}
    GROUP BY url ORDER BY hits DESC LIMIT 5
  `).all(from, to, ...sp).map(r => ({ url: trunc(r.url), hits: r.hits }))

  // -- Estimation des requêtes scan (bots déguisés en humains — URLs non-WordPress)
  const scanEstimate = db.prepare(`
    SELECT COUNT(*) AS count
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND is_bot = 0
      AND ${SCAN_UA_SQL}
      AND ${SCAN_ONLY_URL_SQL} ${sc}
  `).get(from, to, ...sp)

  // -- 404 breakdown : humains vs bots vs scans malveillants
  const err404Detail = db.prepare(`
    SELECT
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human404,
      SUM(CASE WHEN is_bot = 1 AND user_agent LIKE '%Googlebot%' THEN 1 ELSE 0 END) AS googlebot404,
      SUM(CASE WHEN is_bot = 1 AND user_agent NOT LIKE '%Googlebot%'
               AND (url LIKE '%wp-login%' OR url LIKE '%.env%'
                    OR url LIKE '%/.git%' OR url LIKE '%/phpmyadmin%'
                    OR url LIKE '%xmlrpc%') THEN 1 ELSE 0 END) AS scan404,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot404
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND status_code = 404 ${sc}
  `).get(from, to, ...sp)

  // -- Taux d'erreur humains réels (SEO-pertinent — hors UA vides/corrompus uniquement)
  const humanOverview = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND is_bot = 0
      AND ${SCAN_UA_SQL} ${sc}
  `).get(from, to, ...sp)

  const humanErrorRate = humanOverview.total > 0
    ? `${(((humanOverview.s4xx + humanOverview.s5xx) / humanOverview.total) * 100).toFixed(1)}%`
    : '0%'

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

  // -- Googlebot spécifique (SEO-critical)
  const googlebotStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
      SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) AS s404,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
      COUNT(DISTINCT DATE(timestamp)) AS activeDays
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND user_agent LIKE '%Googlebot%' ${sc}
  `).get(from, to, ...sp)

  const googlebotTop404 = db.prepare(`
    SELECT url, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND user_agent LIKE '%Googlebot%' AND status_code = 404 ${sc}
    GROUP BY url ORDER BY hits DESC LIMIT 5
  `).all(from, to, ...sp).map(r => ({ url: trunc(r.url), hits: r.hits }))

  // -- Bots SEO tiers (Bingbot, AhrefsBot, SemrushBot, MJ12bot, ClaudeBot, etc.)
  // Données de crawl par bot — ce qu'ils voient comme codes HTTP = reflet réel de la santé du site
  const SEO_BOTS = [
    { key: 'bingbot',    pattern: '%Bingbot%'    },
    { key: 'ahrefsbot',  pattern: '%AhrefsBot%'  },
    { key: 'semrushbot', pattern: '%SemrushBot%' },
    { key: 'mj12bot',    pattern: '%MJ12bot%'    },
    { key: 'claudebot',  pattern: '%ClaudeBot%'  },
    { key: 'gptbot',     pattern: '%GPTBot%'     },
  ]
  const seoBotStats = {}
  for (const bot of SEO_BOTS) {
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
        SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) AS s404,
        SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
        COUNT(DISTINCT DATE(timestamp)) AS activeDays
      FROM log_entries
      WHERE timestamp BETWEEN ? AND ? AND user_agent LIKE ? ${sc}
    `).get(from, to, bot.pattern, ...sp)
    if (row?.total > 0) seoBotStats[bot.key] = row
  }

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

  // -- Données crawl on-page (si disponibles pour ce site)
  let crawlSummary = null
  if (siteId != null) {
    const crawlTotal = db.prepare('SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ?').get(siteId)?.cnt || 0
    if (crawlTotal > 0) {
      const missingTitle = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND (title IS NULL OR title = '')").get(siteId).cnt
      const missingH1    = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND (h1 IS NULL OR h1 = '')").get(siteId).cnt
      const noindex      = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND meta_robots LIKE '%noindex%'").get(siteId).cnt
      const avgWc        = db.prepare("SELECT ROUND(AVG(word_count)) as avg FROM crawled_pages WHERE site_id = ? AND word_count > 0").get(siteId)?.avg || 0
      const thinContent  = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND word_count > 0 AND word_count < 300").get(siteId).cnt
      const errors       = db.prepare("SELECT COUNT(*) as cnt FROM crawled_pages WHERE site_id = ? AND error IS NOT NULL").get(siteId).cnt
      const lastCrawl    = db.prepare("SELECT MAX(crawled_at) as dt FROM crawled_pages WHERE site_id = ?").get(siteId)?.dt
      crawlSummary = { total: crawlTotal, missingTitle, missingH1, noindex, avgWordCount: avgWc, thinContent, errors, lastCrawl }
    }
  }

  // -- Cross-référence : top404 URLs présentes dans crawled_pages = vrais liens cassés internes
  // inCrawl: true → URL connue du site → problème SEO réel (lien cassé)
  // inCrawl: false → URL inconnue → scanner ou lien externe → à ignorer pour le score
  const top404WithCrawlRef = top404.map(item => {
    if (siteId == null || !crawlSummary) return { ...item, inCrawl: null }
    const urlPattern = item.url.replace(/…$/, '')
    const found = db.prepare("SELECT 1 FROM crawled_pages WHERE site_id = ? AND url LIKE ? LIMIT 1").get(siteId, `%${urlPattern}%`)
    return { ...item, inCrawl: !!found }
  })

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
      errorRate,             // taux global (humains + bots)
      humanErrorRate,        // taux erreur humains uniquement — SEO-pertinent
      // Estimation des requêtes de scan déguisées en humains (wp-login, .env, xmlrpc, etc.)
      // Si ce chiffre est élevé, humanErrorRate peut être artificiellement gonflé
      scanRequestsEstimate: scanEstimate?.count ?? 0,
    },
    // 404 breakdown : humains / googlebot / scans malveillants
    err404Detail: {
      human404: err404Detail?.human404 ?? 0,
      googlebot404: err404Detail?.googlebot404 ?? 0,
      scan404: err404Detail?.scan404 ?? 0,   // wp-admin, .env, etc. — à IGNORER pour le score SEO
      bot404: err404Detail?.bot404 ?? 0,
    },
    top404: top404WithCrawlRef,  // top 404 humains, avec inCrawl: true/false/null
    topPages,
    topBots,
    // Googlebot — indicateur SEO principal
    googlebot: {
      total: googlebotStats?.total ?? 0,
      s2xx: googlebotStats?.s2xx ?? 0,
      s404: googlebotStats?.s404 ?? 0,
      s5xx: googlebotStats?.s5xx ?? 0,
      activeDays: googlebotStats?.activeDays ?? 0,  // jours actifs sur 30
      top404: googlebotTop404,
    },
    ttfb,
    topCountries,
    weeklyTrend,
    recentAnomalies,
    crawlSummary,    // données on-page du crawler (null si pas encore crawlé)
    seoBotStats,     // codes HTTP vus par Bingbot, AhrefsBot, SemrushBot, MJ12bot, ClaudeBot, GPTBot
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
function getSystemPrompt(summary, pageContext) {
  const contextBlock = pageContext
    ? `\n\nCONTEXTE PAGE ACTUELLE (ce que l'utilisateur voit en ce moment) :\n${JSON.stringify(pageContext)}`
    : ''

  return `Tu es Nova, une assistante SEO intégrée à Spider-Lens, un outil d'analyse de logs serveur.

COMPORTEMENT :
- Tu es conversationnelle et naturelle. Si l'utilisateur dit "Salut", tu réponds juste "Salut !" ou quelque chose de court et chaleureux — pas un rapport complet.
- Tu adaptes la longueur de ta réponse à la question posée. Question courte → réponse courte. Question technique → réponse détaillée.
- Tu n'envoies JAMAIS tout ce que tu sais d'emblée. Tu attends qu'on te pose une vraie question.
- Si on te demande une analyse ou un bilan, alors oui tu développes. Sinon, tu restes concise.
- Tu utilises le Markdown uniquement quand c'est utile (listes, code). Pas de titres H1/H2 pour une réponse de 2 phrases.
- Tu réponds dans la langue de l'utilisateur.
- Tu expliques les termes techniques simplement quand c'est pertinent.

DONNÉES DU SITE (30 derniers jours) — à utiliser uniquement si la question le justifie :
${JSON.stringify(summary, null, 0)}${contextBlock}`
}

// ── Init Gemini ────────────────────────────────────────────
function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: GEMINI_MODEL })
}

// ── Analyse structurée JSON ────────────────────────────────
const structuredCache = new Map()

export async function analyzeStructured(siteId, language = 'en') {
  const key = `structured_${siteId ?? 'all'}_${language}`
  const cached = structuredCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const model = initGemini()
  if (!model) throw new Error('GEMINI_API_KEY non configurée')

  const summary = getCachedSummary(siteId)

  const SCORE_LABELS = {
    great:    { fr: 'Très Bon',  en: 'Great',    es: 'Muy Bueno', de: 'Sehr Gut',  it: 'Ottimo',   nl: 'Uitstekend' },
    good:     { fr: 'Bon',      en: 'Good',     es: 'Bueno',     de: 'Gut',       it: 'Buono',    nl: 'Goed'       },
    average:  { fr: 'Moyen',    en: 'Average',  es: 'Regular',   de: 'Mittel',    it: 'Medio',    nl: 'Gemiddeld'  },
    bad:      { fr: 'Mauvais',  en: 'Poor',     es: 'Malo',      de: 'Schlecht',  it: 'Scarso',   nl: 'Slecht'     },
    critical: { fr: 'Critique', en: 'Critical', es: 'Crítico',   de: 'Kritisch',  it: 'Critico',  nl: 'Kritiek'    },
  }
  const lang = language.split('-')[0]
  const labels = {
    great:    SCORE_LABELS.great[lang]    || SCORE_LABELS.great.en,
    good:     SCORE_LABELS.good[lang]     || SCORE_LABELS.good.en,
    average:  SCORE_LABELS.average[lang]  || SCORE_LABELS.average.en,
    bad:      SCORE_LABELS.bad[lang]      || SCORE_LABELS.bad.en,
    critical: SCORE_LABELS.critical[lang] || SCORE_LABELS.critical.en,
  }

  const prompt = `You are an SEO expert analyzing the health of a website based on its server logs.

SITE DATA (last 30 days):
${JSON.stringify(summary)}

IMPORTANT: All text fields in your response (summary, titles, details, actions, why, key names) MUST be written in "${language}" language. Only JSON keys and enum values (scoreColor, impact, trend, icon names) must remain in English.

Generate a structured SEO analysis as strict JSON. Follow EXACTLY this format:

{
  "score": <integer 0-100>,
  "scoreLabel": <"${labels.critical}"|"${labels.bad}"|"${labels.average}"|"${labels.good}"|"${labels.great}">,
  "scoreColor": <"dustyred"|"amber"|"moonstone"|"green">,
  "summary": <short synthesis sentence, max 120 chars, pedagogical>,
  "problems": [
    {
      "id": <snake_case identifier>,
      "icon": <phosphor icon e.g. "ph:warning-diamond">,
      "color": <"dustyred"|"amber"|"moonstone">,
      "title": <short problem title>,
      "detail": <pedagogical explanation with analogy, max 150 chars>,
      "impact": <"critique"|"warning"|"info">
    }
  ],
  "recommendations": [
    {
      "id": <snake_case identifier>,
      "icon": <phosphor icon e.g. "ph:arrow-bend-up-right">,
      "title": <short recommendation title>,
      "action": <concrete action to take, max 150 chars>,
      "why": <why it matters for SEO, max 100 chars>
    }
  ],
  "highlights": [
    {
      "key": <metric name>,
      "value": <formatted value e.g. "11 344">,
      "trend": <"up"|"down"|"neutral">,
      "icon": <phosphor icon>
    }
  ]
}

SEO SCORING PHILOSOPHY — READ CAREFULLY:
This is an SEO-focused analysis. The score reflects what Google cares about, NOT raw server statistics.

WHAT MATTERS FOR SEO (affects the score):
1. Googlebot health (googlebot field): 404s and 5xx seen by Googlebot, activeDays — this is the PRIMARY SEO signal.
2. SEO bot health (seoBotStats field): HTTP codes seen by Bingbot, AhrefsBot, SemrushBot, MJ12bot, ClaudeBot, GPTBot. High 404/5xx rates across multiple bots = confirmed site health issue. Use this to corroborate Googlebot findings.
3. TTFB: server response time affects Core Web Vitals and crawl efficiency.
4. Crawl budget waste: Googlebot crawling 404 pages wastes crawl budget.
5. Human 404s (top404 field): only penalize those with inCrawl: true (real internal broken links confirmed by crawler).

WHAT DOES NOT AFFECT SEO SCORE:
- humanErrorRate may be inflated by automated scanners (bots with human-looking User-Agents hitting wp-login, .env, etc.). Do NOT use humanErrorRate as a primary scoring signal — use it only as secondary context.
- scan404 in err404Detail: security scan attempts — NOT an SEO problem.
- The global errorRate includes all bot scans — do NOT use it for scoring.
- scanRequestsEstimate: if significant (> 50), humanErrorRate is likely inflated. Mention as info only.
- top404 entries with inCrawl: false — these URLs don't exist on the site (scanners, external links). Do NOT penalize the score for these.

CRAWLER DATA (top404 cross-reference — when crawlSummary is available):
- top404 entries with "inCrawl: true": the URL was found during sitemap crawl → this is a REAL broken internal link. Penalize the score accordingly.
- top404 entries with "inCrawl: false": the URL was NOT found during crawling → it's not a real page (scanner probing, external referrer, outdated bookmark). Do NOT penalize the score for these.
- top404 entries with "inCrawl: null": no crawl data available yet, treat with caution.
- crawlSummary.missingTitle > 0: pages without <title> tag — critical SEO issue, penalize.
- crawlSummary.missingH1 > 0: pages without <h1> tag — important SEO issue, mention as warning.
- crawlSummary.thinContent: pages < 300 words — flag as warning if > 10% of total pages.
- crawlSummary.noindex: noindex pages — mention as info (may be intentional).
- If crawlSummary is null: no crawl has been run yet, do not mention crawl data.

SCORING RULES:
- 80-100 → "${labels.great}", scoreColor: "green"
- 60-79 → "${labels.good}", scoreColor: "moonstone"
- 40-59 → "${labels.average}", scoreColor: "amber"
- 20-39 → "${labels.bad}", scoreColor: "dustyred"
- 0-19 → "${labels.critical}", scoreColor: "dustyred"

PROBLEMS rules (3 to 5 problems):
- impact "critique": Googlebot seeing 5xx errors, or humanErrorRate > 15%, or TTFB avg > 1000ms, or Googlebot absent (activeDays < 3)
- impact "warning": Googlebot 404s > 10 URLs, or humanErrorRate > 5%, or TTFB avg 500-1000ms
- impact "info": minor optimizations, security scans (mention as info only, not SEO-critical)

HIGHLIGHTS rules (2 to 4 positive signals or key metrics):
- Googlebot activity, human visit trends, fast TTFB, low human error rate, etc.

ICONS rules (use only @phosphor-icons):
- Errors/problems: ph:warning-diamond, ph:x-circle, ph:bug
- Performance: ph:lightning, ph:gauge, ph:clock
- Bots/crawl: ph:robot, ph:magnifying-glass
- SEO/links: ph:arrow-bend-up-right, ph:link, ph:files
- Positive: ph:check-circle, ph:trend-up, ph:star

Return ONLY the JSON, no markdown, no comments, no text before or after.`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  })

  const raw = result.response.text()
  console.log('[analyzeStructured] raw response (first 200):', raw?.slice(0, 200))
  const data = JSON.parse(raw)

  structuredCache.set(key, { data, timestamp: Date.now() })
  return data
}

// ── Streaming vers SSE ─────────────────────────────────────

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
      systemInstruction: { parts: [{ text: systemPrompt }] },
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

export async function streamChat(siteId, messages, pageContext, res) {
  const model = initGemini()
  if (!model) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurée' })
    return
  }

  const summary = getCachedSummary(siteId)
  const systemPrompt = getSystemPrompt(summary, pageContext || null)

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
      systemInstruction: { parts: [{ text: systemPrompt }] },
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
