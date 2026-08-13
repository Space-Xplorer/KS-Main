/**
 * One-off: convert the source event posters to web-sized WebP.
 *
 * The originals are 1.5–6 MB PNGs (~36 MB total). Committing those would make
 * the repo heavy and the page unusable on venue mobile data.
 */
import sharp from "sharp";
import { stat } from "node:fs/promises";
import path from "node:path";

const SRC = process.argv[2] ?? "C:/Users/mahes/Downloads/Marykate";
const OUT = "public/posters";

const MAP = {
  "1.png": "escape-room",
  "2.png": "battle-of-brands",
  "3.png": "cosmic-clash",
  "4.png": "investors-roulette",
  "5.png": "orbital-defence",
  "6.png": "design-your-spacecraft",
  "7.png": "guest-lecture",
  "8.png": "elevator-pitch",
  "9.png": "sell-the-secret",
  "CELLESTRA.png": "celestra-banner",
};

let before = 0;
let after = 0;

for (const [file, slug] of Object.entries(MAP)) {
  const src = path.join(SRC, file);
  const meta = await sharp(src).metadata();
  before += (await stat(src)).size;

  const out = path.join(OUT, `${slug}.webp`);
  await sharp(src)
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(out);

  const o = await sharp(out).metadata();
  after += (await stat(out)).size;
  console.log(
    `${file.padEnd(16)} -> ${slug.padEnd(24)} ${meta.width}x${meta.height} -> ${o.width}x${o.height}`,
  );
}

console.log(`\ntotal: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
