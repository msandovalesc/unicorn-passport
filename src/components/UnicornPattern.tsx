import { PATTERN_TILE } from "@/lib/pattern";

/**
 * Background texture: scattered pixel unicorns in random sizes and angles at low opacity.
 * One pre-rendered tile (public/brand/unicorn-pattern.svg, from `npm run assets:stamps`) in which
 * no unicorns overlap; it repeats seamlessly. `seed` shifts the tile so screens don't all look
 * identical. Use only on dark/blue screens, never behind dense text, tables or forms.
 */
export function UnicornPattern({ seed = 0 }: { seed?: number }) {
  const x = (seed * 211) % PATTERN_TILE.width;
  const y = (seed * 337) % PATTERN_TILE.height;
  return (
    <div
      className="unicorn-pattern"
      aria-hidden
      style={{
        backgroundImage: "url(/brand/unicorn-pattern.svg)",
        backgroundSize: `${PATTERN_TILE.width}px ${PATTERN_TILE.height}px`,
        backgroundPosition: `-${x}px -${y}px`,
      }}
    />
  );
}
