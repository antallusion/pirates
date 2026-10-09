// docs/23 (2026-10-09, batch-fight): the hex battle's order book and the side panel's pages, measured at a size and
// language — every page of the book in sight and inside the field it opens over, every page's words whole on the
// panel, and the panel's pages standing still from turn to turn.
//
//   GPORT=58925 SIZE=1500x600 LANG2=ru OUT=docs/img/fight TAG=after node tools/mobile/fight/book.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '1500x600').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/fight';
const TAG = process.env.TAG ?? 'now';
const SHOTS = process.env.SHOTS !== '0';
mkdirSync(OUT, { recursive: true });
const tag = `${TAG}_${W}x${H}_${lang}`;

const b = await L.browser();
let p = await L.page(b, [W, H], { lang, touch });
const sleep = L.sleep;
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const tac = () => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t ? { round: t.round, over: !!t.over, mine: !!t.mine } : null; });
async function waitFor(f, ms = 20000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }

const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
// (a random name the server refuses leaves a sheet over the form: a fresh page and another name)
for (let i = 0; ; i++) {
  try {
    await L.login(p, { port: Number(process.env.GPORT ?? 58925), name: (lang === 'ru' ? 'Книга' : 'Book') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true, captain: process.env.PATH_ID ?? 'corsair' });
    break;
  } catch (e) {
    if (i >= 2) throw e;
    L.log(tag, 'login again', e.message.split('\n')[0]);
    await p.ctx.close();
    p = await L.page(b, [W, H], { lang, touch });
  }
}
await skip();
await p.evaluate(() => document.body.classList.add('reduce-motion'));
await say('/level 60');
await say('/order all');
await say('/will full');
await say('/army level 8');
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
await say('/tp gravewater', 2500);
await L.closeAll(p, 2);
await say('/board pirate frigate 400', 1500);
const t0 = await waitFor(async () => { await skip(); return tac(); }, 30000);
if (!t0) { console.log('no battle'); await b.close(); process.exit(1); }
await sleep(2500);
await skip();

