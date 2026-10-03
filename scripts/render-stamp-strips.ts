/**
 * Pre-renders the wallet images (wallet passes cannot draw a custom grid):
 *  - 11 Apple strip images (0..10 stamps) at @1x/@2x/@3x
 *  - 11 Google hero images
 *  - brand assets: logos and unicorn icons for passes and the web app
 * Output: public/wallet (served publicly; Google fetches images by URL) and public/brand.
 * Run: npm run assets:stamps
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { STRIP_SIZES, stampStripSvg } from "../src/lib/stampStrip";
import { ART_VIEWBOX, BLUE_UNICORN, BRAND, LIGHT_UNICORN, unicornPaths, unicornSvg } from "../src/lib/unicorn";

const root = path.resolve(__dirname, "..");
const walletDir = path.join(root, "public", "wallet");
const brandDir = path.join(root, "public", "brand");

const png = (svg: string, file: string) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);

function recolor(svg: string, color: string) {
  return svg.replace(/fill="black"/g, `fill="${color}"`);
}

/** Unicorn centred in a filled circle (square image). */
function unicornBadge(size: number, circle: string, colors: typeof LIGHT_UNICORN, bg?: string) {
  const art = size * 0.62;
  const [vbX, vbY, vbW] = ART_VIEWBOX.split(" ").map(Number);
  const s = art / vbW;
  const c = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}<circle cx="${c}" cy="${c}" r="${c}" fill="${circle}"/><g transform="translate(${c - art / 2 - vbX * s} ${c - art / 2 - vbY * s}) scale(${s})">${unicornPaths(colors)}</g></svg>`;
}

async function main() {
  await fs.mkdir(path.join(walletDir, "strips"), { recursive: true });
  await fs.mkdir(path.join(walletDir, "hero"), { recursive: true });
  await fs.mkdir(brandDir, { recursive: true });

  for (let n = 0; n <= 10; n++) {
    for (const size of STRIP_SIZES.apple) {
      await png(stampStripSvg({ stamps: n, width: size.width, height: size.height }), path.join(walletDir, "strips", `strip-${n}${size.suffix}.png`));
    }
    const g = STRIP_SIZES.google;
    await png(stampStripSvg({ stamps: n, width: g.width, height: g.height }), path.join(walletDir, "hero", `hero-${n}.png`));
  }

  // Unicorn source files for the web app.
  await fs.writeFile(path.join(brandDir, "unicorn-light.svg"), unicornSvg(LIGHT_UNICORN));
  await fs.writeFile(path.join(brandDir, "unicorn-blue.svg"), unicornSvg(BLUE_UNICORN));

  // Logos: white on blue (wallet card), white and dark (web).
  const imagotype = await fs.readFile(path.join(root, "assets", "brand", "imagotype.svg"), "utf8");
  await fs.writeFile(path.join(brandDir, "imagotype-white.svg"), recolor(imagotype, BRAND.white));
  await fs.writeFile(path.join(brandDir, "imagotype-dark.svg"), recolor(imagotype, BRAND.dark));

  // Apple logo.png: max 160×50 pt. The imagotype is 284×80 → 160×45.
  for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]] as const) {
    await sharp(Buffer.from(recolor(imagotype, BRAND.white))).resize({ width: 160 * scale }).png().toFile(path.join(walletDir, `logo${suffix}.png`));
    // Apple icon.png: 29×29 pt, shown on the lock screen and in notifications.
    await png(unicornBadge(29 * scale, BRAND.blue500, LIGHT_UNICORN, BRAND.blue500), path.join(walletDir, `icon${suffix}.png`));
  }

  // Google program logo: square, min 660×660 (displayed as a circle).
  await png(unicornBadge(660, BRAND.blue500, LIGHT_UNICORN), path.join(walletDir, "google-program-logo.png"));

  // Web app icons.
  await png(unicornBadge(512, BRAND.blue500, LIGHT_UNICORN, BRAND.blue500), path.join(root, "src", "app", "icon.png"));
  await png(unicornBadge(180, BRAND.blue500, LIGHT_UNICORN, BRAND.blue500), path.join(root, "src", "app", "apple-icon.png"));

  console.log("Rendered 11 strip sets, 11 hero images, logos and icons.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
