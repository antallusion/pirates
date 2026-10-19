// Framed buttons and tiles (owner, 2026-10-15: «иконки и текст не должны залезать на край окантовки кнопок, все
// четко должно быть отцентровано… это касается всех экранов»). Every painted frame on screen (an element with a
// border-image: the brass button, the plate, the bar's sheath; or one of FRAMED below, framed by a background or a
// pseudo element) has its pictures and words measured against the frame's inner edge — its border-box less the border
// (the painted ornament) and a safe pixel. A word or picture past it is a violation; so is a tile whose content is not
// centred (its group off the middle by more than 3 px either way).
//   GPORT=58994 SIZE=844x390,480x270,1440x900 LANG2=ru,en OUT=assets/raw/audit/frames node tools/mobile/ux/frames.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const sizes = (process.env.SIZE ?? '844x390').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru').split(',');
const port = Number(process.env.GPORT ?? 58994);
const OUT = process.env.OUT ?? 'assets/raw/audit/frames';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SHOTS = process.env.SHOTS !== '0';
mkdirSync(OUT, { recursive: true });

// The screens: each opened from a clean sea (or harbour) and measured.
const SCREENS = [
  { id: 'port', at: 'port', open: (p) => p.evaluate(() => globalThis.gravetide.open('port')) },
  { id: 'port-quests', at: 'port', open: async (p) => { await p.evaluate(() => globalThis.gravetide.open('port')); await L.sleep(400); await p.evaluate(() => document.querySelector('[data-ptab="quests"]')?.click()); } },
  { id: 'port-hud', at: 'port', open: async () => {} },
  { id: 'sea', at: 'sea', open: async () => {} },
  // the far view and the free look (freecam.ts): the chart, «К кораблю» under the chart's row
  { id: 'far', at: 'sea', open: (p) => p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.06; r.panBy(-150, 80, globalThis.gravetide.state.ownDisplay); }) },
  // a ship striking her colours: the terms' card and its painted choices
  { id: 'strike', at: 'sea', open: async (p) => { await L.say(p, '/strike'); await L.sleep(2000); } },
  { id: 'menu', at: 'sea', open: (p) => p.evaluate(() => document.getElementById('tc-menu')?.click()) },
  { id: 'news', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.seaHud.openNews()) },
  { id: 'capmenu', at: 'sea', open: (p) => p.evaluate(() => document.getElementById('hud-captain')?.click()) },
  { id: 'shop', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.shop()) },
  // docs/32 §12: the cosmetics' tab (its titles, its bundles) and the wardrobe
  { id: 'cos', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.cos.shop('cos_titles')) },
  { id: 'cos-sets', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.cos.shop('cos_sets')) },
  { id: 'wardrobe', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.cos.wardrobe()) },
  { id: 'hero', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.hero()) },
  { id: 'ship', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.open('ship')) },
  { id: 'crew', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.open('crew')) },
  { id: 'journal', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.open('journal')) },
  { id: 'options', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.open('options')) },
  { id: 'company', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.open('company')) },
  { id: 'base', at: 'sea', open: (p) => p.evaluate(() => globalThis.gravetide.open('base')) },
  // docs/35: the floating waystation's window, moored, with her fallen listed.
  { id: 'way', at: 'sea', open: async (p) => { await L.say(p, '/way go'); await L.sleep(1800); await shut(p); await p.evaluate(() => document.querySelector('.act-moor_way')?.click()); await L.sleep(1200); await L.say(p, '/way fallen'); } },
  { id: 'lair', at: 'lair', open: async () => {} },
  // (owner, 2026-10-18: «нельзя скрывать ничего»): a sea fight with everything at hand — a roaming stack, the gulls, a
  // castaway, the mast over the side, a pirate on her — every button of the action row in sight; then twelve (the
  // ceasefire's and whatever comes after: copies of the small ones)
  { id: 'acts', at: 'sea', open: (p) => manyActs(p, 0) },
  { id: 'acts12', at: 'sea', open: (p) => manyActs(p, 12) },
];

async function manyActs(p, n) {
  for (const c of ['/noboard on', '/stack go', '/find gulls', '/castaway 2', '/mast', '/foe pirate brig 250']) { await L.say(p, c); await L.sleep(1200); }
  await shut(p);
  await L.sleep(1200);
  if (n) await p.evaluate((n) => {
    const row = document.getElementById('tc-actrow');
    const src = row.querySelector('.tc-act2');
    const words = ['Перемирие', 'Сдаться', 'Переговоры', 'Отступить', 'Осмотреть', 'Причалить', 'Высадка', 'Ремонт'];
    for (let i = row.querySelectorAll('.k-btn').length; src && i < n; i++) { const c = src.cloneNode(true); c.dataset.act = 'syn' + i; c.querySelector('.k-btn-l').textContent = words[i % words.length]; row.append(c); }
    globalThis.gravetide.seaHud.fitActs();
  }, n);
}

