import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";

import { hasPermission } from "@/lib/permissions";
import { rateLimit, authRateLimit } from "@/lib/rate-limit";

/**
 * Route guards: (route prefix -> required permission)
 * First match wins.
 */
const ROUTE_GUARDS: [string, string][] = [
  // Administration
  ["/settings",   "user.manage"],
  // AI OS
  ["/ai",         "ai.view"],
  // Marketing OS
  ["/marketing",  "marketing.view"],
  ["/whatsapp",   "whatsapp.view"],
  // Finance OS
  ["/finance",    "finance.view"],
  // Logistics OS
  ["/logistics",  "logistics.view"],
  ["/qc",         "qc.view"],
  // Sourcing OS
  ["/sourcing",   "sourcing.view"],
  // CRM OS
  ["/crm",        "crm.view"],
  ["/contacts",   "crm.view"],
  // Project OS
  ["/projects",   "project.view"],
  // Operations OS / Tasks
  ["/tasks",      "task.view"],
  // Orders
  ["/orders",     "order.view"],
  // Catalogue
  ["/catalog",    "catalog.view"],
  // Devis — quote.approve est la permission minimale commune à tous les rôles liés aux devis
  ["/quotes",     "quote.approve"],
  // Pilotage stratégique — CEO / DIRECTION / ADMIN uniquement
  ["/pilotage",   "pilotage.view"],
  // Dashboard intentionally not protected by middleware
];

const PUBLIC_API_ROUTES = [
  "/api/whatsapp/webhook",
  "/api/bank/webhook",
  "/api/logistics/tracking/webhook",
  "/api/logistics/sla-check",
  "/api/logistics/portal",
  "/api/pay",
  "/api/cron",
  "/api/auth",
];

const PUBLIC_PAGE_ROUTES = new Set([
  "/",
  "/comment-ca-marche",
  "/services",
  "/pourquoi-horion",
  "/faq",
  "/a-propos",
  "/contact",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

const PUBLIC_PAGE_PREFIXES = [
  "/portal",
  "/quote/",
  "/pay/",
  "/verification/",
];

const PUBLIC_ASSET_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".txt",
  ".xml",
  ".json",
  ".mp4",
  ".webm",
  ".woff",
  ".woff2",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Brute-force protection on the credentials sign-in endpoint.
  // This must run before the generic public API limiter, otherwise
  // /api/auth/callback/credentials will be caught by the broader
  // /api/auth prefix and this stricter branch will never execute.
  if (pathname === "/api/auth/callback/credentials" && req.method === "POST") {
    const result = await authRateLimit(req);
    if (!result.success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Reessayez dans 15 minutes." },
        {
          status: 429,
          headers: {
            "x-ratelimit-limit": String(result.limit),
            "x-ratelimit-remaining": String(result.remaining),
            "Retry-After": "900",
          },
        }
      );
    }
  }

  if (pathname.startsWith("/api")) {
    const isPublicApi = PUBLIC_API_ROUTES.some((prefix) => pathname.startsWith(prefix));
    if (isPublicApi) {
      const result = await rateLimit(req);
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: {
              "x-ratelimit-limit": String(result.limit),
              "x-ratelimit-remaining": String(result.remaining),
              "x-ratelimit-reset": String(result.reset),
            },
          }
        );
      }

      const res = NextResponse.next();
      res.headers.set("x-ratelimit-limit", String(result.limit));
      res.headers.set("x-ratelimit-remaining", String(result.remaining));
      res.headers.set("x-ratelimit-reset", String(result.reset));
      return res;
    }
  }

  // Public assets and NextAuth routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    PUBLIC_ASSET_EXTENSIONS.some((ext) => pathname.toLowerCase().endsWith(ext)) ||
    PUBLIC_PAGE_ROUTES.has(pathname) ||
    PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // Auth.js v5: let getToken read AUTH_SECRET from env automatically.
  // Passing secret explicitly can cause mismatches with internal JWT signing.
  // Explicitly set the v5 cookie name to avoid v4/v5 cookie name mismatch.
  const cookiePrefix = req.nextUrl.protocol === "https:" ? "__Secure-" : "";
  const token = await getToken({
    req,
    cookieName: `${cookiePrefix}authjs.session-token`,
  });

  // Login page
  if (pathname.startsWith("/login")) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // All other routes require auth
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as UserRole;

  // Permission check by route prefix
  for (const [prefix, permission] of ROUTE_GUARDS) {
    if (pathname.startsWith(prefix)) {
      if (!hasPermission(role, permission)) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Exclude static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
