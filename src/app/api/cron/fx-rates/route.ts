import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { FxService } from "@/lib/services/fx.service";
import { FxRevaluationService } from "@/lib/services/fx-revaluation.service";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rates = await FxService.getLatestRates();
    const tenants = await prisma.tenant.findMany({ select: { id: true } });

    const revaluation = [] as Array<{ tenantId: string; adjustedEntries: number; adjustedAmountXaf: number; skipped: number; totalPositions?: number }>;
    for (const tenant of tenants) {
      const result = await FxRevaluationService.runForTenant({ tenantId: tenant.id });
      revaluation.push({ tenantId: tenant.id, ...result });
    }

    return NextResponse.json({ data: { refreshed: true, rates, revaluation } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron FX error" },
      { status: 500 }
    );
  }
}
