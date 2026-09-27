// Admin commands for play-testing (docs/09_ART_PASS.md P8). Typed in chat with a leading slash; they exist only
// when the server runs with GRAVETIDE_ADMIN=1 — on a normal server a slash line is ordinary chat.
//   /help                      the list
//   /speed N                   world time ×N (0.25–20); the client predicts at the same pace
//   /xp N · /level N · /silver N
//   /tp <port> | <region> | <x> <y>
//   /boss <id>                 raise a boss 600 m off the bow
//   /weather <kind> [region]   calm · breeze · wind · fog · rain · storm · black_storm
//   /time <hour>               wind the world clock forward to that hour
//   /god                       no damage, hull and crew kept whole
//   /ship <class>              change hull (in port or at sea)
//   /heal · /ammo · /give <good> <n> · /reveal (chart every island) · /sink · /spawn [role] [class] [faction]

import { DAY_LENGTH_SEC, MAX_LEVEL, timeOfDay } from '../../../shared/src/constants.ts';
import { BOSSES } from '../../../shared/src/data/bosses.ts';
import type { BossId } from '../../../shared/src/data/bosses.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { AMMO_IDS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { WeatherKind } from '../../../shared/src/protocol.ts';
import { closestOnPolygon, pointInPolygon } from '../../../shared/src/math.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import { summon } from './bosses.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export function adminEnabled(): boolean {
  return process.env.GRAVETIDE_ADMIN === '1';
}

const WEATHERS: WeatherKind[] = ['calm', 'breeze', 'wind', 'fog', 'rain', 'storm', 'black_storm'];

const HELP = '/speed N · /xp N · /level N · /silver N · /tp port|region|x y · /boss id · /weather kind [region] · /time hour · /god · /ship class · /heal · /ammo · /give good n · /reveal · /sink · /spawn role class faction';

