import { NextResponse, type NextRequest } from "next/server";
import { GRANT_COOKIE, GRANT_TTL_MS, issueGrant } from "@/lib/checkin/grant";
import { validateQrToken } from "@/lib/checkin/service";
import { LIMITS, clientIp, rateLimit } from "@/lib/rateLimit";
import { appUrl, resultPath } from "@/lib/urls";

/**
 * Target of the rotating event QR (opened by the phone camera).
 * Validates the token, then hands the browser a 15-minute check-in grant cookie and continues to
 * /checkin/resume, which signs the employee in if needed and saves the stamp.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = clientIp(req.headers);
  const rl = await rateLimit(`checkin:ip:${ip}`, LIMITS.checkinPerIp.limit, LIMITS.checkinPerIp.windowMs);
  if (!rl.ok) return NextResponse.redirect(appUrl(resultPath("rate_limited")), 303);

  const now = new Date();
  const valid = await validateQrToken(token, now);
  if (valid.status !== "ok") return NextResponse.redirect(appUrl(resultPath(valid.status, valid.eventId)), 303);

  const res = NextResponse.redirect(appUrl("/checkin/resume"), 303);
  res.cookies.set(GRANT_COOKIE, issueGrant(valid.eventId!, now.getTime()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GRANT_TTL_MS / 1000,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
