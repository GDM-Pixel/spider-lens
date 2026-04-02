/**
 * Tests Network — IP, URLs, User-Agents
 * Utilise supertest + une DB SQLite in-memory isolée.
 * Le module database.js est mocké pour injecter la DB de test.
 */
import { jest } from '@jest/globals'

// ── Setup DB de test AVANT l'import des routes ──────────
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const testDb = new Database(':memory:')
testDb.pragma('journal_mode = WAL')

// Charger et exécuter le schema V0.1
const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8')
testDb.exec(schema)

// Charger et exécuter la migration V0.2 (multi-sites)
const migrationV02 = readFileSync(join(__dirname, '../db/migration_v02.sql'), 'utf8')
testDb.exec(migrationV02)

// Charger et exécuter la migration V0.3 (filtres IP/UA + anomalies)
const migrationV03 = readFileSync(join(__dirname, '../db/migration_v03.sql'), 'utf8')
testDb.exec(migrationV03)

// Mock du module database.js pour retourner notre DB de test
jest.unstable_mockModule('../db/database.js', () => ({
  getDb: () => testDb,
  default: () => testDb,
}))

// ── Import app après le mock ─────────────────────────────
import express from 'express'
import helmet from 'helmet'
import { createServer } from 'http'
import request from 'supertest'

const { default: authRoutes } = await import('../routes/auth.js')
const { default: networkRoutes } = await import('../routes/network.js')

function buildApp() {
  const app = express()
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/network', networkRoutes)
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
  return app
}

// ── Helpers ──────────────────────────────────────────────
function seedUser(username = 'admin', password = 'testpass123') {
  const hash = bcrypt.hashSync(password, 1)
  testDb.prepare('INSERT OR REPLACE INTO users (username, password_hash) VALUES (?, ?)').run(username, hash)
  return { username, password }
}

function clearDb() {
  testDb.exec('DELETE FROM log_entries')
  testDb.exec('DELETE FROM users')
}

