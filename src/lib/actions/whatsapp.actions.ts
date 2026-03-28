"use server";

import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { WhatsAppService } from "@/lib/services/whatsapp.service";
import { WhatsappConversationService } from "@/lib/services/whatsapp-conversation.service";
import { WhatsappMessageService } from "@/lib/services/whatsapp-message.service";
import { WhatsappIntentService } from "@/lib/services/whatsapp-intent.service";
import { WhatsappTemplateService } from "@/lib/services/whatsapp-template.service";
import { WhatsappBroadcastService } from "@/lib/services/whatsapp-broadcast.service";
import { WhatsappNotificationService } from "@/lib/services/whatsapp-notification.service";
import { WhatsappBotFlowService } from "@/lib/services/whatsapp-bot-flow.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { CrmTaskOrchestratorService } from "@/lib/services/crm-task-orchestrator.service";
import { SourcingTicketService } from "@/lib/services/sourcing-ticket.service";
import { getCrmContactScopeWithDelegation, getModuleScopeWithDelegation } from "@/lib/access-control";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { serializeDecimals } from "@/lib/utils";
import type {
  WhatsAppAccountItem,
  WhatsAppAssignableUserItem,
  WhatsAppCampaignItem,
  WhatsAppConversationItem,
  WhatsAppDashboardStats,
  WhatsAppGroupItem,
  WhatsAppIntentItem,
  WhatsAppMessageItem,
  WhatsAppTemplateItem,
  WhatsAppBotFlowItem,
} from "@/lib/types/whatsapp";

type UserLike = { id: string; tenantId: string; role: any };

async function findCommunityManager(tenantId: string) {
  return prisma.user.findFirst({
    where: { tenantId, isActive: true, role: "COMMUNITY_MANAGER" },
    select: { id: true },
  });
}

async function getWhatsappConversationScope(user: UserLike) {
  const scope = await getModuleScopeWithDelegation(user, "whatsapp");
  if (scope.type === "none") return null;
  if (scope.type === "full") return { tenantId: user.tenantId };

  const baseOr = Array.isArray((scope.where as any).OR) ? (scope.where as any).OR : [];
  const crmScope = await getCrmContactScopeWithDelegation(user);
  const contactScope = crmScope ? [{ contact: { linkedContact: crmScope } }] : [];

  return {
    tenantId: user.tenantId,
    OR: [...baseOr, ...contactScope],
  };
}

