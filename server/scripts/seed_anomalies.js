/**
 * seed_anomalies.js — Insère des anomalies mockées pour tester l'UI
 * Usage : node server/scripts/seed_anomalies.js
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '..', '.env') })

import { getDb } from '../db/database.js'

const db = getDb()

// Récupère les sites existants
const sites = db.prepare('SELECT id, name FROM sites').all()
const siteIds = sites.length > 0 ? sites.map(s => s.id) : [null]

console.log(`[seed] Sites trouvés : ${sites.length > 0 ? sites.map(s => s.name).join(', ') : 'aucun (mode legacy)'}`)

// Supprime les anomalies existantes pour partir propre
const deleted = db.prepare('DELETE FROM anomalies').run()
console.log(`[seed] ${deleted.changes} anomalies supprimées`)

// ── Définition des mocks ──────────────────────────────────

function ts(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 3600000).toISOString().replace('T', ' ').slice(0, 19)
}

const ANOMALIES = [
  // Site 0 — spike de trafic critique il y a 2h
  {
    site_idx: 0,
    type: 'traffic_spike',
    severity: 'critical',
    value_observed: 4820,
    baseline_mean: 1230,
    baseline_stddev: 310,
    metadata: { hour: 14, threshold: 2005 },
    detected_at: ts(2),
    notified: 1,
  },
  // Site 0 — taux d'erreurs élevé il y a 5h
  {
    site_idx: 0,
    type: 'error_rate_spike',
    severity: 'critical',
    value_observed: 0.34,
    baseline_mean: 0.021,
    baseline_stddev: 0.008,
    metadata: { errors5xx: 612, total: 1800, rate5xx: 34 },
    detected_at: ts(5),
    notified: 1,
  },
  // Site 0 — bots inconnus warning il y a 8h
  {
    site_idx: 0,
    type: 'unknown_bot_spike',
    severity: 'warning',
    value_observed: 0.41,
    baseline_mean: 0.07,
    baseline_stddev: 0.03,
    metadata: { unknown_bots: 738, total: 1800, rate_pct: 41 },
    detected_at: ts(8),
    notified: 1,
  },
  // Site 0 — spike de trafic warning il y a 18h
  {
    site_idx: 0,
    type: 'traffic_spike',
    severity: 'warning',
    value_observed: 2100,
    baseline_mean: 1230,
    baseline_stddev: 310,
    metadata: { hour: 20, threshold: 2005 },
    detected_at: ts(18),
    notified: 1,
  },
  // Site 0 — Googlebot absent (warning) il y a 26h
  {
    site_idx: 0,
    type: 'googlebot_absent',
    severity: 'warning',
    value_observed: 0,
    baseline_mean: null,
    baseline_stddev: null,
    metadata: { lastSeen: ts(192), absentDays: 8 },
    detected_at: ts(26),
    notified: 1,
  },
  // Site 1 (si existe) — spike trafic critique il y a 1h
  {
    site_idx: 1,
    type: 'traffic_spike',
    severity: 'critical',
    value_observed: 9200,
    baseline_mean: 800,
    baseline_stddev: 190,
    metadata: { hour: new Date().getHours(), threshold: 1275 },
    detected_at: ts(1),
    notified: 1,
  },
  // Site 1 — taux erreurs warning il y a 12h
  {
    site_idx: 1,
    type: 'error_rate_spike',
    severity: 'warning',
    value_observed: 0.12,
    baseline_mean: 0.018,
    baseline_stddev: 0.009,
    metadata: { errors5xx: 96, total: 800, rate5xx: 12 },
    detected_at: ts(12),
    notified: 1,
  },
  // Site 0 — spike trafic ancien (3 jours)
  {
    site_idx: 0,
    type: 'traffic_spike',
    severity: 'warning',
    value_observed: 1890,
    baseline_mean: 1230,
    baseline_stddev: 310,
    metadata: { hour: 10, threshold: 2005 },
    detected_at: ts(72),
    notified: 1,
  },
  // Site 0 — bots inconnus ancien (5 jours)
  {
    site_idx: 0,
    type: 'unknown_bot_spike',
    severity: 'warning',
    value_observed: 0.29,
    baseline_mean: 0.07,
    baseline_stddev: 0.03,
    metadata: { unknown_bots: 290, total: 1000, rate_pct: 29 },
    detected_at: ts(120),
    notified: 1,
  },
]

const insert = db.prepare(`
  INSERT INTO anomalies (site_id, type, severity, value_observed, baseline_mean, baseline_stddev, metadata, detected_at, notified)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

let count = 0
for (const a of ANOMALIES) {
  const siteId = siteIds[a.site_idx] ?? siteIds[0] ?? null
  insert.run(
    siteId,
    a.type,
    a.severity,
    a.value_observed,
    a.baseline_mean,
    a.baseline_stddev,
    a.metadata ? JSON.stringify(a.metadata) : null,
    a.detected_at,
    a.notified,
  )
  count++
}

console.log(`[seed] ${count} anomalies mockées insérées`)
console.log('[seed] Dont :')
const summary = db.prepare('SELECT type, severity, COUNT(*) as n FROM anomalies GROUP BY type, severity ORDER BY type, severity').all()
for (const row of summary) {
  console.log(`  - ${row.type} / ${row.severity} : ${row.n}`)
}
