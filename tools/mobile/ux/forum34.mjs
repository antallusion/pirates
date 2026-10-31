// Proof shots (forum, Нефигугум, post 34): the chart's «Сокровища» layer with a map's search circle (no spot), «Плыть к
// кладу» into the circle with the warm/cold step, the scroll on the water close by, and the dig. 844×390 and 1366×768, RU.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-tm34.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/forum34.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/forum34';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: [...(process.env.SWIFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']), `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
/** A shot that waits out a busy software GPU (one retry). */
async function snap(p, path) {
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) L.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
const mapOf = (p) => p.evaluate(() => globalThis.gravetide.state.self?.maps?.[0] ?? null);
/** The spot from the admin's answer (the client's state never has it out of sight). */
async function spotFromToast(p) {
  for (let i = 0; i < 60; i++) {
    const t = (await L.toasts(p)).find((x) => /(\d+) (\d+)\.?\s*$/.test(x) && /(Map|Карт|spot|мест)/i.test(x));
    if (t) {
      const m = t.match(/(\d+) (\d+)\.?\s*$/);
      return { x: Number(m[1]), y: Number(m[2]) };
    }
    await L.sleep(250);
  }
  return null;
}
/** Out to sea from the spot: away from the nearest island's middle, `d` metres. */
const seaward = (p, spot, d) => p.evaluate(([s, dd]) => {
  const isl = globalThis.gravetide.state.islands;
  let best = null, bd = Infinity;
  for (const i of isl.values()) { const k = Math.hypot(i.x - s.x, i.y - s.y); if (k < bd) { bd = k; best = i; } }
  const dx = s.x - best.x, dy = s.y - best.y, l = Math.hypot(dx, dy) || 1;
  return { x: Math.round(s.x + (dx / l) * dd), y: Math.round(s.y + (dy / l) * dd), hx: -dx / l, hy: -dy / l };
}, [spot, d]);

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await dismiss(p);
    await L.say(p, '/level 12');
    await L.say(p, '/fog all');
    await L.say(p, '/god on');
    await L.say(p, '/weather calm');
    await L.sleep(600);
    await L.say(p, '/tmap 1');
    const spot = await spotFromToast(p);
    await L.sleep(1500);
    const m = await mapOf(p);
    L.log(tag, 'map', JSON.stringify(m), 'spot', JSON.stringify(spot));
    if (!m || !spot) throw new Error('no map');
    // 1. the chart: «Сокровища», the circle, never the spot (and the map's card under it)
    const start = await seaward(p, { x: m.x, y: m.y }, m.r + 700);
    await L.say(p, `/tp ${start.x} ${start.y}`);
    await L.sleep(2500);
    await dismiss(p);
    await L.open(p, 'map');
    await L.sleep(1500);
    await p.evaluate((mm) => {
      const c = globalThis.gravetide.chart;
      c.layers = new Set(['ports', 'goals', 'lairs', 'treasure']);
      document.querySelectorAll('[data-mlayer]').forEach((x) => x.classList.toggle('on', c.layers.has(x.dataset.mlayer)));
      c.cx = mm.x; c.cy = mm.y; c.zoom = Math.max(c.zoom, 18);
      c.draw(globalThis.gravetide.state);
    }, m);
    await L.sleep(800);
    await snap(p, `${OUT}/1-chart-circle-${tag}.png`);
    const card = await p.evaluate(() => document.querySelector('.tmap')?.innerText.replace(/\s+/g, ' ') ?? '');
    L.log(tag, 'card', card);
    await p.evaluate(() => document.querySelector('.tmap')?.scrollIntoView({ block: 'center' }));
    await L.sleep(400);
    await snap(p, `${OUT}/1b-map-card-${tag}.png`);
    await L.closeAll(p);
    // 2. «Плыть к кладу»: into the circle — the toast, the warm/cold step in «Сейчас»
    await L.say(p, '/speed 6');
    await p.evaluate((id) => globalThis.gravetide.goal(`tm:${id}`), m.id);
    let inside = false;
    for (let i = 0; i < 120 && !inside; i++) {
      await L.sleep(1000);
      inside = await p.evaluate((mm) => { const o = globalThis.gravetide.state.ownDisplay; return !!o && Math.hypot(o.x - mm.x, o.y - mm.y) < mm.r - 40; }, m);
    }
    L.log(tag, 'entry toasts', JSON.stringify(await L.toasts(p)));
    await snap(p, `${OUT}/2a-entered-${tag}.png`);
    await L.sleep(2500);
    await snap(p, `${OUT}/2-in-circle-${tag}.png`);
    L.log(tag, 'inside', inside, 'toasts', JSON.stringify(await L.toasts(p)), 'heat', JSON.stringify((await mapOf(p))?.heat ?? null));
    await L.say(p, '/speed 1');
    await L.say(p, '/weather calm');
    // 3. the scroll on the water, close by (the spot comes only now)
    const close = await seaward(p, spot, 95);
    await L.say(p, `/tp ${close.x} ${close.y}`);
    await L.sleep(3500);
    await dismiss(p);
    const seen = await mapOf(p);
    L.log(tag, 'in sight', JSON.stringify(seen?.spot ?? null));
    await snap(p, `${OUT}/3-scroll-${tag}.png`);
    // 4. the dig: alongside the scroll, «Копать»
    const at = await seaward(p, spot, 26);
    await L.say(p, `/tp ${at.x} ${at.y}`);
    await L.sleep(2500);
    await snap(p, `${OUT}/4-dig-button-${tag}.png`);
    await p.evaluate(() => { if (!globalThis.gravetide.state.self?.landing) globalThis.gravetide.land(); }); // (the run may have sent the boats already)
    await L.sleep(2500);
    await snap(p, `${OUT}/4b-digging-${tag}.png`);
    if (W > 1000) {
      for (let i = 0; i < 90; i++) {
        await L.sleep(1000);
        if (!(await mapOf(p))) break;
      }
      await L.sleep(800);
      await snap(p, `${OUT}/5-dug-${tag}.png`);
      L.log(tag, 'after dig', JSON.stringify(await L.toasts(p)));
    }
    L.log(tag, 'errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.context().close();
  }
} finally {
  await b.close();
}
