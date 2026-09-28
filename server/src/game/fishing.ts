// Fishing on the server (docs/12 P3). Shoals drift about every sea (near the coasts and out on the open water),
// shown by the birds over them; a captain with tackle in the slot fishes as the tackle allows:
//  - nets: through a shoal at a walking pace, a haul every few seconds while the shoal lasts;
//  - trolling rods: at a steady pace on open water, now and then a bite — and the fight on the line;
//  - pots: set on the shallows, hauled after ten minutes to half an hour (in lawless waters anyone may haul them);
//  - a lamp: by night, lying still, squid and eels come to the light;
//  - a deep line: lying still over deep water, the slow bite of the big and strange.
// Every catch teaches the craft; the heaviest of each kind is the whole sea's record.

import { omenKept } from './omens.ts';
import { tattooCount } from './tattoos.ts';
import { trophyBonus } from './estate.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { questEvent } from './quests.ts';
import { SEA_LETTERS } from '../../../shared/src/data/encounters.ts';
import { FISH, FISH_IDS, METHOD_SKILL, READ_WATER, SKILL_MAX, TACKLE_METHOD, TRAP_FULL_SEC, TRAP_MIN_SEC, craftXpNext, fightParams, playFight, trapsAllowed } from '../../../shared/src/data/fishing.ts';
import type { FishDef, FishId, FishMethod } from '../../../shared/src/data/fishing.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { gearSource } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { dist } from '../../../shared/src/math.ts';
import type { FishFightView, FishingView, ShoalView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { depthAt, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { giveGoods } from './director.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

export interface Shoal {
  id: number;
  fish: FishId;
  x: number;
  y: number;
  r: number;
  stock: number;
  max: number;
  vx: number;
  vy: number;
  until: number;
  region: RegionId;
}

interface Fight {
  id: number;
  fish: FishId;
  kg: number;
  seed: number;
  craft: number;
  at: number;
  method: FishMethod;
}

interface FishState {
  shoals: Map<number, Shoal>;
  seq: number;
  fights: Map<number, Fight>;
  /** A deep line down: account → when it bites. */
  deep: Map<number, { at: number; x: number; y: number }>;
  /** Last haul by tackle: account → world time. */
  last: Map<string, number>;
  sentKey: Map<number, string>;
  /** The water's own dice: fishing never shifts the rest of the world's. */
  rng: Rng;
}

const states = new WeakMap<Game, FishState>();

function fs(game: Game): FishState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { shoals: new Map(), seq: 1, fights: new Map(), deep: new Map(), last: new Map(), sentKey: new Map(), rng: new Rng(game.world.seed ^ 0xf154) }));
  return s;
}

export interface FishingProfile {
  skill: number;
  xp: number;
  caught: Partial<Record<FishId, { n: number; best: number }>>;
  traps: { id: number; x: number; y: number; placed: number; island: string }[];
}

export function sanitizeFishing(p: Profile): void {
  p.fishing ??= { skill: 1, xp: 0, caught: {}, traps: [] };
  p.fishing.skill = Math.max(1, Math.min(SKILL_MAX, p.fishing.skill ?? 1));
  p.fishing.caught ??= {};
  p.fishing.traps ??= [];
}

/** Shoals kept in each sea: more near the busy coasts. */
const SHOALS_PER_REGION = 9;
const SHOAL_LIFE = 20 * 60;
const SHOAL_VIEW = 4500;

function nearestIsland(game: Game, x: number, y: number): { is: Island | null; d: number } {
  let best: Island | null = null, bd = Infinity;
  for (const is of game.world.islands) {
    const d = dist(is.x, is.y, x, y) - is.radius;
    if (d < bd) {
      bd = d;
      best = is;
    }
  }
  return { is: best, d: bd };
}

