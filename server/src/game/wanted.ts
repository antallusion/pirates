// The wanted (docs/12 P5): the named pirates at sea by their habits, with their lieutenants and their tricks; the
// trail they leave (sightings by fishers and lighthouses, what a tavern informant sells); their bounties and the
// Hunters' Guild's ranks; the barons of the Brethren, who show themselves to a hunter who has sunk three of their
// captains; the lairs on the islands — a battery to silence from the sea, then a landing for the chest and the
// prisoners; and the trail of a wanted captain for a licensed hunter.

import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { nemesisBonus, nemesisEscaped, nemesisRevenge, nemesisViews, stepNemesis } from './nemesis.ts';
import { questEvent } from './quests.ts';
import { trophyBonus } from './estate.ts';
import {
  BARON_AFTER, CAPTAIN_KILLER, HUNTER_BONUS, HUNTER_BONUS_RANK, HUNTER_PENNANT, HUNTER_PENNANT_RANK, HUNTER_POINTS, HUNTER_RANKS, HUNTER_SIGHT_R,
  HUNTER_SIGHT_RANK, HUNTER_TITLE, HUNTER_TITLE_RANK, INFORMANT_SEC, PIRATE_SEAS, RESPAWN_H, baronOf, hunterRank, informantCost, namedPirates, pirateById,
} from '../../../shared/src/data/pirates.ts';
import type { NamedPirate } from '../../../shared/src/data/pirates.ts';
import { SETS } from '../../../shared/src/data/items.ts';
import type { Slot } from '../../../shared/src/data/items.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { dist } from '../../../shared/src/math.ts';
import type { WantedPoster, WantedView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { wantedLevel } from '../../../shared/src/data/factions.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { islandLife } from '../../../shared/src/world/islandlife.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { spawnFireship } from './npc.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession, Profile } from './player.ts';
import { changeRep } from './player.ts';
import { grantDeed } from './progression.ts';
import { hunterLicence } from './pvp.ts';
import type { ShipEntity } from './ship.ts';

const HOUR = 3600_000;
const WEEK = 7 * 24 * HOUR;
const LIVE_PER_SEA: Record<string, number> = { safe: 1, contested: 2, lawless: 3 };
const DESPAWN_R = 12000;
const LAIR_BATTERY_R = 550;
const LAIR_HIT_R = 140;
const LAIR_OPEN_MIN = 20;
const LAIR_REBUILD_H = 6;

interface Live {
  id: string;
  ship: number;
  lts: number[];
  region: RegionId;
  farSince: number;
  calledOut: Set<number>;
  fireshipAt: number;
  seenAt: number;
}

interface Rec {
  /** Wall time she may put to sea again (0: free now). */
  respawnAt?: number;
  lastSeen?: { x: number; y: number; t: number; region: RegionId };
  battery?: number;
  /** Wall time the lair's battery is rebuilt (while silenced). */
  lairOpenUntil?: number;
  lairRebuildAt?: number;
  /** Game time until which the battery, struck, answers every ship in range. */
  awakeUntil?: number;
}

interface Lair {
  id: string;
  island: number;
  name: string;
  x: number;
  y: number;
  max: number;
}

interface WantedState {
  live: Map<string, Live>;
  rec: Record<string, Rec>;
  lairs: Map<string, Lair>;
  informed: Map<number, { id: string; x: number; y: number; until: number }>;
  rogues: { name: string; x: number; y: number; r: number; t: number }[];
  roguesAt: number;
  sent: Map<number, string>;
  rng: Rng;
  loaded: boolean;
  dirty: boolean;
}

const states = new WeakMap<Game, WantedState>();

function ws(game: Game): WantedState {
  let s = states.get(game);
  if (!s) {
    s = { live: new Map(), rec: {}, lairs: new Map(), informed: new Map(), rogues: [], roguesAt: -1e9, sent: new Map(), rng: new Rng(game.world.seed ^ 0x3a17ed), loaded: false, dirty: false };
    states.set(game, s);
  }
  if (!s.loaded) {
    s.loaded = true;
    s.rec = game.db.getKv<Record<string, Rec>>('named_pirates') ?? {};
    placeLairs(game, s);
  }
  return s;
}

function save(game: Game): void {
  const S = ws(game);
  if (!S.dirty) return;
  S.dirty = false;
  game.db.setKv('named_pirates', S.rec);
}

// ------------------------------------------------------------------------------------------------ the lairs

/** Each named captain's lair: an island of her sea with a pirates' camp (the same on every boot of the world). */
function placeLairs(game: Game, S: WantedState): void {
  // Islands with a pirates' camp of their own first; in a sea without one, any islet off the shipping (the lair
  // makes its own camp there).
  const camps = new Map<RegionId, { is: Island; x: number; y: number }[]>();
  const islets = new Map<RegionId, { is: Island; x: number; y: number }[]>();
  for (const is of game.world.islands) {
    if (is.portId) continue;
    const camp = islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: is.radius, poly: is.poly, features: is.features }).find((l) => l.kind === 'pirate_camp');
    if (camp) {
      const list = camps.get(is.region) ?? [];
      list.push({ is, x: camp.x, y: camp.y });
      camps.set(is.region, list);
    } else if (is.radius >= 200 && is.poly.length >= 6) {
      const list = islets.get(is.region) ?? [];
      // A camp just inside the coast: the first vertex drawn a third of the way to the middle.
      list.push({ is, x: is.poly[0] + (is.x - is.poly[0]) * 0.3, y: is.poly[1] + (is.y - is.poly[1]) * 0.3 });
      islets.set(is.region, list);
    }
  }
  // Each captain her own island where the sea has enough: the camps first, then islets in a fixed shuffle.
  for (const region of new Set(namedPirates().map((p) => p.region))) {
    const pool = [...(camps.get(region) ?? []), ...(islets.get(region) ?? []).sort((a, b) => hash(`${a.is.id}`) - hash(`${b.is.id}`))];
    if (!pool.length) continue;
    namedPirates().filter((p) => p.region === region).forEach((p, i) => {
      const c = pool[i % pool.length];
      S.lairs.set(p.id, { id: p.id, island: c.is.id, name: c.is.name, x: c.x, y: c.y, max: 800 + 220 * p.level });
    });
  }
}

