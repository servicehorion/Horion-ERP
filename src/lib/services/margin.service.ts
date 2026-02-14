import { prisma } from "@/lib/db";

export class MarginService {
  static async calculateForOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { where: { status: "CONFIRMED" } },
      },
    });

    if (!order) throw new Error("Commande introuvable");

    const revenue = Number(order.totalClient);
    const cogs = order.payments
      .filter((p) => p.direction === "OUTBOUND")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);
    const commission = Number(order.commissionAmount);
    const grossMargin = revenue - cogs;
    const marginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;

    const report = await prisma.marginReport.upsert({
      where: { orderId },
      update: {
        revenue,
        cogs,
        commission,
        grossMargin,
        marginPercent,
        calculatedAt: new Date(),
      },
      create: {
        orderId,
        revenue,
        cogs,
        commission,
        grossMargin,
        marginPercent,
      },
    });

    return report;
  }

  static async list(tenantId: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;

    const [reports, total] = await Promise.all([
      prisma.marginReport.findMany({
        where: { order: { tenantId } },
        include: {
          order: {
            select: {
              orderNumber: true,
              status: true,
              contact: { select: { name: true } },
            },
          },
        },
        orderBy: { calculatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.marginReport.count({
        where: { order: { tenantId } },
      }),
    ]);

    return { reports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getAverageMargin(tenantId: string) {
    const result = await prisma.marginReport.aggregate({
      where: { order: { tenantId } },
      _avg: { marginPercent: true },
      _sum: { grossMargin: true, revenue: true },
      _count: true,
    });

    return {
      avgMarginPercent: Number(result._avg?.marginPercent || 0),
      totalGrossMargin: Number(result._sum?.grossMargin || 0),
      totalRevenue: Number(result._sum?.revenue || 0),
      count: result._count,
    };
  }
}