/** Run one admin line; the answer is a short line for the captain (or null when it is not a command). */
export function runAdmin(game: Game, s: PlayerSession, line: string): string | null {
  if (!line.startsWith('/')) return null;
  const [cmd, ...args] = line.slice(1).trim().split(/\s+/);
  const p = s.profile;
  const ship = s.ship;
  if (!p || !ship) return 'No captain.';
  const num = (i: number, def = NaN) => (args[i] !== undefined ? Number(args[i]) : def);
  switch (cmd.toLowerCase()) {
    case 'help':
      return HELP;
    case 'speed': {
      const k = num(0, 1);
      if (!Number.isFinite(k)) return 'Usage: /speed N';
      game.timeScale = Math.max(0.25, Math.min(20, k));
      return `World time ×${game.timeScale}.`;
    }
    case 'xp': {
      const n = num(0);
      if (!(n > 0)) return 'Usage: /xp N';
      game.grantXp(s, n, 'admin');
      game.pushSelf(s, true);
      return `Level ${p.level}, ${p.xp} XP.`;
    }
    case 'level': {
      const n = Math.round(num(0));
      if (!(n >= 1)) return 'Usage: /level N';
      const before = p.level;
      p.level = Math.min(MAX_LEVEL, n);
      p.xp = 0;
      ship.level = p.level;
      ship.recompute(game.now);
      game.pushSelf(s, true);
      return `Level ${before} → ${p.level}.`;
    }
    case 'silver':
    case 'gold': {
      const n = Math.round(num(0));
      if (!Number.isFinite(n)) return 'Usage: /silver N';
      p.gold = Math.max(0, p.gold + n);
      game.pushSelf(s, true);
      return `Silver: ${p.gold}.`;
    }
    case 'tp': {
      let x: number, y: number, where: string;
      if (args.length >= 2 && Number.isFinite(num(0)) && Number.isFinite(num(1))) {
        x = num(0);
        y = num(1);
        where = `${Math.round(x)}, ${Math.round(y)}`;
      } else {
        const q = args.join(' ').toLowerCase();
        // An exact port, then an exact region, then the first port or region the words begin.
        const exactPort = game.world.ports.find((pt) => pt.id === q || pt.name.toLowerCase() === q);
        const exactRegion = REGION_IDS.find((r) => r === q);
        const port = exactPort ?? (exactRegion ? undefined : game.world.ports.find((pt) => pt.id.startsWith(q) || pt.name.toLowerCase().startsWith(q)));
        const region = exactRegion ?? REGION_IDS.find((r) => REGIONS[r].name.toLowerCase().includes(q));
        if (port) {
          const is = game.world.islands[port.islandId];
          const d = Math.hypot(port.x - is.x, port.y - is.y) || 1;
          x = port.x + ((port.x - is.x) / d) * 150;
          y = port.y + ((port.y - is.y) / d) * 150;
          where = port.name;
        } else if (region) {
          [x, y] = openWater(game, REGIONS[region].center[0], REGIONS[region].center[1]);
          where = REGIONS[region].name;
        } else return `No port or region "${q}".`;
      }
      if (ship.docked) game.undock(s);
      ship.state = { ...ship.state, x, y, speed: 0, sail: 0 };
      ship.input = { rudder: 0, sailTarget: 0 };
      game.grid.upsert(ship.id, x, y);
      game.pushSelf(s, true);
      return `Set down at ${where}.`;
    }
    case 'boss': {
      const kind = args[0] as BossId;
      if (!BOSSES[kind]) return `Bosses: ${Object.keys(BOSSES).join(', ')}`;
      const [x, y] = openSpot(game, ship, [600, 900, 1300], 400);
      const f = summon(game, kind, x, y);
      return `${BOSSES[kind].name} rises (fight ${f.id}).`;
    }
    case 'weather': {
      const kind = args[0] as WeatherKind;
      if (!WEATHERS.includes(kind)) return `Weather: ${WEATHERS.join(', ')}`;
      const region = (args[1] as RegionId) ?? ship.region;
      if (!REGIONS[region]) return `No region "${args[1]}".`;
      game.weather[region] = { kind, until: game.now + 600, next: kind };
      return `${REGIONS[region].name}: ${kind} for ten minutes.`;
    }
    case 'time': {
      const hour = num(0);
      if (!(hour >= 0 && hour < 24)) return 'Usage: /time 0-23';
      const phase = timeOfDay(game.now);
      const ahead = ((hour / 24 - phase + 1) % 1) * DAY_LENGTH_SEC;
      game.now += ahead;
      return `The clock runs on ${Math.round(ahead / 60)} min to ${hour}:00.`;
    }
    case 'god':
      ship.god = args[0] === 'on' ? true : args[0] === 'off' ? false : !ship.god;
      return ship.god ? 'God mode on: nothing harms her.' : 'God mode off.';
    case 'ship': {
      const cls = args[0] as ShipClassId;
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      ship.loadout.classId = cls;
      ship.recompute(game.now);
      ship.hull = ship.stats.hullMax;
      ship.sails = ship.stats.sailHpMax;
      ship.crew = Math.max(ship.crew, ship.stats.crewMin);
      game.pushSelf(s, true);
      return `She is a ${SHIP_CLASSES[cls].name} now (crew ${ship.crew}).`;
    }
    case 'spawn': {
      // A ship to fight, board or trade with, 300 m off the beam: /spawn [role] [class] [faction].
      const role = (args[0] ?? 'merchant') as 'merchant';
      const cls = (args[1] ?? 'fluyt') as ShipClassId;
      const faction = (args[2] ?? 'league') as 'league';
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      // Off the beam if the water is open there, else the first open bearing (never on a reef or a shore).
      const [x, y] = openSpot(game, ship, [300, 500, 800], 200, Math.PI / 2);
      const o = game.spawnNpcShip(role, cls, faction, x, y, ship.state.heading);
      if (role === 'merchant') o.cargo = { spices: 20, rum: 15, sugar: 20 };
      // Awake at once (a dormant ship is neither simulated nor sent until the sea wakes it).
      const brain = game.npcs.get(o.id);
      if (brain) brain.active = true;
      game.grid.upsert(o.id, o.state.x, o.state.y);
      return `${o.name} (${SHIP_CLASSES[cls].name}, ${faction}) lies off your beam.`;
    }
    case 'sink':
      // The death screen, the tow or the respawn, the losses — without waiting for a fight to go wrong.
      if (ship.docked) return 'Put to sea first.';
      ship.god = false;
      ship.hull = 0;
      game.beginSinking(ship);
      return 'She goes down.';
    case 'heal':
      mend(ship);
      ship.crew = Math.max(ship.crew, ship.stats.crewMax);
      game.pushSelf(s, true);
      return 'Hull, sails and crew made whole.';
    case 'ammo':
      for (const a of AMMO_IDS) ship.ammo[a] = Math.max(ship.ammo[a] ?? 0, 500);
      game.pushSelf(s, true);
      return 'Five hundred of every shot.';
    case 'give': {
      const good = args[0] as GoodId;
      const n = Math.round(num(1, 10));
      if (!GOODS[good]) return `Goods: ${Object.keys(GOODS).join(', ')}`;
      ship.cargo[good] = (ship.cargo[good] ?? 0) + n;
      game.pushSelf(s, true);
      return `${n} ${GOODS[good].name} in the hold.`;
    }
    case 'reveal': {
      let n = 0;
      for (const is of game.world.islands) {
        if (s.discovered.has(is.id)) continue;
        game.chartIsland(s, is);
        n++;
      }
      return `${n} islands charted.`;
    }
    default:
      return `Unknown command. ${HELP}`;
  }
}

