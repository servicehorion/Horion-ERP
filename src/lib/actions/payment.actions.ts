"use server";

import { getSession } from "@/lib/session";
import { PaymentService } from "@/lib/services/payment.service";
import { MarginService } from "@/lib/services/margin.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { AccountingService } from "@/lib/services/accounting.service";
import { StorageService } from "@/lib/services/storage.service";
import { checkPermission } from "@/lib/permissions";
import { createPaymentSchema } from "@/lib/validators/payment";
import { revalidatePath } from "next/cache";
import type { PaymentDirection, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const uniqueIds = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

async function getOrderTeamUserIds(orderId: string): Promise<string[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ownerId: true,
      onboardedById: true,
      collaborators: { select: { userId: true } },
      tenantId: true,
    },
  });
  if (!order) return [];
  return uniqueIds([
    order.ownerId,
    order.onboardedById,
    ...order.collaborators.map((c) => c.userId),
  ]);
}

export async function createPayment(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.create");

    const validated = createPaymentSchema.parse(formData);
    const payment = await PaymentService.create(validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payment.created",
      entityType: "payment",
      entityId: payment.id,
      newValue: {
        orderId: validated.orderId,
        direction: validated.direction,
        amount: validated.amount,
        currency: validated.currency,
      },
    });

    const teamIds = await getOrderTeamUserIds(validated.orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "PAYMENT_CREATED",
      title: "Paiement enregistre",
      message: `${user.name || user.email} a ajoute un paiement`,
      entityType: "payment",
      entityId: payment.id,
    });

    revalidatePath(`/orders/${validated.orderId}`);
    revalidatePath("/orders");
    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    return { data: payment };
  } catch (error) {
    console.error("Error creating payment:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du paiement" };
  }
}

export async function createPaymentSchedule(params: {
  orderId: string;
  depositPercent?: number;
  installments?: number;
  intervalDays?: number;
  startDate?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.create");

    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: { id: true, tenantId: true, totalClient: true, currency: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const payments = await PaymentService.createSchedule({
      orderId: order.id,
      totalAmount: Number(order.totalClient),
      currency: order.currency || "XAF",
      depositPercent: params.depositPercent ?? 30,
      installments: params.installments ?? 2,
      intervalDays: params.intervalDays ?? 30,
      startDate: params.startDate ? new Date(params.startDate) : new Date(),
      direction: "INBOUND",
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payment.schedule_created",
      entityType: "order",
      entityId: order.id,
      newValue: {
        installments: params.installments ?? 2,
        depositPercent: params.depositPercent ?? 30,
      },
    });

    const teamIds = await getOrderTeamUserIds(order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "PAYMENT_CREATED",
      title: "Echeancier cree",
      message: `${user.name || user.email} a genere un echeancier`,
      entityType: "order",
      entityId: order.id,
    });

    revalidatePath(`/orders/${order.id}`);
    return { data: payments };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation echeancier" };
  }
}

export async function autoReconcileOrderPayments(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, orderNumber: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const payments = await prisma.payment.findMany({
      where: {
        orderId,
        status: { in: ["PENDING", "PROCESSING", "PENDING_PROOF", "PROOF_UPLOADED", "PROOF_REJECTED"] },
        direction: "INBOUND",
      },
      orderBy: { dueAt: "asc" },
    });
    if (payments.length === 0) return { data: { reconciled: 0 } };

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        status: "PENDING",
        connection: { tenantId: user.tenantId },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });

    let reconciled = 0;
    for (const tx of transactions) {
      const match = payments.find((p) => {
        const sameAmount = Number(p.amountXAF) === Number(tx.amount);
        if (!sameAmount) return false;
        if (tx.reference && order.orderNumber && tx.reference.includes(order.orderNumber)) return true;
        if (p.reference && tx.reference && p.reference === tx.reference) return true;
        return false;
      });

      if (match) {
        await PaymentService.confirm(match.id, user.tenantId);
        await prisma.bankTransaction.update({
          where: { id: tx.id },
          data: { status: "RECONCILED", matchedPaymentId: match.id },
        });
        const idx = payments.findIndex((p) => p.id === match.id);
        if (idx >= 0) payments.splice(idx, 1);
        reconciled++;
      }
    }

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/finance/treasury");
    return { data: { reconciled } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur reconciliation bancaire" };
  }
}

