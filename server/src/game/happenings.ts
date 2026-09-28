// The sea's shorter events (docs/12 P2), riding on the world events' machinery (events.ts): hours, not days, and a
// reason for the whole server to sail somewhere.
//  - The silver galleon: a Crown galleon with two frigates from one Crown port to another, a fortune in her strongbox.
//  - The Brethren of the Coast: a pirate baron (an elite, for a company) and his captains round a lawless island.
//  - A falling star: at night, onto an island; the first captain to anchor off it takes the star-iron.
//  - An eclipse: ten minutes when the uncanny comes five times as often (the sea director reads it).
//  - The lost fleet: after the Great Storm, the region's water full of drifting hulls and wreckage.
//  - A festival: a lawful port's two kind hours — prices, a cheerful crew, fireworks after dark.

import { spawnWhiteOrca } from './beasts.ts';
import { herringShoals, killShoals } from './fishing.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import { hullsFor, watersBand } from '../../../shared/src/data/shiplevel.ts';
import { dist } from '../../../shared/src/math.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { giveGoods } from './director.ts';
import type { WorldEvent } from './events.ts';
import { scatterWreckage, startEvent } from './events.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { findPath } from './nav.ts';
import { planWander, setPath } from './npc.ts';
import type { ShipEntity } from './ship.ts';

const HOUR = 3600_000;
const MIN = 60_000;

export function eclipseOn(game: Game): boolean {
  return game.worldEvents.active(game).some((e) => e.kind === 'eclipse');
}

export function lostFleetIn(game: Game, region: RegionId): boolean {
  return game.worldEvents.active(game).some((e) => e.kind === 'lost_fleet' && e.region === region);
}

export function festivalAt(game: Game, portId: string): boolean {
  return game.worldEvents.active(game).some((e) => e.kind === 'festival' && e.port === portId);
}

function active(game: Game, kind: WorldEvent['kind']): WorldEvent | undefined {
  return game.worldEvents.active(game).find((e) => e.kind === kind);
}

/** An island of the region, not a port's, with open water round it. */
function wildIsland(game: Game, region: RegionId): Island | null {
  const pool = game.world.islands.filter((is) => is.region === region && !game.world.ports.some((p) => p.islandId === is.id) && is.radius > 150);
  return pool.length ? game.worldEvents.rng.pick(pool) : null;
}

/** Who struck a ship last (for the world's word on who took her). */
function lastStriker(game: Game, ship: ShipEntity): string | null {
  let best: number | null = null, bt = -Infinity;
  for (const [id, t] of ship.attackers) if (t > bt) {
    bt = t;
    best = id;
  }
  const s = best !== null ? game.ships.get(best) : undefined;
  return s ? (s.isPlayer ? s.captainName : s.name) : null;
}

// ------------------------------------------------------------------------------------------------ starts