/** Whether a kind of fish is found here and now (by a method). */
export function fishFits(game: Game, def: FishDef, x: number, y: number, method: FishMethod): boolean {
  if (!def.methods.includes(method) || def.weight <= 0) return false;
  const region = regionAt(game.world, x, y);
  if (def.regions && !def.regions.includes(region)) return false;
  const night = isNight(game.now);
  if (def.time === 'day' && night) return false;
  if (def.time === 'night' && !night) return false;
  if (def.time === 'fog' && game.weatherAt(x, y) !== 'fog') return false;
  if (def.coast || def.open || def.biomes) {
    const n = nearestIsland(game, x, y);
    if (def.coast && n.d > 2500) return false;
    if (def.open && n.d < 3000) return false;
    if (def.biomes && (!n.is || n.d > 4000 || !def.biomes.includes(n.is.biome))) return false;
  }
  return true;
}

/** A kind of fish for a method here, weighted; the craft limits what can be taken. */
function pickFish(game: Game, x: number, y: number, method: FishMethod, skill: number): FishId | null {
  const pool: [FishId, number][] = [];
  for (const id of FISH_IDS) {
    const def = FISH[id];
    if (def.skill > skill || !fishFits(game, def, x, y, method)) continue;
    pool.push([id, def.weight]);
  }
  if (!pool.length) return null;
  return fs(game).rng.weighted(pool);
}

function spawnShoal(game: Game, region: RegionId, force?: FishId, stockMul = 1): Shoal | null {
  const S = fs(game);
  const rng = fs(game).rng;
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 20; k++) {
    // Half by the coasts, half on open water (a forced coastal kind always by a coast).
    let x: number, y: number;
    if (force ? !!FISH[force].coast : rng.chance(0.5)) {
      const isl = game.world.islands.filter((is) => is.region === region);
      if (!isl.length) continue;
      const is = rng.pick(isl);
      const a = rng.float() * Math.PI * 2, r = is.radius + rng.range(300, 1800);
      x = is.x + Math.cos(a) * r;
      y = is.y + Math.sin(a) * r;
    } else {
      x = cx + rng.range(-12000, 12000);
      y = cy + rng.range(-12000, 12000);
    }
    if (isLand(game.world, x, y) || regionAt(game.world, x, y) !== region || !game.inZone(x, y)) continue;
    const fish = force ?? pickFish(game, x, y, 'net', SKILL_MAX) ?? pickFish(game, x, y, 'rod', SKILL_MAX);
    if (!fish) continue;
    const max = Math.round(rng.int(30, 70) * stockMul);
    const sh: Shoal = { id: S.seq++, fish, x, y, r: rng.range(90, 200), stock: max, max, vx: rng.range(-0.6, 0.6), vy: rng.range(-0.6, 0.6), until: game.now + SHOAL_LIFE, region };
    S.shoals.set(sh.id, sh);
    return sh;
  }
  return null;
}

/** Every shoal afloat (for the tests and the admin). */
export function shoalsOf(game: Game): Shoal[] {
  return [...fs(game).shoals.values()];
}

/** A herring run (docs/12 P3): thick shoals of herring crowd the coasts of a sea. */
export function herringShoals(game: Game, region: RegionId, n: number): number {
  let made = 0;
  for (let i = 0; i < n; i++) if (spawnShoal(game, region, 'herring', 2.5)) made++;
  return made;
}

/** A red tide (docs/12 P3): every shoal of the sea dies at once. */
export function killShoals(game: Game, region: RegionId): void {
  const S = fs(game);
  for (const sh of [...S.shoals.values()]) if (sh.region === region) S.shoals.delete(sh.id);
}

function redTideIn(game: Game, region: RegionId): boolean {
  return game.worldEvents.active(game).some((e) => e.kind === 'red_tide' && e.region === region);
}

/** The shoal a point lies in, if any. */
export function shoalAt(game: Game, x: number, y: number): Shoal | null {
  for (const sh of fs(game).shoals.values()) if (dist(sh.x, sh.y, x, y) <= sh.r) return sh;
  return null;
}

