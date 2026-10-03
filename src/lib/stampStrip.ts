import { ART_VIEWBOX, BLUE_UNICORN, BRAND, LIGHT_UNICORN, unicornPaths, type UnicornColors } from "./unicorn";
import { CARD_SIZE } from "./progress";

export type StripTheme = "onBlue" | "onLight";

const THEMES: Record<StripTheme, { bg: string; filled: string; unicorn: UnicornColors; empty: string; emptyOpacity: number }> = {
  // Wallet card: blue background, light circles holding the blue unicorn.
  onBlue: { bg: BRAND.blue500, filled: BRAND.light, unicorn: BLUE_UNICORN, empty: BRAND.light, emptyOpacity: 0.55 },
  // Light pages: blue circles holding the light unicorn.
  onLight: { bg: BRAND.light, filled: BRAND.blue500, unicorn: LIGHT_UNICORN, empty: BRAND.blue500, emptyOpacity: 0.4 },
};

/**
 * SVG for a 2×5 stamp grid at an exact pixel size, used to pre-render the wallet strip
 * (Apple) and hero (Google) images. `stamps` is 0..10.
 */
export function stampStripSvg(opts: { stamps: number; width: number; height: number; theme?: StripTheme; transparent?: boolean }): string {
  const { width: W, height: H, theme = "onBlue", transparent = false } = opts;
  const stamps = Math.max(0, Math.min(CARD_SIZE, Math.floor(opts.stamps)));
  const t = THEMES[theme];

  const cols = 5;
  const rows = 2;
  const padY = H * 0.1;
  const gapRatio = 0.28; // gap as a fraction of diameter
  const dByH = (H - 2 * padY) / (rows + (rows - 1) * gapRatio);
  const dByW = (W * 0.86) / (cols + (cols - 1) * gapRatio);
  const d = Math.min(dByH, dByW);
  const gap = d * gapRatio;
  const gridW = cols * d + (cols - 1) * gap;
  const gridH = rows * d + (rows - 1) * gap;
  const x0 = (W - gridW) / 2;
  const y0 = (H - gridH) / 2;
  const stroke = Math.max(1.5, d * 0.05);
  const art = d * 0.62;
  const [vbX, vbY, vbW] = ART_VIEWBOX.split(" ").map(Number);
  const s = art / vbW;

  const slots: string[] = [];
  for (let i = 0; i < CARD_SIZE; i++) {
    const cx = x0 + (i % cols) * (d + gap) + d / 2;
    const cy = y0 + Math.floor(i / cols) * (d + gap) + d / 2;
    if (i < stamps) {
      slots.push(
        `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="${t.filled}"/>` +
          `<g transform="translate(${cx - art / 2 - vbX * s} ${cy - art / 2 - vbY * s}) scale(${s})">${unicornPaths(t.unicorn)}</g>`,
      );
    } else {
      slots.push(
        `<circle cx="${cx}" cy="${cy}" r="${d / 2 - stroke / 2}" fill="none" stroke="${t.empty}" stroke-opacity="${t.emptyOpacity}" stroke-width="${stroke}"/>`,
      );
    }
  }

  const bg = transparent ? "" : `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${slots.join("")}</svg>`;
}

/** Image sizes required by each wallet. */
export const STRIP_SIZES = {
  // Apple store card strip: 375×123 pt (@1x/@2x/@3x).
  apple: [
    { suffix: "", width: 375, height: 123 },
    { suffix: "@2x", width: 750, height: 246 },
    { suffix: "@3x", width: 1125, height: 369 },
  ],
  // Google loyalty hero image: 1032×336 recommended.
  google: { width: 1032, height: 336 },
} as const;
