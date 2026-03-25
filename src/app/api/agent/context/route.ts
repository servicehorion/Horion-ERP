import { NextRequest, NextResponse } from "next/server";

import { authenticateAgentRequest } from "@/lib/agents/auth";
import { AgentPlatformService } from "@/lib/services/agent-platform.service";

export async function POST(req: NextRequest) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    if (body.toolId) {
      await AgentPlatformService.assertToolAccess(auth.agent.tenantId, auth.agent.agentId, body.toolId);
    }

    const context = await AgentPlatformService.buildContext(auth.agent.tenantId, {
      taskId: body.taskId,
      entityType: body.entityType,
      entityId: body.entityId,
    });

    return NextResponse.json({ data: context });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 400 }
    );
  }
}
