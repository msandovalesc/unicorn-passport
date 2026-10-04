"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { saveEvent, type FormState } from "@/app/admin/actions";

type Initial = {
  id?: string;
  name?: string;
  type?: "in_person" | "virtual";
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  checkinOpensAt?: string;
  checkinClosesAt?: string;
};

const MIN = 60_000;

/** "YYYY-MM-DDTHH:mm" in the admin's own time zone, for <input type="datetime-local">. */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * MIN;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function toIso(local: string) {
  return local ? new Date(local).toISOString() : "";
}
function addMinutes(local: string, minutes: number) {
  if (!local) return "";
  return toLocalInput(new Date(new Date(local).getTime() + minutes * MIN).toISOString());
}

/**
 * Event create/edit. Times are typed in the admin's local time and sent as ISO (UTC), so
 * employees in other time zones see them correctly. Check-in defaults to opening 30 min
 * before the start and closing 60 min after the end, until the admin changes it.
 */
export function EventForm({ initial = {} }: { initial?: Initial }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEvent, undefined);
  const [ready, setReady] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [customWindow, setCustomWindow] = useState(Boolean(initial.id));

  // Local-time values depend on the browser's time zone, so fill them after mount.
  useEffect(() => {
    if (initial.startsAt) {
      setStartsAt(toLocalInput(initial.startsAt));
      setEndsAt(toLocalInput(initial.endsAt));
      setOpensAt(toLocalInput(initial.checkinOpensAt));
      setClosesAt(toLocalInput(initial.checkinClosesAt));
    } else {
      const next = new Date();
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 24);
      const s = toLocalInput(next.toISOString());
      setStartsAt(s);
      setEndsAt(addMinutes(s, 60));
      setOpensAt(addMinutes(s, -30));
      setClosesAt(addMinutes(s, 120));
    }
    setReady(true);
  }, [initial.startsAt, initial.endsAt, initial.checkinOpensAt, initial.checkinClosesAt]);

  function onStart(v: string) {
    const duration = startsAt && endsAt ? (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / MIN : 60;
    const newEnd = addMinutes(v, duration > 0 ? duration : 60);
    setStartsAt(v);
    setEndsAt(newEnd);
    if (!customWindow) {
      setOpensAt(addMinutes(v, -30));
      setClosesAt(addMinutes(newEnd, 60));
    }
  }
  function onEnd(v: string) {
    setEndsAt(v);
    if (!customWindow) setClosesAt(addMinutes(v, 60));
  }

  return (
    <form action={action} className="panel stack" style={{ maxWidth: 640 }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="startsAt" value={toIso(startsAt)} />
      <input type="hidden" name="endsAt" value={toIso(endsAt)} />
      <input type="hidden" name="checkinOpensAt" value={toIso(opensAt)} />
      <input type="hidden" name="checkinClosesAt" value={toIso(closesAt)} />

      <label className="field">
        Event name
        <input className="input" name="name" required maxLength={120} defaultValue={initial.name} placeholder="e.g. unoTalks: Platform Teams" />
      </label>

      <fieldset className="field-set">
        <legend className="field">Type</legend>
        <div className="row">
          <label className="radio">
            <input type="radio" name="type" value="in_person" defaultChecked={(initial.type ?? "in_person") === "in_person"} /> In person
          </label>
          <label className="radio">
            <input type="radio" name="type" value="virtual" defaultChecked={initial.type === "virtual"} /> Virtual
            <span className="muted small"> (also shows a typed code)</span>
          </label>
        </div>
      </fieldset>

      <label className="field">
        Where <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
        <input className="input" name="description" maxLength={200} defaultValue={initial.description ?? ""} placeholder="e.g. Guadalajara office, 3rd floor · or Teams call" />
      </label>

      <div className="grid-2">
        <label className="field">
          Starts
          <input className="input" type="datetime-local" required value={startsAt} onChange={(e) => onStart(e.target.value)} disabled={!ready} />
        </label>
        <label className="field">
          Ends
          <input className="input" type="datetime-local" required value={endsAt} onChange={(e) => onEnd(e.target.value)} disabled={!ready} />
        </label>
      </div>

      <div className="stack-sm">
        <p className="field">Check-in window</p>
        {!customWindow ? (
          <p className="small muted">
            Opens 30 min before the start and closes 1 hour after the end.{" "}
            <button type="button" className="btn-link" onClick={() => setCustomWindow(true)}>
              Change
            </button>
          </p>
        ) : (
          <div className="grid-2">
            <label className="field">
              Opens
              <input className="input" type="datetime-local" required value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            </label>
            <label className="field">
              Closes
              <input className="input" type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {state?.error && <p className="alert">{state.error}</p>}

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || !ready}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create event"}
        </button>
        <Link href={initial.id ? `/admin/events/${initial.id}` : "/admin/events"} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
