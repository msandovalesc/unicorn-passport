import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { toCsv } from "@/lib/admin/csv";

describe("CSV export", () => {
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    const csv = toCsv(["Name"], [["María"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe("Name\r\nMaría\r\n");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a"], [['He said "hi", then left\nlater']]).slice(1)).toBe('a\r\n"He said ""hi"", then left\nlater"\r\n');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(toCsv(["a"], [["=HYPERLINK(\"x\")"], ["+1"], ["@SUM(A1)"]]).slice(1)).toBe("a\r\n\"'=HYPERLINK(\"\"x\"\")\"\r\n'+1\r\n'@SUM(A1)\r\n");
  });

  it("formats dates as ISO and blanks null", () => {
    expect(toCsv(["d", "n"], [[new Date("2026-10-04T12:00:00Z"), null]]).slice(1)).toBe("d,n\r\n2026-10-04T12:00:00.000Z,\r\n");
  });
});

const dbReady = process.env.__TEST_DB_OK === "1";
(dbReady ? describe : describe.skip)("dashboard stats (database)", async () => {
  const { db } = await import("@/lib/db");
  const { weeklyAttendance, dashboardMetrics } = await import("@/lib/admin/stats");
  // Wednesday 2026-10-07 12:00 UTC; its week starts Monday 2026-10-05.
  const NOW = new Date("2026-10-07T12:00:00Z");

  beforeEach(async () => {
    await db.reward.deleteMany();
    await db.stamp.deleteMany();
    await db.event.deleteMany();
    await db.pass.deleteMany();
    await db.employee.deleteMany();
    await db.rewardTier.deleteMany();
    await db.rewardTrack.deleteMany();
  });

  it("buckets check-ins by week and event type, zero-filling empty weeks", async () => {
    const track = await db.rewardTrack.create({ data: { slug: "t", name: "T" } });
    const a = await db.employee.create({ data: { m365ObjectId: "a", name: "A", email: "a@unosquare.com", trackId: track.id } });
    const b = await db.employee.create({ data: { m365ObjectId: "b", name: "B", email: "b@unosquare.com", trackId: track.id } });
    const mk = (type: "in_person" | "virtual", at: string) =>
      db.event.create({
        data: { name: `E ${at}`, type, startsAt: new Date(at), endsAt: new Date(at), checkinOpensAt: new Date(at), checkinClosesAt: new Date(at), qrSecret: randomBytes(8).toString("hex"), createdById: a.id },
      });
    const thisWeekIp = await mk("in_person", "2026-10-06T17:00:00Z");
    const thisWeekV = await mk("virtual", "2026-10-07T09:00:00Z");
    const lastWeek = await mk("virtual", "2026-09-30T17:00:00Z");
    const tooOld = await mk("in_person", "2026-06-01T17:00:00Z");
    for (const [emp, ev] of [[a, thisWeekIp], [b, thisWeekIp], [a, thisWeekV], [a, lastWeek], [a, tooOld]] as const) {
      await db.stamp.create({ data: { employeeId: emp.id, eventId: ev.id, method: "qr", createdAt: ev.startsAt } });
    }

    const weeks = await weeklyAttendance(4, NOW);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(weeks.at(-1)).toMatchObject({ inPerson: 2, virtual: 1 });
    expect(weeks.at(-2)).toMatchObject({ inPerson: 0, virtual: 1 });
    expect(weeks[0]).toMatchObject({ inPerson: 0, virtual: 0 });

    const m = await dashboardMetrics(NOW);
    expect(m.enrolled).toBe(2);
    expect(m.stamps30).toBe(4);
  });
});
