import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TotpService } from "@/lib/services/totp.service";

/**
 * POST /api/auth/2fa/setup
 * Generates a new TOTP secret for the authenticated user and returns:
 *  - secret (base32)
 *  - otpauthUri (for QR code)
 *
 * The secret is persisted but 2FA is NOT yet enabled — the user must
 * call /api/auth/2fa/enable (with a valid code) to activate it.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const email = session.user.email ?? "";

  const secret = TotpService.generateSecret();

  await prisma.twoFactorSecret.upsert({
    where: { userId },
    update: { secret },
    create: { userId, secret },
  });

  const otpauthUri = TotpService.buildOtpAuthUri({ secret, email });

  return NextResponse.json({ secret, otpauthUri });
}
