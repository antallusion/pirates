// World bosses (docs/02 §11.A.4). Each boss is a ship entity of a monster class (and, for some, a set of
// part entities: the Kraken's arms, the Whale's heart, the Mother's cores, the Hollow Admiral's line) moved
// by this module rather than by sail physics. Fights rise on a schedule announced half an hour ahead in the
// taverns of the region; the spoils are personal, by contribution (damage, control, support), with a weekly
// lockout on rare drops.

import { tattooCount } from './tattoos.ts';
import { grantDeed } from './progression.ts';
import { chronicle } from './renown.ts';
import { BOSSES, BOSS_ANNOUNCE, BOSS_IDS, BOSS_LOCKOUT, BOSS_RANGE, lootFactor } from '../../../shared/src/data/bosses.ts';
import type { BossDef, BossId } from '../../../shared/src/data/bosses.ts';
import { FIGUREHEADS } from '../../../shared/src/data/shipbuild.ts';
import type { FigureheadId } from '../../../shared/src/data/shipbuild.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { MODULES } from '../../../shared/src/data/ships.ts';
import type { ModuleId, ShipClassId } from '../../../shared/src/data/ships.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { clamp, dist, headingVec, wrapAngle } from '../../../shared/src/math.ts';
import type { BossView, BossZone } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import type { WindSample } from '../../../shared/src/sim/wind.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { depthAt, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import type { DamagePacket } from './combat.ts';
import { hasOfficer } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { legendFragment } from './treasure.ts';
import { chapter, giveShard, spawnEcho } from './abyss.ts';
import { seasonStat, seasonMods } from './seasons.ts';
import { onFirstKill } from './legendary.ts';
import { governorsOfRegion } from './empires.ts';
import { logNote } from './captainlog.ts';
import { artifactFind } from './hero.ts';
import { maybeScroll } from './pathbook.ts';
import { riseTen, tenEnd, tenHint, tenIncoming, tenPart, tenSecond, tenSinking, tenTick, tenWhere, tenZones } from './bosses10.ts';
import type { TenState } from './bosses10.ts';

/** A fight's entities: the body; the Kraken's arms, the Whale's heart, the Mother's cores, the Admiral's line, the
 *  adds; and the six of 2026-10-03's (bosses10.ts): the Changeling's false shapes, the Prelate's bell spires, the
 *  second of the Rime Twins. */
export type Part = 'body' | 'arm' | 'heart' | 'core' | 'ghost' | 'add' | 'phantom' | 'spire' | 'twin';

export interface Contribution {
  name: string;
  dmg: number; // hull taken off the boss and its parts
  control: number; // harpoon lines, arms cut, lanterns put out, the heart's guard killed
  support: number; // repairs under fire, bells against the Song
}

interface Grab {
  arm: number;
  since: number;
  x: number; // where the arm holds her
  y: number;
}

interface Swallow {
  since: number;
  dealt: number;
}

export interface Fight {
  id: number; // the body
  kind: BossId;
  def: BossDef;
  region: RegionId;
  phase: number;
  started: number;
  endsAt: number;
  anchor: { x: number; y: number };
  pool: number; // total hit points of body and parts at the rising
  parts: Map<number, Part>;
  contrib: Map<number, Contribution>;
  ready: Record<string, number>; // cooldowns (world time)
  dive: number; // submerged until
  charge: { x: number; y: number; at: number; until: number; hit: Set<number> } | null;
  whirl: { x: number; y: number; until: number } | null;
  ring: { x: number; y: number; r: number; until: number; a: number } | null;
  eye: { x: number; y: number; a: number; r: number };
  inks: { x: number; y: number; until: number }[];
  lures: { x: number; y: number }[];
  bile: { x: number; y: number; until: number } | null;
  grabs: Map<number, Grab>;
  swallowed: Map<number, Swallow>;
  lanterns: Map<number, boolean>; // the Hollow Admiral: ghost → soul-lantern still lit
  bitten: Map<number, number>; // per-ship cooldowns for bites, walls and claws
  wind: { dir: number; strength: number; at: number };
  aloneSince: number; // the Serpent: nobody within reach since
  inRing: Set<number>; // ships caught inside the Serpent's coil
  songActive: boolean;
  /** The six of 2026-10-03: their own state (bosses10.ts). */
  ten?: TenState;
}

interface Schedule {
  next: Partial<Record<BossId, number>>; // wall-clock ms of the next rising
  pending: Partial<Record<BossId, { at: number; x: number; y: number; warned?: boolean }>>;
}

const KRAKEN_ARMS = 8;
const ARM_REACH = 170;
const SWALLOW_TIME = 60;
const HOLD_LINES = 6;

export class BossHub {
  fights = new Map<number, Fight>();
  private sched: Schedule | null = null;
  private viewers = new Set<number>();

  private key(game: Game): string {
    return `bosses:${game.zone?.id ?? 'world'}`;
  }

  schedule(game: Game): Schedule {
    if (!this.sched) {
      this.sched = game.db.getKv<Schedule>(this.key(game)) ?? { next: {}, pending: {} };
      const wall = game.wallNow();
      // The first risings are spread by the world seed (not the game's dice, which the rest of the world shares).
      BOSS_IDS.forEach((id, i) => {
        const u = ((game.world.seed * 9301 + (i + 1) * 49297) % 233280) / 233280;
        this.sched!.next[id] ??= wall + Math.round((0.15 + 0.85 * u) * BOSSES[id].every * 1000);
      });
      this.save(game);
    }
    return this.sched;
  }

  private save(game: Game): void {
    if (this.sched) game.db.setKv(this.key(game), this.sched);
  }

  fightOf(ship: ShipEntity): Fight | null {
    return ship.bossOf ? this.fights.get(ship.bossOf) ?? null : null;
  }

  /** Once a second: the calendar, then every fight's decisions. */
  second(game: Game): void {
    this.calendar(game);
    for (const f of [...this.fights.values()]) fightSecond(game, f);
    this.broadcast(game);
  }

  private calendar(game: Game): void {
    const sc = this.schedule(game);
    const wall = game.wallNow();
    let dirty = false;
    for (const id of BOSS_IDS) {
      const def = seasonal(game, BOSSES[id]);
      const regions = def.regions.filter((r) => !game.zone || game.zone.regions.has(r));
      if (!regions.length) continue;
      if ([...this.fights.values()].some((f) => f.kind === id)) continue;
      const next = sc.next[id] ?? wall;
      const pend = sc.pending[id];
      if (!pend && wall >= next - BOSS_ANNOUNCE * 1000) {
        const spot = id === 'abyss_eye' ? game.abyss.eye : risingPoint(game, def, regions);
        if (!spot) continue;
        sc.pending[id] = { at: Math.max(next, wall), x: spot.x, y: spot.y };
        announce(game, def, spot.x, spot.y, Math.max(0, Math.round((next - wall) / 60000)));
        dirty = true;
        continue;
      }
      // Five minutes before, the whole sea hears it (owner, 2026-09-29: events everyone sails to).
      if (pend && !pend.warned && wall >= pend.at - 5 * 60_000) {
        pend.warned = true;
        dirty = true;
        const region = REGIONS[regionAt(game.world, pend.x, pend.y)].name;
        for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${def.name} rises in ${region} within five minutes!`, kind: 'bad' });
      }
      if (pend && wall >= pend.at) {
        const late = wall - pend.at > (def.every * 1000) / 2;
        if (!late && !windowOpen(game, def, regionAt(game.world, pend.x, pend.y))) continue;
        delete sc.pending[id];
        sc.next[id] = wall + Math.round(def.every * 1000 * game.rng.range(0.85, 1.15));
        dirty = true;
        if (late || !game.rng.chance(def.chance)) continue;
        summon(game, id, pend.x, pend.y);
        const region = REGIONS[regionAt(game.world, pend.x, pend.y)].name;
        for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${def.name} has risen in ${region}. Every captain who dares, to arms!`, kind: 'bad' });
      }
    }
    if (dirty) this.save(game);
  }

  /** The boss panel for every captain within reach of a fight (and one empty list when they leave it). */
  private broadcast(game: Game): void {
    const seen = new Set<number>();
    for (const s of game.sessions) {
      const ship = s.ship;
      if (!ship || ship.docked || s.disconnectedAt !== null) continue;
      const list: BossView[] = [];
      for (const f of this.fights.values()) {
        const body = game.ships.get(f.id);
        if (body && dist(body.state.x, body.state.y, ship.state.x, ship.state.y) < BOSS_RANGE + 1800) list.push(view(game, f, body, s));
      }
      if (list.length) {
        seen.add(s.accountId);
        game.sendTo(s, { t: 'boss', list });
      } else if (this.viewers.has(s.accountId)) game.sendTo(s, { t: 'boss', list: [] });
    }
    this.viewers = seen;
  }
}

// ================================================================== the calendar

/** The Great Migration: the Leviathans rise twice as often, and in Gravewater too. */
export function seasonal(game: Game, def: BossDef): BossDef {
  if (def.id !== 'leviathan' || !seasonMods(game).migration) return def;
  return { ...def, every: def.every / 2, regions: [...def.regions, 'gravewater'] };
}

function windowOpen(game: Game, def: BossDef, region: RegionId): boolean {
  if (def.window === 'night') return isNight(game.now);
  if (def.window === 'storm') {
    const k = game.weather[region]?.kind;
    return k === 'storm' || k === 'black_storm';
  }
  return true;
}

/** Open deep water in one of the boss's regions, clear of ports (or near its port, for the Mother). */
export function risingPoint(game: Game, def: BossDef, regions: RegionId[]): { x: number; y: number } | null {
  for (let i = 0; i < 40; i++) {
    let x: number, y: number;
    const port = def.nearPort ? game.world.ports.find((p) => p.id === def.nearPort) : undefined;
    if (port) {
      const a = game.rng.range(0, Math.PI * 2), r = game.rng.range(2600, 4200);
      x = port.x + Math.sin(a) * r;
      y = port.y - Math.cos(a) * r;
    } else {
      const [cx, cy] = REGIONS[game.rng.pick(regions)].center;
      x = cx + game.rng.range(-7000, 7000);
      y = cy + game.rng.range(-7000, 7000);
    }
    if (!regions.includes(regionAt(game.world, x, y)) || !game.inZone(x, y)) continue;
    if (isLand(game.world, x, y) || depthAt(game.world, x, y) < 12) continue;
    if (game.world.ports.some((p) => dist(p.x, p.y, x, y) < 2200)) continue;
    return { x, y };
  }
  return null;
}

