// The owner, 2026-10-07, in the browser (a desk window of 1500×600 with a mouse): «акулы всякие они не должны убивать
// моих людей… я вот уже сражаюсь с акулой минуты 2». A captain of ⚓L on her level's hull, a beast of the sea put by
// her (the admin's /beast), and «Атаковать» on it as he gives it — the beast taken for the mark (a click on its frame),
// the bar's «Атаковать» clicked. Measured: the fight's length from the order and from her first broadside, her men
// and her hull before and after, the beast's hull over time, every refusal and every console error.
//
//   APORT=58871 OUT=assets/raw/beast/web node tools/mobile/beast.mjs --beast shark --level 1 [--blevel 2] [--size desk|phone]
//     [--class sloop] [--secs 150] [--tag x]
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from './m0/lib.mjs';
import { Phone, StepError, signIn } from './e2e/pages.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SIZE = arg('size', 'desk');
const [W, H] = SIZE === 'desk' ? [1500, 600] : [812, 375];
const TOUCH = SIZE !== 'desk';
const APORT = Number(process.env.APORT ?? 58871);
const OUT = process.env.OUT ?? 'assets/raw/beast/web';
const BEAST = arg('beast', 'shark');
const LEVEL = Number(arg('level', '1'));
const HULL = { 1: 'sloop', 2: 'sloop', 3: 'schooner', 4: 'brigantine', 5: 'brig', 6: 'brig', 7: 'frigate', 8: 'frigate' };
const CLS = arg('class', HULL[LEVEL] ?? 'frigate');
const BLEVEL = Number(arg('blevel', String(LEVEL)));
const SECS = Number(arg('secs', '150'));
const TAG = arg('tag', `${BEAST}${BLEVEL}_on${LEVEL}_${SIZE}`);
mkdirSync(OUT, { recursive: true });

async function instrument(p) {
  await p.evaluate(() => {
    const g = globalThis.gravetide;
    const W = (globalThis.__bt = { toasts: [], volleys: 0, t0: performance.now() });
    const now = () => Math.round(performance.now() - W.t0) / 1000;
    g.net.on((m) => {
      if (m.t === 'toast' || m.t === 'err') W.toasts.push({ t: now(), kind: m.kind ?? 'err', msg: m.msg });
      else if (m.t === 'ev') for (const e of m.list) if (e.k === 'volley' && e.ship === g.state.entityId && (e.side === 'port' || e.side === 'starboard')) { W.volleys++; W.first ??= now(); }
    });
  });
}

/** The beast nearest her: its id, distance, hull and whether it lies on the screen. */
const beast = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
  let best = null, bd = 1e9;
  for (const x of s.ships.values()) {
    if (!x.info || (x.info.npcRole ?? x.info.role) !== 'beast' || !x.cur || x.id === s.entityId) continue;
    const d = Math.hypot(x.cur.x - o.x, x.cur.y - o.y);
    if (d < bd) { bd = d; best = x; }
  }
  if (!best) return null;
  return { id: best.id, d: Math.round(bd), hull: best.cur.hull, flags: best.cur.flags, cls: best.info.classId };
});

const me = (p) => p.evaluate(() => { const s = globalThis.gravetide.state; return { crew: s.self?.crew ?? s.you?.crew, hull: s.you?.hull, hullMax: s.you?.hullMax, pursuit: s.pursuit ?? null }; });

