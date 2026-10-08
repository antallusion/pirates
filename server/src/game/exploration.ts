// Landing parties: anchor off an island and send boats ashore to explore a feature (cache, wreck, ruins,
// grove, mine, pearl bank, shrine). It takes time, leaves the ship anchored and exposed, and can cost lives.
// Features restock after a while, so islands stay worth revisiting. Rumours in taverns point to them.

import { pointsXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { fatesOnLand } from './fates.ts';
import { petsOnLand } from './pets.ts';
import { lairIsland, lairLanding } from './wanted.ts';
import { raiseHull, salvageTarget } from './bridgefx.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import { cargoVolume, tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island, IslandFeature, Port } from '../../../shared/src/world/worldgen.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import { LAND_SITES, islandLife } from '../../../shared/src/world/islandlife.ts';
import type { LandSite, LifeSite } from '../../../shared/src/world/islandlife.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { haulSite, ownSiteNear } from './resources.ts';
import { flagLanded, startFlag } from './mines.ts';
import { canDive, digTime, makeMap, grantMap, mapChance, mapHere, resolveDig, resolveDive, wreckHere } from './explorefx.ts';
import { islandJobOffer, questEvent, questLandsHere } from './quests.ts';
import { landingMinigame, openMinigame } from './minigames.ts';
import { startTrek, trekBusy } from './trek.ts';
import { bankHere, bankName, bankUp, climbLookout, combBank, lookoutReady } from './isles.ts';
import { tidalIsles } from '../../../shared/src/world/tidal.ts';
import { turtles } from '../../../shared/src/world/drift.ts';
import { combTurtle, hiddenCache, turtleHere, turtleName, turtleUpNow, warnLanding } from './isles18.ts';
import { lairLanding as beastLanding } from './beastlairs.ts';
import { shoreBossLanding } from './shorebosses.ts';
import { hearsayCacheBonus } from './hearsay.ts';
import { onShrine, onSpring } from './hero.ts';
import { HAUNT_NAMES, islandHaunt } from '../../../shared/src/data/minigames.ts';
import type { HauntId } from '../../../shared/src/data/minigames.ts';

/** An island feature, or one of the island's people or beasts (living islands, docs/11 P3), or an island's haunt
 * with its mini-games (2026-09-30: 'scene', on every island with nothing else ashore). */
export type LandableFeature = Exclude<IslandFeature, 'port' | 'lighthouse'> | LandSite | 'scene' | 'lookout';
export const LANDABLE: LandableFeature[] = ['cache', 'wreck', 'ruins', 'grove', 'mine', 'pearl_bank', 'shrine', 'fort', 'volcano', 'bones', 'bell', 'hermit', 'spring', ...LAND_SITES];

/** Who and what lives on an island (the same list the client draws). */
export function lifeOf(is: Island): LifeSite[] {
  return islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: Math.round(is.radius), poly: is.poly, features: is.features, portId: is.portId });
}

export const FEATURE_NAMES: Record<LandableFeature, string> = {
  cache: "smugglers' cache", wreck: 'beached wreck', ruins: 'ruins', grove: 'timber grove', mine: 'surface mine', pearl_bank: 'pearl bank', shrine: 'drowned shrine',
  fort: 'abandoned fort', volcano: 'smoking volcano', bones: 'leviathan bones', bell: 'drowned bell tower', hermit: "hermit's hut", spring: 'freshwater spring',
  fishers: 'fishing hamlet', smugglers: "smugglers' camp", pirate_camp: 'pirate camp', garrison: 'garrisoned fort', seals: 'seal colony', crabs: 'crab beach', turtles: 'turtle beach',
  scene: 'landing place', lookout: 'lookout',
};

/** An island's haunt (her mini-games), if she has nothing else ashore: no feature, no people or beasts to land for,
 * no port. Fixed by her id. */
export function islandScene(is: Island): HauntId | null {
  if (is.portId) return null;
  if ([...is.features, ...lifeOf(is).map((x) => x.kind)].some((f) => LANDABLE.includes(f as LandableFeature))) return null;
  return islandHaunt(is.id);
}

/** What the boats row for, by name (a haunt is named for the island's own). */
export function featureName(is: Island, f: LandableFeature): string {
  return f === 'scene' ? HAUNT_NAMES[islandHaunt(is.id)][0] : FEATURE_NAMES[f];
}

