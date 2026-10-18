// The helmsman's runs at random (owner, 2026-10-18: «часто врезаешься в острова когда путь проложен»): N runs from open
// water to a mark anywhere within a few kilometres — open sea, an island's middle (a mark on land), a port, the far
// side of an island, a mark among the reefs — in five hulls, the real currents, a steady wind each. Counted per run:
// a touch of her hull on a coast or a solid thing (strike.ts), a blow, her keel over a reef, and how it ended.
// Deterministic (its own generator; the sea's dice untouched by the picking).
//
//   node --disable-warning=ExperimentalWarning tools/nav/autosail-sim.ts [--n 200] [--seed 7] [-v]

import { WORLD_SIZE } from '../../shared/src/constants.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { headingOf, headingVec } from '../../shared/src/math.ts';
import { isLand, reefDepthAt, regionAt } from '../../shared/src/world/worldgen.ts';
import { autosailOf, pausedCourse } from '../../server/src/game/autosail.ts';
import { touches } from '../../server/src/game/strike.ts';
import { makeGame } from '../../tests/helpers.ts';
import type { FakeConn } from '../../tests/helpers.ts';
import type { PlayerSession } from '../../server/src/game/player.ts';
import { openAt, quietAround, retire, sceneWind, seaCaptainAt } from './harness.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', '200'));
const V = process.argv.includes('-v');
/** The live sea: its own ships about (protected: they make her helmsman break off, never sink her), its own weather and
 *  winds; a course broken off by them is taken up again by the helmsman (autosail.ts stepResume), and her hull's touches
 *  are counted all the while — the drift after a break as well. */
const LIVE = process.argv.includes('--live');
let seed = Number(arg('seed', '7')) >>> 0;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const { game } = makeGame();
const world = game.world;
const HULLS: ShipClassId[] = ['sloop', 'brig', 'frigate', 'galleon', 'man_o_war'];
type Kind = 'open' | 'island' | 'port' | 'behind' | 'reef' | 'shore';
const KINDS: Kind[] = ['open', 'island', 'port', 'behind', 'reef', 'shore'];
/** How near she is to come (a tap on a thing ashore: its reach, the client's `near`). */
const NEAR: Partial<Record<Kind, number>> = { island: 60, shore: 40 };
/** After the helmsman gives the wheel back, her hand stays off it this long (a phone's captain looks up late). */
const TAIL = 25;

function startAt(): { x: number; y: number } {
  for (;;) {
    const x = 3000 + rnd() * (WORLD_SIZE - 6000), y = 3000 + rnd() * (WORLD_SIZE - 6000);
    if (openAt(world, x, y, 90) && regionAt(world, x, y) !== 'the_abyss') return { x, y };
  }
}

function markFor(kind: Kind, f: { x: number; y: number }): { x: number; y: number } | null {
  const within = (x: number, y: number) => { const d = Math.hypot(x - f.x, y - f.y); return d > 1200 && d < 6000 && regionAt(world, x, y) !== 'the_abyss'; };
  const pick = <T>(xs: T[]): T | null => (xs.length ? xs[Math.floor(rnd() * xs.length)] : null);
  if (kind === 'open') {
    const a = rnd() * Math.PI * 2, d = 1500 + rnd() * 4000;
    const x = f.x + Math.sin(a) * d, y = f.y - Math.cos(a) * d;
    return x > 2500 && y > 2500 && x < WORLD_SIZE - 2500 && y < WORLD_SIZE - 2500 && regionAt(world, x, y) !== 'the_abyss' ? { x, y } : null;
  }
  if (kind === 'island') {
    const is = pick(world.islands.filter((i) => !i.slot && !i.hidden && i.poly.length > 0 && within(i.x, i.y)));
    return is ? { x: is.x, y: is.y } : null;
  }
  if (kind === 'port') {
    const p = pick(world.ports.filter((q) => within(q.x, q.y)));
    return p ? { x: p.x, y: p.y } : null;
  }
  if (kind === 'behind') {
    const is = pick(world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && i.poly.length > 0 && i.radius >= 150 && within(i.x, i.y)));
    if (!is) return null;
    const ux = (is.x - f.x) / Math.hypot(is.x - f.x, is.y - f.y), uy = (is.y - f.y) / Math.hypot(is.x - f.x, is.y - f.y);
    const x = is.x + ux * (is.radius + 250 + rnd() * 300), y = is.y + uy * (is.radius + 250 + rnd() * 300);
    return { x, y };
  }
  if (kind === 'shore') {
    // a tap on an island's shore: a point of its coast, a little inland
    const is = pick(world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && i.poly.length >= 6 && within(i.x, i.y)));
    if (!is) return null;
    const j = Math.floor(rnd() * (is.poly.length / 2)) * 2;
    const x = is.poly[j], y = is.poly[j + 1], l = Math.hypot(is.x - x, is.y - y) || 1;
    return { x: x + ((is.x - x) / l) * 10, y: y + ((is.y - y) / l) * 10 };
  }
  const rf = pick(world.reefs.filter((r) => r.region !== 'the_abyss' && within(r.x, r.y)));
  return rf ? { x: rf.x + (rnd() - 0.5) * rf.radius, y: rf.y + (rnd() - 0.5) * rf.radius } : null;
}

