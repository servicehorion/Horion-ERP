# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Horion ERP is a multi-tenant ERP system for an import/logistics business operating on the **China → Congo (Brazzaville)** trade corridor. The UI is in **French**. The default tenant is `horion-congo`, and all monetary values are stored and displayed in **XAF (CFA Franc)**; USD, RMB, EUR are also supported via the FX rate system.

Default dev login: `admin@horion.cg` / `Admin123!`

---

## Commands

```bash
# Development
npm run dev               # Start Next.js dev server (localhost:3000)
npm run build             # Production build
npm run lint              # ESLint

# Database
npm run db:migrate        # Run Prisma migrations (uses DATABASE_URL direct, port 5432)
npm run db:push           # Push schema changes without migration history
npm run db:seed           # Seed tenant, users, FX rates, ledger accounts, channels
npm run db:generate       # Regenerate Prisma client after schema changes
npm run db:studio         # Open Prisma Studio GUI

# Tests
npm run test              # Run all tests once (Vitest)
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
# Run a single test file:
npx vitest run src/__tests__/finance/finance-intelligence.test.ts
```

**DB connection note:** In dev, `DATABASE_URL` (port 5432, direct PostgreSQL) is used. In production, `DATABASE_URL_POOLING` (port 6543, PgBouncer) is used. Never run migrations against the pooling URL.

---

## Architecture

