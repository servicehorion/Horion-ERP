import { NextResponse } from "next/server";

import { requireSecretHeader } from "@/lib/api/secret-auth";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { PawaPayAdapter } from "@/lib/payment-gateway/pawapay-adapter";
import { PaymentGatewayFactory } from "@/lib/payment-gateway/factory";
import { PaymentService } from "@/lib/services/payment.service";

const PENDING_STATUSES = ["PENDING", "PROCESSING"] as const;

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (PaymentGatewayFactory.getPreferredProvider() !== "PAWAPAY") {
      return NextResponse.json({ data: { skipped: true, reason: "provider_not_pawapay" } });
    }

    const gateway = PaymentService.getGateway("AGGREGATOR", "PAWAPAY");
    const pawapay = new PawaPayAdapter();

    const [deposits, refunds] = await Promise.all([
      prisma.payment.findMany({
        where: {
          direction: "INBOUND",
          type: "CLIENT_DEPOSIT",
          status: { in: [...PENDING_STATUSES] },
          reference: { not: null },
          method: { startsWith: "PAWAPAY:" },
        },
        select: { id: true, orderId: true, reference: true, amountXAF: true, notes: true },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.payment.findMany({
        where: {
          direction: "OUTBOUND",
          type: "REFUND",
          status: { in: [...PENDING_STATUSES] },
          reference: { not: null },
          method: { startsWith: "PAWAPAY_REFUND:" },
        },
        select: { id: true, orderId: true, reference: true, notes: true },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);

    let depositsConfirmed = 0;
    let depositsCancelled = 0;
    let refundsConfirmed = 0;
    let refundsCancelled = 0;

    for (const payment of deposits) {
      try {
        const status = await gateway.verifyTransaction(payment.reference!);
        if (status.status === "CONFIRMED") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "CONFIRMED",
              confirmedAt: new Date(),
              paidAt: new Date(),
              notes: [payment.notes, `Confirmation pawaPay via polling. Reference: ${payment.reference}.`]
                .filter(Boolean)
                .join(" "),
            },
          });
          await prisma.order.updateMany({
            where: { id: payment.orderId, status: "PAIEMENT_EN_COURS" },
            data: { status: "SOURCING" },
          });
          await emitEvent("payment.confirmed", "payment", payment.id, {
            orderId: payment.orderId,
            amountXAF: Number(payment.amountXAF),
            method: "pawapay_polling",
            providerReference: payment.reference,
            rawPayload: status.raw ? JSON.parse(JSON.stringify(status.raw)) : null,
          });
          depositsConfirmed += 1;
        } else if (status.status === "FAILED" || status.status === "CANCELLED") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: status.status === "FAILED" ? "FAILED" : "CANCELLED",
              notes: [payment.notes, `Paiement pawaPay ${status.status.toLowerCase()} via polling. Reference: ${payment.reference}.`]
                .filter(Boolean)
                .join(" "),
            },
          });
          await emitEvent("payment.cancelled", "payment", payment.id, {
            orderId: payment.orderId,
            reason: status.status,
            providerReference: payment.reference,
            rawPayload: status.raw ? JSON.parse(JSON.stringify(status.raw)) : null,
          });
          depositsCancelled += 1;
        }
      } catch {
        // On laisse le paiement en attente ; la callback ou le prochain polling reprendra.
      }
    }

    for (const payment of refunds) {
      try {
        const status = await pawapay.verifyRefund(payment.reference!);
        if (status.status === "CONFIRMED") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "REFUNDED",
              confirmedAt: new Date(),
              paidAt: new Date(),
              notes: [payment.notes, `Remboursement pawaPay confirme via polling. Reference: ${payment.reference}.`]
                .filter(Boolean)
                .join(" "),
            },
          });
          refundsConfirmed += 1;
        } else if (status.status === "FAILED" || status.status === "CANCELLED") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: status.status === "FAILED" ? "FAILED" : "CANCELLED",
              notes: [payment.notes, `Remboursement pawaPay ${status.status.toLowerCase()} via polling. Reference: ${payment.reference}.`]
                .filter(Boolean)
                .join(" "),
            },
          });
          refundsCancelled += 1;
        }
      } catch {
        // Meme logique : on n'annule pas a tort en cas d'indisponibilite temporaire.
      }
    }

    return NextResponse.json({
      data: {
        depositsChecked: deposits.length,
        depositsConfirmed,
        depositsCancelled,
        refundsChecked: refunds.length,
        refundsConfirmed,
        refundsCancelled,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "pawapay status cron error" },
      { status: 500 }
    );
  }
}
