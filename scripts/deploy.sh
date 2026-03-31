#!/usr/bin/env bash
# deploy.sh — Déploiement Horion ERP sur VPS Contabo (Linux / Ubuntu 22.04+)
#
# PRÉREQUIS sur le VPS (à faire une seule fois):
#   apt update && apt install -y nodejs npm nginx certbot python3-certbot-nginx curl git
#   npm install -g pm2
#
# Usage (première fois):
#   git clone https://github.com/servicehorion/Horion-ERP.git /opt/horion-erp
#   cd /opt/horion-erp
#   cp .env.example .env.production.local
#   nano .env.production.local   # Remplir toutes les variables
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh --first-run
#
# Usage (mise à jour):
#   git pull && ./scripts/deploy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/horion-erp}"
APP_NAME="horion-erp"
NODE_ENV="production"
PORT="${PORT:-3000}"

FIRST_RUN=false
for arg in "$@"; do
  [[ "$arg" == "--first-run" ]] && FIRST_RUN=true
done

echo "========================================="
echo "  Horion ERP — Déploiement $(date '+%Y-%m-%d %H:%M')"
echo "========================================="

cd "$APP_DIR"

# 1. Variables d'environnement
if [[ ! -f .env.production.local ]]; then
  echo "ERREUR: .env.production.local manquant. Copier .env.example et le remplir."
  exit 1
fi

# Vérification des variables critiques
source .env.production.local 2>/dev/null || true
: "${DATABASE_URL:?ERREUR: DATABASE_URL non défini dans .env.production.local}"
: "${AUTH_SECRET:?ERREUR: AUTH_SECRET non défini}"
: "${NEXTAUTH_URL:?ERREUR: NEXTAUTH_URL non défini}"
: "${CRON_SECRET:?ERREUR: CRON_SECRET non défini}"

echo "✓ Variables d'environnement validées"

# 2. Dépendances
echo "→ Installation des dépendances..."
npm ci --include=dev

echo "✓ Dépendances installées"

# 3. Migration base de données (uniquement si schéma a changé)
if [[ "$FIRST_RUN" == "true" ]]; then
  echo "→ Migration base de données..."
  NODE_ENV=production npx prisma migrate deploy
  echo "→ Seed initial..."
  NODE_ENV=production npx prisma db seed || echo "  (seed ignoré si déjà fait)"
  echo "✓ Base de données prête"
fi

# 4. Build Next.js
echo "→ Build Next.js..."
NODE_ENV=production npm run build
echo "✓ Build terminé"

# 5. PM2 — démarrer ou redémarrer
if pm2 list | grep -q "$APP_NAME"; then
  echo "→ Redémarrage PM2..."
  pm2 reload "$APP_NAME" --update-env
else
  echo "→ Démarrage PM2 (première fois)..."
  pm2 start npm --name "$APP_NAME" -- start -- --port "$PORT"
  pm2 save
fi

echo "✓ Application démarrée sur le port $PORT"

# 6. Crons (uniquement au premier déploiement ou si --recron passé)
if [[ "$FIRST_RUN" == "true" ]] || [[ "${1:-}" == "--recron" ]]; then
  if [[ -n "${CRON_SECRET:-}" ]] && [[ -n "${NEXTAUTH_URL:-}" ]]; then
    echo "→ Installation des cron jobs..."
    HORION_DOMAIN="$NEXTAUTH_URL" CRON_SECRET="$CRON_SECRET" ./scripts/setup-crons.sh
  else
    echo "⚠ CRON_SECRET ou NEXTAUTH_URL manquant — crons non installés"
    echo "  Exécuter manuellement: HORION_DOMAIN=https://... CRON_SECRET=... ./scripts/setup-crons.sh"
  fi
fi

echo ""
echo "========================================="
echo "  Déploiement terminé avec succès"
echo "  App: $NEXTAUTH_URL"
echo "  Logs: pm2 logs $APP_NAME"
echo "  Status: pm2 status"
echo "========================================="
