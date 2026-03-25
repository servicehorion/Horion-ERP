"use server";

import { revalidatePath } from "next/cache";
import type { PaymentStatus, Prisma, QuoteApprovalStatus, QuoteStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { AccountingService } from "@/lib/services/accounting.service";
import { AuditService } from "@/lib/services/audit.service";
import { OrderService } from "@/lib/services/order.service";
import { PaymentService } from "@/lib/services/payment.service";
import { QcUpsellService } from "@/lib/services/qc-upsell.service";
import { serializeDecimals } from "@/lib/utils";
import { emitEvent } from "@/lib/events";
import {
  canRoleApproveQuote,
  cancelQuoteWorkflowTasks,
  ensureQuoteIsActive,
  getQuoteApprovalGateLabel,
  getQuoteApprovalPolicy,
  markDemandConvertedForQuote,
  syncDemandStatusForQuote,
} from "@/lib/quotes/workflow";

type QuoteFilters = {
  q?: string;
  status?: string;
  approval?: string;
};

export async function getQuotesOverview(filters: QuoteFilters = {}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const q = (filters.q || "").trim();
    const status = normalizeStatus(filters.status);
    const approval = normalizeApproval(filters.approval);

    const where: Prisma.QuoteWhereInput = {
      isActive: true,
      order: { tenantId: user.tenantId, archivedAt: null },
      ...(status ? { status } : {}),
      ...(approval ? { approvalStatus: approval } : {}),
      ...(q
        ? {
            OR: [
              { order: { orderNumber: { contains: q, mode: "insensitive" } } },
              { order: { contact: { name: { contains: q, mode: "insensitive" } } } },
              { sentByEmailTo: { contains: q, mode: "insensitive" } },
              { signedByName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            contact: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } },
            payments: {
              where: {
                direction: "INBOUND",
                type: "CLIENT_DEPOSIT",
              },
              orderBy: [{ createdAt: "desc" }],
              take: 3,
              select: {
                id: true,
                status: true,
                method: true,
                reference: true,
                createdAt: true,
                confirmedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });

    const rows = serializeDecimals(
      quotes.map((quote) => {
        const snapshot = (quote.pricingSnapshot as Record<string, unknown> | null) ?? {};
          return {
            id: quote.id,
            version: quote.version,
            isActive: quote.isActive,
            status: quote.status,
          approvalStatus: quote.approvalStatus,
          merchandiseTotal: quote.merchandiseTotal,
          logisticsCost: quote.logisticsCost,
          commission: quote.commission,
          insuranceCost: quote.insuranceCost,
          total: quote.total,
          currency: quote.currency,
          createdAt: quote.createdAt,
          validUntil: quote.validUntil,
          sentAt: quote.sentAt,
          sentByEmailAt: quote.sentByEmailAt,
          sentByEmailTo: quote.sentByEmailTo,
          acceptedAt: quote.acceptedAt,
          paidAt: quote.paidAt,
          paymentStatus: quote.paymentStatus,
          paymentMethod: quote.paymentMethod,
          paymentExpiry: quote.paymentExpiry,
          signatureToken: quote.signatureToken,
          signedAt: quote.signedAt,
          signedByName: quote.signedByName,
          source: typeof snapshot.source === "string" ? snapshot.source : "ORDER",
          lineCount:
            typeof snapshot.lineCount === "number"
              ? snapshot.lineCount
              : Array.isArray(snapshot.items)
                ? snapshot.items.length
                : null,
          latestPayment: quote.order.payments[0] ?? null,
          order: quote.order,
        };
      })
    ) as Array<Record<string, any>>;

      const activeRows = rows.filter(
        (row) =>
          row.isActive &&
          !["REJECTED", "EXPIRED"].includes(String(row.status)) &&
          row.approvalStatus !== "REJECTED"
      );

    const kpis = {
      totalQuotes: activeRows.length,
      draft: activeRows.filter((row) => row.status === "DRAFT").length,
      sent: activeRows.filter((row) => row.status === "SENT").length,
      accepted: activeRows.filter((row) => row.status === "ACCEPTED").length,
      rejectedOrExpired: rows.filter((row) => row.status === "REJECTED" || row.status === "EXPIRED").length,
      awaitingApproval: activeRows.filter((row) => row.approvalStatus === "PENDING").length,
      signed: activeRows.filter((row) => Boolean(row.signedAt)).length,
      totalValueXaf: activeRows
        .filter((row) => row.currency === "XAF")
        .reduce((sum, row) => sum + Number(row.total || 0), 0),
    };

    return {
      data: {
        quotes: rows,
        filters: { q, status: status ?? "all", approval: approval ?? "all" },
        kpis,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erreur lors du chargement des devis",
    };
  }
}

async function getLatestQuotePayment(
  orderId: string,
  statuses: PaymentStatus[] = ["PENDING", "PROCESSING", "PENDING_PROOF", "PROOF_UPLOADED", "PROOF_REJECTED"]
) {
  return prisma.payment.findFirst({
    where: {
      orderId,
      direction: "INBOUND",
      type: "CLIENT_DEPOSIT",
      status: { in: statuses },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

async function completeOrderPaymentTasks(orderId: string) {
  await prisma.task.updateMany({
    where: {
      entityType: "order",
      entityId: orderId,
      taskType: "confirm_payment",
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

/** Rôles autorisés à confirmer un paiement client (Finance, direction, futur agent IA) */
function canConfirmPayment(role: string) {
  return ["CEO", "DIRECTION", "ADMIN", "FINANCE_MANAGER", "FINANCE", "OPS"].includes(role);
}

async function completeCeoValidationTasks(orderId: string) {
  await prisma.task.updateMany({
    where: {
      entityType: "order",
      entityId: orderId,
      taskType: { in: ["ceo_payment_validation", "payment_validation"] },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

async function cancelCeoValidationTasks(orderId: string) {
  await prisma.task.updateMany({
    where: {
      entityType: "order",
      entityId: orderId,
      taskType: { in: ["ceo_payment_validation", "payment_validation"] },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });
}

export async function confirmQuoteSubmittedPayment(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");
    if (!canConfirmPayment(user.role)) {
      return { error: "Permission insuffisante pour confirmer ce paiement (Finance, Direction ou CEO requis)." };
    }

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, order: { tenantId: user.tenantId } },
      include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });
      if (quote.paymentStatus !== "SUBMITTED") {
        return { error: "Aucun paiement soumis a confirmer pour ce devis" };
      }

    const payment = await getLatestQuotePayment(quote.order.id);
    if (!payment) {
      return { error: "Aucun paiement en attente n'est lie a ce devis" };
    }

    const confirmedPayment = await PaymentService.confirm(payment.id, user.tenantId);
    try {
      await AccountingService.recordPayment({
        paymentId: confirmedPayment.id,
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (accountingError) {
      try {
        await PaymentService.cancel(payment.id, user.tenantId);
      } catch {
        console.error(
          `[confirmQuoteSubmittedPayment] Accounting compensation failed for payment ${payment.id}.`,
          accountingError
        );
      }
      throw accountingError;
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        paymentStatus: "PAID",
        paidAt: confirmedPayment.paidAt ?? confirmedPayment.confirmedAt ?? new Date(),
        paymentMethod: confirmedPayment.method ?? quote.paymentMethod,
      },
    });

      await completeOrderPaymentTasks(quote.order.id);
      await completeCeoValidationTasks(quote.order.id);
      await QcUpsellService.ensureGhostRequestAfterPayment(quote.order.id);
      await syncDemandStatusForQuote(quote.id);
      const snapshot = (quote.pricingSnapshot as Record<string, unknown> | null) ?? {};
    const isIndicatifQuote = snapshot.source === "SOURCING_INDICATIF";
    if (!isIndicatifQuote && (quote.order.status === "PAIEMENT_EN_COURS" || quote.order.status === "DEVIS")) {
        await OrderService.updateStatus(
          quote.order.id,
          "SOURCING",
          user.id,
          "Paiement confirmé — sourcing profond lancé automatiquement"
        );
      }

      const refreshedQuote = await prisma.quote.findUnique({
        where: { id: quote.id },
        select: { pricingSnapshot: true },
      });
      const refreshedSnapshot = (refreshedQuote?.pricingSnapshot as Record<string, unknown> | null) ?? {};
      const autoSourcing =
        refreshedSnapshot.autoSourcing && typeof refreshedSnapshot.autoSourcing === "object"
          ? (refreshedSnapshot.autoSourcing as Record<string, unknown>)
          : null;
      const firstCaseId =
        autoSourcing && Array.isArray(autoSourcing.caseIds) && autoSourcing.caseIds.length > 0
          ? String(autoSourcing.caseIds[0])
          : null;
      await markDemandConvertedForQuote({
        quoteId: quote.id,
        orderId: quote.order.id,
        convertedCaseId: firstCaseId,
      });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.payment_confirmed",
      entityType: "quote",
      entityId: quote.id,
      newValue: { paymentId: confirmedPayment.id, orderId: quote.order.id },
    });

    revalidatePath("/quotes");
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    revalidatePath("/sourcing/cases");
    revalidatePath("/tasks");
    if (quote.paymentToken) {
      revalidatePath(`/pay/${quote.paymentToken}`);
      revalidatePath(`/pay/${quote.paymentToken}/submitted`);
      revalidatePath(`/pay/${quote.paymentToken}/success`);
      revalidatePath(`/verification/${quote.paymentToken}`);
    }
    return { data: { quoteId: quote.id, paymentId: confirmedPayment.id } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la confirmation du paiement" };
  }
}

export async function rejectQuoteSubmittedPayment(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, order: { tenantId: user.tenantId } },
      include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });
      if (quote.paymentStatus !== "SUBMITTED") {
        return { error: "Ce devis n'a pas de paiement soumis a rejeter" };
      }

    const payment = await getLatestQuotePayment(quote.order.id);
    if (payment) {
      await PaymentService.cancel(payment.id, user.tenantId);
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        paymentStatus: "PENDING",
        paymentMethod: null,
        paidAt: null,
      },
    });

    await cancelCeoValidationTasks(quote.order.id);
    await cancelQuoteWorkflowTasks({ orderId: quote.order.id, includePaymentTasks: true, excludingQuoteId: quote.id });
    await syncDemandStatusForQuote(quote.id);

    await prisma.order.update({
      where: { id: quote.order.id },
      data: {
        status: quote.order.status === "PAIEMENT_EN_COURS" ? "DEVIS" : quote.order.status,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.payment_rejected",
      entityType: "quote",
      entityId: quote.id,
      newValue: { paymentId: payment?.id ?? null, orderId: quote.order.id },
    });

    revalidatePath("/quotes");
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    if (quote.paymentToken) {
      revalidatePath(`/pay/${quote.paymentToken}`);
      revalidatePath(`/pay/${quote.paymentToken}/submitted`);
      revalidatePath(`/pay/${quote.paymentToken}/failed`);
      revalidatePath(`/verification/${quote.paymentToken}`);
    }
    return { data: { quoteId: quote.id, paymentId: payment?.id ?? null } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors du rejet du paiement" };
  }
}

export async function generatePaymentLink(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, order: { tenantId: user.tenantId } },
      include: {
        order: { select: { id: true, orderNumber: true } },
        approvedBy: { select: { role: true } },
      },
    });

      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });
      if (quote.status !== "ACCEPTED") return { error: "Le devis doit etre accepte avant de generer un lien de paiement" };
    const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (
      quote.approvalStatus !== "APPROVED" ||
      !quote.approvedBy ||
      !canRoleApproveQuote(quote.approvedBy.role, policy)
    ) {
      return {
        error: `Le devis doit être validé par ${getQuoteApprovalGateLabel(
          policy.requiredGate
        )} avant d'envoyer le lien de paiement.`,
      };
    }

    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    await prisma.quote.update({
      where: { id: quoteId },
      data: { paymentToken: token, paymentExpiry: expiry, paymentStatus: "PENDING" },
    });

    const siteBaseUrl =
      process.env.PUBLIC_QUOTE_SITE_BASE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000/pay";
    const normalizedBaseUrl = siteBaseUrl.replace(/\/+$/, "");
    const url = normalizedBaseUrl.endsWith("/pay")
      ? `${normalizedBaseUrl}/${token}`
      : `${normalizedBaseUrl}/pay/${token}`;

    return { data: { url, token, expiry: expiry.toISOString() } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la generation du lien" };
  }
}

// ─── Approval Gate ─────────────────────────────────────────────────────────

export async function approveQuote(quoteId: string, note?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.approve");

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, order: { tenantId: user.tenantId } },
      include: {
        order: {
          select: { id: true, orderNumber: true, tenantId: true, ownerId: true },
        },
      },
      });
      if (!quote) return { error: "Devis introuvable" };
      if (quote.approvalStatus === "APPROVED") return { error: "Ce devis est déjà approuvé" };
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (!canRoleApproveQuote(user.role, policy)) {
      return {
        error: `Ce devis doit être validé par ${getQuoteApprovalGateLabel(policy.requiredGate)}.`,
      };
    }

    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        approvalStatus: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
      },
    });

    // Notify the order owner (CM / commercial who created the quote)
    if (quote.order.ownerId) {
      await prisma.notification.create({
        data: {
          tenantId: quote.order.tenantId,
          userId: quote.order.ownerId,
          type: "APPROVAL_REQUIRED",
          title: `Devis approuvé — ${quote.order.orderNumber}`,
          message: note
            ? `Approuvé par ${user.name ?? user.email}. Note : ${note}`
            : `Le devis est approuvé et prêt à être envoyé au client.`,
          entityType: "order",
          entityId: quote.order.id,
        },
      });
    }

    // Complete the quote_approval task if one exists
    await prisma.task.updateMany({
      where: {
        entityType: "order",
        entityId: quote.order.id,
        taskType: "quote_approval",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await syncDemandStatusForQuote(quoteId);

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "quote.approved",
        entityType: "quote",
        entityId: quoteId,
        newValue: { approvedById: user.id, note },
      });
      await emitEvent("quote.approved", "quote", quoteId, {
        orderId: quote.order.id,
        approvedById: user.id,
      });

    revalidatePath("/quotes");
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: { quoteId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'approbation" };
  }
}

