import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { PassCard } from "@/components/PassCard";
import { UnicornPattern } from "@/components/UnicornPattern";
import { cardQrSvg, ensureWebPass, getCardState } from "@/lib/card";
import { requireEmployee } from "@/lib/session";

export const metadata: Metadata = { title: "My card" };
export const dynamic = "force-dynamic";

export default async function CardPage() {
  const { employee } = await requireEmployee("/card");
  if (!employee.trackId) redirect("/join");

  const pass = await ensureWebPass(employee.id);
  const { progress, tiers, pendingRewards } = await getCardState(employee.id);
  const qr = await cardQrSvg(pass.cardToken);

  return (
    <main className="screen surface-dark">
      <UnicornPattern seed={5} count={10} />
      <div className="container stack-lg">
        <PassCard name={employee.name} progress={progress} qrSvg={qr} />

        {pendingRewards.length > 0 && (
          <section className="panel stack-sm">
            <p className="eyebrow">Ready to claim</p>
            <ul className="reward-list">
              {pendingRewards.map((r) => (
                <li key={r.id}>
                  <strong>{r.item}</strong>
                  <span className="badge">Card #{r.cardNumber}</span>
                </li>
              ))}
            </ul>
            <p className="small muted">Show your card QR to the merch team to collect.</p>
          </section>
        )}

        <section className="panel stack-sm">
          <p className="eyebrow">How it works</p>
          <p>Scan the event QR at any Unosquare event, in person or on a call, to earn one stamp. Ten stamps fill a card, then a fresh one starts.</p>
          <ul className="reward-list">
            {tiers.map((t) => (
              <li key={t.stampCount}>
                <span>{t.item}</span>
                <span className="badge">{t.stampCount} stamps</span>
              </li>
            ))}
          </ul>
          <p className="small muted">Track: {employee.track?.name}. Total stamps all-time: {progress.totalStamps}.</p>
        </section>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <Link href="/checkin">Have an event code?</Link>
          <Link href="/join">Add to wallet</Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="btn-link" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
