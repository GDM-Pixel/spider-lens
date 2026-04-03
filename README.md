<div align="center">
  <img src="client/src/assets/spider-lens-logo.png" alt="Spider-Lens" width="180" />

  # Spider-Lens

  **Analyseur de logs serveur orienté SEO — open-source, auto-hébergé**

  [![Version](https://img.shields.io/badge/version-1.0.0-blue)](#)
  [![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](#)
  [![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)
  [![i18n](https://img.shields.io/badge/i18n-FR%20EN%20ES%20DE%20IT%20NL-orange)](#)
  [![WordPress](https://img.shields.io/badge/WordPress-plugin-blue?logo=wordpress)](#)

</div>

<img src=".github/banner.jpg" alt="Spider-Lens Dashboard" width="100%" />

---

Spider-Lens lit vos fichiers de logs Apache/Nginx et vous offre un tableau de bord complet pour surveiller votre trafic, vos erreurs HTTP, vos bots d'indexation et vos performances serveur (TTFB). Disponible en application Node.js autonome **et** en plugin WordPress natif.

---

## ✨ Fonctionnalités

| Vue | Description |
|-----|-------------|
| **Dashboard** | KPIs synthétiques : visites, bots, taux d'erreur, codes HTTP, graphiques |
| **Codes HTTP** | Tableau filtrable (2xx/3xx/4xx/5xx) + drill-down par URL + export CSV & Excel |
| **Top Pages** | Pages les plus vues + liste des erreurs 404 à corriger en priorité |
| **Bots & Crawlers** | Détection de 16+ bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...) |
| **TTFB** | Time To First Byte par URL, seuil configurable, export CSV & Excel |
| **Réseau** | Analyse des IPs et user-agents |
| **Anomalies** | Détection automatique de pics de trafic et comportements anormaux |
| **Blocklist** | Blocage d'IPs/user-agents suspects |
| **Paramètres** | Configuration SMTP, rétention des données, changement de mot de passe |

### Autres fonctionnalités

- 🌍 **i18n** — Interface disponible en FR, EN, ES, DE, IT, NL (persistance via localStorage)
- 🔒 **Authentification JWT** — Token 7 jours, session sécurisée
- 📧 **Alertes email** — Spike 404, erreurs 5xx, absence de Googlebot (SMTP configurable)
- 📊 **Parsing incrémental** — Reprise à l'offset, détection de rotation de logs
- 🌱 **Mode débutant** — Bandeaux d'aide et infobulles contextuelles désactivables
- 🌐 **Multi-sites** — Suivez plusieurs sites depuis une seule interface
- 🔌 **Plugin WordPress** — Intégration native dans l'admin WP sans Node.js requis

---

## 🛠️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | Node.js 18+ · Express 4 · ES Modules |
| Base de données | SQLite via better-sqlite3 (WAL) |
| Authentification | JWT + bcryptjs |
| Tâches planifiées | node-cron |
| Emails | Nodemailer (SMTP) |
| Frontend | React 18 · Vite 5 |
| Graphiques | Recharts |
| Styles | Tailwind CSS 3 |
| i18n | react-i18next · i18next-browser-languagedetector |
| Tests | Jest 29 · Supertest |
| WordPress | PHP 7.4+ · WP REST API · wp-element |

---

## 🚀 Installation — Application Node.js

### Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Accès à votre fichier de log Apache ou Nginx

### 1. Cloner le dépôt

```bash
git clone https://github.com/gdm-pixel/spider-lens.git
cd spider-lens
```

### 2. Installer les dépendances

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Configurer l'environnement

```bash
cp server/.env.example server/.env
```

Éditez `server/.env` :

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=changez-ce-secret-en-production
ADMIN_USER=admin
ADMIN_PASS=changez-ce-mot-de-passe
LOG_FILE_PATH=/var/log/apache2/access.log
DB_PATH=./spider-lens.db
SITE_NAME=Mon Site
```

> ⚠️ **Sécurité** : Changez `JWT_SECRET` et `ADMIN_PASS` avant toute mise en ligne !

### 4. Compiler le frontend

```bash
cd client && npm run build
```

### 5. Lancer le serveur

```bash
cd server && npm start
```

Le dashboard est accessible sur `http://localhost:3000`.

---

## 🔄 Déploiement en production (Nginx + PM2)

### PM2

```bash
npm install -g pm2
cd server && pm2 start index.js --name spider-lens
pm2 save && pm2 startup
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name spider-lens.votre-domaine.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name spider-lens.votre-domaine.com;

    ssl_certificate     /etc/letsencrypt/live/spider-lens.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spider-lens.votre-domaine.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL avec Certbot

```bash
sudo certbot --nginx -d spider-lens.votre-domaine.com
```

---

## 🔌 Installation — Plugin WordPress

Le plugin WordPress permet d'intégrer Spider-Lens directement dans votre admin WP, sans avoir besoin de Node.js sur votre serveur.

### 1. Télécharger le plugin

Téléchargez `spider-lens.zip` depuis la [page des releases GitHub](../../releases).

### 2. Installer via l'admin WordPress

`Extensions → Ajouter → Téléverser une extension → spider-lens.zip → Installer → Activer`

### 3. Configurer

Rendez-vous dans **Spider-Lens** dans le menu d'administration. La base de données et les paramètres sont configurables directement depuis l'interface.

> Le plugin utilise `wp-element` (React bundlé avec WordPress) — aucune dépendance externe requise.

---

## 📊 Format de logs supportés

**Apache Combined Log Format**
```
127.0.0.1 - - [10/Oct/2023:13:55:36 -0700] "GET /page HTTP/1.1" 200 1234 "http://ref" "Mozilla/5.0" 150
```

**Nginx** (format standard)
```
127.0.0.1 - - [10/Oct/2023:13:55:36 -0700] "GET /page HTTP/1.1" 200 1234
```

Le champ final optionnel (`150`) est le temps de réponse en ms (TTFB). Pour l'activer dans Nginx :

```nginx
log_format combined_time '$remote_addr - $remote_user [$time_local] '
                         '"$request" $status $body_bytes_sent '
                         '"$http_referer" "$http_user_agent" $request_time';
access_log /var/log/nginx/access.log combined_time;
```

---

## 🧪 Tests

```bash
cd server && npm test
```

27 tests couvrant :
- Détection de bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...)
- Parsing Apache Combined et Nginx
- Normalisation des URLs
- API auth (login, token invalide, champs manquants)
- Routes stats (protection JWT, cohérence des compteurs)

---

## ⚙️ Configuration des alertes email

Dans les **Paramètres** du dashboard :

| Champ | Description |
|-------|-------------|
| Hôte SMTP | ex: `smtp.gmail.com` |
| Port | 587 (TLS) ou 465 (SSL) |
| Email de destination | Adresse qui recevra les alertes |
| Seuil 404 | Nombre de 404/heure déclenchant une alerte |
| Seuil 5xx | Nombre d'erreurs serveur/heure |
| Absence Googlebot | Nombre de jours sans visite Googlebot |

---

## 💻 Développement local

```bash
# Backend avec hot-reload (port 3000)
cd server && npm run dev

# Frontend Vite (port 5173)
cd client && npm run dev
```

---

## 🗺️ Roadmap

### v1.0.0 ✅
- [x] Dashboard, Codes HTTP, Top Pages, Bots, TTFB, Réseau, Anomalies, Blocklist
- [x] Plugin WordPress natif
- [x] i18n : FR / EN / ES / DE / IT / NL
- [x] Export CSV & Excel
- [x] Alertes email
- [x] Multi-sites
- [x] Mode débutant
- [x] Tests Jest (27)

### v1.1.0 (prévue)
- [ ] Filtres avancés par IP et user-agent
- [ ] API webhook pour intégrations externes
- [ ] Dashboard personnalisable (widgets)

---

## 🤝 Contribution

Les contributions sont bienvenues ! Ouvrez une issue ou une pull request.

---

## 📄 Licence

MIT — [GDM-Pixel](https://www.gdm-pixel.com) · Caen, France

---

<div align="center">
  <sub>Fait avec ❤️ à Caen, Normandie</sub>
</div>