function craftOf(p: Profile): number {
  const worn = [...Object.values(p.captainGear), ...Object.values(p.loadout.gear ?? {})].filter((x): x is Item => !!x);
  // The Hook tattoo (docs/12 P9): a fish on the line is easier to play.
  return (gearSource(worn).cap.craft ?? 0) + (p.tattoos?.active.includes('hook') ? 10 : 0);
}

function tackleOf(p: Profile): FishMethod | null {
  const it = p.loadout.gear?.tackle;
  return it && it.dur > 0 ? TACKLE_METHOD[it.base] ?? null : null;
}

/** Experience of the craft; the skill rises. */
function learn(game: Game, s: PlayerSession, xp: number): void {
  const f = s.profile!.fishing!;
  if (f.skill >= SKILL_MAX) return;
  f.xp += xp;
  while (f.skill < SKILL_MAX && f.xp >= craftXpNext(f.skill)) {
    f.xp -= craftXpNext(f.skill);
    f.skill++;
    game.sendTo(s, { t: 'toast', msg: `Your fishing craft rises to ${f.skill}.`, kind: 'xp' });
    if (f.skill === READ_WATER) game.sendTo(s, { t: 'toast', msg: 'You can read the water now: every shoal shows what swims in it.', kind: 'good' });
  }
}

