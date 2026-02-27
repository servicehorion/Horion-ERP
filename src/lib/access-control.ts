import type { UserRole } from "@prisma/client";

type UserLike = { id: string; tenantId: string; role: UserRole };

/**
 * Scope de module : détermine ce qu'un utilisateur peut voir dans un OS donné.
 *
 * - "full"    → accès total aux données du tenant
 * - "limited" → accès partiel (portefeuille propre, statut livraison, etc.)
 * - "none"    → module non autorisé
 *
 * La clause `where` est un filtre Prisma à injecter dans les requêtes.
 */
export type ModuleScope = {
  type: "full" | "limited" | "none";
  where: Record<string, unknown>;
};

// Rôles avec accès complet à tous les modules opérationnels
const SUPER_ROLES = new Set<UserRole>(["ADMIN", "CEO", "DIRECTION", "OPS"]);

/**
 * ABAC — retourne le scope Prisma pour un module OS donné.
 *
 * Modules : "crm" | "project" | "logistics" | "sourcing" | "qc"
 *           | "finance" | "marketing" | "ai" | "orders" | "tasks"
 */
export function getModuleScope(user: UserLike, module: string): ModuleScope {
  const tenantBase = { tenantId: user.tenantId };

  // Super-rôles → accès total partout
  if (SUPER_ROLES.has(user.role)) {
    return { type: "full", where: tenantBase };
  }

  switch (module) {
    // ─── CRM OS ─────────────────────────────────────────────────────────────
    case "crm": {
      // Accès complet CRM
      if (user.role === "CRM_MANAGER") {
        return { type: "full", where: tenantBase };
      }
      // Commercial → uniquement son portefeuille
      if (user.role === "COMMERCIAL") {
        return {
          type: "limited",
          where: {
            tenantId: user.tenantId,
            OR: [
              { ownerId: user.id },
              { onboardedById: user.id },
              { collaborators: { some: { userId: user.id } } },
            ],
          },
        };
      }
      // Logistique → statut livraison uniquement (même WHERE tenant, restriction au niveau UI)
      if (user.role === "LOGISTICS_MANAGER" || user.role === "LOGISTICS_ASSISTANT") {
        return { type: "limited", where: tenantBase };
      }
      // Finance → données financières clients (restriction champs au niveau UI)
      if (user.role === "FINANCE_MANAGER" || user.role === "FINANCE") {
        return { type: "limited", where: tenantBase };
      }
      // Community Manager → contacts en lecture seule
      if (user.role === "COMMUNITY_MANAGER") {
        return { type: "limited", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── Project OS ─────────────────────────────────────────────────────────
    case "project": {
      // Managers avec accès projet complet
      if (
        user.role === "CTO" ||
        user.role === "LOGISTICS_MANAGER" ||
        user.role === "CRM_MANAGER"
      ) {
        return { type: "full", where: tenantBase };
      }
      // Autres rôles → uniquement les projets dont ils sont membres
      return {
        type: "limited",
        where: {
          tenantId: user.tenantId,
          members: { some: { userId: user.id } },
        },
      };
    }

    // ─── Logistique OS ──────────────────────────────────────────────────────
    case "logistics": {
      if (
        user.role === "LOGISTICS_MANAGER" ||
        user.role === "LOGISTICS_ASSISTANT"
      ) {
        return { type: "full", where: tenantBase };
      }
      // Finance → statut livraison pour facturation (lecture, champs limités)
      if (user.role === "FINANCE_MANAGER" || user.role === "FINANCE") {
        return { type: "limited", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── Sourcing OS ────────────────────────────────────────────────────────
    case "sourcing": {
      if (
        user.role === "LOGISTICS_MANAGER" ||
        user.role === "LOGISTICS_ASSISTANT" ||
        user.role === "SOURCING_ASSISTANT"
      ) {
        return { type: "full", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── Contrôle Qualité ───────────────────────────────────────────────────
    case "qc": {
      if (
        user.role === "LOGISTICS_MANAGER" ||
        user.role === "LOGISTICS_ASSISTANT"
      ) {
        return { type: "full", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── Finance OS ─────────────────────────────────────────────────────────
    case "finance": {
      if (user.role === "FINANCE_MANAGER" || user.role === "FINANCE") {
        return { type: "full", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── Marketing OS ───────────────────────────────────────────────────────
    case "marketing": {
      if (user.role === "COMMUNITY_MANAGER") {
        return { type: "full", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── AI OS ──────────────────────────────────────────────────────────────
    case "ai": {
      if (user.role === "CTO" || user.role === "AI_ENGINEER") {
        return { type: "full", where: tenantBase };
      }
      return { type: "none", where: {} };
    }

    // ─── Commandes ──────────────────────────────────────────────────────────
    case "orders": {
      // Commercial → uniquement ses propres commandes
      if (user.role === "COMMERCIAL") {
        return {
          type: "limited",
          where: { tenantId: user.tenantId, createdById: user.id },
        };
      }
      return { type: "full", where: tenantBase };
    }

    // ─── Tâches ─────────────────────────────────────────────────────────────
    case "tasks": {
      return { type: "full", where: tenantBase };
    }

    default:
      return { type: "full", where: tenantBase };
  }
}

// ─── Compatibilité : anciennes exports CRM ───────────────────────────────────

const roleSet = (roles: UserRole[]) => new Set<UserRole>(roles);

export const CRM_FULL_ROLES = roleSet([
  "ADMIN", "CEO", "DIRECTION", "OPS", "CRM_MANAGER",
]);

export const CRM_LIMITED_ROLES = roleSet([
  "COMMERCIAL",
]);

/** WHERE clause Prisma pour les contacts CRM selon le rôle */
export function getCrmContactScope(user: UserLike) {
  const scope = getModuleScope(user, "crm");
  if (scope.type === "none") return null;
  if (scope.type === "full") return { tenantId: user.tenantId };
  // limited → filtre portefeuille pour COMMERCIAL, tenant pour les autres
  if (user.role === "COMMERCIAL") {
    return {
      tenantId: user.tenantId,
      OR: [
        { ownerId: user.id },
        { onboardedById: user.id },
        { collaborators: { some: { userId: user.id } } },
      ],
    };
  }
  return { tenantId: user.tenantId };
}

/** WHERE clause Prisma pour les leads CRM selon le rôle */
export function getCrmLeadScope(user: UserLike) {
  const scope = getModuleScope(user, "crm");
  if (scope.type === "none") return null;
  if (scope.type === "full") return { contact: { tenantId: user.tenantId } };
  if (user.role === "COMMERCIAL") {
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
  return { contact: { tenantId: user.tenantId } };
}

export function canExportCrm(role: UserRole) {
  return role === "CEO" || role === "ADMIN";
}

// ─── Compatibilité : accès modules de tâches ─────────────────────────────────

const TASK_MODULE_ACCESS: Record<UserRole, string[] | "*"> = {
  ADMIN: "*",
  CEO: "*",
  DIRECTION: "*",
  OPS: "*",

  CRM_MANAGER: ["crm", "orders"],
  COMMERCIAL: ["crm", "orders", "catalog"],

  LOGISTICS_MANAGER: ["logistics", "qc", "sourcing"],
  LOGISTICS_ASSISTANT: ["logistics", "qc"],

  SOURCING_ASSISTANT: ["sourcing"],

  FINANCE_MANAGER: ["finance"],
  FINANCE: ["finance"],

  CTO: "*",
  AI_ENGINEER: ["ai"],
  COMMUNITY_MANAGER: ["marketing"],

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
  for (const mod of modules) {
    for (const role of getTaskRolesForModule(mod)) {
      roles.add(role);
    }
  }
  return Array.from(roles);
}
