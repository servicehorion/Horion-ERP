import { prisma } from "@/lib/db";
import { WhatsappLeadQualificationService } from "@/lib/services/whatsapp-lead-qualification.service";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";
import { SourcingIngestionService } from "@/lib/services/sourcing-ingestion.service";

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

export class WhatsappIntentService {
  static async detectAndCreate(params: {
    tenantId: string;
    conversationId: string;
    waContactId?: string | null;
    sourceMessageId?: string | null;
    text: string;
  }) {
    const score = scoreFromText(params.text);

    const intent = await prisma.whatsappIntent.create({
      data: {
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        waContactId: params.waContactId ?? null,
        sourceMessageId: params.sourceMessageId ?? null,
        score,
        summary: params.text.slice(0, 200),
        status: "DETECTED",
      },
    });

    await prisma.whatsappConversation.update({
      where: { id: params.conversationId },
      data: { intentScore: score },
    });

    await WhatsappAuditService.log({
      tenantId: params.tenantId,
      action: "whatsapp.intent_detected",
      entityType: "whatsapp_intent",
      entityId: intent.id,
      payload: { score },
    });

    if (score === "MEDIUM" || score === "HIGH" || score === "URGENT") {
      await WhatsappLeadQualificationService.ensureCrmLink(intent.id);
      await SourcingIngestionService.ingestFromWhatsappIntent(params.tenantId, intent.id, {
        autoAssign: true,
      });
    }

    return intent;
  }

  static async updateStatus(intentId: string, status: string, actorId?: string) {
    const intent = await prisma.whatsappIntent.update({
      where: { id: intentId },
      data: { status: status as any },
    });

    await WhatsappAuditService.log({
      tenantId: intent.tenantId,
      actorId,
      action: "whatsapp.intent_status",
      entityType: "whatsapp_intent",
      entityId: intentId,
      payload: { status },
    });

    if (status === "QUALIFIED") {
      await WhatsappLeadQualificationService.qualifyIntent(intentId, actorId);
    }

    return intent;
  }
}
