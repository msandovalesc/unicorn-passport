import type { Metadata } from "next";
import Link from "next/link";
import { CardScanner } from "@/components/admin/CardScanner";
import { LocalTime } from "@/components/LocalTime";
import { UnicornOutline } from "@/components/UnicornOutline";
import { db } from "@/lib/db";
import { markRedeemed, undoRedeemed } from "../actions";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const [pending, recent, byItem] = await Promise.all([
    db.reward.findMany({
      where: { redeemedAt: null },
      orderBy: { unlockedAt: "asc" },
      include: { employee: { select: { id: true, name: true, email: true, location: true, track: { select: { name: true } } } } },
    }),
    db.reward.findMany({
      where: { redeemedAt: { not: null } },
      orderBy: { redeemedAt: "desc" },
      take: 20,
      include: { employee: { select: { id: true, name: true } }, redeemedBy: { select: { name: true } } },
    }),
    db.reward.groupBy({ by: ["item"], where: { redeemedAt: null }, _count: { _all: true }, orderBy: { _count: { item: "desc" } } }),
  ]);

  return (
    <div className="stack-lg">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 32 }}>
          <strong>Rewards</strong>
        </h1>
        <div className="row">
          <a href="/api/admin/reports/redemptions" className="btn btn-ghost">
            Download CSV
          </a>
          <CardScanner />
        </div>
      </div>

      {byItem.length > 0 && (
        <section className="panel stack-sm">
          <p className="eyebrow">Merch to prepare</p>
          <div className="row" style={{ gap: 24 }}>
            {byItem.map((i) => (
              <div key={i.item}>
                <div className="metric-value" style={{ fontSize: 24 }}>
                  {i._count._all}
                </div>
                <div className="small">{i.item}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel" style={{ padding: 0 }}>
        <p className="eyebrow" style={{ padding: "16px 16px 0" }}>
          Waiting to be handed out · {pending.length}
        </p>
        {pending.length === 0 ? (
          <div className="empty-state">
            <UnicornOutline size={64} color="var(--blue-300)" />
            <p className="muted">All rewards have been handed out.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Reward</th>
                  <th>Unlocked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/employees/${r.employee.id}`}>
                        <strong>{r.employee.name}</strong>
                      </Link>
                      <div className="small muted">
                        {r.employee.location ?? r.employee.email} · {r.employee.track?.name ?? "–"}
                      </div>
                    </td>
                    <td>
                      {r.item}
                      <div className="small muted">
                        Card #{r.cardNumber}, {r.tier} stamps
                      </div>
                    </td>
                    <td className="small">
                      <LocalTime iso={r.unlockedAt.toISOString()} withDate />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form action={markRedeemed}>
                        <input type="hidden" name="rewardId" value={r.id} />
                        <input type="hidden" name="returnTo" value="/admin/rewards" />
                        <button className="btn btn-primary btn-sm" type="submit">
                          Mark redeemed
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ padding: 0 }}>
        <p className="eyebrow" style={{ padding: "16px 16px 0" }}>
          Recently handed out
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/employees/${r.employee.id}`}>{r.employee.name}</Link>
                  </td>
                  <td>{r.item}</td>
                  <td className="small muted">
                    <LocalTime iso={r.redeemedAt!.toISOString()} withDate /> by {r.redeemedBy?.name ?? "admin"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <form action={undoRedeemed}>
                      <input type="hidden" name="rewardId" value={r.id} />
                      <input type="hidden" name="returnTo" value="/admin/rewards" />
                      <button className="btn-link small" type="submit">
                        Undo
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
