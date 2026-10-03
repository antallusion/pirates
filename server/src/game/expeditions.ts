// PvE locations (docs/02 §11.A.5): sunken cities and ship graveyards, out in the open sea where rivals can
// wait at the entrance. A sunken city is dived: the ship rides at anchor over the bell buoy while the diving
// party works through a drowned maze in the bell (air, traps, guardians, a vault behind a key), and the dead
// come for the ship above. A graveyard is sailed: a wall of wrecks with gates blocked by rotten hulks (mortars
// bring them down), a keel limit, a current, ambushes from the wrecks, and the Graveyard Captain at its heart.
// Each week's Tide changes them: Fog, Blood Moon, Calm.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { DiveRoomView, DiveView, PveSiteView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { beforePorts, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import type { World } from '../../../shared/src/world/worldgen.ts';
import { diveDepth } from './explorefx.ts';
import type { Game } from './Game.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { grantPlan } from './shipbuilding.ts';
import { legendFragment } from './treasure.ts';

export type Tide = 'none' | 'fog' | 'blood_moon' | 'calm';

export interface PveSite {
  id: string;
  kind: 'city' | 'graveyard';
  name: string;
  region: RegionId;
  x: number;
  y: number;
  r: number;
}

// -------------------------------------------------------------- the sunken city's maze

export type RoomKind = 'entry' | 'hall' | 'relic' | 'trap' | 'guardian' | 'key' | 'vault' | 'shrine';

export interface Room {
  kind: RoomKind;
  doors: number; // bits: 1 north, 2 east, 4 south, 8 west
  done: boolean;
}

export const MAZE_W = 7;
export const MAZE_H = 7;
const DIRS: Record<'n' | 'e' | 's' | 'w', { bit: number; back: number; dx: number; dy: number }> = {
  n: { bit: 1, back: 4, dx: 0, dy: -1 },
  e: { bit: 2, back: 8, dx: 1, dy: 0 },
  s: { bit: 4, back: 1, dx: 0, dy: 1 },
  w: { bit: 8, back: 2, dx: -1, dy: 0 },
};

export interface DiveRun {
  id: number;
  site: string;
  leader: number; // account
  members: number[]; // accounts (the leader first), up to five ships
  anchor: { x: number; y: number };
  started: number;
  ends: number;
  rooms: Room[];
  pos: number;
  seen: Set<number>;
  air: number;
  airMax: number;
  divers: number;
  keys: number;
  haul: Cargo;
  silver: number;
  plan: boolean; // a vault plan found
  nextMove: number;
  nextWave: number;
  wave: number;
  adds: Set<number>;
  log: string[];
}

interface Graveyard {
  site: PveSite;
  hulks: Map<number, { x: number; y: number; h: number; gate: number }>; // entity → where it lies (gate −1: loose wreck)
  gates: { a: number; open: boolean }[];
  captain: number; // entity id (0: not risen)
  resetAt: number; // world time the graveyard fills again
  ambushAt: number;
}

const CITY_NAMES = ['Sunken Ys', 'The Bells of Vael', 'Drowned Carcosa', 'Lower Maréchal'];
const YARD_NAMES = ['The Boneyard of Keels', "Widow's Moor"];
const WALL_R = 360;
const YARD_R = 900;
const GATE_ARC = 0.14; // radians either side of a gate
const KEEL_LIMIT = 3.2;
const DIVE_RANGE = 250;

export class ExpeditionHub {
  sites: PveSite[];
  runs = new Map<number, DiveRun>();
  yards = new Map<string, Graveyard>();
  /** Account:site → world time a captain may dive it again. */
  locks = new Map<string, number>();
  private seq = 1;
  private sentKey = '';

  constructor(world: World) {
    this.sites = buildSites(world);
  }

  site(id: string): PveSite | undefined {
    return this.sites.find((s) => s.id === id);
  }

  runOf(accountId: number): DiveRun | undefined {
    for (const r of this.runs.values()) if (r.members.includes(accountId)) return r;
    return undefined;
  }

  nextId(): number {
    return this.seq++;
  }

  viewsKey(k: string): boolean {
    if (k === this.sentKey) return false;
    this.sentKey = k;
    return true;
  }
}

