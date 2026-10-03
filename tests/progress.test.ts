import { describe, expect, it } from "vitest";
import { cardPosition, cardProgress, tiersReachedBetween } from "@/lib/progress";

const tiers = [
  { stampCount: 5, item: "Sticker pack" },
  { stampCount: 10, item: "Hoodie" },
];

describe("cardPosition", () => {
  it.each([
    [0, 1, 0],
    [1, 1, 1],
    [9, 1, 9],
    [10, 1, 10],
    [11, 2, 1],
    [20, 2, 10],
    [21, 3, 1],
  ])("%i stamps → card %i, %i on card", (total, card, onCard) => {
    expect(cardPosition(total)).toEqual({ cardNumber: card, stampsOnCard: onCard });
  });

  it("rejects negative counts", () => {
    expect(() => cardPosition(-1)).toThrow();
  });
});

describe("cardProgress", () => {
  it("points to the first tier on a fresh card", () => {
    const p = cardProgress(0, tiers);
    expect(p.nextReward).toMatchObject({ item: "Sticker pack", stampsToGo: 5, onNextCard: false });
    expect(p.unlockedTiers).toEqual([]);
  });

  it("keeps a full card at 10/10 and points to the next card's first tier", () => {
    const p = cardProgress(10, tiers);
    expect(p.isComplete).toBe(true);
    expect(p.unlockedTiers.map((t) => t.stampCount)).toEqual([5, 10]);
    expect(p.nextReward).toMatchObject({ item: "Sticker pack", stampsToGo: 5, onNextCard: true });
  });

  it("restarts after 10", () => {
    const p = cardProgress(12, tiers);
    expect(p).toMatchObject({ cardNumber: 2, stampsOnCard: 2, isComplete: false });
    expect(p.nextReward).toMatchObject({ item: "Sticker pack", stampsToGo: 3 });
  });

  it("supports a remote track with earlier tiers", () => {
    const remote = [{ stampCount: 3, item: "Mug" }, { stampCount: 6, item: "Tote" }, { stampCount: 10, item: "Hoodie" }];
    expect(cardProgress(4, remote).nextReward).toMatchObject({ item: "Tote", stampsToGo: 2 });
  });

  it("handles no tiers", () => {
    expect(cardProgress(3, []).nextReward).toBeNull();
  });
});

describe("tiersReachedBetween", () => {
  it("unlocks the tier on the stamp that reaches it", () => {
    expect(tiersReachedBetween(4, 5, tiers)).toEqual([{ stampCount: 5, item: "Sticker pack", cardNumber: 1 }]);
    expect(tiersReachedBetween(5, 6, tiers)).toEqual([]);
  });

  it("unlocks again on the next card", () => {
    expect(tiersReachedBetween(14, 15, tiers)).toEqual([{ stampCount: 5, item: "Sticker pack", cardNumber: 2 }]);
    expect(tiersReachedBetween(19, 20, tiers)).toEqual([{ stampCount: 10, item: "Hoodie", cardNumber: 2 }]);
  });
});
