"use server";

/**
 * task-extras.actions.ts
 * Secondary task actions split out for compilation performance:
 *   - Checklists
 *   - Comment reactions
 *   - Saved filters
 *   - Goals / OKRs
 *   - Recurring tasks
 *   - Custom fields
 *   - CSV import
 *   - Calendar data
 *
 * All of these are re-exported from task.actions.ts via `export * from ./task-extras.actions`
 * so existing imports do not need to change.
 */

import { getSession } from "@/lib/session";
import { checkPermission, hasPermission } from "@/lib/permissions";
import { canAccessTaskModule, getTaskAllowedModules } from "@/lib/access-control";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { TaskStatus, Priority } from "@prisma/client";

function revalidateTask(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/board");
  revalidatePath("/dashboard");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

// ============================================================
// TASK CHECKLISTS
// ============================================================

export async function getTaskChecklists(taskId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { tenantId: true, module: true } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tache introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acces refuse" };

    const items = await prisma.taskChecklist.findMany({
      where: { taskId },
      orderBy: { position: "asc" },
    });
    return { data: items };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addChecklistItem(taskId: string, text: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { tenantId: true, module: true } });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tache introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acces refuse" };

    const maxPosition = await prisma.taskChecklist.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const position = (maxPosition._max.position ?? 0) + 1;

    const item = await prisma.taskChecklist.create({
      data: { taskId, text: text.trim(), position },
    });

    revalidateTask(taskId);
    return { data: item };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function toggleChecklistItem(checklistId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const item = await prisma.taskChecklist.findUnique({
      where: { id: checklistId },
      include: { task: { select: { tenantId: true, module: true } } },
    });
    if (!item || item.task.tenantId !== user.tenantId) return { error: "Element introuvable" };
    if (!canAccessTaskModule(user.role, item.task.module)) return { error: "Acces refuse" };

    const updated = await prisma.taskChecklist.update({
      where: { id: checklistId },
      data: { checked: !item.checked },
    });

    revalidateTask(item.taskId);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateChecklistItem(checklistId: string, data: { text?: string; position?: number }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const item = await prisma.taskChecklist.findUnique({
      where: { id: checklistId },
      include: { task: { select: { tenantId: true, module: true } } },
    });
    if (!item || item.task.tenantId !== user.tenantId) return { error: "Element introuvable" };
    if (!canAccessTaskModule(user.role, item.task.module)) return { error: "Acces refuse" };

    const updated = await prisma.taskChecklist.update({
      where: { id: checklistId },
      data: {
        ...(data.text !== undefined ? { text: data.text } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      },
    });

    revalidateTask(item.taskId);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteChecklistItem(checklistId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const item = await prisma.taskChecklist.findUnique({
      where: { id: checklistId },
      include: { task: { select: { tenantId: true, module: true } } },
    });
    if (!item || item.task.tenantId !== user.tenantId) return { error: "Element introuvable" };
    if (!canAccessTaskModule(user.role, item.task.module)) return { error: "Acces refuse" };

    await prisma.taskChecklist.delete({ where: { id: checklistId } });
    revalidateTask(item.taskId);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// COMMENT REACTIONS
// ============================================================

export async function toggleCommentReaction(commentId: string, emoji: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: { select: { tenantId: true, module: true } } },
    });
    if (!comment || comment.task.tenantId !== user.tenantId) return { error: "Commentaire introuvable" };
    if (!canAccessTaskModule(user.role, comment.task.module)) return { error: "Acces refuse" };

    const existing = await prisma.taskCommentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId: user.id, emoji } },
    });

    if (existing) {
      await prisma.taskCommentReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.taskCommentReaction.create({
        data: { commentId, userId: user.id, emoji },
      });
    }

    revalidateTask(comment.taskId);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// SAVED FILTERS
// ============================================================

