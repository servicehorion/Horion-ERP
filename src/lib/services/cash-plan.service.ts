import { prisma } from "@/lib/db";

export class CashPlanService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async list(tenantId: string) {
    const model = this.getModel("cashPlan");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(params: { tenantId: string; name: string; startAt: Date; endAt: Date; currency: string }) {
    const model = this.getModel("cashPlan");
    if (!model) {
      throw new Error("Model cashPlan missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        startAt: params.startAt,
        endAt: params.endAt,
        currency: params.currency,
      },
    });
  }

  static async addLine(params: {
    planId: string;
    date: Date;
    direction: string;
    amount: number;
    description?: string | null;
  }) {
    const model = this.getModel("cashPlanLine");
    if (!model) {
      throw new Error("Model cashPlanLine missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        planId: params.planId,
        date: params.date,
        direction: params.direction,
        amount: params.amount,
        description: params.description || undefined,
      },
    });
  }
}
