import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Admin role is re-checked against Entra at least this often (admins sign in again). */
const ADMIN_RECHECK_MS = 12 * 60 * 60 * 1000;

function signInUrl(returnTo: string) {
  return `/signin?callbackUrl=${encodeURIComponent(returnTo)}`;
}

/** Signed-in employee (with track), or redirect to sign-in and come back to `returnTo`. */
export async function requireEmployee(returnTo: string) {
  const session = await auth();
  if (!session?.employeeId) redirect(signInUrl(returnTo));
  const employee = await db.employee.findUnique({ where: { id: session.employeeId }, include: { track: true } });
  if (!employee) redirect(signInUrl(returnTo));
  return { session, employee };
}

export async function requireAdmin(returnTo = "/admin") {
  const { session, employee } = await requireEmployee(returnTo);
  if (!session.isAdmin) redirect("/?error=not-admin");
  if (Date.now() - session.adminCheckedAt > ADMIN_RECHECK_MS) redirect(signInUrl(returnTo) + "&reason=admin-recheck");
  return { session, employee };
}

/** Only allow same-site relative redirects. */
export function safeCallback(url: string | undefined | null, fallback = "/card"): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return fallback;
  return url;
}
