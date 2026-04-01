"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import type { ProjectStatus, ProjectRole, SprintStatus } from "@prisma/client";

function revalidateProjects(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

// ============================================================
// PROJECT QUERIES
// ============================================================

export async function getProjects(options?: {
  status?: ProjectStatus;
  search?: string;
  memberId?: string;
  limit?: number;
  compact?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const where: any = {
      tenantId: user.tenantId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { description: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(options?.memberId
        ? { members: { some: { userId: options.memberId } } }
        : {}),
    };

      const projects = options?.compact
        ? await prisma.project.findMany({
            where,
            select: { id: true, name: true },
            orderBy: { updatedAt: "desc" },
            take: options?.limit ?? 50,
          })
        : await prisma.project.findMany({
            where,
            include: {
              members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
              milestones: { orderBy: { dueDate: "asc" }, take: 5 },
              sprints: { where: { status: "ACTIVE" }, take: 1 },
              _count: { select: { tasks: true, milestones: true, sprints: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: options?.limit ?? 50,
          });

    return { data: projects };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getProject(projectId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
        milestones: { orderBy: { dueDate: "asc" } },
        phases: { orderBy: { order: "asc" } },
        sprints: { orderBy: { startDate: "desc" } },
        budgets: { orderBy: { category: "asc" } },
        tasks: {
          where: { parentTaskId: null },
          include: {
            assignments: { include: { user: { select: { name: true, avatarUrl: true } } } },
            _count: { select: { children: true } },
          },
          orderBy: { position: "asc" },
          take: 100,
        },
      },
    });

    if (!project) return { error: "Projet introuvable" };
    return { data: project };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// PROJECT MUTATIONS
// ============================================================

export async function createProject(formData: {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  icon?: string;
  budgetTotal?: number;
  budgetCurrency?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    if (!formData.name?.trim()) return { error: "Le nom du projet est requis" };

    const project = await prisma.project.create({
      data: {
        tenantId: user.tenantId,
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        ownerId: user.id,
        color: formData.color || "#6366f1",
        icon: formData.icon || undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        budgetTotal: formData.budgetTotal || undefined,
        budgetCurrency: formData.budgetCurrency || "XAF",
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });

    revalidateProjects();
    return { data: project };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
    startDate?: string | null;
    endDate?: string | null;
    color?: string;
    icon?: string;
    budgetTotal?: number | null;
    budgetCurrency?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const existing = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!existing) return { error: "Projet introuvable" };

    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name.trim();
    if (updates.description !== undefined) data.description = updates.description?.trim() || null;
    if (updates.status !== undefined) {
      data.status = updates.status;
      if (updates.status === "COMPLETED") data.completedAt = new Date();
    }
    if (updates.startDate !== undefined)
      data.startDate = updates.startDate ? new Date(updates.startDate) : null;
    if (updates.endDate !== undefined)
      data.endDate = updates.endDate ? new Date(updates.endDate) : null;
    if (updates.color !== undefined) data.color = updates.color;
    if (updates.icon !== undefined) data.icon = updates.icon;
    if (updates.budgetTotal !== undefined)
      data.budgetTotal = updates.budgetTotal ?? null;
    if (updates.budgetCurrency !== undefined)
      data.budgetCurrency = updates.budgetCurrency;

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    revalidateProjects(projectId);
    return { data: project };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteProject(projectId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.manage");

    const existing = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!existing) return { error: "Projet introuvable" };

    await prisma.project.delete({ where: { id: projectId } });
    revalidateProjects();
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// PROJECT MEMBERS
// ============================================================

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole = "MEMBER",
  hourlyRate?: number
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Projet introuvable" };

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role, hourlyRate: hourlyRate ?? undefined },
      create: {
        projectId,
        userId,
        role,
        hourlyRate: hourlyRate ?? undefined,
      },
    });

    revalidateProjects(projectId);
    return { data: member };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Projet introuvable" };

    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    revalidateProjects(projectId);
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// MILESTONES
// ============================================================

export async function createMilestone(
  projectId: string,
  data: { name: string; description?: string; dueDate?: string }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Projet introuvable" };

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    revalidateProjects(projectId);
    return { data: milestone };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateMilestone(
  milestoneId: string,
  updates: { name?: string; dueDate?: string | null; status?: string }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const ms = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!ms) return { error: "Milestone introuvable" };

    const project = await prisma.project.findFirst({
      where: { id: ms.projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Accès refusé" };

    const data: any = {};
    if (updates.name) data.name = updates.name.trim();
    if (updates.dueDate !== undefined)
      data.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    if (updates.status) {
      data.status = updates.status;
      if (updates.status === "ACHIEVED") data.achievedAt = new Date();
    }

    const milestone = await prisma.milestone.update({ where: { id: milestoneId }, data });
    revalidateProjects(ms.projectId);
    return { data: milestone };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// SPRINTS
// ============================================================

export async function createSprint(
  projectId: string,
  data: {
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Projet introuvable" };

    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name: data.name.trim(),
        goal: data.goal?.trim() || undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    revalidateProjects(projectId);
    return { data: sprint };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateSprintStatus(sprintId: string, status: SprintStatus) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) return { error: "Sprint introuvable" };

    const project = await prisma.project.findFirst({
      where: { id: sprint.projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Accès refusé" };

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: { status },
    });

    revalidateProjects(sprint.projectId);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function assignTaskToSprint(taskId: string, sprintId: string | null) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId: user.tenantId },
    });
    if (!task) return { error: "Tâche introuvable" };

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { sprintId },
    });

    revalidatePath("/projects");
    revalidatePath("/tasks");
    if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function assignTaskToProject(
  taskId: string,
  projectId: string | null,
  storyPoints?: number
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId: user.tenantId },
    });
    if (!task) return { error: "Tâche introuvable" };

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId: user.tenantId },
      });
      if (!project) return { error: "Projet introuvable" };
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        projectId,
        storyPoints: storyPoints ?? task.storyPoints,
        // clear sprint when moving to a different project
        ...(projectId !== task.projectId ? { sprintId: null } : {}),
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    if (projectId) revalidatePath(`/projects/${projectId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// BUDGET
// ============================================================

export async function upsertBudgetLine(
  projectId: string,
  data: {
    id?: string;
    category: string;
    label: string;
    planned: number;
    actual?: number;
    currency?: string;
    notes?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return { error: "Projet introuvable" };

    let budget;
    if (data.id) {
      budget = await prisma.budget.update({
        where: { id: data.id },
        data: {
          category: data.category,
          label: data.label.trim(),
          planned: data.planned,
          actual: data.actual ?? 0,
          currency: data.currency || "XAF",
          notes: data.notes?.trim() || undefined,
        },
      });
    } else {
      budget = await prisma.budget.create({
        data: {
          projectId,
          category: data.category,
          label: data.label.trim(),
          planned: data.planned,
          actual: data.actual ?? 0,
          currency: data.currency || "XAF",
          notes: data.notes?.trim() || undefined,
        },
      });
    }

    revalidateProjects(projectId);
    return { data: budget };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// TIME ENTRIES
// ============================================================

export async function logTimeEntry(data: {
  taskId: string;
  minutes: number;
  startedAt: string;
  endedAt?: string;
  description?: string;
  billable?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const task = await prisma.task.findFirst({
      where: { id: data.taskId, tenantId: user.tenantId },
    });
    if (!task) return { error: "Tâche introuvable" };

    // Get member's hourly rate if set
    let hourlyRate: number | undefined;
    let cost: number | undefined;
    if (task.projectId) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
      });
      if (member?.hourlyRate) {
        hourlyRate = Number(member.hourlyRate);
        cost = (data.minutes / 60) * hourlyRate;
      }
    }

    const entry = await prisma.taskTimeEntry.create({
      data: {
        taskId: data.taskId,
        userId: user.id,
        minutes: data.minutes,
        startedAt: new Date(data.startedAt),
        endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
        description: data.description?.trim() || undefined,
        billable: data.billable ?? true,
        hourlyRate,
        cost,
      },
    });

    // Update task actualHours
    await prisma.task.update({
      where: { id: data.taskId },
      data: { actualHours: { increment: data.minutes / 60 } },
    });

    // Update budget actual cost if project member has hourly rate
    if (task.projectId && cost) {
      await prisma.budget.updateMany({
        where: { projectId: task.projectId, category: "LABOR" },
        data: { actual: { increment: cost } },
      });
    }

    revalidatePath(`/tasks/${data.taskId}`);
    if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
    return { data: entry };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTimeEntries(options: {
  taskId?: string;
  projectId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.view");

    const where: any = {};
    if (options.taskId) where.taskId = options.taskId;
    if (options.userId) where.userId = options.userId;
    if (options.startDate || options.endDate) {
      where.startedAt = {
        ...(options.startDate ? { gte: new Date(options.startDate) } : {}),
        ...(options.endDate ? { lte: new Date(options.endDate) } : {}),
      };
    }
    if (options.projectId) {
      where.task = { projectId: options.projectId };
    }

    const entries = await prisma.taskTimeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        task: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 500,
    });

    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    const totalCost = entries.reduce((sum, e) => sum + Number(e.cost ?? 0), 0);

    return { data: { entries, totalMinutes, totalCost } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function approveTimeEntry(entryId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.manage");

    const entry = await prisma.taskTimeEntry.update({
      where: { id: entryId },
      data: { approved: true, approvedBy: user.id, approvedAt: new Date() },
    });

    return { data: entry };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteTimeEntry(entryId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const entry = await prisma.taskTimeEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { error: "Entrée introuvable" };

    // Only author or manager can delete
    if (entry.userId !== user.id) {
      checkPermission(user.role, "task.manage");
    }

    // Revert task actualHours
    await prisma.task.update({
      where: { id: entry.taskId },
      data: { actualHours: { decrement: entry.minutes / 60 } },
    });

    await prisma.taskTimeEntry.delete({ where: { id: entryId } });

    revalidatePath(`/tasks/${entry.taskId}`);
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
