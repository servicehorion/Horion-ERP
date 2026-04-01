import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import type { PaymentDirection, PaymentMethod, PaymentStatus, PaymentType, Prisma } from "@prisma/client";
import { convertCurrency } from "@/config/currencies";
import { PaymentGatewayFactory } from "@/lib/payment-gateway/factory";

export class PaymentService {
  static async create(data: {
    orderId: string;
    direction: PaymentDirection;
    type: PaymentType;
    amount: number;
    currency: string;
    amountXAF: number;
    fxRate?: number;
    methodKey?: PaymentMethod;
    method?: string;
    reference?: string;
    proofUrl?: string;
    depositCode?: string;
    expiresAt?: string | Date;
    proofUploadedAt?: string | Date;
    dueAt?: string;
    notes?: string;
  }) {
    // Idempotency: if a reference is provided, return the existing payment
    // rather than creating a duplicate. This prevents double-submission on retry.
    if (data.reference) {
      const existing = await prisma.payment.findFirst({
        where: { orderId: data.orderId, reference: data.reference },
        include: { order: { select: { orderNumber: true } } },
      });
      if (existing) return existing;
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: data.orderId,
        direction: data.direction,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        amountXAF: data.amountXAF,
        fxRate: data.fxRate,
        methodKey: data.methodKey,
        method: data.method,
        reference: data.reference,
        proofUrl: data.proofUrl,
        depositCode: data.depositCode,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        proofUploadedAt: data.proofUploadedAt ? new Date(data.proofUploadedAt) : undefined,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        notes: data.notes,
      },
      include: {
        order: { select: { orderNumber: true } },
      },
    });

    await emitEvent("payment.created", "payment", payment.id, {
      orderId: data.orderId,
      direction: data.direction,
      type: data.type,
      amount: Number(data.amount),
      currency: data.currency,
    });

    return payment;
  }

  static async list(
    options: {
      tenantId?: string;
      orderId?: string;
      direction?: PaymentDirection;
      type?: PaymentType;
      status?: PaymentStatus;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { tenantId, orderId, direction, type, status, page = 1, limit = 20 } = options;

    const where: Prisma.PaymentWhereInput = {
      ...(tenantId && { order: { tenantId } }),
      ...(orderId && { orderId }),
      ...(direction && { direction }),
      ...(type && { type }),
      ...(status && { status }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async confirm(paymentId: string, tenantId?: string) {
    // Verify tenant ownership if provided
    if (tenantId) {
      const existing = await prisma.payment.findFirst({
        where: { id: paymentId, order: { tenantId } },
      });
      if (!existing) throw new Error("Paiement introuvable");
      // Idempotency: if already confirmed, return the existing payment silently
      if (existing.status === "CONFIRMED") return existing;
      if (!["PENDING", "PROCESSING", "PENDING_PROOF", "PROOF_UPLOADED", "PROOF_REJECTED"].includes(existing.status)) {
        throw new Error(`Impossible de confirmer un paiement ${existing.status}`);
      }
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        paidAt: new Date(),
      },
    });

    await emitEvent("payment.confirmed", "payment", payment.id, {
      orderId: payment.orderId,
      amount: Number(payment.amount),
    });

    return payment;
  }

  static async markProofUploaded(paymentId: string, params: {
    proofUrl: string;
    reference?: string | null;
    tenantId?: string;
  }) {
    if (params.tenantId) {
      const existing = await prisma.payment.findFirst({
        where: { id: paymentId, order: { tenantId: params.tenantId } },
        select: { id: true, status: true },
      });
      if (!existing) throw new Error("Paiement introuvable");
      if (!["PENDING_PROOF", "PROOF_REJECTED"].includes(existing.status)) {
        throw new Error("Ce paiement n'attend pas de preuve.");
      }
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "PROOF_UPLOADED",
        proofUrl: params.proofUrl,
        reference: params.reference ?? undefined,
        proofUploadedAt: new Date(),
      },
    });

    await emitEvent("payment.proof_uploaded", "payment", payment.id, {
      orderId: payment.orderId,
      proofUrl: params.proofUrl,
    });

    return payment;
  }

  static async cancel(paymentId: string, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.payment.findFirst({
        where: { id: paymentId, order: { tenantId } },
      });
      if (!existing) throw new Error("Paiement introuvable");
      if (existing.status === "CONFIRMED") {
        throw new Error("Impossible d'annuler un paiement déjà confirmé");
      }
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "CANCELLED" },
    });

    await emitEvent("payment.cancelled", "payment", payment.id, {
      orderId: payment.orderId,
      amount: Number(payment.amount),
    });

    return payment;
  }

  static getGateway(method: PaymentMethod, providerName?: string | null) {
    return PaymentGatewayFactory.resolve(method, providerName);
  }

  static async createSchedule(params: {
    orderId: string;
    totalAmount: number;
    currency: string;
    depositPercent?: number;
    installments?: number;
    startDate?: Date;
    intervalDays?: number;
    direction?: PaymentDirection;
  }) {
    const installments = Math.max(1, params.installments ?? 2);
    const depositPercent = Math.min(100, Math.max(0, params.depositPercent ?? 30));
    const startDate = params.startDate ?? new Date();
    const intervalDays = Math.max(1, params.intervalDays ?? 30);
    const direction = params.direction ?? "INBOUND";

    const total = Number(params.totalAmount || 0);
    const amounts: number[] = [];

    if (installments === 1 || depositPercent === 0) {
      amounts.push(total);
    } else {
      const deposit = +(total * (depositPercent / 100)).toFixed(2);
      const remainder = +(total - deposit).toFixed(2);
      const per = +(remainder / Math.max(1, installments - 1)).toFixed(2);
      amounts.push(deposit, ...Array.from({ length: installments - 1 }, () => per));
    }

    const data = amounts.map((amount, idx) => {
      const dueAt = new Date(startDate.getTime() + idx * intervalDays * 86_400_000);
      const amountXAF =
        params.currency === "XAF"
          ? amount
          : convertCurrency(amount, params.currency, "XAF");
      return {
        orderId: params.orderId,
        direction,
        type: (idx === 0 ? "CLIENT_DEPOSIT" : "CLIENT_BALANCE") as PaymentType,
        status: "PENDING" as const,
        amount,
        currency: params.currency,
        amountXAF,
        dueAt,
      };
    });

    await prisma.payment.createMany({ data });

    const payments = await prisma.payment.findMany({
      where: { orderId: params.orderId },
      orderBy: { dueAt: "asc" },
    });

    await emitEvent("payment.schedule_created", "order", params.orderId, {
      orderId: params.orderId,
      installments,
      total: total,
    });

    return payments;
  }

  static async getOrderPaymentSummary(orderId: string) {
    const payments = await prisma.payment.findMany({
      where: { orderId, status: "CONFIRMED" },
    });

    const inbound = payments
      .filter((p) => p.direction === "INBOUND")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);

    const outbound = payments
      .filter((p) => p.direction === "OUTBOUND")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);

    return { inbound, outbound, balance: inbound - outbound, count: payments.length };
  }

  static async getMonthlyStats(tenantId: string) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const payments = await prisma.payment.findMany({
      where: {
        status: "CONFIRMED",
        confirmedAt: { gte: startOfMonth },
        order: { tenantId },
      },
    });

    const totalInbound = payments
      .filter((p) => p.direction === "INBOUND")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);

    const totalOutbound = payments
      .filter((p) => p.direction === "OUTBOUND")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);

    return { totalInbound, totalOutbound, netCashflow: totalInbound - totalOutbound };
  }
}
