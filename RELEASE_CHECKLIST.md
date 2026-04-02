# Spider-Lens V0.1.0 — Checklist de release

## ✅ Fonctionnalités complètes

- [x] Dashboard (KPIs, graphes HTTP, répartition bots)
- [x] Page Codes HTTP (graphes + tableau drill-down filtrable + export CSV/Excel)
- [x] Page Top Pages (404 + pages populaires)
- [x] Page Bots & Crawlers (PieChart, BarChart, tableau détaillé)
- [x] Page TTFB (AreaChart, seuil configurable, tableau par URL, export CSV/Excel)
- [x] Page Paramètres (config SMTP alertes + changement mot de passe)
- [x] Mode débutant (toggle header, bandeaux d'aide, InfoBubbles)
- [x] Authentification JWT (login, change-password)
- [x] Parsing incrémental Apache/Nginx (offset + détection rotation)
- [x] Détection 16 bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...)
- [x] Alertes email (404 spike, 5xx, Googlebot absent)
- [x] Tests Jest (18 tests parser + 9 tests API = 27 au total)
- [x] README.md complet

## ✅ Vérifications techniques

- [x] `npm run build` côté client : 0 erreur, 0 warning
- [x] `npm test` : 27/27 tests passent
- [x] `.env` dans `.gitignore` (secrets non commitables)
- [x] `.env.example` créé avec documentation
- [x] Aucun secret hardcodé dans le code (JWT, mots de passe via `process.env`)
- [x] Script `seed.js` non appelé depuis `index.js` (données mock uniquement en dev)
- [x] Base de données SQLite en mode WAL (performances)

## ✅ Sécurité

- [x] Toutes les routes `/api/stats` et `/api/alerts` protégées par JWT
- [x] Helmet activé (headers HTTP sécurisés)
- [x] CORS restreint (uniquement localhost:5173 en dev, false en prod)
- [x] Hachage bcrypt avec 10 rounds pour les mots de passe
- [x] Tokens JWT 7j (non-révocables — logout côté client uniquement)

## 📋 Avant la mise en production

1. Copier `server/.env.example` en `server/.env`
2. Générer un JWT_SECRET fort :
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Changer ADMIN_USER et ADMIN_PASS
4. Configurer LOG_FILE_PATH vers votre fichier de log réel
5. Compiler le frontend : `cd client && npm run build`
6. Lancer avec PM2 : `cd server && pm2 start index.js --name spider-lens`
7. Configurer Nginx en reverse proxy (voir README)
8. Activer HTTPS avec Certbot

## 🚫 Exclusions V0.1 (prévues V0.2)

- Multi-sites (plusieurs fichiers de log)
- Filtres avancés par IP
- Détection d'anomalies automatique
- Export PDF
