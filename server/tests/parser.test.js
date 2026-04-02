import { parseLine, detectBot } from '../services/parser.js'

// ─────────────────────────────────────────────────────────
// detectBot
// ─────────────────────────────────────────────────────────
describe('detectBot()', () => {
  test('identifie Googlebot', () => {
    const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    const result = detectBot(ua)
    expect(result.isBot).toBe(true)
    expect(result.botName).toBe('Googlebot')
  })

  test('identifie AhrefsBot', () => {
    const ua = 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'
    const result = detectBot(ua)
    expect(result.isBot).toBe(true)
    expect(result.botName).toBe('AhrefsBot')
  })

  test('identifie SemrushBot', () => {
    const ua = 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'
    const result = detectBot(ua)
    expect(result.isBot).toBe(true)
    expect(result.botName).toBe('SemrushBot')
  })

  test('identifie ClaudeBot', () => {
    const ua = 'ClaudeBot/1.0; +https://www.anthropic.com/claude-bot'
    const result = detectBot(ua)
    expect(result.isBot).toBe(true)
    expect(result.botName).toBe('ClaudeBot')
  })

  test('identifie un humain (Chrome)', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'
    const result = detectBot(ua)
    expect(result.isBot).toBe(false)
    expect(result.botName).toBeNull()
  })

  test('gère un user-agent vide', () => {
    expect(detectBot('')).toEqual({ isBot: false, botName: null })
    expect(detectBot(null)).toEqual({ isBot: false, botName: null })
    expect(detectBot(undefined)).toEqual({ isBot: false, botName: null })
  })

  test('Googlebot-Image est distinct de Googlebot', () => {
    const ua = 'Googlebot-Image/1.0'
    const result = detectBot(ua)
    expect(result.isBot).toBe(true)
    expect(result.botName).toBe('Googlebot-Image')
  })
})

// ─────────────────────────────────────────────────────────
// parseLine — format Apache Combined
// ─────────────────────────────────────────────────────────
describe('parseLine() — format Apache Combined', () => {
  const apacheLine =
    '192.168.1.1 - - [10/Oct/2023:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "http://example.com/" "Mozilla/5.0 Chrome/121.0"'

  test('parse une ligne Apache valide', () => {
    const result = parseLine(apacheLine)
    expect(result).not.toBeNull()
    expect(result.ip).toBe('192.168.1.1')
    expect(result.method).toBe('GET')
    expect(result.url).toBe('/index.html')
    expect(result.status_code).toBe(200)
    expect(result.response_size).toBe(2326)
    expect(result.referrer).toBe('http://example.com/')
    expect(result.user_agent).toBe('Mozilla/5.0 Chrome/121.0')
    expect(result.is_bot).toBe(0)
    expect(result.timestamp).toBeTruthy()
  })

  test('détecte Googlebot dans Apache Combined', () => {
    const line =
      '66.249.66.1 - - [10/Oct/2023:14:00:00 +0000] "GET /page HTTP/1.1" 200 1024 "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.is_bot).toBe(1)
    expect(result.bot_name).toBe('Googlebot')
  })

  test('parse une erreur 404', () => {
    const line =
      '10.0.0.1 - - [15/Jan/2024:10:30:00 +0100] "GET /page-inconnue HTTP/1.1" 404 512 "-" "Mozilla/5.0"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.status_code).toBe(404)
    expect(result.url).toBe('/page-inconnue')
  })

  test('normalise les URLs avec query string', () => {
    const line =
      '10.0.0.1 - - [15/Jan/2024:10:30:00 +0100] "GET /search?q=seo&page=2 HTTP/1.1" 200 1024 "-" "curl/7.68"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.url).toBe('/search')
  })

  test('gère le tiret comme referrer absent', () => {
    const line =
      '10.0.0.1 - - [15/Jan/2024:10:30:00 +0100] "GET / HTTP/1.1" 200 1024 "-" "Mozilla/5.0"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.referrer).toBeNull()
  })

  test('gère la taille "-" (body vide)', () => {
    const line =
      '10.0.0.1 - - [15/Jan/2024:10:30:00 +0100] "HEAD / HTTP/1.1" 200 - "-" "Mozilla/5.0"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.response_size).toBe(0)
  })

  test('retourne null pour une ligne invalide', () => {
    expect(parseLine('ligne complètement invalide')).toBeNull()
    expect(parseLine('')).toBeNull()
    expect(parseLine('127.0.0.1 - -')).toBeNull()
  })

  test('parse le timestamp correctement', () => {
    const line =
      '10.0.0.1 - - [01/Jan/2024:00:00:00 +0000] "GET / HTTP/1.1" 200 100 "-" "-"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z')
  })
})

// ─────────────────────────────────────────────────────────
// parseLine — format Nginx default (sans referrer/UA)
// ─────────────────────────────────────────────────────────
describe('parseLine() — format Nginx default', () => {
  test('parse une ligne Nginx minimal', () => {
    const line =
      '203.0.113.5 - - [12/Mar/2024:08:15:42 +0100] "POST /api/data HTTP/1.1" 201 256'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.ip).toBe('203.0.113.5')
    expect(result.method).toBe('POST')
    expect(result.url).toBe('/api/data')
    expect(result.status_code).toBe(201)
    expect(result.user_agent == null).toBe(true)  // null ou undefined selon le format
  })
})

// ─────────────────────────────────────────────────────────
// parseLine — avec TTFB (response_time_ms)
// ─────────────────────────────────────────────────────────
describe('parseLine() — avec TTFB', () => {
  test('parse le temps de réponse en fin de ligne', () => {
    const line =
      '10.0.0.1 - - [15/Jan/2024:10:30:00 +0100] "GET /slow-page HTTP/1.1" 200 8192 "-" "Mozilla/5.0" 1250'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.response_time_ms).toBe(1250)
  })

  test('retourne null pour response_time_ms si absent', () => {
    const line =
      '10.0.0.1 - - [15/Jan/2024:10:30:00 +0100] "GET / HTTP/1.1" 200 100 "-" "Mozilla/5.0"'
    const result = parseLine(line)
    expect(result).not.toBeNull()
    expect(result.response_time_ms).toBeNull()
  })
})