export async function rejectQuote(quoteId: string, note: string = "Devis rejeté") {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.approve");

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, order: { tenantId: user.tenantId } },
      include: {
        order: {
          select: { id: true, orderNumber: true, tenantId: true, ownerId: true },
        },
      },
      });
      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (!canRoleApproveQuote(user.role, policy)) {
      return {
        error: `Ce devis doit être traité par ${getQuoteApprovalGateLabel(policy.requiredGate)}.`,
      };
    }

    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        approvalStatus: "REJECTED",
        approvedById: user.id,
        approvedAt: new Date(),
        approvalNote: note,
      },
    });

    // Notify owner
    if (quote.order.ownerId) {
      await prisma.notification.create({
        data: {
          tenantId: quote.order.tenantId,
          userId: quote.order.ownerId,
          type: "APPROVAL_REQUIRED",
          title: `Devis refusé — ${quote.order.orderNumber}`,
          message: `Refusé par ${user.name ?? user.email}. Raison : ${note}`,
          entityType: "order",
          entityId: quote.order.id,
        },
      });
    }

    await prisma.task.updateMany({
      where: {
        entityType: "order",
        entityId: quote.order.id,
        taskType: "quote_approval",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    await cancelQuoteWorkflowTasks({ orderId: quote.order.id, includePaymentTasks: false, excludingQuoteId: quoteId });
    await syncDemandStatusForQuote(quoteId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.rejected",
      entityType: "quote",
      entityId: quoteId,
      newValue: { rejectedById: user.id, note },
    });

    revalidatePath("/quotes");
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: { quoteId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors du refus" };
  }
}

function normalizeStatus(value?: string): QuoteStatus | null {
  if (!value || value === "all") return null;
  const allowed: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
  return allowed.includes(value as QuoteStatus) ? (value as QuoteStatus) : null;
}

function normalizeApproval(value?: string): QuoteApprovalStatus | null {
  if (!value || value === "all") return null;
  const allowed: QuoteApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];
  return allowed.includes(value as QuoteApprovalStatus) ? (value as QuoteApprovalStatus) : null;
}
