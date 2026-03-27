import type { UserRole } from "@prisma/client";

import { getTaskRolesForModule } from "@/lib/access-control";
import { prisma } from "@/lib/db";

const TERMINAL_TASK_STATUSES = ["COMPLETED", "CANCELLED"] as const;
const DEFAULT_FALLBACK_ROLES: UserRole[] = ["ADMIN", "DIRECTION", "CEO"];
const MODULE_PRIMARY_ROLES: Record<string, UserRole[]> = {
  orders: ["COMMERCIAL", "CRM_MANAGER", "OPS"],
  sourcing: ["SOURCING_ASSISTANT", "LOGISTICS_MANAGER", "OPS"],
  logistics: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER", "OPS"],
  qc: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER", "OPS"],
  finance: ["FINANCE", "FINANCE_MANAGER", "OPS"],
  crm: ["COMMERCIAL", "CRM_MANAGER", "COMMUNITY_MANAGER", "OPS"],
  catalog: ["COMMERCIAL", "SOURCING_ASSISTANT", "OPS"],
  whatsapp: ["COMMUNITY_MANAGER", "CRM_MANAGER", "OPS"],
};

const MODULE_MANAGER_ROLES: Record<string, UserRole[]> = {
  orders: ["CRM_MANAGER", "OPS"],
  sourcing: ["LOGISTICS_MANAGER", "OPS"],
  logistics: ["LOGISTICS_MANAGER", "OPS"],
  qc: ["LOGISTICS_MANAGER", "OPS"],
  finance: ["FINANCE_MANAGER", "OPS"],
  crm: ["CRM_MANAGER", "OPS"],
  catalog: ["CRM_MANAGER", "OPS"],
  whatsapp: ["CRM_MANAGER", "OPS"],
};

type EntityContext = {
  primaryUserIds: string[];
  secondaryUserIds: string[];
};

type CandidateScore = {
  userId: string;
  name: string;
  role: UserRole;
  score: number;
  reasons: string[];
  metrics: {
    activeAssignedCount: number;
    overdueAssignedCount: number;
    urgentAssignedCount: number;
    inProgressAssignedCount: number;
    sameEntityActiveCount: number;
    sameModuleCompletedCount: number;
  };
};

type ResponsibilityInput = {
  tenantId: string;
  module: string;
  entityType: string;
  entityId: string;
  assigneeId?: string | null;
  preferredAssigneeId?: string | null;
  assigneeRoles?: UserRole[];
  fallbackRoles?: UserRole[];
  dueDate?: Date | null;
  slaDeadline?: Date | null;
};

export type TaskResponsibilityResolution = {
  primaryOwnerId: string | null;
  backupOwnerId: string | null;
  managerOwnerId: string | null;
  escalationAt: Date | null;
  escalationLevel: number;
  assignmentReason: string | null;
  candidates: CandidateScore[];
};

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

function uniqueByKey<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePrimaryRoles(module: string, roles?: UserRole[]) {
  if (roles && roles.length > 0) {
    return uniq(roles);
  }
  return uniq(MODULE_PRIMARY_ROLES[module] ?? getTaskRolesForModule(module));
}

function normalizeFallbackRoles(module: string, roles?: UserRole[]) {
  if (roles && roles.length > 0) {
    return uniq(roles);
  }
  return uniq([...(MODULE_MANAGER_ROLES[module] ?? []), ...DEFAULT_FALLBACK_ROLES]);
}

