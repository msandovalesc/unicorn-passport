"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type QrState = {
  state: "open" | "not_open" | "closed";
  svg: string | null;
  code: string | null;
  rotatesAt: number;
  serverNow: number;
  checkedIn: number;
  opensAt: string;
  closesAt: string;
};

const WINDOW_MS = 60_000;

/** Full-screen rotating QR. Refreshes at each rotation and polls the live check-in count. */
export function RotatingQr({ eventId, eventName, virtual }: { eventId: string; eventName: string; virtual: boolean }) {
  const [data, setData] = useState<QrState | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const offset = useRef(0); // server clock − local clock
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/qr`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as QrState;
      offset.current = json.serverNow - Date.now();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    }
  }, [eventId]);

  // Poll every 5s for the live count; also refetch right after each rotation.
  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const wait = data.rotatesAt - (Date.now() + offset.current) + 300;
    const t = setTimeout(load, Math.max(wait, 300));
    return () => clearTimeout(t);
  }, [data, load]);

  const msLeft = data ? Math.max(0, data.rotatesAt - (now + offset.current)) : WINDOW_MS;
  const secondsLeft = Math.ceil(msLeft / 1000);

  return (
    <div ref={root} className="present">
      <div className="present-qr">
        {data?.svg ? (
          <div className="present-qr-tile" dangerouslySetInnerHTML={{ __html: data.svg }} role="img" aria-label="Event check-in QR code" />
        ) : (
          <div className="present-qr-tile present-qr-off">
            {data?.state === "not_open" ? "Check-in hasn't opened yet" : data?.state === "closed" ? "Check-in is closed" : "Loading…"}
          </div>
        )}
        {data?.svg && (
          <div className="present-timer" aria-hidden>
            <div className="present-timer-bar" style={{ transform: `scaleX(${msLeft / WINDOW_MS})` }} />
          </div>
        )}
      </div>

      <div className="present-side stack">
        <p className="eyebrow">Unicorn Passport</p>
        <h1 className="present-title">
          <strong>{eventName}</strong>
        </h1>
        <p className="present-lead">Scan with your phone camera to collect your stamp.</p>

        {virtual && data?.code && (
          <div className="stack-sm">
            <p className="muted">On this device? Go to the Check in page and type:</p>
            <p className="present-code" aria-live="polite">
              {data.code.slice(0, 3)} {data.code.slice(3)}
            </p>
          </div>
        )}

        {data?.svg && <p className="muted small">New code in {secondsLeft}s</p>}

        <div className="present-count">
          <span className="present-count-n">{data?.checkedIn ?? "–"}</span> unicorns checked in
        </div>

        {error && <p className="alert">Connection lost. Retrying…</p>}

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())}
        >
          Full screen
        </button>
      </div>
    </div>
  );
}
