import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";

import { hasPermission } from "@/lib/permissions";

/**
 * Route guards : (préfixe de route → permission requise)
 * Premier match gagne — ordre du plus spécifique au plus général.
 */
const ROUTE_GUARDS: [string, string][] = [
  // Administration
  ["/settings",   "user.manage"],
  // AI OS
  ["/ai",         "ai.view"],
  // Marketing OS
  ["/marketing",  "marketing.view"],
  ["/whatsapp",   "marketing.view"],
  // Finance OS
  ["/finance",    "finance.view"],
  // Logistique OS
  ["/logistics",  "logistics.view"],
  ["/qc",         "qc.view"],
  // Sourcing OS
  ["/sourcing",   "sourcing.view"],
  // CRM OS
  ["/crm",        "crm.view"],
  ["/contacts",   "crm.view"],
  // Project OS
  ["/projects",   "project.view"],
  // Operations OS / Tâches
  ["/tasks",      "task.view"],
  // Commandes
  ["/orders",     "order.view"],
  // Pilotage — accessible à tous les authentifiés (filtrage par rôle dans l'UI)
  // ["/dashboard", "pilotage.view"],  // intentionnellement non protégé
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Actifs publics et routes NextAuth → laisser passer ───────────────────
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ── Lire le JWT (edge-compatible, pas de bcrypt/prisma) ──────────────────
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  // ── Page login ────────────────────────────────────────────────────────────
  if (pathname.startsWith("/login")) {
    // Déjà connecté → rediriger vers le dashboard
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // ── Racine → rediriger ────────────────────────────────────────────────────
  if (pathname === "/") {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── Toute autre route protégée : authentification requise ────────────────
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as UserRole;

  // ── Vérification des permissions par préfixe de route ────────────────────
  for (const [prefix, permission] of ROUTE_GUARDS) {
    if (pathname.startsWith(prefix)) {
      if (!hasPermission(role, permission)) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
      break; // premier match suffit
    }
  }

  return NextResponse.next();
}

export const config = {
  // Exclure les assets statiques et les routes API NextAuth
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
