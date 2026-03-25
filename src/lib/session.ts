import { cache } from "react";

import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}

async function loadSessionWithRetry(retries = 1) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return (await auth()) as { user?: Record<string, unknown> } | null;
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw lastError;
    }
  }
  return null;
}

const loadCachedSession = cache(async () => {
  return loadSessionWithRetry(1);
});

export async function getSession(): Promise<SessionUser> {
  let session: { user?: Record<string, unknown> } | null;

  try {
    session = await loadCachedSession();
  } catch {
    throw new Error("Session indisponible. Reconnectez-vous.");
  }

  if (!session?.user) throw new Error("Session expiree. Reconnectez-vous.");

  const user = session.user;
  if (!user.tenantId) throw new Error("Tenant non configure");

  return {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string,
    role: user.role as UserRole,
    tenantId: user.tenantId as string,
  };
}
