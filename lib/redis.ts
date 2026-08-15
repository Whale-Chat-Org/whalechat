import { Redis } from "ioredis";

/**
 * The Redis connection, as a module-level singleton.
 *
 * @remarks Shared by Better Auth's secondary storage, the onboarding cache and
 * the rate limiter — one connection, not three. Next's dev server re-evaluates
 * modules on every edit, so without the global cache each reload would leak a
 * connection until Redis refused new ones.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