export async function getWhatsAppDashboard(): Promise<{ data?: WhatsAppDashboardStats; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const stats = await WhatsAppService.getDashboard(user.tenantId);
    return { data: stats };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppConversations(): Promise<{ data?: WhatsAppConversationItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const scope = await getWhatsappConversationScope(user);
    if (!scope) return { data: [] };
    const data = await WhatsAppService.listConversations(user.tenantId, scope);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppIntents(): Promise<{ data?: WhatsAppIntentItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const scope = await getWhatsappConversationScope(user);
    if (!scope) return { data: [] };
    const data = await WhatsAppService.listIntents(user.tenantId, { conversation: scope });
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppGroups(): Promise<{ data?: WhatsAppGroupItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const data = await WhatsAppService.listGroups(user.tenantId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppCampaigns(): Promise<{ data?: WhatsAppCampaignItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const data = await WhatsAppService.listCampaigns(user.tenantId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppTemplates(): Promise<{ data?: WhatsAppTemplateItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const data = await WhatsAppService.listTemplates(user.tenantId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppAccounts(): Promise<{ data?: WhatsAppAccountItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const data = await WhatsAppService.listAccounts(user.tenantId);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppBotFlows(): Promise<{ data?: WhatsAppBotFlowItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");
    const flows = await prisma.botFlow.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    });
    const data = serializeDecimals(flows).map((f: any) => ({
      id: f.id,
      name: f.name,
      trigger: f.trigger,
      triggerValue: f.triggerValue ?? null,
      response: f.response,
      escalate: Boolean(f.escalate),
      isActive: Boolean(f.isActive),
      priority: Number(f.priority ?? 0),
      createdAt: f.createdAt?.toISOString?.() ?? null,
    }));
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createWhatsAppBotFlow(data: {
  name: string;
  trigger: string;
  triggerValue?: string;
  response: string;
  escalate?: boolean;
  priority?: number;
  isActive?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");
    const flow = await prisma.botFlow.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        trigger: data.trigger,
        triggerValue: data.triggerValue || null,
        response: data.response,
        escalate: Boolean(data.escalate),
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      },
    });
    revalidatePath("/whatsapp");
    return { data: flow };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateWhatsAppBotFlow(data: {
  id: string;
  name?: string;
  trigger?: string;
  triggerValue?: string | null;
  response?: string;
  escalate?: boolean;
  priority?: number;
  isActive?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");
    const flow = await prisma.botFlow.update({
      where: { id: data.id },
      data: {
        name: data.name,
        trigger: data.trigger,
        triggerValue: data.triggerValue ?? undefined,
        response: data.response,
        escalate: data.escalate,
        priority: data.priority,
        isActive: data.isActive,
      },
    });
    revalidatePath("/whatsapp");
    return { data: flow };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppAssignableUsers(): Promise<{ data?: WhatsAppAssignableUserItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        role: {
          in: ["COMMUNITY_MANAGER", "CRM_MANAGER", "COMMERCIAL", "OPS", "DIRECTION", "ADMIN", "CEO"] as any[],
        },
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    return {
      data: users.map((entry) => ({
        id: entry.id,
        name: entry.name,
        role: String(entry.role),
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function ensureWarehousePartnerBotFlow() {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");

    const flow = await WhatsappBotFlowService.ensureWarehousePartnerFlow(user.tenantId);
    revalidatePath("/whatsapp");
    return { data: flow };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getWhatsAppConversationMessages(
  conversationId: string
): Promise<{ data?: WhatsAppMessageItem[]; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.view");

    const scope = await getWhatsappConversationScope(user);
    if (!scope) return { data: [] };

    const convo = await prisma.whatsappConversation.findFirst({
      where: { id: conversationId, ...scope },
      select: { id: true },
    });

    if (!convo) return { error: "Acces refuse" };

    const messages = await WhatsappMessageService.listMessages(conversationId, 80);
    const data = serializeDecimals(messages)
      .map((m: any) => ({
        id: m.id,
        direction: m.direction,
        type: m.type ?? null,
        body: m.body ?? null,
        status: m.status ?? null,
        createdAt: m.createdAt?.toISOString?.() ?? null,
        media: Array.isArray(m.media)
          ? m.media.map((media: any) => ({
              url: media.url,
              mimeType: media.mimeType ?? null,
              caption: media.caption ?? null,
            }))
          : [],
      }))
      .reverse();

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function convertWhatsAppIntentToCrm(intentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");
    checkPermission(user.role, "contact.manage");

    const intent = await prisma.whatsappIntent.findFirst({
      where: { id: intentId, tenantId: user.tenantId },
      include: {
        whatsappContact: { include: { linkedContact: { include: { collaborators: true } } } },
        contact: true,
        conversation: true,
      },
    });

    if (!intent) return { error: "Intention introuvable" };

    if (user.role === "COMMERCIAL") {
      const convo = intent.conversation;
      const linked = intent.whatsappContact?.linkedContact;
      const canAccess =
        convo?.assignedToId === user.id ||
        convo?.ownerId === user.id ||
        linked?.ownerId === user.id ||
        linked?.onboardedById === user.id ||
        (linked?.collaborators ?? []).some((c: any) => c.userId === user.id);
      if (!canAccess) return { error: "Accès refusé" };
    }

    let contactId = intent.contactId as string | null;
    const waPhone = intent.whatsappContact?.phone as string | undefined;

    if (!contactId && waPhone) {
      const existing = await prisma.contact.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            { whatsapp: waPhone },
            { phone: waPhone },
          ],
        },
        select: { id: true },
      });

      if (existing) {
        contactId = existing.id;
      } else {
        const created = await prisma.contact.create({
          data: {
            tenantId: user.tenantId,
            type: "PROSPECT",
            name: intent.whatsappContact?.name || waPhone,
            phone: waPhone,
            whatsapp: waPhone,
          },
        });
        contactId = created.id;
      }
    }

    if (!contactId) return { error: "Contact CRM introuvable" };

    const pipelineIntent = await prisma.customerPipelineIntent.create({
      data: {
        contactId,
        productName: intent.summary?.slice(0, 120),
        source: "whatsapp",
        probability: intent.score === "URGENT" || intent.score === "HIGH" ? 0.75 : 0.5,
        currency: "XAF",
      },
    });

    await prisma.whatsappIntent.update({
      where: { id: intentId },
      data: {
        contactId,
        crmIntentId: pipelineIntent.id,
        status: "TRANSFERRED",
        qualifiedById: user.id,
      },
    });

    revalidatePath("/whatsapp");
    revalidatePath("/crm");

    return { data: { success: true, crmIntentId: pipelineIntent.id } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function assignWhatsAppConversation(conversationId: string, userId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");

    const updated = await WhatsappConversationService.assignConversation(conversationId, userId, user.id);

    if (updated) {
      await WhatsappNotificationService.notifyConversationParticipants({
        conversationId,
        tenantId: updated.tenantId,
        title: "Conversation assignée",
        message: "Une conversation WhatsApp vous a été assignée.",
        type: "WHATSAPP_ASSIGN",
        excludeUserId: user.id,
      });
    }

    revalidatePath("/whatsapp");
    return { data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message.includes("No record was found") || message.includes("Record to update not found")) {
      return { error: "Conversation introuvable" };
    }
    return { error: message };
  }
}

export async function updateWhatsAppConversationStatus(conversationId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");

    const updated = await WhatsappConversationService.updateStatus(conversationId, status, user.id);
    revalidatePath("/whatsapp");
    return { data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message.includes("No record was found") || message.includes("Record to update not found")) {
      return { error: "Conversation introuvable" };
    }
    return { error: message };
  }
}

export async function addWhatsAppConversationTags(conversationId: string, tags: string[]) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");

    const updated = await WhatsappConversationService.addTags(conversationId, tags);
    revalidatePath("/whatsapp");
    return { data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message.includes("No record was found") || message.includes("Record to update not found")) {
      return { error: "Conversation introuvable" };
    }
    return { error: message };
  }
}

async function getManagedConversationContext(user: UserLike, conversationId: string) {
  const scope = await getWhatsappConversationScope(user);
  if (!scope) return null;

  return prisma.whatsappConversation.findFirst({
    where: { id: conversationId, ...scope },
    include: {
      contact: {
        include: {
          linkedContact: {
            include: {
              leads: {
                take: 1,
                orderBy: { createdAt: "desc" },
                select: { id: true, status: true },
              },
              orders: {
                take: 1,
                orderBy: { createdAt: "desc" },
                select: { id: true, orderNumber: true, status: true },
              },
              demandIntakes: {
                take: 1,
                orderBy: { receivedAt: "desc" },
                select: { id: true, status: true },
              },
            },
          },
        },
      },
      intents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          summary: true,
          score: true,
          status: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { media: true },
      },
    },
  });
}

export async function ensureWhatsAppConversationContact(conversationId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");
    checkPermission(user.role, "contact.manage");

    const conversation = await getManagedConversationContext(user, conversationId);
    if (!conversation) return { error: "Conversation introuvable" };

    if (conversation.contact?.linkedContactId) {
      return {
        data: {
          contactId: conversation.contact.linkedContactId,
          created: false,
        },
      };
    }

    const phone = conversation.contact?.phone;
    if (!phone) return { error: "Numero WhatsApp introuvable" };

    let linkedContact = await prisma.contact.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [{ whatsapp: phone }, { phone }],
      },
      select: { id: true },
    });

    let created = false;
    if (!linkedContact) {
      linkedContact = await prisma.contact.create({
        data: {
          tenantId: user.tenantId,
          type: "PROSPECT",
          name: conversation.contact?.name || phone,
          phone,
          whatsapp: phone,
          ownerId: conversation.assignedToId ?? user.id,
          onboardedById: user.id,
          notes: "Contact cree depuis WhatsApp OS",
        },
        select: { id: true },
      });
      created = true;
    }

    await prisma.whatsappContact.update({
      where: { id: conversation.waContactId },
      data: { linkedContactId: linkedContact.id },
    });

    revalidatePath("/whatsapp");
    revalidatePath("/crm");
    revalidatePath(`/contacts/${linkedContact.id}`);

    return {
      data: {
        contactId: linkedContact.id,
        created,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur liaison CRM" };
  }
}

export async function createDemandFromWhatsAppConversation(conversationId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");

    const conversation = await getManagedConversationContext(user, conversationId);
    if (!conversation) return { error: "Conversation introuvable" };

    const sourceRef = `conversation:${conversation.id}`;
    const existing = await prisma.demandIntake.findFirst({
      where: {
        tenantId: user.tenantId,
        source: "WHATSAPP",
        sourceRef,
      },
      select: { id: true, status: true },
    });

    if (existing) {
      return { data: { demandId: existing.id, created: false, status: existing.status } };
    }

    const linkedContactId = conversation.contact?.linkedContactId ?? null;
    const latestLeadId = conversation.contact?.linkedContact?.leads?.[0]?.id ?? null;
    const latestIntent = conversation.intents?.[0] ?? null;
    const inboundMessages = (conversation.messages ?? []).filter((message) => message.direction === "IN");
    const latestInbound = inboundMessages[0] ?? conversation.messages?.[0] ?? null;
    const rawDescription =
      latestIntent?.summary ||
      latestInbound?.body ||
      inboundMessages
        .map((message) => message.body)
        .filter(Boolean)
        .slice(0, 3)
        .join("\n\n") ||
      "Demande WhatsApp";

    const media = inboundMessages.flatMap((message) =>
      (message.media ?? []).map((item) => ({
        name: item.caption || item.mimeType || "piece-jointe-whatsapp",
        url: item.url,
        type: item.mimeType || "whatsapp_media",
      }))
    );

    const cm = await findCommunityManager(user.tenantId);

    const demand = await prisma.demandIntake.create({
      data: {
        tenantId: user.tenantId,
        source: "WHATSAPP",
        sourceRef,
        sourcePayload: {
          conversationId: conversation.id,
          waContactId: conversation.waContactId,
          latestIntentId: latestIntent?.id ?? null,
          latestIntentScore: latestIntent?.score ?? conversation.intentScore ?? null,
          latestMessageId: latestInbound?.id ?? null,
          tags: conversation.tags,
        } as any,
        clientName:
          conversation.contact?.linkedContact?.name ||
          conversation.contact?.name ||
          conversation.contact?.phone ||
          "Client WhatsApp",
        rawDescription,
        currency: "XAF",
        urgency:
          latestIntent?.score === "URGENT"
            ? "CRITICAL"
            : latestIntent?.score === "HIGH"
              ? "HIGH"
              : "NORMAL",
        status: "RAW",
        contactId: linkedContactId,
        leadId: latestLeadId,
        cmId: cm?.id ?? null,
        assignedToId: conversation.assignedToId ?? cm?.id ?? null,
        aiScore:
          latestIntent?.score === "URGENT"
            ? 95
            : latestIntent?.score === "HIGH"
              ? 80
              : latestIntent?.score === "MEDIUM"
                ? 65
                : 50,
        attachments: media.length
          ? {
              create: media,
            }
          : undefined,
      },
    });

    await SourcingTicketService.ensureFromDemand(demand.id);
    await CrmTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demand.id);

    revalidatePath("/whatsapp");
    revalidatePath("/crm");
    revalidatePath("/sourcing");
    revalidatePath("/tasks");

    return { data: { demandId: demand.id, created: true, status: demand.status } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation demande WhatsApp" };
  }
}

export async function createWhatsAppConversationTask(
  conversationId: string,
  taskKind: "followup" | "missing_info" | "quote" | "payment" | "logistics"
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.manage");
    checkPermission(user.role, "whatsapp.manage");

    const conversation = await getManagedConversationContext(user, conversationId);
    if (!conversation) return { error: "Conversation introuvable" };

    const latestOrder = conversation.contact?.linkedContact?.orders?.[0] ?? null;
    const latestIntent = conversation.intents?.[0] ?? null;
    const subject = latestOrder?.orderNumber || conversation.contact?.name || conversation.contact?.phone || "Conversation WhatsApp";

    const config = {
      followup: {
        taskType: "whatsapp_followup",
        title: `Relancer la conversation - ${subject}`,
        description: "Repondre au client et confirmer la prochaine etape.",
        tags: ["whatsapp", "followup"],
        slaHours: 2,
        dueInHours: 1,
      },
      missing_info: {
        taskType: "whatsapp_missing_info",
        title: `Completer les infos manquantes - ${subject}`,
        description: "Obtenir les informations manquantes pour rendre la conversation exploitable.",
        tags: ["whatsapp", "qualification"],
        slaHours: 4,
        dueInHours: 2,
      },
      quote: {
        taskType: "whatsapp_prepare_quote",
        title: `Preparer le devis - ${subject}`,
        description: "Transformer cette conversation en proposition commerciale claire.",
        tags: ["whatsapp", "quote"],
        slaHours: 6,
        dueInHours: 4,
      },
      payment: {
        taskType: "whatsapp_payment_followup",
        title: `Suivi paiement client - ${subject}`,
        description: "Verifier la preuve, la validation ou la prochaine action paiement.",
        tags: ["whatsapp", "payment"],
        slaHours: 4,
        dueInHours: 2,
      },
      logistics: {
        taskType: "whatsapp_logistics_followup",
        title: `Suivi logistique client - ${subject}`,
        description: "Repondre avec le bon contexte shipment / livraison / incident.",
        tags: ["whatsapp", "logistics"],
        slaHours: 6,
        dueInHours: 3,
      },
    }[taskKind];

    const created = await OperationalTaskService.create({
      tenantId: user.tenantId,
      entityType: "whatsapp_conversation",
      entityId: conversation.id,
      taskType: config.taskType,
      title: config.title,
      description: [
        config.description,
        "",
        latestIntent?.summary ? `Signal: ${latestIntent.summary}` : null,
        latestOrder ? `Commande: ${latestOrder.orderNumber} (${latestOrder.status})` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      module: "whatsapp",
      priority:
        latestIntent?.score === "URGENT"
          ? "URGENT"
          : latestIntent?.score === "HIGH"
            ? "HIGH"
            : "NORMAL",
      ownerType: "SYSTEM",
      riskLevel: latestIntent?.score === "URGENT" ? "HIGH" : "LOW",
      slaHours: config.slaHours,
      dueInHours: config.dueInHours,
      tags: [...config.tags, ...(Array.isArray(conversation.tags) ? conversation.tags : [])],
      assigneeId: conversation.assignedToId ?? user.id,
      assigneeRoles: ["COMMUNITY_MANAGER", "COMMERCIAL", "CRM_MANAGER", "OPS"] as any[],
      fallbackRoles: ["DIRECTION", "ADMIN", "CEO"] as any[],
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    });

    revalidatePath("/whatsapp");
    revalidatePath("/tasks");

    return { data: { taskId: created.taskId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation tache WhatsApp" };
  }
}

export async function sendWhatsAppMessage(conversationId: string, body: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.send");

    const message = await WhatsappMessageService.sendText({
      tenantId: user.tenantId,
      conversationId,
      body,
    });

    if (message?.conversationId) {
      await WhatsappNotificationService.notifyConversationParticipants({
        conversationId,
        tenantId: user.tenantId,
        title: "Message WhatsApp envoyé",
        message: body.slice(0, 120),
        type: "WHATSAPP_MESSAGE",
        excludeUserId: user.id,
      });
    }

    revalidatePath("/whatsapp");
    return { data: message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message.includes("No record was found") || message.includes("Record to update not found")) {
      return { error: "Conversation introuvable" };
    }
    return { error: message };
  }
}

export async function updateWhatsAppIntentStatus(intentId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");
    const updated = await WhatsappIntentService.updateStatus(intentId, status, user.id);
    revalidatePath("/whatsapp");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createWhatsAppTemplate(data: { name: string; category?: string; language?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.templates.manage");
    const template = await WhatsappTemplateService.createTemplate(user.tenantId, data);
    revalidatePath("/whatsapp");
    return { data: template };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addWhatsAppTemplateVersion(templateId: string, body: string, variables: string[] = []) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.templates.manage");
    const version = await WhatsappTemplateService.addVersion(templateId, body, variables);
    revalidatePath("/whatsapp");
    return { data: version };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function approveWhatsAppTemplateVersion(versionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.templates.manage");
    const version = await WhatsappTemplateService.approveVersion(versionId);
    revalidatePath("/whatsapp");
    return { data: version };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createWhatsAppCampaign(data: {
  name: string;
  objective?: string;
  segment?: string;
  scheduledAt?: string;
  waContactIds?: string[];
  templateVersionId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.broadcast");
    const campaign = await WhatsappBroadcastService.createCampaign(user.tenantId, {
      name: data.name,
      objective: data.objective,
      segment: data.segment,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      createdById: user.id,
    });

    if (campaign && data.waContactIds?.length) {
      await WhatsappBroadcastService.scheduleSends({
        campaignId: campaign.id,
        waContactIds: data.waContactIds,
        templateVersionId: data.templateVersionId,
      });
    }

    revalidatePath("/whatsapp");
    return { data: campaign };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function exportWhatsAppConversationsCsv() {
  try {
    const user = await getSession();
    checkPermission(user.role, "whatsapp.manage");
    if (!["ADMIN", "CEO", "DIRECTION"].includes(String(user.role))) {
      return { error: "Export non autorisé" };
    }

    const scope = await getWhatsappConversationScope(user);
    if (!scope) return { data: "" };

    const conversations = await prisma.whatsappConversation.findMany({
      where: scope,
      include: { contact: true },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    });

    const headers = "Contact,Phone,Status,Priority,LastMessageAt,IntentScore";
    const rows = conversations.map((c: any) => [
      `"${(c.contact?.name || c.contact?.phone || "").replace(/\"/g, '""')}"`,
      c.contact?.phone ?? "",
      c.status,
      c.priority ?? "",
      c.lastMessageAt?.toISOString?.() ?? "",
      c.intentScore ?? "",
    ].join(","));

    return { data: [headers, ...rows].join("\n") };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ── Start WhatsApp Conversation from Contact ─────────────────────────────────

export async function createLeadFromWhatsAppConversation(conversationId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");
    checkPermission(user.role, "contact.manage");

    const conversation = await prisma.whatsappConversation.findFirst({
      where: { id: conversationId, tenantId: user.tenantId },
      include: {
        contact: {
          include: {
            linkedContact: {
              include: {
                leads: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!conversation) return { error: "Conversation introuvable" };

    let linkedContact = conversation.contact.linkedContact;
    if (!linkedContact) {
      linkedContact = await prisma.contact.create({
        data: {
          tenantId: user.tenantId,
          type: "PROSPECT",
          name: conversation.contact.name || conversation.contact.phone || "Prospect WhatsApp",
          phone: conversation.contact.phone,
          whatsapp: conversation.contact.phone,
          ownerId: user.id,
          onboardedById: user.id,
          notes: "Contact cree depuis une conversation WhatsApp",
        },
        include: {
          leads: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      await prisma.whatsappContact.update({
        where: { id: conversation.contact.id },
        data: { linkedContactId: linkedContact.id },
      });
    }

    const existingLead = linkedContact.leads?.[0];
    if (existingLead) {
      revalidatePath("/whatsapp");
      return {
        data: {
          leadId: existingLead.id,
          contactId: linkedContact.id,
          created: false,
        },
      };
    }

    const lead = await prisma.lead.create({
      data: {
        contactId: linkedContact.id,
        source: "whatsapp",
        description: conversation.messages[0]?.body || "Conversation WhatsApp",
        notes: conversation.messages[0]?.body || "Conversation WhatsApp",
        ownerId: user.id,
        assignedTo: user.id,
        onboardedById: user.id,
        currency: "XAF",
      },
    });

    revalidatePath("/whatsapp");
    revalidatePath("/crm");
    revalidatePath(`/contacts/${linkedContact.id}`);

    return {
      data: {
        leadId: lead.id,
        contactId: linkedContact.id,
        created: true,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation lead WhatsApp" };
  }
}
export async function startWhatsAppConversation(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    // Find or create a WhatsappContact
    let waContact = await prisma.whatsappContact.findFirst({
      where: { tenantId: user.tenantId, phone: contact.whatsapp ?? contact.phone ?? "" },
    });
    if (!waContact) {
      waContact = await prisma.whatsappContact.create({
        data: {
          tenantId: user.tenantId,
          phone: contact.whatsapp ?? contact.phone ?? "",
          name: contact.name,
          linkedContactId: contact.id,
        },
      });
    }

    // Find a default WhatsApp account for the tenant
    const account = await prisma.whatsappAccount.findFirst({ where: { tenantId: user.tenantId } });

    // Find or create the conversation
    let conversation = await prisma.whatsappConversation.findFirst({
      where: { tenantId: user.tenantId, waContactId: waContact.id },
    });
    let created = false;
    if (!conversation && account) {
      conversation = await prisma.whatsappConversation.create({
        data: {
          tenantId: user.tenantId,
          accountId: account.id,
          waContactId: waContact.id,
          status: "OPEN",
          priority: "NORMAL",
        },
      });
      created = true;
    }

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/whatsapp");
    return { data: { conversationId: conversation?.id ?? null, whatsappContactId: waContact.id, created } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur démarrage conversation WA" };
  }
}
