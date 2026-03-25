import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { StrategicDecisionService } from "@/lib/services/strategic-decision.service";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;
    const tenantIds = tenantId
      ? [tenantId]
      : (
          await prisma.strategicDecision.findMany({
            where: { status: { in: ["DRAFT", "ACTIVE"] } },
            distinct: ["tenantId"],
            select: { tenantId: true },
          })
        ).map((item) => item.tenantId);

    let activated = 0;

    for (const currentTenantId of tenantIds) {
      const result = await StrategicDecisionService.evaluateRulesForTenant(currentTenantId);
      activated += result.activated;
    }

    return NextResponse.json({
      data: {
        tenantsChecked: tenantIds.length,
        activated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Strategic decision cron error" },
      { status: 500 }
    );
  }
}
