import { prisma } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

/**
 * NotificationService — In-app notification system.
 *
 * Features:
 * - Create notifications for users
 * - Batch notifications (e.g. notify all watchers)
 * - Mark read/unread
 * - Unread count for badges
 * - Task-specific notification helpers
 */
export class NotificationService {
  /**
   * Create a notification for a user.
   */
  static async notify(data: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: string;
  }) {
    return prisma.notification.create({ data });
  }

  /**
   * Notify multiple users at once.
   */
  static async notifyMany(
    userIds: string[],
    data: {
      tenantId: string;
      type: NotificationType;
      title: string;
      message?: string;
      entityType?: string;
      entityId?: string;
    }
  ) {
    if (userIds.length === 0) return;

    return prisma.notification.createMany({
      data: userIds.map((userId) => ({ ...data, userId })),
    });
  }

  /**
   * Notify all watchers of a task.
   */
  static async notifyTaskWatchers(
    taskId: string,
    data: {
      tenantId: string;
      type: NotificationType;
      title: string;
      message?: string;
    },
    excludeUserId?: string
  ) {
    const watchers = await prisma.taskWatcher.findMany({
      where: { taskId },
      select: { userId: true },
    });

    const userIds = watchers
      .map((w) => w.userId)
      .filter((id) => id !== excludeUserId);

    if (userIds.length === 0) return;

    return this.notifyMany(userIds, {
      ...data,
      entityType: "task",
      entityId: taskId,
    });
  }

  /**
   * Notify all assignees of a task.
   */
  static async notifyTaskAssignees(
    taskId: string,
    data: {
      tenantId: string;
      type: NotificationType;
      title: string;
      message?: string;
    },
    excludeUserId?: string
  ) {
    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId },
      select: { userId: true },
    });

    const userIds = assignments
      .map((a) => a.userId)
      .filter((id) => id !== excludeUserId);

    if (userIds.length === 0) return;

    return this.notifyMany(userIds, {
      ...data,
      entityType: "task",
      entityId: taskId,
    });
  }

  /**
   * Get notifications for a user (paginated).
   */
  static async getUserNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
  ) {
    const { unreadOnly = false, limit = 30, offset = 0 } = options;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly && { read: false }),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: {
          userId,
          ...(unreadOnly && { read: false }),
        },
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Get unread count for nav badge.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Mark a notification as read.
   */
  static async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read.
   */
  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  // ── Task-specific notification helpers ──────────────────────────

  /**
   * On task assigned → notify the assignee.
   */
  static async onTaskAssigned(
    taskId: string,
    tenantId: string,
    assigneeId: string,
    taskTitle: string,
    assignedByName: string
  ) {
    return this.notify({
      tenantId,
      userId: assigneeId,
      type: "TASK_ASSIGNED",
      title: `Tâche assignée: ${taskTitle}`,
      message: `${assignedByName} vous a assigné une tâche`,
      entityType: "task",
      entityId: taskId,
    });
  }

  /**
   * On task completed → notify watchers + assignees.
   */
  static async onTaskCompleted(
    taskId: string,
    tenantId: string,
    taskTitle: string,
    completedByUserId?: string
  ) {
    await this.notifyTaskWatchers(
      taskId,
      {
        tenantId,
        type: "TASK_COMPLETED",
        title: `Tâche terminée: ${taskTitle}`,
      },
      completedByUserId
    );

    await this.notifyTaskAssignees(
      taskId,
      {
        tenantId,
        type: "TASK_COMPLETED",
        title: `Tâche terminée: ${taskTitle}`,
      },
      completedByUserId
    );
  }

  /**
   * On SLA breach → notify assignees urgently.
   */
  static async onSLABreach(
    taskId: string,
    tenantId: string,
    taskTitle: string
  ) {
    return this.notifyTaskAssignees(taskId, {
      tenantId,
      type: "SLA_BREACH",
      title: `SLA DÉPASSÉ: ${taskTitle}`,
      message: "Action immédiate requise — le SLA est dépassé",
    });
  }

  /**
   * On approval required → notify admins + direction.
   */
  static async onApprovalRequired(
    taskId: string,
    tenantId: string,
    taskTitle: string
  ) {
    const approvers = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "CEO", "DIRECTION"] },
        isActive: true,
      },
      select: { id: true },
    });

    return this.notifyMany(
      approvers.map((a) => a.id),
      {
        tenantId,
        type: "APPROVAL_REQUIRED",
        title: `Approbation requise: ${taskTitle}`,
        message: "Une tâche nécessite votre approbation",
        entityType: "task",
        entityId: taskId,
      }
    );
  }

  /**
   * On comment added → notify watchers + assignees.
   */
  static async onCommentAdded(
    taskId: string,
    tenantId: string,
    taskTitle: string,
    commentByUserId: string,
    commentByName: string
  ) {
    await this.notifyTaskWatchers(
      taskId,
      {
        tenantId,
        type: "COMMENT_ADDED",
        title: `Commentaire sur: ${taskTitle}`,
        message: `${commentByName} a ajouté un commentaire`,
      },
      commentByUserId
    );

    await this.notifyTaskAssignees(
      taskId,
      {
        tenantId,
        type: "COMMENT_ADDED",
        title: `Commentaire sur: ${taskTitle}`,
        message: `${commentByName} a ajouté un commentaire`,
      },
      commentByUserId
    );
  }

  /**
   * On agent execution completed/failed → notify watchers.
   */
  static async onAgentResult(
    taskId: string,
    tenantId: string,
    taskTitle: string,
    agentName: string,
    success: boolean
  ) {
    const type = success ? "AGENT_COMPLETED" : "AGENT_FAILED";
    const title = success
      ? `Agent terminé: ${taskTitle}`
      : `Agent échoué: ${taskTitle}`;
    const message = success
      ? `L'agent ${agentName} a terminé l'exécution`
      : `L'agent ${agentName} a échoué — intervention requise`;

    await this.notifyTaskWatchers(taskId, { tenantId, type, title, message });
    await this.notifyTaskAssignees(taskId, { tenantId, type, title, message });
  }
}
