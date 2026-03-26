import {
  Prisma,
  type DependencyType,
  type OwnerType,
  type Priority,
  type RiskLevel,
  type TaskStatus,
  type UserRole,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { SubtaskService } from "@/lib/services/subtask.service";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";
import { TaskService } from "@/lib/services/task.service";

type SubtaskInput = {
  title: string;
  description?: string;
  priority?: Priority;
  slaHours?: number;
  module?: string;
  tags?: string[];
  assigneeId?: string;
  assigneeRoles?: UserRole[];
  fallbackRoles?: UserRole[];
  dependsOnPrevious?: boolean;
};

type CompletionRequirementsInput = {
  requireAllSubtasks?: boolean;
  requireAllChecklistItems?: boolean;
  requiredFieldKeys?: string[];
  requiredAttachmentCount?: number;
  requiredComment?: boolean;
  requireApprovedDecision?: boolean;
};

type DependencyInput = {
  dependsOnTaskId: string;
  type?: DependencyType;
};

type CreateOperationalTaskInput = {
  tenantId: string;
  entityType: string;
  entityId: string;
  taskType: string;
  title: string;
  description?: string;
  module: string;
  priority?: Priority;
  ownerType?: OwnerType;
  riskLevel?: RiskLevel;
  slaHours?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status?: TaskStatus;
  parentTaskId?: string | null;
  templateId?: string | null;
  requiredApproval?: boolean;
  automationAllowed?: boolean;
  agentId?: string | null;
  agentName?: string | null;
  assigneeId?: string | null;
  assigneeRoles?: UserRole[];
  fallbackRoles?: UserRole[];
  watcherIds?: string[];
  watcherRoles?: UserRole[];
  assignedByName?: string;
  reuseIfOpen?: boolean;
  subtasks?: SubtaskInput[];
  completionRequirements?: CompletionRequirementsInput;
  dependencies?: DependencyInput[];
};

const DEFAULT_FALLBACK_ROLES: UserRole[] = ["ADMIN", "DIRECTION", "CEO"];
const DEFAULT_ASSIGNED_BY_NAME = "Automatisation Horion";

async function pickUserByRoles(tenantId: string, roles: UserRole[]) {
  if (roles.length === 0) return null;

  return prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      role: { in: roles as any[] },
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });
}

export class OperationalTaskService {
  static async resolveAssigneeId(
    tenantId: string,
    assigneeRoles: UserRole[] = [],
    fallbackRoles: UserRole[] = DEFAULT_FALLBACK_ROLES
  ) {
    const primary = await pickUserByRoles(tenantId, assigneeRoles);
    if (primary?.id) return primary.id;

    const fallback = await pickUserByRoles(tenantId, fallbackRoles);
    return fallback?.id ?? null;
  }

