import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TotpService } from "@/lib/services/totp.service";
import { AuditService } from "@/lib/services/audit.service";

/**
 * POST /api/auth/2fa/disable
 * Body: { code: string }
 * Requires a valid TOTP code to disable 2FA (prevents CSRF/session hijack).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Code invalide (6 chiffres requis)" }, { status: 400 });
  }

  const record = await prisma.twoFactorSecret.findUnique({ where: { userId } });
  if (!record) {
    return NextResponse.json({ error: "2FA non configuré" }, { status: 400 });
  }

  if (!TotpService.verify(record.secret, code)) {
    return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.twoFactorSecret.delete({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
  ]);

  await AuditService.log({
    tenantId,
    userId,
    action: "security.2fa_disabled",
    entityType: "user",
    entityId: userId,
  });

  return NextResponse.json({ ok: true });
}