function seedLogs() {
  const insert = testDb.prepare(`
    INSERT INTO log_entries (timestamp, ip, method, url, status_code, response_size, user_agent, is_bot, bot_name, response_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const now = new Date().toISOString()
  const yesterday = new Date(Date.now() - 86400000).toISOString()

  // 3 hits pour IP 1.2.3.4 (humain, Chrome UA)
  insert.run(now,       '1.2.3.4', 'GET', '/page-a',   200, 1024, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 0, null, 150)
  insert.run(now,       '1.2.3.4', 'GET', '/page-b',   404, 512,  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 0, null, 80)
  insert.run(yesterday, '1.2.3.4', 'GET', '/page-c',   200, 2048, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 0, null, 200)

  // 2 hits pour IP 5.6.7.8 (bot Googlebot)
  insert.run(now,       '5.6.7.8', 'GET', '/page-a', 200, 512, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 1, 'Googlebot', 120)
  insert.run(now,       '5.6.7.8', 'GET', '/sitemap.xml', 200, 1024, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 1, 'Googlebot', 100)

  // 1 hit pour IP 9.10.11.12 (bot unknown)
  insert.run(now, '9.10.11.12', 'GET', '/page-a', 500, 0, 'UnknownBot/1.0', 1, null, 5000)
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

let app
let authToken

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-jwt-for-tests-only'
  app = buildApp()
})

beforeEach(() => {
  clearDb()
})

// ── GET /api/network/ips ──────────────────────────────────
describe('GET /api/network/ips', () => {
  async function getToken() {
    const { username, password } = seedUser()
    const res = await request(app).post('/api/auth/login').send({ username, password })
    return res.body.token
  }

  test('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/network/ips')
    expect(res.status).toBe(401)
  })

  test('retourne 401 avec un token invalide', async () => {
    const res = await request(app)
      .get('/api/network/ips')
      .set('Authorization', 'Bearer token-bidon')
    expect(res.status).toBe(401)
  })

  test('retourne 200 avec token + structure rows/total/limit/offset', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/ips')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('rows')
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('limit')
    expect(res.body).toHaveProperty('offset')
    expect(Array.isArray(res.body.rows)).toBe(true)
    expect(typeof res.body.total).toBe('number')
  })

  test('filtre ?bot=1 ne retourne que des bots', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/network/ips')
      .set('Authorization', `Bearer ${token}`)
      .query({ bot: '1', from, to })
    expect(res.status).toBe(200)
    // Seules les IPs 5.6.7.8 et 9.10.11.12 sont des bots
    expect(res.body.rows.length).toBeGreaterThan(0)
    // Vérifier que seules des IPs bots sont retournées
    res.body.rows.forEach(row => {
      expect(['5.6.7.8', '9.10.11.12']).toContain(row.ip)
    })
  })

  test('filtre ?bot=0 ne retourne que des humains', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/network/ips')
      .set('Authorization', `Bearer ${token}`)
      .query({ bot: '0', from, to })
    expect(res.status).toBe(200)
    // Seule l'IP 1.2.3.4 est humaine
    expect(res.body.rows.length).toBeGreaterThan(0)
    res.body.rows.forEach(row => {
      expect(row.ip).toBe('1.2.3.4')
    })
  })

  test('filtre ?search= filtre par IP', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/network/ips')
      .set('Authorization', `Bearer ${token}`)
      .query({ search: '1.2.3', from, to })
    expect(res.status).toBe(200)
    expect(res.body.rows.length).toBe(1)
    expect(res.body.rows[0].ip).toBe('1.2.3.4')
  })

  test('retourne les bonnes colonnes dans rows', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/ips')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.rows.length).toBeGreaterThan(0)
    const firstRow = res.body.rows[0]
    expect(firstRow).toHaveProperty('ip')
    expect(firstRow).toHaveProperty('hits')
    expect(firstRow).toHaveProperty('bot_hits')
    expect(firstRow).toHaveProperty('human_hits')
    expect(firstRow).toHaveProperty('s2xx')
    expect(firstRow).toHaveProperty('s3xx')
    expect(firstRow).toHaveProperty('s4xx')
    expect(firstRow).toHaveProperty('s5xx')
    expect(firstRow).toHaveProperty('last_seen')
    expect(firstRow).toHaveProperty('bot_name')
  })
})

// ── GET /api/network/ips/:ip/urls ────────────────────────
describe('GET /api/network/ips/:ip/urls', () => {
  async function getToken() {
    const { username, password } = seedUser()
    const res = await request(app).post('/api/auth/login').send({ username, password })
    return res.body.token
  }

  test('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/network/ips/1.2.3.4/urls')
    expect(res.status).toBe(401)
  })

  test('retourne 401 avec un token invalide', async () => {
    const res = await request(app)
      .get('/api/network/ips/1.2.3.4/urls')
      .set('Authorization', 'Bearer token-bidon')
    expect(res.status).toBe(401)
  })

  test('retourne 200 avec token', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/ips/1.2.3.4/urls')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('retourne les URLs visitées par une IP', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/network/ips/1.2.3.4/urls')
      .set('Authorization', `Bearer ${token}`)
      .query({ from, to })
    expect(res.status).toBe(200)
    // L'IP 1.2.3.4 a visité /page-a, /page-b, /page-c
    expect(res.body.length).toBeGreaterThanOrEqual(3)
    const urls = res.body.map(row => row.url)
    expect(urls).toContain('/page-a')
    expect(urls).toContain('/page-b')
    expect(urls).toContain('/page-c')
  })

  test('retourne les bonnes colonnes dans le résultat', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/ips/1.2.3.4/urls')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    const firstRow = res.body[0]
    expect(firstRow).toHaveProperty('url')
    expect(firstRow).toHaveProperty('status_code')
    expect(firstRow).toHaveProperty('hits')
    expect(firstRow).toHaveProperty('last_seen')
  })

  test('retourne un array vide si l\'IP n\'existe pas', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/ips/999.999.999.999/urls')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

// ── GET /api/network/user-agents ─────────────────────────
describe('GET /api/network/user-agents', () => {
  async function getToken() {
    const { username, password } = seedUser()
    const res = await request(app).post('/api/auth/login').send({ username, password })
    return res.body.token
  }

  test('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/network/user-agents')
    expect(res.status).toBe(401)
  })

  test('retourne 401 avec un token invalide', async () => {
    const res = await request(app)
      .get('/api/network/user-agents')
      .set('Authorization', 'Bearer token-bidon')
    expect(res.status).toBe(401)
  })

  test('retourne 200 avec token + structure rows/total/limit/offset', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/user-agents')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('rows')
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('limit')
    expect(res.body).toHaveProperty('offset')
    expect(Array.isArray(res.body.rows)).toBe(true)
    expect(typeof res.body.total).toBe('number')
  })

  test('filtre ?bot=1 ne retourne que les user-agents de bots', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/network/user-agents')
      .set('Authorization', `Bearer ${token}`)
      .query({ bot: '1', from, to })
    expect(res.status).toBe(200)
    // Doit contenir les UAs des bots
    expect(res.body.rows.length).toBeGreaterThan(0)
    res.body.rows.forEach(row => {
      expect(row.is_bot).toBe(1)
    })
  })

  test('filtre ?bot=0 ne retourne que les user-agents humains', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/network/user-agents')
      .set('Authorization', `Bearer ${token}`)
      .query({ bot: '0', from, to })
    expect(res.status).toBe(200)
    expect(res.body.rows.length).toBeGreaterThan(0)
    res.body.rows.forEach(row => {
      expect(row.is_bot).toBe(0)
    })
  })

  test('retourne les bonnes colonnes dans rows', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/user-agents')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.rows.length).toBeGreaterThan(0)
    const firstRow = res.body.rows[0]
    expect(firstRow).toHaveProperty('user_agent')
    expect(firstRow).toHaveProperty('is_bot')
    expect(firstRow).toHaveProperty('bot_name')
    expect(firstRow).toHaveProperty('hits')
    expect(firstRow).toHaveProperty('last_seen')
  })

  test('les UAs humains sont présentes dans les résultats', async () => {
    const token = await getToken()
    seedLogs()
    const res = await request(app)
      .get('/api/network/user-agents')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    const found = res.body.rows.find(row => row.user_agent === chromeUA)
    expect(found).toBeDefined()
    expect(found.is_bot).toBe(0)
  })
})
