import { prisma } from "@/lib/db";

export class ConsolidationService {
  static async listEntities(tenantId: string) {
    return prisma.legalEntity.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  static async createEntity(params: { tenantId: string; name: string; country?: string | null; baseCurrency: string; taxId?: string | null }) {
    return prisma.legalEntity.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        country: params.country || undefined,
        baseCurrency: params.baseCurrency,
        taxId: params.taxId || undefined,
      },
    });
  }

  static async listRuns(tenantId: string) {
    return prisma.consolidationRun.findMany({
      where: { tenantId },
      include: { lines: { include: { entity: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createRun(params: { tenantId: string; periodId?: string | null; baseCurrency: string; notes?: string | null }) {
    return prisma.consolidationRun.create({
      data: {
        tenantId: params.tenantId,
        periodId: params.periodId || undefined,
        baseCurrency: params.baseCurrency,
        notes: params.notes || undefined,
      },
    });
  }

  static async addLine(params: { runId: string; entityId: string; metric: string; amount: number; currency: string }) {
    return prisma.consolidationLine.create({
      data: {
        runId: params.runId,
        entityId: params.entityId,
        metric: params.metric,
        amount: params.amount,
        currency: params.currency,
      },
    });
  }
}