const DURATION: Record<LandableFeature, number> = {
  cache: 20, wreck: 25, ruins: 40, grove: 30, mine: 35, pearl_bank: 30, shrine: 25, fort: 40, volcano: 35, bones: 30, bell: 30, hermit: 20, spring: 20,
  fishers: 20, smugglers: 25, pirate_camp: 40, garrison: 25, seals: 20, crabs: 15, turtles: 20, scene: 12, lookout: 15,
};
const RESTOCK_SEC = 2 * 3600; // a feature can be worked again two real hours later
/** An island's haunt has a new game for the same captain half an hour later. */
export const SCENE_COOLDOWN = 30 * 60;
const LAND_RANGE = 260; // meters from the coastline
/** A bared bank is combed quickly: the sea is coming back. */
export const TIDAL_LANDING_SEC = 18;

export interface Landing {
  islandId: number;
  feature: LandableFeature | 'haul' | 'dig' | 'dive' | 'tidal' | 'flag' | 'turtle';
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
    if (is.hidden && !s.discovered.has(is.id)) continue; // a hidden island in her mist (docs/18 #30)
    const d = Math.sqrt(closestOnPolygon(ship.state.x, ship.state.y, is.poly).d2);
    if (d > LAND_RANGE || d >= bd) continue;
    // The island's features first, then her people and beasts.
    // A named pirate's lair is the first thing on its island (docs/16 #7): the boats go for the camp.
    const here: string[] = lairIsland(game, is.id) ? ['pirate_camp', ...is.features, ...lifeOf(is).map((x) => x.kind)] : [...is.features, ...lifeOf(is).map((x) => x.kind)];
    let found = false;
    // A lookout on her headland (docs/16 #24): climbed first, once in two hours.
    if (lookoutReady(game, s, is.id)) {
      best = { island: is, feature: 'lookout' };
      bd = d;
      continue;
    }
    for (const f of here) {
      if (!LANDABLE.includes(f as LandableFeature)) continue;
      const t = p.explored[exploredKey(is.id, f as LandableFeature)] ?? -Infinity;
      if (game.now - t < RESTOCK_SEC && !questLandsHere(p, is.id, f)) continue;
      best = { island: is, feature: f as LandableFeature };
      bd = d;
      found = true;
      break;
    }
    // Nothing else ashore: the island's haunt and her games, once the last game there is half an hour old.
    if (!found && islandScene(is) && !openMinigame(game, s) && !trekBusy(game, s) && game.now - (p.explored[exploredKey(is.id, 'scene')] ?? -Infinity) >= SCENE_COOLDOWN) {
      best = { island: is, feature: 'scene' };
      bd = d;
    }
  }
  return best;
}

