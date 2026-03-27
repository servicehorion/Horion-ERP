import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { OrderService } from "@/lib/services/order.service";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";

function toNumber(value: unknown) {
  return Number(value || 0);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

type ProjectionTone = "neutral" | "success" | "warning" | "danger";

type SubsystemState = {
  label: string;
  detail: string;
  tone: ProjectionTone;
};

export type OrderDetailProjection = {
  subsystemStates: {
    commercial: SubsystemState;
    payment: SubsystemState & {
      collectedXAF: number;
      outstandingXAF: number;
    };
    logistics: SubsystemState;
    quality: SubsystemState;
    execution: SubsystemState & {
      openTasks: number;
      blockedTasks: number;
      overdueTasks: number;
    };
    finance: SubsystemState & {
      netMarginXAF: number;
      netMarginPct: number;
      spendXAF: number;
    };
  };
  transitionReadiness: Array<{
    status: string;
    label: string;
    ready: boolean;
    blockers: string[];
  }>;
  activeBlockers: string[];
  nextRecommendedStatus: {
    status: string;
    label: string;
    ready: boolean;
  } | null;
};

export class OrderDetailProjectionService {
  static async get(orderId: string, scopeWhere?: Prisma.OrderWhereInput) {
    const order = await OrderService.getById(orderId, scopeWhere);
    if (!order) return null;

    const [transitionReadiness] = await Promise.all([
      OrderService.getTransitionReadiness(orderId),
      FinanceTransactionService.syncTenant(order.tenantId),
    ]);

    const financeTransactions = await prisma.financeTransaction.findMany({
      where: {
        tenantId: order.tenantId,
        orderId,
        status: "COMPLETED",
      },
      select: {
        category: true,
        amountXAF: true,
        completedAt: true,
      },
    });

    let collectedXAF = 0;
    let refundedXAF = 0;
    let spendXAF = 0;
    let insuranceXAF = 0;

    for (const transaction of financeTransactions) {
      const amount = toNumber(transaction.amountXAF);
      switch (transaction.category) {
        case "CLIENT_PAYMENT":
          collectedXAF += amount;
          break;
        case "CLIENT_REFUND":
          refundedXAF += amount;
          break;
        case "INSURANCE_FEE":
          insuranceXAF += amount;
          break;
        case "CHINA_PURCHASE":
        case "SHIPPING_FEE":
        case "PARTNER_PAYMENT":
        case "PLATFORM_FEE":
          spendXAF += amount;
          break;
        default:
          break;
      }
    }

    const activeQuote = order.currentQuote ?? order.quotes?.[0] ?? null;
    const commercialState: SubsystemState = activeQuote
      ? activeQuote.status === "ACCEPTED"
        ? {
            label: "Devis accepte",
            detail: `Version ${activeQuote.version ?? "active"} acceptee et exploitable`,
            tone: "success",
          }
        : activeQuote.status === "SENT"
          ? {
              label: "Devis envoye",
              detail: "En attente de retour client",
              tone: "warning",
            }
          : {
              label: "Devis en preparation",
              detail: "Le dossier commercial reste en construction",
              tone: "neutral",
            }
      : {
          label: "Aucun devis actif",
          detail: "Le dossier n'a pas encore de proposition active",
          tone: "warning",
        };

    const outstandingXAF = Math.max(0, roundMoney(toNumber(order.totalClient) - collectedXAF + refundedXAF));
    const paymentState = {
      label:
        collectedXAF <= 0
          ? "Paiement non confirme"
          : outstandingXAF > 0
            ? "Paiement partiel"
            : "Paiement couvert",
      detail:
        collectedXAF <= 0
          ? "Aucun encaissement client confirme pour cette commande"
          : outstandingXAF > 0
            ? `${outstandingXAF.toLocaleString("fr-FR")} XAF restent a couvrir`
            : "Le besoin de financement client est confirme",
      tone: collectedXAF <= 0 ? "danger" : outstandingXAF > 0 ? "warning" : "success",
      collectedXAF: roundMoney(collectedXAF - refundedXAF),
      outstandingXAF,
    } satisfies SubsystemState & { collectedXAF: number; outstandingXAF: number };

    const shipments = order.shipments ?? [];
    const deliveredCount = shipments.filter((shipment) => shipment.status === "DELIVERED").length;
    const movingCount = shipments.filter((shipment) =>
      ["BOOKED", "PICKED_UP", "IN_TRANSIT", "ARRIVED_PORT", "CUSTOMS", "CLEARED", "IN_DELIVERY"].includes(shipment.status),
    ).length;
    const customsOpenCount = shipments.filter(
      (shipment) =>
        shipment.customsClearance &&
        !["CLEARED"].includes(shipment.customsClearance.status),
    ).length;
    const logisticsState: SubsystemState =
      deliveredCount > 0
        ? {
            label: "Livraison constatee",
            detail: `${deliveredCount} expedition(s) livree(s)`,
            tone: "success",
          }
        : movingCount > 0
          ? {
              label: customsOpenCount > 0 ? "Transit / douane" : "Transit en cours",
              detail: `${movingCount} expedition(s) actives`,
              tone: customsOpenCount > 0 ? "warning" : "neutral",
            }
          : (order.warehouseReceipts?.length ?? 0) > 0
            ? {
                label: "Reception entrepot",
                detail: `${order.warehouseReceipts?.length ?? 0} reception(s) interne(s) confirmees`,
                tone: "neutral",
              }
            : {
                label: "Aucune expedition",
                detail: "La logistique n'a pas encore pris la main",
                tone: "warning",
              };

    const latestQcRequest = order.qcRequests?.[0] ?? null;
    const latestInspection = order.qcInspections?.[0] ?? null;
    const qcFailed =
      latestQcRequest?.status === "FAILED" ||
      latestInspection?.overall === "FAIL";
    const qcPassed =
      ["PASSED", "CONDITIONAL"].includes(latestQcRequest?.status ?? "") ||
      ["PASS", "CONDITIONAL"].includes(latestInspection?.overall ?? "");
    const qualityState: SubsystemState = qcFailed
      ? {
          label: "QC en echec",
          detail: "Le dossier qualite bloque la progression",
          tone: "danger",
        }
      : qcPassed
        ? {
            label: "QC valide",
            detail: "Le dernier signal qualite est positif",
            tone: "success",
          }
        : (order.qcRequests?.length ?? 0) > 0
          ? {
              label: "QC en cours",
              detail: `${order.qcRequests?.length ?? 0} demande(s) qualite ouvertes`,
              tone: "warning",
            }
          : {
              label: "Pas de QC actif",
              detail: "Aucun controle qualite en cours",
              tone: "neutral",
            };

    const openTasks = (order.tasks ?? []).filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)).length;
    const blockedTasks = (order.tasks ?? []).filter((task) => task.status === "BLOCKED").length;
    const overdueTasks = (order.tasks ?? []).filter((task) => Boolean(task.slaBreach)).length;
    const executionState = {
      label:
        blockedTasks > 0
          ? "Execution bloquee"
          : overdueTasks > 0
            ? "Execution sous tension"
            : openTasks > 0
              ? "Execution active"
              : "Aucune tache ouverte",
      detail:
        openTasks > 0
          ? `${openTasks} tache(s) ouvertes, ${blockedTasks} bloquee(s), ${overdueTasks} en retard SLA`
          : "Aucun reste a faire visible cote Task OS",
      tone: blockedTasks > 0 ? "danger" : overdueTasks > 0 ? "warning" : openTasks > 0 ? "neutral" : "success",
      openTasks,
      blockedTasks,
      overdueTasks,
    } satisfies SubsystemState & { openTasks: number; blockedTasks: number; overdueTasks: number };

    const fallbackNetMargin = order.marginReport ? toNumber(order.marginReport.netMargin ?? order.marginReport.grossMargin) : 0;
    const fallbackNetMarginPct = order.marginReport ? toNumber(order.marginReport.netMarginPct ?? order.marginReport.marginPercent) : 0;
    const netMarginXAF =
      financeTransactions.length > 0
        ? roundMoney(collectedXAF - spendXAF - refundedXAF + insuranceXAF)
        : roundMoney(fallbackNetMargin);
    const netMarginPct =
      financeTransactions.length > 0 && collectedXAF > 0
        ? (netMarginXAF / collectedXAF) * 100
        : fallbackNetMarginPct;
    const financeState = {
      label:
        financeTransactions.length === 0
          ? "Lecture legacy"
          : netMarginXAF >= 0
            ? "Marge positive"
            : "Marge sous pression",
      detail:
        financeTransactions.length === 0
          ? "Aucune ecriture finance complete disponible pour cette commande"
          : `Encaisse ${roundMoney(collectedXAF - refundedXAF).toLocaleString("fr-FR")} XAF / Depense ${roundMoney(spendXAF).toLocaleString("fr-FR")} XAF`,
      tone: financeTransactions.length === 0 ? "warning" : netMarginXAF >= 0 ? "success" : "danger",
      netMarginXAF,
      netMarginPct,
      spendXAF: roundMoney(spendXAF),
    } satisfies SubsystemState & { netMarginXAF: number; netMarginPct: number; spendXAF: number };

    const projection: OrderDetailProjection = {
      subsystemStates: {
        commercial: commercialState,
        payment: paymentState,
        logistics: logisticsState,
        quality: qualityState,
        execution: executionState,
        finance: financeState,
      },
      transitionReadiness: transitionReadiness.nextStatuses,
      activeBlockers: uniqueStrings(transitionReadiness.activeBlockers),
      nextRecommendedStatus:
        transitionReadiness.nextStatuses.find((item) => item.ready) ??
        transitionReadiness.nextStatuses[0] ??
        null,
    };

    return {
      ...order,
      projection,
    };
  }
}
