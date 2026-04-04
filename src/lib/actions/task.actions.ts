"use server";
import { getSession } from "@/lib/session";
import { TaskService } from "@/lib/services/task.service";
import { TaskIntelligenceService } from "@/lib/services/task-intelligence.service";
import { SubtaskService } from "@/lib/services/subtask.service";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";
import { TaskTemplateService } from "@/lib/services/task-template.service";
import { AgentTaskService } from "@/lib/services/agent-task.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { TaskWorkflowService } from "@/lib/services/task-workflow.service";
import { NotificationService } from "@/lib/services/notification.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission, hasPermission } from "@/lib/permissions";
import {
  canAccessTaskModule,
  getTaskAllowedModules,
  getTaskRolesForModule,
  getTaskRolesForModules,
} from "@/lib/access-control";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { getTenantCacheTags } from "@/lib/server-cache";
import { TaskDashboardSnapshotService } from "@/lib/services/task-dashboard-snapshot.service";
import { StorageService } from "@/lib/services/storage.service";
import type { TaskStatus, Priority, DependencyType } from "@prisma/client";
import * as taskExtrasActions from "./task-extras.actions";

const TASK_CACHE_NAMESPACES = ["task-dashboard"];

function revalidateTask(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/board");
  revalidatePath("/dashboard");
  revalidatePath("/tasks/analytics");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

function revalidateTaskCaches(tenantId: string) {
  for (const namespace of TASK_CACHE_NAMESPACES) {
    for (const tag of getTenantCacheTags(namespace, tenantId)) {
      revalidateTag(tag, "max");
    }
  }
}

function parseOptionalDateInput(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeHoursFromBaseline(referenceDate: Date, targetDate?: Date | null) {
  if (!targetDate) return undefined;
  return Math.max(0, (targetDate.getTime() - referenceDate.getTime()) / 3_600_000);
}

// ============================================================
// TASK QUERIES
// ============================================================

export async function getTasks(options?: {
  module?: string;
  status?: string;
  priority?: string;
  search?: string;
  assigneeId?: string;
  projectId?: string;
  slaBreach?: boolean;
  tags?: string[];
  parentTaskId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const {
      module,
      status,
      priority,
      search,
      assigneeId,
      projectId,
      slaBreach,
      tags,
      parentTaskId,
      sortBy,
      sortDir,
      page = 1,
      limit = 50,
    } = options || {};

    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { data: [], total: 0, page, totalPages: 1 };
    }
    if (module && module !== "all" && allowedModules !== "*" && !allowedModules.includes(module)) {
      return { data: [], total: 0, page, totalPages: 1 };
    }

    const where: any = {
      tenantId: user.tenantId,
      parentTaskId: parentTaskId ?? null, // only root tasks by default
      ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
      ...(module && module !== "all" && { module }),
      ...(status && status !== "all" && { status }),
      ...(priority && priority !== "all" && { priority }),
      ...(slaBreach && { slaBreach: true }),
      ...(assigneeId && { assignments: { some: { userId: assigneeId } } }),
      ...(projectId && { projectId }),
      ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const sortDirection = sortDir === "asc" ? "asc" : "desc";
    const orderBy: any =
      sortBy === "priority"
        ? [{ priority: sortDirection }, { slaDeadline: "asc" }, { createdAt: "desc" }]
        : sortBy === "sla"
        ? [{ slaDeadline: sortDirection }, { priority: "desc" }, { createdAt: "desc" }]
        : sortBy === "created"
        ? [{ createdAt: sortDirection }]
        : sortBy === "updated"
        ? [{ updatedAt: sortDirection }]
        : [{ priority: "desc" }, { slaDeadline: "asc" }, { createdAt: "desc" }];

    // Keep the list query ahead of the count to avoid opening two DB reads at once
    // on the already-busy Tasks page.
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        project: { select: { id: true, name: true } },
        _count: { select: { children: true, dependencies: true, comments: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.task.count({ where });

    return { data: tasks, total, page, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskById(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId: user.tenantId,
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true, role: true } } } },
        approvals: { include: { user: { select: { name: true } } }, orderBy: { decidedAt: "desc" } },
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
        watchers: { include: { user: { select: { id: true, name: true } } } },
        children: {
          include: { assignments: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { position: "asc" },
        },
        dependencies: {
          include: { dependsOn: { select: { id: true, title: true, status: true, priority: true, module: true } } },
        },
        dependents: {
          include: { task: { select: { id: true, title: true, status: true, priority: true, module: true } } },
        },
        agentExecutions: { orderBy: { createdAt: "desc" }, take: 10 },
        attachments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
        checklists: { orderBy: { position: "asc" } },
        parent: { select: { id: true, title: true } },
      },
    });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskActivity(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId: user.tenantId,
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
      },
      select: { id: true },
    });
    if (!task) return { error: "TÒ¢che introuvable" };
    // Combine AuditLog + TaskComment for unified activity
    const [auditLogs, comments] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType: "task", entityId: taskId },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.taskComment.findMany({
        where: { taskId },
        include: {
          user: { select: { id: true, name: true } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // Merge and sort by date
    const activities = [
      ...auditLogs.map((a) => ({ ...a, _type: "audit" as const })),
      ...comments.map((c) => ({
        id: c.id,
        action: "task.comment",
        createdAt: c.createdAt,
        user: c.user,
        newValue: { comment: c.content, reactions: c.reactions },
        _type: "comment" as const,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { data: activities };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TASK DASHBOARD
// ============================================================

export async function getTaskDashboardData() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    const snapshot = await TaskDashboardSnapshotService.getDashboard(user.tenantId, user.id, allowedModules);
    return { data: snapshot };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur dashboard" };
  }
}

// ============================================================
// TASK MUTATIONS
// ============================================================

export async function updateTaskStatus(taskId: string, newStatus: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing || existing.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, existing.module)) return { error: "Accès refusé" };

    let task;
    if (newStatus === "COMPLETED") {
      const result = await TaskWorkflowService.completeTask(taskId, { completedByUserId: user.id });
      task = result.task;
      if (existing.parentTaskId) {
        await SubtaskService.onSubtaskCompleted(taskId);
      }
    } else if (newStatus === "BLOCKED") {
      const result = await TaskWorkflowService.blockTask(taskId, {
        reason: existing.blockedBy || "Bloquee manuellement",
        blockedByUserId: user.id,
      });
      task = result.task;
      if (existing.parentTaskId) {
        await SubtaskService.onSubtaskBlocked(taskId);
      }
    } else if (newStatus === "IN_PROGRESS") {
      task = await TaskWorkflowService.startTask(taskId);
    } else if (newStatus === "WAITING_APPROVAL") {
      task = await TaskWorkflowService.submitForApproval(taskId, user.tenantId, existing.title);
    } else {
      task = await TaskService.updateStatus(taskId, newStatus as TaskStatus);
    }

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.status_changed", entityType: "task", entityId: taskId,
      oldValue: { status: existing.status }, newValue: { status: newStatus },
    });

    revalidateTask(taskId);
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function assignTask(taskId: string, userId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.assign");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "T�che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acc�s refus�" };

    const assignee = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, tenantId: true },
    });
    if (!assignee || assignee.tenantId !== user.tenantId) return { error: "Utilisateur introuvable" };
    if (!canAccessTaskModule(assignee.role, task.module)) {
      return { error: "Assignation impossible: r�le non autoris�" };
    }

    const assignment = await TaskService.assignTask(taskId, userId);

    // Notify assignee
    await NotificationService.onTaskAssigned(taskId, user.tenantId, userId, task.title, user.name);

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.assigned", entityType: "task", entityId: taskId,
      newValue: { assignedTo: assignee?.name, assignedUserId: userId },
    });

    revalidateTask(taskId);
    return { data: assignment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
export async function createManualTask(formData: {
  title: string;
  description?: string;
  module: string;
  priority?: string;
  slaHours?: number;
  dueDate?: string | Date | null;
  assigneeId?: string;
  projectId?: string;
  tags?: string[];
  parentTaskId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");
    if (!canAccessTaskModule(user.role, formData.module)) {
      return { error: "Acces refuse" };
    }

    if (formData.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: formData.projectId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!project) return { error: "Projet introuvable" };
    }

    if (formData.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: formData.assigneeId },
        select: { id: true, role: true, tenantId: true },
      });
      if (!assignee || assignee.tenantId !== user.tenantId) return { error: "Utilisateur introuvable" };
      if (!canAccessTaskModule(assignee.role, formData.module)) {
        return { error: "Assignation impossible: role non autorise" };
      }
    }

    const created = await OperationalTaskService.create({
      tenantId: user.tenantId,
      entityType: "manual",
      entityId: formData.projectId ?? "manual",
      taskType: "manual",
      title: formData.title.trim(),
      description: formData.description,
      module: formData.module,
      priority: (formData.priority as Priority) || "NORMAL",
      ownerType: "HUMAN",
      status: "PENDING",
      riskLevel: "LOW",
      slaHours: formData.slaHours,
      dueAt: parseOptionalDateInput(formData.dueDate),
      tags: formData.tags ?? [],
      parentTaskId: formData.parentTaskId,
      projectId: formData.projectId || undefined,
      assigneeId: formData.assigneeId ?? null,
      preferredAssigneeId: formData.assigneeId ?? null,
      assignedByName: user.name,
      reuseIfOpen: false,
      customFields: {
        source: "manual_create_dialog",
      },
    });

    const task = await prisma.task.findUnique({ where: { id: created.taskId } });
    if (!task) return { error: "Tache creee mais introuvable" };

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.created", entityType: "task", entityId: task.id,
      newValue: { title: task.title, module: task.module },
    });

    revalidateTask();
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur création" };
  }
}

