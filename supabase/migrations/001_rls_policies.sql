-- ============================================================
-- Horion ERP — Row Level Security (RLS) Policies
-- Migration: 001_rls_policies.sql
-- Applies multi-tenant isolation via app.tenant_id session variable
-- ============================================================
-- USAGE: Before any query, your app must set the session variable:
--   SET LOCAL app.tenant_id = 'horion-congo';
-- This is done in src/lib/db.ts via a Prisma middleware or $executeRaw.
-- ============================================================

-- Helper: current tenant from session variable
-- Returns empty string if not set (blocks all rows = safe default)
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.tenant_id', true), '')
$$ LANGUAGE sql STABLE;

-- ============================================================
-- TABLE: contacts
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON contacts;
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: leads
-- ============================================================
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Lead";
CREATE POLICY tenant_isolation ON "Lead"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: orders
-- ============================================================
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Order";
CREATE POLICY tenant_isolation ON "Order"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: invoices
-- ============================================================
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Invoice";
CREATE POLICY tenant_isolation ON "Invoice"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: users
-- ============================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: tasks
-- ============================================================
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Task";
CREATE POLICY tenant_isolation ON "Task"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: whatsapp_conversations (mapped from WhatsappConversation)
-- ============================================================
ALTER TABLE "WhatsappConversation" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "WhatsappConversation";
CREATE POLICY tenant_isolation ON "WhatsappConversation"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: WhatsappMessage
-- RLS via conversation tenant_id (join required — use policy on conversation instead)
-- Here we use a subquery on conversation
-- ============================================================
ALTER TABLE "WhatsappMessage" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "WhatsappMessage";
CREATE POLICY tenant_isolation ON "WhatsappMessage"
  USING (
    conversation_id IN (
      SELECT id FROM "WhatsappConversation"
      WHERE tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- TABLE: EmailLog
-- ============================================================
ALTER TABLE "EmailLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "EmailLog";
CREATE POLICY tenant_isolation ON "EmailLog"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: AuditLog
-- ============================================================
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: EmailCampaign
-- ============================================================
ALTER TABLE "EmailCampaign" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "EmailCampaign";
CREATE POLICY tenant_isolation ON "EmailCampaign"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: QcPlan
-- ============================================================
ALTER TABLE "QcPlan" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "QcPlan";
CREATE POLICY tenant_isolation ON "QcPlan"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- TABLE: QcInspection
-- ============================================================
ALTER TABLE "QcInspection" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "QcInspection";
CREATE POLICY tenant_isolation ON "QcInspection"
  USING (tenant_id = current_tenant_id());

-- ============================================================
-- IMPORTANT: Service role bypass
-- Supabase's service_role key bypasses RLS entirely.
-- Use it only in migrations and cron jobs.
-- The app uses the anon/authenticated role via pooler — RLS applies.
-- ============================================================

-- ============================================================
-- HOW TO APPLY THIS MIGRATION
-- Option A — Supabase Dashboard > SQL Editor: paste and run
-- Option B — Supabase CLI:
--   supabase db push  (if using linked project)
-- Option C — psql direct:
--   psql $DATABASE_URL -f supabase/migrations/001_rls_policies.sql
-- ============================================================