/** A lair's island offers its camp to a landing party even where the island's own life has none. */
export function lairIsland(game: Game, island: number): boolean {
  for (const l of ws(game).lairs.values()) if (l.island === island) return true;
  return false;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

export function lairOf(game: Game, id: string): Readonly<Lair> | undefined {
  return ws(game).lairs.get(id);
}

/** A lair's battery: whole unless silenced (and rebuilt after six hours). */
function battery(game: Game, lair: Lair): number {
  const r = ws(game).rec[lair.id] ?? {};
  if (r.lairRebuildAt && game.wallNow() >= r.lairRebuildAt) {
    delete r.lairRebuildAt;
    delete r.lairOpenUntil;
    r.battery = lair.max;
  }
  return r.battery ?? lair.max;
}

/** Shot falling near a lair's camp (from combat, where balls land): the battery takes it. */
export function lairImpact(game: Game, x: number, y: number, damage: number, owner: number): void {
  const S = ws(game);
  for (const lair of S.lairs.values()) {
    if (Math.abs(lair.x - x) > LAIR_HIT_R || Math.abs(lair.y - y) > LAIR_HIT_R || dist(lair.x, lair.y, x, y) > LAIR_HIT_R) continue;
    const hp = battery(game, lair);
    if (hp <= 0) return;
    const r = (S.rec[lair.id] ??= {});
    r.battery = Math.max(0, hp - damage);
    r.awakeUntil = game.now + 300;
    S.dirty = true;
    if (r.battery <= 0) {
      r.lairOpenUntil = game.wallNow() + LAIR_OPEN_MIN * 60_000;
      r.lairRebuildAt = game.wallNow() + LAIR_REBUILD_H * HOUR;
      const by = game.ships.get(owner);
      for (const s of game.sessions) if (s.ship && dist(s.ship.state.x, s.ship.state.y, lair.x, lair.y) < 3000) game.sendTo(s, { t: 'toast', msg: `The lair’s battery on ${lair.name} is silenced. Land now — the lair is open.`, kind: 'gold' });
      void by;
    }
    return;
  }
}

/** A landing at an island's pirate camp (exploration): a lair's battery drives the boats off; a silenced one lets
 *  the party storm the lair — its chest and its prisoners. Returns true when it was a lair's landing. */
export function lairLanding(game: Game, s: PlayerSession, island: Island): boolean {
  const S = ws(game);
  const lair = [...S.lairs.values()].find((l) => l.island === island.id);
  if (!lair) return false;
  const ship = s.ship!;
  const p = s.profile!;
  const hp = battery(game, lair);
  const r = (S.rec[lair.id] ??= {});
  if (hp > 0) {
    const lost = Math.min(ship.crew - 1, S.rng.int(3, 8));
    ship.crew -= Math.max(0, lost);
    ship.morale = Math.max(0, ship.morale - 10);
    game.sendTo(s, { t: 'toast', msg: 'The lair’s battery drives your boats off!', kind: 'bad' });
    return true;
  }
  if (!r.lairOpenUntil || game.wallNow() > r.lairOpenUntil) {
    // Silenced but already stormed (or the chance is past): an empty camp.
    return false;
  }
  const np = pirateById(lair.id)!;
  const chest = Math.round((1200 + 380 * np.level) * S.rng.range(0.8, 1.2));
  const prisoners = S.rng.int(4, 10);
  p.gold += chest;
  game.db.ledger(s.accountId, 'lair', chest, lair.id);
  const room = Math.max(0, ship.stats.crewMax - ship.crew);
  ship.crew += Math.min(room, prisoners);
  p.refugees = (p.refugees ?? 0) + 2; // some would rather live ashore on their saviour's island (docs/12 P7)
  // The prisoners' people remember who freed them.
  const lawful = (['crown', 'league'] as const)[S.rng.int(0, 1)];
  changeRep(p, lawful, 5);
  delete r.lairOpenUntil;
  S.dirty = true;
  game.sendTo(s, { t: 'toast', msg: `The lair of ${np.name[0]} is stormed: ${chest} silver from its chest, ${prisoners} prisoners freed.`, kind: 'gold' });
  if (room > 0) game.sendTo(s, { t: 'toast', msg: 'The freed prisoners join your crew.', kind: 'good' });
  game.grantXp(s, 300 + 60 * np.level, `Sank ${np.name[0]}`);
  return true;
}

function stepLairs(game: Game): void {
  const S = ws(game);
  if (Math.floor(game.now) % 6 !== 0) return;
  for (const lair of S.lairs.values()) {
    if (battery(game, lair) <= 0) continue;
    // Asleep, it fires only on a ship that comes too close, and never in safe waters; struck, on all in range.
    const awake = (S.rec[lair.id]?.awakeUntil ?? 0) > game.now;
    const island = game.world.islands[lair.island];
    const unsafe = !!island && REGIONS[island.region].safety !== 'safe';
    if (!awake && !unsafe) continue;
    game.forShipsNear(lair.x, lair.y, LAIR_BATTERY_R, (o) => {
      if (!o.isPlayer || !o.alive || o.docked) return;
      const d = dist(o.state.x, o.state.y, lair.x, lair.y);
      if (d > (awake ? LAIR_BATTERY_R : 350)) return;
      applyDamage(game, o, { hull: o.stats.hullMax * 0.03, sails: o.stats.sailHpMax * 0.02 }, null);
      if (!o.attackers.has(-lair.island)) game.toastShip(o, `The lair’s battery on ${lair.name} opens fire!`, 'bad');
      o.attackers.set(-lair.island, game.now);
      game.emit({ k: 'fx', fx: 'barrage', x: Math.round(o.state.x), y: Math.round(o.state.y), r: 40 }, o.state.x, o.state.y);
    });
  }
}

// ------------------------------------------------------------------------------------------------ at sea

function fits(game: Game, np: NamedPirate, x: number, y: number): boolean {
  const night = isNight(game.now);
  if (np.time === 'night' && !night) return false;
  if (np.time === 'day' && night) return false;
  const w = game.weatherAt(x, y);
  if (np.weather === 'fog' && w !== 'fog') return false;
  if (np.weather === 'storm' && w !== 'storm' && w !== 'black_storm') return false;
  return true;
}

function freePoint(game: Game, x: number, y: number, r0: number, r1: number, region: RegionId): [number, number] | null {
  const S = ws(game);
  for (let k = 0; k < 16; k++) {
    const a = S.rng.float() * Math.PI * 2, r = S.rng.range(r0, r1);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (isLand(game.world, px, py) || regionAt(game.world, px, py) !== region || !game.inZone(px, py)) continue;
    return [px, py];
  }
  return null;
}

/** A named captain puts to sea with her lieutenants, some miles off a captain in her waters. */
export function putToSea(game: Game, np: NamedPirate, near: ShipEntity): ShipEntity | null {
  const S = ws(game);
  const pt = freePoint(game, near.state.x, near.state.y, 3500, 6500, np.region);
  if (!pt) return null;
  // A nemesis sails levels above himself against the captain he hunts, on a bigger hull if his own tops out
  // (docs/12 P10 #1; the ladder of levels keeps each hull to its span).
  const bonus = nemesisBonus(game, np, near);
  const lvl = Math.min(10, np.level + bonus);
  const hulls = bonus ? hullsFor('pirate', lvl) : [];
  const cls = hulls.length && !hulls.includes(np.cls) ? hulls[S.rng.int(0, hulls.length - 1)] : np.cls;
  const ship = game.spawnNpcShip('pirate', cls, 'confederacy', pt[0], pt[1], S.rng.float() * Math.PI * 2, { ship: np.ship[0], captain: np.name[0] });
  game.setNpcLevel(ship, lvl);
  ship.named = np.id;
  ship.fleeAt = np.temper === 'coward' ? 0.45 : np.temper === 'brute' ? 0 : undefined;
  if (np.baron) {
    ship.elite = true;
    game.setNpcLevel(ship, lvl);
  }
  ship.purse = (ship.purse ?? 0) + Math.round(np.bounty * 0.3);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x: pt[0], y: pt[1], r: 6000 };
  brain.expiresAt = 0;
  const lts: number[] = [];
  np.lieutenants.forEach((lt, i) => {
    const lp = freePoint(game, pt[0], pt[1], 120, 300, np.region);
    if (!lp) return;
    const l = game.spawnNpcShip('pirate', lt.cls, 'confederacy', lp[0], lp[1], ship.state.heading, { ship: lt.name[0], captain: lt.name[0] });
    game.setNpcLevel(l, lt.level);
    l.namedMate = `${np.id}#${i}`;
    const lb = game.npcs.get(l.id)!;
    lb.leader = ship.id;
    lb.slot = i + 1;
    lts.push(l.id);
  });
  S.live.set(np.id, { id: np.id, ship: ship.id, lts, region: np.region, farSince: game.now, calledOut: new Set(), fireshipAt: 0, seenAt: 0 });
  return ship;
}

