/**
 * Seed — génère 60 jours de données mockées dans Spider-Lens
 * Usage : node scripts/seed.js
 */

import { getDb } from '../db/database.js'
import dotenv from 'dotenv'
dotenv.config()

const db = getDb()

// ── Config ────────────────────────────────────────────────
const DAYS = 60
const ENTRIES_PER_DAY_BASE = 2000  // trafic humain moyen
const BOT_RATIO = 0.35             // 35% de bots

const URLS = [
  '/', '/a-propos/', '/contact/', '/services/', '/blog/',
  '/blog/seo-local-caen/', '/blog/optimisation-vitesse/',
  '/blog/crawl-budget-googlebot/', '/prestations/creation-site/',
  '/prestations/seo/', '/prestations/maintenance/', '/portfolio/',
  '/faq/', '/mentions-legales/', '/sitemap.xml', '/robots.txt',
  // 404s fréquents
  '/wp-admin/', '/wp-login.php', '/old-page/', '/page-supprimee/',
  '/ancien-blog/article-1/', '/promo-ete-2022/', '/test/',
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

const BOTS = [
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

const IPS = Array.from({ length: 80 }, (_, i) => `${80 + (i % 60)}.${i % 256}.${(i * 3) % 256}.${(i * 7) % 256}`)

// ── Helpers ───────────────────────────────────────────────
function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomUrl(statusCode) {
  if (statusCode === 404) {
    const error404Urls = ['/wp-admin/', '/wp-login.php', '/old-page/', '/page-supprimee/', '/ancien-blog/article-1/', '/promo-ete-2022/', '/test/']
    return error404Urls[randInt(0, error404Urls.length - 1)]
  }
  const normalUrls = URLS.filter(u => !u.includes('wp-') && !u.includes('old-') && !u.includes('supprimee') && !u.includes('ancien') && !u.includes('promo') && u !== '/test/')
  return normalUrls[randInt(0, normalUrls.length - 1)]
}

// ── Génération ────────────────────────────────────────────
console.log('🌱 Génération des données mockées...')

db.prepare('DELETE FROM log_entries').run()
db.prepare('DELETE FROM parse_state').run()

const insert = db.prepare(`
  INSERT INTO log_entries
    (timestamp, ip, method, url, status_code, response_size, referrer, user_agent, response_time_ms, is_bot, bot_name)
  VALUES
    (@timestamp, @ip, @method, @url, @status_code, @response_size, @referrer, @user_agent, @response_time_ms, @is_bot, @bot_name)
`)

const insertMany = db.transaction((entries) => {
  for (const e of entries) insert.run(e)
})

const now = new Date()
let totalInserted = 0

for (let d = DAYS - 1; d >= 0; d--) {
  const dayBase = new Date(now)
  dayBase.setDate(dayBase.getDate() - d)
  dayBase.setHours(0, 0, 0, 0)

  // Variation trafic : weekend -40%, tendance légère hausse sur 60j
  const dayOfWeek = dayBase.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const trendFactor = 1 + (DAYS - d) / DAYS * 0.3  // +30% sur 60 jours
  const weekendFactor = isWeekend ? 0.6 : 1
  // Pic de crise simulé jour 20 : erreurs 5xx
  const crisisFactor = d === 20 ? 3 : 1  // spike 5xx

  const dailyEntries = Math.floor(ENTRIES_PER_DAY_BASE * trendFactor * weekendFactor)
  const botEntries = Math.floor(dailyEntries * BOT_RATIO)
  const humanEntries = dailyEntries - botEntries

  const entries = []

  // Humains
  for (let i = 0; i < humanEntries; i++) {
    const hour = randInt(6, 23)  // les humains naviguent de 6h à 23h
    const minute = randInt(0, 59)
    const ts = new Date(dayBase)
    ts.setHours(hour, minute, randInt(0, 59))

    const statusItem = weightedRandom(STATUS_DIST)
    // Amplifier les 5xx lors du pic de crise
    const statusCode = (d === 20 && Math.random() < 0.15) ? 500 : statusItem.code

    entries.push({
      timestamp: ts.toISOString(),
      ip: IPS[randInt(0, IPS.length - 1)],
      method: Math.random() < 0.95 ? 'GET' : 'POST',
      url: randomUrl(statusCode),
      status_code: statusCode,
      response_size: randInt(500, 85000),
      referrer: Math.random() < 0.3 ? 'https://www.google.com/' : null,
      user_agent: HUMAN_UAS[randInt(0, HUMAN_UAS.length - 1)],
      response_time_ms: randInt(50, 1800),
      is_bot: 0,
      bot_name: null,
    })
  }

  // Bots
  for (let i = 0; i < botEntries; i++) {
    const hour = randInt(0, 23)  // les bots crawlent 24h/24
    const ts = new Date(dayBase)
    ts.setHours(hour, randInt(0, 59), randInt(0, 59))

    const bot = weightedRandom(BOTS)
    // Googlebot absent les 5 derniers jours (simulation alerte)
    if (bot.name === 'Googlebot' && d < 5) continue

    const statusCode = Math.random() < 0.85 ? 200 : Math.random() < 0.7 ? 404 : 301

    entries.push({
      timestamp: ts.toISOString(),
      ip: `66.${randInt(100, 200)}.${randInt(0, 255)}.${randInt(0, 255)}`,
      method: 'GET',
      url: randomUrl(statusCode),
      status_code: statusCode,
      response_size: randInt(1000, 50000),
      referrer: null,
      user_agent: bot.ua,
      response_time_ms: randInt(30, 600),
      is_bot: 1,
      bot_name: bot.name,
    })
  }

  insertMany(entries)
  totalInserted += entries.length

  if (d % 10 === 0) {
    const date = dayBase.toISOString().slice(0, 10)
    console.log(`  ✓ ${date} — ${entries.length} entrées`)
  }
}

// ── Résumé ────────────────────────────────────────────────
const stats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as humans,
    SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bots,
    SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) as s404,
    SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as s5xx
  FROM log_entries
`).get()

console.log(`
✅ Seed terminé !
   Total    : ${stats.total.toLocaleString('fr-FR')} entrées
   Humains  : ${stats.humans.toLocaleString('fr-FR')}
   Bots     : ${stats.bots.toLocaleString('fr-FR')}
   404      : ${stats.s404.toLocaleString('fr-FR')}
   5xx      : ${stats.s5xx.toLocaleString('fr-FR')}

   Scénarios simulés :
   - Spike 5xx il y a 20 jours
   - Googlebot absent depuis 5 jours (→ alerte crawl)
   - Tendance trafic +30% sur 60 jours
   - Baisse trafic les weekends (-40%)
`)
