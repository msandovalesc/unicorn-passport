/**
 * End-to-end check-in rules against a real Postgres (the unique key, transactions and advisory
 * locks are database behaviour, so they're tested on the database).
 * Uses TEST_DATABASE_URL; skipped with a notice if it isn't reachable.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { codeFor, makeToken, windowAt, WINDOW_MS } from "@/lib/checkin/token";

const dbReady = Boolean(process.env.TEST_DATABASE_URL) && process.env.__TEST_DB_OK === "1";
const d = dbReady ? describe : describe.skip;
if (!dbReady) console.warn("[tests] TEST_DATABASE_URL not reachable: skipping check-in DB tests (run `npm run db:local`).");

// Fixed clock: events are placed around NOW and every call passes `now` explicitly.
const NOW = new Date(Date.UTC(2026, 9, 3, 18, 0, 30));
const min = (m: number) => new Date(NOW.getTime() + m * 60_000);
const secret = () => randomBytes(16).toString("hex");

d("check-in service (database)", async () => {
  const { db } = await import("@/lib/db");
  const svc = await import("@/lib/checkin/service");

  let employeeId: string;
  let adminId: string;

  async function event(overrides: Partial<{ type: "in_person" | "virtual"; opens: Date; closes: Date; closedAt: Date | null }> = {}) {
    return db.event.create({
      data: {
        name: `Event ${randomBytes(3).toString("hex")}`,
        type: overrides.type ?? "in_person",
        startsAt: min(0),
        endsAt: min(60),
        checkinOpensAt: overrides.opens ?? min(-30),
        checkinClosesAt: overrides.closes ?? min(90),
        closedAt: overrides.closedAt ?? null,
        qrSecret: secret(),
        createdById: adminId,
      },
    });
  }
  const stampCount = () => db.stamp.count({ where: { employeeId } });

  beforeAll(async () => {
    await db.$connect();
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.reward.deleteMany();
    await db.stamp.deleteMany();
    await db.event.deleteMany();
    await db.pass.deleteMany();
    await db.employee.deleteMany();
    await db.rewardTier.deleteMany();
    await db.rewardTrack.deleteMany();
    await db.rateLimit.deleteMany();

    const track = await db.rewardTrack.create({
      data: { slug: "office", name: "Office", tiers: { create: [{ stampCount: 5, item: "Mug" }, { stampCount: 10, item: "Hoodie" }] } },
    });
    adminId = (await db.employee.create({ data: { m365ObjectId: "admin", name: "Admin", email: "admin@unosquare.com", trackId: track.id } })).id;
    employeeId = (await db.employee.create({ data: { m365ObjectId: "emp", name: "Emp", email: "emp@unosquare.com", trackId: track.id } })).id;
  });

  describe("rotating token", () => {
    it("stamps with the current token", async () => {
      const e = await event();
      const r = await svc.checkInWithToken(employeeId, makeToken(e.id, e.qrSecret, NOW.getTime()), NOW);
      expect(r.status).toBe("ok");
      expect(await stampCount()).toBe(1);
      const s = await db.stamp.findFirstOrThrow({ where: { employeeId } });
      expect(s.method).toBe("qr");
    });

    it("stamps with the previous token", async () => {
      const e = await event();
      const r = await svc.checkInWithToken(employeeId, makeToken(e.id, e.qrSecret, NOW.getTime() - WINDOW_MS), NOW);
      expect(r.status).toBe("ok");
    });

    it("rejects an older token and saves nothing", async () => {
      const e = await event();
      const r = await svc.checkInWithToken(employeeId, makeToken(e.id, e.qrSecret, NOW.getTime() - 2 * WINDOW_MS), NOW);
      expect(r.status).toBe("expired");
      expect(await stampCount()).toBe(0);
    });

    it("rejects a forged token", async () => {
      const e = await event();
      const r = await svc.checkInWithToken(employeeId, makeToken(e.id, "wrong-secret", NOW.getTime()), NOW);
      expect(r.status).toBe("invalid");
      expect(await stampCount()).toBe(0);
    });

    it("rejects a token for an unknown event", async () => {
      const r = await svc.checkInWithToken(employeeId, makeToken("00000000-0000-4000-8000-000000000000", "x", NOW.getTime()), NOW);
      expect(r.status).toBe("invalid");
    });
  });

  describe("check-in window", () => {
    it("refuses before check-in opens", async () => {
      const e = await event({ opens: min(5), closes: min(90) });
      expect((await svc.checkInWithToken(employeeId, makeToken(e.id, e.qrSecret, NOW.getTime()), NOW)).status).toBe("not_open");
      expect(await stampCount()).toBe(0);
    });

    it("refuses after check-in closes", async () => {
      const e = await event({ opens: min(-120), closes: min(-1) });
      expect((await svc.checkInWithToken(employeeId, makeToken(e.id, e.qrSecret, NOW.getTime()), NOW)).status).toBe("closed");
    });

    it("refuses once an admin closed the event early", async () => {
      const e = await event({ closedAt: min(-1) });
      expect((await svc.checkInWithToken(employeeId, makeToken(e.id, e.qrSecret, NOW.getTime()), NOW)).status).toBe("closed");
    });

    it("re-checks the window when a grant is redeemed later", async () => {
      const e = await event({ closes: min(2) });
      // Scanned in time, but finished signing in after check-in closed.
      expect((await svc.checkInToEvent(employeeId, e.id, "qr", min(3))).status).toBe("closed");
    });
  });

  describe("one stamp per employee per event", () => {
    it("returns 'already' on a second scan", async () => {
      const e = await event();
      const token = makeToken(e.id, e.qrSecret, NOW.getTime());
      expect((await svc.checkInWithToken(employeeId, token, NOW)).status).toBe("ok");
      expect((await svc.checkInWithToken(employeeId, token, NOW)).status).toBe("already");
      expect(await stampCount()).toBe(1);
    });

    it("holds under simultaneous scans", async () => {
      const e = await event();
      const token = makeToken(e.id, e.qrSecret, NOW.getTime());
      const results = await Promise.all(Array.from({ length: 8 }, () => svc.checkInWithToken(employeeId, token, NOW)));
      expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
      expect(results.filter((r) => r.status === "already")).toHaveLength(7);
      expect(await stampCount()).toBe(1);
    });

    it("lets different employees stamp the same event", async () => {
      const e = await event();
      const other = await db.employee.create({ data: { m365ObjectId: "o", name: "O", email: "o@unosquare.com", trackId: (await db.employee.findUniqueOrThrow({ where: { id: employeeId } })).trackId } });
      const token = makeToken(e.id, e.qrSecret, NOW.getTime());
      expect((await svc.checkInWithToken(employeeId, token, NOW)).status).toBe("ok");
      expect((await svc.checkInWithToken(other.id, token, NOW)).status).toBe("ok");
    });
  });

  describe("rewards", () => {
    async function stampN(n: number) {
      const results = [];
      for (let i = 0; i < n; i++) {
        const e = await event();
        results.push(await svc.checkInToEvent(employeeId, e.id, "qr", NOW));
      }
      return results;
    }

    it("unlocks tiers at 5 and 10, then again on card #2", async () => {
      const results = await stampN(15);
      expect(results[4].newRewards).toEqual(["Mug"]);
      expect(results[9].newRewards).toEqual(["Hoodie"]);
      expect(results[14].newRewards).toEqual(["Mug"]);
      const rewards = await db.reward.findMany({ where: { employeeId }, orderBy: [{ cardNumber: "asc" }, { tier: "asc" }] });
      expect(rewards.map((r) => [r.cardNumber, r.tier, r.item])).toEqual([
        [1, 5, "Mug"],
        [1, 10, "Hoodie"],
        [2, 5, "Mug"],
      ]);
    });

    it("never skips a tier when stamps for different events arrive at once", async () => {
      await stampN(3);
      const [a, b] = [await event(), await event()];
      await Promise.all([svc.checkInToEvent(employeeId, a.id, "qr", NOW), svc.checkInToEvent(employeeId, b.id, "qr", NOW)]);
      expect(await stampCount()).toBe(5);
      expect(await db.reward.count({ where: { employeeId, tier: 5 } })).toBe(1);
    });
  });

  describe("typed code (virtual events)", () => {
    it("stamps with the current code", async () => {
      const e = await event({ type: "virtual" });
      const r = await svc.checkInWithCode(employeeId, codeFor(e.id, e.qrSecret, windowAt(NOW.getTime())), NOW);
      expect(r).toMatchObject({ status: "ok", eventId: e.id });
      expect((await db.stamp.findFirstOrThrow({ where: { employeeId } })).method).toBe("code");
    });

    it("rejects a wrong or stale code", async () => {
      const e = await event({ type: "virtual" });
      expect((await svc.checkInWithCode(employeeId, "ZZZZZZ", NOW)).status).toBe("invalid");
      const stale = codeFor(e.id, e.qrSecret, windowAt(NOW.getTime()) - 2);
      expect((await svc.checkInWithCode(employeeId, stale, NOW)).status).toBe("invalid");
    });

    it("does not accept codes for in-person events", async () => {
      const e = await event({ type: "in_person" });
      expect((await svc.checkInWithCode(employeeId, codeFor(e.id, e.qrSecret, windowAt(NOW.getTime())), NOW)).status).toBe("invalid");
    });
  });

  it("requires enrollment", async () => {
    const e = await event();
    const newbie = await db.employee.create({ data: { m365ObjectId: "n", name: "N", email: "n@unosquare.com" } });
    expect((await svc.checkInToEvent(newbie.id, e.id, "qr", NOW)).status).toBe("not_enrolled");
  });

  it("records who added a manual stamp", async () => {
    const e = await event();
    await svc.recordStamp({ employeeId, eventId: e.id, method: "manual", addedById: adminId, note: "Forgot phone", now: NOW });
    expect(await db.stamp.findFirstOrThrow({ where: { employeeId } })).toMatchObject({ method: "manual", addedById: adminId, note: "Forgot phone" });
  });

  it("rate limits per key within a window", async () => {
    const { rateLimit } = await import("@/lib/rateLimit");
    const t = NOW.getTime();
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await rateLimit("t:key", 3, 60_000, t));
    expect(hits.map((h) => h.ok)).toEqual([true, true, true, false]);
    expect((await rateLimit("t:key", 3, 60_000, t + 60_000)).ok).toBe(true);
  });
});
