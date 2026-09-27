// World events (docs/01 §16), the ones that change the shape of the sea: the Crown's Armada, blockades
// (pirate squadrons and guild fleets holding a port's waters), the Storm of the Century, a new island thrown
// up by an eruption, and epidemics. Each event starts from the state of the world (or, failing that, from a
// slow calendar), lasts wall-clock hours or days, touches at least three systems (markets, NPC traffic,
// law and reputation, weather), and never more than two major events share a region.

import { GOODS } from '../../../shared/src/data/goods.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { WorldEventView } from '../../../shared/src/protocol.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { depthAt, isLand, islandChunkKeys, raiseIsland, regionAt } from '../../../shared/src/world/worldgen.ts';
import type { Port, RaisedIsland } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { glories } from './legendary.ts';
import { sitesOfIsland } from './resources.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export type EventKind = 'armada' | 'blockade' | 'storm_century' | 'new_island' | 'epidemic';

export interface WorldEvent {
  id: number;
  kind: EventKind;
  region: RegionId;
  port?: string;
  x: number;
  y: number;
  started: number; // wall ms
  ends: number; // wall ms
  title: string;
  by?: string; // who holds a blockade: 'Confederacy', 'the Crown', or a guild tag
  stage?: 'eruption' | 'risen' | 'storm' | 'aftermath';
  quarantine?: boolean;
  runners?: number[]; // accounts that ran this blockade
  islandId?: number;
  named?: boolean;
}

interface EventStore {
  list: WorldEvent[];
  next: Record<string, number>; // calendars, wall ms
  crownLosses: number[]; // wall ms of Crown ships lost to captains
  seq: number;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const MAJOR: EventKind[] = ['armada', 'blockade', 'storm_century', 'epidemic', 'new_island'];
const ARMADA_TRIGGER = 25; // Crown ships lost in a week
const GUILD_HOLD_SEC = 30 * 60;
const GUILD_SHIPS = 5;
const BLOCKADE_R = 2500;
const MAX_RAISED = 6;

export class EventHub {
  private store: EventStore | null = null;
  /** Runtime only: squadrons that make an event (entity ids), guild hold progress by port. */
  fleets = new Map<number, number[]>();
  holds = new Map<string, { tag: string; since: number; lost: number }>();
  lastSent = '';
  /** Its own dice: the world's events do not disturb the rest of the simulation's. */
  rng = new Rng(0xe7e7);
  /** Seconds stepped (the cadence of triggers and periodic effects). */
  secs = 0;

  private key(game: Game): string {
    return `world_events:${game.zone?.id ?? 'world'}`;
  }

  data(game: Game): EventStore {
    if (!this.store) {
      this.store = game.db.getKv<EventStore>(this.key(game)) ?? { list: [], next: {}, crownLosses: [], seq: 1 };
      const wall = game.wallNow();
      const seedU = (k: number) => ((game.world.seed * 7919 + k * 104729) % 1000) / 1000;
      this.store.next.armada ??= wall + (8 + seedU(1) * 8) * DAY;
      this.store.next.pirate_blockade ??= wall + (3 + seedU(2) * 4) * DAY;
      this.store.next.new_island ??= wall + (10 + seedU(3) * 10) * DAY;
      this.store.next.epidemic ??= wall + (4 + seedU(4) * 6) * DAY;
      REGION_IDS.forEach((r, i) => (this.store!.next[`storm:${r}`] ??= wall + (20 + seedU(10 + i) * 20) * DAY));
    }
    return this.store;
  }

  save(game: Game): void {
    if (this.store) game.db.setKv(this.key(game), this.store);
  }

  active(game: Game): WorldEvent[] {
    return this.data(game).list;
  }

  at(game: Game, port: string, kind?: EventKind): WorldEvent | undefined {
    return this.active(game).find((e) => e.port === port && (!kind || e.kind === kind) && (e.kind !== 'new_island'));
  }

  /** A port under blockade (the Armada's, a pirate squadron's or a guild's). */
  blockaded(game: Game, portId: string): WorldEvent | undefined {
    return this.active(game).find((e) => e.port === portId && (e.kind === 'blockade' || e.kind === 'armada'));
  }

