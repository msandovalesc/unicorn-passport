/**
 * Pre-renders the wallet images (wallet passes cannot draw a custom grid):
 *  - 11 Apple strip images (0..10 stamps) at @1x/@2x/@3x
 *  - 11 Google hero images
 *  - brand assets: Unicorn Passport logos/icons (from assets/brand/unicorn-passport) for passes and the web app
 * Output: public/wallet (served publicly; Google fetches images by URL) and public/brand.
 * Run: npm run assets:stamps
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { STRIP_SIZES, stampStripSvg } from "../src/lib/stampStrip";
import { ART_VIEWBOX, BLUE_UNICORN, BRAND, LIGHT_UNICORN, unicornPaths, unicornSvg } from "../src/lib/unicorn";
import { unicornPatternSvg } from "../src/lib/pattern";
import { OUTLINE_PATH, OUTLINE_VIEWBOX } from "../src/lib/unicornOutline";

const root = path.resolve(__dirname, "..");
const walletDir = path.join(root, "public", "wallet");
const brandDir = path.join(root, "public", "brand");

const png = (svg: string, file: string) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);

function recolor(svg: string, color: string) {
  return svg.replace(/fill="black"/g, `fill="${color}"`);
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
  // Non-overlapping background tile for dark/blue screens.
  await fs.writeFile(path.join(brandDir, "unicorn-pattern.svg"), unicornPatternSvg());

  // Outline unicorn (vector, ® removed) for other uses: slides, emails, print.
  for (const [name, color] of [["blue", BRAND.blue500], ["light", BRAND.light], ["dark", BRAND.dark]] as const) {
    await fs.writeFile(path.join(brandDir, `unicorn-outline-${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${OUTLINE_VIEWBOX}" width="300" height="300"><path d="${OUTLINE_PATH}" fill="${color}"/></svg>`);
  }

  // Logos: white on blue (wallet card), white and dark (web).
  const imagotype = await fs.readFile(path.join(root, "assets", "brand", "imagotype.svg"), "utf8");
  await fs.writeFile(path.join(brandDir, "imagotype-white.svg"), recolor(imagotype, BRAND.white));
  await fs.writeFile(path.join(brandDir, "imagotype-dark.svg"), recolor(imagotype, BRAND.dark));

  // ── Unicorn Passport program logos (designed in Claude Design; sources in assets/brand/unicorn-passport).
  const up = path.join(root, "assets", "brand", "unicorn-passport");

  // Apple Wallet logo.png / icon.png come pre-sized (160×50 and 29×29 pt at @1x/@2x/@3x).
  // The card is blue, so use the "dark" set (white wordmark).
  for (const suffix of ["", "@2x", "@3x"]) {
    await fs.copyFile(path.join(up, "wallet-dark-pass", `logo${suffix}.png`), path.join(walletDir, `logo${suffix}.png`));
    await fs.copyFile(path.join(up, "wallet-dark-pass", `icon${suffix}.png`), path.join(walletDir, `icon${suffix}.png`));
    // unosquare wordmark in white, in case the pass shows both marks.
    await sharp(Buffer.from(recolor(imagotype, BRAND.white)))
      .resize({ width: 160 * (suffix ? Number(suffix[1]) : 1) })
      .png()
      .toFile(path.join(walletDir, `unosquare-logo${suffix}.png`));
  }

  // Google program logo: square, min 660×660 (shown as a circle). Upscaled from the 512 icon.
  await sharp(path.join(up, "unicorn-passport-icon-512.png")).resize(660, 660, { kernel: "lanczos3" }).png().toFile(path.join(walletDir, "google-program-logo.png"));

  // Web: wordmarks sized for retina headers, and the app icons.
  for (const tone of ["light", "dark"] as const) {
    await sharp(path.join(up, `unicorn-passport-logo-${tone}.png`)).resize({ width: 960 }).png({ compressionLevel: 9 }).toFile(path.join(brandDir, `unicorn-passport-${tone}.png`));
  }
  await sharp(path.join(up, "unicorn-passport-icon-512.png")).png().toFile(path.join(root, "src", "app", "icon.png"));
  await sharp(path.join(up, "unicorn-passport-icon-512.png")).resize(180, 180).png().toFile(path.join(root, "src", "app", "apple-icon.png"));

  console.log("Rendered 11 strip sets, 11 hero images, logos and icons.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
