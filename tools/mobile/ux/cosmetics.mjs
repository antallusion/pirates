// The cosmetics in the browser (docs/32 §12): two captains at sea, each wearing a title on a plate, a frame, a flag
// and a trail; each sees the other's; an emote over a ship; the shop's «Косметика» tab and the wardrobe — at a phone
// on its side (RU and EN), in Telegram (the Stars first) and on a desk. Then the frame rate with 30 ships on screen,
// every one with a plate, a flag and a trail, against the same 30 with none.
//   GPORT=58640 OUT=assets/raw/audit/cosmetics node tools/mobile/ux/cosmetics.mjs
//   STEP=shots|perf  — one half only
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const port = Number(process.env.GPORT ?? 58640);
const OUT = process.env.OUT ?? 'assets/raw/audit/cosmetics';
const STEP = process.env.STEP ?? 'all';
mkdirSync(OUT, { recursive: true });
/** The pictures on the page in (every <img> loaded, every plate drawn), or 8 s. */
async function settle(p) {
  await L.sleep(600);
  for (let i = 0; i < 16; i++) {
    const left = await p.evaluate(() => [...document.querySelectorAll('#modal img')].filter((x) => !x.complete).length + document.querySelectorAll('#modal canvas.cos-plate:not([data-drawn])').length);
    if (!left) break;
    await L.sleep(500);
  }
  await L.sleep(400);
}

/** Every window and offer put away (frames.mjs's shut): the offers' carousel later, the daily gift later. */
async function clean(p) {
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => {
      globalThis.gravetide.open(null);
      document.querySelector('#promo-over [data-polater]')?.click();
      document.querySelector('[data-gflater]')?.click();
      for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
    });
    await L.sleep(250);
  }
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000 }).catch(() => L.log('(no screenshot: ' + name + ')'));

const WEAR_A = [['title', 'devil'], ['plate', 'gold'], ['frame', 'kraken'], ['emblem', 'raven'], ['cloth', 'crimson'], ['trail', 'fire']];
const WEAR_B = [['title', 'saltmarrow'], ['plate', 'abyss'], ['frame', 'abyss'], ['emblem', 'kraken'], ['cloth', 'teal'], ['trail', 'plankton']];

async function dress(p, wear) {
  await L.say(p, '/cos all');
  for (const [k, v] of wear) {
    await L.say(p, `/cos wear ${k} ${v}`);
    await L.sleep(150);
  }
}

async function tgInit(p) {
  await p.ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('tg-app');
    document.documentElement.style.setProperty('--sa-t', '0px');
  }));
}

