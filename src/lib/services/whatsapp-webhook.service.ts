import { prisma } from "@/lib/db";
import { WhatsappBotFlowService } from "@/lib/services/whatsapp-bot-flow.service";
import { WhatsappConversationService } from "@/lib/services/whatsapp-conversation.service";
import { WhatsappIntentService } from "@/lib/services/whatsapp-intent.service";
import { WhatsappMessageService } from "@/lib/services/whatsapp-message.service";
import { WarehouseBridgeService } from "@/lib/services/warehouse-bridge.service";

type MetaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
};

type MetaStatus = {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
};

function mapStatus(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value === "sent") return "SENT";
  if (value === "delivered") return "DELIVERED";
  if (value === "read") return "READ";
  if (value === "failed") return "FAILED";
  return "PENDING";
}

function extractInboundMedia(message: MetaMessage) {
  const media: Array<{ url: string; mimeType?: string; caption?: string }> = [];

  if (message.image?.id) {
    media.push({
      url: `meta-media:${message.image.id}`,
      mimeType: message.image.mime_type,
      caption: message.image.caption,
    });
  }

  if (message.document?.id) {
    media.push({
      url: `meta-media:${message.document.id}`,
      mimeType: message.document.mime_type,
      caption: message.document.caption ?? message.document.filename,
    });
  }

  return media;
}

export class WhatsappWebhookService {
  static async ingest(payload: any) {
    if (payload?.object !== "whatsapp_business_account") {
      return { status: "ignored" };
    }

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id;

        const account = phoneNumberId
          ? await prisma.whatsappAccount.findFirst({ where: { phoneNumberId } })
          : await prisma.whatsappAccount.findFirst({});
        if (!account) continue;

        if (entry.id && account.wabaId !== entry.id) {
          await prisma.whatsappAccount.update({
            where: { id: account.id },
            data: { wabaId: entry.id },
          });
        }

        const statuses: MetaStatus[] = Array.isArray(value.statuses) ? value.statuses : [];
        for (const status of statuses) {
          const existing = await prisma.whatsappWebhookEvent.findUnique({
            where: { accountId_externalId: { accountId: account.id, externalId: status.id } },
          });
          if (!existing) {
            await prisma.whatsappWebhookEvent.create({
              data: {
                accountId: account.id,
                externalId: status.id,
                type: `status:${status.status}`,
                payload,
                processedAt: new Date(),
              },
            });
          }
          const statusDate = status.timestamp ? new Date(Number(status.timestamp) * 1000) : undefined;
          await WhatsappMessageService.updateStatusByExternalId(status.id, mapStatus(status.status), statusDate);
        }

        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const contactByWaId = new Map<string, string>();
        for (const c of contacts) {
          if (c?.wa_id) {
            contactByWaId.set(c.wa_id, c?.profile?.name || c.wa_id);
          }
        }

        const messages: MetaMessage[] = Array.isArray(value.messages) ? value.messages : [];
        for (const message of messages) {
          const existing = await prisma.whatsappWebhookEvent.findUnique({
            where: { accountId_externalId: { accountId: account.id, externalId: message.id } },
          });
          if (existing) continue;

          await prisma.whatsappWebhookEvent.create({
            data: {
              accountId: account.id,
              externalId: message.id,
              type: "message",
              payload,
            },
          });

          let waContact = await prisma.whatsappContact.findFirst({
            where: { tenantId: account.tenantId, phone: message.from },
          });
          if (!waContact) {
            waContact = await prisma.whatsappContact.create({
              data: {
                tenantId: account.tenantId,
                phone: message.from,
                name: contactByWaId.get(message.from) || message.from,
                lastSeenAt: new Date(),
              },
            });
          } else {
            await prisma.whatsappContact.update({
              where: { id: waContact.id },
              data: { lastSeenAt: new Date() },
            });
          }

          const conversation = await WhatsappConversationService.getOrCreateConversation({
            tenantId: account.tenantId,
            accountId: account.id,
            waContactId: waContact.id,
          });
          if (!conversation) continue;

          const body =
            message.text?.body ||
            message.image?.caption ||
            message.document?.caption ||
            message.document?.filename ||
            "";
          const inboundMedia = extractInboundMedia(message);

          const created = await WhatsappMessageService.createMessage({
            tenantId: account.tenantId,
            conversationId: conversation.id,
            direction: "IN",
            type: message.type?.toUpperCase?.() ?? "TEXT",
            body,
            externalId: message.id,
            sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : undefined,
            rawJson: payload,
            media: inboundMedia,
          });

          if (body) {
            const botResult = await WhatsappBotFlowService.handleInbound({
              tenantId: account.tenantId,
              conversationId: conversation.id,
              text: body,
            });
            const shouldDetectIntent = !(botResult?.handled && !botResult.escalated);
            if (shouldDetectIntent) {
              await WhatsappIntentService.detectAndCreate({
                tenantId: account.tenantId,
                conversationId: conversation.id,
                waContactId: waContact.id,
                sourceMessageId: created?.id ?? undefined,
                text: body,
              });
            }
          }

          await WarehouseBridgeService.captureInbound({
            tenantId: account.tenantId,
            conversationId: conversation.id,
            waContactId: waContact.id,
            sourceMessageId: created?.id ?? null,
            rawText: body,
            photoUrls: inboundMedia.map((item) => item.url),
          });

          await prisma.whatsappWebhookEvent.updateMany({
            where: { accountId: account.id, externalId: message.id },
            data: { processedAt: new Date() },
          });
        }
      }
    }

    return { status: "ok" };
  }
}
