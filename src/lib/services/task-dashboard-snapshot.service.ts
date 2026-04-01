import { unstable_cache } from "next/cache";

import { getTenantCacheTags } from "@/lib/server-cache";
import { TaskIntelligenceService } from "@/lib/services/task-intelligence.service";

function normalizeModulesKey(modules?: string[] | "*") {
  if (!modules || modules === "*") return "all";
  return [...modules].sort().join(",");
}

function getSnapshotTtlSeconds() {
  const configured = Number(process.env.TASK_DASHBOARD_SNAPSHOT_TTL_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(5, Math.floor(configured / 1000));
  }

  return process.env.NODE_ENV === "production" ? 60 : 15;
}

export class TaskDashboardSnapshotService {
  static async getDashboard(tenantId: string, userId: string, modules?: string[] | "*") {
    const namespace = "task-dashboard";
    const modulesKey = normalizeModulesKey(modules);

    return unstable_cache(
      async () => {
        const metrics = await TaskIntelligenceService.getDashboardMetrics(tenantId, userId, modules);
        const moduleBreakdown = await TaskIntelligenceService.getModuleBreakdown(tenantId, modules);
        const priorities = await TaskIntelligenceService.getPriorityDistribution(tenantId, modules);
        const urgencies = await TaskIntelligenceService.getUrgencies(tenantId, 10, modules);
        const myTasks = await TaskIntelligenceService.getMyTasks(tenantId, userId, 15, modules);
        const teamWorkload = await TaskIntelligenceService.getTeamWorkload(tenantId, modules);

        return {
          metrics,
          moduleBreakdown,
          priorities,
          urgencies,
          myTasks,
          teamWorkload,
          currentUserId: userId,
          generatedAt: new Date().toISOString(),
        };
      },
      [namespace, tenantId, userId, modulesKey],
      {
        revalidate: getSnapshotTtlSeconds(),
        tags: [
          ...getTenantCacheTags(namespace, tenantId),
          `${namespace}:${tenantId}:${userId}:${modulesKey}`,
        ],
      }
    )();
  }
}