function silverConvoy(game: Game, wall: number): boolean {
  // From the Crown's mint (Gravesend, or another Crown port) to a lawful port a long day's sail away.
  const ports = game.zonePorts();
  const rng = game.worldEvents.rng;
  const crown = ports.filter((p) => p.faction === 'crown');
  if (!crown.length) return false;
  const from = crown.find((p) => p.id === 'gravesend') ?? rng.pick(crown);
  const lawful = ports.filter((p) => p !== from && (p.faction === 'crown' || p.faction === 'league') && dist(p.x, p.y, from.x, from.y) > 12000 && dist(p.x, p.y, from.x, from.y) < 45000);
  if (!lawful.length) return false;
  const to = rng.pick(lawful);
  const path = findPath(game.world, from.x, from.y, to.x, to.y, 90000);
  if (!path) return false;
  const lv = Math.min(10, watersBand(REGIONS[from.region].safety)[1] + 2);
  const g = game.spawnNpcShip('merchant', 'galleon', 'crown', from.x, from.y, 0, { ship: rng.pick(['Sovereign Weight', 'Crown Tithe', 'Silver Psalter', 'King’s Ransom']), captain: 'Commodore of the Mint' });
  game.setNpcLevel(g, lv);
  g.purse = 8000 + rng.int(0, 7000);
  g.cargo = { pearls: 6, spices: 20, cloth: 20 };
  const brain = game.npcs.get(g.id)!;
  brain.destPort = to.id;
  setPath(brain, path);
  const fleet = [g.id];
  for (let i = 0; i < 2; i++) {
    const f = game.spawnNpcShip('patrol', 'frigate', 'crown', from.x + (i ? 80 : -80), from.y, 0, { ship: `HMS ${rng.pick(['Vigilant', 'Warden', 'Stalwart', 'Tribute'])}`, captain: 'Captain of the Escort' });
    game.setNpcLevel(f, Math.min(10, lv));
    const b = game.npcs.get(f.id)!;
    b.leader = g.id;
    b.slot = i + 1;
    fleet.push(f.id);
  }
  const e = startEvent(game, { kind: 'silver_convoy', region: from.region, port: to.id, x: from.x, y: from.y, ends: wall + 90 * MIN, title: `The silver galleon sails from ${from.name} to ${to.name}`, by: g.name },
    `The Crown’s silver galleon ${g.name} weighs anchor at ${from.name} for ${to.name}, with two frigates at her side. A fortune under sail.`);
  if (!e) {
    for (const id of fleet) game.removeShip(id);
    return false;
  }
  game.worldEvents.fleets.set(e.id, fleet);
  return true;
}

function brethren(game: Game, wall: number): boolean {
  const rng = game.worldEvents.rng;
  const regions = (Object.keys(REGIONS) as RegionId[]).filter((r) => REGIONS[r].safety === 'lawless' && r !== 'the_abyss' && (!game.zone || game.zone.regions.has(r)));
  if (!regions.length) return false;
  const region = rng.pick(regions);
  const is = wildIsland(game, region);
  if (!is) return false;
  const band = watersBand('lawless');
  const fleet: number[] = [];
  const spot = (r: number) => {
    for (let k = 0; k < 12; k++) {
      const a = rng.float() * Math.PI * 2;
      const x = is.x + Math.cos(a) * (is.radius + r), y = is.y + Math.sin(a) * (is.radius + r);
      if (!isLand(game.world, x, y) && game.inZone(x, y)) return { x, y };
    }
    return null;
  };
  const at = spot(500);
  if (!at) return false;
  const baronName = rng.pick(['Red Cassius', 'Iron Meg', 'Salt-Eye Borro', 'Madame Vex', 'One-Hand Tobias']);
  const baron = game.spawnNpcShip('pirate', hullsFor('pirate', band[1]).at(-1)!, 'confederacy', at.x, at.y, 0, { ship: 'The Baron’s Crown', captain: `Baron ${baronName}` });
  baron.elite = true;
  game.setNpcLevel(baron, band[1]);
  baron.purse = 3000 + rng.int(0, 3000);
  fleet.push(baron.id);
  for (let i = 0; i < 5; i++) {
    const p = spot(600 + i * 150);
    if (!p) continue;
    const lv = rng.int(band[0], band[1] - 1);
    const s = game.spawnNpcShip('pirate', rng.pick(hullsFor('pirate', lv)), 'confederacy', p.x, p.y, rng.float() * 6.28);
    game.setNpcLevel(s, lv);
    fleet.push(s.id);
  }
  for (const id of fleet) {
    const b = game.npcs.get(id);
    const sh = game.ships.get(id);
    if (b && sh) {
      b.area = { x: is.x, y: is.y, r: is.radius + 2500 };
      planWander(game, sh, b);
    }
  }
  const e = startEvent(game, { kind: 'brethren', region, x: is.x, y: is.y, ends: wall + 2 * HOUR, title: `The Brethren gather off ${is.name}`, by: baronName },
    `The Brethren of the Coast gather off ${is.name} in ${REGIONS[region].name}: Baron ${baronName} holds court among his captains. Scatter them, or keep clear.`);
  if (!e) {
    for (const id of fleet) game.removeShip(id);
    return false;
  }
  game.worldEvents.fleets.set(e.id, fleet);
  return true;
}

