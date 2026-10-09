// docs/25 block Д (2026-10-09, batch-boardskill): the Path book's numbers and rounds at a level, and a boarding — the
// ultimate shut in round 1 and open in round 2, the stacks in cover marked on the field, a covered stack's card and a
// shot's preview — on a size and language, each measured (inside the screen, its words whole) and shot.
//
//   GPORT=58960 SIZE=812x375 LANG2=ru LEVEL=50 PATH_ID=drowned OUT=docs/img/boardskill TAG=after node tools/mobile/fight/boardskill.mjs
//   (SHIP="frigate 9": her hull, 0 to keep the one she has; FOE="pirate frigate 400": the ship she boards)
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/boardskill';
const TAG = process.env.TAG ?? 'now';
const LEVEL = Number(process.env.LEVEL ?? 50);
const PATH_ID = process.env.PATH_ID ?? 'corsair';
mkdirSync(OUT, { recursive: true });
const tag = `${TAG}_${PATH_ID}_L${LEVEL}_${W}x${H}_${lang}`;

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const sleep = L.sleep;
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const view = () => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; if (!t) return null; const me = t.heroes[t.you]; return { round: t.round, over: !!t.over, mine: !!t.mine, ult: me.ult ?? null, ultFrom: me.ultFrom ?? null, level: t.level }; });
async function waitFor(f, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }
const R = 'const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };';

const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
await L.login(p, { port: Number(process.env.GPORT ?? 58960), name: (lang === 'ru' ? 'Навык' : 'Skill') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true, captain: PATH_ID });
await skip();
await p.evaluate(() => document.body.classList.add('reduce-motion'));
await say(`/level ${LEVEL}`);
// A hull of her level, so the fight is between like crews (the foe a fifth fewer: her ultimate from round 2).
if (process.env.SHIP !== '0') await say(`/ship ${process.env.SHIP ?? `frigate ${Math.min(10, Math.ceil(LEVEL / 6))}`}`, 1500);
await say(`/army level ${process.env.ARMY ?? Math.min(10, Math.ceil(LEVEL / 6))}`);
for (let i = 0; i < 4; i++) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later)$/.test(x.textContent.trim())).forEach((x) => x.click()));
  await sleep(300);
}
await L.closeAll(p, 2);

// 1. The Path book: her moves' and pages' figures and rounds at her level.
await p.evaluate(() => globalThis.gravetide.hero('path'));
await waitFor(() => p.evaluate(() => document.querySelectorAll('.pb-num').length > 0), 15000);
await sleep(800);
const book = await p.evaluate(new Function(`${R}
  const shown = (e) => e.getClientRects().length > 0;
  const nums = [...document.querySelectorAll('.pb-move, .pb-page')].filter(shown).map((e) => ({ name: e.querySelector('b')?.textContent.trim(), num: e.querySelector('.pb-num')?.textContent.trim() ?? '', facet: [...e.querySelectorAll('small')].map((s) => s.textContent.trim()).find((t) => /40/.test(t) && /(level|уровн)/.test(t)) ?? null, ...R(e) }));
  const cut = [...document.querySelectorAll('.pb-move b, .pb-page b, .pb-num')].filter(shown).filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
  return { nums, cut, free: [...document.querySelectorAll('.pb-move.ult small.muted')].map((e) => e.textContent.trim()) };`));
await p.screenshot({ path: `${OUT}/${tag}_book.png` });
// Scroll the book to its pages (a phone's window scrolls).
await p.evaluate(() => document.querySelector('.pb-pages')?.scrollIntoView({ block: 'start' }));
await sleep(400);
await p.screenshot({ path: `${OUT}/${tag}_pages.png` });
await L.closeAll(p, 3);

// 2. A boarding: round 1 her ultimate shut (from round 2), round 2 open; the stacks in cover marked.
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
await say('/tp gravewater', 2500);
await L.closeAll(p, 2);
await sleep(4000);
await say(`/board ${process.env.FOE ?? 'pirate frigate'}`, 1500);
const v0 = await waitFor(async () => { await skip(); return view(); });
if (!v0) { console.log('no battle'); await b.close(); process.exit(1); }
await waitFor(async () => { await skip(); const v = await view(); return v && (v.mine || v.over); }, 25000);
await sleep(1200);
await skip();
const ultBtn = () => p.evaluate(new Function(`${R}
  const e = document.querySelector('.tb-spells [data-move="ult"], .tb-bc[data-bkmove="ult"]');
  const pad = document.querySelector('.tb-pad');
  return e ? { off: e.disabled, note: e.querySelector('small')?.textContent.trim() ?? '', ...R(e) } : { none: true, pad: pad ? pad.textContent.trim().slice(0, 60) : null };`));
const covered = () => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; const tac = globalThis.gravetide.tactical; return t && tac?.covered ? [...tac.covered(t)] : []; });
const r1 = { view: await view(), ult: await ultBtn(), covered: await covered() };
await p.screenshot({ path: `${OUT}/${tag}_r1.png` });
// Her first round: each of her stacks stands on guard (her ultimate kept), to round 2.
await waitFor(async () => {
  await skip();
  const v = await view();
  if (!v || v.over || v.round >= 2) return v;
  if (v.mine) await p.evaluate(() => globalThis.gravetide.net.send({ t: 'tac', act: { a: 'defend' } }));
  return null;
}, 90000, 600);
await waitFor(async () => { await skip(); const v = await view(); return v && (v.mine || v.over); }, 30000);
await sleep(1500);
await skip();
// A phone's pages are in the book (its round button): open it to see the ultimate's card.
if (touch) {
  await p.evaluate(() => document.querySelector('.tb-pad [data-book]')?.click());
  await sleep(800);
}
const r2 = { view: await view(), ult: await ultBtn(), covered: await covered() };
await p.screenshot({ path: `${OUT}/${tag}_r2.png` });
if (touch) { await p.evaluate(() => document.querySelector('.tb-bookk .k-sheet-x')?.click()); await sleep(500); }
// A covered stack's card (its chip), and the field with the marks.
const cov = r2.covered[0] ?? r1.covered[0];
let card = null;
if (cov !== undefined) {
  await p.evaluate((id) => globalThis.gravetide.tactical.showInfo(id), cov).catch(() => {});
  await sleep(600);
  card = await p.evaluate(() => [...document.querySelectorAll('.tb-card .tb-st, .tb-cardk .tb-st')].map((e) => e.textContent.trim()));
}
await p.screenshot({ path: `${OUT}/${tag}_cover.png` });
const rec = { tag, book, r1, r2, card, errors: p.errors };
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rec, null, 1));
console.log(JSON.stringify({ tag, moves: book.nums.length, cut: book.cut, ultNote: book.free, r1: { round: r1.view?.round, ultFrom: r1.view?.ultFrom, off: r1.ult?.off, note: r1.ult?.note }, r2: { round: r2.view?.round, off: r2.ult?.off, note: r2.ult?.note, ult: r2.view?.ult }, covered: [r1.covered.length, r2.covered.length], card, errors: p.errors.length }));
await b.close();
