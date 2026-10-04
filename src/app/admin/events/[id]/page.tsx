import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { LocalTime } from "@/components/LocalTime";
import { UnicornOutline } from "@/components/UnicornOutline";
import { checkinWindowState } from "@/lib/checkin/rules";
import { db } from "@/lib/db";
import { addManualStamp, closeCheckin, deleteEvent, reopenCheckin } from "../../actions";

export const metadata: Metadata = { title: "Event" };

const STATE_LABEL = { open: "Check-in open", not_open: "Upcoming", closed: "Closed" } as const;
const METHOD_LABEL = { qr: "QR scan", code: "Typed code", manual: "Manual" } as const;
const STAMP_MESSAGES: Record<string, string> = {
  ok: "Stamp added.",
  already: "They already had a stamp for this event.",
};

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; stamped?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      stamps: {
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { id: true, name: true, email: true, location: true } }, addedBy: { select: { name: true } } },
      },
    },
  });
  if (!event) notFound();

  const state = checkinWindowState(event, new Date());
  const byMethod = { qr: 0, code: 0, manual: 0 };
  for (const s of event.stamps) byMethod[s.method]++;

  const q = sp.q?.trim();
  const stampedIds = new Set(event.stamps.map((s) => s.employeeId));
  const matches = q
    ? (
        await db.employee.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
          orderBy: { name: "asc" },
          take: 8,
          select: { id: true, name: true, email: true },
        })
      ).map((e) => ({ ...e, stamped: stampedIds.has(e.id) }))
    : [];
  const returnTo = `/admin/events/${event.id}`;

  return (
    <div className="stack-lg">
      {state === "open" && <AutoRefresh seconds={10} />}
      <Link href="/admin/events" className="small">
        ← Events
      </Link>

      <header className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>
            <span className={`badge badge-${state}`}>{STATE_LABEL[state]}</span>
            <span className="badge">{event.type === "virtual" ? "Virtual" : "In person"}</span>
          </div>
          <h1 style={{ fontSize: 32 }}>
            <strong>{event.name}</strong>
          </h1>
          <p className="muted small">
            {event.description && <>{event.description} · </>}
            <LocalTime iso={event.startsAt.toISOString()} withDate /> – <LocalTime iso={event.endsAt.toISOString()} />
            <br />
            Check-in <LocalTime iso={event.checkinOpensAt.toISOString()} withDate /> – <LocalTime iso={event.checkinClosesAt.toISOString()} withDate />
            {event.closedAt && (
              <>
                {" "}
                (closed early at <LocalTime iso={event.closedAt.toISOString()} withDate />)
              </>
            )}{" "}
            · Created by {event.createdBy.name}
          </p>
        </div>
        <div className="row">
          {state === "open" && (
            <Link href={`/admin/events/${event.id}/present`} className="btn btn-primary">
              Show QR
            </Link>
          )}
          <Link href={`/admin/events/${event.id}/edit`} className="btn btn-ghost">
            Edit
          </Link>
          {state === "open" && (
            <form action={closeCheckin.bind(null, event.id)}>
              <button className="btn btn-ghost" type="submit">
                Close check-in
              </button>
            </form>
          )}
          {event.closedAt && (
            <form action={reopenCheckin.bind(null, event.id)}>
              <button className="btn btn-ghost" type="submit">
                Reopen check-in
              </button>
            </form>
          )}
          {event.stamps.length === 0 && (
            <form action={deleteEvent.bind(null, event.id)}>
              <button className="btn btn-ghost btn-danger" type="submit">
                Delete
              </button>
            </form>
          )}
        </div>
      </header>

      {sp.error === "has-stamps" && <p className="alert">Events with check-ins can&apos;t be deleted. Close check-in instead.</p>}

      <section className="metrics">
        <div className="panel">
          <div className="metric-value">{event.stamps.length}</div>
          <div className="metric-label">People checked in</div>
        </div>
        <div className="panel">
          <div className="metric-value">{byMethod.qr}</div>
          <div className="metric-label">QR scans</div>
        </div>
        {event.type === "virtual" && (
          <div className="panel">
            <div className="metric-value">{byMethod.code}</div>
            <div className="metric-label">Typed codes</div>
          </div>
        )}
        <div className="panel">
          <div className="metric-value">{byMethod.manual}</div>
          <div className="metric-label">Manual stamps</div>
        </div>
      </section>

      <div className="grid-2 grid-2-wide">
        <section className="panel stack-sm" style={{ padding: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", padding: "16px 16px 0" }}>
            <p className="eyebrow">Attendance {state === "open" && <span className="live-dot">live</span>}</p>
            <a href={`/api/admin/reports/attendance?event=${event.id}`} className="small">
              Download CSV
            </a>
          </div>
          {event.stamps.length === 0 ? (
            <div className="empty-state">
              <UnicornOutline size={64} color="var(--blue-300)" />
              <p className="muted">No check-ins yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Checked in</th>
                    <th>How</th>
                  </tr>
                </thead>
                <tbody>
                  {event.stamps.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/admin/employees/${s.employee.id}`}>
                          <strong>{s.employee.name}</strong>
                        </Link>
                        <div className="small muted">{s.employee.email}</div>
                      </td>
                      <td className="small">
                        <LocalTime iso={s.createdAt.toISOString()} withDate />
                      </td>
                      <td className="small">
                        {METHOD_LABEL[s.method]}
                        {s.method === "manual" && (
                          <div className="muted">
                            by {s.addedBy?.name ?? "admin"}
                            {s.note && <> · “{s.note}”</>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel stack-sm">
          <p className="eyebrow">Add a stamp manually</p>
          <p className="small muted">For someone who attended but couldn&apos;t scan. It&apos;s recorded with your name.</p>
          {sp.stamped && <p className={sp.stamped === "ok" ? "note" : "alert"}>{STAMP_MESSAGES[sp.stamped] ?? "Couldn't add that stamp."}</p>}
          <form method="get" className="row" style={{ flexWrap: "nowrap" }}>
            <input className="input" style={{ marginTop: 0 }} name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search employees" />
            <button className="btn btn-ghost" type="submit">
              Search
            </button>
          </form>
          {q && matches.length === 0 && <p className="small muted">No employees match “{q}”.</p>}
          <ul className="reward-list">
            {matches.map((m) => (
              <li key={m.id} style={{ alignItems: "center" }}>
                <span>
                  <strong>{m.name}</strong>
                  <span className="small muted" style={{ display: "block" }}>
                    {m.email}
                  </span>
                </span>
                {m.stamped ? (
                  <span className="badge">Stamped</span>
                ) : (
                  <form action={addManualStamp} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="employeeId" value={m.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input className="input input-sm" name="note" placeholder="Note (optional)" maxLength={200} aria-label={`Note for ${m.name}`} />
                    <button className="btn btn-primary btn-sm" type="submit">
                      Add stamp
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
