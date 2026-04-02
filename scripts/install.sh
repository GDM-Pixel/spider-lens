#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Spider-Lens — Script d'installation automatique
# Testé sur : Ubuntu 20.04+, Debian 11+
# Usage : curl -sSL https://install.spider-lens.io | bash
#         ou en local : bash scripts/install.sh
# ─────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/spider-lens"
SERVICE_NAME="spider-lens"

echo ""
echo -e "${CYAN}${BOLD}🕷️  Spider-Lens — Installation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Vérification root ─────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}✗ Ce script doit être exécuté en root (sudo bash install.sh)${NC}"
  exit 1
fi

# ── Détection OS ──────────────────────────────────────────
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  echo -e "${RED}✗ OS non supporté${NC}"
  exit 1
fi

echo -e "${GREEN}✓ OS détecté : $PRETTY_NAME${NC}"

# ── Installation Node.js 18+ ──────────────────────────────
install_node() {
  if command -v node &> /dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
      echo -e "${GREEN}✓ Node.js $(node -v) déjà installé${NC}"
      return
    fi
  fi
  echo -e "${YELLOW}→ Installation de Node.js 18...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
  echo -e "${GREEN}✓ Node.js $(node -v) installé${NC}"
}

install_node

# ── Installation PM2 ──────────────────────────────────────
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}→ Installation de PM2...${NC}"
  npm install -g pm2
fi
echo -e "${GREEN}✓ PM2 $(pm2 -v) disponible${NC}"

# ── Détection serveur web + path des logs ─────────────────
echo ""
echo -e "${BOLD}Configuration des logs${NC}"
echo "─────────────────────────"

detect_log_path() {
  # Nginx
  if [ -f /var/log/nginx/access.log ]; then
    echo "/var/log/nginx/access.log"
    return
  fi
  # Apache Debian/Ubuntu
  if [ -f /var/log/apache2/access.log ]; then
    echo "/var/log/apache2/access.log"
    return
  fi
  # Apache CentOS/RHEL
  if [ -f /var/log/httpd/access_log ]; then
    echo "/var/log/httpd/access_log"
    return
  fi
  echo ""
}

AUTO_LOG=$(detect_log_path)

if [ -n "$AUTO_LOG" ]; then
  echo -e "${GREEN}✓ Fichier de log détecté : $AUTO_LOG${NC}"
  read -p "Utiliser ce fichier ? [Y/n] : " USE_AUTO
  if [[ "$USE_AUTO" =~ ^[Nn]$ ]]; then
    read -p "Chemin du fichier access.log : " LOG_PATH
  else
    LOG_PATH="$AUTO_LOG"
  fi
else
  read -p "Chemin du fichier access.log : " LOG_PATH
fi

if [ ! -f "$LOG_PATH" ]; then
  echo -e "${RED}⚠️  Fichier introuvable : $LOG_PATH${NC}"
  echo -e "${YELLOW}   L'installation continue — vous pourrez modifier le chemin dans .env${NC}"
fi

# Détection format
if echo "$LOG_PATH" | grep -qi nginx; then
  LOG_FORMAT="nginx"
else
  LOG_FORMAT="apache"
fi

# ── Configuration ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuration du dashboard${NC}"
echo "───────────────────────────"

read -p "Port du dashboard [3000] : " PORT
PORT=${PORT:-3000}

read -p "Nom d'utilisateur admin [admin] : " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -s -p "Mot de passe admin : " ADMIN_PASS
echo ""
if [ -z "$ADMIN_PASS" ]; then
  ADMIN_PASS="spider-lens-$(openssl rand -hex 4)"
  echo -e "${YELLOW}→ Mot de passe généré : ${BOLD}$ADMIN_PASS${NC}"
fi

read -p "Sous-domaine pour le dashboard (ex: spider-lens.monsite.com) : " SUBDOMAIN

JWT_SECRET=$(openssl rand -hex 32)

# ── Copie du projet ───────────────────────────────────────
echo ""
echo -e "${YELLOW}→ Installation dans $INSTALL_DIR...${NC}"

if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}   Dossier existant — mise à jour${NC}"
fi

# Si exécuté depuis le répertoire du projet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/server/index.js" ]; then
  cp -r "$PROJECT_DIR" "$INSTALL_DIR" 2>/dev/null || true
  echo -e "${GREEN}✓ Fichiers copiés depuis $PROJECT_DIR${NC}"