/** Where the sunken cities and the graveyards lie (fixed by the world seed). */
export function buildSites(world: World): PveSite[] {
  world = beforePorts(world); // where they always lay (the twenty new towns keep off them: shared/src/world/newports.ts)
  const rng = new Rng(world.seed ^ 0xc17e);
  const out: PveSite[] = [];
  const place = (region: RegionId, kind: PveSite['kind'], name: string, r: number) => {
    const [cx, cy] = REGIONS[region].center;
    for (let i = 0; i < 400; i++) {
      const x = cx + rng.range(-11000, 11000), y = cy + rng.range(-11000, 11000);
      if (regionAt(world, x, y) !== region || isLand(world, x, y)) continue;
      if (world.islands.some((is) => dist(is.x, is.y, x, y) < is.radius + r + 400)) continue;
      if (world.ports.some((p) => dist(p.x, p.y, x, y) < 4000)) continue;
      if (world.reefs.some((f) => dist(f.x, f.y, x, y) < f.radius + r + 200)) continue;
      if (out.some((o) => dist(o.x, o.y, x, y) < 5000)) continue;
      out.push({ id: `${kind}${out.length}`, kind, name, region, x: Math.round(x), y: Math.round(y), r });
      return;
    }
  };
  place('drowned_crown', 'city', CITY_NAMES[0], 150);
  place('drowned_crown', 'city', CITY_NAMES[1], 150);
  place('drowned_crown', 'city', CITY_NAMES[2], 150);
  place('the_abyss', 'city', CITY_NAMES[3], 150);
  place('dead_mans_expanse', 'graveyard', YARD_NAMES[0], YARD_R);
  place('dead_mans_expanse', 'graveyard', YARD_NAMES[1], YARD_R);
  return out;
}

/** This week's Tide (the same everywhere, turning each wall-clock week). */
export function tideOf(game: Game): Tide {
  const week = Math.floor(game.wallNow() / (7 * 24 * 3600_000));
  return (['none', 'fog', 'blood_moon', 'calm'] as Tide[])[(week * 2654435761 >>> 0) % 4];
}

const TIDE_NAMES: Record<Tide, string> = { none: 'a quiet tide', fog: 'the Fog Tide', blood_moon: 'the Blood Moon', calm: 'the Dead Calm' };

// ================================================================== the sunken city

/** A maze of drowned streets: a spanning tree with a few loops, and what waits in each room. */
export function buildMaze(seed: number): Room[] {
  const rng = new Rng(seed);
  const rooms: Room[] = Array.from({ length: MAZE_W * MAZE_H }, () => ({ kind: 'hall' as RoomKind, doors: 0, done: false }));
  const entry = (MAZE_H - 1) * MAZE_W + Math.floor(MAZE_W / 2);
  const seen = new Set([entry]);
  const stack = [entry];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % MAZE_W, cy = Math.floor(cur / MAZE_W);
    const opts = (Object.keys(DIRS) as (keyof typeof DIRS)[]).filter((d) => {
      const nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
      return nx >= 0 && ny >= 0 && nx < MAZE_W && ny < MAZE_H && !seen.has(ny * MAZE_W + nx);
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = rng.pick(opts);
    const nxt = (cy + DIRS[d].dy) * MAZE_W + cx + DIRS[d].dx;
    rooms[cur].doors |= DIRS[d].bit;
    rooms[nxt].doors |= DIRS[d].back;
    seen.add(nxt);
    stack.push(nxt);
  }
  // A few collapsed walls make loops.
  for (let i = 0; i < 8; i++) {
    const cur = rng.int(0, rooms.length - 1);
    const cx = cur % MAZE_W, cy = Math.floor(cur / MAZE_W);
    const d = rng.pick(Object.keys(DIRS) as (keyof typeof DIRS)[]);
    const nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
    if (nx < 0 || ny < 0 || nx >= MAZE_W || ny >= MAZE_H) continue;
    rooms[cur].doors |= DIRS[d].bit;
    rooms[ny * MAZE_W + nx].doors |= DIRS[d].back;
  }
  rooms[entry].kind = 'entry';
  // The vault lies far from the entry; the key somewhere between.
  const far = rooms.map((_, i) => i).sort((a, b) => depthFrom(rooms, entry, b) - depthFrom(rooms, entry, a));
  rooms[far[0]].kind = 'vault';
  const mid = far.filter((i) => i !== far[0] && i !== entry);
  rooms[mid[Math.floor(mid.length / 3)]].kind = 'key';
  rooms[mid[Math.floor(mid.length / 2)]].kind = 'shrine';
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].kind !== 'hall') continue;
    const u = rng.float();
    rooms[i].kind = u < 0.24 ? 'relic' : u < 0.36 ? 'trap' : u < 0.46 ? 'guardian' : 'hall';
  }
  return rooms;
}

