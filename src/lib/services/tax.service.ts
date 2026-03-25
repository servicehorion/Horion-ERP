import { prisma } from "@/lib/db";

export class TaxService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async listRates(tenantId: string) {
    const model = this.getModel("taxRate");
    if (!model) return [];
    return model.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  static async createRate(params: {
    tenantId: string;
    name: string;
    rate: number;
    type?: string;
    country?: string | null;
  }) {
    const model = this.getModel("taxRate");
    if (!model) {
      throw new Error("Model taxRate missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        rate: params.rate,
        type: params.type || "VAT",
        country: params.country || undefined,
      },
    });
  }

  static async listReports(tenantId: string) {
    const model = this.getModel("taxReport");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createReport(params: {
    tenantId: string;
    type: string;
    currency: string;
    dueAt?: Date | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }) {
    const model = this.getModel("taxReport");
    if (!model) {
      throw new Error("Model taxReport missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        currency: params.currency,
        dueAt: params.dueAt || undefined,
        periodStart: params.periodStart || undefined,
        periodEnd: params.periodEnd || undefined,
      },
    });
  }

  static async addLine(params: { reportId: string; name: string; base: number; taxAmount: number }) {
    const model = this.getModel("taxLine");
    if (!model) {
      throw new Error("Model taxLine missing. Run `npx prisma generate`.");
    }
    const line = await model.create({
      data: {
        reportId: params.reportId,
        name: params.name,
        base: params.base,
        taxAmount: params.taxAmount,
      },
    });

    const reportModel = this.getModel("taxReport");
    const report = reportModel ? await reportModel.findUnique({ where: { id: params.reportId } }) : null;
    if (report) {
      await reportModel.update({
        where: { id: params.reportId },
        data: { totalTax: { increment: params.taxAmount } },
      });
    }

    return line;
  }

  static async markFiled(reportId: string) {
    const model = this.getModel("taxReport");
    if (!model) {
      throw new Error("Model taxReport missing. Run `npx prisma generate`.");
    }
    return model.update({
      where: { id: reportId },
      data: { status: "FILED", filedAt: new Date() },
    });
  }

  static async exportVatReport(tenantId: string, reportId: string) {
    const model = this.getModel("taxReport");
    if (!model) throw new Error("Model taxReport missing. Run `npx prisma generate`.");
    const report = await model.findUnique({
      where: { id: reportId },
      include: { lines: true },
    });
    if (!report || report.tenantId !== tenantId) throw new Error("Rapport introuvable");

    const header = ["name", "base", "taxAmount"];
    const rows = report.lines.map((l: any) => [l.name, l.base, l.taxAmount].join(","));
    const csv = [header.join(","), ...rows].join("\n");

    return {
      reportId: report.id,
      currency: report.currency,
      totalTax: Number(report.totalTax),
      csv,
    };
  }
}
