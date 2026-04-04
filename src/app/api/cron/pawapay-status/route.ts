import { NextResponse } from "next/server";

import { requireSecretHeader } from "@/lib/api/secret-auth";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { AccountingService } from "@/lib/services/accounting.service";
import { PawaPayAdapter } from "@/lib/payment-gateway/pawapay-adapter";
import { PaymentGatewayFactory } from "@/lib/payment-gateway/factory";
import { PaymentService } from "@/lib/services/payment.service";

const PENDING_STATUSES = ["PENDING", "PROCESSING"] as const;

function appendUniqueNote(existing: string | null | undefined, note: string) {
  if (existing?.includes(note)) return existing;
  return [existing, note].filter(Boolean).join(" ");
}

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
        select: { id: true, orderId: true, reference: true, amountXAF: true, notes: true, order: { select: { tenantId: true } } },
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
        select: { id: true, orderId: true, reference: true, notes: true, order: { select: { tenantId: true } } },
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
          await PaymentService.confirm(payment.id, payment.order.tenantId, {
            method: "pawapay_polling",
            providerReference: payment.reference,
            rawPayload: status.raw ? JSON.parse(JSON.stringify(status.raw)) : null,
          });

          await AccountingService.recordPayment({
            paymentId: payment.id,
            tenantId: payment.order.tenantId,
          });

          await prisma.order.updateMany({
            where: { id: payment.orderId, status: "PAIEMENT_EN_COURS" },
            data: { status: "SOURCING" },
          });

          const confirmationNote = `Confirmation pawaPay via polling. Reference: ${payment.reference}.`;
          if (!payment.notes?.includes(confirmationNote)) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                notes: appendUniqueNote(payment.notes, confirmationNote),
              },
            });
          }

          depositsConfirmed += 1;
        } else if (status.status === "FAILED" || status.status === "CANCELLED") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: status.status === "FAILED" ? "FAILED" : "CANCELLED",
              notes: appendUniqueNote(
                payment.notes,
                `Paiement pawaPay ${status.status.toLowerCase()} via polling. Reference: ${payment.reference}.`
              ),
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
          await AccountingService.recordPayment({
            paymentId: payment.id,
            tenantId: payment.order.tenantId,
          });

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "REFUNDED",
              confirmedAt: new Date(),
              paidAt: new Date(),
              notes: appendUniqueNote(
                payment.notes,
                `Remboursement pawaPay confirme via polling. Reference: ${payment.reference}.`
              ),
            },
          });
          refundsConfirmed += 1;
        } else if (status.status === "FAILED" || status.status === "CANCELLED") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: status.status === "FAILED" ? "FAILED" : "CANCELLED",
              notes: appendUniqueNote(
                payment.notes,
                `Remboursement pawaPay ${status.status.toLowerCase()} via polling. Reference: ${payment.reference}.`
              ),
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
