"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { AgentPlatformService } from "@/lib/services/agent-platform.service";
import { AgentTaskService } from "@/lib/services/agent-task.service";
import type { AgentChannel, HorionAgentId } from "@/lib/agents/types";

export async function getAgentPlatformSnapshot() {
  const user = await getSession();
  if (!hasPermission(user.role, "ai.view") && !hasPermission(user.role, "user.manage")) {
    return { error: "Permission refusee" as const };
  }

  try {
    const snapshot = await AgentPlatformService.getPlatformSnapshot(user.tenantId);
    return { data: snapshot };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de charger la plateforme agents" };
  }
}

export async function updateAgentConfiguration(input: {
  agentId: HorionAgentId;
  enabled: boolean;
  autonomy: "assist" | "supervised" | "guarded_write";
  escalationUserId?: string | null;
  channels?: AgentChannel[];
  allowedModules?: AgentChannel[];
  allowedTools?: string[];
  notes?: string;
}) {
  const user = await getSession();
  if (!hasPermission(user.role, "ai.manage") && !hasPermission(user.role, "user.manage")) {
    return { error: "Permission refusee" as const };
  }

  try {
    await AgentPlatformService.updateAgentOverride(user.tenantId, input.agentId, {
      enabled: input.enabled,
      autonomy: input.autonomy,
      escalationUserId: input.escalationUserId || null,
      channels: input.channels,
      allowedModules: input.allowedModules,
      allowedTools: input.allowedTools,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath("/settings/agents");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Mise a jour impossible" };
  }
}

export async function createAgentHandoff(input: {
  sourceAgentId: HorionAgentId;
  targetAgentId: HorionAgentId;
  title: string;
  description?: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  summary?: string;
}) {
  const user = await getSession();
  if (!hasPermission(user.role, "ai.manage") && !hasPermission(user.role, "user.manage")) {
    return { error: "Permission refusee" as const };
  }

  try {
    const [source, target] = await Promise.all([
      AgentPlatformService.getAgentProfile(user.tenantId, input.sourceAgentId),
      AgentPlatformService.getAgentProfile(user.tenantId, input.targetAgentId),
    ]);

    if (!source || !target) return { error: "Agent source ou cible introuvable" };
    if (!target.enabled) return { error: "Agent cible desactive" };

    const module = input.module || target.allowedModules[0] || target.modules[0] || "tasks";

    const task = await AgentTaskService.createAgentHandoff({
      tenantId: user.tenantId,
      sourceAgentId: source.id,
      sourceAgentName: source.displayName,
      targetAgentId: target.id,
      targetAgentName: target.displayName,
      title: input.title,
      description: input.description,
      module,
      entityType: input.entityType,
      entityId: input.entityId,
      priority: input.priority,
      summary: input.summary,
      tags: ["agent-platform", module],
      payload: {
        createdByUserId: user.id,
        createdByUserName: user.name,
      },
    });

    revalidatePath("/settings/agents");
    revalidatePath("/tasks");
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Handoff impossible" };
  }
}