// ============================================================
// COMMENTS (dedicated TaskComment model)
// ============================================================

export async function addTaskComment(taskId: string, content: string, mentions: string[] = []) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tache introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acces refuse" };

    const comment = await prisma.taskComment.create({
      data: { taskId, userId: user.id, content, mentions },
    });

    // Also log in AuditLog for backward compatibility
    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.comment", entityType: "task", entityId: taskId,
      newValue: { comment: content, mentions },
    });

    // Notify watchers + assignees
    await NotificationService.onCommentAdded(taskId, user.tenantId, task.title, user.id, user.name);

    // Notify mentioned users specifically
    if (mentions.length > 0) {
      await NotificationService.notifyMany(
        mentions.filter((id) => id !== user.id),
        {
          tenantId: user.tenantId,
          type: "MENTION",
          title: `${user.name} vous a mentionné`,
          message: content.slice(0, 200),
          entityType: "task",
          entityId: taskId,
        }
      );
    }

    revalidatePath(`/tasks/${taskId}`);
    return { data: comment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// APPROVALS
// ============================================================

export async function approveTask(taskId: string, decision: string, comment?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acc�s refus�" };

    if (decision === "APPROVED") {
      const readiness = await TaskWorkflowService.getTaskWorkflowSnapshot(taskId);
      const actionableBlockers = readiness.blockers.filter((blocker) => blocker.code !== "APPROVAL_REQUIRED");
      if (actionableBlockers.length > 0) {
        return { error: actionableBlockers.map((blocker) => blocker.message).join(" ") };
      }
    }

    const approval = await prisma.approval.create({
      data: { taskId, userId: user.id, decision: decision as any, comment },
    });

    if (decision === "APPROVED") {
      await TaskWorkflowService.completeTask(taskId, { completedByUserId: user.id, skipApproval: true });
      if (task.parentTaskId) await SubtaskService.onSubtaskCompleted(taskId);
    } else if (decision === "REJECTED") {
      await TaskWorkflowService.blockTask(taskId, {
        reason: `Rejected: ${comment || "No reason"}`,
        blockedByUserId: user.id,
      });
    }

    // Notify watchers
    await NotificationService.notifyTaskWatchers(taskId, {
      tenantId: user.tenantId,
      type: "APPROVAL_DECIDED",
      title: `Tâche ${decision.toLowerCase()}: ${task.title}`,
      message: comment,
    }, user.id);

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: `task.${decision.toLowerCase()}`, entityType: "task", entityId: taskId,
      newValue: { decision, comment },
    });

    revalidateTask(taskId);
    return { data: approval };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// SUBTASKS
