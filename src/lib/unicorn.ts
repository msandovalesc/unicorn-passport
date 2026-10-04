/**
 * Unicorn pixel art (Unosquare cultural asset), drawn exactly as supplied (no ® in the source).
 * Two-tone: "mane" (mane, tail, ear tip) and "body" (body, legs and the segmented horn on top).
 * Original viewBox 0 0 300 300; the horn reaches y = 0, so ART_VIEWBOX keeps the full figure
 * with a little padding.
 */
export const MANE_PATHS = [
  "M40.0001 138.662V158.83H20V219.331H0V239.498H40.0001V219.331H60.0138L59.9999 158.83H79.9999V138.662H40.0001Z",
  "M200 57.994H180V98.3282H160V138.662H180V158.83H200V98.3282H220V57.994V37.8268H200V57.994Z",
  "M259.998 37.8268H239.999V57.994H259.998V37.8268Z",
];

export const BODY_PATHS = [
  "M240 199.164V219.331H260V259.666H240V279.833H260V259.666H280V199.164H240Z",
  "M140.014 239.498L140 259.665L140.014 279.833H140V300H159.999L159.985 259.665L159.999 239.498H140.014Z",
  "M280 78.1618V57.9947L239.999 57.994V37.8268L240 27.744H220L220 37.8268V57.994V98.3282H200V158.83H180V138.662L79.9999 138.662V158.83H59.9999L59.9999 219.332H79.9999V239.499H59.9999V300H79.9999V259.666H99.9999V219.332H200V300H220V199.165L240 199.151V98.3289H300V78.1618H280Z",
  // Horn segments
  "M232.5 17.66H220V22.7018H232.5V17.66Z",
  "M227.5 7.57668H225V0H220V12.6185H227.5V7.57668Z",
];

export const ART_VIEWBOX = "-8 -8 316 316";

export type UnicornColors = { body: string; mane: string };

export const BRAND = {
  blue500: "#0522DE",
  blue600: "#040FBC",
  blue400: "#2550F9",
  blue300: "#5A89FF",
  blue200: "#92B1FF",
  blue100: "#B0C9FF",
  yellow: "#FFD200",
  dark: "#191919",
  light: "#F6F5F1",
  white: "#FFFFFF",
  gray: "#E7E7E7",
} as const;

/** Light unicorn: for blue circles on dark/blue backgrounds. */
export const LIGHT_UNICORN: UnicornColors = { body: BRAND.light, mane: BRAND.blue200 };
/** Blue unicorn: for light circles (wallet card, light backgrounds). */
export const BLUE_UNICORN: UnicornColors = { body: BRAND.blue500, mane: BRAND.blue300 };

/** Inner SVG markup (paths only) for embedding in a larger SVG. */
export function unicornPaths(c: UnicornColors): string {
  return [
    ...MANE_PATHS.map((d) => `<path d="${d}" fill="${c.mane}"/>`),
    ...BODY_PATHS.map((d) => `<path d="${d}" fill="${c.body}"/>`),
  ].join("");
}

/** Standalone SVG string. */
export function unicornSvg(c: UnicornColors, size = 300): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ART_VIEWBOX}" width="${size}" height="${size}">${unicornPaths(c)}</svg>`;
}
