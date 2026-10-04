import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { PassCard } from "@/components/PassCard";
import { UnicornPattern } from "@/components/UnicornPattern";
import { cardQrSvg, ensureWebPass, getCardState } from "@/lib/card";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

const CHEERS = ["Unicorn secured!", "Stamped!", "Another one for the herd!", "You showed up. We noticed.", "Hoof-ray!"];

type Search = { status?: string; event?: string };

export default async function CheckinResultPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { employee } = await requireEmployee(`/checkin/result?${new URLSearchParams(sp as Record<string, string>)}`);

  const event = sp.event ? await db.event.findUnique({ where: { id: sp.event } }) : null;
  // Never trust the status in the URL for a celebration: confirm the stamp exists.
  const stamp = event ? await db.stamp.findUnique({ where: { employeeId_eventId: { employeeId: employee.id, eventId: event.id } } }) : null;
  const status = sp.status === "ok" && !stamp ? "already" : (sp.status ?? "invalid");

  const pass = await ensureWebPass(employee.id);
  const { progress } = await getCardState(employee.id);
  const qr = await cardQrSvg(pass.cardToken);

  if ((status === "ok" || status === "already") && stamp && event) {
    const celebrating = status === "ok" && Date.now() - stamp.createdAt.getTime() < 10 * 60_000;
    const unlocked = celebrating
      ? await db.reward.findMany({ where: { employeeId: employee.id, unlockedAt: stamp.createdAt }, orderBy: { tier: "asc" } })
      : [];
    const cheer = CHEERS[parseInt(stamp.id.slice(0, 2), 16) % CHEERS.length];

    return (
      <main className="screen surface-dark">
        <UnicornPattern seed={42} count={18} opacity={[0.06, 0.16]} />
        <div className="container stack-lg">
          <section className="stack-sm" style={{ textAlign: "center" }}>
            <p className="eyebrow">{event.name}</p>
            <h1 style={{ fontSize: 36 }}>
              <strong>{celebrating ? cheer : "Already stamped"}</strong>
            </h1>
            <p className="muted">
              {celebrating
                ? progress.isComplete
                  ? "That's a full card! Your next stamp starts card #" + (progress.cardNumber + 1) + "."
                  : `Stamp ${progress.stampsOnCard} of 10 is on your card.`
                : "You already have this event's stamp. One per event, but nice enthusiasm."}
            </p>
          </section>

          <PassCard name={employee.name} progress={progress} qrSvg={qr} newStamp={celebrating ? progress.stampsOnCard : undefined} />

          {unlocked.length > 0 && (
            <section className="panel stack-sm reward-unlocked" style={{ textAlign: "center" }}>
              <p className="eyebrow">Reward unlocked</p>
              <h2 style={{ fontSize: 24 }}>
                <strong>{unlocked.map((r) => r.item).join(" + ")}</strong>
              </h2>
              <p className="muted small">Show your card QR to the merch team to collect it.</p>
              <Link href="/card" className="btn btn-cta btn-block">
                Claim reward
              </Link>
            </section>
          )}

          {unlocked.length === 0 && (
            <Link href="/card" className="btn btn-ghost btn-block">
              View my card
            </Link>
          )}
        </div>
      </main>
    );
  }

  const messages: Record<string, { title: string; body: React.ReactNode }> = {
    not_open: {
      title: "Hold your unicorns",
      body: event ? (
        <>
          Check-in for <strong>{event.name}</strong> opens at <LocalTime iso={event.checkinOpensAt.toISOString()} withDate />. Scan again then.
        </>
      ) : (
        "Check-in for this event hasn't opened yet."
      ),
    },
    closed: {
      title: "This one's wrapped",
      body: event ? (
        <>
          Check-in for <strong>{event.name}</strong> closed at <LocalTime iso={(event.closedAt ?? event.checkinClosesAt).toISOString()} withDate />. Catch you at the next one!
        </>
      ) : (
        "Check-in for this event is closed."
      ),
    },
    expired: {
      title: "That code galloped off",
      body: "Event QR codes refresh every minute. Scan the one on screen again.",
    },
    rate_limited: {
      title: "Whoa, slow down",
      body: "Too many check-in attempts. Wait a minute and try again.",
    },
    invalid: {
      title: "Hmm, that's not a stamp code",
      body: "We couldn't read that check-in code. Scan the event QR on screen, or type the event code.",
    },
  };
  const m = messages[status] ?? messages.invalid;

  return (
    <main className="screen surface-dark">
      <UnicornPattern seed={8} count={8} />
      <div className="container stack-lg">
        <section className="stack-sm">
          <p className="eyebrow">Check-in</p>
          <h1 style={{ fontSize: 32 }}>
            <strong>{m.title}</strong>
          </h1>
          <p className="muted" style={{ fontSize: 17 }}>
            {m.body}
          </p>
        </section>
        <div className="stack-sm">
          <Link href="/checkin" className="btn btn-ghost btn-block">
            Type an event code
          </Link>
          <Link href="/card" className="btn btn-link btn-block">
            Back to my card
          </Link>
        </div>
      </div>
    </main>
  );
}
