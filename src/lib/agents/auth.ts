import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

import { AgentPlatformService } from "@/lib/services/agent-platform.service";

export type AuthenticatedAgent = {
  agentId: string;
  tenantId: string;
  agentName: string;
};

type AuthResult =
  | { ok: true; agent: AuthenticatedAgent }
  | { ok: false; status: number; error: string };

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function getProvidedSecret(req: NextRequest) {
  const headerSecret = req.headers.get("x-agent-secret");
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return headerSecret;
}

export async function authenticateAgentRequest(req: NextRequest): Promise<AuthResult> {
  const registry = AgentPlatformService.loadRuntimeRegistry();
  const agentId = req.headers.get("x-agent-id");
  const providedSecret = getProvidedSecret(req);
  const tenantIdHeader = req.headers.get("x-tenant-id") || undefined;

  if (!agentId || !providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const entry = registry[agentId];
  if (!entry || entry.active === false) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (tenantIdHeader && tenantIdHeader !== entry.tenantId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!safeEqual(providedSecret, entry.secret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return {
    ok: true,
    agent: {
      agentId,
      tenantId: entry.tenantId,
      agentName: entry.name || agentId,
    },
  };
}
