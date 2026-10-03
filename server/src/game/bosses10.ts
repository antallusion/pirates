// The six new world bosses at sea (owner, 2026-10-03: «еще больше всяких там боссов»; docs/02 §11.A.4, the second
// table; shared/src/data/bosses.ts says who and where). They rise, are announced, fought and paid for as the old ones
// are — bosses.ts keeps the calendar, the contribution, the spoils and the panel, and hands each of these its rising,
// its every tick, its every second, the hits on it, its parts going under, its zones and its hint here. Each is one
// lesson a fleet learns:
//
//   Old Moorings (the Black Coast, the sea's first boss): buried, nothing touches it; it marks the slowest ship and
//     rears up under her three seconds later — keep way on. A strike that finds empty water leaves it sprawled on the
//     surface, a third and more open to shot; wounded, what it strikes it coils round, until the others hurt it enough.
//   The Tithe-Taker (Gravewater): hunts the fullest hold, takes its tithe of it and heals on it — empty holds are left
//     alone, one laden ship is bait; at half its strength it disgorges a century of tithes for anyone to fish up.
//   The Fog Changeling (the Whispering Archipelago): four shapes circle the fleet and only one casts a wake — seen
//     from close in, or found by a harpoon; a false shape shot bursts into ink. Wounded, its colours seize the helm of
//     any ship that points her bow at it: keep it on the beam.
//   The Cinder Ray (the Ashen Isles): guns fired inside its ash light their own powder; it glides down on a ship (her
//     shadow marked three seconds ahead) and lies grounded after — fire then. Wounded, the ash hangs about it always
//     but while it lies grounded, and the water burns where it comes down.
//   The Drowned Prelate (the Drowned Crown, by night): three bell spires toll about it and shot glances off it while
//     they do; a ship that holds beside a spire for eight seconds silences its bell, and a silent spire is a
//     sanctuary from the sermon that breaks every crew in reach. At the last rite the bells ring again.
//   The Rime Twins (Leviathan Reach): two narwhals that charge in turn (together, wounded); the one that falls while
//     its twin stands above a fifth is sung back from the sea twenty seconds later — bring both down together.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { clamp, dist, headingVec, wrapAngle } from '../../../shared/src/math.ts';
import type { BossView, BossZone } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { credit, end, every, fighters, head, hurt, nearest, place, sayTo, setPhase, spawnPart, submerge, swim, wander } from './bosses.ts';
import type { Fight, Part } from './bosses.ts';
import { igniteShip } from './combat.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** What one of the six keeps of its fight beyond the old bosses' fields. */
export interface TenState {
  /** Old Moorings: the strike coming up under a ship; up on the surface until; sprawled (a miss); the ship it holds. */
  strike: { x: number; y: number; at: number; target: number } | null;
  up: number;
  sprawl: boolean;
  hold: { ship: number; since: number; hull0: number } | null;
  /** The Tithe-Taker: its prey, and the tithes in its gut. */
  prey: number;
  gut: Cargo;
  /** The Fog Changeling: each false shape and when it forms again (0: up). */
  phantoms: Map<number, number>;
  /** The Cinder Ray: its ash, its glide coming down, grounded until, the burning water; each ship's guns last seen. */
  ash: { x: number; y: number; r: number; until: number } | null;
  glide: { x: number; y: number; at: number } | null;
  grounded: number;
  burns: { x: number; y: number; until: number }[];
  guns: Map<number, [number, number]>;
  /** The Drowned Prelate: each spire's bell (tolling or silent) and how long a ship has held beside it; the sermon. */
  spires: Map<number, { n: number; lit: boolean; hold: number }>;
  sermon: number;
  /** The Rime Twins: the charges under way, the fallen and when each rises, whose charge is next. */
  charges: { by: number; dir: number; at: number; until: number; hit: Set<number> }[];
  fallen: Map<number, number>;
  turn: number;
}

const TEN = new Set(['old_moorings', 'old_tithe', 'fog_changeling', 'cinder_ray', 'drowned_prelate', 'rime_twins']);
const tenOf = (f: Fight): TenState | null => (TEN.has(f.kind) ? f.ten ?? null : null);

/** Old Moorings: the strike's reach about its mark, the warning, the time sprawled after a miss and up after a hit. */
const MOOR_STRIKE_R = 45;
const MOOR_WARN = 3;
/** The Prelate: a spire's reach, the seconds to silence it, a silent spire's sanctuary, the sermon's reach. */
const SPIRE_R = 90;
const SPIRE_HOLD = 8;
const SANCTUARY_R = 130;
const SERMON_R = 1100;
/** The Rime Twins: the speed of a charge (metres a second). */
const TWIN_CHARGE = 45;

function surface(s: ShipEntity): void {
  s.effects = s.effects.filter((e) => e.id !== 'submerged');
}

function rate(f: Fight, key: string, now: number, period: number): boolean {
  return every(f, key, now, period);
}

/** The middle of the fleet in the fight (or the boss's anchor). */
function centre(game: Game, f: Fight, r = 2500): { x: number; y: number } {
  const ships = fighters(game, f, r);
  if (!ships.length) return f.anchor;
  let x = 0, y = 0;
  for (const s of ships) {
    x += s.state.x;
    y += s.state.y;
  }
  return { x: x / ships.length, y: y / ships.length };
}

/** Its trade cargo's worth (the crew's provisions are not cargo). */
function laden(s: ShipEntity): number {
  let v = 0;
  for (const g in s.cargo) if (GOODS[g as GoodId].category !== 'supply') v += (s.cargo[g as GoodId] ?? 0) * GOODS[g as GoodId].basePrice;
  return v;
}

// ================================================================================================ rising

