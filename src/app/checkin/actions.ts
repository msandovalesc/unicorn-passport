"use server";

import { redirect } from "next/navigation";
import { checkInWithCode } from "@/lib/checkin/service";
import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { requireEmployee } from "@/lib/session";
import { resultPath } from "@/lib/urls";

/** Typed code for single-device users at virtual events. */
export async function submitCode(formData: FormData) {
  const { employee } = await requireEmployee("/checkin");
  if (!employee.trackId) redirect(`/join?next=${encodeURIComponent("/checkin")}`);

  const rl = await rateLimit(`code:emp:${employee.id}`, LIMITS.codePerEmployee.limit, LIMITS.codePerEmployee.windowMs);
  if (!rl.ok) redirect(resultPath("rate_limited"));

  const result = await checkInWithCode(employee.id, String(formData.get("code") ?? ""));
  if (result.status === "invalid") redirect("/checkin?error=code");
  redirect(resultPath(result.status, result.eventId));
}