function depthFrom(rooms: Room[], from: number, to: number): number {
  const d = new Map([[from, 0]]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    if (c === to) return d.get(c)!;
    const cx = c % MAZE_W, cy = Math.floor(c / MAZE_W);
    for (const k of Object.keys(DIRS) as (keyof typeof DIRS)[]) {
      if (!(rooms[c].doors & DIRS[k].bit)) continue;
      const n = (cy + DIRS[k].dy) * MAZE_W + cx + DIRS[k].dx;
      if (d.has(n)) continue;
      d.set(n, d.get(c)! + 1);
      q.push(n);
    }
  }
  return 0;
}

export function cityHere(game: Game, ship: ShipEntity): PveSite | null {
  for (const s of game.expeditions.sites) if (s.kind === 'city' && dist(s.x, s.y, ship.state.x, ship.state.y) < DIVE_RANGE) return s;
  return null;
}

export function canStartDive(game: Game, s: PlayerSession, site: PveSite): string | null {
  const ship = s.ship!;
  if (game.expeditions.runOf(s.accountId)) return 'Your bell is already down';
  if ([...game.expeditions.runs.values()].some((r) => r.site === site.id)) return 'Another crew has a bell down here — wait your turn, or make them leave';
  if (Math.abs(ship.state.speed) > 1.5) return 'Heave to over the bell buoy first (under 1.5 m/s)';
  if (ship.crew < 20) return 'A diving party needs at least twenty hands aboard';
  const lock = game.expeditions.locks.get(`${s.accountId}:${site.id}`) ?? 0;
  if (lock > game.now) return `Your divers need rest before ${site.name} again (${Math.ceil((lock - game.now) / 60)} min)`;
  return null;
}

/** Lower the bell: the leader's group (anchored within reach, five ships at most) shares the dive. */
export function startDive(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const site = cityHere(game, ship);
  if (!site) return 'No bell buoy here';
  const why = canStartDive(game, s, site);
  if (why) return why;
  const hub = game.expeditions;
  const members = [s.accountId];
  const g = groupOfAccount(game, s.accountId);
  for (const m of g?.members ?? []) {
    if (members.length >= 5 || m === s.accountId) continue;
    const o = game.sessionByAccount(m)?.ship;
    if (o && o.alive && !o.docked && dist(o.state.x, o.state.y, site.x, site.y) < DIVE_RANGE * 2 && !hub.runOf(m)) members.push(m);
  }
  const tide = tideOf(game);
  const depth = diveDepth(ship);
  const airMax = Math.round((60 + depth * 2.5) * (tide === 'calm' ? 1.2 : 1));
  const divers = Math.max(4, Math.min(24, Math.round(ship.crew * 0.15)));
  const id = hub.nextId();
  const run: DiveRun = {
    id, site: site.id, leader: s.accountId, members, anchor: { x: ship.state.x, y: ship.state.y }, started: game.now, ends: game.now + 45 * 60,
    rooms: buildMaze((game.world.seed ^ (site.x * 31 + site.y) ^ Math.floor(game.wallNow() / 3600_000)) >>> 0), pos: 0, seen: new Set(), air: airMax, airMax, divers, keys: 0,
    haul: {}, silver: 0, plan: false, nextMove: 0, nextWave: game.now + 45, wave: 0, adds: new Set(), log: [],
  };
  run.pos = run.rooms.findIndex((r) => r.kind === 'entry');
  run.seen.add(run.pos);
  run.rooms[run.pos].done = true;
  hub.runs.set(id, run);
  ship.crew -= divers;
  say(run, `The bell goes down into ${site.name} under ${TIDE_NAMES[tide]} with ${divers} divers and ${airMax} breaths of air.`);
  for (const a of members) {
    const ms = game.sessionByAccount(a);
    if (ms) game.sendTo(ms, { t: 'toast', msg: a === s.accountId ? `The bell goes down into ${site.name}. Keep her anchored — the dead will come for the ship.` : `${s.name}'s bell goes down into ${site.name}; you share the dive. Guard the anchorage!`, kind: 'info' });
  }
  pushDive(game, run);
  return null;
}

function say(run: DiveRun, line: string): void {
  run.log.push(line);
  if (run.log.length > 8) run.log.shift();
}

/** One move of the bell through the drowned streets. */
export function diveMove(game: Game, s: PlayerSession, dir: string): string | null {
  const run = game.expeditions.runOf(s.accountId);
  if (!run || run.leader !== s.accountId) return 'You have no bell down';
  const d = DIRS[dir as keyof typeof DIRS];
  if (!d) return 'Bad direction';
  if (game.now < run.nextMove) return null;
  const room = run.rooms[run.pos];
  if (!(room.doors & d.bit)) return 'Rubble blocks that way';
  const cx = run.pos % MAZE_W, cy = Math.floor(run.pos / MAZE_W);
  const next = (cy + d.dy) * MAZE_W + cx + d.dx;
  const target = run.rooms[next];
  if (target.kind === 'vault' && !target.done && run.keys <= 0) return 'The vault door is sealed. Find the drowned key.';
  run.nextMove = game.now + 1.2;
  run.air -= 3;
  run.pos = next;
  run.seen.add(next);
  enterRoom(game, run, target);
  if (run.air <= 0) {
    drown(game, run);
    return null;
  }
  pushDive(game, run);
  return null;
}