  noteCrownLoss(game: Game): void {
    const st = this.data(game);
    st.crownLosses.push(game.wallNow());
    if (st.crownLosses.length > 200) st.crownLosses.splice(0, st.crownLosses.length - 200);
  }
}

// ================================================================== the step (every second)

export function stepEvents(game: Game): void {
  const hub = game.worldEvents;
  const st = hub.data(game);
  const wall = game.wallNow();
  hub.secs++;
  let dirty = false;
  // Continuing effects, every second.
  for (const e of [...st.list]) {
    if (wall >= e.ends || !stillOn(game, e)) {
      finish(game, e);
      dirty = true;
      continue;
    }
    if (tick(game, e)) dirty = true;
  }
  if (hub.secs % 10 === 0) {
    // Triggers, every ten seconds.
    if (triggers(game, st, wall)) dirty = true;
    guildHolds(game);
  }
  if (dirty) {
    hub.save(game);
    broadcast(game);
  }
}

function regionLoad(game: Game, region: RegionId): number {
  return game.worldEvents.active(game).filter((e) => e.region === region && MAJOR.includes(e.kind)).length;
}

function start(game: Game, e: Omit<WorldEvent, 'id' | 'started'>, text: string): WorldEvent | null {
  const st = game.worldEvents.data(game);
  if (regionLoad(game, e.region) >= 2) return null; // never more than two major events on a region
  const ev: WorldEvent = { ...e, id: st.seq++, started: game.wallNow() };
  st.list.push(ev);
  game.addRumor(ev.x, ev.y, text);
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'info' });
  game.log(`[event] ${ev.kind} ${ev.port ?? ev.region}: ${text}`);
  game.worldEvents.save(game);
  broadcast(game);
  return ev;
}

function finish(game: Game, e: WorldEvent): void {
  const st = game.worldEvents.data(game);
  st.list = st.list.filter((x) => x.id !== e.id);
  const fleet = game.worldEvents.fleets.get(e.id) ?? [];
  game.worldEvents.fleets.delete(e.id);
  let text = '';
  switch (e.kind) {
    case 'armada': {
      const left = fleet.filter((id) => game.ships.get(id)?.alive).length;
      text = left ? `The Armada weighs anchor off ${portName(game, e.port)} and sails home.` : `The Crown's Armada off ${portName(game, e.port)} is broken!`;
      for (const id of fleet) if (game.ships.get(id)?.alive) game.removeShip(id);
      break;
    }
    case 'blockade': {
      const left = fleet.filter((id) => game.ships.get(id)?.alive).length;
      text = fleet.length && !left ? `The blockade of ${portName(game, e.port)} is broken — the squadron is sunk.` : `The blockade of ${portName(game, e.port)} is lifted.`;
      for (const id of fleet) if (game.ships.get(id)?.alive) game.removeShip(id);
      if (e.by && !fleet.length) game.worldEvents.holds.delete(e.port ?? '');
      break;
    }
    case 'storm_century':
      if (e.stage === 'storm') {
        // The aftermath: a day of dear timber and canvas, and wreckage to salvage.
        const after: Omit<WorldEvent, 'id' | 'started'> = { kind: 'storm_century', region: e.region, x: e.x, y: e.y, ends: game.wallNow() + DAY, title: `After the Great Storm in ${REGIONS[e.region].name}`, stage: 'aftermath' };
        st.list.push({ ...after, id: st.seq++, started: game.wallNow() });
        scatterWreckage(game, e.region, 8);
        text = `The Storm of the Century blows itself out over ${REGIONS[e.region].name}. Wreckage everywhere; timber and canvas are dear.`;
      } else text = `${REGIONS[e.region].name} has mended from the Great Storm.`;
      break;
    case 'epidemic':
      text = `The fever in ${portName(game, e.port)} has passed.`;
      break;
    case 'new_island':
      break;
  }
  if (text) {
    game.addRumor(e.x, e.y, text);
    for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'info' });
  }
  game.log(`[event] ended ${e.kind} ${e.port ?? e.region}`);
}

function portName(game: Game, id?: string): string {
  return (id && game.portById(id)?.name) || 'the port';
}