/** A catch into the hold (as goods), the tally and the record. */
function landCatch(game: Game, s: PlayerSession, fish: FishId, kg: number, units: number, fought = false): number {
  const ship = s.ship!;
  const def = FISH[fish];
  const got = giveGoods(ship, def.good as GoodId, units);
  if (got > 0) omenKept(game, s, 'fish'); // the dolphins' omen (docs/12 P10 #9)
  if (got <= 0) {
    // No room: the catch goes back over the side (said now and then, not every haul).
    if (every(game, s, 'full', 60)) game.sendTo(s, { t: 'toast', msg: 'The hold is full: the catch goes back over the side.', kind: 'bad' });
    return 0;
  }
  const f = s.profile!.fishing!;
  const c = (f.caught[fish] ??= { n: 0, best: 0 });
  c.n += got;
  if (kg > c.best) c.best = Math.round(kg * 10) / 10;
  // The sea's record for the kind: a fish fought on the line, or a trophy in the net.
  if (fought || def.trophy) {
    const rec = game.db.getKv<Record<string, { name: string; kg: number }>>('fish_records') ?? {};
    if (kg > (rec[fish]?.kg ?? 0)) {
      rec[fish] = { name: s.name, kg: Math.round(kg * 10) / 10 };
      game.db.setKv('fish_records', rec);
      if (kg > def.kg[0] + (def.kg[1] - def.kg[0]) * 0.5) for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: A new record: ${s.name}, ${def.name[0]} ${Math.round(kg * 10) / 10} kg!`, kind: 'gold' });
    }
  }
  questEvent(game, s, { k: 'catch', units: got, kg, fought });
  return got;
}

/** Now and then the water gives more than fish. */
function oddCatch(game: Game, s: PlayerSession): void {
  const r = fs(game).rng.float();
  const p = s.profile!;
  if (r < 0.001) {
    s.ship!.addEffect({ id: 'golden_fish', until: game.now + 3600, mods: { treasureHunter: 0.2, moraleRegen: 0.1 } }, game.now);
    game.sendTo(s, { t: 'toast', msg: 'A golden fish! It begs for its life and grants you luck for an hour.', kind: 'gold' });
  } else if (r < 0.006) {
    p.seaLetters ??= [];
    const missing = SEA_LETTERS.map((_, i) => i).filter((i) => !p.seaLetters!.includes(i));
    if (missing.length) p.seaLetters.push(fs(game).rng.pick(missing));
    questEvent(game, s, { k: 'letter' });
    game.sendTo(s, { t: 'toast', msg: 'In the net: a bottle with a letter inside.', kind: 'info' });
  } else if (r < 0.01) {
    mapChance(game, s, 1, 1, 'In the net');
  } else if (r < 0.013) {
    // A skull: three of them, and a hidden quest begins (docs/12 P9).
    game.sendTo(s, { t: 'toast', msg: 'A skull in the net.', kind: 'info' });
    tattooCount(game, s, 'skulls');
  }
}

// ------------------------------------------------------------------------------------------------ the second

export function stepFishing(game: Game): void {
  const S = fs(game);
  const now = game.now;
  // Shoals drift, thin out and go; new ones rise.
  for (const sh of [...S.shoals.values()]) {
    sh.x += sh.vx;
    sh.y += sh.vy;
    if (now > sh.until || sh.stock <= 0 || isLand(game.world, sh.x, sh.y)) S.shoals.delete(sh.id);
  }
  if (Math.floor(now) % 10 === 0) {
    const regions = (Object.keys(REGIONS) as RegionId[]).filter((r) => !game.zone || game.zone.regions.has(r));
    const events = game.worldEvents.active(game);
    for (const r of regions) {
      if (redTideIn(game, r)) continue;
      const here = [...S.shoals.values()].filter((x) => x.region === r);
      if (here.length < SHOALS_PER_REGION) spawnShoal(game, r);
      // A herring run keeps its coasts thick with herring while it lasts.
      if (events.some((e) => e.kind === 'herring_run' && e.region === r) && here.filter((x) => x.fish === 'herring').length < 8) spawnShoal(game, r, 'herring', 2.5);
    }
    npcFishers(game);
  }
  for (const s of game.sessions) {
    const ship = s.ship;
    const p = s.profile;
    if (!ship || !p || ship.docked || !ship.alive) continue;
    fishWith(game, s, ship, p);
    sendShoals(game, s);
  }
  // A line nobody plays for 45 s is lost.
  for (const [acc, f] of S.fights) if (now - f.at > 45) {
    S.fights.delete(acc);
    const s = game.sessionByAccount(acc);
    if (s) {
      game.sendTo(s, { t: 'fishfight', view: null });
      game.sendTo(s, { t: 'toast', msg: 'It shakes the hook and is gone.', kind: 'info' });
    }
  }
}

function every(game: Game, s: PlayerSession, key: string, sec: number): boolean {
  const S = fs(game);
  const k = `${s.accountId}:${key}`;
  const last = S.last.get(k) ?? -1e9;
  if (game.now - last < sec) return false;
  S.last.set(k, game.now);
  return true;
}

function fishWith(game: Game, s: PlayerSession, ship: ShipEntity, p: Profile): void {
  const S = fs(game);
  const f = p.fishing!;
  const method = tackleOf(p);
  if (method && redTideIn(game, ship.region)) {
    if (every(game, s, 'redtide', 90)) game.sendTo(s, { t: 'toast', msg: 'The water is red and dead here: nothing bites.', kind: 'info' });
    return;
  }
  const craft = craftOf(p);
  const spd = ship.state.speed, max = Math.max(1, ship.stats.maxSpeed);
  // A deep line's bite.
  const deep = S.deep.get(s.accountId);
  if (deep && game.now >= deep.at) {
    S.deep.delete(s.accountId);
    if (dist(ship.state.x, ship.state.y, deep.x, deep.y) < 150) {
      if (fs(game).rng.chance(0.05)) {
        game.sendTo(s, { t: 'toast', msg: 'Something enormous takes the line and the whole reel with it.', kind: 'bad' });
        return;
      }
      const fish = pickFish(game, ship.state.x, ship.state.y, 'deep', f.skill) ?? 'cod';
      startFight(game, s, fish, 'deep', craft);
    }
  }
  if (!method || S.fights.has(s.accountId)) return;
  if (f.skill < METHOD_SKILL[method]) return;
  if (method === 'net') {
    const sh = shoalAt(game, ship.state.x, ship.state.y);
    if (!sh || spd < 0.5 || spd > max * 0.4 || !FISH[sh.fish].methods.includes('net')) return;
    if (!every(game, s, 'net', 5)) return;
    const well = (ship.cls.passive.id === 'wet_well' ? 2 : 1) * (1 + trophyBonus(game, s.accountId, 'fish')) * (ship.hasFlag('tattoo_fish') ? 1.1 : 1);
    const n = Math.min(sh.stock, Math.max(1, Math.round(fs(game).rng.int(1, 3) * (1 + craft / 40) * (1 + f.skill / 100) * well)));
    if (FISH[sh.fish].skill > f.skill) return;
    sh.stock -= n;
    const kg = FISH[sh.fish].kg[0] + fs(game).rng.float() * (FISH[sh.fish].kg[1] - FISH[sh.fish].kg[0]);
    const got = landCatch(game, s, sh.fish, kg, n);
    if (got) learn(game, s, got);
    if (sh.fish === 'ray' && fs(game).rng.chance(0.08)) {
      ship.crew = Math.max(1, ship.crew - 1);
      game.sendTo(s, { t: 'toast', msg: 'A stingray lashes a man in the net.', kind: 'bad' });
    }
    // Rocks tear a net now and then.
    if (fs(game).rng.chance(0.02) && nearestIsland(game, ship.state.x, ship.state.y).d < 400) {
      const it = p.loadout.gear?.tackle;
      if (it) it.dur = Math.max(0, it.dur - 10);
      game.sendTo(s, { t: 'toast', msg: 'The net tears on the rocks.', kind: 'bad' });
    }
    oddCatch(game, s);
    return;
  }
  if (method === 'rod') {
    if (spd < 2.5 || spd > max * 0.8) return; // a steady pace (light airs allowed), not a chase
    if (!every(game, s, 'rod', 10)) return;
    if (!fs(game).rng.chance(0.14 + craft * 0.004)) return;
    const fish = pickFish(game, ship.state.x, ship.state.y, 'rod', f.skill);
    if (fish) startFight(game, s, fish, 'rod', craft);
    return;
  }
  if (method === 'lamp') {
    if (spd > 1.5 || !isNight(game.now)) return;
    if (!every(game, s, 'lamp', 8)) return;
    const fish = pickFish(game, ship.state.x, ship.state.y, 'lamp', f.skill);
    if (!fish) return;
    const def = FISH[fish];
    const kg = def.kg[0] + fs(game).rng.float() * (def.kg[1] - def.kg[0]);
    const got = landCatch(game, s, fish, kg, fs(game).rng.int(1, 2) + Math.floor(craft / 30));
    if (got) learn(game, s, got * 2);
    oddCatch(game, s);
  }
}

// ------------------------------------------------------------------------------------------------ the fight on the line

export function startFight(game: Game, s: PlayerSession, fish: FishId, method: FishMethod, craft: number): void {
  const S = fs(game);
  const def = FISH[fish];
  // The weight: most are middling, a few are monsters of their kind.
  const r = Math.pow(fs(game).rng.float(), 1.6);
  const kg = Math.round((def.kg[0] + r * (def.kg[1] - def.kg[0])) * 10) / 10;
  const fight: Fight = { id: S.seq++, fish, kg, seed: fs(game).rng.int(1, 2 ** 30), craft, at: game.now, method };
  S.fights.set(s.accountId, fight);
  const view: FishFightView = { id: fight.id, fish, kg, seed: fight.seed, craft };
  game.sendTo(s, { t: 'fishfight', view });
  game.sendTo(s, { t: 'toast', msg: 'A bite! Play it: hold to reel in, let it run when the line is taut.', kind: 'info' });
}

/** The captain's play of the line, judged by replaying it. */
export function endFight(game: Game, s: PlayerSession, id: number, holds: [number, number][]): string | null {
  const S = fs(game);
  const f = S.fights.get(s.accountId);
  if (!f || f.id !== id) return 'That fish is gone';
  S.fights.delete(s.accountId);
  const res = playFight(fightParams(f.fish, f.kg, f.seed), Array.isArray(holds) ? holds : [], f.craft);
  game.sendTo(s, { t: 'fishfight', view: null });
  const def = FISH[f.fish];
  if (res.done === 'landed') {
    const units = Math.max(1, Math.round(f.kg / 10));
    landCatch(game, s, f.fish, f.kg, units, true);
    tattooCount(game, s, 'fought');
    learn(game, s, 5 + Math.round(f.kg / 15));
    game.sendTo(s, { t: 'toast', msg: `Landed: ${def.name[0]}, ${f.kg} kg.`, kind: 'good' });
    if (f.fish === 'moray' && fs(game).rng.chance(0.25)) game.sendTo(s, { t: 'toast', msg: 'A moray bites a hand on the line.', kind: 'bad' });
    oddCatch(game, s);
  } else if (res.done === 'snapped') game.sendTo(s, { t: 'toast', msg: 'The line snaps. It was a big one.', kind: 'bad' });
  else game.sendTo(s, { t: 'toast', msg: 'It shakes the hook and is gone.', kind: 'info' });
  return null;
}

/** A deep line down: lying still over deep water. */
export function dropDeepLine(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const f = p.fishing!;
  if (tackleOf(p) !== 'rod') return 'No tackle in that slot';
  if (f.skill < METHOD_SKILL.deep) return `Your craft is not up to it yet (${f.skill} of ${METHOD_SKILL.deep})`;
  if (ship.state.speed > 1.5 || depthAt(game.world, ship.state.x, ship.state.y) < 40) return 'The deep line wants still water over a deep drop';
  fs(game).deep.set(s.accountId, { at: game.now + fs(game).rng.range(20, 60), x: ship.state.x, y: ship.state.y });
  game.sendTo(s, { t: 'toast', msg: 'The deep line goes down into the dark.', kind: 'info' });
  return null;
}

// ------------------------------------------------------------------------------------------------ pots

let trapSeq = 1;

export function setTrap(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const f = p.fishing!;
  if (tackleOf(p) !== 'trap') return 'No tackle in that slot';
  if (f.skill < METHOD_SKILL.trap) return `Your craft is not up to it yet (${f.skill} of ${METHOD_SKILL.trap})`;
  const n = nearestIsland(game, ship.state.x, ship.state.y);
  if (!n.is || n.d > 1500) return 'Pots go down in the shallows, within a mile of land';
  if (f.traps.length >= trapsAllowed(f.skill) + (s.ship?.hasFlag('tattoo_octopus') ? 1 : 0)) return `You have ${f.traps.length} pots out already`;
  f.traps.push({ id: Date.now() * 10 + (trapSeq++ % 10), x: Math.round(ship.state.x), y: Math.round(ship.state.y), placed: game.wallNow(), island: n.is.name });
  game.sendTo(s, { t: 'toast', msg: 'A pot goes down: haul it in ten minutes or more.', kind: 'info' });
  game.pushSelf(s, true);
  return null;
}

/** Hauls the nearest pot: one's own anywhere, another's in lawless waters (and its owner hears). */
export function haulTrap(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const near = (t: { x: number; y: number }) => dist(t.x, t.y, ship.state.x, ship.state.y) < 90;
  let owner: Profile = p, ownerSession: PlayerSession | null = s;
  let trap = p.fishing!.traps.find(near);
  if (!trap && REGIONS[ship.region].safety === 'lawless') {
    for (const o of game.sessions) {
      const t = o !== s ? o.profile?.fishing?.traps.find(near) : undefined;
      if (t) {
        trap = t;
        owner = o.profile!;
        ownerSession = o;
        break;
      }
    }
  }
  if (!trap) return 'No pot of yours near';
  const mins = (game.wallNow() - trap.placed) / 60000;
  if (owner === p && mins * 60 < TRAP_MIN_SEC) return `Too soon: the pot has been down ${Math.floor(mins)} min`;
  owner.fishing!.traps = owner.fishing!.traps.filter((t) => t !== trap);
  if (owner !== p && ownerSession) game.sendTo(ownerSession, { t: 'toast', msg: `Someone hauls your pot off ${trap.island}: gone, catch and all.`, kind: 'bad' });
  const fill = Math.min(1, (mins * 60) / TRAP_FULL_SEC);
  const fish = pickFish(game, trap.x, trap.y, 'trap', p.fishing!.skill) ?? 'crab';
  const n = Math.round((2 + fs(game).rng.int(0, 4) + craftOf(p) / 15) * fill);
  if (n <= 0) {
    game.sendTo(s, { t: 'toast', msg: 'The pot comes up empty.', kind: 'info' });
    return null;
  }
  const def = FISH[fish];
  const got = landCatch(game, s, fish, def.kg[0] + fs(game).rng.float() * (def.kg[1] - def.kg[0]), n);
  learn(game, s, got * 2);
  game.sendTo(s, { t: 'toast', msg: `The pot comes up: ${got} ${def.name[0]}.`, kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** Salting the fresh catch aboard: a measure of salt keeps four of fish. */
export function saltCatch(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const fish = Math.floor(ship.cargo.fish ?? 0);
  const salt = Math.floor(ship.cargo.salt ?? 0);
  const n = Math.min(fish, salt * 4);
  if (n <= 0) return 'Nothing to salt: fresh fish and salt are both needed';
  const used = Math.ceil(n / 4);
  ship.cargo.fish = fish - n;
  if (!ship.cargo.fish) delete ship.cargo.fish;
  ship.cargo.salt = salt - used;
  if (!ship.cargo.salt) delete ship.cargo.salt;
  ship.cargo.salted_fish = (ship.cargo.salted_fish ?? 0) + n;
  game.sendTo(s, { t: 'toast', msg: `Salted: ${n} fish into ${n} barrels.`, kind: 'info' });
  game.pushSelf(s, true);
  return null;
}

// ------------------------------------------------------------------------------------------------ the sea's own fishers

/** NPC fishing boats work the shoals near their ports: the shoals thin, and the fish goes to their holds. */
function npcFishers(game: Game): void {
  const S = fs(game);
  for (const [id, b] of game.npcs) {
    if (b.role !== 'fisher') continue;
    const ship = game.ships.get(id);
    if (!ship) continue;
    for (const sh of S.shoals.values()) {
      if (dist(sh.x, sh.y, ship.state.x, ship.state.y) > 2000 || sh.stock <= 5) continue;
      sh.stock -= 2;
      ship.cargo.fish = Math.min(40, (ship.cargo.fish ?? 0) + 2);
      break;
    }
  }
}

// ------------------------------------------------------------------------------------------------ what a captain sees

function sendShoals(game: Game, s: PlayerSession): void {
  const S = fs(game);
  const ship = s.ship!;
  if (Math.floor(game.now) % 2 !== 0) return;
  const read = (s.profile!.fishing?.skill ?? 1) >= READ_WATER;
  const list: ShoalView[] = [];
  for (const sh of S.shoals.values()) {
    if (dist(sh.x, sh.y, ship.state.x, ship.state.y) > SHOAL_VIEW) continue;
    list.push({ id: sh.id, x: Math.round(sh.x), y: Math.round(sh.y), r: Math.round(sh.r), full: Math.round((sh.stock / sh.max) * 10) / 10, ...(read ? { fish: sh.fish } : {}) });
  }
  const key = list.map((x) => `${x.id}:${Math.round(x.x / 50)}:${Math.round(x.y / 50)}:${x.full}`).join(',');
  if (S.sentKey.get(s.accountId) === key) return;
  S.sentKey.set(s.accountId, key);
  game.sendTo(s, { t: 'shoals', list });
}

/** The fishing part of a captain's papers. */
export function fishingView(p: Profile): FishingView {
  const f = p.fishing ?? { skill: 1, xp: 0, caught: {}, traps: [] };
  return { skill: f.skill, xp: f.xp, next: craftXpNext(f.skill), caught: f.caught, traps: f.traps.map((t) => ({ id: t.id, x: t.x, y: t.y, placed: t.placed, island: t.island })), method: tackleOf(p) };
}

export function fishRecords(game: Game): Record<string, { name: string; kg: number }> {
  return game.db.getKv<Record<string, { name: string; kg: number }>>('fish_records') ?? {};
}
