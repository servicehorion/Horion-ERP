"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export type NavBadgeMap = Record<string, number | "dot">;

export async function getNavBadges(): Promise<NavBadgeMap> {
  try {
    const user = await getSession();
    const now = new Date();

    const [overdueTasks, slaBreaches, openDisputes, recalledLots, failedLabTests] = await Promise.all([
      prisma.task.count({
        where: {
          tenantId: user.tenantId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          dueDate: { lt: now },
        },
      }),
      prisma.task.count({
        where: {
          tenantId: user.tenantId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          OR: [
            { slaBreach: true },
            { slaDeadline: { lt: now } },
          ],
        },
      }),
      prisma.dispute.count({
        where: {
          order: { tenantId: user.tenantId },
          status: { in: ["OPEN", "INVESTIGATING", "ESCALATED"] },
        },
      }),
      prisma.qcLotTrace.count({
        where: {
          tenantId: user.tenantId,
          status: { in: ["RECALLED", "QUARANTINE"] },
        },
      }),
      prisma.qcLabTest.count({
        where: {
          connection: { tenantId: user.tenantId },
          status: "FAILED",
        },
      }),
    ]);

    const taskBadge = overdueTasks + slaBreaches;
    const qcBadge = recalledLots + failedLabTests;

    return {
      "/tasks": taskBadge,
      "/orders": openDisputes,
      "/qc": qcBadge,
      "/pilotage": taskBadge + openDisputes + qcBadge > 0 ? "dot" : 0,
    };
  } catch {
    return {};
  }
}