### Stack
- **Next.js 15** App Router with React Server Components — **no separate API layer** for UI (all mutations use Server Actions)
- **Prisma 7** ORM with `@prisma/adapter-pg` (native PG driver, not the default Prisma engine)
- **NextAuth v5** (beta) for auth — session includes `id`, `role`, `tenantId`
- **Tailwind CSS v4** + shadcn/ui components
- **Vitest** for unit tests (8 fichiers, ~120 tests — logique pure uniquement, pas d'intégration DB)

### Directory structure conventions
```
src/
  app/(dashboard)/[module]/        # Page routes per OS module
  app/api/                         # REST API routes (only for AI agent + NextAuth)
  components/[module]/             # UI components scoped to a module
  components/shared/               # DataTable, EmptyState, LoadingSkeleton, StatusBadge, CurrencyDisplay
  lib/
    actions/[module].actions.ts    # Server Actions — all data mutations go here
    services/[name].service.ts     # Business logic classes (pure DB operations)
    validators/[module].ts         # Zod schemas for form/action validation
    permissions.ts                 # RBAC permission map
    events.ts                      # Event emitter (persists to DB + processes handlers)
    event-handlers.ts              # Event handler registry
    session.ts                     # getSession() — use this in every Server Action
    db.ts                          # Prisma singleton
  config/
    navigation.ts                  # Sidebar nav structure
    currencies.ts                  # formatCurrency() utility
```

### Data flow pattern
Every write operation follows this exact chain:
1. **Page** (Server Component or Client Component) calls a **Server Action**
2. **Server Action** calls `getSession()` → `checkPermission()` → **Service method** → `AuditService.log()` → `revalidatePath()`
3. **Service** runs Prisma queries and emits events via `emitEvent()`
4. **Event handlers** (`src/lib/event-handlers.ts`) auto-create Tasks and Notifications as side effects

### Multi-tenancy
Every DB query **must** filter by `tenantId`. `getSession()` returns `user.tenantId`. The default seed tenant is `horion-congo`. There is no middleware-level row-level security — tenant isolation is enforced manually in every service.

### RBAC
`src/lib/permissions.ts` defines the permission map. 15 roles: `ADMIN`, `DIRECTION`, `CEO`, `CTO`, `FINANCE`, `FINANCE_MANAGER`, `OPS`, `LOGISTICS_MANAGER`, `LOGISTICS_ASSISTANT`, `COMMERCIAL`, `CRM_MANAGER`, `COMMUNITY_MANAGER`, `SOURCING_ASSISTANT`, `AI_ENGINEER`, `VIEWER`. Always call `checkPermission(user.role, "action.name")` at the top of Server Actions before any DB write. ADMIN has `["*"]`.

### Crons (vercel.json — 8 schedules)
| Route | Schedule | Usage |
|-------|----------|-------|
| `/api/cron/sla-check` | every 15min | SLA alertes commandes |
| `/api/cron/strategic-risk` | every 30min | Risques stratégiques |
| `/api/cron/strategic-decisions` | every 30min | Décisions pilotage |
| `/api/cron/intelligence-refresh` | daily 2h | Refresh intelligence cross-OS |
| `/api/cron/nurturing-step` | every 30min | Séquences nurturing CRM |
| `/api/cron/lead-scoring` | hourly | Recalcul score leads |
| `/api/cron/fx-rates` | every 6h | Mise à jour taux FX |
| `/api/cron/finance-approval-escalation` | every 30min | Escalade approbations finance |

Toutes les routes cron sont désormais planifiées dans `vercel.json`. Les 4 routes précédemment orphelines ont été ajoutées (mars 2026).

### Event system
`emitEvent(type, entityType, entityId, payload)` persists an event to DB and immediately calls `processEvents()` (synchronous in dev). In production this should be wired to a cron. The handler registry in `event-handlers.ts` maps event types to handlers — order status changes auto-create Tasks with subtasks and SLA deadlines.

### OS Modules (implementation status)
| Module | Route | Status |
|--------|-------|--------|
| Pilotage | `/pilotage` | Complete — Intelligence, Décisions, Forecast, Ressources, Risk |
| Commandes | `/orders` | Complete — 11 onglets, Kanban, risk calc, SLA |
| CRM + Contacts | `/crm`, `/contacts` | Complete — scoring, NBA, nurturing, multi-pipeline |
| Sourcing | `/sourcing` | Complete — groupage, marge, indicatif, tickets |
| Catalogue | `/catalog` | Complete — produits, fournisseurs, analytics, vault |
| Finance | `/finance` | Complete — 19 sous-pages : payroll, banques, FX, budgets, trésorerie, TVA |
| Tâches | `/tasks` | Complete — Kanban, Gantt, calendrier, OKRs, recurring, templates |
| QC | `/qc` | Complete — Labs SGS/BV/TÜV, SPC, traçabilité lots, analyse photo AI |
| Logistique | `/logistics` | Complete — dashboard, expéditions, warehouse bridge AI |
| WhatsApp | `/whatsapp` | Complete — inbox, WAHA + Meta Cloud API, broadcast |
| Marketing | `/marketing` | Complete — content studio, campagnes, calendrier éditorial |
| Paramètres | `/settings` | Complete — branding, sécurité, team, audit, 2FA TOTP |
| Assistant | `/` (widget) | Complete — Zelia OS : internal + pay widgets, knowledge base |

### Known Bugs & Active Issues (mars 2026)

#### ~~🔴 Bug critique — 4 cron routes orphelines~~ — Corrigé
`expire-payments`, `sourcing-sla-check`, `treasury-balance-alerts`, `assistant-knowledge-sync` ajoutés dans `vercel.json`.

#### ~~🟡 Cron manquant — RecurringTask jamais déclenché~~ — Corrigé
`src/app/api/cron/recurring-tasks/route.ts` créé + ajouté dans `vercel.json` (schedule: `0 * * * *`).

#### 🟡 TypeScript errors silencées au build
`next.config.ts:28` → `typescript: { ignoreBuildErrors: true }`.
Le build ne remonte pas les erreurs TS. Toujours lancer `npx tsc --noEmit` séparément pour valider avant de déployer.

#### 🟡 JWT DB resync toutes les 6h (pas 15min)
`src/lib/auth.ts:132` : `RESYNC_INTERVAL_MS = 6h`. Le `updateAge: 15min` dans `session` est l'intervalle de rafraîchissement du cookie NextAuth, pas du resync DB. Un rôle changé en DB peut mettre jusqu'à 6h à se propager dans le JWT.

#### ~~🟡 Routes non protégées par rôle dans le middleware~~ — Corrigé
`/catalog` (`catalog.view`), `/quotes` (`quote.approve`), `/pilotage` (`pilotage.view`) ajoutés dans `ROUTE_GUARDS` de `middleware.ts`. `/dashboard` reste intentionnellement ouvert.

---

### Finance OS specifics
- `confirmPayment()` in `payment.actions.ts` triggers **auto-margin calculation** and **auto-ledger entry** generation
- Ledger account codes follow the standard plan: 101-110 (Assets/Cash), 201-230 (Liabilities), 401-420 (Revenue), 501-560 (Expenses)
- FX conversion falls back to hardcoded rates if no DB rate found: USD=605, RMB=83, EUR=655.957 XAF
- `LedgerService.seedChartOfAccounts()` creates 23 standard accounts for import/export business

### Tasks OS specifics
- `ownerType` field: `HUMAN`, `AI_AGENT`, or `SYSTEM`
- AI agents interact via `GET/POST /api/agent/tasks` using `x-agent-id` and `x-tenant-id` headers
- Completing a task calls `TaskDependencyService.resolveCompletedTask()` which auto-unblocks dependents
- `TaskTemplateService.processDueRecurring()` must be called by an external cron — **NOT wired yet** (see Known Bugs)

### Customer/Supplier Intelligence
`CustomerIntelligenceService` and `SupplierIntelligenceService` compute LTV, churn risk (0.0–1.0), and segments. Segments: `CASHFLOW_DRIVER`, `KEY_ACCOUNT`, `HIGH_RISK_HIGH_REWARD`, `AT_RISK`, `ONE_TIME_BUYER`, `LOW_MARGIN_VOLUME`. These are recalculated on-the-fly — no scheduled recalculation job exists yet.

---

## Key Conventions

- **Server Actions** must start with `"use server"` and always call `getSession()` first. Return `{ data }` on success, `{ error: string }` on failure — never throw to the client.
- **Client components** that call Server Actions show loading state with `useState` and surface errors via `toast.error()` (sonner).
- **Forms** use `react-hook-form` + Zod resolver. Validators live in `src/lib/validators/`.
- **Currency display** always use `<CurrencyDisplay>` component or `formatCurrency(amount, currency)` from `src/config/currencies.ts`. Never format amounts inline.
- **Prisma schema changes**: always run `npm run db:push` then `npm run db:generate` in dev. Do not use `db:migrate` in dev unless creating a named migration for production.
- **Adding a new OS module**: create the route in `app/(dashboard)/[module]/`, add the service in `lib/services/`, add actions in `lib/actions/[module].actions.ts`, add Zod validators in `lib/validators/[module].ts`, and register the nav item in `src/config/navigation.ts`.
