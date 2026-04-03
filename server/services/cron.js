import cron from 'node-cron'
import { parseLogFile } from './parser.js'
import { checkAndSendAlerts } from './mailer.js'
import { detectAnomalies } from './anomalyDetector.js'
import { sendWeeklyReports } from './weeklyReport.js'
import { getDb } from '../db/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function parseAllSites() {
  const db = getDb()
  const sites = db.prepare('SELECT id, name, log_file_path FROM sites WHERE active = 1').all()

  if (sites.length === 0) {
    // Fallback V0.1 : LOG_FILE_PATH sans site en DB
    const logFilePath = process.env.LOG_FILE_PATH
    if (logFilePath) {
      const result = await parseLogFile(logFilePath, null)
      return result.parsed
    }
    return 0
  }

  let totalParsed = 0
  for (const site of sites) {
    try {
      const result = await parseLogFile(site.log_file_path, site.id)
      if (result.parsed > 0) {
        console.log(`[cron] ${site.name} : ${result.parsed} nouvelles entrées`)
        totalParsed += result.parsed
      }
    } catch (e) {
      console.error(`[cron] Erreur parsing ${site.name} : ${e.message}`)
    }
  }
  return totalParsed
}

export function startCron() {
  const db = getDb()
  const hasSites = db.prepare('SELECT COUNT(*) as cnt FROM sites WHERE active = 1').get()?.cnt || 0
  const hasLegacyEnv = !!process.env.LOG_FILE_PATH

  if (hasSites === 0 && !hasLegacyEnv) {
    console.warn('[cron] Aucun site configuré et LOG_FILE_PATH non défini — parsing désactivé')
    console.warn('[cron] Ajoutez un site depuis Paramètres > Sites pour activer le parsing automatique')
  }

  // Parsing initial au démarrage
  parseAllSites().then(async parsed => {
    if (parsed > 0) console.log(`[cron] Parsing initial : ${parsed} entrées au total`)
    await checkAndSendAlerts()
    await detectAnomalies()
  })

  // Parsing horaire
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Parsing horaire...')
    const parsed = await parseAllSites()
    await checkAndSendAlerts()
    await detectAnomalies()
    if (parsed > 0) {
      console.log(`[cron] ${parsed} nouvelles entrées, alertes et anomalies vérifiées`)
    }
  })

  // Rapport hebdomadaire — chaque lundi à 8h
  cron.schedule('0 8 * * 1', async () => {
    console.log('[cron] Envoi du rapport hebdomadaire...')
    await sendWeeklyReports()
  })

  // Purge des données anciennes + VACUUM (chaque nuit à 2h)
  cron.schedule('0 2 * * *', () => {
    const days = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10)
    const db = getDb()
    const result = db.prepare(
      "DELETE FROM log_entries WHERE timestamp < datetime('now', ? || ' days')"
    ).run(`-${days}`)
    console.log(`[cron] Purge : ${result.changes} entrées supprimées (>${days} jours)`)
    if (result.changes > 0) {
      db.exec('VACUUM')
      console.log('[cron] VACUUM done — disk space reclaimed')
    }
  })
}
