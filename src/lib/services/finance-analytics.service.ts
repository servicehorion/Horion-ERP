import { prisma } from "@/lib/db";
import { FinanceIntelligenceService } from "@/lib/services/finance-intelligence.service";

export class FinanceAnalyticsService {
  private static hasOrderProjectField() {
    try {
      const dmmf = (prisma as any)?._dmmf;
      const orderModel = dmmf?.datamodel?.models?.find((m: any) => m.name === "Order");
      if (!orderModel?.fields) return false;
      const hasProjectId = orderModel.fields.some((f: any) => f.name === "projectId");
      const hasProjectRel = orderModel.fields.some((f: any) => f.name === "project");
      return Boolean(hasProjectId && hasProjectRel);
    } catch {
      return false;
    }
  }
  static async getPnlByClient(tenantId: string) {
    const orders = await prisma.order.findMany({
      where: { tenantId },
      include: { contact: true, marginReport: true },
    });

    const map: Record<string, { client: string; revenue: number; margin: number; count: number }> = {};
    for (const order of orders) {
      if (!order.contact) continue;
      const key = order.contact.id;
      if (!map[key]) {
        map[key] = { client: order.contact.name, revenue: 0, margin: 0, count: 0 };
      }
      map[key].revenue += Number(order.totalClient);
      map[key].margin += Number(order.marginReport?.grossMargin || 0);
      map[key].count += 1;
    }

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }

  static async getPnlByOrder(tenantId: string) {
    const orders = await prisma.order.findMany({
      where: { tenantId },
      include: { marginReport: true, contact: true },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.contact?.name || "-",
      revenue: Number(o.totalClient),
      margin: Number(o.marginReport?.grossMargin || 0),
    }));
  }

  static async getPnlByProject(tenantId: string) {
    if (!this.hasOrderProjectField()) {
      console.warn("PnL par projet indisponible: projectId/project relation non present dans Prisma.");
      return [];
    }

    const orders = await prisma.order.findMany({
      where: { tenantId, projectId: { not: null } },
      include: { project: true, marginReport: true },
    });
    const map: Record<string, { project: string; revenue: number; margin: number; count: number }> = {};
    for (const order of orders) {
      if (!order.project) continue;
      const key = order.project.id;
      if (!map[key]) {
        map[key] = { project: order.project.name, revenue: 0, margin: 0, count: 0 };
      }
      map[key].revenue += Number(order.totalClient);
      map[key].margin += Number(order.marginReport?.grossMargin || 0);
      map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }

  static async getCashflowSeries(tenantId: string, months = 6) {
    return FinanceIntelligenceService.getCashflowAnalysis(tenantId, months);
  }
}
