import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { WhatsappNotificationService } from "@/lib/services/whatsapp-notification.service";

const WHATSAPP_TASK_ROLES: UserRole[] = ["COMMUNITY_MANAGER", "COMMERCIAL", "CRM_MANAGER", "OPS"];
const WHATSAPP_FALLBACK_ROLES: UserRole[] = ["DIRECTION", "ADMIN", "CEO"];

export class WhatsappSlaService {
  static isWaitingOnUs(params: { lastInboundAt?: Date | null; lastOutboundAt?: Date | null }) {
    if (!params.lastInboundAt) return false;
    if (!params.lastOutboundAt) return true;
    return params.lastInboundAt.getTime() > params.lastOutboundAt.getTime();
  }

  static async computeSlaDueAt(tenantId: string, baseTime: Date) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings ?? {}) as Prisma.JsonObject;
    const configuredHours = settings.whatsappSlaHours;
    const hours = typeof configuredHours === "number" ? configuredHours : Number(configuredHours ?? 4);
    return new Date(baseTime.getTime() + hours * 3600 * 1000);
  }

  static async applySla(conversationId: string, tenantId: string, baseTime: Date) {
    const slaDueAt = await this.computeSlaDueAt(tenantId, baseTime);
    await prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { slaDueAt },
    });
  }

  static async createBreachFollowupTask(conversationId: string) {
    const conversation = await prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: {
          include: {
            linkedContact: {
              select: {
                id: true,
                name: true,
                orders: {
                  take: 1,
                  orderBy: { createdAt: "desc" },
                  select: { orderNumber: true },
                },
              },
            },
          },
        },
      },
    });

    if (!conversation) return null;
    if (!this.isWaitingOnUs({ lastInboundAt: conversation.lastInboundAt, lastOutboundAt: conversation.lastOutboundAt })) {
      return null;
    }

    const orderNumber = conversation.contact?.linkedContact?.orders?.[0]?.orderNumber ?? null;
    const subject =
      orderNumber ||
      conversation.contact?.linkedContact?.name ||
      conversation.contact?.name ||
      conversation.contact?.phone ||
      "conversation WhatsApp";

    const created = await OperationalTaskService.create({
      tenantId: conversation.tenantId,
      entityType: "whatsapp_conversation",
      entityId: conversation.id,
      taskType: "whatsapp_sla_breach",
      title: `SLA WhatsApp depasse - ${subject}`,
      description: `Le client attend toujours une reponse sur ${subject}. Reprendre la conversation et confirmer la prochaine action.`,
      module: "whatsapp",
      priority: conversation.intentScore === "URGENT" ? "URGENT" : "HIGH",
      ownerType: "SYSTEM",
      riskLevel: conversation.intentScore === "URGENT" ? "HIGH" : "LOW",
      slaHours: 1,
      dueInHours: 1,
      tags: ["whatsapp", "sla-breach"],
      assigneeId: conversation.assignedToId ?? conversation.ownerId ?? null,
      assigneeRoles: WHATSAPP_TASK_ROLES,
      fallbackRoles: WHATSAPP_FALLBACK_ROLES,
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    });

    await WhatsappNotificationService.notifyConversationParticipants({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      title: "SLA WhatsApp depasse",
      message: `Une relance operateur est requise pour ${subject}.`,
      type: "WHATSAPP_SLA_BREACH",
    });

    return created;
  }

  static async checkBreaches(tenantId?: string | null) {
    const now = new Date();
    const conversations = await prisma.whatsappConversation.findMany({
      where: {
        status: { not: "CLOSED" },
        slaDueAt: { not: null, lt: now },
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        lastInboundAt: true,
        lastOutboundAt: true,
      },
    });

    let created = 0;
    for (const conversation of conversations) {
      if (!this.isWaitingOnUs(conversation)) continue;
      const task = await this.createBreachFollowupTask(conversation.id);
      if (task?.taskId) created += 1;
    }

    return created;
  }
}
