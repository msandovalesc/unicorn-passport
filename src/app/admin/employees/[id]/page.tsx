import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { StampGrid } from "@/components/StampGrid";
import { getCardState } from "@/lib/card";
import { db } from "@/lib/db";
import { addManualStamp, markRedeemed, setEmployeeTrack, undoRedeemed } from "../../actions";

export const metadata: Metadata = { title: "Employee" };

const METHOD_LABEL = { qr: "QR scan", code: "Typed code", manual: "Manual" } as const;

/** Employee record. Also where the merch owner lands after scanning a card QR (/r/<token>). */
export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stamped?: string; saved?: string; scanned?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      passes: { select: { platform: true, createdAt: true, updatedAt: true, _count: { select: { registrations: true } } } },
      stamps: { orderBy: { createdAt: "desc" }, include: { event: { select: { id: true, name: true, type: true } }, addedBy: { select: { name: true } } } },
      rewards: { orderBy: [{ redeemedAt: { sort: "asc", nulls: "first" } }, { unlockedAt: "desc" }], include: { redeemedBy: { select: { name: true } } } },
    },
  });
  if (!employee) notFound();

  const [{ progress }, tracks, recentEvents] = await Promise.all([
    getCardState(employee.id),
    db.rewardTrack.findMany({ orderBy: { sortOrder: "asc" } }),
    db.event.findMany({
      where: { startsAt: { lte: new Date() }, stamps: { none: { employeeId: employee.id } } },
      orderBy: { startsAt: "desc" },
      take: 15,
      select: { id: true, name: true, startsAt: true },
    }),
  ]);
  const pending = employee.rewards.filter((r) => !r.redeemedAt);
  const returnTo = `/admin/employees/${employee.id}`;
  const wallets = employee.passes.filter((p) => p.platform !== "web");

  return (
    <div className="stack-lg">
      <Link href="/admin/employees" className="small">
        ← Employees
      </Link>

      {sp.scanned && <p className="note">Card scanned. {pending.length ? "Hand out the reward below and mark it redeemed." : "No rewards waiting for this person."}</p>}

      <header className="stack-sm">
        <h1 style={{ fontSize: 32 }}>
          <strong>{employee.name}</strong>
        </h1>
        <p className="muted small">
          {employee.email} · {employee.location ?? "No location"} · Joined <LocalTime iso={employee.createdAt.toISOString()} withDate />
        </p>
      </header>

      <div className="grid-2">
        <section className="panel stack-sm">
          <p className="eyebrow">Card</p>
          <div className="mini-card">
            <StampGrid stamps={progress.stampsOnCard} variant="onBlue" />
          </div>
          <p>
            <strong>
              Card #{progress.cardNumber} · {progress.stampsOnCard} of 10
            </strong>{" "}
            <span className="muted small">({progress.totalStamps} stamps all-time)</span>
          </p>
          <p className="small muted">{progress.nextReward ? `Next: ${progress.nextReward.item} in ${progress.nextReward.stampsToGo}` : "No tiers on this track"}</p>
          <p className="small">
            Wallet:{" "}
            {wallets.length === 0
              ? "web card only"
              : wallets.map((w) => `${w.platform === "apple" ? "Apple" : "Google"}${w.platform === "apple" ? ` (${w._count.registrations} device${w._count.registrations === 1 ? "" : "s"})` : ""}`).join(", ")}
          </p>
          <form action={setEmployeeTrack} className="row" style={{ flexWrap: "nowrap" }}>
            <input type="hidden" name="employeeId" value={employee.id} />
            <select className="input input-sm" name="trackId" defaultValue={employee.trackId ?? ""} aria-label="Reward track" style={{ marginTop: 0 }}>
              {!employee.trackId && <option value="">Not enrolled</option>}
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} track
                </option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" type="submit">
              Change track
            </button>
          </form>
          {sp.saved === "track" && <p className="note">Track updated.</p>}
        </section>

        <section className="panel stack-sm">
          <p className="eyebrow">Rewards</p>
          {employee.rewards.length === 0 ? (
            <p className="muted">No rewards unlocked yet.</p>
          ) : (
            <ul className="reward-list">
              {employee.rewards.map((r) => (
                <li key={r.id} style={{ alignItems: "center" }}>
                  <span>
                    <strong>{r.item}</strong>
                    <span className="small muted" style={{ display: "block" }}>
                      Card #{r.cardNumber}, {r.tier} stamps · unlocked <LocalTime iso={r.unlockedAt.toISOString()} withDate />
                      {r.redeemedAt && (
                        <>
                          {" "}
                          · handed out <LocalTime iso={r.redeemedAt.toISOString()} withDate /> by {r.redeemedBy?.name ?? "admin"}
                        </>
                      )}
                    </span>
                  </span>
                  <form action={r.redeemedAt ? undoRedeemed : markRedeemed}>
                    <input type="hidden" name="rewardId" value={r.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    {r.redeemedAt ? (
                      <button className="btn-link small" type="submit">
                        Undo
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" type="submit">
                        Mark redeemed
                      </button>
                    )}
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid-2 grid-2-wide">
        <section className="panel" style={{ padding: 0 }}>
          <p className="eyebrow" style={{ padding: "16px 16px 0" }}>
            Stamps
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>When</th>
                  <th>How</th>
                </tr>
              </thead>
              <tbody>
                {employee.stamps.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/events/${s.event.id}`}>{s.event.name}</Link>
                    </td>
                    <td className="small">
                      <LocalTime iso={s.createdAt.toISOString()} withDate />
                    </td>
                    <td className="small">
                      {METHOD_LABEL[s.method]}
                      {s.method === "manual" && <span className="muted"> by {s.addedBy?.name ?? "admin"}</span>}
                    </td>
                  </tr>
                ))}
                {employee.stamps.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No stamps yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel stack-sm">
          <p className="eyebrow">Add a stamp manually</p>
          {sp.stamped && <p className={sp.stamped === "ok" ? "note" : "alert"}>{sp.stamped === "ok" ? "Stamp added." : "They already had that stamp."}</p>}
          {recentEvents.length === 0 ? (
            <p className="muted small">They have a stamp for every past event.</p>
          ) : (
            <form action={addManualStamp} className="stack-sm">
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <select className="input" name="eventId" required aria-label="Event">
                {recentEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.startsAt.toISOString().slice(0, 10)})
                  </option>
                ))}
              </select>
              <input className="input" name="note" placeholder="Note (optional), e.g. forgot phone" maxLength={200} aria-label="Note" />
              <button className="btn btn-primary" type="submit">
                Add stamp
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
