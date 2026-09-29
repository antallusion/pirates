// The beasts of the sea and the hunt (docs/12 P4). Beasts are ship entities of monster classes with a level ⚓,
// moved here rather than by the NPC brains or the ship physics: orcas circle their prey and dart in for the rudder,
// a pod loses heart when half of it is gone and stands over a wounded one while it lasts; whales wander and dive,
// take fright at a loud ship and sound; a sperm whale struck turns and rams, a narwhal's tusk opens a leak; sharks
// come to blood; a young serpent coils round a hull and crushes it.
//
// A harpoon in a beast is a line on a winch, not the twenty-second tether it is against a ship: the captain plays
// it with her sails — hauling away from it tires it, turning toward it gives it line — while the beast surges.
// Too taut and the line parts (the beast is away with the iron in it); too slack and the iron works loose. Spent,
// it lies on the water to be finished. Its carcass floats for five minutes to be flensed alongside, hove to, and the
// blood in the water brings the sharks — and in the cold seas the orcas.

import { omenCarcassMul } from './omens.ts';
import { giveCalf } from './companion.ts';
import { tattooCount } from './tattoos.ts';
import { trophyBonus } from './estate.ts';
import { BEASTS, BEAST_IDS, LINE, SACRED_WATERS, SPOOK_NOISE, beastOfClass, biteAt, hullNoise, lineStep, yieldScale } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import { clampLevel, xpForGap } from '../../../shared/src/data/shiplevel.ts';
import { clamp, dist, headingVec, wrapAngle } from '../../../shared/src/math.ts';
import type { CarcassView, HuntView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import { giveGoods } from './director.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import { changeRep } from './player.ts';
import { hasLicence } from './ports.ts';
import { questEvent } from './quests.ts';
import type { ShipEntity } from './ship.ts';
import { SPEED_SCALE, TURN_SCALE } from '../../../shared/src/constants.ts';

type Mode = 'roam' | 'hunt' | 'flee' | 'line' | 'spent';

interface Brain {
  beast: BeastId;
  pack: number;
  mode: Mode;
  target: number | null;
  home: { x: number; y: number };
  nextBite: number;
  fleeUntil: number;
  nextDive: number;
  surgeUntil: number;
  nextSurge: number;
  /** Away once with an iron in it: a fifth slower for the rest of its days. */
  ironed: boolean;
  coil: { target: number; until: number; next: number } | null;
  nextCoil: number;
  called: boolean;
  /** A whale the pod hunts (another beast), if any. */
  prey: number | null;
  spooked: Set<number>;
  /** Drawn by blood to a carcass. */
  blood: number | null;
  spentSince: number;
}

interface Pack {
  id: number;
  members: number[];
  size: number;
  broken: boolean;
  prey: number | null;
  /** Captains who fired on the pod while it hunted a whale. */
  saviors: Set<number>;
}

interface Line {
  ship: number;
  beast: number;
  tension: number;
  stamina: number;
  max: number;
  over: number;
  slack: number;
  payAt: number;
  len: number;
  key: string;
}

interface Carcass {
  id: number;
  beast: BeastId;
  level: number;
  x: number;
  y: number;
  h: number;
  until: number;
  progress: number;
  by: number | null;
  freshUntil: number;
  nextBlood: number;
  called: number;
  killer: number | null;
}

interface BeastState {
  brains: Map<number, Brain>;
  packs: Map<number, Pack>;
  lines: Map<number, Line>;
  carcasses: Map<number, Carcass>;
  seq: number;
  rng: Rng;
  sentCarc: Map<number, string>;
  sentHunt: Map<number, string>;
  paused: Set<number>;
}

const states = new WeakMap<Game, BeastState>();

function bs(game: Game): BeastState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { brains: new Map(), packs: new Map(), lines: new Map(), carcasses: new Map(), seq: 1, rng: new Rng(game.world.seed ^ 0xbea5), sentCarc: new Map(), sentHunt: new Map(), paused: new Set() }));
  return s;
}

const SPAWN_R: [number, number] = [2500, 4000];
const DESPAWN_R = 7000;
const WORLD_CAP = 80;
const CARCASS_LIFE = 300;
const FLENSE_R = 80;
const CARCASS_VIEW = 4000;

export function beastBrain(game: Game, id: number): Readonly<Brain> | undefined {
  return bs(game).brains.get(id);
}

/** Set a beast on a ship (the Descent's creatures go for the divers, docs/12 P10 #17). */
export function setBeastPrey(game: Game, id: number, prey: number): void {
  const br = bs(game).brains.get(id);
  if (br) br.prey = prey;
}

export function beastsAlive(game: Game): ShipEntity[] {
  const out: ShipEntity[] = [];
  for (const id of bs(game).brains.keys()) {
    const b = game.ships.get(id);
    if (b?.alive) out.push(b);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ spawning

/** One beast at a point, at a level (kept within its kind's). */
export function spawnBeast(game: Game, id: BeastId, x: number, y: number, level: number, pack = 0): ShipEntity {
  const S = bs(game);
  const def = BEASTS[id];
  const h = S.rng.float() * Math.PI * 2;
  const ship = game.spawnNpcShip('beast', def.cls, 'free', x, y, h, { ship: def.name[0], captain: def.name[0] });
  game.npcs.delete(ship.id); // moved here, not by the NPC brains
  ship.crew = 0;
  ship.morale = 100;
  ship.state.sail = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.level = clampLevel(def.cls, level) * 5;
  game.setNpcLevel(ship, level);
  ship.crew = 0;
  const now = game.now;
  S.brains.set(ship.id, {
    beast: id, pack, mode: 'roam', target: null, home: { x, y }, nextBite: now + def.every, fleeUntil: 0, nextDive: now + S.rng.range(30, 90),
    surgeUntil: 0, nextSurge: now + 4, ironed: false, coil: null, nextCoil: now + 5, called: false, prey: null, spooked: new Set(), blood: null, spentSince: 0,
  });
  if (pack) S.packs.get(pack)?.members.push(ship.id);
  game.grid.upsert(ship.id, x, y);
  return ship;
}

/** A group of a kind: a pod, a pair, a lone one. */
export function spawnGroup(game: Game, id: BeastId, x: number, y: number, level: number, n?: number): ShipEntity[] {
  const S = bs(game);
  const def = BEASTS[id];
  const count = n ?? S.rng.int(def.pack[0], def.pack[1]);
  let pack = 0;
  if (count > 1 || id === 'orca' || id === 'white_orca') {
    pack = S.seq++;
    S.packs.set(pack, { id: pack, members: [], size: 0, broken: false, prey: null, saviors: new Set() });
  }
  const out: ShipEntity[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2, r = count > 1 ? 40 + S.rng.float() * 40 : 0;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (isLand(game.world, px, py)) continue;
    out.push(spawnBeast(game, id, px, py, level + (i && S.rng.chance(0.3) ? S.rng.int(-1, 0) : 0), pack));
  }
  if (pack) S.packs.get(pack)!.size = out.length;
  return out;
}

/** The White Orca and her pod (the happening's). */
export function spawnWhiteOrca(game: Game, x: number, y: number): ShipEntity {
  const S = bs(game);
  const pack = S.seq++;
  S.packs.set(pack, { id: pack, members: [], size: 0, broken: false, prey: null, saviors: new Set() });
  const queen = spawnBeast(game, 'white_orca', x, y, 8, pack);
  queen.elite = true;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    spawnBeast(game, 'orca', x + Math.cos(a) * 60, y + Math.sin(a) * 60, 6, pack);
  }
  S.packs.get(pack)!.size = 5;
  return queen;
}

function orcaMigrationIn(game: Game, region: RegionId): boolean {
  return game.worldEvents.active(game).some((e) => e.kind === 'orca_migration' && e.region === region);
}

function pickKind(game: Game, region: RegionId, level: number): BeastId | null {
  const S = bs(game);
  const migrating = orcaMigrationIn(game, region);
  const pool: [BeastId, number][] = [];
  for (const id of BEAST_IDS) {
    const d = BEASTS[id];
    if (!d.weight || !d.regions.includes(region)) continue;
    // Not a beast wildly above or below the captain: the sea fits its beasts to who sails there.
    if (level < d.level[0] - 2 || level > d.level[1] + 3) continue;
    pool.push([id, d.weight * (id === 'orca' && migrating ? 3 : 1)]);
  }
  if (!pool.length) return null;
  let r = S.rng.float() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of pool) if ((r -= w) <= 0) return id;
  return pool[0][0];
}