function announce(game: Game, def: BossDef, x: number, y: number, mins: number): void {
  const region = REGIONS[regionAt(game.world, x, y)].name;
  const text = `${def.name} stirs in ${region}. Whalers mark the water ${Math.round(x / 1000)} km east, ${Math.round(y / 1000)} km south — within the half hour.`;
  for (const p of game.world.ports) if (def.regions.includes(p.region) || dist(p.x, p.y, x, y) < 30000) game.addRumor(p.x, p.y, text);
  const gov = governorsOfRegion(game, regionAt(game.world, x, y));
  for (const s of game.sessions) {
    const sh = s.ship;
    if (!sh) continue;
    const governor = gov !== null && game.guilds.of(game, s.accountId)?.id === gov;
    if (governor) game.sendTo(s, { t: 'toast', msg: `Governor's dispatch: ${text}`, kind: 'gold' });
    else if (def.regions.includes(sh.region) || dist(sh.state.x, sh.state.y, x, y) < 20000) game.sendTo(s, { t: 'toast', msg: `Tavern talk: ${text}`, kind: 'info' });
  }
  // The rest of the sea hears of it too, as world news with the time left.
  for (const s of game.sessions) {
    const sh = s.ship;
    if (sh && (def.regions.includes(sh.region) || dist(sh.state.x, sh.state.y, x, y) < 20000)) continue;
    game.sendTo(s, { t: 'toast', msg: `WORLD: ${def.name} will rise in ${region} in about ${Math.max(1, mins)} min.`, kind: 'info' });
  }
  game.log(`[boss] ${def.id} announced at ${Math.round(x)},${Math.round(y)} (in ~${mins} min)`);
}

// ================================================================== rising

export function spawnPart(game: Game, f: Fight | null, classId: ShipClassId, x: number, y: number, heading: number, name: string, part: Part): ShipEntity {
  const ship = game.spawnNpcShip('ghost', classId, 'choir', x, y, heading, { ship: name, captain: 'the Deep' });
  game.npcs.delete(ship.id); // moved here, not by the NPC brains
  ship.npcRole = 'boss';
  ship.bossPart = part;
  ship.level = 40;
  ship.morale = 100;
  ship.crew = part === 'heart' ? 240 : 0;
  ship.state.sail = 0;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.hull = ship.stats.hullMax;
  if (f) {
    ship.bossOf = f.id;
    f.parts.set(ship.id, part);
    f.pool += ship.stats.hullMax;
  }
  game.grid.upsert(ship.id, x, y);
  return ship;
}

/** Raise a boss now at a point (the calendar, or a test). */
export function summon(game: Game, kind: BossId, x: number, y: number): Fight {
  const def = BOSSES[kind];
  const now = game.now;
  let body: ShipEntity;
  if (kind === 'hollow_admiral') {
    body = spawnGhost(game, null, x, y, 0, 'HMS Hollow Sovereign');
  } else {
    body = spawnPart(game, null, def.classId, x, y, game.rng.range(0, Math.PI * 2), def.name, 'body');
  }
  body.bossOf = body.id;
  if (kind === 'ancient_leviathan') {
    // Three times the beast of the Reach.
    body.addEffect({ id: 'ancient', until: now + 1e9, mods: { hullMax: 2 } }, now);
    body.hull = body.stats.hullMax;
    body.name = def.name;
  }
  const f: Fight = {
    id: body.id, kind, def, region: regionAt(game.world, x, y), phase: 0, started: now, endsAt: now + def.lifetime, anchor: { x, y },
    pool: body.stats.hullMax, parts: new Map([[body.id, kind === 'hollow_admiral' ? 'ghost' : 'body']]), contrib: new Map(), ready: {},
    dive: 0, charge: null, whirl: null, ring: null, eye: { x, y, a: 0, r: 260 }, inks: [], lures: [], bile: null,
    grabs: new Map(), swallowed: new Map(), lanterns: new Map(), bitten: new Map(), wind: { dir: 0, strength: 1.2, at: 0 }, aloneSince: now, songActive: false, inRing: new Set(),
  };
  game.bosses.fights.set(f.id, f);
  switch (kind) {
    case 'kraken':
      for (let i = 0; i < KRAKEN_ARMS; i++) {
        const a = (i / KRAKEN_ARMS) * Math.PI * 2;
        spawnPart(game, f, 'kraken_tentacle', x + Math.sin(a) * 60, y - Math.cos(a) * 60, a, `Kraken Arm ${i + 1}`, 'arm');
      }
      break;
    case 'hollow_admiral':
      f.lanterns.set(body.id, true);
      for (const [i, name] of ['The Hollow Resolve', 'The Hollow Vigil', 'The Hollow Oath'].entries()) {
        const a = body.state.heading + Math.PI / 2;
        spawnGhost(game, f, x + Math.sin(a) * (i + 1) * 140, y - Math.cos(a) * (i + 1) * 140, body.state.heading, name);
      }
      break;
    case 'mother_of_wrecks':
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        spawnPart(game, f, 'wreck_core', x + Math.sin(a) * 42, y - Math.cos(a) * 42, 0, `Wreck Core ${i + 1}`, 'core');
      }
      break;
    case 'lantern_maw':
      placeLures(game, f, body);
      break;
    case 'storm_widow':
      f.eye = { x: x + 450, y, a: 0, r: 260 };
      f.wind = { dir: game.rng.range(0, Math.PI * 2), strength: 1.25, at: now };
      break;
    default:
      riseTen(game, f, body); // the six of 2026-10-03
  }
  game.emit({ k: 'fx', fx: 'boss_roar', x: Math.round(x), y: Math.round(y), r: 400 }, x, y);
  const region = REGIONS[f.region].name;
  game.addRumor(x, y, `${def.name} has risen in ${region}.`);
  for (const s of game.sessions) {
    const sh = s.ship;
    if (sh && !sh.docked && dist(sh.state.x, sh.state.y, x, y) < 12000) game.sendTo(s, { t: 'toast', msg: `${def.name} rises! ${def.lore}`, kind: 'bad' });
  }
  game.log(`[boss] ${kind} rose at ${Math.round(x)},${Math.round(y)}`);
  return f;
}

/** A ship of the Hollow Admiral's line: a real ghost-ship brain that fights, under a lantern that raises it. */
function spawnGhost(game: Game, f: Fight | null, x: number, y: number, heading: number, name: string): ShipEntity {
  const g = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', x, y, heading, { ship: name, captain: 'Admiral Drey (what is left of him)' });
  g.addEffect({ id: 'admiral_line', until: game.now + 1e9, mods: { hullMax: 2, gunDamageMul: 0.3, crewMax: 0.5 } }, game.now);
  g.hull = g.stats.hullMax;
  g.crew = g.stats.crewMax;
  g.level = 40;
  g.bossPart = 'ghost';
  const brain = game.npcs.get(g.id);
  if (brain) {
    brain.active = true;
    brain.area = { x, y, r: 3000 };
  }
  if (f) {
    g.bossOf = f.id;
    f.parts.set(g.id, 'ghost');
    f.lanterns.set(g.id, true);
    f.pool += g.stats.hullMax;
  }
  game.grid.upsert(g.id, x, y);
  return g;
}

function placeLures(game: Game, f: Fight, body: ShipEntity): void {
  f.lures = [];
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 8; k++) {
      const a = game.rng.range(0, Math.PI * 2), r = game.rng.range(600, 950);
      const x = body.state.x + Math.sin(a) * r, y = body.state.y - Math.cos(a) * r;
      if (isLand(game.world, x, y)) continue;
      f.lures.push({ x, y });
      break;
    }
  }
}

// ================================================================== helpers

export function fighters(game: Game, f: Fight, r = BOSS_RANGE): ShipEntity[] {
  const body = game.ships.get(f.id);
  if (!body) return [];
  const out: ShipEntity[] = [];
  game.forShipsNear(body.state.x, body.state.y, r, (o) => {
    if (o.alive && !o.docked && !o.bossOf && (o.isPlayer || o.ownerId !== null) && !o.ghost) out.push(o);
  });
  return out;
}

