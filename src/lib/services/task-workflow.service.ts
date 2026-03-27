import { Prisma, type NotificationType, type TaskStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";

const WORKFLOW_KEY = "__workflow";
const SYSTEM_ESCALATION_ROLES = ["ADMIN", "DIRECTION", "CEO"] as const;
const TERMINAL_STATUSES: TaskStatus[] = ["COMPLETED", "CANCELLED"];

type CompletionRequirements = {
  requireAllSubtasks: boolean;
  requireAllChecklistItems: boolean;
  requiredFieldKeys: string[];
  requiredAttachmentCount: number;
  requiredComment: boolean;
  requireApprovedDecision: boolean;
};

type CompletionBlockerCode =
  | "SUBTASKS_OPEN"
  | "CHECKLIST_PENDING"
  | "DEPENDENCY_PENDING"
  | "APPROVAL_REQUIRED"
  | "FIELDS_MISSING"
  | "ATTACHMENTS_MISSING"
  | "COMMENT_REQUIRED"
  | "START_BLOCKED";

type CompletionBlocker = {
  code: CompletionBlockerCode;
  message: string;
  severity: "blocking" | "warning";
  relatedTaskId?: string;
};

type ResponsibilitySnapshot = {
  primaryOwner: { id: string; name: string; role: string } | null;
  backupOwner: { id: string; name: string; role: string } | null;
  managerOwner: { id: string; name: string; role: string } | null;
  escalationAt: string | null;
  escalationLevel: number;
  assignmentReason: string | null;
};

type OperationalImpactSummary = {
  downstreamTaskCount: number;
  downstreamBlockedCount: number;
  impactedModules: string[];
  impactedEntities: Array<{ entityType: string; entityId: string }>;
  impactedOrders: Array<{ id: string; orderNumber: string; clientName: string | null; totalClientXAF: number }>;
  impactedClients: string[];
  atRiskRevenueXAF: number;
  nearestDeadline: string | null;
  parentChain: Array<{ id: string; title: string }>;
  summary: string;
};

type WorkflowSnapshot = {
  taskId: string;
  requirements: CompletionRequirements;
  blockers: CompletionBlocker[];
  startBlockers: CompletionBlocker[];
  canComplete: boolean;
  canStart: boolean;
  metrics: {
    openSubtasks: number;
    pendingChecklistItems: number;
    unresolvedDependencies: number;
    attachmentCount: number;
    commentCount: number;
  };
  responsibility: ResponsibilitySnapshot;
  operationalImpact: OperationalImpactSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isTaskClosed(status: string) {
  return TERMINAL_STATUSES.includes(status as TaskStatus);
}

function hasMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function firstNonEmptyDate(task: { dueDate: Date | null; slaDeadline: Date | null }) {
  return task.dueDate ?? task.slaDeadline ?? null;
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

function getWorkflowState(customFields: unknown) {
  const fields = toObject(customFields);
  return toObject(fields[WORKFLOW_KEY]);
}

function getResponsibilityState(customFields: unknown) {
  return toObject(getWorkflowState(customFields).responsibility);
}

function getUserVisibleCustomFields(customFields: unknown) {
  return Object.entries(toObject(customFields)).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (!key.startsWith("__")) acc[key] = value;
    return acc;
  }, {});
}

function mergeWorkflowState(customFields: unknown, patch: Record<string, unknown>) {
  const fields = toObject(customFields);
  const existing = getWorkflowState(customFields);
  return {
    ...fields,
    [WORKFLOW_KEY]: {
      ...existing,
      ...patch,
    },
  };
}

async function hydrateResponsibilityUsers(customFields: unknown): Promise<ResponsibilitySnapshot> {
  const responsibility = getResponsibilityState(customFields);
  const primaryOwnerId = typeof responsibility.primaryOwnerId === "string" ? responsibility.primaryOwnerId : null;
  const backupOwnerId = typeof responsibility.backupOwnerId === "string" ? responsibility.backupOwnerId : null;
  const managerOwnerId = typeof responsibility.managerOwnerId === "string" ? responsibility.managerOwnerId : null;
  const userIds = uniqueByKey(
    [primaryOwnerId, backupOwnerId, managerOwnerId].filter((value): value is string => Boolean(value)),
    (value) => value
  );

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, role: true },
      })
    : [];

  const userMap = new Map(users.map((user) => [user.id, user]));
  const toUser = (userId: string | null) => {
    if (!userId) return null;
    const user = userMap.get(userId);
    return user ? { id: user.id, name: user.name, role: user.role } : null;
  };

  return {
    primaryOwner: toUser(primaryOwnerId),
    backupOwner: toUser(backupOwnerId),
    managerOwner: toUser(managerOwnerId),
    escalationAt: typeof responsibility.escalationAt === "string" ? responsibility.escalationAt : null,
    escalationLevel:
      typeof responsibility.escalationLevel === "number" ? Number(responsibility.escalationLevel) : 0,
    assignmentReason: typeof responsibility.assignmentReason === "string" ? responsibility.assignmentReason : null,
  };
}

