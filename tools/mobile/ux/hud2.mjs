// The painted HUD's return (owner, 2026-10-07: «ты удалил всё, что было, и штурвал и вообще всё… возвращай иконки,
// обводки графические… сделать круче»; «при наведении на цель показывать иконку атаки»; «наводя на кого-то пальцем или
// на десктопе мышкой, надо предлагать захват цели и преследование и бой»). A fresh captain casts off by the harbour's
// «В море» and the screens he judges are taken and measured:
//   sea      right after leaving port
//   target   a pirate marked
//   hover    the mouse resting on her (the attack cursor — drawn into the picture, a headless browser shows none — and
//            her choices beside her); on a touch screen a tap on her (the choices, the attack mark over her)
//   fight    «Атаковать» under way, the guns at work
//   battle   the hex battle (on a desk the mouse over a stack hers may strike: the sabres)
// On each, by numbers (as ux.mjs): controls, audit() and center(), the crop check, the popup budget (≤ 15 %, none in
// the middle; the target's choices are her own control, invoked, and counted apart as `menu`), overlaps.
//   GPORT=58861 SIZE=1500x600 TOUCH=0 LANG2=ru TAG=after OUT=assets/raw/audit/hud2 node tools/mobile/ux/hud2.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Phone, signIn, foeOnScreen } from '../e2e/pages.mjs';

const [W, H] = (process.env.SIZE ?? '1500x600').split('x').map(Number);
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const lang = process.env.LANG2 ?? 'ru';
const tag = process.env.TAG ?? 'after';
const port = Number(process.env.GPORT ?? 58861);
const OUT = process.env.OUT ?? 'assets/raw/audit/hud2';
const only = (process.env.ONLY ?? 'sea,target,hover,fight,battle').split(',');
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
  for (const sel of ['.k-hint', '#hud-watch', '#tut-finger', '#hud-feed', '#hud-tip', '#sea-herald', '#sea-boss']) {
    for (const e of document.querySelectorAll(sel)) {
      if (!vis(e) || (modalUp && sel === '#hud-watch')) continue;
      if (items.some((i) => i.startsWith(sel))) continue;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      pct += (100 * r.width * r.height) / (W * H); items.push(`${sel} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
      if (sel !== '#tut-finger' && r.left < cz.r && r.right > cz.l && r.top < cz.b && r.bottom > cz.t) centre.push(`${sel} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
    }
  }
  // the target's choices: her own control, invoked by the pointer — its share of the screen apart
  let menu = 0;
  for (const e of document.querySelectorAll('#tmenu:not(.hidden) .tm-item')) { const r = e.getBoundingClientRect(); const l = e.querySelector('.tm-l')?.getBoundingClientRect(); menu += r.width * r.height + (l ? l.width * l.height : 0); }
  const sel = ['#hud-captain', '#hud-map', '#hud-stack > :not(.hidden)', '#toasts > .toast', '#tc-stick', '#tc-fire', '#tc-act', '#tc-special', '#tc-menu', '#tc-news', '#tc-target', '#tc-lock', '#tc-ammo', '#tc-deck', '#tc-speed', '#hud-bottom', '#hud-watch', '#sea-herald'];
  const boxes = [];
  for (const q of sel) document.querySelectorAll(q).forEach((e) => {
    if (!vis(e)) return;
    let r = e.getBoundingClientRect();
    if (e.id === 'hud-captain' || e.id === 'hud-bottom') { const rs = [...e.querySelectorAll('*')].filter(vis).map((k) => k.getBoundingClientRect()).filter((k) => k.height > 0 && k.width > 0); if (rs.length) r = new DOMRect(Math.min(...rs.map((k) => k.left)), Math.min(...rs.map((k) => k.top)), Math.max(...rs.map((k) => k.right)) - Math.min(...rs.map((k) => k.left)), Math.max(...rs.map((k) => k.bottom)) - Math.min(...rs.map((k) => k.top))); else return; }
    if (r.width < 2 || r.height < 2) return;
    boxes.push({ q: e.id ? '#' + e.id : q, r, e });
  });
  const overlap = [];
  if (!modalUp && !document.body.classList.contains('tac')) for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, c = boxes[j].r;
    if (boxes[i].e.contains(boxes[j].e) || boxes[j].e.contains(boxes[i].e)) continue;
    if ([boxes[i].q, boxes[j].q].sort().join() === '#tc-speed,#tc-stick') continue; // (her speed in the sail ring's gap under the wheel, by design)
    if (a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) overlap.push(`${boxes[i].q} × ${boxes[j].q}`);
  }
  // every control's picture painted (no letter for a glyph) and every round control in its painted ring
  const glyphs = [...document.querySelectorAll('#touch .glyph, #tmenu .glyph, #hud-captain .glyph')].filter(vis).map((e) => `${e.closest('[id]')?.id}:${e.textContent}`);
  const t = globalThis.__targets();
  let audit = globalThis.audit(); if (!Array.isArray(audit)) audit = [];
  let center = globalThis.center(); if (!Array.isArray(center)) center = [];
  const crop = await globalThis.__crop();
  const cur = document.querySelector('#world')?.dataset.cur ?? document.querySelector('#board-tac canvas')?.dataset.cur ?? '';
  return { controls: t.n, controlList: t.list, small: t.small, smallList: t.smallList, pop: +pct.toFixed(1), menu: +(100 * menu / (W * H)).toFixed(1), centre, items, overlap, audit, center, crop: crop.fails, cropChecked: crop.checked, cropList: crop.list, glyphs, cur, tm: !document.querySelector('#tmenu')?.classList.contains('hidden') };
});