export function riseTen(game: Game, f: Fight, body: ShipEntity): void {
  if (!TEN.has(f.kind)) return;
  const st: TenState = {
    strike: null, up: 0, sprawl: false, hold: null, prey: 0, gut: {}, phantoms: new Map(), ash: null, glide: null, grounded: 0, burns: [], guns: new Map(),
    spires: new Map(), sermon: 0, charges: [], fallen: new Map(), turn: 0,
  };
  f.ten = st;
  const { x, y } = f.anchor;
  switch (f.kind) {
    case 'old_moorings':
      submerge(game, body, 1e7); // in the silt until something lies still
      break;
    case 'fog_changeling':
      for (let i = 0; i < 3; i++) {
        const a = ((i + 1) / 4) * Math.PI * 2;
        const p = spawnPart(game, f, 'fog_changeling', x + Math.sin(a) * 300, y - Math.cos(a) * 300, a, f.def.name, 'phantom');
        f.pool -= p.stats.hullMax; // a false shape is no part of the reckoning
        st.phantoms.set(p.id, 0);
      }
      break;
    case 'drowned_prelate': {
      // Three spires a third of a circle apart about it, turned a little each try until each stands in open water.
      let n = 0;
      for (let k = 0; k < 36 && n < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 + Math.floor(k / 3) * 0.35;
        const sx = x + Math.sin(a) * 520, sy = y - Math.cos(a) * 520;
        if (isLand(game.world, sx, sy)) continue;
        if ([...st.spires.keys()].some((id) => {
          const o = game.ships.get(id);
          return !!o && dist(o.state.x, o.state.y, sx, sy) < 500;
        })) continue;
        const sp = spawnPart(game, f, 'bell_spire', sx, sy, 0, `Bell Spire ${++n}`, 'spire');
        f.pool -= sp.stats.hullMax;
        st.spires.set(sp.id, { n, lit: true, hold: 0 });
      }
      break;
    }
    case 'rime_twins': {
      const a = body.state.heading + Math.PI / 2;
      spawnPart(game, f, 'rime_narwhal', x + Math.sin(a) * 160, y - Math.cos(a) * 160, body.state.heading, 'The Other Twin', 'twin');
      break;
    }
  }
}

// ================================================================================================ every tick

export function tenTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const st = tenOf(f);
  if (!st) return;
  const now = game.now;
  switch (f.kind) {
    case 'old_moorings': {
      const held = st.hold ? game.ships.get(st.hold.ship) : null;
      if (held && held.alive) {
        // Coiled round her: it lies along her side, and she does not move.
        const v = headingVec(held.state.heading + Math.PI / 2);
        place(game, body, held.state.x + v.x * 20, held.state.y + v.y * 20, held.state.heading);
        held.state.speed = 0;
        body.state.speed = 0;
      } else if (st.strike) swim(game, body, st.strike.x, st.strike.y, 40, dt, 3);
      else if (now < st.up) body.state.speed = 0;
      else {
        const t = nearest(fighters(game, f), body.state.x, body.state.y);
        if (t) swim(game, body, t.state.x, t.state.y, 12, dt, 1);
        else wander(game, f, body, 5, dt);
      }
      return;
    }
    case 'old_tithe': {
      const prey = game.ships.get(st.prey);
      if (prey && prey.alive && !prey.docked) swim(game, body, prey.state.x, prey.state.y, f.phase === 1 ? 16 : 13, dt, 1.4);
      else wander(game, f, body, 8, dt);
      return;
    }
    case 'fog_changeling': {
      const c = centre(game, f);
      const shapes = [body, ...[...st.phantoms].filter(([, at]) => at === 0).map(([id]) => game.ships.get(id)).filter((p): p is ShipEntity => !!p && p.alive)];
      shapes.forEach((s, i) => {
        const a = now * 0.016 + (i / 4) * Math.PI * 2 + (s.id % 7) * 0.3;
        const r = 520 + Math.sin(now * 0.2 + i) * 60;
        swim(game, s, c.x + Math.sin(a) * r, c.y - Math.cos(a) * r, 11, dt, 1.2);
        // The false shapes look as hurt as the true one (no glass shows which is real).
        if (s !== body) s.hull = s.stats.hullMax * (body.hull / body.stats.hullMax);
      });
      // Wounded, the true one comes in to bite.
      if (f.phase === 1) {
        const t = nearest(fighters(game, f, 900), body.state.x, body.state.y);
        if (t) swim(game, body, t.state.x, t.state.y, 13, dt, 1.4);
      }
      return;
    }
    case 'cinder_ray': {
      if (now < st.grounded) {
        body.state.speed = 0;
        return;
      }
      if (st.glide) {
        swim(game, body, st.glide.x, st.glide.y, 45, dt, 4);
        return;
      }
      const c = centre(game, f);
      const a = now * 0.03 + f.id;
      swim(game, body, c.x + Math.sin(a) * 450, c.y - Math.cos(a) * 450, 13, dt, 1);
      if (f.phase === 1 && st.ash) {
        st.ash.x = body.state.x;
        st.ash.y = body.state.y;
      }
      return;
    }
    case 'drowned_prelate':
      wander(game, f, body, f.phase === 1 ? 3 : 2, dt);
      for (const id of st.spires.keys()) {
        const sp = game.ships.get(id);
        if (sp) sp.state.speed = 0;
      }
      return;
    case 'rime_twins': {
      const c = centre(game, f);
      const twins = twinsOf(game, f);
      twins.forEach((s, i) => {
        if (st.fallen.has(s.id)) {
          s.state.speed = 0;
          return;
        }
        const ch = st.charges.find((x) => x.by === s.id && now >= x.at && now < x.until);
        if (ch) {
          // The charge: straight on through the white water and out beyond it, at the speed of a thrown harpoon.
          s.state.heading = ch.dir;
          s.state.speed = TWIN_CHARGE;
          const v = headingVec(ch.dir);
          place(game, s, s.state.x + v.x * TWIN_CHARGE * dt, s.state.y + v.y * TWIN_CHARGE * dt);
          game.forShipsNear(s.state.x, s.state.y, s.stats.length / 2 + 30, (o) => {
            if (o.bossOf || !o.alive || o.docked || ch.hit.has(o.id)) return;
            if (dist(o.state.x, o.state.y, s.state.x, s.state.y) > s.stats.length * 0.45 + o.stats.length * 0.3) return;
            ch.hit.add(o.id);
            hurt(game, f, o, 0.08, { crew: 3, morale: 5 });
            o.leaks = Math.min(8, o.leaks + 1);
            game.emit({ k: 'fx', fx: 'ram', x: Math.round(o.state.x), y: Math.round(o.state.y) }, o.state.x, o.state.y);
            game.toastShip(o, 'A narwhal’s tusk goes through your planking!', 'bad');
          });
          return;
        }
        // Waiting to charge: turned on the mark. Else the hunt of two, opposite each other about the fleet.
        const next = st.charges.find((x) => x.by === s.id && now < x.at);
        if (next) {
          s.state.speed = 0;
          s.state.heading = wrapAngle(s.state.heading + clamp(wrapAngle(next.dir - s.state.heading), -2 * dt, 2 * dt));
          return;
        }
        const a = now * 0.04 + i * Math.PI;
        swim(game, s, c.x + Math.sin(a) * 320, c.y - Math.cos(a) * 320, 15, dt, 1.2);
      });
      return;
    }
  }
}