/** Whether an event still stands (a squadron sunk ends a blockade early; medicine ends a fever). */
function stillOn(game: Game, e: WorldEvent): boolean {
  if (e.kind === 'armada' || (e.kind === 'blockade' && !e.by?.startsWith('['))) {
    const fleet = game.worldEvents.fleets.get(e.id);
    if (fleet && fleet.length && !fleet.some((id) => game.ships.get(id)?.alive)) return false;
    if (!fleet && e.kind === 'armada') stationSquadron(game, e); // after a restart the squadron takes station again
    if (!fleet && e.kind === 'blockade' && e.by === 'Confederacy') stationSquadron(game, e);
  }
  if (e.kind === 'blockade' && e.by?.startsWith('[')) {
    // A guild's blockade holds while three of its ships stay on station (ten minutes' grace).
    const tag = e.by.slice(1, -1);
    const port = game.portById(e.port ?? '');
    if (!port) return false;
    const n = guildShipsNear(game, port, tag, BLOCKADE_R + 500);
    const h = game.worldEvents.holds.get(port.id) ?? { tag, since: game.now, lost: 0 };
    if (n >= 3) h.lost = 0;
    else if (!h.lost) h.lost = game.now;
    game.worldEvents.holds.set(port.id, h);
    if (h.lost && game.now - h.lost > 600) return false;
  }
  if (e.kind === 'epidemic') {
    const gm = game.markets.get(e.port ?? '')?.goods.medicine;
    if (gm && gm.stock >= gm.target * 0.6) {
      game.addRumor(e.x, e.y, `Medicine reached ${portName(game, e.port)} in time: the fever breaks.`);
      return false;
    }
  }
  return true;
}

/** Once a second while an event lasts. Returns true when the record changed. */
function tick(game: Game, e: WorldEvent): boolean {
  switch (e.kind) {
    case 'armada':
      shock(game, e.port!, blockadeMul(game, e.port!));
      shock(game, e.port!, { provisions: 1.2 }, true);
      shock(game, 'gravesend', { gunpowder: 1.5, weapons: 1.5 });
      return false;
    case 'blockade':
      shock(game, e.port!, blockadeMul(game, e.port!));
      return false;
    case 'storm_century':
      if (e.stage === 'storm') {
        const w = game.weather[e.region];
        const kind = REGIONS[e.region].strangeness >= 0.25 ? 'black_storm' : 'storm';
        w.kind = kind;
        w.until = game.now + 30;
        w.next = kind;
        if (game.worldEvents.secs % 60 === 0) founderTraffic(game, e.region);
      } else for (const p of game.world.ports) if (p.region === e.region) shock(game, p.id, { timber: 1.5, sailcloth: 1.5, planks: 1.5 });
      return false;
    case 'epidemic':
      shock(game, e.port!, { medicine: 2, provisions: 1.5 });
      if (game.worldEvents.secs % 60 === 0) feverAboard(game);
      return false;
    case 'new_island':
      return eruption(game, e);
  }
  return false;
}

/** Imports cost up to ×2.8 in a blockaded port; what it makes piles up and sells for ×0.6. */
function blockadeMul(game: Game, portId: string): Partial<Record<GoodId, number>> {
  const port = game.portById(portId);
  const m = game.markets.get(portId);
  const out: Partial<Record<GoodId, number>> = {};
  if (!port || !m) return out;
  for (const g in m.goods) out[g as GoodId] = (port.profile.produces[g as GoodId] ?? 0) > 0 ? 0.6 : 2.8;
  return out;
}

function shock(game: Game, portId: string, muls: Partial<Record<GoodId, number>>, stack = false): void {
  const m = game.markets.get(portId);
  if (!m) return;
  for (const [g, mul] of Object.entries(muls) as [GoodId, number][]) {
    const gm = m.goods[g];
    if (!gm) continue;
    gm.shock = stack ? Math.max(gm.shock, gm.shock * mul) : mul;
  }
}

// ================================================================== triggers

