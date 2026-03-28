import { NextResponse } from "next/server";

import { TaskTemplateService } from "@/lib/services/task-template.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const results = await TaskTemplateService.processDueRecurring();
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ data: { processed: results.length, succeeded, failed, results } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron recurring-tasks error" },
      { status: 500 }
    );
  }
}