function loot(run: DiveRun, g: GoodId, n: number): void {
  run.haul[g] = (run.haul[g] ?? 0) + n;
}

function enterRoom(game: Game, run: DiveRun, room: Room): void {
  if (room.done) return;
  room.done = true;
  const rng = game.rng;
  const blood = tideOf(game) === 'blood_moon' ? 1.5 : 1;
  switch (room.kind) {
    case 'relic': {
      const g = rng.pick(['cursed_relics', 'pearls', 'abyssal_ore', 'drowned_silk'] as GoodId[]);
      const n = Math.round(rng.int(2, 5) * blood);
      loot(run, g, n);
      run.silver += Math.round(rng.int(60, 180) * blood);
      say(run, `A drowned chapel: ${n} ${GOODS[g].name.toLowerCase()} and a purse.`);
      break;
    }
    case 'trap': {
      if (rng.chance(0.5)) {
        run.air -= 15;
        say(run, 'A ceiling gives way — the bell is pinned and bleeds air (−15).');
      } else {
        const lost = Math.min(run.divers - 1, rng.int(1, 2));
        run.divers -= lost;
        say(run, `An undertow in a flooded hall drags ${lost} diver${lost > 1 ? 's' : ''} into the dark.`);
      }
      break;
    }
    case 'guardian': {
      const lost = run.divers >= 8 ? rng.int(0, 1) : rng.int(1, 3);
      run.divers = Math.max(1, run.divers - lost);
      run.silver += Math.round(rng.int(100, 260) * blood);
      loot(run, 'abyssal_ore', Math.round(rng.int(1, 3) * blood));
      say(run, lost ? `The drowned guardians fight for their hall: ${lost} diver${lost > 1 ? 's' : ''} lost; their hoard is yours.` : 'The drowned guardians fall to your axes; their hoard is yours.');
      break;
    }
    case 'key':
      run.keys++;
      say(run, 'In a bishop\'s hand, a key of green bronze. The vault will open to it.');
      break;
    case 'shrine':
      run.air = Math.min(run.airMax, run.air + 40);
      say(run, 'An air pocket under a shrine dome: the bell breathes again (+40).');
      break;
    case 'vault': {
      run.keys--;
      run.silver += Math.round(rng.int(800, 1600) * blood);
      loot(run, 'cursed_relics', Math.round(rng.int(3, 6) * blood));
      loot(run, 'abyssal_ore', Math.round(rng.int(3, 6) * blood));
      run.plan = true;
      say(run, 'The vault! Coin of the Drowned Empire, relics, and plans sealed in wax.');
      break;
    }
    default:
      say(run, rng.pick(['Silt and silence.', 'Fish in the pews.', 'A street of doors, all open.', 'Bones in a doorway, still sitting.']));
  }
}

/** Surface from the entry: the haul is shared among the ships that kept the anchorage. */
export function diveSurface(game: Game, s: PlayerSession): string | null {
  const run = game.expeditions.runOf(s.accountId);
  if (!run || run.leader !== s.accountId) return 'You have no bell down';
  if (run.rooms[run.pos].kind !== 'entry') return 'Bring the bell back to the entry shaft first';
  finishDive(game, run, true);
  return null;
}

