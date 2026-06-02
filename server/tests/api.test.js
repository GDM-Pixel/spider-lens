/**
 * Tests API — auth + stats
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
const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8')
testDb.exec(schema)

// Applique les migrations (tables/colonnes ajoutées après schema.sql, ex: url_rechecks en v09).
// Les ALTER/CREATE déjà couverts par schema.sql sont ignorés sans bloquer.
for (const v of ['02','03','04','05','06','07','08','09']) {
  const sql = readFileSync(join(__dirname, `../db/migration_v${v}.sql`), 'utf8')
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    try { testDb.exec(stmt) } catch { /* colonne/table déjà présente */ }
  }
}

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
const { default: statsRoutes } = await import('../routes/stats.js')

function buildApp() {
  const app = express()
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/stats', statsRoutes)
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
    INSERT INTO log_entries (timestamp, ip, method, url, status_code, response_size, is_bot, bot_name, response_time_ms, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const now = new Date().toISOString()
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const GBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/145 Safari/537.36'

  insert.run(now,       '1.1.1.1', 'GET', '/page-a',   200, 1024, 0, null, 150, CHROME)
  insert.run(now,       '1.1.1.1', 'GET', '/page-b',   404, 512,  0, null, 80,  CHROME)
  insert.run(yesterday, '2.2.2.2', 'GET', '/page-a',   200, 1024, 0, null, 200, CHROME)
  insert.run(now, '66.249.1.1', 'GET', '/page-a', 200, 512, 1, 'Googlebot', 120, GBOT)
  insert.run(now, '66.249.1.1', 'GET', '/page-b', 500, 0,   1, 'Googlebot', 5000, GBOT)
  // Assets pour tester le filtre type de ressource
  insert.run(now, '66.249.1.1', 'GET', '/_astro/app.css', 200, 8000, 1, 'Googlebot', 30, GBOT)
  insert.run(now, '66.249.1.1', 'GET', '/_astro/app.js',  404, 0,    1, 'Googlebot', 10, GBOT)
  insert.run(now, '3.3.3.3',    'GET', '/logo.png',       200, 4000, 0, null,        20, CHROME)
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

// ── Auth ─────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  test('retourne 200 + token avec des credentials valides', async () => {
    const { username, password } = seedUser()
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.username).toBe(username)
    authToken = res.body.token
  })

  test('retourne 401 avec un mauvais mot de passe', async () => {
    seedUser('admin', 'correct-password')
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  test('retourne 401 si l\'utilisateur n\'existe pas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'anything' })
    expect(res.status).toBe(401)
  })

  test('retourne 400 si les champs sont manquants', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' })
    expect(res.status).toBe(400)
  })
})

// ── Stats protégées ───────────────────────────────────────
describe('GET /api/stats/overview', () => {
  async function getToken() {
    const { username, password } = seedUser()
    const res = await request(app).post('/api/auth/login').send({ username, password })
    return res.body.token
  }

  test('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/stats/overview')
    expect(res.status).toBe(401)
  })

  test('retourne 401 avec un token invalide', async () => {
    const res = await request(app)
      .get('/api/stats/overview')
      .set('Authorization', 'Bearer token-bidon')
    expect(res.status).toBe(401)
  })

  test('retourne 200 avec un token valide', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const to   = new Date().toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/stats/overview')
      .set('Authorization', `Bearer ${token}`)
      .query({ from, to })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('humans')
    expect(res.body).toHaveProperty('bots')
  })

  test('les compteurs overview sont cohérents', async () => {
    const token = await getToken()
    seedLogs()
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const res = await request(app)
      .get('/api/stats/overview')
      .set('Authorization', `Bearer ${token}`)
      .query({ from, to })
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThan(0)
    expect(res.body.total).toBe(res.body.humans + res.body.bots)
    expect(res.body.s4xx).toBeGreaterThan(0)
    expect(res.body.s5xx).toBeGreaterThan(0)
  })
})

// ── Filtre type de ressource (url-detail) ─────────────────
describe('GET /api/stats/url-detail?type=', () => {
  async function getToken() {
    const { username, password } = seedUser()
    const res = await request(app).post('/api/auth/login').send({ username, password })
    return res.body.token
  }
  const range = () => ({
    from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    to:   new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  })
  const urls = (body) => body.rows.map(r => r.url)

  test('type=asset ne retourne que les CSS/JS', async () => {
    const token = await getToken(); seedLogs()
    const res = await request(app).get('/api/stats/url-detail')
      .set('Authorization', `Bearer ${token}`).query({ ...range(), type: 'asset' })
    expect(res.status).toBe(200)
    expect(urls(res.body).sort()).toEqual(['/_astro/app.css', '/_astro/app.js'])
  })

  test('type=image ne retourne que les images', async () => {
    const token = await getToken(); seedLogs()
    const res = await request(app).get('/api/stats/url-detail')
      .set('Authorization', `Bearer ${token}`).query({ ...range(), type: 'image' })
    expect(urls(res.body)).toEqual(['/logo.png'])
  })

  test('type=page exclut assets et images', async () => {
    const token = await getToken(); seedLogs()
    const res = await request(app).get('/api/stats/url-detail')
      .set('Authorization', `Bearer ${token}`).query({ ...range(), type: 'page' })
    expect(res.status).toBe(200)
    expect(urls(res.body)).toEqual(expect.arrayContaining(['/page-a', '/page-b']))
    expect(urls(res.body)).not.toContain('/_astro/app.css')
    expect(urls(res.body)).not.toContain('/logo.png')
  })

  test('type=all (ou absent) ne filtre rien', async () => {
    const token = await getToken(); seedLogs()
    const res = await request(app).get('/api/stats/url-detail')
      .set('Authorization', `Bearer ${token}`).query({ ...range() })
    expect(urls(res.body)).toEqual(expect.arrayContaining(['/page-a', '/_astro/app.css', '/logo.png']))
  })

  test('type=asset + ua=__googlebot__ se combinent (cas render-blocking)', async () => {
    const token = await getToken(); seedLogs()
    const res = await request(app).get('/api/stats/url-detail')
      .set('Authorization', `Bearer ${token}`).query({ ...range(), type: 'asset', ua: '__googlebot__', status: '404' })
    expect(res.status).toBe(200)
    // Googlebot s'est pris un 404 sur /_astro/app.js
    expect(res.body.rows).toHaveLength(1)
    expect(res.body.rows[0].url).toBe('/_astro/app.js')
    expect(res.body.rows[0].status_code).toBe(404)
  })
})

// ── Health ────────────────────────────────────────────────
describe('GET /api/health', () => {
  test('retourne { status: "ok" }', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
