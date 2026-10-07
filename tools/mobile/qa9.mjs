// docs/23 phase 9, items 91, 92 and 97 (browser-qa, a11y-architect + accessibility, the popup budget): every main
// screen of the new interface at one size and language — the harbour's places, the sea, a mark, «Атаковать», the risk
// window, the hex battle (field, book, end), the prize, a ship striking her colours, the captain's tabs, the journal,
// the chart, the options, the menu sheet, the island and its town — and on each, by numbers:
//   errors   console errors and page errors (none allowed);
//   audit    the QA kit's audit() (text out of its box, cut, overlapping);
//   pop      the popup budget: every transient thing (toasts, hints, cards, banners, the lesson's row, the finger) as a
//            share of the screen, and what of it lies in the middle (30–70 % both ways) — ≤ 15 %, nothing in the middle;
//   overlap  HUD blocks on top of each other (the new sea HUD's own list);
//   targets  tap targets and how many are under 44 px (a phone: 0 allowed), icon-only controls without a name;
//   contrast text under 4.5:1 (3:1 large) against the colour behind it, where that colour is plain (not a picture);
//   words    Latin on a Russian screen, Cyrillic on an English one (captains' and ships' names apart).
//
//   APORT=58821 SIZE=phone LANG2=ru OUT=assets/raw/audit/m9/qa node tools/mobile/qa9.mjs
import * as L from './m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Phone, signIn, autoBattle, battleEnd } from './e2e/pages.mjs';

const size = process.env.SIZE ?? 'phone', lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/m9/qa';
const APORT = Number(process.env.APORT ?? 58821);
mkdirSync(OUT, { recursive: true });
const [W, H] = L.SIZES[size];
const touch = W < 1000;
const b = await L.browser();
const p = await L.page(b, [W, H], { lang, films: true, touch });
const ph = new Phone(p, { out: OUT, tag: `${size}_${lang}`, port: APORT, touch });
const rows = [];

