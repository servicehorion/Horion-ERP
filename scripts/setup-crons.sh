#!/usr/bin/env bash
# setup-crons.sh — Installe les 14 cron jobs Horion ERP sur un VPS Linux (Contabo)
# Remplace vercel.json qui ne fonctionne que sur Vercel.
#
# Usage:
#   chmod +x scripts/setup-crons.sh
#   HORION_DOMAIN=https://erp.horion.cg CRON_SECRET=ton_secret_fort ./scripts/setup-crons.sh
#
# Les jobs POST sur chaque route avec le header Authorization: Bearer $CRON_SECRET
# (conforme à requireSecretHeader dans chaque route cron)

set -euo pipefail

DOMAIN="${HORION_DOMAIN:?Définir HORION_DOMAIN ex: https://erp.horion.cg}"
SECRET="${CRON_SECRET:?Définir CRON_SECRET}"
LOG_DIR="/var/log/horion-crons"
CURL="curl -s -X POST -H \"x-horion-secret: ${SECRET}\" -o /dev/null -w \"%{http_code}\""

# Créer le dossier de logs
mkdir -p "$LOG_DIR"

echo "Installation des cron jobs Horion ERP sur $DOMAIN..."

# Générer le bloc crontab
CRON_BLOCK="
# ── Horion ERP Cron Jobs ──────────────────────────────────────────────────────
# Géré par scripts/setup-crons.sh — NE PAS MODIFIER MANUELLEMENT
# Pour mettre à jour: re-exécuter setup-crons.sh

# SLA commandes (toutes les 15 min)
*/15 * * * * $CURL ${DOMAIN}/api/cron/sla-check >> ${LOG_DIR}/sla-check.log 2>&1

# PawaPay — vérification statut paiements (toutes les 15 min)
*/15 * * * * $CURL ${DOMAIN}/api/cron/pawapay-status >> ${LOG_DIR}/pawapay-status.log 2>&1

# Risques stratégiques (toutes les 30 min)
*/30 * * * * $CURL ${DOMAIN}/api/cron/strategic-risk >> ${LOG_DIR}/strategic-risk.log 2>&1

# Décisions pilotage (toutes les 30 min)
*/30 * * * * $CURL ${DOMAIN}/api/cron/strategic-decisions >> ${LOG_DIR}/strategic-decisions.log 2>&1

# Séquences nurturing CRM (toutes les 30 min)
*/30 * * * * $CURL ${DOMAIN}/api/cron/nurturing-step >> ${LOG_DIR}/nurturing-step.log 2>&1

# Escalade approbations finance (toutes les 30 min)
*/30 * * * * $CURL ${DOMAIN}/api/cron/finance-approval-escalation >> ${LOG_DIR}/finance-approval-escalation.log 2>&1

# SLA sourcing (toutes les 30 min)
*/30 * * * * $CURL ${DOMAIN}/api/cron/sourcing-sla-check >> ${LOG_DIR}/sourcing-sla-check.log 2>&1

# Lead scoring (toutes les heures)
0 * * * * $CURL ${DOMAIN}/api/cron/lead-scoring >> ${LOG_DIR}/lead-scoring.log 2>&1

# Expiration paiements (toutes les heures)
0 * * * * $CURL ${DOMAIN}/api/cron/expire-payments >> ${LOG_DIR}/expire-payments.log 2>&1

# Tâches récurrentes (toutes les heures)
0 * * * * $CURL ${DOMAIN}/api/cron/recurring-tasks >> ${LOG_DIR}/recurring-tasks.log 2>&1

# Alertes trésorerie (toutes les 4 heures)
0 */4 * * * $CURL ${DOMAIN}/api/cron/treasury-balance-alerts >> ${LOG_DIR}/treasury-balance-alerts.log 2>&1

# Taux de change FX (toutes les 6 heures)
0 */6 * * * $CURL ${DOMAIN}/api/cron/fx-rates >> ${LOG_DIR}/fx-rates.log 2>&1

# Intelligence refresh (quotidien à 2h)
0 2 * * * $CURL ${DOMAIN}/api/cron/intelligence-refresh >> ${LOG_DIR}/intelligence-refresh.log 2>&1

# Sync base de connaissances assistant (quotidien à 3h)
0 3 * * * $CURL ${DOMAIN}/api/cron/assistant-knowledge-sync >> ${LOG_DIR}/assistant-knowledge-sync.log 2>&1

# ── Fin Horion ERP Cron Jobs ──────────────────────────────────────────────────
"

# Supprimer les anciens jobs Horion et les remplacer
EXISTING=$(crontab -l 2>/dev/null || true)
# Retirer l'ancien bloc si présent
CLEANED=$(echo "$EXISTING" | sed '/# ── Horion ERP Cron Jobs/,/# ── Fin Horion ERP Cron Jobs/d')
echo "${CLEANED}${CRON_BLOCK}" | crontab -

echo "✓ 14 cron jobs installés dans crontab"
echo "  Logs dans: $LOG_DIR"
echo ""
echo "Vérifier avec: crontab -l | grep horion"
echo "Tester manuellement:"
echo "  curl -s -X POST -H \"x-horion-secret: $SECRET\" $DOMAIN/api/cron/sla-check"
