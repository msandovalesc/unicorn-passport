import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { checkinWindowState } from "@/lib/checkin/rules";
import { codeFor, makeToken, windowAt, windowEndsAt } from "@/lib/checkin/token";
import { db } from "@/lib/db";
import { checkinUrl } from "@/lib/urls";

/**
 * Current rotating QR for an event (admins only). Polled by the full-screen display.
 * Returns the QR as SVG, the typed code for virtual events, when it rotates, and the live count.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, include: { _count: { select: { stamps: true } } } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = Date.now();
  const state = checkinWindowState(event, new Date(now));
  const url = checkinUrl(makeToken(event.id, event.qrSecret, now));
  const svg =
    state === "open"
      ? await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#191919", light: "#FFFFFF" } })
      : null;

  return NextResponse.json(
    {
      state,
      svg,
      url: state === "open" ? url : null,
      code: state === "open" && event.type === "virtual" ? codeFor(event.id, event.qrSecret, windowAt(now)) : null,
      rotatesAt: windowEndsAt(windowAt(now)),
      serverNow: now,
      checkedIn: event._count.stamps,
      opensAt: event.checkinOpensAt,
      closesAt: event.closedAt ?? event.checkinClosesAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
