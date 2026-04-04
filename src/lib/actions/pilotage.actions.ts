"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { getTenantCacheTags } from "@/lib/server-cache";
import { TaskIntelligenceService } from "@/lib/services/task-intelligence.service";
import { NotificationService } from "@/lib/services/notification.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { PilotageSnapshotService } from "@/lib/services/pilotage-snapshot.service";
import { RiskCommandService } from "@/lib/services/risk-command.service";
import { StrategicDecisionService } from "@/lib/services/strategic-decision.service";
import type {
  Priority,
  RiskLevel,
  StrategicDecisionStatus,
  StrategicDecisionPriority,
  StrategicDecisionHorizon,
  StrategicRiskStatus,
} from "@prisma/client";

const ALLOWED_TASK_MODULES = [
  "orders",
  "crm",
  "sourcing",
  "logistics",
  "qc",
  "finance",
  "marketing",
  "whatsapp",
  "catalog",
];

type ExecutionPlan = {
  project?: {
    name: string;
    description?: string;
    color?: string;
    budgetTotal?: number;
    budgetCurrency?: string;
  };
  tasks?: Array<{
    title: string;
    description?: string;
    module?: string;
    priority?: string;
    slaHours?: number;
  }>;
};

type ActivationRule = {
  metric: string;
  operator: "LT" | "LTE" | "GT" | "GTE";
  value: number;
  severity?: "red" | "orange";
  note?: string;
};

const normalizeModule = (value?: string | null) => {
  const lower = (value || "orders").toLowerCase().trim();
  if (ALLOWED_TASK_MODULES.includes(lower)) return lower;
  return "orders";
};

const mapPriority = (value?: string): Priority => {
  const v = (value || "NORMAL").toUpperCase();
  if (v === "LOW" || v === "NORMAL" || v === "HIGH" || v === "URGENT") return v as Priority;
  return "NORMAL";
};

const mapDecisionPriorityToTask = (value: StrategicDecisionPriority): Priority => {
  if (value === "CRITICAL") return "URGENT";
  if (value === "HIGH") return "HIGH";
  if (value === "LOW") return "LOW";
  return "NORMAL";
};

const PILOTAGE_CACHE_NAMESPACES = [
  "pilotage-intelligence",
  "pilotage-forecast",
  "pilotage-risk-dashboard",
];

function revalidatePilotageCaches(tenantId: string) {
  for (const namespace of PILOTAGE_CACHE_NAMESPACES) {
    for (const tag of getTenantCacheTags(namespace, tenantId)) {
      revalidateTag(tag, "max");
    }
  }
}

function mapRiskLevelToTaskPriority(value?: RiskLevel | null): Priority {
  if (value === "CRITICAL") return "URGENT";
  if (value === "HIGH") return "HIGH";
  if (value === "LOW") return "LOW";
  return "NORMAL";
}

function mapRiskLevelToSlaHours(value?: RiskLevel | null) {
  if (value === "CRITICAL") return 6;
  if (value === "HIGH") return 12;
  if (value === "MEDIUM") return 24;
  return 48;
}

function taskPriorityScore(value: Priority) {
  if (value === "URGENT") return 40;
  if (value === "HIGH") return 25;
  if (value === "NORMAL") return 10;
  return 0;
}