function fallingStar(game: Game, wall: number): boolean {
  const rng = game.worldEvents.rng;
  const regions = (Object.keys(REGIONS) as RegionId[]).filter((r) => REGIONS[r].safety !== 'safe' && r !== 'the_abyss' && (!game.zone || game.zone.regions.has(r)));
  if (!regions.length) return false;
  const region = rng.pick(regions);
  const is = wildIsland(game, region);
  if (!is) return false;
  return !!startEvent(game, { kind: 'star', region, x: is.x, y: is.y, ends: wall + HOUR, title: `A falling star on ${is.name}`, islandId: is.id },
    `A star falls from the sky onto ${is.name} in ${REGIONS[region].name}! The first to anchor off it claims the star-iron.`);
}

function eclipse(game: Game, wall: number): boolean {
  const [x, y] = REGIONS.dead_mans_expanse.center;
  return !!startEvent(game, { kind: 'eclipse', region: 'dead_mans_expanse', x, y, ends: wall + 10 * MIN, title: 'The eclipse' },
    'The sun goes dark. For a while the drowned are bold, and strange things walk the water.');
}

function festival(game: Game, wall: number): boolean {
  const pool = game.zonePorts().filter((p) => (p.faction === 'crown' || p.faction === 'league' || p.faction === 'free') && p.size >= 2 && !game.worldEvents.blockaded(game, p.id));
  if (!pool.length) return false;
  const p = game.worldEvents.rng.pick(pool);
  return !!startEvent(game, { kind: 'festival', region: p.region, port: p.id, x: p.x, y: p.y, ends: wall + 2 * HOUR, title: `Festival in ${p.name}` },
    `${p.name} holds its festival: prices are kind, the taverns are loud, and there will be fireworks after dark.`);
}

/** The herring run (docs/12 P3): a northern sea's coasts boil with herring for an hour, by day. */
function herringRun(game: Game, wall: number): boolean {
  const regions = (FISH.herring.regions ?? []).filter((r) => !game.zone || game.zone.regions.has(r));
  if (!regions.length) return false;
  const region = game.worldEvents.rng.pick(regions);
  const [x, y] = REGIONS[region].center;
  const e = startEvent(game, { kind: 'herring_run', region, x, y, ends: wall + HOUR, title: `The herring run in ${REGIONS[region].name}` },
    `The herring are running along the coasts of ${REGIONS[region].name}: the water boils with them, and every net comes up full. It lasts an hour.`);
  if (e) herringShoals(game, region, 8);
  return !!e;
}

/** A red tide (docs/12 P3): a warm sea's fish die, and the sharks come for them. */
function redTide(game: Game, wall: number): boolean {
  const regions = (Object.keys(REGIONS) as RegionId[]).filter((r) => REGIONS[r].safety !== 'safe' && r !== 'the_abyss' && (!game.zone || game.zone.regions.has(r)));
  if (!regions.length) return false;
  const region = game.worldEvents.rng.pick(regions);
  const [x, y] = REGIONS[region].center;
  const e = startEvent(game, { kind: 'red_tide', region, x, y, ends: wall + HOUR, title: `Red tide in ${REGIONS[region].name}` },
    `The sea turns red over ${REGIONS[region].name}: the fish die in their shoals, and the sharks and worse come for the dead. No net will bring anything up there for an hour.`);
  if (e) killShoals(game, region);
  return !!e;
}

