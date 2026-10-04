import { describe, expect, it } from "vitest";
import { issueGrant, readGrant, GRANT_TTL_MS } from "@/lib/checkin/grant";
import { checkinWindowState } from "@/lib/checkin/rules";
import { codeFor, codeMatches, makeToken, normalizeCode, parseToken, verifyToken, windowAt, WINDOW_MS } from "@/lib/checkin/token";

const EVENT = "2f1c7a8e-3b4d-4c5e-9f60-718293a4b5c6";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SECRET = "event-secret-1";
const T0 = Date.UTC(2026, 9, 3, 18, 0, 0); // start of a window

const check = (token: string, secret: string, now: number) => verifyToken(parseToken(token)!, secret, now);

describe("rotating QR token", () => {
  it("accepts the current window", () => {
    expect(check(makeToken(EVENT, SECRET, T0), SECRET, T0 + 5_000)).toBe("ok");
  });

  it("accepts the previous window (QR just rotated while scanning)", () => {
    const token = makeToken(EVENT, SECRET, T0);
    expect(check(token, SECRET, T0 + WINDOW_MS + 30_000)).toBe("ok");
  });

  it("rejects tokens two or more windows old", () => {
    const token = makeToken(EVENT, SECRET, T0);
    expect(check(token, SECRET, T0 + 2 * WINDOW_MS)).toBe("expired");
    expect(check(token, SECRET, T0 + 60 * WINDOW_MS)).toBe("expired");
  });

  it("rejects tokens from the future", () => {
    expect(check(makeToken(EVENT, SECRET, T0 + 5 * WINDOW_MS), SECRET, T0)).toBe("future");
  });

  it("rotates roughly every 60 seconds", () => {
    expect(makeToken(EVENT, SECRET, T0)).toBe(makeToken(EVENT, SECRET, T0 + WINDOW_MS - 1));
    expect(makeToken(EVENT, SECRET, T0)).not.toBe(makeToken(EVENT, SECRET, T0 + WINDOW_MS));
  });

  it("rejects a token signed with another event's secret", () => {
    expect(check(makeToken(EVENT, "other-secret", T0), SECRET, T0)).toBe("bad_signature");
  });

  it("rejects a token moved to another event", () => {
    const [, w, sig] = makeToken(EVENT, SECRET, T0).split(".");
    expect(check(`${OTHER}.${w}.${sig}`, SECRET, T0)).toBe("bad_signature");
  });

  it("rejects a token whose window was edited to look fresh", () => {
    const [id, , sig] = makeToken(EVENT, SECRET, T0).split(".");
    expect(check(`${id}.${windowAt(T0 + 10 * WINDOW_MS)}.${sig}`, SECRET, T0 + 10 * WINDOW_MS)).toBe("bad_signature");
  });

  it.each(["", "abc", "not-a-uuid.123.AAAAAAAAAAAAAAAA", `${EVENT}.12x.AAAAAAAAAAAAAAAA`, `${EVENT}.1.short`, `${EVENT}.1.AAAAAAAAAAAAAAAA.extra`])(
    "parses malformed token %j as null",
    (t) => expect(parseToken(t)).toBeNull(),
  );
});

describe("typed event code", () => {
  const code = codeFor(EVENT, SECRET, windowAt(T0));

  it("is 6 unambiguous characters", () => {
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it("accepts current and previous window, case- and space-insensitive", () => {
    expect(codeMatches(code, EVENT, SECRET, T0)).toBe(true);
    expect(codeMatches(code.toLowerCase().replace(/(...)/, "$1 "), EVENT, SECRET, T0 + WINDOW_MS)).toBe(true);
  });

  it("expires after the previous window", () => {
    expect(codeMatches(code, EVENT, SECRET, T0 + 2 * WINDOW_MS)).toBe(false);
  });

  it("is specific to the event and secret", () => {
    expect(codeMatches(code, OTHER, SECRET, T0)).toBe(false);
    expect(codeMatches(code, EVENT, "other", T0)).toBe(false);
  });

  it("normalizes input", () => {
    expect(normalizeCode(" k7m-2qx ")).toBe("K7M2QX");
  });
});

describe("check-in window", () => {
  const event = {
    checkinOpensAt: new Date("2026-10-03T17:30:00Z"),
    checkinClosesAt: new Date("2026-10-03T21:00:00Z"),
    closedAt: null as Date | null,
  };

  it.each([
    ["2026-10-03T17:29:59Z", "not_open"],
    ["2026-10-03T17:30:00Z", "open"],
    ["2026-10-03T19:00:00Z", "open"],
    ["2026-10-03T21:00:00Z", "open"],
    ["2026-10-03T21:00:01Z", "closed"],
  ])("at %s → %s", (at, state) => {
    expect(checkinWindowState(event, new Date(at))).toBe(state);
  });

  it("is closed once an admin closes the event early", () => {
    const closed = { ...event, closedAt: new Date("2026-10-03T18:00:00Z") };
    expect(checkinWindowState(closed, new Date("2026-10-03T17:59:59Z"))).toBe("open");
    expect(checkinWindowState(closed, new Date("2026-10-03T18:00:00Z"))).toBe("closed");
  });
});

describe("check-in grant (bridges the QR to sign-in)", () => {
  process.env.AUTH_SECRET ??= "test-secret";

  it("round-trips within 15 minutes", () => {
    const g = issueGrant(EVENT, T0);
    expect(readGrant(g, T0 + GRANT_TTL_MS - 1)).toMatchObject({ eventId: EVENT });
  });

  it("expires", () => {
    expect(readGrant(issueGrant(EVENT, T0), T0 + GRANT_TTL_MS + 1)).toBeNull();
  });

  it("rejects tampering", () => {
    const [payload, sig] = issueGrant(EVENT, T0).split(".");
    const forged = Buffer.from(JSON.stringify({ eventId: OTHER, exp: T0 + 1e9 })).toString("base64url");
    expect(readGrant(`${forged}.${sig}`, T0)).toBeNull();
    expect(readGrant(`${payload}.${sig.slice(0, -2)}xx`, T0)).toBeNull();
    expect(readGrant(undefined, T0)).toBeNull();
  });
});
