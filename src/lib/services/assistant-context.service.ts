import { getRolePermissions } from "@/lib/permissions";
import { getPaymentMethodLabel, isManualPaymentMethod, PAYMENT_METHOD_LABELS } from "@/lib/payments/config";
import { formatPublicMoney } from "@/lib/public-money";
import { getWhatsAppUrl, SITE_CONFIG } from "@/lib/site-config";
import { prisma } from "@/lib/db";
import { serializeDecimals } from "@/lib/utils";

function inferModuleFromRoute(route?: string | null) {
  if (!route) return null;
  const normalized = route.replace(/^\//, "");
  const [first, second] = normalized.split("/");
  if (first === "(dashboard)") return second ?? null;
  return first || null;
}

function inferNextActionFromOrder(order: { status: string; approvalStatus?: string | null }) {
  switch (order.status) {
    case "DEMANDE":
      return "Verifier la demande et preparer la recherche produit.";
    case "DEVIS":
      return order.approvalStatus === "PENDING"
        ? "Attendre la validation interne avant exposition client."
        : "Envoyer ou actualiser le devis client.";
    case "PAIEMENT_EN_COURS":
      return "Suivre l'encaissement ou verifier la preuve de paiement.";
    case "SOURCING":
      return "Lancer ou suivre l'achat fournisseur.";
    case "RECU_ENTREPOT":
      return "Verifier la reception entrepot puis preparer le QC.";
    case "QC_EN_COURS":
      return "Finaliser le controle qualite et lever les blocages.";
    case "EN_TRANSIT":
      return "Suivre le transit et preparer les operations destination.";
    case "LIVRE":
      return "Organiser la remise client et cloturer l'execution.";
    default:
      return "Verifier le dernier evenement et executer l'etape suivante du workflow.";
  }
}

export class AssistantContextService {
  static async getInternalContext(params: {
    tenantId: string;
    userId: string;
    role: string;
    route?: string | null;
    module?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    taskId?: string | null;
    orderId?: string | null;
    quoteId?: string | null;
    paymentId?: string | null;
  }) {
    const moduleName = params.module ?? inferModuleFromRoute(params.route) ?? "dashboard";
    const entityType = params.entityType ?? null;
    const entityId = params.entityId ?? null;

    const [order, quote, task, payment] = await Promise.all([
      prisma.order.findFirst({
        where: {
          tenantId: params.tenantId,
          id: params.orderId ?? (entityType === "order" ? entityId : undefined) ?? undefined,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          approvalStatus: true,
          totalClient: true,
          contact: { select: { name: true } },
        },
      }),
      prisma.quote.findFirst({
        where: {
          id: params.quoteId ?? (entityType === "quote" ? entityId : undefined) ?? undefined,
          order: { tenantId: params.tenantId },
        },
        select: {
          id: true,
          status: true,
          approvalStatus: true,
          paymentStatus: true,
          total: true,
          currency: true,
          order: { select: { id: true, orderNumber: true } },
        },
      }),
      prisma.task.findFirst({
        where: {
          tenantId: params.tenantId,
          id: params.taskId ?? (entityType === "task" ? entityId : undefined) ?? undefined,
        },
        select: {
          id: true,
          title: true,
          status: true,
          module: true,
          priority: true,
          dueDate: true,
          slaDeadline: true,
          taskType: true,
        },
      }),
      prisma.payment.findFirst({
        where: {
          id: params.paymentId ?? (entityType === "payment" ? entityId : undefined) ?? undefined,
          order: { tenantId: params.tenantId },
        },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          methodKey: true,
          dueAt: true,
          expiresAt: true,
          order: { select: { orderNumber: true } },
        },
      }),
    ]);

    return serializeDecimals({
      module: moduleName,
      route: params.route ?? null,
      role: params.role,
      permissions: getRolePermissions(params.role as any),
      order: order
        ? {
            ...order,
            nextAction: inferNextActionFromOrder(order),
          }
        : null,
      quote: quote
        ? {
            ...quote,
            suggestedAction:
              quote.approvalStatus === "PENDING"
                ? "Faire valider le devis en interne."
                : quote.status === "SENT"
                  ? "Suivre la signature ou le paiement client."
                  : "Verifier la version active et preparer l'envoi client.",
          }
        : null,
      task: task
        ? {
            ...task,
            suggestedAction:
              task.status === "BLOCKED"
                ? "Lever le blocage ou escalader vers un manager/admin."
                : task.status === "PENDING"
                  ? "Prendre la tache en charge et suivre les sous-etapes."
                  : "Verifier la prochaine etape de traitement.",
          }
        : null,
      payment: payment
        ? {
            ...payment,
            methodLabel: getPaymentMethodLabel(payment.methodKey),
          }
        : null,
    });
  }

  static async getPublicContext(params: {
    token: string;
    page?: "quote" | "pay" | "submitted" | "success";
  }) {
    const page = params.page ?? "pay";
    const quote =
      page === "quote"
        ? await prisma.quote.findFirst({
            where: { signatureToken: params.token, isActive: true },
            select: {
              id: true,
              orderId: true,
              total: true,
              currency: true,
              status: true,
              paymentToken: true,
              paymentStatus: true,
              paymentExpiry: true,
              order: { select: { tenantId: true, orderNumber: true, contact: { select: { name: true } } } },
            },
          })
        : await prisma.quote.findFirst({
            where: { paymentToken: params.token, isActive: true },
            select: {
              id: true,
              orderId: true,
              total: true,
              currency: true,
              status: true,
              paymentStatus: true,
              paymentMethod: true,
              paymentExpiry: true,
              paidAt: true,
              order: {
                select: {
                  tenantId: true,
                  orderNumber: true,
                  contact: { select: { name: true } },
                  payments: {
                    where: { direction: "INBOUND" },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      methodKey: true,
                      depositCode: true,
                      expiresAt: true,
                      proofUrl: true,
                      proofUploadedAt: true,
                      confirmedAt: true,
                    },
                  },
                },
              },
            },
          });

    if (!quote) return null;

    const payment = "payments" in quote.order ? quote.order.payments?.[0] ?? null : null;
    const currentMethod = payment?.methodKey ?? ("paymentMethod" in quote ? quote.paymentMethod : null);
    const availableMethods = Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({
      key,
      label,
      manual: isManualPaymentMethod(key),
    }));

    return serializeDecimals({
      tenantId: quote.order.tenantId,
      page,
      orderNumber: quote.order.orderNumber,
      clientName: quote.order.contact?.name ?? "Client Horion",
      amountLabel: formatPublicMoney(Number(quote.total), quote.currency),
      currency: quote.currency,
      quoteStatus: quote.status,
      paymentStatus: quote.paymentStatus ?? "PENDING",
      paymentMethodLabel: currentMethod ? getPaymentMethodLabel(currentMethod) : null,
      paymentExpiry: quote.paymentExpiry,
      receiptAvailable: quote.paymentStatus === "PAID",
      proofRequired: currentMethod ? isManualPaymentMethod(currentMethod) : false,
      proofUploadedAt: payment?.proofUploadedAt ?? null,
      paymentProofStatus: payment?.status ?? null,
      depositCode: payment?.depositCode ?? null,
      supportWhatsappUrl: getWhatsAppUrl(
        `Bonjour Horion, j'ai besoin d'aide pour le paiement de la commande #${quote.order.orderNumber}.`
      ),
      supportEmail: SITE_CONFIG.contactEmail,
      availableMethods,
    });
  }
}
