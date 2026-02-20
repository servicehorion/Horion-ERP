"use server";

import { getSession } from "@/lib/session";
import { TaskService } from "@/lib/services/task.service";
import { TaskIntelligenceService } from "@/lib/services/task-intelligence.service";
import { SubtaskService } from "@/lib/services/subtask.service";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";
import { TaskTemplateService } from "@/lib/services/task-template.service";
import { AgentTaskService } from "@/lib/services/agent-task.service";
import { NotificationService } from "@/lib/services/notification.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { TaskStatus, Priority, DependencyType } from "@prisma/client";

function revalidateTask(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/board");
  revalidatePath("/dashboard");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
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
  slaBreach?: boolean;
  tags?: string[];
  parentTaskId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    const { module, status, priority, search, assigneeId, slaBreach, tags, parentTaskId, page = 1, limit = 50 } = options || {};

    const where: any = {
      tenantId: user.tenantId,
      parentTaskId: parentTaskId ?? null, // only root tasks by default
      ...(module && module !== "all" && { module }),
      ...(status && status !== "all" && { status }),
      ...(priority && priority !== "all" && { priority }),
      ...(slaBreach && { slaBreach: true }),
      ...(assigneeId && { assignments: { some: { userId: assigneeId } } }),
      ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignments: { include: { user: { select: { id: true, name: true } } } },
          order: { select: { orderNumber: true, contact: { select: { name: true } } } },
          _count: { select: { children: true, dependencies: true, comments: true } },
        },
        orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return { data: tasks, total, page, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskById(taskId: string) {
  try {
    const user = await getSession();
    const task = await prisma.task.findUnique({
      where: { id: taskId },
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
        parent: { select: { id: true, title: true } },
      },
    });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskActivity(taskId: string) {
  try {
    await getSession();
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
        include: { user: { select: { name: true } } },
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
        newValue: { comment: c.content },
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
    await TaskService.checkSLABreaches(user.tenantId);

    const [metrics, moduleBreakdown, priorities, urgencies, myTasks, teamWorkload] = await Promise.all([
      TaskIntelligenceService.getDashboardMetrics(user.tenantId, user.id),
      TaskIntelligenceService.getModuleBreakdown(user.tenantId),
      TaskIntelligenceService.getPriorityDistribution(user.tenantId),
      TaskIntelligenceService.getUrgencies(user.tenantId, 10),
      TaskIntelligenceService.getMyTasks(user.tenantId, user.id, 15),
      TaskIntelligenceService.getTeamWorkload(user.tenantId),
    ]);

    return { data: { metrics, moduleBreakdown, priorities, urgencies, myTasks, teamWorkload, currentUserId: user.id } };
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

    const task = await TaskService.updateStatus(taskId, newStatus as TaskStatus);

    // Handle dependency resolution on completion
    if (newStatus === "COMPLETED") {
      await TaskDependencyService.resolveCompletedTask(taskId);
      if (existing.parentTaskId) {
        await SubtaskService.onSubtaskCompleted(taskId);
      }
      await NotificationService.onTaskCompleted(taskId, user.tenantId, task.title, user.id);
    }

    // Handle subtask blocked propagation
    if (newStatus === "BLOCKED" && existing.parentTaskId) {
      await SubtaskService.onSubtaskBlocked(taskId);
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
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    const assignment = await TaskService.assignTask(taskId, userId);
    const assignee = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

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
  assigneeId?: string;
  tags?: string[];
  parentTaskId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const slaDeadline = formData.slaHours
      ? new Date(Date.now() + formData.slaHours * 3600 * 1000)
      : null;

    const task = await prisma.task.create({
      data: {
        tenantId: user.tenantId,
        entityType: "manual",
        entityId: "manual",
        taskType: "manual",
        title: formData.title,
        description: formData.description,
        module: formData.module,
        priority: (formData.priority as Priority) || "NORMAL",
        slaDeadline,
        ownerType: "HUMAN",
        status: "PENDING",
        riskLevel: "LOW",
        tags: formData.tags ?? [],
        parentTaskId: formData.parentTaskId,
      },
    });

    if (formData.assigneeId) {
      await prisma.taskAssignment.create({
        data: { taskId: task.id, userId: formData.assigneeId, role: "assignee" },
      });
      await NotificationService.onTaskAssigned(task.id, user.tenantId, formData.assigneeId, task.title, user.name);
    }

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

export async function addTaskComment(taskId: string, content: string) {
  try {
    const user = await getSession();
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    const comment = await prisma.taskComment.create({
      data: { taskId, userId: user.id, content },
    });

    // Also log in AuditLog for backward compatibility
    await AuditService.log({
      tenantId: user.tenantId, userId: user.id,
      action: "task.comment", entityType: "task", entityId: taskId,
      newValue: { comment: content },
    });

    // Notify watchers + assignees
    await NotificationService.onCommentAdded(taskId, user.tenantId, task.title, user.id, user.name);

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

    const approval = await prisma.approval.create({
      data: { taskId, userId: user.id, decision: decision as any, comment },
    });

    if (decision === "APPROVED") {
      await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date() } });
      await TaskDependencyService.resolveCompletedTask(taskId);
      if (task.parentTaskId) await SubtaskService.onSubtaskCompleted(taskId);
      await NotificationService.onTaskCompleted(taskId, user.tenantId, task.title, user.id);
    } else if (decision === "REJECTED") {
      await prisma.task.update({ where: { id: taskId }, data: { status: "BLOCKED", blockedBy: `Rejected: ${comment || "No reason"}` } });
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
  module?: string;
  assigneeId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const parent = await prisma.task.findUnique({ where: { id: parentTaskId } });
    if (!parent || parent.tenantId !== user.tenantId) return { error: "Tâche parent introuvable" };

    const subtask = await SubtaskService.createSubtask({
      parentTaskId,
      title: data.title,
      description: data.description,
      priority: data.priority as Priority,
      slaHours: data.slaHours,
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
    await getSession();
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
    return { data: await TaskTemplateService.listTemplates(user.tenantId, { module, isActive: true }) };
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

    await prisma.task.updateMany({
      where: { id: { in: taskIds }, tenantId: user.tenantId },
      data: { status: status as TaskStatus, ...(status === "COMPLETED" && { completedAt: new Date() }) },
    });

    // Resolve dependencies for completed tasks
    if (status === "COMPLETED") {
      for (const id of taskIds) {
        await TaskDependencyService.resolveCompletedTask(id);
      }
    }

    revalidateTask();
    return { data: { updated: taskIds.length } };
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

export async function getTeamMembers() {
  try {
    const user = await getSession();
    const members = await prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
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
    const tasks = await TaskIntelligenceService.getKanbanTasks(user.tenantId, module);
    return { data: tasks };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskModuleCounts() {
  try {
    const user = await getSession();
    return { data: await TaskService.getModuleCounts(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getPendingTaskCount() {
  try {
    const user = await getSession();
    return { data: await TaskService.getPendingCount(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
