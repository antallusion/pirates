// End-to-end smoke test in a real browser (Playwright/Chromium): login → captain → port → sail → fire.
// Usage: node tools/e2e.mjs [baseUrl] [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const base = process.argv[2] ?? 'http://localhost:8080';
const out = process.argv[3] ?? 'screenshots';
mkdirSync(out, { recursive: true });

const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text());
});

await page.goto(base);
await page.fill('#login-name', 'Tester ' + Math.random().toString(36).slice(2, 6));
await page.screenshot({ path: `${out}/01-login.png` });
await page.click('#login-form button');
await page.waitForSelector('#screen-captain:not(.hidden)', { timeout: 10000 });
await page.click('.captain-card[data-id="reaver"]');
await page.screenshot({ path: `${out}/02-captain.png` });
await page.check('#know-sea');
await page.click('#pick-captain');
await page.waitForSelector('#hud:not(.hidden)', { timeout: 10000 });
await page.waitForTimeout(800);
await page.keyboard.press('Escape'); // help
await page.waitForTimeout(500);
if (await page.isVisible('#modal:not(.hidden)')) await page.screenshot({ path: `${out}/03-port.png` });
await page.click('#modal-panel [data-ptab="sea"]', { timeout: 3000 }).catch(() => page.keyboard.press('f'));
await page.waitForTimeout(500);
await page.keyboard.press('w');
await page.keyboard.press('w');
await page.keyboard.down('d');
await page.waitForTimeout(1500);
await page.keyboard.up('d');
await page.waitForTimeout(4000);
await page.mouse.move(1100, 450);
await page.keyboard.press('e');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/04-sea.png` });
await page.keyboard.press('m');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/05-map.png` });
await page.keyboard.press('m');
await page.keyboard.press('t');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/06-talents.png` });
await page.keyboard.press('t');
await page.evaluate(() => { globalThis.gravetide.renderer.targetZoom = 0.5; });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/07-zoomed-out.png` });
const stats = await page.evaluate(() => {
  const s = globalThis.gravetide.state;
  return { ships: s.ships.size, islands: s.islands.size, you: s.you && { x: Math.round(s.you.x), y: Math.round(s.you.y), spd: s.you.spd }, region: s.region };
});
console.log(JSON.stringify({ stats, errors }, null, 2));
await browser.close();
