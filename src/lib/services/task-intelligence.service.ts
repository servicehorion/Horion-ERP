/**
 * TASK INTELLIGENCE SERVICE
 * Enterprise-grade analytics for the Operations OS.
 * Powers dashboards, workload analysis, SLA compliance, team performance.
 */

import { prisma } from "@/lib/db";
import type { TaskStatus } from "@prisma/client";

export interface TaskDashboardMetrics {
  totalActive: number;
  pending: number;
  inProgress: number;
  waitingApproval: number;
  blocked: number;
  slaBreaches: number;
  completedToday: number;
  completedThisWeek: number;
  totalCompleted: number;
  totalCancelled: number;
  avgResolutionHours: number;
  myTasks: number;
}

export interface ModuleBreakdown {
  module: string;
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  slaBreaches: number;
}

export interface TeamMemberWorkload {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedCount: number;
  completedCount: number;
  slaBreaches: number;
  inProgressCount: number;
}

export interface PriorityDistribution {
  LOW: number;
  NORMAL: number;
  HIGH: number;
  URGENT: number;
}

export class TaskIntelligenceService {

  /**
   * Full dashboard metrics for the Tasks OS page.
   */
  static async getDashboardMetrics(tenantId: string, userId: string, modules?: string[] | "*"): Promise<TaskDashboardMetrics> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};

    const [
      statusCounts,
      slaBreaches,
      completedToday,
      completedWeek,
      totalCompleted,
      totalCancelled,
      myTasks,
    ] = await Promise.all([
      prisma.task.groupBy({
        by: ["status"],
        where: { tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] }, ...moduleFilter },
        _count: { id: true },
      }),
      prisma.task.count({
        where: { tenantId, slaBreach: true, status: { notIn: ["COMPLETED", "CANCELLED"] }, ...moduleFilter },
      }),
      prisma.task.count({
        where: { tenantId, status: "COMPLETED", completedAt: { gte: todayStart }, ...moduleFilter },
      }),
      prisma.task.count({
        where: { tenantId, status: "COMPLETED", completedAt: { gte: weekStart }, ...moduleFilter },
      }),
      prisma.task.count({ where: { tenantId, status: "COMPLETED", ...moduleFilter } }),
      prisma.task.count({ where: { tenantId, status: "CANCELLED", ...moduleFilter } }),
      prisma.task.count({
        where: {
          tenantId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          assignments: { some: { userId } },
          ...moduleFilter,
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row._count.id;
    }

    const totalActive = Object.values(statusMap).reduce((s, c) => s + c, 0);

    // Compute avg resolution time from recent completed tasks
    const recentCompleted = await prisma.task.findMany({
      where: { tenantId, status: "COMPLETED", completedAt: { not: null }, ...moduleFilter },
      select: { createdAt: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 50,
    });

    let avgHours = 0;
    if (recentCompleted.length > 0) {
      const totalHours = recentCompleted.reduce((sum, t) => {
        const diff = (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        return sum + diff;
      }, 0);
      avgHours = Math.round(totalHours / recentCompleted.length);
    }

    return {
      totalActive,
      pending: statusMap.PENDING ?? 0,
      inProgress: statusMap.IN_PROGRESS ?? 0,
      waitingApproval: statusMap.WAITING_APPROVAL ?? 0,
      blocked: statusMap.BLOCKED ?? 0,
      slaBreaches,
      completedToday,
      completedThisWeek: completedWeek,
      totalCompleted,
      totalCancelled,
      avgResolutionHours: avgHours,
      myTasks,
    };
  }

  /**
   * Breakdown by module with status + SLA counts.
   */
  static async getModuleBreakdown(tenantId: string, modules?: string[] | "*"): Promise<ModuleBreakdown[]> {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    const active = await prisma.task.findMany({
      where: { tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] }, ...moduleFilter },
      select: { module: true, status: true, slaBreach: true },
    });

    const map = new Map<string, ModuleBreakdown>();

    for (const t of active) {
      if (!map.has(t.module)) {
        map.set(t.module, {
          module: t.module,
          total: 0,
          pending: 0,
          inProgress: 0,
          blocked: 0,
          slaBreaches: 0,
        });
      }
      const m = map.get(t.module)!;
      m.total++;
      if (t.status === "PENDING") m.pending++;
      if (t.status === "IN_PROGRESS") m.inProgress++;
      if (t.status === "BLOCKED") m.blocked++;
      if (t.slaBreach) m.slaBreaches++;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  /**
   * Team workload — tasks per team member.
   */
  static async getTeamWorkload(tenantId: string, modules?: string[] | "*"): Promise<TeamMemberWorkload[]> {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    const users = await prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        taskAssignments: {
          include: {
            task: { select: { status: true, slaBreach: true, module: true } },
          },
        },
      },
    });

    return users
      .map((u) => {
        const tasks = moduleFilter.module
          ? u.taskAssignments.map((a) => a.task).filter((t) => moduleFilter.module?.in?.includes(t.module))
          : u.taskAssignments.map((a) => a.task);
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          assignedCount: tasks.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status)).length,
          completedCount: tasks.filter((t) => t.status === "COMPLETED").length,
          slaBreaches: tasks.filter((t) => t.slaBreach && !["COMPLETED", "CANCELLED"].includes(t.status)).length,
          inProgressCount: tasks.filter((t) => t.status === "IN_PROGRESS").length,
        };
      })
      .sort((a, b) => b.assignedCount - a.assignedCount);
  }

  /**
   * Priority distribution for active tasks.
   */
  static async getPriorityDistribution(tenantId: string, modules?: string[] | "*"): Promise<PriorityDistribution> {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    const counts = await prisma.task.groupBy({
      by: ["priority"],
      where: { tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] }, ...moduleFilter },
      _count: { id: true },
    });

    const dist: PriorityDistribution = { LOW: 0, NORMAL: 0, HIGH: 0, URGENT: 0 };
    for (const row of counts) {
      dist[row.priority as keyof PriorityDistribution] = row._count.id;
    }
    return dist;
  }

  /**
   * Get urgencies — HIGH/URGENT priority + SLA breaches.
   */
  static async getUrgencies(tenantId: string, limit = 10, modules?: string[] | "*") {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    return prisma.task.findMany({
      where: {
        tenantId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        ...moduleFilter,
        OR: [
          { priority: { in: ["HIGH", "URGENT"] } },
          { slaBreach: true },
        ],
      },
      include: {
        assignments: { include: { user: { select: { name: true, id: true } } } },
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
      },
      orderBy: [{ slaBreach: "desc" }, { priority: "desc" }, { slaDeadline: "asc" }],
      take: limit,
    });
  }

  /**
   * My tasks for a specific user.
   */
  static async getMyTasks(tenantId: string, userId: string, limit = 20, modules?: string[] | "*") {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    return prisma.task.findMany({
      where: {
        tenantId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        assignments: { some: { userId } },
        ...moduleFilter,
      },
      include: {
        assignments: { include: { user: { select: { name: true, id: true } } } },
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
      },
      orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }],
      take: limit,
    });
  }

  /**
   * Get task by ID with full details.
   */
  static async getTaskDetail(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
        approvals: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { decidedAt: "desc" },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            priority: true,
            totalClient: true,
            currency: true,
            contact: { select: { id: true, name: true, company: true } },
          },
        },
      },
    });
  }

  /**
   * Activity log for a task (from AuditLog).
   */
  static async getTaskActivity(taskId: string) {
    return prisma.auditLog.findMany({
      where: { entityType: "task", entityId: taskId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }

  /**
   * Tasks for Kanban board view (grouped by status).
   */
  static async getKanbanTasks(tenantId: string, module?: string, modules?: string[] | "*") {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    return prisma.task.findMany({
      where: {
        tenantId,
        status: { notIn: ["CANCELLED"] },
        ...(module && module !== "all" && { module }),
        ...moduleFilter,
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }],
      take: 200,
    });
  }
}
