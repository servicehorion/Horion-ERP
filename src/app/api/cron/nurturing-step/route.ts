import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { NurturingService } from "@/lib/services/nurturing.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;
    const now = new Date();

    const enrollments = await prisma.nurturingEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextStepAt: { lte: now },
        ...(tenantId ? { lead: { contact: { tenantId } } } : {}),
      },
      include: {
        sequence: { include: { steps: { orderBy: { order: "asc" } } } },
        lead: { include: { contact: true } },
      },
      take: 200,
    });

    let advanced = 0;
    for (const enrollment of enrollments) {
      const result = await NurturingService.advanceEnrollmentRecord(enrollment as any, null);
      if (!result.error) advanced += 1;
    }

    return NextResponse.json({ data: { processed: enrollments.length, advanced } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron nurturing error" },
      { status: 500 }
    );
  }
}
