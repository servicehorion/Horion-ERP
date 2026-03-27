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
import { TaskAssignmentEngineService } from "@/lib/services/task-assignment-engine.service";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";
import { TaskService } from "@/lib/services/task.service";

type SubtaskInput = {
  title: string;
  description?: string;
  priority?: Priority;
  slaHours?: number;
  dueInHours?: number;
  dueAt?: Date | null;
  module?: string;
  tags?: string[];
  assigneeId?: string;
  preferredAssigneeId?: string;
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
  estimatedHours?: number | null;
  slaHours?: number;
  dueInHours?: number;
  dueAt?: Date | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status?: TaskStatus;
  parentTaskId?: string | null;
  projectId?: string | null;
  templateId?: string | null;
  requiredApproval?: boolean;
  automationAllowed?: boolean;
  agentId?: string | null;
  agentName?: string | null;
  assigneeId?: string | null;
  preferredAssigneeId?: string | null;
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

const DEFAULT_ASSIGNED_BY_NAME = "Automatisation Horion";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function buildDeadline(baseDate: Date, hours?: number | null, explicitDate?: Date | null) {
  if (explicitDate) return explicitDate;
  if (typeof hours === "number" && Number.isFinite(hours)) {
    return new Date(baseDate.getTime() + hours * 3_600_000);
  }
  return null;
}

export class OperationalTaskService {
  static async create(input: CreateOperationalTaskInput) {
    const now = new Date();
    const slaDeadline = buildDeadline(now, input.slaHours, null);
    const dueDate = buildDeadline(now, input.dueInHours, input.dueAt) ?? slaDeadline;

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
      requireApprovedDecision: input.completionRequirements?.requireApprovedDecision ?? false,
    };

    const responsibility = await TaskAssignmentEngineService.resolveResponsibility({
      tenantId: input.tenantId,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      assigneeId: input.assigneeId,
      preferredAssigneeId: input.preferredAssigneeId,
      assigneeRoles: input.assigneeRoles,
      fallbackRoles: input.fallbackRoles,
      dueDate,
      slaDeadline,
    });

    const reusableFields = toRecord(reusableTask?.customFields);
    const reusableWorkflow = toRecord(reusableFields.__workflow);

    const mergedCustomFields = {
      ...reusableFields,
      ...(input.customFields ?? {}),
      __workflow: {
        ...reusableWorkflow,
        autoCreated: true,
        taskPolicyVersion: 2,
        completionRequirements,
        responsibility: {
          primaryOwnerId: responsibility.primaryOwnerId,
          backupOwnerId: responsibility.backupOwnerId,
          managerOwnerId: responsibility.managerOwnerId,
          escalationAt: responsibility.escalationAt?.toISOString() ?? null,
          escalationLevel: responsibility.escalationLevel,
          assignmentReason: responsibility.assignmentReason,
          topCandidates: responsibility.candidates.slice(0, 3).map((candidate) => ({
            userId: candidate.userId,
            role: candidate.role,
            score: candidate.score,
            reasons: candidate.reasons,
            metrics: candidate.metrics,
          })),
        },
        scheduling: {
          slaDeadline: slaDeadline?.toISOString() ?? null,
          dueDate: dueDate?.toISOString() ?? null,
          usesDistinctDueDate: Boolean(dueDate && slaDeadline && dueDate.getTime() !== slaDeadline.getTime()),
        },
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
      estimatedHours: input.estimatedHours ?? undefined,
      slaDeadline: slaDeadline ?? undefined,
      dueDate: dueDate ?? undefined,
      parentTaskId: input.parentTaskId ?? undefined,
      projectId: input.projectId ?? undefined,
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

    const assigneeId = responsibility.primaryOwnerId;
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

    const watcherIds = [
      ...(input.watcherIds ?? []),
      ...watcherRoleIds,
      ...(responsibility.backupOwnerId ? [responsibility.backupOwnerId] : []),
      ...(responsibility.managerOwnerId ? [responsibility.managerOwnerId] : []),
    ]
      .filter((value): value is string => Boolean(value))
      .filter((value, index, items) => items.indexOf(value) === index)
      .filter((value) => value !== assigneeId);

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
        const createdSubtask =
          existingSubtask ??
          (await SubtaskService.createSubtask({
            parentTaskId: ensuredTask.id,
            title: subtask.title,
            description: subtask.description,
            priority: subtask.priority ?? "NORMAL",
            slaHours: subtask.slaHours,
            dueInHours: subtask.dueInHours,
            dueAt: subtask.dueAt ?? dueDate,
            module: subtask.module ?? input.module,
            assigneeId: subtask.assigneeId,
            preferredAssigneeId: subtask.preferredAssigneeId,
            assigneeRoles: subtask.assigneeRoles,
            fallbackRoles: subtask.fallbackRoles ?? input.fallbackRoles,
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

    return { taskId: ensuredTask.id, assigneeId, responsibility };
  }
}
