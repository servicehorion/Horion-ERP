import { prisma } from "@/lib/db";
import { WhatsappMessageService } from "@/lib/services/whatsapp-message.service";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";

const GREETINGS = ["bonjour", "salut", "hello", "hi", "bonsoir"];
const KEYWORDS_HIGH = ["commander", "commande", "acheter", "prix", "urgent", "besoin"];
const KEYWORDS_MEDIUM = ["devis", "tarif", "livraison", "disponible", "stock"];

function scoreFromText(text: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  const normalized = text.toLowerCase();
  const high = KEYWORDS_HIGH.some((k) => normalized.includes(k));
  const medium = KEYWORDS_MEDIUM.some((k) => normalized.includes(k));
  if (normalized.includes("urgent") || normalized.includes("immediat")) return "URGENT";
  if (high) return "HIGH";
  if (medium) return "MEDIUM";
  return "LOW";
}

function matchesKeyword(text: string, triggerValue?: string | null) {
  if (!triggerValue) return false;
  const keywords = triggerValue.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  const normalized = text.toLowerCase();
  return keywords.some((k) => normalized.includes(k));
}

export class WhatsappBotFlowService {
  static async list(tenantId: string) {
    return prisma.botFlow.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  static async matchFlow(tenantId: string, text: string) {
    const flows = await this.list(tenantId);
    if (!flows.length) return null;

    const normalized = text.trim().toLowerCase();
    const intentScore = scoreFromText(text);
    let fallback = null as typeof flows[number] | null;

    for (const flow of flows) {
      const trigger = flow.trigger.toUpperCase();
      if (trigger === "UNHANDLED") {
        fallback = flow;
        continue;
      }
      if (trigger === "GREETING" && GREETINGS.some((g) => normalized.includes(g))) return flow;
      if (trigger === "KEYWORD" && matchesKeyword(text, flow.triggerValue)) return flow;
      if (trigger === "INTENT" && flow.triggerValue && flow.triggerValue.toUpperCase() === intentScore) return flow;
    }

    return fallback;
  }

  static async handleInbound(params: { tenantId: string; conversationId: string; text: string }) {
    const flow = await this.matchFlow(params.tenantId, params.text);
    if (!flow) return { handled: false };

    if (flow.response?.trim()) {
      await WhatsappMessageService.sendText({
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        body: flow.response,
      });
    }

    await WhatsappAuditService.log({
      tenantId: params.tenantId,
      action: "whatsapp.botflow.triggered",
      entityType: "bot_flow",
      entityId: flow.id,
      payload: { trigger: flow.trigger, triggerValue: flow.triggerValue, escalated: flow.escalate },
    });

    return { handled: true, escalated: Boolean(flow.escalate), flowId: flow.id };
  }

  static async ensureWarehousePartnerFlow(tenantId: string) {
    const name = "Horion Warehouse Intake";
    const triggerValue = "cmd,commande,colis,kg,taille,dimension,dimensions,warehouse,entrepot";
    const response =
      "Merci. Pour enregistrer la reception merci d'envoyer: CMD-XXXX, poids en kg, dimensions LxWxH en cm, puis les photos du colis et du produit.";

    const existing = await prisma.botFlow.findFirst({
      where: {
        tenantId,
        name,
      },
      select: { id: true },
    });

    if (existing) {
      return prisma.botFlow.update({
        where: { id: existing.id },
        data: {
          trigger: "KEYWORD",
          triggerValue,
          response,
          escalate: true,
          isActive: true,
          priority: 90,
        },
      });
    }

    return prisma.botFlow.create({
      data: {
        tenantId,
        name,
        trigger: "KEYWORD",
        triggerValue,
        response,
        escalate: true,
        isActive: true,
        priority: 90,
      },
    });
  }
}
