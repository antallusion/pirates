// The piers as the keel strikes them, on the screen (2026-10-09): by three towns, at the owner's 1500×600 (mouse) and
// a phone's 812×375 (touch), a shot of the harbour as drawn, the same with the keel's boxes over it (each pier its own,
// gold; the old one box over the whole foot, dashed red), and a sloop lying in the water between two piers.
//
//   APORT=58851 OUT=assets/raw/nav/piers node tools/nav/piers-shot.mjs [port ids…]
import { mkdirSync } from 'node:fs';
import * as L from '../mobile/m0/lib.mjs';

const APORT = Number(process.env.APORT ?? 58851);
const OUT = process.env.OUT ?? 'assets/raw/nav/piers';
mkdirSync(OUT, { recursive: true });
const PORTS = process.argv.slice(2).length ? process.argv.slice(2) : ['rotgut_landing', 'frostgate', 'bellhaven'];

/** In the page: the harbour's layout, its pier boxes and the old box, and a slip's middle (between two piers). */
async function harbour(p, id) {
  return p.evaluate(async (pid) => {
    const S = await import('/shared/src/world/solids.ts');
    const Q = await import('/shared/src/data/quays.ts');
    const st = globalThis.gravetide.state;
    const port = st.ports.find((q) => q.id === pid);
    const is = [...st.islands.values()].find((i) => i.portId === pid);
    if (!port || !is) return null;
    const lay = S.portLayout(port, is);
    const art = S.quayArt(port);
    const boxes = S.quayBlockers(port, is).map((b) => ({ x: b.x, y: b.y, hw: b.hw, hh: b.hh, ca: b.ca, sa: b.sa, pad: b.pad }));
    const turn = (u, v) => [lay.x + u * Math.cos(lay.ang) - v * Math.sin(lay.ang), lay.y + u * Math.sin(lay.ang) + v * Math.cos(lay.ang)];
    const [ox, oy] = turn(0, lay.size * 0.355);
    const old = { x: ox, y: oy, hw: lay.size * 0.32, hh: lay.size * 0.115, ca: Math.cos(lay.ang), sa: Math.sin(lay.ang), pad: 3 };
    // The widest slip between two deep piers, her place in it: its middle, halfway down the shallower pier.
    let slip = null;
    const piers = (art ? Q.QUAY_PIERS[art] : []).filter((b) => b[2] > 0.12);
    for (let i = 0; i + 1 < piers.length; i++) {
      const gap = piers[i + 1][0] - piers[i][1];
      if (gap > 0.04 && (!slip || gap > slip.gap)) slip = { gap, u: ((piers[i][1] + piers[i + 1][0]) / 2 - 0.5) * lay.size, v: (Q.QUAY_LINE - 0.5) * lay.size + Math.min(piers[i][2], piers[i + 1][2]) * lay.size * 0.5, m: gap * lay.size };
    }
    const at = slip ? turn(slip.u, slip.v) : null;
    return { port: { id: port.id, x: port.x, y: port.y, faction: port.faction }, lay, art, boxes, old, slip: slip && { x: at[0], y: at[1], m: Math.round(slip.m), heading: lay.ang + Math.PI }, n: boxes.length };
  }, id);
}

/** Her canvas in, still in the water (the camera with her), at a zoom the piers read at; then put where asked. */
async function still(p, x, y, zoom) {
  await p.evaluate((z) => {
    const st = globalThis.gravetide.state;
    st.input.sail = 0;
    st.input.rudder = 0;
    const r = globalThis.gravetide.renderer;
    r.userZoomed = true;
    r.targetZoom = z;
  }, zoom);
  await L.sleep(400);
  await L.say(p, `/tp ${Math.round(x)} ${Math.round(y)}`);
  for (let i = 0; i < 20; i++) {
    await L.sleep(500);
    const v = await p.evaluate(() => globalThis.gravetide.state.ownDisplay?.speed ?? 0);
    if (i > 4 && v < 0.05) break;
  }
  await L.sleep(800);
}

/** In the page: the boxes drawn over the chart (the keel's: gold, with her pad; the old: dashed red). */
async function overlay(p, h, on) {
  await p.evaluate(([hb, show]) => {
    let cv = document.getElementById('nav-overlay');
    if (!show) {
      cv?.remove();
      return;
    }
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'nav-overlay';
      Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: 50 });
      document.body.appendChild(cv);
    }
    cv.width = innerWidth;
    cv.height = innerHeight;
    const r = globalThis.gravetide.renderer;
    const g = cv.getContext('2d');
    const box = (b, pad) => {
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => {
        const u = su * (b.hw + pad), v = sv * (b.hh + pad);
        return [r.sx(b.x + u * b.ca - v * b.sa), r.sy(b.y + u * b.sa + v * b.ca)];
      });
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    };
    g.setLineDash([8, 6]);
    g.strokeStyle = 'rgba(230,60,50,0.95)';
    g.lineWidth = 2;
    box(hb.old, 0);
    g.stroke();
    g.setLineDash([]);
    for (const b of hb.boxes) {
      box(b, 0);
      g.fillStyle = 'rgba(240,190,60,0.12)';
      g.fill();
      g.strokeStyle = 'rgba(250,210,80,1)';
      g.lineWidth = 1.5;
      g.stroke();
    }
  }, [h, on]);
}

const b = await L.browser();
const report = [];
for (const [tag, size] of [['1500x600', [1500, 600]], ['812x375', [812, 375]]]) {
  const p = await L.page(b, size, { touch: size[0] < 1000 });
  await L.login(p, { port: APORT, know: true });
  await L.say(p, '/ship sloop');
  await L.sleep(800);
  for (const id of PORTS) {
    // To the town first (so its chunk and its island are here), then her place.
    const pre = await p.evaluate((pid) => globalThis.gravetide.state.ports.find((q) => q.id === pid), id);
    if (!pre) {
      report.push({ tag, id, err: 'no such port' });
      continue;
    }
    await L.say(p, `/tp ${Math.round(pre.x)} ${Math.round(pre.y + 0)}`);
    await L.sleep(2500);
    const h = await harbour(p, id);
    if (!h) {
      report.push({ tag, id, err: 'no harbour' });
      continue;
    }
    // Her place: off the pier heads (the anchorage), the harbour in view.
    const zoom = size[0] < 1000 ? 1.6 : 2.2;
    await still(p, h.port.x, h.port.y, zoom);
    await L.closeAll(p, 2);
    await p.screenshot({ path: `${OUT}/${tag}_${id}_drawn.png` });
    await overlay(p, h, true);
    await p.screenshot({ path: `${OUT}/${tag}_${id}_keel.png` });
    await overlay(p, h, false);
    let inSlip = null;
    if (h.slip) {
      await still(p, h.slip.x, h.slip.y, zoom);
      const m = await L.me(p);
      inSlip = { want: [Math.round(h.slip.x), Math.round(h.slip.y)], at: [Math.round(m.x), Math.round(m.y)], off: Math.round(Math.hypot(m.x - h.slip.x, m.y - h.slip.y)), gap: h.slip.m };
      await p.screenshot({ path: `${OUT}/${tag}_${id}_slip.png` });
      await overlay(p, h, true);
      await p.screenshot({ path: `${OUT}/${tag}_${id}_slip_keel.png` });
      await overlay(p, h, false);
    }
    report.push({ tag, id, art: h.art, piers: h.n, size: Math.round(h.lay.size), inSlip });
  }
  report.push({ tag, errors: p.errors.slice(0, 5) });
  await p.ctx.close();
}
await b.close();
console.log(JSON.stringify(report, null, 1));