function triggers(game: Game, st: EventStore, wall: number): boolean {
  let changed = false;
  const ports = game.zonePorts();
  // The Crown's Armada: after heavy Crown losses, or on the Admiralty's own slow calendar.
  const cinder = ports.find((p) => p.id === 'cinderhold');
  if (cinder && !st.list.some((e) => e.kind === 'armada')) {
    st.crownLosses = st.crownLosses.filter((t) => wall - t < 7 * DAY);
    const angry = st.crownLosses.length >= ARMADA_TRIGGER;
    if (angry || wall >= st.next.armada) {
      const e = start(game, { kind: 'armada', region: cinder.region, port: cinder.id, x: cinder.x, y: cinder.y, ends: wall + (3 + game.worldEvents.rng.float() * 2) * DAY, title: `The Crown's Armada blockades ${cinder.name}`, by: 'the Crown' },
        angry ? `The Admiralty has lost ${st.crownLosses.length} ships this week. The Royal Armada sails to blockade ${cinder.name}! Powder and arms are dear in Gravesend.` : `The Royal Armada sails to blockade ${cinder.name}. Powder and arms are dear in Gravesend.`);
      if (e) {
        stationSquadron(game, e);
        st.crownLosses = [];
      }
      st.next.armada = wall + (12 + game.worldEvents.rng.float() * 6) * DAY;
      changed = true;
    }
  }
  // A pirate squadron blockades a lawful port.
  if (wall >= st.next.pirate_blockade) {
    st.next.pirate_blockade = wall + (4 + game.worldEvents.rng.float() * 3) * DAY;
    const lawful = ports.filter((p) => (p.faction === 'crown' || p.faction === 'league') && p.id !== 'gravesend' && !game.worldEvents.blockaded(game, p.id) && REGIONS[p.region].safety !== 'safe');
    const pool = lawful.length ? lawful : ports.filter((p) => (p.faction === 'crown' || p.faction === 'league') && !game.worldEvents.blockaded(game, p.id));
    if (pool.length) {
      const p = game.worldEvents.rng.pick(pool);
      const e = start(game, { kind: 'blockade', region: p.region, port: p.id, x: p.x, y: p.y, ends: wall + (1 + game.worldEvents.rng.float()) * DAY, title: `Pirates blockade ${p.name}`, by: 'Confederacy' },
        `A Confederacy squadron has closed the roads of ${p.name}. Whatever gets through sells dear.`);
      if (e) stationSquadron(game, e);
      changed = true;
    }
  }
  // The Storm of the Century: about once a month on a region.
  for (const r of REGION_IDS) {
    if (game.zone && !game.zone.regions.has(r)) continue;
    const k = `storm:${r}`;
    if (wall < (st.next[k] ?? Infinity)) continue;
    st.next[k] = wall + (25 + game.worldEvents.rng.float() * 10) * DAY;
    const [x, y] = REGIONS[r].center;
    start(game, { kind: 'storm_century', region: r, x, y, ends: wall + (3 + game.worldEvents.rng.float() * 3) * HOUR, title: `The Storm of the Century over ${REGIONS[r].name}`, stage: 'storm' },
      `The Storm of the Century is breaking over ${REGIONS[r].name}. Make for harbour — or for the wrecks after.`);
    changed = true;
  }
  // A new island: an eruption in the Ashen Isles or the Expanse.
  if (wall >= st.next.new_island) {
    st.next.new_island = wall + (12 + game.worldEvents.rng.float() * 10) * DAY;
    const raised = game.db.getKv<RaisedIsland[]>('raised_islands') ?? [];
    const regions = (['ashen_isles', 'dead_mans_expanse'] as RegionId[]).filter((r) => !game.zone || game.zone.regions.has(r));
    if (raised.length < MAX_RAISED && regions.length) {
      const spot = eruptionPoint(game, game.worldEvents.rng.pick(regions));
      if (spot) {
        start(game, { kind: 'new_island', region: regionAt(game.world, spot.x, spot.y), x: spot.x, y: spot.y, ends: wall + 7 * DAY, title: `The sea boils in ${REGIONS[regionAt(game.world, spot.x, spot.y)].name}`, stage: 'eruption' },
          `The sea boils and spits fire at ${Math.round(spot.x / 1000)} km east, ${Math.round(spot.y / 1000)} km south. Something is rising.`);
        changed = true;
      }
    }
  }
  // Epidemics: a port short of medicine, now and then.
  if (wall >= st.next.epidemic || game.worldEvents.rng.chance(0.002)) {
    const short = ports.filter((p) => {
      const gm = game.markets.get(p.id)?.goods.medicine;
      return gm && gm.stock < gm.target * 0.2 && !game.worldEvents.at(game, p.id, 'epidemic');
    });
    const pool = short.length ? short : wall >= st.next.epidemic ? ports.filter((p) => p.size >= 2 && !game.worldEvents.at(game, p.id, 'epidemic')) : [];
    if (pool.length) {
      st.next.epidemic = wall + (5 + game.worldEvents.rng.float() * 5) * DAY;
      const p = game.worldEvents.rng.pick(pool);
      const quarantine = game.worldEvents.rng.chance(0.3);
      start(game, { kind: 'epidemic', region: p.region, port: p.id, x: p.x, y: p.y, ends: wall + (1 + game.worldEvents.rng.float() * 2) * DAY, title: quarantine ? `Fever in ${p.name} (quarantine)` : `Fever in ${p.name}`, quarantine },
        `Fever in ${p.name}! Medicine sells for twice its weight${quarantine ? '; the yellow flag flies — no hands to hire and ships that leave may carry it' : ''}.`);
      changed = true;
    }
  }
  return changed;
}

