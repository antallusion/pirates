// docs/23 phase 0, item 6 (and phase 8/9): the frame rate at sea on a phone on its side, with the machine's GPU (GPU=1)
// or the software renderer, as is and with the CPU slowed 4× like a mid phone. requestAnimationFrame over 6 s.
//   GPU=1 GPORT=58791 node assets/raw/audit/m0/fps.mjs
import * as L from './lib.mjs';
import { writeFileSync } from 'node:fs';
const OUT = process.env.OUT ?? 'assets/raw/audit/m0';
const b = await L.browser();
const p = await L.page(b, L.SIZES[process.env.SIZE ?? 'phone'], { lang: 'ru', films: true });
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const rows = [];
async function fps(label, rate) {
  const cdp = await p.ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await L.sleep(800);
  const r = await p.evaluate(() => new Promise((done) => {
    const ts = []; const t0 = performance.now();
    const f = (t) => { ts.push(t); if (t - t0 < 6000) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); done({ fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), long: d.filter((x) => x > 50).length }); } };
    requestAnimationFrame(f);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  rows.push({ label, cpu: rate, ...r }); L.log(label, rate + '×', JSON.stringify(r));
}
await L.login(p, { know: true }); await skip();
const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c?.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
await L.say(p, '/level 12'); await L.sleep(800); await L.closeAll(p);
await L.send(p, { t: 'undock' }); await L.sleep(2500); await skip(); await L.closeAll(p);
await L.say(p, '/tp 21000 70000'); await L.sleep(3000); await skip(); await L.closeAll(p);
await fps('sea', 1); await fps('sea', 4);
await L.say(p, '/foe pirate sloop 260'); await L.sleep(2500);
await fps('sea_combat', 1); await fps('sea_combat', 4);
writeFileSync(`${OUT}/fps_${process.env.GPU ? 'gpu' : 'swiftshader'}.json`, JSON.stringify({ at: new Date().toISOString(), renderer: gl, rows }, null, 1));
console.log(gl); await b.close();