async function notifyResponsibilityChain(
  taskId: string,
  tenantId: string,
  title: string,
  message: string,
  type: NotificationType,
  excludeUserId?: string
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { customFields: true },
  });

  if (!task) return;

  const responsibility = getResponsibilityState(task.customFields);
  const userIds = uniqueByKey(
    [responsibility.backupOwnerId, responsibility.managerOwnerId]
      .filter((value): value is string => typeof value === "string")
      .filter((value) => value !== excludeUserId),
    (value) => value
  );

  if (userIds.length === 0) return;

  await NotificationService.notifyMany(userIds, {
    tenantId,
    type,
    title,
    message,
    entityType: "task",
    entityId: taskId,
  });
}

export class TaskWorkflowService {
  private static async loadTask(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: { include: { user: { select: { id: true, name: true, role: true } } } },
        children: {
          select: {
            id: true,
            title: true,
            status: true,
            module: true,
            entityType: true,
            entityId: true,
            priority: true,
            slaDeadline: true,
            dueDate: true,
          },
          orderBy: { position: "asc" },
        },
        checklists: {
          select: { id: true, text: true, checked: true },
          orderBy: { position: "asc" },
        },
        dependencies: {
          include: {
            dependsOn: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                module: true,
                slaDeadline: true,
                dueDate: true,
              },
            },
          },
        },
        approvals: {
          select: { id: true, decision: true, decidedAt: true, userId: true },
          orderBy: { decidedAt: "desc" },
        },
        attachments: {
          select: { id: true },
        },
        comments: {
          select: { id: true },
        },
      },
    });
  }

  private static getCompletionRequirements(task: Awaited<ReturnType<typeof TaskWorkflowService.loadTask>>): CompletionRequirements {
    const workflowState = getWorkflowState(task?.customFields);
    const completionRequirements = toObject(workflowState.completionRequirements);

    return {
      requireAllSubtasks:
        typeof completionRequirements.requireAllSubtasks === "boolean"
          ? Boolean(completionRequirements.requireAllSubtasks)
          : (task?.children.length ?? 0) > 0,
      requireAllChecklistItems:
        typeof completionRequirements.requireAllChecklistItems === "boolean"
          ? Boolean(completionRequirements.requireAllChecklistItems)
          : (task?.checklists.length ?? 0) > 0,
      requiredFieldKeys: Array.isArray(completionRequirements.requiredFieldKeys)
        ? completionRequirements.requiredFieldKeys.map((item) => String(item))
        : [],
      requiredAttachmentCount:
        typeof completionRequirements.requiredAttachmentCount === "number"
          ? Number(completionRequirements.requiredAttachmentCount)
          : 0,
      requiredComment:
        typeof completionRequirements.requiredComment === "boolean"
          ? Boolean(completionRequirements.requiredComment)
          : false,
      requireApprovedDecision:
        typeof completionRequirements.requireApprovedDecision === "boolean"
          ? Boolean(completionRequirements.requireApprovedDecision)
          : Boolean(task?.requiredApproval),
    };
  }

  private static evaluateTask(
    task: NonNullable<Awaited<ReturnType<typeof TaskWorkflowService.loadTask>>>,
    options?: { ignoreApproval?: boolean }
  ) {
    const requirements = this.getCompletionRequirements(task);
    const blockers: CompletionBlocker[] = [];
    const startBlockers: CompletionBlocker[] = [];

    const openSubtasks = task.children.filter((child) => !isTaskClosed(child.status));
    if (requirements.requireAllSubtasks && openSubtasks.length > 0) {
      blockers.push({
        code: "SUBTASKS_OPEN",
        severity: "blocking",
        message: `${openSubtasks.length} sous-tache(s) restent ouvertes.`,
      });
    }

    const pendingChecklistItems = task.checklists.filter((item) => !item.checked);
    if (requirements.requireAllChecklistItems && pendingChecklistItems.length > 0) {
      blockers.push({
        code: "CHECKLIST_PENDING",
        severity: "blocking",
        message: `${pendingChecklistItems.length} element(s) de checklist ne sont pas coches.`,
      });
    }

    const unresolvedDependencies = task.dependencies.filter(
      (dependency) => dependency.type !== "RELATED" && !isTaskClosed(dependency.dependsOn.status)
    );
    if (unresolvedDependencies.length > 0) {
      blockers.push({
        code: "DEPENDENCY_PENDING",
        severity: "blocking",
        message: `${unresolvedDependencies.length} dependance(s) ne sont pas encore resolues.`,
        relatedTaskId: unresolvedDependencies[0]?.dependsOnId,
      });
    }

    const startBlockingDependencies = unresolvedDependencies.filter((dependency) => dependency.type === "BLOCKS");
    if (startBlockingDependencies.length > 0) {
      startBlockers.push({
        code: "START_BLOCKED",
        severity: "blocking",
        message: `Demarrage bloque par ${startBlockingDependencies.length} dependance(s) non terminee(s).`,
        relatedTaskId: startBlockingDependencies[0]?.dependsOnId,
      });
    }

    const customFields = getUserVisibleCustomFields(task.customFields);
    const missingFields = requirements.requiredFieldKeys.filter((key) => !hasMeaningfulValue(customFields[key]));
    if (missingFields.length > 0) {
      blockers.push({
        code: "FIELDS_MISSING",
        severity: "blocking",
        message: `Champs requis manquants: ${missingFields.join(", ")}.`,
      });
    }

    if (requirements.requiredAttachmentCount > task.attachments.length) {
      blockers.push({
        code: "ATTACHMENTS_MISSING",
        severity: "blocking",
        message: `Au moins ${requirements.requiredAttachmentCount} piece(s) jointe(s) sont requises.`,
      });
    }

    if (requirements.requiredComment && task.comments.length === 0) {
      blockers.push({
        code: "COMMENT_REQUIRED",
        severity: "blocking",
        message: "Un commentaire de cloture est requis avant de terminer cette tache.",
      });
    }

    const latestApproval = task.approvals[0]?.decision;
    if (!options?.ignoreApproval && requirements.requireApprovedDecision && latestApproval !== "APPROVED") {
      blockers.push({
        code: "APPROVAL_REQUIRED",
        severity: "blocking",
        message: "Cette tache requiert une approbation avant cloture.",
      });
    }

    return {
      requirements,
      blockers,
      startBlockers,
      canComplete: blockers.length === 0,
      canStart: startBlockers.length === 0,
      metrics: {
        openSubtasks: openSubtasks.length,
        pendingChecklistItems: pendingChecklistItems.length,
        unresolvedDependencies: unresolvedDependencies.length,
        attachmentCount: task.attachments.length,
        commentCount: task.comments.length,
      },
    };
  }

  static async computeOperationalImpact(taskId: string): Promise<OperationalImpactSummary> {
    const rootTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        parentTaskId: true,
      },
    });

    if (!rootTask) {
      return {
        downstreamTaskCount: 0,
        downstreamBlockedCount: 0,
        impactedModules: [],
        impactedEntities: [],
        impactedOrders: [],
        impactedClients: [],
        atRiskRevenueXAF: 0,
        nearestDeadline: null,
        parentChain: [],
        summary: "Aucun impact operationnel detecte.",
      };
    }

    const impactedTasks: Array<{
      id: string;
      title: string;
      status: string;
      module: string;
      entityType: string;
      entityId: string;
      slaDeadline: Date | null;
      dueDate: Date | null;
      order: {
        id: string;
        orderNumber: string;
        totalClient: Prisma.Decimal | null;
        contact: { name: string | null } | null;
      } | null;
    }> = [];

    const visited = new Set<string>();
    let frontier = [taskId];

    while (frontier.length > 0) {
      const batch = await prisma.taskDependency.findMany({
        where: {
          dependsOnId: { in: frontier },
          type: { in: ["BLOCKS", "REQUIRES"] },
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              module: true,
              entityType: true,
              entityId: true,
              slaDeadline: true,
              dueDate: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  totalClient: true,
                  contact: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      frontier = [];
      for (const dependency of batch) {
        const dependent = dependency.task;
        if (!dependent || visited.has(dependent.id) || isTaskClosed(dependent.status)) continue;
        visited.add(dependent.id);
        impactedTasks.push(dependent);
        frontier.push(dependent.id);
      }
    }

    const parentChain: Array<{ id: string; title: string }> = [];
    let currentParentId = rootTask.parentTaskId;
    while (currentParentId) {
      const parent = await prisma.task.findUnique({
        where: { id: currentParentId },
        select: { id: true, title: true, parentTaskId: true },
      });
      if (!parent) break;
      parentChain.push({ id: parent.id, title: parent.title });
      currentParentId = parent.parentTaskId;
    }

    const impactedModules = [...new Set(impactedTasks.map((task) => task.module))];
    const impactedEntities = uniqueByKey(
      impactedTasks.map((task) => ({ entityType: task.entityType, entityId: task.entityId })),
      (item) => `${item.entityType}:${item.entityId}`
    );
    const impactedOrders = uniqueByKey(
      impactedTasks
        .map((task) => task.order)
        .filter(
          (
            order
          ): order is {
            id: string;
            orderNumber: string;
            totalClient: Prisma.Decimal | null;
            contact: { name: string | null } | null;
          } => Boolean(order)
        )
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          clientName: order.contact?.name ?? null,
          totalClientXAF: Number(order.totalClient || 0),
        })),
      (order) => order.id
    );
    const impactedClients = uniqueByKey(
      impactedOrders.map((order) => order.clientName).filter((name): name is string => Boolean(name)),
      (name) => name
    );
    const atRiskRevenueXAF = impactedOrders.reduce((sum, order) => sum + order.totalClientXAF, 0);
    const nearestDeadline = impactedTasks
      .map((task) => firstNonEmptyDate(task))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    let summary = "Aucun impact operationnel detecte.";
    if (impactedTasks.length > 0 || parentChain.length > 0) {
      const parts = [
        impactedTasks.length > 0 ? `${impactedTasks.length} tache(s) aval peuvent etre ralenties` : null,
        impactedOrders.length > 0 ? `${impactedOrders.length} commande(s) exposee(s)` : null,
        atRiskRevenueXAF > 0 ? `${Math.round(atRiskRevenueXAF).toLocaleString("fr-FR")} XAF a risque` : null,
        impactedModules.length > 0 ? `modules touches: ${impactedModules.join(", ")}` : null,
        parentChain.length > 0 ? `${parentChain.length} tache(s) parent peuvent etre bloquees` : null,
        nearestDeadline ? `prochaine echeance impactee: ${nearestDeadline.toLocaleString("fr-FR")}` : null,
      ].filter(Boolean);
      summary = parts.join(" - ");
    }

    return {
      downstreamTaskCount: impactedTasks.length,
      downstreamBlockedCount: impactedTasks.filter((task) => task.status === "BLOCKED").length,
      impactedModules,
      impactedEntities,
      impactedOrders,
      impactedClients,
      atRiskRevenueXAF,
      nearestDeadline: nearestDeadline?.toISOString() ?? null,
      parentChain,
      summary,
    };
  }

  static async getTaskWorkflowSnapshot(taskId: string): Promise<WorkflowSnapshot> {
    const task = await this.loadTask(taskId);
    if (!task) {
      throw new Error("Tache introuvable");
    }

    const [operationalImpact, responsibility] = await Promise.all([
      this.computeOperationalImpact(taskId),
      hydrateResponsibilityUsers(task.customFields),
    ]);
    const evaluation = this.evaluateTask(task);

    return {
      taskId,
      requirements: evaluation.requirements,
      blockers: evaluation.blockers,
      startBlockers: evaluation.startBlockers,
      canComplete: evaluation.canComplete,
      canStart: evaluation.canStart,
      metrics: evaluation.metrics,
      responsibility,
      operationalImpact,
    };
  }

  private static async persistWorkflowMetadata(taskId: string, patch: Record<string, unknown>) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { customFields: true },
    });

    if (!task) return;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        customFields: mergeWorkflowState(task.customFields, patch) as Prisma.InputJsonValue,
      },
    });
  }

  static async startTask(taskId: string) {
    const snapshot = await this.getTaskWorkflowSnapshot(taskId);
    if (!snapshot.canStart) {
      throw new Error(snapshot.startBlockers.map((blocker) => blocker.message).join(" "));
    }

    return prisma.task.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        blockedBy: null,
      },
    });
  }

  static async submitForApproval(taskId: string, tenantId: string, title: string) {
    const task = await this.loadTask(taskId);
    if (!task) throw new Error("Tache introuvable");

    const evaluation = this.evaluateTask(task, { ignoreApproval: true });
    const nonApprovalBlockers = evaluation.blockers.filter((blocker) => blocker.code !== "APPROVAL_REQUIRED");
    if (nonApprovalBlockers.length > 0) {
      throw new Error(nonApprovalBlockers.map((blocker) => blocker.message).join(" "));
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { status: "WAITING_APPROVAL", blockedBy: null },
    });

    if (task.requiredApproval) {
      await NotificationService.onApprovalRequired(taskId, tenantId, title);
    }

    return updated;
  }

  static async completeTask(taskId: string, options: { completedByUserId?: string; skipApproval?: boolean } = {}) {
    const task = await this.loadTask(taskId);
    if (!task) throw new Error("Tache introuvable");

    const evaluation = this.evaluateTask(task, { ignoreApproval: options.skipApproval });
    if (!evaluation.canComplete) {
      throw new Error(evaluation.blockers.map((blocker) => blocker.message).join(" "));
    }

    const operationalImpact = await this.computeOperationalImpact(taskId);
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        blockedBy: null,
        customFields: mergeWorkflowState(task.customFields, {
          completionRequirements: evaluation.requirements,
          operationalImpact,
          completionSnapshot: {
            completedAt: new Date().toISOString(),
            completedByUserId: options.completedByUserId ?? null,
            metrics: evaluation.metrics,
          },
        }) as Prisma.InputJsonValue,
      },
    });

    await TaskDependencyService.resolveCompletedTask(taskId);
    await NotificationService.onTaskCompleted(taskId, task.tenantId, task.title, options.completedByUserId);

    return { task: updated, snapshot: { ...evaluation, operationalImpact } };
  }

  static async blockTask(
    taskId: string,
    params: { reason: string; blockedByUserId?: string; notifyType?: NotificationType }
  ) {
    const task = await this.loadTask(taskId);
    if (!task) throw new Error("Tache introuvable");

    const operationalImpact = await this.computeOperationalImpact(taskId);
    const reason = params.reason.trim() || "Bloquee manuellement";
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "BLOCKED",
        blockedBy: reason,
        customFields: mergeWorkflowState(task.customFields, {
          operationalImpact,
          responsibility: {
            ...getResponsibilityState(task.customFields),
            escalationLevel: 1,
          },
          lastBlockedReason: reason,
          lastBlockedAt: new Date().toISOString(),
          lastBlockedByUserId: params.blockedByUserId ?? null,
        }) as Prisma.InputJsonValue,
      },
    });

    const message = `${reason}. ${operationalImpact.summary}`;
    await NotificationService.notifyTaskAssignees(
      taskId,
      {
        tenantId: task.tenantId,
        type: params.notifyType ?? "TASK_BLOCKED",
        title: `Tache bloquee: ${task.title}`,
        message,
      },
      params.blockedByUserId
    );

    await NotificationService.notifyTaskWatchers(
      taskId,
      {
        tenantId: task.tenantId,
        type: params.notifyType ?? "TASK_BLOCKED",
        title: `Tache bloquee: ${task.title}`,
        message,
      },
      params.blockedByUserId
    );

    await notifyResponsibilityChain(
      taskId,
      task.tenantId,
      `Responsabilite engagee: ${task.title}`,
      message,
      params.notifyType ?? "TASK_BLOCKED",
      params.blockedByUserId
    );

    if (operationalImpact.downstreamTaskCount > 0 || ["HIGH", "CRITICAL"].includes(task.riskLevel)) {
      const escalators = await prisma.user.findMany({
        where: {
          tenantId: task.tenantId,
          isActive: true,
          role: { in: [...SYSTEM_ESCALATION_ROLES] },
        },
        select: { id: true },
      });

      const userIds = escalators.map((user) => user.id);
      if (userIds.length > 0) {
        await NotificationService.notifyMany(userIds, {
          tenantId: task.tenantId,
          type: "TASK_BLOCKED",
          title: `Escalade operationnelle: ${task.title}`,
          message: operationalImpact.summary,
          entityType: "task",
          entityId: taskId,
        });
      }
    }

    return { task: updated, operationalImpact };
  }

  static async refreshOperationalImpact(taskId: string) {
    const operationalImpact = await this.computeOperationalImpact(taskId);
    await this.persistWorkflowMetadata(taskId, { operationalImpact });
    return operationalImpact;
  }

  static async checkSLABreachesWithConsequences(tenantId: string) {
    const now = new Date();
    const newlyBreached = await prisma.task.findMany({
      where: {
        tenantId,
        slaBreach: false,
        slaDeadline: { lt: now },
        status: { notIn: TERMINAL_STATUSES },
      },
      select: {
        id: true,
        title: true,
        tenantId: true,
        riskLevel: true,
        customFields: true,
      },
    });

    for (const task of newlyBreached) {
      const operationalImpact = await this.computeOperationalImpact(task.id);
      await prisma.task.update({
        where: { id: task.id },
        data: {
          slaBreach: true,
          customFields: mergeWorkflowState(task.customFields, {
            operationalImpact,
            responsibility: {
              ...getResponsibilityState(task.customFields),
              escalationLevel: 2,
            },
            lastSlaBreachAt: new Date().toISOString(),
          }) as Prisma.InputJsonValue,
        },
      });

      await NotificationService.onSLABreach(task.id, tenantId, task.title);
      await notifyResponsibilityChain(
        task.id,
        tenantId,
        `Escalade SLA: ${task.title}`,
        operationalImpact.summary,
        "SLA_BREACH"
      );

      if (operationalImpact.downstreamTaskCount > 0 || ["HIGH", "CRITICAL"].includes(task.riskLevel)) {
        const escalators = await prisma.user.findMany({
          where: {
            tenantId,
            isActive: true,
            role: { in: [...SYSTEM_ESCALATION_ROLES] },
          },
          select: { id: true },
        });

        await NotificationService.notifyMany(
          escalators.map((user) => user.id),
          {
            tenantId,
            type: "SLA_BREACH",
            title: `Escalade SLA: ${task.title}`,
            message: operationalImpact.summary,
            entityType: "task",
            entityId: task.id,
          }
        );
      }
    }

    return newlyBreached.length;
  }
}
