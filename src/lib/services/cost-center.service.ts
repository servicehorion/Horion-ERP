import { prisma } from "@/lib/db";

export class CostCenterService {
  static async list(tenantId: string) {
    return prisma.costCenter.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });
  }

  static async create(params: { tenantId: string; code: string; name: string; description?: string }) {
    return prisma.costCenter.create({
      data: {
        tenantId: params.tenantId,
        code: params.code,
        name: params.name,
        description: params.description || undefined,
      },
    });
  }

  static async getBudgetVsActual(params: { tenantId: string; year?: number }) {
    const year = params.year || new Date().getFullYear();

    const [costCenters, budgets, ledgerEntries] = await Promise.all([
      prisma.costCenter.findMany({ where: { tenantId: params.tenantId }, orderBy: { code: "asc" } }),
      prisma.budgetPlan.findMany({
        where: { tenantId: params.tenantId, year },
        include: { lines: true },
      }),
      prisma.ledgerEntry.findMany({
        where: { costCenter: { tenantId: params.tenantId } },
      }),
    ]);

    const budgetByCenter: Record<string, number> = {};
    for (const budget of budgets) {
      for (const line of budget.lines) {
        if (!line.costCenterId) continue;
        budgetByCenter[line.costCenterId] = (budgetByCenter[line.costCenterId] || 0) + Number(line.amount);
      }
    }

    const actualByCenter: Record<string, number> = {};
    for (const entry of ledgerEntries) {
      if (!entry.costCenterId) continue;
      if (entry.type !== "DEBIT") continue;
      actualByCenter[entry.costCenterId] = (actualByCenter[entry.costCenterId] || 0) + Number(entry.amount);
    }

    return costCenters.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      budget: budgetByCenter[c.id] || 0,
      actual: actualByCenter[c.id] || 0,
    }));
  }
}
