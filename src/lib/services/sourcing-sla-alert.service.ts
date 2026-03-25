import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { SourcingSlaService } from "@/lib/services/sourcing-sla.service";

const SLA_NOTIFY_ROLES = ["LOGISTICS_MANAGER", "SOURCING_ASSISTANT", "OPS", "ADMIN", "CEO", "DIRECTION"] as const;
const NOTIFY_COOLDOWN_HOURS = 24;

export class SourcingSlaAlertService {
  static async notifyForCases(params: {
    tenantId: string;
    cases: Array<{
      id: string;
      status: string;
      stageEnteredAt?: Date | string | null;
      createdAt?: Date | string | null;
      updatedAt?: Date | string | null;
      assignedToId?: string | null;
    }>;
  }) {
    const now = new Date();
    const cooldown = new Date(now.getTime() - NOTIFY_COOLDOWN_HOURS * 3_600_000);

    for (const sc of params.cases) {
      const statusEnteredAt = sc.stageEnteredAt ?? sc.updatedAt ?? sc.createdAt ?? now;
      const sla = SourcingSlaService.compute(sc.status, new Date(statusEnteredAt));

      if (sla.status === "ON_TIME") continue;

      const type = sla.status === "BREACHED" ? "SLA_BREACH" : "SLA_WARNING";

      const recent = await prisma.notification.findFirst({
        where: {
          tenantId: params.tenantId,
          type,
          entityType: "sourcing_case",
          entityId: sc.id,
          createdAt: { gte: cooldown },
        },
        select: { id: true },
      });
      if (recent) continue;

      let userIds: string[] = [];
      if (sc.assignedToId) {
        userIds = [sc.assignedToId];
      } else {
        const fallback = await prisma.user.findMany({
          where: {
            tenantId: params.tenantId,
            isActive: true,
            role: { in: [...SLA_NOTIFY_ROLES] as any },
          },
          select: { id: true },
        });
        userIds = fallback.map((u) => u.id);
      }

      if (userIds.length === 0) continue;

      await NotificationService.notifyMany(userIds, {
        tenantId: params.tenantId,
        type: type as any,
        title: sla.status === "BREACHED" ? "Sourcing SLA breached" : "Sourcing SLA warning",
        message: `Sourcing case ${sc.id.slice(0, 6)} - ${sla.label}`,
        entityType: "sourcing_case",
        entityId: sc.id,
      });
    }
  }
}
