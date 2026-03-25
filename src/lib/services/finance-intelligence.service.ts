import { prisma } from "@/lib/db";

export class FinanceIntelligenceService {
  /**
   * Cash-flow analysis: monthly inbound vs outbound with running balance
   */
  static async getCashflowAnalysis(tenantId: string, months: number = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);

    const payments = await prisma.payment.findMany({
      where: {
        status: "CONFIRMED",
        confirmedAt: { gte: startDate },
        order: { tenantId },
      },
      select: {
        direction: true,
        amountXAF: true,
        confirmedAt: true,
      },
      orderBy: { confirmedAt: "asc" },
    });

    // Build monthly buckets
    const buckets: Record<string, { inbound: number; outbound: number }> = {};
    for (let i = 0; i <= months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (months - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { inbound: 0, outbound: 0 };
    }

    for (const p of payments) {
      if (!p.confirmedAt) continue;
      const key = `${p.confirmedAt.getFullYear()}-${String(p.confirmedAt.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets[key]) buckets[key] = { inbound: 0, outbound: 0 };
      if (p.direction === "INBOUND") {
        buckets[key].inbound += Number(p.amountXAF);
      } else {
        buckets[key].outbound += Number(p.amountXAF);
      }
    }

    let runningBalance = 0;
    const series = Object.entries(buckets).map(([month, data]) => {
      const net = data.inbound - data.outbound;
      runningBalance += net;
      return {
        month,
        inbound: Math.round(data.inbound),
        outbound: Math.round(data.outbound),
        net: Math.round(net),
        balance: Math.round(runningBalance),
      };
    });

    return series;
  }

  /**
   * P&L: full profit and loss breakdown
   */
  static async getProfitAndLoss(tenantId: string) {
    const [margins, payments] = await Promise.all([
      prisma.marginReport.findMany({
        where: { order: { tenantId } },
      }),
      prisma.payment.findMany({
        where: { status: "CONFIRMED", order: { tenantId } },
        include: { order: { select: { tenantId: true } } },
      }),
    ]);

    const totalRevenue = margins.reduce((s, m) => s + Number(m.revenue), 0);
    const totalCogs = margins.reduce((s, m) => s + Number(m.cogs), 0);
    const totalCommission = margins.reduce((s, m) => s + Number(m.commission), 0);
    const grossProfit = totalRevenue - totalCogs;

    // Breakdown by payment type for expense detail
    const expenseByType: Record<string, number> = {};
    for (const p of payments) {
      if (p.direction === "OUTBOUND") {
        const type = p.type;
        expenseByType[type] = (expenseByType[type] || 0) + Number(p.amountXAF);
      }
    }

    // Revenue breakdown
    const revenueInbound = payments
      .filter((p) => p.direction === "INBOUND")
      .reduce((s, p) => s + Number(p.amountXAF), 0);

    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfit = grossProfit - totalCommission;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPercent,
      totalCommission,
      netProfit,
      netMarginPercent,
      revenueInbound,
      expenseByType,
      ordersAnalyzed: margins.length,
    };
  }

  /**
   * Accounts receivable / payable aging
   */
  static async getAgingReport(tenantId: string) {
    const now = new Date();
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { notIn: ["CLOTURE", "ANNULE"] },
      },
      select: {
        id: true,
        orderNumber: true,
        totalClient: true,
        createdAt: true,
        status: true,
        contact: { select: { name: true } },
        payments: {
          where: { status: "CONFIRMED" },
          select: { direction: true, amountXAF: true },
        },
      },
    });

    const aging = {
      current: [] as typeof items,
      days30: [] as typeof items,
      days60: [] as typeof items,
      days90: [] as typeof items,
      over90: [] as typeof items,
    };

    const items = orders.map((o) => {
      const totalClient = Number(o.totalClient);
      const paid = o.payments
        .filter((p) => p.direction === "INBOUND")
        .reduce((s, p) => s + Number(p.amountXAF), 0);
      const outstanding = totalClient - paid;
      const daysOld = Math.floor((now.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        client: o.contact.name,
        totalClient,
        paid,
        outstanding,
        daysOld,
        status: o.status,
      };
    }).filter((i) => i.outstanding > 0);

    for (const item of items) {
      if (item.daysOld <= 0) aging.current.push(item);
      else if (item.daysOld <= 30) aging.days30.push(item);
      else if (item.daysOld <= 60) aging.days60.push(item);
      else if (item.daysOld <= 90) aging.days90.push(item);
      else aging.over90.push(item);
    }

    const totals = {
      current: aging.current.reduce((s, i) => s + i.outstanding, 0),
      days30: aging.days30.reduce((s, i) => s + i.outstanding, 0),
      days60: aging.days60.reduce((s, i) => s + i.outstanding, 0),
      days90: aging.days90.reduce((s, i) => s + i.outstanding, 0),
      over90: aging.over90.reduce((s, i) => s + i.outstanding, 0),
    };

    return { aging, totals, totalOutstanding: Object.values(totals).reduce((s, v) => s + v, 0) };
  }

  /**
   * Financial health KPIs for the Bloomberg dashboard
   */
  static async getFinancialKPIs(tenantId: string) {
    const [monthlyStats, avgMargin, pendingPayments, totalOrders] = await Promise.all([
      // Monthly stats
      (async () => {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const payments = await prisma.payment.findMany({
          where: {
            status: "CONFIRMED",
            confirmedAt: { gte: startOfMonth },
            order: { tenantId },
          },
        });
        const inbound = payments.filter((p) => p.direction === "INBOUND").reduce((s, p) => s + Number(p.amountXAF), 0);
        const outbound = payments.filter((p) => p.direction === "OUTBOUND").reduce((s, p) => s + Number(p.amountXAF), 0);
        return { inbound, outbound, net: inbound - outbound };
      })(),

      // Average margin
      prisma.marginReport.aggregate({
        where: { order: { tenantId } },
        _avg: { marginPercent: true },
        _sum: { grossMargin: true, revenue: true, cogs: true },
        _count: true,
      }),

      // Pending payments
      prisma.payment.count({
        where: { status: "PENDING", order: { tenantId } },
      }),

      // Active orders
      prisma.order.count({
        where: { tenantId, status: { notIn: ["CLOTURE", "ANNULE"] } },
      }),
    ]);

    // Collection rate: paid vs total due
    const totalDue = Number(avgMargin._sum?.revenue || 0);
    const totalCollected = monthlyStats.inbound;
    const collectionRate = totalDue > 0 ? Math.min(100, (totalCollected / totalDue) * 100) : 0;

    // Burn rate: average monthly outbound
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const recentOutbound = await prisma.payment.findMany({
      where: {
        status: "CONFIRMED",
        direction: "OUTBOUND",
        confirmedAt: { gte: threeMonthsAgo },
        order: { tenantId },
      },
    });
    const totalRecentOutbound = recentOutbound.reduce((s, p) => s + Number(p.amountXAF), 0);
    const avgMonthlyBurn = totalRecentOutbound / 3;

    return {
      mtdInbound: monthlyStats.inbound,
      mtdOutbound: monthlyStats.outbound,
      mtdNet: monthlyStats.net,
      avgMarginPercent: Number(avgMargin._avg?.marginPercent || 0),
      totalGrossMargin: Number(avgMargin._sum?.grossMargin || 0),
      totalRevenue: Number(avgMargin._sum?.revenue || 0),
      totalCogs: Number(avgMargin._sum?.cogs || 0),
      ordersAnalyzed: avgMargin._count,
      pendingPayments,
      activeOrders: totalOrders,
      collectionRate,
      avgMonthlyBurn,
    };
  }

  /**
   * Revenue by client (top 10)
   */
  static async getRevenueByClient(tenantId: string) {
    const orders = await prisma.order.findMany({
      where: { tenantId },
      select: {
        contactId: true,
        contact: { select: { name: true } },
        payments: {
          where: { status: "CONFIRMED", direction: "INBOUND" },
          select: { amountXAF: true },
        },
      },
    });

    const byClient: Record<string, { name: string; revenue: number; orders: number }> = {};
    for (const o of orders) {
      const key = o.contactId;
      if (!byClient[key]) byClient[key] = { name: o.contact.name, revenue: 0, orders: 0 };
      byClient[key].revenue += o.payments.reduce((s, p) => s + Number(p.amountXAF), 0);
      byClient[key].orders++;
    }

    return Object.values(byClient)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  /**
   * Payment method distribution
   */
  static async getPaymentMethodStats(tenantId: string) {
    const payments = await prisma.payment.findMany({
      where: { status: "CONFIRMED", order: { tenantId } },
      select: { method: true, amountXAF: true, direction: true },
    });

    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      const method = p.method || "Non specifie";
      if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
      byMethod[method].count++;
      byMethod[method].total += Number(p.amountXAF);
    }

    return Object.entries(byMethod)
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.total - a.total);
  }
}