/** The side panel's pages and the book (if open): what runs past the field or the screen, what words are cut. */
const measure = () => p.evaluate(() => {
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const stage = document.querySelector('.tb-stage');
  const out = { screen: [innerWidth, innerHeight], stage: stage ? R(stage) : null, panel: null, pages: [], book: null, entries: [] };
  const panel = document.querySelector('.tb-spells');
  if (panel && shown(panel)) {
    out.panel = { ...R(panel), scrollH: panel.scrollHeight, clientH: panel.clientHeight, hiddenBelow: Math.max(0, panel.scrollHeight - panel.clientHeight) };
    for (const s of panel.querySelectorAll('.tb-spell, .tb-bookbtn')) {
      const sm = s.querySelector('small');
      const r = R(s);
      const pr = panel.getBoundingClientRect();
      out.pages.push({ id: s.dataset.spell ?? s.dataset.move ?? 'book', ...r, past: Math.max(0, Math.round(r.b - pr.bottom), Math.round(r.b - innerHeight)), text: sm?.textContent ?? '', cut: sm && shown(sm) ? (sm.scrollHeight > sm.clientHeight + 2 || sm.scrollWidth > sm.clientWidth + 1) : false, lines: sm && shown(sm) ? Math.round(sm.scrollHeight / parseFloat(getComputedStyle(sm).lineHeight || '12')) : 0, smallShown: !!sm && shown(sm) });
    }
  }
  const book = document.querySelector('.tb-book:not(.hidden)');
  if (book) {
    out.book = R(book);
    // the painting's parchment ends at 73.5 % of its height at the lowest (by the spine and the right page's curl)
    const pageEnd = book.classList.contains('painted') ? out.book.t + 0.735 * out.book.h : out.book.b;
    for (const e of book.querySelectorAll('.bk-sp')) {
      const r = R(e);
      const sr = stage.getBoundingClientRect();
      // what is drawn of it (its picture, name and price) past the parchment's lower edge
      const inner = [...e.children].map((c) => c.getBoundingClientRect().bottom);
      const low = Math.max(...inner, 0);
      // what is really drawn at its lowest pixel: the entry itself, or something else (cut by a box)
      const y = Math.min(innerHeight - 1, r.b - 2), x = (r.l + r.r) / 2;
      const top = document.elementFromPoint(x, y);
      const b = e.querySelector('b'), sm = e.querySelector('small');
      // past the field's box only matters while the book is inside it (a box that hides what runs over its edge)
      const inStage = stage.contains(e);
      out.entries.push({ id: e.dataset.spell, ...r, inStage, pastStage: inStage ? Math.max(0, Math.round(r.b - sr.bottom), Math.round(sr.top - r.t)) : 0, pastPage: Math.max(0, Math.round(low - pageEnd)), pastScreen: Math.max(0, r.b - innerHeight, -r.t), hit: !!top && (top === e || e.contains(top)), nameCut: b ? b.scrollHeight > b.clientHeight + 2 || b.scrollWidth > b.clientWidth + 1 : false, noteCut: sm ? sm.scrollWidth > sm.clientWidth + 1 : false });
    }
    for (const c of book.querySelectorAll('.bk-turn, .bk-close, .bk-tab')) {
      const r = R(c);
      if (r.b > innerHeight || r.r > innerWidth || r.t < 0 || r.l < 0) out.entries.push({ id: c.className, ...r, pastScreen: Math.max(r.b - innerHeight, r.r - innerWidth, -r.t, -r.l) });
    }
  }
  // A phone's book: the sheet of cards — each card in sight (scrolled to) and its name and words whole.
  const sheet = document.querySelector('.tb-bookk');
  if (sheet && shown(sheet)) {
    const body = sheet.querySelector('.k-sheet-body') ?? sheet;
    const br = body.getBoundingClientRect();
    out.sheet = { ...R(sheet), scrollH: body.scrollHeight, clientH: body.clientHeight, cards: [] };
    for (const c of sheet.querySelectorAll('.tb-bc')) {
      const r = R(c), b = c.querySelector('b'), sm = c.querySelector('small');
      out.sheet.cards.push({ id: c.dataset.bkspell ?? c.dataset.bkmove ?? c.dataset.bk, ...r, below: Math.max(0, Math.round(r.b - br.bottom)), nameCut: b ? b.scrollHeight > b.clientHeight + 2 || b.scrollWidth > b.clientWidth + 1 : false, noteCut: sm ? sm.scrollWidth > sm.clientWidth + 1 : false, words: !!c.querySelector('.tb-bc-w') });
    }
  }
  const tip = document.querySelector('.tb-words:not(.hidden)');
  if (tip) { const r = R(tip); out.tip = { ...r, text: tip.textContent.trim().slice(0, 80), cut: tip.scrollHeight > tip.clientHeight + 2, off: Math.max(0, r.b - innerHeight, r.r - innerWidth, -r.t, -r.l) }; }
  return out;
});

const rows = {};
const sum = (name, m) => {
  const pastPanel = m.pages.filter((x) => x.past > 0).map((x) => `${x.id}+${x.past}`);
  const cut = m.pages.filter((x) => x.cut).map((x) => x.id);
  const ent = m.entries.filter((x) => x.pastStage > 0 || x.pastPage > 0 || x.pastScreen > 0 || x.hit === false || x.nameCut || x.noteCut).map((x) => `${x.id}${x.pastStage ? ` stage+${x.pastStage}` : ''}${x.pastPage ? ` page+${x.pastPage}` : ''}${x.pastScreen ? ` screen+${x.pastScreen}` : ''}${x.hit === false ? ' covered' : ''}${x.nameCut ? ' name-cut' : ''}${x.noteCut ? ' note-cut' : ''}`);
  L.log(tag, name.padEnd(10), `panel ${m.panel ? `${m.panel.h}px hidden ${m.panel.hiddenBelow}` : '-'} · pages past ${pastPanel.join(' ') || 0} · words cut ${cut.length}/${m.pages.filter((x) => x.smallShown).length}${cut.length ? ` (${cut.join(' ')})` : ''}${m.book ? ` · book ${m.book.w}×${m.book.h} @${m.book.t}–${m.book.b} stage ${m.stage.t}–${m.stage.b} · entries ${m.entries.length}: ${ent.join(', ') || 'clean'}` : ''}`);
  rows[name] = m;
};

