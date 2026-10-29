// The owner's three phone bugs (2026-10-29):
//   1. tap-to-sail: «поставить просто пальцем точку на карту и начать движение не получается» — a REAL touch tap
//      (CDP touchStart/touchEnd, Playwright's touchscreen) on the open sea and on the chart: the pill and the ship moving;
//   2. «К кораблю» in the right column: «тут иконки друг на друга накладываются если сместиться от корабля»;
//   3. no blinking finger on «Плыть»: «вот эти подсказки плыть надо мигающие убрать».
//   SIZE=844x390,740x360,1093x481 node tools/mobile/declutter/tapsail.mjs   (server on GPORT, default 58780)
import * as L from '../m0/lib.mjs';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'assets/raw/audit/declutter/tapsail';
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.GPORT ?? 58780);
const sizes = (process.env.SIZE ?? '844x390,740x360,1093x481').split(',').map((s) => s.split('x').map(Number));
const b = await L.browser();
// (one headless Chrome, at BelowNormal: the owner's CPU)
try {
  const pid = b.process?.()?.pid;
  if (pid) execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq ${pid} -or $_.ParentProcessId -eq ${pid} } | ForEach-Object { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch { /* not on Windows, or gone */ }

async function dismiss(p) {
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => {
      globalThis.gravetide.open(null);
      const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut], [data-gflater], #promo-over [data-polater], .lu-sheet [data-lulater]')].filter((b) => b.getBoundingClientRect().width);
      x.forEach((b) => b.click());
      for (const b of document.querySelectorAll('button')) if (/^\s*Вперёд\s*$/.test(b.textContent) && b.getBoundingClientRect().width) { b.click(); x.push(b); }
      return x.length;
    });
    if (!n) break;
    await L.sleep(400);
  }
  await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
}
/** A point of open sea on the screen: nothing under it (no ship, stack, place, thing), away from the HUD. */
const seaPoint = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, W = innerWidth, H = innerHeight;
  for (const [fx, fy] of [[0.62, 0.3], [0.38, 0.3], [0.62, 0.62], [0.5, 0.25], [0.7, 0.45], [0.3, 0.55]]) {
    const x = Math.round(W * fx), y = Math.round(H * fy);
    const el = document.elementFromPoint(x, y);
    if (el?.id !== 'world') continue;
    if (g.aim.about(x, y)) continue;
    return { x, y };
  }
  return null;
});
const own = (p) => p.evaluate(() => { const o = globalThis.gravetide.state.ownDisplay; return o ? { x: Math.round(o.x), y: Math.round(o.y) } : null; });
const pill = (p) => p.evaluate(() => { const e = document.getElementById('hud-autosail'); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().height > 2 ? e.innerText.replace(/\s+/g, ' ').trim() : null; });
/** A finger dragged over the sea (touchStart, moves, touchEnd): the view looks away from her. */
async function drag(p, x0, y0, dx, dy) {
  const s = await p.context().newCDPSession(p);
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 8; i++) {
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 8, y: y0 + (dy * i) / 8 }] });
    await L.sleep(30);
  }
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await s.detach();
}
/** The right column's round buttons under the chart: their boxes and every overlap between two of them. */
const column = (p) => p.evaluate(() => {
  const mm = document.getElementById('hud-map')?.getBoundingClientRect();
  const els = [...document.querySelectorAll('#touch > *, #hud-chat > #chat-toggle, #hud-map')].filter((e) => {
    if (e.classList.contains('hidden')) return false;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') return false;
    return mm && r.left >= mm.left - 30 && r.top >= mm.top - 4 && r.top < innerHeight * 0.75;
  });
  const box = (e) => {
    const r = e.getBoundingClientRect();
    // the word under «К кораблю» belongs to its slot
    const l = e.querySelector('.tc-home-l')?.getBoundingClientRect();
    return { id: e.id || e.className, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(Math.max(r.bottom, l?.bottom ?? 0)) };
  };
  const bs = els.map(box);
  const over = [];
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], c = bs[j];
    const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (ox > 0 && oy > 0) over.push(`${a.id}×${c.id} ${ox}x${oy}`);
  }
  return { boxes: bs, over };
});