/** Guild fleets: five of a guild's ships on a port's roads for half an hour close it. */
function guildHolds(game: Game): void {
  for (const port of game.zonePorts()) {
    if (game.worldEvents.blockaded(game, port.id)) continue;
    const counts = new Map<string, number>();
    game.forShipsNear(port.x, port.y, BLOCKADE_R, (o) => {
      if (o.isPlayer && o.alive && !o.docked && o.guildTag) counts.set(o.guildTag, (counts.get(o.guildTag) ?? 0) + 1);
    });
    let best: string | null = null;
    for (const [tag, n] of counts) if (n >= GUILD_SHIPS && (!best || n > (counts.get(best) ?? 0))) best = tag;
    const h = game.worldEvents.holds.get(port.id);
    if (!best) {
      if (h && !game.worldEvents.blockaded(game, port.id)) game.worldEvents.holds.delete(port.id);
      continue;
    }
    if (!h || h.tag !== best) {
      game.worldEvents.holds.set(port.id, { tag: best, since: game.now, lost: 0 });
      for (const s of game.sessions) if (s.ship?.guildTag === best && s.ship && dist(s.ship.state.x, s.ship.state.y, port.x, port.y) < BLOCKADE_R) game.sendTo(s, { t: 'toast', msg: `[${best}] holds the roads of ${port.name}. Hold them half an hour to close the port.`, kind: 'info' });
      continue;
    }
    if (game.now - h.since >= GUILD_HOLD_SEC) {
      start(game, { kind: 'blockade', region: port.region, port: port.id, x: port.x, y: port.y, ends: game.wallNow() + 2 * DAY, title: `[${best}] blockades ${port.name}`, by: `[${best}]` },
        `The guild [${best}] has closed the roads of ${port.name}. Imports sell dear; what the port makes rots on the quay.`);
    }
  }
}

function guildShipsNear(game: Game, port: Port, tag: string, r: number): number {
  let n = 0;
  game.forShipsNear(port.x, port.y, r, (o) => {
    if (o.isPlayer && o.alive && !o.docked && o.guildTag === tag) n++;
  });
  return n;
}

