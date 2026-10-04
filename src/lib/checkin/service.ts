import { Prisma, type StampMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { tiersReachedBetween } from "@/lib/progress";
import { notifyCardChanged } from "@/lib/wallet/notify";
import { checkinWindowState } from "./rules";
import { codeMatches, parseToken, verifyToken } from "./token";

export type CheckinStatus =
  | "ok"          // stamp saved
  | "already"     // one stamp per employee per event
  | "not_open"    // before checkin_opens_at
  | "closed"      // after checkin_closes_at or closed early
  | "expired"     // QR token older than the previous window
  | "invalid"     // malformed / forged token, unknown event, wrong code
  | "not_enrolled";

export type CheckinResult = { status: CheckinStatus; eventId?: string; newRewards?: string[] };

/**
 * Saves one stamp and unlocks rewards, atomically.
 * - The unique (employee_id, event_id) key enforces one stamp per event, even under races.
 * - A per-employee advisory lock serialises an employee's stamps, so tier detection
 *   (count before → count after) can't be skipped by two simultaneous check-ins.
 * Used by QR check-in, typed codes and (with method = manual + addedById) admin stamping.
 */
export async function recordStamp(input: {
  employeeId: string;
  eventId: string;
  method: StampMethod;
  addedById?: string;
  note?: string;
  now?: Date;
}): Promise<CheckinResult> {
  const now = input.now ?? new Date();
  let result: CheckinResult;
  try {
    result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.employeeId}))`;

      const existing = await tx.stamp.findUnique({
        where: { employeeId_eventId: { employeeId: input.employeeId, eventId: input.eventId } },
        select: { id: true },
      });
      if (existing) return { status: "already", eventId: input.eventId } satisfies CheckinResult;

      const before = await tx.stamp.count({ where: { employeeId: input.employeeId } });
      await tx.stamp.create({
        data: {
          employeeId: input.employeeId,
          eventId: input.eventId,
          method: input.method,
          addedById: input.addedById,
          note: input.note,
          createdAt: now,
        },
      });

      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: input.employeeId },
        select: { track: { select: { tiers: { where: { active: true }, select: { stampCount: true, item: true } } } } },
      });
      const reached = tiersReachedBetween(before, before + 1, employee.track?.tiers ?? []);
      if (reached.length) {
        await tx.reward.createMany({
          data: reached.map((t) => ({ employeeId: input.employeeId, cardNumber: t.cardNumber, tier: t.stampCount, item: t.item, unlockedAt: now })),
          skipDuplicates: true,
        });
      }
      return { status: "ok", eventId: input.eventId, newRewards: reached.map((t) => t.item) } satisfies CheckinResult;
    });
  } catch (e) {
    // Unique key backstop (e.g. the same stamp written through another path).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: "already", eventId: input.eventId };
    throw e;
  }

  if (result.status === "ok") {
    // Wallet updates are best-effort: a push failure must never lose the stamp.
    await notifyCardChanged(input.employeeId, {
      reason: result.newRewards?.length ? "reward_unlocked" : "stamp",
      rewards: result.newRewards,
    }).catch((err) => console.error("[wallet] notify failed", err));
  }
  return result;
}

async function isEnrolled(employeeId: string) {
  const e = await db.employee.findUnique({ where: { id: employeeId }, select: { trackId: true } });
  return Boolean(e?.trackId);
}

/** Validates a scanned token (signature + rotation window) without stamping. */
export async function validateQrToken(token: string, now = new Date()): Promise<CheckinResult> {
  const parsed = parseToken(token);
  if (!parsed) return { status: "invalid" };
  const event = await db.event.findUnique({ where: { id: parsed.eventId } });
  if (!event) return { status: "invalid" };
  const check = verifyToken(parsed, event.qrSecret, now.getTime());
  if (check === "bad_signature" || check === "future") return { status: "invalid" };
  if (check === "expired") return { status: "expired", eventId: event.id };
  return { status: "ok", eventId: event.id };
}

/**
 * Stamp for an event the employee holds a valid check-in grant (or fresh token) for.
 * The window rule is checked here, at stamping time.
 */
export async function checkInToEvent(employeeId: string, eventId: string, method: StampMethod, now = new Date()): Promise<CheckinResult> {
  if (!(await isEnrolled(employeeId))) return { status: "not_enrolled", eventId };
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return { status: "invalid" };
  const state = checkinWindowState(event, now);
  if (state !== "open") return { status: state, eventId };
  return recordStamp({ employeeId, eventId, method, now });
}

/** Full QR path: token → validation → window → stamp. */
export async function checkInWithToken(employeeId: string, token: string, now = new Date()): Promise<CheckinResult> {
  const valid = await validateQrToken(token, now);
  if (valid.status !== "ok") return valid;
  return checkInToEvent(employeeId, valid.eventId!, "qr", now);
}

/** Typed-code path for virtual events: matches against events whose check-in is open right now. */
export async function checkInWithCode(employeeId: string, code: string, now = new Date()): Promise<CheckinResult> {
  const open = await db.event.findMany({
    where: { type: "virtual", closedAt: null, checkinOpensAt: { lte: now }, checkinClosesAt: { gte: now } },
    select: { id: true, qrSecret: true },
  });
  const match = open.find((e) => codeMatches(code, e.id, e.qrSecret, now.getTime()));
  if (!match) return { status: "invalid" };
  return checkInToEvent(employeeId, match.id, "code", now);
}