export function startLanding(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  if (ship.docked || !ship.alive || ship.boarding) return 'Not now';
  if (ship.landing) return 'The boats are already ashore';
  if (ship.underFire(game.now)) return 'Not while under fire';
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
  // A bank the ebb or the season has bared (docs/16 #25).
  const bank = bankHere(game, s);
  if (bank) {
    const party = Math.max(3, Math.min(12, Math.round(ship.crew * 0.3)));
    ship.landing = { islandId: 0, feature: 'tidal', siteId: String(bank.id), until: game.now + TIDAL_LANDING_SEC, started: game.now, party };
    ship.input = { rudder: 0, sailTarget: 0 };
    game.toastShip(ship, `Boats away: ${party} hands row for ${bankName(bank)} while the sea is out (${TIDAL_LANDING_SEC}s).`, 'info');
    return null;
  }
  // A turtle island basking (docs/18 #31).
  const turtle = turtleHere(game, s);
  if (turtle) {
    const party = Math.max(3, Math.min(12, Math.round(ship.crew * 0.3)));
    ship.landing = { islandId: 0, feature: 'turtle', siteId: String(turtle.id), until: game.now + TIDAL_LANDING_SEC, started: game.now, party };
    ship.input = { rudder: 0, sailTarget: 0 };
    game.toastShip(ship, `Boats away: ${party} hands row for the back of ${turtleName(turtle)} while she basks (${TIDAL_LANDING_SEC}s).`, 'info');
    return null;
  }
  // A mine ashore (docs/17 H3): the flag first.
  const flag = startFlag(game, s);
  if (flag !== undefined) return flag;
  // A great one ashore in reach (shorebosses.ts, 2026-10-03): the boats go ashore against it.
  const great = shoreBossLanding(game, s);
  if (great !== undefined) return great;
  // A lair of the land's creatures in reach (docs/18 II): the boats go ashore against it.
  const lair = beastLanding(game, s);
  if (lair !== undefined) return lair;
  const target = findLandable(game, s);
  if (!target) return 'Nothing worth landing for within reach of the boats';
  const party = Math.max(3, Math.min(12, Math.round(ship.crew * 0.3)));
  if (ship.crew - party < ship.stats.crewMin * 0.4) return 'Too few hands to spare a landing party';
  const dur = DURATION[target.feature];
  ship.landing = { islandId: target.island.id, feature: target.feature, until: game.now + dur, started: game.now, party };
  ship.input = { rudder: 0, sailTarget: 0 };
  warnLanding(game, s, target.island); // docs/18 #28: an island above her level
  game.toastShip(ship, `Boats away: ${party} hands row for the ${featureName(target.island, target.feature)} on ${target.island.name} (${dur}s). The ship lies at anchor.`, 'info');
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
  const recalled = ship.input.sailTarget > 0 || ship.underFire(game.now);
  // A bared bank the sea takes back before the party is done (docs/16 #25).
  const bank = l.feature === 'tidal' ? tidalIsles(game.world)[Number(l.siteId)] : undefined;
  if (bank && !bankUp(game, bank)) {
    ship.landing = null;
    combBank(game, s, bank, 0);
    return;
  }
  // A turtle island that sounds before the party is done (docs/18 #31).
  const turtle = l.feature === 'turtle' ? turtles(game.world)[Number(l.siteId)] : undefined;
  if (turtle && !turtleUpNow(game, turtle)) {
    ship.landing = null;
    combTurtle(game, s, turtle, 0);
    return;
  }
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
  if (l.feature === 'tidal') {
    if (bank) combBank(game, s, bank, recalled ? 0.5 : 1);
    return;
  }
  if (l.feature === 'turtle') {
    if (turtle) combTurtle(game, s, turtle, recalled ? 0.5 : 1);
    return;
  }
  if (l.feature === 'flag') return flagLanded(game, s, ship, l, recalled);
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
  // A named pirate's lair (docs/12 P5): its battery drives the boats off, or, silenced, the lair is stormed.
  if (feature === 'pirate_camp' && lairLanding(game, s, island)) return;
  p.explored[exploredKey(island.id, feature)] = game.now;
  // A lookout on the headland (docs/16 #24): the sea about charted.
  if (feature === 'lookout') {
    climbLookout(game, s, island, share);
    questEvent(game, s, { k: 'land', island: island.id, feature });
    return;
  }
  // An island's haunt: her mini-game opens (it pays, and counts as a landing, when it is played out).
  if (feature === 'scene') {
    // docs/16 #21: the party meets what waits at the haunt (its game), then walks on across the island.
    if (!startTrek(game, s, island, share)) {
      game.toastShip(ship, `The party finds the ${featureName(island, feature)} on ${island.name} deserted.`, 'info');
      game.grantXp(s, pointsXp(s.profile!.level, 10 * share), null);
    }
    petsOnLand(game, s, island, feature);
    fatesOnLand(game, s, island.id);
    return;
  }
  const got: string[] = [];
  const give = (good: GoodId, lo: number, hi: number) => {
    const n = addCargo(ship, good, Math.round(rng.int(lo, hi) * share));
    if (n > 0) got.push(`${n} ${GOODS[good].name}`);
  };
  let silver = 0, lost = 0, xp = 20;
  let morale = 0;
  switch (feature) {
    case 'cache':
      silver = rng.int(80, 260) + hearsayCacheBonus(game, s, island.id); // a true whisper's finder's share (docs/16 #14)
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
      onSpring(game, s); // docs/17 H2: HoMM3's well
      give('provisions', 6, 14);
      morale = 10;
      xp = 25;
      break;
    // Living islands: the people and beasts ashore.
    case 'fishers': {
      // The hamlet sells its catch cheap and tells what it has seen at sea.
      const price = rng.int(30, 70);
      if (p.gold >= price) {
        p.gold -= price;
        give('provisions', 8, 16);
        got.push(`paid ${price} silver`);
      } else give('provisions', 3, 6);
      morale = 3;
      xp = 20;
      break;
    }
    case 'smugglers':
      if (rng.chance(0.5)) {
        const price = rng.int(90, 220);
        if (p.gold >= price) {
          p.gold -= price;
          give(rng.pick(['dreamleaf', 'tobacco', 'rum'] as GoodId[]), 3, 8);
          got.push(`paid ${price} silver`);
        }
      } else give('rum', 2, 6);
      xp = 40;
      break;
    case 'pirate_camp': {
      // A fight on the sand: a small party is thrown back.
      const beaten = rng.chance(ship.crew < 40 ? 0.35 : 0.15);
      lost = rng.int(1, beaten ? 7 : 4);
      if (!beaten) {
        silver = rng.int(150, 450);
        give(rng.pick(['weapons', 'rum', 'gunpowder'] as GoodId[]), 3, 8);
      } else morale = -8;
      xp = 70;
      break;
    }
    case 'garrison':
      if (ship.wantedCache >= 2) {
        // The garrison knows your face: its guns speak before the boats touch the sand.
        lost = rng.int(2, 5);
        ship.hull = Math.max(1, ship.hull - ship.stats.hullMax * 0.06);
        morale = -8;
        game.toastShip(ship, 'The garrison opens fire on your boats!', 'bad');
      } else {
        const price = 120;
        if (p.gold >= price) {
          p.gold -= price;
          ship.ammo.round = (ship.ammo.round ?? 0) + Math.round(20 * share);
          ship.ammo.chain = (ship.ammo.chain ?? 0) + Math.round(10 * share);
          got.push('shot for the guns', `paid ${price} silver`);
        }
      }
      xp = 20;
      break;
    case 'seals':
      give('provisions', 6, 12);
      if (rng.chance(0.5)) give('whale_oil', 1, 3);
      xp = 20;
      break;
    case 'crabs':
      give('provisions', 4, 9);
      morale = 2;
      xp = 15;
      break;
    case 'turtles':
      give('provisions', 5, 10);
      morale = 5; // turtle soup
      xp = 20;
      break;
    case 'shrine':
      onShrine(game, s, island.id); // docs/17 H2: an order, and the will whole
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
  // A hidden island's cache (docs/18 #30): richer, pearls with it, now and then a piece of gear a tier up.
  if (feature === 'cache' && island.hidden) {
    const h = hiddenCache(game, s, island, share);
    silver = Math.round(silver * h.silverMul);
    got.push(...h.got);
    xp = Math.round(xp * 1.5);
  }
  silver = Math.round(silver * share);
  if (silver) {
    p.gold += silver;
    got.push(`${silver} silver`);
    game.db.ledger(s.accountId, 'landing', silver, `${feature} @ ${island.name}`);
  }
  if (lost) ship.crew = Math.max(1, ship.crew - lost);
  ship.morale = Math.max(0, Math.min(100, ship.morale + morale + (got.length ? 4 : 0)));
  game.grantXp(s, pointsXp(s.profile!.level, xp * share), null);
  const what = got.length ? got.join(', ') : 'nothing but sand and bones';
  game.toastShip(ship, `The party returns from the ${FEATURE_NAMES[feature]} on ${island.name}: ${what}.${lost ? ` ${lost} lost ashore.` : ''}`, got.length ? 'gold' : 'info');
  questEvent(game, s, { k: 'land', island: island.id, feature });
  petsOnLand(game, s, island, feature);
  fatesOnLand(game, s, island.id); // an old captain's grave (docs/12 P10 #11) // the dog digs; a pet may come back with the party (docs/12 P10 #3)
  // The hamlet's or the camp's people have a job of their own.
  if (feature === 'fishers' || feature === 'smugglers') islandJobOffer(game, s, island.id);
  // Now and then the party stumbles on one of the island games too.
  landingMinigame(game, s, island.id, share);
  // Treasure maps turn up in caches, wrecks and ruins.
  if (feature === 'cache') mapChance(game, s, 0.15, 1, 'In the cache');
  if (feature === 'wreck') mapChance(game, s, 0.1, 1, 'In a captain\'s chest');
  if (feature === 'ruins') mapChance(game, s, 0.12, REGIONS[island.region].safety === 'lawless' ? 2 : 1, 'Carved on a wall');
  if (feature === 'bell') mapChance(game, s, 0.25, 2, 'Scratched inside the bell');
  if (feature === 'hermit') mapChance(game, s, 0.35, 1, 'The hermit draws it in the sand');
  if (feature === 'fort') mapChance(game, s, 0.1, 1, "In the commandant's desk");
  if (feature === 'smugglers') mapChance(game, s, 0.2, 1, 'A smuggler sells it for a drink');
  if (feature === 'pirate_camp') mapChance(game, s, 0.15, 2, "In the camp's plunder");
  // Ruin Reader: every third inscription of the Drowned Crown points to a hidden cache.
  if (feature === 'ruins' && island.region === 'drowned_crown' && ship.hasFlag('ruin_reader') && island.id % 3 === 0) {
    grantMap(game, s, makeMap(game, 2, { island }), 'The inscription reads true');
  }
}

/** A tavern whisper about an unexplored feature near this port; charts the island (quietly) when heard. */
export function poiRumor(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  const candidates = game.world.islands
    .filter((is) => !is.portId && !is.minor && !is.hidden && dist(is.x, is.y, port.x, port.y) < 22000)
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
