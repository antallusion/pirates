// The harbour's every place, and the windows around it, laid out on a phone held sideways (owner, 2026-10-22: «что-то
// с версткой текста на бирже и кнопки выходят за рамку» — the exchange's table squeezed to a letter a line, its bank cut
// at the top, «Подписать» out of its row, the page past the window's frame). A captain at a great harbour of the League
// (an exchange and a bank), with something in every place — her forwards signed, an order posted, silver in the bank,
// the auction stirred, pets and tattoos, her own island — and every port tab, its sub-switches, the tattoos', the
// island's, the shop's, the ship's and the journal's windows measured. Found automatically, in the window on top:
//   wrap   a word broken inside itself across lines (the letter-by-letter column), or a line of ≤3 characters of a
//          longer text;
//   out    an element past its window's frame (what its scrolling boxes do not clip), or the window past the screen
//          or above Telegram's controls;
//   hscroll a box that scrolls sideways (a designed swipe row with no scrollbar apart);
//   cut    a button clipped sideways by a box that cannot scroll to it;
//   btn    a button outside its row or card;
//   cover  a button, a tab, a field whose middle is under something else (a header, a tab strip, another button);
//   overlap two buttons over each other.
//   GPORT=58640 SIZE=1093x481,844x390,812x375,740x360,480x270 LANG2=ru,en TG=46 OUT=assets/raw/audit/ports node tools/mobile/ux/ports.mjs
//   (TG=0: the browser; SIZE=1440x900 TG=0 for a desk.)  ONLY=exchange,shop — some screens;  SHOTS=0;  LIST=1 — all.
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const sizes = (process.env.SIZE ?? '1093x481,844x390,812x375,740x360,480x270').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru,en').split(',');
const port = Number(process.env.GPORT ?? 58640);
const tg = Number(process.env.TG ?? 46);
const OUT = process.env.OUT ?? 'assets/raw/audit/ports';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SHOTS = process.env.SHOTS !== '0';
mkdirSync(OUT, { recursive: true });

// The port's places by their tab (port.ts): the ones that open a window of their own are measured as that window.
const SUBS = '[data-qchip], [data-xtab]'; // a place's own switch: each of its pages measured too
// The windows around the harbour: each opened afresh; `tabs` its own tabs (each measured, with the chips of its page),
// `opens` its buttons that open a window of their own (the island's side buttons, the ship's gear and looks) — each
// measured as the window on top.
const WTABS = '#modal-panel:not([data-modal="port"]) .w-tab:not(.w-tab--go), #modal-panel .tabs .tab, #modal-panel button[data-view]';
const WCHIPS = '#modal-panel:not([data-modal="port"]) .w-pane > .w-chips .w-chip';
const WINDOWS = [
  { id: 'tattoos', open: (p) => viaPort(p, 'tattoo'), tabs: WTABS },
  { id: 'isle', open: (p) => viaPort(p, 'isle'), opens: '#isle:not(.hidden) .is-sb:not(:disabled)' },
  { id: 'shop', open: (p) => p.evaluate(() => globalThis.gravetide.shop()), tabs: WTABS, chips: WCHIPS },
  { id: 'ship', open: (p) => p.evaluate(() => globalThis.gravetide.open('ship')), opens: '#modal-panel [data-open-gear], #modal-panel [data-open-look]' },
  { id: 'journal', open: (p) => p.evaluate(() => globalThis.gravetide.open('journal')), tabs: WTABS, chips: WCHIPS },
];
async function viaPort(p, tab) {
  await p.evaluate(() => globalThis.gravetide.open('port'));
  await L.sleep(500);
  await p.evaluate((t) => document.querySelector(`#modal-panel [data-ptab="${t}"]`)?.click(), tab);
}
const keyOf = (e) => (e.dataset.tab || e.dataset.view || e.dataset.iside || e.textContent.trim() || '').slice(0, 14).replace(/[^\p{L}\p{N}_-]+/gu, '');