/** The orca migration (docs/12 P4): a cold sea full of pods for two hours; now and then the White Orca with them. */
function orcaMigration(game: Game, wall: number, next: Record<string, number>): boolean {
  const rng = game.worldEvents.rng;
  const regions = (['leviathan_reach', 'gravewater'] as RegionId[]).filter((r) => !game.zone || game.zone.regions.has(r));
  if (!regions.length) return false;
  const region = rng.pick(regions);
  const [x, y] = REGIONS[region].center;
  const e = startEvent(game, { kind: 'orca_migration', region, x, y, ends: wall + 2 * HOUR, title: 'The Orca Migration' },
    `The orcas are running south through ${REGIONS[region].name}: pods everywhere, hungry, and something white among them.`);
  if (e && rng.chance(0.25)) next.white_orca = wall;
  return !!e;
}

/** The White Orca rises in the Reach: rumoured in every tavern, an hour to find her. */
function whiteOrca(game: Game, wall: number): boolean {
  if (game.zone && !game.zone.regions.has('leviathan_reach')) return false;
  const rng = game.worldEvents.rng;
  const [cx, cy] = REGIONS.leviathan_reach.center;
  for (let k = 0; k < 20; k++) {
    const x = cx + rng.range(-9000, 9000), y = cy + rng.range(-7000, 7000);
    if (isLand(game.world, x, y) || regionAt(game.world, x, y) !== 'leviathan_reach') continue;
    const e = startEvent(game, { kind: 'white_orca', region: 'leviathan_reach', x, y, ends: wall + HOUR, title: 'The White Orca' },
      `Whalers have seen the White Orca in ${REGIONS.leviathan_reach.name}. She has sunk three boats this season.`);
    if (!e) return false;
    const queen = spawnWhiteOrca(game, x, y);
    game.worldEvents.fleets.set(e.id, [queen.id]);
    for (const p of game.world.ports) if (p.region === 'leviathan_reach' || p.region === 'gravewater') game.addRumor(p.x, p.y, `Whalers have seen the White Orca in ${REGIONS.leviathan_reach.name}. She has sunk three boats this season.`);
    return true;
  }
  return false;
}

export function redTideAt(game: Game, region: RegionId): boolean {
  return game.worldEvents.active(game).some((e) => e.kind === 'red_tide' && e.region === region);
}

/** After the Great Storm blows itself out: the lost fleet of that sea. */
export function lostFleet(game: Game, region: RegionId): void {
  const [x, y] = REGIONS[region].center;
  const e = startEvent(game, { kind: 'lost_fleet', region, x, y, ends: game.wallNow() + 2 * HOUR, title: `The lost fleet of ${REGIONS[region].name}` },
    `The Great Storm has scattered a whole fleet over ${REGIONS[region].name}: empty hulls drift everywhere, and their holds are full.`);
  if (e) scatterWreckage(game, region, 16);
}

