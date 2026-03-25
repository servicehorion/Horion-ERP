import { NextResponse } from "next/server";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { LeadMiningService } from "@/lib/services/lead-mining.service";

export async function POST(req: Request) {
  const auth = requireSecretHeader(req, "CRM_LEAD_MINING_SECRET");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const jobId = String(body.jobId || "");
  const results = Array.isArray(body.results) ? body.results : [];

  if (!jobId) {
    return NextResponse.json({ error: "missing_jobId" }, { status: 400 });
  }

  const outcome = await LeadMiningService.ingestResults(jobId, results);
  return NextResponse.json({ data: outcome });
}
