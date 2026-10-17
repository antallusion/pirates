// The far view and the free look in the browser (owner, 2026-10-17: «дай возможность отдалить море сильно и просто
// возить пальцем и просматривать где что»; client/src/render/freecam.ts). A captain at sea on a phone (touch), real
// touch events through CDP:
//   pinch   two fingers apart and together: the zoom follows; pinched far out, below the old 0.35 px/m, to ZOOM_MIN
//   drag    one finger across the sea: the camera parks off her (renderer.free), she sails on (her position moves),
//           no tap fired (no course set, no mark)
//   tap     a short still touch: aims (renderer.mouseX/Y at the point), the view stays where it is
//   home    «К кораблю» shows while looking away; a tap on it brings the view home and the zoom back in
//   fight   looking away when a pirate comes: the view comes home by itself
//   fps     the frame rate at the default zoom and at the farthest, under a 4× CPU throttle, a few ships about
// Screenshots: the far view at each size (RU/EN, Telegram's inset).
//   GPORT=58980 SIZE=844x390,480x270 LANG2=ru,en TG=0 OUT=assets/raw/audit/freecam node tools/mobile/ux/freecam.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const sizes = (process.env.SIZE ?? '844x390').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru').split(',');
const port = Number(process.env.GPORT ?? 58980);
const tg = Number(process.env.TG ?? 0);
const OUT = process.env.OUT ?? 'assets/raw/audit/freecam';
const FPS = process.env.FPS !== '0';
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let fails = 0;
const report = [];
const bad = (cond, what) => { if (!cond) { fails++; L.log('FAIL ' + what); } else L.log('ok   ' + what); };
try {
  for (const lang of langs) {
    const [W0, H0] = sizes[0];
    const p = await L.page(b, [W0, H0], { lang, touch: true });
    if (tg) await p.ctx.addInitScript((t) => addEventListener('DOMContentLoaded', () => { document.documentElement.classList.add('tg-app'); document.documentElement.style.setProperty('--sa-t', `${t}px`); document.documentElement.style.setProperty('--tg-top', `${t}px`); }), tg);
    await L.login(p, { port, know: true });
    await L.say(p, '/god');
    await L.say(p, '/noboard on');
    await L.closeAll(p);
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
    await L.sleep(3000);
    await shut(p);
    const cdp = await p.ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
    const R = () => p.evaluate(() => { const r = globalThis.gravetide.renderer, s = globalThis.gravetide.state; return { zoom: r.zoom, target: r.targetZoom, free: r.free, looking: r.looking, cam: [r.camX, r.camY], own: s.ownDisplay ? [s.ownDisplay.x, s.ownDisplay.y] : null, mouse: [r.mouseX, r.mouseY], mix: r.farMix, auto: !!s.autosail, home: !document.getElementById('tc-home')?.classList.contains('hidden') }; });
    // a clear patch of sea in the middle of the screen, away from the HUD (a third from the left, under the top band)
    const cx = Math.round(W0 * 0.45), cy = Math.round(H0 * 0.5);
    // (the sea under the finger: anything over it — a sheet that came by itself, the daily gift — is put away first)
    const clear = async () => {
      for (let i = 0; i < 8; i++) {
        const top = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id === 'world' ? '' : `${e.tagName}#${e.id}.${String(e.className).slice(0, 40)}`) : '?'; }, [cx, cy]);
        if (!top) return true;
        if (i === 7) L.log('over the sea: ' + top);
        await shut(p);
        await L.sleep(600);
      }
      return false;
    };
    const pinch = async (from, to, steps = 8) => {
      await clear(); // (an offer's card comes by itself a while after casting off)
      await touch('touchStart', [[cx - from, cy], [cx + from, cy]]);
      for (let i = 1; i <= steps; i++) { const d = from + ((to - from) * i) / steps; await touch('touchMove', [[cx - d, cy], [cx + d, cy]]); await L.sleep(16); }
      await touch('touchEnd', []);
      await L.sleep(400);
    };
    if (lang === langs[0]) {
      await clear();
      // her sails up: she moves while the view is dragged
      await p.evaluate(() => { globalThis.gravetide.state.input.sail = 4; });
      await L.sleep(1500);
      const z0 = (await R()).zoom;
      // pinch out (fingers together) several times: the zoom down to the floor
      for (let i = 0; i < 6; i++) await pinch(140, 20);
      await L.sleep(1200);
      const far = await R();
      bad(far.target <= 0.041, `pinch out: zoom ${z0.toFixed(2)} → ${far.target.toFixed(3)} (floor 0.04)`);
      bad(far.mix === 1, `the chart alone at the farthest (mix ${far.mix})`);
      bad(far.home, '«К кораблю» shows while drawn out');
      // a drag: the view parks off her, she sails on, no tap
      await clear();
      const before = await R();
      await p.evaluate(() => { globalThis.gravetide.renderer.mouseX = -1; globalThis.gravetide.renderer.mouseY = -1; });
      await touch('touchStart', [[cx, cy]]);
      for (let i = 1; i <= 10; i++) { await touch('touchMove', [[cx - i * 25, cy - i * 8]]); await L.sleep(16); }
      await touch('touchEnd', []);
      await L.sleep(1500);
      const dragged = await R();
      const camMove = Math.hypot(dragged.cam[0] - before.cam[0], dragged.cam[1] - before.cam[1]);
      const shipMove = Math.hypot(dragged.own[0] - before.own[0], dragged.own[1] - before.own[1]);
      bad(!!dragged.free && camMove > 3000, `drag: the camera parked ${Math.round(camMove)} m off (free ${JSON.stringify(dragged.free && [Math.round(dragged.free.x), Math.round(dragged.free.y)])})`);
      bad(shipMove > 5, `drag: she sailed on ${Math.round(shipMove)} m meanwhile`);
      bad(dragged.mouse[0] === -1, 'drag: no tap fired');
      await p.screenshot({ path: `${OUT}/drag_${W0}x${H0}_${lang}.png` });
      // a tap: aims at the point, the view stays
      await touch('touchStart', [[cx + 30, cy + 20]]);
      await L.sleep(60);
      await touch('touchEnd', []);
      await L.sleep(500);
      const tapped = await R();
      bad(tapped.mouse[0] === cx + 30 && tapped.mouse[1] === cy + 20, `tap: aimed at ${tapped.mouse}`);
      bad(!!tapped.free, 'tap: the view stays parked');
      // a long still press: still a tap (its meaning before: the aim where it went down)
      await touch('touchStart', [[cx - 40, cy + 10]]);
      await L.sleep(700);
      await touch('touchEnd', []);
      await L.sleep(300);
      const held = await R();
      bad(held.mouse[0] === cx - 40 && held.mouse[1] === cy + 10, `long press: aimed at ${held.mouse}`);
      // the helm under a finger is not the sea's: a drag on the stick steers, it does not pan
      const st = await p.evaluate(() => { const r = document.getElementById('tc-stick').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const freeBefore = (await R()).free;
      await touch('touchStart', [[st[0], st[1]]]);
      for (let i = 1; i <= 6; i++) { await touch('touchMove', [[st[0] + i * 6, st[1] - i * 6]]); await L.sleep(20); }
      await touch('touchEnd', []);
      await L.sleep(300);
      const freeAfter = (await R()).free;
      bad(freeBefore && freeAfter && Math.abs(freeBefore.x - freeAfter.x) < 1 && Math.abs(freeBefore.y - freeAfter.y) < 1, 'the helm\'s drag does not move the view');
      // home: the button brings the view back and the zoom in
      const hb = await p.evaluate(() => { const r = document.getElementById('tc-home').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await touch('touchStart', [hb]);
      await L.sleep(60);
      await touch('touchEnd', []);
      await L.sleep(2500);
      const home = await R();
      const off = Math.hypot(home.cam[0] - home.own[0], home.cam[1] - home.own[1]);
      bad(!home.free && !home.looking && home.target >= 0.35, `home: free ${home.free}, zoom back to ${home.target.toFixed(2)}`);
      bad(off < 400, `home: the camera on her again (${Math.round(off)} m off, the look-ahead)`);
      bad(!home.home, '«К кораблю» hidden again');
      // pinch in: the zoom grows
      const zi = (await R()).target;
      await pinch(30, 120);
      bad((await R()).target > zi * 1.5, 'pinch in: the zoom grows');
      // fps: a few ships about, the default zoom and the farthest, 4× CPU throttle
      if (FPS) {
        await L.say(p, '/foe merchant brig 600');
        await L.say(p, '/foe merchant sloop 900');
        await L.sleep(2500);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        // (the frames a second, and the renderer's own milliseconds a frame)
        await p.evaluate(() => { const r = globalThis.gravetide.renderer; if (r.__timed) return; r.__timed = true; const o = r.render.bind(r); globalThis.__rt = []; r.render = (...a) => { const t = performance.now(); o(...a); globalThis.__rt.push(performance.now() - t); }; });
        const fps = () => p.evaluate(() => new Promise((res) => { globalThis.__rt = []; let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else { const a = globalThis.__rt; res({ fps: Math.round((n * 1000 / (performance.now() - t0)) * 10) / 10, ms: Math.round((a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)) * 10) / 10 }); } }; requestAnimationFrame(f); }));
        await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.recentre(); r.targetZoom = 1.5; });
        await L.sleep(2500);
        const near = await fps();
        await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.35; });
        await L.sleep(2500);
        const old = await fps();
        await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.24; });
        await L.sleep(2500);
        const fade = await fps();
        await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.04; });
        await L.sleep(3000);
        const farFps = await fps();
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        const f = (x) => `${x.fps} fps (${x.ms} ms)`;
        L.log(`×4 CPU throttle: zoom 1.5 ${f(near)} · 0.35 ${f(old)} · 0.24 the fade ${f(fade)} · 0.04 the farthest ${f(farFps)}`);
        report.push({ fps: { near, old, fade, far: farFps } });
        bad(farFps.fps >= near.fps * 0.9 && farFps.ms <= near.ms, `the farthest view no slower than the near one (${f(farFps)} vs ${f(near)})`);
        bad(fade.ms <= old.ms * 1.6, `the fade not much dearer than the old farthest (${f(fade)} vs ${f(old)})`);
      }
      // a fight brings the view home: look away, then a pirate on her (after any fight of before has died down)
      for (let i = 0; i < 50 && (await p.evaluate(() => !!globalThis.gravetide.state.you?.combat || !!globalThis.gravetide.state.pursuit)); i++) await L.sleep(500);
      await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.05; r.panBy(400, 0, globalThis.gravetide.state.ownDisplay); });
      await L.sleep(800);
      bad((await R()).looking, 'looking away before the fight');
      await L.say(p, '/foe pirate brig 250');
      await L.sleep(1500);
      // (her own broadside at him: the fight's first sign)
      await p.evaluate(() => { const g = globalThis.gravetide, s = g.state, o = s.ownDisplay; let best = null, bd = 1e9; for (const x of s.ships.values()) { if (!x.cur) continue; const d = Math.hypot(x.cur.x - o.x, x.cur.y - o.y); if (d < bd) { bd = d; best = x; } } const t = best ? best.cur : { x: o.x + 100, y: o.y }; g.net.send({ t: 'fire', side: 'port', dist: Math.round(Math.min(bd, 140)), x: Math.round(t.x), y: Math.round(t.y) }); g.net.send({ t: 'fire', side: 'starboard', dist: Math.round(Math.min(bd, 140)), x: Math.round(t.x), y: Math.round(t.y) }); });
      let fought = false;
      for (let i = 0; i < 30 && !fought; i++) { await L.sleep(500); fought = !(await R()).looking; }
      bad(fought, 'a fight: the view came home by itself');
      await L.say(p, '/tp gravewater');
      await L.sleep(2000);
      report.push({ lang, z0, far, dragged, tapped, home });
    }
    // the far view at every size (the screenshots)
    for (const [W, H] of sizes) {
      await p.setViewportSize({ width: W, height: H });
      await shut(p);
      await p.evaluate(() => { const r = globalThis.gravetide.renderer, s = globalThis.gravetide.state; r.recentre(); r.targetZoom = 0.06; r.panBy(-120, 60, s.ownDisplay); });
      await L.sleep(2500);
      const name = `far_${W}x${H}_${lang}${tg ? '_tg' + tg : ''}`;
      await p.screenshot({ path: `${OUT}/${name}.png` });
      const ov = await overlaps(p);
      bad(!ov.length, `${name}: nothing overlaps ${ov.join(', ')}`);
      await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.targetZoom = 0.24; });
      await L.sleep(2000);
      await p.screenshot({ path: `${OUT}/fade_${W}x${H}_${lang}${tg ? '_tg' + tg : ''}.png` });
      await p.evaluate(() => globalThis.gravetide.renderer.recentre());
      await L.sleep(1500);
    }
    if (p.errors.length) { fails += p.errors.length; L.log('page errors: ' + p.errors.slice(0, 5).join(' | ')); }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
