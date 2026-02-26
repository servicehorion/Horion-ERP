import type { UserRole } from "@prisma/client";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ["*"],
  CEO: ["*"],
  DIRECTION: [
    "order.create", "order.update", "order.delete", "order.update_status", "order.view",
    "task.update", "task.assign", "task.view",
    "payment.create", "payment.approve", "payment.confirm",
    "quote.create", "quote.send",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "catalog.manage", "catalog.view",
    "sourcing.manage", "sourcing.view",
    "finance.view", "finance.manage",
    "marketing.view", "marketing.manage",
    "ai.view", "ai.manage",
    "pilotage.view",
    "delegation.manage",
    "user.manage",
  ],
  CTO: [
    "ai.view", "ai.manage",
  ],
  AI_ENGINEER: [
    "ai.view", "ai.manage",
  ],
  CRM_MANAGER: [
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "order.view",
    "quote.create",
    "task.view", "task.update",
  ],
  COMMUNITY_MANAGER: [
    "marketing.view", "marketing.manage",
  ],
  LOGISTICS_MANAGER: [
    "order.view", "order.update_status",
    "sourcing.manage", "sourcing.view",
    "logistics.manage",
    "qc.manage",
    "task.view", "task.update", "task.assign",
  ],
  LOGISTICS_ASSISTANT: [
    "order.view",
    "sourcing.view",
    "logistics.manage",
    "qc.manage",
    "task.view", "task.update",
  ],
  SOURCING_ASSISTANT: [
    "order.view",
    "sourcing.manage", "sourcing.view",
    "task.view", "task.update",
  ],
  FINANCE_MANAGER: [
    "order.view",
    "payment.create", "payment.approve", "payment.confirm",
    "finance.view", "finance.manage",
    "task.view",
  ],
  FINANCE: [
    "order.view", "order.update_status",
    "payment.create", "payment.approve", "payment.confirm",
    "quote.create", "quote.send",
    "finance.view", "finance.manage",
    "task.update", "task.assign", "task.view",
    "contact.view", "lead.view",
    "catalog.view",
  ],
  OPS: [
    "order.create", "order.update", "order.update_status", "order.view",
    "task.update", "task.assign", "task.view",
    "quote.create",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "catalog.manage", "catalog.view",
    "sourcing.manage", "sourcing.view",
    "qc.manage",
    "logistics.manage",
  ],
  COMMERCIAL: [
    "order.create", "order.view",
    "contact.manage", "contact.view",
    "lead.manage", "lead.view",
    "catalog.view",
    "quote.create",
    "task.view",
  ],
  VIEWER: [
    "order.view",
    "task.view",
    "contact.view",
    "lead.view",
    "catalog.view",
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