export async function getStrategicDecisions() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.view");

    const decisions = await prisma.strategicDecision.findMany({
      where: { tenantId: user.tenantId },
      include: {
        owner: { select: { id: true, name: true } },
        actions: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: decisions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur decisions" };
  }
}

export async function createStrategicDecision(data: {
  title: string;
  description?: string;
  objective?: string;
  targetMetric?: string;
  targetValue?: number;
  targetUnit?: string;
  riskLevel?: RiskLevel;
  priority?: StrategicDecisionPriority;
  status?: StrategicDecisionStatus;
  horizon?: StrategicDecisionHorizon;
  impactAreas?: string[];
  executionPlan?: ExecutionPlan;
  executionTemplateId?: string | null;
  activationRules?: ActivationRule[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    if (!data.title?.trim()) return { error: "Titre requis" };

    const decision = await prisma.strategicDecision.create({
      data: {
        tenantId: user.tenantId,
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        objective: data.objective?.trim() || undefined,
        targetMetric: data.targetMetric?.trim() || undefined,
        targetValue: data.targetValue ?? undefined,
        targetUnit: data.targetUnit?.trim() || undefined,
        riskLevel: data.riskLevel || undefined,
        priority: data.priority || "MEDIUM",
        status: data.status || "DRAFT",
        horizon: data.horizon || "QUARTER",
        impactAreas: data.impactAreas ?? [],
        executionPlan: data.executionPlan ?? {},
        activationRules: data.activationRules ?? [],
        ...(data.executionTemplateId ? { executionTemplateId: data.executionTemplateId } : {}),
        ownerId: user.id,
      },
    });

    revalidatePath("/pilotage/decisions");
    revalidatePath("/dashboard");
    revalidatePilotageCaches(user.tenantId);
    return { data: decision };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur creation decision" };
  }
}

export async function updateStrategicDecision(
  decisionId: string,
      updates: Partial<{
        title: string;
        description: string;
        objective: string;
        targetMetric: string;
        targetValue: number;
        targetUnit: string;
        riskLevel: RiskLevel;
      priority: StrategicDecisionPriority;
      status: StrategicDecisionStatus;
      horizon: StrategicDecisionHorizon;
      impactAreas: string[];
      executionPlan: ExecutionPlan;
      executionTemplateId: string | null;
      activationRules: ActivationRule[];
    }>
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const decision = await prisma.strategicDecision.findFirst({
      where: { id: decisionId, tenantId: user.tenantId },
    });
    if (!decision) return { error: "Decision introuvable" };

    const updated = await prisma.strategicDecision.update({
      where: { id: decisionId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
        ...(updates.description !== undefined ? { description: updates.description?.trim() || null } : {}),
        ...(updates.objective !== undefined ? { objective: updates.objective?.trim() || null } : {}),
        ...(updates.targetMetric !== undefined ? { targetMetric: updates.targetMetric?.trim() || null } : {}),
        ...(updates.targetValue !== undefined ? { targetValue: updates.targetValue ?? null } : {}),
        ...(updates.targetUnit !== undefined ? { targetUnit: updates.targetUnit?.trim() || null } : {}),
        ...(updates.riskLevel ? { riskLevel: updates.riskLevel } : {}),
        ...(updates.priority ? { priority: updates.priority } : {}),
        ...(updates.status ? { status: updates.status } : {}),
        ...(updates.horizon ? { horizon: updates.horizon } : {}),
        ...(updates.impactAreas ? { impactAreas: updates.impactAreas } : {}),
        ...(updates.executionPlan ? { executionPlan: updates.executionPlan } : {}),
        ...(updates.executionTemplateId !== undefined ? { executionTemplateId: updates.executionTemplateId } : {}),
        ...(updates.activationRules ? { activationRules: updates.activationRules } : {}),
      },
    });

    revalidatePath("/pilotage/decisions");
    revalidatePilotageCaches(user.tenantId);
    return { data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur mise a jour decision" };
  }
}

export async function executeStrategicDecision(decisionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const decision = await prisma.strategicDecision.findFirst({
      where: { id: decisionId, tenantId: user.tenantId },
    });
    if (!decision) return { error: "Decision introuvable" };

    if (decision.status === "CANCELLED" || decision.status === "COMPLETED") {
      return { error: "Decision deja terminee" };
    }
    if (decision.status === "EXECUTING") {
      return { error: "Decision deja en cours d'execution" };
    }
    if (decision.executedAt) {
      return { error: "Decision deja lancee" };
    }

    let executionPlan = (decision.executionPlan as ExecutionPlan) || {};

    if ((!executionPlan.tasks || executionPlan.tasks.length === 0) && decision.executionTemplateId) {
      const template = await prisma.decisionExecutionTemplate.findFirst({
        where: { id: decision.executionTemplateId, tenantId: decision.tenantId, isActive: true },
      });
      if (template) {
        executionPlan = {
          project: template.projectName
            ? { name: template.projectName, description: template.projectDescription || undefined }
            : undefined,
          tasks: Array.isArray(template.tasks) ? (template.tasks as ExecutionPlan["tasks"]) : [],
        };
      }
    }

    const tasksPlan = executionPlan.tasks ?? [];

    const projectPayload = executionPlan.project?.name
      ? {
          name: executionPlan.project.name,
          description: executionPlan.project.description,
          color: executionPlan.project.color || "#0f766e",
          budgetTotal: executionPlan.project.budgetTotal ?? undefined,
          budgetCurrency: executionPlan.project.budgetCurrency || "XAF",
        }
      : null;

    const executionStart = new Date();

    const initialExecution = await prisma.$transaction(async (tx) => {
      await tx.strategicDecision.update({
        where: { id: decisionId },
        data: { status: "EXECUTING", executedAt: executionStart },
      });

      let projectId: string | null = null;
      if (projectPayload) {
        const project = await tx.project.create({
          data: {
            tenantId: decision.tenantId,
            name: projectPayload.name,
            description: projectPayload.description || undefined,
            ownerId: decision.ownerId || user.id,
            color: projectPayload.color,
            budgetTotal: projectPayload.budgetTotal || undefined,
            budgetCurrency: projectPayload.budgetCurrency || "XAF",
            members: {
              create: { userId: decision.ownerId || user.id, role: "OWNER" },
            },
          },
        });
        projectId = project.id;
        await tx.decisionAction.create({
          data: {
            decisionId,
            type: "CREATE_PROJECT",
            status: "EXECUTED",
            payload: { projectId },
            executedAt: executionStart,
          },
        });
      }

      return { projectId };
    });

    const taskIds: string[] = [];
    try {
      for (const task of tasksPlan) {
        if (!task?.title?.trim()) continue;

        const created = await OperationalTaskService.create({
          tenantId: decision.tenantId,
          entityType: "pilotage",
          entityId: decisionId,
          taskType: "strategic",
          title: task.title.trim(),
          description: task.description?.trim() || undefined,
          module: normalizeModule(task.module),
          priority: task.priority
            ? mapPriority(task.priority)
            : mapDecisionPriorityToTask(decision.priority),
          ownerType: "HUMAN",
          riskLevel: decision.riskLevel || "LOW",
          tags: ["pilotage", "decision"],
          projectId: initialExecution.projectId || undefined,
          assigneeId: decision.ownerId || undefined,
          preferredAssigneeId: decision.ownerId || undefined,
          slaHours: task.slaHours,
          watcherRoles: ["DIRECTION"],
          assignedByName: "Decision Engine Horion",
          customFields: {
            strategicDecisionId: decisionId,
            impactAreas: decision.impactAreas,
            objective: decision.objective,
            targetMetric: decision.targetMetric,
            targetValue: decision.targetValue,
          },
        });

        taskIds.push(created.taskId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur creation taches";

      await prisma.$transaction(async (tx) => {
        await tx.decisionAction.create({
          data: {
            decisionId,
            type: "CREATE_TASKS",
            status: "FAILED",
            payload: { taskIds, attemptedTasks: tasksPlan.length },
            error: message,
          },
        });

        await tx.strategicDecision.update({
          where: { id: decisionId },
          data: { status: "ACTIVE" },
        });
      });

      return { error: message };
    }

    const result = await prisma.$transaction(async (tx) => {
      if (taskIds.length > 0) {
        await tx.decisionAction.create({
          data: {
            decisionId,
            type: "CREATE_TASKS",
            status: "EXECUTED",
            payload: { taskIds },
            executedAt: new Date(),
          },
        });
      }

      await tx.strategicDecision.update({
        where: { id: decisionId },
        data: { status: "ACTIVE" },
      });

      return { projectId: initialExecution.projectId, taskIds };
    });

    revalidatePath("/pilotage/decisions");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/tasks");
    revalidatePilotageCaches(user.tenantId);

    return { data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur execution" };
  }
}

export async function getDecisionTemplates() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.view");

    const templates = await prisma.decisionExecutionTemplate.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return { data: templates };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur templates" };
  }
}

export async function createDecisionTemplate(data: {
  name: string;
  description?: string;
  impactAreas?: string[];
  defaultPriority?: StrategicDecisionPriority;
  defaultHorizon?: StrategicDecisionHorizon;
  projectName?: string;
  projectDescription?: string;
  tasks?: ExecutionPlan["tasks"];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    if (!data.name?.trim()) return { error: "Nom requis" };

    const template = await prisma.decisionExecutionTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        impactAreas: data.impactAreas ?? [],
        defaultPriority: data.defaultPriority || "MEDIUM",
        defaultHorizon: data.defaultHorizon || "QUARTER",
        projectName: data.projectName?.trim() || undefined,
        projectDescription: data.projectDescription?.trim() || undefined,
        tasks: data.tasks ?? [],
      },
    });

    revalidatePath("/pilotage/decisions");
    return { data: template };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur creation template" };
  }
}

