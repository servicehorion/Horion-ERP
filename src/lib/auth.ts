import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { TotpService } from "@/lib/services/totp.service";

/** Thrown when the user has 2FA enabled but no TOTP code was submitted. */
class TwoFactorRequired extends CredentialsSignin {
  code = "two_factor_required";
}

/** Thrown when the submitted TOTP code is incorrect. */
class TwoFactorInvalid extends CredentialsSignin {
  code = "two_factor_invalid";
}

class TwoFactorUnavailable extends CredentialsSignin {
  code = "two_factor_unavailable";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        // Optional — sent only on the second leg of a 2FA login
        totpCode: { label: "Code 2FA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            tenantId: true,
            isActive: true,
            twoFactorEnabled: true,
            tenant: {
              select: {
                name: true,
              },
            },
          },
        });

        if (!user || !user.isActive) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!passwordMatch) return null;

        // ── 2FA check ────────────────────────────────────────────────────────
        let twoFactorSecret: { secret: string } | null = null;
        let twoFactorLookupFailed = false;
        if (user.twoFactorEnabled) {
          try {
            twoFactorSecret = await prisma.twoFactorSecret.findUnique({
              where: { userId: user.id },
              select: { secret: true },
            });
          } catch {
            twoFactorSecret = null;
            twoFactorLookupFailed = true;
          }
        }

        if (user.twoFactorEnabled && (!twoFactorSecret || twoFactorLookupFailed)) {
          throw new TwoFactorUnavailable();
        }

        if (user.twoFactorEnabled && twoFactorSecret) {
          const totpCode = (credentials.totpCode as string | undefined)?.trim();
          if (!totpCode) {
            // First leg: password OK but no TOTP code — signal the UI to ask for it
            throw new TwoFactorRequired();
          }
          const valid = TotpService.verify(twoFactorSecret.secret, totpCode);
          if (!valid) {
            throw new TwoFactorInvalid();
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          // Ignore login tracking errors
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in: populate token from the authorized user object
      if (user) {
        token.id = user.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.role = u.role;
        token.tenantId = u.tenantId;
        token.tenantName = u.tenantName;
        token.isActive = u.isActive;
        // Record when we last synced from DB so we can throttle future lookups
        token.dbSyncedAt = Date.now();
        return token;
      }

      // On subsequent calls: re-sync rarely to avoid DB pressure on /api/auth/session.
      // A forced refresh can still happen with trigger === "update".
      const RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
      const lastSync = (token.dbSyncedAt as number | undefined) ?? 0;
      const shouldResync = trigger === "update" || Date.now() - lastSync > RESYNC_INTERVAL_MS;

      if (token.id && shouldResync) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: String(token.id) },
            select: { role: true, tenantId: true, isActive: true, tenant: { select: { name: true } } },
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.tenantId = dbUser.tenantId;
            token.tenantName = dbUser.tenant.name;
            token.isActive = dbUser.isActive;
          } else {
            // User deleted or suspended — invalidate token
            token.role = "VIEWER";
            token.isActive = false;
          }
        } catch {
          // Keep current token claims when DB is temporarily unavailable.
          // This prevents session endpoints from failing hard and showing users
          // as unauthenticated due to transient DB/pool issues.
        }
        token.dbSyncedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const su = session.user as any;
        su.id = token.id;
        su.role = token.role;
        su.tenantId = token.tenantId;
        su.tenantName = token.tenantName;
        su.isActive = token.isActive ?? true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,     // Session expires after 8 h (work day)
    updateAge: 15 * 60,       // NextAuth refreshes the JWT cookie every 15 min max
  },
  trustHost: true,
});
