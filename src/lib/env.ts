/**
 * env.ts — Validate required environment variables at startup.
 *
 * Import this module at the top of src/lib/db.ts (and optionally in
 * src/app/layout.tsx) so missing vars throw a clear error at boot time,
 * not at first request.
 *
 * Uses native error throwing instead of zod to avoid adding a dependency
 * just for env validation.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[Horion ERP] Missing required environment variable: ${key}\n` +
        `  Check your .env file. The application cannot start without it.`
    );
  }
  return value;
}

function optional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

// Validate all critical env vars in one pass so the error lists everything
// missing at once, not one-by-one on successive restarts.
const errors: string[] = [];

function check(key: string): void {
  if (!process.env[key] || process.env[key]!.trim() === "") {
    errors.push(key);
  }
}

// --- Required in every environment ---
check("DATABASE_URL");
// Accept either AUTH_SECRET (preferred) or NEXTAUTH_SECRET for compatibility.
if (
  (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.trim() === "") &&
  (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.trim() === "")
) {
  errors.push("AUTH_SECRET (or NEXTAUTH_SECRET)");
}
check("NEXTAUTH_URL");

// --- Required in production only ---
if (process.env.NODE_ENV === "production") {
  check("NEXT_PUBLIC_APP_URL");
}

if (errors.length > 0) {
  throw new Error(
    `[Horion ERP] Missing required environment variables:\n` +
      errors.map((k) => `  - ${k}`).join("\n") +
      `\n\nCheck your .env or Vercel/hosting environment configuration.`
  );
}

// Export typed, validated env values for use in the app.
const resolvedAuthSecret =
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  AUTH_SECRET: resolvedAuthSecret,
  NEXTAUTH_URL: required("NEXTAUTH_URL"),
  NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!,
  ANTHROPIC_API_KEY: optional("ANTHROPIC_API_KEY"),
  UPSTASH_REDIS_REST_URL: optional("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: optional("UPSTASH_REDIS_REST_TOKEN"),
  RESEND_API_KEY: optional("RESEND_API_KEY"),
  SENTRY_DSN: optional("SENTRY_DSN"),
  AGENT_REGISTRY_JSON: optional("AGENT_REGISTRY_JSON"),
  AGENT_REGISTRY_BASE64: optional("AGENT_REGISTRY_BASE64"),
  NODE_ENV: (process.env.NODE_ENV || "development") as "development" | "production" | "test",
};
