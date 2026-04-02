import { getDb } from '../db/database.js'
import nodemailer from 'nodemailer'
import { sendWebhook } from './webhook.js'

const SIGMA_THRESHOLD = 2.5
const MIN_BASELINE_DAYS = 3 // besoin d'au moins 3 jours pour calculer une baseline fiable

// ── Helpers ───────────────────────────────────────────────

function getAlertConfig() {
  const db = getDb()
  return db.prepare('SELECT * FROM alert_config WHERE id = 1').get()
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: config.smtp_secure === 1,
    auth: config.smtp_user ? { user: config.smtp_user, pass: config.smtp_pass } : undefined,
  })
}

async function sendAnomalyEmail(subject, html) {
  const config = getAlertConfig()
  if (!config?.smtp_host || !config?.alert_email) return false
  try {
    const transporter = createTransporter(config)
    await transporter.sendMail({
      from: `"Spider-Lens" <${config.smtp_user || 'noreply@spider-lens.io'}>`,
      to: config.alert_email,
      subject: `[Spider-Lens Anomalie] ${subject}`,
      html,
    })
    return true
  } catch (err) {
    console.error('[anomaly] Erreur envoi email:', err.message)
    return false
  }
}

function wasAnomalyRecentlySent(siteId, type, windowHours = 2) {
  const db = getDb()
  const recent = db.prepare(`
    SELECT id FROM anomalies
    WHERE site_id IS ? AND type = ? AND notified = 1
    AND detected_at > datetime('now', ? || ' hours')
  `).get(siteId, type, `-${windowHours}`)
  return !!recent
}

function saveAnomaly(siteId, type, severity, observed, mean, stddev, metadata) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO anomalies (site_id, type, severity, value_observed, baseline_mean, baseline_stddev, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(siteId, type, severity, observed, mean, stddev, metadata ? JSON.stringify(metadata) : null)
  return result.lastInsertRowid
}

function markNotified(id) {
  getDb().prepare('UPDATE anomalies SET notified = 1 WHERE id = ?').run(id)
}

// ── Calcul de baseline ────────────────────────────────────
// Calcule mean + stddev sur les N derniers jours pour la même heure

function calculateBaseline(siteId, hourOfDay, daysBack = 7) {
  const db = getDb()
  const siteClause = siteId != null ? 'AND site_id = ?' : 'AND site_id IS NULL'
  const siteParams = siteId != null ? [siteId] : []

  // Récupère les counts horaires des 7 derniers jours (même heure, j-1 à j-7)
  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%d', timestamp) AS day,
           COUNT(*) AS cnt
    FROM log_entries
    WHERE strftime('%H', timestamp) = ?
    AND timestamp BETWEEN datetime('now', ? || ' days') AND datetime('now', '-1 day')
    ${siteClause}
    GROUP BY day
    ORDER BY day DESC
  `).all(String(hourOfDay).padStart(2, '0'), `-${daysBack}`, ...siteParams)

  if (rows.length < MIN_BASELINE_DAYS) return null

  const values = rows.map(r => r.cnt)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const stddev = Math.sqrt(variance)

  return { mean, stddev, sampleSize: values.length }
}

// ── Détecteurs ────────────────────────────────────────────

async function detectTrafficSpike(siteId, siteName) {
  const db = getDb()
  const now = new Date()
  const hour = now.getUTCHours()

  const baseline = calculateBaseline(siteId, hour)
  if (!baseline) return

  const { mean, stddev } = baseline
  if (stddev < 5) return // trop stable pour déclencher des alertes

  const siteClause = siteId != null ? 'AND site_id = ?' : 'AND site_id IS NULL'
  const siteParams = siteId != null ? [siteId] : []

  const observed = db.prepare(`
    SELECT COUNT(*) AS cnt FROM log_entries
    WHERE timestamp > datetime('now', '-1 hour') ${siteClause}
  `).get(...siteParams)?.cnt || 0

  const threshold = mean + SIGMA_THRESHOLD * stddev
  if (observed < threshold) return

  const severity = observed > mean + 4 * stddev ? 'critical' : 'warning'
  const type = 'traffic_spike'

  if (wasAnomalyRecentlySent(siteId, type)) return

  const id = saveAnomaly(siteId, type, severity, observed, mean, stddev, {
    hour,
    threshold: Math.round(threshold),
  })

  console.log(`[anomaly] ${siteName || 'global'} — traffic_spike : ${observed} req/h (baseline: ${Math.round(mean)} ± ${Math.round(stddev)})`)

  const webhookPayload = { type, severity, siteName, observed, baselineMean: mean, baselineStddev: stddev, metadata: { hour, threshold: Math.round(threshold) } }
  await Promise.all([
    severity === 'critical'
      ? sendAnomalyEmail(
          `Spike de trafic — ${observed} req/h sur ${siteName || 'tous les sites'}`,
          `<h2>Spike de trafic anormal détecté</h2>
           <p>Site : <strong>${siteName || 'tous les sites'}</strong></p>
           <p>Volume observé : <strong>${observed} requêtes</strong> dans la dernière heure</p>
           <p>Baseline habituelle : ${Math.round(mean)} ± ${Math.round(stddev)} req/h</p>
           <p>Seuil d'alerte : ${Math.round(threshold)} req/h (moyenne + ${SIGMA_THRESHOLD}σ)</p>`
        )
      : Promise.resolve(false),
    sendWebhook(webhookPayload),
  ])
  markNotified(id)
}