const b = await L.browser();
const rows = [];
const per = {};
let total = 0;
try {
  for (const lang of langs) {
    const [W0, H0] = sizes[0];
    const p = await L.page(b, [W0, H0], { lang, touch: process.env.TOUCH ? process.env.TOUCH === '1' : W0 < 1000 });
    if (tg) await p.ctx.addInitScript((t) => {
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('tg-app');
        const r = document.documentElement.style;
        r.setProperty('--sa-t', `${t}px`);
        r.setProperty('--tg-top', `${t}px`);
      });
    }, tg);
    // toasts come and go: not what is measured
    await p.ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#toasts{visibility:hidden!important}'; document.head.append(s); }));
    // a long-named captain (the longest name the harbour takes: 20), for the names' ellipses
    const sfx = String(Math.floor(Math.random() * 900) + 100);
    await L.login(p, { port, know: true, name: (lang === 'en' ? 'Maximiliana Hartw' : 'Аделаида Крестова') + sfx });
    await L.closeAll(p);
    await seed(p);
    for (const [W, H] of sizes) {
      await p.setViewportSize({ width: W, height: H });
      await L.sleep(500);
      const tag = `${W}x${H}_${lang}${tg ? '_tg' : ''}`;
      // the port's places
      await shut(p);
      await p.evaluate(() => globalThis.gravetide.open('port'));
      await L.sleep(700);
      const tabs = await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-ptab]')].map((e) => e.dataset.ptab).filter((x) => !['sea', 'tattoo', 'isle'].includes(x)));
      for (const t of tabs) {
        if (only && !only.includes(t)) continue;
        await p.evaluate((t) => { if (globalThis.gravetide.modal() !== 'port') globalThis.gravetide.open('port'); }, t);
        await L.sleep(200);
        await p.evaluate((t) => document.querySelector(`#modal-panel [data-ptab="${t}"]`)?.click(), t);
        await L.sleep(600);
        const subs = await p.evaluate((s) => [...document.querySelectorAll(`#modal-panel :is(${s})`)].map((e) => [e.dataset.qchip ? 'qchip' : 'xtab', e.dataset.qchip ?? e.dataset.xtab]), SUBS);
        if (!subs.length) await measure(p, `${tag}_${t}`, t);
        for (const [attr, v] of subs) {
          await p.evaluate(([a, v]) => document.querySelector(`#modal-panel [data-${a}="${v}"]`)?.click(), [attr, v]);
          await L.sleep(500);
          await measure(p, `${tag}_${t}-${v}`, t);
        }
      }
      // the windows around the harbour, each with its tabs
      for (const w of WINDOWS) {
        if (only && !only.includes(w.id)) continue;
        await shut(p);
        await w.open(p);
        await L.sleep(1100);
        await offers(p);
        await measure(p, `${tag}_${w.id}`, w.id);
        const tabs = w.tabs ? await p.evaluate((s) => document.querySelectorAll(s).length, w.tabs) : 0;
        // (each tab from the window opened afresh: a chip may open another window — the journal's «Сага»)
        const tab = async (i) => {
          await shut(p);
          await w.open(p);
          await L.sleep(900);
          await offers(p);
          const k = await p.evaluate(([s, i, f]) => { const e = [...document.querySelectorAll(s)][i]; if (!e) return null; e.click(); return (0, eval)(f)(e); }, [w.tabs, i, keyOf.toString()]);
          await L.sleep(600);
          return k;
        };
        for (let i = 0; i < Math.min(tabs, 14); i++) {
          const k = await tab(i);
          if (k === null) break;
          await measure(p, `${tag}_${w.id}-${i}-${k}`, w.id);
          const chips = w.chips ? await p.evaluate((s) => [...document.querySelectorAll(s)].filter((c) => !c.classList.contains('on')).length, w.chips) : 0;
          for (let j = 0; j < Math.min(chips, 8); j++) {
            if (j) await tab(i);
            const c = await p.evaluate(([s, j, f]) => { const e = [...document.querySelectorAll(s)].filter((c) => !c.classList.contains('on'))[j]; if (!e) return null; const k = (0, eval)(f)(e); e.click(); return k; }, [w.chips, j, keyOf.toString()]);
            if (c === null) break;
            await L.sleep(500);
            await measure(p, `${tag}_${w.id}-${i}-${k}-${c}`, w.id);
          }
        }
        const opens = w.opens ? await p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.outerHTML.length), w.opens) : [];
        for (let i = 0; i < opens.length; i++) {
          await shut(p);
          await w.open(p);
          await L.sleep(1100);
          await offers(p);
          const k = await p.evaluate(([s, i, f]) => { const e = [...document.querySelectorAll(s)][i]; if (!e) return null; const k = (0, eval)(f)(e); e.click(); return k; }, [w.opens, i, keyOf.toString()]);
          if (k === null) continue;
          await L.sleep(1100);
          await measure(p, `${tag}_${w.id}-${k}`, w.id);
        }
      }
    }
    if (p.errors.length) L.log('page errors:', p.errors.slice(0, 5));
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report${tg ? '_tg' : ''}.json`, JSON.stringify({ per, rows }, null, 1));
L.log('per screen:', Object.entries(per).map(([k, v]) => `${k} ${v}`).join(' · '));
L.log(`${total} violations`);
process.exit(total ? 1 : 0);

/** Every window shut, the island's screen left, the offers' card put away. */
async function shut(p) {
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => {
      globalThis.gravetide.open(null);
      document.querySelector('#promo-over [data-polater]')?.click();
      document.querySelector('#isle:not(.hidden) .is-sea')?.click();
      for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
    });
    await L.sleep(250);
  }
}
/** The offers' card that comes up over a screen as it opens (promo.ts): put away, it is not the screen. */
async function offers(p) { await p.evaluate(() => document.querySelector('#promo-over:not(.hidden) [data-polater]')?.click()); await L.sleep(300); }

async function measure(p, name, group) {
  await offers(p);
  const v = await p.evaluate(CHECK);
  if (SHOTS) await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000 }).catch(() => L.log('(no screenshot: ' + name + ')'));
  total += v.bad.length;
  per[group] = (per[group] ?? 0) + v.bad.length;
  rows.push({ name, root: v.root, n: v.n, bad: v.bad });
  L.log(`${v.bad.length ? 'FAIL' : 'ok  '} ${name} (${v.root}, ${v.n} measured): ${v.bad.length}${v.bad.length ? '\n     ' + v.bad.slice(0, process.env.LIST ? 999 : 10).join('\n     ') + (v.bad.length > 10 && !process.env.LIST ? `\n     … ${v.bad.length - 10} more` : '') : ''}`);
}

/** Her captain set up to have something in every place: level, silver, an island, tattoos, pets; then to a great
 *  League harbour (an exchange and a bank) — a forward signed, an order posted, silver banked, the auction stirred. */
async function seed(p) {
  for (const c of ['/god', '/level 60', '/silver 90000', '/doubloons 500', '/isle', '/tattoo all', '/pet cat', '/pet parrot', '/pet monkey', '/give rum 40', '/give timber 30', '/give provisions 25', '/army marine 40', '/army musketeer 20', '/contract take 1', '/contract take 2', '/relic all', '/item random 60 6', '/scrolls 12', '/mine take', '/find bottle done', '/find chest done']) { await L.say(p, c); await L.sleep(450); }
  const to = await p.evaluate(() => {
    const s = globalThis.gravetide.state;
    const lg = s.ports.filter((x) => x.faction === 'league' && x.size >= 2).sort((a, b) => b.size - a.size);
    return (lg[0] ?? s.ports.find((x) => x.size >= 3))?.id;
  });
  await L.say(p, `/tp ${to}`);
  await L.sleep(1800);
  for (let k = 0; k < 3; k++) {
    await L.send(p, { t: 'dock' });
    for (let i = 0; i < 16 && !(await p.evaluate((id) => globalThis.gravetide.state.portView?.portId === id, to)); i++) await L.sleep(500);
  }
  await L.closeAll(p);
  await L.send(p, { t: 'bank', action: 'deposit', amount: 4000 });
  await L.sleep(400);
  await L.send(p, { t: 'bank', action: 'borrow', amount: 1500 });
  await L.sleep(400);
  // a guild with a long name (the longest the harbour office registers), for the names' ellipses
  const tag = 'Q' + Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  await L.send(p, { t: 'guild', action: 'found', name: (await p.evaluate(() => document.documentElement.lang)) === 'en' ? 'Brotherhood of Black Moon' .slice(0, 24) : 'Братство Чёрной Луны Юга', tag });
  await L.sleep(400);
  // a rumour bought (the tavern's hearsay), if one is told here
  const rid = await p.evaluate(() => globalThis.gravetide.state.portView?.hearsay?.[0]?.id ?? globalThis.gravetide.state.portView?.rumours?.[0]?.id);
  if (rid) await L.send(p, { t: 'hearsay', action: 'buy', id: rid });
  for (let i = 0; i < 1; i++) { // (one signed: the others stay on the board)
    const fid = await p.evaluate((i) => globalThis.gravetide.state.portView?.exchange?.forwards?.[i]?.id, i);
    if (fid) await L.send(p, { t: 'forward', id: fid });
    await L.sleep(300);
  }
  await L.send(p, { t: 'order', action: 'post', good: 'rum', qty: 20, price: 30 });
  await L.say(p, '/auction');
  await L.sleep(1500);
  L.log('seeded at', to, await p.evaluate(() => { const v = globalThis.gravetide.state.portView; const s = globalThis.gravetide.state.self; return JSON.stringify({ port: v?.portId, fwd: v?.exchange?.forwards?.length, mine: s?.forwards?.length, orders: v?.exchange?.orders?.length, bank: v?.bank?.available, balance: v?.bank?.balance }); }));
}

// In the page: the window on top, and what is wrong in it.
function CHECK() {
  const roots = ['.k-sheet-root.k-open .k-sheet-panel', '#modal:not(.hidden) #modal-panel', '#isle:not(.hidden)'];
  let root = null;
  for (const q of roots) { const e = document.querySelector(q); if (e && e.getBoundingClientRect().width > 10) { root = e; break; } }
  if (!root) return { root: 'none', n: 0, bad: ['no window open'] };
  const bad = new Set();
  const label = (e) => {
    const id = e.id ? '#' + e.id : '';
    const cls = [...e.classList].slice(0, 2).map((c) => '.' + c).join('');
    const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22);
    return `${e.tagName.toLowerCase()}${id}${cls}${t ? ` «${t}»` : ''}`;
  };
  const shown = (e) => {
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  // what is left of a box once the boxes around it (to the window) clip it
  const clipped = (e) => {
    const r = e.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, bb = r.bottom;
    for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
      const c = getComputedStyle(q);
      const qr = q.getBoundingClientRect();
      if (c.overflowX !== 'visible') { l = Math.max(l, qr.left); rr = Math.min(rr, qr.right); }
      if (c.overflowY !== 'visible') { t = Math.max(t, qr.top); bb = Math.min(bb, qr.bottom); }
      if (q === root) break;
    }
    return { l, t, r: rr, b: bb, w: rr - l, h: bb - t };
  };
  const R = root.getBoundingClientRect();
  const tgTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tg-top')) || 0;
  const tgOn = document.documentElement.classList.contains('tg-app');
  // (a screen of its own — the island's — takes the whole page under Telegram's controls by design: what is in it is
  // held below them, each button on its own, under «cover» below)
  const full = R.top <= 0.5 && R.height >= innerHeight - 1;
  if (R.left < -1 || R.right > innerWidth + 1 || R.bottom > innerHeight + 1 || R.top < (tgOn && !full ? tgTop : 0) - 1) bad.add(`out: the window ${[R.left, R.top, R.right, R.bottom].map(Math.round)} past the screen${tgOn ? ` (Telegram's top ${tgTop})` : ''}`);
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.add(`hscroll: the page ${document.documentElement.scrollWidth} wide`);
  const all = [...root.querySelectorAll('*')].filter(shown);
  const CLICK = 'button, a[href], input, select, textarea, [data-act], [data-ptab], [data-tab], [role="tab"]';
  const clicks = all.filter((e) => e.matches(CLICK) && !e.parentElement.closest(CLICK));
  // out: past the window's frame
  const outs = new Set();
  for (const e of all) {
    if (e.closest('.k-badge, .w-badge, .badge, [class*="badge"], .tip, .k-tip')) continue;
    const c = clipped(e);
    if (c.w <= 0.5 || c.h <= 0.5) continue;
    const over = Math.max(R.left - c.l, R.top - c.t, c.r - R.right, c.b - R.bottom);
    if (over > 1.5) {
      if ([...outs].some((o) => o.contains(e))) continue;
      outs.add(e);
      bad.add(`out: ${label(e)} past the window by ${over.toFixed(0)} px`);
    }
  }
  // hscroll and cut
  for (const e of [root, ...all]) {
    const c = getComputedStyle(e);
    if (/auto|scroll/.test(c.overflowX) && e.scrollWidth > e.clientWidth + 1 && c.scrollbarWidth !== 'none' && !e.matches('.w-chips, .w-rail, .w-tabs, [data-swipe]')) bad.add(`hscroll: ${label(e)} ${e.scrollWidth}/${e.clientWidth}`);
  }
  for (const e of clicks) {
    const r = e.getBoundingClientRect(), c = clipped(e);
    if (c.h <= 0) continue; // scrolled out of sight: its turn comes on another scroll
    if (c.w < r.width - 2) {
      // (a row that swipes sideways may hide part of one)
      let swipe = false;
      for (let q = e.parentElement; q && q !== root.parentElement; q = q.parentElement) { const s = getComputedStyle(q); if (/auto|scroll/.test(s.overflowX) && q.scrollWidth > q.clientWidth + 1) { swipe = true; break; } }
      if (!swipe) bad.add(`cut: ${label(e)} ${Math.round(c.w)} of ${Math.round(r.width)} px wide shown`);
    }
  }
  // btn: a button outside its row or card
  const HOLD = 'tr, li, .card, .k-card, .w-row, .row, .xch-row, .q-card, .adm-card, .poster, .tip-row, .qb-card, .rc-card';
  for (const e of clicks) {
    if (!e.matches('button, .btn, .k-btn')) continue;
    const h = e.parentElement.closest(HOLD);
    if (!h || !root.contains(h)) continue;
    const r = e.getBoundingClientRect(), hr = h.getBoundingClientRect();
    const over = Math.max(hr.left - r.left, hr.top - r.top, r.right - hr.right, r.bottom - hr.bottom);
    if (over > 1.5) bad.add(`btn: ${label(e)} out of its ${label(h).split(' «')[0]} by ${over.toFixed(0)} px`);
  }
  // wrap: a word broken inside itself, or a line of three characters or fewer of a longer text
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const rg = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.textContent;
    if (s.trim().length < 4) continue;
    const pe = n.parentElement;
    if (!pe || !shown(pe) || pe.closest('select, option, textarea, script, style')) continue;
    rg.selectNodeContents(n);
    const rects = [...rg.getClientRects()].filter((x) => x.width > 0.5);
    if (rects.length < 2) continue;
    // the characters by line
    const lines = [];
    let top = null, cur = '', prev = '';
    let broke = '';
    for (let i = 0; i < s.length; i++) {
      rg.setStart(n, i); rg.setEnd(n, i + 1);
      const cr = [...rg.getClientRects()].find((x) => x.width > 0.1);
      if (!cr) { cur += s[i]; prev = s[i]; continue; }
      if (top !== null && cr.top > top + 2) {
        lines.push(cur);
        if (/[\p{L}\p{N}]/u.test(prev) && /[\p{L}\p{N}]/u.test(s[i]) && !broke) broke = `${s.slice(Math.max(0, i - 8), i)}|${s.slice(i, i + 8)}`;
        cur = '';
      }
      top = cr.top;
      cur += s[i];
      prev = s[i];
    }
    lines.push(cur);
    const t = s.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (broke) bad.add(`wrap: «${t}» broken inside a word (${broke.replace(/\s+/g, ' ')}) in ${label(pe).split(' «')[0]}`);
    // (a line of ≤3 characters: in a box under five letters wide — the squeezed column — or two such lines and more;
    // a long label's last word on a line of its own is ordinary wrapping)
    else if (s.replace(/\s/g, '').length >= 6 && (lines.filter((x) => x.trim().length > 0 && x.trim().length <= 3).length >= 2 || (lines.some((x) => x.trim().length > 0 && x.trim().length <= 3) && pe.getBoundingClientRect().width < 5 * parseFloat(getComputedStyle(pe).fontSize)))) bad.add(`wrap: «${t}» with a line of ≤3 characters (${lines.map((x) => x.trim()).join(' / ')}) in ${label(pe).split(' «')[0]}`);
  }
  // ell: a one-line text (a name, a label held to its line) cut at its box's edge with no ellipsis, or spilling past it
  for (const e of all) {
    if (e.children.length && [...e.children].some((k) => !/^(B|I|EM|STRONG|SMALL|SPAN)$/.test(k.tagName) || k.children.length)) continue;
    const s = (e.textContent || '').trim();
    if (s.length < 4 || e.closest('select, textarea, input, .k-badge, .w-badge, [class*="badge"]')) continue;
    const c = getComputedStyle(e);
    if (c.display === 'inline' || c.whiteSpace !== 'nowrap' && c.whiteSpace !== 'pre') continue;
    if (e.scrollWidth <= e.clientWidth + 1) continue;
    const cut = c.overflowX !== 'visible';
    if (cut && c.textOverflow === 'ellipsis') continue;
    // (spilling: only when it leaves its parent's box too, or is cut)
    const pr = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect();
    if (!cut && r.left + e.scrollWidth <= pr.right + 1) continue;
    bad.add(`ell: «${s.slice(0, 26)}» ${cut ? 'cut with no ellipsis' : 'spilling past its box'} (${e.scrollWidth}/${e.clientWidth}) in ${label(e).split(' «')[0]}`);
  }
  // vc: an icon and a label in a one-line button, each on the button's middle line
  for (const e of clicks) {
    if (!e.matches('button, .btn, .k-btn')) continue;
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    if (r.height < 14 || r.height > 72) continue;
    const pt = parseFloat(c.paddingTop) + parseFloat(c.borderTopWidth), pb = parseFloat(c.paddingBottom) + parseFloat(c.borderBottomWidth);
    const mid = (r.top + pt + r.bottom - pb) / 2;
    const parts = [];
    for (const k of e.querySelectorAll('img, svg, .ic, .icon, [class*="-ic"]')) { if (k.parentElement.closest('svg') ) continue; const kr = k.getBoundingClientRect(); if (kr.width > 3 && kr.height > 3 && kr.height < r.height) parts.push(['icon', kr]); }
    const w2 = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let lines = 0;
    for (let n = w2.nextNode(); n; n = w2.nextNode()) {
      if (!n.textContent.trim() || !shown(n.parentElement)) continue;
      rg.selectNodeContents(n);
      const rs = [...rg.getClientRects()].filter((x) => x.width > 0.5);
      lines += rs.length;
      if (rs.length === 1) parts.push(['label', rs[0]]);
    }
    if (lines !== parts.filter((x) => x[0] === 'label').length || lines > 2) continue; // a wrapped label: a block, not a line
    // (only when the button holds one row: its parts side by side)
    const tops = parts.map(([, x]) => x);
    if (tops.some((a) => tops.some((b) => a !== b && (a.bottom <= b.top + 1 || b.bottom <= a.top + 1)))) continue;
    for (const [k, x] of parts) {
      const d = (x.top + x.bottom) / 2 - mid;
      if (Math.abs(d) > 2.5) { bad.add(`vc: ${label(e)} its ${k} ${d.toFixed(1)} px off the middle line`); break; }
    }
  }
  // cover: a button's middle under something else; overlap: two buttons over each other
  const live = [];
  for (const e of clicks) {
    if (e.disabled && e.matches('input')) continue;
    const r = e.getBoundingClientRect(), c = clipped(e);
    if (c.w < 4 || c.h < 4 || c.h < Math.min(r.height, 12) * 0.8) continue;
    if (c.b > innerHeight || c.t < 0) continue;
    live.push([e, c]);
    if (tgOn && c.t < tgTop - 1) { bad.add(`cover: ${label(e)} under Telegram's controls (its top ${Math.round(c.t)} < ${tgTop})`); continue; }
    const x = (c.l + c.r) / 2, y = (c.t + c.b) / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && hit !== e && !e.contains(hit) && !hit.contains(e) && !hit.closest('.tg-pill-fake')) bad.add(`cover: ${label(e)} under ${label(hit)}`);
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const [a, ca] = live[i], [bb, cb] = live[j];
    if (a.contains(bb) || bb.contains(a)) continue;
    const ox = Math.min(ca.r, cb.r) - Math.max(ca.l, cb.l), oy = Math.min(ca.b, cb.b) - Math.max(ca.t, cb.t);
    if (ox > 2 && oy > 2) bad.add(`overlap: ${label(a)} and ${label(bb)} (${ox.toFixed(0)}×${oy.toFixed(0)})`);
  }
  const rid = root.id ? '#' + root.id + (root.dataset.modal ? `[${root.dataset.modal}]` : '') : '.' + root.className.split(' ')[0];
  return { root: rid, n: all.length, bad: [...bad] };
}