/** The two of the Rime Twins: the body first. */
function twinsOf(game: Game, f: Fight): ShipEntity[] {
  const out: ShipEntity[] = [];
  const body = game.ships.get(f.id);
  if (body?.alive) out.push(body);
  for (const [id, p] of f.parts) {
    if (p !== 'twin') continue;
    const t = game.ships.get(id);
    if (t?.alive) out.push(t);
  }
  return out;
}

// ================================================================================================ every second

export function tenSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const st = tenOf(f);
  if (!st) return;
  switch (f.kind) {
    case 'old_moorings': return mooringsSecond(game, f, st, body, ships, hp);
    case 'old_tithe': return titheSecond(game, f, st, body, ships, hp);
    case 'fog_changeling': return changelingSecond(game, f, st, body, ships, hp);
    case 'cinder_ray': return raySecond(game, f, st, body, ships, hp);
    case 'drowned_prelate': return prelateSecond(game, f, st, body, ships, hp);
    case 'rime_twins': return twinsSecond(game, f, st, body, ships);
  }
}

// -- Old Moorings: the slowest ship marked; up from the silt under her; sprawled after a miss; coiled round after a hit.
function mooringsSecond(game: Game, f: Fight, st: TenState, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.45) setPhase(game, f, 1);
  // What it holds: crushed by the second, let go when the others have hurt it enough or after fifteen seconds.
  if (st.hold) {
    const held = game.ships.get(st.hold.ship);
    if (!held || !held.alive || held.docked) return void letGo(game, f, st, body, null);
    hurt(game, f, held, 0.01);
    if (st.hold.hull0 - body.hull >= body.stats.hullMax * 0.04) {
      for (const s of fighters(game, f)) if (s !== held && s.inCombat(now)) credit(game, f, s, 'control', 8);
      return void letGo(game, f, st, body, 'Old Moorings lets go of her: the others have hurt it enough.');
    }
    if (now - st.hold.since >= 15) {
      hurt(game, f, held, 0.06, { crew: 4 });
      held.leaks = Math.min(8, held.leaks + 2);
      game.toastShip(held, 'Old Moorings crushes your hull before it lets go!', 'bad');
      return void letGo(game, f, st, body, null);
    }
    return;
  }
  // The strike comes up under the mark.
  if (st.strike && now >= st.strike.at) {
    const k = st.strike;
    st.strike = null;
    surface(body);
    place(game, body, k.x, k.y, game.rng.range(0, Math.PI * 2));
    const hit: ShipEntity[] = [];
    game.forShipsNear(k.x, k.y, MOOR_STRIKE_R + 40, (o) => {
      if (o.bossOf || !o.alive || o.docked) return;
      if (dist(o.state.x, o.state.y, k.x, k.y) > MOOR_STRIKE_R + o.stats.length * 0.3) return;
      hit.push(o);
      hurt(game, f, o, 0.07, { crew: 3, morale: 5 });
      o.leaks = Math.min(8, o.leaks + 1);
      game.emit({ k: 'fx', fx: 'ram', x: Math.round(o.state.x), y: Math.round(o.state.y) }, o.state.x, o.state.y);
    });
    game.emit({ k: 'fx', fx: 'boss_roar', x: Math.round(k.x), y: Math.round(k.y), r: 120 }, k.x, k.y);
    if (!hit.length) {
      st.sprawl = true;
      st.up = now + 8;
      sayTo(game, ships, 'Old Moorings strikes empty water and lies sprawled on the surface — pour it on!', 'good');
      return;
    }
    if (f.phase === 1) {
      const t = hit[0];
      st.hold = { ship: t.id, since: now, hull0: body.hull };
      st.up = now + 16;
      t.addEffect({ id: 'moored', until: now + 16, mods: { maxSpeed: -1, turnRate: -0.8 } }, now);
      game.toastShip(t, 'Old Moorings coils round your hull! The others must hurt it — a twenty-fifth of it — to make it let go, within 15 s.', 'bad');
      sayTo(game, ships.filter((s) => s !== t), `Old Moorings has ${t.name} in its coils — hurt it to make it let go!`, 'bad');
      return;
    }
    st.up = now + 5;
    return;
  }
  if (st.strike) return;
  // Up on the surface: until the time runs out, then down into the silt again.
  if (now < st.up) return;
  if (!body.hasEffect('submerged')) {
    submerge(game, body, 1e7);
    st.sprawl = false;
  }
  // The next strike: the slowest ship within reach.
  if (!rate(f, 'moor_strike', now, f.phase === 1 ? 7 : 9)) return;
  const near = ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 1500);
  if (!near.length) return;
  const t = near.reduce((a, b) => (b.state.speed < a.state.speed ? b : a));
  st.strike = { x: t.state.x, y: t.state.y, at: now + MOOR_WARN, target: t.id };
  game.emit({ k: 'fx', fx: 'white_water', x: Math.round(t.state.x), y: Math.round(t.state.y), r: MOOR_STRIKE_R }, t.state.x, t.state.y);
  game.toastShip(t, 'The silt boils under your keel — Old Moorings is coming up. Get way on!', 'bad');
}