async function detectErrorRateSpike(siteId, siteName) {
  const db = getDb()
  const siteClause = siteId != null ? 'AND site_id = ?' : 'AND site_id IS NULL'
  const siteParams = siteId != null ? [siteId] : []

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS errors5xx,
      SUM(CASE WHEN status_code = 404  THEN 1 ELSE 0 END) AS errors404
    FROM log_entries
    WHERE timestamp > datetime('now', '-1 hour') ${siteClause}
  `).get(...siteParams)

  if (!stats || stats.total < 20) return // pas assez de volume

  const rate5xx = stats.errors5xx / stats.total
  const rate404 = stats.errors404 / stats.total

  // Baseline du taux d'erreur sur 7 jours
  const rateHistory = db.prepare(`
    SELECT strftime('%Y-%m-%d %H', timestamp) AS hour_slot,
           COUNT(*) AS total,
           SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS err5xx
    FROM log_entries
    WHERE timestamp BETWEEN datetime('now', '-8 days') AND datetime('now', '-1 day')
    ${siteClause}
    GROUP BY hour_slot
    HAVING total > 10
    ORDER BY hour_slot DESC
    LIMIT 168
  `).all(...siteParams)

  if (rateHistory.length < 10) return

  const rates = rateHistory.map(r => r.err5xx / r.total)
  const mean = rates.reduce((s, v) => s + v, 0) / rates.length
  const variance = rates.reduce((s, v) => s + (v - mean) ** 2, 0) / rates.length
  const stddev = Math.sqrt(variance)

  const threshold = mean + SIGMA_THRESHOLD * stddev
  if (rate5xx <= threshold) return

  const severity = rate5xx > mean + 4 * stddev ? 'critical' : 'warning'
  const type = 'error_rate_spike'

  if (wasAnomalyRecentlySent(siteId, type)) return

  const id = saveAnomaly(siteId, type, severity, rate5xx, mean, stddev, {
    errors5xx: stats.errors5xx,
    total: stats.total,
    rate5xx: Math.round(rate5xx * 100),
  })

  console.log(`[anomaly] ${siteName || 'global'} — error_rate_spike : ${Math.round(rate5xx * 100)}% 5xx (baseline: ${Math.round(mean * 100)}%)`)

  const meta = { errors5xx: stats.errors5xx, total: stats.total, rate5xx: Math.round(rate5xx * 100) }
  await Promise.all([
    severity === 'critical'
      ? sendAnomalyEmail(
          `Taux d'erreurs 5xx anormal — ${Math.round(rate5xx * 100)}% sur ${siteName || 'tous les sites'}`,
          `<h2>Taux d'erreurs serveur anormal détecté</h2>
           <p>Site : <strong>${siteName || 'tous les sites'}</strong></p>
           <p>Taux 5xx actuel : <strong>${Math.round(rate5xx * 100)}%</strong> (${stats.errors5xx}/${stats.total} requêtes)</p>
           <p>Baseline habituelle : ${Math.round(mean * 100)}% ± ${Math.round(stddev * 100)}%</p>`
        )
      : Promise.resolve(false),
    sendWebhook({ type: 'error_rate_spike', severity, siteName, observed: rate5xx, baselineMean: mean, baselineStddev: stddev, metadata: meta }),
  ])
  markNotified(id)
}

