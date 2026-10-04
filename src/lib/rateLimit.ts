import { db } from "@/lib/db";

/**
 * Fixed-window rate limiter stored in Postgres, so it holds across several App Service instances.
 * One atomic upsert per hit.
 */
export async function rateLimit(key: string, limit: number, windowMs: number, nowMs = Date.now()) {
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start = EXCLUDED.window_start THEN rate_limits.count + 1 ELSE 1 END,
      window_start = EXCLUDED.window_start
    RETURNING count`;

  // Occasionally clear stale keys.
  if (Math.random() < 0.01) {
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(nowMs - 24 * 3600_000) } } });
  }

  const count = Number(rows[0]?.count ?? 0);
  return { ok: count <= limit, count };
}

/** Best-effort client IP behind Azure App Service / proxies. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim().replace(/:\d+$/, "") ||
    headers.get("x-client-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Limits for the check-in endpoints. */
export const LIMITS = {
  checkinPerEmployee: { limit: 20, windowMs: 60_000 },
  checkinPerIp: { limit: 120, windowMs: 60_000 },
  // Typed codes are guessable in principle, so they get a much tighter budget.
  codePerEmployee: { limit: 6, windowMs: 5 * 60_000 },
} as const;
