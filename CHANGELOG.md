# Changelog

All notable changes to Spider-Lens are documented here.

Format: [Semantic Versioning](https://semver.org/)

---

## [1.1.0] — 2026-04-04

### Added
- **Analyse IA (Nova)** — Page d'analyse SEO structurée propulsée par Gemini 3 Flash Preview : score global, problèmes détectés, recommandations actionnables, highlights clés (composants `ScoreGauge`, `ProblemCard`, `RecommendationCard`, `HighlightBadge`, `AnalysisSection`)
- **Nova chat bubble** — Chatbot assistant flottant accessible sur toutes les pages, avec streaming SSE, contexte de page dynamique (envoyé uniquement lors d'un message utilisateur), badge de messages non lus et avatar Nova
- **Contexte de page** — Chaque vue (Dashboard, HTTP Codes, Anomalies, TTFB, Network, Top Pages) injecte automatiquement un résumé compact au chatbot lors d'une question
- **Gestion base de données** — Section dans les Paramètres : stats en temps réel (taille, lignes par table, plage de dates), politique de rétention configurable (7/30/90/180/365 jours ou illimité) avec avertissement, purge manuelle + VACUUM avec feedback inline
- **Tri sur toutes les colonnes** — Tables triables sur toutes les vues avec micro-animations sur les en-têtes de colonnes
- **Filtre User-Agent** — Sélecteur UA sur la vue HTTP Codes, synchronisé avec les KPIs, graphiques et tableau de drill-down
- **Changement de nom d'utilisateur** — Depuis les Paramètres, en plus du changement de mot de passe
- **Logo SVG** — Logo Spider-Lens affiché sur la page de connexion

### Improved
- **UI polish — micro-interactions** — Hover harmonisés sur toutes les vues : KPI cards (border + shadow), table rows (opacité unifiée), anomaly cards (border dynamique critique/normal), filter toggles (background au hover), tab switchers, boutons cancel
- **btn-red / btn-blue** — Effet `brightness(1.1)` au hover en plus du shadow existant
- **Toggle switch** — Border visible + `hover:opacity-80`
- **Select rétention** — `hover:border-prussian-300 + cursor-pointer` sur les selects natifs
- **Scroll résistant** — Le changement de filtre UA ne réinitialise plus le scroll de la page
- **Settings layout** — Grille 2 colonnes sur desktop (`lg:grid-cols-2`)

### Fixed
- **Anomalies — traductions filtres** — Les labels des sélecteurs de type (Traffic spike, Error rate...) n'étaient pas traduits : mapping snake_case → clés i18n camelCase ajouté dans `TYPE_CONFIG`
- **UA filter drill-down** — Filtre UA utilise maintenant un `exact match` et corrige la sous-requête `top_ua`

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
