import { NextRequest, NextResponse } from "next/server";

import { authenticateAgentRequest } from "@/lib/agents/auth";
import { AgentPlatformService } from "@/lib/services/agent-platform.service";

export async function GET(req: NextRequest) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [self, peers] = await Promise.all([
      AgentPlatformService.getAgentProfile(auth.agent.tenantId, auth.agent.agentId),
      AgentPlatformService.getAgentProfiles(auth.agent.tenantId),
    ]);

    if (!self) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        self,
        tools: await AgentPlatformService.getToolCatalogForAgent(auth.agent.tenantId, auth.agent.agentId),
        peers: peers.map((agent) => ({
          id: agent.id,
          displayName: agent.displayName,
          enabled: agent.enabled,
          handoffTargets: agent.handoffTargets,
          modules: agent.allowedModules,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