/** A headless browser draws no cursor: the one the page asks for, put into the picture where the mouse is. */
const showCursor = (x, y) => p.evaluate(([x, y]) => {
  document.getElementById('qa-cursor')?.remove();
  const e = document.elementFromPoint(x, y);
  const m = e ? /url\("?([^")]+)"?\)\s*(\d+)\s+(\d+)/.exec(getComputedStyle(e).cursor) : null;
  if (!m) return '';
  const img = document.createElement('img');
  img.id = 'qa-cursor';
  img.src = m[1];
  img.style.cssText = `position:fixed;left:${x - +m[2]}px;top:${y - +m[3]}px;z-index:99999;pointer-events:none`;
  document.body.append(img);
  return e.dataset?.cur ?? 'url';
}, [x, y]);
const hideCursor = () => p.evaluate(() => document.getElementById('qa-cursor')?.remove());

async function check(screen, beforeShot = null) {
  if (!beforeShot) {
    await L.sleep(700);
    if (screen !== 'menu') await later();
  }
  await kit();
  // (a sailing target: the mouse on her and the picture at once, the measures after — they take a while)
  if (beforeShot) {
    await beforeShot();
    await p.screenshot({ path: `${OUT}/${tag}_${name}_${screen}.png` });
  }
  const m = await look();
  if (!beforeShot) await p.screenshot({ path: `${OUT}/${tag}_${name}_${screen}.png` });
  const row = { screen, ...m, errors: p.errors.splice(0) };
  rows.push(row);
  L.log(`${tag} ${name} ${screen.padEnd(7)} controls ${String(m.controls).padStart(2)} (small ${m.small}) · audit ${m.audit.length} · center ${m.center.length} · crop ${m.crop.length}/${m.cropChecked} · pop ${m.pop}%${m.centre.length ? ` CENTRE ${m.centre.length}` : ''}${m.tm ? ` · menu ${m.menu}%` : ''}${m.cur ? ` · cursor ${m.cur}` : ''}${m.overlap.length ? ` · overlap ${m.overlap.join(', ')}` : ''}${m.glyphs.length ? ` · GLYPHS ${m.glyphs.join(' ')}` : ''}${row.errors.length ? ` · ERRORS ${row.errors.length}` : ''}`);
  if (m.crop.length) L.log('  crop: ' + m.crop.map((c) => `${c.el} ${c.why}`).join(' | '));
  if (m.audit.length) L.log('  audit: ' + JSON.stringify(m.audit).slice(0, 400));
  return row;
}
const later = async () => {
  for (let i = 0, quiet = 0; i < 10 && quiet < 2; i++) {
    const ok = await p.evaluate(() => { const b = document.querySelector('.k-sheet-root.k-open .lu-pick') ?? [...document.querySelectorAll('.k-sheet-root.k-open button')].find((x) => /Позже|Later/.test(x.innerText)); b?.click(); return !!b; });
    quiet = ok ? 0 : quiet + 1;
    await L.sleep(ok ? 800 : 300);
  }
};

