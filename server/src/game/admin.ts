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

import { sendDutchman, weekPlan } from './dutchman.ts';
import { wondersOf } from './wonders.ts';
import { regattaNow, regattaSignUp } from './regatta.ts';
import { startEvent } from './events.ts';
import { heartAt } from './storms.ts';
import { givePet, petAction } from './pets.ts';
import { PETS, PET_IDS } from '../../../shared/src/data/companions.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import { giveCalf, sendCompanion } from './companion.ts';
import { sanitizeNemeses } from './nemesis.ts';
import { NEMESIS_CAUSES } from '../../../shared/src/data/nemesis.ts';
import type { NemesisCause } from '../../../shared/src/data/nemesis.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { applyTattoos, earnTattoo, offerChoice, sanitizeTattoos, sendTattoos } from './tattoos.ts';
import { TATTOOS, TATTOO_BY_ID } from '../../../shared/src/data/sidequests.ts';
import { ownIsland } from './estate.ts';
import { hunterRank, namedPirates, pirateById } from '../../../shared/src/data/pirates.ts';
import { putToSea, sanitizeHunter } from './wanted.ts';
import { BEASTS } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { spawnGroup, spawnWhiteOrca } from './beasts.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import type { FishId } from '../../../shared/src/data/fishing.ts';
import { startFight } from './fishing.ts';
import { ENCOUNTERS } from '../../../shared/src/data/encounters.ts';
import type { EncounterId } from '../../../shared/src/data/encounters.ts';
import { startEncounter } from './director.ts';
import { ITEM_BASES, makeItem } from '../../../shared/src/data/items.ts';
import { clampLevel } from '../../../shared/src/data/shiplevel.ts';
import { DAY_LENGTH_SEC, MAX_LEVEL, timeOfDay } from '../../../shared/src/constants.ts';
import { BOSSES } from '../../../shared/src/data/bosses.ts';
import type { BossId } from '../../../shared/src/data/bosses.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { AMMO_IDS, MOUNTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { MountId, ShipClassId } from '../../../shared/src/data/ships.ts';
import type { WeatherKind } from '../../../shared/src/protocol.ts';
import { closestOnPolygon, headingVec, pointInPolygon } from '../../../shared/src/math.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import { summon } from './bosses.ts';
import { startBoarding } from './boarding.ts';
import { mastWreck } from './combat.ts';
import { spawnFireship } from './npc.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { FACTION_IDS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { seizeCaptain, takeCaptive } from './prizes.ts';

export function adminEnabled(): boolean {
  return process.env.GRAVETIDE_ADMIN === '1';
}

const WEATHERS: WeatherKind[] = ['calm', 'breeze', 'wind', 'fog', 'rain', 'storm', 'black_storm'];

