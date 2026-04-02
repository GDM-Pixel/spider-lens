/**
 * Seed V0.2 — 2 sites avec profils distincts
 *
 * Site 1 : gdm-pixel.com — agence web, trafic mixte, spike 5xx j-20, Googlebot absent j-5
 * Site 2 : blog.gdm-pixel.com — blog SEO, moins de trafic, fort ratio bots SEO, TTFB élevé
 *
 * Usage : node scripts/seed_v02.js
 */

import { getDb } from '../db/database.js'
import dotenv from 'dotenv'
dotenv.config()

const db = getDb()

// ── Helpers ───────────────────────────────────────────────
function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) { r -= item.weight; if (r <= 0) return item }
  return items[items.length - 1]
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Constantes communes ───────────────────────────────────
const DAYS = 60

const BOTS_COMMON = [
  { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', name: 'Googlebot', weight: 40 },
  { ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', name: 'Bingbot', weight: 12 },
  { ua: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', name: 'AhrefsBot', weight: 18 },
  { ua: 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', name: 'SemrushBot', weight: 15 },
  { ua: 'ChatGPT-User (Mozilla/5.0)', name: 'ChatGPT-User', weight: 5 },
  { ua: 'ClaudeBot/1.0 (+https://www.anthropic.com/)', name: 'ClaudeBot', weight: 5 },
  { ua: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', name: 'YandexBot', weight: 3 },
  { ua: 'Twitterbot/1.0', name: 'Twitterbot', weight: 2 },
]

const HUMAN_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
]

const STATUS_DIST = [
  { code: 200, weight: 72 },
  { code: 301, weight: 10 },
  { code: 302, weight: 3 },
  { code: 304, weight: 3 },
  { code: 404, weight: 8 },
  { code: 403, weight: 1 },
  { code: 500, weight: 2 },
  { code: 503, weight: 1 },
]

const IPS = Array.from({ length: 80 }, (_, i) =>
  `${80 + (i % 60)}.${i % 256}.${(i * 3) % 256}.${(i * 7) % 256}`
)

function randomUrl(statusCode, urls, errorUrls) {
  if (statusCode === 404) return errorUrls[randInt(0, errorUrls.length - 1)]
  return urls[randInt(0, urls.length - 1)]
}

// ── Paramètres par site ───────────────────────────────────
const SITES_CONFIG = [
  {
    name: 'gdm-pixel.com',
    log_file_path: '/var/log/nginx/gdm-pixel.access.log',
    entriesPerDay: 2000,
    botRatio: 0.35,
    ttfbMin: 50,
    ttfbMax: 1800,
    spikeDay: 20,
    googlebotAbsentDays: 5,
    urls: [
      '/', '/a-propos/', '/contact/', '/services/', '/blog/',
      '/blog/seo-local-caen/', '/blog/optimisation-vitesse/',
      '/blog/crawl-budget-googlebot/', '/prestations/creation-site/',
      '/prestations/seo/', '/prestations/maintenance/', '/portfolio/',
      '/faq/', '/mentions-legales/', '/sitemap.xml', '/robots.txt',
    ],
    errorUrls: ['/wp-admin/', '/wp-login.php', '/old-page/', '/page-supprimee/', '/promo-ete-2022/'],
  },
  {
    name: 'blog.gdm-pixel.com',
    log_file_path: '/var/log/nginx/blog.access.log',
    entriesPerDay: 600,
    botRatio: 0.55,
    ttfbMin: 200,
    ttfbMax: 3500,
    spikeDay: null,
    googlebotAbsentDays: 0,
    urls: [
      '/blog/', '/blog/referencement-naturel-2024/', '/blog/core-web-vitals/',
      '/blog/schema-markup/', '/blog/liens-internes-seo/', '/blog/balises-title/',
      '/blog/google-search-console/', '/blog/audit-seo/', '/blog/vitesse-chargement/',
      '/blog/mobile-first/', '/about/', '/contact/', '/sitemap.xml',
    ],
    errorUrls: ['/blog/article-supprime/', '/old-category/', '/tag/deprecated/'],
  },
]

// ── Préparation DB ────────────────────────────────────────
console.log('Seed V0.2 — 2 sites...')

db.prepare('DELETE FROM log_entries').run()
db.prepare('DELETE FROM parse_state').run()
db.prepare('DELETE FROM sites').run()

const insertSite = db.prepare('INSERT INTO sites (name, log_file_path) VALUES (?, ?)')
const insertEntry = db.prepare(`
  INSERT INTO log_entries
    (timestamp, ip, method, url, status_code, response_size, referrer, user_agent, response_time_ms, is_bot, bot_name, site_id)
  VALUES
    (@timestamp, @ip, @method, @url, @status_code, @response_size, @referrer, @user_agent, @response_time_ms, @is_bot, @bot_name, @site_id)
`)
const insertMany = db.transaction((entries) => { for (const e of entries) insertEntry.run(e) })

// ── Génération ────────────────────────────────────────────
const now = new Date()
let grandTotal = 0

for (const site of SITES_CONFIG) {
  const siteRow = insertSite.run(site.name, site.log_file_path)
  const siteId = siteRow.lastInsertRowid
  let siteTotal = 0

  console.log(`\n  Site : ${site.name} (id=${siteId})`)

  for (let d = DAYS - 1; d >= 0; d--) {
    const dayBase = new Date(now)
    dayBase.setDate(dayBase.getDate() - d)
    dayBase.setHours(0, 0, 0, 0)

    const dayOfWeek = dayBase.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isMonday  = dayOfWeek === 1

    const trendFactor   = 1 + (DAYS - d) / DAYS * 0.3
    const weekendFactor = isWeekend ? 0.6 : (isMonday && site.botRatio > 0.5 ? 1.4 : 1)

    const dailyEntries = Math.floor(site.entriesPerDay * trendFactor * weekendFactor)
    const botEntries   = Math.floor(dailyEntries * site.botRatio)
    const humanEntries = dailyEntries - botEntries

    const entries = []

    // Humains
    for (let i = 0; i < humanEntries; i++) {
      const ts = new Date(dayBase)
      ts.setHours(randInt(6, 23), randInt(0, 59), randInt(0, 59))

      const statusItem = weightedRandom(STATUS_DIST)
      const statusCode = (site.spikeDay === d && Math.random() < 0.15) ? 500 : statusItem.code

      entries.push({
        timestamp:        ts.toISOString(),
        ip:               IPS[randInt(0, IPS.length - 1)],
        method:           Math.random() < 0.95 ? 'GET' : 'POST',
        url:              randomUrl(statusCode, site.urls, site.errorUrls),
        status_code:      statusCode,
        response_size:    randInt(500, 85000),
        referrer:         Math.random() < 0.3 ? 'https://www.google.com/' : null,
        user_agent:       HUMAN_UAS[randInt(0, HUMAN_UAS.length - 1)],
        response_time_ms: randInt(site.ttfbMin, site.ttfbMax),
        is_bot:           0,
        bot_name:         null,
        site_id:          siteId,
      })
    }

    // Bots
    for (let i = 0; i < botEntries; i++) {
      const ts = new Date(dayBase)
      ts.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59))

      const bot = weightedRandom(BOTS_COMMON)
      if (bot.name === 'Googlebot' && d < site.googlebotAbsentDays) continue

      const statusCode = Math.random() < 0.85 ? 200 : (Math.random() < 0.7 ? 404 : 301)

      entries.push({
        timestamp:        ts.toISOString(),
        ip:               `66.${randInt(100, 200)}.${randInt(0, 255)}.${randInt(0, 255)}`,
        method:           'GET',
        url:              randomUrl(statusCode, site.urls, site.errorUrls),
        status_code:      statusCode,
        response_size:    randInt(1000, 50000),
        referrer:         null,
        user_agent:       bot.ua,
        response_time_ms: randInt(30, 600),
        is_bot:           1,
        bot_name:         bot.name,
        site_id:          siteId,
      })
    }

    insertMany(entries)
    siteTotal += entries.length
  }

  grandTotal += siteTotal
  console.log(`  Total : ${siteTotal.toLocaleString('fr-FR')} entrees inserees`)
}

// ── Résumé ────────────────────────────────────────────────
const stats = db.prepare(`
  SELECT
    s.name,
    COUNT(*) as total,
    SUM(CASE WHEN l.is_bot = 0 THEN 1 ELSE 0 END) as humans,
    SUM(CASE WHEN l.is_bot = 1 THEN 1 ELSE 0 END) as bots,
    SUM(CASE WHEN l.status_code = 404 THEN 1 ELSE 0 END) as s404,
    SUM(CASE WHEN l.status_code >= 500 THEN 1 ELSE 0 END) as s5xx,
    ROUND(AVG(CASE WHEN l.response_time_ms IS NOT NULL THEN l.response_time_ms END)) as avg_ttfb
  FROM log_entries l
  JOIN sites s ON s.id = l.site_id
  GROUP BY l.site_id
`).all()

console.log('\nSeed V0.2 termine !\n')
for (const s of stats) {
  console.log(`  ${s.name}`)
  console.log(`    Total   : ${s.total.toLocaleString('fr-FR')}`)
  console.log(`    Humains : ${s.humans.toLocaleString('fr-FR')} | Bots : ${s.bots.toLocaleString('fr-FR')}`)
  console.log(`    404     : ${s.s404.toLocaleString('fr-FR')} | 5xx : ${s.s5xx.toLocaleString('fr-FR')} | TTFB moyen : ${s.avg_ttfb}ms`)
}
console.log(`\n  Total global : ${grandTotal.toLocaleString('fr-FR')} entrees`)