const rows = [];
for (const [W, H] of sizes) {
  const tag = `${W}x${H}`;
  const p = await L.page(b, [W, H], { lang: 'ru', touch: true });
  await L.login(p, { port: PORT, know: true });
  await dismiss(p);
  // (the story's chapter 2: at sea its «Плыть» is on the bar — where the finger used to blink)
  for (const c of ['/god', '/level 8']) { await L.say(p, c); await L.sleep(400); }
  await L.say(p, '/tp black_coast');
  await L.sleep(2500);
  await dismiss(p);
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'autosail', stop: true }));
  await L.sleep(800);
  const r = { size: tag };
  // 1a. a tap on the open sea: the pill, and she moves
  const pt = await seaPoint(p);
  const a0 = await own(p);
  r.seaPoint = pt;
  if (pt) {
    await p.touchscreen.tap(pt.x, pt.y);
    await L.sleep(3500);
    const a1 = await own(p);
    r.seaTap = { pill: await pill(p), autosail: await p.evaluate(() => !!globalThis.gravetide.state.autosail), moved: a0 && a1 ? Math.round(Math.hypot(a1.x - a0.x, a1.y - a0.y)) : null };
    await p.screenshot({ path: `${OUT}/${tag}_1_sea_tap.png` });
  }
  // 1b. the chart: opened, a tap on it, the course at once
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'autosail', stop: true }));
  await L.sleep(800);
  await p.evaluate(() => globalThis.gravetide.open('map'));
  await L.sleep(1200);
  const cpt = await p.evaluate(() => { const c = document.getElementById('worldmap-canvas')?.getBoundingClientRect(); return c ? { x: Math.round(c.left + c.width * 0.62), y: Math.round(c.top + c.height * 0.4) } : null; });
  if (cpt) {
    const c0 = await own(p);
    await p.touchscreen.tap(cpt.x, cpt.y);
    await L.sleep(3500);
    const c1 = await own(p);
    r.chartTap = { modal: await p.evaluate(() => globalThis.gravetide.modal()), pill: await pill(p), autosail: await p.evaluate(() => !!globalThis.gravetide.state.autosail), moved: c0 && c1 ? Math.round(Math.hypot(c1.x - c0.x, c1.y - c0.y)) : null };
    await p.screenshot({ path: `${OUT}/${tag}_1_chart_tap.png` });
  }
  // 2. the view dragged away: «К кораблю» in its own slot of the right column
  await p.evaluate(() => globalThis.gravetide.open(null));
  await L.sleep(400);
  await drag(p, Math.round(W * 0.45), Math.round(H * 0.5), -Math.round(W * 0.25), -Math.round(H * 0.2));
  await L.sleep(900);
  r.home = await p.evaluate(() => { const e = document.getElementById('tc-home'); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().width > 0; });
  r.column = await column(p);
  await p.screenshot({ path: `${OUT}/${tag}_2_home.png` });
  // 3. «Плыть» on the bar, no finger on it (the story's chapter 2: at sea its «Плыть» is on the bar, where the finger blinked)
  await p.evaluate(() => { globalThis.gravetide.renderer.recentre(); globalThis.gravetide.net.send({ t: 'autosail', stop: true }); });
  await L.say(p, '/camp ch 2');
  await L.sleep(1500);
  await dismiss(p);
  await L.sleep(2500);
  r.finger = await p.evaluate(() => {
    const f = document.getElementById('tut-finger');
    const sail = document.querySelector('#tc-act[data-act="goal_sail"], .tc-act2[data-act="goal_sail"]');
    return { quests: (globalThis.gravetide.state.self?.quests ?? []).map((q) => q.id).join(','), fingerShown: !!f && !f.classList.contains('hidden'), sailOnBar: !!sail, sailRinged: !!sail?.classList.contains('tut-target'), anyRing: document.querySelectorAll('.tut-target').length };
  });
  await p.screenshot({ path: `${OUT}/${tag}_3_no_finger.png` });
  r.errors = p.errors.slice(0, 5);
  rows.push(r);
  console.log(JSON.stringify(r));
  await p.ctx.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
await b.close();
