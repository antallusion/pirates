// Fishing on the server (docs/12 P3). Shoals drift about every sea (near the coasts and out on the open water),
// shown by the birds over them; a captain with tackle in the slot fishes as the tackle allows — and every catch is her
// own doing (owner, 2026-09-30: «fishing must not be automatic»):
//  - nets: in a shoal at a walking pace she casts, and hauls in as the floats dip (a quick mini-game, judged here);
//  - trolling rods: at a steady pace on open water, now and then a bite — and the fight on the line;
//  - pots: set on the shallows, hauled after ten minutes to half an hour (in lawless waters anyone may haul them);
//  - a lamp: by night, lying still, she hangs it out and hauls in what comes to the light (the same mini-game);
//  - a deep line: lying still over deep water, the slow bite of the big and strange.
// Every catch teaches the craft; the heaviest of each kind is the whole sea's record.

import { omenKept } from './omens.ts';
import { tattooCount } from './tattoos.ts';
import { trophyBonus } from './estate.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { questEvent } from './quests.ts';
import { SEA_LETTERS } from '../../../shared/src/data/encounters.ts';
import { CAST_COOLDOWN, FISH, FISH_IDS, HAUL_SHARE, METHOD_SKILL, READ_WATER, SKILL_MAX, TACKLE_METHOD, TRAP_FULL_SEC, TRAP_MIN_SEC, craftXpNext, fightParams, haulParams, judgeHaul, playFight, trapsAllowed } from '../../../shared/src/data/fishing.ts';
import type { FishDef, FishId, FishMethod } from '../../../shared/src/data/fishing.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { gearSource } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { dist } from '../../../shared/src/math.ts';
import type { FishFightView, FishingView, NetHaulView, ShoalView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { depthAt, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { giveGoods } from './director.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { holidayCatch } from './holidays.ts';
import { sagaNote } from './saga.ts';

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

/** A net (or a lamp) out: the haul the captain is playing. */
interface Haul {
  id: number;
  seed: number;
  craft: number;
  at: number;
  method: 'net' | 'lamp';
  /** The shoal the net went into (a lamp's catch comes to the light, no shoal). */
  shoal: number | null;
  fish: FishId;
}

interface FishState {
  shoals: Map<number, Shoal>;
  seq: number;
  fights: Map<number, Fight>;
  hauls: Map<number, Haul>;
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
  if (!s) states.set(game, (s = { shoals: new Map(), seq: 1, fights: new Map(), hauls: new Map(), deep: new Map(), last: new Map(), sentKey: new Map(), rng: new Rng(game.world.seed ^ 0xf154) }));
  return s;
}

export interface FishingProfile {
  skill: number;
  xp: number;
  caught: Partial<Record<FishId, { n: number; best: number }>>;
  traps: { id: number; x: number; y: number; placed: number; island: string }[];
  /** The plain drift net every captain is given once, so the first shoal on her way can be worked. */
  netGiven?: boolean;
}

export function sanitizeFishing(p: Profile): void {
  p.fishing ??= { skill: 1, xp: 0, caught: {}, traps: [] };
  p.fishing.skill = Math.max(1, Math.min(SKILL_MAX, p.fishing.skill ?? 1));
  p.fishing.caught ??= {};
  p.fishing.traps ??= [];
  // Nobody fished (owner, 2026-09-29): the tackle slot came empty and nets were only in the ports' shops. Every
  // captain now has a plain drift net aboard once; she can sell it, swap it or buy better.
  if (!p.fishing.netGiven) {
    p.fishing.netGiven = true;
    p.loadout.gear ??= {};
    p.itemSeq ??= 1;
    if (!p.loadout.gear.tackle) p.loadout.gear.tackle = { uid: p.itemSeq++, base: 'drift_net', ilvl: 1, rarity: 0, affixes: [], dur: 100 };
  }
}

/** Shoals kept in each sea: more near the busy coasts. */
const SHOALS_PER_REGION = 9;
const SHOAL_LIFE = 20 * 60;
const SHOAL_VIEW = 4500;

function nearestIsland(game: Game, x: number, y: number): { is: Island | null; d: number } {
  let best: Island | null = null, bd = Infinity;
  for (const is of game.world.islands) {
    if (is.minor) continue; // a sea stack is no coast to fish (docs/16 P3)
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
      const isl = game.world.islands.filter((is) => is.region === region && !is.minor);
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
/** A small shoal breaking the surface near a point, for a few minutes (the sea's small life, sealife.ts). */
export function shoalNear(game: Game, x: number, y: number, region: RegionId): boolean {
  const S = fs(game);
  const rng = S.rng;
  for (let k = 0; k < 10; k++) {
    const a = rng.float() * Math.PI * 2, r = rng.range(300, 900);
    const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r;
    if (isLand(game.world, sx, sy) || regionAt(game.world, sx, sy) !== region || !game.inZone(sx, sy)) continue;
    const fish = pickFish(game, sx, sy, 'net', SKILL_MAX) ?? pickFish(game, sx, sy, 'rod', SKILL_MAX);
    if (!fish) continue;
    const max = rng.int(20, 45);
    S.shoals.set(S.seq, { id: S.seq++, fish, x: sx, y: sy, r: rng.range(80, 150), stock: max, max, vx: rng.range(-0.5, 0.5), vy: rng.range(-0.5, 0.5), until: game.now + 240, region });
    return true;
  }
  return false;
}

/** A shoal of a kind right here (the admin's /shoal, for play-testing). */
export function shoalHere(game: Game, x: number, y: number, fish: FishId): Shoal {
  const S = fs(game);
  const sh: Shoal = { id: S.seq++, fish, x, y, r: 160, stock: 60, max: 60, vx: 0, vy: 0, until: game.now + SHOAL_LIFE, region: regionAt(game.world, x, y) };
  S.shoals.set(sh.id, sh);
  return sh;
}

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
function landCatch(game: Game, s: PlayerSession, fish: FishId, kg: number, units: number, fought = false, quiet = false): number {
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
  // The fish of the day (owner, 2026-09-29): one kind a day, twice the catch of it.
  let bonus = 0;
  if (fish === fishOfDay(game)) bonus = giveGoods(ship, def.good as GoodId, got);
  c.n += got + bonus;
  const first = c.best <= 0;
  const best = !first && kg > c.best;
  if (kg > c.best) c.best = Math.round(kg * 10) / 10;
  // Every haul is told (not only a fight): what came up, and a best of the kind.
  if (bonus > 0) game.sendTo(s, { t: 'toast', msg: `Fish of the day! ${def.name[0]} ×${got + bonus}`, kind: 'gold' });
  else if (!fought && !quiet) game.sendTo(s, { t: 'toast', msg: `Into the net: ${def.name[0]} ×${got}`, kind: 'good' });
  if (best && (fought || def.trophy)) game.sendTo(s, { t: 'toast', msg: `Your best ${def.name[0]} yet: ${Math.round(kg * 10) / 10} kg!`, kind: 'gold' });
  // The sea's record for the kind: a fish fought on the line, or a trophy in the net.
  if (fought || def.trophy) {
    const rec = game.db.getKv<Record<string, { name: string; kg: number }>>('fish_records') ?? {};
    if (kg > (rec[fish]?.kg ?? 0)) {
      rec[fish] = { name: s.name, kg: Math.round(kg * 10) / 10 };
      game.db.setKv('fish_records', rec);
      sagaNote(game, s, 'record_fish', [def.name[0]], Math.round(kg * 10) / 10);
      if (kg > def.kg[0] + (def.kg[1] - def.kg[0]) * 0.5) for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: A new record: ${s.name}, ${def.name[0]} ${Math.round(kg * 10) / 10} kg!`, kind: 'gold' });
    }
  }
  questEvent(game, s, { k: 'catch', units: got, kg, fought });
  holidayCatch(game, s, kg * Math.max(1, got)); // the Herring Run's tournament (docs/12 P10 #18)
  return got;
}

/** The day's kind (the same for everyone, by the calendar day): the common net fish, one in turn. */
export function fishOfDay(game: Game): FishId {
  const day = Math.floor(game.wallNow() / 86_400_000);
  const pool = FISH_IDS.filter((id) => FISH[id].methods.includes('net') && FISH[id].skill <= 20);
  return pool[((day % pool.length) + pool.length) % pool.length];
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
  // A net nobody hauls is lost with its catch (the screen closed, the wire dropped).
  for (const [acc, h] of S.hauls) if (now - h.at > haulParams(h.seed, h.craft).end + 20) {
    S.hauls.delete(acc);
    const s = game.sessionByAccount(acc);
    if (s) game.sendTo(s, { t: 'nethaul', view: null });
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
  if (!method || S.fights.has(s.accountId) || S.hauls.has(s.accountId)) return;
  if (f.skill < METHOD_SKILL[method]) return;
  if (method === 'rod') {
    if (spd < 2.5 || spd > max * 0.8) return; // a steady pace (light airs allowed), not a chase
    if (!every(game, s, 'rod', 10)) return;
    if (!fs(game).rng.chance(0.14 + craft * 0.004)) return;
    const fish = pickFish(game, ship.state.x, ship.state.y, 'rod', f.skill);
    if (fish) startFight(game, s, fish, 'rod', craft);
    return;
  }
}

// ------------------------------------------------------------------------------------------------ casting and hauling

function holdUsed(ship: ShipEntity): number {
  const st = ship.stats;
  return cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
}

/** Why the net (or the lamp) cannot go out here and now, or what it goes into. */
function castCheck(game: Game, s: PlayerSession): string | { method: 'net' | 'lamp'; shoal: Shoal | null; fish: FishId } {
  const ship = s.ship;
  const p = s.profile;
  if (!ship || !p || !ship.alive) return 'Not at sea';
  if (ship.docked) return 'Not in port: cast the net at sea';
  const f = p.fishing!;
  const method = tackleOf(p);
  if (method !== 'net' && method !== 'lamp') return method ? 'That tackle is not cast: it works on the line' : 'No net in the tackle slot';
  if (f.skill < METHOD_SKILL[method]) return `Your craft is not up to it yet (${f.skill} of ${METHOD_SKILL[method]})`;
  const S = fs(game);
  if (S.hauls.has(s.accountId) || S.fights.has(s.accountId)) return 'Your hands are full: finish this haul first';
  if (redTideIn(game, ship.region)) return 'The water is red and dead here: nothing bites.';
  const spd = ship.state.speed, max = Math.max(1, ship.stats.maxSpeed);
  const last = S.last.get(`${s.accountId}:cast`) ?? -1e9;
  if (game.now - last < CAST_COOLDOWN) return `The net is still being made ready (${Math.ceil(CAST_COOLDOWN - (game.now - last))} s)`;
  if (ship.stats.holdVolume - holdUsed(ship) < 0.5) return 'The hold is full: no room for the catch';
  if (method === 'lamp') {
    if (!isNight(game.now)) return 'The lamp draws them only by night';
    if (spd > 1.5) return 'Lie still to hang out the lamp';
    const fish = pickFish(game, ship.state.x, ship.state.y, 'lamp', f.skill);
    if (!fish) return 'Nothing comes to the light in these waters';
    return { method, shoal: null, fish };
  }
  const sh = shoalAt(game, ship.state.x, ship.state.y);
  if (!sh) return 'No shoal here: look for the gulls over the water';
  if (!FISH[sh.fish].methods.includes('net')) return 'This shoal will not go into a net: it wants a rod';
  if (FISH[sh.fish].skill > f.skill) return `This shoal is beyond your craft yet (${f.skill} of ${FISH[sh.fish].skill})`;
  if (spd > max * 0.4) return 'Too fast to cast: slow to a walking pace';
  return { method, shoal: sh, fish: sh.fish };
}

/** Whether the net can be cast now. */
export function canCast(game: Game, s: PlayerSession): boolean {
  return typeof castCheck(game, s) !== 'string';
}

/** The captain casts the net (or hangs out the lamp): the haul begins, to be played on her screen. */
export function castNet(game: Game, s: PlayerSession): string | null {
  const c = castCheck(game, s);
  if (typeof c === 'string') return c;
  const S = fs(game);
  const p = s.profile!;
  S.last.set(`${s.accountId}:cast`, game.now);
  const craft = craftOf(p);
  const haul: Haul = { id: S.seq++, seed: S.rng.int(1, 2 ** 30), craft, at: game.now, method: c.method, shoal: c.shoal?.id ?? null, fish: c.fish };
  S.hauls.set(s.accountId, haul);
  const read = (p.fishing?.skill ?? 1) >= READ_WATER || c.method === 'lamp';
  const view: NetHaulView = { id: haul.id, seed: haul.seed, craft, method: c.method, ...(read ? { fish: c.fish } : {}) };
  game.sendTo(s, { t: 'nethaul', view });
  return null;
}

/** The haul judged from the captain's pulls (seconds from the cast): the catch by the floats pulled in time. */
export function endHaul(game: Game, s: PlayerSession, id: number, pulls: number[]): string | null {
  const S = fs(game);
  const h = S.hauls.get(s.accountId);
  if (!h || h.id !== id) return 'That net is already in';
  const par = haulParams(h.seed, h.craft);
  // Not before the last float could have dipped (a little slack for the wire).
  if (game.now - h.at < par.dips[par.dips.length - 1] - 2) return 'The net is still out';
  S.hauls.delete(s.accountId);
  const { hits } = judgeHaul(par, Array.isArray(pulls) ? pulls.map(Number) : []);
  const ship = s.ship;
  const p = s.profile!;
  if (!ship) return null;
  const f = p.fishing!;
  const def = FISH[h.fish];
  const share = HAUL_SHARE[hits] ?? 0;
  const rng = S.rng;
  const told = (n: number) => game.sendTo(s, { t: 'nethaul', view: null, got: { fish: h.fish, n, hits } });
  if (share <= 0) {
    told(0);
    game.sendTo(s, { t: 'toast', msg: h.method === 'lamp' ? 'They slip away from the light: nothing in the net.' : 'The net comes up empty: every float was missed.', kind: 'info' });
    return null;
  }
  let n: number;
  if (h.method === 'net') {
    const sh = h.shoal !== null ? S.shoals.get(h.shoal) : undefined;
    if (!sh || sh.stock <= 0) {
      told(0);
      game.sendTo(s, { t: 'toast', msg: 'The shoal has moved on: the net comes up empty.', kind: 'info' });
      return null;
    }
    const well = (ship.cls.passive.id === 'wet_well' ? 2 : 1) * (1 + trophyBonus(game, s.accountId, 'fish')) * (ship.hasFlag('tattoo_fish') ? 1.1 : 1);
    n = Math.min(sh.stock, Math.max(1, Math.round(rng.int(2, 5) * (1 + h.craft / 40) * (1 + f.skill / 100) * well * share)));
    sh.stock -= n;
  } else n = Math.max(1, Math.round((rng.int(2, 3) + Math.floor(h.craft / 24)) * share));
  const kg = def.kg[0] + rng.float() * (def.kg[1] - def.kg[0]);
  const got = landCatch(game, s, h.fish, kg, n, false, true);
  told(got);
  if (got > 0) {
    learn(game, s, h.method === 'lamp' ? got * 2 : got);
    game.sendTo(s, { t: 'toast', msg: hits >= 3 ? `A full haul: ${def.name[0]} ×${got}` : `Hauled in: ${def.name[0]} ×${got}`, kind: 'good' });
  }
  if (h.method === 'net') {
    if (h.fish === 'ray' && rng.chance(0.08)) {
      ship.crew = Math.max(1, ship.crew - 1);
      game.sendTo(s, { t: 'toast', msg: 'A stingray lashes a man in the net.', kind: 'bad' });
    }
    // Rocks tear a net now and then.
    if (rng.chance(0.04) && nearestIsland(game, ship.state.x, ship.state.y).d < 400) {
      const it = p.loadout.gear?.tackle;
      if (it) it.dur = Math.max(0, it.dur - 10);
      game.sendTo(s, { t: 'toast', msg: 'The net tears on the rocks.', kind: 'bad' });
    }
  }
  oddCatch(game, s);
  game.pushSelf(s, true);
  return null;
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
