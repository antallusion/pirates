// Landing parties: anchor off an island and send boats ashore to explore a feature (cache, wreck, ruins,
// grove, mine, pearl bank, shrine). It takes time, leaves the ship anchored and exposed, and can cost lives.
// Features restock after a while, so islands stay worth revisiting. Rumours in taverns point to them.

import { raiseHull, salvageTarget } from './bridgefx.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import { cargoVolume, tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island, IslandFeature, Port } from '../../../shared/src/world/worldgen.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { haulSite, ownSiteNear } from './resources.ts';
import { canDive, digTime, makeMap, grantMap, mapChance, mapHere, resolveDig, resolveDive, wreckHere } from './explorefx.ts';

export type LandableFeature = Exclude<IslandFeature, 'port' | 'lighthouse'>;
export const LANDABLE: LandableFeature[] = ['cache', 'wreck', 'ruins', 'grove', 'mine', 'pearl_bank', 'shrine', 'fort', 'volcano', 'bones', 'bell', 'hermit', 'spring'];

export const FEATURE_NAMES: Record<LandableFeature, string> = {
  cache: "smugglers' cache", wreck: 'beached wreck', ruins: 'ruins', grove: 'timber grove', mine: 'surface mine', pearl_bank: 'pearl bank', shrine: 'drowned shrine',
  fort: 'abandoned fort', volcano: 'smoking volcano', bones: 'leviathan bones', bell: 'drowned bell tower', hermit: "hermit's hut", spring: 'freshwater spring',
};

const DURATION: Record<LandableFeature, number> = { cache: 20, wreck: 25, ruins: 40, grove: 30, mine: 35, pearl_bank: 30, shrine: 25, fort: 40, volcano: 35, bones: 30, bell: 30, hermit: 20, spring: 20 };
const RESTOCK_SEC = 2 * 3600; // a feature can be worked again two real hours later
const LAND_RANGE = 260; // meters from the coastline

export interface Landing {
  islandId: number;
  feature: LandableFeature | 'haul' | 'dig' | 'dive';
  siteId?: string;
  mapId?: string;
  wreckId?: number;
  until: number;
  started: number;
  party: number;
}

export function exploredKey(islandId: number, f: LandableFeature): string {
  return `${islandId}:${f}`;
}

/** Nearest island feature this captain can land on right now, or null. */
export function findLandable(game: Game, s: PlayerSession): { island: Island; feature: LandableFeature } | null {
  const ship = s.ship!;
  const p = s.profile!;
  let best: { island: Island; feature: LandableFeature } | null = null;
  let bd = Infinity;
  for (const id of islandsNear(game.world, ship.state.x, ship.state.y)) {
    const is = game.world.islands[id];
    if (dist(is.x, is.y, ship.state.x, ship.state.y) > is.radius + LAND_RANGE) continue;
    const d = Math.sqrt(closestOnPolygon(ship.state.x, ship.state.y, is.poly).d2);
    if (d > LAND_RANGE || d >= bd) continue;
    for (const f of is.features) {
      if (!LANDABLE.includes(f as LandableFeature)) continue;
      const t = p.explored[exploredKey(is.id, f as LandableFeature)] ?? -Infinity;
      if (game.now - t < RESTOCK_SEC) continue;
      best = { island: is, feature: f as LandableFeature };
      bd = d;
      break;
    }
  }
  return best;
}

