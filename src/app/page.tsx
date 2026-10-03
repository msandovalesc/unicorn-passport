import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";
import { StampGrid } from "@/components/StampGrid";
import { UnicornPattern } from "@/components/UnicornPattern";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const { error } = await searchParams;

  return (
    <main className="screen surface-dark">
      <UnicornPattern seed={3} />
      <div className="container stack-lg">
        <header className="topbar">
          <Logo />
          {session?.isAdmin && (
            <Link href="/admin" className="small">
              Admin
            </Link>
          )}
        </header>

        {error === "not-admin" && <p className="alert">That page is for the events team only.</p>}

        <section className="stack">
          <p className="eyebrow">Unosquare events</p>
          <h1 style={{ fontSize: 40 }}>
            Unicorn <strong>Passport</strong>
          </h1>
          <p className="muted" style={{ fontSize: 17 }}>
            Show up, scan in, collect unicorns. Every company event earns a stamp, and every few stamps unlocks Unosquare merch.
          </p>
        </section>

        <StampGrid stamps={4} variant="onLight" newStamp={4} />

        <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li>Add it<span>to your wallet</span></li>
          <li>Scan it<span>at any event</span></li>
          <li>Stack it<span>10 per card</span></li>
          <li>Claim it<span>merch rewards</span></li>
        </ol>

        <div className="stack">
          <Link href={session ? "/card" : "/join"} className="btn btn-cta btn-block">
            {session ? "Open my card" : "Get my card"}
          </Link>
          {!session && <p className="muted small" style={{ textAlign: "center" }}>Sign in with your Unosquare Microsoft 365 account.</p>}
        </div>
      </div>
    </main>
  );
}
