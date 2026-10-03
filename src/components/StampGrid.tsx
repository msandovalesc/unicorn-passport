import { CARD_SIZE } from "@/lib/progress";
import { BLUE_UNICORN, LIGHT_UNICORN } from "@/lib/unicorn";
import { Unicorn } from "./Unicorn";

/**
 * 10 stamp slots in 2 rows of 5. "onBlue": blue unicorn on light circles (card / blue screens).
 * "onLight": light unicorn on blue circles. `newStamp` (1-based) pops into its slot.
 */
export function StampGrid({
  stamps,
  variant = "onBlue",
  newStamp,
}: {
  stamps: number;
  variant?: "onBlue" | "onLight";
  newStamp?: number;
}) {
  const colors = variant === "onBlue" ? BLUE_UNICORN : LIGHT_UNICORN;
  return (
    <ol className={`stamps stamps--${variant}`} aria-label={`${stamps} of ${CARD_SIZE} stamps`}>
      {Array.from({ length: CARD_SIZE }, (_, i) => {
        const filled = i < stamps;
        const isNew = newStamp === i + 1;
        return (
          <li key={i} className={`stamp ${filled ? "is-filled" : "is-empty"} ${isNew ? "is-new" : ""}`} aria-hidden>
            {filled && <Unicorn colors={colors} />}
          </li>
        );
      })}
    </ol>
  );
}
