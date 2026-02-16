import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}

export async function getSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const user = session.user as Record<string, unknown>;
  if (!user.tenantId) throw new Error("Tenant non configuré");
  return {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string,
    role: user.role as UserRole,
    tenantId: user.tenantId as string,
  };
}
