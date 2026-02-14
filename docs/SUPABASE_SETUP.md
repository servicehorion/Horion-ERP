# Configuration Supabase Self-Hosted (GCP)

Guide complet pour déployer Horion ERP avec Supabase auto-hébergé sur Google Cloud Platform.

## 📋 Prérequis

- Instance Supabase déployée sur GCP
- Accès aux credentials PostgreSQL
- Node.js 18+ installé localement
- Git configuré

## 🚀 Configuration Initiale

### 1. Récupérer les informations de connexion Supabase

Depuis votre console Supabase GCP, récupérez :

```bash
# IP publique de l'instance PostgreSQL
GCP_POSTGRES_IP=xx.xx.xx.xx

# Port PostgreSQL direct (migrations)
POSTGRES_PORT=5432

# Port PgBouncer (pooling pour l'app)
PGBOUNCER_PORT=6543

# Mot de passe PostgreSQL
POSTGRES_PASSWORD=votre-mot-de-passe-securise
```

### 2. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env avec vos informations
nano .env
```

Remplacez les placeholders :

```env
# URL directe (pour migrations et seeds)
DATABASE_URL="postgresql://postgres:VOTRE_PASSWORD@XX.XX.XX.XX:5432/postgres"

# URL avec pooling (pour l'application)
DATABASE_URL_POOLING="postgresql://postgres:VOTRE_PASSWORD@XX.XX.XX.XX:6543/postgres?pgbouncer=true&connection_limit=1"

# Optionnel : Si vous utilisez Supabase Auth/Storage
NEXT_PUBLIC_SUPABASE_URL="https://votre-instance.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="votre-anon-key"
SUPABASE_SERVICE_ROLE_KEY="votre-service-role-key"
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Déployer la base de données

```bash
# Option A : Script automatique
./scripts/setup-db.sh

# Option B : Commandes manuelles
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 5. Vérifier la connexion

```bash
# Ouvrir Prisma Studio
npx prisma studio

# Vous devriez voir :
# - Tables créées (43 tables)
# - Données seed (tenant, users, contacts, fx_rates)
```

### 6. Démarrer l'application

```bash
npm run dev
# → http://localhost:3000
```

## 🔐 Connexion initiale

Utilisez les credentials créés par le seed :

```
Email: admin@horion.cg
Password: Admin123!
```

## 🏗️ Architecture de connexion

```
┌─────────────────────────────────────────────────┐
│  Next.js App (Horion ERP)                       │
│                                                  │
│  NODE_ENV=production ?                          │
│  ├─ Yes → DATABASE_URL_POOLING (port 6543)     │
│  │         PgBouncer + Connection Pooling       │
│  │         Max 10 connections                   │
│  │                                               │
│  └─ No  → DATABASE_URL (port 5432)             │
│            Direct PostgreSQL                     │
│            Pour dev/migrations/seeds            │
└─────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────┐
│  Supabase on GCP                                │
│  ┌──────────────┐        ┌──────────────┐      │
│  │  PgBouncer   │        │  PostgreSQL  │      │
│  │  Port 6543   │───────→│  Port 5432   │      │
│  │  (Pooling)   │        │  (Direct)    │      │
│  └──────────────┘        └──────────────┘      │
└─────────────────────────────────────────────────┘
```

## 📊 Schéma de base de données

Le schéma complet inclut **43 tables** organisées en 8 domaines :

### A. Identity & Access (4 tables)
- `tenants` - Multi-tenant isolation
- `users` - Utilisateurs avec rôles RBAC
- `delegation_rules` - Délégation automatique
- `audit_logs` - Logs d'audit complets

### B. Commercial (8 tables)
- `contacts` - Clients/Fournisseurs/Transitaires
- `orders` - Commandes d'importation
- `order_items` - Articles de commande
- `order_timeline` - Historique des commandes
- `quotes` - Devis avec versioning
- `leads` - Pipeline commercial
- `whatsapp_messages` - Conversations WhatsApp
- `campaigns` - Campagnes marketing

### C. Finance (9 tables)
- `payments` - Paiements entrants/sortants
- `payment_schedules` - Échéanciers
- `invoices` - Factures
- `fx_rates` - Taux de change
- `ledger_entries` - Comptabilité
- `expenses` - Dépenses
- `margins` - Calculs de marges
- `cash_positions` - Trésorerie
- `reconciliations` - Rapprochements bancaires

### D. Sourcing & QC (6 tables)
- `sourcing_cases` - Cas de sourcing
- `suppliers` - Fournisseurs
- `supplier_quotes` - Cotations fournisseurs
- `qc_requests` - Demandes de contrôle qualité
- `qc_reports` - Rapports QC
- `qc_photos` - Photos QC

### E. Logistics (7 tables)
- `shipments` - Expéditions
- `containers` - Conteneurs
- `documents` - Documents logistiques
- `customs_declarations` - Déclarations douanières
- `warehouses` - Entrepôts
- `inventory_movements` - Mouvements de stock
- `delivery_notes` - Bons de livraison

### F. Task Engine (3 tables)
- `tasks` - Tâches avec SLA
- `task_assignments` - Affectations
- `approvals` - Flux d'approbation

### G. System (3 tables)
- `events` - Event sourcing
- `notifications` - Notifications push
- `files` - Gestion de fichiers

### H. Analytics (3 tables)
- `disputes` - Litiges
- `risk_assessments` - Évaluation des risques
- `performance_metrics` - Métriques de performance

## 🔧 Maintenance

### Backup de la base de données

```bash
# Via pg_dump (depuis votre machine locale)
pg_dump postgresql://postgres:PASSWORD@IP:5432/postgres > backup.sql

# Ou depuis Supabase Dashboard → Database → Backups
```

### Mise à jour du schéma

```bash
# Après modification de prisma/schema.prisma
npx prisma db push
npx prisma generate
```

### Reset complet (⚠️ DANGER)

```bash
# ATTENTION : Supprime toutes les données
npx prisma migrate reset
```

## 🛡️ Sécurité

### Checklist production :

- [ ] Changer `NEXTAUTH_SECRET` (générer avec `openssl rand -base64 32`)
- [ ] Configurer un mot de passe PostgreSQL fort
- [ ] Activer SSL pour les connexions DB
- [ ] Restreindre l'IP source dans GCP Firewall
- [ ] Activer Row Level Security (RLS) dans Supabase
- [ ] Configurer les backups automatiques
- [ ] Monitorer les connexions DB (max pool size)

## 📞 Support

En cas de problème :

1. Vérifier les logs : `docker logs horion-app`
2. Tester la connexion DB : `npx prisma db pull`
3. Vérifier Prisma Studio : `npx prisma studio`

## 🔗 Ressources

- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [Prisma + Supabase](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-supabase)
- [PgBouncer](https://www.pgbouncer.org/)