function openPoint(game: Game, x: number, y: number, r0: number, r1: number, region?: RegionId): [number, number] | null {
  const S = bs(game);
  for (let k = 0; k < 12; k++) {
    const a = S.rng.float() * Math.PI * 2, r = S.rng.range(r0, r1);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (isLand(game.world, px, py) || !game.inZone(px, py)) continue;
    if (region && regionAt(game.world, px, py) !== region) continue;
    return [px, py];
  }
  return null;
}

/** Every five seconds: now and then a group rises within a few miles of a captain at sea. */
function spawnAbout(game: Game): void {
  const S = bs(game);
  if (S.brains.size >= WORLD_CAP) return;
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || ship.docked || !ship.alive || !s.profile) continue;
    let near = 0;
    for (const id of S.brains.keys()) {
      const b = game.ships.get(id);
      if (b && dist(b.state.x, b.state.y, ship.state.x, ship.state.y) < 5000) near++;
    }
    const migrating = orcaMigrationIn(game, ship.region);
    if (near >= (migrating ? 10 : 6)) continue;
    if (!S.rng.chance(migrating ? 0.25 : 0.12)) continue;
    const lvl = ship.shipLevel;
    const kind = pickKind(game, ship.region, lvl);
    if (!kind) continue;
    const pt = openPoint(game, ship.state.x, ship.state.y, SPAWN_R[0], SPAWN_R[1], ship.region);
    if (!pt) continue;
    const d = BEASTS[kind];
    const level = clamp(lvl + S.rng.int(-1, 1), d.level[0], d.level[1]);
    const group = spawnGroup(game, kind, pt[0], pt[1], level);
    // A pod of orcas now and then has a whale of its own in its jaws.
    if (kind === 'orca' && group.length && S.rng.chance(0.25)) {
      const w = spawnBeast(game, S.rng.chance(0.5) ? 'humpback' : 'narwhal', pt[0] + 120, pt[1], clamp(level, 4, 7));
      const pack = S.packs.get(S.brains.get(group[0].id)!.pack);
      if (pack) {
        pack.prey = w.id;
        for (const m of pack.members) {
          const mb = S.brains.get(m);
          if (mb) mb.prey = w.id;
        }
      }
    }
  }
}

/** Beasts passing within a mile or so of one captain (the sea's small life, sealife.ts); false when none fits. */
export function beastsPass(game: Game, ship: ShipEntity): boolean {
  const S = bs(game);
  if (S.brains.size >= WORLD_CAP) return false;
  const kind = pickKind(game, ship.region, ship.shipLevel);
  if (!kind) return false;
  const pt = openPoint(game, ship.state.x, ship.state.y, 1200, 2000, ship.region);
  if (!pt) return false;
  const d = BEASTS[kind];
  return spawnGroup(game, kind, pt[0], pt[1], clamp(ship.shipLevel + S.rng.int(-1, 1), d.level[0], d.level[1])).length > 0;
}

// ------------------------------------------------------------------------------------------------ movement

function swim(game: Game, s: ShipEntity, tx: number, ty: number, speed: number, dt: number, turn = 1.4): void {
  const want = Math.atan2(tx - s.state.x, -(ty - s.state.y));
  // At the pace of the sea, as the ships (SPEED_SCALE, TURN_SCALE): her way is reckoned on the old scale.
  const tr = turn * TURN_SCALE;
  s.state.heading = wrapAngle(s.state.heading + clamp(wrapAngle(want - s.state.heading), -tr * dt, tr * dt));
  const v = Math.min(speed, dist(s.state.x, s.state.y, tx, ty) / Math.max(dt * SPEED_SCALE, 1e-3));
  const h = headingVec(s.state.heading);
  const nx = s.state.x + h.x * v * SPEED_SCALE * dt, ny = s.state.y + h.y * v * SPEED_SCALE * dt;
  if (isLand(game.world, nx, ny)) {
    // Land ahead: turn off it.
    s.state.heading = wrapAngle(s.state.heading + turn * dt * 2);
    s.state.speed = v * 0.3;
    return;
  }
  s.state.x = nx;
  s.state.y = ny;
  s.state.speed = v;
  game.grid.upsert(s.id, nx, ny);
}

function away(game: Game, s: ShipEntity, from: { x: number; y: number }, speed: number, dt: number): void {
  const a = Math.atan2(s.state.x - from.x, -(s.state.y - from.y));
  const v = headingVec(a);
  swim(game, s, s.state.x + v.x * 500, s.state.y + v.y * 500, speed, dt, 1.2);
}

function speedOf(b: ShipEntity, br: Brain, k: number): number {
  return b.stats.maxSpeed * k * (br.ironed ? 0.8 : 1);
}

// ------------------------------------------------------------------------------------------------ the tick

/** Every tick: the beasts swim, bite, dive and pull on the lines. */
export function stepBeasts(game: Game, dt: number): void {
  const S = bs(game);
  if (!S.brains.size && !S.lines.size) return;
  const now = game.now;
  for (const [id, br] of S.brains) {
    const b = game.ships.get(id);
    if (!b || !b.alive) {
      if (!b) S.brains.delete(id);
      continue;
    }
    b.region = regionAt(game.world, b.state.x, b.state.y);
    think(game, b, br, dt, now);
  }
  stepLines(game, dt);
}

