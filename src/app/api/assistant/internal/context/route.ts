import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { AssistantContextService } from "@/lib/services/assistant-context.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    const { searchParams } = new URL(req.url);

    const context = await AssistantContextService.getInternalContext({
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
      route: searchParams.get("route"),
      module: searchParams.get("module"),
      entityType: searchParams.get("entityType"),
      entityId: searchParams.get("entityId"),
      taskId: searchParams.get("taskId"),
      orderId: searchParams.get("orderId"),
      quoteId: searchParams.get("quoteId"),
      paymentId: searchParams.get("paymentId"),
    });

    return NextResponse.json({ data: context });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur contexte interne" },
      { status: 400 }
    );
  }
}
