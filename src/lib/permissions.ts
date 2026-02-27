import type { UserRole } from "@prisma/client";

/**
 * RBAC — Role-Based Access Control
 *
 * Permissions keys (module.action):
 *  order.*          commandes
 *  crm.view/manage  CRM OS (contacts + leads)
 *  contact.*        contacts (granular)
 *  lead.*           leads (granular)
 *  sourcing.*       Sourcing OS
 *  logistics.*      Logistique OS
 *  qc.view/manage   Contrôle Qualité
 *  finance.*        Finance OS
 *  marketing.*      Marketing OS
 *  ai.*             AI OS
 *  operations.*     Operations OS
 *  task.*           Tâches (view / update / assign / manage)
 *  project.*        Project OS (view / manage)
 *  pilotage.view    Dashboard / KPIs stratégiques
 *  payment.*        Paiements
 *  quote.*          Devis
 *  catalog.*        Catalogue
 *  delegation.*     Délégations
 *  user.manage      Gestion équipe / paramètres
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  // ───── Super-admin : accès total ─────────────────────────────────────────
  ADMIN: ["*"],
  CEO:   ["*"],

  // ───── Direction générale ─────────────────────────────────────────────────
  DIRECTION: [
    // Commandes
    "order.create", "order.update", "order.delete", "order.update_status", "order.view",
    // CRM OS
    "crm.view", "crm.manage",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    // Sourcing OS
    "sourcing.manage", "sourcing.view",
    // Logistique OS
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    // Finance OS
    "payment.create", "payment.approve", "payment.confirm",
    "finance.view", "finance.manage",
    // Marketing OS
    "marketing.view", "marketing.manage",
    // AI OS — vue seule (pas de configuration)
    "ai.view",
    // Catalogue / Devis
    "catalog.manage", "catalog.view",
    "quote.create", "quote.send",
    // Operations OS / Tâches
    "operations.view", "operations.manage",
    "task.view", "task.update", "task.assign", "task.manage",
    // Project OS
    "project.view", "project.manage",
    // Pilotage
    "pilotage.view",
    // Admin
    "delegation.manage",
    "user.manage",
  ],

  // ───── CTO ───────────────────────────────────────────────────────────────
  CTO: [
    "ai.view", "ai.manage",
    "task.view", "task.update", "task.assign", "task.manage",
    "project.view", "project.manage",
  ],

  // ───── AI Engineer ────────────────────────────────────────────────────────
  AI_ENGINEER: [
    "ai.view", "ai.manage",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // ───── CRM Manager ───────────────────────────────────────────────────────
  CRM_MANAGER: [
    "crm.view", "crm.manage",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "order.view",
    "quote.create",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // ───── Commercial (scope = portefeuille propre) ───────────────────────────
  COMMERCIAL: [
    "crm.view", "crm.manage",    // limité au portefeuille — filtré dans access-control
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "order.create", "order.view",
    "catalog.view",
    "quote.create",
    "task.view",
    "project.view",
  ],

  // ───── Community Manager ──────────────────────────────────────────────────
  COMMUNITY_MANAGER: [
    "marketing.view", "marketing.manage",
    "crm.view",         // contacts seulement — limité dans access-control
    "contact.view",
    "task.view",
  ],

  // ───── Logistics Manager ──────────────────────────────────────────────────
  LOGISTICS_MANAGER: [
    "order.view", "order.update_status",
    "sourcing.manage", "sourcing.view",
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    "crm.view",           // statut livraison seulement — scope limité
    "task.view", "task.update", "task.assign", "task.manage",
    "project.view", "project.manage",
  ],

  // ───── Logistics Assistant ────────────────────────────────────────────────
  LOGISTICS_ASSISTANT: [
    "order.view",
    "sourcing.view",
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // ───── Sourcing Assistant ─────────────────────────────────────────────────
  SOURCING_ASSISTANT: [
    "order.view",
    "sourcing.manage", "sourcing.view",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // ───── Finance Manager ────────────────────────────────────────────────────
  FINANCE_MANAGER: [
    "order.view",
    "payment.create", "payment.approve", "payment.confirm",
    "finance.view", "finance.manage",
    "crm.view",         // données financières clients seulement
    "logistics.view",   // statut livraison pour facturation
    "task.view",
    "project.view",
  ],

  // ───── Finance ────────────────────────────────────────────────────────────
  FINANCE: [
    "order.view", "order.update_status",
    "payment.create", "payment.approve", "payment.confirm",
    "quote.create", "quote.send",
    "finance.view", "finance.manage",
    "crm.view",         // limité — scope dans access-control
    "task.update", "task.assign", "task.view",
    "contact.view", "lead.view",
    "catalog.view",
    "project.view",
  ],

  // ───── Ops (opérations transverses) ──────────────────────────────────────
  OPS: [
    "order.create", "order.update", "order.update_status", "order.view",
    "crm.view", "crm.manage",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "catalog.manage", "catalog.view",
    "sourcing.manage", "sourcing.view",
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    "quote.create",
    "operations.view", "operations.manage",
    "task.update", "task.assign", "task.view", "task.manage",
    "project.view", "project.manage",
  ],

  // ───── Viewer (lecture seule) ─────────────────────────────────────────────
  VIEWER: [
    "order.view",
    "task.view",
    "contact.view", "lead.view",
    "catalog.view",
    "project.view",
  ],
};

export function hasPermission(role: UserRole, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(action);
}

export function checkPermission(role: UserRole, action: string): void {
  if (!hasPermission(role, action)) {
    throw new Error(`Permission refusée : ${action} pour le rôle ${role}`);
  }
}

/** Retourne la liste des permissions d'un rôle (ou ["*"]) */
export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
