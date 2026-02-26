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
import {
  canAccessTaskModule,
  getTaskAllowedModules,
  getTaskRolesForModule,
  getTaskRolesForModules,
} from "@/lib/access-control";
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
    checkPermission(user.role, "task.view");
    const { module, status, priority, search, assigneeId, slaBreach, tags, parentTaskId, page = 1, limit = 50 } = options || {};

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
        parent: { select: { id: true, title: true } },
      },
    });
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };
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
    if (!task) return { error: "TÃƒÂ¢che introuvable" };
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
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);
    await TaskService.checkSLABreaches(user.tenantId);

    const [metrics, moduleBreakdown, priorities, urgencies, myTasks, teamWorkload] = await Promise.all([
      TaskIntelligenceService.getDashboardMetrics(user.tenantId, user.id, allowedModules),
      TaskIntelligenceService.getModuleBreakdown(user.tenantId, allowedModules),
      TaskIntelligenceService.getPriorityDistribution(user.tenantId, allowedModules),
      TaskIntelligenceService.getUrgencies(user.tenantId, 10, allowedModules),
      TaskIntelligenceService.getMyTasks(user.tenantId, user.id, 15, allowedModules),
      TaskIntelligenceService.getTeamWorkload(user.tenantId, allowedModules),
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
    if (!canAccessTaskModule(user.role, formData.module)) return { error: "Accès refusé" };

    if (formData.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: formData.assigneeId },
        select: { id: true, name: true, role: true, tenantId: true },
      });
      if (!assignee || assignee.tenantId !== user.tenantId) return { error: "Utilisateur introuvable" };
      if (!canAccessTaskModule(assignee.role, formData.module)) {
        return { error: "Assignation impossible: rôle non autorisé" };
      }
    }

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing || existing.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, existing.module)) return { error: "AccÃ¨s refusÃ©" };

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
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

    const assignee = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, tenantId: true },
    });
    if (!assignee || assignee.tenantId !== user.tenantId) return { error: "Utilisateur introuvable" };
    if (!canAccessTaskModule(assignee.role, task.module)) {
      return { error: "Assignation impossible: rôle non autorisé" };
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
    return { error: error instanceof Error ? error.message : "Erreur crÃ©ation" };
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };
    if (data.module && !canAccessTaskModule(user.role, data.module)) return { error: "Accès refusé" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

    const dependsOn = await prisma.task.findUnique({
      where: { id: dependsOnId },
      select: { tenantId: true, module: true },
    });
    if (!dependsOn || dependsOn.tenantId !== user.tenantId) return { error: "Tâche dépendance introuvable" };
    if (!canAccessTaskModule(user.role, dependsOn.module)) return { error: "Accès refusé" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

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
          title: `${user.name} vous a mentionnÃ©`,
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Accès refusé" };

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
      title: `TÃ¢che ${decision.toLowerCase()}: ${task.title}`,
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
    if (!parent || parent.tenantId !== user.tenantId) return { error: "TÃ¢che parent introuvable" };
    if (!canAccessTaskModule(user.role, parent.module)) return { error: "AccÃ¨s refusÃ©" };
    const targetModule = data.module ?? parent.module;
    if (!canAccessTaskModule(user.role, targetModule)) return { error: "Accès refusé" };

    if (data.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: data.assigneeId },
        select: { id: true, role: true, tenantId: true },
      });
      if (!assignee || assignee.tenantId !== user.tenantId) return { error: "Utilisateur introuvable" };
      if (!canAccessTaskModule(assignee.role, targetModule)) {
        return { error: "Assignation impossible: rôle non autorisé" };
      }
    }

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
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const parent = await prisma.task.findUnique({
      where: { id: parentTaskId },
      select: { tenantId: true, module: true },
    });
    if (!parent || parent.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    if (!canAccessTaskModule(user.role, parent.module)) return { error: "Accès refusé" };
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };

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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };

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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };
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
    if (!canAccessTaskModule(user.role, formData.module)) return { error: "Accès refusé" };

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
    if (!template || template.tenantId !== user.tenantId) return { error: "Modèle introuvable" };
    if (!canAccessTaskModule(user.role, template.module)) return { error: "Accès refusé" };

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
    if (!original || original.tenantId !== user.tenantId) return { error: "Modèle introuvable" };

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
        subtaskDefinitions: original.subtaskDefinitions,
        dependencyDefinitions: original.dependencyDefinitions,
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };

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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };

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
      include: { children: true },
    });
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };

    const copy = await prisma.task.create({
      data: {
        tenantId: task.tenantId,
        title: `${task.title} (copie)`,
        description: task.description,
        module: task.module,
        taskType: task.taskType,
        entityType: task.entityType,
        entityId: task.entityId,
        priority: task.priority,
        riskLevel: task.riskLevel,
        ownerType: task.ownerType,
        estimatedHours: task.estimatedHours,
        tags: task.tags,
        slaDeadline: task.slaDeadline ? new Date(Date.now() + (task.slaDeadline.getTime() - task.createdAt.getTime())) : null,
        requiredApproval: task.requiredApproval,
        automationAllowed: task.automationAllowed,
      },
    });

    // Duplicate children
    for (const child of task.children) {
      await prisma.task.create({
        data: {
          tenantId: child.tenantId,
          parentTaskId: copy.id,
          title: child.title,
          description: child.description,
          module: child.module,
          taskType: child.taskType,
          entityType: child.entityType,
          entityId: child.entityId,
          priority: child.priority,
          riskLevel: child.riskLevel,
          ownerType: child.ownerType,
          tags: child.tags,
          position: child.position,
        },
      });
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };

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
      return { error: "Accès refusé" };
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
      const headers = "ID,Titre,Module,Statut,PrioritÃ©,AssignÃ©,SLA,CrÃ©Ã©,ComplÃ©tÃ©";
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

    return { error: "Format non supportÃ©" };
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { data: attachments };
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
    if (!task || task.tenantId !== user.tenantId) return { error: "TÃ¢che introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "AccÃ¨s refusÃ©" };

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
        title: `PiÃ¨ce jointe ajoutÃ©e: ${task.title}`,
        message: `${user.name} a ajoutÃ© "${data.name}"`,
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
    if (!attachment || attachment.task.tenantId !== user.tenantId) return { error: "PiÃ¨ce jointe introuvable" };
    if (!canAccessTaskModule(user.role, attachment.task.module)) return { error: "AccÃ¨s refusÃ©" };

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