export function startLanding(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  if (ship.docked || !ship.alive || ship.boarding) return 'Not now';
  if (ship.landing) return 'The boats are already ashore';
  if (ship.inCombat(game.now)) return 'Not while under fire';
  if (ship.state.speed > 2.5) return 'Heave to first — the boats cannot be lowered at speed';
  const party0 = Math.max(3, Math.min(12, Math.round(ship.crew * 0.3)));
  // A treasure map whose circle covers us: the boats go digging.
  // Salvage King: raise a hull that just went down.
  const hull = salvageTarget(game, s);
  if (hull) {
    raiseHull(game, s, hull);
    return null;
  }
  const tmap = mapHere(game, s);
  if (tmap) {
    const t = digTime(ship, tmap.tier);
    ship.landing = { islandId: 0, feature: 'dig', mapId: tmap.id, until: game.now + t, started: game.now, party: party0 };
    ship.input = { rudder: 0, sailTarget: 0 };
    game.toastShip(ship, `The boats go ashore with spades for the ${tmap.name} (${Math.round(t)}s).`, 'info');
    return null;
  }
  // A sunken wreck below: send the divers down.
  const wreck = wreckHere(game, ship);
  if (wreck) {
    const why = canDive(game, s, wreck);
    if (why) return why;
    ship.landing = { islandId: 0, feature: 'dive', wreckId: wreck.id, until: game.now + 25, started: game.now, party: party0 };
    ship.input = { rudder: 0, sailTarget: 0 };
    game.toastShip(ship, `Divers go down to the ${wreck.name} (${wreck.depth} m, 25s).`, 'info');
    return null;
  }
  const own = ownSiteNear(game, s);
  if (own) {
    const party = Math.max(3, Math.min(16, Math.round(ship.crew * 0.35)));
    const haul = 15 * Math.max(0.25, 1 - tx(ship.stats, 'transferSpeed'));
    ship.landing = { islandId: own.island.id, feature: 'haul', siteId: own.site.id, until: game.now + haul, started: game.now, party };
    ship.input = { rudder: 0, sailTarget: 0 };
    game.toastShip(ship, `Boats away to haul the ${GOODS[own.site.good].name.toLowerCase()} stockpile on ${own.island.name} (${Math.round(haul)}s).`, 'info');
    return null;
  }
  const target = findLandable(game, s);
  if (!target) return 'Nothing worth landing for within reach of the boats';
  const party = Math.max(3, Math.min(12, Math.round(ship.crew * 0.3)));
  if (ship.crew - party < ship.stats.crewMin * 0.4) return 'Too few hands to spare a landing party';
  const dur = DURATION[target.feature];
  ship.landing = { islandId: target.island.id, feature: target.feature, until: game.now + dur, started: game.now, party };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.toastShip(ship, `Boats away: ${party} hands row for the ${FEATURE_NAMES[target.feature]} on ${target.island.name} (${dur}s). The ship lies at anchor.`, 'info');
  return null;
}

/** Called every second for each ship with an active landing. */
export function stepLanding(game: Game, ship: ShipEntity): void {
  const l = ship.landing;
  if (!l) return;
  const s = game.sessionOf(ship);
  if (!s || !s.profile) {
    ship.landing = null;
    return;
  }
  // Recalled: the captain sets sail or the enemy arrives. The party scrambles back with less.
  const recalled = ship.input.sailTarget > 0 || ship.inCombat(game.now);
  if (!recalled && game.now < l.until) return;
  ship.landing = null;
  const island = game.world.islands[l.islandId];
  const progress = Math.min(1, (game.now - l.started) / (l.until - l.started));
  if (recalled && progress < 0.5) {
    const lost = Math.min(l.party, Math.round(l.party * 0.3 * game.rng.float()));
    ship.crew = Math.max(1, ship.crew - lost);
    game.toastShip(ship, `The landing party is recalled empty-handed${lost ? `; ${lost} did not make it back` : ''}.`, 'bad');
    return;
  }
  if (l.feature === 'dig') {
    resolveDig(game, s, l.mapId!, recalled ? 0.5 : 1);
    return;
  }
  if (l.feature === 'dive') {
    resolveDive(game, s, l.wreckId!, recalled ? 0.5 : 1);
    return;
  }
  if (l.feature === 'haul') {
    const site = game.sites.find((x) => x.id === l.siteId);
    if (!site || site.holder !== s.accountId) return;
    const n = haulSite(game, ship, recalled ? { ...site, stock: site.stock / 2 } : site);
    if (recalled) site.stock -= n;
    game.toastShip(ship, n > 0 ? `Hauled ${n} ${GOODS[site.good].name.toLowerCase()} aboard from ${island.name}.` : 'No room in the hold for the stockpile.', n > 0 ? 'good' : 'bad');
    return;
  }
  resolveLanding(game, s, ship, island, l.feature, recalled ? 0.5 : 1);
}

