import { prisma } from "@/lib/db";
import { serializeDecimals } from "@/lib/utils";
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

      const [openConversations, slaBreaches, highIntents, messagesToday, groupsActive, broadcastsScheduled] = await Promise.all([
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
      ]);

      return {
        openConversations,
        slaBreaches,
        highIntents,
        messagesToday,
        groupsActive,
        broadcastsScheduled,
      };
    } catch {
      return {
        openConversations: 0, slaBreaches: 0, highIntents: 0,
        messagesToday: 0, groupsActive: 0, broadcastsScheduled: 0,
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
                  _count: {
                    select: { leads: true },
                  },
                },
              },
            },
          },
          assignedTo: { select: { name: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 60,
      });

      return serializeDecimals(conversations).map((c: any) => ({
        id: c.id,
        contactName: c.contact?.name || c.contact?.phone || "Inconnu",
        contactPhone: c.contact?.phone ?? null,
        linkedContactId: c.contact?.linkedContact?.id ?? null,
        linkedContactName: c.contact?.linkedContact?.name ?? null,
        linkedLeadId: c.contact?.linkedContact?.leads?.[0]?.id ?? null,
        linkedLeadStatus: c.contact?.linkedContact?.leads?.[0]?.status ?? null,
        linkedLeadCount: c.contact?.linkedContact?._count?.leads ?? 0,
        status: c.status,
        priority: c.priority,
        assignedTo: c.assignedTo?.name ?? null,
        lastMessage: c.messages?.[0]?.body ?? null,
        lastMessageAt: c.messages?.[0]?.createdAt?.toISOString?.() ?? c.lastMessageAt?.toISOString?.() ?? null,
        slaDueAt: c.slaDueAt?.toISOString?.() ?? null,
        intentScore: c.intentScore ?? null,
        tags: Array.isArray(c.tags) ? c.tags : [],
      }));
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
