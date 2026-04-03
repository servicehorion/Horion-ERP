"use server";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export type NavBadgeMap = Record<string, number | "dot">;

async function safeBadgeCount(label: string, run: () => Promise<number>) {
  try {
    return await run();
  } catch (error) {
    console.error(`[nav-badges] ${label}`, error);
    return 0;
  }
}

async function fetchNavBadges(tenantId: string): Promise<NavBadgeMap> {
  const now = new Date();

  // Keep this intentionally sequential: badges are informational and this runs
  // from the shared layout, so reducing DB fan-out is more important than shaving
  // a few milliseconds off the response time.
  const overdueTasks = await safeBadgeCount("overdue-tasks", () =>
    prisma.task.count({
      where: {
        tenantId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        dueDate: { lt: now },
      },
    })
  );

  const slaBreaches = await safeBadgeCount("sla-breaches", () =>
    prisma.task.count({
      where: {
        tenantId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        OR: [
          { slaBreach: true },
          { slaDeadline: { lt: now } },
        ],
      },
    })
  );

  const openDisputes = await safeBadgeCount("open-disputes", () =>
    prisma.dispute.count({
      where: {
        order: { tenantId },
        status: { in: ["OPEN", "INVESTIGATING", "ESCALATED"] },
      },
    })
  );

  const recalledLots = await safeBadgeCount("recalled-lots", () =>
    prisma.qcLotTrace.count({
      where: {
        tenantId,
        status: { in: ["RECALLED", "QUARANTINE"] },
      },
    })
  );

  const failedLabTests = await safeBadgeCount("failed-lab-tests", () =>
    prisma.qcLabTest.count({
      where: {
        connection: { tenantId },
        status: "FAILED",
      },
    })
  );

  const taskBadge = overdueTasks + slaBreaches;
  const qcBadge = recalledLots + failedLabTests;

  return {
    "/tasks": taskBadge,
    "/orders": openDisputes,
    "/qc": qcBadge,
    "/pilotage": taskBadge + openDisputes + qcBadge > 0 ? "dot" : 0,
  };
}

export async function getNavBadges(): Promise<NavBadgeMap> {
  try {
    const user = await getSession();
    // Cache the 5 DB queries for 60 seconds per tenant.
    // Badges are informational — a 1-minute delay is acceptable.
    // Revalidated automatically when tasks/orders/qc are mutated via revalidateTag("nav-badges").
    const cached = unstable_cache(
      () => fetchNavBadges(user.tenantId),
      [`nav-badges-${user.tenantId}`],
      { revalidate: 60, tags: [`nav-badges-${user.tenantId}`] }
    );
    return await cached();
  } catch {
    return {};
  }
}
