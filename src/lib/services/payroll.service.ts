import { prisma } from "@/lib/db";

/**
 * Congo (République du Congo) payroll tax rules — 2024
 *
 * CNSS salarié  : 4.725 % du salaire brut, plafonné à 1 500 000 XAF/mois
 * IRPP          : barème progressif sur le salaire imposable (brut – CNSS)
 *   Tranche 1 :     0 – 464 000 XAF/an  → 0 %
 *   Tranche 2 : 464 001 – 1 000 000      → 1 %
 *   Tranche 3 : 1 000 001 – 3 000 000    → 10 %
 *   Tranche 4 : 3 000 001 – 8 000 000    → 25 %
 *   Tranche 5 :   > 8 000 000            → 40 %
 */

const CNSS_RATE = 0.04725;
const CNSS_SALARY_CEILING_MONTHLY = 1_500_000; // XAF/month

function computeCnss(grossMonthly: number): number {
  const taxable = Math.min(grossMonthly, CNSS_SALARY_CEILING_MONTHLY);
  return Math.round(taxable * CNSS_RATE);
}

function computeIrpp(grossMonthly: number, cnssMonthly: number): number {
  const imposableMonthly = Math.max(0, grossMonthly - cnssMonthly);
  const imposableAnnual = imposableMonthly * 12;

  let irppAnnual = 0;
  if (imposableAnnual <= 464_000) {
    irppAnnual = 0;
  } else if (imposableAnnual <= 1_000_000) {
    irppAnnual = (imposableAnnual - 464_000) * 0.01;
  } else if (imposableAnnual <= 3_000_000) {
    irppAnnual = (1_000_000 - 464_000) * 0.01 + (imposableAnnual - 1_000_000) * 0.10;
  } else if (imposableAnnual <= 8_000_000) {
    irppAnnual = (1_000_000 - 464_000) * 0.01 + (3_000_000 - 1_000_000) * 0.10 + (imposableAnnual - 3_000_000) * 0.25;
  } else {
    irppAnnual = (1_000_000 - 464_000) * 0.01 + (3_000_000 - 1_000_000) * 0.10 + (8_000_000 - 3_000_000) * 0.25 + (imposableAnnual - 8_000_000) * 0.40;
  }

  return Math.round(irppAnnual / 12);
}

export function computeCongoPayrollDeductions(grossMonthly: number): {
  cnss: number;
  irpp: number;
  totalDeductions: number;
  netSalary: number;
} {
  const cnss = computeCnss(grossMonthly);
  const irpp = computeIrpp(grossMonthly, cnss);
  const totalDeductions = cnss + irpp;
  return { cnss, irpp, totalDeductions, netSalary: grossMonthly - totalDeductions };
}

export class PayrollService {
  static async listProfiles(tenantId: string) {
    return prisma.payrollProfile.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  }

  static async upsertProfile(params: { tenantId: string; userId: string; baseSalary: number; currency: string; bankAccount?: string }) {
    return prisma.payrollProfile.upsert({
      where: { tenantId_userId: { tenantId: params.tenantId, userId: params.userId } },
      update: {
        baseSalary: params.baseSalary,
        currency: params.currency,
        bankAccount: params.bankAccount || undefined,
      },
      create: {
        tenantId: params.tenantId,
        userId: params.userId,
        baseSalary: params.baseSalary,
        currency: params.currency,
        bankAccount: params.bankAccount || undefined,
      },
    });
  }

  static async listRuns(tenantId: string) {
    return prisma.payrollRun.findMany({
      where: { tenantId },
      include: { lines: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createRun(params: { tenantId: string; periodStart: Date; periodEnd: Date; createdById?: string }) {
    return prisma.payrollRun.create({
      data: {
        tenantId: params.tenantId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        createdById: params.createdById || undefined,
      },
    });
  }

  static async addLine(params: {
    runId: string;
    userId: string;
    baseSalary: number;
    allowances?: number;
    /** If omitted, CNSS + IRPP are auto-computed using Congo fiscal rules */
    deductions?: number;
  }) {
    const gross = params.baseSalary + (params.allowances || 0);
    let deductions = params.deductions;
    if (deductions === undefined) {
      const computed = computeCongoPayrollDeductions(gross);
      deductions = computed.totalDeductions;
    }
    const net = gross - deductions;
    const line = await prisma.payrollLine.create({
      data: {
        runId: params.runId,
        userId: params.userId,
        baseSalary: params.baseSalary,
        allowances: params.allowances || 0,
        deductions,
        gross,
        net,
      },
    });

    await this.recomputeRunTotals(line.runId);
    return line;
  }

  static async recomputeRunTotals(runId: string) {
    const lines = await prisma.payrollLine.findMany({ where: { runId } });
    const totalGross = lines.reduce((sum, l) => sum + Number(l.gross), 0);
    const totalNet = lines.reduce((sum, l) => sum + Number(l.net), 0);
    await prisma.payrollRun.update({ where: { id: runId }, data: { totalGross, totalNet } });
  }

  static async markRunPaid(runId: string) {
    await prisma.payrollRun.update({ where: { id: runId }, data: { status: "PAID" } });
    await prisma.payrollLine.updateMany({ where: { runId }, data: { status: "PAID", paidAt: new Date() } });
  }
}