/** The page's own checks for this moment. */
const KIT = () => p.evaluate(async () => {
  if (typeof globalThis.audit !== 'function') await (0, eval)(await (await fetch('/assets/raw/qa.js?' + Date.now())).text());
  for (let i = 0; i < 50 && typeof globalThis.audit !== 'function'; i++) await new Promise((r) => setTimeout(r, 100));
  if (typeof globalThis.__targets !== 'function') await (0, eval)(await (await fetch('/assets/raw/audit/m0/measure.js?' + Date.now())).text());
});
const look = () => p.evaluate((isTouch) => {
  const W = innerWidth, H = innerHeight, cz = { l: W * 0.3, t: H * 0.3, r: W * 0.7, b: H * 0.7 };
  const vis = (e) => { if (!e) return false; for (let q = e; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } return true; };
  // The popup budget: the kit's list, and the new interface's own transient parts.
  const pop = globalThis.__popAudit();
  // What a window or a film lies over is not on the screen (the battle's end band under the prize window was counted).
  const covered = (l, t, r, b) => { const e = document.elementFromPoint((l + r) / 2, (t + b) / 2); return !!e && !!e.closest('#modal-panel, .film, .k-sheet-root.k-open') && !e.closest('#modal-toasts'); };
  let hiddenArea = 0;
  const items = [];
  for (const it of pop.items) {
    const m = /(-?\d+),(-?\d+),(-?\d+),(-?\d+)$/.exec(it);
    if (m && !/modal-toasts/.test(it) && covered(+m[1], +m[2], +m[3], +m[4])) { hiddenArea += (m[3] - m[1]) * (m[4] - m[2]); continue; }
    items.push(it);
  }
  pop.pct = +(pop.pct - (100 * hiddenArea) / (W * H)).toFixed(1);
  let extra = 0; const centre = pop.centre.filter((c) => items.some((i) => i.startsWith(c.split(' ')[0])));
  const modalUp = !document.querySelector('#modal')?.classList.contains('hidden');
  for (const sel of ['.k-hint', '#hud-watch', '#tut-finger', '#hud-feed', '#hud-tip']) {
    for (const e of document.querySelectorAll(sel)) {
      if (!vis(e) || (modalUp && sel === '#hud-watch')) continue;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      extra += r.width * r.height; items.push(`${sel} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
      if (sel !== '#tut-finger' && r.left < cz.r && r.right > cz.l && r.top < cz.b && r.bottom > cz.t) centre.push(`${sel} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
    }
  }
  // The sea HUD's blocks on top of each other.
  const sel = ['#hud-captain', '#hud-map', '#hud-stack > :not(.hidden)', '#toasts > .toast', '#tc-stick', '#tc-fire', '#tc-act', '#tc-special', '#tc-menu', '#tc-news', '#tc-target', '#hud-watch'];
  const boxes = [];
  for (const q of sel) document.querySelectorAll(q).forEach((e) => { if (!vis(e)) return; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; boxes.push({ q: e.id ? '#' + e.id : q, r, e }); });
  const overlap = [];
  if (!modalUp && !document.body.classList.contains('tac')) for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, c = boxes[j].r;
    if (boxes[i].e.contains(boxes[j].e) || boxes[j].e.contains(boxes[i].e)) continue;
    if (a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) overlap.push(`${boxes[i].q} × ${boxes[j].q}`);
  }
  // Icon-only controls with no name for a screen reader.
  const unnamed = [];
  for (const e of document.querySelectorAll('button, [role=button], a[href], [role=tab], [role=menuitem]')) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    const name = (e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || '').trim() || (e.getAttribute('aria-labelledby') ? 'by' : '') || [...e.querySelectorAll('img[alt]')].map((i) => i.alt).join('').trim();
    if (!name) unnamed.push((e.id ? '#' + e.id : e.className?.toString().split(' ')[0] || e.tagName) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  // Contrast of text against a plain colour behind it (a picture behind: not judged here).
  const lum = (c) => { const [r, g, b2] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b2; };
  const rgba = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
  const low = [];
  const seenEl = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || seenEl.has(el) || !vis(el)) continue; seenEl.add(el);
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    const cs = getComputedStyle(el); const fg = rgba(cs.color); if ((fg[3] ?? 1) < 0.4) continue;
    let bg = null, pic = false;
    for (let q = el; q; q = q.parentElement) {
      const c = getComputedStyle(q);
      if ((c.backgroundImage && c.backgroundImage !== 'none') || (c.borderImageSource && c.borderImageSource !== 'none' && q !== el)) { pic = true; break; }
      const v = rgba(c.backgroundColor); if (v.length >= 3 && (v[3] ?? 1) > 0.85) { bg = v; break; }
    }
    if (pic || !bg) continue;
    const a = lum(fg), c2 = lum(bg), ratio = (Math.max(a, c2) + 0.05) / (Math.min(a, c2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (bold && px >= 18.66);
    if (ratio < (large ? 3 : 4.5)) low.push(`${n.textContent.trim().slice(0, 24)} ${ratio.toFixed(2)}:1 (${Math.round(px)}px)`);
  }
  const t = globalThis.__targets();
  let auditOut = globalThis.audit(); if (!Array.isArray(auditOut)) auditOut = [];
  return { pop: +(pop.pct + (100 * extra) / (W * H)).toFixed(1), centre, items, overlap, unnamed, low: low.slice(0, 12), lowN: low.length, targets: t.n, small: isTouch ? t.small : 0, smallList: isTouch ? t.smallList.slice(0, 8) : [], audit: auditOut.slice(0, 8), auditN: auditOut.length, sea: globalThis.__sea() };
}, touch);

async function check(name) {
  await L.sleep(700);
  await KIT();
  const m = await look();
  // (other captains' names in a list — the test captains of the e2e and QA runs, «Риск…», «Probe…» — are not words)
  const words = (lang === 'ru' ? await L.latin(p) : await L.cyr(p)).filter((w) => !/^(Ревизор|Probe|Qa\w*|QA\w*|Iron|Verdict|Grey|Gray|Widow|Saltmarrow|Риск|Бой|Порт|Остров|Книга|Урок|Вход|Замер|Экран|Нов|Дбг|Гав|Login|Fight|Risk|Port|Isle|Book|Lesson)/.test(w) && !/@(.*name|.*-who|tb-who|w-sub|hud-captain|uf-)/.test(w));
  const shot = await ph.shot(name);
  const row = { screen: name, ...m, words: words.slice(0, 6), errors: p.errors.splice(0) };
  rows.push(row);
  const bad = [row.auditN ? `audit ${row.auditN}` : '', row.pop > 15 ? `pop ${row.pop}%` : '', row.centre.length ? `centre ${row.centre.length}` : '', row.overlap.length ? `overlap ${row.overlap.length}` : '', row.small ? `small ${row.small}` : '', row.unnamed.length ? `unnamed ${row.unnamed.length}` : '', row.lowN ? `contrast ${row.lowN}` : '', row.words.length ? `words ${row.words.length}` : '', row.errors.length ? `ERRORS ${row.errors.length}` : ''].filter(Boolean);
  L.log(`${size} ${lang} ${name.padEnd(16)} targets ${String(m.targets).padStart(3)} pop ${m.pop}% sea ${m.sea}% ${bad.join(' · ') || 'clean'}`);
  return shot;
}
const open = async (m, tab) => { await p.evaluate(([x, t]) => { const g = globalThis.gravetide; g.open(null); if (x === 'hero' && t) g.hero(t); else g.open(x); }, [m, tab]); await L.sleep(900); };
const closeAll = () => L.closeAll(p, 2);

const tail = () => [...Array(3)].map(() => (lang === 'ru' ? 'абвгдежзик' : 'abcdefghik')[Math.floor(Math.random() * 10)]).join('');
await signIn(ph, { name: (lang === 'ru' ? 'Ревизор' : 'Probe') + tail(), know: true });
await p.evaluate(() => document.body.classList.add('reduce-motion'));
for (const x of ['/level 12', '/silver 20000', '/give rum 30']) await ph.admin(x, 700);
// The harbour: its places and the chips that matter.
await open('port');
for (const t of ['market', 'shipyard', 'tavern', 'quests', 'harbour']) {
  await p.evaluate((x) => document.querySelector(`#modal-panel [data-ptab="${x}"]`)?.click(), t);
  await check(`port_${t}`);
}
await closeAll();
await check('port_quay');
// The sea.
await L.send(p, { t: 'undock' }); await L.sleep(2500); await ph.skipFilm(); await closeAll();
// A spot of its own each run (the ships of the last run's scenes lie about the one before).
const k = (Object.keys(L.SIZES).indexOf(size) * 2 + (lang === 'ru' ? 0 : 1) + Math.floor(Date.now() / 60000)) % 6;
for (const x of [`/tp ${21000 + 3000 * (k % 3)} ${70000 + 2500 * (Math.floor(k / 3) % 2)}`, '/weather clear', '/heal', '/ammo']) await ph.admin(x, x.startsWith('/tp') ? 2500 : 600);
await ph.skipFilm(); await closeAll();
await check('sea');
await p.evaluate(() => globalThis.gravetide.seaHud?.openMenu?.()); await L.sleep(700);
await check('sea_menu');
await closeAll(); await p.keyboard.press('Escape').catch(() => {});
await ph.admin('/foe pirate sloop 380', 2500);
const foeId = await p.evaluate(() => [...globalThis.gravetide.state.ships.values()].find((x) => x.info?.npcRole === 'pirate')?.id);
if (foeId) await p.evaluate((id) => globalThis.gravetide.target(id), foeId);
await L.sleep(900);
await check('sea_mark');
if (await ph.visible('#tc-act[data-act="attack"]') || !touch) await L.send(p, { t: 'attack', target: foeId, mode: 'board' });
await L.sleep(6000);
await check('sea_attack');
await L.send(p, { t: 'attack', stop: true });
// The risk window: a frigate's company.
await ph.admin('/god on', 500); // afloat whatever the frigate does: the window is what is checked
await ph.admin('/foe pirate frigate 120', 2500);
const fr = await p.evaluate(() => [...globalThis.gravetide.state.ships.values()].filter((x) => x.info?.npcRole === 'pirate').map((x) => ({ id: x.id, c: x.info?.cls ?? x.info?.classId })).pop()?.id);
// «Атаковать» on her, and «На абордаж» when the grapples reach: the risk window comes up (a frigate's company).
await L.send(p, { t: 'attack', target: fr, mode: 'board' });
for (let i = 0; i < 30 && !(await p.$('[data-risk="go"]')); i++) {
  await p.evaluate(() => document.querySelector('#tc-act[data-act="board"]:not(.hidden), .act-btn.act-board')?.click());
  await L.sleep(500);
}
if (await p.$('[data-risk="go"]')) await check('risk');
else L.log('no risk window came');
await p.evaluate(() => document.querySelector('[data-risk="back"]')?.click()); await L.sleep(500);
// A ship strikes her colours (the «спускает флаг» card).
await ph.admin('/strike pirate brig', 2500);
await check('surrender');
await p.evaluate(() => document.querySelector('#surrender button:last-of-type')?.click()); await L.sleep(800);
await closeAll();
// The hex battle: the field, the book, the end; then the prize.
await ph.admin('/board pirate sloop 12', 4000); await ph.skipFilm(); await L.sleep(1500);
if ((await ph.state()).tac) {
  await check('battle');
  if (touch) { await p.evaluate(() => document.querySelector('.tb-pad [data-book]')?.click()); await L.sleep(900); await check('battle_book'); await p.evaluate(() => document.querySelector('.k-sheet-root.k-open .k-sheet-x, .k-sheet-root.k-open [data-close]')?.click()); await p.keyboard.press('Escape').catch(() => {}); await L.sleep(500); }
  await L.send(p, { t: 'tac', act: { a: 'quick' } });
  await ph.until(async () => { const s = await ph.state(); return !s?.tac || s.tac.over; }, 30000, 'the end').catch(() => {});
  if ((await ph.state())?.tac?.over) { await L.sleep(900); await check('battle_end'); await p.evaluate(() => document.querySelector('.tb-pad.over button, .tb-banner:not(.hidden) button, .tb-end button')?.click()); }
  await L.sleep(2500); await ph.skipFilm();
  if (await p.$('[data-fate]')) { await L.sleep(600); await check('prize'); await p.evaluate(() => document.querySelector('[data-fate="ransom"], [data-fate="release"]')?.click()); await L.sleep(800); }
}
await closeAll();
// The windows.
for (const [m, tab] of [['hero', 'hero'], ['hero', 'book'], ['hero', 'gear'], ['journal'], ['map'], ['options'], ['ship'], ['crew']]) {
  await open(m, tab);
  await check(`win_${m}${tab && tab !== 'hero' ? '_' + tab : ''}`);
}
await closeAll();
// Her island and its town.
for (const x of ['/isle 3', '/town 2']) await ph.admin(x, 900);
await open('base');
await check('isle');
await p.evaluate(() => document.querySelector('#modal-panel [data-btab="town"]')?.click()); await L.sleep(800);
await check('isle_town');
await closeAll();

const sum = { at: new Date().toISOString(), size: `${W}×${H}`, touch, lang, rows };
writeFileSync(`${OUT}/qa9_${size}_${lang}.json`, JSON.stringify(sum, null, 1));
const tot = (k) => rows.reduce((a, r) => a + (Array.isArray(r[k]) ? r[k].length : r[k] ?? 0), 0);
console.log(`${size} ${lang}: ${rows.length} screens · audit ${tot('auditN')} · centre ${tot('centre')} · overlap ${tot('overlap')} · small ${tot('small')} · unnamed ${tot('unnamed')} · contrast ${tot('lowN')} · words ${tot('words')} · errors ${tot('errors')} · pop max ${Math.max(...rows.map((r) => r.pop))}%`);
await b.close();