async function run(ph) {
  const p = ph.p;
  await ph.admin('/silver 3000');
  for (let i = 0; i < 30; i++) {
    const s = await ph.state();
    if (!s.docked) break;
    if (!(await ph.tapIf('[data-dp="sail"]', '«Всё равно выйти»')) && !(await ph.tapIf('#modal-panel [data-ptab="sea"]', '«В море»')) && !(await ph.tapIf('#tc-fire.tc-sail', '«В море»'))) await L.send(p, { t: 'undock' });
    await L.sleep(1000);
  }
  await L.sleep(1500);
  await ph.skipFilm();
  await L.closeAll(p, 1);
  // Open water of the Black Coast (the sharks' and the beginners' sea), a spot of its own each run.
  const spot = process.env.SPOT ? process.env.SPOT.split(',').map(Number) : [15000 + Math.floor(Math.random() * 18) * 1000, 63000 + Math.floor(Math.random() * 14) * 1000];
  await ph.admin(`/tp ${spot[0]} ${spot[1]}`, 2500);
  await ph.skipFilm();
  await L.closeAll(p, 1);
  await ph.admin('/level 60', 800);
  await ph.admin(`/ship ${CLS} ${LEVEL}`, 1500);
  for (const x of ['/weather clear', '/heal', '/ammo', '/heading 90']) await ph.admin(x, 700);
  await instrument(p);
  const before = await me(p);
  await ph.admin(`/beast ${BEAST} ${BLEVEL} 1`, 1500);
  const b0 = await ph.until(() => beast(p), 10000, 'the beast');
  await ph.step('beast', { beast: b0, me: before });
  // Her mark: the beast (a click on its frame), then the bar's «Атаковать» with the mouse (the action button on a phone).
  await p.evaluate((id) => globalThis.gravetide.target(id), b0.id);
  await L.sleep(400);
  const tA = Date.now();
  const sel = TOUCH ? '#tc-act[data-act="attack"]' : '#hud-prompt .act-attack';
  await ph.tap(sel, '«Атаковать»', 8000);
  await p.evaluate(() => { const w = globalThis.__bt; w.tA = (performance.now() - w.t0) / 1000; });
  await ph.step('attack');
  const samples = [];
  let end = null, why = 'time';
  for (;;) {
    const t = (Date.now() - tA) / 1000;
    const b = await beast(p);
    const m = await me(p);
    samples.push(`${t.toFixed(1)}:${b ? b.d : '-'}m/${b ? Math.round(b.hull * 100) : '-'}%`);
    if (!b || b.id !== b0.id || b.flags & 1) { why = 'dead'; end = t; break; }
    if (!m.pursuit) { why = 'chase over'; end = t; break; }
    if (t > SECS) break;
    if (samples.length % 30 === 1) await ph.shot(`t${Math.round(t)}`);
    await L.sleep(500);
  }
  await L.sleep(1500);
  const after = await me(p);
  await ph.step('end', { why, end, after });
  const B = await p.evaluate(() => globalThis.__bt);
  return {
    beast: BEAST, blevel: BLEVEL, level: LEVEL, cls: CLS, size: SIZE, why, end, firstVolley: B.first ?? null, fight: B.first != null && end != null ? +(end - (B.first - B.tA)).toFixed(1) : null, firstAfter: B.first != null ? +(B.first - B.tA).toFixed(1) : null,
    volleys: B.volleys, menLost: (before.crew ?? 0) - (after.crew ?? 0), hullLost: before.hullMax ? +(((before.hull - after.hull) / before.hullMax) * 100).toFixed(1) : null,
    refusals: B.toasts.filter((x) => x.kind === 'bad' || x.kind === 'err'), toasts: B.toasts.slice(-30), errors: p.errors, samples: samples.join(' '),
  };
}

const b = await L.browser();
const pg = await L.page(b, [W, H], { touch: TOUCH, lang: 'ru' });
const ph = new Phone(pg, { out: OUT, tag: TAG, port: APORT, touch: TOUCH });
let res;
try {
  await signIn(ph, { name: `BT${Math.random().toString(36).slice(2, 6)}`, know: true });
  res = await run(ph);
} catch (e) {
  res = { error: e instanceof StepError ? e.message : String(e?.stack ?? e).slice(0, 800) };
  await ph.shot('error');
}
res.steps = ph.steps;
writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 1));
const brief = { ...res };
delete brief.steps; delete brief.toasts;
console.log(JSON.stringify(brief, null, 1).slice(0, 3000));
await b.close();
