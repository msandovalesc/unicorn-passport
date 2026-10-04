import { db } from "@/lib/db";

const DAY = 24 * 3600_000;

export type WeekPoint = { weekStart: string; inPerson: number; virtual: number };

/** Stamps per week (Monday start, UTC) split by event type, for the last `weeks` weeks, zero-filled. */
export async function weeklyAttendance(weeks = 12, now = new Date()): Promise<WeekPoint[]> {
  const rows = await db.$queryRaw<{ week: Date; type: "in_person" | "virtual"; n: bigint }[]>`
    SELECT date_trunc('week', s.created_at) AS week, e.type::text AS type, count(*) AS n
    FROM stamps s JOIN events e ON e.id = s.event_id
    WHERE s.created_at >= date_trunc('week', ${now}::timestamp) - make_interval(weeks => ${weeks - 1}::int)
    GROUP BY 1, 2`;

  const monday = (d: Date) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x;
  };
  const first = monday(new Date(now.getTime() - (weeks - 1) * 7 * DAY));
  const points: WeekPoint[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(first.getTime() + i * 7 * DAY).toISOString().slice(0, 10),
    inPerson: 0,
    virtual: 0,
  }));
  for (const r of rows) {
    const key = monday(new Date(r.week)).toISOString().slice(0, 10);
    const p = points.find((x) => x.weekStart === key);
    if (!p) continue;
    if (r.type === "virtual") p.virtual += Number(r.n);
    else p.inPerson += Number(r.n);
  }
  return points;
}

export async function dashboardMetrics(now = new Date()) {
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);
  const d90 = new Date(now.getTime() - 90 * DAY);

  const [enrolled, apple, google, active90, stamps30, stampsPrev30, pending, redeemed, pastEvents, pastStamps] = await Promise.all([
    db.employee.count({ where: { trackId: { not: null } } }),
    db.pass.count({ where: { platform: "apple" } }),
    db.pass.count({ where: { platform: "google" } }),
    db.stamp.groupBy({ by: ["employeeId"], where: { createdAt: { gte: d90 } } }).then((r) => r.length),
    db.stamp.count({ where: { createdAt: { gte: d30 } } }),
    db.stamp.count({ where: { createdAt: { gte: d60, lt: d30 } } }),
    db.reward.count({ where: { redeemedAt: null } }),
    db.reward.count({ where: { redeemedAt: { not: null } } }),
    db.event.count({ where: { startsAt: { lt: now, gte: d90 } } }),
    db.stamp.count({ where: { event: { startsAt: { lt: now, gte: d90 } } } }),
  ]);

  return {
    enrolled,
    walletPasses: apple + google,
    apple,
    google,
    active90,
    stamps30,
    stampsPrev30,
    pending,
    redeemed,
    avgAttendance: pastEvents ? Math.round(pastStamps / pastEvents) : 0,
  };
}

/** Attendance for recent past and live events, newest first. */
export async function recentEventAttendance(limit = 10, now = new Date()) {
  const events = await db.event.findMany({
    where: { startsAt: { lte: now } },
    orderBy: { startsAt: "desc" },
    take: limit,
    select: { id: true, name: true, type: true, startsAt: true, _count: { select: { stamps: true } } },
  });
  return events.map((e) => ({ id: e.id, name: e.name, type: e.type, startsAt: e.startsAt, count: e._count.stamps }));
}
