// Any tap sails (owner, 2026-10-29, TG on an iPhone: «мне нужно тапнуть куда мне надо и начать плыть. порт или еще
// куда-то, куда угодно короче»). As near an iPhone in Telegram as headless Chrome goes: an iPhone's UA, touch, DPR 3,
// 1128×500 landscape; every tap a real touchStart/touchEnd (Playwright's touchscreen = CDP Input.dispatchTouchEvent).
//   A. in the harbour's roads («В МОРЕ» on the round button): a tap on the sea → she casts off and sails there;
//   B. at sea: a tap on a port → the run there (she is put in on arrival);
//   C. a tap after a finger's drag (the view looked away) → still a course;
//   D. a tap with the island's step pill / HUD up → still a course.
//   GPORT=58820 SIZE=1128x500 node tools/mobile/declutter/tapany.mjs
import * as L from '../m0/lib.mjs';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'assets/raw/audit/declutter/tapany';
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.GPORT ?? 58820);
const [W, H] = (process.env.SIZE ?? '1128x500').split('x').map(Number);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS';
const b = await L.browser();
try {
  const pid = b.process?.()?.pid;
  if (pid) execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq ${pid} -or $_.ParentProcessId -eq ${pid} } | ForEach-Object { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch { /* gone */ }
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: UA, locale: 'ru-RU' });
await ctx.addInitScript(() => { try { localStorage.setItem('gravetide.lang', 'ru'); } catch {} });
await ctx.addInitScript(() => { setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300); });
const p = await ctx.newPage();
p.errors = [];
p.on('pageerror', (e) => p.errors.push(e.message));
p.ctx = ctx;

const st = () => p.evaluate(() => {
  const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
  const pill = document.getElementById('hud-autosail');
  const cast = document.getElementById('tc-cast');
  return {
    docked: s.self?.dockedAt ?? null, x: o ? Math.round(o.x) : null, y: o ? Math.round(o.y) : null, speed: o ? Math.round((o.speed ?? 0) * 10) / 10 : null,
    autosail: !!s.autosail, route: s.route?.key ?? null,
    pill: pill && !pill.classList.contains('hidden') && pill.getBoundingClientRect().height > 2 ? pill.innerText.replace(/\s+/g, ' ').trim() : null,
    castBtn: !!cast && cast.getBoundingClientRect().width > 0 && getComputedStyle(cast).display !== 'none' ? cast.innerText.replace(/\s+/g, ' ').trim() : null,
    toasts: [...document.querySelectorAll('#toasts > .toast')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()).slice(-3),
  };
});
/** Open sea on the screen with nothing under it, and what the page has there (never a HUD element). */
const seaPoint = () => p.evaluate(() => {
  const g = globalThis.gravetide, Wd = innerWidth, Hd = innerHeight;
  for (const [fx, fy] of [[0.6, 0.3], [0.4, 0.3], [0.6, 0.6], [0.35, 0.6], [0.7, 0.45], [0.5, 0.22]]) {
    const x = Math.round(Wd * fx), y = Math.round(Hd * fy);
    if (document.elementFromPoint(x, y)?.id !== 'world') continue;
    if (g.aim.about(x, y)) continue;
    const w = g.renderer.toWorld(x, y);
    const inPoly = (px, py, q) => { let c = false; for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2) if ((q[i + 1] > py) !== (q[j + 1] > py) && px < ((q[j] - q[i]) * (py - q[i + 1])) / (q[j + 1] - q[i + 1]) + q[i]) c = !c; return c; };
    if ([...g.state.islands.values()].some((i) => i.poly?.length >= 6 && inPoly(w.x, w.y, i.poly))) continue;
    if (g.state.ports.some((pt) => Math.hypot(pt.x - w.x, pt.y - w.y) * g.renderer.zoom < 90)) continue;
    return { x, y };
  }
  return null;
});
async function drag(x0, y0, dx, dy) {
  const s = await p.context().newCDPSession(p);
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 8; i++) { await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 8, y: y0 + (dy * i) / 8 }] }); await L.sleep(30); }
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await s.detach();
}
const clearToasts = () => p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
const rep = { ua: UA, size: `${W}x${H}@3` };

