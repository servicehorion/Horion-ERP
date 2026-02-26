import type { UserRole } from "@prisma/client";

type UserLike = { id: string; tenantId: string; role: UserRole };

const roleSet = (roles: UserRole[]) => new Set<UserRole>(roles);

export const CRM_FULL_ROLES = roleSet([
  "ADMIN",
  "CEO",
  "DIRECTION",
  "CRM_MANAGER",
]);

export const CRM_LIMITED_ROLES = roleSet([
  "COMMERCIAL",
]);

export function getCrmContactScope(user: UserLike) {
  if (CRM_FULL_ROLES.has(user.role)) {
    return { tenantId: user.tenantId };
  }
  if (CRM_LIMITED_ROLES.has(user.role)) {
    return {
      tenantId: user.tenantId,
      OR: [
        { ownerId: user.id },
        { onboardedById: user.id },
        { collaborators: { some: { userId: user.id } } },
      ],
    };
  }
  return null;
}

export function getCrmLeadScope(user: UserLike) {
  if (CRM_FULL_ROLES.has(user.role)) {
    return { contact: { tenantId: user.tenantId } };
  }
  if (CRM_LIMITED_ROLES.has(user.role)) {
    return {
      contact: { tenantId: user.tenantId },
      OR: [
        { ownerId: user.id },
        { onboardedById: user.id },
        { assignedTo: user.id },
        { collaborators: { some: { userId: user.id } } },
      ],
    };
  }
  return null;
}

export function canExportCrm(role: UserRole) {
  return role === "CEO" || role === "ADMIN";
}

const TASK_MODULE_ACCESS: Record<UserRole, string[] | "*"> = {
  ADMIN: "*",
  CEO: "*",
  DIRECTION: "*",
  OPS: "*",

  CRM_MANAGER: ["crm", "orders"],
  COMMERCIAL: ["crm", "orders", "catalog"],

  LOGISTICS_MANAGER: ["logistics", "qc"],
  LOGISTICS_ASSISTANT: ["logistics", "qc"],

  SOURCING_ASSISTANT: ["sourcing"],

  FINANCE_MANAGER: ["finance"],
  FINANCE: ["finance"],

  COMMUNITY_MANAGER: ["manual"],
  CTO: ["manual"],
  AI_ENGINEER: ["manual"],

  VIEWER: [],
};

export function getTaskAllowedModules(role: UserRole): string[] | "*" {
  return TASK_MODULE_ACCESS[role] ?? [];
}

export function canAccessTaskModule(role: UserRole, module: string): boolean {
  const allowed = getTaskAllowedModules(role);
  if (allowed === "*") return true;
  return allowed.includes(module);
}

export function getTaskRolesForModule(module: string): UserRole[] {
  return (Object.entries(TASK_MODULE_ACCESS) as [UserRole, string[] | "*"][])
    .filter(([, allowed]) => allowed === "*" || (Array.isArray(allowed) && allowed.includes(module)))
    .map(([role]) => role);
}

export function getTaskRolesForModules(modules?: string[] | "*"): UserRole[] | "*" {
  if (!modules || modules === "*") return "*";
  const roles = new Set<UserRole>();
  for (const module of modules) {
    for (const role of getTaskRolesForModule(module)) {
      roles.add(role);
    }
  }
  return Array.from(roles);
}
