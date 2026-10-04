import { LIGHT_UNICORN, unicornPaths, type UnicornColors } from "./unicorn";

/** Small deterministic PRNG so the tile is identical on every build. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PlacedUnicorn = { cx: number; cy: number; size: number; rotate: number; flip: boolean; opacity: number };

/**
 * Places unicorns of random size and angle so that none overlap and none cross the tile edge,
 * which makes the tile repeat seamlessly. Each unicorn is treated as a circle around its rotated
 * square (radius ≈ 0.72 × size), and circles are kept `gap` px apart.
 */
export function placeUnicorns(opts: {
  width: number;
  height: number;
  count: number;
  minSize: number;
  maxSize: number;
  gap: number;
  seed: number;
  opacity: [number, number];
}): PlacedUnicorn[] {
  const rand = mulberry32(opts.seed);
  // Place the big ones first; small ones fill the gaps.
  const sizes = Array.from({ length: opts.count }, () => opts.minSize + rand() * (opts.maxSize - opts.minSize)).sort((a, b) => b - a);
  const placed: PlacedUnicorn[] = [];

  for (const size of sizes) {
    const r = size * 0.72;
    const edge = r + opts.gap / 2;
    for (let attempt = 0; attempt < 600; attempt++) {
      const cx = edge + rand() * (opts.width - 2 * edge);
      const cy = edge + rand() * (opts.height - 2 * edge);
      const clear = placed.every((p) => Math.hypot(p.cx - cx, p.cy - cy) >= p.size * 0.72 + r + opts.gap);
      if (clear) {
        placed.push({
          cx,
          cy,
          size,
          rotate: -35 + rand() * 70,
          flip: rand() > 0.6,
          opacity: opts.opacity[0] + rand() * (opts.opacity[1] - opts.opacity[0]),
        });
        break;
      }
    }
  }
  return placed;
}

export const PATTERN_TILE = { width: 640, height: 960 } as const;

/** Repeating background tile for dark/blue screens. */
export function unicornPatternSvg(colors: UnicornColors = LIGHT_UNICORN, seed = 7): string {
  const { width, height } = PATTERN_TILE;
  const unicorns = placeUnicorns({ width, height, count: 13, minSize: 40, maxSize: 160, gap: 28, seed, opacity: [0.05, 0.13] });
  const paths = unicornPaths(colors);
  const groups = unicorns
    .map((u) => {
      const s = u.size / 300;
      return `<g opacity="${u.opacity.toFixed(3)}" transform="translate(${u.cx.toFixed(1)} ${u.cy.toFixed(1)}) rotate(${u.rotate.toFixed(1)}) scale(${(u.flip ? -s : s).toFixed(4)} ${s.toFixed(4)}) translate(-150 -150)">${paths}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${groups}</svg>`;
}
