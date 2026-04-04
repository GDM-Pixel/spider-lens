import { Router } from 'express'
import { getDb, applyRetentionPolicy, getDbFileSize } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/admin/db-stats
router.get('/db-stats', (req, res) => {
  try {
    const db = getDb()

    const logCount    = db.prepare('SELECT COUNT(*) as cnt FROM log_entries').get()?.cnt ?? 0
    const anomCount   = db.prepare('SELECT COUNT(*) as cnt FROM anomalies').get()?.cnt ?? 0
    const alertCount  = db.prepare('SELECT COUNT(*) as cnt FROM alert_history').get()?.cnt ?? 0
    const blockCount  = db.prepare('SELECT COUNT(*) as cnt FROM ip_blocklist').get()?.cnt ?? 0

    const range = db.prepare('SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM log_entries').get()
    const policy = db.prepare('SELECT logs_days, anomalies_days, alerts_days FROM retention_policy WHERE id = 1').get()

    res.json({
      file_size: getDbFileSize(),
      rows: {
        log_entries:   logCount,
        anomalies:     anomCount,
        alert_history: alertCount,
        ip_blocklist:  blockCount,
      },
      log_range: {
        oldest: range?.oldest ?? null,
        newest: range?.newest ?? null,
      },
      retention: policy ?? { logs_days: 90, anomalies_days: 90, alerts_days: 90 },
    })
  } catch (e) {
    console.error('[admin] db-stats error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/admin/retention
router.put('/retention', (req, res) => {
  try {
    const db = getDb()
    const { logs_days, anomalies_days, alerts_days } = req.body

    const clean = (v) => {
      if (v === null || v === undefined || v === '') return null
      const n = parseInt(v, 10)
      return isNaN(n) || n <= 0 ? null : n
    }

    db.prepare(`
      UPDATE retention_policy
      SET logs_days = ?, anomalies_days = ?, alerts_days = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(clean(logs_days), clean(anomalies_days), clean(alerts_days))

    const policy = db.prepare('SELECT logs_days, anomalies_days, alerts_days FROM retention_policy WHERE id = 1').get()
    res.json({ ok: true, retention: policy })
  } catch (e) {
    console.error('[admin] retention error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/purge — purge + VACUUM
router.post('/purge', (req, res) => {
  try {
    const deleted = applyRetentionPolicy()
    const db = getDb()
    db.exec('VACUUM')
    const newSize = getDbFileSize()
    res.json({ ok: true, deleted, file_size: newSize })
  } catch (e) {
    console.error('[admin] purge error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

export default router
