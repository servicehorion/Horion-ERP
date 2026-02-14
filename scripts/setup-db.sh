#!/bin/bash
# Script de configuration de la base de données Supabase

set -e

echo "🚀 Horion ERP - Configuration Base de Données"
echo "=============================================="

# Vérifier que les variables d'environnement sont définies
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur: DATABASE_URL n'est pas défini"
  echo "   Copiez .env.example vers .env et configurez vos credentials Supabase"
  exit 1
fi

echo "✅ Variables d'environnement chargées"

# Générer le client Prisma
echo ""
echo "📦 Génération du client Prisma..."
npx prisma generate

# Pousser le schéma vers la DB
echo ""
echo "🗄️  Déploiement du schéma sur Supabase..."
npx prisma db push --accept-data-loss

# Exécuter le seed
echo ""
echo "🌱 Insertion des données initiales..."
npx prisma db seed

echo ""
echo "✨ Configuration terminée avec succès!"
echo ""
echo "📊 Pour visualiser la base de données:"
echo "   npx prisma studio"
echo ""
echo "🚀 Pour démarrer l'application:"
echo "   npm run dev"
echo ""
