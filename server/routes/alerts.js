import { Router } from 'express'
import { getDb } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'
import { testSmtp } from '../services/mailer.js'
import { testWebhook } from '../services/webhook.js'
import { sendWeeklyReports } from '../services/weeklyReport.js'

const router = Router()
router.use(requireAuth)

// GET /api/alerts/config
router.get('/config', (req, res) => {
  const db = getDb()
  const config = db.prepare('SELECT * FROM alert_config WHERE id = 1').get()
  // Ne jamais renvoyer le mot de passe SMTP
  if (config) delete config.smtp_pass
  res.json(config || {})
})

// POST /api/alerts/config
router.post('/config', (req, res) => {
  const db = getDb()
  const {
    smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
    alert_email, site_name,
    alert_404_enabled, alert_5xx_enabled, alert_googlebot_enabled,
    alert_404_threshold, alert_5xx_threshold, alert_googlebot_days,
    webhook_url, webhook_enabled, webhook_on_warning,
    weekly_report_enabled,
  } = req.body

  const updateFields = [
    'smtp_host = @smtp_host',
    'smtp_port = @smtp_port',
    'smtp_secure = @smtp_secure',
    'smtp_user = @smtp_user',
    'alert_email = @alert_email',
    'site_name = @site_name',
    'alert_404_enabled = @alert_404_enabled',
    'alert_5xx_enabled = @alert_5xx_enabled',
    'alert_googlebot_enabled = @alert_googlebot_enabled',
    'alert_404_threshold = @alert_404_threshold',
    'alert_5xx_threshold = @alert_5xx_threshold',
    'alert_googlebot_days = @alert_googlebot_days',
    'webhook_url = @webhook_url',
    'webhook_enabled = @webhook_enabled',
    'webhook_on_warning = @webhook_on_warning',
    'weekly_report_enabled = @weekly_report_enabled',
    "updated_at = CURRENT_TIMESTAMP",
  ]

  const params = {
    smtp_host, smtp_port, smtp_secure: smtp_secure ? 1 : 0, smtp_user,
    alert_email, site_name,
    alert_404_enabled: alert_404_enabled ? 1 : 0,
    alert_5xx_enabled: alert_5xx_enabled ? 1 : 0,
    alert_googlebot_enabled: alert_googlebot_enabled ? 1 : 0,
    alert_404_threshold, alert_5xx_threshold, alert_googlebot_days,
    webhook_url: webhook_url || null,
    webhook_enabled: webhook_enabled ? 1 : 0,
    webhook_on_warning: webhook_on_warning ? 1 : 0,
    weekly_report_enabled: weekly_report_enabled ? 1 : 0,
  }

  // Mettre à jour le mot de passe uniquement s'il est fourni
  if (smtp_pass) {
    updateFields.push('smtp_pass = @smtp_pass')
    params.smtp_pass = smtp_pass
  }

  db.prepare(`UPDATE alert_config SET ${updateFields.join(', ')} WHERE id = 1`).run(params)
  res.json({ success: true })
})

// POST /api/alerts/test-smtp — tester la config SMTP
router.post('/test-smtp', async (req, res) => {
  const db = getDb()
  const config = db.prepare('SELECT * FROM alert_config WHERE id = 1').get()
  const result = await testSmtp(config)
  res.json(result)
})

// POST /api/alerts/test-webhook — tester l'URL webhook
router.post('/test-webhook', async (req, res) => {
  const { url } = req.body
  const result = await testWebhook(url)
  res.json(result)
})

// POST /api/alerts/send-weekly-report — envoi manuel du rapport
router.post('/send-weekly-report', async (req, res) => {
  try {
    await sendWeeklyReports()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/alerts/history — historique des alertes
router.get('/history', (req, res) => {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM alert_history ORDER BY sent_at DESC LIMIT 50'
  ).all()
  res.json(rows)
})

// GET /api/alerts/anomalies — liste paginée des anomalies
router.get('/anomalies', (req, res) => {
  const db = getDb()
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200)
  const offset = parseInt(req.query.offset || '0', 10)
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : null
  const type   = req.query.type || null

  const conditions = []
  const params = []

  if (siteId != null) { conditions.push('a.site_id = ?'); params.push(siteId) }
  if (type)           { conditions.push('a.type = ?');    params.push(type) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = db.prepare(`
    SELECT a.*, s.name AS site_name
    FROM anomalies a
    LEFT JOIN sites s ON s.id = a.site_id
    ${where}
    ORDER BY a.detected_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    SELECT COUNT(*) AS cnt FROM anomalies a ${where}
  `).get(...params)?.cnt || 0

  res.json({ rows, total, limit, offset })
})

// GET /api/alerts/anomalies/recent — dernières anomalies (widget dashboard)
router.get('/anomalies/recent', (req, res) => {
  const db = getDb()
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : null
  const siteClause = siteId != null ? 'AND a.site_id = ?' : ''
  const siteParams = siteId != null ? [siteId] : []

  const rows = db.prepare(`
    SELECT a.id, a.type, a.severity, a.value_observed, a.baseline_mean, a.detected_at, s.name AS site_name
    FROM anomalies a
    LEFT JOIN sites s ON s.id = a.site_id
    WHERE a.detected_at > datetime('now', '-48 hours') ${siteClause}
    ORDER BY a.detected_at DESC
    LIMIT 10
  `).all(...siteParams)

  res.json(rows)
})

export default router