function finishDive(game: Game, run: DiveRun, ok: boolean, why = ''): void {
  const hub = game.expeditions;
  hub.runs.delete(run.id);
  const site = hub.site(run.site)!;
  const leader = game.sessionByAccount(run.leader);
  if (leader?.ship) leader.ship.crew += ok ? run.divers : 0;
  for (const id of run.adds) if (game.ships.get(id)?.alive) game.removeShip(id);
  const members = run.members.map((a) => game.sessionByAccount(a)).filter((m): m is PlayerSession => !!m?.ship && !!m.profile);
  for (const m of members) hub.locks.set(`${m.accountId}:${site.id}`, game.now + 30 * 60);
  if (!ok) {
    for (const m of members) {
      game.sendTo(m, { t: 'toast', msg: `${site.name}: ${why} The diving party is lost with everything it carried.`, kind: 'bad' });
      game.sendTo(m, { t: 'dive', view: null });
    }
    return;
  }
  const share = 1 / Math.max(1, members.length);
  for (const m of members) {
    const cargo: Cargo = {};
    for (const [g, n] of Object.entries(run.haul) as [GoodId, number][]) {
      const k = Math.max(1, Math.round(n * share));
      cargo[g] = k;
    }
    const silver = Math.round(run.silver * share);
    m.profile!.gold += silver;
    game.db.ledger(m.accountId, 'expedition', silver, site.name);
    if (Object.keys(cargo).length) game.dropPrivateLoot(m.accountId, m.ship!.state.x + 30, m.ship!.state.y + 30, cargo, 900);
    if (run.plan && (m.accountId === run.leader || game.rng.chance(0.5))) grantPlan(game, m, 'masterwork');
    if (run.plan && m.accountId === run.leader) legendFragment(game, m, 0.3, `Sealed in the vault of ${site.name}`);
    game.grantXp(m, 400 + run.seen.size * 25, `Dived ${site.name}`);
    game.sendTo(m, { t: 'toast', msg: `The bell comes up from ${site.name}: ${silver} silver${Object.keys(cargo).length ? ', and a haul floating by your side' : ''}.`, kind: 'gold' });
    game.sendTo(m, { t: 'dive', view: null });
    game.saveSession(m);
  }
}

function drown(game: Game, run: DiveRun): void {
  const leader = game.sessionByAccount(run.leader);
  if (leader?.ship) leader.ship.morale = Math.max(0, leader.ship.morale - 15);
  finishDive(game, run, false, 'The bell ran out of air.');
}

/** Every second: the anchor holds or the line parts; the air runs out; the dead come for the ship. */
function diveSecond(game: Game, run: DiveRun): void {
  const hub = game.expeditions;
  const site = hub.site(run.site)!;
  const leader = game.sessionByAccount(run.leader);
  const ship = leader?.ship;
  if (!ship || !ship.alive || ship.docked) return void finishDive(game, run, false, 'The ship above is gone.');
  if (dist(ship.state.x, ship.state.y, site.x, site.y) > DIVE_RANGE * 1.4 || Math.abs(ship.state.speed) > 3) return void finishDive(game, run, false, 'The ship dragged her anchor and the bell line parted.');
  if (game.now >= run.ends) return void finishDive(game, run, false, 'The bell stayed down too long.');
  if (game.expeditionSecs % 3 === 0) {
    run.air -= 1;
    if (run.air <= 0) return void drown(game, run);
  }
  // Waves of the drowned against the anchored ships.
  const tide = tideOf(game);
  if (game.now >= run.nextWave) {
    run.wave++;
    run.nextWave = game.now + (tide === 'blood_moon' ? 50 : 70);
    const alive = [...run.adds].filter((id) => game.ships.get(id)?.alive).length;
    const n = Math.min(6 - alive, 1 + Math.ceil(run.wave / 2) + (tide === 'blood_moon' ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const a = game.rng.range(0, Math.PI * 2);
      const x = site.x + Math.sin(a) * 650, y = site.y - Math.cos(a) * 650;
      if (isLand(game.world, x, y)) continue;
      const b = game.spawnNpcShip('ghost', run.wave >= 4 && i === 0 ? 'brig' : 'sloop', 'choir', x, y, a + Math.PI, { ship: run.wave >= 4 && i === 0 ? 'The Drowned Bishop' : 'Drowned Boarders', captain: 'the Drowned' });
      b.crew = b.stats.crewMax;
      b.morale = 100;
      b.purse = 80;
      const brain = game.npcs.get(b.id);
      if (brain) {
        brain.active = true;
        brain.target = ship.id;
        brain.area = { x: site.x, y: site.y, r: 1500 };
      }
      game.grid.upsert(b.id, x, y);
      run.adds.add(b.id);
    }
    if (n > 0) for (const a of run.members) {
      const ms = game.sessionByAccount(a);
      if (ms) game.sendTo(ms, { t: 'toast', msg: `The drowned rise around ${site.name} (${n})! Hold the anchorage.`, kind: 'bad' });
    }
  }
  if (tide === 'fog') for (const a of run.members) game.sessionByAccount(a)?.ship?.addEffect({ id: 'tide_fog', until: game.now + 2, mods: { detection: -0.3 } }, game.now);
  pushDive(game, run);
}

function pushDive(game: Game, run: DiveRun): void {
  const view = diveView(game, run);
  for (const a of run.members) {
    const ms = game.sessionByAccount(a);
    if (ms) game.sendTo(ms, { t: 'dive', view: { ...view, leader: a === run.leader } });
  }
}

export function diveView(game: Game, run: DiveRun): DiveView {
  const site = game.expeditions.site(run.site)!;
  const rooms: DiveRoomView[] = run.rooms.map((r, i) => (run.seen.has(i) ? { k: r.kind, d: r.doors, done: r.done } : { k: '?', d: 0, done: false }));
  // Doors of rooms next to where you have been are guessed from the ones you saw.
  return {
    site: site.name, w: MAZE_W, h: MAZE_H, rooms, pos: run.pos, air: Math.max(0, run.air), airMax: run.airMax, divers: run.divers, keys: run.keys,
    haul: { ...run.haul }, silver: run.silver,
    waveIn: Math.max(0, Math.round(run.nextWave - game.now)), endsIn: Math.max(0, Math.round(run.ends - game.now)), tide: TIDE_NAMES[tideOf(game)], log: run.log, leader: false,
  };
}

// ================================================================== the graveyard

function yard(game: Game, site: PveSite): Graveyard {
  let y = game.expeditions.yards.get(site.id);
  if (!y) {
    y = { site, hulks: new Map(), gates: [], captain: 0, resetAt: 0, ambushAt: 0 };
    game.expeditions.yards.set(site.id, y);
    fillYard(game, y);
  }
  return y;
}

/** Wrecks drift in: three gates in the wall, each closed by a rotten hulk, and loose hulks in the outer field. */
function fillYard(game: Game, y: Graveyard): void {
  const site = y.site;
  const rng = new Rng((game.world.seed ^ (site.x * 7 + site.y * 13)) >>> 0);
  for (const id of y.hulks.keys()) if (game.ships.get(id)) game.removeShip(id);
  y.hulks.clear();
  const base = rng.range(0, Math.PI * 2);
  y.gates = [0, 1, 2].map((i) => ({ a: base + (i * Math.PI * 2) / 3, open: false }));
  const add = (x: number, yy: number, h: number, gate: number) => {
    const s = game.spawnNpcShip('ghost', 'hulk', 'free', x, yy, h, { ship: 'Rotten Hulk', captain: '' });
    game.npcs.delete(s.id);
    s.npcRole = null;
    s.crew = 0;
    s.state.sail = 0;
    s.state.speed = 0;
    s.input = { rudder: 0, sailTarget: 0 };
    s.hull = s.stats.hullMax;
    s.purse = 0;
    s.cargo = { planks: 4, timber: 3 };
    y.hulks.set(s.id, { x, y: yy, h, gate });
    game.grid.upsert(s.id, x, yy);
  };
  y.gates.forEach((g, i) => add(site.x + Math.sin(g.a) * WALL_R, site.y - Math.cos(g.a) * WALL_R, g.a + Math.PI / 2, i));
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(WALL_R + 150, YARD_R - 80);
    add(site.x + Math.sin(a) * r, site.y - Math.cos(a) * r, rng.range(0, Math.PI * 2), -1);
  }
  y.captain = 0;
}

