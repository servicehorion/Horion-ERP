import { prisma } from "@/lib/db";

export class ForecastService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async list(tenantId: string) {
    const model = this.getModel("forecastScenario");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(params: { tenantId: string; name: string; type: "BASE" | "OPTIMISTIC" | "PESSIMISTIC" }) {
    const model = this.getModel("forecastScenario");
    if (!model) {
      throw new Error("Model forecastScenario missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        type: params.type,
      },
    });
  }

  static async addLine(params: {
    scenarioId: string;
    month: string;
    revenue: number;
    cogs: number;
    expenses: number;
    cashIn: number;
    cashOut: number;
  }) {
    const model = this.getModel("forecastLine");
    if (!model) {
      throw new Error("Model forecastLine missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        scenarioId: params.scenarioId,
        month: params.month,
        revenue: params.revenue,
        cogs: params.cogs,
        expenses: params.expenses,
        cashIn: params.cashIn,
        cashOut: params.cashOut,
      },
    });
  }
}