async function loadEntityContext(tenantId: string, entityType: string, entityId: string): Promise<EntityContext> {
  if (!entityId || entityId === "manual") {
    return { primaryUserIds: [], secondaryUserIds: [] };
  }

  if (entityType === "order") {
    const order = await prisma.order.findFirst({
      where: { id: entityId, tenantId },
      select: {
        ownerId: true,
        onboardedById: true,
        collaborators: { select: { userId: true } },
      },
    });

    return {
      primaryUserIds: uniq([order?.ownerId, order?.onboardedById].filter((value): value is string => Boolean(value))),
      secondaryUserIds: uniq((order?.collaborators ?? []).map((item) => item.userId)),
    };
  }

  if (entityType === "lead") {
    const lead = await prisma.lead.findUnique({
      where: { id: entityId },
      select: {
        ownerId: true,
        onboardedById: true,
        assignedTo: true,
        collaborators: { select: { userId: true } },
      },
    });

    return {
      primaryUserIds: uniq(
        [lead?.assignedTo, lead?.ownerId, lead?.onboardedById].filter((value): value is string => Boolean(value))
      ),
      secondaryUserIds: uniq((lead?.collaborators ?? []).map((item) => item.userId)),
    };
  }

  if (entityType === "demand" || entityType === "demandIntake") {
    const demand = await prisma.demandIntake.findFirst({
      where: { id: entityId, tenantId },
      select: {
        assignedToId: true,
        qualifiedById: true,
        cmId: true,
      },
    });

    return {
      primaryUserIds: uniq(
        [demand?.assignedToId, demand?.qualifiedById, demand?.cmId].filter((value): value is string => Boolean(value))
      ),
      secondaryUserIds: [],
    };
  }

  if (entityType === "contact") {
    const contact = await prisma.contact.findFirst({
      where: { id: entityId, tenantId },
      select: {
        ownerId: true,
        onboardedById: true,
        collaborators: { select: { userId: true } },
      },
    });

    return {
      primaryUserIds: uniq([contact?.ownerId, contact?.onboardedById].filter((value): value is string => Boolean(value))),
      secondaryUserIds: uniq((contact?.collaborators ?? []).map((item) => item.userId)),
    };
  }

  if (entityType === "project") {
    const project = await prisma.project.findFirst({
      where: { id: entityId, tenantId },
      select: {
        ownerId: true,
        members: { select: { userId: true } },
      },
    });

    return {
      primaryUserIds: uniq([project?.ownerId].filter((value): value is string => Boolean(value))),
      secondaryUserIds: uniq((project?.members ?? []).map((item) => item.userId)),
    };
  }

  return { primaryUserIds: [], secondaryUserIds: [] };
}

