// The living sea (2026-10-16): the frame rate at sea with 10+ ships about her (as is and with the CPU slowed 4×), a
// pixel diff of two frames a second apart (the sea moves), and screenshots at the phone, the small phone and the desk.
//   GPORT=58989 OUT=assets/raw/audit/gfx TAG=after [GL=0] [LANG2=ru,en] [SIZES=844x390,480x270,1440x900] [FPS=1] node tools/mobile/gfx/seafx.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.OUT ?? 'assets/raw/audit/gfx';
const TAG = process.env.TAG ?? 'now';
const port = Number(process.env.GPORT ?? 58989);
const sizes = (process.env.SIZES ?? '844x390,480x270,1440x900').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru').split(',');
const noGl = process.env.GL === '0';
mkdirSync(OUT, { recursive: true });
const rows = [];
async function dismiss(p) {
  await L.closeAll(p, 1);
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => { const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, .k-sheet-root.k-open [data-close], [data-poshut]')]; x.forEach((b) => b.click()); return x.length; });
    if (!n) break;
    await L.sleep(400);
  }
}
const b = await L.browser();
try {
  for (const lang of langs) {
    const p = await L.page(b, sizes[0], { lang, touch: sizes[0][0] < 1000 });
    if (noGl) await p.ctx.addInitScript(() => { try { localStorage.setItem('gravetide.gl', 'off'); } catch {} });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/level 12'); await L.say(p, '/god'); await L.sleep(800); await L.closeAll(p);
    await L.send(p, { t: 'undock' }); await L.sleep(2500); await L.closeAll(p);
    await L.say(p, process.env.SPOT ?? '/tp 21000 70000'); await L.sleep(3000); await L.closeAll(p);
    if (process.env.WEATHER) { await L.say(p, `/weather ${process.env.WEATHER}`); await L.sleep(500); }
    if (process.env.HOUR) { await L.say(p, `/time ${process.env.HOUR}`); await L.sleep(500); }
    // a dozen peaceful sails about her (merchants: none grapples her, so the frame rate is of the sea, not a fight)
    await L.say(p, '/noboard on');
    const cls = ['fluyt', 'brig', 'sloop', 'schooner'];
    for (let i = 0; i < 12; i++) { await L.say(p, `/foe merchant ${cls[i % 4]} ${70 + i * 45}`); await L.sleep(150); }
    // under way, slow (the sails about her stay in sight)
    await p.evaluate(() => { const s = globalThis.gravetide.state; s.input.sail = 1; });
    await L.sleep(3000);
    await dismiss(p);
    const ships = await p.evaluate(() => { const s = globalThis.gravetide.state, o = s.ownDisplay; let n = 0; for (const x of s.ships.values()) if (x.cur && Math.hypot(x.cur.x - o.x, x.cur.y - o.y) < 1200) n++; return n; });
    const info = await p.evaluate(() => ({ gl: !!globalThis.gravetide.renderer.sea, lod: globalThis.gravetide.renderer.fx.lod }));
    L.log(lang, 'ships near', ships, JSON.stringify(info));
    if (process.env.FPS !== '0' && lang === langs[0]) {
      const cdp = await p.ctx.newCDPSession(p);
      for (const rate of [1, 4]) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await L.sleep(1500);
        const r = await p.evaluate(() => new Promise((done) => {
          const ts = []; const t0 = performance.now();
          const f = (t) => { ts.push(t); if (t - t0 < 6000) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, c) => a - c); done({ fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), long: d.filter((x) => x > 50).length, lod: globalThis.gravetide.renderer.fx.lod }); } };
          requestAnimationFrame(f);
        }));
        rows.push({ tag: TAG, gl: !noGl, cpu: rate, ships, ...r });
        L.log(TAG, noGl ? '2D' : 'GL', rate + '×', JSON.stringify(r));
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      // the sea moves: two screenshots a second apart, the share of pixels that changed (the HUD masked off: the
      // middle band of the screen only)
      const cdp2 = await p.ctx.newCDPSession(p);
      const grab = async () => (await cdp2.send('Page.captureScreenshot', { format: 'png' })).data;
      // the ship stopped and the camera still, so only the water's own motion changes pixels
      await p.evaluate(() => { const s = globalThis.gravetide.state; s.input.sail = 0; });
      for (let i = 0; i < 30; i++) { const v = await p.evaluate(() => Math.abs(globalThis.gravetide.state.ownDisplay?.speed ?? 0)); if (v < 0.02) break; await L.sleep(1000); }
      await L.sleep(1500);
      await dismiss(p);
      // the water alone: the shader sea's own layer (WebGL), or the world canvas without the HUD (2D)
      await p.evaluate(() => { const st = document.createElement('style'); st.id = 'gfx-only-sea'; st.textContent = document.getElementById('world-sea') ? 'body * { visibility: hidden !important; } #world-sea { visibility: visible !important; }' : '#hud, #touch, #toasts, #hud-chat, .k-sheet-root { visibility: hidden !important; }'; document.head.append(st); });
      await L.sleep(300);
      const speed = await p.evaluate(() => +(globalThis.gravetide.state.ownDisplay?.speed ?? 0).toFixed(3));
      const a = await grab(); await L.sleep(1000); const c = await grab();
      const diff = await p.evaluate(async ([x, y]) => {
        const load = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + d; });
        const [ia, ic] = await Promise.all([load(x), load(y)]);
        const W = ia.width, H = ia.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, W, H).data;
        g.drawImage(ic, 0, 0); const dc = g.getImageData(0, 0, W, H).data;
        let n = 0, tot = 0, sum = 0;
        for (let yy = Math.floor(H * 0.3); yy < H * 0.7; yy += 2) for (let xx = Math.floor(W * 0.15); xx < W * 0.85; xx += 2) {
          const i = (yy * W + xx) * 4; const d = Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]);
          tot++; sum += d; if (d > 6) n++;
        }
        return { changed: +(n / tot * 100).toFixed(1), meanDelta: +(sum / tot).toFixed(2) };
      }, [a, c]);
      await p.evaluate(() => document.getElementById('gfx-only-sea')?.remove());
      rows.push({ tag: TAG, gl: !noGl, diff, speed });
      L.log('sea diff 1 s', JSON.stringify(diff), 'her speed', speed);
      writeFileSync(`${OUT}/diff_${TAG}${noGl ? '_2d' : ''}_a.png`, Buffer.from(a, 'base64'));
      writeFileSync(`${OUT}/diff_${TAG}${noGl ? '_2d' : ''}_b.png`, Buffer.from(c, 'base64'));
    }
    for (const [W, H] of sizes) {
      await p.setViewportSize({ width: W, height: H });
      await L.sleep(1500);
      await dismiss(p);
      const name = `${OUT}/sea_${TAG}${noGl ? '_2d' : ''}_${W}x${H}_${lang}.png`;
      await p.screenshot({ path: name });
      L.log('shot', name);
    }
    if (p.errors.length) L.log('page errors', p.errors.slice(0, 5));
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/fps_${TAG}${noGl ? '_2d' : ''}.json`, JSON.stringify(rows, null, 1));
