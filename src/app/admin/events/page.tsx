import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { checkinWindowState } from "@/lib/checkin/rules";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Events" };

const STATE_LABEL = { open: "Check-in open", not_open: "Upcoming", closed: "Closed" } as const;

/** Event list with "Show QR". Creating and editing events arrives in Milestone 4. */
export default async function EventsPage() {
  const now = new Date();
  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { stamps: true } } },
    take: 100,
  });
  const withState = events.map((e) => ({ ...e, state: checkinWindowState(e, now) }));
  const order = { open: 0, not_open: 1, closed: 2 } as const;
  withState.sort((a, b) => order[a.state] - order[b.state]);

  return (
    <div className="stack-lg">
      <h1 style={{ fontSize: 32 }}>
        <strong>Events</strong>
      </h1>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th>Check-in window</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Stamps</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {withState.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.name}</strong>
                  {e.description && <div className="small muted">{e.description}</div>}
                </td>
                <td>{e.type === "virtual" ? "Virtual" : "In person"}</td>
                <td className="small">
                  <LocalTime iso={e.checkinOpensAt.toISOString()} withDate /> – <LocalTime iso={e.checkinClosesAt.toISOString()} />
                </td>
                <td>
                  <span className={`badge badge-${e.state}`}>{STATE_LABEL[e.state]}</span>
                </td>
                <td style={{ textAlign: "right" }}>{e._count.stamps}</td>
                <td style={{ textAlign: "right" }}>
                  {e.state === "open" && (
                    <Link href={`/admin/events/${e.id}/present`} className="btn btn-primary" style={{ minHeight: 36, padding: "6px 16px" }}>
                      Show QR
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
