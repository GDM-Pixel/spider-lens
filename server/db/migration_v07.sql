-- Migration V0.7 — Sitemap Crawler
-- site_sitemaps : plusieurs URLs de sitemap par site
CREATE TABLE IF NOT EXISTS site_sitemaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, url)
);
CREATE INDEX IF NOT EXISTS idx_sitemap_site ON site_sitemaps(site_id);

-- crawled_pages : données on-page par URL crawlée
CREATE TABLE IF NOT EXISTS crawled_pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  status_code INTEGER,
  title       TEXT,
  h1          TEXT,
  word_count  INTEGER DEFAULT 0,
  canonical   TEXT,
  meta_robots TEXT,
  depth       INTEGER DEFAULT 0,
  source      TEXT DEFAULT 'sitemap',
  crawled_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  error       TEXT,
  UNIQUE(site_id, url)
);
CREATE INDEX IF NOT EXISTS idx_crawled_site ON crawled_pages(site_id);
CREATE INDEX IF NOT EXISTS idx_crawled_url  ON crawled_pages(site_id, url);

-- crawl_runs : historique des exécutions de crawl
CREATE TABLE IF NOT EXISTS crawl_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'idle',
  pages_found   INTEGER DEFAULT 0,
  pages_crawled INTEGER DEFAULT 0,
  started_at    DATETIME,
  finished_at   DATETIME,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_site ON crawl_runs(site_id);
