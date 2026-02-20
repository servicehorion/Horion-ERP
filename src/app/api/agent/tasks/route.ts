import { NextRequest, NextResponse } from "next/server";
import { AgentTaskService } from "@/lib/services/agent-task.service";
import { prisma } from "@/lib/db";

/**
 * Agent Task API — REST endpoints for AI agents to interact with the Tasks OS.
 *
 * Authentication: x-agent-id + x-agent-secret headers (or Bearer token).
 * In production, implement proper API key management.
 *
 * GET  /api/agent/tasks — Get assigned tasks for an agent
 * POST /api/agent/tasks — Create a task (cross-OS task creation)
 */

async function authenticateAgent(req: NextRequest) {
  const agentId = req.headers.get("x-agent-id");
  const agentSecret = req.headers.get("x-agent-secret");
  const tenantId = req.headers.get("x-tenant-id");

  if (!agentId || !tenantId) {
    return null;
  }

  // In production: validate agent credentials against an AgentRegistry table
  // For now: trust the headers if present
  return { agentId, tenantId };
}

/**
 * GET /api/agent/tasks
 *
 * Query params:
 * - status: filter by status
 * - module: filter by module
 * - mode: "assigned" (default) | "automatable"
 * - limit: max results (default 50)
 */
export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized: x-agent-id and x-tenant-id required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "assigned";
  const status = searchParams.get("status") ?? undefined;
  const module = searchParams.get("module") ?? undefined;
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

  try {
    let tasks;
    if (mode === "automatable") {
      tasks = await AgentTaskService.getAutomatableTasks(agent.tenantId, { module, limit });
    } else {
      tasks = await AgentTaskService.getAgentTasks(agent.tenantId, agent.agentId, { status, module, limit });
    }

    return NextResponse.json({ data: tasks, count: tasks.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/tasks
 *
 * Body:
 * - action: "create" | "claim" | "report" | "delegate"
 * - ...action-specific fields
 */
export async function POST(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          agentName: body.agentName ?? agent.agentId,
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
          body.agentName ?? agent.agentId
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

      case "analytics": {
        const analytics = await AgentTaskService.getAgentAnalytics(agent.tenantId);
        return NextResponse.json({ data: analytics });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: create, claim, report, delegate, analytics` },
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
