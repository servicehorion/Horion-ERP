import { prisma } from "@/lib/db";

export class MarketService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async listMarketData(tenantId: string) {
    const model = this.getModel("marketData");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  static async upsertMarketData(params: {
    tenantId: string;
    symbol: string;
    name?: string | null;
    type?: string | null;
    lastPrice: number;
    changePct?: number | null;
  }) {
    const model = this.getModel("marketData");
    if (!model) {
      throw new Error("Model marketData missing. Run `npx prisma generate`.");
    }
    const existing = await model.findFirst({
      where: { tenantId: params.tenantId, symbol: params.symbol },
    });
    if (existing) {
      return model.update({
        where: { id: existing.id },
        data: {
          name: params.name || existing.name,
          type: params.type || existing.type,
          lastPrice: params.lastPrice,
          changePct: params.changePct ?? undefined,
          updatedAt: new Date(),
        },
      });
    }

    return model.create({
      data: {
        tenantId: params.tenantId,
        symbol: params.symbol,
        name: params.name || undefined,
        type: params.type || undefined,
        lastPrice: params.lastPrice,
        changePct: params.changePct ?? undefined,
      },
    });
  }

  static async listExposures(tenantId: string) {
    const model = this.getModel("exposure");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createExposure(params: {
    tenantId: string;
    type: "FX" | "CUSTOMER" | "SUPPLIER";
    currency?: string | null;
    amount: number;
    counterparty?: string | null;
    dueAt?: Date | null;
  }) {
    const model = this.getModel("exposure");
    if (!model) {
      throw new Error("Model exposure missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        currency: params.currency || undefined,
        amount: params.amount,
        counterparty: params.counterparty || undefined,
        dueAt: params.dueAt || undefined,
      },
    });
  }

  static async listRiskMetrics(tenantId: string) {
    const model = this.getModel("riskMetric");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createRiskMetric(params: {
    tenantId: string;
    type: "FX" | "CREDIT" | "LIQUIDITY" | "MARKET";
    value: number;
    status?: string | null;
  }) {
    const model = this.getModel("riskMetric");
    if (!model) {
      throw new Error("Model riskMetric missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        value: params.value,
        status: params.status || "OK",
      },
    });
  }
}