// ============================================================

export async function createSubtask(parentTaskId: string, data: {
  title: string;
  description?: string;
  priority?: string;
  slaHours?: number;
  dueDate?: string | Date | null;
  module?: string;
  assigneeId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const parent = await prisma.task.findUnique({ where: { id: parentTaskId } });
    if (!parent || parent.tenantId !== user.tenantId) return { error: "Tâche parent introuvable" };
    if (!canAccessTaskModule(user.role, parent.module)) return { error: "Accès refusé" };
    const targetModule = data.module ?? parent.module;
    if (!canAccessTaskModule(user.role, targetModule)) return { error: "Acc�s refus�" };

    if (data.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: data.assigneeId },
        select: { id: true, role: true, tenantId: true },
      });
      if (!assignee || assignee.tenantId !== user.tenantId) return { error: "Utilisateur introuvable" };
      if (!canAccessTaskModule(assignee.role, targetModule)) {
        return { error: "Assignation impossible: r�le non autoris�" };
      }
    }

      const subtask = await SubtaskService.createSubtask({
        parentTaskId,
        title: data.title,
        description: data.description,
        priority: data.priority as Priority,
        slaHours: data.slaHours,
        dueAt: parseOptionalDateInput(data.dueDate),
        module: data.module,
        assigneeId: data.assigneeId,
      });

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.subtask_created", entityType: "task", entityId: parentTaskId,
      newValue: { subtaskId: subtask.id, title: data.title },
    });

    revalidateTask(parentTaskId);
    return { data: subtask };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSubtaskProgress(parentTaskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const parent = await prisma.task.findUnique({
      where: { id: parentTaskId },
      select: { tenantId: true, module: true },
    });
    if (!parent || parent.tenantId !== user.tenantId) return { error: "T�che introuvable" };
    if (!canAccessTaskModule(user.role, parent.module)) return { error: "Acc�s refus�" };
    return { data: await SubtaskService.getProgress(parentTaskId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// DEPENDENCIES
// ============================================================

export async function addTaskDependency(taskId: string, dependsOnId: string, type?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    const dep = await TaskDependencyService.addDependency(
      taskId, dependsOnId, (type as DependencyType) ?? "BLOCKS"
    );

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.dependency_added", entityType: "task", entityId: taskId,
      newValue: { dependsOnId, type: type ?? "BLOCKS" },
    });

    revalidateTask(taskId);
    return { data: dep };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function removeTaskDependency(taskId: string, dependsOnId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

    await TaskDependencyService.removeDependency(taskId, dependsOnId);

    revalidateTask(taskId);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// WATCHERS
// ============================================================

export async function watchTask(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };
    await prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId, userId: user.id } },
      update: {},
      create: { taskId, userId: user.id },
    });
    revalidatePath(`/tasks/${taskId}`);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function unwatchTask(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };
    await prisma.taskWatcher.deleteMany({ where: { taskId, userId: user.id } });
    revalidatePath(`/tasks/${taskId}`);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TEMPLATES
