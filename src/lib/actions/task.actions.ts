"use server";

import { getSession } from "@/lib/session";
import { TaskService } from "@/lib/services/task.service";
import { TaskIntelligenceService } from "@/lib/services/task-intelligence.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { TaskStatus, Priority } from "@prisma/client";

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
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    const { module, status, priority, search, assigneeId, slaBreach, page = 1, limit = 50 } = options || {};

    const where: any = {
      tenantId: user.tenantId,
      ...(module && module !== "all" && { module }),
      ...(status && status !== "all" && { status }),
      ...(priority && priority !== "all" && { priority }),
      ...(slaBreach && { slaBreach: true }),
      ...(assigneeId && { assignments: { some: { userId: assigneeId } } }),
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
        },
        orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return { data: tasks, total, page, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des tâches" };
  }
}

export async function getTaskById(taskId: string) {
  try {
    const user = await getSession();
    const task = await TaskIntelligenceService.getTaskDetail(taskId);
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTaskActivity(taskId: string) {
  try {
    await getSession();
    return { data: await TaskIntelligenceService.getTaskActivity(taskId) };
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

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "task.status_changed",
      entityType: "task",
      entityId: taskId,
      oldValue: { status: existing.status },
      newValue: { status: newStatus },
    });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/tasks/board");
    revalidatePath("/dashboard");
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

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "task.assigned",
      entityType: "task",
      entityId: taskId,
      newValue: { assignedTo: assignee?.name, assignedUserId: userId },
    });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/tasks/board");
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
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const slaDeadline = formData.slaHours
      ? new Date(Date.now() + formData.slaHours * 60 * 60 * 1000)
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
      },
    });

    if (formData.assigneeId) {
      await prisma.taskAssignment.create({
        data: { taskId: task.id, userId: formData.assigneeId, role: "assignee" },
      });
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      newValue: { title: task.title, module: task.module },
    });

    revalidatePath("/tasks");
    revalidatePath("/tasks/board");
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur création" };
  }
}

export async function addTaskComment(taskId: string, comment: string) {
  try {
    const user = await getSession();
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tâche introuvable" };

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "task.comment",
      entityType: "task",
      entityId: taskId,
      newValue: { comment },
    });

    revalidatePath(`/tasks/${taskId}`);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

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
    } else if (decision === "REJECTED") {
      await prisma.task.update({ where: { id: taskId }, data: { status: "BLOCKED" } });
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: `task.${decision.toLowerCase()}`,
      entityType: "task",
      entityId: taskId,
      newValue: { decision, comment },
    });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    return { data: approval };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function bulkUpdateTaskStatus(taskIds: string[], status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    await prisma.task.updateMany({
      where: { id: { in: taskIds }, tenantId: user.tenantId },
      data: { status: status as TaskStatus, ...(status === "COMPLETED" && { completedAt: new Date() }) },
    });

    revalidatePath("/tasks");
    revalidatePath("/tasks/board");
    return { data: { updated: taskIds.length } };
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
