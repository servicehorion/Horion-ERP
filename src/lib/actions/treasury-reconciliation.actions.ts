"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { AuditService } from "@/lib/services/audit.service";

type TreasuryMatchCandidate = {
  kind: "PAYMENT" | "BANK_TRANSACTION";
  targetId: string;
  score: number;
  method: string;
};

function normalizeReference(value?: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function scoreReference(left?: string | null, right?: string | null) {
  const a = normalizeReference(left);
  const b = normalizeReference(right);
  if (!a || !b) return 0;
  if (a === b) return 40;
  if (a.includes(b) || b.includes(a)) return 24;
  return 0;
}

function scoreDateDistance(left: Date, right: Date, maxDays = 7) {
  const diffDays = Math.abs(left.getTime() - right.getTime()) / 86_400_000;
  if (diffDays > maxDays) return 0;
  return Math.max(0, 20 - diffDays * 3);
}

function scoreAmountDistance(left: number, right: number, tolerance = 0.03) {
  if (left <= 0 || right <= 0) return 0;
  const ratio = Math.abs(left - right) / Math.max(left, right);
  if (ratio > tolerance) return 0;
  return Math.max(0, 35 - ratio * 400);
}

async function findBestCandidate(transactionId: string) {
  const transaction = await prisma.treasuryTransaction.findUnique({
    where: { id: transactionId },
    include: {
      account: {
        select: {
          id: true,
          tenantId: true,
          currency: true,
        },
      },
    },
  });

  if (!transaction) return null;

  const txAmount = Number(transaction.amount);
  const txAmountXaf = transaction.fxRate ? txAmount * Number(transaction.fxRate) : null;
  const txDate = transaction.createdAt;

  let best: TreasuryMatchCandidate | null = null;

  if (transaction.type === "ORDER_DEBIT") {
    const payments = await prisma.payment.findMany({
      where: {
        order: { tenantId: transaction.account.tenantId },
        direction: "OUTBOUND",
        status: { in: ["PENDING", "PROCESSING", "CONFIRMED"] },
        ...(transaction.orderId ? { orderId: transaction.orderId } : {}),
      },
      select: {
        id: true,
        orderId: true,
        amount: true,
        amountXAF: true,
        currency: true,
        reference: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: transaction.orderId ? 20 : 80,
    });

    for (const payment of payments) {
      let score = 0;
      if (transaction.orderId && payment.orderId === transaction.orderId) score += 40;
      score += scoreReference(transaction.reference, payment.reference);
      score += scoreDateDistance(txDate, payment.createdAt, 10);

      if (payment.currency === transaction.account.currency) {
        score += scoreAmountDistance(txAmount, Number(payment.amount), 0.05);
      } else if (txAmountXaf != null) {
        score += scoreAmountDistance(txAmountXaf, Number(payment.amountXAF), 0.08);
      }

      if (!best || score > best.score) {
        best = {
          kind: "PAYMENT",
          targetId: payment.id,
          score,
          method: payment.orderId === transaction.orderId && score >= 70 ? "ORDER_REF" : "HYBRID",
        };
      }
    }
  }

  if (transaction.type === "TOP_UP") {
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: {
        connection: { tenantId: transaction.account.tenantId },
        status: { in: ["PENDING", "POSTED", "RECONCILED"] },
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        direction: true,
        reference: true,
        description: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "desc" },
      take: 120,
    });

    for (const bankTransaction of bankTransactions) {
      let score = 0;
      if (bankTransaction.direction === "OUT") score += 10;
      score += scoreReference(transaction.reference, bankTransaction.reference || bankTransaction.description);
      score += scoreDateDistance(txDate, bankTransaction.occurredAt, 10);
      if (txAmountXaf != null) {
        score += scoreAmountDistance(txAmountXaf, Number(bankTransaction.amount), 0.12);
      }

      if (!best || score > best.score) {
        best = {
          kind: "BANK_TRANSACTION",
          targetId: bankTransaction.id,
          score,
          method: "FX_TOPUP",
        };
      }
    }
  }

  return best && best.score >= 55 ? { transaction, candidate: best } : { transaction, candidate: null };
}