const b = await L.browser();
const rows = [];
let total = 0;
try {
  for (const lang of langs) {
    const [W0, H0] = sizes[0];
    const p = await L.page(b, [W0, H0], { lang, touch: W0 < 1000 });
    await L.login(p, { port, know: true });
    await L.say(p, '/isle');
    await L.say(p, '/god');
    await L.sleep(800);
    let where = 'port';
    for (const [W, H] of sizes) {
      await p.setViewportSize({ width: W, height: H });
      await L.sleep(400);
      for (const s of SCREENS) {
        if (only && !only.includes(s.id)) continue;
        await shut(p);
        if (s.at === 'port' && where !== 'port') continue; // the harbour is measured on the first size only
        if (s.at !== 'port' && where === 'port') {
          await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
          await L.sleep(2500);
          await shut(p);
          where = 'sea';
        }
        if (s.at === 'lair') {
          await L.say(p, '/lair crab_beach go');
          await L.sleep(1500);
          await shut(p);
          for (let i = 0; i < 10 && !(await p.$('#advcard:not(.hidden) .ac-card')); i++) {
            await p.evaluate(() => { for (const x of document.querySelectorAll('#touch button, #hud-bottom button')) if (/Осмотреть|Look/.test(x.textContent) && x.getBoundingClientRect().width) { x.click(); break; } });
            await L.sleep(400);
          }
          where = 'lair';
        } else if (s.at === 'sea' && where === 'lair') {
          await L.say(p, '/tp black_coast');
          await L.sleep(1500);
          await shut(p);
          where = 'sea';
        }
        await s.open(p);
        await L.sleep(900);
        const v = await p.evaluate(MEASURE);
        const name = `${W}x${H}_${lang}_${s.id}`;
        if (SHOTS) await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000 }).catch(() => L.log('(no screenshot: ' + name + ')'));
        total += v.bad.length;
        rows.push({ name, frames: v.frames, bad: v.bad }); if (process.env.LIST) L.log(v.list.join(' | '));
        L.log(`${v.bad.length ? 'FAIL' : 'ok  '} ${name}: ${v.frames} frames, ${v.bad.length} violations${v.bad.length ? '\n     ' + v.bad.slice(0, 12).join('\n     ') + (v.bad.length > 12 ? `\n     … ${v.bad.length - 12} more` : '') : ''}`);
      }
      if (where === 'port') {
        // (the harbour's sizes after the first: its screens again are worth a look too)
      }
    }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
L.log(`${total} violations`);
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