/** The Armada (a ship of the line and frigates) or a pirate squadron takes station on a port's roads. */
function stationSquadron(game: Game, e: WorldEvent): void {
  const port = game.portById(e.port ?? '');
  if (!port) return;
  const crown = e.kind === 'armada';
  const classes = crown ? (['man_o_war', 'frigate', 'frigate', 'frigate'] as const) : (['brigantine', 'brigantine', 'brig', 'brig', 'xebec'] as const);
  const names = crown ? ['HMS Sovereign Wrath', 'HMS Diligence', 'HMS Stalwart', 'HMS Retribution'] : ['Red Wake', 'Sulphur Kiss', 'Gallows Joy', 'Ash Maiden', 'Cinder Widow'];
  const ids: number[] = [];
  classes.forEach((cls, i) => {
    const a = (i / classes.length) * Math.PI * 2;
    let x = port.x + Math.sin(a) * 1600, y = port.y - Math.cos(a) * 1600;
    for (let k = 0; k < 6 && (isLand(game.world, x, y) || depthAt(game.world, x, y) < 8); k++) {
      x = port.x + Math.sin(a + k * 0.5) * (1800 + k * 200);
      y = port.y - Math.cos(a + k * 0.5) * (1800 + k * 200);
    }
    const ship = game.spawnNpcShip(crown ? 'patrol' : 'pirate', cls, crown ? 'crown' : 'confederacy', x, y, a, { ship: names[i], captain: crown ? 'Commodore Ashby' : 'Captain Vex' });
    ship.eventOf = e.id;
    const brain = game.npcs.get(ship.id);
    if (brain) {
      brain.active = true;
      brain.area = { x: port.x, y: port.y, r: BLOCKADE_R };
      brain.destPort = null;
    }
    game.grid.upsert(ship.id, x, y);
    ids.push(ship.id);
  });
  game.worldEvents.fleets.set(e.id, ids);
}

// ================================================================== the storm

/** In the storm, NPC traffic founders: a merchant or a fisher goes down now and then. */
function founderTraffic(game: Game, region: RegionId): void {
  for (const [id, b] of game.npcs) {
    if (b.role !== 'merchant' && b.role !== 'fisher') continue;
    const s = game.ships.get(id);
    if (!s || !s.alive || s.docked || s.region !== region || s.eventOf) continue;
    if (!game.worldEvents.rng.chance(0.08)) continue;
    s.hull = 0;
    game.beginSinking(s);
  }
}

function scatterWreckage(game: Game, region: RegionId, n: number): void {
  const [cx, cy] = REGIONS[region].center;
  for (let i = 0; i < n * 4 && n > 0; i++) {
    const x = cx + game.worldEvents.rng.range(-9000, 9000), y = cy + game.worldEvents.rng.range(-9000, 9000);
    if (regionAt(game.world, x, y) !== region || isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const id = game.allocId();
    const pick = game.worldEvents.rng.pick(['timber', 'planks', 'sailcloth', 'rum', 'spices', 'iron'] as GoodId[]);
    game.loot.set(id, { id, x, y, cargo: { [pick]: game.worldEvents.rng.int(6, 20), planks: game.worldEvents.rng.int(3, 10) }, gold: game.worldEvents.rng.int(50, 400), expires: game.now + 6 * 3600, wreck: region });
    n--;
  }
}

// ================================================================== the eruption and the new island

function eruptionPoint(game: Game, region: RegionId): { x: number; y: number } | null {
  const [cx, cy] = REGIONS[region].center;
  for (let i = 0; i < 60; i++) {
    const x = cx + game.worldEvents.rng.range(-10000, 10000), y = cy + game.worldEvents.rng.range(-10000, 10000);
    if (regionAt(game.world, x, y) !== region || !game.inZone(x, y)) continue;
    if (game.world.islands.some((is) => dist(is.x, is.y, x, y) < is.radius + 1800)) continue;
    if (game.world.ports.some((p) => dist(p.x, p.y, x, y) < 5000)) continue;
    if (game.world.reefs.some((r) => dist(r.x, r.y, x, y) < r.radius + 1200)) continue;
    return { x, y };
  }
  return null;
}

const ERUPTION_SEC = 6 * 3600;

/** Six hours of fire and pumice, then land. Returns true when the record changed. */
function eruption(game: Game, e: WorldEvent): boolean {
  const wall = game.wallNow();
  if (e.stage === 'eruption') {
    // Volcanic bombs about the vent.
    if (game.worldEvents.secs % 15 === 0) {
      const a = game.worldEvents.rng.range(0, Math.PI * 2), r = game.worldEvents.rng.range(0, 1200);
      game.strikes.push({ at: game.now + 3, x: e.x + Math.sin(a) * r, y: e.y - Math.cos(a) * r, radius: 60, hull: 160, rudder: 0.05, owner: 0, slow: 0, shells: 1, fx: 'mortar' });
    }
    if (wall - e.started >= ERUPTION_SEC * 1000) {
      riseNow(game, e);
      return true;
    }
    return false;
  }
  // Risen: the first captain ashore names her.
  if (e.stage === 'risen' && !e.named && e.islandId !== undefined) {
    const is = game.world.islands[e.islandId];
    for (const s of game.sessions) {
      const sh = s.ship;
      if (!sh || !s.profile || sh.docked || dist(sh.state.x, sh.state.y, is.x, is.y) > is.radius + 400) continue;
      nameIsland(game, e, s);
      return true;
    }
  }
  return false;
}

export function riseNow(game: Game, e: WorldEvent): void {
  const region = e.region;
  const raised = game.db.getKv<RaisedIsland[]>('raised_islands') ?? [];
  const volcanic = region === 'ashen_isles';
  const r: RaisedIsland = {
    x: e.x, y: e.y, radius: Math.round(game.worldEvents.rng.range(380, 700)), seed: (game.world.seed ^ (e.id * 2654435761)) >>> 0,
    name: `The Newborn Rock ${raised.length + 1}`, region, biome: volcanic ? 'volcanic' : 'barren',
    features: volcanic ? ['mine', 'ruins'] : ['mine', 'wreck'],
  };
  const is = raiseIsland(game.world, r);
  raised.push(r);
  game.db.setKv('raised_islands', raised);
  onIslandRaised(game, is.id);
  e.stage = 'risen';
  e.islandId = is.id;
  e.title = `A new island in ${REGIONS[region].name}`;
  e.ends = game.wallNow() + 3 * DAY;
  const text = `Where the sea boiled, there is land: a new island in ${REGIONS[region].name}. The first captain ashore names her — then the race for her lease begins.`;
  game.addRumor(e.x, e.y, text);
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'info' });
}

