"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordStamp } from "@/lib/checkin/service";
import { db } from "@/lib/db";
import { requireAdmin, safeCallback } from "@/lib/session";
import { notifyCardChanged } from "@/lib/wallet/notify";

/** Every admin action re-checks the admin role on the server; the UI hiding buttons is not enough. */
async function admin() {
  const { employee } = await requireAdmin();
  return employee;
}

function done(path: string) {
  revalidatePath("/admin", "layout");
  redirect(path);
}

// ─── Events ────────────────────────────────────────────────────────────────

const eventSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, "Give the event a name").max(120),
    type: z.enum(["in_person", "virtual"]),
    description: z.string().trim().max(200).optional(),
    startsAt: z.coerce.date({ message: "Pick a start time" }),
    endsAt: z.coerce.date({ message: "Pick an end time" }),
    checkinOpensAt: z.coerce.date({ message: "Pick when check-in opens" }),
    checkinClosesAt: z.coerce.date({ message: "Pick when check-in closes" }),
  })
  .refine((e) => e.endsAt > e.startsAt, { message: "The event must end after it starts", path: ["endsAt"] })
  .refine((e) => e.checkinClosesAt > e.checkinOpensAt, { message: "Check-in must close after it opens", path: ["checkinClosesAt"] });

export type FormState = { error?: string } | undefined;

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await admin();
  const raw = Object.fromEntries(formData);
  const parsed = eventSchema.safeParse({ ...raw, id: raw.id || undefined, description: raw.description || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { id, ...data } = parsed.data;

  let eventId = id;
  if (id) {
    await db.event.update({ where: { id }, data: { ...data, description: data.description ?? null } });
  } else {
    const created = await db.event.create({ data: { ...data, qrSecret: randomBytes(32).toString("hex"), createdById: me.id } });
    eventId = created.id;
  }
  done(`/admin/events/${eventId}`);
}

export async function closeCheckin(eventId: string) {
  await admin();
  await db.event.update({ where: { id: eventId }, data: { closedAt: new Date() } });
  done(`/admin/events/${eventId}`);
}

export async function reopenCheckin(eventId: string) {
  await admin();
  await db.event.update({ where: { id: eventId }, data: { closedAt: null } });
  done(`/admin/events/${eventId}`);
}

export async function deleteEvent(eventId: string) {
  await admin();
  const stamps = await db.stamp.count({ where: { eventId } });
  if (stamps > 0) redirect(`/admin/events/${eventId}?error=has-stamps`);
  await db.event.delete({ where: { id: eventId } });
  done("/admin/events");
}

// ─── Manual stamps ─────────────────────────────────────────────────────────

/** For people who attended but couldn't scan. Always logged with the admin who added it. */
export async function addManualStamp(formData: FormData) {
  const me = await admin();
  const eventId = String(formData.get("eventId"));
  const employeeId = String(formData.get("employeeId"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || undefined;
  const returnTo = safeCallback(String(formData.get("returnTo") ?? ""), `/admin/events/${eventId}`);
  const result = await recordStamp({ employeeId, eventId, method: "manual", addedById: me.id, note });
  const sep = returnTo.includes("?") ? "&" : "?";
  done(`${returnTo}${sep}stamped=${result.status}`);
}

// ─── Rewards ───────────────────────────────────────────────────────────────

export async function markRedeemed(formData: FormData) {
  const me = await admin();
  const rewardId = String(formData.get("rewardId"));
  const returnTo = safeCallback(String(formData.get("returnTo") ?? ""), "/admin/rewards");
  // Conditional update: two people clicking at once can't redeem twice.
  const reward = await db.reward.findUnique({ where: { id: rewardId }, select: { employeeId: true, item: true } });
  const { count } = await db.reward.updateMany({ where: { id: rewardId, redeemedAt: null }, data: { redeemedAt: new Date(), redeemedById: me.id } });
  if (count && reward) await notifyCardChanged(reward.employeeId, { reason: "reward_redeemed", rewards: [reward.item] }).catch(() => {});
  done(returnTo);
}

export async function undoRedeemed(formData: FormData) {
  await admin();
  const rewardId = String(formData.get("rewardId"));
  const returnTo = safeCallback(String(formData.get("returnTo") ?? ""), "/admin/rewards");
  const reward = await db.reward.update({ where: { id: rewardId }, data: { redeemedAt: null, redeemedById: null } });
  await notifyCardChanged(reward.employeeId, { reason: "reward_redeemed" }).catch(() => {});
  done(returnTo);
}

// ─── Employees ─────────────────────────────────────────────────────────────

export async function setEmployeeTrack(formData: FormData) {
  await admin();
  const employeeId = String(formData.get("employeeId"));
  const trackId = String(formData.get("trackId"));
  const track = await db.rewardTrack.findUnique({ where: { id: trackId } });
  if (!track) redirect(`/admin/employees/${employeeId}?error=track`);
  await db.employee.update({ where: { id: employeeId }, data: { trackId } });
  await notifyCardChanged(employeeId, { reason: "track_changed" }).catch(() => {});
  done(`/admin/employees/${employeeId}?saved=track`);
}

// ─── Reward tracks & tiers (editable without a deploy) ─────────────────────

const tierSchema = z.object({
  id: z.string().uuid().optional(),
  trackId: z.string().uuid(),
  stampCount: z.coerce.number().int().min(1, "Stamp count must be 1–10").max(10, "Stamp count must be 1–10"),
  item: z.string().trim().min(2, "Name the reward").max(120),
  active: z.boolean(),
});

export async function saveTier(formData: FormData) {
  await admin();
  const parsed = tierSchema.safeParse({
    id: formData.get("id") || undefined,
    trackId: formData.get("trackId"),
    stampCount: formData.get("stampCount"),
    item: formData.get("item"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) redirect(`/admin/tiers?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the tier")}`);
  const { id, ...data } = parsed.data;

  const clash = await db.rewardTier.findFirst({ where: { trackId: data.trackId, stampCount: data.stampCount, NOT: id ? { id } : undefined } });
  if (clash) redirect(`/admin/tiers?error=${encodeURIComponent(`There's already a reward at ${data.stampCount} stamps on this track`)}`);

  if (id) await db.rewardTier.update({ where: { id }, data });
  else await db.rewardTier.create({ data });
  await notifyTrack(data.trackId);
  done("/admin/tiers?saved=1");
}

export async function deleteTier(formData: FormData) {
  await admin();
  const id = String(formData.get("id"));
  const tier = await db.rewardTier.delete({ where: { id } });
  await notifyTrack(tier.trackId);
  done("/admin/tiers?saved=1");
}

const trackSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name the track").max(40),
  description: z.string().trim().max(120).optional(),
});

export async function saveTrack(formData: FormData) {
  await admin();
  const parsed = trackSchema.safeParse({ id: formData.get("id") || undefined, name: formData.get("name"), description: formData.get("description") || undefined });
  if (!parsed.success) redirect(`/admin/tiers?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the track")}`);
  const { id, name, description } = parsed.data;
  if (id) {
    await db.rewardTrack.update({ where: { id }, data: { name, description: description ?? null } });
  } else {
    const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "track";
    const count = await db.rewardTrack.count();
    await db.rewardTrack.create({ data: { name, description, slug: `${base}-${randomBytes(2).toString("hex")}`, sortOrder: count + 1 } });
  }
  done("/admin/tiers?saved=1");
}

/** Tier changes alter "next reward" on every card in the track. */
async function notifyTrack(trackId: string) {
  const employees = await db.employee.findMany({ where: { trackId }, select: { id: true } });
  await Promise.all(employees.map((e) => notifyCardChanged(e.id, { reason: "track_changed" }).catch(() => {})));
}
