import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export class WhatsappNotificationService {
  static async notifyConversationParticipants(params: {
    conversationId: string;
    tenantId: string;
    title: string;
    message: string;
    type: string;
    excludeUserId?: string;
  }) {
    const prismaAny = prisma as any;
    if (!prismaAny.whatsappConversation) return;

    const conversation = await prismaAny.whatsappConversation.findUnique({
      where: { id: params.conversationId },
      include: {
        contact: {
          include: {
            linkedContact: {
              include: { collaborators: true },
            },
          },
        },
      },
    });
    if (!conversation) return;

    const linked = conversation.contact?.linkedContact;
    const ids = uniqueIds([
      conversation.assignedToId,
      conversation.ownerId,
      linked?.ownerId,
      linked?.onboardedById,
      ...(linked?.collaborators?.map((c: any) => c.userId) ?? []),
    ]);

    const recipients = params.excludeUserId
      ? ids.filter((id) => id !== params.excludeUserId)
      : ids;

    if (recipients.length === 0) return;

    await NotificationService.notifyMany(recipients, {
      tenantId: params.tenantId,
      type: params.type as any,
      title: params.title,
      message: params.message,
      entityType: "whatsapp_conversation",
      entityId: params.conversationId,
    });
  }
}