// The field on her turn.
await waitFor(async () => (await tac())?.mine, 20000);
await sleep(800);
let m = await measure();
sum('field', m);
if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_field.png` });
const layout0 = m.pages.map((x) => [x.id, x.t, x.h]);

// The book, every spread of it.
if (!touch && (await p.$('[data-book]'))) {
  await p.evaluate(() => document.querySelector('.tb-spells [data-book]')?.click());
  await sleep(700);
  for (let s = 0; s < 6; s++) {
    m = await measure();
    sum(`book${s + 1}`, m);
    if (SHOTS && s === 0) await p.screenshot({ path: `${OUT}/${tag}_book.png` });
    const next = await p.$('.bk-turn.next:not([disabled])');
    if (!next) break;
    await next.click();
    await sleep(400);
  }
  await p.evaluate(() => document.querySelector('[data-bookclose]')?.click());
  await sleep(400);
}
// A phone's book: the sheet of cards by the round button; a long press on a card for its words.
if (touch && (await p.$('.tb-pad [data-book]'))) {
  const r = await p.evaluate(() => { const b = document.querySelector('.tb-pad [data-book]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.touchscreen.tap(r.x, r.y);
  await sleep(900);
  m = await measure();
  const s = m.sheet;
  L.log(tag, 'sheet'.padEnd(10), s ? `${s.w}×${s.h} · cards ${s.cards.length} · below the fold ${s.cards.filter((c) => c.below > 0).length} (scrolls ${s.scrollH > s.clientH + 2}) · names cut ${s.cards.filter((c) => c.nameCut).length} · notes cut ${s.cards.filter((c) => c.noteCut).length}` : 'no sheet');
  if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_book.png` });
  // the long press: a finger held on the second card of the pages
  const c = await p.evaluate(() => { const e = [...document.querySelectorAll('.tb-bookk .tb-bc[data-bkspell]')][1]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, id: e.dataset.bkspell }; });
  if (c) {
    const cdp = await p.ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
    await sleep(800);
    m = await measure();
    L.log(tag, 'hold'.padEnd(10), m.tip ? `tip ${m.tip.w}×${m.tip.h} @${m.tip.l},${m.tip.t} off ${m.tip.off} cut ${m.tip.cut} «${m.tip.text}»` : 'no tip');
    if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_hold.png` });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(500);
    const still = await p.evaluate(() => ({ sheet: !!document.querySelector('.tb-bookk'), aiming: !!globalThis.gravetide.tac?.targeting }));
    L.log(tag, 'release'.padEnd(10), `sheet still open ${still.sheet}`);
  }
  await p.evaluate(() => document.querySelector('.tb-bookk .k-sheet-x')?.click());
  await sleep(600);
}
// The desk: a page of the panel and of the book under the mouse, for its whole words.
if (!touch) {
  const pg = await p.evaluate(() => { const e = [...document.querySelectorAll('.tb-spells .tb-spell[data-spell]')][0]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  if (pg) {
    await p.mouse.move(pg.x, pg.y, { steps: 3 });
    await sleep(600);
    m = await measure();
    L.log(tag, 'hover'.padEnd(10), m.tip ? `tip ${m.tip.w}×${m.tip.h} @${m.tip.l},${m.tip.t} off ${m.tip.off} cut ${m.tip.cut} «${m.tip.text}»` : `no tip ${JSON.stringify(await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const w = document.querySelector('.tb-words'); return { at: e?.className, hov: [...document.querySelectorAll(':hover')].map((h) => h.className).slice(-3), words: w ? w.className : null }; }, [pg.x, pg.y]))}`);
    if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_hover.png` });
    // the mouse resting on the page while a turn goes by (the panel drawn anew under it): the words stay
    await L.send(p, { t: 'tac', act: { a: 'defend' } });
    await sleep(2500);
    m = await measure();
    L.log(tag, 'hover+turn'.padEnd(10), m.tip ? `tip stays «${m.tip.text.slice(0, 40)}»` : 'tip gone');
    await p.mouse.move(W / 2, 10);
    await sleep(300);
  }
  // a page that cannot be given now (the ultimate before round 3), and a page of the open book
  for (const [sel, name] of [['.tb-spells [data-move="ult"]', 'hover-off'], ['.tb-book .bk-sp', 'hover-bk']]) {
    if (name === 'hover-bk') { await p.evaluate(() => document.querySelector('.tb-spells [data-book]')?.click()); await sleep(700); }
    const q = await p.evaluate((s) => { const e = [...document.querySelectorAll(s)].at(-1); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, off: e.disabled }; }, sel);
    if (!q) continue;
    await p.mouse.move(q.x, q.y, { steps: 3 });
    await sleep(600);
    m = await measure();
    L.log(tag, name.padEnd(10), `${q.off ? '(disabled) ' : ''}${m.tip ? `tip ${m.tip.w}×${m.tip.h} @${m.tip.l},${m.tip.t} off ${m.tip.off} cut ${m.tip.cut} «${m.tip.text}»` : 'no tip'}`);
    if (SHOTS && name === 'hover-bk') await p.screenshot({ path: `${OUT}/${tag}_hoverbk.png` });
    await p.mouse.move(W / 2, 10);
    await sleep(300);
  }
  await p.evaluate(() => document.querySelector('[data-bookclose]')?.click());
  await sleep(400);
}

