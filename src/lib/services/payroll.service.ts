import { prisma } from "@/lib/db";

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
    deductions?: number;
  }) {
    const gross = params.baseSalary + (params.allowances || 0);
    const net = gross - (params.deductions || 0);
    const line = await prisma.payrollLine.create({
      data: {
        runId: params.runId,
        userId: params.userId,
        baseSalary: params.baseSalary,
        allowances: params.allowances || 0,
        deductions: params.deductions || 0,
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