// ============================================================

export async function getTaskTemplates(module?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (module && module !== "all" && allowedModules !== "*" && !allowedModules.includes(module)) {
      return { data: [] };
    }
    const templates = await TaskTemplateService.listTemplates(user.tenantId, { module, isActive: true });
    const filtered = allowedModules === "*"
      ? templates
      : templates.filter((t) => allowedModules.includes(t.module));
    return { data: filtered };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createTaskTemplate(formData: {
  name: string;
  description?: string;
  module: string;
  taskType: string;
  titleTemplate: string;
  descriptionTemplate?: string;
  defaultPriority?: string;
  defaultSlaHours?: number;
  defaultTags?: string[];
  requiresApproval?: boolean;
  automationAllowed?: boolean;
  subtaskDefinitions?: { title: string; priority?: string; slaHours?: number; module?: string }[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");
    if (!canAccessTaskModule(user.role, formData.module)) return { error: "Acc�s refus�" };

    const template = await TaskTemplateService.createTemplate({
      tenantId: user.tenantId,
      name: formData.name,
      description: formData.description,
      module: formData.module,
      taskType: formData.taskType,
      titleTemplate: formData.titleTemplate,
      descriptionTemplate: formData.descriptionTemplate,
      defaultPriority: formData.defaultPriority as Priority,
      defaultSlaHours: formData.defaultSlaHours,
      defaultTags: formData.defaultTags,
      requiresApproval: formData.requiresApproval,
      automationAllowed: formData.automationAllowed,
      subtaskDefinitions: formData.subtaskDefinitions,
    });

    revalidatePath("/tasks/templates");
    return { data: template };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function instantiateTemplate(templateId: string, vars?: Record<string, string>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const template = await TaskTemplateService.getTemplate(templateId);
    if (!template || template.tenantId !== user.tenantId) return { error: "Mod�le introuvable" };
    if (!canAccessTaskModule(user.role, template.module)) return { error: "Acc�s refus�" };

    const result = await TaskTemplateService.instantiate(templateId, {
      tenantId: user.tenantId,
      variables: vars,
    });

    revalidateTask();
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function duplicateTaskTemplate(templateId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const original = await TaskTemplateService.getTemplate(templateId);
    if (!original || original.tenantId !== user.tenantId) return { error: "Mod�le introuvable" };

    const copy = await prisma.taskTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: `${original.name} (copie)`,
        description: original.description ?? undefined,
        module: original.module,
        taskType: original.taskType,
        titleTemplate: original.titleTemplate,
        descriptionTemplate: original.descriptionTemplate ?? undefined,
        defaultPriority: original.defaultPriority,
        defaultSlaHours: original.defaultSlaHours ?? undefined,
        defaultTags: original.defaultTags,
        requiresApproval: original.requiresApproval,
        automationAllowed: original.automationAllowed,
        ownerType: original.ownerType,
        subtaskDefinitions: original.subtaskDefinitions as any,
        dependencyDefinitions: original.dependencyDefinitions as any,
        isActive: original.isActive,
      },
    });

    revalidatePath("/tasks/templates");
    return { data: copy };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function getMyNotifications(unreadOnly?: boolean) {
  try {
    const user = await getSession();
    return { data: await NotificationService.getUserNotifications(user.id, { unreadOnly }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getUnreadNotificationCount() {
  try {
    const user = await getSession();
    return { data: await NotificationService.getUnreadCount(user.id) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    const user = await getSession();
    await NotificationService.markRead(notificationId, user.id);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function markAllNotificationsRead() {
  try {
    const user = await getSession();
    await NotificationService.markAllRead(user.id);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// BULK OPERATIONS
// ============================================================

export async function bulkUpdateTaskStatus(taskIds: string[], status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, tenantId: user.tenantId },
      select: { id: true, title: true, module: true },
    });

    for (const task of tasks) {
      if (!canAccessTaskModule(user.role, task.module)) continue;

      if (status === "COMPLETED") {
        await TaskWorkflowService.completeTask(task.id, { completedByUserId: user.id });
      } else if (status === "BLOCKED") {
        await TaskWorkflowService.blockTask(task.id, {
          reason: "Bloquee via mise a jour en masse",
          blockedByUserId: user.id,
        });
      } else if (status === "IN_PROGRESS") {
        await TaskWorkflowService.startTask(task.id);
      } else if (status === "WAITING_APPROVAL") {
        await TaskWorkflowService.submitForApproval(task.id, user.tenantId, task.title);
      } else {
        await TaskService.updateStatus(task.id, status as TaskStatus);
      }
    }

    revalidateTask();
    return { data: { updated: tasks.length } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function bulkAssignTasks(taskIds: string[], userId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.assign");

    for (const taskId of taskIds) {
      await TaskService.assignTask(taskId, userId);
    }

    revalidateTask();
    return { data: { assigned: taskIds.length } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// HELPERS
// ============================================================

export async function getTeamMembers(module?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { data: [] };
    }
    const normalizedModule = module && module !== "all" ? module : undefined;
    if (normalizedModule && allowedModules !== "*" && !allowedModules.includes(normalizedModule)) {
      return { data: [] };
    }
    const roleFilter = normalizedModule
      ? getTaskRolesForModule(normalizedModule)
      : (allowedModules === "*" ? "*" : getTaskRolesForModules(allowedModules));

    const members = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(roleFilter !== "*" ? { role: { in: roleFilter } } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return { data: members };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getKanbanTasks(module?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (module && module !== "all" && allowedModules !== "*" && !allowedModules.includes(module)) {
      return { data: [] };
    }
    const tasks = await TaskIntelligenceService.getKanbanTasks(user.tenantId, module, allowedModules);
    return { data: tasks };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskModuleCounts() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    return { data: await TaskService.getModuleCounts(user.tenantId, allowedModules) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getPendingTaskCount() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    return { data: await TaskService.getPendingCount(user.tenantId, allowedModules) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TASK EDIT / UPDATE
// ============================================================

export async function updateTask(taskId: string, data: {
  title?: string;
  description?: string;
  priority?: string;
  module?: string;
  tags?: string[];
  estimatedHours?: number;
  dueDate?: string;
  riskLevel?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority && { priority: data.priority as Priority }),
        ...(data.module && { module: data.module }),
        ...(data.tags && { tags: data.tags }),
        ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
        ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
        ...(data.riskLevel && { riskLevel: data.riskLevel as any }),
      },
    });

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.updated", entityType: "task", entityId: taskId,
      oldValue: { title: task.title, priority: task.priority },
      newValue: data,
    });

    revalidateTask(taskId);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteTask(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    // Delete child relations first
    await prisma.$transaction([
      prisma.taskComment.deleteMany({ where: { taskId } }),
      prisma.taskWatcher.deleteMany({ where: { taskId } }),
      prisma.taskDependency.deleteMany({ where: { OR: [{ taskId }, { dependsOnId: taskId }] } }),
      prisma.agentExecution.deleteMany({ where: { taskId } }),
      prisma.taskAssignment.deleteMany({ where: { taskId } }),
      prisma.approval.deleteMany({ where: { taskId } }),
      prisma.task.deleteMany({ where: { parentTaskId: taskId } }),
      prisma.task.delete({ where: { id: taskId } }),
    ]);

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.deleted", entityType: "task", entityId: taskId,
      oldValue: { title: task.title },
    });

    revalidateTask();
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function duplicateTask(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: { select: { userId: true } },
        watchers: { select: { userId: true } },
        checklists: { select: { text: true, checked: true, position: true }, orderBy: { position: "asc" } },
        dependencies: { select: { dependsOnId: true, type: true } },
        children: {
          include: {
            assignments: { select: { userId: true } },
            watchers: { select: { userId: true } },
            checklists: { select: { text: true, checked: true, position: true }, orderBy: { position: "asc" } },
            dependencies: { select: { dependsOnId: true, type: true } },
          },
          orderBy: { position: "asc" },
        },
      },
    });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

    const parseWorkflowRequirements = (customFields: unknown) => {
      if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return undefined;
      const workflow = (customFields as Record<string, unknown>).__workflow;
      if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) return undefined;
      const requirements = (workflow as Record<string, unknown>).completionRequirements;
      if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) return undefined;

      const record = requirements as Record<string, unknown>;
      return {
        requireAllSubtasks: record.requireAllSubtasks === true,
        requireAllChecklistItems: record.requireAllChecklistItems === true,
        requiredFieldKeys: Array.isArray(record.requiredFieldKeys)
          ? record.requiredFieldKeys.filter((value): value is string => typeof value === "string")
          : undefined,
        requiredAttachmentCount:
          typeof record.requiredAttachmentCount === "number" ? record.requiredAttachmentCount : undefined,
        requiredComment: record.requiredComment === true,
        requireApprovedDecision: record.requireApprovedDecision === true,
      };
    };

    const stripWorkflowMetadata = (customFields: unknown) => {
      if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return undefined;
      const entries = Object.entries(customFields as Record<string, unknown>).filter(([key]) => key !== "__workflow");
      return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    };

    const duplicateRoot = await OperationalTaskService.create({
      tenantId: task.tenantId,
      entityType: task.entityType,
      entityId: task.entityId,
      taskType: task.taskType,
      title: `${task.title} (copie)`,
      description: task.description ?? undefined,
      module: task.module,
      priority: task.priority,
      ownerType: task.ownerType,
      riskLevel: task.riskLevel,
      estimatedHours: task.estimatedHours,
      slaHours: computeHoursFromBaseline(task.createdAt, task.slaDeadline),
      dueInHours: computeHoursFromBaseline(task.createdAt, task.dueDate),
      tags: task.tags,
      customFields: stripWorkflowMetadata(task.customFields),
      projectId: task.projectId,
      templateId: task.templateId,
      requiredApproval: task.requiredApproval,
      automationAllowed: task.automationAllowed,
      assigneeId: task.assignments[0]?.userId ?? null,
      preferredAssigneeId: task.assignments[0]?.userId ?? null,
      watcherIds: task.watchers.map((watcher) => watcher.userId),
      assignedByName: user.name,
      reuseIfOpen: false,
      completionRequirements: parseWorkflowRequirements(task.customFields),
    });

    const copy = await prisma.task.findUnique({
      where: { id: duplicateRoot.taskId },
      include: { children: true },
    });
    if (!copy) return { error: "Copie creee mais introuvable" };

    if (task.checklists.length > 0) {
      await prisma.taskChecklist.createMany({
        data: task.checklists.map((item) => ({
          taskId: copy.id,
          text: item.text,
          checked: item.checked,
          position: item.position,
        })),
      });
    }

    for (const dependency of task.dependencies) {
      await TaskDependencyService.addDependency(copy.id, dependency.dependsOnId, dependency.type).catch(() => null);
    }

    const childIdMap = new Map<string, string>();

    for (const child of task.children) {
      const duplicatedChild = await OperationalTaskService.create({
        tenantId: child.tenantId,
        entityType: child.entityType,
        entityId: child.entityId,
        taskType: child.taskType,
        title: child.title,
        description: child.description ?? undefined,
        module: child.module,
        priority: child.priority,
        ownerType: child.ownerType,
        riskLevel: child.riskLevel,
        estimatedHours: child.estimatedHours,
        slaHours: computeHoursFromBaseline(child.createdAt, child.slaDeadline),
        dueInHours: computeHoursFromBaseline(child.createdAt, child.dueDate),
        tags: child.tags,
        customFields: stripWorkflowMetadata(child.customFields),
        parentTaskId: copy.id,
        projectId: child.projectId,
        templateId: child.templateId,
        requiredApproval: child.requiredApproval,
        automationAllowed: child.automationAllowed,
        assigneeId: child.assignments[0]?.userId ?? null,
        preferredAssigneeId: child.assignments[0]?.userId ?? null,
        watcherIds: child.watchers.map((watcher) => watcher.userId),
        assignedByName: user.name,
        reuseIfOpen: false,
        completionRequirements: parseWorkflowRequirements(child.customFields),
      });

      childIdMap.set(child.id, duplicatedChild.taskId);

      if (child.checklists.length > 0) {
        await prisma.taskChecklist.createMany({
          data: child.checklists.map((item) => ({
            taskId: duplicatedChild.taskId,
            text: item.text,
            checked: item.checked,
            position: item.position,
          })),
        });
      }
    }

    for (const child of task.children) {
      const duplicatedChildId = childIdMap.get(child.id);
      if (!duplicatedChildId) continue;

      for (const dependency of child.dependencies) {
        const mappedDependsOnId = childIdMap.get(dependency.dependsOnId) ?? dependency.dependsOnId;
        if (mappedDependsOnId === duplicatedChildId) continue;
        await TaskDependencyService.addDependency(duplicatedChildId, mappedDependsOnId, dependency.type).catch(() => null);
      }
    }

    revalidateTask();
    return { data: copy };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TIME TRACKING
// ============================================================

export async function logTaskTime(taskId: string, hours: number, note?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    const newActual = (task.actualHours ?? 0) + hours;
    await prisma.task.update({
      where: { id: taskId },
      data: { actualHours: newActual },
    });

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.time_logged", entityType: "task", entityId: taskId,
      newValue: { hours, total: newActual, note },
    });

    revalidateTask(taskId);
    return { data: { logged: hours, total: newActual } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// MY TASKS (PERSONALIZED)
// ============================================================

export async function getMyTasksList() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { data: [] };
    }
    const tasks = await prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        assignments: { some: { userId: user.id } },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        _count: { select: { children: true, comments: true } },
      },
      orderBy: [
        { priority: "desc" },
        { slaDeadline: "asc" },
        { createdAt: "desc" },
      ],
    });
    return { data: tasks };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TASK TIMELINE DATA
// ============================================================

export async function getTaskTimeline() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { data: [] };
    }
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    const tasks = await prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        parentTaskId: null,
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
        OR: [
          { slaDeadline: { gte: thirtyDaysAgo, lte: thirtyDaysFromNow } },
          { createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        ],
      },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
      },
      orderBy: { slaDeadline: "asc" },
      take: 100,
    });

    return { data: tasks };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// ANALYTICS (ENHANCED)