export async function deleteDecisionTemplate(templateId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    await prisma.decisionExecutionTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    revalidatePath("/pilotage/decisions");
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur suppression template" };
  }
}

export async function getResourceCommandData() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.view");

    const [teamWorkload, moduleBreakdown, priorities] = await Promise.all([
      TaskIntelligenceService.getTeamWorkload(user.tenantId),
      TaskIntelligenceService.getModuleBreakdown(user.tenantId),
      TaskIntelligenceService.getPriorityDistribution(user.tenantId),
    ]);

    return { data: { teamWorkload, moduleBreakdown, priorities } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur resource command" };
  }
}

export async function redeployTasks(params: {
  fromUserId: string;
  toUserId: string;
  limit?: number;
  module?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const limit = Math.max(1, Math.min(50, params.limit ?? 5));
    if (!params.fromUserId || !params.toUserId) return { error: "Parametres invalides" };
    if (params.fromUserId === params.toUserId) return { error: "Meme utilisateur" };

    const [targetContext, candidateTasks] = await Promise.all([
      prisma.task.findMany({
        where: {
          tenantId: user.tenantId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          assignments: { some: { userId: params.toUserId } },
        },
        select: { entityType: true, entityId: true, module: true },
      }),
      prisma.task.findMany({
        where: {
          tenantId: user.tenantId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          assignments: { some: { userId: params.fromUserId } },
          ...(params.module ? { module: params.module } : {}),
        },
        select: {
          id: true,
          title: true,
          module: true,
          priority: true,
          slaBreach: true,
          slaDeadline: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

    const targetEntityKeys = new Set(
      targetContext.map((task) => `${task.entityType}:${task.entityId}`)
    );
    const targetModules = new Map<string, number>();
    for (const task of targetContext) {
      targetModules.set(task.module, (targetModules.get(task.module) || 0) + 1);
    }

    const tasks = candidateTasks
      .map((task) => {
        const sameEntity = targetEntityKeys.has(`${task.entityType}:${task.entityId}`);
        const sameModuleLoad = targetModules.get(task.module) || 0;
        const ageHours = Math.max(
          0,
          (Date.now() - new Date(task.createdAt).getTime()) / 3_600_000
        );

        const score =
          taskPriorityScore(task.priority) +
          (task.slaBreach ? 30 : 0) +
          (sameEntity ? 25 : 0) +
          (sameModuleLoad > 0 ? 12 : 0) +
          (ageHours > 24 ? 6 : 0) -
          (sameEntity ? 0 : task.entityType === "order" ? 8 : 0);

        return { ...task, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.slaDeadline && b.slaDeadline) {
          return a.slaDeadline.getTime() - b.slaDeadline.getTime();
        }
        if (a.slaDeadline) return -1;
        if (b.slaDeadline) return 1;
        return 0;
      })
      .slice(0, limit)
      .map(({ score: _score, ...task }) => task);

    if (tasks.length === 0) return { error: "Aucune tache a reassigner" };

    await prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        await tx.taskAssignment.deleteMany({
          where: { taskId: task.id, userId: params.fromUserId },
        });
        await tx.taskAssignment.upsert({
          where: { taskId_userId: { taskId: task.id, userId: params.toUserId } },
          update: {},
          create: { taskId: task.id, userId: params.toUserId, role: "assignee" },
        });

        await tx.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: "task.reassign",
            entityType: "task",
            entityId: task.id,
            oldValue: { fromUserId: params.fromUserId },
            newValue: { toUserId: params.toUserId },
          },
        });
      }
    });

    const fromUser = await prisma.user.findUnique({
      where: { id: params.fromUserId },
      select: { name: true },
    });
    const toUser = await prisma.user.findUnique({
      where: { id: params.toUserId },
      select: { name: true },
    });

    await Promise.all(
      tasks.map((task) =>
        NotificationService.notify({
          tenantId: user.tenantId,
          userId: params.toUserId,
          type: "TASK_ASSIGNED",
          title: `Tache reassignee: ${task.title}`,
          message: `Transferee depuis ${fromUser?.name || "inconnu"} par ${user.name}`,
          entityType: "task",
          entityId: task.id,
        })
      )
    );

    revalidatePath("/pilotage/resources");
    revalidatePath("/tasks");

    return {
      data: {
        reassigned: tasks.length,
        tasks,
        fromUser: fromUser?.name || null,
        toUser: toUser?.name || null,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur reallocation" };
  }
}

export async function getStrategicIntelligence() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.view");

    const snapshot = await PilotageSnapshotService.getStrategicIntelligence(user.tenantId);
    return { data: snapshot };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur intelligence" };
  }
}

