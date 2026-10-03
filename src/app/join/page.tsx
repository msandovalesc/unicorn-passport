import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PassCard } from "@/components/PassCard";
import { UnicornPattern } from "@/components/UnicornPattern";
import { WalletButtons } from "@/components/WalletButtons";
import { cardQrSvg, ensureWebPass, getCardState } from "@/lib/card";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { chooseTrack } from "./actions";

export const metadata: Metadata = { title: "Get your card" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string; welcome?: string }> }) {
  const { employee } = await requireEmployee("/join");
  const sp = await searchParams;

  // Step 1: pick a reward track (form on a plain light screen: no pattern behind forms).
  if (!employee.trackId) {
    const tracks = await db.rewardTrack.findMany({ orderBy: { sortOrder: "asc" }, include: { tiers: { where: { active: true }, orderBy: { stampCount: "asc" } } } });
    return (
      <main className="screen surface-light">
        <div className="container stack-lg">
          <Logo tone="dark" />
          <section className="stack-sm">
            <p className="eyebrow">Welcome, {employee.name.split(" ")[0]}</p>
            <h1 style={{ fontSize: 32 }}>
              How do you <strong>usually join events?</strong>
            </h1>
            <p className="muted">This picks your reward track. You can ask the events team to change it later.</p>
          </section>
          {sp.error && <p className="alert">Pick one of the options to continue.</p>}
          <form action={chooseTrack} className="stack">
            {tracks.map((t, i) => (
              <label key={t.id} className="choice">
                <input type="radio" name="track" value={t.slug} defaultChecked={i === 0} required />
                <span className="choice-card">
                  <strong>{t.name}</strong>
                  <span className="muted small">{t.description}</span>
                  <span className="small" style={{ display: "block", marginTop: 8 }}>
                    {t.tiers.map((tier) => `${tier.stampCount} stamps: ${tier.item}`).join(" · ")}
                  </span>
                </span>
              </label>
            ))}
            <label className="field">
              Office or city <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
              <input className="input" name="location" maxLength={80} placeholder="e.g. Guadalajara" defaultValue={employee.location ?? ""} />
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              Create my card
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Step 2: the card is ready. Offer the wallet for this device + the web card.
  const pass = await ensureWebPass(employee.id);
  const { progress } = await getCardState(employee.id);
  const qr = await cardQrSvg(pass.cardToken);

  return (
    <main className="screen surface-dark">
      <UnicornPattern seed={21} />
      <div className="container stack-lg">
        <section className="stack-sm" style={{ textAlign: "center" }}>
          <p className="eyebrow">{sp.welcome ? "You're in!" : "Your card"}</p>
          <h1 style={{ fontSize: 32 }}>
            Your passport is <strong>ready to stack</strong>
          </h1>
          <p className="muted">Add it to your wallet so it&apos;s one tap away at every event.</p>
        </section>

        <PassCard name={employee.name} progress={progress} qrSvg={qr} />

        <WalletButtons />

        <p style={{ textAlign: "center" }}>
          <Link href="/card">No wallet? Open the web card</Link>
        </p>
      </div>
    </main>
  );
}