export function nearest(ships: ShipEntity[], x: number, y: number, skip?: (s: ShipEntity) => boolean): ShipEntity | null {
  let best: ShipEntity | null = null, bd = Infinity;
  for (const s of ships) {
    if (skip?.(s)) continue;
    const d = dist(s.state.x, s.state.y, x, y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

export function head(body: ShipEntity, k = 0.42): { x: number; y: number } {
  const v = headingVec(body.state.heading);
  return { x: body.state.x + v.x * body.stats.length * k, y: body.state.y + v.y * body.stats.length * k };
}

/** Steer and swim toward a point: monsters turn like beasts, not ships. */
export function swim(game: Game, s: ShipEntity, tx: number, ty: number, speed: number, dt: number, turn = 1.2): void {
  const want = Math.atan2(tx - s.state.x, -(ty - s.state.y));
  const d = dist(s.state.x, s.state.y, tx, ty);
  s.state.heading = wrapAngle(s.state.heading + clamp(wrapAngle(want - s.state.heading), -turn * dt, turn * dt));
  const v = Math.min(speed, d / Math.max(dt, 1e-3));
  s.state.speed = v;
  const h = headingVec(s.state.heading);
  s.state.x += h.x * v * dt;
  s.state.y += h.y * v * dt;
  game.grid.upsert(s.id, s.state.x, s.state.y);
}

export function place(game: Game, s: ShipEntity, x: number, y: number, heading?: number): void {
  s.state.x = x;
  s.state.y = y;
  if (heading !== undefined) s.state.heading = heading;
  game.grid.upsert(s.id, x, y);
}

/** Her draught as the shoals see it (Trim the Ballast and friends included). */
export function draftOf(s: ShipEntity): number {
  return s.cls.draft * Math.max(0.5, 1 + tval(s.stats, 'draftMul'));
}

function tethersOn(game: Game, body: ShipEntity): number {
  let n = 0;
  for (const o of game.ships.values()) if (o.tether?.target === body.id && o.alive) n++;
  return n;
}

/** The lines needed to hold the Leviathan: six, or half the fleet if it is smaller. */
function linesNeeded(game: Game, f: Fight): number {
  return clamp(Math.ceil(fighters(game, f).filter((s) => s.isPlayer).length / 2), 1, HOLD_LINES);
}

function accountOf(game: Game, s: ShipEntity | null): { id: number; name: string } | null {
  if (!s) return null;
  if (s.accountId !== null) return { id: s.accountId, name: s.captainName };
  if (s.ownerId !== null) return accountOf(game, game.ships.get(s.ownerId) ?? null);
  return null;
}

export function credit(game: Game, f: Fight, s: ShipEntity | null, k: keyof Omit<Contribution, 'name'>, n: number): void {
  const a = accountOf(game, s);
  if (!a || n <= 0) return;
  let c = f.contrib.get(a.id);
  if (!c) f.contrib.set(a.id, (c = { name: a.name, dmg: 0, control: 0, support: 0 }));
  c[k] += n;
}

/** Contribution as points: 1000 for the whole pool of hit points, plus control and support. */
export function scoreOf(f: Fight, c: Contribution): number {
  return (c.dmg / Math.max(1, f.pool)) * 1000 + c.control + c.support;
}

export function hurt(game: Game, f: Fight, target: ShipEntity, frac: number, extra: Partial<DamagePacket> = {}): void {
  const body = game.ships.get(f.id) ?? null;
  applyDamage(game, target, { hull: target.stats.hullMax * frac, ...extra }, body);
}

export function sayTo(game: Game, ships: ShipEntity[], msg: string, kind: 'info' | 'good' | 'bad' = 'bad'): void {
  for (const s of ships) if (s.isPlayer) game.toastShip(s, msg, kind);
}

export function setPhase(game: Game, f: Fight, phase: number): void {
  if (f.phase === phase) return;
  f.phase = phase;
  const body = game.ships.get(f.id);
  if (!body) return;
  sayTo(game, fighters(game, f), `${f.def.name}: ${f.def.phases[phase] ?? ''}!`, 'bad');
  game.emit({ k: 'fx', fx: 'boss_roar', x: Math.round(body.state.x), y: Math.round(body.state.y), r: 500 }, body.state.x, body.state.y);
}

export function every(f: Fight, key: string, now: number, period: number): boolean {
  if ((f.ready[key] ?? 0) > now) return false;
  f.ready[key] = now + period;
  return true;
}

export function submerge(game: Game, s: ShipEntity, secs: number): void {
  s.addEffect({ id: 'submerged', until: game.now + secs }, game.now);
}

// ================================================================== every tick

export function stepBosses(game: Game, dt: number): void {
  for (const f of [...game.bosses.fights.values()]) {
    const body = game.ships.get(f.id);
    if (!body || !body.alive) continue;
    switch (f.kind) {
      case 'leviathan':
      case 'ancient_leviathan': leviathanTick(game, f, body, dt); break;
      case 'abyss_eye': eyeTick(game, f, body, dt); break;
      case 'kraken': krakenTick(game, f, body, dt); break;
      case 'drowned_whale': whaleTick(game, f, body, dt); break;
      case 'lantern_maw': mawTick(game, f, body, dt); break;
      case 'black_serpent': serpentTick(game, f, body, dt); break;
      case 'mother_of_wrecks': motherTick(game, f, body, dt); break;
      case 'storm_widow': widowTick(game, f, body, dt); break;
      case 'hollow_admiral': break; // the ghosts sail under their own brains
      default: tenTick(game, f, body, dt); // the six of 2026-10-03
    }
  }
}

export function wander(game: Game, f: Fight, body: ShipEntity, speed: number, dt: number): void {
  const t = game.now * 0.02 + f.id;
  swim(game, body, f.anchor.x + Math.sin(t) * 900, f.anchor.y - Math.cos(t * 0.7) * 900, speed, dt, 0.5);
}

// -- Leviathan: rams from white water; held by harpoons its gills open; the whirlpool; the frenzy.
function leviathanTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const now = game.now;
  if (f.whirl) {
    whirlpool(game, f, f.whirl.x, f.whirl.y, 720, dt);
    place(game, body, f.whirl.x, f.whirl.y, body.state.heading + 0.8 * dt);
    body.state.speed = 0;
    return;
  }
  const c = f.charge;
  if (c && now >= c.at) {
    const held = tethersOn(game, body) >= linesNeeded(game, f);
    swim(game, body, c.x, c.y, held ? 12 : 26, dt, 2.5);
    const bigMul = f.phase === 2 ? 1 : 0;
    game.forShipsNear(body.state.x, body.state.y, body.stats.length / 2 + 30, (o) => {
      if (o.bossOf || !o.alive || o.docked || c.hit.has(o.id)) return;
      if (dist(o.state.x, o.state.y, body.state.x, body.state.y) > body.stats.length * 0.45 + o.stats.length * 0.3) return;
      c.hit.add(o.id);
      hurt(game, f, o, 0.07 * (1 + bigMul * 0.15 * o.cls.tier), { crew: 3, morale: 6 });
      o.leaks = Math.min(8, o.leaks + 1);
      game.emit({ k: 'fx', fx: 'ram', x: Math.round(o.state.x), y: Math.round(o.state.y) }, o.state.x, o.state.y);
    });
    if (now >= c.until || dist(body.state.x, body.state.y, c.x, c.y) < 10) f.charge = null;
    return;
  }
  const t = nearest(fighters(game, f), body.state.x, body.state.y);
  if (t && !c) swim(game, body, t.state.x, t.state.y, f.dive > now ? 14 : 8, dt, 0.8);
  else if (!t) wander(game, f, body, 6, dt);
}

/** The Roar of the Deep: go with the current or be drawn into the mouth. */
function whirlpool(game: Game, f: Fight, cx: number, cy: number, r: number, dt: number): void {
  const now = game.now;
  game.forShipsNear(cx, cy, r, (o) => {
    if (o.bossOf || !o.alive || o.docked) return;
    const dx = o.state.x - cx, dy = o.state.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    if (d > r) return;
    const nx = dx / d, ny = dy / d;
    const tx = -ny, ty = nx; // clockwise
    const v = headingVec(o.state.heading);
    const withIt = v.x * tx + v.y * ty; // sailing with the current?
    const inward = 3.2 * (1 - d / r) * (withIt > 0.5 && o.state.speed > 3 ? 0.25 : 1) + 0.6;
    o.state.x += (tx * 4 - nx * inward) * dt;
    o.state.y += (ty * 4 - ny * inward) * dt;
    game.grid.upsert(o.id, o.state.x, o.state.y);
    if (d < 75 && (f.bitten.get(o.id) ?? 0) <= now) {
      f.bitten.set(o.id, now + 5);
      hurt(game, f, o, 0.15, { crew: 4, morale: 10 });
      game.emit({ k: 'fx', fx: 'maw', x: Math.round(cx), y: Math.round(cy), r: 60 }, cx, cy);
      game.toastShip(o, 'The Leviathan bites! Sail WITH the current to break free of the pull.', 'bad');
    }
  });
}

// -- Kraken: eight arms around the body; each can hold a ship.
function krakenTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const t = nearest(fighters(game, f), body.state.x, body.state.y);
  if (t && dist(t.state.x, t.state.y, body.state.x, body.state.y) > 120) swim(game, body, t.state.x, t.state.y, 4, dt, 0.4);
  else if (!t) wander(game, f, body, 3, dt);
  else body.state.speed = 0;
  let i = 0;
  for (const [id, part] of f.parts) {
    if (part !== 'arm') continue;
    const arm = game.ships.get(id);
    i++;
    if (!arm || !arm.alive) continue;
    const grab = [...f.grabs.entries()].find(([, g]) => g.arm === id);
    const held = grab ? game.ships.get(grab[0]) : null;
    if (held && held.alive) {
      // The arm reaches out to the ship it holds; the ship does not move.
      const a = Math.atan2(held.state.x - body.state.x, -(held.state.y - body.state.y));
      place(game, arm, (body.state.x + held.state.x) / 2, (body.state.y + held.state.y) / 2, a);
      place(game, held, grab![1].x, grab![1].y);
      held.state.speed = 0;
      continue;
    }
    const a = (i / KRAKEN_ARMS) * Math.PI * 2 + Math.sin(game.now * 0.7 + i) * 0.25;
    const r = 58 + Math.sin(game.now * 1.3 + i * 2) * 10;
    place(game, arm, body.state.x + Math.sin(a) * r, body.state.y - Math.cos(a) * r, a);
    arm.state.speed = 0;
  }
  for (const [sid, g] of f.grabs) {
    const s = game.ships.get(sid);
    const arm = game.ships.get(g.arm);
    if (!s || !s.alive || !arm || !arm.alive || s.docked) release(game, f, sid);
  }
}

export function release(game: Game, f: Fight, shipId: number): void {
  f.grabs.delete(shipId);
  const s = game.ships.get(shipId);
  if (!s) return;
  s.effects = s.effects.filter((e) => e.id !== 'grabbed');
  s.recompute(game.now);
}

// -- The Drowned Whale drifts; in its last hour it is slow enough to board.
function whaleTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const t = nearest(fighters(game, f), body.state.x, body.state.y);
  const speed = f.phase === 2 ? 1.5 : 3;
  if (t && dist(t.state.x, t.state.y, body.state.x, body.state.y) > 300) swim(game, body, t.state.x, t.state.y, speed, dt, 0.25);
  else if (!t) wander(game, f, body, speed, dt);
  else {
    body.state.speed = speed;
    const h = headingVec(body.state.heading);
    place(game, body, body.state.x + h.x * speed * dt, body.state.y + h.y * speed * dt);
  }
  for (const [id, part] of f.parts) {
    if (part !== 'heart') continue;
    const heart = game.ships.get(id);
    if (heart) {
      place(game, heart, body.state.x, body.state.y, body.state.heading);
      heart.state.speed = body.state.speed;
    }
  }
}