export async function getRiskCommandData() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.view");

    const data = await PilotageSnapshotService.getRiskDashboard(user.tenantId);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur risk command" };
  }
}

export async function syncRiskRegistry() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const data = await RiskCommandService.syncRegistry(user.tenantId);
    revalidatePath("/pilotage/risk");
    revalidatePath("/pilotage/intelligence");
    revalidatePilotageCaches(user.tenantId);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur synchronisation risques" };
  }
}

export async function updateStrategicRisk(
  riskId: string,
  updates: { ownerId?: string | null; status?: StrategicRiskStatus }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const risk = await prisma.strategicRisk.findFirst({
      where: { id: riskId, tenantId: user.tenantId },
      include: { owner: { select: { id: true, name: true } } },
    });
    if (!risk) return { error: "Risque introuvable" };

    await prisma.strategicRisk.update({
      where: { id: riskId },
      data: {
        ...(updates.ownerId !== undefined ? { ownerId: updates.ownerId || null } : {}),
        ...(updates.status ? { status: updates.status } : {}),
        ...(updates.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        ...(updates.status && updates.status !== "RESOLVED" ? { resolvedAt: null } : {}),
      },
    });

    if (updates.ownerId !== undefined && updates.ownerId !== risk.ownerId) {
      const nextOwner = updates.ownerId
        ? await prisma.user.findUnique({ where: { id: updates.ownerId }, select: { id: true, name: true } })
        : null;

      await prisma.riskMitigationEntry.create({
        data: {
          riskId,
          type: "OWNER_CHANGED",
          title: "Risk owner updated",
          detail: `${risk.owner?.name || "Unassigned"} -> ${nextOwner?.name || "Unassigned"}`,
          createdById: user.id,
        },
      });

      if (updates.ownerId) {
        await NotificationService.notify({
          tenantId: user.tenantId,
          userId: updates.ownerId,
          type: "APPROVAL_REQUIRED",
          title: `Risk assigned: ${risk.title}`,
          message: "You are now the owner of a strategic risk.",
          entityType: "strategicRisk",
          entityId: riskId,
        });
      }
    }

    if (updates.status && updates.status !== risk.status) {
      await prisma.riskMitigationEntry.create({
        data: {
          riskId,
          type: updates.status === "RESOLVED" ? "RESOLVED" : "NOTE",
          title: `Risk status -> ${updates.status}`,
          detail: `Updated by ${user.name}`,
          createdById: user.id,
        },
      });
    }

    revalidatePath("/pilotage/risk");
    revalidatePilotageCaches(user.tenantId);
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur mise a jour risque" };
  }
}

