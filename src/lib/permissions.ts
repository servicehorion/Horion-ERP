import type { UserRole } from "@prisma/client";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ["*"],
  DIRECTION: [
    "order.create", "order.update", "order.delete", "order.update_status", "order.view",
    "task.update", "task.assign", "task.view",
    "payment.create", "payment.approve", "payment.confirm",
    "quote.create", "quote.send",
    "contact.manage", "contact.view",
    "lead.manage",
    "catalog.manage", "catalog.view",
    "sourcing.manage",
    "delegation.manage",
    "user.manage",
  ],
  FINANCE: [
    "order.view", "order.update_status",
    "payment.create", "payment.approve", "payment.confirm",
    "quote.create", "quote.send",
    "task.update", "task.assign", "task.view",
    "contact.view",
    "catalog.view",
  ],
  OPS: [
    "order.create", "order.update", "order.update_status", "order.view",
    "task.update", "task.assign", "task.view",
    "quote.create",
    "contact.manage", "contact.view",
    "catalog.manage", "catalog.view",
    "sourcing.manage",
    "qc.manage",
    "logistics.manage",
  ],
  COMMERCIAL: [
    "order.create", "order.view",
    "contact.manage", "contact.view",
    "lead.manage",
    "catalog.view",
    "quote.create",
    "task.view",
  ],
  VIEWER: [
    "order.view",
    "task.view",
    "contact.view",
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
