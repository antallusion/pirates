// End-to-end check of the options (docs/07 §11): Esc opens them at sea, a rebound key steers, Russian, colour-blind
// and high-contrast classes land on the page, a clash is flagged.
// Usage: node tools/e2e-options.mjs [baseUrl] [outDir]
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
await page.evaluate(() => localStorage.clear());
await page.fill('#login-name', 'Options ' + Math.random().toString(36).slice(2, 6));
await page.click('#login-form button');
await page.waitForSelector('#screen-captain:not(.hidden)', { timeout: 10000 });
await page.check('#know-sea');
await page.click('#pick-captain');
await page.waitForSelector('#hud:not(.hidden)', { timeout: 10000 });
await page.waitForTimeout(800);
await page.keyboard.press('Escape'); // the handbook
await page.waitForTimeout(300);
if (await page.isVisible('#modal:not(.hidden)')) await page.keyboard.press('Escape'); // the harbour
await page.keyboard.press('f');
await page.waitForTimeout(800);
await page.keyboard.press('Escape');
await page.waitForSelector('.options', { timeout: 3000 }).catch(() => fail('Esc at sea should open the options'));
// Controls: bind "Helm to port" to J — which clashes with the formation signal.
await page.click('[data-tab="controls"]');
await page.click('[data-bind="rudderLeft:1"]');
await page.keyboard.press('j');
await page.waitForTimeout(200);
const clash = await page.$$eval('.bind.clash', (els) => els.length);
if (clash < 2) fail('a doubly bound key should be flagged');
await page.screenshot({ path: `${out}/opt-1-controls.png` });
await page.click('[data-preset="arrows"]');
// Interface: Russian, high contrast; vision: tritanopia.
await page.click('[data-tab="ui"]');
await page.selectOption('select[data-sel="lang"]', 'ru');
await page.waitForTimeout(200);
const title = await page.textContent('#modal-panel h2');
if (!/Настройки/.test(title)) fail('the options should speak Russian: ' + title);
await page.check('input[data-bool="highContrast"]');
await page.click('[data-tab="vision"]');
await page.selectOption('select[data-sel="colorblind"]', 'tritan');
await page.check('input[data-bool="lanternMarks"]');
await page.click('[data-tab="sound"]');
await page.check('input[data-bool="captions"]');
await page.screenshot({ path: `${out}/opt-2-sound-ru.png` });
const classes = await page.evaluate(() => document.body.className);
if (!/hi-contrast/.test(classes) || !/cb-tritan/.test(classes)) fail('body classes: ' + classes);
await page.keyboard.press('Escape');
// The arrows preset steers with the arrow keys; the compass speaks Russian.
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(3000);
const h0 = await page.evaluate(() => globalThis.gravetide.state.ownDisplay?.heading ?? 0);
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(1500);
await page.keyboard.up('ArrowLeft');
const h1 = await page.evaluate(() => globalThis.gravetide.state.ownDisplay?.heading ?? 0);
if (Math.abs(h1 - h0) < 0.02) fail('the arrow preset should put the helm over: ' + JSON.stringify(await page.evaluate(() => ({ d: globalThis.gravetide.state.self?.dockedAt, own: globalThis.gravetide.state.ownDisplay, input: globalThis.gravetide.state.input, modal: !document.getElementById('modal').classList.contains('hidden') && document.querySelector('#modal-panel h2')?.textContent, km: JSON.parse(localStorage.getItem('gravetide.settings')).keys.rudderLeft }))));
const nav = await page.textContent('#nav-text');
if (!/Ветер/.test(nav)) fail('the binnacle should speak Russian: ' + nav);
await page.screenshot({ path: `${out}/opt-3-sea.png` });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gravetide.settings')));
if (saved.colorblind !== 'tritan' || saved.keys.rudderLeft[0] !== 'arrowleft') fail('options should be saved');
console.log(JSON.stringify({ nav, classes, errors }, null, 1));
if (errors.length) process.exitCode = 1;
await browser.close();
