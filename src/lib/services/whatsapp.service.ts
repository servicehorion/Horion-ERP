import { prisma } from "@/lib/db";
import { serializeDecimals } from "@/lib/utils";
import { WhatsappCopilotService } from "@/lib/services/whatsapp-copilot.service";
import type {
  WhatsAppAccountItem,
  WhatsAppCampaignItem,
  WhatsAppConversationItem,
  WhatsAppDashboardStats,
  WhatsAppGroupItem,
  WhatsAppIntentItem,
  WhatsAppTemplateItem,
} from "@/lib/types/whatsapp";

export class WhatsAppService {
  static async getDashboard(tenantId: string): Promise<WhatsAppDashboardStats> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        openConversations,
        slaBreaches,
        highIntents,
        messagesToday,
        groupsActive,
        broadcastsScheduled,
        responseSnapshots,
        unlinkedConversations,
      ] = await Promise.all([
        prisma.whatsappConversation.count({ where: { tenantId, status: { not: "CLOSED" } } }),
        prisma.whatsappConversation.count({
          where: {
            tenantId,
            status: { not: "CLOSED" },
            slaDueAt: { not: null, lt: now },
          },
        }),
        prisma.whatsappIntent.count({
          where: {
            tenantId,
            status: { in: ["DETECTED", "QUALIFIED"] },
            score: { in: ["HIGH", "URGENT"] },
          },
        }),
        prisma.whatsappMessage.count({ where: { createdAt: { gte: todayStart }, conversation: { tenantId } } }),
        prisma.whatsappChannel.count({ where: { tenantId, type: "GROUP", status: "active" } }),
        prisma.whatsappCampaign.count({ where: { tenantId, status: "SCHEDULED" } }),
        prisma.whatsappConversation.findMany({
          where: {
            tenantId,
            status: { not: "CLOSED" },
            lastInboundAt: { not: null },
          },
          select: { lastInboundAt: true, lastOutboundAt: true },
        }),
        prisma.whatsappConversation.count({
          where: {
            tenantId,
            contact: { linkedContactId: null },
            status: { not: "CLOSED" },
          },
        }),
      ]);

      const needsReply = responseSnapshots.filter((item) => {
        if (!item.lastInboundAt) return false;
        if (!item.lastOutboundAt) return true;
        return item.lastInboundAt.getTime() > item.lastOutboundAt.getTime();
      }).length;

      return {
        openConversations,
        slaBreaches,
        highIntents,
        messagesToday,
        groupsActive,
        broadcastsScheduled,
        needsReply,
        unlinkedConversations,
      };
    } catch {
      return {
        openConversations: 0, slaBreaches: 0, highIntents: 0,
        messagesToday: 0, groupsActive: 0, broadcastsScheduled: 0,
        needsReply: 0, unlinkedConversations: 0,
      };
    }
  }

  static async listConversations(tenantId: string, scope?: Record<string, unknown>): Promise<WhatsAppConversationItem[]> {
    try {
      const conversations = await prisma.whatsappConversation.findMany({
        where: scope ? { ...scope } : { tenantId },
        include: {
          contact: {
            include: {
              linkedContact: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  whatsapp: true,
                  leads: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: { id: true, status: true },
                  },
                  demandIntakes: {
                    take: 1,
                    orderBy: { receivedAt: "desc" },
                    select: {
                      id: true,
                      status: true,
                      urgency: true,
                      receivedAt: true,
                    },
                  },
                  orders: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: {
                      id: true,
                      orderNumber: true,
                      status: true,
                      payments: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: { status: true },
                      },
                      shipments: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: { status: true },
                      },
                    },
                  },
                  _count: {
                    select: { leads: true, orders: true, demandIntakes: true },
                  },
                },
              },
            },
          },
          assignedTo: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { media: true },
          },
          intents: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              summary: true,
              score: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 60,
      });

      return serializeDecimals(conversations).map((c: any) => {
        const linkedDemand = c.contact?.linkedContact?.demandIntakes?.[0] ?? null;
        const latestOrder = c.contact?.linkedContact?.orders?.[0] ?? null;
        const latestIntent = c.intents?.[0] ?? null;
        const copilot = WhatsappCopilotService.buildSnapshot({
          status: c.status,
          lastMessage: c.messages?.[0]?.body ?? null,
          intentScore: c.intentScore ?? latestIntent?.score ?? null,
          latestIntentSummary: latestIntent?.summary ?? null,
          linkedContactId: c.contact?.linkedContact?.id ?? null,
          linkedLeadId: c.contact?.linkedContact?.leads?.[0]?.id ?? null,
          linkedDemandId: linkedDemand?.id ?? null,
          latestOrderId: latestOrder?.id ?? null,
          latestOrderStatus: latestOrder?.status ?? null,
          latestPaymentStatus: latestOrder?.payments?.[0]?.status ?? null,
          latestShipmentStatus: latestOrder?.shipments?.[0]?.status ?? null,
          assignedToId: c.assignedTo?.id ?? c.assignedToId ?? null,
          lastInboundAt: c.lastInboundAt ?? null,
          lastOutboundAt: c.lastOutboundAt ?? null,
          slaDueAt: c.slaDueAt ?? null,
          tags: Array.isArray(c.tags) ? c.tags : [],
        });

        return {
          id: c.id,
          contactName: c.contact?.name || c.contact?.phone || "Inconnu",
          contactPhone: c.contact?.phone ?? null,
          linkedContactId: c.contact?.linkedContact?.id ?? null,
          linkedContactName: c.contact?.linkedContact?.name ?? null,
          linkedLeadId: c.contact?.linkedContact?.leads?.[0]?.id ?? null,
          linkedLeadStatus: c.contact?.linkedContact?.leads?.[0]?.status ?? null,
          linkedLeadCount: c.contact?.linkedContact?._count?.leads ?? 0,
          linkedDemandId: linkedDemand?.id ?? null,
          linkedDemandStatus: linkedDemand?.status ?? null,
          linkedDemandUrgency: linkedDemand?.urgency ?? null,
          linkedDemandReceivedAt: linkedDemand?.receivedAt?.toISOString?.() ?? null,
          latestOrderId: latestOrder?.id ?? null,
          latestOrderNumber: latestOrder?.orderNumber ?? null,
          latestOrderStatus: latestOrder?.status ?? null,
          latestPaymentStatus: latestOrder?.payments?.[0]?.status ?? null,
          latestShipmentStatus: latestOrder?.shipments?.[0]?.status ?? null,
          status: c.status,
          priority: c.priority,
          assignedTo: c.assignedTo?.name ?? null,
          assignedToId: c.assignedTo?.id ?? c.assignedToId ?? null,
          ownerName: c.owner?.name ?? null,
          ownerId: c.owner?.id ?? c.ownerId ?? null,
          lastMessage: c.messages?.[0]?.body ?? null,
          lastMessageAt: c.messages?.[0]?.createdAt?.toISOString?.() ?? c.lastMessageAt?.toISOString?.() ?? null,
          slaDueAt: c.slaDueAt?.toISOString?.() ?? null,
          intentScore: c.intentScore ?? latestIntent?.score ?? null,
          latestIntentId: latestIntent?.id ?? null,
          latestIntentSummary: latestIntent?.summary ?? null,
          latestIntentStatus: latestIntent?.status ?? null,
          responseState: copilot.responseState,
          slaState: copilot.slaState,
          mediaCount: Array.isArray(c.messages?.[0]?.media) ? c.messages[0].media.length : 0,
          copilotSummary: copilot.summary,
          copilotNextAction: copilot.nextAction,
          copilotMissingFields: copilot.missingFields,
          tags: Array.isArray(c.tags) ? c.tags : [],
        };
      });
    } catch {
      return [];
    }
  }

  static async listIntents(tenantId: string, scope?: Record<string, unknown>): Promise<WhatsAppIntentItem[]> {
    try {
      const intents = await prisma.whatsappIntent.findMany({
        where: scope ? { ...scope } : { tenantId },
        include: {
          whatsappContact: true,
          contact: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return serializeDecimals(intents).map((i: any) => ({
        id: i.id,
        contactName: i.contact?.name || i.whatsappContact?.name || i.whatsappContact?.phone || "Inconnu",
        contactPhone: i.contact?.whatsapp || i.whatsappContact?.phone || null,
        score: i.score,
        status: i.status,
        summary: i.summary ?? null,
        createdAt: i.createdAt?.toISOString?.() ?? null,
        crmIntentId: i.crmIntentId ?? null,
      }));
    } catch {
      return [];
    }
  }

  static async listGroups(tenantId: string): Promise<WhatsAppGroupItem[]> {
    try {
      const groups = await prisma.whatsappChannel.findMany({
        where: { tenantId, type: "GROUP" },
        orderBy: { membersCount: "desc" },
        take: 50,
      });

      return serializeDecimals(groups).map((g: any) => ({
        id: g.id,
        name: g.name,
        category: g.category ?? null,
        membersCount: g.membersCount ?? 0,
        status: g.status ?? "active",
        lastMessageAt: g.lastMessageAt?.toISOString?.() ?? null,
      }));
    } catch {
      return [];
    }
  }

  static async listCampaigns(tenantId: string): Promise<WhatsAppCampaignItem[]> {
    try {
      const campaigns = await prisma.whatsappCampaign.findMany({
        where: { tenantId },
        include: { sends: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return serializeDecimals(campaigns).map((c: any) => ({
        id: c.id,
        name: c.name,
        objective: c.objective ?? null,
        segment: c.segment ?? null,
        status: c.status,
        scheduledAt: c.scheduledAt?.toISOString?.() ?? null,
        sentCount: c.sends?.length ?? 0,
      }));
    } catch {
      return [];
    }
  }

  static async listTemplates(tenantId: string): Promise<WhatsAppTemplateItem[]> {
    try {
      const templates = await prisma.whatsappTemplate.findMany({
        where: { tenantId },
        include: {
          versions: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });

      return serializeDecimals(templates).map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category ?? null,
        language: t.language ?? "fr",
        status: t.status,
        versions: t._count?.versions ?? 0,
        latestVersionId: t.versions?.[0]?.id ?? null,
        latestVersionStatus: t.versions?.[0]?.status ?? null,
        latestVersionBody: t.versions?.[0]?.body ?? null,
      }));
    } catch {
      return [];
    }
  }

  static async listAccounts(tenantId: string): Promise<WhatsAppAccountItem[]> {
    try {
      const accounts = await prisma.whatsappAccount.findMany({ where: { tenantId } });
      return serializeDecimals(accounts).map((a: any) => ({
        id: a.id,
        provider: a.provider ?? "waha",
        displayName: a.displayName ?? null,
        phoneNumberId: a.phoneNumberId ?? null,
        status: a.status ?? "active",
      }));
    } catch {
      return [];
    }
  }
}
