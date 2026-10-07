// The owner's sizes, before and after the sea HUD's rebuild (2026-10-07): a fresh captain casts off by the harbour's
// «В море» and the screens he judged are taken and measured — the sea right after leaving port, the sea with a mark,
// the sea near a world boss, the menu, the hex battle. On each, by numbers:
//   controls  the tap targets a finger or a mouse can reach now (measure.js __targets: ≤ 7 on the sea after port);
//   audit     the QA kit's audit() (text out of its box, cut, overlapping) and center() (off-centre lines);
//   crop      crop.js __crop(): pictures in round frames cut by the frame or covered by a badge;
//   pop       the popup budget: every passing thing as a share of the screen (≤ 15 %) and what of it lies in the middle;
//   overlap   the sea HUD's blocks on top of each other.
//   GPORT=58831 SIZE=1500x600 TOUCH=0 LANG2=ru TAG=after OUT=assets/raw/audit/ux node tools/mobile/ux/ux.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Phone, signIn } from '../e2e/pages.mjs';

const [W, H] = (process.env.SIZE ?? '1500x600').split('x').map(Number);
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const lang = process.env.LANG2 ?? 'ru';
const tag = process.env.TAG ?? 'after';
const port = Number(process.env.GPORT ?? 58831);
const OUT = process.env.OUT ?? 'assets/raw/audit/ux';
const only = (process.env.ONLY ?? 'sea,target,boss,menu,battle').split(',');
mkdirSync(OUT, { recursive: true });
const here = new URL('.', import.meta.url);
const CROP = readFileSync(new URL('crop.js', here), 'utf8');
const MEASURE = readFileSync(new URL('../m0/measure.js', here), 'utf8');

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const name = `${W}x${H}_${touch ? 'touch' : 'mouse'}_${lang}`;
const ph = new Phone(p, { out: OUT, tag: `${tag}_${name}`, port, touch });
const rows = [];

const kit = () => p.evaluate(async ([crop, measure]) => {
  if (typeof globalThis.audit !== 'function') await (0, eval)(await (await fetch('/assets/raw/qa.js?' + Date.now())).text());
  for (let i = 0; i < 50 && typeof globalThis.audit !== 'function'; i++) await new Promise((r) => setTimeout(r, 100));
  if (typeof globalThis.__crop !== 'function') (0, eval)(crop);
  if (typeof globalThis.__targets !== 'function') (0, eval)(measure);
}, [CROP, MEASURE]);

