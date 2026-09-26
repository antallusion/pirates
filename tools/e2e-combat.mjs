// Combat screenshots against tools/showcase-server.ts: undock → staged into Gravewater → fight.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const base = process.argv[2] ?? 'http://localhost:8091';
const out = process.argv[3] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.fill('#login-name', 'Showcase ' + Math.random().toString(36).slice(2, 5));
await page.click('#login-form button');
await page.waitForSelector('#screen-captain:not(.hidden)');
await page.click('.captain-card[data-id="corsair"]');
await page.check('#know-sea');
await page.click('#pick-captain');
await page.waitForSelector('#hud:not(.hidden)');
await page.waitForTimeout(600);
await page.keyboard.press('Escape');
await page.keyboard.press('f');
await page.waitForTimeout(1500);
await page.keyboard.press('w');
await page.evaluate(() => { globalThis.gravetide.renderer.targetZoom = 1.6; });
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1500);
  // Aim at the nearest hostile and fire the side facing it.
  const aim = await page.evaluate(() => {
    const { state, renderer } = globalThis.gravetide;
    const own = state.ownDisplay;
    let best = null, bd = 1e9;
    for (const s of state.ships.values()) {
      const d = Math.hypot(s.cur.x - own.x, s.cur.y - own.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return null;
    return { x: renderer.sx(best.cur.x), y: renderer.sy(best.cur.y), d: bd };
  });
  if (aim) {
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down();
    await page.mouse.up();
  }
  if (i === 4) await page.keyboard.press('2');
  if (i === 7) await page.keyboard.press('1');
  if (i === 3 || i === 8 || i === 11) await page.screenshot({ path: `${out}/combat-${i}.png` });
}
console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
