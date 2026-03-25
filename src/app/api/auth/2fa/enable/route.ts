import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TotpService } from "@/lib/services/totp.service";
import { AuditService } from "@/lib/services/audit.service";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/2fa/enable
 * Body: { code: string }
 * Verifies the TOTP code against the pending secret, enables 2FA on the user,
 * and returns hashed backup codes.
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
    return NextResponse.json({ error: "Configurez d'abord le 2FA via /setup" }, { status: 400 });
  }

  if (!TotpService.verify(record.secret, code)) {
    return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 400 });
  }

  const plainCodes = TotpService.generateBackupCodes();
  const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.$transaction([
    prisma.twoFactorSecret.update({
      where: { userId },
      data: { backupCodes: hashedCodes },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    }),
  ]);

  await AuditService.log({
    tenantId,
    userId,
    action: "security.2fa_enabled",
    entityType: "user",
    entityId: userId,
  });

  return NextResponse.json({ backupCodes: plainCodes });
}
