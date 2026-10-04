/** Check-in window rule: stamps only between checkin_opens_at and checkin_closes_at, unless closed early. */
export type WindowState = "open" | "not_open" | "closed";

export function checkinWindowState(
  event: { checkinOpensAt: Date; checkinClosesAt: Date; closedAt: Date | null },
  now: Date,
): WindowState {
  if (event.closedAt && event.closedAt <= now) return "closed";
  if (now < event.checkinOpensAt) return "not_open";
  if (now > event.checkinClosesAt) return "closed";
  return "open";
}
