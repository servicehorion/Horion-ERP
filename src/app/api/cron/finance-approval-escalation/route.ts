import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { FinanceApprovalService } from "@/lib/services/finance-approval.service";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    const results = [] as Array<{ tenantId: string; escalated: number; scanned: number }>;

    for (const tenant of tenants) {
      const result = await FinanceApprovalService.escalateOverdue({ tenantId: tenant.id });
      results.push({ tenantId: tenant.id, ...result });
    }

    return NextResponse.json({ data: { tenants: tenants.length, results } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron finance approval escalation error" },
      { status: 500 }
    );
  }
}