function think(game: Game, b: ShipEntity, br: Brain, dt: number, now: number): void {
  const S = bs(game);
  const def = BEASTS[br.beast];
  const lined = [...S.lines.values()].find((l) => l.beast === b.id);
  if (lined) br.mode = br.mode === 'spent' ? 'spent' : 'line';
  else if (br.mode === 'line') br.mode = 'flee';
  if (br.mode === 'spent') {
    b.state.speed = 0.3;
    // Left alone, a spent beast gets its wind back.
    if (!lined && now - br.spentSince > 30) {
      br.mode = 'flee';
      br.fleeUntil = now + 30;
      b.effects = b.effects.filter((e) => e.id !== 'spent');
      b.recompute(now);
    }
    return;
  }
  // The coil holds: stay on the prey.
  if (br.coil) {
    stepCoil(game, b, br, now);
    return;
  }
  if (br.mode === 'line') {
    lineSwim(game, b, br, lined!, dt, now);
    return;
  }
  // Whales dive now and then; the surfacing shows a spout.
  if (def.temper !== 'pack' && def.temper !== 'blood' && def.temper !== 'coil' && br.mode !== 'hunt' && now >= br.nextDive) {
    br.nextDive = now + S.rng.range(60, 100);
    b.addEffect({ id: 'submerged', until: now + S.rng.range(12, 22) }, now);
  }
  if (b.hasEffect('submerged') && S.rng.chance(dt * 0.02)) game.emit({ k: 'fx', fx: 'spout', x: Math.round(b.state.x), y: Math.round(b.state.y) }, b.state.x, b.state.y);
  if (br.mode === 'flee') {
    if (now > br.fleeUntil) br.mode = 'roam';
    const threat = nearestShip(game, b, 1500);
    away(game, b, threat ? threat.state : br.home, speedOf(b, br, 1), dt);
    return;
  }
  const target = chooseTarget(game, b, br, now);
  if (target) {
    br.mode = 'hunt';
    br.target = target.id;
    attack(game, b, br, target, dt, now);
    return;
  }
  br.mode = 'roam';
  br.target = null;
  // Round a carcass the blood drew it to, or wandering about its home.
  const c = br.blood !== null ? S.carcasses.get(br.blood) : undefined;
  if (c) {
    const a = now * 0.4 + b.id;
    swim(game, b, c.x + Math.cos(a) * 70, c.y + Math.sin(a) * 70, speedOf(b, br, 0.6), dt);
    return;
  }
  const t = now * 0.03 + b.id * 1.7;
  swim(game, b, br.home.x + Math.sin(t) * 600, br.home.y - Math.cos(t * 0.8) * 600, speedOf(b, br, 0.3), dt, 0.6);
  // A shy beast takes fright at a loud ship.
  if (def.spookRange > 0) spook(game, b, br, now);
}

