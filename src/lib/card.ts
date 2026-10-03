import QRCode from "qrcode";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cardProgress } from "@/lib/progress";
import { randomToken } from "@/lib/tokens";

/** Every enrolled employee has a web pass; its card_token is what their card QR encodes. */
export async function ensureWebPass(employeeId: string) {
  return db.pass.upsert({
    where: { employeeId_platform: { employeeId, platform: "web" } },
    create: { employeeId, platform: "web", serialNumber: randomToken(), authToken: randomToken(), cardToken: randomToken() },
    update: {},
  });
}

/** Card QR content: an opaque URL. Scanning it opens the admin redeem screen (admins only). */
export function cardQrUrl(cardToken: string) {
  return `${env.APP_URL}/r/${cardToken}`;
}

export async function cardQrSvg(cardToken: string) {
  return QRCode.toString(cardQrUrl(cardToken), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#191919", light: "#FFFFFF" },
  });
}

/** Everything a card (web or wallet) needs to display. Stamp count always comes from the stamps table. */
export async function getCardState(employeeId: string) {
  const employee = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: { track: { include: { tiers: { where: { active: true }, orderBy: { stampCount: "asc" } } } } },
  });
  const totalStamps = await db.stamp.count({ where: { employeeId } });
  const tiers = employee.track?.tiers.map((t) => ({ stampCount: t.stampCount, item: t.item })) ?? [];
  const progress = cardProgress(totalStamps, tiers);
  const pendingRewards = await db.reward.findMany({
    where: { employeeId, redeemedAt: null },
    orderBy: { unlockedAt: "asc" },
  });
  return { employee, tiers, progress, pendingRewards };
}
