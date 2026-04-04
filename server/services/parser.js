import { createReadStream, statSync } from 'fs'
import { createInterface } from 'readline'
import { getDb } from '../db/database.js'

// ─────────────────────────────────────────────────────────
// Regex formats de logs
// ─────────────────────────────────────────────────────────

// Apache Combined / Nginx combined :
// 127.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "http://ref" "UA"
// Avec $request_time nginx (secondes flottantes) en dernier champ optionnel : ... "UA" 0.123
const REGEX_COMBINED = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d{3})\s+(\S+)(?:\s+"([^"]*)")?(?:\s+"([^"]*)")?(?:\s+(\d+(?:\.\d+)?))?/

// Nginx format par défaut (sans referrer/UA)
const REGEX_NGINX_DEFAULT = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d{3})\s+(\S+)/

// ─────────────────────────────────────────────────────────
// Liste de bots connus
// ─────────────────────────────────────────────────────────
const BOT_PATTERNS = [
  { regex: /Googlebot(?!-Image|-Mobile|-Video)/i, name: 'Googlebot' },
  { regex: /Googlebot-Image/i,  name: 'Googlebot-Image' },
  { regex: /Googlebot-Mobile/i, name: 'Googlebot-Mobile' },
  { regex: /bingbot/i,          name: 'Bingbot' },
  { regex: /AhrefsBot/i,        name: 'AhrefsBot' },
  { regex: /SemrushBot/i,       name: 'SemrushBot' },
  { regex: /MJ12bot|DotBot/i,   name: 'MajesticBot' },
  { regex: /ChatGPT-User/i,     name: 'ChatGPT-User' },
  { regex: /ClaudeBot|Anthropic/i, name: 'ClaudeBot' },
  { regex: /FacebookBot|facebookexternalhit/i, name: 'FacebookBot' },
  { regex: /Twitterbot/i,       name: 'Twitterbot' },
  { regex: /LinkedInBot/i,      name: 'LinkedInBot' },
  { regex: /Slackbot/i,         name: 'Slackbot' },
  { regex: /YandexBot/i,        name: 'YandexBot' },
  { regex: /Baiduspider/i,      name: 'BaiduSpider' },
  { regex: /bot|crawler|spider|scraper/i, name: 'Unknown Bot' },
]

export function detectBot(userAgent) {
  if (!userAgent) return { isBot: false, botName: null }
  for (const pattern of BOT_PATTERNS) {
    if (pattern.regex.test(userAgent)) {
      return { isBot: true, botName: pattern.name }
    }
  }
  return { isBot: false, botName: null }
}

// ─────────────────────────────────────────────────────────
// Parse une ligne de log
// ─────────────────────────────────────────────────────────
export function parseLine(line) {
  const match = REGEX_COMBINED.exec(line) || REGEX_NGINX_DEFAULT.exec(line)
  if (!match) return null

  const [, ip, dateStr, method, url, statusStr, sizeStr, referrer, userAgent, responseTimeStr] = match

  const timestamp = parseDate(dateStr)
  if (!timestamp) return null

  const { isBot, botName } = detectBot(userAgent)

  return {
    timestamp: timestamp.toISOString(),
    ip: ip === '-' ? null : ip,
    method: method || null,
    url: normalizeUrl(url),
    status_code: parseInt(statusStr, 10),
    response_size: sizeStr === '-' ? 0 : parseInt(sizeStr, 10),
    referrer: referrer === '-' || !referrer ? null : referrer,
    user_agent: userAgent || null,
    response_time_ms: responseTimeStr ? Math.round(parseFloat(responseTimeStr) * 1000) : null,
    is_bot: isBot ? 1 : 0,
    bot_name: botName || null,
  }
}

function parseDate(dateStr) {
  const m = /(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([\+\-]\d{4})/.exec(dateStr)
  if (!m) return null
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }
  const [, day, mon, year, hh, mm, ss] = m
  return new Date(Date.UTC(+year, months[mon], +day, +hh, +mm, +ss))
}

function normalizeUrl(url) {
  try {
    const u = url.startsWith('http') ? new URL(url) : new URL('http://x' + url)
    return u.pathname
  } catch {
    return url.split('?')[0]
  }
}

// ─────────────────────────────────────────────────────────
// Lecture incrémentale du fichier de log
// ─────────────────────────────────────────────────────────
export async function parseLogFile(logFilePath, siteId = null) {
  const db = getDb()

  let currentInode = 0
  let fileSize = 0
  try {
    const stat = statSync(logFilePath)
    currentInode = stat.ino
    fileSize = stat.size
  } catch {
    console.error(`[parser] Fichier introuvable : ${logFilePath}`)
    return { parsed: 0, errors: 0 }
  }

  const state = db.prepare('SELECT * FROM parse_state WHERE log_file_path = ?').get(logFilePath)
  const startOffset = (state && state.last_inode === currentInode) ? state.last_offset : 0

  if (startOffset >= fileSize) return { parsed: 0, errors: 0 }

  const insertEntry = db.prepare(`
    INSERT INTO log_entries
      (timestamp, ip, method, url, status_code, response_size, referrer, user_agent, response_time_ms, is_bot, bot_name, site_id)
    VALUES
      (@timestamp, @ip, @method, @url, @status_code, @response_size, @referrer, @user_agent, @response_time_ms, @is_bot, @bot_name, @site_id)
  `)
  const insertMany = db.transaction((entries) => { for (const e of entries) insertEntry.run(e) })

  let parsed = 0, errors = 0
  const buffer = []

  await new Promise((resolve, reject) => {
    const stream = createReadStream(logFilePath, { start: startOffset, encoding: 'utf8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      if (!line.trim()) return
      const entry = parseLine(line)
      if (entry) {
        entry.site_id = siteId
        buffer.push(entry)
        parsed++
        if (buffer.length >= 1000) insertMany(buffer.splice(0, 1000))
      } else {
        errors++
      }
    })

    rl.on('close', () => { if (buffer.length) insertMany(buffer); resolve() })
    rl.on('error', reject)
    stream.on('error', reject)
  })

  db.prepare(`
    INSERT INTO parse_state (log_file_path, last_offset, last_inode, last_parsed_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(log_file_path) DO UPDATE SET
      last_offset = excluded.last_offset,
      last_inode = excluded.last_inode,
      last_parsed_at = excluded.last_parsed_at
  `).run(logFilePath, fileSize, currentInode)

  console.log(`[parser] ${parsed} entrées parsées, ${errors} erreurs`)
  return { parsed, errors }
}
