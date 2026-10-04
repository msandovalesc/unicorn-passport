import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Rotating event QR tokens.
 *
 * token = `<eventId>.<window>.<sig>`, where window = floor(now / 60s) and
 * sig = HMAC-SHA256(event.qr_secret, "<eventId>.<window>") truncated to 96 bits.
 * Only the current and the previous window are accepted, so a photo of the QR
 * stops working within ~1–2 minutes.
 */
export const WINDOW_MS = 60_000;

/** Typed codes avoid look-alike characters (0/O, 1/I/L). */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

export type ParsedToken = { eventId: string; window: number; sig: string };
export type TokenCheck = "ok" | "expired" | "future" | "bad_signature";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function windowAt(nowMs: number): number {
  return Math.floor(nowMs / WINDOW_MS);
}

/** When the given window stops being "current". */
export function windowEndsAt(window: number): number {
  return (window + 1) * WINDOW_MS;
}

function hmac(secret: string, message: string): Buffer {
  return createHmac("sha256", secret).update(message).digest();
}

function signature(eventId: string, window: number, secret: string): string {
  return hmac(secret, `${eventId}.${window}`).subarray(0, 12).toString("base64url");
}

export function makeToken(eventId: string, secret: string, nowMs: number): string {
  const w = windowAt(nowMs);
  return `${eventId}.${w}.${signature(eventId, w, secret)}`;
}

/** Structural parse only; does not prove anything until verifyToken. */
export function parseToken(token: string): ParsedToken | null {
  if (typeof token !== "string" || token.length > 120) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [eventId, w, sig] = parts;
  if (!UUID.test(eventId) || !/^\d{1,12}$/.test(w) || !/^[A-Za-z0-9_-]{16}$/.test(sig)) return null;
  return { eventId: eventId.toLowerCase(), window: Number(w), sig };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Signature first (so a forged token never reads as merely "expired"), then the window. */
export function verifyToken(t: ParsedToken, secret: string, nowMs: number): TokenCheck {
  if (!safeEqual(t.sig, signature(t.eventId, t.window, secret))) return "bad_signature";
  const current = windowAt(nowMs);
  if (t.window > current) return "future";
  if (t.window < current - 1) return "expired";
  return "ok";
}

/** Short code for single-device users at virtual events. Rotates with the QR. */
export function codeFor(eventId: string, secret: string, window: number): string {
  const bytes = hmac(secret, `code.${eventId}.${window}`);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function normalizeCode(input: string): string {
  return (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True if `input` matches the code for the current or previous window. */
export function codeMatches(input: string, eventId: string, secret: string, nowMs: number): boolean {
  const code = normalizeCode(input);
  if (code.length !== CODE_LENGTH) return false;
  const w = windowAt(nowMs);
  // Evaluate both without short-circuiting to keep timing uniform.
  const current = safeEqual(code, codeFor(eventId, secret, w));
  const previous = safeEqual(code, codeFor(eventId, secret, w - 1));
  return current || previous;
}
