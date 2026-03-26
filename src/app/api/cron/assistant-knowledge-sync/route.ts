import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { AssistantAuditService } from "@/lib/services/assistant-audit.service";
import { KnowledgeDriveSyncService } from "@/lib/services/knowledge-drive-sync.service";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    const results: Array<Record<string, unknown>> = [];
    for (const tenant of tenants) {
      const result = await KnowledgeDriveSyncService.syncTenantInternalKnowledge(tenant.id).catch((error) => ({
        synced: 0,
        chunks: 0,
        skipped: false,
        reason: error instanceof Error ? error.message : "sync_error",
      }));

      results.push({ tenantId: tenant.id, ...result });

      await AssistantAuditService.log({
        tenantId: tenant.id,
        assistantType: "INTERNAL",
        action: "knowledge.sync.cron",
        output: result as Record<string, unknown>,
        status: typeof result.reason === "string" && result.reason.includes("error") ? "ERROR" : "SUCCESS",
        errorMessage: typeof result.reason === "string" && result.reason.includes("error") ? result.reason : null,
      });
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur cron knowledge sync" },
      { status: 500 }
    );
  }
}
