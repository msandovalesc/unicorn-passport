/**
 * Card progress maths. Pure functions: everything is derived from the total stamp count,
 * which itself always comes from the stamps table.
 *
 * Cards hold 10 stamps. When a card is full it stays at 10/10 (so the employee sees the
 * completed card) until the next stamp, which starts card #2 at 1/10.
 */
export const CARD_SIZE = 10;

export type Tier = { stampCount: number; item: string };

export type CardProgress = {
  totalStamps: number;
  cardNumber: number;     // 1-based
  stampsOnCard: number;   // 0..10
  isComplete: boolean;
  nextReward: { item: string; stampCount: number; stampsToGo: number; onNextCard: boolean } | null;
  unlockedTiers: Tier[];  // tiers reached on the current card
};

export function cardPosition(totalStamps: number): { cardNumber: number; stampsOnCard: number } {
  if (!Number.isInteger(totalStamps) || totalStamps < 0) throw new Error("totalStamps must be a non-negative integer");
  if (totalStamps === 0) return { cardNumber: 1, stampsOnCard: 0 };
  return {
    cardNumber: Math.ceil(totalStamps / CARD_SIZE),
    stampsOnCard: ((totalStamps - 1) % CARD_SIZE) + 1,
  };
}

export function cardProgress(totalStamps: number, tiers: Tier[]): CardProgress {
  const { cardNumber, stampsOnCard } = cardPosition(totalStamps);
  const sorted = tiers
    .filter((t) => t.stampCount >= 1 && t.stampCount <= CARD_SIZE)
    .sort((a, b) => a.stampCount - b.stampCount);

  const upcoming = sorted.find((t) => t.stampCount > stampsOnCard);
  let nextReward: CardProgress["nextReward"] = null;
  if (upcoming) {
    nextReward = { ...upcoming, stampsToGo: upcoming.stampCount - stampsOnCard, onNextCard: false };
  } else if (sorted.length > 0) {
    const first = sorted[0];
    nextReward = { ...first, stampsToGo: CARD_SIZE - stampsOnCard + first.stampCount, onNextCard: true };
  }

  return {
    totalStamps,
    cardNumber,
    stampsOnCard,
    isComplete: stampsOnCard === CARD_SIZE,
    nextReward,
    unlockedTiers: sorted.filter((t) => t.stampCount <= stampsOnCard),
  };
}

/** Tiers newly reached when the total goes from `before` to `after` (usually after = before + 1). */
export function tiersReachedBetween(before: number, after: number, tiers: Tier[]): Array<Tier & { cardNumber: number }> {
  const reached: Array<Tier & { cardNumber: number }> = [];
  for (let n = before + 1; n <= after; n++) {
    const { cardNumber, stampsOnCard } = cardPosition(n);
    for (const t of tiers) if (t.stampCount === stampsOnCard) reached.push({ ...t, cardNumber });
  }
  return reached;
}
