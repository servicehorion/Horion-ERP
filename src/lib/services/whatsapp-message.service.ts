import { prisma } from "@/lib/db";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";
import { WhatsappSlaService } from "@/lib/services/whatsapp-sla.service";

function normalizeWhatsappPhone(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function hasRealWhatsappProvider(conversation?: { account?: { phoneNumberId?: string | null } | null }) {
  if (process.env.WAHA_BASE_URL?.trim()) return true;
  const phoneNumberId = conversation?.account?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  return Boolean(phoneNumberId && accessToken);
}

export class WhatsappMessageService {
  static async listMessages(conversationId: string, limit = 60) {
    return prisma.whatsappMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { media: true },
    });
  }

  static async createMessage(params: {
    tenantId: string;
    conversationId: string;
    direction: "IN" | "OUT";
    type?: string;
    body?: string;
    externalId?: string;
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
    rawJson?: Record<string, unknown>;
    media?: Array<{ url: string; mimeType?: string; size?: number; caption?: string }>;
  }) {
    const resolvedStatus = params.status ?? (params.direction === "OUT" ? "PENDING" : "DELIVERED");
    const message = await prisma.whatsappMessage.create({
      data: {
        conversationId: params.conversationId,
        direction: params.direction,
        type: (params.type ?? "TEXT") as any,
        body: params.body ?? null,
        externalId: params.externalId ?? null,
        status: resolvedStatus,
        sentAt:
          params.sentAt ??
          (resolvedStatus === "SENT" || resolvedStatus === "DELIVERED" || resolvedStatus === "READ"
            ? new Date()
            : null),
        deliveredAt: params.deliveredAt ?? null,
        readAt: params.readAt ?? null,
        rawJson: (params.rawJson ?? {}) as any,
        media: params.media?.length
          ? {
              create: params.media.map((media) => ({
                url: media.url,
                mimeType: media.mimeType,
                size: media.size,
                caption: media.caption,
              })),
            }
          : undefined,
      },
    });

    const now = new Date();
    await prisma.whatsappConversation.update({
      where: { id: params.conversationId },
      data: {
        lastMessageAt: now,
        ...(params.direction === "IN" ? { lastInboundAt: now } : { lastOutboundAt: now }),
        ...(params.direction === "IN" ? { status: "OPEN" as any } : {}),
      },
    });

    if (params.direction === "IN") {
      await WhatsappSlaService.applySla(params.conversationId, params.tenantId, now);
    }

    await WhatsappAuditService.log({
      tenantId: params.tenantId,
      action: "whatsapp.message",
      entityType: "whatsapp_message",
      entityId: message.id,
      payload: { direction: params.direction, type: params.type },
    });

    return message;
  }

  static async updateStatusByExternalId(
    externalId: string,
    status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED",
    at?: Date,
  ) {
    const now = at || new Date();
    const data: Record<string, unknown> = { status };
    if (status === "SENT") data.sentAt = now;
    if (status === "DELIVERED") data.deliveredAt = now;
    if (status === "READ") data.readAt = now;
    await prisma.whatsappMessage.updateMany({
      where: { externalId },
      data: data as any,
    });
  }

  static async sendText(params: { conversationId: string; body: string; tenantId: string }) {
    const conversation = await prisma.whatsappConversation.findUnique({
      where: { id: params.conversationId },
      include: { contact: true, account: true },
    });
    if (!conversation) throw new Error("Conversation introuvable");

    const normalizedPhone = normalizeWhatsappPhone(conversation.contact.phone);
    if (!normalizedPhone) throw new Error("Numero WhatsApp introuvable");

    const wahaBase = process.env.WAHA_BASE_URL;
    const wahaKey = process.env.WAHA_API_KEY;
    if (wahaBase) {
      const response = await fetch(`${wahaBase}/api/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(wahaKey ? { "X-Api-Key": wahaKey } : {}),
        },
        body: JSON.stringify({
          chatId: `${normalizedPhone}@c.us`,
          text: params.body,
          session: "default",
        }),
      });
      const payload = await response.json().catch(() => null);
      return this.createMessage({
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        direction: "OUT",
        type: "TEXT",
        body: params.body,
        externalId: payload?.id ?? payload?.messageId ?? undefined,
        status: response.ok ? "SENT" : "FAILED",
        rawJson: payload || { provider: "waha", error: `HTTP ${response.status}` },
      });
    }

    const phoneNumberId = conversation.account?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!hasRealWhatsappProvider(conversation)) {
      console.warn("[WhatsApp] No WAHA or Meta provider configured - storing outbound message as pending");
      return this.createMessage({
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        direction: "OUT",
        type: "TEXT",
        body: params.body,
        status: "PENDING",
        rawJson: { localOnly: true, provider: "none" },
      });
    }

    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: { body: params.body },
      }),
    });

    const payload = await response.json().catch(() => null);
    return this.createMessage({
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      direction: "OUT",
      type: "TEXT",
      body: params.body,
      externalId: payload?.messages?.[0]?.id,
      status: response.ok ? "SENT" : "FAILED",
      rawJson: payload || { provider: "meta", error: `HTTP ${response.status}` },
    });
  }

  static async sendMedia(params: {
    conversationId: string;
    tenantId: string;
    mediaType: "image" | "video" | "document" | "audio";
    mediaUrl: string;
    caption?: string;
  }) {
    const conversation = await prisma.whatsappConversation.findUnique({
      where: { id: params.conversationId },
      include: { contact: true, account: true },
    });
    if (!conversation) throw new Error("Conversation introuvable");

    const normalizedPhone = normalizeWhatsappPhone(conversation.contact.phone);
    if (!normalizedPhone) throw new Error("Numero WhatsApp introuvable");

    const wahaBase = process.env.WAHA_BASE_URL;
    const wahaKey = process.env.WAHA_API_KEY;
    const phoneNumberId = conversation.account?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    let externalId: string | undefined;
    let status: "PENDING" | "SENT" | "FAILED" = "PENDING";
    let rawJson: Record<string, unknown> = {};

    if (wahaBase) {
      const endpoint = params.mediaType === "image" ? "/api/sendImage" : "/api/sendFile";
      const response = await fetch(`${wahaBase}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(wahaKey ? { "X-Api-Key": wahaKey } : {}),
        },
        body: JSON.stringify({
          chatId: `${normalizedPhone}@c.us`,
          file: { url: params.mediaUrl },
          caption: params.caption,
          session: "default",
        }),
      });
      const payload = await response.json().catch(() => null);
      externalId = payload?.id ?? payload?.messageId;
      status = response.ok ? "SENT" : "FAILED";
      rawJson = payload || { provider: "waha", error: `HTTP ${response.status}` };
    } else if (phoneNumberId && accessToken) {
      const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: params.mediaType,
          [params.mediaType]: {
            link: params.mediaUrl,
            ...(params.caption ? { caption: params.caption } : {}),
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      externalId = payload?.messages?.[0]?.id;
      status = response.ok ? "SENT" : "FAILED";
      rawJson = payload || { provider: "meta", error: `HTTP ${response.status}` };
    } else {
      rawJson = { localOnly: true, provider: "none" };
    }

    return this.createMessage({
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      direction: "OUT",
      type: params.mediaType.toUpperCase(),
      body: params.caption,
      externalId,
      status,
      rawJson,
      media: [{ url: params.mediaUrl, caption: params.caption }],
    });
  }
}