/** Every second: the named at sea keep their habits, leave their trail, and go home when nobody is near. */
export function stepWanted(game: Game): void {
  const S = ws(game);
  const now = game.now, wall = game.wallNow();
  stepLairs(game);
  for (const [id, live] of [...S.live]) {
    const ship = game.ships.get(live.ship);
    const np = pirateById(id)!;
    if (!ship || !ship.alive) {
      // Gone down without a hunter's name on it: she comes back all the same.
      S.live.delete(id);
      const r = (S.rec[id] ??= {});
      if (!r.respawnAt || r.respawnAt < wall) r.respawnAt = wall + respawnDelay(S, np);
      S.dirty = true;
      continue;
    }
    // Nobody near for two minutes: she sails out of the story (and her mates with her).
    let near: ShipEntity | null = null, nd = DESPAWN_R;
    for (const s of game.sessions) {
      const o = s.ship;
      if (!o || o.docked || !o.alive) continue;
      const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y);
      if (d < nd) {
        nd = d;
        near = o;
      }
    }
    if (!near) {
      if (now - live.farSince > 120 && !ship.inCombat(now)) {
        seen(game, id, ship);
        nemesisEscaped(game, np, ship); // hurt and gone: a grudge on both sides
        for (const l of live.lts) game.removeShip(l);
        game.removeShip(ship.id);
        S.live.delete(id);
      }
      continue;
    }
    live.farSince = now;
    // Her trail: fishers and lighthouses see her now and then.
    if (now - live.seenAt > 30) {
      live.seenAt = now;
      seen(game, id, ship);
    }
    const brain = game.npcs.get(ship.id);
    // The proud one calls a captain out when she comes in sight.
    if (np.temper === 'proud' && near.isPlayer && nd < 1600 && !live.calledOut.has(near.id)) {
      live.calledOut.add(near.id);
      game.toastShip(near, `${np.name[0]} hoists the black and calls you out!`, 'bad');
    }
    // Her trick: a fireship sent ahead of her, once in a while.
    if (np.trick === 'fireship' && brain?.target !== null && brain?.target !== undefined && now - live.fireshipAt > 180) {
      const prey = game.ships.get(brain.target);
      if (prey?.isPlayer && dist(prey.state.x, prey.state.y, ship.state.x, ship.state.y) < 1400) {
        live.fireshipAt = now;
        spawnFireship(game, prey);
      }
    }
    // The coward runs when she is hurt.
    if (np.temper === 'coward' && ship.hull < ship.stats.hullMax * 0.45 && brain && brain.fleeFrom === null && brain.target !== null) {
      brain.fleeFrom = brain.target;
      game.toastNear(ship, `${np.name[0]} loses her nerve and runs!`);
    }
  }
  if (game.directorOn && Math.floor(now) % 10 === 0) spawnAbout(game);
  if (game.directorOn && Math.floor(now) % 60 === 0) stepNemesis(game); // a nemesis finds his captain's wake
  // Informants' word lapses.
  for (const [acc, inf] of S.informed) if (now > inf.until) S.informed.delete(acc);
  // The licensed hunters' trail of wanted captains: a 3 km circle about each, moved once a minute.
  if (now - S.roguesAt >= 60) {
    S.roguesAt = now;
    S.rogues = [];
    for (const s of game.sessions) {
      const o = s.ship, p = s.profile;
      if (!o || !p || o.docked || wantedLevel(p.infamy) < 2) continue;
      const a = S.rng.float() * Math.PI * 2, off = S.rng.float() * 2500;
      S.rogues.push({ name: s.name, x: Math.round(o.state.x + Math.cos(a) * off), y: Math.round(o.state.y + Math.sin(a) * off), r: 3000, t: wall });
    }
  }
  if (Math.floor(now) % 5 === 0) for (const s of game.sessions) sendWanted(game, s);
  if (Math.floor(now) % 60 === 0) save(game);
}