else
  echo -e "${YELLOW}→ Téléchargement depuis GitHub...${NC}"
  apt-get install -y git &>/dev/null
  git clone https://github.com/gdm-pixel/spider-lens "$INSTALL_DIR"
fi

# ── Installation des dépendances ──────────────────────────
echo -e "${YELLOW}→ Installation des dépendances backend...${NC}"
cd "$INSTALL_DIR/server"
npm install --production

echo -e "${YELLOW}→ Build du frontend...${NC}"
cd "$INSTALL_DIR/client"
npm install
npm run build

# ── Création du .env ─────────────────────────────────────
echo -e "${YELLOW}→ Création du fichier .env...${NC}"

cat > "$INSTALL_DIR/server/.env" << EOF
# Spider-Lens — Configuration (généré le $(date))
PORT=$PORT
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
ADMIN_USER=$ADMIN_USER
ADMIN_PASS=$ADMIN_PASS
LOG_FILE_PATH=$LOG_PATH
LOG_FORMAT=$LOG_FORMAT
DB_PATH=$INSTALL_DIR/spider-lens.db
ALERT_EMAIL=
SITE_NAME=Mon Site
ALERT_404_THRESHOLD=10
ALERT_5XX_THRESHOLD=5
ALERT_GOOGLEBOT_DAYS=7
DATA_RETENTION_DAYS=90
EOF

chmod 600 "$INSTALL_DIR/server/.env"

# ── Droits lecture logs ───────────────────────────────────
LOG_GROUP=$(stat -c '%G' "$LOG_PATH" 2>/dev/null || echo "adm")
usermod -aG "$LOG_GROUP" root 2>/dev/null || true

# ── Démarrage avec PM2 ────────────────────────────────────
echo -e "${YELLOW}→ Démarrage avec PM2...${NC}"
cd "$INSTALL_DIR/server"

# Charger le .env pour PM2
export $(grep -v '^#' .env | xargs)

pm2 delete "$SERVICE_NAME" 2>/dev/null || true
pm2 start index.js --name "$SERVICE_NAME" --env production
pm2 startup 2>/dev/null || true
pm2 save

echo -e "${GREEN}✓ Spider-Lens démarré (port $PORT)${NC}"

# ── Config Nginx reverse proxy ────────────────────────────
if command -v nginx &> /dev/null && [ -n "$SUBDOMAIN" ]; then
  echo -e "${YELLOW}→ Configuration Nginx pour $SUBDOMAIN...${NC}"

  NGINX_CONF="/etc/nginx/sites-available/spider-lens"

  cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $SUBDOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 10M;
    }
}
EOF

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/spider-lens
  nginx -t && nginx -s reload
  echo -e "${GREEN}✓ Nginx configuré pour $SUBDOMAIN${NC}"

  # HTTPS avec Certbot
  if command -v certbot &> /dev/null; then
    read -p "Activer HTTPS avec Let's Encrypt ? [Y/n] : " HTTPS
    if [[ ! "$HTTPS" =~ ^[Nn]$ ]]; then
      read -p "Email pour Let's Encrypt : " LE_EMAIL
      certbot --nginx -d "$SUBDOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL"
      echo -e "${GREEN}✓ HTTPS activé sur $SUBDOMAIN${NC}"
    fi
  else
    echo -e "${YELLOW}   Certbot non installé. Pour HTTPS : apt install certbot python3-certbot-nginx${NC}"
    echo -e "${YELLOW}   puis : certbot --nginx -d $SUBDOMAIN${NC}"
  fi
fi

# ── Résumé ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}✅ Spider-Lens installé avec succès !${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}URL :${NC} http://$SUBDOMAIN  (ou http://localhost:$PORT)"
echo -e "  ${BOLD}Login :${NC} $ADMIN_USER"
echo -e "  ${BOLD}Mot de passe :${NC} $ADMIN_PASS"
echo ""
echo -e "  ${YELLOW}⚠️  Changez le mot de passe dans Settings dès la première connexion !${NC}"
echo ""
echo -e "  ${BOLD}Commandes utiles :${NC}"
echo -e "    pm2 logs spider-lens     → Voir les logs"
echo -e "    pm2 restart spider-lens  → Redémarrer"
echo -e "    pm2 stop spider-lens     → Arrêter"
echo ""
