import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { AssistantAuditService } from "@/lib/services/assistant-audit.service";

export async function POST(req: NextRequest) {
  try {
    await getSession();
    const body = await req.json().catch(() => ({}));

    await AssistantAuditService.addFeedback({
      sessionId: body.sessionId ? String(body.sessionId) : null,
      messageId: body.messageId ? String(body.messageId) : null,
      rating: body.rating != null ? Number(body.rating) : null,
      comment: body.comment ? String(body.comment) : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur feedback interne" },
      { status: 400 }
    );
  }
}
