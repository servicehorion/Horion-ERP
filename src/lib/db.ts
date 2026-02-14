import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Utilise DATABASE_URL_POOLING en production (Supabase PgBouncer)
  // Utilise DATABASE_URL en dev ou pour migrations
  const connectionString =
    process.env.NODE_ENV === "production" && process.env.DATABASE_URL_POOLING
      ? process.env.DATABASE_URL_POOLING
      : process.env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
    max: 10, // Maximum de connexions dans le pool
    idleTimeoutMillis: 30000, // Fermer les connexions inactives après 30s
    connectionTimeoutMillis: 10000, // Timeout de connexion 10s
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
