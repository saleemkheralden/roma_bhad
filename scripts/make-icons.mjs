// Renders Roma's app icons from HTML with the installed Chrome (playwright-core).
// The mark: board navy ground, the letter ר in Heebo 800 in "now" amber, with the
// amber underline the app uses for the live count. Content stays inside the
// central 80% so the same image works as a maskable icon.
// Usage: node scripts/make-icons.mjs
// Afterwards re-embed provenance (re-rendering drops it):
//   .claude/skills/impeccable/scripts/impeccable embed-prompt <file> --prompt "Origin: rendered by scripts/make-icons.mjs ..."
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const html = (size) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@800&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:${size}px;height:${size}px;background:#0e1b33;overflow:hidden}
  .mark{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .letter{font:800 ${Math.round(size * 0.66)}px/0.62 Heebo,sans-serif;color:#f2a900}
  .rule{width:${Math.round(size * 0.4)}px;height:${Math.max(3, Math.round(size * 0.055))}px;background:#f2a900;margin-top:${Math.round(size * 0.07)}px}
</style></head><body><div class="mark"><div class="letter">ר</div><div class="rule"></div></div></body></html>`;

const targets = [
  { size: 512, path: "public/icons/icon-512.png" },
  { size: 192, path: "public/icons/icon-192.png" },
  { size: 180, path: "src/app/apple-icon.png" },
  { size: 64, path: "src/app/icon.png" },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const { size, path } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(html(size), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path, omitBackground: false });
    await page.close();
    console.log(`wrote ${path} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
