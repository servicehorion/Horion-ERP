import type { UserRole } from "@prisma/client";

import { AssistantAuditService } from "@/lib/services/assistant-audit.service";
import { AssistantContextService } from "@/lib/services/assistant-context.service";
import { AssistantOrchestratorService } from "@/lib/services/assistant-orchestrator.service";
import { KnowledgeDriveSyncService } from "@/lib/services/knowledge-drive-sync.service";
import { KnowledgeRetrievalService } from "@/lib/services/knowledge-retrieval.service";

function buildFallbackAnswer(
  message: string,
  context: Record<string, unknown>,
  knowledge: Array<{ title: string; snippet: string }>
) {
  const normalized = message.toLowerCase();
  const moduleName = String(context.module ?? "dashboard");
  const order = context.order as Record<string, unknown> | null;
  const quote = context.quote as Record<string, unknown> | null;
  const task = context.task as Record<string, unknown> | null;
  const role = String(context.role ?? "");

  let answer = `Vous etes dans le module ${moduleName}. `;

  if ((normalized.includes("bloqu") || normalized.includes("pourquoi")) && task) {
    answer += `La tache ${String(task.title ?? "")} est au statut ${String(task.status ?? "-")}. `;
    answer += String(task.suggestedAction ?? "Vérifiez le statut, le SLA et l'assignation.");
  } else if ((normalized.includes("prochain") || normalized.includes("que faire")) && order) {
    answer += `Pour la commande ${String(order.orderNumber ?? "")}, le statut actuel est ${String(order.status ?? "-")}. `;
    answer += String(order.nextAction ?? "Vérifiez le prochain jalon du workflow.");
  } else if ((normalized.includes("valider") || normalized.includes("devis")) && quote) {
    answer += `Le devis est au statut ${String(quote.status ?? "-")} avec une approbation ${String(
      quote.approvalStatus ?? "-"
    )}. `;
    answer += String(quote.suggestedAction ?? "Vérifiez la validation interne avant envoi client.");
  } else if (normalized.includes("permission") || normalized.includes("droit")) {
    answer += `Votre role ${role} dispose des permissions necessaires pour le module ${moduleName} si elles apparaissent dans le contexte. En cas de blocage, Zelia recommande l'escalade manager ou admin.`;
  } else {
    answer += "Je peux vous aider a comprendre l'ecran, le prochain jalon, les permissions et les blocages. ";
    if (task?.suggestedAction) answer += `Sur cette page, priorite a: ${String(task.suggestedAction)} `;
    else if (order?.nextAction) answer += `Sur cette page, priorite a: ${String(order.nextAction)} `;
    else if (quote?.suggestedAction) answer += `Sur cette page, priorite a: ${String(quote.suggestedAction)} `;
  }

  if (knowledge.length > 0) {
    answer += ` Reference utile: ${knowledge[0].snippet}`;
  }

  return {
    answer,
    suggestions: [
      "Explique cette page",
      "Que dois-je faire maintenant ?",
      "Pourquoi c'est bloque ?",
      "Qui doit valider ?",
    ],
  };
}

export class ZeliaInternalService {
  static async chat(params: {
    sessionId?: string | null;
    tenantId: string;
    userId: string;
    role: UserRole;
    route?: string | null;
    module?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    taskId?: string | null;
    orderId?: string | null;
    quoteId?: string | null;
    paymentId?: string | null;
    message: string;
  }) {
    const context = await AssistantContextService.getInternalContext({
      tenantId: params.tenantId,
      userId: params.userId,
      role: params.role,
      route: params.route,
      module: params.module,
      entityType: params.entityType,
      entityId: params.entityId,
      taskId: params.taskId,
      orderId: params.orderId,
      quoteId: params.quoteId,
      paymentId: params.paymentId,
    });

    const session = await AssistantAuditService.ensureSession({
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      assistantType: "INTERNAL",
      userId: params.userId,
      title: `Zelia interne - ${String(context.module ?? "dashboard")}`,
      role: params.role,
      module: String(context.module ?? params.module ?? "dashboard"),
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: {
        route: params.route ?? null,
        taskId: params.taskId ?? null,
        orderId: params.orderId ?? null,
        quoteId: params.quoteId ?? null,
        paymentId: params.paymentId ?? null,
      },
    });

    await AssistantAuditService.appendMessage({
      sessionId: session.id,
      role: "USER",
      content: params.message,
    });

    await KnowledgeDriveSyncService.ensureFresh(params.tenantId).catch(() => null);

    const knowledge = (
      await KnowledgeRetrievalService.search({
        tenantId: params.tenantId,
        audience: "INTERNAL",
        query: params.message,
        module: String(context.module ?? params.module ?? "dashboard"),
        limit: 5,
      })
    ).map((item) => ({
      title: item.title,
      module: item.module,
      sourceUrl: item.sourceUrl,
      snippet: item.content,
    }));

    const reply = await AssistantOrchestratorService.buildReply({
      assistantType: "INTERNAL",
      systemPrompt:
        "Tu es Zelia Interne, guide d'orientation ERP Horion. Tu expliques la page courante, le prochain jalon, les permissions et les blocages. Tu n'inventes jamais une permission. Si tu deduis quelque chose, tu le dis clairement.",
      message: params.message,
      context: context as Record<string, unknown>,
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
      tenantId: params.tenantId,
      assistantType: "INTERNAL",
      sessionId: session.id,
      action: "chat.reply",
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      input: {
        message: params.message,
        route: params.route ?? null,
        module: params.module ?? null,
      },
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
      context,
    };
  }
}