export async function addRiskMitigationEntry(data: {
  riskId: string;
  title: string;
  detail?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const risk = await prisma.strategicRisk.findFirst({
      where: { id: data.riskId, tenantId: user.tenantId },
      select: { id: true, status: true },
    });
    if (!risk) return { error: "Risque introuvable" };
    if (!data.title?.trim()) return { error: "Titre requis" };

    await prisma.$transaction(async (tx) => {
      await tx.riskMitigationEntry.create({
        data: {
          riskId: data.riskId,
          type: "MITIGATION",
          title: data.title.trim(),
          detail: data.detail?.trim() || undefined,
          createdById: user.id,
        },
      });

      if (risk.status === "OPEN") {
        await tx.strategicRisk.update({
          where: { id: data.riskId },
          data: { status: "MITIGATING" },
        });
      }
    });

    revalidatePath("/pilotage/risk");
    revalidatePilotageCaches(user.tenantId);
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur plan mitigation" };
  }
}

export async function escalateStrategicRisk(riskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");

    const risk = await prisma.strategicRisk.findFirst({
      where: { id: riskId, tenantId: user.tenantId },
      include: { owner: { select: { id: true, name: true } } },
    });
    if (!risk) return { error: "Risque introuvable" };

    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId: user.tenantId,
        entityType: "strategicRisk",
        entityId: riskId,
        taskType: "risk_mitigation",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true },
    });

    const taskId =
      existingTask?.id ||
      (
        await OperationalTaskService.create({
          tenantId: user.tenantId,
          entityType: "strategicRisk",
          entityId: riskId,
          taskType: "risk_mitigation",
          title: `Mitiger le risque : ${risk.title}`,
          description: `${risk.description || ""}\n\nPlan de mitigation : ${JSON.stringify(risk.mitigationPlan)}`,
          module: RiskCommandService.moduleForCategory(risk.category),
          priority: mapRiskLevelToTaskPriority(risk.severity),
          ownerType: "HUMAN",
          riskLevel: risk.severity,
          requiredApproval: risk.severity === "CRITICAL",
          tags: ["pilotage", "risk"],
          assigneeId: risk.ownerId || undefined,
          preferredAssigneeId: risk.ownerId || undefined,
          watcherRoles: ["DIRECTION"],
          assignedByName: "Risk Command Horion",
          slaHours: mapRiskLevelToSlaHours(risk.severity),
          customFields: {
            strategicRiskId: riskId,
            category: risk.category,
            linkedHref: risk.linkedHref,
            mitigationPlan: risk.mitigationPlan,
          },
        })
      ).taskId;

    if (!existingTask) {
      await prisma.$transaction(async (tx) => {
        await tx.strategicRisk.update({
          where: { id: riskId },
          data: {
            status: "ESCALATED",
            escalatedAt: new Date(),
          },
        });

        await tx.riskMitigationEntry.create({
          data: {
            riskId,
            type: "ESCALATED",
            title: "Risk escalated",
            detail: "Mitigation task created from Risk Command.",
            meta: { taskId },
            createdById: user.id,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: "risk.escalated",
            entityType: "strategicRisk",
            entityId: riskId,
            newValue: { taskId },
          },
        });
      });
    }

    if (existingTask && risk.status !== "ESCALATED") {
      await prisma.$transaction(async (tx) => {
        await tx.strategicRisk.update({
          where: { id: riskId },
          data: {
            status: "ESCALATED",
            escalatedAt: risk.escalatedAt || new Date(),
          },
        });
        await tx.riskMitigationEntry.create({
          data: {
            riskId,
            type: "ESCALATED",
            title: "Risk escalated",
            detail: "Existing mitigation task linked to the risk.",
            meta: { taskId: existingTask.id },
            createdById: user.id,
          },
        });
      });
    }

    if (risk.ownerId) {
      await NotificationService.notify({
        tenantId: user.tenantId,
        userId: risk.ownerId,
        type: "SLA_BREACH",
        title: `Risk escalated: ${risk.title}`,
        message: "A mitigation task has been created and assigned.",
        entityType: "strategicRisk",
        entityId: riskId,
      });
    }

    revalidatePath("/pilotage/risk");
    revalidatePath("/tasks");
    revalidatePilotageCaches(user.tenantId);

    return { data: { taskId } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur escalation risque" };
  }
}

export async function getStrategicForecast() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.view");

    const data = await PilotageSnapshotService.getStrategicForecast(user.tenantId);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur forecast" };
  }
}

export async function evaluateDecisionRules() {
  try {
    const user = await getSession();
    checkPermission(user.role, "pilotage.manage");
    const result = await StrategicDecisionService.evaluateRulesForTenant(user.tenantId);

    revalidatePath("/pilotage/decisions");
    revalidatePath("/pilotage/intelligence");
    revalidatePilotageCaches(user.tenantId);
    return { data: { activated: result.activated } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur evaluation rules" };
  }
}