function gateOf(y: Graveyard, a: number): number {
  for (let i = 0; i < y.gates.length; i++) {
    const d = Math.atan2(Math.sin(a - y.gates[i].a), Math.cos(a - y.gates[i].a));
    if (Math.abs(d) < GATE_ARC) return i;
  }
  return -1;
}

/** Every tick: hulks lie where they lie; the wall holds except at open gates; the keel limit; the current. */
function yardTick(game: Game, y: Graveyard, dt: number): void {
  const site = y.site;
  for (const [id, at] of y.hulks) {
    const s = game.ships.get(id);
    if (!s) {
      y.hulks.delete(id);
      continue;
    }
    if (!s.alive) {
      if (at.gate >= 0 && !y.gates[at.gate].open) {
        y.gates[at.gate].open = true;
        for (const o of game.sessions) if (o.ship && dist(o.ship.state.x, o.ship.state.y, site.x, site.y) < 3000) game.sendTo(o, { t: 'toast', msg: `A hulk in the wall of ${site.name} breaks apart — a gate is open!`, kind: 'good' });
      }
      continue;
    }
    s.state.x = at.x;
    s.state.y = at.y;
    s.state.heading = at.h;
    s.state.speed = 0;
  }
  const calm = tideOf(game) === 'calm';
  game.forShipsNear(site.x, site.y, YARD_R, (o) => {
    if (!o.alive || o.docked || o.cls.monster || o.id === y.captain) return;
    const dx = o.state.x - site.x, dy = o.state.y - site.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > YARD_R) return;
    // The wall of wrecks.
    if (Math.abs(d - WALL_R) < 26) {
      const a = Math.atan2(dx, -dy);
      const g = gateOf(y, a);
      if (g < 0 || !y.gates[g].open) {
        const inside = d < WALL_R;
        const to = inside ? WALL_R - 26 : WALL_R + 26;
        o.state.x = site.x + (dx / d) * to;
        o.state.y = site.y + (dy / d) * to;
        o.state.speed *= 0.3;
      }
    }
    // The keel limit: the field is silted wreckage.
    const draft = o.cls.draft * Math.max(0.5, 1 + tx(o.stats, 'draftMul'));
    if (draft > KEEL_LIMIT && o.isPlayer) {
      o.state.speed *= 1 - 0.6 * dt;
      if (game.expeditionSecs % 2 === 0 && (o.talentReady.yardScrape ?? 0) <= game.now) {
        o.talentReady.yardScrape = game.now + 1;
        o.hull -= o.stats.hullMax * 0.008;
        if (o.hull <= 0) {
          o.hull = 0;
          game.beginSinking(o);
        }
      }
    }
    // The graveyard current turns round the wall.
    if (!calm && d > WALL_R) {
      const v = 1.4 * dt;
      o.state.x += (-dy / d) * v;
      o.state.y += (dx / d) * v;
    }
    game.grid.upsert(o.id, o.state.x, o.state.y);
  });
}

