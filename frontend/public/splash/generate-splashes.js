/**
 * Splash screen generator — run once with: node generate-splashes.js
 * Requires: npm install canvas (optional — falls back to SVG stubs if unavailable)
 *
 * For CI/production, use pwa-asset-generator instead:
 *   npx pwa-asset-generator icon.svg ./splash --splash-only --background "#1d4ed8"
 */
const sizes = [
  [2048, 2732, "apple-splash-2048-2732"],
  [1668, 2388, "apple-splash-1668-2388"],
  [1290, 2796, "apple-splash-1290-2796"],
  [1179, 2556, "apple-splash-1179-2556"],
  [1170, 2532, "apple-splash-1170-2532"],
  [750,  1334, "apple-splash-750-1334"],
];

try {
  const { createCanvas } = require("canvas");
  const fs = require("fs");

  for (const [w, h, name] of sizes) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(0, 0, w, h);

    const r = Math.min(w, h) * 0.12;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.roundRect(w / 2 - r, h / 2 - r, r * 2, r * 2, r * 0.22);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${r * 1.1}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", w / 2, h / 2);

    fs.writeFileSync(`${name}.png`, canvas.toBuffer("image/png"));
    console.log(`✓ ${name}.png`);
  }
} catch {
  // canvas not installed — write minimal 1x1 placeholder PNGs
  const fs = require("fs");
  // Minimal valid 1×1 transparent PNG (base64)
  const TINY_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  for (const [,, name] of sizes) {
    fs.writeFileSync(`${name}.png`, TINY_PNG);
    console.log(`(stub) ${name}.png`);
  }
}