function nearestShip(game: Game, b: ShipEntity, r: number): ShipEntity | null {
  let best: ShipEntity | null = null, bd = r;
  game.forShipsNear(b.state.x, b.state.y, r, (o) => {
    if (!o.alive || o.docked || o.npcRole === 'beast' || o.cls.monster) return;
    const d = dist(o.state.x, o.state.y, b.state.x, b.state.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

function spook(game: Game, b: ShipEntity, br: Brain, now: number): void {
  const def = BEASTS[br.beast];
  game.forShipsNear(b.state.x, b.state.y, def.spookRange, (o) => {
    if (br.mode === 'flee' || !o.alive || o.docked || o.npcRole === 'beast' || o.cls.monster) return;
    const quiet = o.cls.passive.id === 'flensing_deck' ? 0.67 : 1;
    if (dist(o.state.x, o.state.y, b.state.x, b.state.y) > def.spookRange * quiet) return;
    const n = hullNoise(o.state.speed, o.stats.maxSpeed, now - o.lastCombat);
    if (n <= SPOOK_NOISE) return;
    br.mode = 'flee';
    br.fleeUntil = now + 40;
    b.addEffect({ id: 'submerged', until: now + 10 }, now);
    if (!br.spooked.has(o.id)) {
      br.spooked.add(o.id);
      game.toastShip(o, `${def.name[0]} takes fright and sounds!`, 'info');
    }
  });
}

/** Whom a beast goes for: its pod's quarry, whoever hurt it (or its pod), a wounded ship for the predators. */
function chooseTarget(game: Game, b: ShipEntity, br: Brain, now: number): ShipEntity | null {
  const S = bs(game);
  const def = BEASTS[br.beast];
  // The pod's whale.
  if (br.prey !== null) {
    const w = game.ships.get(br.prey);
    if (w?.alive && dist(w.state.x, w.state.y, b.state.x, b.state.y) < 2500) {
      // A ship that fires on the pod turns it from the whale.
      const hit = recentAttacker(game, b, now, 20);
      return hit ?? w;
    }
    br.prey = null;
  }
  // Whoever struck it — or a packmate lying wounded.
  const own = recentAttacker(game, b, now, 60);
  if (own && (def.predator || def.temper === 'ram' || def.temper === 'tusk')) return own;
  if (br.pack) {
    const pack = S.packs.get(br.pack);
    for (const m of pack?.members ?? []) {
      const mb = game.ships.get(m);
      if (!mb?.alive || mb.id === b.id || mb.hull > mb.stats.hullMax * 0.6) continue;
      const hurt = recentAttacker(game, mb, now, 30);
      if (hurt) return hurt;
    }
  }
  if (!def.predator) return null;
  // Predators: the wounded in reach (orcas), the bleeding (sharks), any prey close in (the serpent, the White Orca).
  const migrating = orcaMigrationIn(game, b.region);
  const reach = br.beast === 'white_orca' ? 1200 : br.beast === 'young_serpent' ? 350 : br.beast === 'shark' ? 700 : 900;
  let best: ShipEntity | null = null, bd = reach;
  game.forShipsNear(b.state.x, b.state.y, reach, (o) => {
    if (!o.alive || o.docked || o.npcRole === 'beast' || o.cls.monster || o.hasEffect('submerged')) return;
    if (o.protectedUntil > now) return;
    const frac = o.hull / Math.max(1, o.stats.hullMax);
    if (br.beast === 'orca' && !(frac < (migrating ? 0.8 : 0.6))) return;
    if (br.beast === 'orca' && o.hasFlag('fh_white_orca')) return; // the White Orca's figure on the bow
    if (br.beast === 'shark' && !(frac < 0.4 || flensingNear(game, o))) return;
    if (!o.isPlayer && !(br.beast === 'white_orca' || br.beast === 'young_serpent')) return;
    const d = dist(o.state.x, o.state.y, b.state.x, b.state.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

function recentAttacker(game: Game, b: ShipEntity, now: number, sec: number): ShipEntity | null {
  let best: ShipEntity | null = null, bt = now - sec;
  for (const [id, t] of b.attackers) {
    if (t < bt) continue;
    const o = game.ships.get(id);
    if (!o?.alive || o.docked || o.npcRole === 'beast') continue;
    if (dist(o.state.x, o.state.y, b.state.x, b.state.y) > 2500) continue;
    bt = t;
    best = o;
  }
  return best;
}

function flensingNear(game: Game, o: ShipEntity): boolean {
  for (const c of bs(game).carcasses.values()) if (c.by !== null && dist(c.x, c.y, o.state.x, o.state.y) < 150) return true;
  return false;
}

/** The blow of a beast at its prey. */
function bite(game: Game, b: ShipEntity, br: Brain, t: ShipEntity, mul = 1): void {
  const S = bs(game);
  const dmg = biteAt(br.beast, b.shipLevel) * mul * S.rng.range(0.85, 1.15);
  const def = BEASTS[br.beast];
  const packet: { hull: number; rudder?: number; crew?: number } = { hull: dmg };
  if (def.temper === 'pack' && br.beast === 'orca' && S.rng.chance(0.3)) {
    packet.rudder = 0.06;
    if (t.isPlayer) game.toastShip(t, 'The orcas go for your rudder!', 'bad');
  }
  if (def.temper === 'blood') packet.crew = 1;
  if (t.npcRole === 'beast') {
    // One beast on another (a pod on its whale): no ladder, no law.
    t.hull = Math.max(0, t.hull - dmg);
    if (t.hull <= 0) game.beginSinking(t);
    return;
  }
  applyDamage(game, t, packet, b);
  // A beast alongside is in reach of the rail: muskets, swivels, boathooks and axes on the coils answer every bite.
  if ((def.temper === 'pack' || def.temper === 'blood' || def.temper === 'tusk' || def.temper === 'coil') && t.crew > 0) {
    const hands = Math.min(1, t.crew / Math.max(1, t.stats.crewMax));
    applyDamage(game, b, { hull: t.stats.hullMax * 0.02 * hands }, t);
  }
  if (def.temper === 'tusk') {
    t.leaks = Math.min(6, t.leaks + 1);
    game.toastShip(t, 'A narwhal’s tusk goes through the planking: a leak!', 'bad');
  }
}

function attack(game: Game, b: ShipEntity, br: Brain, t: ShipEntity, dt: number, now: number): void {
  const S = bs(game);
  const def = BEASTS[br.beast];
  const d = dist(b.state.x, b.state.y, t.state.x, t.state.y);
  const reach = t.stats.length / 2 + b.stats.length / 2 + 12;
  switch (def.temper) {
    case 'pack':
    case 'blood': {
      if (br.beast === 'white_orca') return whiteOrca(game, b, br, t, dt, now);
      // Circle the prey, each in its own place round it, darting in to bite.
      const pack = br.pack ? S.packs.get(br.pack) : undefined;
      const idx = pack ? Math.max(0, pack.members.indexOf(b.id)) : 0;
      const n = pack ? Math.max(1, pack.members.length) : 1;
      const a = now * 0.5 + (idx / n) * Math.PI * 2;
      // Between bites they keep off at a stone's throw, circling; a second before the bite they dart in.
      const dart = now >= br.nextBite - 1.2;
      const r = dart ? reach * 0.6 : reach + 60;
      swim(game, b, t.state.x + Math.cos(a) * r, t.state.y + Math.sin(a) * r, speedOf(b, br, 1.05), dt, 2.2);
      if (now >= br.nextBite && d < reach + 8) {
        br.nextBite = now + def.every * S.rng.range(0.8, 1.2);
        bite(game, b, br, t);
      }
      return;
    }
    case 'ram': {
      // The sperm whale charges whoever struck it and rams, then stands off to come again.
      if (now < br.nextBite) {
        const a = Math.atan2(b.state.x - t.state.x, -(b.state.y - t.state.y)) + 0.2;
        const v = headingVec(a);
        swim(game, b, t.state.x + v.x * 200, t.state.y + v.y * 200, speedOf(b, br, 0.4), dt, 1.1);
        return;
      }
      swim(game, b, t.state.x, t.state.y, speedOf(b, br, 1.3), dt, 1.1);
      if (d < reach) {
        br.nextBite = now + def.every;
        bite(game, b, br, t);
        game.emit({ k: 'fx', fx: 'ram', x: Math.round(t.state.x), y: Math.round(t.state.y) }, t.state.x, t.state.y);
        if (t.isPlayer) game.toastShip(t, 'The sperm whale turns on you and rams!', 'bad');
      }
      return;
    }
    case 'tusk':
    case 'shy': {
      swim(game, b, t.state.x, t.state.y, speedOf(b, br, 0.9), dt, 1.6);
      if (now >= br.nextBite && d < reach) {
        br.nextBite = now + def.every;
        bite(game, b, br, t);
      }
      return;
    }
    case 'coil': {
      swim(game, b, t.state.x, t.state.y, speedOf(b, br, 1), dt, 1.5);
      if (now >= br.nextCoil && d < reach + 10) {
        br.coil = { target: t.id, until: now + 8, next: now + 0.5 };
        t.addEffect({ id: 'coiled', until: now + 8, mods: { maxSpeed: -0.85, turnRate: -0.8 }, source: b.id }, now);
        game.emit({ k: 'fx', fx: 'coil', x: Math.round(t.state.x), y: Math.round(t.state.y) }, t.state.x, t.state.y);
        if (t.isPlayer) game.toastShip(t, 'The serpent’s coils close round your hull!', 'bad');
      }
      return;
    }
  }
}

function stepCoil(game: Game, b: ShipEntity, br: Brain, now: number): void {
  const c = br.coil!;
  const t = game.ships.get(c.target);
  if (!t?.alive || t.docked || now > c.until) {
    br.coil = null;
    br.nextCoil = now + 18;
    br.fleeUntil = now + 6;
    br.mode = 'flee';
    if (t) {
      t.effects = t.effects.filter((e) => e.id !== 'coiled');
      t.recompute(now);
      game.toastShip(t, 'The coils loosen.', 'good');
    }
    return;
  }
  b.state.x = t.state.x;
  b.state.y = t.state.y;
  b.state.heading = wrapAngle(b.state.heading + 0.05);
  game.grid.upsert(b.id, b.state.x, b.state.y);
  if (now >= c.next) {
    c.next = now + BEASTS[br.beast].every;
    bite(game, b, br, t);
  }
}

/** The White Orca: rams from a run, dives under the keel to come up on the other side, calls her pod when hurt. */
function whiteOrca(game: Game, b: ShipEntity, br: Brain, t: ShipEntity, dt: number, now: number): void {
  const S = bs(game);
  if (!br.called && b.hull < b.stats.hullMax * 0.5) {
    br.called = true;
    for (let i = 0; i < 3; i++) {
      const p = openPoint(game, b.state.x, b.state.y, 250, 400);
      if (p) spawnBeast(game, 'orca', p[0], p[1], 7, br.pack);
    }
    game.toastShip(t, 'The White Orca calls her pod!', 'bad');
  }
  const d = dist(b.state.x, b.state.y, t.state.x, t.state.y);
  const reach = t.stats.length / 2 + b.stats.length / 2 + 10;
  if (b.hasEffect('submerged')) {
    // Under the keel: she comes up on the far side.
    swim(game, b, t.state.x, t.state.y, speedOf(b, br, 1.4), dt, 3);
    return;
  }
  const ready = now >= br.nextBite;
  if (ready && d < 90 && S.rng.chance(dt * 0.5)) {
    b.addEffect({ id: 'submerged', until: now + 3 }, now);
    const a = Math.atan2(b.state.x - t.state.x, -(b.state.y - t.state.y)) + Math.PI;
    const v = headingVec(a);
    b.state.x = t.state.x + v.x * 40;
    b.state.y = t.state.y + v.y * 40;
    game.grid.upsert(b.id, b.state.x, b.state.y);
    game.toastShip(t, 'The White Orca dives under your keel!', 'bad');
    return;
  }
  const a = now * 0.35;
  const r = ready ? 0 : reach + 60;
  swim(game, b, t.state.x + Math.cos(a) * r, t.state.y + Math.sin(a) * r, speedOf(b, br, ready ? 1.3 : 0.9), dt, 1.8);
  if (ready && d < reach) {
    br.nextBite = now + BEASTS.white_orca.every;
    bite(game, b, br, t);
    game.emit({ k: 'fx', fx: 'ram', x: Math.round(t.state.x), y: Math.round(t.state.y) }, t.state.x, t.state.y);
  }
}

// ------------------------------------------------------------------------------------------------ the line

/** A harpoon into a beast: the line with the winch. Called from the harpoon mount. */
export function harpoonBeast(game: Game, ship: ShipEntity, b: ShipEntity): string | null {
  const S = bs(game);
  const br = S.brains.get(b.id);
  if (!br) return 'Nothing there to strike';
  if (b.hasEffect('submerged')) return 'It is under the water';
  for (const l of S.lines.values()) if (l.beast === b.id && l.ship !== ship.id) return 'Another line is in it already';
  const def = BEASTS[br.beast];
  applyDamage(game, b, { hull: 40 }, ship);
  const len = clamp(dist(ship.state.x, ship.state.y, b.state.x, b.state.y) + 40, 60, LINE.MAX_LEN);
  S.lines.set(ship.id, { ship: ship.id, beast: b.id, tension: 30, stamina: def.stamina * (b.shipLevel >= def.level[1] ? 1.2 : 1), max: def.stamina, over: 0, slack: 0, payAt: 0, len, key: '' });
  br.mode = 'line';
  br.nextSurge = game.now + 3;
  game.emit({ k: 'tether', a: ship.id, b: b.id, until: Math.round(game.now + 900) }, ship.state.x, ship.state.y);
  game.toastShip(ship, `The harpoon bites! ${def.name[0]} is on the line — work her with the sails.`, 'good');
  return null;
}

function lineSwim(game: Game, b: ShipEntity, br: Brain, l: Line, dt: number, now: number): void {
  const S = bs(game);
  const ship = game.ships.get(l.ship);
  if (!ship) return;
  const def = BEASTS[br.beast];
  // Surges: every few seconds it throws itself against the line.
  if (now >= br.nextSurge) {
    br.surgeUntil = now + S.rng.range(1.2, 2.6);
    br.nextSurge = now + S.rng.range(4, 8);
  }
  const surge = now < br.surgeUntil;
  const spent = l.stamina <= 0;
  const sp = speedOf(b, br, spent ? 0.05 : surge ? 0.9 : 0.55);
  away(game, b, ship.state, sp, dt);
  // The sperm whale on the line turns and rams now and then; a humpback's tail finds a ship too close.
  const d = dist(b.state.x, b.state.y, ship.state.x, ship.state.y);
  if (def.temper === 'ram' && now >= br.nextBite && !spent) {
    swim(game, b, ship.state.x, ship.state.y, speedOf(b, br, 1.3), dt, 2);
    if (d < ship.stats.length / 2 + b.stats.length / 2 + 10) {
      br.nextBite = now + def.every;
      bite(game, b, br, ship);
      game.emit({ k: 'fx', fx: 'ram', x: Math.round(ship.state.x), y: Math.round(ship.state.y) }, ship.state.x, ship.state.y);
      game.toastShip(ship, 'The sperm whale turns on you and rams!', 'bad');
    }
  } else if (def.temper === 'shy' && now >= br.nextBite && d < ship.stats.length / 2 + 40) {
    br.nextBite = now + def.every;
    bite(game, b, br, ship);
  }
}

function stepLines(game: Game, dt: number): void {
  const S = bs(game);
  const now = game.now;
  for (const [key, l] of S.lines) {
    const ship = game.ships.get(l.ship);
    const b = game.ships.get(l.beast);
    const br = S.brains.get(l.beast);
    if (!ship || !b || !br || !ship.alive || !b.alive || ship.docked || dist(ship.state.x, ship.state.y, b.state.x, b.state.y) > LINE.MAX_LEN * 1.6) {
      endLine(game, key, null);
      continue;
    }
    const def = BEASTS[br.beast];
    const dx = b.state.x - ship.state.x, dy = b.state.y - ship.state.y;
    const d = Math.hypot(dx, dy) || 1;
    // Her heading against the line: hauling away from it, or giving it line.
    const hv = headingVec(ship.state.heading);
    const awayF = -(hv.x * dx + hv.y * dy) / d;
    const spent = l.stamina <= 0;
    const st = lineStep(l.tension, def.pull, now < br.surgeUntil, ship.state.sail * (ship.state.speed > 0.5 ? 1 : 0.4), awayF, spent, dt);
    l.tension = st.tension;
    if (!spent) {
      l.stamina = Math.max(0, l.stamina - st.drain);
      if (l.stamina <= 0) {
        br.mode = 'spent';
        br.spentSince = now;
        b.addEffect({ id: 'spent', until: now + 1e6, mods: { incomingDamageMul: 0.5 } }, now);
        b.recompute(now);
        game.toastShip(ship, `${def.name[0]} is spent and lies still. Finish her.`, 'gold');
      }
    }
    // Beyond the line's length the beast tows the ship (a sleigh ride), and the winch takes up what it can.
    const over = d - l.len;
    if (over > 0) {
      const k = Math.min(1, dt * 1.5) * (spent ? 0.1 : def.pull);
      ship.state.x += (dx / d) * over * k;
      ship.state.y += (dy / d) * over * k;
      b.state.x -= (dx / d) * over * (1 - k) * 0.5;
      b.state.y -= (dy / d) * over * (1 - k) * 0.5;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      game.grid.upsert(b.id, b.state.x, b.state.y);
    }
    if (l.tension < 60) l.len = Math.max(50, l.len - 3 * dt);
    const snap = LINE.SNAP * (ship.cls.passive.id === 'flensing_deck' ? 1.33 : 1) * (ship.hasFlag('tattoo_harpoon') ? 1.15 : 1);
    l.over = l.tension > snap ? l.over + dt : 0;
    l.slack = !spent && l.tension < LINE.SLACK ? l.slack + dt : 0;
    if (l.over > LINE.SNAP_HOLD) {
      br.ironed = true;
      br.mode = 'flee';
      br.fleeUntil = now + 60;
      endLine(game, key, `The line parts! ${def.name[0]} is away with your iron in her.`);
      continue;
    }
    if (l.slack > LINE.SLACK_HOLD) {
      br.mode = 'flee';
      br.fleeUntil = now + 40;
      endLine(game, key, `The iron works loose and ${def.name[0]} is free.`);
      continue;
    }
    sendHunt(game, ship);
  }
}

function endLine(game: Game, key: number, msg: string | null): void {
  const S = bs(game);
  const l = S.lines.get(key);
  if (!l) return;
  S.lines.delete(key);
  const ship = game.ships.get(l.ship);
  if (ship) {
    game.emit({ k: 'tether', a: ship.id, b: l.beast, until: Math.round(game.now) }, ship.state.x, ship.state.y);
    if (msg) game.toastShip(ship, msg, 'bad');
    sendHunt(game, ship, true);
  }
}

/** The captain's hand on the line: pay out (the tension drops at once), or cut it. */
export function huntOrder(game: Game, s: PlayerSession, action: string, id?: number): string | null {
  const S = bs(game);
  const ship = s.ship;
  if (!ship) return 'No ship';
  switch (action) {
    case 'slack': {
      const l = S.lines.get(ship.id);
      if (!l) return 'No line out.';
      if (game.now < l.payAt) return 'The winch is not ready.';
      l.tension = Math.max(0, l.tension - LINE.PAY_OUT);
      l.len = Math.min(LINE.MAX_LEN, l.len + 40);
      l.payAt = game.now + LINE.PAY_OUT_COOLDOWN;
      game.toastShip(ship, 'You pay out the line.', 'info');
      sendHunt(game, ship, true);
      return null;
    }
    case 'cut': {
      if (!S.lines.has(ship.id)) return 'No line out.';
      endLine(game, ship.id, null);
      game.toastShip(ship, 'You cut the line.', 'info');
      return null;
    }
    case 'flense':
      return startFlense(game, s, Number(id));
  }
  return 'Unknown order';
}

// ------------------------------------------------------------------------------------------------ the kill

/** A beast's death (from beginSinking): no wreck, a carcass; the experience, the quests, the Choir and the Order. */
export function beastSlain(game: Game, b: ShipEntity): boolean {
  const S = bs(game);
  const br = S.brains.get(b.id);
  if (!br) return false;
  const def = BEASTS[br.beast];
  const now = game.now;
  // The killer: the last to strike within a minute (an escort's for its owner).
  let killer: ShipEntity | null = null, lt = -Infinity;
  for (const [id, t] of b.attackers) if (t > now - 60 && t > lt) {
    const o = game.ships.get(id);
    if (!o || o.npcRole === 'beast') continue;
    lt = t;
    killer = o.ownerId !== null ? game.ships.get(o.ownerId) ?? o : o;
  }
  const c: Carcass = { id: S.seq++, beast: br.beast, level: b.shipLevel, x: b.state.x, y: b.state.y, h: b.state.heading, until: now + CARCASS_LIFE, progress: 0, by: null, freshUntil: now + 60, nextBlood: now + 8, called: 0, killer: killer?.accountId ?? null };
  S.carcasses.set(c.id, c);
  for (const [k, l] of S.lines) if (l.beast === b.id) endLine(game, k, null);
  game.emit({ k: 'sunk', ship: b.id, x: Math.round(b.state.x), y: Math.round(b.state.y), name: b.name }, b.state.x, b.state.y);
  const pack = br.pack ? S.packs.get(br.pack) : undefined;
  S.brains.delete(b.id);
  game.removeShip(b.id);
  // Everyone who drew its blood: the killer's share, and some for the rest.
  const shares = new Map<number, number>();
  for (const [id, t] of b.attackers) {
    if (t < now - 90) continue;
    const o = game.ships.get(id);
    const acc = o ? (o.ownerId !== null ? game.ships.get(o.ownerId)?.accountId : o.accountId) : null;
    if (acc !== null && acc !== undefined) shares.set(acc, 0.4);
  }
  if (killer?.accountId !== null && killer?.accountId !== undefined) shares.set(killer.accountId, 1);
  for (const [acc, k] of shares) {
    const s = game.sessionByAccount(acc);
    if (!s?.profile || !s.ship) continue;
    const gap = s.ship.onLadder ? c.level - s.ship.combatLevel : 0;
    const xp = def.xp * Math.pow(1.3, c.level - def.level[0]) * xpForGap(gap) * k;
    game.grantXp(s, xp, `Took ${def.name[0]}`, true);
    if (k === 1) game.sendTo(s, { t: 'toast', msg: `${def.name[0]} is dead. Heave to alongside to flense her.`, kind: 'good' });
    const p = s.profile;
    p.beasts ??= {};
    p.beasts[br.beast] = (p.beasts[br.beast] ?? 0) + 1;
    questEvent(game, s, { k: 'beast', beast: br.beast });
    // A group sails as one.
    const g = groupOfAccount(game, acc);
    if (g && k === 1) for (const m of g.members) {
      if (m === acc) continue;
      const ms = game.sessionByAccount(m);
      if (ms?.ship && ms.ship.alive && dist(ms.ship.state.x, ms.ship.state.y, c.x, c.y) < 3000) questEvent(game, ms, { k: 'beast', beast: br.beast });
    }
    if (k === 1 && def.group === 'whale') {
      // The Choir keeps count of the whales.
      const sacred = SACRED_WATERS.includes(regionAt(game.world, c.x, c.y));
      changeRep(p, 'choir', sacred ? -4 : -1);
      if (sacred) game.sendTo(s, { t: 'toast', msg: 'The Choir will not forgive whaling in its waters.', kind: 'bad' });
    }
  }
  if (br.beast === 'white_orca') {
    const s = killer?.accountId !== null && killer?.accountId !== undefined ? game.sessionByAccount(killer.accountId) : undefined;
    if (s?.profile) {
      for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} took the White Orca!`, kind: 'gold' });
      giveCalf(game, s, 'orphan'); // her calf, orphaned, follows the one who took her (docs/12 P10 #2)
      if (!s.profile.figureheads.includes('fh_white_orca')) {
        s.profile.figureheads.push('fh_white_orca');
        game.sendTo(s, { t: 'toast', msg: 'The White Orca’s figurehead is yours.', kind: 'gold' });
      } else takeItem(game, s, makeItem(game.rng, s.profile.itemSeq++, { ilvl: 8, source: 'elite' }));
    }
  }
  if (pack) packLoss(game, pack, b.id, now, killer);
  // A whale saved from its pod: the pod is gone and it lives.
  for (const pk of S.packs.values()) if (pk.prey === b.id) pk.prey = null;
  return true;
}

/** A pod that has lost half of its number loses heart; if it hunted a whale that still lives, the whale is saved. */
function packLoss(game: Game, pack: Pack, dead: number, now: number, killer: ShipEntity | null): void {
  const S = bs(game);
  pack.members = pack.members.filter((m) => m !== dead && game.ships.get(m)?.alive);
  const queen = pack.members.some((m) => S.brains.get(m)?.beast === 'white_orca');
  // A pod above its prey's strength smells the weakness and fights to the last.
  const level = Math.max(0, ...pack.members.map((m) => game.ships.get(m)?.shipLevel ?? 0));
  const bold = !!killer && killer.onLadder && level > killer.combatLevel;
  if (pack.broken || queen || bold || pack.members.length > Math.floor(pack.size / 2)) return;
  pack.broken = true;
  for (const m of pack.members) {
    const mb = S.brains.get(m);
    if (!mb) continue;
    mb.mode = 'flee';
    mb.fleeUntil = now + 60;
    mb.prey = null;
    mb.target = null;
  }
  const whale = pack.prey !== null ? game.ships.get(pack.prey) : undefined;
  const near = new Set<number>(pack.saviors);
  for (const o of game.sessions) {
    const ship = o.ship;
    if (!ship || !o.profile || !pack.size) continue;
    const any = pack.members.map((m) => game.ships.get(m)).find(Boolean) ?? whale;
    if (!any || dist(ship.state.x, ship.state.y, any.state.x, any.state.y) > 3000) continue;
    game.sendTo(o, { t: 'toast', msg: 'The orcas lose heart and scatter.', kind: 'good' });
    if (whale?.alive && near.has(o.accountId)) {
      changeRep(o.profile, 'choir', 3);
      ship.addEffect({ id: 'enc_whale', until: now + 300, mods: { maxSpeed: 0.05 } }, now);
      game.sendTo(o, { t: 'toast', msg: 'You drove the orcas off the whale. The Choir hears of it.', kind: 'good' });
    }
  }
  if (whale?.alive) {
    const wb = S.brains.get(whale.id);
    if (wb) {
      wb.mode = 'flee';
      wb.fleeUntil = now + 40;
    }
  }
  pack.prey = null;
}

/** A hit on a pod that hunts a whale marks the captain as its saviour (from applyDamage's attackers). */
function markSaviors(game: Game): void {
  const S = bs(game);
  for (const pack of S.packs.values()) {
    if (pack.prey === null || pack.broken) continue;
    for (const m of pack.members) {
      const b = game.ships.get(m);
      if (!b) continue;
      for (const [id, t] of b.attackers) {
        if (t < game.now - 5) continue;
        const acc = game.ships.get(id)?.accountId;
        if (acc !== null && acc !== undefined) pack.saviors.add(acc);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ flensing

function startFlense(game: Game, s: PlayerSession, id: number): string | null {
  const S = bs(game);
  const ship = s.ship!;
  const c = S.carcasses.get(id);
  if (!c) return 'Nothing to flense here.';
  if (dist(c.x, c.y, ship.state.x, ship.state.y) > FLENSE_R + ship.stats.length / 2 || ship.state.speed > 1.5) return 'Heave to alongside the carcass first.';
  if (c.by !== null && c.by !== s.accountId) {
    const o = game.sessionByAccount(c.by)?.ship;
    if (o && dist(c.x, c.y, o.state.x, o.state.y) <= FLENSE_R + o.stats.length / 2 && o.state.speed <= 1.5) return 'Someone is already flensing it.';
  }
  c.by = s.accountId;
  S.paused.delete(s.accountId);
  game.sendTo(s, { t: 'toast', msg: `Flensing ${BEASTS[c.beast].name[0]}: the blood is in the water.`, kind: 'info' });
  sendHunt(game, ship, true);
  return null;
}

function stepCarcasses(game: Game): void {
  const S = bs(game);
  const now = game.now;
  for (const c of [...S.carcasses.values()]) {
    if (now > c.until) {
      S.carcasses.delete(c.id);
      continue;
    }
    const def = BEASTS[c.beast];
    if (c.by !== null) {
      const s = game.sessionByAccount(c.by);
      const ship = s?.ship;
      if (!s || !ship || !ship.alive || ship.docked || dist(c.x, c.y, ship.state.x, ship.state.y) > FLENSE_R + ship.stats.length / 2 || ship.state.speed > 1.5) {
        if (s && !S.paused.has(c.by)) {
          S.paused.add(c.by);
          game.sendTo(s, { t: 'toast', msg: 'Flensing stopped: stay alongside and hove to.', kind: 'bad' });
        }
        c.by = null;
        if (ship) sendHunt(game, ship, true);
      } else {
        // The sharks round the carcass get in the way of the knives.
        let sharks = 0;
        game.forShipsNear(c.x, c.y, 120, (o) => {
          if (o.alive && o.loadout.classId === 'shark') sharks++;
        });
        const rate = (1 / def.flense) * (ship.cls.passive.id === 'flensing_deck' ? 2 : 1) * (ship.hasFlag('tattoo_shark') ? 1 : Math.max(0.25, 1 - 0.25 * sharks));
        c.progress = Math.min(1, c.progress + rate);
        c.until = Math.max(c.until, now + 30);
        if (c.progress >= 1) {
          flensed(game, s, c);
          continue;
        }
        sendHunt(game, ship);
      }
    }
    // Blood in the water: the sharks — and in the cold seas the orcas — come for it.
    const bleeding = c.by !== null || now < c.freshUntil;
    if (bleeding && now >= c.nextBlood && c.called < 4) {
      c.nextBlood = now + 10;
      const region = regionAt(game.world, c.x, c.y);
      const cold = BEASTS.orca.regions.includes(region);
      if (cold && S.rng.chance(0.12)) {
        const p = openPoint(game, c.x, c.y, 700, 1000);
        if (p) {
          const g = spawnGroup(game, 'orca', p[0], p[1], clamp(c.level, 3, 8), S.rng.int(2, 3));
          for (const o of g) S.brains.get(o.id)!.blood = c.id;
          c.called += g.length;
          toastNear(game, c.x, c.y, 2000, 'Orcas come for the blood!', 'bad');
        }
      } else if (BEASTS.shark.regions.includes(region) && S.rng.chance(0.35)) {
        const p = openPoint(game, c.x, c.y, 500, 800);
        if (p) {
          const g = spawnGroup(game, 'shark', p[0], p[1], clamp(c.level - 1, 2, 6), S.rng.int(1, 2));
          for (const o of g) S.brains.get(o.id)!.blood = c.id;
          if (!c.called) toastNear(game, c.x, c.y, 2000, 'The sharks smell the blood.', 'info');
          c.called += g.length;
        }
      }
    }
  }
}

function toastNear(game: Game, x: number, y: number, r: number, msg: string, kind: 'info' | 'bad'): void {
  for (const s of game.sessions) if (s.ship && dist(s.ship.state.x, s.ship.state.y, x, y) < r) game.sendTo(s, { t: 'toast', msg, kind });
}

function flensed(game: Game, s: PlayerSession, c: Carcass): void {
  const S = bs(game);
  const def = BEASTS[c.beast];
  const ship = s.ship!;
  S.carcasses.delete(c.id);
  const k = yieldScale(c.beast, c.level) * (1 + trophyBonus(game, s.accountId, 'skull')) * omenCarcassMul(game); // a whaler's day (docs/12 P10 #9)
  for (const [g, [lo, hi]] of Object.entries(def.yields) as [GoodId, [number, number]][]) {
    const n = Math.round(S.rng.range(lo, hi + 0.99) * k - 0.49);
    if (n > 0) giveGoods(ship, g, n);
  }
  if (def.rare && S.rng.chance(def.rare.chance)) {
    giveGoods(ship, def.rare.good, 1);
    game.sendTo(s, { t: 'toast', msg: 'Ambergris! A lump of it in the belly — worth a fortune.', kind: 'gold' });
  }
  if (S.rng.chance(0.08)) takeItem(game, s, makeItem(game.rng, s.profile!.itemSeq++, { ilvl: c.level, source: 'common', slots: ['tackle', 'hold', 'rigging', 'coat', 'spyglass'] }));
  // The Order's licence: the catch is written down, and the Order remembers.
  if (hasLicence(s.profile!, 'harpoon', game.now)) {
    changeRep(s.profile!, 'harpoon', 1);
    game.sendTo(s, { t: 'toast', msg: 'The Order of the Harpoon marks your catch.', kind: 'good' });
  }
  game.sendTo(s, { t: 'toast', msg: `Flensed: ${def.name[0]}.`, kind: 'good' });
  tattooCount(game, s, 'flensed');
  sendHunt(game, ship, true);
}

// ------------------------------------------------------------------------------------------------ the second

/** Every second: groups rise and go, the carcasses bleed and are flensed, the views go out. */
export function beastSecond(game: Game): void {
  const S = bs(game);
  const now = game.now;
  if (game.directorOn && Math.floor(now) % 5 === 0) spawnAbout(game); // the living sea's own (off in most tests)
  markSaviors(game);
  // Out of every captain's sight: gone (not a beast on a line, nor one fighting).
  for (const [id, br] of S.brains) {
    const b = game.ships.get(id);
    if (!b) {
      S.brains.delete(id);
      continue;
    }
    if (br.beast === 'white_orca') continue; // her happening sends her away
    if ([...S.lines.values()].some((l) => l.beast === id) || b.inCombat(now) || [...b.attackers.values()].some((t) => t > now - 60)) continue;
    let far = true;
    for (const s of game.sessions) if (s.ship && dist(s.ship.state.x, s.ship.state.y, b.state.x, b.state.y) < DESPAWN_R) {
      far = false;
      break;
    }
    if (far || (br.mode === 'flee' && now > br.fleeUntil + 60 && (S.packs.get(br.pack)?.broken ?? false))) {
      S.brains.delete(id);
      game.removeShip(id);
    }
  }
  for (const pk of [...S.packs.values()]) if (!pk.members.some((m) => game.ships.get(m)?.alive)) S.packs.delete(pk.id);
  stepCarcasses(game);
  for (const s of game.sessions) {
    if (!s.ship) continue;
    sendHunt(game, s.ship);
    if (Math.floor(now) % 2 === 0) sendCarcasses(game, s);
  }
}

// ------------------------------------------------------------------------------------------------ what a captain sees

function nearCarcass(game: Game, ship: ShipEntity): Carcass | null {
  for (const c of bs(game).carcasses.values()) if (dist(c.x, c.y, ship.state.x, ship.state.y) <= FLENSE_R + ship.stats.length / 2 + 40) return c;
  return null;
}

export function huntView(game: Game, ship: ShipEntity): HuntView | null {
  const S = bs(game);
  const l = S.lines.get(ship.id);
  const b = l ? game.ships.get(l.beast) : undefined;
  const br = l ? S.brains.get(l.beast) : undefined;
  const acc = ship.accountId;
  const flense = acc !== null ? [...S.carcasses.values()].find((c) => c.by === acc) : undefined;
  const near = nearCarcass(game, ship);
  if (!l && !flense && !near) return null;
  const snap = LINE.SNAP * (ship.cls.passive.id === 'flensing_deck' ? 1.33 : 1);
  return {
    ...(l && b && br ? { line: { beast: br.beast, level: b.shipLevel, tension: Math.round(l.tension), stamina: Math.round((l.stamina / Math.max(1, l.max)) * 100) / 100, spent: l.stamina <= 0, snap: Math.round(snap), slack: LINE.SLACK, good: [LINE.GOOD_LO, LINE.GOOD_HI] as [number, number], payIn: Math.max(0, Math.ceil(l.payAt - game.now)), hull: Math.round((b.hull / Math.max(1, b.stats.hullMax)) * 100) / 100 } } : {}),
    ...(flense ? { flense: { id: flense.id, beast: flense.beast, progress: Math.round(flense.progress * 100) / 100 } } : {}),
    ...(near && !flense ? { carcass: { id: near.id, beast: near.beast } } : {}),
  };
}

function sendHunt(game: Game, ship: ShipEntity, force = false): void {
  const S = bs(game);
  const s = game.sessionOf(ship);
  if (!s) return;
  const v = huntView(game, ship);
  const key = v ? JSON.stringify(v) : '';
  const prev = S.sentHunt.get(s.accountId) ?? '';
  if (!force && key === prev) return;
  if (!v && !prev) return;
  S.sentHunt.set(s.accountId, key);
  game.sendTo(s, { t: 'hunt', view: v });
}

function sendCarcasses(game: Game, s: PlayerSession): void {
  const S = bs(game);
  const ship = s.ship!;
  const list: CarcassView[] = [];
  for (const c of S.carcasses.values()) {
    if (dist(c.x, c.y, ship.state.x, ship.state.y) > CARCASS_VIEW) continue;
    list.push({ id: c.id, beast: c.beast, x: Math.round(c.x), y: Math.round(c.y), h: Math.round(c.h * 100) / 100, progress: Math.round(c.progress * 10) / 10, blood: c.by !== null || game.now < c.freshUntil });
  }
  const key = JSON.stringify(list);
  if (S.sentCarc.get(s.accountId) === key) return;
  S.sentCarc.set(s.accountId, key);
  game.sendTo(s, { t: 'carcasses', list });
}

/** Whether a beast of this class is a beast of the hunt (for the labels and the law). */
export function isBeast(ship: ShipEntity): boolean {
  return ship.npcRole === 'beast' && beastOfClass(ship.loadout.classId) !== undefined;
}

/** Tests and the admin: the carcasses afloat. */
export function carcassesOf(game: Game): Readonly<Carcass>[] {
  return [...bs(game).carcasses.values()];
}

export function lineOf(game: Game, ship: ShipEntity): Readonly<Line> | undefined {
  return bs(game).lines.get(ship.id);
}

/** Every beast out of the world (tests). */
export function clearBeasts(game: Game): void {
  const S = bs(game);
  for (const id of S.brains.keys()) game.removeShip(id);
  S.brains.clear();
  S.packs.clear();
  S.lines.clear();
  S.carcasses.clear();
}

export function regionHasBeasts(region: RegionId): boolean {
  return BEAST_IDS.some((id) => BEASTS[id].weight > 0 && BEASTS[id].regions.includes(region)) && REGIONS[region] !== undefined;
}
