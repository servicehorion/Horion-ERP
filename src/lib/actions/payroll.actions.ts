"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { PayrollService } from "@/lib/services/payroll.service";
import { AuditService } from "@/lib/services/audit.service";

const toNumber = (value: FormDataEntryValue | null, field: string) => {
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Champ invalide: ${field}`);
  return n;
};

const toDate = (value: FormDataEntryValue | null) => {
  if (!value) return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

export async function upsertPayrollProfile(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const userId = String(formData.get("userId") || "");
    const baseSalary = toNumber(formData.get("baseSalary"), "Salaire");
    const currency = String(formData.get("currency") || "XAF");
    const bankAccount = String(formData.get("bankAccount") || "") || undefined;

    if (!userId) throw new Error("Employe manquant");

    const profile = await PayrollService.upsertProfile({
      tenantId: user.tenantId,
      userId,
      baseSalary,
      currency,
      bankAccount,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payroll.profile.upserted",
      entityType: "payroll_profile",
      entityId: profile.id,
      newValue: { userId, baseSalary, currency },
    });

    revalidatePath("/finance/payroll");
    return { data: profile };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createPayrollRun(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const periodStart = toDate(formData.get("periodStart"));
    const periodEnd = toDate(formData.get("periodEnd"));
    if (!periodStart || !periodEnd) throw new Error("Periode invalide");

    const run = await PayrollService.createRun({
      tenantId: user.tenantId,
      periodStart,
      periodEnd,
      createdById: user.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payroll.run.created",
      entityType: "payroll_run",
      entityId: run.id,
      newValue: { periodStart, periodEnd },
    });

    revalidatePath("/finance/payroll");
    return { data: run };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addPayrollLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const runId = String(formData.get("runId") || "");
    const userId = String(formData.get("userId") || "");
    const baseSalary = toNumber(formData.get("baseSalary"), "Salaire");
    const allowances = Number(formData.get("allowances") || 0);
    const deductions = Number(formData.get("deductions") || 0);

    if (!runId || !userId) throw new Error("Champs manquants");

    const line = await PayrollService.addLine({
      runId,
      userId,
      baseSalary,
      allowances,
      deductions,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payroll.line.added",
      entityType: "payroll_line",
      entityId: line.id,
      newValue: { runId, userId, baseSalary, allowances, deductions },
    });

    revalidatePath("/finance/payroll");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function markPayrollRunPaid(runId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    await PayrollService.markRunPaid(runId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payroll.run.paid",
      entityType: "payroll_run",
      entityId: runId,
    });

    revalidatePath("/finance/payroll");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function exportPayrollRunCsv(runId: string) {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const runs = await PayrollService.listRuns(user.tenantId);
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new Error("Run introuvable");

  const header = ["employee", "gross", "net", "status"];
  const lines = run.lines.map((line) => [
    line.user?.name || line.userId,
    Number(line.gross).toFixed(2),
    Number(line.net).toFixed(2),
    line.status,
  ]);
  const csv = [header, ...lines].map((row) => row.join(",")).join("\n");
  return csv;
}
