import { NextRequest, NextResponse } from "next/server";

import { authenticateAgentRequest } from "@/lib/agents/auth";
import { AgentTaskService } from "@/lib/services/agent-task.service";
import { AgentPlatformService } from "@/lib/services/agent-platform.service";

/**
 * GET  /api/agent/tasks
 * POST /api/agent/tasks
 *
 * Main work queue for Horion AI agents.
 */

export async function GET(req: NextRequest) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const agent = auth.agent;
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "assigned";
  const status = searchParams.get("status") ?? undefined;
  const module = searchParams.get("module") ?? undefined;
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

  try {
    const tasks = mode === "automatable"
      ? await AgentTaskService.getAutomatableTasks(agent.tenantId, { module, limit })
      : await AgentTaskService.getAgentTasks(agent.tenantId, agent.agentId, { status, module, limit });

    return NextResponse.json({ data: tasks, count: tasks.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const agent = auth.agent;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const task = await AgentTaskService.createAgentTask({
          tenantId: agent.tenantId,
          title: body.title,
          description: body.description,
          module: body.module,
          taskType: body.taskType ?? "agent_task",
          entityType: body.entityType,
          entityId: body.entityId,
          priority: body.priority,
          slaHours: body.slaHours,
          ownerType: body.ownerType ?? "AI_AGENT",
          agentId: agent.agentId,
          agentName: body.agentName ?? agent.agentName,
          parentTaskId: body.parentTaskId,
          tags: body.tags,
          requiredApproval: body.requiredApproval,
          automationAllowed: body.automationAllowed,
          assigneeId: body.assigneeId,
        });
        return NextResponse.json({ data: task }, { status: 201 });
      }

      case "claim": {
        if (!body.taskId) {
          return NextResponse.json({ error: "taskId required" }, { status: 400 });
        }
        const result = await AgentTaskService.claimTask(
          body.taskId,
          agent.agentId,
          body.agentName ?? agent.agentName
        );
        return NextResponse.json({ data: result });
      }

      case "report": {
        if (!body.executionId) {
          return NextResponse.json({ error: "executionId required" }, { status: 400 });
        }
        const execution = await AgentTaskService.reportResult(body.executionId, {
          status: body.status ?? "COMPLETED",
          output: body.output,
          error: body.error,
          newTaskStatus: body.newTaskStatus,
        });
        return NextResponse.json({ data: execution });
      }

      case "delegate": {
        if (!body.taskId || !body.targetAgentId) {
          return NextResponse.json({ error: "taskId and targetAgentId required" }, { status: 400 });
        }
        const task = await AgentTaskService.delegateToAgent(
          body.taskId,
          body.targetAgentId,
          body.targetAgentName ?? body.targetAgentId
        );
        return NextResponse.json({ data: task });
      }

      case "handoff": {
        if (!body.targetAgentId || !body.title) {
          return NextResponse.json({ error: "targetAgentId and title required" }, { status: 400 });
        }

        const target = await AgentPlatformService.getAgentProfile(agent.tenantId, body.targetAgentId);
        if (!target || !target.enabled) {
          return NextResponse.json({ error: "Target agent unavailable" }, { status: 400 });
        }

        const task = await AgentTaskService.createAgentHandoff({
          tenantId: agent.tenantId,
          sourceAgentId: agent.agentId,
          sourceAgentName: agent.agentName,
          targetAgentId: target.id,
          targetAgentName: target.displayName,
          title: body.title,
          description: body.description,
          module: body.module ?? target.allowedModules[0] ?? target.modules[0] ?? "tasks",
          entityType: body.entityType,
          entityId: body.entityId,
          priority: body.priority,
          parentTaskId: body.parentTaskId,
          tags: body.tags,
          summary: body.summary,
          payload: body.payload,
        });

        return NextResponse.json({ data: task }, { status: 201 });
      }

      case "analytics": {
        const analytics = await AgentTaskService.getAgentAnalytics(agent.tenantId);
        return NextResponse.json({ data: analytics });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: create, claim, report, delegate, handoff, analytics` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