export async function getSavedFilters(entityType: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const filters = await prisma.savedFilter.findMany({
      where: {
        tenantId: user.tenantId,
        entityType,
        OR: [{ userId: user.id }, { isShared: true }],
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return { data: filters };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createSavedFilter(data: {
  name: string;
  entityType: string;
  filters: Record<string, unknown>;
  isShared?: boolean;
  isDefault?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    if (data.isDefault) {
      await prisma.savedFilter.updateMany({
        where: { tenantId: user.tenantId, entityType: data.entityType, userId: user.id },
        data: { isDefault: false },
      });
    }

    const filter = await prisma.savedFilter.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        name: data.name,
        entityType: data.entityType,
        filters: data.filters as any,
        isShared: data.isShared ?? false,
        isDefault: data.isDefault ?? false,
      },
    });

    return { data: filter };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteSavedFilter(filterId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const filter = await prisma.savedFilter.findUnique({ where: { id: filterId } });
    if (!filter || filter.tenantId !== user.tenantId) return { error: "Filtre introuvable" };

    if (filter.userId !== user.id && !hasPermission(user.role, "task.manage")) {
      return { error: "Acces refuse" };
    }

    await prisma.savedFilter.delete({ where: { id: filterId } });
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// GOALS / OKRS
// ============================================================

export async function getGoals() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const goals = await prisma.goal.findMany({
      where: { tenantId: user.tenantId, isArchived: false },
      include: { keyResults: true, owner: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { data: goals };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createGoal(data: {
  title: string;
  description?: string;
  ownerId?: string | null;
  status?: string;
  targetDate?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const goal = await prisma.goal.create({
      data: {
        tenantId: user.tenantId,
        title: data.title,
        description: data.description,
        ownerId: data.ownerId || undefined,
        status: data.status || "ON_TRACK",
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      },
    });

    return { data: goal };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateGoal(
  goalId: string,
  data: {
    title?: string;
    description?: string;
    ownerId?: string | null;
    status?: string;
    targetDate?: string | null;
    progress?: number;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.tenantId !== user.tenantId) return { error: "Objectif introuvable" };

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.targetDate !== undefined
          ? { targetDate: data.targetDate ? new Date(data.targetDate) : null }
          : {}),
        ...(data.progress !== undefined ? { progress: data.progress } : {}),
      },
    });

    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteGoal(goalId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.tenantId !== user.tenantId) return { error: "Objectif introuvable" };

    await prisma.goal.update({ where: { id: goalId }, data: { isArchived: true } });
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addKeyResult(goalId: string, data: { title: string; target: number; unit?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.tenantId !== user.tenantId) return { error: "Objectif introuvable" };

    const kr = await prisma.keyResult.create({
      data: { goalId, title: data.title, target: data.target, unit: data.unit || "%" },
    });

    return { data: kr };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateKeyResult(
  keyResultId: string,
  data: { title?: string; target?: number; current?: number; unit?: string }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const kr = await prisma.keyResult.findUnique({ where: { id: keyResultId }, include: { goal: true } });
    if (!kr || kr.goal.tenantId !== user.tenantId) return { error: "Key result introuvable" };

    const updated = await prisma.keyResult.update({
      where: { id: keyResultId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.target !== undefined ? { target: data.target } : {}),
        ...(data.current !== undefined ? { current: data.current } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
      },
    });

    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteKeyResult(keyResultId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const kr = await prisma.keyResult.findUnique({ where: { id: keyResultId }, include: { goal: true } });
    if (!kr || kr.goal.tenantId !== user.tenantId) return { error: "Key result introuvable" };

    await prisma.keyResult.delete({ where: { id: keyResultId } });
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// RECURRING TASKS
// ============================================================

export async function getRecurringTasks() {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");
    const allowedModules = getTaskAllowedModules(user.role);

    const recurring = await prisma.recurringTask.findMany({
      where: {
        tenantId: user.tenantId,
        ...(allowedModules !== "*" ? { template: { module: { in: allowedModules } } } : {}),
      },
      include: { template: { select: { id: true, name: true, module: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { data: recurring };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createRecurringTask(data: {
  templateId: string;
  cronExpression: string;
  timezone?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.manage");

    const template = await prisma.taskTemplate.findUnique({ where: { id: data.templateId } });
    if (!template || template.tenantId !== user.tenantId) return { error: "Template introuvable" };
    if (!canAccessTaskModule(user.role, template.module)) return { error: "Acces refuse" };

    const recurring = await prisma.recurringTask.create({
      data: {
        tenantId: user.tenantId,
        templateId: data.templateId,
        cronExpression: data.cronExpression,
        timezone: data.timezone || "Africa/Brazzaville",
        isActive: true,
      },
      include: { template: { select: { id: true, name: true, module: true } } },
    });

    return { data: recurring };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateRecurringTask(
  recurringId: string,
  data: { cronExpression?: string; timezone?: string; isActive?: boolean }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.manage");

    const existing = await prisma.recurringTask.findUnique({
      where: { id: recurringId },
      include: { template: true },
    });
    if (!existing || existing.tenantId !== user.tenantId) return { error: "Recurring introuvable" };
    if (!canAccessTaskModule(user.role, existing.template.module)) return { error: "Acces refuse" };

    const updated = await prisma.recurringTask.update({
      where: { id: recurringId },
      data: {
        ...(data.cronExpression ? { cronExpression: data.cronExpression } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { template: { select: { id: true, name: true, module: true } } },
    });

    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteRecurringTask(recurringId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.manage");

    const existing = await prisma.recurringTask.findUnique({ where: { id: recurringId } });
    if (!existing || existing.tenantId !== user.tenantId) return { error: "Recurring introuvable" };

    await prisma.recurringTask.delete({ where: { id: recurringId } });
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CUSTOM FIELDS
// ============================================================

export async function updateTaskCustomFields(taskId: string, customFields: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { tenantId: true, module: true, customFields: true },
    });
    if (!task || task.tenantId !== user.tenantId) return { error: "Tache introuvable" };
    if (!canAccessTaskModule(user.role, task.module)) return { error: "Acces refuse" };

    const reserved = Object.entries(
      task.customFields && typeof task.customFields === "object" && !Array.isArray(task.customFields)
        ? (task.customFields as Record<string, unknown>)
        : {}
    ).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (key.startsWith("__")) acc[key] = value;
      return acc;
    }, {});

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { customFields: { ...reserved, ...customFields } as any },
    });

    revalidateTask(taskId);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CSV IMPORT
// ============================================================

export async function importTasksFromCSV(
  rows: Array<{
    title: string;
    description?: string;
    module?: string;
    priority?: string;
    status?: string;
    slaHours?: number;
    tags?: string[];
    dueDate?: string;
    estimatedHours?: number;
  }>
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const allowedModules = getTaskAllowedModules(user.role);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = rows
      .filter((r) => r.title && r.title.trim().length > 0)
      .map((r) => {
        const module = r.module || "manual";
        if (allowedModules !== "*" && !allowedModules.includes(module)) return null;

        const slaDeadline = r.slaHours ? new Date(Date.now() + r.slaHours * 3600 * 1000) : null;
        return {
          tenantId: user.tenantId,
          entityType: "manual",
          entityId: "manual",
          taskType: "manual",
          title: r.title.trim(),
          description: r.description?.trim() || undefined,
          module,
          priority: (r.priority as Priority) || "NORMAL",
          status: (r.status as TaskStatus) || "PENDING",
          slaDeadline,
          ownerType: "HUMAN",
          riskLevel: "LOW",
          tags: r.tags ?? [],
          dueDate: r.dueDate ? new Date(r.dueDate) : undefined,
          estimatedHours: r.estimatedHours ?? undefined,
        };
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter(Boolean) as any[];

    if (data.length === 0) return { error: "Aucune tache importable" };

    await prisma.task.createMany({ data });

    revalidateTask();
    return { data: { count: data.length } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CALENDAR DATA
// ============================================================

export async function getCalendarTasks(year: number, month: number) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const allowedModules = getTaskAllowedModules(user.role);
    if (allowedModules !== "*" && allowedModules.length === 0) {
      return { data: [] };
    }

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);

    const tasks = await prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        parentTaskId: null,
        ...(allowedModules !== "*" ? { module: { in: allowedModules } } : {}),
        OR: [
          { dueDate: { gte: start, lte: end } },
          { slaDeadline: { gte: start, lte: end } },
        ],
      },
      select: {
        id: true,
        title: true,
        module: true,
        status: true,
        priority: true,
        dueDate: true,
        slaDeadline: true,
      },
      orderBy: [{ dueDate: "asc" }, { slaDeadline: "asc" }],
      // Calendar is bounded by month — 500 tasks/month is a reasonable ceiling
      take: 500,
    });

    return { data: tasks, range: { start, end } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
