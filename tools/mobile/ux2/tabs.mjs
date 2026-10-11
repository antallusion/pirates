// ux2 · the journal's tabs under a finger (owner, 2026-10-11: «журнал иногда подзаедает и не переключает вкладки»).
// Touch taps by the browser's own touch events (CDP Input.dispatchTouchEvent: touchstart → pointerdown, touchend →
// pointerup and the tap's click), at a phone held sideways, on the Journal's rail and the company's chips:
//   quick   — a run of quick taps (60 ms down, 120 ms between), each tab must come up;
//   opening — a tap while the window is still sliding up;
//   redraw  — the finger down, the window drawn anew under it (the server's answer to a list), the finger up;
//   active  — the lit tab tapped while its page redraws, then the next one;
//   long    — a slow, deliberate tap (600 ms: the long-press hint shows) must still switch.
//   PORT=58992 node tools/mobile/ux2/tabs.mjs [--size 844x390] [--rounds 6] [--shots docs/img/ux2]
// Prints each case's misses and exits 1 when any tap was lost.
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(process.env.PORT ?? arg('port', 58992));
const [W, H] = arg('size', '844x390').split('x').map(Number);
const ROUNDS = Number(arg('rounds', 6));
const SHOTS = arg('shots', '');
/** How long after the window began to slide up the finger may come down (it slides 120 ms; 320 ms before ux2). */
const OPEN_MS = Number(arg('open', 30));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const b = await L.browser();
const p = await L.page(b, [W, H], { lang: 'ru', touch: true });
const cdp = await p.ctx.newCDPSession(p);
await L.login(p, { port: PORT, know: true, name: 'Вкладки' + Math.random().toString(36).slice(2, 6) });
await p.evaluate(() => document.body.classList.add('reduce-motion'));