function letGo(game: Game, f: Fight, st: TenState, body: ShipEntity, why: string | null): void {
  const s = st.hold ? game.ships.get(st.hold.ship) : null;
  st.hold = null;
  st.up = Math.min(st.up, game.now + 3);
  if (s) {
    s.effects = s.effects.filter((e) => e.id !== 'moored');
    s.recompute(game.now);
    if (why) game.toastShip(s, why, 'good');
  }
  void body;
  void f;
}

// -- The Tithe-Taker: the fullest hold hunted, its tithe taken and fed on; at half its strength, the tithes disgorged.
function titheSecond(game: Game, f: Fight, st: TenState, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  const near = ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 2500);
  const full = near.filter((s) => laden(s) > 0);
  const prey = full.length ? full.reduce((a, b) => (laden(b) > laden(a) ? b : a)) : nearest(near, body.state.x, body.state.y);
  st.prey = prey?.id ?? 0;
  if (hp <= 0.5 && f.phase === 0) {
    setPhase(game, f, 1);
    disgorge(game, f, st, body);
  }
  if (!prey) return;
  const h = head(body, 0.4);
  if (dist(prey.state.x, prey.state.y, h.x, h.y) > 45 + prey.stats.length * 0.35) return;
  if (!rate(f, 'tithe_bite', now, f.phase === 1 ? 5 : 8)) return;
  const worth = laden(prey);
  if (worth <= 0) {
    hurt(game, f, prey, 0.02, { crew: 1 });
    game.toastShip(prey, 'The Tithe-Taker noses at your empty hold and bites half-hearted.', 'info');
    return;
  }
  hurt(game, f, prey, 0.04, { crew: 2, morale: 3 });
  // The tithe: a tenth (at least one) of her two richest goods, into its gut; and it feeds on it.
  const goods = (Object.keys(prey.cargo) as GoodId[]).filter((g) => (prey.cargo[g] ?? 0) > 0 && GOODS[g].category !== 'supply')
    .sort((a, b) => (prey.cargo[b] ?? 0) * GOODS[b].basePrice - (prey.cargo[a] ?? 0) * GOODS[a].basePrice).slice(0, 2);
  const took: string[] = [];
  for (const g of goods) {
    const n = Math.max(1, Math.ceil((prey.cargo[g] ?? 0) * 0.1));
    prey.cargo[g] = (prey.cargo[g] ?? 0) - n;
    if ((prey.cargo[g] ?? 0) <= 0) delete prey.cargo[g];
    st.gut[g] = (st.gut[g] ?? 0) + n;
    took.push(`${n} ${GOODS[g].name.toLowerCase()}`);
  }
  prey.recompute(now);
  body.hull = Math.min(body.stats.hullMax, body.hull + body.stats.hullMax * 0.012 * goods.length);
  game.emit({ k: 'fx', fx: 'maw', x: Math.round(prey.state.x), y: Math.round(prey.state.y), r: 40 }, prey.state.x, prey.state.y);
  game.toastShip(prey, `The Tithe-Taker takes its tithe: ${took.join(', ')} from your hold. Empty holds do not tempt it.`, 'bad');
}

/** A century of tithes on the water for anyone to fish up, and what it took this fight besides. */
function disgorge(game: Game, f: Fight, st: TenState, body: ShipEntity): void {
  const old: GoodId[] = ['spices', 'cloth', 'rum', 'tobacco', 'sugar', 'pearls', 'weapons', 'medicine'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + game.rng.range(-0.3, 0.3), r = game.rng.range(60, 180);
    const x = body.state.x + Math.sin(a) * r, y = body.state.y - Math.cos(a) * r;
    const g = game.rng.pick(old);
    const cargo: Cargo = { [g]: g === 'pearls' ? game.rng.int(2, 5) : game.rng.int(4, 10) };
    if (i === 0) for (const [k, n] of Object.entries(st.gut) as [GoodId, number][]) cargo[k] = (cargo[k] ?? 0) + n;
    game.dropCrate(x, y, cargo);
  }
  st.gut = {};
  game.emit({ k: 'fx', fx: 'spit', x: Math.round(body.state.x), y: Math.round(body.state.y), r: 120 }, body.state.x, body.state.y);
  sayTo(game, fighters(game, f), 'The Tithe-Taker disgorges a century of tithes — the sea is strewn with cargo for anyone to fish up. It bites twice as often now.', 'good');
}