/** The calendars of the shorter events (every ten seconds, with the world events' triggers). */
export function happeningTriggers(game: Game, next: Record<string, number>, wall: number): boolean {
  const rng = game.worldEvents.rng;
  let changed = false;
  next.silver_convoy ??= wall + (1 + rng.float() * 2) * HOUR;
  next.brethren ??= wall + (3 + rng.float() * 6) * HOUR;
  next.star ??= wall + (2 + rng.float() * 4) * HOUR;
  next.eclipse ??= wall + (5 + rng.float() * 8) * HOUR;
  next.festival ??= wall + (1 + rng.float() * 3) * HOUR;
  next.herring_run ??= wall + (1 + rng.float() * 3) * HOUR;
  next.red_tide ??= wall + (4 + rng.float() * 8) * HOUR;
  next.orca_migration ??= wall + (2 + rng.float() * 6) * HOUR;
  next.white_orca ??= wall + (4 + rng.float() * 4) * HOUR;
  if (wall >= next.silver_convoy && !active(game, 'silver_convoy')) {
    next.silver_convoy = wall + (5 + rng.float() * 2) * HOUR;
    if (silverConvoy(game, wall)) changed = true;
  }
  if (wall >= next.brethren && !active(game, 'brethren')) {
    next.brethren = wall + (20 + rng.float() * 8) * HOUR;
    if (brethren(game, wall)) changed = true;
  }
  // A star falls only by night; by day it waits.
  if (wall >= next.star && !active(game, 'star') && isNight(game.now)) {
    next.star = wall + (18 + rng.float() * 12) * HOUR;
    if (fallingStar(game, wall)) changed = true;
  }
  if (wall >= next.eclipse && !active(game, 'eclipse')) {
    next.eclipse = wall + (20 + rng.float() * 8) * HOUR;
    if (eclipse(game, wall)) changed = true;
  }
  if (wall >= next.festival && !active(game, 'festival')) {
    next.festival = wall + (20 + rng.float() * 8) * HOUR;
    if (festival(game, wall)) changed = true;
  }
  // The herring run only by day.
  if (wall >= next.herring_run && !active(game, 'herring_run') && !isNight(game.now)) {
    next.herring_run = wall + (8 + rng.float() * 6) * HOUR;
    if (herringRun(game, wall)) changed = true;
  }
  if (wall >= next.red_tide && !active(game, 'red_tide')) {
    next.red_tide = wall + (14 + rng.float() * 8) * HOUR;
    if (redTide(game, wall)) changed = true;
  }
  if (wall >= next.orca_migration && !active(game, 'orca_migration')) {
    next.orca_migration = wall + (10 + rng.float() * 8) * HOUR;
    if (orcaMigration(game, wall, next)) changed = true;
  }
  if (wall >= next.white_orca && !active(game, 'white_orca')) {
    next.white_orca = wall + (5 + rng.float() * 2) * HOUR;
    if (whiteOrca(game, wall)) changed = true;
  }
  return changed;
}

// ------------------------------------------------------------------------------------------------ while they last

