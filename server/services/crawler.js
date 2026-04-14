import { XMLParser } from 'fast-xml-parser'
import { getDb } from '../db/database.js'

// ── Constantes ────────────────────────────────────────────
const DEFAULT_MAX_DEPTH  = 3
const DEFAULT_MAX_PAGES  = 500
const DEFAULT_DELAY_MS   = 1000
const FETCH_TIMEOUT_MS   = 10000
const MAX_BODY_BYTES     = 2 * 1024 * 1024 // 2 MB
const MAX_CHILD_SITEMAPS = 10
const CRAWLER_UA         = 'SpiderLens-Crawler/1.0'

// ── État en mémoire ───────────────────────────────────────
// Map<siteId, { status, runId, controller, pagesFound, pagesCrawled, startedAt }>
const activeCrawls = new Map()

// ── Helpers URL ───────────────────────────────────────────
function normalizeUrl(raw) {
  try {
    const u = new URL(raw)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.hostname}${path}${u.search}`
  } catch { return null }
}

function isSameDomain(url, baseHostname) {
  try { return new URL(url).hostname === baseHostname }
  catch { return false }
}

// ── Extraction on-page (regex, sans DOM) ─────────────────
function extractPageData(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null

  const text = html.replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim()
  const wordCount = text ? text.split(' ').filter(w => w.length > 0).length : 0

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : null

  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']robots["']/i)
  const metaRobots = robotsMatch ? robotsMatch[1].trim() : null

  return { title, h1, wordCount, canonical, metaRobots }
}

// ── Extraction liens internes ─────────────────────────────
function extractInternalLinks(html, pageUrl, baseHostname) {
  const links = new Set()
  const hrefRe = /<a[^>]*\shref=["']([^"'#][^"']*?)["']/gi
  let m
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], pageUrl).href
      const norm = normalizeUrl(abs)
      if (norm && isSameDomain(norm, baseHostname)) links.add(norm)
    } catch { /* skip malformed */ }
  }
  return [...links]
}

// ── Parse sitemap XML ─────────────────────────────────────
async function fetchSitemapUrls(sitemapUrl, signal, depth = 0) {
  if (depth > 2) return []

  let xml
  try {
    const res = await fetch(sitemapUrl, {
      signal,
      headers: { 'User-Agent': CRAWLER_UA },
      redirect: 'follow',
    })
    if (!res.ok) return []
    xml = await res.text()
  } catch { return [] }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  let parsed
  try { parsed = parser.parse(xml) } catch { return [] }

  if (parsed.sitemapindex?.sitemap) {
    const children = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap]

    const urls = []
    for (const child of children.slice(0, MAX_CHILD_SITEMAPS)) {
      const loc = child.loc
      if (loc) {
        const childUrls = await fetchSitemapUrls(loc, signal, depth + 1)
        urls.push(...childUrls)
      }
    }
    return urls
  }

  if (parsed.urlset?.url) {
    const entries = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url]
    return entries.map(e => e.loc).filter(Boolean)
  }

  return []
}

// ── Crawl principal ───────────────────────────────────────
export async function startCrawl(siteId, opts = {}) {
  const db = getDb()
  const maxDepth  = opts.maxDepth  ?? DEFAULT_MAX_DEPTH
  const maxPages  = opts.maxPages  ?? DEFAULT_MAX_PAGES
  const delayMs   = opts.delayMs   ?? DEFAULT_DELAY_MS

  const sitemaps = db.prepare('SELECT url FROM site_sitemaps WHERE site_id = ?').all(siteId)
  if (!sitemaps.length) throw new Error('Aucun sitemap configuré pour ce site')

  const runResult = db.prepare(`
    INSERT INTO crawl_runs (site_id, status, started_at)
    VALUES (?, 'running', datetime('now'))
  `).run(siteId)
  const runId = runResult.lastInsertRowid

  db.prepare('DELETE FROM crawled_pages WHERE site_id = ?').run(siteId)

  const controller = new AbortController()
  activeCrawls.set(siteId, {
    status: 'running',
    runId,
    controller,
    pagesFound: 0,
    pagesCrawled: 0,
    startedAt: new Date().toISOString(),
  })

  runCrawlBFS(siteId, sitemaps.map(s => s.url), runId, controller.signal, { maxDepth, maxPages, delayMs })
    .catch(e => {
      console.error(`[crawler] Erreur fatale site ${siteId}:`, e.message)
      db.prepare(`UPDATE crawl_runs SET status='error', error=?, finished_at=datetime('now') WHERE id=?`).run(e.message, runId)
      activeCrawls.delete(siteId)
    })

  return { runId }
}

async function runCrawlBFS(siteId, sitemapUrls, runId, signal, { maxDepth, maxPages, delayMs }) {
  const db = getDb()

  let seedUrls = []
  for (const url of sitemapUrls) {
    const urls = await fetchSitemapUrls(url, signal)
    seedUrls.push(...urls)
    if (signal.aborted) break
  }

  const seen = new Set()
  const queue = []

  for (const raw of seedUrls) {
    const norm = normalizeUrl(raw)
    if (norm && !seen.has(norm)) {
      seen.add(norm)
      queue.push({ url: norm, depth: 0, source: 'sitemap' })
    }
  }

  if (!queue.length) {
    db.prepare(`UPDATE crawl_runs SET status='completed', pages_found=0, pages_crawled=0, finished_at=datetime('now') WHERE id=?`).run(runId)
    activeCrawls.delete(siteId)
    return
  }

  const baseHostname = new URL(queue[0].url).hostname

  const state = activeCrawls.get(siteId)
  if (state) state.pagesFound = queue.length
  db.prepare('UPDATE crawl_runs SET pages_found = ? WHERE id = ?').run(queue.length, runId)

  const insertPage = db.prepare(`
    INSERT OR REPLACE INTO crawled_pages
      (site_id, url, status_code, title, h1, word_count, canonical, meta_robots, depth, source, crawled_at, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `)

  let pagesCrawled = 0

  while (queue.length > 0 && pagesCrawled < maxPages && !signal.aborted) {
    const { url, depth, source } = queue.shift()

    let statusCode = null
    let error = null
    let title = null, h1 = null, wordCount = 0, canonical = null, metaRobots = null

    try {
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      const combinedSignal = AbortSignal.any([signal, timeoutSignal])

      const res = await fetch(url, {
        signal: combinedSignal,
        redirect: 'follow',
        headers: { 'User-Agent': CRAWLER_UA },
      })

      statusCode = res.status
      const contentType = res.headers.get('content-type') || ''

      if (!contentType.includes('text/html')) {
        error = 'non-html'
      } else {
        const reader = res.body?.getReader()
        if (!reader) {
          error = 'no-body'
        } else {
          const chunks = []
          let totalBytes = 0
          let truncated = false

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            totalBytes += value.byteLength
            if (totalBytes > MAX_BODY_BYTES) {
              truncated = true
              reader.cancel()
              break
            }
            chunks.push(value)
          }

          if (truncated) error = 'body-too-large'

          const merged = new Uint8Array(totalBytes > MAX_BODY_BYTES
            ? chunks.reduce((sum, c) => sum + c.byteLength, 0)
            : chunks.reduce((sum, c) => sum + c.byteLength, 0))
          let offset = 0
          for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }

          const html = new TextDecoder().decode(merged)

          if (html) {
            const data = extractPageData(html)
            title      = data.title
            h1         = data.h1
            wordCount  = data.wordCount
            canonical  = data.canonical
            metaRobots = data.metaRobots

            if (depth < maxDepth) {
              const links = extractInternalLinks(html, url, baseHostname)
              for (const link of links) {
                if (!seen.has(link)) {
                  seen.add(link)
                  queue.push({ url: link, depth: depth + 1, source: 'link' })
                }
              }
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        if (signal.aborted) break
        error = 'timeout'
      } else {
        error = (e.message || 'fetch-error').slice(0, 100)
      }
    }

    try {
      insertPage.run(siteId, url, statusCode, title, h1, wordCount, canonical, metaRobots, depth, source, error)
    } catch { /* UNIQUE constraint */ }

    pagesCrawled++

    const crawlState = activeCrawls.get(siteId)
    if (crawlState) {
      crawlState.pagesCrawled = pagesCrawled
      crawlState.pagesFound = seen.size
    }
    if (pagesCrawled % 10 === 0) {
      db.prepare('UPDATE crawl_runs SET pages_crawled = ?, pages_found = ? WHERE id = ?')
        .run(pagesCrawled, seen.size, runId)
    }

    if (queue.length > 0 && !signal.aborted) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  const finalStatus = signal.aborted ? 'cancelled' : 'completed'
  db.prepare(`
    UPDATE crawl_runs
    SET status = ?, pages_crawled = ?, pages_found = ?, finished_at = datetime('now')
    WHERE id = ?
  `).run(finalStatus, pagesCrawled, seen.size, runId)

  activeCrawls.delete(siteId)
  console.log(`[crawler] Site ${siteId} — ${finalStatus} : ${pagesCrawled} pages crawlées`)
}

// ── Annuler un crawl ──────────────────────────────────────
export function cancelCrawl(siteId) {
  const state = activeCrawls.get(siteId)
  if (!state || state.status !== 'running') return false
  state.controller.abort()
  state.status = 'cancelling'
  return true
}

// ── Statut d'un crawl ─────────────────────────────────────
export function getCrawlStatus(siteId) {
  const state = activeCrawls.get(siteId)
  if (state) {
    return {
      status:       state.status,
      runId:        state.runId,
      pagesFound:   state.pagesFound,
      pagesCrawled: state.pagesCrawled,
      startedAt:    state.startedAt,
    }
  }
  const db = getDb()
  const run = db.prepare('SELECT * FROM crawl_runs WHERE site_id = ? ORDER BY id DESC LIMIT 1').get(siteId)
  if (!run) return null
  return {
    status:       run.status,
    runId:        run.id,
    pagesFound:   run.pages_found,
    pagesCrawled: run.pages_crawled,
    startedAt:    run.started_at,
    finishedAt:   run.finished_at,
  }
}

// ── Re-check d'une URL (vérification statut actuel) ───────
// Utilisé par POST /api/crawler/recheck-url
// redirect: 'manual' pour capturer explicitement 301/302 sans les suivre
export async function fetchUrlStatus(url) {
  try {
    const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal:   timeoutSignal,
      redirect: 'manual',
      headers:  { 'User-Agent': CRAWLER_UA },
    })
    const location = res.headers.get('location') || null
    return { status: res.status, finalUrl: location }
  } catch {
    return { status: 0, finalUrl: null }
  }
}
