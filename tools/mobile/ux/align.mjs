// Vertical (and, for round and square ones, horizontal) centring of what sits inside the HUD's buttons, badges and
// counters (owner, 2026-10-18: «иконка +- и к кораблю не выровнены по вертикали, они все чуть вниз смещены, надо на всем
// поправить»). Each candidate's border box against its content, measured, not looked at:
//  - a picture (img, svg, canvas): its layout box (an svg's shapes: their own boxes);
//  - a glyph or a number (text of 1–3 characters: «+», «−», «×», «›», «12»): its INK box — the font's own glyph
//    measured on a canvas (actualBoundingBoxAscent/Descent/Left/Right) and laid on the text's baseline, found with a
//    zero-size inline-block probe (its bottom is the baseline);
//  - a word: its capital-height box (baseline − the cap height … baseline): how a label is centred by the eye (an «р»
//    or a «у» hanging below the line does not move it).
// The rule: every piece's centre within TOL px (1) of the box's centre vertically; for a box near square (w/h < 1.5)
// the pieces' union within TOL horizontally too. Corner decorations (badges, key chips, clocks, ribbons) are judged on
// their own, not as the content of their button.
//   GPORT=58660 SIZE=844x390,480x270,1440x900 LANG2=ru,en TG=0 OUT=assets/raw/audit/align node tools/mobile/ux/align.mjs
//   ONLY=sea,acts  — some scenes;  LIST=1 — every candidate measured;  TOL=1
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const sizes = (process.env.SIZE ?? '844x390,480x270,1440x900').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru').split(',');
const port = Number(process.env.GPORT ?? 58660);
const tg = Number(process.env.TG ?? 0);
const TOL = Number(process.env.TOL ?? 1);
const OUT = process.env.OUT ?? 'assets/raw/audit/align';
// (the HUD by default; ONLY=shop adds the shop's window — its rail tabs and offers)
const only = process.env.ONLY ? process.env.ONLY.split(',') : ['port', 'sea', 'far', 'acts', 'offers'];
const SHOTS = process.env.SHOTS !== '0';
mkdirSync(OUT, { recursive: true });

const SCREENS = [
  { id: 'port', at: 'port', open: async () => {} },
  { id: 'sea', at: 'sea', open: async () => {} },
  // the far view and the free look: «К кораблю»
  { id: 'far', at: 'sea', open: (p) => p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.06; r.panBy(-150, 80, globalThis.gravetide.state.ownDisplay); }) },
  // a sea fight with every action at hand (frames.mjs manyActs)
  { id: 'acts', at: 'sea', open: async (p) => { for (const c of ['/noboard on', '/stack go', '/find gulls', '/castaway 2', '/mast', '/foe pirate brig 250']) { await L.say(p, c); await L.sleep(1100); } await shut(p); await L.sleep(1200); } },
  // the offers' cards (‹ › ×) and the shop's window (its ✕, its tabs)
  { id: 'offers', at: 'sea', open: (p) => p.evaluate(() => document.getElementById('tc-offer')?.click()) },
  { id: 'shop', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.shop()) },
];

