import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { LeadScoringService } from "@/lib/services/lead-scoring.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;

    const leads = await prisma.lead.findMany({
      where: {
        ...(tenantId ? { contact: { tenantId } } : {}),
        status: { notIn: ["WON", "LOST"] },
      },
      select: {
        id: true,
        estimatedValue: true,
        status: true,
        description: true,
        category: true,
        source: true,
        assignedTo: true,
        createdAt: true,
      },
      take: 500,
    });

    for (const lead of leads) {
      await LeadScoringService.recalculate(lead.id);
    }

    return NextResponse.json({ data: { processed: leads.length } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron lead scoring error" },
      { status: 500 }
    );
  }
}