// A few turns on: the panel's pages where they were (an order cast: its words become «ready in N»).
const jumps = [];
for (let k = 0; k < 3; k++) {
  // The first page on the panel cast at the first foe stack (its words become «ready in N» or «no will»).
  const id = await p.evaluate(() => [...document.querySelectorAll('.tb-spells .tb-spell[data-spell]:not([disabled])')][0]?.dataset.spell ?? null);
  if (id && k === 0) {
    const foe = await p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t?.stacks?.find((s) => s.side !== t.you && s.count > 0)?.id ?? null; });
    await L.send(p, { t: 'tac', act: { a: 'spell', id, target: foe ?? undefined } });
    await sleep(1500);
    L.log(tag, 'cast', id, await p.evaluate((x) => document.querySelector(`.tb-spells [data-spell="${x}"] small`)?.textContent ?? '-', id));
  }
  await L.send(p, { t: 'tac', act: { a: 'defend' } });
  await waitFor(async () => !(await tac())?.mine, 8000);
  await waitFor(async () => (await tac())?.mine || (await tac())?.over, 30000);
  await sleep(900);
  const mk = await measure();
  const lay = mk.pages.map((x) => [x.id, x.t, x.h]);
  const moved = lay.filter(([id, t, h], i) => layout0[i] && (layout0[i][0] !== id || Math.abs(layout0[i][1] - t) > 1 || Math.abs(layout0[i][2] - h) > 1)).map(([id, t, h]) => `${id}@${t}/${h}`);
  jumps.push(moved.length);
  sum(`turn${k + 1}`, mk);
  L.log(tag, `turn${k + 1}`.padEnd(10), `pages moved ${moved.length}${moved.length ? `: ${moved.join(' ')}` : ''}`);
  if (SHOTS && k === 0) await p.screenshot({ path: `${OUT}/${tag}_turn.png` });
  if ((await tac())?.over) break;
}
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify({ at: new Date().toISOString(), size: [W, H], lang, touch, rows, jumps }, null, 1));
await b.close();
