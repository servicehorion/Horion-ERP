import { NextRequest, NextResponse } from "next/server";

import { AssistantContextService } from "@/lib/services/assistant-context.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = String(searchParams.get("token") || "").trim();
    const page = (searchParams.get("page") || "pay") as "quote" | "pay" | "submitted" | "success";

    if (!token) {
      return NextResponse.json({ error: "token requis" }, { status: 400 });
    }

    const context = await AssistantContextService.getPublicContext({ token, page });
    if (!context) {
      return NextResponse.json({ error: "Contexte public introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: context });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur contexte public" },
      { status: 400 }
    );
  }
}