const HELP = '/speed N · /xp N · /level N · /silver N · /tp port|region|x y · /boss id · /captive [n] · /rep faction n · /storm [hearts N] · /weather kind [region] · /time hour · /god · /ship class · /heal · /ammo · /give good n · /reveal · /sink · /spawn role class faction · /board [role] [class] [crew] · /fireship · /mast';

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
      // /ship class [level]: her level (canon D12), else her class's first.
      ship.loadout.level = args[1] ? clampLevel(cls, num(1)) : undefined;
      if (SHIP_CLASSES[cls].fixedMount) ship.loadout.mount = SHIP_CLASSES[cls].fixedMount;
      ship.recompute(game.now);
      ship.hull = ship.stats.hullMax;
      ship.sails = ship.stats.sailHpMax;
      ship.crew = Math.max(ship.crew, ship.stats.crewMin);
      game.pushSelf(s, true);
      return `She is a ${SHIP_CLASSES[cls].name} now, level ${ship.shipLevel} (crew ${ship.crew}).`;
    }
    case 'bite': {
      // A fish on the line at once (docs/12 P3): /bite [kind].
      const fish = (args[0] ?? 'tuna') as FishId;
      if (!FISH[fish]) return `Fish: ${Object.keys(FISH).join(', ')}`;
      startFight(game, s, fish, 'rod', 10);
      return `${fish} on the line.`;
    }
    case 'clear':
      // An empty hold for play-testing: /clear.
      for (const k of Object.keys(ship.cargo)) delete ship.cargo[k as keyof typeof ship.cargo];
      game.pushSelf(s, true);
      return 'The hold is swept clean.';
    case 'fish': {
      // Fishing for play-testing (docs/12 P3): /fish <craft 1-100>.
      const p = s.profile!;
      p.fishing!.skill = Math.max(1, Math.min(100, num(0, 60)));
      game.pushSelf(s, true);
      return `Fishing craft ${p.fishing!.skill}.`;
    }
    case 'mount': {
      // A deck mount fitted at once: /mount harpoon|mortar|chain_gun|abyssal_lance|fire_charge.
      const m = args[0] as MountId;
      if (!MOUNTS[m]) return `Mounts: ${Object.keys(MOUNTS).join(', ')}`;
      ship.loadout.mount = m;
      ship.mountReload = 0;
      game.pushSelf(s, true);
      return `${MOUNTS[m].name} fitted.`;
    }
    case 'slay': {
      // The nearest beast within a mile dies to your hand (docs/12 P4 play-testing: the carcass and the flensing).
      let best: ShipEntity | null = null, bd = 1800;
      for (const o of game.ships.values()) {
        if (o.npcRole !== 'beast' || !o.alive) continue;
        const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (!best) return 'No beast within a mile.';
      best.attackers.set(ship.id, game.now);
      best.hull = 0;
      game.beginSinking(best);
      return `${best.name} slain ${Math.round(bd)} m off.`;
    }
    case 'berth': {
      // A cargo hull berthed at one's own island (docs/12 P8 play-testing): /berth [class] [level].
      const h = ownIsland(game, s.accountId);
      if (!h) return 'You have no island of your own.';
      const cls = (args[0] ?? 'fluyt') as ShipClassId;
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      s.profile!.berths.push({ port: `isle:${h.island}`, loadout: { classId: cls, name: `${SHIP_CLASSES[cls].name} ${s.profile!.berths.length + 1}`, guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: args[1] ? clampLevel(cls, num(1)) : undefined }, hull: 1 });
      game.pushSelf(s, true);
      return `A ${SHIP_CLASSES[cls].name} berthed at your island.`;
    }
    case 'tattoo': {
      // Tattoos (docs/12 P9 play-testing): /tattoo <id|all> earns them (Old Needle inks them in a haven), /tattoo ink inks at once.
      const p = s.profile!;
      const t = sanitizeTattoos(p);
      if (args[0] === 'ink') {
        for (const id of t.pending) if (!t.owned.includes(id)) t.owned.push(id);
        t.pending = [];
        applyTattoos(ship, p, game.now);
        sendTattoos(game, s);
        return `Inked: ${t.owned.length}.`;
      }
      const ids = args[0] === 'all' ? TATTOOS.map((x) => x.id) : [args[0] ?? ''];
      if (!ids.every((id) => TATTOO_BY_ID[id])) return `Tattoos: ${TATTOOS.map((x) => x.id).join(', ')}`;
      for (const id of ids) earnTattoo(game, s, id);
      return `Earned: ${ids.length}.`;
    }
    case 'nemesis': {
      // A nemesis (docs/12 P10 #1 play-testing): /nemesis [id] [rank] [cause] — a grudge from a pirate of these waters.
      const np = pirateById(args[0] ?? '') ?? namedPirates().find((x) => x.region === ship.region && !x.baron);
      if (!np) return 'No named pirates in these waters.';
      const cause = (NEMESIS_CAUSES as string[]).includes(args[2] ?? '') ? (args[2] as NemesisCause) : 'boarding';
      sanitizeNemeses(s.profile!)[np.id] = { rank: Math.max(1, Math.min(5, num(1, 2))), epithet: `${cause}:0`, scars: [cause], lost: 1, fled: 1, lastAt: game.wallNow(), letterAt: 0, huntAt: -1e9 };
      return `${np.name[0]} will remember you: a new nemesis.`;
    }
    case 'calf': {
      // The orca calf (docs/12 P10 #2 play-testing): /calf [level].
      const p = s.profile!;
      p.companion = null;
      giveCalf(game, s, 'orphan');
      p.companion!.level = Math.max(1, Math.min(10, num(0, 1)));
      sendCompanion(game, s);
      return `${p.companion!.name} grows: level ${p.companion!.level}.`;
    }
    case 'pet': {
      // A ship's pet (docs/12 P10 #3 play-testing): /pet cat|parrot|monkey|dog.
      const pet = (args[0] ?? '') as PetId;
      if (!PET_IDS.includes(pet)) return `Pets: ${PET_IDS.join(', ')}`;
      givePet(game, s, pet);
      petAction(game, s, 'deck', pet);
      return `${PETS[pet].name[0]} is on deck now.`;
    }
    case 'regatta': {
      // The Regatta of Equal Waters (docs/12 P10 #5 play-testing): /regatta [port] — a race off it in 30 s, signed up.
      const portId = args[0] ?? ship.docked ?? 'saltmarrow';
      if (!game.portById(portId)) return `No port or region "${portId}".`;
      regattaNow(game, portId, 30_000);
      if (ship.docked === portId) regattaSignUp(game, s);
      return `Regatta of Equal Waters: ${portId}.`;
    }
    case 'captive': {
      // Captive captains (docs/12 P10 #16 play-testing): /captive [n] — captains of pirates and merchants in irons.
      const n = Math.max(1, Math.min(3, Math.trunc(num(0, 2))));
      for (let i = 0; i < n; i++) {
        const role = i % 2 ? 'merchant' : 'pirate';
        const o = game.spawnNpcShip(role, 'brig', role === 'pirate' ? 'confederacy' : 'league', ship.state.x + 900, ship.state.y, 0);
        seizeCaptain(o);
        takeCaptive(game, s, o);
        game.removeShip(o.id);
      }
      game.pushSelf(s, true);
      return `Captives: ${p.captives.length}.`;
    }
    case 'rep': {
      // Standing with a flag (docs/12 P10 #15 play-testing): /rep faction n.
      const f = args[0] as FactionId;
      if (!FACTION_IDS.includes(f)) return `Factions: ${FACTION_IDS.join(', ')}`;
      p.reputation[f] = Math.max(-100, Math.min(100, num(1, 50)));
      game.pushSelf(s, true);
      return `Standing with ${f}: ${p.reputation[f]}.`;
    }
    case 'storm': {
      // Storm chasers (docs/12 P10 #14 play-testing): /storm — the Storm of the Century over her sea, set down by its
      // heart; /storm hearts N — hearts of the storm in hand.
      if (args[0] === 'hearts') {
        p.stormHearts = Math.max(0, Math.trunc(num(1, 2)));
        game.pushSelf(s, true);
        return `Hearts of the storm: ${p.stormHearts}.`;
      }
      const region = ship.region;
      let e = game.worldEvents.active(game).find((x) => x.kind === 'storm_century' && x.stage === 'storm' && x.region === region);
      if (!e) {
        const [x, y] = REGIONS[region].center;
        e = startEvent(game, { kind: 'storm_century', region, x, y, ends: game.wallNow() + 3 * 3600_000, title: `The Storm of the Century over ${REGIONS[region].name}`, stage: 'storm' },
          `The Storm of the Century is breaking over ${REGIONS[region].name}. Make for harbour — or for the wrecks after.`) ?? undefined;
      }
      if (!e) return 'Too much is happening on this sea already.';
      const h = heartAt(game, e);
      ship.docked = null;
      ship.state.x = h.x + 700;
      ship.state.y = h.y;
      ship.state.speed = 0;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      return 'The heart of the storm is near.';
    }
    case 'wonder': {
      // The Atlas of Sea Wonders (docs/12 P10 #8 play-testing): /wonder — set down beside the nearest one not yet found.
      const found = new Set(s.profile!.wonders ?? []);
      const w = wondersOf(game).filter((x) => !found.has(x.id)).sort((a, b) => Math.hypot(a.x - ship.state.x, a.y - ship.state.y) - Math.hypot(b.x - ship.state.x, b.y - ship.state.y))[0];
      if (!w) return 'No wonders left.';
      ship.docked = null;
      ship.state.x = w.x + 300;
      ship.state.y = w.y;
      ship.state.speed = 0;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      return `Set down at ${w.name[0]}.`;
    }
    case 'dutchman': {
      // The Flying Dutchman (docs/12 P10 #10 play-testing): /dutchman — all five pages, set down by his island.
      const p = s.profile!;
      const plan = weekPlan(game);
      p.dutchman = { week: plan.week, pages: [0, 1, 2, 3, 4] };
      ship.docked = null;
      ship.state.x = plan.battle.x + 900;
      ship.state.y = plan.battle.y;
      ship.state.speed = 0;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      sendDutchman(game, s, true);
      return 'The Flying Dutchman';
    }
    case 'choice': {
      // A chain's reward (docs/12 P9): /choice offers three pieces.
      offerChoice(game, s, QUESTS_BY_ID.side_clerk_2);
      return 'Three pieces to choose from.';
    }
    case 'named': {
      // A named pirate put to sea near you (docs/12 P5): /named [id] — or the list of your sea's.
      const id = args[0] ?? '';
      const np = pirateById(id);
      if (!np) return namedPirates().filter((x) => x.region === ship.region).map((x) => `${x.id} ${x.name[0]} ⚓${x.level}`).join(' · ') || 'No named pirates in these waters.';
      const got = putToSea(game, np, ship);
      return got ? `${np.name[0]} puts to sea ${Math.round(Math.hypot(got.state.x - ship.state.x, got.state.y - ship.state.y))} m off.` : 'No open water for her here.';
    }
    case 'hunter': {
      // The Hunters' Guild: /hunter <points> (and three captains of this sea sunk, for its baron).
      const p = s.profile!;
      sanitizeHunter(p);
      p.hunter!.points = num(0, 0);
      p.hunter!.seas[ship.region] = Math.max(p.hunter!.seas[ship.region] ?? 0, 3);
      return `Hunter's points ${p.hunter!.points}, rank ${hunterRank(p.hunter!.points)}.`;
    }
    case 'beast': {
      // A beast of the sea by the ship (docs/12 P4): /beast <kind> [level] [n].
      const id = (args[0] ?? '') as BeastId;
      if (!BEASTS[id]) return `Beasts: ${Object.keys(BEASTS).join(', ')}`;
      const lv = args[1] ? num(1) : BEASTS[id].level[0];
      const h = headingVec(ship.state.heading);
      const x = ship.state.x + h.x * 450, y = ship.state.y + h.y * 450;
      const g = id === 'white_orca' ? [spawnWhiteOrca(game, x, y)] : spawnGroup(game, id, x, y, lv, args[2] ? num(2) : undefined);
      return `${g.length} × ${id} ⚓${lv} 450 m ahead.`;
    }
    case 'happen': {
      // One of the sea's shorter events now (docs/12 P2): /happen silver_convoy|brethren|star|eclipse|festival|herring_run|red_tide.
      const kind = args[0] ?? '';
      const kinds = ['silver_convoy', 'brethren', 'star', 'eclipse', 'festival', 'herring_run', 'red_tide', 'orca_migration', 'white_orca'];
      if (!kinds.includes(kind)) return `Kinds: ${kinds.join(', ')}`;
      game.worldEvents.data(game).next[kind] = 0;
      return `${kind}: due within ten seconds${kind === 'star' ? ' (by night)' : ''}.`;
    }
    case 'enc': {
      // An encounter at once (docs/12 P2): /enc [id]; its sign a mile off, or aboard.
      const id = args[0] as EncounterId;
      if (!ENCOUNTERS[id]) return `Encounters: ${Object.keys(ENCOUNTERS).join(', ')}`;
      const live = startEncounter(game, s, id);
      return live ? `${id}: ${Math.round(Math.hypot(live.x - ship.state.x, live.y - ship.state.y))} m off.` : 'No open water for it here.';
    }
    case 'item': {
      // An item into the locker: /item [base] [level] [rarity 0-4] — or /item random [level] [n].
      const p = s.profile!;
      const lv = args[1] ? num(1) : ship.shipLevel;
      if (args[0] === 'random' || !args[0]) {
        const n = Math.min(20, args[2] ? num(2) : 8);
        for (let i = 0; i < n; i++) p.stash.push(makeItem(game.rng, p.itemSeq++, { ilvl: lv, source: 'elite' }));
      } else {
        if (!ITEM_BASES[args[0]]) return `Bases: ${Object.keys(ITEM_BASES).join(', ')}`;
        p.stash.push(makeItem(game.rng, p.itemSeq++, { base: args[0], ilvl: lv, rarity: (args[2] ? Math.max(0, Math.min(4, num(2))) : 2) as 0 }));
      }
      game.pushSelf(s, true);
      return `The locker holds ${p.stash.length}.`;
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
      if (args[3]) game.setNpcLevel(o, num(3)); // /spawn role class faction level (canon D12)
      if (role === 'merchant') o.cargo = { spices: 20, rum: 15, sugar: 20 };
      // Awake at once (a dormant ship is neither simulated nor sent until the sea wakes it).
      const brain = game.npcs.get(o.id);
      if (brain) brain.active = true;
      game.grid.upsert(o.id, o.state.x, o.state.y);
      return `${o.name} (${SHIP_CLASSES[cls].name} ⚓${o.shipLevel}, ${faction}) lies off your beam.`;
    }
    case 'board': {
      // A deck fight at once: a crippled ship lashed alongside (/board [role] [class] [crew]).
      if (ship.docked) return 'Put to sea first.';
      const role = (args[0] ?? 'pirate') as 'pirate';
      const cls = (args[1] ?? 'brig') as ShipClassId;
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      const v = headingVec(ship.state.heading + Math.PI / 2);
      const o = game.spawnNpcShip(role, cls, role === 'pirate' ? 'free' : 'league', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
      const brain = game.npcs.get(o.id);
      if (brain) brain.active = true;
      o.input = { rudder: 0, sailTarget: 0 };
      o.state.speed = ship.state.speed = 0;
      o.hull = o.stats.hullMax * 0.4;
      o.crew = Math.max(4, Math.round(num(2, ship.crew * 0.8)));
      o.morale = 80;
      game.grid.upsert(o.id, o.state.x, o.state.y);
      startBoarding(game, ship, o, 'standard');
      return `Grappled: ${o.name}.`;
    }
    case 'fireship':
      // A burning hull steered at you from 1.5 km.
      if (ship.docked) return 'Put to sea first.';
      return spawnFireship(game, ship) ? 'A fireship is coming.' : 'No open water for her.';
    case 'mast':
      // Your mast by the board: the wreckage alongside, to keep or cut away.
      if (ship.docked) return 'Put to sea first.';
      ship.addEffect({ id: 'broken_mast', until: game.now + 1e9, mods: { maxSpeed: -0.3 } }, game.now);
      mastWreck(game, ship);
      game.pushSelf(s, true);
      return 'Dismasted.';
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
      ship.morale = Math.max(ship.morale, 80);
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
