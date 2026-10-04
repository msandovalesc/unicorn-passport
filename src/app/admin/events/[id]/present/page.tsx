import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RotatingQr } from "./RotatingQr";

export const metadata: Metadata = { title: "Event QR" };

/** The host shows this on a screen, prints it, or shares it on a call. */
export default async function PresentEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, select: { id: true, name: true, type: true } });
  if (!event) notFound();

  return (
    <div className="stack">
      <Link href="/admin/events" className="small">
        ← Events
      </Link>
      <RotatingQr eventId={event.id} eventName={event.name} virtual={event.type === "virtual"} />
    </div>
  );
}