const look = () => p.evaluate(async () => {
  const W = innerWidth, H = innerHeight, cz = { l: W * 0.3, t: H * 0.3, r: W * 0.7, b: H * 0.7 };
  const vis = (e) => { if (!e) return false; for (let q = e; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } return true; };
  const pop = globalThis.__popAudit();
  const covered = (l, t, r, b) => { const e = document.elementFromPoint((l + r) / 2, (t + b) / 2); return !!e && !!e.closest('#modal-panel, .film, .k-sheet-root.k-open') && !e.closest('#modal-toasts'); };
  let hiddenArea = 0;
  const items = [];
  for (const it of pop.items) {
    const m = /(-?\d+),(-?\d+),(-?\d+),(-?\d+)$/.exec(it);
    if (m && !/modal-toasts/.test(it) && covered(+m[1], +m[2], +m[3], +m[4])) { hiddenArea += (m[3] - m[1]) * (m[4] - m[2]); continue; }
    items.push(it);
  }
  let pct = pop.pct - (100 * hiddenArea) / (W * H);
  const centre = pop.centre.filter((c) => items.some((i) => i.startsWith(c.split(' ')[0])));
  const modalUp = !document.querySelector('#modal')?.classList.contains('hidden') || !!document.querySelector('.k-sheet-root.k-open');
  // the new passing lines: the sea's name, the boss's line, the hint, the lesson, the finger
  for (const sel of ['.k-hint', '#hud-watch', '#tut-finger', '#hud-feed', '#hud-tip', '#sea-herald', '#sea-boss']) {
    for (const e of document.querySelectorAll(sel)) {
      if (!vis(e) || (modalUp && sel === '#hud-watch')) continue;
      if (items.some((i) => i.startsWith(sel))) continue;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      pct += (100 * r.width * r.height) / (W * H); items.push(`${sel} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
      if (sel !== '#tut-finger' && r.left < cz.r && r.right > cz.l && r.top < cz.b && r.bottom > cz.t) centre.push(`${sel} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
    }
  }
  // the sea HUD's blocks on top of each other
  const sel = ['#hud-captain', '#hud-map', '#hud-stack > :not(.hidden)', '#hud-region', '#hud-combat', '#hud-nav', '#hud-menu', '#hud-ship', '#toasts > .toast', '#tc-stick', '#tc-fire', '#tc-act', '#tc-special', '#tc-menu', '#tc-news', '#tc-target', '#hud-watch', '#sea-herald', '#sea-boss'];
  const boxes = [];
  for (const q of sel) document.querySelectorAll(q).forEach((e) => {
    if (!vis(e)) return;
    let r = e.getBoundingClientRect();
    if (e.id === 'hud-captain') { const rs = [...e.querySelectorAll('*')].filter(vis).map((k) => k.getBoundingClientRect()).filter((k) => k.height > 0 && k.width > 0); if (rs.length) r = new DOMRect(Math.min(...rs.map((k) => k.left)), Math.min(...rs.map((k) => k.top)), Math.max(...rs.map((k) => k.right)) - Math.min(...rs.map((k) => k.left)), Math.max(...rs.map((k) => k.bottom)) - Math.min(...rs.map((k) => k.top))); }
    if (r.width < 2 || r.height < 2) return;
    boxes.push({ q: e.id ? '#' + e.id : q, r, e });
  });
  const overlap = [];
  if (!modalUp && !document.body.classList.contains('tac')) for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, c = boxes[j].r;
    if (boxes[i].e.contains(boxes[j].e) || boxes[j].e.contains(boxes[i].e)) continue;
    if (a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) overlap.push(`${boxes[i].q} × ${boxes[j].q}`);
  }
  const t = globalThis.__targets();
  let audit = globalThis.audit(); if (!Array.isArray(audit)) audit = [];
  let center = globalThis.center(); if (!Array.isArray(center)) center = [];
  const crop = await globalThis.__crop();
  return { controls: t.n, controlList: t.list, small: t.small, smallList: t.smallList, pop: +pct.toFixed(1), centre, items, overlap, audit, center, crop: crop.fails, cropChecked: crop.checked, cropList: crop.list, sea: globalThis.__sea() };
});

async function check(screen) {
  await L.sleep(900);
  if (screen !== 'menu') await later(); // a new level's choice come up by itself is not the screen measured
  await kit();
  const m = await look();
  await p.screenshot({ path: `${OUT}/${tag}_${name}_${screen}.png` });
  const row = { screen, ...m, errors: p.errors.splice(0) };
  rows.push(row);
  L.log(`${tag} ${name} ${screen.padEnd(7)} controls ${String(m.controls).padStart(2)} · audit ${m.audit.length} · center ${m.center.length} · crop ${m.crop.length}/${m.cropChecked} · pop ${m.pop}%${m.centre.length ? ` CENTRE ${m.centre.length}` : ''}${m.overlap.length ? ` · overlap ${m.overlap.length}` : ''}${row.errors.length ? ` · ERRORS ${row.errors.length}` : ''}`);
  return row;
}
const closeSheets = () => p.evaluate(() => { document.querySelectorAll('.k-sheet-root.k-open').forEach((s) => s.querySelector('.k-scrim')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); globalThis.gravetide.seaHud?.closeSheets?.(); });
/** A new level's choice over the sea: «Позже». */
const later = async () => {
  for (let i = 0; i < 4; i++) {
    const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('.k-sheet-root.k-open button')].find((x) => /Позже|Later/.test(x.innerText)); b?.click(); return !!b; });
    if (!ok) break;
    await L.sleep(700);
  }
};

