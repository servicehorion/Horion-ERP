import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { PaymentService } from "@/lib/services/payment.service";

/**
 * Webhook agregateur (Hub2, DPO, CinetPay...).
 *
 * POST /api/pay/webhook
 * Header: x-webhook-secret: <PAYMENT_WEBHOOK_SECRET>
 */

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "";

function verifySecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) return true;
  const header = req.headers.get("x-webhook-secret") ?? req.headers.get("x-api-key") ?? "";
  return header === WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const providerName =
    String((body as Record<string, unknown>).provider ?? "").trim() ||
    req.headers.get("x-payment-provider") ||
    req.headers.get("x-provider");
  const gateway = PaymentService.getGateway("AGGREGATOR", providerName);
  const parsed = await gateway.handleWebhook(
    body,
    req.headers.get("x-signature") ?? req.headers.get("x-webhook-secret")
  );

  if (!parsed.providerReference || !parsed.transactionStatus) {
    return NextResponse.json(
      { error: "Webhook incomplet: reference ou statut manquant" },
      { status: 400 }
    );
  }

  const payment = await prisma.payment.findFirst({
    where: {
      reference: parsed.providerReference,
      direction: "INBOUND",
      status: { notIn: ["CONFIRMED", "CANCELLED", "FAILED", "EXPIRED"] },
    },
    select: { id: true, orderId: true, amountXAF: true },
  });

  if (!payment) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: { tenantId: true, orderNumber: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  if (parsed.transactionStatus === "CONFIRMED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        paidAt: new Date(),
        notes: `Confirme automatiquement via webhook agregateur. Reference: ${parsed.providerReference}.`,
      },
    });

    await prisma.order.updateMany({
      where: { id: payment.orderId, status: "PAIEMENT_EN_COURS" },
      data: { status: "SOURCING" },
    });

    await emitEvent("payment.confirmed", "payment", payment.id, {
      orderId: payment.orderId,
      amountXAF: Number(payment.amountXAF),
      method: "aggregator_webhook",
      providerReference: parsed.providerReference,
      rawPayload: parsed.raw ? JSON.parse(JSON.stringify(parsed.raw)) : null,
    });
  } else if (["FAILED", "CANCELLED"].includes(parsed.transactionStatus)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: parsed.transactionStatus === "FAILED" ? "FAILED" : "CANCELLED",
        notes: `Echec via webhook agregateur (${parsed.transactionStatus}). Reference: ${parsed.providerReference}.`,
      },
    });

    await emitEvent("payment.cancelled", "payment", payment.id, {
      orderId: payment.orderId,
      reason: parsed.transactionStatus,
      providerReference: parsed.providerReference,
    });
  } else if (["PENDING", "PROCESSING"].includes(parsed.transactionStatus)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: parsed.transactionStatus === "PROCESSING" ? "PROCESSING" : "PENDING",
        notes: `Webhook agregateur recu (${parsed.transactionStatus}). Reference: ${parsed.providerReference}.`,
      },
    });
  } else {
    console.warn(
      `[webhook] Statut inconnu recu pour ${parsed.providerReference}: ${parsed.transactionStatus}`
    );
  }

  return NextResponse.json({ ok: true, processed: payment.id });
}
