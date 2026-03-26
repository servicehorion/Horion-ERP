import { AssistantAuditService } from "@/lib/services/assistant-audit.service";
import { AssistantContextService } from "@/lib/services/assistant-context.service";
import { AssistantOrchestratorService } from "@/lib/services/assistant-orchestrator.service";
import { KnowledgeRetrievalService } from "@/lib/services/knowledge-retrieval.service";

function buildFallbackAnswer(
  message: string,
  context: Record<string, unknown>,
  knowledge: Array<{ title: string; snippet: string }>
) {
  const normalized = message.toLowerCase();
  const orderNumber = String(context.orderNumber ?? "-");
  const amountLabel = String(context.amountLabel ?? "");
  const paymentStatus = String(context.paymentStatus ?? "PENDING");
  const proofRequired = Boolean(context.proofRequired);
  const receiptAvailable = Boolean(context.receiptAvailable);
  const paymentMethodLabel = String(context.paymentMethodLabel ?? "paiement Horion");
  const depositCode = String(context.depositCode ?? "");
  const supportWhatsappUrl = String(context.supportWhatsappUrl ?? "");

  let answer = `Je vous guide pour la commande #${orderNumber}. `;

  if (normalized.includes("combien") || normalized.includes("montant") || normalized.includes("payer")) {
    answer += `Le montant attendu est ${amountLabel}. Vous pouvez finaliser avec la methode disponible sur cette page.`;
  } else if (normalized.includes("preuve") || normalized.includes("recu") || normalized.includes("justificatif")) {
    answer += proofRequired
      ? `Comme vous utilisez ${paymentMethodLabel}, Horion attend une preuve de paiement. ${
          depositCode ? `Le code de depot a rappeler est ${depositCode}. ` : ""
        }Vous pouvez televerser une photo ou un PDF depuis cette page.`
      : "Pour un paiement instantane, aucune preuve manuelle n'est demandee. Horion confirmera automatiquement la transaction.";
  } else if (normalized.includes("quand") || normalized.includes("confirmation") || normalized.includes("confirmer")) {
    answer += paymentStatus === "PAID"
      ? "Votre paiement est deja confirme. Vous pouvez recuperer votre recu."
      : paymentStatus === "SUBMITTED"
        ? "Votre paiement a bien ete soumis. Horion verifie la transaction avant de lancer la commande."
        : "Le paiement n'est pas encore confirme. Finalisez le paiement ou envoyez la preuve si la methode le demande.";
  } else if (normalized.includes("recu") || normalized.includes("receipt") || normalized.includes("facture")) {
    answer += receiptAvailable
      ? "Le recu est disponible depuis la page de succes du paiement."
      : "Le recu devient disponible une fois le paiement confirme par Horion.";
  } else {
    answer += proofRequired
      ? `Vous etes sur un paiement manuel (${paymentMethodLabel}). Suivez les instructions de depot ou de virement, puis televersez votre preuve.`
      : `Vous pouvez payer directement via ${paymentMethodLabel}. Si quelque chose bloque, Horion peut vous assister rapidement.`;
  }

  if (knowledge.length > 0) {
    answer += ` Conseil utile: ${knowledge[0].snippet}`;
  }

  return {
    answer,
    suggestions: [
      "Comment envoyer ma preuve ?",
      "Quand Horion confirme le paiement ?",
      "Comment telecharger mon recu ?",
      supportWhatsappUrl ? "Contacter Horion sur WhatsApp" : "Quel moyen de paiement choisir ?",
    ],
  };
}

export class ZeliaPayService {
  static async chat(params: {
    token: string;
    page?: "quote" | "pay" | "submitted" | "success";
    sessionId?: string | null;
    message: string;
  }) {
    const publicContext = await AssistantContextService.getPublicContext({
      token: params.token,
      page: params.page,
    });
    if (!publicContext) {
      throw new Error("Contexte public introuvable");
    }

    const tenantId =
      publicContext && typeof publicContext === "object" && "tenantId" in publicContext
        ? String(publicContext.tenantId || "")
        : "";

    const effectiveTenantId = tenantId || "public";
    const session = await AssistantAuditService.ensureSession({
      sessionId: params.sessionId,
      tenantId: effectiveTenantId,
      assistantType: "PAYMENT",
      publicToken: params.token,
      title: `Zelia Pay ${String(publicContext.orderNumber ?? "")}`.trim(),
      module: "payments",
      entityType: "quote",
      entityId: null,
      metadata: {
        page: params.page ?? "pay",
        orderNumber: publicContext.orderNumber,
      },
    });

    await AssistantAuditService.appendMessage({
      sessionId: session.id,
      role: "USER",
      content: params.message,
    });

    const knowledge = (
      await KnowledgeRetrievalService.search({
        tenantId: effectiveTenantId,
        audience: "PUBLIC",
        query: params.message,
        module: "payments",
        limit: 4,
      })
    ).map((item) => ({
      title: item.title,
      module: item.module,
      sourceUrl: item.sourceUrl,
      snippet: item.content,
    }));

    const reply = await AssistantOrchestratorService.buildReply({
      assistantType: "PAYMENT",
      systemPrompt:
        "Tu es Zelia, l'assistante client Horion pour le devis et le paiement. Tu aides uniquement sur le paiement, la preuve, le recu, les delais et le support. Tu ne reveles jamais d'informations internes.",
      message: params.message,
      context: publicContext as Record<string, unknown>,
      knowledge,
      fallback: buildFallbackAnswer,
    });

    const assistantMessage = await AssistantAuditService.appendMessage({
      sessionId: session.id,
      role: "ASSISTANT",
      content: reply.answer,
      sourcesJson: knowledge.map((item) => ({
        title: item.title,
        module: item.module,
        sourceUrl: item.sourceUrl,
      })),
    });

    await AssistantAuditService.log({
      tenantId: effectiveTenantId,
      assistantType: "PAYMENT",
      sessionId: session.id,
      action: "chat.reply",
      entityType: "quote",
      entityId: String(publicContext.orderNumber ?? ""),
      input: { message: params.message, page: params.page ?? "pay" },
      output: { suggestions: reply.suggestions ?? [] },
    });

    return {
      sessionId: session.id,
      messageId: assistantMessage.id,
      answer: reply.answer,
      suggestions: reply.suggestions ?? [],
      sources: knowledge.map((item) => ({
        title: item.title,
        module: item.module,
        sourceUrl: item.sourceUrl,
      })),
      context: publicContext,
    };
  }
}
