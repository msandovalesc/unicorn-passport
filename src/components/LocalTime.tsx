"use client";

import { useEffect, useState } from "react";

/** Formats a time in the viewer's own time zone (server time zones differ from employees'). */
export function LocalTime({ iso, withDate = false }: { iso: string; withDate?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    setText(
      d.toLocaleString(undefined, withDate ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { hour: "numeric", minute: "2-digit" }),
    );
  }, [iso, withDate]);
  return <time dateTime={iso}>{text ?? ""}</time>;
}
