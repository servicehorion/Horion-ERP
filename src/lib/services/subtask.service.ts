import { prisma } from "@/lib/db";
import type { Priority } from "@prisma/client";

/**
 * SubtaskService — Parent/child task management with cascading logic.
 *
 * Features:
 * - Create subtasks under a parent
 * - Auto-complete parent when all children complete
 * - Auto-block parent when a child is blocked
 * - Progress calculation (% complete)
 * - Reorder subtasks
 */
export class SubtaskService {
  /**
   * Create a subtask under a parent task.
   */
  static async createSubtask(data: {
    parentTaskId: string;
    title: string;
    description?: string;
    priority?: Priority;
    slaHours?: number;
    module?: string;
    assigneeId?: string;
    tags?: string[];
  }) {
    const parent = await prisma.task.findUnique({
      where: { id: data.parentTaskId },
      select: { tenantId: true, module: true, entityType: true, entityId: true, children: { select: { position: true }, orderBy: { position: "desc" }, take: 1 } },
    });

    if (!parent) throw new Error("Parent task not found");

    const nextPosition = (parent.children[0]?.position ?? -1) + 1;

    const slaDeadline = data.slaHours
      ? new Date(Date.now() + data.slaHours * 3600 * 1000)
      : undefined;

    const subtask = await prisma.task.create({
      data: {
        tenantId: parent.tenantId,
        parentTaskId: data.parentTaskId,
        title: data.title,
        description: data.description,
        module: data.module ?? parent.module,
        taskType: "subtask",
        entityType: parent.entityType,
        entityId: parent.entityId,
        priority: data.priority ?? "NORMAL",
        ownerType: "HUMAN",
        slaDeadline,
        position: nextPosition,
        tags: data.tags ?? [],
        riskLevel: "LOW",
      },
    });

    if (data.assigneeId) {
      await prisma.taskAssignment.create({
        data: { taskId: subtask.id, userId: data.assigneeId },
      });
    }

    return subtask;
  }

  /**
   * Get all subtasks of a parent, ordered by position.
   */
  static async getSubtasks(parentTaskId: string) {
    return prisma.task.findMany({
      where: { parentTaskId },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { position: "asc" },
    });
  }

  /**
   * Calculate completion percentage of a parent's subtasks.
   */
  static async getProgress(parentTaskId: string): Promise<{
    total: number;
    completed: number;
    percent: number;
  }> {
    const children = await prisma.task.findMany({
      where: { parentTaskId },
      select: { status: true },
    });

    const total = children.length;
    const completed = children.filter(
      (c) => c.status === "COMPLETED" || c.status === "CANCELLED"
    ).length;

    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Handle subtask completion — check if parent should auto-complete.
   */
  static async onSubtaskCompleted(subtaskId: string): Promise<boolean> {
    const subtask = await prisma.task.findUnique({
      where: { id: subtaskId },
      select: { parentTaskId: true },
    });

    if (!subtask?.parentTaskId) return false;

    const progress = await this.getProgress(subtask.parentTaskId);

    // If all subtasks completed, mark parent as completed (or WAITING_APPROVAL if approval required)
    if (progress.total > 0 && progress.completed === progress.total) {
      const parent = await prisma.task.findUnique({
        where: { id: subtask.parentTaskId },
        select: { requiredApproval: true, status: true },
      });

      if (parent && !["COMPLETED", "CANCELLED"].includes(parent.status)) {
        const newStatus = parent.requiredApproval ? "WAITING_APPROVAL" : "COMPLETED";
        await prisma.task.update({
          where: { id: subtask.parentTaskId },
          data: {
            status: newStatus,
            ...(newStatus === "COMPLETED" && { completedAt: new Date() }),
          },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Handle subtask blocked — propagate to parent.
   */
  static async onSubtaskBlocked(subtaskId: string): Promise<void> {
    const subtask = await prisma.task.findUnique({
      where: { id: subtaskId },
      select: { parentTaskId: true, title: true },
    });

    if (!subtask?.parentTaskId) return;

    const parent = await prisma.task.findUnique({
      where: { id: subtask.parentTaskId },
      select: { status: true },
    });

    // Don't overwrite completed/cancelled
    if (parent && !["COMPLETED", "CANCELLED", "BLOCKED"].includes(parent.status)) {
      await prisma.task.update({
        where: { id: subtask.parentTaskId },
        data: {
          status: "BLOCKED",
          blockedBy: `Subtask blocked: ${subtask.title}`,
        },
      });
    }
  }

  /**
   * Reorder subtasks (move to position).
   */
  static async reorder(parentTaskId: string, subtaskId: string, newPosition: number) {
    const children = await prisma.task.findMany({
      where: { parentTaskId },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });

    // Recompute positions
    const ordered = children.filter((c) => c.id !== subtaskId);
    ordered.splice(newPosition, 0, { id: subtaskId, position: newPosition });

    const updates = ordered.map((child, index) =>
      prisma.task.update({
        where: { id: child.id },
        data: { position: index },
      })
    );

    await prisma.$transaction(updates);
  }

  /**
   * Get full subtask tree (recursive, max 3 levels deep).
   */
  static async getSubtaskTree(taskId: string, depth = 0): Promise<any> {
    if (depth > 3) return [];

    const children = await prisma.task.findMany({
      where: { parentTaskId: taskId },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { position: "asc" },
    });

    const result = [];
    for (const child of children) {
      const grandchildren = await this.getSubtaskTree(child.id, depth + 1);
      result.push({ ...child, children: grandchildren });
    }

    return result;
  }
}
