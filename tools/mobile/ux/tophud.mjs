// The sea HUD's top row (owner, 2026-10-15, a Telegram screenshot: «рядом с картой слева иконки… друг на друга
// налезли, я бы их вниз карты подспустил»; «крабовый пляж… рядом с картой и аватаркой одну длину и выровнял по
// высоте четко по верху»). A captain with an island of her own sails to a creature lair; the top row is measured:
//   the portrait's ring, the chart, the adventure card (its top, height, the gaps either side), the round buttons
//   under the chart (news, menu, «Остров»: sizes, gaps, overlaps, their badges and label inside the screen).
// States: none (no card), lair (the card, folded), open (the card unfolded), ship (a ship marked), boss.
//   GPORT=58994 SIZE=844x390 LANG2=ru TG=25 OUT=assets/raw/audit/tophud node tools/mobile/ux/tophud.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const sizes = (process.env.SIZE ?? '844x390').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru').split(',');
const tg = Number(process.env.TG ?? 0);
const port = Number(process.env.GPORT ?? 58994);
const OUT = process.env.OUT ?? 'assets/raw/audit/tophud';
const states = (process.env.STATES ?? 'none,lair,open,boss,ship').split(',');
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let fails = 0;
const rows = [];
try {
  for (const lang of langs) {
    // one captain per language, at the first size; the others by resizing the same page
    const [W0, H0] = sizes[0];
    const p = await L.page(b, [W0, H0], { lang, touch: process.env.TOUCH ? process.env.TOUCH === '1' : W0 < 1000 });
    if (tg) {
      // Telegram's fullscreen: html.tg-app and its content safe area at the top (src/tg.ts applyInsets), its two pills
      // drawn in that band so a collision shows
      await p.ctx.addInitScript((t) => {
        addEventListener('DOMContentLoaded', () => {
          document.documentElement.classList.add('tg-app');
          const r = document.documentElement.style;
          r.setProperty('--sa-t', `${t}px`);
          r.setProperty('--tg-top', `${t}px`);
          for (const [side, w] of [['left', 80], ['right', 64]]) {
            const d = document.createElement('div');
            d.className = 'tg-pill-fake';
            d.style.cssText = `position:fixed;top:${Math.round(t * 0.18)}px;${side}:${Math.round(t * 0.5)}px;width:${w}px;height:${Math.round(t * 0.66)}px;border-radius:99px;background:rgba(40,50,60,.85);z-index:2147483000;pointer-events:none`;
            document.body.append(d);
          }
        });
      }, tg);
    }
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/isle');
    await L.say(p, '/god');
    await L.say(p, '/silver 287');
    await L.sleep(800);
    for (const [W, H] of sizes) {
      await p.setViewportSize({ width: W, height: H });
      await L.sleep(500);
      for (const st of states) {
        await L.closeAll(p, 2);
        await dismiss(p);
                if (st === 'none') { await L.say(p, '/tp black_coast'); await L.sleep(1500); }
        if (st === 'lair' || st === 'open') {
          await L.say(p, '/lair crab_beach go');
          await dismiss(p);
          for (let i = 0; i < 20 && !(await p.$('#advcard:not(.hidden) .ac-card')); i++) {
            // the card waits on «Осмотреть…» (main.ts autoFold)
            await p.evaluate(() => { for (const b of document.querySelectorAll('#touch button, #hud-bottom button')) if (/Осмотреть|Look/.test(b.textContent) && b.getBoundingClientRect().width) { b.click(); break; } });
            await L.sleep(400);
          }
          if (st === 'open') await p.evaluate(() => { const c = document.querySelector('#advcard .ac-card:not(.open) .ac-head'); c?.click(); });
          else await p.evaluate(() => { const c = document.querySelector('#advcard .ac-card.open .ac-head'); c?.click(); });
        }
        if (st === 'ship') {
          await L.say(p, '/tp gravewater');
          await L.sleep(1200);
          await L.say(p, '/foe merchant brig 300');
          await L.sleep(1500);
          await p.evaluate(() => { const g = globalThis.gravetide, s = g.state; let best = null, bd = 1e9; for (const x of s.ships.values()) { if (x.id === s.entityId || !x.cur) continue; const d = Math.hypot(x.cur.x - s.ownDisplay.x, x.cur.y - s.ownDisplay.y); if (d < bd) { bd = d; best = x.id; } } if (best !== null) g.target(best); });
        }
        if (st === 'boss') { await L.say(p, '/tp black_coast'); await L.sleep(1200); await L.say(p, '/boss lantern_maw'); }
        await L.sleep(1500);
        await dismiss(p);
        await L.sleep(400);
        const m = await measure(p);
        const name = `${W}x${H}_${lang}${tg ? '_tg' + tg : ''}_${st}`;
        await p.screenshot({ path: `${OUT}/${name}.png` });
        const bad = judge(m, W, H, tg);
        fails += bad.length;
        rows.push({ name, ...m, bad });
        L.log(`${bad.length ? 'FAIL' : 'ok  '} ${name} ${summary(m)}${bad.length ? '\n     ' + bad.join('\n     ') : ''}`);
      }
    }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report${tg ? '_tg' : ''}.json`, JSON.stringify(rows, null, 1));
L.log(`${fails} problems`);
process.exit(fails ? 1 : 0);

// sheets that came by themselves (a new level's choice) and the chat closed
async function dismiss(p) {
  await p.evaluate(() => globalThis.gravetide.open(null));
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => { const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut]')]; x.forEach((b) => b.click()); if (document.body.classList.contains('chat-open')) document.getElementById('chat-toggle')?.click(); return x.length; });
    if (!n) break;
    await L.sleep(400);
  }
}

function summary(m) {
  const f = (r) => (r ? `${r.l},${r.t} ${r.w}x${r.h}` : '—');
  return `col ${m.colN}×${m.colB} ring ${f(m.ring)} map ${f(m.map)} card ${f(m.card)} gaps ${m.gapL ?? '—'}/${m.gapR ?? '—'} btns ${m.btns.map((x) => `${x.id}:${f(x)}`).join(' ')}${m.stack ? ` stack ${f(m.stack)} gaps ${m.sgL}/${m.sgR}` : ''}`;
}

function judge(m, W, H, tg) {
  const bad = [];
  const top = m.peek ? m.ring?.t : m.map?.t;
  if (m.ring && m.map && !m.peek && Math.abs(m.ring.t - m.map.t) > 2) bad.push(`portrait top ${m.ring.t} ≠ map top ${top}`);
  if (m.card) {
    if (Math.abs(m.card.t - top) > 2) bad.push(`card top ${m.card.t} ≠ map top ${top}`);
    if (!m.open && Math.abs(m.card.h - m.rowH) > 2) bad.push(`card height ${m.card.h} ≠ row ${m.rowH}`);
    if (!m.open && Math.abs(m.gapL - m.gapR) > 2) bad.push(`gaps ${m.gapL} / ${m.gapR}`);
    if (m.cta && (m.cta.r > m.card.r + 0.5 || m.cta.b > m.card.b + 0.5 || m.cta.l < m.card.l - 0.5 || m.cta.t < m.card.t - 0.5)) bad.push(`CTA out of the card ${JSON.stringify(m.cta)}`);
    if (m.cta && m.ctaScroll) bad.push('CTA text cut ' + m.ctaScroll);
  }
  if (m.stack && !m.card && top !== undefined && Math.abs(m.stack.t - top) > 2) bad.push(`top stack ${m.stack.t} ≠ map top ${top}`);
  if (m.stack && !m.card && m.sgL !== null && m.sgR !== null && Math.abs(m.sgL - m.sgR) > 2) bad.push(`top stack gaps ${m.sgL} / ${m.sgR}`);
  for (const x of [...m.btns, ...m.extra]) if (x.l < -0.5 || x.t < -0.5 || x.r > W + 0.5 || x.b > H + 0.5) bad.push(`${x.id} off the screen`);
  const all = [m.peek ? null : null, m.ring && { id: 'portrait', ...m.ring }, m.cap && { id: 'captain', ...m.cap }, m.map && { id: 'map', ...m.map }, m.card && { id: 'card', ...m.card }, m.stack && { id: 'stack', ...m.stack }, ...m.btns, ...m.extra, ...m.pills].filter(Boolean);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], c = all[j];
    if ((a.id === 'portrait' && c.id === 'captain') || (a.id === 'captain' && c.id === 'portrait')) continue;
    if (a.id.startsWith(c.id + ':') || c.id.startsWith(a.id + ':')) continue;
    const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (ox > 1 && oy > 1) bad.push(`${a.id} × ${c.id} overlap ${Math.round(ox)}×${Math.round(oy)}`);
  }
  // one COLUMN under the chart (owner, 2026-10-16: «вертикально», after «в одну линию»): one right edge (the chart's),
  // even gaps, under the chart, in the screen
  const col = [...m.btns.filter((x) => !x.id.includes(':')), ...m.extra.filter((x) => x.id === '#hud-chat > .chat-toggle' && m.map && x.l > W / 2)].sort((a, c) => a.t - c.t);
  if (col.length > 1 && m.map) {
    if (Math.max(...col.map((x) => x.r)) - Math.min(...col.map((x) => x.r)) > 1) bad.push(`the column's right edges differ ${col.map((x) => x.r)}`);
    const gaps = col.slice(1).map((x, i) => Math.round((x.t - col[i].b) * 10) / 10);
    if (Math.max(...gaps) - Math.min(...gaps) > 1) bad.push(`the column's gaps differ ${gaps}`);
    if (Math.min(...gaps) < 2) bad.push(`the column's gap ${Math.min(...gaps)} too small`);
    if (Math.abs(col[0].r - m.map.r) > 1 && !m.peek) bad.push(`the column's right edge ${col[0].r} ≠ the chart's ${m.map.r}`);
    if (col[0].t < m.map.b && !m.peek) bad.push('the column is not under the chart');
    if (col.at(-1).b > H + 0.5) bad.push('the column runs off the screen');
  }
  m.colN = col.length;
  m.colB = col.length ? col[0].w : null;
  if (m.btns.length > 1) {
    const s = new Set(m.btns.filter((x) => !x.id.includes(':')).map((x) => x.w));
    if (s.size > 1) bad.push(`button sizes differ ${[...s]}`);
  }
  return bad;
}