const b = await L.browser();
const rows = [];
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
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    for (const c of ['/isle', '/god', '/silver 287', '/offers roll', '/noboard on']) await L.say(p, c);
    await L.sleep(800);
    let where = 'port';
    for (const [W, H] of sizes) {
      // (a desk's mouse at the big size: a page of its own, as the game starts there)
      await p.setViewportSize({ width: W, height: H });
      await L.sleep(500);
      for (const s of SCREENS) {
        if (only && !only.includes(s.id)) continue;
        await shut(p);
        if (s.at === 'port' && where !== 'port') continue; // (the harbour: the first size only, she starts there)
        if (s.at !== 'port' && where === 'port') {
          await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
          await L.sleep(2500);
          await shut(p);
          where = 'sea';
        }
        if (s.id !== 'acts') { await L.say(p, '/tp black_coast'); await L.sleep(900); await shut(p); }
        await s.open(p);
        await L.sleep(900);
        const v = await p.evaluate(MEASURE, TOL);
        // the round buttons' pictures against their ring's own hole (RING below): «К кораблю» held to it
        const rv = await p.evaluate(RING, { tol: TOL, all: !!process.env.RING_ALL });
        v.n += rv.n;
        v.bad.push(...rv.bad);
        v.list.push(...rv.list);
        const name = `${W}x${H}_${lang}${tg ? '_tg' : ''}_${s.id}`;
        if (SHOTS) await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000 }).catch(() => L.log('(no screenshot: ' + name + ')'));
        total += v.bad.length;
        rows.push({ name, n: v.n, bad: v.bad, list: process.env.LIST ? v.list : undefined });
        if (process.env.LIST) L.log(v.list.join('\n  '));
        L.log(`${v.bad.length ? 'FAIL' : 'ok  '} ${name}: ${v.n} measured, ${v.bad.length} off-centre${v.bad.length ? '\n     ' + v.bad.slice(0, 40).join('\n     ') + (v.bad.length > 40 ? `\n     … ${v.bad.length - 40} more` : '') : ''}`);
      }
    }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report${tg ? '_tg' : ''}.json`, JSON.stringify(rows, null, 1));
L.log(`${total} off-centre`);
process.exit(total ? 1 : 0);

async function shut(p) {
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => {
      globalThis.gravetide.open(null);
      globalThis.gravetide.renderer.recentre?.();
      document.querySelector('#promo-over [data-polater]')?.click();
      document.querySelector('[data-gflater]')?.click();
      document.querySelector('#isle:not(.hidden) .is-sea')?.click();
      for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
      if (document.body.classList.contains('chat-open')) document.getElementById('chat-toggle')?.click();
    });
    await L.sleep(250);
  }
}

// In the page (owner, 2026-10-19: «Иконка "к кораблю" не отцентрована по вертикали» — measured by its box it was within a
// hundredth of a pixel, and still sat low): a round button's picture as the eye sees it in its ring — the picture's
// own ink (its alpha-weighted middle, the image's pixels read, laid by object-fit: contain) against the middle of the
// ring's painted hole (the ring art's pixels read along its two middle lines, laid as the ring is drawn: the ::after's
// box, background contain). RING_SEL by default «К кораблю»; RING_ALL=1 every .sea-round (reported, the rule the same).
async function RING({ tol, all }) {
  const SEL = all ? 'body.simple .sea-round' : '#tc-home';
  const px = async (url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  };
  const list = [], bad = [];
  let n = 0;
  for (const e of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || e.classList.contains('hidden')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    const ico = e.querySelector('img.k-btn-ico');
    const ring = getComputedStyle(e, '::after');
    const m = /url\("?([^")]+)"?\)/.exec(ring.backgroundImage);
    if (!ico || !m) continue;
    // the ring's hole: along its vertical and horizontal middle lines, the first clear pixel inside the art each way
    const R = await px(m[1]);
    const a = (x, y) => R.d[(y * R.w + x) * 4 + 3];
    const mx = R.w >> 1, my = R.h >> 1;
    let t = 0; while (t < R.h && a(mx, t) <= 128) t++; while (t < R.h && a(mx, t) > 128) t++;
    let b = R.h - 1; while (b > 0 && a(mx, b) <= 128) b--; while (b > 0 && a(mx, b) > 128) b--;
    let l = 0; while (l < R.w && a(l, my) <= 128) l++; while (l < R.w && a(l, my) > 128) l++;
    let rr = R.w - 1; while (rr > 0 && a(rr, my) <= 128) rr--; while (rr > 0 && a(rr, my) > 128) rr--;
    // the ::after's own box (its inset on the button) and the art contained in it
    const bw = parseFloat(ring.width) || r.width, bh = parseFloat(ring.height) || r.height;
    const bl = r.left + (parseFloat(ring.left) || 0), bt = r.top + (parseFloat(ring.top) || 0);
    const k = Math.min(bw / R.w, bh / R.h);
    const ox = bl + (bw - R.w * k) / 2, oy = bt + (bh - R.h * k) / 2;
    const hole = { x: ox + ((l + rr + 1) / 2) * k, y: oy + ((t + b + 1) / 2) * k };
    // the picture's ink: alpha-weighted middle
    const I = await px(ico.currentSrc || ico.src);
    let sw = 0, sx = 0, sy = 0;
    for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) { const w = I.d[(y * I.w + x) * 4 + 3] / 255; if (w > 0.1) { sw += w; sx += w * (x + 0.5); sy += w * (y + 0.5); } }
    if (!sw) continue;
    const ir = ico.getBoundingClientRect();
    const ki = Math.min(ir.width / I.w, ir.height / I.h);
    const ix = ir.left + (ir.width - I.w * ki) / 2 + (sx / sw) * ki, iy = ir.top + (ir.height - I.h * ki) / 2 + (sy / sw) * ki;
    n++;
    const dy = iy - hole.y, dx = ix - hole.x;
    const line = `ring ${e.id ? '#' + e.id : e.className.split(' ').slice(0, 2).join('.')} ${Math.round(r.width)}×${Math.round(r.height)} dy ${dy.toFixed(1)} dx ${dx.toFixed(1)} (the picture's ink against the ring's hole)`;
    list.push(line);
    if (Math.abs(dy) > tol || Math.abs(dx) > tol) bad.push(line);
  }
  return { n, bad, list };
}

// In the page: the candidates and their content's centres.
function MEASURE(TOL) {
  const CAND = ':is(button, [role="button"]):not(#hud-captain, #mm-tab), #mm-tab .mm-tab-pill, .k-badge, .sea-round, .tc-offer-t, kbd, .po-clock, .tc-ammo-n, .dk-n';
  // decorations on a button's corner: judged on their own, not as its content
  const DECOR = '.cs-bar, .dk-n, .dk-cd, .dk-slot.locked .dk-cdt, .dk-charge, .tc-isle-l, .tc-home-l, .k-badge, kbd, .kc, .tc-ring, .tc-offer-off, .tc-offer-t, .tc-ammo-n, .po-off, .sh-bonus, .sh-lim, .act-k, .act-s, .tc-sail-pips';
  const vis = (e) => {
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const label = (e) => {
    const id = e.id ? '#' + e.id : '';
    const cls = [...e.classList].slice(0, 3).map((c) => '.' + c).join('');
    const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
    return `${e.tagName.toLowerCase()}${id}${cls}${t ? ` «${t}»` : ''}`;
  };
  const cv = document.createElement('canvas').getContext('2d');
  const fontOf = (cs) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  /** A text node's box: the ink of a short glyph, the cap height of a word — on its baseline. */
  const textBox = (node) => {
    const el = node.parentElement;
    const cs = getComputedStyle(el);
    const t = node.textContent.trim();
    if (!t) return null;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
    if (rects.length !== 1) return rects.length ? { l: rects[0].left, r: rects[0].right, t: rects[0].top, b: rects[0].bottom, rough: true } : null;
    const rr = rects[0];
    // the baseline: the range's box is the font's content area (its ascent over its descent) — centred on the line
    const k = el.offsetHeight ? el.getBoundingClientRect().height / el.offsetHeight || 1 : 1; // (a zoomed HUD)
    cv.font = fontOf(cs);
    const fm = cv.measureText(t);
    const fa = fm.fontBoundingBoxAscent * k, fd = fm.fontBoundingBoxDescent * k;
    const base = rr.top + (rr.height - fa - fd) / 2 + fa;
    if ([...t].length <= 3) {
      const m = cv.measureText(t);
      // (the left/right of the ink from the range's start: the text's own advance is the range's width)
      const lead = node.textContent.indexOf(t[0]);
      const pre = lead > 0 ? cv.measureText(node.textContent.slice(0, lead)).width * k : 0;
      return { l: rr.left + pre - m.actualBoundingBoxLeft * k, r: rr.left + pre + m.actualBoundingBoxRight * k, t: base - m.actualBoundingBoxAscent * k, b: base + m.actualBoundingBoxDescent * k, ink: true };
    }
    const cap = cv.measureText('H').actualBoundingBoxAscent * k;
    return { l: rr.left, r: rr.right, t: base - cap, b: base, cap: true };
  };
  const pieces = (root) => {
    const out = [];
    const walk = (e) => {
      for (const n of e.childNodes) {
        if (n.nodeType === 3) {
          if (!n.textContent.trim()) continue;
          const bx = textBox(n);
          if (bx) out.push({ ...bx, what: `"${n.textContent.trim().slice(0, 10)}"` });
        } else if (n.nodeType === 1) {
          if (n.matches(DECOR) || !vis(n)) continue;
          const cs = getComputedStyle(n);
          if (n.matches('img, canvas')) { const r = n.getBoundingClientRect(); out.push({ l: r.left, r: r.right, t: r.top, b: r.bottom, what: n.tagName.toLowerCase() }); continue; }
          if (n.matches('svg')) {
            const shapes = [...n.querySelectorAll('path, circle, rect, line, polygon, polyline, ellipse')].map((x) => x.getBoundingClientRect()).filter((r) => r.width || r.height);
            if (shapes.length) out.push({ l: Math.min(...shapes.map((r) => r.left)), r: Math.max(...shapes.map((r) => r.right)), t: Math.min(...shapes.map((r) => r.top)), b: Math.max(...shapes.map((r) => r.bottom)), what: 'svg' });
            continue;
          }
          // a picture drawn as a background (a mask, a sprite) on an empty element
          if (!n.childNodes.length && (cs.backgroundImage !== 'none' || cs.maskImage && cs.maskImage !== 'none' || cs.webkitMaskImage && cs.webkitMaskImage !== 'none')) { const r = n.getBoundingClientRect(); if (r.width && r.height) out.push({ l: r.left, r: r.right, t: r.top, b: r.bottom, what: 'bg ' + label(n) }); continue; }
          walk(n);
        }
      }
    };
    walk(root);
    return out;
  };
  const list = [], bad = [];
  let n = 0;
  const modal = document.querySelector('#modal:not(.hidden) #modal-panel, #promo-over, .k-sheet-root.k-open');
  for (const e of document.querySelectorAll(CAND)) {
    if (!vis(e)) continue;
    if (modal && !modal.contains(e)) continue; // (with a window up: only the window's own)
    const r = e.getBoundingClientRect();
    if (r.width > 340 || r.height > 120 || r.width < 6 || r.height < 6) continue;
    if (e.matches('#tc-home')) continue; // (its picture is held to its ring's hole: RING)
    // (what is on top at its middle: a candidate under another layer is not seen)
    // (a corner badge lets taps through: its button's middle is looked at instead)
    const host = getComputedStyle(e).pointerEvents === 'none' ? e.parentElement.closest('button, [role="button"]') ?? e : e;
    const hr = host.getBoundingClientRect();
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, hr.left + hr.width / 2)), Math.min(innerHeight - 1, Math.max(0, hr.top + hr.height / 2)));
    if (top && !host.contains(top) && !top.contains(host)) continue;
    const ps = pieces(e).filter((x) => x.b >= x.t && x.r >= x.l && (x.b > x.t || x.r > x.l)); // (a «−» drawn is a line: no height)
    if (!ps.length) continue;
    n++;
    const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    const u = { l: Math.min(...ps.map((x) => x.l)), r: Math.max(...ps.map((x) => x.r)), t: Math.min(...ps.map((x) => x.t)), b: Math.max(...ps.map((x) => x.b)) };
    // in one row (their vertical spans overlap): each piece on the middle; stacked: their union
    const row = ps.every((x) => ps.every((y) => x.t < y.b && y.t < x.b));
    const dys = row ? ps.map((x) => ({ d: (x.t + x.b) / 2 - cy, w: x.what })) : [{ d: (u.t + u.b) / 2 - cy, w: 'stack' }];
    const worst = dys.reduce((a, x) => (Math.abs(x.d) >= Math.abs(a.d) ? x : a), dys[0]);
    const square = r.width / r.height < 1.5;
    const dx = square ? (u.l + u.r) / 2 - cx : 0;
    const line = `${label(e)} ${Math.round(r.width)}×${Math.round(r.height)} dy ${worst.d.toFixed(1)} (${worst.w})${square ? ` dx ${dx.toFixed(1)}` : ''}`;
    list.push(line);
    if (Math.abs(worst.d) > TOL || Math.abs(dx) > TOL) bad.push(line);
  }
  return { n, bad, list };
}