// -- The Lantern Maw: lanterns draw it; false lights lure ships; what it swallows fights from inside.
function mawTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const now = game.now;
  const ships = fighters(game, f, 2600);
  const lit = (s: ShipEntity) => !s.hasFlag('dark_running') && !s.hasFlag('hidden');
  const hungry = f.phase === 1;
  // Prey: lit ships within 2.5 km, dark ones only within 300 m.
  const prey = nearest(ships, body.state.x, body.state.y, (s) => f.swallowed.has(s.id) || (!lit(s) && dist(s.state.x, s.state.y, body.state.x, body.state.y) > 300));
  // A ship that sails into a false light is where the Maw lunges.
  const lured = ships.find((s) => !f.swallowed.has(s.id) && f.lures.some((l) => dist(l.x, l.y, s.state.x, s.state.y) < 90));
  if (lured) swim(game, body, lured.state.x, lured.state.y, 28, dt, 2.5);
  else if (prey) swim(game, body, prey.state.x, prey.state.y, hungry ? 14 : 11, dt, 1);
  else wander(game, f, body, 5, dt);
  const h = head(body, 0.35);
  if (f.swallowed.size < 3 && (f.ready.swallow ?? 0) <= now) {
    for (const s of ships) {
      if (f.swallowed.has(s.id) || s.hasEffect('submerged')) continue;
      if (dist(s.state.x, s.state.y, h.x, h.y) > 45 + s.stats.length * 0.3) continue;
      if (!lit(s) && !lured) continue; // a dark ship slips past the jaws unless it chased a false light
      swallow(game, f, body, s);
      f.ready.swallow = now + (hungry ? 5 : 8);
      break;
    }
  }
  for (const [sid] of f.swallowed) {
    const s = game.ships.get(sid);
    if (!s || !s.alive) {
      f.swallowed.delete(sid);
      continue;
    }
    place(game, s, body.state.x, body.state.y, body.state.heading);
    s.state.speed = 0;
  }
}

function swallow(game: Game, f: Fight, body: ShipEntity, s: ShipEntity): void {
  f.swallowed.set(s.id, { since: game.now, dealt: 0 });
  s.addEffect({ id: 'swallowed', until: game.now + SWALLOW_TIME + 5, mods: { maxSpeed: -1, turnRate: -1 } }, game.now);
  s.tether = null;
  s.boarding = null;
  game.emit({ k: 'fx', fx: 'swallow', x: Math.round(body.state.x), y: Math.round(body.state.y), r: 60 }, body.state.x, body.state.y);
  game.toastShip(s, 'SWALLOWED! Fire every gun into its gut — inside, each hit counts thrice. You have a minute.', 'bad');
}

export function spit(game: Game, f: Fight, s: ShipEntity, why: string): void {
  f.swallowed.delete(s.id);
  s.effects = s.effects.filter((e) => e.id !== 'swallowed');
  s.recompute(game.now);
  const body = game.ships.get(f.id);
  if (body) {
    const v = headingVec(body.state.heading);
    place(game, s, body.state.x + v.x * (body.stats.length * 0.6 + 40), body.state.y + v.y * (body.stats.length * 0.6 + 40), body.state.heading);
    game.emit({ k: 'fx', fx: 'spit', x: Math.round(s.state.x), y: Math.round(s.state.y), r: 50 }, s.state.x, s.state.y);
  }
  game.toastShip(s, why, 'good');
}

/** A swallowed ship's broadside goes straight into the Maw's gut, at three times the weight. */
export function innerVolley(game: Game, ship: ShipEntity, damage: number): boolean {
  if (!ship.hasEffect('swallowed')) return false;
  for (const f of game.bosses.fights.values()) {
    const sw = f.swallowed.get(ship.id);
    const body = game.ships.get(f.id);
    if (!sw || !body) continue;
    const before = body.hull;
    applyDamage(game, body, { hull: damage * 3 }, ship);
    sw.dealt += Math.max(0, before - body.hull);
    game.emit({ k: 'hit', x: Math.round(body.state.x), y: Math.round(body.state.y), ship: body.id, dmg: Math.round(damage * 3), ammo: 'round', crit: 'gut' }, body.state.x, body.state.y);
    if (sw.dealt >= body.stats.hullMax * 0.04 && body.alive && !body.sinkingUntil) spit(game, f, ship, 'The Maw retches you out into the night! Its gut is torn.');
    return true;
  }
  return false;
}

// -- The Black Serpent: the coil is a wall; the chase goes where only small ships follow.
function serpentTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const now = game.now;
  const ships = fighters(game, f, 3000);
  if (f.ring && now < f.ring.until) {
    const r = f.ring;
    r.a += (9 / r.r) * dt;
    const x = r.x + Math.sin(r.a) * r.r, y = r.y - Math.cos(r.a) * r.r;
    place(game, body, x, y, r.a + Math.PI / 2);
    body.state.speed = 9;
    // The coil is a wall: nothing crosses it either way.
    for (const s of ships) {
      const dx = s.state.x - r.x, dy = s.state.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      const inside = f.inRing.has(s.id);
      if (Math.abs(d - r.r) > 30) continue;
      const to = inside ? r.r - 30 : r.r + 30;
      place(game, s, r.x + (dx / d) * to, r.y + (dy / d) * to);
      s.state.speed *= 0.3;
      if ((f.bitten.get(s.id) ?? 0) <= now) {
        f.bitten.set(s.id, now + 3);
        hurt(game, f, s, 0.02);
        game.toastShip(s, 'The coils of the Serpent throw you back!', 'bad');
      }
    }
    return;
  }
  if (f.ring) {
    f.ring = null;
    f.inRing.clear();
  }
  if (f.phase === 1) {
    // The chase: away from the nearest ship, weaving.
    const t = nearest(ships, body.state.x, body.state.y);
    if (t) {
      const away = Math.atan2(body.state.x - t.state.x, -(body.state.y - t.state.y)) + Math.sin(now * 0.4) * 0.6;
      const v = headingVec(away);
      let tx = body.state.x + v.x * 400, ty = body.state.y + v.y * 400;
      if (isLand(game.world, tx, ty)) {
        tx = body.state.x - v.y * 400;
        ty = body.state.y + v.x * 400;
      }
      swim(game, body, tx, ty, 15.5, dt, 1.4);
    } else body.state.speed = 0;
    return;
  }
  const t = nearest(ships, body.state.x, body.state.y);
  if (t) swim(game, body, t.state.x, t.state.y, 12, dt, 1);
  else wander(game, f, body, 8, dt);
}

// -- Mother of Wrecks: a reef that will not move; the maze keeps deep keels out.
function motherTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  body.state.speed = 0;
  const now = game.now;
  game.forShipsNear(body.state.x, body.state.y, 110, (o) => {
    if (o.bossOf || !o.alive || o.docked || draftOf(o) <= 2.5) return;
    const dx = o.state.x - body.state.x, dy = o.state.y - body.state.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d >= 100) return;
    place(game, o, body.state.x + (dx / d) * 100, body.state.y + (dy / d) * 100);
    o.state.speed *= 0.4;
    if ((f.bitten.get(o.id) ?? 0) <= now) {
      f.bitten.set(o.id, now + 1);
      hurt(game, f, o, 0.02);
      game.toastShip(o, `The maze of wrecks tears at your keel — she draws ${draftOf(o).toFixed(1)} m; only 2.5 m or less gets through.`, 'bad');
    }
  });
  void dt;
}

// -- The Storm Widow walks her circle; the eye goes round her.
function widowTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  const t = game.now * 0.05;
  swim(game, body, f.anchor.x + Math.sin(t) * 500, f.anchor.y - Math.cos(t) * 500, 6, dt, 0.6);
  const orbit = f.phase === 1 ? 380 : 450;
  f.eye.a += ((f.phase === 1 ? 12 : 8) / orbit) * dt;
  f.eye.x = body.state.x + Math.sin(f.eye.a) * orbit;
  f.eye.y = body.state.y - Math.cos(f.eye.a) * orbit;
  f.eye.r = f.phase === 1 ? 180 : 260;
}

// ================================================================== every second

function fightSecond(game: Game, f: Fight): void {
  const now = game.now;
  if (f.kind === 'hollow_admiral') {
    admiralSecond(game, f);
    if (!game.bosses.fights.has(f.id)) return;
  }
  const body = game.ships.get(f.id);
  if (!body) return void end(game, f, 'gone');
  if (!body.alive) return;
  if (now >= f.endsAt) return void end(game, f, 'escaped');
  const ships = fighters(game, f);
  // Support: repairs under fire while in the fight.
  for (const s of ships) if (s.isPlayer && s.repairing && s.inCombat(now)) credit(game, f, s, 'support', 0.5);
  // Control: harpoon lines on the boss or its parts.
  for (const o of game.ships.values()) {
    if (!o.tether || !o.alive) continue;
    const t = game.ships.get(o.tether.target);
    if (t && t.bossOf === f.id) credit(game, f, o, 'control', 1);
  }
  const hp = body.hull / body.stats.hullMax;
  switch (f.kind) {
    case 'leviathan':
    case 'ancient_leviathan': leviathanSecond(game, f, body, ships, hp); break;
    case 'abyss_eye': eyeSecond(game, f, body, ships, hp); break;
    case 'kraken': krakenSecond(game, f, body, ships); break;
    case 'drowned_whale': whaleSecond(game, f, body, ships, hp); break;
    case 'lantern_maw': mawSecond(game, f, body, ships, hp); break;
    case 'black_serpent': serpentSecond(game, f, body, ships, hp); break;
    case 'mother_of_wrecks': motherSecond(game, f, body, ships, hp); break;
    case 'storm_widow': widowSecond(game, f, body, ships, hp); break;
    default: tenSecond(game, f, body, ships, hp); // the six of 2026-10-03
  }
  f.inks = f.inks.filter((k) => k.until > now);
}

function leviathanSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.33) setPhase(game, f, 2);
  else if (hp <= 0.66 && f.phase === 0) setPhase(game, f, 1);
  const held = tethersOn(game, body) >= linesNeeded(game, f);
  if (held && !body.hasEffect('gills_open')) {
    body.addEffect({ id: 'gills_open', until: now + 2 }, now);
    if (every(f, 'gills_msg', now, 20)) sayTo(game, ships, `The harpoons hold the Leviathan! Its gills are open — aim for the head (×2).`, 'good');
  } else if (held) body.addEffect({ id: 'gills_open', until: now + 2 }, now);
  // Roar of the Deep (phase 2): a whirlpool for 30 s, then 40 s on the surface.
  if (f.phase === 1) {
    if (f.whirl && now >= f.whirl.until) {
      f.whirl = null;
      f.ready.whirl = now + 40;
    } else if (!f.whirl && (f.ready.whirl ?? 0) <= now) {
      f.whirl = { x: body.state.x, y: body.state.y, until: now + 30 };
      f.charge = null;
      submerge(game, body, 30);
      game.emit({ k: 'fx', fx: 'boss_roar', x: Math.round(body.state.x), y: Math.round(body.state.y), r: 720 }, body.state.x, body.state.y);
      sayTo(game, ships, 'The Leviathan dives and the sea turns! Sail WITH the current or be drawn to its mouth.');
    }
    if (f.whirl) return;
  }
  // Dives (phase 1): unless enough harpoon lines hold it.
  if (f.phase === 0 && every(f, 'dive', now, 30)) {
    if (held) sayTo(game, ships, 'It tries to sound — the lines hold!', 'good');
    else {
      f.dive = now + 10;
      submerge(game, body, 10);
      sayTo(game, ships, `The Leviathan sounds! ${linesNeeded(game, f)} harpoon lines would have held it.`, 'info');
    }
  }
  // Rams from white water.
  if (!f.charge && body.hasEffect('submerged') === false && every(f, 'charge', now, f.phase === 2 ? 7 : 14)) {
    const t = game.rng.pick(ships.length ? ships : [body]);
    if (t !== body) {
      f.charge = { x: t.state.x, y: t.state.y, at: now + 3, until: now + 7, hit: new Set() };
      game.emit({ k: 'fx', fx: 'white_water', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 70 }, t.state.x, t.state.y);
      game.toastShip(t, 'White water under your keel — the Leviathan is coming. Turn away!', 'bad');
    }
  }
  // The frenzy: ice floes thrown up by its thrashing.
  if (f.phase === 2 && ships.length && every(f, 'ice', now, 5)) {
    const t = game.rng.pick(ships);
    hurt(game, f, t, 0.02, { sails: 6 });
    game.emit({ k: 'fx', fx: 'ice', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 40 }, t.state.x, t.state.y);
  }
}

function krakenSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[]): void {
  const now = game.now;
  const arms = [...f.parts].filter(([id, p]) => p === 'arm' && game.ships.get(id)?.alive).map(([id]) => game.ships.get(id)!);
  const cut = KRAKEN_ARMS - arms.length;
  if (cut >= 4 && f.phase === 0) {
    setPhase(game, f, 1);
    sayTo(game, ships, 'Four arms cut away — the Kraken\'s body opens to your guns!', 'good');
  }
  if (f.phase === 0) body.addEffect({ id: 'kraken_guard', until: now + 2 }, now);
  // Arms reach for ships within their grasp.
  for (const arm of arms) {
    if ([...f.grabs.values()].some((g) => g.arm === arm.id)) continue;
    if ((f.ready[`arm${arm.id}`] ?? 0) > now) continue;
    const t = nearest(ships, arm.state.x, arm.state.y, (s) => f.grabs.has(s.id) || s.hasEffect('submerged') || s.hasEffect('grab_immune'));
    if (!t || dist(t.state.x, t.state.y, arm.state.x, arm.state.y) > ARM_REACH || !game.rng.chance(0.35)) continue;
    f.ready[`arm${arm.id}`] = now + 8;
    f.grabs.set(t.id, { arm: arm.id, since: now, x: t.state.x, y: t.state.y });
    t.addEffect({ id: 'grabbed', until: now + 600, mods: { maxSpeed: -1, turnRate: -0.8 }, source: arm.id }, now);
    game.emit({ k: 'fx', fx: 'drowned_hands', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 30 }, t.state.x, t.state.y);
    game.toastShip(t, 'A Kraken arm has you! Cut it away (board it: "Axes!") or shoot it off within 30 s.', 'bad');
  }
  // What an arm holds, it crushes; after half a minute it tears her open.
  for (const [sid, g] of f.grabs) {
    const s = game.ships.get(sid);
    if (!s) continue;
    hurt(game, f, s, 0.006);
    if (now - g.since > 30 && (now - g.since) % 4 < 1) {
      s.leaks = Math.min(8, s.leaks + 1);
      game.toastShip(s, 'The arm tears your planking open!', 'bad');
    }
  }
  // The beak, for anyone who comes too close; the ink.
  game.forShipsNear(body.state.x, body.state.y, 60, (o) => {
    if (!o.bossOf && o.alive && !o.docked) hurt(game, f, o, 0.02, { crew: 2 });
  });
  if (ships.length && every(f, 'ink', now, 20)) {
    const t = game.rng.pick(ships);
    f.inks.push({ x: t.state.x, y: t.state.y, until: now + 12 });
    game.emit({ k: 'fx', fx: 'ink', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 180 }, t.state.x, t.state.y);
  }
  for (const k of f.inks) {
    game.forShipsNear(k.x, k.y, 180, (o) => {
      if (!o.bossOf && dist(o.state.x, o.state.y, k.x, k.y) < 180) o.addEffect({ id: 'ink', until: now + 2, mods: { spreadMul: 1 } }, now);
    });
  }
}

/** "Axes!": a held ship's boarders hack at the arm that holds her. */
export function axes(game: Game, ship: ShipEntity): string | null {
  for (const f of game.bosses.fights.values()) {
    const g = f.grabs.get(ship.id);
    if (!g) continue;
    const arm = game.ships.get(g.arm);
    if (!arm || !arm.alive) {
      release(game, f, ship.id);
      return null;
    }
    if ((ship.talentReady.axes ?? 0) > game.now) return 'The axe party is still at it';
    if (ship.crew < 6) return 'Not enough hands to swing an axe';
    ship.talentReady.axes = game.now + 5;
    const lost = Math.max(1, Math.round(ship.crew * 0.02));
    ship.crew -= lost;
    const blow = 280 + ship.crew * 3 * ship.stats.boardingPower;
    applyDamage(game, arm, { hull: blow }, ship);
    credit(game, f, ship, 'control', 10);
    game.emit({ k: 'fx', fx: 'axes', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 30 }, ship.state.x, ship.state.y);
    game.toastShip(ship, `Axes! The arm bleeds (${Math.round(blow)}); ${lost} men lost to it.`, 'info');
    return null;
  }
  return 'Nothing holds you';
}

export function grabbedBy(game: Game, ship: ShipEntity): boolean {
  for (const f of game.bosses.fights.values()) if (f.grabs.has(ship.id)) return true;
  return false;
}

function whaleSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.3 && f.phase < 2) {
    setPhase(game, f, 2);
    const heart = spawnPart(game, f, 'whale_heart', body.state.x, body.state.y, body.state.heading, 'Heart of the Whale', 'heart');
    heart.crew = 240;
    sayTo(game, ships, 'The Whale slows, dying. Cannon will not finish it — heave to alongside and BOARD its heart!', 'good');
  } else if (hp <= 0.6 && f.phase === 0) setPhase(game, f, 1);
  // The dead come down off its back and board.
  if (f.phase === 0 && every(f, 'boarders', now, 25)) {
    const adds = [...f.parts].filter(([id, p]) => p === 'add' && game.ships.get(id)?.alive).length;
    for (let i = 0; i < 2 && adds + i < 6; i++) {
      const a = game.rng.range(0, Math.PI * 2);
      const b = game.spawnNpcShip('ghost', 'sloop', 'choir', body.state.x + Math.sin(a) * 80, body.state.y - Math.cos(a) * 80, a, { ship: 'Drowned Boarders', captain: 'the Drowned' });
      b.crew = b.stats.crewMax;
      b.morale = 100;
      b.bossOf = f.id;
      b.bossPart = 'add';
      f.parts.set(b.id, 'add');
      const brain = game.npcs.get(b.id);
      const t = nearest(ships, b.state.x, b.state.y);
      if (brain) {
        brain.active = true;
        if (t) brain.target = t.id;
      }
      game.grid.upsert(b.id, b.state.x, b.state.y);
    }
  }
  // The Song: −3 morale every 10 s within 1.6 km, unless a Choir Bell tolls near or a deep pastor leads the prayers.
  f.songActive = f.phase === 1;
  if (f.phase === 1 && every(f, 'song', now, 10)) {
    const bells = ships.filter((s) => s.hasFlag('choir_bell'));
    game.emit({ k: 'fx', fx: 'song', x: Math.round(body.state.x), y: Math.round(body.state.y), r: 1600 }, body.state.x, body.state.y);
    for (const s of ships) {
      if (dist(s.state.x, s.state.y, body.state.x, body.state.y) > 1600) continue;
      const bell = bells.find((b) => dist(b.state.x, b.state.y, s.state.x, s.state.y) <= 400);
      const pastor = s.isPlayer && hasOfficer(game.profileOf(s)?.company, 'deep_pastor', now);
      if (bell || pastor) {
        credit(game, f, bell ?? s, 'support', 2);
        continue;
      }
      s.morale = Math.max(0, s.morale - 3);
      if (s.isPlayer && every(f, `songmsg${s.id}`, now, 30)) game.toastShip(s, 'The Song of the Drowned Whale: your crew weeps and lets go of the ropes (−3 morale). A Choir Bell within 400 m or a deep pastor quiets it.', 'bad');
    }
  }
  // The heart's guard fills up again slowly.
  for (const [id, p] of f.parts) {
    if (p !== 'heart') continue;
    const heart = game.ships.get(id);
    if (heart && !heart.boarding) heart.crew = Math.min(240, heart.crew + 2);
  }
}

function mawSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.5) setPhase(game, f, 1);
  if (every(f, 'lures', now, f.phase === 1 ? 30 : 60)) placeLures(game, f, body);
  // Inside: the gut burns; after a minute what is left is digested.
  for (const [sid, sw] of [...f.swallowed]) {
    const s = game.ships.get(sid);
    if (!s) continue;
    applyDamage(game, s, { hull: s.stats.hullMax * 0.015, crew: 1 }, body);
    if (now - sw.since >= SWALLOW_TIME && s.alive) {
      f.swallowed.delete(sid);
      s.effects = s.effects.filter((e) => e.id !== 'swallowed');
      s.recompute(now);
      s.hull = 0;
      game.toastShip(s, 'Digested. The Lantern Maw keeps what it swallows.', 'bad');
      game.beginSinking(s);
    }
  }
  // The Hungry Dark: its night eats the lookouts' sight.
  if (f.phase === 1) for (const s of ships) s.addEffect({ id: 'maw_dark', until: now + 2, mods: { detection: -0.4 } }, now);
}

function serpentSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.4 && f.phase === 0) {
    setPhase(game, f, 1);
    f.ring = null;
    f.inRing.clear();
    sayTo(game, ships, 'The Serpent breaks away for the shoals! Only small, fast ships can keep up — and big guns cannot hit it in the shallows.', 'info');
  }
  if (f.phase === 1) {
    const near = ships.some((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 1200);
    if (near) f.aloneSince = now;
    else if (now - f.aloneSince > 60) return void end(game, f, 'escaped');
    return;
  }
  // The coil: a ring around the thick of the fleet.
  if (!f.ring && ships.length && every(f, 'coil', now, 40)) {
    let cx = 0, cy = 0;
    const close = ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 1500);
    for (const s of close) {
      cx += s.state.x;
      cy += s.state.y;
    }
    if (close.length) {
      cx /= close.length;
      cy /= close.length;
      f.ring = { x: cx, y: cy, r: 320, until: now + 20, a: Math.atan2(body.state.x - cx, -(body.state.y - cy)) };
      f.inRing = new Set(ships.filter((s) => dist(s.state.x, s.state.y, cx, cy) < 320).map((s) => s.id));
      game.emit({ k: 'fx', fx: 'coil', x: Math.round(cx), y: Math.round(cy), r: 320 }, cx, cy);
      sayTo(game, close, 'The Black Serpent throws its coils around you — its body is a wall!');
    }
  }
  if (f.ring) {
    const r = f.ring;
    // The head bites inside the coil; the tail sweeps the biggest hull.
    const h = head(body);
    const inside = ships.filter((s) => dist(s.state.x, s.state.y, r.x, r.y) < r.r);
    if (every(f, 'bite', now, 4)) {
      const t = nearest(inside, h.x, h.y);
      if (t && dist(t.state.x, t.state.y, h.x, h.y) < 160) hurt(game, f, t, 0.05, { crew: 3 });
    }
    if (inside.length && every(f, 'tail', now, 10)) {
      const big = inside.reduce((a, b) => (b.cls.tier > a.cls.tier ? b : a));
      if (big.cls.tier >= 3) {
        hurt(game, f, big, 0.02 * big.cls.tier);
        game.toastShip(big, 'The tail sweeps your great hull — a big ship has nowhere to turn inside the coil.', 'bad');
      }
    }
  }
  // Bile: canvas-eating spit.
  if (ships.length && every(f, 'bile', now, 8)) {
    const t = game.rng.pick(ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 900).concat([]));
    if (t) {
      f.bile = { x: t.state.x, y: t.state.y, until: now + 3 };
      game.emit({ k: 'fx', fx: 'bile', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 70 }, t.state.x, t.state.y);
      game.forShipsNear(t.state.x, t.state.y, 70, (o) => {
        if (o.bossOf || !o.alive) return;
        o.sails = Math.max(0, o.sails - o.stats.sailHpMax * 0.25);
        o.addEffect({ id: 'bile', until: now + 15, mods: { sailHpMax: -0.2 } }, now);
        o.recompute(now);
        game.toastShip(o, 'Serpent bile! Your canvas smokes and rots (−25% sails).', 'bad');
      });
    }
  }
  if (f.bile && f.bile.until <= now) f.bile = null;
}

function admiralSecond(game: Game, f: Fight): void {
  const now = game.now;
  const afloat = [...f.lanterns.keys()].filter((id) => game.ships.get(id)?.alive);
  if (afloat.length === 1 && f.phase === 0) {
    setPhase(game, f, 1);
    const last = game.ships.get(afloat[0]);
    if (last) last.addEffect({ id: 'last_flag', until: now + 1e9, mods: { reloadMul: -0.25, gunDamageMul: 0.2 } }, now);
  }
  if (!afloat.length) return void end(game, f, 'slain');
  // The body of the fight follows the line: its flagship, or whoever is left.
  if (!game.ships.get(f.id)?.alive && afloat.length) {
    // The flagship is gone for good; the fight is carried by the rest.
    const next = game.ships.get(afloat[0])!;
    game.bosses.fights.delete(f.id);
    f.id = next.id;
    for (const id of f.parts.keys()) {
      const s = game.ships.get(id);
      if (s) s.bossOf = f.id;
    }
    game.bosses.fights.set(f.id, f);
  }
  // Their own wind: the gauge is always theirs.
  f.wind.at = now;
}

function motherSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  const cores = [...f.parts].filter(([id, p]) => p === 'core' && game.ships.get(id)?.alive);
  if (!cores.length) {
    body.hull = 0;
    return void game.beginSinking(body);
  }
  if (hp <= 0.5) setPhase(game, f, 1);
  // While the cores beat, the shell grows back.
  body.hull = Math.min(body.stats.hullMax, body.hull + body.stats.hullMax * 0.004 * cores.length / 3);
  // Claws for anything in the maze; wreckage hurled at the biggest hull further out.
  if (every(f, 'claws', now, 5)) {
    game.forShipsNear(body.state.x, body.state.y, 130, (o) => {
      if (!o.bossOf && o.alive && !o.docked) hurt(game, f, o, 0.03, { crew: 2 });
    });
    game.emit({ k: 'fx', fx: 'claws', x: Math.round(body.state.x), y: Math.round(body.state.y), r: 130 }, body.state.x, body.state.y);
  }
  if (every(f, 'debris', now, 6)) {
    const far = ships.filter((s) => dist(s.state.x, s.state.y, body.state.x, body.state.y) < 1400);
    if (far.length) {
      const big = far.reduce((a, b) => (b.cls.tier > a.cls.tier ? b : a));
      game.strikes.push({ at: now + 2.5, x: big.state.x + game.rng.gauss() * 25, y: big.state.y + game.rng.gauss() * 25, radius: 50, hull: 90 + big.stats.hullMax * 0.02, rudder: 0.05, owner: body.id, slow: 0, shells: 1, fx: 'mortar' });
    }
  }
}

function widowSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.4) setPhase(game, f, 1);
  if (now - f.wind.at >= 15) {
    f.wind = { dir: game.rng.range(0, Math.PI * 2), strength: 1.25, at: now };
    sayTo(game, ships, 'The wind veers — trim for the new wind!', 'info');
  }
  const outside = ships.filter((s) => dist(s.state.x, s.state.y, f.eye.x, f.eye.y) > f.eye.r);
  // Lightning seeks the tallest mast.
  if (outside.length && every(f, 'lightning', now, f.phase === 1 ? 4 : 6)) {
    const top = Math.max(...outside.map((s) => s.cls.tier));
    const t = game.rng.pick(outside.filter((s) => s.cls.tier === top));
    const rod = t.hasFlag('lightning_rod') ? 0.4 : 1;
    hurt(game, f, t, 0.06 * rod, { sails: t.stats.sailHpMax * 0.1 * rod, crew: 2 * rod });
    if (rod === 1 && game.rng.chance(0.3)) t.addEffect({ id: 'fire', until: now + 8 }, now); // a rod takes the fire to the sea too
    game.emit({ k: 'fx', fx: 'lightning', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 30 }, t.state.x, t.state.y);
    game.toastShip(t, rod < 1 ? 'Lightning! The rod takes most of it.' : 'Lightning strikes your mainmast! (A Lightning Rod would ground it.)', 'bad');
  }
  // The sea outside the eye.
  if (every(f, 'waves', now, 10)) for (const s of outside) hurt(game, f, s, 0.01);
}

// -- The Eye of the Abyss: the black storm, the dead wind, the fall.
function eyeTick(game: Game, f: Fight, body: ShipEntity, dt: number): void {
  place(game, body, f.anchor.x, f.anchor.y, body.state.heading + 0.1 * dt);
  body.state.speed = 0;
  if (f.phase === 2) whirlpool(game, f, f.anchor.x, f.anchor.y, 1500, dt);
}

function eyeSecond(game: Game, f: Fight, body: ShipEntity, ships: ShipEntity[], hp: number): void {
  const now = game.now;
  if (hp <= 0.33) setPhase(game, f, 2);
  else if (hp <= 0.66) setPhase(game, f, 1);
  if (f.phase === 0) {
    if (now - f.wind.at >= 8) {
      f.wind = { dir: f.wind.dir + (game.rng.chance(0.5) ? 1 : -1) * game.rng.range(45, 120) * (Math.PI / 180), strength: 1.3, at: now };
    }
    if (ships.length && every(f, 'lightning', now, 5)) {
      const top = Math.max(...ships.map((s) => s.cls.tier));
      const t = game.rng.pick(ships.filter((s) => s.cls.tier === top));
      const rod = t.hasFlag('lightning_rod') ? 0.4 : 1;
      hurt(game, f, t, 0.05 * rod, { sails: t.stats.sailHpMax * 0.1 * rod, crew: 2 });
      game.emit({ k: 'fx', fx: 'lightning', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 30 }, t.state.x, t.state.y);
    }
  }
  if (f.phase === 1 && ships.length && every(f, 'echoes', now, 20)) {
    const e = spawnEcho(game, game.rng.pick(ships));
    if (e) {
      e.bossOf = f.id;
      e.bossPart = 'add';
      f.parts.set(e.id, 'add');
    }
  }
  if (f.phase === 2) f.whirl = { x: f.anchor.x, y: f.anchor.y, until: now + 2 };
}

// ================================================================== hooks from combat and the game

/**
 * A hit on a boss or its parts: returns the packet as it lands (weak points, the eye, shells and mazes),
 * or null when it cannot land at all; records the contribution.
 */
