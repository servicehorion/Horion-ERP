import { NextResponse } from "next/server";

import { requireSecretHeader } from "@/lib/api/secret-auth";
import { prisma } from "@/lib/db";
import { RiskCommandService } from "@/lib/services/risk-command.service";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const requestedTenantId = body?.tenantId ? String(body.tenantId) : null;

    const tenantIds = requestedTenantId
      ? [requestedTenantId]
      : (
          await prisma.tenant.findMany({
            select: { id: true },
          })
        ).map((tenant) => tenant.id);

    let created = 0;
    let updated = 0;
    let escalated = 0;
    let resolved = 0;

    for (const tenantId of tenantIds) {
      const result = await RiskCommandService.syncRegistry(tenantId);
      created += result.created;
      updated += result.updated;
      escalated += result.escalated;
      resolved += result.resolved;
    }

    return NextResponse.json({
      data: {
        tenantsChecked: tenantIds.length,
        created,
        updated,
        escalated,
        resolved,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Strategic risk cron error" },
      { status: 500 }
    );
  }
}
