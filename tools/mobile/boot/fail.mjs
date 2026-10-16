// The boot shell when a module is lost on the way: the page reloads itself once and the game starts; lost again, the
// shell says so with «Перезагрузить». ?bootdebug shows the stages; the server logs the report.
import { browser, sleep } from '../m0/lib.mjs';
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
await ctx.addInitScript(() => { try { localStorage.setItem('gravetide.lang', 'ru'); } catch {} });
let lose = Number(process.env.LOSE ?? 1);
await ctx.route('**/src/ui/hud.ts*', (r) => (lose-- > 0 ? r.abort() : r.continue()));
const p = await ctx.newPage();
let loads = 0;
p.on('load', () => loads++);
await p.goto('http://localhost:58990/?bootdebug', { waitUntil: 'commit' });
for (let i = 0; i < 60 && !(await p.evaluate(() => !!globalThis.__gtReady).catch(() => false)); i++) await sleep(500);
await sleep(800);
const st = await p.evaluate(() => ({ ready: !!globalThis.__gtReady, shell: document.getElementById('boot')?.className, text: document.querySelector('#boot .bt-text')?.textContent, retry: !document.querySelector('#boot .bt-retry')?.hidden, log: document.getElementById('boot-log')?.textContent?.split('\n').slice(-6) }));
console.log('loads', loads, JSON.stringify(st));
await p.screenshot({ path: `assets/raw/audit/boot/fail-${process.env.LOSE ?? 1}.png` });
await b.close();