function addCargo(ship: ShipEntity, good: GoodId, n: number): number {
  const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
  const per = GOODS[good].volume * (GOODS[good].contraband ? ship.stats.contrabandVolumeMul : 1);
  const fit = Math.max(0, Math.min(n, Math.floor((free + 1e-6) / per)));
  if (fit > 0) ship.cargo[good] = (ship.cargo[good] ?? 0) + fit;
  return fit;
}

export function resolveLanding(game: Game, s: PlayerSession, ship: ShipEntity, island: Island, feature: LandableFeature, share: number): void {
  const p = s.profile!;
  const rng = game.rng;
  const strange = REGIONS[island.region].strangeness;
  p.explored[exploredKey(island.id, feature)] = game.now;
  const got: string[] = [];
  const give = (good: GoodId, lo: number, hi: number) => {
    const n = addCargo(ship, good, Math.round(rng.int(lo, hi) * share));
    if (n > 0) got.push(`${n} ${GOODS[good].name}`);
  };
  let silver = 0, lost = 0, xp = 20;
  let morale = 0;
  switch (feature) {
    case 'cache':
      silver = rng.int(80, 260);
      give(rng.pick(['rum', 'weapons', 'tobacco', 'dreamleaf'] as GoodId[]), 3, 10);
      if (rng.chance(0.15)) lost = rng.int(1, 3); // trapped
      xp = 40;
      break;
    case 'wreck':
      give('planks', 3, 8);
      give('sailcloth', 2, 6);
      if (rng.chance(0.4)) give('iron', 2, 5);
      if (rng.chance(0.25)) silver = rng.int(60, 200);
      xp = 35;
      break;
    case 'ruins':
      silver = rng.int(40, 150) + Math.round(strange * 400);
      if (rng.chance(0.5)) give('pearls', 1, 3);
      if (rng.chance(0.2 + strange)) give('cursed_relics', 1, 2);
      if (rng.chance(0.25)) lost = rng.int(1, 4);
      xp = 80 + strange * 200;
      break;
    case 'grove':
      give('timber', 6, 14);
      give('provisions', 2, 6);
      xp = 25;
      break;
    case 'mine':
      give(island.biome === 'volcanic' ? 'iron' : 'coal', 4, 10);
      if (strange > 0.3 && rng.chance(0.3)) give('abyssal_ore', 1, 2);
      if (rng.chance(0.12)) lost = rng.int(1, 2);
      xp = 35;
      break;
    case 'pearl_bank':
      give('pearls', 2, 6);
      if (rng.chance(0.2)) lost = 1; // a diver does not come up
      xp = 45;
      break;
    case 'fort':
      // Powder and shot the garrison never fired; its dead still keep the magazine.
      give('gunpowder', 3, 8);
      give('iron', 2, 6);
      for (const a of ['round', 'chain'] as const) ship.ammo[a] = (ship.ammo[a] ?? 0) + Math.round(rng.int(10, 30) * share);
      got.push('shot for the guns');
      if (rng.chance(0.3)) silver = rng.int(60, 180);
      if (rng.chance(0.18)) lost = rng.int(1, 3);
      xp = 60;
      break;
    case 'volcano':
      give('sulfur_iron', 3, 8);
      give('coal', 2, 6);
      if (rng.chance(0.25)) lost = rng.int(1, 3); // the ground gives way
      xp = 55;
      break;
    case 'bones':
      give('leviathan_bone', 1, 3);
      if (rng.chance(0.3)) give('whale_oil', 2, 5);
      morale = -6;
      xp = 70 + strange * 150;
      break;
    case 'bell':
      silver = rng.int(60, 200) + Math.round(strange * 250);
      if (rng.chance(0.35)) give('pearls', 1, 3);
      if (rng.chance(0.2)) lost = 1;
      xp = 65 + strange * 150;
      break;
    case 'hermit':
      give('medicine', 1, 4);
      morale = 5;
      xp = 40;
      break;
    case 'spring':
      give('provisions', 6, 14);
      morale = 10;
      xp = 25;
      break;
    case 'shrine':
      if (rng.chance(0.5)) {
        give('cursed_relics', 1, 3);
        morale = -15;
      } else {
        morale = 10;
        silver = rng.int(20, 90);
      }
      xp = 60 + strange * 150;
      break;
  }
  silver = Math.round(silver * share);
  if (silver) {
    p.gold += silver;
    got.push(`${silver} silver`);
    game.db.ledger(s.accountId, 'landing', silver, `${feature} @ ${island.name}`);
  }
  if (lost) ship.crew = Math.max(1, ship.crew - lost);
  ship.morale = Math.max(0, Math.min(100, ship.morale + morale + (got.length ? 4 : 0)));
  game.grantXp(s, xp * share, null);
  const what = got.length ? got.join(', ') : 'nothing but sand and bones';
  game.toastShip(ship, `The party returns from the ${FEATURE_NAMES[feature]} on ${island.name}: ${what}.${lost ? ` ${lost} lost ashore.` : ''}`, got.length ? 'gold' : 'info');
  // Treasure maps turn up in caches, wrecks and ruins.
  if (feature === 'cache') mapChance(game, s, 0.15, 1, 'In the cache');
  if (feature === 'wreck') mapChance(game, s, 0.1, 1, 'In a captain\'s chest');
  if (feature === 'ruins') mapChance(game, s, 0.12, REGIONS[island.region].safety === 'lawless' ? 2 : 1, 'Carved on a wall');
  if (feature === 'bell') mapChance(game, s, 0.25, 2, 'Scratched inside the bell');
  if (feature === 'hermit') mapChance(game, s, 0.35, 1, 'The hermit draws it in the sand');
  if (feature === 'fort') mapChance(game, s, 0.1, 1, "In the commandant's desk");
  // Ruin Reader: every third inscription of the Drowned Crown points to a hidden cache.
  if (feature === 'ruins' && island.region === 'drowned_crown' && ship.hasFlag('ruin_reader') && island.id % 3 === 0) {
    grantMap(game, s, makeMap(game, 2, { island }), 'The inscription reads true');
  }
}

