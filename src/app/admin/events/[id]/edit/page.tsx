import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await db.event.findUnique({ where: { id } });
  if (!e) notFound();

  return (
    <div className="stack-lg">
      <Link href={`/admin/events/${e.id}`} className="small">
        ← {e.name}
      </Link>
      <h1 style={{ fontSize: 32 }}>
        <strong>Edit event</strong>
      </h1>
      <EventForm
        initial={{
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          checkinOpensAt: e.checkinOpensAt.toISOString(),
          checkinClosesAt: e.checkinClosesAt.toISOString(),
        }}
      />
    </div>
  );
}
