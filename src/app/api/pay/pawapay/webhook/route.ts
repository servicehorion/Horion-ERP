import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { AccountingService } from "@/lib/services/accounting.service";
import { PaymentService } from "@/lib/services/payment.service";

const CALLBACK_TOKEN = process.env.PAWAPAY_CALLBACK_TOKEN ?? "";

function isTerminalStatus(status?: string | null) {
  return ["CONFIRMED", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(String(status ?? ""));
}

function verifyOptionalToken(req: NextRequest) {
  if (!CALLBACK_TOKEN) return { ok: true } as const;
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-callback-token") ?? "";
  return token === CALLBACK_TOKEN
    ? ({ ok: true } as const)
    : ({ ok: false, status: 401, error: "Callback token invalide" } as const);
}

function appendUniqueNote(existing: string | null | undefined, note: string) {
  if (existing?.includes(note)) return existing;
  return [existing, note].filter(Boolean).join(" ");
}

export async function POST(req: NextRequest) {
  const tokenCheck = verifyOptionalToken(req);
  if (!tokenCheck.ok) {
    return NextResponse.json({ error: tokenCheck.error }, { status: tokenCheck.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corps callback invalide" }, { status: 400 });
  }

  const gateway = PaymentService.getGateway("AGGREGATOR", "PAWAPAY");
  const parsed = await gateway.handleWebhook(body, req.headers.get("x-signature"));

  if (!parsed.accepted) {
    return NextResponse.json({ ok: false, skipped: true, reason: "payload_rejected" }, { status: 400 });
  }

  if (!parsed.providerReference || !parsed.transactionStatus) {
    return NextResponse.json({ ok: true, skipped: true, reason: "missing_reference_or_status" });
  }

  const isRefund = parsed.operationType === "REFUND";
  const payment = await prisma.payment.findFirst({
    where: {
      reference: parsed.providerReference,
      direction: isRefund ? "OUTBOUND" : "INBOUND",
      ...(isRefund ? { type: "REFUND" } : { type: "CLIENT_DEPOSIT" }),
    },
    select: {
      id: true,
      orderId: true,
      direction: true,
      status: true,
      amountXAF: true,
      notes: true,
      order: {
        select: {
          tenantId: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ ok: true, skipped: true, reason: "payment_not_found" });
  }

  const isDepositConfirmation = !isRefund && parsed.transactionStatus === "CONFIRMED";
  const isRefundConfirmation = isRefund && parsed.transactionStatus === "CONFIRMED";

  if (
    !isDepositConfirmation &&
    !isRefundConfirmation &&
    isTerminalStatus(payment.status) &&
    parsed.transactionStatus !== "PROCESSING" &&
    parsed.transactionStatus !== "PENDING"
  ) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_terminal", paymentId: payment.id });
  }

  if (isRefund) {
    if (parsed.transactionStatus === "CONFIRMED") {
      await AccountingService.recordPayment({
        paymentId: payment.id,
        tenantId: payment.order.tenantId,
      });

      const refundNote = `Remboursement pawaPay confirme. Reference: ${parsed.providerReference}.`;
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "REFUNDED",
          confirmedAt: new Date(),
          paidAt: new Date(),
          notes: appendUniqueNote(payment.notes, refundNote),
        },
      });
      return NextResponse.json({ ok: true, processed: payment.id, operation: "refund" });
    }

    const nextStatus =
      parsed.transactionStatus === "FAILED"
        ? "FAILED"
        : parsed.transactionStatus === "CANCELLED"
          ? "CANCELLED"
          : parsed.transactionStatus === "PROCESSING"
            ? "PROCESSING"
            : "PENDING";
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        notes: appendUniqueNote(
          payment.notes,
          `Callback remboursement pawaPay (${parsed.transactionStatus}). Reference: ${parsed.providerReference}.`
        ),
      },
    });

    return NextResponse.json({ ok: true, processed: payment.id, operation: "refund" });
  }

  if (parsed.transactionStatus === "CONFIRMED") {
    await PaymentService.confirm(payment.id, payment.order.tenantId, {
      method: "pawapay_webhook",
      providerReference: parsed.providerReference,
      rawPayload: parsed.raw ? JSON.parse(JSON.stringify(parsed.raw)) : null,
    });

    await AccountingService.recordPayment({
      paymentId: payment.id,
      tenantId: payment.order.tenantId,
    });

    await prisma.order.updateMany({
      where: { id: payment.orderId, status: "PAIEMENT_EN_COURS" },
      data: { status: "SOURCING" },
    });

    const confirmationNote = `Paiement pawaPay confirme. Reference: ${parsed.providerReference}.`;
    if (!payment.notes?.includes(confirmationNote)) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          notes: appendUniqueNote(payment.notes, confirmationNote),
        },
      });
    }

    return NextResponse.json({ ok: true, processed: payment.id, operation: "deposit" });
  }

  if (parsed.transactionStatus === "FAILED" || parsed.transactionStatus === "CANCELLED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: parsed.transactionStatus === "FAILED" ? "FAILED" : "CANCELLED",
        notes: appendUniqueNote(
          payment.notes,
          `Paiement pawaPay ${parsed.transactionStatus.toLowerCase()}. Reference: ${parsed.providerReference}.`
        ),
      },
    });

    await emitEvent("payment.cancelled", "payment", payment.id, {
      orderId: payment.orderId,
      reason: parsed.transactionStatus,
      providerReference: parsed.providerReference,
      rawPayload: parsed.raw ? JSON.parse(JSON.stringify(parsed.raw)) : null,
    });

    return NextResponse.json({ ok: true, processed: payment.id, operation: "deposit" });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: parsed.transactionStatus === "PROCESSING" ? "PROCESSING" : "PENDING",
      notes: appendUniqueNote(
        payment.notes,
        `Callback pawaPay recu (${parsed.transactionStatus}). Reference: ${parsed.providerReference}.`
      ),
    },
  });

  return NextResponse.json({ ok: true, processed: payment.id, operation: "deposit" });
}
