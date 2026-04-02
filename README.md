# 🕷️ Spider-Lens

**Analyseur de logs serveur orienté SEO — open-source, auto-hébergé**

Spider-Lens lit vos fichiers de logs Apache/Nginx et vous offre un tableau de bord complet pour surveiller votre trafic, vos erreurs HTTP, vos bots d'indexation et vos performances serveur (TTFB).

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](#)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](#)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

---

## 📸 Aperçu

> _Captures d'écran à venir — dashboard, codes HTTP, bots, TTFB_

---

## ✨ Fonctionnalités (V0.1)

- **Dashboard** — KPIs synthétiques : visites, bots, taux d'erreur, codes HTTP
- **Codes HTTP** — Tableau filtrable (2xx/3xx/4xx/5xx) + export CSV & Excel
- **Top Pages** — Pages les plus vues + liste des erreurs 404 à corriger
- **Bots & Crawlers** — Détection de 16 bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...)
- **TTFB** — Time To First Byte par URL, seuil configurable, export CSV & Excel
- **Mode débutant** — Bandeaux d'aide + infobulles contextuelles désactivables
- **Alertes email** — Spike 404, erreurs 5xx, absence de Googlebot (SMTP configurable)
- **Authentification** — JWT 7j, changement de mot de passe depuis les paramètres
- **Parsing incrémental** — Reprise à l'offset, détection de rotation de logs

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
| Animations | Framer Motion |
| Tests | Jest 29 · Supertest |

---

## 🚀 Installation

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
# Backend
cd server && npm install

# Frontend
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

Le serveur écoute sur `http://localhost:3000`.

---

## 🔄 Déploiement en production (Nginx + PM2)

### Avec PM2

```bash
npm install -g pm2
cd server && pm2 start index.js --name spider-lens
pm2 save && pm2 startup
```

### Avec Nginx (reverse proxy)

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

## 📊 Format de logs supportés

Spider-Lens supporte deux formats :

**Apache Combined Log Format**
```
127.0.0.1 - - [10/Oct/2023:13:55:36 -0700] "GET /page HTTP/1.1" 200 1234 "http://ref" "Mozilla/5.0" 150
```

**Nginx default** (sans referrer/UA)
```
127.0.0.1 - - [10/Oct/2023:13:55:36 -0700] "GET /page HTTP/1.1" 200 1234
```

Le champ final optionnel `150` représente le temps de réponse en millisecondes (TTFB).

Pour l'activer dans Nginx, ajoutez à votre `nginx.conf` :
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
- Parsing de lignes Apache Combined et Nginx
- Normalisation des URLs
- API auth (login, token invalide, champs manquants)
- Routes stats (protection JWT, cohérence des compteurs)

---

## ⚙️ Configuration des alertes email

Dans les **Paramètres** du dashboard, configurez :

| Champ | Description |
|-------|-------------|
| Hôte SMTP | ex: `smtp.gmail.com` |
| Port | 587 (TLS) ou 465 (SSL) |
| Email de destination | Adresse qui recevra les alertes |
| Seuil 404 | Nombre de 404 par heure déclenchant une alerte |
| Seuil 5xx | Nombre d'erreurs serveur par heure |
| Absence Googlebot | Nombre de jours sans visite Googlebot |

---

## 🗺️ Roadmap

### V0.1 (actuelle)
- [x] Dashboard, HTTP codes, Top Pages, Bots, TTFB
- [x] Mode débutant avec aide contextuelle
- [x] Export CSV & Excel
- [x] Alertes email
- [x] Parsing incrémental Apache/Nginx
- [x] Tests Jest

### V0.2 (prévue)
- [ ] Support multi-sites (plusieurs fichiers de log)
- [ ] Filtres avancés par IP et user-agent
- [ ] Détection d'anomalies automatique
- [ ] API webhook pour intégrations externes

---

## 🤝 Contribution

Les contributions sont bienvenues ! Ouvrez une issue ou une pull request.

```bash
# Dev local
cd server && npm run dev          # Backend avec hot-reload (port 3000)
cd client && npm run dev          # Frontend Vite (port 5173)
```

---

## 📄 Licence

MIT — [GDM-Pixel](https://www.gdm-pixel.com) · Caen, France

---

*Fait avec ☕ à Caen, Normandie*