// -- The Fog Changeling: the false shapes burst, the true one bites; wounded, its colours seize a bow turned on it.
function changelingSecond(game: Game, f: Fight, st: TenState, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.5 && f.phase === 0) {
    setPhase(game, f, 1);
    // Every false shape gone for good: those up burst now, those still re-forming never form again.
    for (const id of st.phantoms.keys()) {
      if (st.phantoms.get(id) === 0) burst(game, f, st, id, null, Infinity);
      else {
        st.phantoms.set(id, Infinity);
        const p = game.ships.get(id);
        if (p) submerge(game, p, 1e7);
      }
    }
    sayTo(game, ships, 'The Fog Changeling’s false shapes fall away — its colours flare. Keep it on your beam: a bow turned on it is seized.', 'info');
  }
  // The false shapes form again where they burst, a while after.
  for (const [id, at] of st.phantoms) {
    if (at === 0 || at === Infinity || now < at) continue;
    const p = game.ships.get(id);
    if (!p) continue;
    surface(p);
    st.phantoms.set(id, 0);
  }
  // A harpoon in a false shape goes through fog; a false shape's bite does too.
  for (const s of ships) {
    if (s.tether && st.phantoms.get(s.tether.target) === 0) {
      burst(game, f, st, s.tether.target, s, 15);
      s.tether = null;
      game.toastShip(s, 'Your harpoon goes through fog: a false shape bursts into ink.', 'info');
    }
  }
  for (const [id, at] of st.phantoms) {
    if (at !== 0) continue;
    const p = game.ships.get(id);
    if (!p) continue;
    const h = head(p, 0.4);
    const t = nearest(ships, h.x, h.y);
    if (t && dist(t.state.x, t.state.y, h.x, h.y) < 60 + t.stats.length * 0.3) {
      burst(game, f, st, id, t, 15);
      game.toastShip(t, 'The Changeling’s bite passes through your hull like fog: that one was false.', 'good');
    }
  }
  // The true one's beak.
  const h = head(body, 0.4);
  const t = nearest(ships, h.x, h.y);
  if (t && dist(t.state.x, t.state.y, h.x, h.y) < 60 + t.stats.length * 0.3 && rate(f, 'changeling_bite', now, 5)) {
    hurt(game, f, t, f.phase === 1 ? 0.06 : 0.04, { crew: 3, morale: 4 });
    game.emit({ k: 'fx', fx: 'maw', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 40 }, t.state.x, t.state.y);
    game.toastShip(t, 'The true Changeling’s beak bites into your hull!', 'bad');
  }
  // The Colours: a bow turned on it within 700 m is seized and drawn in.
  if (f.phase === 1) {
    for (const s of ships) {
      const d = dist(s.state.x, s.state.y, body.state.x, body.state.y);
      if (d > 700) continue;
      const bearing = Math.atan2(body.state.x - s.state.x, -(body.state.y - s.state.y));
      const off = wrapAngle(bearing - s.state.heading);
      if (Math.abs(off) > (25 * Math.PI) / 180) continue;
      s.addEffect({ id: 'dazzled', until: now + 3, mods: { turnRate: -0.85 } }, now);
      s.state.heading = wrapAngle(s.state.heading + clamp(off, -0.08, 0.08));
      if (rate(f, `dazzle${s.id}`, now, 10)) game.toastShip(s, 'The Changeling’s colours seize your helmsman — turn your beam to it, never your bow!', 'bad');
    }
  }
}

/** A false shape bursts into ink where it is, and forms again `secs` later (Infinity: never). */
function burst(game: Game, f: Fight, st: TenState, id: number, by: ShipEntity | null, secs: number): void {
  const p = game.ships.get(id);
  if (!p || st.phantoms.get(id) !== 0) return;
  st.phantoms.set(id, game.now + secs);
  f.inks.push({ x: p.state.x, y: p.state.y, until: game.now + 12 });
  game.emit({ k: 'fx', fx: 'ink', x: Math.round(p.state.x), y: Math.round(p.state.y), r: 180 }, p.state.x, p.state.y);
  submerge(game, p, secs === Infinity ? 1e7 : secs + 1);
  if (by) credit(game, f, by, 'control', 10);
}

