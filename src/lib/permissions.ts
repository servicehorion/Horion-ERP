import type { UserRole } from "@prisma/client";

/**
 * RBAC â€” Role-Based Access Control
 *
 * Permissions keys (module.action):
 *  order.*          commandes
 *  crm.view/manage  CRM OS (contacts + leads)
 *  contact.*        contacts (granular)
 *  lead.*           leads (granular)
 *  sourcing.*       Sourcing OS
 *  logistics.*      Logistique OS
 *  qc.view/manage   ContrÃ´le QualitÃ©
 *  finance.*        Finance OS
 *  marketing.*      Marketing OS
 *  whatsapp.*       WhatsApp OS
 *  ai.*             AI OS
 *  operations.*     Operations OS
 *  task.*           TÃ¢ches (view / update / assign / manage)
 *  project.*        Project OS (view / manage)
 *  pilotage.view    Dashboard / KPIs stratÃ©giques
 *  pilotage.manage  Decisions stratÃ©giques
 *  payment.*        Paiements
 *  quote.*          Devis
 *  catalog.*        Catalogue
 *  delegation.*     DÃ©lÃ©gations
 *  user.manage      Gestion Ã©quipe / paramÃ¨tres
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  // â”€â”€â”€â”€â”€ Super-admin : accÃ¨s total â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ADMIN: ["*"],
  CEO:   ["*"],

  // â”€â”€â”€â”€â”€ Direction gÃ©nÃ©rale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DIRECTION: [
    // Commandes
    "order.create", "order.update", "order.delete", "order.update_status", "order.view", "order.approve",
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
    // WhatsApp OS
    "whatsapp.view", "whatsapp.manage", "whatsapp.send", "whatsapp.broadcast", "whatsapp.templates.manage", "whatsapp.settings",
    // AI OS â€” vue seule (pas de configuration)
    "ai.view",
    // Catalogue / Devis
    "catalog.manage", "catalog.view",
    "quote.create", "quote.send", "quote.approve",
    // Operations OS / TÃ¢ches
    "operations.view", "operations.manage",
    "task.view", "task.update", "task.assign", "task.manage",
    // Project OS
    "project.view", "project.manage",
    // Pilotage
    "pilotage.view",
    "pilotage.manage",
    // Admin
    "delegation.manage",
    "user.manage",
  ],

  // â”€â”€â”€â”€â”€ CTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CTO: [
    "ai.view", "ai.manage",
    "task.view", "task.update", "task.assign", "task.manage",
    "project.view", "project.manage",
  ],

  // â”€â”€â”€â”€â”€ AI Engineer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  AI_ENGINEER: [
    "ai.view", "ai.manage",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // â”€â”€â”€â”€â”€ CRM Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CRM_MANAGER: [
    "crm.view", "crm.manage",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "order.view",
    "quote.create", "quote.send", "quote.approve",
    "task.view", "task.update", "task.manage",
    "project.view",
    "whatsapp.view", "whatsapp.manage", "whatsapp.send",
  ],

  // â”€â”€â”€â”€â”€ Commercial (scope = portefeuille propre) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  COMMERCIAL: [
    "crm.view", "crm.manage",    // limitÃ© au portefeuille â€” filtrÃ© dans access-control
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "order.create", "order.view",
    "marketing.view",
    "catalog.view",
    "quote.create", "quote.send", "quote.approve",
    "task.view",
    "project.view",
    "whatsapp.view", "whatsapp.send",
  ],

  // â”€â”€â”€â”€â”€ Community Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  COMMUNITY_MANAGER: [
    "marketing.view", "marketing.manage",
    "crm.view",         // contacts seulement â€” limitÃ© dans access-control
    "contact.view",
    "task.view",
    "whatsapp.view", "whatsapp.manage", "whatsapp.send", "whatsapp.broadcast", "whatsapp.templates.manage",
  ],

  // â”€â”€â”€â”€â”€ Logistics Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  LOGISTICS_MANAGER: [
    "order.view", "order.update_status",
    "quote.approve",
    "sourcing.manage", "sourcing.view",
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    "crm.view",           // statut livraison seulement â€” scope limitÃ©
    "task.view", "task.update", "task.assign", "task.manage",
    "project.view", "project.manage",
  ],

  // â”€â”€â”€â”€â”€ Logistics Assistant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  LOGISTICS_ASSISTANT: [
    "order.view",
    "quote.approve",
    "sourcing.view",
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // â”€â”€â”€â”€â”€ Sourcing Assistant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SOURCING_ASSISTANT: [
    "order.view",
    "sourcing.manage", "sourcing.view",
    "task.view", "task.update", "task.manage",
    "project.view",
  ],

  // â”€â”€â”€â”€â”€ Finance Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  FINANCE_MANAGER: [
    "order.view",
    "order.approve",
    "payment.create", "payment.approve", "payment.confirm",
    "finance.view", "finance.manage",
    "crm.view",         // donnÃ©es financiÃ¨res clients seulement
    "logistics.view",   // statut livraison pour facturation
    "task.view",
    "project.view",
  ],

  // â”€â”€â”€â”€â”€ Finance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  FINANCE: [
    "order.view", "order.update_status",
    "payment.create", "payment.approve", "payment.confirm",
    "quote.create", "quote.send", "quote.approve",
    "finance.view", "finance.manage",
    "crm.view",         // limitÃ© â€” scope dans access-control
    "task.update", "task.assign", "task.view",
    "contact.view", "lead.view",
    "catalog.view",
    "project.view",
  ],

  // â”€â”€â”€â”€â”€ Ops (opÃ©rations transverses) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  OPS: [
    "order.create", "order.update", "order.update_status", "order.view",
    "crm.view", "crm.manage",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "marketing.view",
    "catalog.manage", "catalog.view",
    "sourcing.manage", "sourcing.view",
    "logistics.view", "logistics.manage",
    "qc.view", "qc.manage",
    "quote.create", "quote.send", "quote.approve",
    "operations.view", "operations.manage",
    "task.update", "task.assign", "task.view", "task.manage",
    "project.view", "project.manage",
    "whatsapp.view", "whatsapp.manage", "whatsapp.send", "whatsapp.broadcast", "whatsapp.templates.manage", "whatsapp.settings",
  ],

  // â”€â”€â”€â”€â”€ Viewer (lecture seule) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    throw new Error(`Permission refusÃ©e : ${action} pour le rÃ´le ${role}`);
  }
}

/** Retourne la liste des permissions d'un rÃ´le (ou ["*"]) */
export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}