async function measure(p) {
  return p.evaluate(() => {
    const R = (r) => ({ l: Math.round(r.left * 10) / 10, t: Math.round(r.top * 10) / 10, r: Math.round(r.right * 10) / 10, b: Math.round(r.bottom * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
    const vis = (e) => { if (!e) return false; for (let q = e; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const frame = document.querySelector('#hud-captain .cs-frame');
    let ring = null, cap = null;
    if (vis(frame)) {
      // the ring is the frame's ::after, inset −0.32 of the face
      const f = frame.getBoundingClientRect(), k = f.width * 0.32;
      ring = R({ left: f.left - k, top: f.top - k, right: f.right + k, bottom: f.bottom + k, width: f.width + 2 * k, height: f.height + 2 * k });
      const cs = document.querySelector('#hud-captain .cs');
      const c = cs.getBoundingClientRect();
      // the plate's visible extent: the ring and the bars' column
      let l = ring.l, t = ring.t, r = ring.r, b = ring.b;
      for (const e of cs.querySelectorAll('.cs-row, .cs-silver')) { if (!vis(e)) continue; const x = e.getBoundingClientRect(); l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom); }
      cap = R({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });
      void c;
    }
    const mapEl = document.getElementById('hud-map');
    const map = vis(mapEl) ? R(mapEl.getBoundingClientRect()) : null;
    const cardEl = document.getElementById('advcard');
    let card = null, cta = null, ctaScroll = false, open = false;
    if (vis(cardEl)) {
      card = R(cardEl.getBoundingClientRect());
      open = !!cardEl.querySelector('.ac-card.open');
      const btn = [...cardEl.querySelectorAll('.ac-acts .btn')].find(vis);
      if (btn) { cta = R(btn.getBoundingClientRect()); { const rg = document.createRange(); rg.selectNodeContents(btn); const t = rg.getBoundingClientRect(), o = btn.getBoundingClientRect(); ctaScroll = t.left < o.left - 0.5 || t.right > o.right + 0.5 || t.top < o.top - 0.5 || t.bottom > o.bottom + 0.5 ? `text ${Math.round(t.left)}..${Math.round(t.right)}×${Math.round(t.top)}..${Math.round(t.bottom)} in ${Math.round(o.left)}..${Math.round(o.right)}×${Math.round(o.top)}..${Math.round(o.bottom)}` : false; } }
    }
    const btns = [];
    for (const id of ['tc-news', 'tc-menu', 'tc-isle']) {
      const e = document.getElementById(id);
      if (!vis(e)) continue;
      btns.push({ id, ...R(e.getBoundingClientRect()) });
      for (const s of e.querySelectorAll('.k-badge, .tc-isle-l, .kc')) if (vis(s)) btns.push({ id: `${id}:${s.className.split(' ')[0]}`, ...R(s.getBoundingClientRect()) });
    }
    const extra = [];
    for (const sel of ['#mm-tab', '#hud-chat > .chat-toggle', '#hud-chat > .chat-toast', '#unread', '#tc-fire', '#tc-ammo', '#tc-lock', '#tc-special', '#tc-actrow', '#tc-cast', '#tc-deck', '#tc-stick', '#toasts > .toast', '#promo-sea', '#hud-autosail', '#encounter', '#surrender']) { const e = document.querySelector(sel); if (vis(e) && !e.classList.contains('hidden')) extra.push({ id: sel, ...R(e.getBoundingClientRect()) }); }
    document.querySelectorAll('#hud-bottom > *').forEach((e, i) => { if (vis(e) && !e.classList.contains('hidden')) extra.push({ id: `#hud-bottom>${i}`, ...R(e.getBoundingClientRect()) }); });
    const pills = [...document.querySelectorAll('.tg-pill-fake')].map((e, i) => ({ id: 'tgpill' + i, ...R(e.getBoundingClientRect()) }));
    let stack = null;
    for (const e of document.querySelectorAll('#hud-stack > :not(.hidden)')) {
      if (!vis(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.top > innerHeight * 0.3) continue;
      stack = stack ? R({ left: Math.min(stack.l, r.left), top: Math.min(stack.t, r.top), right: Math.max(stack.r, r.right), bottom: Math.max(stack.b, r.bottom), width: 0, height: 0 }) : R(r);
    }
    if (stack) { stack.w = Math.round((stack.r - stack.l) * 10) / 10; stack.h = Math.round((stack.b - stack.t) * 10) / 10; }
    const gapL = card && cap ? Math.round((card.l - cap.r) * 10) / 10 : null;
    const tab = document.getElementById('mm-tab'), chartL = document.body.classList.contains('mm-peek') && vis(tab) ? tab.getBoundingClientRect().left : map?.l;
    const gapR = card && chartL !== undefined ? Math.round((chartL - card.r) * 10) / 10 : null;
    const rowH = cap ? cap.h : null;
    const sgL = stack && cap ? Math.round((stack.l - cap.r) * 10) / 10 : null, sgR = stack && chartL !== undefined ? Math.round((chartL - stack.r) * 10) / 10 : null;
    const peek = document.body.classList.contains('mm-peek');
    return { sgL, sgR, peek, ring, cap, map: peek ? null : map, card, cta, ctaScroll, open, btns, extra, pills, stack, gapL, gapR, rowH };
  });
}