function yardSecond(game: Game, y: Graveyard): void {
  const site = y.site;
  const now = game.now;
  if (y.resetAt && now >= y.resetAt) {
    y.resetAt = 0;
    fillYard(game, y);
    game.addRumor(site.x, site.y, `New wrecks have drifted into ${site.name}. The Graveyard Captain walks again.`);
  }
  const players: ShipEntity[] = [];
  game.forShipsNear(site.x, site.y, YARD_R, (o) => {
    if (o.isPlayer && o.alive && !o.docked) players.push(o);
  });
  const tide = tideOf(game);
  // Ambush from the wrecks.
  if (players.length && now >= y.ambushAt) {
    y.ambushAt = now + (tide === 'blood_moon' ? 180 : 300);
    const n = 2 + Math.min(3, players.length) + (tide === 'blood_moon' ? 1 : 0);
    const lurk = [...y.hulks.values()];
    for (let i = 0; i < n; i++) {
      const w = lurk.length ? game.rng.pick(lurk) : { x: site.x, y: site.y };
      const b = game.spawnNpcShip('ghost', 'sloop', 'choir', w.x + game.rng.range(-60, 60), w.y + game.rng.range(-60, 60), game.rng.range(0, 6.28), { ship: 'Drowned from the Wrecks', captain: 'the Drowned' });
      b.crew = b.stats.crewMax;
      b.morale = 100;
      b.purse = 60;
      b.removeAt = now + 900;
      const brain = game.npcs.get(b.id);
      if (brain) {
        brain.active = true;
        brain.target = game.rng.pick(players).id;
        brain.area = { x: site.x, y: site.y, r: YARD_R + 400 };
      }
      game.grid.upsert(b.id, b.state.x, b.state.y);
    }
    for (const p of players) game.toastShip(p, `The drowned climb out of the wrecks of ${site.name}!`, 'bad');
  }
  // The Graveyard Captain rises when a ship reaches the heart.
  if (!y.captain && !y.resetAt && players.some((p) => dist(p.state.x, p.state.y, site.x, site.y) < 220)) {
    const c = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', site.x, site.y, game.rng.range(0, 6.28), { ship: 'The Graveyard Captain', captain: 'Captain of the Dead Keels' });
    c.addEffect({ id: 'graveyard_captain', until: now + 1e9, mods: { hullMax: 1.5, gunDamageMul: 0.25 } }, now);
    c.hull = c.stats.hullMax;
    c.crew = c.stats.crewMax;
    c.level = 35;
    c.purse = 3000;
    c.yardOf = site.id;
    const brain = game.npcs.get(c.id);
    if (brain) {
      brain.active = true;
      brain.area = { x: site.x, y: site.y, r: WALL_R };
      brain.target = players[0].id;
    }
    game.grid.upsert(c.id, c.state.x, c.state.y);
    y.captain = c.id;
    for (const p of players) game.toastShip(p, 'The Graveyard Captain rises from the heart of the wrecks!', 'bad');
  }
  if (tide === 'fog') for (const p of players) p.addEffect({ id: 'tide_fog', until: now + 2, mods: { detection: -0.3 } }, now);
}