function respawnDelay(S: WantedState, np: NamedPirate): number {
  if (np.baron) return WEEK;
  return S.rng.range(RESPAWN_H[0], RESPAWN_H[1]) * HOUR;
}

function seen(game: Game, id: string, ship: ShipEntity): void {
  const S = ws(game);
  const r = (S.rec[id] ??= {});
  r.lastSeen = { x: Math.round(ship.state.x), y: Math.round(ship.state.y), t: game.wallNow(), region: regionAt(game.world, ship.state.x, ship.state.y) };
  S.dirty = true;
}

/** Every ten seconds: in each sea with a captain at sea, the named keep their number (the barons for those who
 *  have earned them). A full hold under false colours or a false bulwark draws them — the bait. */
function spawnAbout(game: Game): void {
  const S = ws(game);
  const wall = game.wallNow();
  for (const region of PIRATE_SEAS) {
    if (game.zone && !game.zone.regions.has(region)) continue;
    const here = [...game.sessions].filter((s) => s.ship && !s.ship.docked && s.ship.alive && s.ship.region === region && s.profile);
    if (!here.length) continue;
    const live = [...S.live.values()].filter((l) => l.region === region && !pirateById(l.id)!.baron).length;
    // The bait: a fat hold that looks like a merchant.
    const bait = here.find((s) => baited(s.ship!));
    const cap = LIVE_PER_SEA[REGIONS[region].safety] + (bait ? 1 : 0);
    if (live < cap && S.rng.chance(bait ? 0.5 : 0.2)) {
      const near = (bait ?? S.rng.pick(here)).ship!;
      const pool = namedPirates().filter((p) => p.region === region && !p.baron && !S.live.has(p.id) && (S.rec[p.id]?.respawnAt ?? 0) <= wall && fits(game, p, near.state.x, near.state.y));
      if (pool.length) {
        const np = S.rng.pick(pool);
        const ship = putToSea(game, np, near);
        if (ship && bait) {
          const b = game.npcs.get(ship.id)!;
          b.chase = { id: near.id, until: game.now + 600 };
        }
      }
    }
    // The baron: for a hunter who has sunk three of his captains, once a week.
    const baron = baronOf(region);
    if (baron && !S.live.has(baron.id) && (S.rec[baron.id]?.respawnAt ?? 0) <= wall) {
      const hunter = here.find((s) => (s.profile!.hunter?.seas[region] ?? 0) >= BARON_AFTER);
      if (hunter && S.rng.chance(0.3)) {
        const ship = putToSea(game, baron, hunter.ship!);
        if (ship) {
          const b = game.npcs.get(ship.id)!;
          b.chase = { id: hunter.ship!.id, until: game.now + 900 };
        }
      }
    }
  }
}

