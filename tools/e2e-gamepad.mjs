// End-to-end check of the gamepad (docs/07 §12) with an emulated standard-mapping pad: A casts off, RB sets sail,
// the left stick steers, RT aims and fires, Menu opens the options and B backs out, the d-pad held opens a radial.
// Usage: node tools/e2e-gamepad.mjs [baseUrl] [outDir]
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
await page.addInitScript(() => {
  const pad = { id: 'Emulated Xbox pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  globalThis.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
});
const press = async (b, ms = 120) => {
  await page.evaluate((i) => { globalThis.__pad.buttons[i] = { pressed: true, touched: true, value: 1 }; }, b);
  await page.waitForTimeout(ms);
  await page.evaluate((i) => { globalThis.__pad.buttons[i] = { pressed: false, touched: false, value: 0 }; }, b);
  await page.waitForTimeout(150);
};
const stick = (axes) => page.evaluate((a) => { globalThis.__pad.axes = a; }, axes);

await page.goto(base);
await page.fill('#login-name', 'Pad ' + Math.random().toString(36).slice(2, 6));
await page.click('#login-form button');
await page.waitForSelector('#screen-captain:not(.hidden)', { timeout: 10000 });
await page.check('#know-sea');
await page.click('#pick-captain');
await page.waitForSelector('#hud:not(.hidden)', { timeout: 10000 });
await page.waitForTimeout(800);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if (await page.isVisible('#modal:not(.hidden)')) await page.keyboard.press('Escape');
// A: cast off (docked).
await press(0);
await page.waitForTimeout(600);
const docked = await page.evaluate(() => globalThis.gravetide.state.self?.dockedAt);
if (docked) fail('A should cast off');
// RB ×3: sail.
for (let i = 0; i < 3; i++) await press(5);
const sail = await page.evaluate(() => globalThis.gravetide.state.input.sail);
if (sail < 3) fail('RB should set sail, got ' + sail);
await page.waitForTimeout(2500);
// Left stick: the helm.
const h0 = await page.evaluate(() => globalThis.gravetide.state.ownDisplay.heading);
await stick([-1, 0, 0, 0]);
await page.waitForTimeout(1500);
await stick([0, 0, 0, 0]);
const h1 = await page.evaluate(() => globalThis.gravetide.state.ownDisplay.heading);
if (Math.abs(h1 - h0) < 0.05) fail('the left stick should steer');
// RT held: aim; the right stick ranges; release: the starboard broadside.
await page.evaluate(() => { globalThis.__pad.buttons[7] = { pressed: true, touched: true, value: 1 }; });
await stick([0, 0, 0, -0.8]);
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/pad-1-aim.png` });
await stick([0, 0, 0, 0]);
await page.evaluate(() => { globalThis.__pad.buttons[7] = { pressed: false, touched: false, value: 0 }; });
await page.waitForTimeout(400);
const reload = await page.evaluate(() => globalThis.gravetide.state.you?.reload?.starboard ?? globalThis.gravetide.state.you?.reloadStarboard ?? null);
// D-pad down held: the actions radial.
await page.evaluate(() => { globalThis.__pad.buttons[13] = { pressed: true, touched: true, value: 1 }; });
// Headless software rendering draws few frames a second: allow the hold a few of them.
const radialOpen = await page.waitForSelector('#radial:not(.hidden)', { timeout: 4000 }).then(() => true).catch(() => false);
await page.screenshot({ path: `${out}/pad-2-radial.png` });
await page.evaluate(() => { globalThis.__pad.buttons[13] = { pressed: false, touched: false, value: 0 }; });
await page.waitForTimeout(200);
if (!radialOpen) fail('holding d-pad down should open the actions radial');
// Menu: options; B: back.
await press(9);
if (!(await page.isVisible('.options'))) fail('Menu should open the options');
await stick([0.8, 0.3, 0, 0]);
await page.waitForTimeout(400);
await stick([0, 0, 0, 0]);
const cursor = await page.isVisible('#pad-cursor:not(.hidden)');
if (!cursor) fail('a virtual cursor in menus');
await page.screenshot({ path: `${out}/pad-3-menu.png` });
await press(1);
if (await page.isVisible('#modal:not(.hidden)')) fail('B should close the menu');
console.log(JSON.stringify({ sail, turned: h1 - h0, reload, radialOpen, errors }, null, 1));
if (errors.length) process.exitCode = 1;
await browser.close();
