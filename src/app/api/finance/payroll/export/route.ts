import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { PayrollService } from "@/lib/services/payroll.service";

export async function GET(req: Request) {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId manquant" }, { status: 400 });
  }

  const runs = await PayrollService.listRuns(user.tenantId);
  const run = runs.find((r) => r.id === runId);
  if (!run) {
    return NextResponse.json({ error: "Run introuvable" }, { status: 404 });
  }

  const header = ["employee", "gross", "net", "status"];
  const rows = run.lines.map((line) => [
    line.user?.name || line.userId,
    Number(line.gross).toFixed(2),
    Number(line.net).toFixed(2),
    line.status,
  ]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"payroll-${runId}.csv\"`,
    },
  });
}
