// End-to-end check of the First Watch (docs/07 §13): the prologue, the reduced HUD, the step panel, a step done
// by sailing, the next block drawing in, a skipped step, and the whole watch skipped to the full HUD and goals.
// Usage: node tools/e2e-onboarding.mjs [baseUrl] [outDir]
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
const fail = (msg) => {
  console.error('FAIL: ' + msg);
  process.exitCode = 1;
};

await page.goto(base);
await page.fill('#login-name', 'Novice ' + Math.random().toString(36).slice(2, 6));
await page.click('#login-form button');
await page.waitForSelector('#screen-captain:not(.hidden)', { timeout: 10000 });
await page.click('.captain-card[data-id="corsair"]');
await page.click('#pick-captain');
await page.waitForSelector('#prologue:not(.hidden)', { timeout: 10000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/onb-1-prologue.png` });
await page.click('#prologue');
await page.waitForSelector('#prologue.hidden', { state: 'attached', timeout: 5000 });
await page.waitForSelector('#hud-watch:not(.hidden)', { timeout: 5000 });
await page.keyboard.press('Escape'); // the harbour screen
const reduced = await page.evaluate(() => ({
  combat: document.getElementById('hud-combat').classList.contains('tut-hidden'),
  map: document.getElementById('hud-map').classList.contains('tut-hidden'),
  ship: document.getElementById('hud-ship').classList.contains('tut-hidden'),
}));
if (!reduced.combat || !reduced.map || reduced.ship) fail('the HUD should start with the ship and the binnacle only: ' + JSON.stringify(reduced));
await page.screenshot({ path: `${out}/onb-2-cast-off.png` });
// Cast off and make way.
await page.keyboard.press('f');
await page.waitForTimeout(500);
for (let i = 0; i < 3; i++) await page.keyboard.press('w');
await page.waitForFunction(() => /2\/7/.test(document.getElementById('hud-watch').textContent), null, { timeout: 30000 }).catch(() => fail('casting off did not finish the first step'));
const cargoIn = await page.evaluate(() => !document.getElementById('hud-captain').classList.contains('tut-hidden'));
if (!cargoIn) fail('the captain block should draw in at the first trade');
await page.screenshot({ path: `${out}/onb-3-first-trade.png` });
// Skip a step.
await page.click('#hud-watch [data-a="skip_stage"]');
await page.waitForFunction(() => !/2\/7/.test(document.getElementById('hud-watch').textContent), null, { timeout: 5000 }).catch(() => fail('skip step'));
// Skip the whole watch: the full HUD and the Captain's Goals.
await page.click('#hud-watch [data-a="skip_all"]');
await page.waitForSelector('#hud-watch.hidden', { state: 'attached', timeout: 5000 }).catch(() => fail('skip the watch'));
await page.waitForSelector('#hud-goals:not(.hidden)', { timeout: 5000 }).catch(() => fail('no goals after the watch'));
const full = await page.evaluate(() => document.querySelectorAll('#hud .tut-hidden').length);
if (full) fail(`${full} HUD blocks still hidden after the watch`);
await page.keyboard.press('h');
await page.waitForTimeout(400);
const logbook = await page.evaluate(() => document.getElementById('modal-panel').textContent);
if (!/Logbook|Судовой журнал/.test(logbook)) fail('no logbook in the handbook');
await page.screenshot({ path: `${out}/onb-4-goals.png` });
console.log(JSON.stringify({ reduced, goals: await page.textContent('#hud-goals'), errors }, null, 1));
if (errors.length) process.exitCode = 1;
await browser.close();
