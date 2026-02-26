import { prisma } from "@/lib/db";
import type { TaskStatus, Prisma } from "@prisma/client";

export class TaskService {
  static async list(
    tenantId: string,
    options: {
      module?: string;
      status?: TaskStatus;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { module, status, page = 1, limit = 20 } = options;

    const where: Prisma.TaskWhereInput = {
      tenantId,
      ...(module && module !== "all" && { module }),
      ...(status && { status }),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignments: { include: { user: true } },
          order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        },
        orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async listByEntity(entityType: string, entityId: string) {
    return prisma.task.findMany({
      where: { entityType, entityId },
      include: {
        assignments: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async updateStatus(taskId: string, newStatus: TaskStatus) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        ...(newStatus === "COMPLETED" && { completedAt: new Date() }),
      },
    });
  }

  static async assignTask(taskId: string, userId: string) {
    return prisma.taskAssignment.upsert({
      where: { taskId_userId: { taskId, userId } },
      update: {},
      create: { taskId, userId, role: "assignee" },
    });
  }

  static async getModuleCounts(tenantId: string, modules?: string[] | "*") {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    const counts = await prisma.task.groupBy({
      by: ["module"],
      where: { tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] }, ...moduleFilter },
      _count: { id: true },
    });

    return counts.reduce(
      (acc, item) => {
        acc[item.module] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  static async getPendingCount(tenantId: string, modules?: string[] | "*") {
    const moduleFilter = modules && modules !== "*" ? { module: { in: modules } } : {};
    return prisma.task.count({
      where: {
        tenantId,
        status: { in: ["PENDING", "IN_PROGRESS", "WAITING_APPROVAL", "BLOCKED"] },
        ...moduleFilter,
      },
    });
  }

  static async checkSLABreaches(tenantId: string) {
    const now = new Date();
    const breached = await prisma.task.updateMany({
      where: {
        tenantId,
        slaBreach: false,
        slaDeadline: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: { slaBreach: true },
    });
    return breached.count;
  }
}
