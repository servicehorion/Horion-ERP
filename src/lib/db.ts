import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function buildPgPoolOptions(connectionString: string) {
  const parsed = new URL(connectionString);
  const sslMode = parsed.searchParams.get("sslmode");
  const needsSsl =
    sslMode !== "disable" &&
    (parsed.hostname.endsWith(".supabase.co") ||
      parsed.hostname.endsWith(".pooler.supabase.com") ||
      sslMode === "require" ||
      sslMode === "verify-full");

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}

function getPgPool() {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;

  const connectionString =
    (process.env.NODE_ENV === "production" && process.env.DATABASE_URL_POOLING
      ? process.env.DATABASE_URL_POOLING
      : process.env.DATABASE_URL) ?? "";

  const max = Number(
    process.env.PG_POOL_MAX ??
      (process.env.NODE_ENV === "production" ? "10" : "6")
  );

  const pool = new Pool({
    ...buildPgPoolOptions(connectionString),
    max,
    keepAlive: true,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? "5000"),
  });

  globalForPrisma.pgPool = pool;
  return pool;
}

function createPrismaClient() {
  const adapter = new PrismaPg(getPgPool());

  return new PrismaClient({
    adapter,
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