export function bossIncoming(game: Game, target: ShipEntity, d: DamagePacket, source: ShipEntity | null, at?: { x: number; y: number }): DamagePacket | null {
  const f = game.bosses.fightOf(target);
  if (!f) return d;
  if (source?.bossOf === f.id) return d; // its own lightning and claws are not for it
  let mul = 1;
  const part = f.parts.get(target.id) ?? 'body';
  switch (f.kind) {
    case 'abyss_eye':
      if (f.phase < 2) mul = 0.25; // it only truly opens as it falls
      else if (!source || dist(source.state.x, source.state.y, target.state.x, target.state.y) > 900) return null;
      break;
    case 'leviathan':
    case 'ancient_leviathan': {
      if (target.hasEffect('gills_open') && at) {
        const h = head(target);
        if (dist(at.x, at.y, h.x, h.y) < 35) mul = 2;
      }
      break;
    }
    case 'kraken':
      if (part === 'body' && target.hasEffect('kraken_guard')) return null;
      break;
    case 'drowned_whale':
      if (part === 'heart') return null; // only boarders reach the heart
      if (f.phase === 2) {
        mul = 0.05;
        if (target.hull - (d.hull ?? 0) * mul < target.stats.hullMax * 0.02) return null;
      }
      break;
    case 'lantern_maw':
      if (source?.hasEffect('swallowed')) mul = 1; // the inner volley already carries its ×3
      break;
    case 'black_serpent':
      if (f.phase === 1 && source && draftOf(source) > 3) mul = 0.35;
      break;
    case 'mother_of_wrecks':
      if (part === 'core') {
        if (!source || dist(source.state.x, source.state.y, target.state.x, target.state.y) > 115) return null;
        const shell = game.ships.get(f.id);
        if (shell && shell.hull > shell.stats.hullMax * 0.5) mul = 0.35;
      } else if (target.hull - (d.hull ?? 0) < 1) {
        // The shell never breaks while a core still beats.
        d = { ...d, hull: Math.max(0, target.hull - 1) };
      }
      break;
    case 'storm_widow':
      if (!source || dist(source.state.x, source.state.y, f.eye.x, f.eye.y) > f.eye.r) return null;
      break;
    case 'hollow_admiral':
      break;
    default: {
      // The six of 2026-10-03: their shells, wards and false shapes (null: it cannot land at all).
      const m = tenIncoming(game, f, target, part, source);
      if (m === null) return null;
      mul = m;
    }
  }
  const out: DamagePacket = mul === 1 ? d : { ...d, hull: (d.hull ?? 0) * mul };
  credit(game, f, source, 'dmg', Math.min(target.hull, out.hull ?? 0));
  return out;
}

/** A boss or one of its parts goes under: returns true when this module handled it (no wreck, no credit). */
export function bossSinking(game: Game, ship: ShipEntity): boolean {
  const f = game.bosses.fightOf(ship);
  if (!f) return false;
  const part = f.parts.get(ship.id);
  const now = game.now;
  // The Rime Twins: the one that falls while its twin stands strong is sung back from the sea (bosses10.ts).
  const ten = tenSinking(game, f, ship, part);
  if (ten !== undefined) return ten;
  if (part === 'ghost') {
    // A lit soul-lantern raises the ghost again.
    if (f.lanterns.get(ship.id)) {
      ship.hull = ship.stats.hullMax * 0.4;
      submerge(game, ship, 15);
      ship.attackers.clear();
      game.emit({ k: 'fx', fx: 'rise', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 60 }, ship.state.x, ship.state.y);
      sayTo(game, fighters(game, f), `${ship.name} goes under — and its soul-lantern still burns. It will rise. Board it to put the lantern out.`, 'bad');
      return true;
    }
    return false; // the lantern is out: she sinks like any ship
  }
  if (part === 'add') return false;
  ship.sinkingUntil = now + 6;
  ship.boarding = null;
  game.emit({ k: 'sunk', ship: ship.id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), name: ship.name }, ship.state.x, ship.state.y);
  if (part === 'arm') {
    for (const [sid, g] of f.grabs) if (g.arm === ship.id) release(game, f, sid);
    let killer: ShipEntity | null = null, t = -Infinity;
    for (const [id, at] of ship.attackers) if (at > t) {
      t = at;
      killer = game.ships.get(id) ?? null;
    }
    credit(game, f, killer, 'control', 30);
    return true;
  }
  if (part === 'core') {
    sayTo(game, fighters(game, f), 'A wreck core bursts! The reef shudders.', 'good');
    return true;
  }
  if (ship.id === f.id) end(game, f, 'slain');
  return true;
}

/** The boarders won aboard a boss part: the Whale's heart, a ghost's soul-lantern. */
export function bossBoarded(game: Game, winner: ShipEntity, b: ShipEntity): boolean {
  const f = game.bosses.fightOf(b);
  if (!f) return false;
  const part = f.parts.get(b.id);
  b.lootLockedFor = null;
  b.surrendered = false;
  if (part === 'heart') {
    credit(game, f, winner, 'control', 300);
    game.toastShip(winner, 'Your boarders cut out the Heart of the Whale!', 'good');
    b.hull = 0;
    game.beginSinking(b);
    const body = game.ships.get(f.id);
    if (body && body.alive) {
      body.hull = 0;
      game.beginSinking(body);
    }
    return true;
  }
  if (part === 'ghost') {
    f.lanterns.set(b.id, false);
    credit(game, f, winner, 'control', 150);
    game.toastShip(winner, `You put out the soul-lantern of ${b.name}. She will not rise again.`, 'good');
    b.hull = 0;
    game.beginSinking(b);
    return true;
  }
  return false;
}

/** Boarding a monster: the heart and the ghost line can be boarded; anything else is not a ship. */
export function bossBoardOrder(game: Game, ship: ShipEntity, target: ShipEntity): string | null | undefined {
  if (grabbedBy(game, ship)) return axes(game, ship);
  if (!target.bossOf) return undefined;
  const part = game.bosses.fightOf(target)?.parts.get(target.id);
  if (part === 'heart' || part === 'ghost' || part === 'add') return undefined;
  return 'There are no decks to board on a creature of the deep';
}

/** Their own wind (the Hollow Admiral's gauge, the Storm Widow's gale) for ships within reach. */
export function bossWind(game: Game, ship: ShipEntity): WindSample | null {
  for (const f of game.bosses.fights.values()) {
    if (f.kind !== 'hollow_admiral' && f.kind !== 'storm_widow' && f.kind !== 'abyss_eye') continue;
    const body = game.ships.get(f.id);
    if (!body) continue;
    const d = dist(body.state.x, body.state.y, ship.state.x, ship.state.y);
    if (d > 3200) continue;
    if (f.kind === 'abyss_eye') {
      if (f.phase === 1) return { dir: f.wind.dir, strength: 0.02 }; // the dead wind
      if (f.phase === 0) return { dir: f.wind.dir, strength: 1.3 }; // the black storm's leaping wind
      return null;
    }
    if (f.kind === 'storm_widow') {
      const calm = dist(ship.state.x, ship.state.y, f.eye.x, f.eye.y) < f.eye.r;
      return { dir: f.wind.dir, strength: calm ? 0.35 : f.wind.strength };
    }
    // The ghosts hold the weather gauge: the wind blows from their line down onto everyone else.
    if (ship.bossOf === f.id) {
      const t = nearest(fighters(game, f, 3200), ship.state.x, ship.state.y);
      return { dir: t ? Math.atan2(t.state.x - ship.state.x, -(t.state.y - ship.state.y)) : ship.state.heading, strength: 0.9 };
    }
    return { dir: Math.atan2(ship.state.x - body.state.x, -(ship.state.y - body.state.y)), strength: 0.9 };
  }
  return null;
}

/** Nothing outside touches a ship in the Maw's gut, and nothing inside it but the Maw. */
export function swallowedShield(target: ShipEntity, source: ShipEntity | null): boolean {
  return target.hasEffect('swallowed') && !!source && source.npcRole !== 'boss';
}

// ================================================================== the end

export function end(game: Game, f: Fight, how: 'slain' | 'escaped' | 'gone'): void {
  if (!game.bosses.fights.has(f.id)) return;
  game.bosses.fights.delete(f.id);
  tenEnd(game, f); // the six of 2026-10-03: what they hold let go
  const body = game.ships.get(f.id);
  const x = body?.state.x ?? f.anchor.x, y = body?.state.y ?? f.anchor.y;
  for (const sid of [...f.grabs.keys()]) release(game, f, sid);
  for (const sid of [...f.swallowed.keys()]) {
    const s = game.ships.get(sid);
    if (s) spit(game, f, s, how === 'slain' ? 'The Maw dies around you — you cut your way out into the night air!' : 'The Maw spits you out as it sinks away.');
  }
  // Parts go down with it (or back into the deep).
  for (const id of f.parts.keys()) {
    const s = game.ships.get(id);
    if (!s || id === f.id) continue;
    if (how === 'slain' && s.alive && !s.sinkingUntil) {
      s.bossOf = 0;
      s.hull = 0;
      s.sinkingUntil = game.now + 6;
      game.emit({ k: 'sunk', ship: s.id, x: Math.round(s.state.x), y: Math.round(s.state.y), name: s.name }, s.state.x, s.state.y);
    } else if (how !== 'slain') game.removeShip(id);
  }
  if (how !== 'slain') {
    if (body) game.removeShip(body.id);
    game.addRumor(x, y, `${f.def.name} sank back into the deep, unbeaten.`);
    for (const s of game.sessions) if (s.ship && dist(s.ship.state.x, s.ship.state.y, x, y) < BOSS_RANGE * 2) game.sendTo(s, { t: 'toast', msg: `${f.def.name} sinks back into the deep, unbeaten.`, kind: 'info' });
    game.log(`[boss] ${f.kind} ${how}`);
    return;
  }
  reward(game, f, x, y);
}

