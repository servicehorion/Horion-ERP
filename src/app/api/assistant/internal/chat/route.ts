import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { ZeliaInternalService } from "@/lib/services/zelia-internal.service";
import { aiRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit per IP: 20 AI calls/min — protects Anthropic API costs
  const rl = await aiRateLimit(req);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  try {
    const user = await getSession();
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json({ error: "message requis" }, { status: 400 });
    }

    const result = await ZeliaInternalService.chat({
      sessionId: body.sessionId ? String(body.sessionId) : null,
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
      route: body.route ? String(body.route) : null,
      module: body.module ? String(body.module) : null,
      entityType: body.entityType ? String(body.entityType) : null,
      entityId: body.entityId ? String(body.entityId) : null,
      taskId: body.taskId ? String(body.taskId) : null,
      orderId: body.orderId ? String(body.orderId) : null,
      quoteId: body.quoteId ? String(body.quoteId) : null,
      paymentId: body.paymentId ? String(body.paymentId) : null,
      message,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur chat interne" },
      { status: 400 }
    );
  }
}
