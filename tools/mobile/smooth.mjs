// docs/23 item 86: how smoothly her own ship and the others move, frame to frame, at 60 and 30 frames a second, with a
// phone's network (each packet late by 30–90 ms, now and then 200 ms). Every frame after the game has drawn, her shown
// place and every other ship's within 1.2 km are read; a frame's step is set against the step her way would make in
// that frame's time. Reported: the median and 95th percentile of the error (in metres and on the screen in px), the
// steps back, and «jumps» (an error over a third of the expected step and over 1 px). The admin server sets the scene.
//   GPORT=58813 HZ=60 JIT=1 SECS=20 GPU=1 node tools/mobile/smooth.mjs
import * as L from './m0/lib.mjs';
import { writeFileSync } from 'node:fs';

const HZ = Number(process.env.HZ ?? 60), JIT = process.env.JIT !== '0', SECS = Number(process.env.SECS ?? 20);
/** A phone's hitches: this share of frames comes a frame late (a collection, a busy core). */
const HITCH = Number(process.env.HITCH ?? 0);
const OUT = process.env.OUT ?? 'assets/raw/audit/m78';
const port = Number(process.env.GPORT ?? 58813);
const b = await L.browser();
const p = await L.page(b, L.SIZES.phone, { lang: 'ru' });
// The frame rate held to HZ (a phone that draws 30 a second), and the network of a phone.
await p.ctx.addInitScript(([hz, jit, hitch]) => {
  if (hz < 120) {
    const raf = window.requestAnimationFrame.bind(window);
    let q = [], last = 0, armed = false, wait = 1000 / hz;
    const tick = (t) => {
      if (t - last < wait - 4) return void raf(tick);
      last = t; armed = false;
      wait = (Math.random() < hitch ? 2 + Math.floor(Math.random() * 2) : 1) * 1000 / hz; // the next one late by one or two
      const cbs = q; q = [];
      for (const c of cbs) c(t);
    };
    window.requestAnimationFrame = (cb) => { q.push(cb); if (!armed) { armed = true; raf(tick); } return q.length; };
  }
  if (jit) {
    const W = window.WebSocket;
    window.WebSocket = class extends W {
      constructor(...a) {
        super(...a);
        let chain = 0;
        const real = new Map();
        const deliver = (f, e) => { const now = performance.now(); const late = 30 + Math.random() * 60 + (Math.random() < 0.03 ? 200 : 0); chain = Math.max(chain, now + late); setTimeout(() => f.call(this, e), chain - now); };
        Object.defineProperty(this, 'onmessage', { set: (f) => real.set('m', f), get: () => real.get('m') });
        super.onmessage = (e) => { const f = real.get('m'); if (f) deliver(f, e); };
      }
    };
  }
}, [HZ, JIT, HITCH]);
await L.login(p, { port, know: true });
await L.closeAll(p);
await L.say(p, '/level 8'); await L.sleep(600);
await L.send(p, { t: 'undock' }); await L.sleep(2500); await L.closeAll(p);
await L.say(p, '/tp 21000 70000'); await L.sleep(3000); await L.closeAll(p);
for (let i = 0; i < 3; i++) { await L.say(p, '/spawn merchant fluyt league'); await L.sleep(400); }
// Under way: half sail, a gentle turn now and then (the helm by the stick's own state).
await p.evaluate(() => { const s = globalThis.gravetide.state; s.input.sail = 3; });
await L.sleep(4000);
const r = await p.evaluate(async (secs) => {
  const g = globalThis.gravetide, s = g.state, R = g.renderer;
  const own = [], others = new Map(); const frames = [];
  const t0 = performance.now();
  await new Promise((done) => {
    const f = (t) => {
      const o = s.ownDisplay;
      frames.push(t);
      if (o) own.push({ t, x: o.x, y: o.y, v: o.speed });
      for (const sh of s.ships.values()) {
        if (!o || Math.hypot(sh.cur.x - o.x, sh.cur.y - o.y) > 1200) continue;
        if (!others.has(sh.id)) others.set(sh.id, []);
        others.get(sh.id).push({ t, x: sh.cur.x, y: sh.cur.y });
      }
      // a turn of the wheel every 4 s for a second
      const k = Math.floor((t - t0) / 1000);
      s.input.rudder = k % 4 === 0 ? 0.6 : 0;
      if (t - t0 < secs * 1000) requestAnimationFrame(f); else done();
    };
    requestAnimationFrame(f);
  });
  s.input.rudder = 0;
  const zoom = R.zoom;
  /** A track's frame errors: each step against the mean of its neighbours' way (a ship's way changes slowly). */
  const judge = (tr) => {
    const errs = [], back = []; let jumps = 0;
    for (let i = 2; i < tr.length - 2; i++) {
      const dt = (tr[i].t - tr[i - 1].t) / 1000;
      if (dt <= 0) continue;
      // her way over the four frames round it
      const span = (tr[i + 2].t - tr[i - 2].t) / 1000;
      const vx = (tr[i + 2].x - tr[i - 2].x) / span, vy = (tr[i + 2].y - tr[i - 2].y) / span;
      const ex = vx * dt, ey = vy * dt;
      const dx = tr[i].x - tr[i - 1].x, dy = tr[i].y - tr[i - 1].y;
      const err = Math.hypot(dx - ex, dy - ey);
      const exp = Math.hypot(ex, ey);
      errs.push(err);
      if (exp > 0.05 && dx * ex + dy * ey < 0) back.push(i);
      if (err * zoom > 1 && err > exp / 3) jumps++;
    }
    errs.sort((a, b) => a - b);
    const q = (p) => errs.length ? errs[Math.min(errs.length - 1, Math.floor(errs.length * p))] : 0;
    // Her way on the whole (m/s), and the worst change of a frame's step against the next (a stutter the eye catches).
    const way = tr.length > 1 ? Math.hypot(tr.at(-1).x - tr[0].x, tr.at(-1).y - tr[0].y) / ((tr.at(-1).t - tr[0].t) / 1000) : 0;
    const acc = [];
    for (let i = 1; i < tr.length - 1; i++) acc.push(Math.hypot(tr[i + 1].x - 2 * tr[i].x + tr[i - 1].x, tr[i + 1].y - 2 * tr[i].y + tr[i - 1].y) * zoom);
    acc.sort((a, b) => a - b);
    return { way: +way.toFixed(1), acc99px: +(acc[Math.floor(acc.length * 0.99)] ?? 0).toFixed(2), frames: tr.length, p50m: +q(0.5).toFixed(3), p95m: +q(0.95).toFixed(3), p95px: +(q(0.95) * zoom).toFixed(2), maxpx: +((errs.at(-1) ?? 0) * zoom).toFixed(1), back: back.length, jumps, jumpPct: +(100 * jumps / Math.max(1, errs.length)).toFixed(1) };
  };
  const d = frames.slice(1).map((x, i) => x - frames[i]).sort((a, b) => a - b);
  const othersJ = [...others.values()].filter((tr) => tr.length > 30).map(judge);
  const sum = (k) => othersJ.reduce((a, x) => a + x[k], 0);
  return {
    fps: +((frames.length - 1) / ((frames.at(-1) - frames[0]) / 1000)).toFixed(1), frameP50: +d[Math.floor(d.length / 2)].toFixed(1), zoom: +zoom.toFixed(2),
    own: judge(own),
    others: { ships: othersJ.length, way: othersJ.map((x) => x.way), acc99px: othersJ.length ? Math.max(...othersJ.map((x) => x.acc99px)) : 0, p95px: othersJ.length ? Math.max(...othersJ.map((x) => x.p95px)) : 0, maxpx: othersJ.length ? Math.max(...othersJ.map((x) => x.maxpx)) : 0, back: sum('back'), jumps: sum('jumps'), frames: sum('frames'), jumpPct: +(100 * sum('jumps') / Math.max(1, sum('frames'))).toFixed(1) },
  };
}, SECS);
L.log(`HZ ${HZ} jitter ${JIT} hitch ${HITCH}`, JSON.stringify(r));
const tag = process.env.TAG ?? 'now';
writeFileSync(`${OUT}/smooth_${tag}_${HZ}hz${JIT ? '_jit' : ''}${HITCH ? '_hitch' : ''}.json`, JSON.stringify({ at: new Date().toISOString(), HZ, JIT, HITCH, ...r }, null, 1));
await b.close();