function baited(ship: ShipEntity): boolean {
  const fill = Object.values(ship.cargo).reduce((a, n) => a + (n ?? 0), 0) / Math.max(1, ship.stats.holdVolume);
  return fill > 0.6 && (ship.hasFlag('false_colors') || ship.hasFlag('false_bulwark'));
}

// ------------------------------------------------------------------------------------------------ the kill

export interface HunterProfile {
  points: number;
  captains: number;
  seas: Partial<Record<RegionId, number>>;
}

export function sanitizeHunter(p: Profile): void {
  p.hunter ??= { points: 0, captains: 0, seas: {} };
}

/** A pirate sunk by a captain (from creditKill): the bounty, the guild's points, the barons, the deed. */
export function wantedKill(game: Game, s: PlayerSession, victim: ShipEntity): void {
  const p = s.profile;
  if (!p) return;
  sanitizeHunter(p);
  const S = ws(game);
  if (victim.named) {
    const np = pirateById(victim.named);
    if (!np) return;
    S.live.delete(np.id);
    const r = (S.rec[np.id] ??= {});
    r.respawnAt = game.wallNow() + respawnDelay(S, np);
    seen(game, np.id, victim);
    const bonus = (hunterRank(p.hunter!.points) >= HUNTER_BONUS_RANK ? 1 + HUNTER_BONUS : 1) + trophyBonus(game, s.accountId, 'flag');
    const pay = Math.round(np.bounty * bonus);
    p.gold += pay;
    game.db.ledger(s.accountId, 'bounty', pay, np.id);
    game.sendTo(s, { t: 'toast', msg: `The bounty on ${np.name[0]}: ${pay} silver.`, kind: 'gold' });
    nemesisRevenge(game, s, np); // her own grudge settled (docs/12 P10 #1)
    // Groupmates near share a part.
    const g = groupOfAccount(game, s.accountId);
    if (g) for (const acc of g.members) {
      if (acc === s.accountId) continue;
      const ms = game.sessionByAccount(acc);
      if (!ms?.profile || !ms.ship || dist(ms.ship.state.x, ms.ship.state.y, victim.state.x, victim.state.y) > 3000) continue;
      ms.profile.gold += Math.round(pay * 0.3);
      addPoints(game, ms, np.baron ? HUNTER_POINTS.baron / 2 : HUNTER_POINTS.captain / 2);
    }
    if (np.baron) {
      for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} sank ${np.name[0]}, baron of the Brethren in ${REGIONS[np.region].name}!`, kind: 'gold' });
      // The Terror of the Seas: a piece of the set, fine or better.
      const slots = Object.keys(SETS.sea_terror.pieces) as Slot[];
      const it = makeItem(game.rng, p.itemSeq++, { ilvl: np.level, rarity: game.rng.chance(0.3) ? 4 : 3, slots });
      if (!it.legendary) it.set = 'sea_terror';
      takeItem(game, s, it);
      addPoints(game, s, HUNTER_POINTS.baron);
    } else {
      for (const o of game.sessions) if (o.ship?.region === np.region || o === s) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} sank the pirate ${np.name[0]} — ${pay} silver on the head.`, kind: 'gold' });
      p.hunter!.captains++;
      const seas = p.hunter!.seas;
      seas[np.region] = (seas[np.region] ?? 0) + 1;
      if (seas[np.region] === BARON_AFTER) {
        const b = baronOf(np.region);
        if (b) game.sendTo(s, { t: 'toast', msg: `Three of his captains are sunk: ${b.name[0]}, baron of the Brethren in ${REGIONS[np.region].name}, will come for you himself.`, kind: 'bad' });
      }
      if (p.hunter!.captains >= CAPTAIN_KILLER) grantDeed(game, s, 'deed_captain_killer');
      questEvent(game, s, { k: 'named' });
      addPoints(game, s, HUNTER_POINTS.captain);
    }
    game.grantXp(s, 120 * np.level, `Sank ${np.name[0]}`, true);
    S.dirty = true;
    sendWanted(game, s, true);
    return;
  }
  if (victim.namedMate) {
    const np = pirateById(victim.namedMate.split('#')[0]);
    const pay = Math.round((np?.bounty ?? 300) * 0.15);
    p.gold += pay;
    game.db.ledger(s.accountId, 'bounty', pay, `${victim.namedMate}_mate`);
    addPoints(game, s, HUNTER_POINTS.lieutenant);
    return;
  }
  if (victim.npcRole === 'pirate') addPoints(game, s, HUNTER_POINTS.pirate);
}

