import type { Metadata } from "next";
import { db } from "@/lib/db";
import { deleteTier, saveTier, saveTrack } from "../actions";

export const metadata: Metadata = { title: "Reward tiers" };

const COUNTS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Reward tracks (e.g. Office / Remote) and their tiers. Editable without a deploy. */
export default async function TiersPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const sp = await searchParams;
  const tracks = await db.rewardTrack.findMany({
    orderBy: { sortOrder: "asc" },
    include: { tiers: { orderBy: { stampCount: "asc" } }, _count: { select: { employees: true } } },
  });

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 style={{ fontSize: 32 }}>
          <strong>Reward tiers</strong>
        </h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Each card has 10 stamps. Pick the stamps that unlock merch on each track, so Remote can earn prizes with fewer events, for example.
          Changes apply to stamps from now on. Rewards already unlocked keep their item.
        </p>
      </div>

      {sp.error && <p className="alert">{sp.error}</p>}
      {sp.saved && <p className="note">Saved. Cards on that track update automatically.</p>}

      <div className="grid-2">
        {tracks.map((t) => (
          <section key={t.id} className="panel stack">
            <form action={saveTrack} className="stack-sm">
              <input type="hidden" name="id" value={t.id} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <p className="eyebrow">
                  {t.name} track · {t._count.employees} people
                </p>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input className="input input-sm" name="name" defaultValue={t.name} aria-label="Track name" maxLength={40} required style={{ marginTop: 0, maxWidth: 140 }} />
                <input className="input input-sm" name="description" defaultValue={t.description ?? ""} aria-label="Shown at sign-up" placeholder="Shown at sign-up" maxLength={120} style={{ marginTop: 0 }} />
                <button className="btn btn-ghost btn-sm" type="submit">
                  Rename
                </button>
              </div>
            </form>

            <StampRuler tiers={t.tiers.filter((x) => x.active).map((x) => x.stampCount)} />

            <div className="stack-sm">
              {t.tiers.map((tier) => (
                <div key={tier.id} className="tier-row">
                  <form action={saveTier} className="tier-form">
                    <input type="hidden" name="id" value={tier.id} />
                    <input type="hidden" name="trackId" value={t.id} />
                    <select className="input input-sm" name="stampCount" defaultValue={tier.stampCount} aria-label="Stamps needed">
                      {COUNTS.map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "stamp" : "stamps"}
                        </option>
                      ))}
                    </select>
                    <input className="input input-sm" name="item" defaultValue={tier.item} required maxLength={120} aria-label="Reward" />
                    <label className="small checkbox">
                      <input type="checkbox" name="active" defaultChecked={tier.active} /> Active
                    </label>
                    <button className="btn btn-ghost btn-sm" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteTier}>
                    <input type="hidden" name="id" value={tier.id} />
                    <button className="btn-link small btn-danger-link" type="submit" aria-label={`Delete ${tier.item}`}>
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <form action={saveTier} className="tier-form tier-new">
              <input type="hidden" name="trackId" value={t.id} />
              <input type="hidden" name="active" value="on" />
              <select className="input input-sm" name="stampCount" defaultValue={3} aria-label="Stamps needed">
                {COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "stamp" : "stamps"}
                  </option>
                ))}
              </select>
              <input className="input input-sm" name="item" placeholder="New reward, e.g. Unicorn mug" required maxLength={120} aria-label="New reward" />
              <button className="btn btn-primary btn-sm" type="submit">
                Add tier
              </button>
            </form>
          </section>
        ))}

        <section className="panel stack-sm">
          <p className="eyebrow">New track</p>
          <p className="small muted">Employees pick their track when they sign up. Admins can move people between tracks from their employee page.</p>
          <form action={saveTrack} className="stack-sm">
            <input className="input" name="name" placeholder="e.g. Hybrid" required maxLength={40} aria-label="Track name" />
            <input className="input" name="description" placeholder="Shown at sign-up, e.g. I join both ways" maxLength={120} aria-label="Description" />
            <button className="btn btn-ghost" type="submit">
              Create track
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

/** 1..10 ruler showing where rewards unlock on the card. */
function StampRuler({ tiers }: { tiers: number[] }) {
  return (
    <ol className="ruler" aria-label={`Rewards at ${tiers.join(", ") || "no"} stamps`}>
      {COUNTS.map((n) => (
        <li key={n} className={tiers.includes(n) ? "is-reward" : undefined}>
          {n}
        </li>
      ))}
    </ol>
  );
}