export async function getPayments(options?: {
  orderId?: string;
  direction?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const result = await PaymentService.list({
      tenantId: user.tenantId,
      orderId: options?.orderId,
      direction: options?.direction as PaymentDirection | undefined,
      status: options?.status as PaymentStatus | undefined,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result.payments };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des paiements" };
  }
}

export async function confirmPayment(paymentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    // PaymentService and AccountingService use the global prisma instance
    // internally, preventing a shared managed transaction. We use a
    // compensation pattern: if AccountingService fails we revert the payment
    // to PENDING so the operator can safely retry without data inconsistency.
    const payment = await PaymentService.confirm(paymentId, user.tenantId);
    try {
      await AccountingService.recordPayment({
        paymentId: payment.id,
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (accountingError) {
      // Compensation: revert payment to PENDING so the user can retry
      try {
        await PaymentService.cancel(paymentId, user.tenantId);
      } catch {
        // Compensation failed — flag for manual reconciliation
        console.error(
          `[confirmPayment] CRITICAL: payment ${paymentId} confirmed but accounting failed AND compensation failed. Manual reconciliation required.`,
          accountingError
        );
      }
      throw accountingError;
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payment.confirmed",
      entityType: "payment",
      entityId: paymentId,
    });

    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    return { data: payment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la confirmation" };
  }
}

export async function rejectPaymentProof(paymentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, status: "PROOF_UPLOADED" },
      select: { id: true, orderId: true },
    });
    if (!payment) return { error: "Paiement introuvable ou statut incorrect" };

    const order = await prisma.order.findUnique({
      where: { id: payment.orderId },
      select: { tenantId: true },
    });
    if (!order || order.tenantId !== user.tenantId) return { error: "Non autorisé" };

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "PROOF_REJECTED",
        notes: `Preuve rejetée par ${user.name || user.email} le ${new Date().toLocaleString("fr-FR")} — illisible ou non conforme.`,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payment.proof_rejected",
      entityType: "payment",
      entityId: paymentId,
    });

    revalidatePath("/finance/payments");
    return { data: { ok: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejet preuve" };
  }
}

export async function getAgentComptablePayments() {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const base = {
      direction: "INBOUND" as const,
      order: { tenantId: user.tenantId },
    };

    const [toReviewRaw, waitingRaw, securedRaw] = await Promise.all([
      prisma.payment.findMany({
        where: { ...base, status: "PROOF_UPLOADED" },
        orderBy: { proofUploadedAt: "asc" },
        include: {
          order: {
            include: {
              contact: {
                select: {
                  name: true,
                  phone: true,
                  whatsapp: true,
                },
              },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: { ...base, status: { in: ["PENDING_PROOF", "PROOF_REJECTED"] } },
        orderBy: { expiresAt: "asc" },
        include: {
          order: {
            include: {
              contact: {
                select: {
                  name: true,
                  phone: true,
                  whatsapp: true,
                },
              },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: { ...base, status: "CONFIRMED" },
        orderBy: { confirmedAt: "desc" },
        take: 50,
        include: {
          order: {
            include: {
              contact: {
                select: {
                  name: true,
                  phone: true,
                  whatsapp: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const [toReview, waiting, secured] = await Promise.all([
      Promise.all(
        toReviewRaw.map(async (payment) => ({
          ...payment,
          amountXAF: Number(payment.amountXAF),
          proofDownloadUrl: await StorageService.createDownloadUrl(payment.proofUrl),
        }))
      ),
      Promise.all(
        waitingRaw.map(async (payment) => ({
          ...payment,
          amountXAF: Number(payment.amountXAF),
          proofDownloadUrl: await StorageService.createDownloadUrl(payment.proofUrl),
        }))
      ),
      Promise.all(
        securedRaw.map(async (payment) => ({
          ...payment,
          amountXAF: Number(payment.amountXAF),
        }))
      ),
    ]);

    return { data: { toReview, waiting, secured } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function cancelPayment(paymentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const payment = await PaymentService.cancel(paymentId, user.tenantId);

    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    return { data: payment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'annulation" };
  }
}

export async function getPaymentSummary(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await PaymentService.getOrderPaymentSummary(orderId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getMonthlyPaymentStats() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await PaymentService.getMonthlyStats(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

// --- Margins ---

export async function calculateMargin(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");
    const report = await MarginService.calculateForOrder(orderId);

    revalidatePath("/finance/margins");
    revalidatePath("/dashboard");
    return { data: report };
  } catch (error) {
    console.error("Error calculating margin:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors du calcul de la marge" };
  }
}

export async function getMargins(options?: { page?: number; limit?: number }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const result = await MarginService.list(user.tenantId, options);
    return { data: result.reports };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des marges" };
  }
}

export async function getAverageMargin() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await MarginService.getAverageMargin(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}
