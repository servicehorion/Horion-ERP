import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { WhatsappWebhookService } from "@/lib/services/whatsapp-webhook.service";

function getWhatsappSecret() {
  return process.env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_WEBHOOK_SECRET || null;
}

export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "WHATSAPP_VERIFY_TOKEN non configure" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false;
  const [algo, sig] = signatureHeader.split("=");
  if (algo !== "sha256" || !sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: NextRequest) {
  try {
    const secret = getWhatsappSecret();
    if (!secret) {
      return NextResponse.json({ ok: false, error: "WHATSAPP_WEBHOOK_SECRET non configure" }, { status: 503 });
    }

    const rawBody = await req.text();
    const valid = verifySignature(rawBody, req.headers.get("x-hub-signature-256"), secret);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 403 });
    }

    const payload = JSON.parse(rawBody);
    const result = await WhatsappWebhookService.ingest(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
