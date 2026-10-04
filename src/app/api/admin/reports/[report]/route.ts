import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { toCsv } from "@/lib/admin/csv";
import { db } from "@/lib/db";
import { cardPosition } from "@/lib/progress";

const METHOD = { qr: "QR scan", code: "Typed code", manual: "Manual" } as const;

/**
 * CSV exports (admins only):
 *   attendance  [?event=<id>] [&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *   redemptions [?from&to]
 *   employees
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const session = await auth();
  if (!session?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { report } = await params;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(`${sp.get("from")}T00:00:00Z`) : undefined;
  const to = sp.get("to") ? new Date(new Date(`${sp.get("to")}T00:00:00Z`).getTime() + 24 * 3600_000) : undefined;
  const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
  const stamp = new Date().toISOString().slice(0, 10);

  let csv: string;
  let name: string;

  if (report === "attendance") {
    const eventId = sp.get("event") ?? undefined;
    const rows = await db.stamp.findMany({
      where: { ...(eventId ? { eventId } : {}), ...(range ? { createdAt: range } : {}) },
      orderBy: [{ event: { startsAt: "desc" } }, { createdAt: "asc" }],
      include: {
        event: { select: { name: true, type: true, startsAt: true } },
        employee: { select: { name: true, email: true, location: true, track: { select: { name: true } } } },
        addedBy: { select: { name: true } },
      },
    });
    csv = toCsv(
      ["Event", "Event type", "Event start (UTC)", "Employee", "Email", "Location", "Track", "Checked in (UTC)", "Method", "Added by", "Note"],
      rows.map((s) => [
        s.event.name,
        s.event.type === "virtual" ? "Virtual" : "In person",
        s.event.startsAt,
        s.employee.name,
        s.employee.email,
        s.employee.location,
        s.employee.track?.name,
        s.createdAt,
        METHOD[s.method],
        s.addedBy?.name,
        s.note,
      ]),
    );
    const evName = eventId && rows[0] ? `-${rows[0].event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}` : "";
    name = `attendance${evName}-${stamp}.csv`;
  } else if (report === "redemptions") {
    const rows = await db.reward.findMany({
      where: range ? { unlockedAt: range } : {},
      orderBy: { unlockedAt: "desc" },
      include: { employee: { select: { name: true, email: true, location: true } }, redeemedBy: { select: { name: true } } },
    });
    csv = toCsv(
      ["Employee", "Email", "Location", "Reward", "Card #", "Stamps", "Unlocked (UTC)", "Status", "Handed out (UTC)", "Handed out by"],
      rows.map((r) => [r.employee.name, r.employee.email, r.employee.location, r.item, r.cardNumber, r.tier, r.unlockedAt, r.redeemedAt ? "Redeemed" : "Pending", r.redeemedAt, r.redeemedBy?.name]),
    );
    name = `rewards-${stamp}.csv`;
  } else if (report === "employees") {
    const rows = await db.employee.findMany({
      orderBy: { name: "asc" },
      include: {
        track: { select: { name: true } },
        passes: { select: { platform: true } },
        _count: { select: { stamps: true } },
        rewards: { select: { redeemedAt: true } },
      },
    });
    csv = toCsv(
      ["Employee", "Email", "Location", "Track", "Joined (UTC)", "Total stamps", "Current card", "Stamps on card", "Wallet", "Rewards unlocked", "Rewards pending"],
      rows.map((e) => {
        const pos = cardPosition(e._count.stamps);
        const wallets = [...new Set(e.passes.map((p) => p.platform).filter((p) => p !== "web"))].join(" + ") || "web";
        return [e.name, e.email, e.location, e.track?.name ?? "Not enrolled", e.createdAt, e._count.stamps, pos.cardNumber, pos.stampsOnCard, wallets, e.rewards.length, e.rewards.filter((r) => !r.redeemedAt).length];
      }),
    );
    name = `employees-${stamp}.csv`;
  } else {
    return NextResponse.json({ error: "unknown report" }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