function addPoints(game: Game, s: PlayerSession, n: number): void {
  const p = s.profile!;
  sanitizeHunter(p);
  const before = hunterRank(p.hunter!.points);
  p.hunter!.points += n;
  const after = hunterRank(p.hunter!.points);
  if (after <= before) return;
  game.sendTo(s, { t: 'toast', msg: `Hunters’ Guild: rank ${after}.`, kind: 'gold' });
  if (after >= HUNTER_PENNANT_RANK && !p.pennants.includes(HUNTER_PENNANT)) {
    p.pennants.push(HUNTER_PENNANT);
    game.sendTo(s, { t: 'toast', msg: 'The Hunters’ Guild gives you its pennant.', kind: 'gold' });
  }
  if (after >= HUNTER_TITLE_RANK && !p.titles.includes(HUNTER_TITLE)) {
    p.titles.push(HUNTER_TITLE);
    game.sendTo(s, { t: 'toast', msg: 'The Hunters’ Guild names you Scourge of the Brethren!', kind: 'gold' });
  }
}

// ------------------------------------------------------------------------------------------------ the tavern

/** The informant: silver for her exact place, good for a minute. */
export function payInformant(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const S = ws(game);
  const np = pirateById(id);
  if (!np) return 'Nobody here has seen that one of late.';
  const p = s.profile!;
  const live = S.live.get(id);
  const ship = live ? game.ships.get(live.ship) : undefined;
  if (!ship?.alive) return 'Nobody here has seen that one of late.';
  const cost = informantCost(np.level);
  if (p.gold < cost) return `Needs ${cost} silver`;
  p.gold -= cost;
  game.db.ledger(s.accountId, 'informant', -cost, id);
  S.informed.set(s.accountId, { id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), until: game.now + INFORMANT_SEC });
  game.sendTo(s, { t: 'toast', msg: `The informant takes ${cost} silver: ${np.name[0]} is there — for a minute.`, kind: 'info' });
  void port;
  sendWanted(game, s, true);
  return null;
}

