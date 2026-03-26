import { prisma } from "@/lib/db";
import type { AgentExecutionStatus, OwnerType, Priority } from "@prisma/client";
import { AgentPlatformService } from "@/lib/services/agent-platform.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";

/**
 * AgentTaskService — API layer for AI agents to interact with the Tasks OS.
 *
 * Supports:
 * - Agent fetching assigned tasks
 * - Agent claiming & executing tasks
 * - Agent reporting results
 * - Cross-OS task creation by agents
 * - Agent-to-agent task delegation
 */
export class AgentTaskService {
  /**
   * Get tasks assigned to a specific agent (by agentId or ownerType=AI_AGENT).
   */
  static async getAgentTasks(
    tenantId: string,
    agentId: string,
    options: { status?: string; module?: string; limit?: number } = {}
  ) {
    const { status, module, limit = 50 } = options;

    return prisma.task.findMany({
      where: {
        tenantId,
        ownerType: "AI_AGENT",
        agentId,
        ...(status && { status: status as any }),
        ...(module && { module }),
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        dependencies: {
          include: { dependsOn: { select: { id: true, title: true, status: true } } },
        },
        children: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }],
      take: limit,
    });
  }

  /**
   * Get all tasks available for agent automation (automationAllowed=true, status=PENDING).
   */
  static async getAutomatableTasks(
    tenantId: string,
    options: { module?: string; limit?: number } = {}
  ) {
    const { module, limit = 50 } = options;

    return prisma.task.findMany({
      where: {
        tenantId,
        automationAllowed: true,
        status: "PENDING",
        ownerType: "HUMAN", // not yet claimed by an agent
        ...(module && { module }),
      },
      include: {
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
      },
      orderBy: [{ priority: "desc" }, { slaDeadline: "asc" }],
      take: limit,
    });
  }

  /**
   * Agent claims a task — sets ownerType to AI_AGENT and starts execution.
   */
  static async claimTask(taskId: string, agentId: string, agentName: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task not found");
    if (!task.automationAllowed && task.ownerType !== "AI_AGENT") {
      throw new Error("Task is not available for automation");
    }

    const [updatedTask, execution] = await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: {
          ownerType: "AI_AGENT",
          agentId,
          agentName,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      }),
      prisma.agentExecution.create({
        data: {
          taskId,
          agentId,
          agentName,
          status: "RUNNING",
          startedAt: new Date(),
        },
      }),
    ]);

    return { task: updatedTask, executionId: execution.id };
  }

  /**
   * Agent reports execution result.
   */
  static async reportResult(
    executionId: string,
    result: {
      status: "COMPLETED" | "FAILED";
      output?: Record<string, unknown>;
      error?: string;
      newTaskStatus?: string;
    }
  ) {
    const execution = await prisma.agentExecution.findUnique({
      where: { id: executionId },
      include: { task: true },
    });
    if (!execution) throw new Error("Execution not found");

    const now = new Date();
    const executionStatus: AgentExecutionStatus =
      result.status === "COMPLETED" ? "COMPLETED" : "FAILED";

    const taskStatus = result.newTaskStatus
      ?? (result.status === "COMPLETED" ? "COMPLETED" : "BLOCKED");

    const [updatedExecution] = await prisma.$transaction([
      prisma.agentExecution.update({
        where: { id: executionId },
        data: {
          status: executionStatus,
          output: (result.output ?? undefined) as any,
          error: result.error,
          completedAt: now,
        },
      }),
      prisma.task.update({
        where: { id: execution.taskId },
        data: {
          status: taskStatus as any,
          ...(taskStatus === "COMPLETED" && { completedAt: now }),
          ...(result.status === "FAILED" && { blockedBy: `Agent error: ${result.error}` }),
        },
      }),
    ]);

    return updatedExecution;
  }

  /**
   * Agent creates a task in any OS module — cross-OS task creation.
   */
  static async createAgentTask(data: {
    tenantId: string;
    title: string;
    description?: string;
    module: string;
    taskType: string;
    entityType?: string;
    entityId?: string;
    priority?: Priority;
    slaHours?: number;
    ownerType?: OwnerType;
    agentId?: string;
    agentName?: string;
    parentTaskId?: string;
    tags?: string[];
    requiredApproval?: boolean;
    automationAllowed?: boolean;
    assigneeId?: string;
  }) {
    const resolvedAgentId =
      data.agentId ||
      (data.ownerType === "AI_AGENT"
        ? AgentPlatformService.getRecommendedAgentId(data.module, {
            entityType: data.entityType,
            taskType: data.taskType,
          })
        : null);

    const resolvedAgentProfile = resolvedAgentId
      ? await AgentPlatformService.getAgentProfile(data.tenantId, resolvedAgentId)
      : null;
    const result = await OperationalTaskService.create({
      tenantId: data.tenantId,
      title: data.title,
      description: data.description,
      module: data.module,
      taskType: data.taskType,
      entityType: data.entityType ?? "manual",
      entityId: data.entityId ?? "none",
      priority: data.priority ?? "NORMAL",
      ownerType: data.ownerType ?? "SYSTEM",
      slaHours: data.slaHours,
      parentTaskId: data.parentTaskId,
      tags: data.tags ?? [],
      requiredApproval: data.requiredApproval ?? false,
      automationAllowed: data.automationAllowed ?? false,
      riskLevel: "LOW",
      assigneeId: data.assigneeId ?? null,
      agentId: resolvedAgentId ?? undefined,
      agentName: data.agentName ?? resolvedAgentProfile?.displayName ?? undefined,
    });

    return prisma.task.findUniqueOrThrow({ where: { id: result.taskId } });
  }

  static async createAgentHandoff(data: {
    tenantId: string;
    sourceAgentId: string;
    sourceAgentName: string;
    targetAgentId: string;
    targetAgentName: string;
    title: string;
    description?: string;
    module: string;
    entityType?: string;
    entityId?: string;
    priority?: Priority;
    parentTaskId?: string;
    tags?: string[];
    summary?: string;
    payload?: Record<string, unknown>;
  }) {
    const result = await OperationalTaskService.create({
      tenantId: data.tenantId,
      title: data.title,
      description: data.description,
      module: data.module,
      taskType: "agent_handoff",
      entityType: data.entityType ?? "manual",
      entityId: data.entityId ?? "none",
      priority: data.priority ?? "NORMAL",
      ownerType: "AI_AGENT",
      automationAllowed: true,
      parentTaskId: data.parentTaskId,
      tags: Array.from(new Set([...(data.tags ?? []), "agent-handoff"])),
      customFields: {
        handoff: {
          sourceAgentId: data.sourceAgentId,
          sourceAgentName: data.sourceAgentName,
          targetAgentId: data.targetAgentId,
          targetAgentName: data.targetAgentName,
          summary: data.summary,
          payload: data.payload ?? {},
        },
      },
      agentId: data.targetAgentId,
      agentName: data.targetAgentName,
    });

    return prisma.task.findUniqueOrThrow({ where: { id: result.taskId } });
  }

  /**
   * Agent delegates task to another agent.
   */
  static async delegateToAgent(taskId: string, targetAgentId: string, targetAgentName: string) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        agentId: targetAgentId,
        agentName: targetAgentName,
        status: "PENDING",
        startedAt: null,
      },
    });
  }

  /**
   * Get agent execution history for a task.
   */
  static async getExecutionHistory(taskId: string) {
    return prisma.agentExecution.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get all agent executions for monitoring/analytics.
   */
  static async getAgentAnalytics(tenantId: string) {
    const [total, completed, failed, running, avgDuration] = await Promise.all([
      prisma.agentExecution.count({
        where: { task: { tenantId } },
      }),
      prisma.agentExecution.count({
        where: { task: { tenantId }, status: "COMPLETED" },
      }),
      prisma.agentExecution.count({
        where: { task: { tenantId }, status: "FAILED" },
      }),
      prisma.agentExecution.count({
        where: { task: { tenantId }, status: "RUNNING" },
      }),
      prisma.agentExecution.findMany({
        where: { task: { tenantId }, status: "COMPLETED", completedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
        take: 100,
        orderBy: { completedAt: "desc" },
      }),
    ]);

    let avgMs = 0;
    const durations = avgDuration.filter((e) => e.startedAt && e.completedAt);
    if (durations.length > 0) {
      const totalMs = durations.reduce(
        (sum, e) => sum + (e.completedAt!.getTime() - e.startedAt!.getTime()),
        0
      );
      avgMs = totalMs / durations.length;
    }

    return {
      total,
      completed,
      failed,
      running,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgExecutionMs: Math.round(avgMs),
    };
  }
}
