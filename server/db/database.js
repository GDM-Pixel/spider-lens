import Database from 'better-sqlite3'
import { readFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DB_PATH || './spider-lens.db'

let db

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    applyMigrations()
  }
  return db
}

function run(sql) { db.exec(sql) }

function initSchema() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  run(schema)
}

function applyMigrations() {
  // V0.2 — multi-sites : appliqué seulement si la table "sites" n'existe pas encore
  const hasSites = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sites'").get()
  if (!hasSites) {
    const migration = readFileSync(join(__dirname, 'migration_v02.sql'), 'utf8')
    // ALTER TABLE ADD COLUMN échoue si la colonne existe déjà — on exécute instruction par instruction
    for (const stmt of migration.split(';').map(s => s.trim()).filter(Boolean)) {
      try { run(stmt) } catch (e) {
        if (!e.message.includes('duplicate column')) throw e
      }
    }
    console.log('[db] Migration V0.2 appliquée (multi-sites)')
  }

  // V0.3 — anomalies + index IP/UA : appliqué si la table "anomalies" n'existe pas encore
  const hasAnomalies = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anomalies'").get()
  if (!hasAnomalies) {
    const migration = readFileSync(join(__dirname, 'migration_v03.sql'), 'utf8')
    for (const stmt of migration.split(';').map(s => s.trim()).filter(Boolean)) {
      try { run(stmt) } catch (e) {
        if (!e.message.includes('already exists')) throw e
      }
    }
    console.log('[db] Migration V0.3 appliquée (anomalies + index IP)')
  }

  // V0.4 — webhook + rapport hebdo : appliqué colonne par colonne (idempotent)
  const migration04 = readFileSync(join(__dirname, 'migration_v04.sql'), 'utf8')
  for (const stmt of migration04.split(';').map(s => s.trim()).filter(Boolean)) {
    try { run(stmt) } catch (e) {
      if (!e.message.includes('duplicate column')) throw e
    }
  }

  // V0.5 — ip_blocklist
  const hasBlocklist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ip_blocklist'").get()
  if (!hasBlocklist) {
    const migration = readFileSync(join(__dirname, 'migration_v05.sql'), 'utf8')
    for (const stmt of migration.split(';').map(s => s.trim()).filter(Boolean)) {
      try { run(stmt) } catch (e) {
        if (!e.message.includes('already exists')) throw e
      }
    }
    console.log('[db] Migration V0.5 appliquée (ip_blocklist)')
  }

  // V0.6 — retention_policy
  const hasRetention = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='retention_policy'").get()
  if (!hasRetention) {
    const migration = readFileSync(join(__dirname, 'migration_v06.sql'), 'utf8')
    for (const stmt of migration.split(';').map(s => s.trim()).filter(Boolean)) {
      try { run(stmt) } catch (e) {
        if (!e.message.includes('already exists')) throw e
      }
    }
    console.log('[db] Migration V0.6 appliquée (retention_policy)')
  }

  // Backfill : créer le site par défaut depuis LOG_FILE_PATH si défini et pas encore de site
  const siteCount = db.prepare('SELECT COUNT(*) as cnt FROM sites').get()?.cnt || 0
  if (siteCount === 0) {
    const logPath = process.env.LOG_FILE_PATH
    if (logPath) {
      const siteName = process.env.SITE_NAME || 'Site principal'
      db.prepare('INSERT OR IGNORE INTO sites (name, log_file_path) VALUES (?, ?)').run(siteName, logPath)
      const siteId = db.prepare('SELECT id FROM sites WHERE log_file_path = ?').get(logPath)?.id
      if (siteId) {
        db.prepare('UPDATE log_entries SET site_id = ? WHERE site_id IS NULL').run(siteId)
        db.prepare('UPDATE parse_state SET site_id = ? WHERE site_id IS NULL').run(siteId)
        console.log(`[db] Site par défaut créé : "${siteName}" (id=${siteId})`)
      }
    }
  }
}

export function applyRetentionPolicy() {
  const db = getDb()
  const policy = db.prepare('SELECT * FROM retention_policy WHERE id = 1').get()
  if (!policy) return { logs: 0, anomalies: 0, alerts: 0 }

  let logsDeleted = 0, anomaliesDeleted = 0, alertsDeleted = 0

  if (policy.logs_days !== null) {
    const cutoff = new Date(Date.now() - policy.logs_days * 86400000).toISOString()
    logsDeleted = db.prepare('DELETE FROM log_entries WHERE timestamp < ?').run(cutoff).changes
  }
  if (policy.anomalies_days !== null) {
    const cutoff = new Date(Date.now() - policy.anomalies_days * 86400000).toISOString()
    anomaliesDeleted = db.prepare('DELETE FROM anomalies WHERE detected_at < ?').run(cutoff).changes
  }
  if (policy.alerts_days !== null) {
    const cutoff = new Date(Date.now() - policy.alerts_days * 86400000).toISOString()
    alertsDeleted = db.prepare('DELETE FROM alert_history WHERE sent_at < ?').run(cutoff).changes
  }

  if (logsDeleted + anomaliesDeleted + alertsDeleted > 0) {
    console.log(`[retention] Purge : ${logsDeleted} logs, ${anomaliesDeleted} anomalies, ${alertsDeleted} alertes supprimés`)
  }
  return { logs: logsDeleted, anomalies: anomaliesDeleted, alerts: alertsDeleted }
}

export function getDbFileSize() {
  const dbPath = process.env.DB_PATH || './spider-lens.db'
  try {
    return statSync(dbPath).size
  } catch {
    return 0
  }
}

// Cron de purge toutes les 24h
let retentionCron = null
export function startRetentionCron() {
  if (retentionCron) return
  retentionCron = setInterval(() => {
    try { applyRetentionPolicy() } catch (e) {
      console.error('[retention] Erreur cron purge :', e.message)
    }
  }, 24 * 60 * 60 * 1000)
}

export default getDb