/** The board of the wanted in a port: the captains of its sea (and its baron, for one who has earned him). */
export function wantedBoard(game: Game, p: Profile, port: Port): WantedPoster[] {
  const S = ws(game);
  const wall = game.wallNow();
  const region = port.region === 'the_abyss' ? 'drowned_crown' : port.region;
  const out: WantedPoster[] = [];
  for (const np of namedPirates()) {
    if (np.region !== region) continue;
    if (np.baron && (p.hunter?.seas[region] ?? 0) < BARON_AFTER) continue;
    const r = S.rec[np.id] ?? {};
    const down = (r.respawnAt ?? 0) > wall;
    const seenAgo = r.lastSeen ? Math.round((wall - r.lastSeen.t) / 60_000) : null;
    out.push({
      id: np.id, name: np.name[0], ship: np.ship[0], level: np.level, cls: np.cls, bounty: np.bounty, portrait: np.portrait, hue: np.hue, baron: np.baron,
      trick: np.trick, temper: np.temper, time: np.time, weather: np.weather, down,
      seen: seenAgo !== null && r.lastSeen ? { region: r.lastSeen.region, ago: seenAgo } : null,
      atSea: S.live.has(np.id), informant: informantCost(np.level), lair: S.lairs.get(np.id)?.name ?? null,
    });
  }
  return out.sort((a, b) => Number(b.baron) - Number(a.baron) || Number(a.down) - Number(b.down) || b.level - a.level);
}

