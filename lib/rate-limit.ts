import { headers } from "next/headers";
import { redis } from "./redis";

/**
 * A fixed-window counter in Redis.
 *
 * @remarks Better Auth ships a rate limiter, but it only runs inside
 * `auth.handler` — Server Actions and custom route handlers get none of it. The
 * license-key check is a guessable secret reachable without a session, so it
 * needs its own throttle.
 *
 * @param key - Bucket identity, e.g. `"onboarding:activate"`.
 * @param limit - Attempts allowed inside the window.
 * @param windowSeconds - Window length. The window starts at the first attempt
 * and is not extended by later ones, so a blocked caller always drains.
 * @returns Whether this attempt is allowed.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const bucket = `whalechat:rl:${key}:${await clientIp()}`;

  const attempts = await redis.incr(bucket);
  // Only on the first attempt, so a stream of requests cannot keep pushing the
  // expiry out and lock the bucket open forever.
  if (attempts === 1) await redis.expire(bucket, windowSeconds);

  return attempts <= limit;
}

/**
 * Best-effort client address.
 *
 * @remarks Behind a proxy this is only as trustworthy as the proxy is. It is a
 * throttle, not an authorization decision — a caller who can forge the header
 * gets more attempts, not access.
 */
async function clientIp() {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return headerList.get("x-real-ip") ?? "unknown";
}
