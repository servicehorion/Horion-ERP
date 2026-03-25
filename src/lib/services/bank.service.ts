import { prisma } from "@/lib/db";
import type { BankConnectionStatus, BankTransactionStatus } from "@prisma/client";

export class BankService {
  static async listConnections(tenantId: string) {
    return prisma.bankConnection.findMany({
      where: { tenantId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createConnection(params: {
    tenantId: string;
    provider: string;
    accountName?: string;
    accountNumber?: string;
    currency: string;
    apiBaseUrl?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    webhookSecret?: string;
  }) {
    return prisma.bankConnection.create({
      data: {
        tenantId: params.tenantId,
        provider: params.provider,
        accountName: params.accountName || undefined,
        accountNumber: params.accountNumber || undefined,
        currency: params.currency,
        apiBaseUrl: params.apiBaseUrl || undefined,
        clientId: params.clientId || undefined,
        clientSecret: params.clientSecret || undefined,
        accessToken: params.accessToken || undefined,
        refreshToken: params.refreshToken || undefined,
        webhookSecret: params.webhookSecret || undefined,
      },
    });
  }

  static async updateConnectionStatus(id: string, status: BankConnectionStatus) {
    return prisma.bankConnection.update({ where: { id }, data: { status } });
  }

  static async listTransactions(tenantId: string, status?: BankTransactionStatus) {
    return prisma.bankTransaction.findMany({
      where: {
        connection: { tenantId },
        ...(status && { status }),
      },
      include: { connection: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  }

  static async addTransaction(params: {
    connectionId: string;
    occurredAt: Date;
    amount: number;
    currency: string;
    direction: string;
    counterparty?: string | null;
    category?: string | null;
    description?: string | null;
    reference?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.bankTransaction.create({
      data: {
        connectionId: params.connectionId,
        occurredAt: params.occurredAt,
        amount: params.amount,
        currency: params.currency,
        direction: params.direction,
        counterparty: params.counterparty || undefined,
        category: params.category || undefined,
        description: params.description || undefined,
        reference: params.reference || undefined,
        metadata: (params.metadata || {}) as any,
      },
    });
  }

  static async reconcileTransaction(params: { transactionId: string; paymentId?: string | null }) {
    return prisma.bankTransaction.update({
      where: { id: params.transactionId },
      data: {
        status: "RECONCILED",
        matchedPaymentId: params.paymentId || undefined,
      },
    });
  }

  static async autoReconcile(tenantId: string) {
    const pending = await prisma.bankTransaction.findMany({
      where: {
        status: "PENDING",
        connection: { tenantId },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });

    if (pending.length === 0) return { reconciled: 0 };

    const payments = await prisma.payment.findMany({
      where: { status: "CONFIRMED", order: { tenantId } },
      select: {
        id: true,
        amountXAF: true,
        confirmedAt: true,
        reference: true,
        order: { select: { orderNumber: true } },
      },
      take: 800,
    });

    const normalize = (value?: string | null) =>
      String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const scorePayment = (tx: any, payment: any) => {
      let score = 0;
      const amountDiff = Math.abs(Number(payment.amountXAF) - Number(tx.amount));
      if (amountDiff <= 5) score += 60;
      if (payment.confirmedAt) {
        const diffDays = Math.abs(
          (payment.confirmedAt.getTime() - tx.occurredAt.getTime()) / 86_400_000
        );
        if (diffDays <= 1) score += 20;
        else if (diffDays <= 3) score += 10;
      }
      const ref = normalize(payment.reference);
      const txRef = normalize(tx.reference);
      const desc = normalize(tx.description);
      if (ref && (txRef.includes(ref) || desc.includes(ref))) score += 15;
      const orderNumber = normalize(payment.order?.orderNumber);
      if (orderNumber && (txRef.includes(orderNumber) || desc.includes(orderNumber))) score += 10;
      return score;
    };

    let reconciled = 0;
    for (const tx of pending) {
      let best: { payment: any; score: number } | null = null;
      for (const p of payments) {
        const score = scorePayment(tx, p);
        if (!best || score > best.score) best = { payment: p, score };
      }
      if (best && best.score >= 60) {
        await prisma.bankTransaction.update({
          where: { id: tx.id },
          data: {
            status: "RECONCILED",
            matchedPaymentId: best.payment.id,
            matchScore: best.score,
            matchMethod: "AUTO",
          },
        });
        reconciled++;
      }
    }

    return { reconciled };
  }

  static async syncTransactions(params: { connectionId: string }) {
    const connection = await prisma.bankConnection.findUnique({ where: { id: params.connectionId } });
    if (!connection) throw new Error("Connexion bancaire introuvable");

    const baseUrl =
      connection.apiBaseUrl ||
      process.env[`BANK_API_URL_${String(connection.provider).toUpperCase()}`] ||
      process.env.BANK_API_URL;
    if (!baseUrl) {
      return { imported: 0, error: "API banque non configuree" };
    }

    try {
      const since = connection.lastSyncAt ? connection.lastSyncAt.toISOString() : undefined;
      const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const url = new URL(`${normalizedBaseUrl}/transactions`);
      if (connection.accountNumber) url.searchParams.set("account", connection.accountNumber);
      if (since) url.searchParams.set("since", since);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...(connection.accessToken ? { Authorization: `Bearer ${connection.accessToken}` } : {}),
        },
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        await prisma.bankConnection.update({ where: { id: connection.id }, data: { lastError: `HTTP ${res.status}` } });
        return { imported: 0, error: `Erreur API banque (${res.status})` };
      }

      const items = Array.isArray(payload) ? payload : payload?.transactions || [];
      let imported = 0;
      for (const item of items) {
        await this.addTransaction({
          connectionId: connection.id,
          occurredAt: new Date(item.occurredAt || item.date || Date.now()),
          amount: Number(item.amount || 0),
          currency: item.currency || connection.currency,
          direction: item.direction || "IN",
          description: item.description || item.memo || undefined,
          reference: item.reference || item.id || undefined,
          counterparty: item.counterparty || item.party || undefined,
          category: item.category || undefined,
          metadata: item,
        });
        imported++;
      }

      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });

      return { imported };
    } catch (error) {
      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: { lastError: error instanceof Error ? error.message : "Erreur sync" },
      });
      return { imported: 0, error: error instanceof Error ? error.message : "Erreur sync" };
    }
  }

  static async createReconciliation(params: { tenantId: string; periodId?: string | null; createdById?: string | null }) {
    return prisma.bankReconciliation.create({
      data: {
        tenantId: params.tenantId,
        periodId: params.periodId || undefined,
        createdById: params.createdById || undefined,
      },
    });
  }
}