// In the page: every painted frame and what is inside it.
function MEASURE() {
  const SAFE = 3; // the small padding clear of the ornament's inner edge (owner: «с небольшим паддингом»)
  const vis = (e) => {
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const px = (v) => parseFloat(v) || 0;
  const label = (e) => {
    const id = e.id ? '#' + e.id : '';
    const cls = [...e.classList].slice(0, 3).map((c) => '.' + c).join('');
    const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${e.tagName.toLowerCase()}${id}${cls}${t ? ` «${t}»` : ''}`;
  };
  // The frames: painted by border-image (not the bars' sheaths: their fill is the content), or the framed boxes below
  // whose ornament is their own border.
  const FRAMED = '.k-tile, .gl-row, .hg-row, .goal-row, #hud-goals .card, .news-card, .k-card';
  const frames = [];
  for (const e of document.querySelectorAll('body *')) {
    const c = getComputedStyle(e);
    const painted = c.borderImageSource && c.borderImageSource !== 'none';
    // (or a button, a card, a chip drawn with a border of its own)
    const lined = Math.max(parseFloat(c.borderTopWidth) || 0, parseFloat(c.borderLeftWidth) || 0) >= 1 && c.borderTopStyle !== 'none' && !/rgba\([^)]*, 0\)|transparent/.test(c.borderTopColor);
    if (!painted && !e.matches(FRAMED) && !(lined && e.matches('button, .btn, .card, .chip, [class*="chip"], .k-btn, .tab, .w-tab'))) continue;
    if (e.matches('.fbar, .cs-bar, .bar, .tg-bar, .k-bar, #modal-panel, #chat, .w-frame, .k-sheet-panel, .k-sheet')) continue;
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.height > 260 || r.width > 900) continue; // a window's own frame: its content scrolls inside
    // (a modal under a sheet: only what is on top is judged)
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && !e.contains(top) && !top.contains(e)) continue;
    frames.push(e);
  }
  const bad = [];
  for (const f of frames) {
    const c = getComputedStyle(f);
    const r = f.getBoundingClientRect();
    // the ornament's band: the border (border-image draws in it); a tile framed by a thin border keeps 2 px more
    // (border-image-width and -outset: in px, or a number of the border's width; four sides as CSS writes them)
    const four = (v) => { const a = String(v).trim().split(/\s+/); return [a[0], a[1] ?? a[0], a[2] ?? a[0], a[3] ?? a[1] ?? a[0]]; };
    const bw = [px(c.borderTopWidth), px(c.borderRightWidth), px(c.borderBottomWidth), px(c.borderLeftWidth)];
    const painted = c.borderImageSource && c.borderImageSource !== 'none';
    const iw = painted ? four(c.borderImageWidth).map((v, i) => (v === 'auto' ? bw[i] : v.endsWith('px') ? px(v) : v.endsWith('%') ? 0 : px(v) * bw[i])) : bw;
    const io = painted ? four(c.borderImageOutset).map((v, i) => (v.endsWith('px') ? px(v) : px(v) * bw[i])) : [0, 0, 0, 0];
    const band = iw.map((w, i) => Math.max(0, w - io[i]));
    // (a plate — a heading's banner — paints its body across its top and bottom bands: only its side curls bound it)
    if (painted && /plate/.test(c.borderImageSource)) band[0] = band[2] = -SAFE;
    const [bt, br, bb, bl] = band;
    const thin = Math.max(bt, bl) < 3 ? -1 : 0; // (a thin line: the padding is the ornament's; 2 px clear of the line)
    const inner = { l: r.left + bl + SAFE + thin, t: r.top + bt + SAFE + thin, r: r.right - br - SAFE - thin, b: r.bottom - bb - SAFE - thin };
    const parts = [];
    // pictures
    for (const e of f.querySelectorAll('img, svg, .ico, .k-btn-ico, .k-tile-ico, canvas')) {
      if (!vis(e) || e.closest('.k-badge, .kc, .po-off, .sh-bonus, .sh-lim')) continue;
      const er = e.getBoundingClientRect();
      parts.push({ what: 'pic ' + label(e), l: er.left, t: er.top, r: er.right, b: er.bottom });
    }
    // words (each line's box: the glyphs' own, not the line's leading)
    const walk = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const pe = n.parentElement;
      if (!pe || !vis(pe) || pe.closest('.k-badge, .kc, .sr-only, .vh, .po-off, .sh-bonus, .sh-lim')) continue; // (a badge or a ribbon sits on the rim by design)
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const fs = px(getComputedStyle(pe).fontSize);
      for (const lr of rg.getClientRects()) {
        if (lr.width < 1) continue;
        // the line box is taller than the glyphs: a cap height over the baseline, about 0.72 of the size
        const glyph = Math.min(lr.height, fs * 1.0);
        const mid = (lr.top + lr.bottom) / 2;
        parts.push({ what: 'text ' + label(pe), l: lr.left, t: mid - glyph / 2, r: lr.right, b: mid + glyph / 2 });
      }
    }
    if (!parts.length) continue;
    for (const q of parts) {
      const over = Math.max(inner.l - q.l, inner.t - q.t, q.r - inner.r, q.b - inner.b);
      if (over > 0.5) {
        const side = inner.t - q.t > 0.5 ? 'top' : q.b - inner.b > 0.5 ? 'bottom' : inner.l - q.l > 0.5 ? 'left' : 'right';
        bad.push(`${label(f)} ${Math.round(r.width)}×${Math.round(r.height)}: ${q.what} over the ${side} edge by ${over.toFixed(1)} px`);
        break;
      }
    }
    // a tile (a picture over its word) is centred as one group, both ways
    if (f.matches('.k-tile')) {
      const l = Math.min(...parts.map((q) => q.l)), t = Math.min(...parts.map((q) => q.t)), rr = Math.max(...parts.map((q) => q.r)), bo = Math.max(...parts.map((q) => q.b));
      const dx = (l + rr) / 2 - (r.left + r.right) / 2, dy = (t + bo) / 2 - (r.top + r.bottom) / 2;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) bad.push(`${label(f)}: its picture and word off the middle by ${dx.toFixed(1)}, ${dy.toFixed(1)} px`);
    }
  }
  return { frames: frames.length, bad, list: frames.map(label) };
}
