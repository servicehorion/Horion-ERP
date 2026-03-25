import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

function requireEmailSecret(req: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "EMAIL_WEBHOOK_SECRET non configure" };
  }
  const received = req.headers.get("x-horion-secret");
  if (!received) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true } as const;
}

export async function POST(req: Request) {
  try {
    const auth = requireEmailSecret(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await req.json().catch(() => ({}));
    const eventType = String(payload?.type || "");
    const data = payload?.data || {};
    const providerId = data?.id || data?.email_id || data?.emailId;

    if (!providerId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const update: any = {};
    if (eventType.includes("opened")) {
      update.status = "OPENED";
      update.openedAt = new Date();
    } else if (eventType.includes("clicked")) {
      update.status = "CLICKED";
      update.clickedAt = new Date();
    } else if (eventType.includes("sent")) {
      update.status = "SENT";
      update.sentAt = new Date();
    }

    if (Object.keys(update).length > 0) {
      await prisma.emailLog.updateMany({
        where: { providerId },
        data: update,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook error" },
      { status: 500 }
    );
  }
}