await L.login(p, { port: PORT, know: true });
await L.say(p, '/god');
await L.sleep(400);
// A. in a harbour's roads: the port's window put away — «В МОРЕ» on the round button
await p.evaluate(() => globalThis.gravetide.open(null));
await L.sleep(1200);
await clearToasts();
rep.A0 = await st();
await p.screenshot({ path: `${OUT}/A0_in_port_roads.png` });
const sp = await seaPoint();
rep.A_point = sp;
if (sp) {
  await p.touchscreen.tap(sp.x, sp.y);
  await L.sleep(5000);
  rep.A1 = await st();
  await p.screenshot({ path: `${OUT}/A1_tap_sea_sailing.png` });
}
// B. at sea: a tap on a port
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'autosail', stop: true }));
await L.sleep(1500);
await clearToasts();
const port = await p.evaluate(() => {
  const g = globalThis.gravetide, r = g.renderer, o = g.state.ownDisplay;
  const near = g.state.ports.map((pt) => ({ pt, d: Math.hypot(pt.x - o.x, pt.y - o.y) })).sort((a, c) => a.d - c.d);
  for (const { pt } of near) {
    const sx = (pt.x - r.camX) * r.zoom + r.w / 2, sy = (pt.y - r.camY) * r.zoom + r.h / 2;
    if (sx > 60 && sy > 60 && sx < innerWidth - 60 && sy < innerHeight - 60 && document.elementFromPoint(sx, sy)?.id === 'world') return { id: pt.id, x: Math.round(sx), y: Math.round(sy) };
  }
  return { none: near.slice(0, 2).map((n) => [n.pt.id, Math.round(n.d)]), zoom: r.zoom };
});
rep.B_port = port;
if (port.id) {
  rep.B0 = await st();
  await p.touchscreen.tap(port.x, port.y);
  await L.sleep(1500);
  rep.B1 = await st();
  await p.screenshot({ path: `${OUT}/B1_tap_port_sailing.png` });
  await L.sleep(5000);
  rep.B2 = await st();
  await p.screenshot({ path: `${OUT}/B2_port_docked.png` });
}
// (out again by a tap on the sea: the roads' case once more)
{
  await p.evaluate(() => globalThis.gravetide.open(null));
  await L.sleep(1200);
  await clearToasts();
  const q = await seaPoint();
  if (q) await p.touchscreen.tap(q.x, q.y);
  await L.sleep(6000);
  rep.B3 = { point: q, ...(await st()) };
}
// C. a tap after a finger's drag
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'autosail', stop: true }));
await L.sleep(1200);
await drag(Math.round(W * 0.5), Math.round(H * 0.5), -Math.round(W * 0.2), -Math.round(H * 0.15));
await L.sleep(700);
await clearToasts();
const cp = await seaPoint();
if (cp) {
  await p.touchscreen.tap(cp.x, cp.y);
  await L.sleep(3500);
  rep.C = { point: cp, ...(await st()) };
  await p.screenshot({ path: `${OUT}/C_tap_after_drag.png` });
}
// D. with HUD elements up (the island's step pill, the tray open)
await p.evaluate(() => { globalThis.gravetide.net.send({ t: 'autosail', stop: true }); globalThis.gravetide.renderer.recentre(); });
await L.sleep(1200);
await p.evaluate(() => document.getElementById('tc-more')?.click());
await L.sleep(600);
await clearToasts();
const dp = await seaPoint();
if (dp) {
  rep.D0 = await p.evaluate(() => ({ trayOpen: document.body.classList.contains('more-open'), el: document.elementFromPoint(innerWidth * 0.5, innerHeight * 0.5)?.id }));
  await p.touchscreen.tap(dp.x, dp.y);
  await L.sleep(900);
  rep.D = { point: dp, pill1: await p.evaluate(() => !!document.querySelector('#hud-isle1:not(.hidden)')), ...(await st()) };
  await p.screenshot({ path: `${OUT}/D_tap_with_hud.png` });
}
rep.errors = p.errors.slice(0, 5);
console.log(JSON.stringify(rep, null, 1));
writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
await b.close();
