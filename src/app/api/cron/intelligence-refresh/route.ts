import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { CustomerIntelligenceService } from "@/lib/services/customer-intelligence.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;

    const contacts = await prisma.contact.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [{ orders: { some: {} } }, { leads: { some: {} } }],
      },
      select: { id: true },
      take: 500,
    });

    let processed = 0;
    for (const contact of contacts) {
      await CustomerIntelligenceService.recalculateAll(contact.id);
      processed += 1;
    }

    return NextResponse.json({ data: { processed } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron intelligence error" },
      { status: 500 }
    );
  }
}
