import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A check-in grant bridges the gap between scanning a (fast-rotating) event QR and finishing
 * the Microsoft sign-in, which can take longer than the QR's 1–2 minute lifetime.
 *
 * It is issued only after a valid QR token is presented, lives in an httpOnly cookie on that
 * browser (so it can't be forwarded as a link), and expires after 15 minutes.
 */
export const GRANT_COOKIE = "up_checkin";
export const GRANT_TTL_MS = 15 * 60_000;

export type Grant = { eventId: string; exp: number };

function key(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(`grant.${payload}`).digest("base64url");
}

export function issueGrant(eventId: string, nowMs: number): string {
  const payload = Buffer.from(JSON.stringify({ eventId, exp: nowMs + GRANT_TTL_MS } satisfies Grant)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readGrant(value: string | undefined, nowMs: number): Grant | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const g = JSON.parse(Buffer.from(payload, "base64url").toString()) as Grant;
    if (typeof g.eventId !== "string" || typeof g.exp !== "number" || g.exp < nowMs) return null;
    return g;
  } catch {
    return null;
  }
}
