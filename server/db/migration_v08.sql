-- Migration V0.8 — Performance indexes for cache-aware queries
CREATE INDEX IF NOT EXISTS idx_log_site_ts_status ON log_entries(site_id, timestamp, status_code);
CREATE INDEX IF NOT EXISTS idx_log_site_url_status ON log_entries(site_id, url, status_code);
CREATE INDEX IF NOT EXISTS idx_log_site_bot_ts ON log_entries(site_id, is_bot, timestamp);
