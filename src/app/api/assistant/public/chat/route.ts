import { NextRequest, NextResponse } from "next/server";

import { ZeliaPayService } from "@/lib/services/zelia-pay.service";
import { aiRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit: public endpoint — 20 AI calls/min per IP
  const rl = await aiRateLimit(req);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    const token = String(body.token || "").trim();
    const page = body.page ? String(body.page) : "pay";

    if (!token) {
      return NextResponse.json({ error: "token requis" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "message requis" }, { status: 400 });
    }

    const result = await ZeliaPayService.chat({
      token,
      page: page as "quote" | "pay" | "submitted" | "success",
      sessionId: body.sessionId ? String(body.sessionId) : null,
      message,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur chat public" },
      { status: 400 }
    );
  }
}
