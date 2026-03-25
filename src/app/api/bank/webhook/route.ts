import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

import { BankService } from "@/lib/services/bank.service";
import { prisma } from "@/lib/db";

function isTimestampFresh(value: string, toleranceMs = 5 * 60 * 1000) {
  const ts = Number(value);
  if (!Number.isFinite(ts)) return false;
  const now = Date.now();
  return Math.abs(now - ts) <= toleranceMs;
}

function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const connectionId = payload.connectionId as string | undefined;
    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];

    if (!connectionId || transactions.length === 0) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const connection = await prisma.bankConnection.findUnique({
      where: { id: connectionId },
      select: { webhookSecret: true },
    });

    const secret = connection?.webhookSecret || process.env.BANK_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "BANK_WEBHOOK_SECRET non configure" }, { status: 503 });
    }

    const timestamp = req.headers.get("x-horion-timestamp");
    const signature = req.headers.get("x-horion-signature");
    if (!timestamp || !signature || !isTimestampFresh(timestamp)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifySignature(rawBody, timestamp, signature, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idempotencyKey =
      req.headers.get("x-horion-idempotency-key") ||
      (payload.eventId as string | undefined) ||
      (payload.id as string | undefined) ||
      undefined;

    if (idempotencyKey) {
      const already = await prisma.bankTransaction.findFirst({
        where: {
          connectionId,
          metadata: { path: ["idempotencyKey"], equals: idempotencyKey },
        },
        select: { id: true },
      });
      if (already) {
        return NextResponse.json({ data: { created: 0, skipped: true } });
      }
    }

    const created = [];
    for (const tx of transactions) {
      const occurredAt = new Date(tx.occurredAt || tx.date || Date.now());
      const amount = Number(tx.amount || 0);
      const reference = tx.reference || tx.id || null;
      const externalId = tx.id || tx.externalId || tx.reference || null;

      if (externalId) {
        const exists = await prisma.bankTransaction.findFirst({
          where: {
            connectionId,
            metadata: { path: ["externalId"], equals: String(externalId) },
          },
          select: { id: true },
        });
        if (exists) continue;
      } else if (reference) {
        const exists = await prisma.bankTransaction.findFirst({
          where: {
            connectionId,
            reference: String(reference),
            occurredAt,
            amount,
            direction: tx.direction || "IN",
          },
          select: { id: true },
        });
        if (exists) continue;
      }

      const item = await BankService.addTransaction({
        connectionId,
        occurredAt,
        amount,
        currency: tx.currency || "XAF",
        direction: tx.direction || "IN",
        description: tx.description || null,
        reference: reference ? String(reference) : null,
        counterparty: tx.counterparty || null,
        category: tx.category || null,
        metadata: {
          ...tx,
          externalId: externalId ? String(externalId) : null,
          idempotencyKey: idempotencyKey || null,
          eventId: payload.eventId || payload.id || null,
        },
      });
      created.push(item.id);
    }

    return NextResponse.json({ data: { created: created.length } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur webhook banque" },
      { status: 500 }
    );
  }
}
