import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Render the existing logo inside a padded SVG canvas. The supplied lettering stays unchanged.
const logo = (await readFile(new URL("../public/brand/samduk45-logo-v3.png", import.meta.url))).toString("base64");
for (const [name, size, inset] of [["192",192,.09],["512",512,.09],["maskable-512",512,.13],["apple-180",180,.09]]) {
  const width = 512 * (1 - 2 * inset), height = width;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#fff"/><image x="${(512-width)/2}" y="${(512-height)/2}" width="${width}" height="${height}" href="data:image/png;base64,${logo}"/></svg>`;
  await sharp(Buffer.from(svg)).resize(size,size).png().toFile(fileURLToPath(new URL(`../public/icons/45-logo-v3-${name}.png`, import.meta.url)));
}