/** Personal spoils by contribution; rares once a week; the first kill on the server is remembered. */
export function reward(game: Game, f: Fight, x: number, y: number): void {
  const def = f.def;
  let total = 0;
  for (const c of f.contrib.values()) total += scoreOf(f, c);
  const names: string[] = [];
  const wall = game.wallNow();
  const ranked = [...f.contrib.entries()].sort((a, b) => scoreOf(f, b[1]) - scoreOf(f, a[1]));
  for (const [account, c] of ranked) {
    const share = total > 0 ? scoreOf(f, c) / total : 0;
    if (share < 0.01 && scoreOf(f, c) < 5) continue;
    names.push(c.name);
    const s = game.sessionByAccount(account);
    const p = s?.profile;
    if (!s || !p) continue;
    logNote(game, s, 'boss', [def.name]); // the captain's log (docs/16 #20)
    const k = lootFactor(def, share);
    const cargo: Cargo = {};
    for (const [g, [lo, hi]] of Object.entries(def.goods) as [GoodId, [number, number]][]) cargo[g] = Math.max(1, Math.round(lo + (hi - lo) * k));
    const lines: string[] = [];
    // Rare drops: once a week per boss.
    if ((p.bossLocks[def.id] ?? 0) <= wall) {
      for (const r of def.rare) {
        if (!game.rng.chance(r.chance * k)) continue;
        if (r.kind === 'module') {
          const id = r.id as ModuleId;
          if (!p.blueprints.includes(id)) {
            p.blueprints.push(id);
            lines.push(`the plans for ${MODULES[id].name}`);
          } else {
            p.gold += 2500;
            lines.push(`plans you already hold (sold for 2 500)`);
          }
        } else if (r.kind === 'figurehead') {
          const id = r.id as FigureheadId;
          p.figureheads.push(id);
          lines.push(`the ${FIGUREHEADS[id].name} figurehead`);
        } else cargo[r.id as GoodId] = (cargo[r.id as GoodId] ?? 0) + (r.qty ?? 1);
        p.bossLocks[def.id] = wall + BOSS_LOCKOUT * 1000;
      }
    }
    game.dropPrivateLoot(account, x + game.rng.range(-60, 60), y + game.rng.range(-60, 60), cargo, 900);
    if (account === ranked[0][0]) legendFragment(game, s, 0.35, `In the belly of ${def.name}`);
    if (!p.trophies.includes(def.trophy)) {
      p.trophies.push(def.trophy);
      lines.push(`a trophy: ${def.trophy}`);
    }
    p.bossKills[def.id] = (p.bossKills[def.id] ?? 0) + 1;
    tattooCount(game, s, 'boss');
    // Leviathan Slain (canon): a tenth of its death is one's own.
    if ((def.id === 'leviathan' || def.id === 'ancient_leviathan') && share >= 0.1) grantDeed(game, s, 'deed_leviathan_slain');
    seasonStat(game, s, 'monsters', Math.round(share * 100));
    if (def.id === 'ancient_leviathan' || def.id === 'abyss_eye') seasonStat(game, s, 'abyss', Math.round(share * 100));
    // The Abyss's own: ritual shards for everyone who truly fought, and a chapter of the story.
    if (def.id === 'ancient_leviathan' || def.id === 'abyss_eye') {
      if (share >= 0.05 || def.id === 'abyss_eye') giveShard(game, s, `From ${def.name}`);
      chapter(game, s, def.id === 'abyss_eye' ? 'eye' : 'ancient');
    }
    game.grantXp(s, def.xp * (0.3 + 0.7 * k), `${def.name} slain`);
    if (share >= 0.1) artifactFind(game, s, 'boss'); // docs/17 H2: a boss keeps an artifact
    if (share >= 0.1) maybeScroll(game, s, 'boss'); // docs/18 item 10: and a scroll of a page
    const pct = Math.round(share * 100);
    game.sendTo(s, { t: 'toast', msg: `${def.name} is slain! Your part: ${pct}%. Your share of the spoils floats where it died${lines.length ? `; and ${lines.join(', ')}` : ''}.`, kind: 'gold' });
    game.saveSession(s);
  }
  const who = names.slice(0, 4).join(', ') + (names.length > 4 ? ` and ${names.length - 4} more` : '');
  game.addRumor(x, y, `${def.name} was slain by ${who || 'nobody the taverns can name'}.`);
  if (names.length) chronicle(game, `${def.name} was slain by ${who}.`); // for those ashore (docs/16 #30)
  for (const s of game.sessions) if (s.ship && !f.contrib.has(s.accountId) && dist(s.ship.state.x, s.ship.state.y, x, y) < 20000) game.sendTo(s, { t: 'toast', msg: `WORLD: ${def.name} was slain by ${who}.`, kind: 'info' });
  // The first kill on the server goes in the book (the Pantheon, Phase 9).
  const firsts = game.db.getKv<Record<string, { names: string[]; at: number }>>('boss_firsts') ?? {};
  if (!firsts[def.id] && names.length) {
    firsts[def.id] = { names: names.slice(0, 20), at: wall };
    game.db.setKv('boss_firsts', firsts);
    onFirstKill(game, def.id); // the keel of a legendary ship
    for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `FIRST ON THE SEAS: ${def.name} falls for the first time — to ${who}.`, kind: 'gold' });
  }
  game.log(`[boss] ${f.kind} slain by ${names.length} captains`);
}

// ================================================================== the view

function view(game: Game, f: Fight, body: ShipEntity, s: PlayerSession): BossView {
  const now = game.now;
  const zones: BossZone[] = [];
  const rz = (k: BossZone['k'], x: number, y: number, r: number) => zones.push({ k, x: Math.round(x), y: Math.round(y), r: Math.round(r) });
  if (f.whirl) rz('whirl', f.whirl.x, f.whirl.y, 720);
  if (f.ring) rz('ring', f.ring.x, f.ring.y, f.ring.r);
  if (f.charge && now < f.charge.at) rz('telegraph', f.charge.x, f.charge.y, 70);
  for (const k of f.inks) rz('ink', k.x, k.y, 180);
  for (const l of f.lures) rz('lure', l.x, l.y, 90);
  if (f.bile) rz('bile', f.bile.x, f.bile.y, 70);
  if (f.kind === 'storm_widow') rz('eye', f.eye.x, f.eye.y, f.eye.r);
  if (f.kind === 'mother_of_wrecks') rz('maze', body.state.x, body.state.y, 100);
  if (f.songActive) rz('song', body.state.x, body.state.y, 1600);
  tenZones(game, f, body, s, rz); // the six of 2026-10-03
  const parts: BossView['parts'] = [];
  for (const [id, p] of f.parts) {
    if (id === f.id || p === 'add' || p === 'phantom') continue;
    const o = game.ships.get(id);
    if (!o) continue;
    const own = tenPart(game, f, id, p, o);
    if (own) {
      parts.push(own);
      continue;
    }
    const label = p === 'ghost' ? `${o.name}${f.lanterns.get(id) ? ' (lantern lit)' : ' (lantern out)'}` : o.name;
    parts.push({ id, label, hp: Math.max(0, Math.round(o.alive ? o.hull : 0)), hpMax: Math.round(o.stats.hullMax) });
  }
  let total = 0;
  for (const c of f.contrib.values()) total += scoreOf(f, c);
  const mine = f.contrib.get(s.accountId);
  const sw = s.ship ? f.swallowed.get(s.ship.id) : undefined;
  // Where it is as she sees it (the Changeling's true shape is not shown to those too far to see its wake).
  const at = tenWhere(game, f, body, s) ?? body.state;
  return {
    id: f.id, kind: f.kind, name: f.def.name, phase: f.phase, phaseName: f.def.phases[f.phase] ?? '',
    hp: Math.max(0, Math.round(body.hull)), hpMax: Math.round(body.stats.hullMax), x: Math.round(at.x), y: Math.round(at.y),
    hint: hintFor(game, f, body), endsIn: Math.max(0, Math.round(f.endsAt - now)), parts, zones,
    you: { share: mine && total > 0 ? Math.round((scoreOf(f, mine) / total) * 1000) / 1000 : 0, grabbed: !!s.ship && f.grabs.has(s.ship.id), swallowed: sw ? Math.max(0, Math.round(SWALLOW_TIME - (now - sw.since))) : 0 },
  };
}

function hintFor(game: Game, f: Fight, body: ShipEntity): string {
  switch (f.kind) {
    case 'abyss_eye':
      return f.phase === 0 ? 'The black storm: the wind leaps every few seconds, lightning finds the tallest mast. The Eye shrugs off shot (×0.25).' : f.phase === 1 ? 'The dead wind: no wind at all within 3 km, and the Echoes rise. Row, tow, fight.' : 'The fall: the sea pours into the Eye. Only guns within 900 m of it reach it — and too close, it swallows you.';
    case 'ancient_leviathan':
    case 'leviathan':
      if (f.whirl) return 'Sail WITH the whirlpool current — against it you are drawn into the mouth.';
      return `Harpoon lines: ${tethersOn(game, body)}/${linesNeeded(game, f)} to hold it. Held, its gills open (×2 at the head).`;
    case 'kraken':
      return f.phase === 0 ? `Cut away the arms (${[...f.parts].filter(([id, p]) => p === 'arm' && game.ships.get(id)?.alive).length} left; the body opens at 4). Held? Board the arm: "Axes!"` : 'The body is open — pour it on.';
    case 'drowned_whale':
      return f.phase === 0 ? 'Fight off the drowned boarders.' : f.phase === 1 ? 'The Song drains morale: a Choir Bell within 400 m or a deep pastor quiets it.' : 'Board the Heart of the Whale — cannon cannot finish it.';
    case 'lantern_maw':
      return 'Lanterns draw it: sail dark (Dark Running). False lights are traps. Swallowed? Fire everything — ×3 inside.';
    case 'black_serpent':
      return f.phase === 0 ? 'The coil is a wall; bile rots your sails; the tail punishes big hulls.' : 'The chase: small fast ships only — its shoals turn big guns aside (−65%).';
    case 'hollow_admiral':
      return 'Sunk ghosts rise while their soul-lanterns burn. Board them to put the lanterns out.';
    case 'mother_of_wrecks':
      return 'Heavy guns on the shell; ships drawing ≤ 2.5 m into the maze to kill the cores (within 115 m).';
    case 'storm_widow':
      return 'Only hits from inside the moving eye land. Lightning seeks the tallest mast.';
    default:
      return tenHint(game, f, body); // the six of 2026-10-03
  }
}

/** Eyes of the Choir and friends: where the bosses are. */
export function bossPositions(game: Game): [number, number][] {
  const out: [number, number][] = [];
  for (const f of game.bosses.fights.values()) {
    const b = game.ships.get(f.id);
    if (b) out.push([b.state.x, b.state.y]);
  }
  return out;
}

export function isBossPart(ship: ShipEntity): boolean {
  return ship.npcRole === 'boss';
}
