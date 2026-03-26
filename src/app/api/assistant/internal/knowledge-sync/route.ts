import { NextResponse } from "next/server";

import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { AssistantAuditService } from "@/lib/services/assistant-audit.service";
import { KnowledgeDriveSyncService } from "@/lib/services/knowledge-drive-sync.service";

export async function POST() {
  try {
    const user = await getSession();
    checkPermission(user.role, "user.manage");

    const result = await KnowledgeDriveSyncService.syncTenantInternalKnowledge(user.tenantId);

    await AssistantAuditService.log({
      tenantId: user.tenantId,
      assistantType: "INTERNAL",
      action: "knowledge.sync.manual",
      input: { triggeredByUserId: user.id },
      output: result as Record<string, unknown>,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync knowledge" },
      { status: 400 }
    );
  }
}
