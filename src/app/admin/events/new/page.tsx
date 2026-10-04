import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/admin/EventForm";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="stack-lg">
      <Link href="/admin/events" className="small">
        ← Events
      </Link>
      <h1 style={{ fontSize: 32 }}>
        <strong>New event</strong>
      </h1>
      <EventForm />
    </div>
  );
}