/** The nearest open water to a point: out along a widening spiral until no shore is within 300 m. */
function openWater(game: Game, x: number, y: number): [number, number] {
  for (let r = 0; r <= 6000; r += 300) {
    for (let k = 0; k < Math.max(1, Math.round(r / 150)); k++) {
      const a = (k / Math.max(1, Math.round(r / 150))) * Math.PI * 2;
      const px = x + Math.sin(a) * r, py = y - Math.cos(a) * r;
      const clear = islandsNear(game.world, px, py).every((id) => {
        const poly = game.world.islands[id].poly;
        return !pointInPolygon(px, py, poly) && closestOnPolygon(px, py, poly).d2 > 300 * 300;
      });
      if (clear) return [px, py];
    }
  }
  return [x, y];
}

/** Keep a god-mode ship whole (called every step). */
export function mend(ship: { hull: number; sails: number; crew: number; water: number; leaks: number; stats: { hullMax: number; sailHpMax: number; crewMin: number } }): void {
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  // Keeps her sailing, but hands out no free hands: the crew is topped up only to the minimum.
  ship.crew = Math.max(ship.crew, ship.stats.crewMin);
  ship.water = 0;
  ship.leaks = 0;
}

/** Open water off the ship: the first bearing (from `start` off the bow, every 30°) at each range in turn with no
 * shore within `margin` metres; the ship's own spot when the sea has none. */
function openSpot(game: Game, ship: ShipEntity, ranges: number[], margin: number, start = 0): [number, number] {
  for (const r of ranges) {
    for (let k = 0; k < 12; k++) {
      const a = ship.state.heading + start + (k * Math.PI) / 6;
      const px = ship.state.x + Math.sin(a) * r, py = ship.state.y - Math.cos(a) * r;
      const clear = islandsNear(game.world, px, py).every((id) => {
        const poly = game.world.islands[id].poly;
        return !pointInPolygon(px, py, poly) && closestOnPolygon(px, py, poly).d2 > margin * margin;
      });
      if (clear) return [px, py];
    }
  }
  return [ship.state.x, ship.state.y];
}
