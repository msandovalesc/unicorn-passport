"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureWebPass } from "@/lib/card";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";

const schema = z.object({
  track: z.string().min(1),
  location: z.string().trim().max(80).optional(),
});

/** Enrollment step: employee picks Office/Remote (their reward track). Admins can change it later. */
export async function chooseTrack(formData: FormData) {
  const { employee } = await requireEmployee("/join");
  const parsed = schema.safeParse({ track: formData.get("track"), location: formData.get("location") || undefined });
  if (!parsed.success) redirect("/join?error=track");

  const track = await db.rewardTrack.findUnique({ where: { slug: parsed.data.track } });
  if (!track) redirect("/join?error=track");

  await db.employee.update({
    where: { id: employee.id },
    data: { trackId: track.id, location: parsed.data.location ?? employee.location },
  });
  await ensureWebPass(employee.id);
  redirect("/join?welcome=1");
}
