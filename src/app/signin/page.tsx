import type { Metadata } from "next";
import { signIn } from "@/auth";
import { Logo } from "@/components/Logo";
import { UnicornPattern } from "@/components/UnicornPattern";
import { db } from "@/lib/db";
import { devLoginEnabled, entraConfigured } from "@/lib/env";
import { safeCallback } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain: "Unicorn Passport is for Unosquare accounts only. Try again with your @unosquare.com account.",
  tenant: "That account isn't part of the Unosquare directory.",
  AccessDenied: "Sign-in was blocked. Use your Unosquare Microsoft 365 account.",
  Configuration: "Sign-in isn't configured yet. Check the Entra ID settings in .env.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  const redirectTo = safeCallback(sp.callbackUrl);
  const devUsers = devLoginEnabled
    ? await db.employee.findMany({ where: { m365ObjectId: { startsWith: "dev-" } }, orderBy: { name: "asc" }, select: { name: true, email: true } })
    : [];
  const fromCheckin = redirectTo.startsWith("/checkin");

  return (
    <main className="screen surface-dark">
      <UnicornPattern seed={11} />
      <div className="container stack-lg">
        <Logo />
        <section className="stack">
          <p className="eyebrow">Unicorn Passport</p>
          <h1 style={{ fontSize: 32 }}>
            {fromCheckin ? (
              <>
                Almost there. <strong>Sign in to grab your stamp.</strong>
              </>
            ) : (
              <>
                Sign in to <strong>get your card</strong>
              </>
            )}
          </h1>
          {sp.reason === "admin-recheck" && <p className="muted">For security, admins sign in again every 12 hours.</p>}
          {sp.error && <p className="alert">{ERRORS[sp.error] ?? "Something went wrong signing you in. Please try again."}</p>}
        </section>

        {entraConfigured ? (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo });
            }}
          >
            <button className="btn btn-ms btn-block" type="submit">
              <MicrosoftMark /> Sign in with Microsoft
            </button>
          </form>
        ) : (
          <p className="note">Microsoft sign-in isn&apos;t configured yet (see README → Microsoft Entra ID).</p>
        )}

        {devUsers.length > 0 && (
          <section className="panel stack">
            <div>
              <p className="eyebrow">Local dev only</p>
              <p className="small muted">Sign in as a seed user. Hidden in production.</p>
            </div>
            {devUsers.map((u) => (
              <form
                key={u.email}
                action={async () => {
                  "use server";
                  await signIn("dev", { email: u.email, redirectTo });
                }}
              >
                <button className="btn btn-ghost btn-block" type="submit" style={{ justifyContent: "space-between" }}>
                  <span>{u.name}</span>
                  <span className="small" style={{ fontWeight: 400 }}>{u.email}</span>
                </button>
              </form>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