  static async create(input: CreateOperationalTaskInput) {
    const slaDeadline = input.slaHours
      ? new Date(Date.now() + input.slaHours * 3_600_000)
      : null;
    const dueDate = slaDeadline;

    const reusableTask =
      input.reuseIfOpen
        ? await prisma.task.findFirst({
            where: {
              tenantId: input.tenantId,
              entityType: input.entityType,
              entityId: input.entityId,
              taskType: input.taskType,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
            select: { id: true, title: true, customFields: true },
            orderBy: { createdAt: "desc" },
          })
        : null;

    const completionRequirements = {
      requireAllSubtasks: input.subtasks?.length ? true : input.completionRequirements?.requireAllSubtasks ?? false,
      requireAllChecklistItems: input.completionRequirements?.requireAllChecklistItems ?? false,
      requiredFieldKeys: input.completionRequirements?.requiredFieldKeys ?? [],
      requiredAttachmentCount: input.completionRequirements?.requiredAttachmentCount ?? 0,
      requiredComment: input.completionRequirements?.requiredComment ?? false,
      requireApprovedDecision:
        input.completionRequirements?.requireApprovedDecision ?? false,
    };

    const mergedCustomFields = {
      ...(reusableTask?.customFields &&
      typeof reusableTask.customFields === "object" &&
      !Array.isArray(reusableTask.customFields)
        ? (reusableTask.customFields as Record<string, unknown>)
        : {}),
      ...(input.customFields ?? {}),
      __workflow: {
        ...((reusableTask?.customFields &&
        typeof reusableTask.customFields === "object" &&
        !Array.isArray(reusableTask.customFields) &&
        (reusableTask.customFields as Record<string, unknown>).__workflow &&
        typeof (reusableTask.customFields as Record<string, unknown>).__workflow === "object")
          ? ((reusableTask.customFields as Record<string, unknown>).__workflow as Record<string, unknown>)
          : {}),
        autoCreated: true,
        taskPolicyVersion: 1,
        completionRequirements,
      },
    };

    const baseData = {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      module: input.module,
      priority: input.priority ?? "HIGH",
      ownerType: input.ownerType ?? "SYSTEM",
      status: input.status ?? ("PENDING" as const),
      riskLevel: input.riskLevel ?? "LOW",
      slaDeadline: slaDeadline ?? undefined,
      dueDate: dueDate ?? undefined,
      parentTaskId: input.parentTaskId ?? undefined,
      templateId: input.templateId ?? undefined,
      requiredApproval: input.requiredApproval ?? false,
      automationAllowed: input.automationAllowed ?? false,
      agentId: input.agentId ?? undefined,
      agentName: input.agentName ?? undefined,
      tags: input.tags ?? [],
      customFields: mergedCustomFields as Prisma.InputJsonValue,
    };

    const task = reusableTask
      ? await prisma.task.update({
          where: { id: reusableTask.id },
          data: baseData,
          select: { id: true, title: true },
        })
      : null;
    if (reusableTask) {
      await prisma.taskAssignment.deleteMany({ where: { taskId: reusableTask.id } });
    }
    const ensuredTask =
      task ??
      (await prisma.task.create({
        data: baseData,
        select: { id: true, title: true },
      }));

    const assigneeId =
      input.assigneeId ??
      (await this.resolveAssigneeId(
        input.tenantId,
        input.assigneeRoles,
        input.fallbackRoles
      ));

    if (assigneeId) {
      await TaskService.assignTask(ensuredTask.id, assigneeId);
      await NotificationService.onTaskAssigned(
        ensuredTask.id,
        input.tenantId,
        assigneeId,
        ensuredTask.title,
        input.assignedByName ?? DEFAULT_ASSIGNED_BY_NAME
      );
    }

    const watcherRoleIds =
      input.watcherRoles && input.watcherRoles.length > 0
        ? (
            await prisma.user.findMany({
              where: {
                tenantId: input.tenantId,
                isActive: true,
                role: { in: input.watcherRoles as any[] },
              },
              select: { id: true },
            })
          ).map((user) => user.id)
        : [];

    const watcherIds = [...new Set([...(input.watcherIds ?? []), ...watcherRoleIds].filter(Boolean))];
    if (watcherIds.length > 0) {
      await prisma.taskWatcher.createMany({
        data: watcherIds.map((userId) => ({ taskId: ensuredTask.id, userId })),
        skipDuplicates: true,
      });
    }

    if (input.subtasks?.length) {
      const existingChildren = await prisma.task.findMany({
        where: { parentTaskId: ensuredTask.id },
        select: { id: true, title: true },
        orderBy: { position: "asc" },
      });
      const existingByTitle = new Map(existingChildren.map((child) => [child.title.toLowerCase(), child]));
      const subtaskIds: string[] = [];

      for (const subtask of input.subtasks) {
        const existingSubtask = existingByTitle.get(subtask.title.toLowerCase());
        const subtaskAssigneeId =
          subtask.assigneeId ??
          (await this.resolveAssigneeId(
            input.tenantId,
            subtask.assigneeRoles,
            subtask.fallbackRoles ?? input.fallbackRoles
          ));

        const createdSubtask =
          existingSubtask ??
          (await SubtaskService.createSubtask({
            parentTaskId: ensuredTask.id,
            title: subtask.title,
            description: subtask.description,
            priority: subtask.priority ?? "NORMAL",
            slaHours: subtask.slaHours,
            module: subtask.module ?? input.module,
            assigneeId: subtaskAssigneeId ?? undefined,
            tags: subtask.tags ?? input.tags,
          }));

        subtaskIds.push(createdSubtask.id);

        if (subtask.dependsOnPrevious && subtaskIds.length > 1) {
          await TaskDependencyService.addDependency(
            createdSubtask.id,
            subtaskIds[subtaskIds.length - 2],
            "BLOCKS"
          ).catch(() => null);
        }
      }
    }

    if (input.dependencies?.length) {
      for (const dependency of input.dependencies) {
        await TaskDependencyService.addDependency(
          ensuredTask.id,
          dependency.dependsOnTaskId,
          dependency.type ?? "BLOCKS"
        ).catch(() => null);
      }
    }

    return { taskId: ensuredTask.id, assigneeId };
  }
}
