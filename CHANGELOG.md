# Changelog

All notable changes to Spider-Lens are documented here.

Format: [Semantic Versioning](https://semver.org/)

---

## [1.0.0] — 2026-04-03

### Added
- **Full i18n support** — 6 languages: French, English, Spanish, German, Italian, Dutch
- **Language switcher** — `LanguageSwitcher` component in the header with flags, persisted via `localStorage`
- **WordPress plugin** — Native WP admin integration (IIFE build, React externalized via `wp-element`)
- **Official logo** — Replaced placeholder with Spider-Lens logo in sidebar and WP admin icon
- **GDM-Pixel signature** — Displayed at the bottom of the sidebar (desktop view)
- **ErrorBoundary** — Catches silent React crashes in development

### Fixed
- **View navigation** — Fixed a deadlock between `AnimatePresence (framer-motion)` and `Suspense` that prevented content from loading on route changes without a forced reload
- **Login redirect loop** — The axios interceptor now dispatches a `spider:unauthorized` event instead of a hard `window.location.href` redirect, eliminating the `/login` ↔ `/dashboard` loop
- **WP plugin — PHP fatal errors** — Fixed reserved keyword `NAMESPACE` → `API_NAMESPACE`, removed PHP 7.4 incompatible typed properties, replaced spread operator in `$wpdb->prepare()`
- **WP plugin — Missing build** — Build detection now reads the Vite manifest instead of looking for a hardcoded `index.js`
- **WP plugin — Backend tracking** — Collector no longer records WordPress admin page visits
- **Version badge** — Header version updated from `v0.3` to `v1.0.0`

### Improved
- **Route transitions** — Removed `AnimatePresence` in favor of plain `Suspense` for reliable navigation
- **Authentication** — JWT token is now cleanly removed from `localStorage` on 401 before navigation

---

## [0.7.0] — 2026-03-XX

### Added
- Dashboard, HTTP Codes, Top Pages, Bots & Crawlers, TTFB, Network, Anomalies, Blocklist, Settings
- Incremental Apache/Nginx log parsing with log rotation detection
- CSV & Excel export on HTTP Codes and Top Pages views
- Email alerts (404 spikes, 5xx errors, missing Googlebot) via configurable SMTP
- Beginner mode with help banners and contextual tooltips
- JWT authentication (7-day token), password change from settings
- Detection of 16+ bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...)
- Multi-site support
- 27 Jest tests (parsing, auth, stats API)
