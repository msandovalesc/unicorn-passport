import { env } from "@/lib/env";

/** Absolute URL on the public app domain (request URLs can show internal hosts behind Azure's proxy). */
export function appUrl(path: string): URL {
  return new URL(path, env.APP_URL);
}

/** Event QR target. Scanning it with the phone camera opens the check-in flow. */
export function checkinUrl(token: string): string {
  return appUrl(`/c/${token}`).toString();
}

export function resultPath(status: string, eventId?: string): string {
  const qs = new URLSearchParams({ status });
  if (eventId) qs.set("event", eventId);
  return `/checkin/result?${qs}`;
}
