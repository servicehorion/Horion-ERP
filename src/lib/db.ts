import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function getPgPool() {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;

  const connectionString =
    process.env.NODE_ENV === "production" && process.env.DATABASE_URL_POOLING
      ? process.env.DATABASE_URL_POOLING
      : process.env.DATABASE_URL;

  const max = Number(
    process.env.PG_POOL_MAX ??
      (process.env.NODE_ENV === "production" ? "10" : "6")
  );

  const pool = new Pool({
    connectionString,
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
