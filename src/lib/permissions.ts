import type { UserRole } from "@prisma/client";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ["*"],
  DIRECTION: [
    "order.create", "order.update", "order.delete", "order.update_status",
    "task.update", "task.assign",
    "payment.approve", "payment.create",
    "quote.create", "quote.send",
    "delegation.manage",
    "user.manage",
  ],
  FINANCE: [
    "order.view", "order.update_status",
    "payment.create", "payment.approve",
    "quote.create", "quote.send",
    "task.update", "task.assign",
  ],
  OPS: [
    "order.create", "order.update", "order.update_status",
    "task.update", "task.assign",
    "quote.create",
    "sourcing.manage",
    "qc.manage",
    "logistics.manage",
  ],
  COMMERCIAL: [
    "order.create", "order.view",
    "contact.manage",
    "lead.manage",
    "quote.create",
  ],
  VIEWER: [
    "order.view",
    "task.view",
    "contact.view",
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
    throw new Error(`Permission refusee: ${action} pour le role ${role}`);
  }
}