/** Each second: the galleon's place on the chart, a star claimed, the eclipse's drowned, a festival's fireworks. */
export function tickHappening(game: Game, e: WorldEvent): boolean {
  switch (e.kind) {
    case 'silver_convoy': {
      const g = game.ships.get(game.worldEvents.fleets.get(e.id)?.[0] ?? -1);
      if (g?.alive && game.worldEvents.secs % 10 === 0) {
        e.x = g.state.x;
        e.y = g.state.y;
        return true;
      }
      return false;
    }
    case 'star': {
      const is = e.islandId !== undefined ? game.world.islands[e.islandId] : null;
      if (!is) return false;
      for (const s of game.sessions) {
        const ship = s.ship;
        if (!ship || ship.docked || !s.profile) continue;
        if (dist(ship.state.x, ship.state.y, is.x, is.y) > is.radius + 400 || ship.state.speed > 2) continue;
        e.ends = game.wallNow(); // claimed: it ends on the next step
        e.by = s.name;
        const n = giveGoods(ship, 'sulfur_iron', 5);
        game.sendTo(s, { t: 'toast', msg: `The star-iron is yours: ${n} of it in the hold.`, kind: 'gold' });
        takeItem(game, s, makeItem(game.rng, 0, { ilvl: ship.shipLevel, source: 'elite' }));
        for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} claims the fallen star on ${is.name}!`, kind: 'gold' });
        return true;
      }
      return false;
    }
    case 'white_orca': {
      const q = game.ships.get(game.worldEvents.fleets.get(e.id)?.[0] ?? -1);
      if (q?.alive && game.worldEvents.secs % 10 === 0) {
        e.x = q.state.x;
        e.y = q.state.y;
        return true;
      }
      return false;
    }
    case 'festival': {
      // Fireworks over the port after dark.
      if (isNight(game.now) && game.worldEvents.secs % 4 === 0) {
        const a = game.rng.float() * Math.PI * 2, r = 150 + game.rng.float() * 300;
        game.emit({ k: 'fx', fx: 'explosion', x: Math.round(e.x + Math.cos(a) * r), y: Math.round(e.y + Math.sin(a) * r), r: 18 }, e.x, e.y);
      }
      return false;
    }
  }
  return false;
}

/** Whether a shorter event still stands: the galleon and the baron end it when they go. */
export function happeningStillOn(game: Game, e: WorldEvent): boolean {
  if (e.kind === 'white_orca') {
    const q = game.ships.get(game.worldEvents.fleets.get(e.id)?.[0] ?? -1);
    return !!q?.alive;
  }
  if (e.kind === 'silver_convoy' || e.kind === 'brethren') {
    const fleet = game.worldEvents.fleets.get(e.id);
    if (!fleet) return false; // after a restart the ships are gone with it
    const lead = game.ships.get(fleet[0]);
    if (!lead?.alive) return false;
    if (e.kind === 'silver_convoy' && e.port) {
      const to = game.portById(e.port);
      if (to && dist(lead.state.x, lead.state.y, to.x, to.y) < 900) return false;
    }
  }
  return true;
}

/** The world's word when a shorter event ends. */
export function happeningFinish(game: Game, e: WorldEvent, fleet: number[]): string {
  const lead = fleet.length ? game.ships.get(fleet[0]) : undefined;
  const leadGone = !!fleet.length && (!lead || !lead.alive);
  let text = '';
  switch (e.kind) {
    case 'silver_convoy': {
      const to = game.portById(e.port ?? '');
      if (leadGone) {
        const who = lead ? lastStriker(game, lead) : null;
        text = who ? `${who} took the silver galleon ${e.by}! The Crown will want that silver back.` : `The silver galleon ${e.by} is gone, and nobody will say where.`;
      } else if (lead && to && dist(lead.state.x, lead.state.y, to.x, to.y) < 900) text = `The silver galleon ${e.by} reached ${to.name} safely.`;
      else text = `The silver galleon ${e.by} is gone, and nobody will say where.`;
      break;
    }
    case 'brethren': {
      const is = game.nearestIslandName(e.x, e.y);
      text = leadGone ? `Baron ${e.by} is sunk off ${is}, and the Brethren scatter!` : `The Brethren weigh anchor off ${is}.`;
      break;
    }
    case 'star':
      if (!e.by) text = `The fallen star on ${game.nearestIslandName(e.x, e.y)} cools, and the sea forgets it.`;
      break;
    case 'eclipse':
      text = 'The sun comes back.';
      break;
    case 'lost_fleet':
      text = `The last of the lost fleet sinks in ${REGIONS[e.region].name}.`;
      break;
    case 'festival':
      text = `The festival in ${game.portById(e.port ?? '')?.name ?? 'the port'} is over.`;
      break;
    case 'herring_run':
      text = `The herring have gone from ${REGIONS[e.region].name}.`;
      break;
    case 'red_tide':
      text = `The red tide over ${REGIONS[e.region].name} clears.`;
      break;
    case 'orca_migration':
      text = `The orcas have passed through ${REGIONS[e.region].name}.`;
      break;
    case 'white_orca': {
      const q = fleet.length ? game.ships.get(fleet[0]) : undefined;
      if (q?.alive) {
        game.removeShip(q.id); // she sounds and is gone
        text = `The White Orca is gone from ${REGIONS[e.region].name}, for now.`;
      } else text = `The White Orca is slain in ${REGIONS[e.region].name}!`;
      break;
    }
  }
  for (const id of fleet) {
    const s = game.ships.get(id);
    if (s?.alive && e.kind === 'silver_convoy') game.removeShip(id); // the convoy sails out of the story
  }
  return text;
}

/** A festival's port: kind prices, and a cheerful crew on coming in. */
export function festivalDock(game: Game, ship: ShipEntity, port: Port): void {
  if (!festivalAt(game, port.id)) return;
  ship.morale = Math.min(100, ship.morale + 10);
  ship.sanity = Math.min(100, ship.sanity + 10);
  game.toastShip(ship, 'The festival warms your crew.', 'good');
}

