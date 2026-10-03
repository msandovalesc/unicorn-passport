import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview() {
  const since = new Date(Date.now() - 90 * 24 * 3600_000);
  const [enrolled, walletPasses, stamps, activeCards, pending, redeemed, liveEvents] = await Promise.all([
    db.employee.count({ where: { trackId: { not: null } } }),
    db.pass.count({ where: { platform: { in: ["apple", "google"] } } }),
    db.stamp.count(),
    db.stamp.groupBy({ by: ["employeeId"], where: { createdAt: { gte: since } } }).then((r) => r.length),
    db.reward.count({ where: { redeemedAt: null } }),
    db.reward.count({ where: { redeemedAt: { not: null } } }),
    db.event.findMany({
      where: { closedAt: null, checkinOpensAt: { lte: new Date() }, checkinClosesAt: { gte: new Date() } },
      include: { _count: { select: { stamps: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const metrics = [
    ["Cards issued", enrolled],
    ["Wallet passes", walletPasses],
    ["Active cards (90 days)", activeCards],
    ["Stamps given", stamps],
    ["Rewards pending", pending],
    ["Rewards redeemed", redeemed],
  ] as const;

  return (
    <div className="stack-lg">
      <h1 style={{ fontSize: 32 }}>
        <strong>Overview</strong>
      </h1>
      <section className="metrics">
        {metrics.map(([label, value]) => (
          <div key={label} className="panel">
            <div className="metric-value">{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </section>
      <section className="panel stack-sm">
        <p className="eyebrow">Check-in open now</p>
        {liveEvents.length === 0 ? (
          <p className="muted">No events are open for check-in right now.</p>
        ) : (
          <ul className="reward-list">
            {liveEvents.map((e) => (
              <li key={e.id}>
                <span>
                  <strong>{e.name}</strong> <span className="muted small">{e.type === "virtual" ? "Virtual" : "In person"}</span>
                </span>
                <span className="badge">{e._count.stamps} checked in</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="note">Events, attendance, rewards, tiers and reports pages arrive in milestones 2–5.</p>
    </div>
  );
}
