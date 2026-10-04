import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { requireEmployee } from "@/lib/session";
import { submitCode } from "./actions";

export const metadata: Metadata = { title: "Check in" };

/** Landing for check-in without a QR: explains scanning, and takes the typed code for virtual events. */
export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireEmployee("/checkin");
  const { error } = await searchParams;

  return (
    <main className="screen surface-light">
      <div className="container stack-lg">
        <Logo tone="dark" />
        <section className="stack-sm">
          <p className="eyebrow">Check in</p>
          <h1 style={{ fontSize: 32 }}>
            Scan it, <strong>stack it</strong>
          </h1>
          <p className="muted">
            Point your phone camera at the event QR code on screen or on the sign. On a call from this same device? Type the code shown
            under the QR instead.
          </p>
        </section>

        <form action={submitCode} className="panel stack">
          <label className="field">
            Event code
            <input
              className="input"
              name="code"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={8}
              placeholder="e.g. K7M2QX"
              style={{ fontSize: 24, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}
            />
          </label>
          {error === "code" && <p className="alert">That code didn&apos;t match a live event. Codes change every minute, so check the screen and try again.</p>}
          <button className="btn btn-cta btn-block" type="submit">
            Check in
          </button>
        </form>

        <p>
          <Link href="/card">Back to my card</Link>
        </p>
      </div>
    </main>
  );
}