export async function runTreasuryAutoReconciliation(limit = 40) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const pending = await prisma.treasuryTransaction.findMany({
      where: {
        account: { tenantId: user.tenantId },
        status: { in: ["PENDING", "SUGGESTED"] },
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 200)),
      select: { id: true },
    });

    let suggested = 0;
    for (const item of pending) {
      const result = await findBestCandidate(item.id);
      if (!result?.candidate) continue;

      await prisma.treasuryTransaction.update({
        where: { id: item.id },
        data: {
          status: "SUGGESTED",
          matchedPaymentId:
            result.candidate.kind === "PAYMENT" ? result.candidate.targetId : null,
          matchedBankTransactionId:
            result.candidate.kind === "BANK_TRANSACTION" ? result.candidate.targetId : null,
          matchScore: result.candidate.score,
          matchMethod: result.candidate.method,
          metadata: {
            ...(result.transaction.metadata as Record<string, unknown> | null ?? {}),
            suggestedBy: "AUTO",
            suggestedAt: new Date().toISOString(),
          },
        },
      });
      suggested += 1;
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "treasury.reconciliation.auto_suggested",
      entityType: "treasury_transaction",
      entityId: "bulk",
      newValue: { scanned: pending.length, suggested },
    });

    revalidatePath("/finance/treasury");
    return { data: { scanned: pending.length, suggested } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rapprochement automatique" };
  }
}

export async function confirmTreasuryReconciliation(transactionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const transaction = await prisma.treasuryTransaction.findFirst({
      where: {
        id: transactionId,
        account: { tenantId: user.tenantId },
      },
      select: {
        id: true,
        status: true,
        matchedPaymentId: true,
        matchedBankTransactionId: true,
      },
    });

    if (!transaction) return { error: "Mouvement introuvable" };
    if (!transaction.matchedPaymentId && !transaction.matchedBankTransactionId) {
      return { error: "Aucune suggestion de rapprochement disponible" };
    }

    const updated = await prisma.treasuryTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "RECONCILED",
        reconciledAt: new Date(),
        reconciledById: user.id,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "treasury.reconciliation.confirmed",
      entityType: "treasury_transaction",
      entityId: updated.id,
      newValue: {
        matchedPaymentId: updated.matchedPaymentId,
        matchedBankTransactionId: updated.matchedBankTransactionId,
      },
    });

    revalidatePath("/finance/treasury");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur validation rapprochement" };
  }
}

export async function resetTreasuryReconciliation(transactionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const updated = await prisma.treasuryTransaction.update({
      where: { id: transactionId },
      data: {
        status: "PENDING",
        matchedPaymentId: null,
        matchedBankTransactionId: null,
        matchScore: null,
        matchMethod: null,
        reconciledAt: null,
        reconciledById: null,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "treasury.reconciliation.reset",
      entityType: "treasury_transaction",
      entityId: updated.id,
    });

    revalidatePath("/finance/treasury");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur reinitialisation rapprochement" };
  }
}

export async function ignoreTreasuryReconciliation(transactionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const updated = await prisma.treasuryTransaction.update({
      where: { id: transactionId },
      data: {
        status: "IGNORED",
        matchedPaymentId: null,
        matchedBankTransactionId: null,
        matchScore: null,
        matchMethod: null,
        reconciledAt: null,
        reconciledById: user.id,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "treasury.reconciliation.ignored",
      entityType: "treasury_transaction",
      entityId: updated.id,
    });

    revalidatePath("/finance/treasury");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur ignore rapprochement" };
  }
}

export async function getTreasuryReconciliationSnapshot(limit = 30) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");

    const transactions = await prisma.treasuryTransaction.findMany({
      where: {
        account: { tenantId: user.tenantId },
      },
      include: {
        account: { select: { id: true, label: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 100)),
    });

    const paymentIds = Array.from(new Set(transactions.map((item) => item.matchedPaymentId).filter(Boolean))) as string[];
    const bankIds = Array.from(new Set(transactions.map((item) => item.matchedBankTransactionId).filter(Boolean))) as string[];

    const [payments, bankTransactions] = await Promise.all([
      paymentIds.length > 0
        ? prisma.payment.findMany({
            where: { id: { in: paymentIds } },
            select: {
              id: true,
              orderId: true,
              reference: true,
              amount: true,
              currency: true,
              amountXAF: true,
              order: { select: { orderNumber: true } },
            },
          })
        : [],
      bankIds.length > 0
        ? prisma.bankTransaction.findMany({
            where: { id: { in: bankIds } },
            select: {
              id: true,
              amount: true,
              currency: true,
              reference: true,
              description: true,
              occurredAt: true,
            },
          })
        : [],
    ]);

    const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
    const bankById = new Map(bankTransactions.map((transaction) => [transaction.id, transaction]));

    return {
      data: transactions.map((transaction) => ({
        ...transaction,
        suggestedPayment: transaction.matchedPaymentId ? paymentsById.get(transaction.matchedPaymentId) ?? null : null,
        suggestedBankTransaction: transaction.matchedBankTransactionId
          ? bankById.get(transaction.matchedBankTransactionId) ?? null
          : null,
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur snapshot rapprochement" };
  }
}