async function scoreCandidates(
  tenantId: string,
  module: string,
  entityType: string,
  entityId: string,
  roles: UserRole[],
  preferredAssigneeId?: string | null
) {
  if (roles.length === 0) return [];

  const entityContext = await loadEntityContext(tenantId, entityType, entityId);
  const candidates = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: roles as any[] },
    },
    select: {
      id: true,
      name: true,
      role: true,
      lastLoginAt: true,
      taskAssignments: {
        select: {
          task: {
            select: {
              status: true,
              module: true,
              entityType: true,
              entityId: true,
              priority: true,
              slaBreach: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  return candidates
    .map((candidate) => {
      const tasks = candidate.taskAssignments.map((assignment) => assignment.task);
      const activeTasks = tasks.filter((task) => !TERMINAL_TASK_STATUSES.includes(task.status as (typeof TERMINAL_TASK_STATUSES)[number]));
      const completedModuleTasks = tasks.filter(
        (task) => task.module === module && task.status === "COMPLETED" && task.completedAt
      );
      const sameEntityActiveCount = activeTasks.filter(
        (task) => task.entityType === entityType && task.entityId === entityId
      ).length;
      const overdueAssignedCount = activeTasks.filter((task) => task.slaBreach).length;
      const urgentAssignedCount = activeTasks.filter((task) => ["HIGH", "URGENT"].includes(task.priority)).length;
      const inProgressAssignedCount = activeTasks.filter((task) => task.status === "IN_PROGRESS").length;
      const activeAssignedCount = activeTasks.length;

      let score = 100;
      const reasons: string[] = [];

      if (preferredAssigneeId && candidate.id === preferredAssigneeId) {
        score += 70;
        reasons.push("continuite du dossier");
      }

      if (entityContext.primaryUserIds.includes(candidate.id)) {
        score += 40;
        reasons.push("responsable direct du dossier");
      }

      if (entityContext.secondaryUserIds.includes(candidate.id)) {
        score += 20;
        reasons.push("deja collaborateur sur le dossier");
      }

      if (sameEntityActiveCount > 0) {
        score += 18;
        reasons.push("travaille deja sur cette entite");
      }

      if (completedModuleTasks.length > 0) {
        score += Math.min(15, completedModuleTasks.length * 2);
        reasons.push("experience recente sur ce module");
      }

      score -= activeAssignedCount * 10;
      score -= overdueAssignedCount * 18;
      score -= urgentAssignedCount * 6;
      score -= inProgressAssignedCount * 4;

      if (!candidate.lastLoginAt) {
        score -= 6;
        reasons.push("aucune activite recente detectee");
      }

      return {
        userId: candidate.id,
        name: candidate.name,
        role: candidate.role,
        score,
        reasons: reasons.length > 0 ? reasons : ["couverture de role"],
        metrics: {
          activeAssignedCount,
          overdueAssignedCount,
          urgentAssignedCount,
          inProgressAssignedCount,
          sameEntityActiveCount,
          sameModuleCompletedCount: completedModuleTasks.length,
        },
      } satisfies CandidateScore;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.metrics.overdueAssignedCount !== right.metrics.overdueAssignedCount) {
        return left.metrics.overdueAssignedCount - right.metrics.overdueAssignedCount;
      }
      if (left.metrics.activeAssignedCount !== right.metrics.activeAssignedCount) {
        return left.metrics.activeAssignedCount - right.metrics.activeAssignedCount;
      }
      return left.name.localeCompare(right.name, "fr");
    });
}

function buildAssignmentReason(candidate: CandidateScore | null) {
  if (!candidate) return null;
  const topReasons = candidate.reasons.slice(0, 3).join(", ");
  return `${candidate.name} (${candidate.role}) choisi pour ${topReasons}. Charge active: ${candidate.metrics.activeAssignedCount}, SLA en retard: ${candidate.metrics.overdueAssignedCount}.`;
}

export class TaskAssignmentEngineService {
  static async resolveResponsibility(input: ResponsibilityInput): Promise<TaskResponsibilityResolution> {
    if (input.assigneeId) {
      const fallbackRoles = normalizeFallbackRoles(input.module, input.fallbackRoles);
      const rankedFallback = await scoreCandidates(
        input.tenantId,
        input.module,
        input.entityType,
        input.entityId,
        fallbackRoles,
        input.assigneeId
      );
      const backupCandidate = rankedFallback.find((candidate) => candidate.userId !== input.assigneeId) ?? null;
      const managerCandidate =
        rankedFallback.find(
          (candidate) => candidate.userId !== input.assigneeId && candidate.userId !== backupCandidate?.userId
        ) ??
        backupCandidate ??
        null;

      return {
        primaryOwnerId: input.assigneeId,
        backupOwnerId: backupCandidate?.userId ?? null,
        managerOwnerId: managerCandidate?.userId ?? null,
        escalationAt: input.slaDeadline ?? input.dueDate ?? null,
        escalationLevel: 0,
        assignmentReason: "Assignation explicite preservee.",
        candidates: uniqueByKey(
          [backupCandidate, managerCandidate].filter((value): value is CandidateScore => Boolean(value)),
          (candidate) => candidate.userId
        ),
      };
    }

    const primaryRoles = normalizePrimaryRoles(input.module, input.assigneeRoles);
    const fallbackRoles = normalizeFallbackRoles(input.module, input.fallbackRoles);
    const rankedPrimary = await scoreCandidates(
      input.tenantId,
      input.module,
      input.entityType,
      input.entityId,
      primaryRoles,
      input.preferredAssigneeId
    );

    const primary = rankedPrimary[0] ?? null;
    const backup = rankedPrimary.find((candidate) => candidate.userId !== primary?.userId) ?? null;

    const rankedFallback = await scoreCandidates(
      input.tenantId,
      input.module,
      input.entityType,
      input.entityId,
      fallbackRoles,
      primary?.userId ?? input.preferredAssigneeId
    );

    const manager =
      rankedFallback.find(
        (candidate) => candidate.userId !== primary?.userId && candidate.userId !== backup?.userId
      ) ?? null;

    return {
      primaryOwnerId: primary?.userId ?? manager?.userId ?? null,
      backupOwnerId: backup?.userId ?? manager?.userId ?? null,
      managerOwnerId: manager?.userId ?? primary?.userId ?? null,
      escalationAt: input.slaDeadline ?? input.dueDate ?? null,
      escalationLevel: 0,
      assignmentReason: buildAssignmentReason(primary ?? manager),
      candidates: uniqueByKey([
        ...(primary ? [primary] : []),
        ...(backup ? [backup] : []),
        ...(manager ? [manager] : []),
      ], (candidate) => candidate.userId),
    };
  }
}