/** The Graveyard Captain sunk: a chest for every captain who fought him, rarer things once a day. */
export function onYardCaptainSunk(game: Game, ship: ShipEntity): void {
  if (!ship.yardOf) return;
  const y = game.expeditions.yards.get(ship.yardOf);
  if (!y || y.captain !== ship.id) return;
  y.resetAt = game.now + 30 * 60;
  const site = y.site;
  const blood = tideOf(game) === 'blood_moon' ? 1.5 : 1;
  const wall = game.wallNow();
  const fighters = [...ship.attackers.entries()].filter(([, t]) => t > game.now - 300).map(([id]) => game.ships.get(id)).filter((o): o is ShipEntity => !!o?.isPlayer);
  for (const f of fighters) {
    const s = game.sessionOf(f);
    if (!s?.profile) continue;
    const cargo: Cargo = { planks: Math.round(12 * blood), iron: Math.round(8 * blood), cursed_relics: Math.round(3 * blood), timber: Math.round(10 * blood) };
    game.dropPrivateLoot(s.accountId, site.x + game.rng.range(-50, 50), site.y + game.rng.range(-50, 50), cargo, 900);
    const key = `yard:${site.id}`;
    const lines: string[] = [];
    if ((s.profile.bossLocks[key] ?? 0) <= wall) {
      s.profile.bossLocks[key] = wall + 24 * 3600_000;
      if (!s.profile.figureheads.includes('fh_serpent') && game.rng.chance(0.15)) {
        s.profile.figureheads.push('fh_serpent');
        lines.push('the Sea Serpent figurehead');
      }
      if (!s.profile.blueprints.includes('ghost_timbers') && game.rng.chance(0.2)) {
        s.profile.blueprints.push('ghost_timbers');
        lines.push('the plans for Ghost Timbers');
      }
      if (game.rng.chance(0.35)) {
        grantPlan(game, s, 'masterwork');
        lines.push('an old master\'s ship plan');
      }
    }
    game.grantXp(s, 900 * blood, `The Graveyard Captain of ${site.name}`);
    legendFragment(game, s, 0.25, 'In the Graveyard Captain\'s coat');
    game.sendTo(s, { t: 'toast', msg: `The Graveyard Captain goes down. His chest floats up for you${lines.length ? `, with ${lines.join(', ')}` : ''}.`, kind: 'gold' });
  }
  game.addRumor(site.x, site.y, `The Graveyard Captain of ${site.name} was sunk. The wrecks are quiet — for a while.`);
}

// ================================================================== the step and the views

export function stepExpeditions(game: Game, dt: number): void {
  for (const site of game.expeditions.sites) if (site.kind === 'graveyard' && game.inZone(site.x, site.y)) yardTick(game, yard(game, site), dt);
}

export function expeditionsSecond(game: Game): void {
  game.expeditionSecs++;
  for (const run of [...game.expeditions.runs.values()]) diveSecond(game, run);
  for (const site of game.expeditions.sites) if (site.kind === 'graveyard' && game.inZone(site.x, site.y)) yardSecond(game, yard(game, site));
  const views = siteViews(game);
  const key = JSON.stringify(views.map((v) => [v.id, v.gates?.map((g) => g.open), v.captain]));
  if (game.expeditions.viewsKey(key)) for (const s of game.sessions) game.sendTo(s, { t: 'pve_sites', list: views });
}

export function siteViews(game: Game): PveSiteView[] {
  const tide = TIDE_NAMES[tideOf(game)];
  return game.expeditions.sites.map((s) => {
    const y = s.kind === 'graveyard' ? game.expeditions.yards.get(s.id) : undefined;
    return {
      id: s.id, kind: s.kind, name: s.name, x: s.x, y: s.y, r: s.kind === 'graveyard' ? YARD_R : s.r, wall: s.kind === 'graveyard' ? WALL_R : undefined,
      gates: y?.gates.map((g) => ({ a: Math.round(g.a * 1000) / 1000, open: g.open })), captain: !!y?.captain && !!game.ships.get(y.captain)?.alive, tide,
    };
  });
}

export function sendSites(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'pve_sites', list: siteViews(game) });
  const run = game.expeditions.runOf(s.accountId);
  if (run) game.sendTo(s, { t: 'dive', view: { ...diveView(game, run), leader: run.leader === s.accountId } });
}

/** The prompt at a bell buoy. */
export function cityPrompt(game: Game, s: PlayerSession): { island: string; feature: string; action: 'expedition'; blocked?: string } | null {
  const ship = s.ship!;
  if (game.expeditions.runOf(s.accountId)) return null;
  const site = cityHere(game, ship);
  if (!site) return null;
  const why = canStartDive(game, s, site);
  return { island: site.name, feature: `the bell buoy over ${site.name}`, action: 'expedition', blocked: why ?? undefined };
}