// -- The Cinder Ray: ash that lights a gun's own powder; the glide and the grounding; the burning water.
function raySecond(game: Game, f: Fight, st: TenState, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.4 && f.phase === 0) {
    setPhase(game, f, 1);
    sayTo(game, ships, 'The Kindling: its ash hangs about it now — fire only while it lies grounded after a glide.', 'info');
  }
  // The ash: over the thick of the fleet a while (wounded: about the ray always, but while it lies grounded).
  if (f.phase === 0) {
    if (st.ash && now >= st.ash.until) st.ash = null;
    if (!st.ash && ships.length && rate(f, 'ray_ash', now, 20)) {
      const c = centre(game, f, 1500);
      st.ash = { x: c.x, y: c.y, r: 320, until: now + 12 };
      game.emit({ k: 'fx', fx: 'smoke', x: Math.round(c.x), y: Math.round(c.y), r: 320 }, c.x, c.y);
      sayTo(game, ships.filter((s) => dist(s.state.x, s.state.y, c.x, c.y) < 320), 'Ash falls over you — hold your fire! Sparks in the ash find your own powder.', 'bad');
    }
  } else st.ash = now < st.grounded ? null : { x: body.state.x, y: body.state.y, r: 420, until: now + 2 };
  // Guns fired inside the ash: the reload that jumped since the last second is a broadside fired.
  for (const s of ships) {
    const last = st.guns.get(s.id);
    st.guns.set(s.id, [s.reload.port, s.reload.starboard]);
    if (!last || !st.ash) continue;
    const fired = s.reload.port > last[0] + 0.5 || s.reload.starboard > last[1] + 0.5;
    if (!fired || dist(s.state.x, s.state.y, st.ash.x, st.ash.y) > st.ash.r) continue;
    hurt(game, f, s, 0.03, { crew: 2 });
    igniteShip(game, s, 8, body);
    game.toastShip(s, 'The sparks in the ash find your own powder! Hold your fire in the ash.', 'bad');
  }
  // The glide comes down: whatever is under it is struck and set alight; the ray lies grounded a while.
  if (st.glide && now >= st.glide.at) {
    const g = st.glide;
    st.glide = null;
    place(game, body, g.x, g.y);
    game.forShipsNear(g.x, g.y, 140, (o) => {
      if (o.bossOf || !o.alive || o.docked) return;
      if (dist(o.state.x, o.state.y, g.x, g.y) > 80 + o.stats.length * 0.3) return;
      hurt(game, f, o, 0.08, { crew: 2, morale: 4 });
      igniteShip(game, o, 10, body);
    });
    game.emit({ k: 'fx', fx: 'mortar', x: Math.round(g.x), y: Math.round(g.y), r: 80 }, g.x, g.y);
    st.grounded = now + 6;
    if (f.phase === 1) st.burns.push({ x: g.x, y: g.y, until: now + 12 });
    sayTo(game, ships, 'The Cinder Ray lies grounded on the water — fire now!', 'good');
  }
  // The next glide: onto a ship within reach (her shadow three seconds ahead).
  if (!st.glide && now >= st.grounded && ships.length && rate(f, 'ray_glide', now, f.phase === 1 ? 9 : 14)) {
    const near = ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 1400);
    if (near.length) {
      const t = game.rng.pick(near);
      st.glide = { x: t.state.x, y: t.state.y, at: now + 3 };
      game.emit({ k: 'fx', fx: 'white_water', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 80 }, t.state.x, t.state.y);
      game.toastShip(t, 'The Cinder Ray leaps — its shadow falls on you! Get clear.', 'bad');
    }
  }
  // The burning water.
  st.burns = st.burns.filter((b) => b.until > now);
  for (const b of st.burns) {
    game.forShipsNear(b.x, b.y, 120, (o) => {
      if (o.bossOf || !o.alive || o.docked || dist(o.state.x, o.state.y, b.x, b.y) > 70 + o.stats.length * 0.3) return;
      if ((f.bitten.get(o.id) ?? 0) > now) return;
      f.bitten.set(o.id, now + 3);
      igniteShip(game, o, 6, body);
    });
  }
}

// -- The Drowned Prelate: the bells held silent; the ward and the healing of those that toll; the sermon.
function prelateSecond(game: Game, f: Fight, st: TenState, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.4 && f.phase === 0) {
    setPhase(game, f, 1);
    for (const sp of st.spires.values()) {
      sp.lit = true;
      sp.hold = 0;
    }
    sayTo(game, ships, 'The Last Rite: the bells ring again! Silence them anew.', 'bad');
  }
  for (const [id, sp] of st.spires) {
    if (!sp.lit) continue;
    const spire = game.ships.get(id);
    if (!spire) continue;
    const holders = ships.filter((s) => s.isPlayer && dist(s.state.x, s.state.y, spire.state.x, spire.state.y) <= SPIRE_R + s.stats.length * 0.3);
    if (!holders.length) {
      sp.hold = Math.max(0, sp.hold - 1);
      continue;
    }
    sp.hold++;
    for (const s of holders) credit(game, f, s, 'control', 2);
    if (sp.hold < SPIRE_HOLD) continue;
    sp.lit = false;
    for (const s of holders) credit(game, f, s, 'control', 40);
    game.emit({ k: 'fx', fx: 'rise', x: Math.round(spire.state.x), y: Math.round(spire.state.y), r: SANCTUARY_R }, spire.state.x, spire.state.y);
    sayTo(game, ships, `A bell falls silent: Bell Spire ${sp.n}. The Prelate is open to shot by a quarter more; the silent spire shelters you from its sermon.`, 'good');
  }
  // While the bells toll, it mends.
  const lit = [...st.spires.values()].filter((x) => x.lit).length;
  if (lit) body.hull = Math.min(body.stats.hullMax, body.hull + body.stats.hullMax * 0.0015 * lit);
  // The sermon: every crew in reach falls to its knees, but those in a silent spire's sanctuary.
  if (rate(f, 'prelate_sermon', now, f.phase === 1 ? 12 : 20)) {
    st.sermon = now;
    game.emit({ k: 'fx', fx: 'song', x: Math.round(body.state.x), y: Math.round(body.state.y), r: SERMON_R }, body.state.x, body.state.y);
    const quiet = [...st.spires].filter(([, x]) => !x.lit).map(([id]) => game.ships.get(id)).filter((x): x is ShipEntity => !!x);
    for (const s of ships) {
      if (dist(s.state.x, s.state.y, body.state.x, body.state.y) > SERMON_R) continue;
      if (quiet.some((q) => dist(q.state.x, q.state.y, s.state.x, s.state.y) <= SANCTUARY_R)) {
        credit(game, f, s, 'support', 1);
        continue;
      }
      s.morale = Math.max(0, s.morale - 8);
      hurt(game, f, s, 0.02);
      if (s.isPlayer && rate(f, `sermon${s.id}`, now, 30)) game.toastShip(s, 'The Prelate’s sermon: your crew falls to its knees. The sanctuary of a silent spire shelters you.', 'bad');
    }
  }
}

