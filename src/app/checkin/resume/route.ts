import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { GRANT_COOKIE, readGrant } from "@/lib/checkin/grant";
import { checkInToEvent } from "@/lib/checkin/service";
import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { appUrl, resultPath } from "@/lib/urls";

/**
 * Second half of a QR check-in. Requires sign-in (login always required, so nobody can stamp
 * for someone else) and enrollment, then saves the stamp for the event in the grant cookie.
 */
export async function GET(req: NextRequest) {
  const grant = readGrant(req.cookies.get(GRANT_COOKIE)?.value, Date.now());
  if (!grant) return NextResponse.redirect(appUrl(resultPath("expired")), 303);

  const session = await auth();
  if (!session?.employeeId) {
    return NextResponse.redirect(appUrl(`/signin?callbackUrl=${encodeURIComponent("/checkin/resume")}`), 303);
  }

  const rl = await rateLimit(`checkin:emp:${session.employeeId}`, LIMITS.checkinPerEmployee.limit, LIMITS.checkinPerEmployee.windowMs);
  if (!rl.ok) return NextResponse.redirect(appUrl(resultPath("rate_limited")), 303);

  const result = await checkInToEvent(session.employeeId, grant.eventId, "qr");
  if (result.status === "not_enrolled") {
    // Keep the grant: after picking a track they come straight back here.
    return NextResponse.redirect(appUrl(`/join?next=${encodeURIComponent("/checkin/resume")}`), 303);
  }

  const res = NextResponse.redirect(appUrl(resultPath(result.status, grant.eventId)), 303);
  res.cookies.delete(GRANT_COOKIE);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
