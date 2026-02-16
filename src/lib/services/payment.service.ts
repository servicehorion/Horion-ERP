import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import type { PaymentDirection, PaymentStatus, PaymentType, Prisma } from "@prisma/client";

export class PaymentService {
  static async create(data: {
    orderId: string;
    direction: PaymentDirection;
    type: PaymentType;
    amount: number;
    currency: string;
    amountXAF: number;
    fxRate?: number;
    method?: string;
    reference?: string;
    notes?: string;
  }) {
    const payment = await prisma.payment.create({
      data: {
        orderId: data.orderId,
        direction: data.direction,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        amountXAF: data.amountXAF,
        fxRate: data.fxRate,
        method: data.method,
        reference: data.reference,
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
      status?: PaymentStatus;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { tenantId, orderId, direction, status, page = 1, limit = 20 } = options;

    const where: Prisma.PaymentWhereInput = {
      ...(tenantId && { order: { tenantId } }),
      ...(orderId && { orderId }),
      ...(direction && { direction }),
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
      if (existing.status !== "PENDING" && existing.status !== "PROCESSING") {
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

    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: "CANCELLED" },
    });
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