/** A tavern whisper about an unexplored feature near this port; charts the island (quietly) when heard. */
export function poiRumor(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  const candidates = game.world.islands
    .filter((is) => !is.portId && dist(is.x, is.y, port.x, port.y) < 22000)
    .flatMap((is) => is.features.filter((f) => LANDABLE.includes(f as LandableFeature)).map((f) => ({ is, f: f as LandableFeature })))
    .filter(({ is, f }) => game.now - (p.explored[exploredKey(is.id, f)] ?? -Infinity) >= RESTOCK_SEC);
  if (!candidates.length) return null;
  // Stable per port visit so reopening the tavern does not reshuffle.
  const pick = candidates[Math.floor(game.now / 900 + port.x) % candidates.length];
  const dx = pick.is.x - port.x, dy = pick.is.y - port.y;
  const dir = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(dx, -dy) / (Math.PI * 2)) * 8 + 8)) % 8];
  const km = Math.round(Math.hypot(dx, dy) / 1000);
  game.chartIsland(s, pick.is);
  // Hearsay is not a survey: a cartographer will not pay for it.
  if (!p.chartsBought.includes(pick.is.id)) p.chartsBought.push(pick.is.id);
  return `An old hand swears there is a ${FEATURE_NAMES[pick.f]} on ${pick.is.name}, ${km} km ${dir} of here. (Now marked on your chart.)`;
}
