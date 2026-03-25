import { prisma } from "@/lib/db";

const DEFAULT_SLA_HOURS = 48;

export class OrderComplianceService {
  static async getKpis(tenantId: string) {
    const slaHours = Number(process.env.ORDER_APPROVAL_SLA_HOURS || DEFAULT_SLA_HOURS);
    const slaMs = slaHours * 60 * 60 * 1000;
    const now = Date.now();

    const [
      totalOrders,
      approvalRequired,
      pendingOrders,
      approvedOrders,
      rejectedOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId, approvalStatus: { not: "NOT_REQUIRED" } } }),
      prisma.order.count({ where: { tenantId, approvalStatus: "PENDING" } }),
      prisma.order.count({ where: { tenantId, approvalStatus: "APPROVED" } }),
      prisma.order.count({ where: { tenantId, approvalStatus: "REJECTED" } }),
    ]);

    const approvedOrdersWithSteps = await prisma.order.findMany({
      where: { tenantId, approvalStatus: "APPROVED" },
      select: {
        id: true,
        approvals: {
          select: { createdAt: true, decidedAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      take: 200,
      orderBy: { updatedAt: "desc" },
    });

    const approvalDurations = approvedOrdersWithSteps
      .map((order) => {
        const first = order.approvals[0];
        const last = order.approvals.slice().reverse().find((a) => a.decidedAt);
        if (!first || !last?.decidedAt) return null;
        return (new Date(last.decidedAt).getTime() - new Date(first.createdAt).getTime()) / 3600000;
      })
      .filter((v): v is number => v !== null);

    const avgApprovalHours =
      approvalDurations.length > 0
        ? approvalDurations.reduce((sum, v) => sum + v, 0) / approvalDurations.length
        : 0;

    const pendingSteps = await prisma.orderApproval.findMany({
      where: {
        order: { tenantId },
        status: "PENDING",
      },
      select: {
        id: true,
        createdAt: true,
        rule: { select: { requiredRole: true } },
        orderId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const overdueSteps = pendingSteps.filter((step) => now - new Date(step.createdAt).getTime() > slaMs);

    const pendingByRole = pendingSteps.reduce<Record<string, number>>((acc, step) => {
      const role = step.rule.requiredRole;
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const overdueByRole = overdueSteps.reduce<Record<string, number>>((acc, step) => {
      const role = step.rule.requiredRole;
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const approvalRate = approvalRequired > 0 ? Math.round((approvedOrders / approvalRequired) * 100) : 100;

    return {
      totalOrders,
      approvalRequired,
      pendingOrders,
      approvedOrders,
      rejectedOrders,
      avgApprovalHours,
      slaHours,
      overdueSteps: overdueSteps.length,
      pendingByRole,
      overdueByRole,
      approvalRate,
    };
  }
}
