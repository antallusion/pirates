// The sea HUD's declutter (owner, 2026-10-29: «на мобиле лютый графический перегруз… прятать в подменюшки»; «скрывать
// плашки с хп… если бой не начат или цель не выбрана»; «поменьше это расстояние»). One captain, every size, the states:
//   clean (at sea, nothing marked), target (a merchant marked), fight (a pirate on her), menu (the «⋯» fan open),
//   and 844x390 with an iPhone's notch (the safe area emulated by CDP).
//   TAG=before|after SIZE=844x390,740x360,1093x481,1366x768,1920x1080 node tools/mobile/declutter/shots.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const tag = process.env.TAG ?? 'after';
const OUT = `assets/raw/audit/declutter/${tag}`;
mkdirSync(OUT, { recursive: true });
const sizes = (process.env.SIZE ?? '844x390,740x360,1093x481,1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const states = (process.env.STATES ?? 'clean,target,fight,menu').split(',');
const port = 58780;
const b = await L.browser();
try {
  execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*ms-playwright*' } | % { try { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' } catch {} }"`, { stdio: 'ignore' });
} catch {}
const rows = [];
async function dismiss(p) {
  await p.evaluate(() => { globalThis.gravetide.open(null); });
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => { const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut], [data-gflater], #promo-over [data-polater], .lu-sheet [data-lulater]')].filter((b) => b.getBoundingClientRect().width); x.forEach((b) => b.click()); if (document.body.classList.contains('chat-open')) document.getElementById('chat-toggle')?.click(); return x.length; });
    if (!n) break;
    await L.sleep(400);
  }
  await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
}
const nearest = (p) => p.evaluate(() => { const g = globalThis.gravetide, s = g.state; let best = null, bd = 1e9; for (const x of s.ships.values()) { if (x.id === s.entityId || !x.cur) continue; const d = Math.hypot(x.cur.x - s.ownDisplay.x, x.cur.y - s.ownDisplay.y); if (d < bd) { bd = d; best = x.id; } } if (best !== null) g.target(best); return best; });
// what is seen on the HUD: every visible box over the sea, its area share
const census = (p) => p.evaluate(() => {
  const out = [];
  const W = innerWidth, H = innerHeight;
  for (const e of document.querySelectorAll('#hud *, #hud-chat > button, #advcard > *, #toasts > *')) {
    if (e.closest('.hidden')) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (!(e.matches('button, .hud-block, [id^="hud-"], .unit-frame, .minimap-frame, .tb-chip, .pill, [class*="pill"], [class*="badge"]') )) continue;
    if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    out.push({ id: e.id || e.className.toString().split(' ')[0] || e.tagName, l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
});
const runs = [...sizes.map((sz) => [sz, false]), ...(process.env.NOTCH === '0' ? [] : [[[844, 390], true]])];
for (const [[W, H], notch] of runs) {
  const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1100 });
  if (notch) {
    const c = await p.ctx.newCDPSession(p);
    try { await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 47, right: 47, top: 0, bottom: 21 } }); rows.push({ notch: 'cdp' }); }
    catch (e) { rows.push({ notch: 'none ' + e.message }); }
  }
  await L.login(p, { port, know: true });
  await dismiss(p);
  for (const c of ['/god', '/noboard on', '/level 8', '/silver 900']) { await L.say(p, c); await L.sleep(300); }
  await L.sleep(800);
  for (const st of states) {
    await dismiss(p);
    await p.evaluate(() => { const g = globalThis.gravetide; g.target?.(null); if (document.body.classList.contains('more-open')) document.getElementById('tc-more')?.click(); });
    if (st === 'clean' || st === 'menu') { await L.say(p, '/tp black_coast'); await L.sleep(1800); }
    if (st === 'target') { await L.say(p, '/tp gravewater'); await L.sleep(1200); await L.say(p, '/foe merchant brig 300'); await L.sleep(1500); await nearest(p); }
    if (st === 'fight') { await L.say(p, '/tp gravewater'); await L.sleep(1200); await L.say(p, '/foe pirate brig 300'); await L.sleep(1500); await nearest(p); await L.sleep(2500); }
    if (st === 'sail') { await L.say(p, '/tp black_coast'); await L.sleep(1500); await p.evaluate(() => { const g = globalThis.gravetide, o = g.state.ownDisplay; g.net.send({ t: 'autosail', x: Math.round(o.x + 1500), y: Math.round(o.y + 1500) }); }); await L.sleep(1500); }
    await dismiss(p);
    if (st === 'menu') { await p.evaluate(() => document.getElementById('tc-more')?.click()); await L.sleep(500); }
    await L.sleep(500);
    const name = `${W}x${H}${notch ? '_notch' : ''}_${st}`;
    await p.screenshot({ path: `${OUT}/${name}.png` });
    const boxes = await census(p);
    const cap = await p.evaluate(() => { const r = document.querySelector('#hud-captain')?.getBoundingClientRect(); const s = document.querySelector('#tc-stick')?.getBoundingClientRect(); const m = document.querySelector('#hud-map')?.getBoundingClientRect(); return { touch: document.body.classList.contains('touch'), more: document.body.classList.contains('hud-more'), desk: document.body.classList.contains('more-desk'), cap: r && Math.round(r.left), capT: r && Math.round(r.top), stick: s && Math.round(s.left), stickB: s && Math.round(innerHeight - s.bottom), mapR: m && Math.round(innerWidth - m.right) }; });
    rows.push({ name, ...cap, n: boxes.length, boxes });
    L.log(name, JSON.stringify(cap), boxes.length, 'boxes', p.errors.slice(-2).join(' | '));
  }
  if (process.env.EACH && !notch) await import('./each.mjs').then((m) => m.default(p, L, OUT, `${W}x${H}`, rows));
  await p.ctx.close();
}
await b.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