const b = await L.browser();
const report = { shots: [], perf: null, errors: [] };
try {
  if (STEP === 'all' || STEP === 'shots') {
    for (const [lang, size, tg] of [['ru', [844, 390], false], ['en', [844, 390], false], ['ru', [844, 390], true], ['ru', [1440, 900], false]]) {
      const tag = `${size[0]}x${size[1]}_${lang}${tg ? '_tg' : ''}`;
      if (process.env.CFG && !process.env.CFG.split(',').includes(tag)) continue;
      L.log('—', tag);
      const a = await L.page(b, size, { lang });
      if (tg) await tgInit(a);
      const nameA = (lang === 'ru' ? 'Анна Вей ' : 'Anne Vey ') + Math.random().toString(36).slice(2, 4);
      await L.login(a, { port, know: true, name: nameA });
      await clean(a);
      await L.say(a, '/doubloons 2000');
      await L.say(a, '/time 13');
      // the shop's tab as a buyer sees it (only the free things hers): every shelf, its prices
      for (const sec of ['cos_titles', 'cos_frames', 'cos_flags', 'cos_trails', 'cos_emotes', 'cos_sets']) {
        await a.evaluate((s) => globalThis.gravetide.cos.shop(s), sec);
        await settle(a);
        await shot(a, `${tag}_shop_${sec}`);
      }
      await clean(a);
      await dress(a, WEAR_A);
      // the second captain (a context of her own in the same browser)
      const bp = await L.page(b, [800, 450], { lang });
      await L.login(bp, { port, know: true, name: 'Bonny ' + Math.random().toString(36).slice(2, 4) });
      await clean(bp);
      await dress(bp, WEAR_B);
      // both to sea, side by side, sailing
      for (const p of [a, bp]) {
        await L.send(p, { t: 'undock' });
        await L.sleep(1500);
        await clean(p);
      }
      await L.say(a, '/tp 21000 70000');
      await L.sleep(2500);
      await clean(a);
      const at = await L.me(a);
      await L.say(bp, `/tp ${Math.round(at.x + 60)} ${Math.round(at.y + 45)}`);
      await L.sleep(2500);
      await clean(bp);
      await L.sailTo(a, at.x + 2600, at.y - 400);
      await L.sailTo(bp, at.x + 2660, at.y - 355);
      await L.sleep(6000);
      await clean(a);
      // what A's client knows of B's ship: her card's cosmetics
      const seen = await a.evaluate(() => [...globalThis.gravetide.state.ships.values()].filter((s) => s.info?.isPlayer).map((s) => ({ name: s.info.captainName, cos: s.info.cos ?? null })));
      L.log('A sees', JSON.stringify(seen));
      // an emote from B over her ship, seen by A
      await L.send(bp, { t: 'cos', action: 'emote', id: 'parrot' });
      await L.sleep(700);
      await shot(a, `${tag}_sea_seen`);
      // closer: the flags at the mastheads, the trails, the plates (the camera on the two of them)
      const z0 = await a.evaluate(() => { const r = globalThis.gravetide.renderer; const z = r.targetZoom; r.userZoomed = true; r.targetZoom = 3.2; return z; });
      await L.send(bp, { t: 'cos', action: 'emote', id: 'kraken' });
      await L.sleep(1600);
      await shot(a, `${tag}_sea_close`);
      await a.evaluate((z) => { const r = globalThis.gravetide.renderer; r.targetZoom = z; r.userZoomed = false; }, z0);
      const plates = await a.evaluate(() => globalThis.gravetide.renderer.platesDrawn);
      report.shots.push({ tag, seen, plates });
      // A's own emote and the quick button's panel
      await a.evaluate(() => document.getElementById('cos-qbtn')?.click());
      await L.sleep(500);
      await shot(a, `${tag}_quick_emotes`);
      await a.evaluate(() => document.querySelector('#cos-qpanel [data-cosemote="hook"]')?.click());
      await L.sleep(600);
      await shot(a, `${tag}_own_emote`);
      // the chat: the frame round B's face and her emote line
      await L.say(bp, 'ahoy!');
      await L.sleep(400);
      await a.evaluate(() => { if (!document.body.classList.contains('chat-open')) document.getElementById('chat-toggle')?.click(); document.querySelector('#chat-tabs [data-ct="local"]')?.click(); });
      await L.sleep(700);
      await shot(a, `${tag}_chat`);
      await clean(a);
      await a.evaluate(() => { if (document.body.classList.contains('chat-open')) document.getElementById('chat-toggle')?.click(); });
      await a.evaluate(() => globalThis.gravetide.cos.wardrobe());
      await settle(a);
      await shot(a, `${tag}_wardrobe`);
      await a.evaluate(() => document.querySelector('[data-cosslot="frame"]')?.click());
      await L.sleep(600);
      await shot(a, `${tag}_wardrobe_frames`);
      await clean(a);
      // the captain's screen's way into the wardrobe
      await a.evaluate(() => globalThis.gravetide.hero());
      await L.sleep(900);
      await shot(a, `${tag}_captain_wardrobe_chip`);
      await clean(a);
      // the HUD's framed portrait
      await shot(a, `${tag}_hud_frame`);
      const latin = lang === 'ru' ? await L.latin(a, '#modal, #hud-chat') : [];
      report.errors.push(...a.errors.map((e) => `${tag} A: ${e}`), ...bp.errors.map((e) => `${tag} B: ${e}`));
      if (latin.length) L.log('latin', JSON.stringify(latin.slice(0, 10)));
      await bp.ctx.close();
      await a.ctx.close();
    }
  }
  if (STEP === 'all' || STEP === 'perf') report.perf = await perf();
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
L.log('errors', report.errors.length, JSON.stringify(report.errors.slice(0, 6)));

/** 30 ships on a phone's screen, sailing: each wears a plate, a flag and a trail, against the same 30 wearing nothing;
 *  the frame rate and the cosmetics' own milliseconds a frame (the trails' step and draw, the names with their plates,
 *  the hulls with their flags). The 30 are the page's own (client-side ships laid out on the screen and moved each
 *  frame), so the scene is the same in both runs. */
async function perf() {
  const p = await L.page(b, [844, 390], { lang: 'ru' });
  await L.login(p, { port, know: true, name: 'Perf ' + Math.random().toString(36).slice(2, 4) });
  await clean(p);
  await L.say(p, '/god');
  await L.say(p, '/time 13');
  await L.send(p, { t: 'undock' });
  await L.sleep(1500);
  await L.say(p, '/tp 21000 70000');
  await L.sleep(2500);
  await clean(p);
  await p.evaluate(() => {
    const g = globalThis.gravetide;
    const st = g.state, r = g.renderer;
    const o = st.ownDisplay;
    const codes = ['f.4.6.6.0.3', '3.2.2.2.4.4', 'g.6.4.5.7.0', '2.1.8.e.9.5', '9.7.5.b.3.2', 'b.3.1.8.6.1'];
    const cls = ['brig', 'sloop', 'schooner'];
    const z = r.zoom, W = r.w / z, H = r.h / z;
    const fakes = [];
    for (let k = 0; k < 30; k++) {
      const col = k % 6, row = Math.floor(k / 6);
      const x = o.x - W * 0.42 + (col + 0.5) * (W * 0.84 / 6), y = o.y - H * 0.38 + (row + 0.5) * (H * 0.76 / 5);
      const s = { id: 900000 + k, info: { id: 900000 + k, kind: 'ship', name: 'Q' + k, classId: cls[k % 3], faction: 'player', captainName: 'Cap' + k, isPlayer: true, level: 5, shipLevel: 3 },
        buf: [], cur: { t: 0, x, y, h: Math.PI / 2 + (k % 2 ? 0.3 : -0.3), spd: 7, sail: 2, hull: 1, sails: 1, flags: 0, crew: 1 }, wake: [], sinkStart: 0, __code: codes[k % codes.length], __dx: x - o.x, __dy: y - o.y, __run: 0 };
      st.ships.set(s.id, s);
      fakes.push(s);
    }
    globalThis.__fakes = fakes;
    let last = performance.now();
    const drive = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      // (each keeps her place on the screen round the captain's own ship, which sails on, and runs to and fro on it)
      const me = st.ownDisplay;
      for (const s of fakes) {
        s.__run = (s.__run + 9 * dt) % 120;
        const run = s.__run - 60;
        s.cur = { ...s.cur, x: me.x + s.__dx + Math.sin(s.cur.h) * run, y: me.y + s.__dy - Math.cos(s.cur.h) * run };
      }
      if (globalThis.__fakes) requestAnimationFrame(drive);
    };
    requestAnimationFrame(drive);
  });
  const measure = (on) => p.evaluate((on) => new Promise((done) => {
    const g = globalThis.gravetide;
    const r = g.renderer;
    for (const s of globalThis.__fakes) s.info = { ...s.info, cos: on ? s.__code : undefined };
    const ms = { trail: 0, label: 0, ship: 0 };
    let frames = 0;
    const wrap = (name, key) => { const f = r[name]; r[name] = function (...a) { const t = performance.now(); const v = f.apply(this, a); ms[key] += performance.now() - t; return v; }; return () => (r[name] = f); };
    const undo = [wrap('stepTrails', 'trail'), wrap('drawLabel', 'label'), wrap('drawShip', 'ship')];
    const ts = [];
    const t0 = performance.now();
    let plates = 0, motes = 0;
    const f = (t) => {
      ts.push(t);
      frames++;
      plates = Math.max(plates, r.platesDrawn);
      motes = Math.max(motes, r.trails.live);
      if (t - t0 < 6000) requestAnimationFrame(f);
      else {
        undo.forEach((u) => u());
        const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
        const per = (x) => +(x / frames).toFixed(2);
        done({ fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), msTrails: per(ms.trail), msNames: per(ms.label), msHulls: per(ms.ship), plates, motes });
      }
    };
    requestAnimationFrame(f);
  }), on);
  const rows = [];
  for (const cpu of [1, 4]) {
    const cdp = await p.ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    for (const on of [false, true, false, true]) {
      await L.sleep(1500);
      const r = await measure(on);
      rows.push({ cpu, on, ...r });
      L.log(`cpu ${cpu}× cosmetics ${on ? 'on ' : 'off'}`, JSON.stringify(r));
      if (on && cpu === 1) await shot(p, 'perf_30_ships');
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
  await p.evaluate(() => { globalThis.__fakes = null; });
  await p.ctx.close();
  return rows;
}
