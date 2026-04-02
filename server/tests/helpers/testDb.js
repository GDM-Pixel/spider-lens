import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

let _db = null

export function getTestDb() {
  if (!_db) {
    _db = new Database(':memory:')
    _db.pragma('journal_mode = WAL')
    const schema = readFileSync(join(__dirname, '../../db/schema.sql'), 'utf8')
    _db.exec(schema)
  }
  return _db
}

export function resetTestDb() {
  const db = getTestDb()
  db.exec('DELETE FROM log_entries')
  db.exec('DELETE FROM users')
  db.exec('DELETE FROM alert_history')
}