L.log(`${fails} problems`);
process.exit(fails ? 1 : 0);

async function shut(p) {
  await p.evaluate(() => globalThis.gravetide.open(null));
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => { const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut], [data-gflater], #promo-over [data-polater]')].filter((b) => b.getBoundingClientRect().width); x.forEach((b) => b.click()); return x.length; });
    if (!n) break;
    await L.sleep(400);
  }
}

/** The HUD's controls on screen now, pairwise (the round buttons, «К кораблю» and its word, the chart, the helm…). */
function overlaps(p) {
  return p.evaluate(() => {
    const vis = (e) => { if (!e) return false; for (let q = e; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const ids = ['#hud-map', '#tc-menu', '#tc-news', '#tc-home', '#tc-home .tc-home-l', '#tc-isle', '#tc-offer', '#tc-daily', '#hud-chat > .chat-toggle', '#tc-stick', '#tc-sail', '#tc-fire', '#tc-ammo', '#tc-lock', '#tc-special', '#tc-actrow', '#tc-cast', '#hud-autosail', '#advcard', '#encounter', '#hud-captain .cs'];
    if (document.body.classList.contains('mm-peek')) ids.splice(ids.indexOf('#hud-map'), 1); // (stepped up behind its tab)
    const els = ids.map((s) => [s, document.querySelector(s)]).filter(([, e]) => vis(e) && !e.classList.contains('hidden')).map(([s, e]) => [s, e.getBoundingClientRect()]);
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const [a, ra] = els[i], [c, rc] = els[j];
      if (a.startsWith(c) || c.startsWith(a)) continue;
      const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
      if (ox > 1 && oy > 1) out.push(`${a}×${c} ${Math.round(ox)}×${Math.round(oy)}`);
    }
    for (const [s, r] of els) if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`${s} off the screen`);
    return out;
  });
}