interface Run { tail: number; tailBlows: number; breaks: number; k: number; kind: Kind; cls: ShipClassId; d: number; why: string; sec: number; touches: number; blows: number; reef: number; left: number; land: boolean }
const rs: Run[] = [];
let ms = 0, ticks = 0;
const tick = game.step.bind(game);
/** The captain's phone as it is: its helm resent every 250 ms — no rudder, the sail the request set (autosailRequest:
 *  the client's own sail is the helmsman's, 4 here) — swallowed while the helmsman has the wheel, hers after. */
let phone: FakeConn | null = null, phoneS: PlayerSession | null = null, seq = 0;
const step = () => {
  if (phone && ticks % 5 === 0) {
    // (four a second of the sea's clock, not of the machine's: the flood guard counts by the wall clock, and the sim's
    // second passes in a few milliseconds)
    if (phoneS) phoneS.msgCount = 0;
    phone.push({ t: 'input', seq: ++seq, rudder: 0, sail: 4 });
  }
  ticks++;
  tick();
};
for (let k = 0; rs.length < N; k++) {
  const kind = KINDS[k % KINDS.length];
  const f = startAt();
  const to = markFor(kind, f);
  if (!to) continue;
  const cls = HULLS[rs.length % HULLS.length];
  if (!LIVE) {
    quietAround(game, f.x, f.y);
    quietAround(game, to.x, to.y);
  }
  const calm = LIVE ? () => {} : sceneWind(game, `r${k}`);
  const { s, c, ship } = seaCaptainAt(game, cls, f.x, f.y, rnd() * Math.PI * 2);
  ship.state.speed = 0;
  phone = c;
  phoneS = s;
  if (LIVE) ship.protectedUntil = game.now + 1e6;
  let breaks = 0;
  const t0v = touches.get(ship) ?? { touch: 0, blow: 0 };
  const touch0 = t0v.touch, blow0 = t0v.blow;
  c.push({ t: 'autosail', x: Math.round(to.x), y: Math.round(to.y), sail: 4, ...(NEAR[kind] ? { near: NEAR[kind] } : {}) });
  const t0 = game.now;
  const d = Math.hypot(to.x - f.x, to.y - f.y);
  const maxSec = 120 + d / 5;
  let why = 'clock', reef = 0;
  const draft = ship.cls.draft;
  if (!autosailOf(ship)) why = `refused: ${(c.last('toast') as { msg?: string } | undefined)?.msg ?? ''}`;
  else {
    let quiet = game.now + 10;
    while (game.now - t0 < maxSec) {
      if (game.now > quiet && !LIVE) {
        quiet = game.now + 10;
        quietAround(game, ship.state.x, ship.state.y);
      }
      if (LIVE) ship.hull = ship.stats.hullMax;
      const a = performance.now();
      step();
      ms += performance.now() - a;
      if (ship.cls.passive.id !== 'shallow_runner' && ship.state.speed > 1) {
        const v = headingVec(ship.state.heading), half = ship.stats.length * 0.45;
        if (reefDepthAt(world, ship.state.x + v.x * half, ship.state.y + v.y * half) < draft) reef++;
      }
      if (!autosailOf(ship)) {
        why = (c.last('autosail') as { why?: string } | undefined)?.why ?? 'off';
        if (LIVE && pausedCourse(ship)) {
          // broken off by a fight or a storm: she runs on as she was until the helmsman takes her up again
          breaks++;
          while (!autosailOf(ship) && pausedCourse(ship) && game.now - t0 < maxSec) {
            ship.hull = ship.stats.hullMax;
            step();
          }
          if (autosailOf(ship)) continue;
          why = `${why}+dropped`;
        }
        break;
      }
    }
  }
  const tal = touches.get(ship) ?? { touch: 0, blow: 0 };
  const inTouch = tal.touch - touch0, inBlow = tal.blow - blow0;
  // the wheel hers, her hand off it a while: what the way she was left with does
  if (!autosailOf(ship)) {
    const t1 = game.now;
    while (game.now - t1 < TAIL && !autosailOf(ship)) {
      if (LIVE) ship.hull = ship.stats.hullMax;
      step();
    }
  }
  const tal2 = touches.get(ship) ?? { touch: 0, blow: 0 };
  const r: Run = { tail: tal2.touch - touch0 - inTouch, tailBlows: tal2.blow - blow0 - inBlow, breaks, k, kind, cls, d: Math.round(d), why, sec: Math.round(game.now - t0), touches: inTouch, blows: inBlow, reef, left: Math.round(Math.hypot(ship.state.x - to.x, ship.state.y - to.y)), land: !!isLand(world, to.x, to.y) };
  rs.push(r);
  if (V || r.touches || r.blows || r.reef || r.tail) console.log(JSON.stringify({ ...r, from: [Math.round(f.x), Math.round(f.y)], to: [Math.round(to.x), Math.round(to.y)] }));
  if (autosailOf(ship)) c.push({ t: 'autosail', stop: true });
  phone = null;
  phoneS = null;
  retire(game, s, c);
  game.dropSession(s); // (out of the sea: two hundred captains left lying about slowed every tick sixfold)
  calm();
  void headingOf;
}
const whys: Record<string, number> = {};
for (const r of rs) whys[r.why] = (whys[r.why] ?? 0) + 1;
const byKind: Record<string, string> = {};
for (const kd of KINDS) {
  const ks = rs.filter((r) => r.kind === kd);
  byKind[kd] = `${ks.length} runs, ${ks.filter((r) => r.why === 'arrived').length} arrived, ${ks.filter((r) => r.touches > 0).length} touched, ${ks.filter((r) => r.tail > 0).length} after, ${ks.filter((r) => r.blows > 0).length} blows, ${ks.filter((r) => r.reef > 0).length} reef`;
}
console.log(JSON.stringify({
  runs: rs.length,
  breaks: rs.reduce((a, r) => a + r.breaks, 0),
  grounded: rs.filter((r) => r.touches > 0 || r.blows > 0 || r.reef > 0 || r.tail > 0).length,
  groundedUnderHelmsman: rs.filter((r) => r.touches > 0 || r.blows > 0 || r.reef > 0).length,
  tailRuns: rs.filter((r) => r.tail > 0).length,
  tailBlows: rs.reduce((a, r) => a + r.tailBlows, 0),
  touchedRuns: rs.filter((r) => r.touches > 0).length,
  blowRuns: rs.filter((r) => r.blows > 0).length,
  reefRuns: rs.filter((r) => r.reef > 0).length,
  touches: rs.reduce((a, r) => a + r.touches, 0),
  blows: rs.reduce((a, r) => a + r.blows, 0),
  whys,
  byKind,
  msPerTick: Math.round((ms / Math.max(1, ticks)) * 1000) / 1000,
}, null, 1));
