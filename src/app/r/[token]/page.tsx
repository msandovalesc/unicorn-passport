import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * Target of the employee card QR. Admin-only: resolves the opaque card token to the employee
 * and sends the merch owner to their record to mark rewards redeemed (built in Milestone 4).
 * Non-admins are sent to the home page; signed-out visitors are asked to sign in first.
 */
export default async function CardTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireAdmin(`/r/${token}`);
  const pass = await db.pass.findUnique({ where: { cardToken: token }, select: { employeeId: true } });
  if (!pass) notFound();
  redirect(`/admin/employees/${pass.employeeId}?scanned=1`);
}