// -- The Rime Twins: the charges in turn (together, wounded); the fallen sung back; the freeze.
function twinsSecond(game: Game, f: Fight, st: TenState, body: ShipEntity, ships: ShipEntity[]): void {
  const now = game.now;
  const twins = twinsOf(game, f);
  // The fallen rise again, sung back by the other.
  for (const [id, at] of [...st.fallen]) {
    if (now < at) continue;
    st.fallen.delete(id);
    const t = game.ships.get(id);
    if (!t || !t.alive) continue;
    surface(t);
    t.hull = t.stats.hullMax * 0.5;
    game.emit({ k: 'fx', fx: 'rise', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 60 }, t.state.x, t.state.y);
    sayTo(game, ships, 'The other twin sings, and the fallen narwhal rises from the sea at half its strength!', 'bad');
  }
  const low = twins.some((t) => t.hull <= t.stats.hullMax * 0.5);
  if ((low || st.turn > 0) && f.phase === 0) {
    setPhase(game, f, 1);
    sayTo(game, ships, 'The Freeze: keep way on — the sea freezes about a slow keel. They charge together now.', 'info');
  }
  st.charges = st.charges.filter((c) => now < c.until);
  // The next charge: one twin and then the other; wounded, both at once from either side of one ship.
  const up = twins.filter((t) => !st.fallen.has(t.id));
  if (up.length && ships.length && !st.charges.length && rate(f, 'twin_charge', now, f.phase === 1 ? 6 : 8)) {
    const t = game.rng.pick(ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 1800).concat([]));
    if (t) {
      const who = f.phase === 1 ? up : [up[Math.floor(now / 8) % up.length]];
      for (const s of who) {
        // Turned on her where she lies now, the charge runs through the mark and on beyond it.
        const dir = Math.atan2(t.state.x - s.state.x, -(t.state.y - s.state.y));
        const run = Math.min(12, (dist(s.state.x, s.state.y, t.state.x, t.state.y) + 120) / TWIN_CHARGE);
        st.charges.push({ by: s.id, dir, at: now + 3, until: now + 3 + run, hit: new Set() });
      }
      game.emit({ k: 'fx', fx: 'white_water', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 70 }, t.state.x, t.state.y);
      game.toastShip(t, 'White water — a narwhal lowers its tusk at you. Turn away!', 'bad');
    }
  }
  // The freeze: floes, and a slow keel frozen in.
  if (f.phase === 1) {
    if (rate(f, 'twin_ice', now, 6)) {
      const t = game.rng.pick(ships.length ? ships : [body]);
      if (t !== body) {
        hurt(game, f, t, 0.02, { sails: t.stats.sailHpMax * 0.06 });
        game.emit({ k: 'fx', fx: 'ice', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 40 }, t.state.x, t.state.y);
      }
    }
    for (const s of ships) {
      if (s.state.speed >= 3 || s.hasEffect('frozen') || dist(s.state.x, s.state.y, body.state.x, body.state.y) > 2000) continue;
      s.addEffect({ id: 'frozen', until: now + 4, mods: { maxSpeed: -1 } }, now);
      if (rate(f, `freeze${s.id}`, now, 15)) game.toastShip(s, 'The sea freezes about your keel — keep way on!', 'bad');
    }
  }
}

// ================================================================================================ hits, the fallen, the end

/** A hit on one of the six or its parts: its multiplier (null: it cannot land at all). */
export function tenIncoming(game: Game, f: Fight, target: ShipEntity, part: Part, source: ShipEntity | null): number | null {
  const st = tenOf(f);
  if (!st) return 1;
  switch (f.kind) {
    case 'old_moorings':
      return st.sprawl ? 1.5 : 1;
    case 'fog_changeling':
      if (part === 'phantom') {
        burst(game, f, st, target.id, source, 15);
        return null;
      }
      return 1;
    case 'cinder_ray':
      return game.now < st.grounded ? 1.6 : 1;
    case 'drowned_prelate': {
      if (part === 'spire') {
        if (source?.isPlayer && rate(f, `spireshot${source.id}`, game.now, 20)) game.toastShip(source, 'Shot does not silence a bell: hold a ship beside the spire.', 'info');
        return null;
      }
      const lit = [...st.spires.values()].filter((x) => x.lit).length;
      return Math.max(0.25, 1 - 0.25 * lit);
    }
  }
  return 1;
}

/** One of the Rime Twins goes under: sung back while its twin stands above a fifth (true: kept afloat); both together
 *  and the fight is won. Undefined for everything else. */
export function tenSinking(game: Game, f: Fight, ship: ShipEntity, part: Part | undefined): boolean | undefined {
  const st = tenOf(f);
  if (!st || f.kind !== 'rime_twins' || (part !== 'twin' && ship.id !== f.id)) return undefined;
  const other = twinsOf(game, f).find((t) => t.id !== ship.id);
  const strong = !!other && !st.fallen.has(other.id) && other.hull > other.stats.hullMax * 0.2;
  if (strong) {
    ship.hull = 1;
    ship.attackers.clear();
    submerge(game, ship, 21);
    st.fallen.set(ship.id, game.now + 20);
    st.turn++;
    game.emit({ k: 'fx', fx: 'boss_roar', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 300 }, ship.state.x, ship.state.y);
    sayTo(game, fighters(game, f), 'A narwhal goes under — its twin sings it back! Bring both down together.', 'bad');
    return true;
  }
  // Both down: the fight is won (the other twin goes down with it).
  if (part === 'twin') {
    const body = game.ships.get(f.id);
    ship.sinkingUntil = game.now + 6;
    game.emit({ k: 'sunk', ship: ship.id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), name: ship.name }, ship.state.x, ship.state.y);
    if (body) {
      body.hull = 0;
      body.sinkingUntil = game.now + 6;
      game.emit({ k: 'sunk', ship: body.id, x: Math.round(body.state.x), y: Math.round(body.state.y), name: body.name }, body.state.x, body.state.y);
    }
    end(game, f, 'slain');
    return true;
  }
  return undefined;
}