// ------------------------------------------------------------------------------------------------ what a hunter sees

export function wantedView(game: Game, s: PlayerSession): WantedView {
  const S = ws(game);
  const p = s.profile!;
  sanitizeHunter(p);
  const h = p.hunter!;
  const rank = hunterRank(h.points);
  const ship = s.ship;
  const inf = S.informed.get(s.accountId);
  const sight: WantedView['sight'] = [];
  if (ship && !ship.docked) {
    for (const live of S.live.values()) {
      // A hunter of rank sees the wanted about her; everyone sees her own nemesis (docs/12 P10 #1).
      if (rank < HUNTER_SIGHT_RANK && !p.nemeses?.[live.id]) continue;
      const o = game.ships.get(live.ship);
      if (!o?.alive || dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > HUNTER_SIGHT_R) continue;
      sight.push({ id: live.id, x: Math.round(o.state.x), y: Math.round(o.state.y) });
    }
  }
  const lairs: WantedView['lairs'] = [];
  if (ship && !ship.docked) {
    for (const l of S.lairs.values()) {
      if (Math.abs(l.x - ship.state.x) > 4500 || Math.abs(l.y - ship.state.y) > 4500) continue;
      const r = S.rec[l.id] ?? {};
      lairs.push({ id: l.id, x: Math.round(l.x), y: Math.round(l.y), hp: Math.round((battery(game, l) / l.max) * 100) / 100, open: !!r.lairOpenUntil && game.wallNow() < r.lairOpenUntil });
    }
  }
  return {
    lairs,
    points: h.points, rank, next: HUNTER_RANKS[Math.min(10, rank + 1)] ?? h.points, captains: h.captains, seas: { ...h.seas },
    informed: inf ? { id: inf.id, x: inf.x, y: inf.y, sec: Math.max(0, Math.ceil(inf.until - game.now)) } : null,
    sight,
    rogues: hunterLicence(p) ? S.rogues.filter((r) => r.name !== s.name).map((r) => ({ name: r.name, x: r.x, y: r.y, r: r.r })) : [],
    nemeses: nemesisViews(p),
    heads: p.nemesisHeads ?? 0,
  };
}

function sendWanted(game: Game, s: PlayerSession, force = false): void {
  if (!s.profile) return;
  const S = ws(game);
  const v = wantedView(game, s);
  const key = JSON.stringify(v);
  if (!force && S.sent.get(s.accountId) === key) return;
  S.sent.set(s.accountId, key);
  game.sendTo(s, { t: 'wanted', view: v });
}

/** Tests and the admin. */
export function liveNamed(game: Game): { id: string; ship: number; lts: number[] }[] {
  return [...ws(game).live.values()].map((l) => ({ id: l.id, ship: l.ship, lts: [...l.lts] }));
}

export function namedRecord(game: Game, id: string): Readonly<Rec> | undefined {
  return ws(game).rec[id];
}

export function clearWanted(game: Game): void {
  const S = ws(game);
  for (const l of S.live.values()) {
    for (const x of l.lts) game.removeShip(x);
    game.removeShip(l.ship);
  }
  S.live.clear();
}
