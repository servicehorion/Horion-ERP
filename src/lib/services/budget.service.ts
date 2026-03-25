import { prisma } from "@/lib/db";

export class BudgetService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async list(tenantId: string) {
    const model = this.getModel("budgetPlan");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { year: "desc" },
    });
  }

  static async create(params: {
    tenantId: string;
    name: string;
    year: number;
    currency: string;
  }) {
    const model = this.getModel("budgetPlan");
    if (!model) {
      throw new Error("Model budgetPlan missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        year: params.year,
        currency: params.currency,
      },
    });
  }

  static async addLine(params: { budgetId: string; category: string; amount: number; month?: number | null; costCenterId?: string }) {
    const model = this.getModel("budgetLine");
    if (!model) {
      throw new Error("Model budgetLine missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        budgetId: params.budgetId,
        category: params.category,
        amount: params.amount,
        month: params.month ?? undefined,
        costCenterId: params.costCenterId || undefined,
      },
    });
  }

  static async close(budgetId: string) {
    const model = this.getModel("budgetPlan");
    if (!model) {
      throw new Error("Model budgetPlan missing. Run `npx prisma generate`.");
    }
    return model.update({ where: { id: budgetId }, data: { status: "CLOSED" } });
  }
}