// ============================================================

export async function getTaskAnalytics() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return {
        data: {
          dailyData: [],
          slaCompliance: 100,
          avgResolution: 0,
          statusBreakdown: [],
          ownerBreakdown: [],
        },
      };
    }
    const moduleFilter = allowedModules !== "*" ? { module: { in: allowedModules } } : {};
    const now = new Date();

    // Daily counts for last 14 days
    const dailyData: { date: string; created: number; completed: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [created, completed] = await Promise.all([
        prisma.task.count({
          where: { tenantId: user.tenantId, createdAt: { gte: dayStart, lte: dayEnd }, ...moduleFilter },
        }),
        prisma.task.count({
          where: { tenantId: user.tenantId, completedAt: { gte: dayStart, lte: dayEnd }, ...moduleFilter },
        }),
      ]);

      dailyData.push({
        date: dayStart.toISOString().split("T")[0],
        created,
        completed,
      });
    }

    // SLA compliance
    const [totalWithSla, slaBreached] = await Promise.all([
      prisma.task.count({
        where: { tenantId: user.tenantId, slaDeadline: { not: null }, status: "COMPLETED", ...moduleFilter },
      }),
      prisma.task.count({
        where: { tenantId: user.tenantId, slaBreach: true, status: "COMPLETED", ...moduleFilter },
      }),
    ]);
    const slaCompliance = totalWithSla > 0
      ? Math.round(((totalWithSla - slaBreached) / totalWithSla) * 100)
      : 100;

    // Average resolution time (hours) for tasks completed this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedTasks = await prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        status: "COMPLETED",
        completedAt: { gte: monthStart },
        startedAt: { not: null },
        ...moduleFilter,
      },
      select: { startedAt: true, completedAt: true },
    });

    const avgResolution = completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((sum, t) => {
            const ms = (t.completedAt!.getTime() - t.startedAt!.getTime());
            return sum + ms / 3600000;
          }, 0) / completedTasks.length
        )
      : 0;

    // Status breakdown
    const statusBreakdown = await prisma.task.groupBy({
      by: ["status"],
      where: { tenantId: user.tenantId, ...moduleFilter },
      _count: true,
    });

    // Owner type breakdown
    const ownerBreakdown = await prisma.task.groupBy({
      by: ["ownerType"],
      where: { tenantId: user.tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] }, ...moduleFilter },
      _count: true,
    });

    return {
      data: {
        dailyData,
        slaCompliance,
        avgResolution,
        statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count })),
        ownerBreakdown: ownerBreakdown.map((o) => ({ ownerType: o.ownerType, count: o._count })),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function exportTasksData(format: "csv") {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { error: "Acc�s refus�" };
    }
    const tasks = await prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        parentTaskId: null,
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
      },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    if (format === "csv") {
      const headers = "ID,Titre,Module,Statut,Priorité,Assigné,SLA,Créé,Complété";
      const rows = tasks.map((t) =>
        [
          t.id,
          `"${t.title.replace(/"/g, '""')}"`,
          t.module,
          t.status,
          t.priority,
          t.assignments?.[0]?.user?.name ?? "",
          t.slaDeadline?.toISOString() ?? "",
          t.createdAt.toISOString(),
          t.completedAt?.toISOString() ?? "",
        ].join(",")
      );
      return { data: [headers, ...rows].join("\n") };
    }

    return { error: "Format non supporté" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TASK ATTACHMENTS (links, files, documents)
// ============================================================

export async function getTaskAttachments(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { tenantId: true, module: true } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const data = await Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        downloadUrl: await StorageService.createDownloadUrl(attachment.url),
      }))
    );
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addTaskAttachment(taskId: string, data: {
  name: string;
  url: string;
  type?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { tenantId: true, title: true, module: true } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

    if (!data.name.trim() || !data.url.trim()) return { error: "Nom et URL requis" };

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        userId: user.id,
        name: data.name.trim(),
        url: data.url.trim(),
        type: data.type ?? "link",
      },
      include: { user: { select: { name: true } } },
    });

    // Notify watchers
    await NotificationService.notifyTaskWatchers(
      taskId,
      {
        tenantId: user.tenantId,
        type: "ATTACHMENT_ADDED",
        title: `Pièce jointe ajoutée: ${task.title}`,
        message: `${user.name} a ajouté "${data.name}"`,
      },
      user.id
    );

    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.attachment_added", entityType: "task", entityId: taskId,
      newValue: { name: data.name, url: data.url },
    });

    revalidatePath(`/tasks/${taskId}`);
    return { data: attachment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function removeTaskAttachment(attachmentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: { select: { tenantId: true, module: true } } },
    });
    if (!attachment || attachment.task.tenantId !== user.tenantId) return { error: "Pièce jointe introuvable" };
    if (!canAccessTaskModule(user.role, attachment.task.module)) return { error: "Accès refusé" };

    await prisma.taskAttachment.delete({ where: { id: attachmentId } });

    revalidatePath(`/tasks/${attachment.taskId}`);
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// GANTT CHART DATA
// ============================================================

