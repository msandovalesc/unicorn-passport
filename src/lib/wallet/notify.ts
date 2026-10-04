import { db } from "@/lib/db";

export type CardChange = { reason: "stamp" | "reward_unlocked" | "reward_redeemed" | "track_changed"; rewards?: string[] };

/**
 * Single fan-out point for "this employee's card changed". Bumps passes.updated_at, which the
 * Apple PassKit web service uses for "list updated passes".
 * Milestone 3 adds: APNs push to registered Apple devices and a PATCH of the Google loyalty object
 * (with a message when a reward unlocks).
 */
export async function notifyCardChanged(employeeId: string, change: CardChange): Promise<void> {
  await db.pass.updateMany({ where: { employeeId }, data: { updatedAt: new Date() } });
  if (process.env.NODE_ENV !== "test") {
    console.info(`[wallet] card changed employee=${employeeId} reason=${change.reason}${change.rewards?.length ? ` rewards=${change.rewards.join("|")}` : ""}`);
  }
}
