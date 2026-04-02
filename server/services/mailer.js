import nodemailer from 'nodemailer'
import { getDb } from '../db/database.js'

function getConfig() {
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

async function sendAlert(subject, html) {
  const config = getConfig()
  if (!config?.smtp_host || !config?.alert_email) return false

  try {
    const transporter = createTransporter(config)
    await transporter.sendMail({
      from: `"Spider-Lens" <${config.smtp_user || 'noreply@spider-lens.io'}>`,
      to: config.alert_email,
      subject: `[Spider-Lens] ${subject}`,
      html,
    })
    return true
  } catch (err) {
    console.error('[mailer] Erreur envoi email:', err.message)
    return false
  }
}

function wasAlertSentRecently(alertType, windowHours = 1) {
  const db = getDb()
  const recent = db.prepare(`
    SELECT id FROM alert_history
    WHERE alert_type = ?
    AND sent_at > datetime('now', ? || ' hours')
  `).get(alertType, `-${windowHours}`)
  return !!recent
}

function logAlert(alertType, detail) {
  const db = getDb()
  db.prepare('INSERT INTO alert_history (alert_type, detail) VALUES (?, ?)').run(alertType, detail)
}

export async function checkAndSendAlerts() {
  const config = getConfig()
  if (!config) return

  const db = getDb()
  const now = new Date()
  const oneHourAgo = new Date(now - 3600000).toISOString()

  // ── Alerte 404 spike ──────────────────────────────────
  if (config.alert_404_enabled) {
    const count404 = db.prepare(`
      SELECT COUNT(*) as cnt FROM log_entries
      WHERE status_code = 404 AND timestamp > ?
    `).get(oneHourAgo)?.cnt || 0

    if (count404 >= config.alert_404_threshold && !wasAlertSentRecently('404_spike')) {
      const top404 = db.prepare(`
        SELECT url, COUNT(*) as cnt FROM log_entries
        WHERE status_code = 404 AND timestamp > ?
        GROUP BY url ORDER BY cnt DESC LIMIT 5
      `).all(oneHourAgo)

      const rows = top404.map(r => `<tr><td>${r.url}</td><td>${r.cnt}</td></tr>`).join('')
      await sendAlert(
        `⚠️ Spike 404 détecté — ${count404} erreurs en 1h`,
        `<h2>Spike de 404 sur ${config.site_name || 'votre site'}</h2>
         <p>${count404} erreurs 404 détectées dans la dernière heure (seuil : ${config.alert_404_threshold}).</p>
         <h3>Top URLs en 404 :</h3>
         <table border="1" cellpadding="6"><thead><tr><th>URL</th><th>Occurrences</th></tr></thead><tbody>${rows}</tbody></table>`
      )
      logAlert('404_spike', `${count404} erreurs 404 en 1h`)
    }
  }

  // ── Alerte 5xx ────────────────────────────────────────
  if (config.alert_5xx_enabled) {
    const count5xx = db.prepare(`
      SELECT COUNT(*) as cnt FROM log_entries
      WHERE status_code >= 500 AND timestamp > ?
    `).get(oneHourAgo)?.cnt || 0

    if (count5xx >= config.alert_5xx_threshold && !wasAlertSentRecently('5xx', 0.5)) {
      await sendAlert(
        `🚨 Erreurs serveur (5xx) — ${count5xx} en 1h`,
        `<h2>Erreurs serveur critiques sur ${config.site_name || 'votre site'}</h2>
         <p>${count5xx} erreurs 5xx détectées dans la dernière heure. Vérifiez votre serveur immédiatement.</p>`
      )
      logAlert('5xx', `${count5xx} erreurs 5xx en 1h`)
    }
  }

  // ── Alerte Googlebot absent ───────────────────────────
  if (config.alert_googlebot_enabled) {
    const days = config.alert_googlebot_days || 7
    const cutoff = new Date(now - days * 86400000).toISOString()
    const lastGooglebot = db.prepare(`
      SELECT MAX(timestamp) as last FROM log_entries
      WHERE bot_name = 'Googlebot'
    `).get()?.last

    const hasEntries = db.prepare('SELECT COUNT(*) as cnt FROM log_entries').get()?.cnt > 0
    if (hasEntries && (!lastGooglebot || lastGooglebot < cutoff) && !wasAlertSentRecently('googlebot_absent', 24)) {
      await sendAlert(
        `🤖 Googlebot absent depuis ${days} jours`,
        `<h2>Absence de Googlebot détectée</h2>
         <p>Googlebot n'a pas été détecté dans vos logs depuis ${days} jours.</p>
         <p>Vérifiez votre fichier robots.txt et la Search Console Google.</p>`
      )
      logAlert('googlebot_absent', `Absent depuis ${lastGooglebot || 'toujours'}`)
    }
  }
}

export async function testSmtp(config) {
  try {
    const transporter = createTransporter(config)
    await transporter.verify()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