const tail = () => [...Array(4)].map(() => 'abcdefghik'[Math.floor(Math.random() * 10)]).join('');
try {
  await signIn(ph, { name: `Ux${tag.slice(0, 1)}${tail()}`, know: true });
} catch (e) {
  // (a finger that missed «Я знаю море» behind the captain's button: the page's own check, as a mouse would)
  L.log(`sign-in by finger failed (${e.message}); by the page`);
  await p.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => !!globalThis.gravetide, null, { timeout: 90000 });
  await p.fill('#login-name', `Ux${tag.slice(0, 1)}${tail()}`);
  await p.evaluate(() => document.querySelector('#login-form button[type="submit"]').click());
  await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 60000 });
  await p.evaluate(() => { document.querySelector('.captain-card[data-id="corsair"]').click(); const k = document.querySelector('#know-sea'); if (k) k.checked = true; document.querySelector('#pick-captain').click(); });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) { await p.evaluate(() => document.querySelectorAll('.film, #prologue').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })))); await L.sleep(700); }
  await L.sleep(2000);
  await p.evaluate(() => document.querySelector('#modal-panel .help-list') && globalThis.gravetide.open(null));
}
// (a finger that met «Take command» instead of «I know the sea» left the First Watch on: every run without it)
if (await p.evaluate(() => !!globalThis.gravetide.state.onboarding?.stage)) { await L.send(p, { t: 'onboarding', action: 'skip_all' }); await L.sleep(800); }
await p.evaluate(() => document.body.classList.add('reduce-motion'));
for (const x of ['/level 3', '/silver 1300', '/god on']) await ph.admin(x, 700);
await later();
// Cast off by the harbour's «В море» (the window opens by itself in port); a film and a new level's choice skipped.
if (!(await ph.visible('#modal-panel .w-tab--go'))) await p.evaluate(() => globalThis.gravetide.open('port'));
await L.sleep(900);
await ph.tap('#modal-panel .w-tab--go', '«В море»', 15000);
await ph.until(async () => !(await ph.state())?.docked, 30000, 'at sea');
for (let i = 0; i < 8 && (await p.$('.film')); i++) { await ph.skipFilm(); await L.sleep(600); }
await L.sleep(1200);
await later();
await p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
await L.sleep(2200);
if (only.includes('sea')) await check('sea');
// A mark.
if (only.includes('target')) {
  await ph.admin('/foe pirate sloop 380', 2500);
  const foe = await p.evaluate(() => [...globalThis.gravetide.state.ships.values()].find((x) => x.info?.npcRole === 'pirate')?.id ?? null);
  if (foe !== null) await p.evaluate((id) => globalThis.gravetide.target(id), foe);
  await L.sleep(1500);
  await later();
  await check('target');
}
// A world boss near (Old Moorings, as the owner met it off Saltmarrow).
if (only.includes('boss')) {
  // (away from the mark first: the boss alone near her)
  const at = await p.evaluate(() => { const o = globalThis.gravetide.state.ownDisplay; return o ? [Math.round(o.x), Math.round(o.y)] : null; });
  if (at) await ph.admin(`/tp ${at[0] + 5000} ${at[1] + 3000}`, 2500);
  await ph.admin('/boss old_moorings', 3500);
  await later();
  await check('boss');
}
// The menu.
if (only.includes('menu')) {
  await p.evaluate(() => { const g = globalThis.gravetide; if (document.querySelector('#tc-menu') && getComputedStyle(document.querySelector('#touch')).display !== 'none') g.seaHud.openMenu(); else g.open('menu'); });
  await L.sleep(1000);
  await check('menu');
  await closeSheets();
  await p.evaluate(() => globalThis.gravetide.open(null));
  await L.sleep(600);
}
// The hex battle.
if (only.includes('battle')) {
  await ph.admin('/board pirate sloop 12', 4000);
  for (let i = 0; i < 6 && (await p.$('.film')); i++) { await ph.skipFilm(); await L.sleep(600); }
  await ph.until(async () => !!(await ph.state())?.tac, 20000, 'the hex battle').catch(() => {});
  await L.sleep(1800);
  if ((await ph.state())?.tac) await check('battle');
  else L.log('no battle came');
}
writeFileSync(`${OUT}/${tag}_${name}.json`, JSON.stringify({ at: new Date().toISOString(), tag, size: `${W}x${H}`, touch, lang, port, rows }, null, 1));
await b.close();
