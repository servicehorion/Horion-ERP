import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { SourcingSlaAlertService } from "@/lib/services/sourcing-sla-alert.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "SOURCING_SLA_WEBHOOK_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;

    const cases = await prisma.sourcingCase.findMany({
      where: tenantId ? { order: { tenantId } } : undefined,
      select: {
        id: true,
        status: true,
        stageEnteredAt: true,
        createdAt: true,
        updatedAt: true,
        assignedToId: true,
        order: { select: { tenantId: true } },
      },
    });

    const byTenant = new Map<string, typeof cases>();
    for (const sc of cases) {
      const key = sc.order.tenantId;
      const list = byTenant.get(key);
      if (list) {
        list.push(sc);
      } else {
        byTenant.set(key, [sc]);
      }
    }

    for (const [tid, items] of byTenant.entries()) {
      await SourcingSlaAlertService.notifyForCases({
        tenantId: tid,
        cases: items.map((sc) => ({
          id: sc.id,
          status: sc.status,
          stageEnteredAt: sc.stageEnteredAt,
          createdAt: sc.createdAt,
          updatedAt: sc.updatedAt,
          assignedToId: sc.assignedToId ?? null,
        })),
      });
    }

    return NextResponse.json({ data: { checked: cases.length, tenants: byTenant.size } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur SLA sourcing" },
      { status: 500 }
    );
  }
}