async function detectGooglebotDrop(siteId, siteName) {
  const db = getDb()
  const siteClause = siteId != null ? 'AND site_id = ?' : 'AND site_id IS NULL'
  const siteParams = siteId != null ? [siteId] : []

  const config = getAlertConfig()
  if (!config?.alert_googlebot_enabled) return

  const days = config.alert_googlebot_days || 7
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  const lastGooglebot = db.prepare(`
    SELECT MAX(timestamp) as last FROM log_entries
    WHERE bot_name = 'Googlebot' ${siteClause}
  `).get(...siteParams)?.last

  const hasEntries = db.prepare(`
    SELECT COUNT(*) as cnt FROM log_entries
    WHERE timestamp > datetime('now', '-${days} days') ${siteClause}
  `).get(...siteParams)?.cnt > 0

  if (!hasEntries) return
  if (lastGooglebot && lastGooglebot >= cutoff) return

  const type = 'googlebot_absent'
  if (wasAnomalyRecentlySent(siteId, type, 24)) return

  const id = saveAnomaly(siteId, type, 'warning', 0, null, null, {
    lastSeen: lastGooglebot || null,
    absentDays: days,
  })

  console.log(`[anomaly] ${siteName || 'global'} — googlebot_absent depuis ${days}j`)

  const gbMeta = { lastSeen: lastGooglebot || null, absentDays: days }
  await Promise.all([
    sendAnomalyEmail(
      `Googlebot absent depuis ${days} jours — ${siteName || 'tous les sites'}`,
      `<h2>Absence de Googlebot détectée</h2>
       <p>Site : <strong>${siteName || 'tous les sites'}</strong></p>
       <p>Googlebot n'a pas été détecté dans les logs depuis <strong>${days} jours</strong>.</p>
       <p>Dernière visite connue : ${lastGooglebot || 'inconnue'}</p>
       <p>Vérifiez votre fichier robots.txt et la Search Console Google.</p>`
    ),
    sendWebhook({ type: 'googlebot_absent', severity: 'warning', siteName, observed: 0, baselineMean: null, baselineStddev: null, metadata: gbMeta }),
  ])
  markNotified(id)
}

async function detectUnknownBotSpike(siteId, siteName) {
  const db = getDb()
  const siteClause = siteId != null ? 'AND site_id = ?' : 'AND site_id IS NULL'
  const siteParams = siteId != null ? [siteId] : []

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_bot = 1 AND (bot_name IS NULL OR bot_name = 'Unknown Bot') THEN 1 ELSE 0 END) AS unknown_bots
    FROM log_entries
    WHERE timestamp > datetime('now', '-1 hour') ${siteClause}
  `).get(...siteParams)

  if (!stats || stats.total < 20) return

  const rate = stats.unknown_bots / stats.total
  if (rate < 0.15) return // moins de 15% de bots inconnus, on ignore

  const history = db.prepare(`
    SELECT strftime('%Y-%m-%d %H', timestamp) AS h,
           COUNT(*) AS total,
           SUM(CASE WHEN is_bot = 1 AND (bot_name IS NULL OR bot_name = 'Unknown Bot') THEN 1 ELSE 0 END) AS ub
    FROM log_entries
    WHERE timestamp BETWEEN datetime('now', '-8 days') AND datetime('now', '-1 day')
    ${siteClause}
    GROUP BY h HAVING total > 5
    LIMIT 168
  `).all(...siteParams)

  if (history.length < 10) return

  const rates = history.map(r => r.ub / r.total)
  const mean = rates.reduce((s, v) => s + v, 0) / rates.length
  const variance = rates.reduce((s, v) => s + (v - mean) ** 2, 0) / rates.length
  const stddev = Math.sqrt(variance)

  const threshold = mean + SIGMA_THRESHOLD * stddev
  if (rate <= threshold) return

  const type = 'unknown_bot_spike'
  if (wasAnomalyRecentlySent(siteId, type, 4)) return

  const id = saveAnomaly(siteId, type, 'warning', rate, mean, stddev, {
    unknown_bots: stats.unknown_bots,
    total: stats.total,
    rate_pct: Math.round(rate * 100),
  })

  console.log(`[anomaly] ${siteName || 'global'} — unknown_bot_spike : ${Math.round(rate * 100)}% (baseline: ${Math.round(mean * 100)}%)`)
  await sendWebhook({ type: 'unknown_bot_spike', severity, siteName, observed: rate, baselineMean: mean, baselineStddev: stddev, metadata: { unknown_bots: stats.unknown_bots, total: stats.total, rate_pct: Math.round(rate * 100) } })
  markNotified(id)
}

// ── Point d'entrée ────────────────────────────────────────

export async function detectAnomaliesForSite(siteId, siteName) {
  await detectTrafficSpike(siteId, siteName)
  await detectErrorRateSpike(siteId, siteName)
  await detectGooglebotDrop(siteId, siteName)
  await detectUnknownBotSpike(siteId, siteName)
}

export async function detectAnomalies() {
  const db = getDb()
  const sites = db.prepare('SELECT id, name FROM sites WHERE active = 1').all()

  if (sites.length === 0) {
    // Mode V0.1 sans sites en DB
    await detectAnomaliesForSite(null, 'global')
    return
  }

  for (const site of sites) {
    try {
      await detectAnomaliesForSite(site.id, site.name)
    } catch (e) {
      console.error(`[anomaly] Erreur analyse ${site.name} :`, e.message)
    }
  }
}
