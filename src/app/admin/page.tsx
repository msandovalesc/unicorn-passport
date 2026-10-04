import type { Metadata } from "next";
import Link from "next/link";
import { AttendanceTrend } from "@/components/admin/AttendanceTrend";
import { LocalTime } from "@/components/LocalTime";
import { UnicornOutline } from "@/components/UnicornOutline";
import { dashboardMetrics, recentEventAttendance, weeklyAttendance } from "@/lib/admin/stats";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview() {
  const now = new Date();
  const [m, weeks, recent, live, upcoming] = await Promise.all([
    dashboardMetrics(now),
    weeklyAttendance(12, now),
    recentEventAttendance(10, now),
    db.event.findMany({
      where: { closedAt: null, checkinOpensAt: { lte: now }, checkinClosesAt: { gte: now } },
      include: { _count: { select: { stamps: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.event.findMany({ where: { startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 5 }),
  ]);

  const delta = m.stampsPrev30 ? Math.round(((m.stamps30 - m.stampsPrev30) / m.stampsPrev30) * 100) : null;
  const maxRecent = Math.max(1, ...recent.map((r) => r.count));

  return (
    <div className="stack-lg">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 32 }}>
          <strong>Overview</strong>
        </h1>
        <Link href="/admin/events/new" className="btn btn-primary">
          + New event
        </Link>
      </div>

      <section className="metrics" aria-label="Key numbers">
        <Metric label="Cards issued" value={m.enrolled} />
        <Metric label="Wallet passes" value={m.walletPasses} sub={`${m.apple} Apple · ${m.google} Google`} />
        <Metric label="Active cards (90 days)" value={m.active90} sub={m.enrolled ? `${Math.round((m.active90 / m.enrolled) * 100)}% of cards` : undefined} />
        <Metric
          label="Check-ins (30 days)"
          value={m.stamps30}
          sub={delta === null ? undefined : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs previous 30 days`}
        />
        <Metric label="Avg. attendance per event" value={m.avgAttendance} sub="last 90 days" />
        <Metric label="Rewards to hand out" value={m.pending} sub={`${m.redeemed} redeemed`} href="/admin/rewards" />
      </section>

      <section className="panel">
        <AttendanceTrend data={weeks} />
      </section>

      <div className="grid-2">
        <section className="panel stack-sm">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p className="eyebrow">Attendance by event</p>
            <Link href="/admin/events" className="small">
              All events
            </Link>
          </div>
          <ul className="barlist">
            {recent.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="barlist-label">
                  <span>{e.name}</span>
                  <span className="muted small">
                    <LocalTime iso={e.startsAt.toISOString()} withDate /> · {e.type === "virtual" ? "Virtual" : "In person"}
                  </span>
                </Link>
                <div className="barlist-track" aria-hidden>
                  <div className="barlist-bar" style={{ width: `${(e.count / maxRecent) * 100}%` }} />
                </div>
                <span className="barlist-value">{e.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="stack">
          <section className="panel stack-sm">
            <p className="eyebrow">Check-in open now</p>
            {live.length === 0 ? (
              <div className="empty-state">
                <UnicornOutline size={64} color="var(--blue-300)" />
                <p className="muted">No events are open for check-in right now.</p>
              </div>
            ) : (
              <ul className="reward-list">
                {live.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/events/${e.id}`}>
                      <strong>{e.name}</strong>
                    </Link>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="badge">{e._count.stamps} in</span>
                      <Link href={`/admin/events/${e.id}/present`} className="small">
                        Show QR
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel stack-sm">
            <p className="eyebrow">Coming up</p>
            {upcoming.length === 0 ? (
              <p className="muted">
                Nothing scheduled. <Link href="/admin/events/new">Create an event</Link>
              </p>
            ) : (
              <ul className="reward-list">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/events/${e.id}`}>{e.name}</Link>
                    <span className="muted small">
                      <LocalTime iso={e.startsAt.toISOString()} withDate />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, href }: { label: string; value: number; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="metric-value">{value.toLocaleString()}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="small muted" style={{ marginTop: 4 }}>{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="panel metric-link">
      {body}
    </Link>
  ) : (
    <div className="panel">{body}</div>
  );
}
