import { prisma } from "@/lib/db";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";
import { WhatsappSlaService } from "@/lib/services/whatsapp-sla.service";

export class WhatsappConversationService {
  static async getOrCreateConversation(params: {
    tenantId: string;
    accountId: string;
    waContactId: string;
    ownerId?: string | null;
    assignedToId?: string | null;
    priority?: string | null;
  }) {
    const existing = await prisma.whatsappConversation.findFirst({
      where: {
        tenantId: params.tenantId,
        accountId: params.accountId,
        waContactId: params.waContactId,
      },
    });

    if (existing) return existing;

    const created = await prisma.whatsappConversation.create({
      data: {
        tenantId: params.tenantId,
        accountId: params.accountId,
        waContactId: params.waContactId,
        ownerId: params.ownerId ?? null,
        assignedToId: params.assignedToId ?? null,
        priority: (params.priority ?? "NORMAL") as any,
      },
    });

    await WhatsappAuditService.log({
      tenantId: params.tenantId,
      actorId: params.ownerId ?? undefined,
      action: "whatsapp.conversation_created",
      entityType: "whatsapp_conversation",
      entityId: created.id,
      payload: { waContactId: params.waContactId },
    });

    await WhatsappSlaService.applySla(created.id, params.tenantId, new Date());

    return created;
  }

  static async assignConversation(conversationId: string, userId: string, actorId?: string) {
    const updated = await prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { assignedToId: userId },
    });

    await WhatsappAuditService.log({
      tenantId: updated.tenantId,
      actorId,
      action: "whatsapp.conversation_assigned",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      payload: { assignedToId: userId },
    });

    return updated;
  }

  static async updateStatus(conversationId: string, status: string, actorId?: string) {
    const updated = await prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { status: status as any },
    });

    await WhatsappAuditService.log({
      tenantId: updated.tenantId,
      actorId,
      action: "whatsapp.conversation_status",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      payload: { status },
    });

    return updated;
  }

  static async addTags(conversationId: string, tags: string[]) {
    const convo = await prisma.whatsappConversation.findUnique({ where: { id: conversationId } });
    if (!convo) return null;
    const existing = Array.isArray(convo.tags) ? convo.tags : [];
    const merged = Array.from(new Set([...existing, ...tags]));
    const updated = await prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { tags: merged },
    });

    for (const tag of tags) {
      const record = await prisma.whatsappTag.upsert({
        where: { tenantId_name: { tenantId: convo.tenantId, name: tag } },
        update: {},
        create: { tenantId: convo.tenantId, name: tag },
      });
      await prisma.whatsappConversationTag.upsert({
        where: {
          conversationId_tagId: { conversationId, tagId: record.id },
        },
        update: {},
        create: { conversationId, tagId: record.id },
      });
    }

    return updated;
  }
}