export async function getGanttData(options?: { module?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 1 month ago
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);   // 3 months ahead
    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { data: { rows: [], modules: [], rangeStart: start, rangeEnd: end, today: now } };
    }
    if (options?.module && options.module !== "all" && allowedModules !== "*" && !allowedModules.includes(options.module)) {
      return { data: { rows: [], modules: [], rangeStart: start, rangeEnd: end, today: now } };
    }

    const tasks = await prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        parentTaskId: null,
        status: { notIn: ["CANCELLED"] },
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
        ...(options?.module && options.module !== "all" && { module: options.module }),
        OR: [
          { slaDeadline: { gte: start, lte: end } },
          { createdAt: { gte: start } },
        ],
      },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        _count: { select: { children: true } },
      },
      orderBy: [{ module: "asc" }, { createdAt: "asc" }],
      take: 200,
    });

    // Build Gantt rows
    const rows = tasks.map((t) => {
      const startDate = t.startedAt ?? t.createdAt;
      const endDate = t.slaDeadline ?? t.completedAt ?? new Date(startDate.getTime() + 7 * 86400000);
      return {
        id: t.id,
        title: t.title,
        module: t.module,
        status: t.status,
        priority: t.priority,
        startDate,
        endDate,
        assignee: t.assignments?.[0]?.user?.name ?? null,
        subtaskCount: t._count.children,
        slaBreach: t.slaBreach,
        completedAt: t.completedAt,
      };
    });

    // Get unique modules for filter
    const modules = [...new Set(rows.map((r) => r.module))];

    return {
      data: {
        rows,
        modules,
        rangeStart: start,
        rangeEnd: end,
        today: now,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// Bridge exports for task extras:
// In a "use server" module, we must only export async functions.
export async function getTaskChecklists(...args: Parameters<typeof taskExtrasActions.getTaskChecklists>) {
  return taskExtrasActions.getTaskChecklists(...args);
}

export async function getTaskWorkflowSnapshot(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { tenantId: true, module: true },
    });

    if (!task || task.tenantId !== user.tenantId) return { error: "Tache introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acces refuse" };

    const snapshot = await TaskWorkflowService.getTaskWorkflowSnapshot(taskId);
    return { data: snapshot };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addChecklistItem(...args: Parameters<typeof taskExtrasActions.addChecklistItem>) {
  return taskExtrasActions.addChecklistItem(...args);
}

export async function toggleChecklistItem(...args: Parameters<typeof taskExtrasActions.toggleChecklistItem>) {
  return taskExtrasActions.toggleChecklistItem(...args);
}

export async function updateChecklistItem(...args: Parameters<typeof taskExtrasActions.updateChecklistItem>) {
  return taskExtrasActions.updateChecklistItem(...args);
}

export async function deleteChecklistItem(...args: Parameters<typeof taskExtrasActions.deleteChecklistItem>) {
  return taskExtrasActions.deleteChecklistItem(...args);
}

export async function toggleCommentReaction(...args: Parameters<typeof taskExtrasActions.toggleCommentReaction>) {
  return taskExtrasActions.toggleCommentReaction(...args);
}

export async function getSavedFilters(...args: Parameters<typeof taskExtrasActions.getSavedFilters>) {
  return taskExtrasActions.getSavedFilters(...args);
}

export async function createSavedFilter(...args: Parameters<typeof taskExtrasActions.createSavedFilter>) {
  return taskExtrasActions.createSavedFilter(...args);
}

export async function deleteSavedFilter(...args: Parameters<typeof taskExtrasActions.deleteSavedFilter>) {
  return taskExtrasActions.deleteSavedFilter(...args);
}

export async function getGoals(...args: Parameters<typeof taskExtrasActions.getGoals>) {
  return taskExtrasActions.getGoals(...args);
}

export async function createGoal(...args: Parameters<typeof taskExtrasActions.createGoal>) {
  return taskExtrasActions.createGoal(...args);
}

export async function updateGoal(...args: Parameters<typeof taskExtrasActions.updateGoal>) {
  return taskExtrasActions.updateGoal(...args);
}

export async function deleteGoal(...args: Parameters<typeof taskExtrasActions.deleteGoal>) {
  return taskExtrasActions.deleteGoal(...args);
}

export async function addKeyResult(...args: Parameters<typeof taskExtrasActions.addKeyResult>) {
  return taskExtrasActions.addKeyResult(...args);
}

export async function updateKeyResult(...args: Parameters<typeof taskExtrasActions.updateKeyResult>) {
  return taskExtrasActions.updateKeyResult(...args);
}

export async function deleteKeyResult(...args: Parameters<typeof taskExtrasActions.deleteKeyResult>) {
  return taskExtrasActions.deleteKeyResult(...args);
}

export async function getRecurringTasks(...args: Parameters<typeof taskExtrasActions.getRecurringTasks>) {
  return taskExtrasActions.getRecurringTasks(...args);
}

export async function createRecurringTask(...args: Parameters<typeof taskExtrasActions.createRecurringTask>) {
  return taskExtrasActions.createRecurringTask(...args);
}

export async function updateRecurringTask(...args: Parameters<typeof taskExtrasActions.updateRecurringTask>) {
  return taskExtrasActions.updateRecurringTask(...args);
}

export async function deleteRecurringTask(...args: Parameters<typeof taskExtrasActions.deleteRecurringTask>) {
  return taskExtrasActions.deleteRecurringTask(...args);
}

export async function updateTaskCustomFields(...args: Parameters<typeof taskExtrasActions.updateTaskCustomFields>) {
  return taskExtrasActions.updateTaskCustomFields(...args);
}

export async function importTasksFromCSV(...args: Parameters<typeof taskExtrasActions.importTasksFromCSV>) {
  return taskExtrasActions.importTasksFromCSV(...args);
}

export async function getCalendarTasks(...args: Parameters<typeof taskExtrasActions.getCalendarTasks>) {
  return taskExtrasActions.getCalendarTasks(...args);
}