const tail = () => [...Array(4)].map(() => 'abcdefghik'[Math.floor(Math.random() * 10)]).join('');
try {
  await signIn(ph, { name: `Hd${tag.slice(0, 1)}${tail()}`, know: true });
} catch (e) {
  L.log(`sign-in by finger failed (${e.message}); by the page`);
  await p.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => !!globalThis.gravetide, null, { timeout: 90000 });
  await p.fill('#login-name', `Hd${tag.slice(0, 1)}${tail()}`);
  await p.evaluate(() => document.querySelector('#login-form button[type="submit"]').click());
  await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 60000 });
  await p.evaluate(() => { document.querySelector('.captain-card[data-id="corsair"]').click(); const k = document.querySelector('#know-sea'); if (k) k.checked = true; document.querySelector('#pick-captain').click(); });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) { await p.evaluate(() => document.querySelectorAll('.film, #prologue').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })))); await L.sleep(700); }
  await L.sleep(2000);
  await p.evaluate(() => document.querySelector('#modal-panel .help-list') && globalThis.gravetide.open(null));
}
if (await p.evaluate(() => !!globalThis.gravetide.state.onboarding?.stage)) { await L.send(p, { t: 'onboarding', action: 'skip_all' }); await L.sleep(800); }
await p.evaluate(() => document.body.classList.add('reduce-motion'));
for (const x of ['/level 3', '/silver 1300', '/god on']) await ph.admin(x, 700);
await later();
if (!(await ph.visible('#modal-panel .w-tab--go'))) await p.evaluate(() => globalThis.gravetide.open('port'));
await L.sleep(900);
await ph.tap('#modal-panel .w-tab--go', '«В море»', 15000);
await ph.until(async () => !(await ph.state())?.docked, 30000, 'at sea');
for (let i = 0; i < 8 && (await p.$('.film')); i++) { await ph.skipFilm(); await L.sleep(600); }
await L.sleep(1200);
await later();
await p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
await L.sleep(2000);
if (!touch) await p.mouse.move(W * 0.3, H * 0.75); // the mouse resting on the open sea
if (only.includes('sea')) await check('sea');
// a pirate, marked
await ph.admin(`/foe pirate sloop ${touch ? 160 : 130}`, 2500);
const foe = await foeOnScreen(p);
if (only.includes('target') && foe) {
  await p.evaluate((id) => globalThis.gravetide.target(id), foe.id);
  await L.sleep(1200);
  await check('target');
}
// the mouse on her (the cursor and her choices) / a finger on her (the choices and the mark over her)
if (only.includes('hover') && foe) {
  // (her, in the open sea: a pirate that lies under the HUD's bottom row cannot be pointed at)
  const inOpen = () => p.evaluate(([W, H]) => {
    const g = globalThis.gravetide, s = g.state;
    for (const x of s.ships.values()) {
      if (x.info?.npcRole !== 'pirate' || x.id === s.entityId) continue;
      const sx = g.renderer.sx(x.cur.x), sy = g.renderer.sy(x.cur.y);
      if (sx > W * 0.2 && sx < W * 0.75 && sy > H * 0.22 && sy < H * 0.66 && document.elementFromPoint(sx, sy)?.id === 'world') return { id: x.id, x: sx, y: sy, on: true };
    }
    return null;
  }, [W, H]);
  let f = await inOpen();
  for (let i = 0; i < 5 && !f; i++) {
    await ph.admin(`/foe pirate sloop ${100 + i * 15}`, 1500);
    for (let k = 0; k < 12 && !f; k++) { await L.sleep(400); f = await inOpen(); }
  }
  if (f) await p.evaluate((id) => globalThis.gravetide.target(id), f.id);
  const foe2 = f?.id;
  const where = () => p.evaluate((id) => { const g = globalThis.gravetide, x = g.state.ships.get(id); return x ? { x: g.renderer.sx(x.cur.x), y: g.renderer.sy(x.cur.y), on: true } : null; }, foe2);
  if (f?.on) {
    if (touch) await p.touchscreen.tap(f.x, f.y);
    else {
      await p.mouse.move(f.x - 30, f.y + 20);
      await p.mouse.move(f.x, f.y, { steps: 4 });
      await L.sleep(500);
      const g = await where();
      if (g) await p.mouse.move(g.x, g.y);
      await L.sleep(400);
      const g2 = await where();
      if (g2) { await p.mouse.move(g2.x, g2.y); await showCursor(g2.x, g2.y); }
    }
    if (touch) await L.sleep(500);
    // (she sails on: the mouse kept on her up to the picture)
    await check('hover', touch ? null : async () => {
      // the mouse kept on her a moment (her choices open after a short rest), then the picture
      for (let k = 0; k < 6; k++) { const g = await where(); if (g) await p.mouse.move(g.x, g.y); await L.sleep(90); }
      const h = await where();
      if (h) { await p.mouse.move(h.x, h.y); await L.sleep(60); await showCursor(h.x, h.y); }
    });
    await hideCursor();
    // a choice taken: «Преследовать» (the pursuit), as the next screen's fight
    const picked = await p.evaluate(() => { const b = document.querySelector('#tmenu:not(.hidden) [data-tm="pursue"]'); if (!b) return false; b.click(); return true; });
    L.log(`the target's choices: ${picked ? '«Преследовать» taken' : 'NOT OPEN'}`);
  } else L.log('the pirate is off the screen');
}
if (!touch) await p.mouse.move(W * 0.3, H * 0.8);
// a fight: the pursuit under way, her guns at work
if (only.includes('fight') && foe) {
  if (!(await p.evaluate(() => !!globalThis.gravetide.state.pursuit))) await L.send(p, { t: 'attack', target: foe.id, mode: 'board' });
  await ph.until(() => p.evaluate(() => !!globalThis.gravetide.state.you?.combat), 30000, 'in a fight').catch(() => L.log('no gunfire came'));
  await L.sleep(1500);
  await check('fight');
}
// the hex battle
if (only.includes('battle')) {
  await ph.admin('/board pirate sloop 12', 4000);
  for (let i = 0; i < 6 && (await p.$('.film')); i++) { await ph.skipFilm(); await L.sleep(600); }
  await ph.until(async () => !!(await ph.state())?.tac, 20000, 'the hex battle').catch(() => {});
  await L.sleep(1800);
  if ((await ph.state())?.tac) {
    if (!touch) {
      // her turn, then the mouse over the field until the cursor turns to the sabres (or the gun)
      await ph.until(() => p.evaluate(() => !!globalThis.gravetide.state.boardTac?.mine), 20000, 'her turn').catch(() => {});
      const box = await p.evaluate(() => { const c = document.querySelector('#board-tac canvas'); const r = c?.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height] : null; });
      let at = null;
      if (box) for (let y = box[1] + 20; y < box[1] + box[3] - 10 && !at; y += 26) for (let x = box[0] + 20; x < box[0] + box[2] - 10; x += 26) {
        await p.mouse.move(x, y);
        if (await p.evaluate(() => !!document.querySelector('#board-tac canvas')?.dataset.cur)) { at = [x, y]; break; }
      }
      if (at) { await p.mouse.move(at[0] + 2, at[1] + 2); await showCursor(at[0] + 2, at[1] + 2); }
      L.log(`the battle's cursor: ${at ? 'found' : 'no stack to strike'}`);
    }
    await check('battle');
    await hideCursor();
  } else L.log('no battle came');
}
writeFileSync(`${OUT}/${tag}_${name}.json`, JSON.stringify({ at: new Date().toISOString(), tag, size: `${W}x${H}`, touch, lang, port, rows }, null, 1));
await b.close();
