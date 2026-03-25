import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type MemoryBucket = {
  limit: number;
  windowMs: number;
  entries: Map<string, number[]>;
};

let ratelimitInstance: Ratelimit | null = null;
let authRatelimitInstance: Ratelimit | null = null;

const memoryPublicBucket: MemoryBucket = {
  limit: 100,
  windowMs: 60_000,
  entries: new Map(),
};

const memoryAuthBucket: MemoryBucket = {
  limit: 10,
  windowMs: 15 * 60_000,
  entries: new Map(),
};

function isUsableEnvValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized === "...") return false;
  if (normalized.toLowerCase().includes("your_")) return false;
  if (normalized.toLowerCase().includes("example")) return false;
  return true;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!isUsableEnvValue(url) || !isUsableEnvValue(token)) return null;
  return new Redis({ url, token });
}

function getRatelimit() {
  if (ratelimitInstance) return ratelimitInstance;
  const redis = getRedis();
  if (!redis) return null;
  ratelimitInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(memoryPublicBucket.limit, "1 m"),
    analytics: true,
    prefix: "horion-rl",
  });
  return ratelimitInstance;
}

function getAuthRatelimit() {
  if (authRatelimitInstance) return authRatelimitInstance;
  const redis = getRedis();
  if (!redis) return null;
  authRatelimitInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(memoryAuthBucket.limit, "15 m"),
    analytics: true,
    prefix: "horion-auth",
  });
  return authRatelimitInstance;
}

function getRequestIp(req: NextRequest) {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function applyMemoryLimit(bucket: MemoryBucket, key: string): LimitResult {
  const now = Date.now();
  const windowStart = now - bucket.windowMs;
  const existing = bucket.entries.get(key) ?? [];
  const recent = existing.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= bucket.limit) {
    const oldest = recent[0] ?? now;
    return {
      success: false,
      limit: bucket.limit,
      remaining: 0,
      reset: Math.ceil((oldest + bucket.windowMs) / 1000),
    };
  }

  recent.push(now);
  bucket.entries.set(key, recent);

  return {
    success: true,
    limit: bucket.limit,
    remaining: Math.max(bucket.limit - recent.length, 0),
    reset: Math.ceil((recent[0] + bucket.windowMs) / 1000),
  };
}

export async function rateLimit(req: NextRequest): Promise<LimitResult> {
  const ip = getRequestIp(req);
  const limiter = getRatelimit();
  if (!limiter) {
    return applyMemoryLimit(memoryPublicBucket, ip);
  }

  try {
    return await limiter.limit(ip);
  } catch {
    return applyMemoryLimit(memoryPublicBucket, ip);
  }
}

export async function authRateLimit(req: NextRequest): Promise<LimitResult> {
  const ip = getRequestIp(req);
  const limiter = getAuthRatelimit();
  if (!limiter) {
    return applyMemoryLimit(memoryAuthBucket, ip);
  }

  try {
    return await limiter.limit(ip);
  } catch {
    return applyMemoryLimit(memoryAuthBucket, ip);
  }
}
