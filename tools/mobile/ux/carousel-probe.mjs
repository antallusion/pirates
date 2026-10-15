// The entry carousel waits for an open window and comes after it (2026-10-15: it covered the journal).
import * as L from '../m0/lib.mjs';
const b = await L.browser();
const p = await L.page(b, [844, 390], { lang: 'ru', touch: true });
await L.login(p, { port: 58994, know: true });
const look = () => p.evaluate(() => ({ modal: globalThis.gravetide.modal(), over: !!document.getElementById('promo-over') }));
await p.evaluate(() => globalThis.gravetide.open('journal'));
await L.sleep(2500);
const a = await look();
await p.evaluate(() => globalThis.gravetide.open(null));
await L.sleep(2500);
const c = await look();
// a window opened over the carousel: it steps down, and comes back after
await p.evaluate(() => globalThis.gravetide.open('journal'));
await L.sleep(2000);
const d = await look();
await p.evaluate(() => globalThis.gravetide.open(null));
await L.sleep(2500);
const e = await look();
console.log(JSON.stringify({ journalOpen: a, closed: c, reopened: d, closedAgain: e }));
await b.close();