const centre = (sel) => p.evaluate((q) => {
  const e = [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}, sel);
const down = (pt) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
const up = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
/** The lit rail tab and chip of the journal's frame. */
const lit = () => p.evaluate(() => ({
  tab: document.querySelector('#modal-panel [data-jtab].on')?.getAttribute('data-jtab') ?? null,
  chip: document.querySelector('#modal-panel [data-jchip].on')?.getAttribute('data-jchip') ?? null,
  modal: globalThis.gravetide.modal?.() ?? document.getElementById('modal-panel')?.dataset.modal ?? null,
}));
/** Polls (getBoundingClientRect-style: the page's own state) until `ok`, up to `ms`. */
async function until(ok, ms = 1500) {
  const t0 = Date.now();
  for (;;) {
    const v = await lit();
    if (ok(v)) return true;
    if (Date.now() - t0 > ms) return false;
    await L.sleep(60);
  }
}
async function tap(sel, hold = 60) {
  const pt = await centre(sel);
  if (!pt) return false;
  await down(pt);
  await L.sleep(hold);
  await up();
  return true;
}
const openJournal = async () => {
  await p.evaluate(() => globalThis.gravetide.open(null));
  await L.sleep(250);
  await p.evaluate(() => globalThis.gravetide.open('journal'));
  await until((v) => v.tab === 'quests');
};

const res = {};
const miss = (k, what) => ((res[k] ??= { taps: 0, lost: [] }).lost.push(what));
const count = (k) => ((res[k] ??= { taps: 0, lost: [] }).taps++);

// 1. quick taps along the rail and back
await openJournal();
const RAIL = ['company', 'guild', 'letters', 'album', 'quests'];
for (let r = 0; r < ROUNDS; r++) {
  for (const t of RAIL) {
    count('quick');
    await tap(`#modal-panel [data-jtab="${t}"]`, 60);
    await L.sleep(120);
    if (!(await until((v) => v.tab === t, 1500))) miss('quick', `${r}:${t}`);
  }
}
// 2. a tap while the window slides up
for (let r = 0; r < ROUNDS; r++) {
  await p.evaluate(() => { document.body.classList.remove('reduce-motion'); globalThis.gravetide.open(null); });
  await L.sleep(300);
  await p.evaluate(() => globalThis.gravetide.open('journal'));
  await L.sleep(OPEN_MS);
  // the finger comes down where the tab is seen as the window settles (the last 12 px of its way up; a slow software
  // frame keeps it below the screen's edge a while — and a tab aimed at farther down is a tab lower by the time the
  // finger lands, whatever the code does: the slide is short, 120 ms, for that)
  let pt = null, moving = false;
  for (let i = 0; i < 80 && !pt; i++) {
    const s = await p.evaluate(() => {
      const e = document.querySelector('#modal-panel [data-jtab="company"]');
      const m = /matrix\([^)]*,\s*([-\d.]+)\)$/.exec(getComputedStyle(document.getElementById('modal-panel')).transform);
      const r = e?.getBoundingClientRect();
      return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), ty: m ? Number(m[1]) : 0 } : null;
    });
    if (s && s.y > 0 && s.y < H - 4 && s.ty <= 12) { pt = s; moving = s.ty > 0.5; }
    else await L.sleep(8);
  }
  count('opening');
  if (!pt) { miss('opening', `${r}: never on screen`); continue; }
  if (moving) res.opening.moving = (res.opening.moving ?? 0) + 1;
  await down(pt);
  await L.sleep(60);
  await up();
  if (!(await until((v) => v.tab === 'company', 1500))) miss('opening', String(r));
  await p.evaluate(() => document.body.classList.add('reduce-motion'));
}
// 3. the finger down, the window drawn anew under it (the server's lists), the finger up — on the company's chips
await openJournal();
await tap('#modal-panel [data-jtab="company"]');
await until((v) => v.tab === 'company');
const CHIPS = ['law', 'isles', 'group', 'empires', 'law', 'group'];
for (let r = 0; r < ROUNDS; r++) {
  for (const c of CHIPS) {
    const pt = await centre(`#modal-panel [data-jchip="${c}"]`);
    if (!pt) { miss('redraw', `${c}: no chip`); continue; }
    count('redraw');
    await down(pt);
    // the server's answers redraw the company's window (each list its own message)
    await L.send(p, { t: 'friend', action: 'list' });
    await L.send(p, { t: 'mail', action: 'list' });
    await L.sleep(260);
    await up();
    if (!(await until((v) => v.chip === c, 1500))) miss('redraw', `${r}:${c}`);
  }
}
// 4. the lit tab tapped while its page redraws, then the next one at once
for (let r = 0; r < ROUNDS; r++) {
  count('active');
  await tap('#modal-panel [data-jchip="group"]', 40);
  await L.send(p, { t: 'friend', action: 'list' });
  await L.sleep(30);
  await tap('#modal-panel [data-jchip="law"]', 40);
  if (!(await until((v) => v.chip === 'law', 1500))) miss('active', String(r));
  await tap('#modal-panel [data-jchip="group"]', 40);
  await until((v) => v.chip === 'group', 1500);
}
// 5. a slow, deliberate tap (the long-press hint shows on the way)
await openJournal();
for (let r = 0; r < Math.min(3, ROUNDS); r++) {
  for (const t of ['company', 'quests']) {
    count('long');
    await tap(`#modal-panel [data-jtab="${t}"]`, 600);
    if (!(await until((v) => v.tab === t, 1500))) miss('long', `${r}:${t}`);
  }
}
if (SHOTS) await p.screenshot({ path: `${SHOTS}/journal-tabs_${W}x${H}.png` });
let lost = 0;
for (const [k, v] of Object.entries(res)) {
  lost += v.lost.length;
  L.log(`${k.padEnd(8)} taps ${String(v.taps).padStart(3)}${v.moving ? ` (${v.moving} while sliding)` : ""}  lost ${v.lost.length}${v.lost.length ? '  ' + v.lost.slice(0, 8).join(', ') : ''}`);
}
if (p.errors.length) L.log('page errors', p.errors.slice(-5));
L.log(lost ? `LOST ${lost} taps` : 'every tap landed');
await b.close();
process.exitCode = lost ? 1 : 0;
