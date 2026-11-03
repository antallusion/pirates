// «Лоцманская книга»: the shared kit of the guide's screenshot scripts (tools/guide/shots-qa.mjs). A real game on a local
// QA server, a headless Chrome at BelowNormal priority, a captain set up with the admin commands; each shot outlines its
// spot with a thin gold rectangle, crops to it (16:9 around it, at least 560 px wide) and is written as a WEBP of at
// most 60 KB in assets/guide/<file>.webp (ffmpeg; quality 70, lower only if it would not fit).
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, statSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as L from '../mobile/m0/lib.mjs';

export { L };
export const W = 1024, H = 576;
export const OUT = process.env.GUIDE_OUT ?? 'assets/guide';
const TMP = 'assets/raw/guide/tmp';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
export const sleep = L.sleep;

/** One headless Chrome, tagged by the port so only it is lowered to BelowNormal (never chrome.exe by name). The GPU by
 *  default (a software GPU on a busy machine took minutes a shot); GUIDE_GPU=0 for SwiftShader. */
export async function browser(port) {
  const require = createRequire('C:/Users/enosi/mobaudit/package.json');
  const { chromium } = require('playwright-core');
  const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: [...(process.env.GUIDE_GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']), `--qa-tag=guide${port}`] });
  try {
    execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=guide${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
  } catch {}
  return b;
}

/** A captain of her own (a fresh name each run): logged in, calm noon weather, admin god mode. */
export async function captain(b, port, { name, captain = 'navigator', cmds = [] } = {}) {
  const p = await L.page(b, [W, H], { lang: 'ru', touch: false });
  await L.login(p, { port, know: true, captain, name: (name ?? 'Лоцман') + ' ' + Math.random().toString(36).slice(2, 5) });
  await clean(p);
  await say(p, '/weather calm', '/time 12', '/god on', ...cmds);
  await clean(p);
  return p;
}

/** Admin commands, one after another. */
export async function say(p, ...cmds) {
  for (const c of cmds) {
    await L.say(p, c);
    await sleep(700);
  }
}

/** Nothing over the screen: windows, the island scene, the season card, the gift, the tutorial finger. */
export async function clean(p) {
  await p.evaluate(() => {
    const g = globalThis.gravetide;
    try { g.seasonPass?.close?.(); } catch {}
    try { g.dailyGift?.close?.(); } catch {}
    try { if (g.isle?.isOpen) g.isle.exit(); } catch {}
    g.open(null);
    // sheets left open (a choice, a hail): their way out, else shut
    document.querySelectorAll('.k-sheet-root.k-open').forEach((r) => {
      const no = [...r.querySelectorAll('button')].find((x) => /^(Не сейчас|Отмена|Пропустить|Закрыть|Позже)/.test(x.textContent.trim()));
      if (no) no.click(); else r.classList.remove('k-open');
    });
    document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
  }).catch(() => {});
  await sleep(400);
  await p.evaluate(() => globalThis.gravetide.open(null)).catch(() => {});
  await sleep(300);
}

/** Stop her ship where she is. */
export const stop = (p) => p.evaluate(() => { const s = globalThis.gravetide.state; s.input.sail = 0; s.autosail = null; });

/** Teleport (stopped first so she does not sail off). */
export async function tp(p, x, y, wait = 3500) {
  await stop(p);
  await sleep(300);
  await L.say(p, `/tp ${Math.round(x)} ${Math.round(y)}`);
  await sleep(wait);
  await stop(p);
}

/** Click the first visible element matching sel (from the page: no actionability wait). */
export const click = (p, sel) => p.evaluate((q) => {
  const e = [...document.querySelectorAll(q)].find((x) => x.offsetParent || x.getClientRects().length);
  if (!e) return false;
  e.click();
  return true;
}, sel);

/** Click a visible button by its words. */
export const clickText = (p, re, scope = 'body') => p.evaluate(([r, s]) => {
  const rx = new RegExp(r);
  const e = [...document.querySelectorAll(`${s} button, ${s} .btn`)].find((x) => x.offsetParent && rx.test(x.textContent.replace(/\s+/g, ' ').trim()));
  if (!e) return false;
  e.click();
  return true;
}, [re, scope]);

/** Wait until a selector is shown (or the time is up). */
export async function waitFor(p, sel, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await p.evaluate((q) => [...document.querySelectorAll(q)].some((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden'), sel).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

/** A world point on the screen (CSS px). */
export const onScreen = (p, x, y) => p.evaluate(([a, b]) => {
  const r = globalThis.gravetide.renderer;
  return [(a - r.camX) * r.zoom + r.w / 2, (b - r.camY) * r.zoom + r.h / 2];
}, [x, y]);

/** Her ship on the screen, a box of side s around it. */
export async function shipBox(p, s = 90) {
  const o = await p.evaluate(() => { const d = globalThis.gravetide.state.ownDisplay; return [d.x, d.y]; });
  const [x, y] = await onScreen(p, o[0], o[1]);
  return [x - s / 2, y - s / 2, s, s];
}

/** Scroll an element into the middle of its scroller. */
export const reveal = (p, sel) => p.evaluate((q) => { const e = [...document.querySelectorAll(q)].find((x) => x.getClientRects().length); e?.scrollIntoView({ block: 'center' }); return !!e; }, sel);

const fixRect = ([x, y, w, h]) => [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];

/**
 * The shot: outline every target (a selector's first visible match, or an [x,y,w,h] box), crop around them, encode.
 *   mark   — a selector, a box, or a list of them (each gets its own gold frame);
 *   crop   — 'full', a box, or (default) 16:9 around the frames, at least minW wide;
 *   pad    — the room around the frames in the crop.
 * Returns the file's size in KB, or throws if a target was not on the screen (a shot must show what it says).
 */
export async function shot(p, file, { mark = [], crop, pad = 70, minW = 560, inset = 3 } = {}) {
  const marks = Array.isArray(mark) && typeof mark[0] === 'number' ? [mark] : Array.isArray(mark) ? mark : [mark];
  // (a mark is resolved at the shot: a window re-rendered under a state push loses any attribute set on it before)
  await p.addStyleTag({ content: '#tut-finger,#promo-isle,.po-chip{display:none!important}' }).catch(() => {});
  const measure = (scroll) => p.evaluate(([ms, ins, sc]) => {
    const out = [];
    for (const m of ms) {
      if (Array.isArray(m)) { out.push(m); continue; }
      // a selector, or { sel, text (a regex), up (the closest ancestor), next (its next sibling) }
      const o = typeof m === 'string' ? { sel: m } : m;
      const rx = o.text ? new RegExp(o.text) : null;
      const hits = [...document.querySelectorAll(o.sel)].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden' && (!rx || rx.test(x.textContent.replace(/\s+/g, ' '))); });
      // (by words: the innermost element that has them, not the window around it)
      let e = rx ? hits.find((x) => !hits.some((y) => y !== x && x.contains(y))) : hits[0];
      if (e && o.up) e = e.closest(o.up) ?? e;
      if (e && o.next) e = e.nextElementSibling;
      if (!e) { out.push({ miss: typeof m === 'string' ? m : JSON.stringify(m) }); continue; }
      // what of it is seen: its box clipped by every scrolling or clipping ancestor (a list scrolled past keeps its
      // boxes); mostly hidden — scrolled into the middle first
      const seen = (el) => {
        let r = el.getBoundingClientRect();
        let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom];
        for (let a = el.parentElement; a; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
          const q = a.getBoundingClientRect();
          l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
        }
        l = Math.max(l, 0); t = Math.max(t, 0); rr = Math.min(rr, innerWidth); b = Math.min(b, innerHeight);
        const area = Math.max(0, rr - l) * Math.max(0, b - t);
        return { box: { left: l, top: t, right: rr, bottom: b }, part: area / Math.max(1, r.width * r.height) };
      };
      let v = seen(e);
      if (sc && v.part < 0.7) { e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); v = seen(e); }
      if (v.part <= 0.05) { out.push({ miss: `${typeof m === 'string' ? m : JSON.stringify(m)} (scrolled out)` }); continue; }
      const r = v.box;
      const x0 = Math.max(1, r.left - ins), y0 = Math.max(1, r.top - ins);
      const x1 = Math.min(innerWidth - 1, r.right + ins), y1 = Math.min(innerHeight - 1, r.bottom + ins);
      out.push([x0, y0, x1 - x0, y1 - y0]);
    }
    return out;
  }, [marks, inset, scroll]);
  // (twice: the first pass scrolls what is hidden into sight, the second measures them all as they stand)
  await measure(true);
  await sleep(250);
  const rects = await measure(false);
  const miss = rects.filter((r) => !Array.isArray(r));
  if (miss.length) throw new Error(`${file}: not on screen: ${miss.map((m) => m.miss).join(', ')}`);
  await p.evaluate((rs) => {
    for (const [x, y, w, h] of rs) {
      const d = document.createElement('div');
      d.className = 'guide-mark';
      d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:2px solid #e2b85a;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.65),0 0 8px rgba(226,184,90,.55);pointer-events:none;z-index:2147483647;box-sizing:border-box`;
      document.body.append(d);
    }
  }, rects);
  await sleep(150);
  const png = `${TMP}/${file.replace(/[\\/]/g, '_')}.png`;
  for (let i = 0; ; i++) {
    try { await p.screenshot({ path: png, timeout: 180000 }); break; } catch (e) { if (i >= 2) throw e; await sleep(1500); }
  }
  await p.evaluate(() => document.querySelectorAll('.guide-mark').forEach((d) => d.remove()));
  let box;
  if (crop === 'full') box = [0, 0, W, H];
  else if (Array.isArray(crop)) box = crop;
  else if (!rects.length) box = [0, 0, W, H];
  else {
    let x0 = Math.min(...rects.map((r) => r[0])) - pad, y0 = Math.min(...rects.map((r) => r[1])) - pad;
    let x1 = Math.max(...rects.map((r) => r[0] + r[2])) + pad, y1 = Math.max(...rects.map((r) => r[1] + r[3])) + pad;
    let w = Math.max(minW, x1 - x0), h = Math.max(w * 9 / 16, y1 - y0);
    w = Math.max(w, h * 16 / 9);
    if (w > W || h > H) { const k = Math.min(W / w, H / h); w *= k; h *= k; if (w < x1 - x0 || h < y1 - y0) { w = W; h = H; } }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    box = [Math.min(Math.max(0, cx - w / 2), W - w), Math.min(Math.max(0, cy - h / 2), H - h), w, h];
  }
  const [cx, cy, cw, ch] = fixRect(box).map((v, i) => (i >= 2 ? v - (v % 2) : v));
  const out = `${OUT}/${file}.webp`;
  for (const q of [70, 60, 50, 40, 32]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', `crop=${cw}:${ch}:${cx}:${cy},scale='min(640,iw)':-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', out]);
    if (statSync(out).size <= 60 * 1024) break;
  }
  rmSync(png, { force: true });
  return Math.round(statSync(out).size / 1024);
}