/** The fight is over: what it held is let go. */
export function tenEnd(game: Game, f: Fight): void {
  const st = tenOf(f);
  if (!st) return;
  if (st.hold) {
    const s = game.ships.get(st.hold.ship);
    st.hold = null;
    if (s) {
      s.effects = s.effects.filter((e) => e.id !== 'moored');
      s.recompute(game.now);
    }
  }
}

// ================================================================================================ the view

/** Where the panel shows it to a captain: the Changeling's true shape only to one close enough to see its wake (or
 *  with a harpoon in it) — else the middle of its circle. Null: where it is. */
export function tenWhere(game: Game, f: Fight, body: ShipEntity, s: PlayerSession): { x: number; y: number } | null {
  if (f.kind !== 'fog_changeling' || f.phase !== 0) return null;
  return sees(body, s) ? null : centre(game, f);
}

function sees(body: ShipEntity, s: PlayerSession): boolean {
  const ship = s.ship;
  return !!ship && (dist(ship.state.x, ship.state.y, body.state.x, body.state.y) <= 350 || ship.tether?.target === body.id);
}

export function tenZones(game: Game, f: Fight, body: ShipEntity, s: PlayerSession, rz: (k: BossZone['k'], x: number, y: number, r: number) => void): void {
  const st = tenOf(f);
  if (!st) return;
  const now = game.now;
  switch (f.kind) {
    case 'old_moorings':
      if (st.strike) rz('telegraph', st.strike.x, st.strike.y, MOOR_STRIKE_R);
      return;
    case 'fog_changeling':
      if (f.phase === 0 && sees(body, s)) rz('wake', body.state.x, body.state.y, 60);
      if (f.phase === 1) rz('gaze', body.state.x, body.state.y, 700);
      return;
    case 'cinder_ray':
      if (st.ash) rz('ash', st.ash.x, st.ash.y, st.ash.r);
      if (st.glide) rz('telegraph', st.glide.x, st.glide.y, 80);
      for (const b of st.burns) rz('burn', b.x, b.y, 70);
      return;
    case 'drowned_prelate':
      for (const [id, sp] of st.spires) {
        const o = game.ships.get(id);
        if (o) rz(sp.lit ? 'spire' : 'sanctuary', o.state.x, o.state.y, sp.lit ? SPIRE_R : SANCTUARY_R);
      }
      if (now - st.sermon < 3) rz('song', body.state.x, body.state.y, SERMON_R);
      return;
    case 'rime_twins':
      for (const c of st.charges) {
        if (now >= c.at) continue;
        const t = game.ships.get(c.by);
        if (!t) continue;
        const v = headingVec(c.dir);
        rz('telegraph', t.state.x + v.x * 200, t.state.y + v.y * 200, 70);
      }
      return;
  }
}

/** A part's line on the panel: a spire's bell (how long a ship has held it; nothing left when silent), the other twin. */
export function tenPart(game: Game, f: Fight, id: number, p: Part, o: ShipEntity): BossView['parts'][number] | null {
  const st = tenOf(f);
  if (!st) return null;
  if (p === 'spire') {
    const sp = st.spires.get(id);
    if (!sp) return null;
    // Its bar is the bell: whole while it tolls untouched, running down as a ship holds beside it, gone when silent.
    return { id, label: o.name, hp: sp.lit ? SPIRE_HOLD - sp.hold : 0, hpMax: SPIRE_HOLD };
  }
  if (p === 'twin') return { id, label: st.fallen.has(id) ? `${o.name} (under the sea)` : o.name, hp: Math.max(0, Math.round(o.alive ? o.hull : 0)), hpMax: Math.round(o.stats.hullMax) };
  return null;
}

export function tenHint(game: Game, f: Fight, body: ShipEntity): string {
  const st = tenOf(f);
  if (!st) return '';
  switch (f.kind) {
    case 'old_moorings':
      return f.phase === 0
        ? 'It rears up under the slowest ship: keep way on. A strike on empty water leaves it sprawled on the surface (×1.5) — fire then.'
        : 'The Moorings: what it strikes, it coils round. Hurt it (a twenty-fifth of it) within 15 s to make it let go.';
    case 'old_tithe':
      return f.phase === 0
        ? 'It hunts the fullest hold and heals on its tithe. Empty holds are left alone — one laden ship is bait.'
        : 'The Disgorging: its tithes float free for anyone to fish up. It bites twice as often now.';
    case 'fog_changeling':
      return f.phase === 0
        ? 'Only the true shape casts a wake: close in (350 m) or harpoon it. A false shape shot bursts into ink.'
        : 'The Colours: a bow turned on it within 700 m is seized and drawn in. Keep it on your beam.';
    case 'cinder_ray':
      return f.phase === 0
        ? 'Guns fired inside its ash light your own powder. When it glides down onto a ship it lies grounded (×1.6): fire then.'
        : 'The Kindling: its ash hangs about it — fire only while it lies grounded after a glide. The water burns where it lands.';
    case 'drowned_prelate': {
      const lit = [...st.spires.values()].filter((x) => x.lit).length;
      return lit
        ? `Bells tolling: ${lit} — each turns a quarter of your shot aside. Hold a ship within 90 m of a spire for 8 s to silence it; a silent spire shelters you from the sermon.`
        : 'Every bell is silent: pour it on. Keep to the sanctuaries when the sermon comes.';
    }
    case 'rime_twins':
      return f.phase === 0
        ? 'The one that falls rises again in 20 s while its twin stands above a fifth: bring both down together. Their charges come from white water.'
        : 'The Freeze: keep way on — a slow keel freezes in. They charge together now; bring both down together.';
  }
  void body;
  return '';
}