/** A new island in the world: sites, routes and the charts captains already hold. */
export function onIslandRaised(game: Game, islandId: number): void {
  const is = game.world.islands[islandId];
  for (const site of sitesOfIsland(is)) if (!game.sites.some((x) => x.id === site.id)) game.sites.push(site);
  game.routes.clear();
  const keys = islandChunkKeys(is);
  for (const s of game.sessions) for (const k of keys) s.knownChunks.delete(k);
}

function nameIsland(game: Game, e: WorldEvent, s: PlayerSession): void {
  const is = game.world.islands[e.islandId!];
  const name = `${s.name.split(' ')[0]}'s Landfall`;
  is.name = name;
  e.named = true;
  const raised = game.db.getKv<RaisedIsland[]>('raised_islands') ?? [];
  const rec = raised.find((r) => r.x === is.x && r.y === is.y);
  if (rec) {
    rec.name = name;
    game.db.setKv('raised_islands', raised);
    }
  for (const site of game.sites) if (site.islandId === is.id) site.name = name;
  game.chartIsland(s, is);
  game.grantXp(s, 800, `First ashore on ${name}`);
  for (const o of game.sessions) {
    for (const k of islandChunkKeys(is)) o.knownChunks.delete(k);
    game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} is first ashore on the new island and names her ${name}.`, kind: 'info' });
  }
  game.addRumor(is.x, is.y, `The new island is called ${name}, after the captain who first set foot on her.`);
}

// ================================================================== the fever

/** Ships that sailed from a fevered port carry it; medicine in the hold cures them. */
function feverAboard(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !ship.hasEffect('fever') || ship.docked) continue;
    const med = ship.cargo.medicine ?? 0;
    if (med > 0) {
      ship.cargo.medicine = med - 1;
      if (!ship.cargo.medicine) delete ship.cargo.medicine;
      ship.effects = ship.effects.filter((x) => x.id !== 'fever');
      ship.recompute(game.now);
      game.toastShip(ship, 'The surgeon doses the sick from your medicine chest: the fever breaks.', 'good');
      continue;
    }
    const lost = Math.max(1, Math.round(ship.crew * 0.01));
    ship.crew = Math.max(1, ship.crew - lost);
    ship.morale = Math.max(0, ship.morale - 1);
    game.toastShip(ship, `Fever aboard: ${lost} men sewn into their hammocks. Medicine would stop it.`, 'bad');
  }
}

// ================================================================== hooks from the game

/** Docking: blockade runners are paid in glory; a fevered, quarantined port marks the ships that leave it. */
export function onDockEvents(game: Game, s: PlayerSession, port: Port): void {
  const ship = s.ship!;
  const b = game.worldEvents.blockaded(game, port.id);
  if (b && b.by !== `[${ship.guildTag}]`) {
    const cargo = Object.values(ship.cargo).reduce((a, n) => a + (n ?? 0), 0);
    b.runners ??= [];
    if (cargo >= 10 && !b.runners.includes(s.accountId)) {
      b.runners.push(s.accountId);
      game.grantXp(s, 300 + port.size * 100, `Ran the blockade of ${port.name}`);
      game.adjustRepProfile(s, port.faction, 6);
      if (b.kind === 'armada') game.adjustRepProfile(s, 'crown', -4);
      game.sendTo(s, { t: 'toast', msg: `You ran the blockade of ${port.name}! The quay cheers; your cargo sells at blockade prices.`, kind: 'good' });
      game.worldEvents.save(game);
    }
  }
  const ep = game.worldEvents.at(game, port.id, 'epidemic');
  if (ep) game.sendTo(s, { t: 'toast', msg: `Fever in ${port.name}.${ep.quarantine ? ' The yellow flag flies: no hands to hire, and your crew may carry it out to sea.' : ''} Medicine sells for twice its weight.`, kind: 'bad' });
}

export function onUndockEvents(game: Game, s: PlayerSession, port: Port): void {
  const ep = game.worldEvents.at(game, port.id, 'epidemic');
  const ship = s.ship!;
  if (!ep || !ep.quarantine || (ship.cargo.medicine ?? 0) >= 5) return;
  if (game.worldEvents.rng.chance(0.5)) {
    ship.addEffect({ id: 'fever', until: game.now + 1800, mods: { reloadMul: 0.1 } }, game.now);
    game.toastShip(ship, 'Your crew brought the fever aboard. Five chests of medicine would have kept it out.', 'bad');
  }
}

/** Quarantine: nobody signs on in a fevered port. */
export function hireBlocked(game: Game, port: Port): string | null {
  const ep = game.worldEvents.at(game, port.id, 'epidemic');
  return ep?.quarantine ? `${port.name} is under quarantine: nobody may sign on until the fever passes` : null;
}

/** Medicine sold in a fevered port saves lives: reputation and a captain's name. */
export function onEventSale(game: Game, s: PlayerSession, port: Port, good: GoodId, n: number): void {
  if (good !== 'medicine') return;
  const ep = game.worldEvents.at(game, port.id, 'epidemic');
  if (!ep) return;
  game.adjustRepProfile(s, port.faction, Math.min(15, n * 0.5));
  game.grantXp(s, n * 12, `${GOODS.medicine.name} for fevered ${port.name}`);
}

/** A merchant plans no voyage into a closed port. */
export function avoidPort(game: Game, portId: string): boolean {
  return !!game.worldEvents.blockaded(game, portId);
}

export function eventShipLost(game: Game, ship: ShipEntity): void {
  if (ship.faction === 'crown' && !ship.eventOf) game.worldEvents.noteCrownLoss(game);
}

// ================================================================== the view

export function eventViews(game: Game): WorldEventView[] {
  const list: WorldEventView[] = game.worldEvents.active(game).map((e) => ({
    id: e.id, kind: e.kind, title: e.title, region: e.region, port: e.port, x: Math.round(e.x), y: Math.round(e.y),
    endsIn: Math.max(0, Math.round((e.ends - game.wallNow()) / 1000)), by: e.by, stage: e.stage, quarantine: e.quarantine,
  }));
  // Sunken Glory: a legendary wreck is marked for the whole sea for 48 hours.
  for (const w of glories(game)) list.push({ id: -1 - list.length, kind: 'glory', title: `Sunken Glory: the ${w.name}`, region: regionAt(game.world, w.x, w.y), x: w.x, y: w.y, endsIn: w.endsIn });
  return list;
}

function broadcast(game: Game): void {
  const list = eventViews(game);
  const key = JSON.stringify(list.map((x) => [x.id, x.title, x.stage]));
  const hub = game.worldEvents;
  if (key === hub.lastSent) return;
  hub.lastSent = key;
  for (const s of game.sessions) game.sendTo(s, { t: 'events', list });
}

export function sendEvents(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'events', list: eventViews(game) });
}
