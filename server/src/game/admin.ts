import { islesAdmin } from './isles.ts';
import { isle18Admin } from './isles18.ts';
import { heroAdmin } from './hero.ts';
import { pathAdmin } from './pathbook.ts';
import { startMinigame } from './minigames.ts';
import { MINIGAMES, MINIGAME_IDS } from '../../../shared/src/data/minigames.ts';
import type { MinigameId } from '../../../shared/src/data/minigames.ts';
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
import { capOf, grantSpeedups, plotCount, yardOf } from './base.ts';
import { lfgPost } from './party.ts';
import { worldGoalsAdd } from './worldgoals.ts';
import { gyardFill, gyardStart } from './guildyard.ts';
import { sendSignal } from './signals.ts';
import { foundGuild } from './guilds.ts';
import { LFG_GOALS, SIGNALS } from '../../../shared/src/data/social.ts';
import type { LfgGoal, SignalKind } from '../../../shared/src/data/social.ts';
import { claimOf, isleWorth, raidNow, startIsleRaid, stepIsleClaim } from './baseclaim.ts';
import { fatMark } from '../../../shared/src/data/baseclaim.ts';
import { OWN_NAMES, OWN_ROLES, OWN_SHIPS_MAX, SHIPYARD_MAX, YARD_SHIP_LEVEL, hullFor, ownXpNext, roleLevels, yardLevelFor } from '../../../shared/src/data/baseships.ts';
import type { OwnRole } from '../../../shared/src/data/baseships.ts';
import { escortsOf } from './fleet.ts';
import { BASE_RES } from '../../../shared/src/data/base.ts';
import { BUY_REGIONS, ISLE_MAX } from '../../../shared/src/data/estate.ts';
import { hunterRank, namedPirates, pirateById } from '../../../shared/src/data/pirates.ts';
import { putToSea, sanitizeHunter } from './wanted.ts';
import { BEASTS } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { spawnGroup, spawnWhiteOrca } from './beasts.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import type { FishId } from '../../../shared/src/data/fishing.ts';
import { shoalHere, startFight } from './fishing.ts';
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
import { isLand, islandsNear } from '../../../shared/src/world/worldgen.ts';
import { summon } from './bosses.ts';
import { boardingRangeBetween, canBoard, startBoarding } from './boarding.ts';
import { UNITS, UNIT_IDS, armyForLevel, armyMen, armyWord } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { mastWreck } from './combat.ts';
import { spawnFireship } from './npc.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { FACTION_IDS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { seizeCaptain, takeCaptive } from './prizes.ts';
import { gateOf } from './descent.ts';
import { HOLIDAYS } from '../../../shared/src/data/holidays.ts';
import type { HolidayId } from '../../../shared/src/data/holidays.ts';
import { sagaNote } from './saga.ts';
import { logNote } from './captainlog.ts';
import { officerSays, resetTalk } from './crewlife.ts';
import { TALK_EVENTS } from '../../../shared/src/data/crewtalk.ts';
import type { TalkEvent } from '../../../shared/src/data/crewtalk.ts';
import { OFFICER_ROLES, PROFESSIONS, UNIQUE_OFFICERS } from '../../../shared/src/data/crew.ts';
import type { OfficerRole, Profession } from '../../../shared/src/data/crew.ts';
import { struck } from './struck.ts';
import { lotsOf } from './auction.ts';
import { endPod, podJoins } from './omenpod.ts';
import type { PodKind } from '../../../shared/src/protocol.ts';
import { convoysAt, learnConvoy, sailConvoy } from './raiding.ts';
import { lairAdmin, lairsAll } from './wanted.ts';
import { pointAlong } from './nav.ts';
import { deliver } from './post.ts';
import { awayMark, awayReturn, chronicle, closeWeek, rn, sendRenown, weeklyAdd } from './renown.ts';
import { weekNumber, weeklyChallenges } from '../../../shared/src/data/renown.ts';
import { FISH_IDS } from '../../../shared/src/data/fishing.ts';
import { adminWeek } from './calendar.ts';
import { adminDwell } from './dwell.ts';
import { adminMine, offIsland } from './mines.ts';
import { adminTown } from './town.ts';
import { adminGuard, adminObj } from './advmap.ts';
import { adminBeast, adminEgg, adminLair, adminLandRes } from './beastlairs.ts';
import { adminLandEcon } from './landecon.ts';
import { throneAdmin } from './throne.ts'; // docs/19 E1–E3
import { CREATURE_IDS, isCreature } from '../../../shared/src/data/bestiary.ts';
import { adminDrift } from './drifts.ts';
import { adminSeaMark } from './seamarks.ts';
import { adminFeed, adminTame, adminTamer } from './tame.ts';
import { LAIR_KINDS } from '../../../shared/src/data/lairs.ts';
import type { LairKind } from '../../../shared/src/data/lairs.ts';
import { adminGrail, adminObelisk } from './grail.ts';
import { RES_GOODS } from '../../../shared/src/data/mines.ts';
import { OMEN_IDS } from '../../../shared/src/data/omens.ts';

export function adminEnabled(): boolean {
  return process.env.GRAVETIDE_ADMIN === '1';
}

const WEATHERS: WeatherKind[] = ['calm', 'breeze', 'wind', 'fog', 'rain', 'storm', 'black_storm'];

const HELP = '/speed N · /xp N · /level N · /silver N · /tp port|region|x y · /boss id · /saga · /holiday id|off · /descent · /captive [n] · /rep faction n · /storm [hearts N] · /weather kind [region] · /time hour · /god · /ship class · /heal · /ammo · /give good n · /reveal · /sink · /spawn role class faction · /board [role] [class] [crew] · /fireship · /mast · /strike [role] [class] · /war [patrol] · /streak N · /heading deg|wind · /isle [level] · /yard [n] · /oship role [level] · /raid [land|tax|calm] · /hurt N · /auction end|room · /say event [role|unique] · /morale N · /wounded N · /practice trade|all N · /logconvoy [region|know] · /lair [close|wake|silence|sink|rebuild] · /pod [dolphins|humpback|orcas] · /front [black] · /streak N · /heading deg|wind · /isle [level] · /yard [n] · /oship role [level] · /raid [land|tax|calm] · /convoy [region|know] · /log · /career crown|league|confederacy N · /feats · /album · /week [close|next|now|kind] · /away H · /tide [up|down|off|here] · /light [dark] · /lookout · /trek · /lfg goal [lo hi] · /near name · /wgoal [n|near|done] · /gyard [found|fill|done] · /signal kind · /army [unit n|level L|clear] · /foe [role] [class] [m] · /board (alongside: grapple her) · /dwell [fill] · /mine [take|lose|free|pay|go] · /res [n] · /town [level|go] · /away Htide [up|down|off|here] · /light [dark] · /lookout · /trek · /lfg goal [lo hi] · /near name · /wgoal [n|near|done] · /gyard [found|fill|done] · /signal kind · /army [unit n|level L|clear] · /foe [role] [class] [m] · /board (alongside: grapple her) · /prim [atk|def|pow|will N|reset] · /skill id [0-3]|offer [n]|clear · /order id|all|clear · /art [id|set regalia|hook|storm|list] · /will [N|full] · /guard [go|beat|weak|board|reset] [kind] [level] · /obj [kind] [go|reset] · /obelisk [n|all|go] · /grail [go|found|reset] · /isle level|type kind|atoll|ridge|small|hidden [reveal]|danger [deadly] · /zone [go] · /turtle [go|up|down|off] · /sandbar · /supply [claim|link|week] · /path [learn page|forget] · /stam [N|full] · /scroll [page|random|clear] [n] · /pathfoe [path] [class] [grapple] · /lair [kind] [go|fight|beat|weak|reset|chain|grotto|guardian|dwell|turtle|sandbar] · /creature [kind] [n] · /egg [kind|hatch|grow] · /landres [n] · /drift [kind|legend|whale|kraken] [go|save|fail|fight|clear] · /tame [kind] [wins N|rank R|hunger S|pen N|slip] · /feed [N|starve] · /tamer [go] · /landecon [fit id rank|cap] · /bestiary [all|clear|kind] · /seamark [drift|wreck|buoy|lantern|bones|floe] [go|done|reset] · /glory [n|xp N|reset] · /mastery [node|branch|all|reset] · /trial [skill] [go|win|lose|reset]';

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
    // The captain as a hero (docs/17 H2).
    case 'prim':
    case 'skill':
    case 'order':
    case 'art':
    case 'will':
      return heroAdmin(game, s, cmd.toLowerCase(), args);
    // The hero's path in the boarding battle (docs/18 I).
    case 'path':
    case 'stam':
    case 'scroll':
    case 'pathfoe':
      return pathAdmin(game, s, cmd.toLowerCase(), args);
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
    case 'shoal': {
      // A shoal right under her keel (docs/12 P3 play-testing): /shoal [fish].
      const fish = (args[0] ?? 'herring') as FishId;
      if (!FISH[fish]) return `Fish: ${Object.keys(FISH).join(', ')}`;
      shoalHere(game, ship.state.x, ship.state.y, fish);
      return `A shoal of ${FISH[fish].name[0]} rises under her keel.`;
    }
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
    case 'zone':
    case 'turtle':
    case 'sandbar':
    case 'supply':
      // docs/18 III: the zones of one level, the turtle islands, the sandbars, the supply routes.
      return isle18Admin(game, s, cmd.toLowerCase(), args);
    case 'isle': {
      // docs/18 III: an island's level and kind, the islands of step 6, the hidden, the dangerous.
      if (['level', 'type', 'atoll', 'ridge', 'small', 'hidden', 'danger'].includes(args[0])) return isle18Admin(game, s, 'isle', args);
      // An island of one's own for play-testing the base (docs/15): /isle [level] — the nearest wild island of a
      // safe or contested sea is given outright, or one's own raised to that level.
      let h = ownIsland(game, s.accountId);
      if (!h) {
        const wild = game.world.islands.filter((i) => !i.portId && BUY_REGIONS.includes(i.region) && i.radius > 150 && !game.holdings.get(game, i.id));
        const best = wild.sort((a, b) => Math.hypot(a.x - ship.state.x, a.y - ship.state.y) - Math.hypot(b.x - ship.state.x, b.y - ship.state.y))[0];
        if (!best) return 'No wild island to give.';
        const now = game.wallNow();
        h = {
          island: best.id, owner: { kind: 'player', id: s.accountId, name: s.name }, since: now, until: 4_102_444_800_000, lastDays: 30, autoRenew: false,
          treasury: 0, store: {}, buildings: [], lastUpkeep: now, lastWork: now, toll: { day: 0, paid: 0 }, warned: false,
          window: 19, windowNext: null, shieldUntil: 4_102_444_800_000, lastSiege: 0, owned: true, level: 1, residents: [],
        };
        game.holdings.map(game)[best.id] = h;
      }
      if (args[0] !== undefined) h.level = Math.max(1, Math.min(ISLE_MAX, Math.round(num(0, 1))));
      game.holdings.touch();
      game.pushSelf(s, true);
      return `Your island: ${game.world.islands[h.island].name}, level ${h.level ?? 1}.`;
    }
    case 'yard': {
      // The island's yard filled for play-testing (docs/15): /yard [n] — n of every resource, and ten speed-ups;
      // /yard hours [n] — the producers have worked n hours more.
      const h = ownIsland(game, s.accountId);
      if (!h) return 'You have no island of your own.';
      const y = yardOf(game, h);
      if (args[0] === 'hours') {
        // /yard hours [n]: the producers' clock set back n hours (the yield of a morning away, to collect).
        const hrs = Math.max(0, Math.min(72, Number(args[1] ?? 3) || 0));
        y.lastYield -= hrs * 3_600_000;
        game.holdings.touch();
        return `The island's producers have worked ${hrs} hours more.`;
      }
      const n = Math.max(0, Math.round(num(0, 200)));
      for (const g of BASE_RES) y.res[g] = Math.min(capOf(h), (y.res[g] ?? 0) + n);
      grantSpeedups(p, 10);
      game.holdings.touch();
      return `The yard holds ${n} more of each.`;
    }
    case 'raid': {
      // Raids on one's own island for play-testing (docs/15 item 7): /raid — pirates make for it now (the yard filled
      // fat first if it is lean); /raid land — their ten minutes run out now; /raid tax — the week's tax falls due now;
      // /raid calm — no raid under way, no cooldown, nothing lost today.
      const h = ownIsland(game, s.accountId);
      if (!h) return 'You have no island of your own.';
      const c = claimOf(game, h);
      if (args[0] === 'land') {
        if (!c.raid) return 'No raiders lie off the island.';
        raidNow(game, h);
        stepIsleClaim(game, h);
        return 'The raiders land.';
      }
      if (args[0] === 'tax') {
        c.taxAt = game.wallNow();
        stepIsleClaim(game, h);
        return `Tax reckoned; weeks unpaid: ${c.unpaid}.`;
      }
      if (args[0] === 'calm') {
        if (c.raid) for (const id of c.raid.ships) if (game.ships.get(id)) game.removeShip(id);
        c.raid = null;
        c.calmUntil = 0;
        c.lossShare = 0;
        game.holdings.touch();
        game.pushSelf(s, true);
        return 'The island is calm.';
      }
      const y = yardOf(game, h);
      for (let k = 0; k < 40 && isleWorth(h) < fatMark(h.level ?? 1); k++) for (const g of BASE_RES) y.res[g] = Math.min(capOf(h), (y.res[g] ?? 0) + 20);
      const why = startIsleRaid(game, h);
      game.holdings.touch();
      return why ?? `Raiders make for your island: ${c.raid?.ships.length ?? 0} ships.`;
    }
    case 'oship': {
      // The island's own ships for play-testing (docs/15 item 4): /oship <war|merchant|fisher|scout> [level] — one
      // built at once (a shipyard raised for her if need be); /oship xp — all of them seasoned; /oship sink — the
      // first at sea sent down (to be laid up).
      const h = ownIsland(game, s.accountId);
      if (!h) return 'You have no island of your own.';
      const y = yardOf(game, h);
      const ships = y.ships ?? [];
      if (args[0] === 'xp') {
        for (const x of ships) x.xp = ownXpNext(x.level);
        game.holdings.touch();
        return `Seasoned: ${ships.length}.`;
      }
      if (args[0] === 'sink') {
        const ent = escortsOf(game, ship).find((e) => p.fleet.escorts.some((f) => f.id === e.fleetId && f.own));
        if (!ent) return 'None of your own ships is at sea.';
        ent.hull = 0;
        game.beginSinking(ent);
        return `${ent.name} is going down.`;
      }
      const role = (args[0] ?? 'war') as OwnRole;
      if (!OWN_ROLES.includes(role)) return `Roles: ${OWN_ROLES.join(', ')}.`;
      if (ships.length >= OWN_SHIPS_MAX) return `The island keeps ${OWN_SHIPS_MAX} ships of its own.`;
      const level = Math.max(1, Math.min(YARD_SHIP_LEVEL[SHIPYARD_MAX], Math.round(num(1, 1))));
      const lvl = roleLevels(role).filter((l) => l <= level).pop() ?? 1;
      let yard = h.buildings.find((b) => b.id === 'shipyard');
      if (!yard) {
        yard = { id: 'shipyard', condition: 1, unpaid: false, level: 1 };
        h.buildings.push(yard);
      }
      yard.level = Math.max(yard.level ?? 1, yardLevelFor(lvl));
      const used = new Set(ships.map((x) => x.name));
      let name = h.island % OWN_NAMES.length;
      while (used.has(name) && used.size < OWN_NAMES.length) name = (name + 1) % OWN_NAMES.length;
      ships.push({ id: `o${h.island}_${y.seq++}`, role, classId: hullFor(role, lvl), level: lvl, xp: 0, name, hull: 1, state: 'home' });
      y.ships = ships;
      yardOf(game, h); // the shipyard takes a plot
      game.holdings.touch();
      return `${OWN_NAMES[name][0]} lies at your island: level ${lvl}.`;
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
    case 'saga': {
      // A captain's saga (docs/12 P10 #20 play-testing): /saga — four chapters of the kinds the sea writes.
      const near = game.nearestIslandName(ship.state.x, ship.state.y);
      sagaNote(game, s, 'beast', ['Sperm Whale', near]);
      sagaNote(game, s, 'storm_heart', [REGIONS[ship.region].name]);
      sagaNote(game, s, 'descent', [], 6);
      sagaNote(game, s, 'sunk', [p.loadout.name, near]);
      return `Saga: ${(p.saga ?? []).length}.`;
    }
    case 'holiday': {
      // The sea's holidays (docs/12 P10 #18 play-testing): /holiday drowned_night|herring_run|powder_night|league_day|off.
      const id = args[0] as HolidayId;
      if (args[0] === 'off') {
        game.db.setKv('holiday_force', { id: 'league_day', until: 0 });
        return 'Holiday: off.';
      }
      if (!HOLIDAYS[id]) return `Holidays: ${Object.keys(HOLIDAYS).join(', ')}`;
      game.db.setKv('holiday_force', { id, until: game.wallNow() + 2 * 3600_000 });
      return `Holiday: ${HOLIDAYS[id].name[0]}.`;
    }
    case 'descent': {
      // The Descent (docs/12 P10 #17 play-testing): /descent — set down by the week's Maelstrom Stair.
      const g = gateOf(game);
      ship.docked = null;
      ship.state.x = g.x + 300;
      ship.state.y = g.y;
      ship.state.speed = 0;
      ship.region = g.region;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      return 'The Maelstrom Stair';
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
    case 'minigame': {
      // A game of the islands (minigames.ts) at once, for QA: /minigame [id].
      const id = args[0] as MinigameId | undefined;
      if (id && !MINIGAMES[id]) return `Games: ${MINIGAME_IDS.join(', ')}`;
      return startMinigame(game, s, { sea: true, ...(id ? { def: id } : {}) }) ? 'A game begins.' : 'No game now.';
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
    case 'war': {
      // The sea's own wars in sight (docs/16 P1): /war — a rover falls on a merchant off your bow; /war patrol — and
      // the law comes for the rover.
      const [mx, my] = openSpot(game, ship, [380, 500, 650], 150, 0.35);
      const m = game.spawnNpcShip('merchant', 'fluyt', 'league', mx, my, ship.state.heading + Math.PI / 2);
      m.cargo = { spices: 20, rum: 15, sugar: 20 };
      const [px, py] = openSpot(game, ship, [620, 800, 950], 150, 0.8);
      const pr = game.spawnNpcShip('pirate', 'schooner', 'confederacy', px, py, ship.state.heading);
      game.setNpcLevel(m, 4);
      game.setNpcLevel(pr, 4);
      for (const o of [m, pr]) {
        const b = game.npcs.get(o.id);
        if (b) {
          b.active = true;
          b.area = { x: o.state.x, y: o.state.y, r: 2000 };
        }
        o.region = game.regionAt(o.state.x, o.state.y);
        game.grid.upsert(o.id, o.state.x, o.state.y);
      }
      game.npcs.get(pr.id)!.chase = { id: m.id, until: game.now + 300 };
      if (args[0] === 'patrol') {
        const [qx, qy] = openSpot(game, ship, [600, 800], 150, -0.5);
        const pa = game.spawnNpcShip('patrol', 'brig', 'crown', qx, qy, ship.state.heading);
        game.setNpcLevel(pa, 5);
        const b = game.npcs.get(pa.id);
        if (b) {
          b.active = true;
          b.chase = { id: pr.id, until: game.now + 300 };
          b.area = { x: qx, y: qy, r: 2000 };
        }
        pa.region = game.regionAt(qx, qy);
        game.grid.upsert(pa.id, qx, qy);
      }
      return `${pr.name} falls on ${m.name} off your bow.`;
    }
    case 'pod': {
      // A good omen alongside (docs/16 #9): /pod [dolphins|humpback|orcas].
      const kind = (['dolphins', 'humpback', 'orcas'].includes(args[0]) ? args[0] : 'dolphins') as PodKind;
      if (ship.docked) return 'Put to sea first.';
      ship.lastCombat = -1e9;
      endPod(game, s);
      return podJoins(game, s, kind) ? 'They come alongside.' : 'They will not come now.';
    }
    case 'convoy': {
      // A League convoy off your beam (docs/16 #6): /convoy [region] — sailed from a port of the sea, run a few miles
      // down its route, and you by its lead ship; /convoy know — every convoy at sea on your chart.
      if (args[0] === 'know') {
        for (const c of convoysAt(game)) learnConvoy(game, s.accountId, c.id);
        return `${convoysAt(game).length} convoys on your chart.`;
      }
      const region = (args[0] as RegionId) ?? ship.region;
      const c = sailConvoy(game, REGIONS[region] && REGIONS[region].safety !== 'safe' ? region : 'gravewater');
      if (!c) return 'No convoy could sail from that sea.';
      const lead = game.npcs.get(c.members[0]);
      if (!lead?.path) return 'No route.';
      const at = Math.min(lead.length * 0.5, 6000);
      for (const id of [...c.members, ...c.escorts]) {
        const b = game.npcs.get(id);
        const o = game.ships.get(id);
        if (!b || !o || !b.path) continue;
        b.traveled += at;
        const p = pointAlong(b.path, b.traveled);
        o.state.x = p.x;
        o.state.y = p.y;
        o.state.heading = p.heading;
      }
      const p = pointAlong(lead.path, lead.traveled);
      const side = headingVec(p.heading + Math.PI / 2);
      ship.state = { ...ship.state, x: p.x + side.x * 320, y: p.y + side.y * 320, heading: p.heading, speed: 0 };
      ship.region = game.regionAt(ship.state.x, ship.state.y);
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      game.pushSelf(s, true);
      return `A convoy of ${c.members.length} with ${c.escorts.length} escorts off your beam.`;
    }
    case 'seamark':
      // The dense sea's marks: hove to by one (of a kind), its work done at once, every mark hers again.
      return adminSeaMark(game, s, args);
    case 'drift':
      // docs/18 IV: drifting creatures — one off her bow, saved or lost at once, fought; the season's legend.
      return adminDrift(game, s, args);
    case 'tame':
      // docs/18 #37–#41: a creature kind's wins, rank and hunger; some into the pen.
      return adminTame(game, s, args);
    case 'feed':
      // docs/18 #37: fish and rum into the hold, or every creature starving.
      return adminFeed(game, s, args);
    case 'tamer':
      // docs/18 #42: the nearest port with a tamer (go: into it).
      return adminTamer(game, s, args);
    case 'creature':
      // docs/18 II: creatures of a kind into her army.
      return adminBeast(game, s, args);
    case 'egg':
      // docs/18 #20: an egg in hand; the pen's eggs hatched or its young grown at once.
      return adminEgg(game, s, args);
    case 'landres':
      // docs/18 #17: the land's resources into her store.
      return adminLandRes(game, s, args);
    case 'landecon':
      // docs/18 #43: her store and fittings; a fitting at a rank; the store full.
      return adminLandEcon(game, s, args);
    case 'bestiary': {
      // docs/18 #46: the bestiary's pages written (all, or a kind), or torn out.
      const r = rn(s.profile!);
      if (args[0] === 'clear') r.met = [];
      else if (args[0] === 'all') r.met = [...CREATURE_IDS];
      else if (args[0] && isCreature(args[0])) r.met = [...new Set([...(r.met ?? []), args[0]])];
      sendRenown(game, s, true);
      return `The bestiary: ${(r.met ?? []).length} of ${CREATURE_IDS.length} pages written.`;
    }
    case 'den':
      return adminLair(game, s, args);
    case 'lair': {
      // docs/18 II: the lairs of the land's creatures — a kind of lair or one of their orders.
      if (args.length && args.every((a) => LAIR_KINDS.includes(a as LairKind) || ['go', 'fight', 'beat', 'weak', 'reset', 'chain', 'dwell', 'info', 'grotto', 'guardian', 'turtle', 'sandbar'].includes(a))) return adminLair(game, s, args);
      // A pirate lair (docs/16 #7): /lair [close] — to the nearest, off its guns (close: within the boats' reach);
      // /lair wake|silence|sink|rebuild.
      const all = lairsAll(game);
      if (!all.length) return 'No lairs.';
      // The lair last gone to keeps being the one meant (two lairs may lie a mile apart).
      const picked = args[0] ? all.find((l) => l.id === lairPick.get(s)) : undefined;
      const near = picked ?? all.reduce((a, b) => (Math.hypot(b.x - ship.state.x, b.y - ship.state.y) < Math.hypot(a.x - ship.state.x, a.y - ship.state.y) ? b : a));
      lairPick.set(s, near.id);
      if (args[0] === 'silence' || args[0] === 'sink' || args[0] === 'rebuild' || args[0] === 'wake') {
        lairAdmin(game, near.id, args[0]);
        return `The lair on ${near.name}: ${args[0]}.`;
      }
      const island = game.world.islands[near.island];
      const [gx, gy] = near.guns[1] ?? [near.x, near.y];
      const ax = gx - (island?.x ?? near.x), ay = gy - (island?.y ?? near.y), al = Math.hypot(ax, ay) || 1;
      let x = gx, y = gy;
      const close = args[0] === 'close';
      for (let d = close ? 60 : 330; d < 1200; d += 20) {
        x = gx + (ax / al) * d;
        y = gy + (ay / al) * d;
        if (isLand(game.world, x, y)) continue;
        if (!close || (island && Math.sqrt(closestOnPolygon(x, y, island.poly).d2) > 150)) break;
      }
      if (ship.docked) return 'Put to sea first.';
      ship.state = { ...ship.state, x, y, heading: Math.atan2(-ay, ax) + Math.PI / 2, speed: 0 };
      ship.region = game.regionAt(x, y);
      game.grid.upsert(ship.id, x, y);
      game.pushSelf(s, true);
      return `Off the lair of ${near.captain} on ${near.name} (⚓${near.level}).`;
    }
    case 'tide':
    case 'light':
    case 'lookout':
    case 'trek':
      // Batch E of docs/16: /tide [up|down|off|here] the nearest bank, /light [dark] a keeper's lighthouse, /lookout,
      // /trek an island to walk across — set before her.
      return islesAdmin(game, s, cmd.toLowerCase(), args);
    case 'front': {
      // A storm front bearing down on your course (docs/16 #10): /front [black] — 9 km ahead, drifting at you.
      const v = headingVec(ship.state.heading);
      const side = headingVec(ship.state.heading + Math.PI / 2);
      const x = ship.state.x + v.x * 9000 + side.x * 1500, y = ship.state.y + v.y * 9000 + side.y * 1500;
      game.fronts.push({ id: 900000 + game.rng.int(0, 99999), kind: args[0] === 'black' ? 'black_storm' : 'storm', x, y, vx: -v.x * 6, vy: -v.y * 6, radius: 4500, until: game.now + 1800 });
      return 'A storm front makes for your course.';
    }
    case 'strike': {
      // A battered ship off your beam strikes her colours to you (docs/16 #3): /strike [role] [class].
      if (ship.docked) return 'Put to sea first.';
      const role = (['pirate', 'patrol', 'hunter', 'merchant'].includes(args[0]) ? args[0] : 'pirate') as 'pirate' | 'patrol' | 'hunter' | 'merchant';
      const cls = (args[1] ?? 'brig') as ShipClassId;
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      const [x, y] = openSpot(game, ship, [260, 330, 400], 150, Math.PI / 2);
      const o = game.spawnNpcShip(role, cls, role === 'pirate' ? 'confederacy' : role === 'patrol' ? 'crown' : 'league', x, y, ship.state.heading);
      if (role === 'merchant') o.cargo = { spices: 20, rum: 15, sugar: 20 };
      const brain = game.npcs.get(o.id);
      if (!brain) return 'No ship.';
      brain.active = true;
      o.hull = o.stats.hullMax * 0.15;
      o.state.speed = 0;
      o.attackers.set(ship.id, game.now);
      o.lastCombat = ship.lastCombat = game.now;
      game.grid.upsert(o.id, o.state.x, o.state.y);
      struck(game, o, brain, ship);
      return `${o.name} strikes her colours to you.`;
    }
    case 'streak':
      // A win streak without making port (docs/16 #4): /streak N.
      p.streak = Math.max(0, Math.trunc(num(0, 3)));
      game.pushSelf(s, true);
      return `Streak: ${p.streak}.`;
    case 'heading': {
      // Her heading in degrees, or "wind": running before it, her broadsides square across it (docs/16 #1).
      const h = args[0] === 'wind' ? game.windFor(ship).dir : (num(0, 0) * Math.PI) / 180;
      ship.state = { ...ship.state, heading: h, speed: 0 };
      game.pushSelf(s, true);
      return `Heading ${Math.round((((h * 180) / Math.PI) % 360 + 360) % 360)}°.`;
    }
    case 'army': {
      // The ship's army (docs/17 H1): /army shows it; /army <unit> <n> sets a stack; /army level L spreads the crew
      // by the ladder of that level; /army clear makes them all deckhands.
      if (!args[0]) return `Army (${ship.crew}/${ship.stats.crewMax}, ${ship.army.length}/${ship.armySlots} stacks, ${armyWord(ship.crew)}): ${ship.army.map((x) => `${x.u} ×${x.n}`).join(', ') || 'none'}.`;
      if (args[0] === 'clear') {
        const n = ship.crew;
        ship.setArmy([{ u: 'deckhand', n }]);
      } else if (args[0] === 'level') {
        const lv = Math.max(1, Math.min(10, Math.round(num(1, ship.shipLevel))));
        ship.setArmy(armyForLevel(lv, ship.crew, ship.armySlots, 'player'));
      } else {
        const u = args[0] as UnitId;
        if (!UNITS[u]) return `Units: ${UNIT_IDS.join(', ')}`;
        const n = Math.max(0, Math.floor(num(1, 10)));
        const rest = ship.army.filter((x) => x.u !== u).map((x) => ({ ...x }));
        // Room in the hammocks: the deckhands make way first, then the smallest stacks.
        let over = armyMen(rest) + n - ship.stats.crewMax;
        for (const x of [...rest].sort((a, b) => UNITS[a.u].tier - UNITS[b.u].tier || a.n - b.n)) {
          if (over <= 0) break;
          const k = Math.min(x.n, over);
          x.n -= k;
          over -= k;
        }
        const kept = rest.filter((x) => x.n > 0);
        if (n > 0 && kept.length >= ship.armySlots) kept.sort((a, b) => UNITS[b.u].tier - UNITS[a.u].tier).pop();
        ship.setArmy([...kept, ...(n > 0 ? [{ u, n: Math.min(n, ship.stats.crewMax) }] : [])]);
      }
      game.pushSelf(s, true);
      return `Army set: ${ship.crew} men in ${ship.army.length} stacks.`;
    }
    case 'foe': {
      // A whole ship of the sea alongside, not grappled (/foe [role] [class] [metres]): to try the guns on her men, or
      // to grapple at once (docs/17 H1).
      if (ship.docked) return 'Put to sea first.';
      const role = (args[0] ?? 'pirate') as 'pirate';
      const cls = (args[1] ?? 'brig') as ShipClassId;
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      const d = Math.max(20, Math.min(900, num(2, 140)));
      const v = headingVec(ship.state.heading + Math.PI / 2);
      const o = game.spawnNpcShip(role, cls, role === 'pirate' ? 'free' : role === 'ghost' ? 'choir' : 'league', ship.state.x + v.x * d, ship.state.y + v.y * d, ship.state.heading);
      game.setNpcLevel(o, ship.shipLevel);
      const brain = game.npcs.get(o.id);
      if (brain) brain.active = true;
      o.input = { rudder: 0, sailTarget: 0 };
      o.state.speed = ship.state.speed = 0;
      game.grid.upsert(o.id, o.state.x, o.state.y);
      return `${o.name} lies ${Math.round(d)} m off your beam, ${o.crew} men in ${o.army.length} stacks.`;
    }
    case 'board': {
      // Alongside a ship already: grapple her at once, whole as she is (docs/17 H1).
      if (!args.length && !ship.docked) {
        let near: ShipEntity | null = null, nd = Infinity;
        for (const o of game.ships.values()) {
          if (o === ship || !o.alive || o.docked || o.npcRole === 'beast') continue;
          const dd = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
          if (dd < nd && dd <= boardingRangeBetween(ship, o) * 1.5) {
            nd = dd;
            near = o;
          }
        }
        if (near) {
          const why = canBoard(game, ship, near);
          if (why) return why;
          startBoarding(game, ship, near, 'standard');
          return `Grappled: ${near.name}.`;
        }
      }
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
    case 'hurt': {
      // Hull and sails down to N% (repairs at sea, docs/16 #15).
      const n = Math.max(1, Math.min(100, num(0, 50)));
      ship.hull = ship.stats.hullMax * n / 100;
      ship.sails = ship.stats.sailHpMax * Math.min(1, (n + 20) / 100);
      game.pushSelf(s, true);
      return `Hull at ${Math.round(n)}%.`;
    }
    case 'say': {
      // An officer's line on an event now (docs/16 #16); with no officer aboard, one is signed on for the trial.
      const ev = (args[0] ?? 'storm') as TalkEvent;
      if (!TALK_EVENTS.includes(ev)) return `Events: ${TALK_EVENTS.join(', ')}`;
      if (!p.company.officers.length) {
        const role = (OFFICER_ROLES.includes(args[1] as OfficerRole) ? args[1] : 'lieutenant') as OfficerRole;
        p.company.officers.push({ id: `o${game.allocId()}`, name: 'Silas Gault', role, level: 3, xp: 0, traits: ['lucky'], loyalty: 60, wound: null, hiredAt: game.now, orderReady: 0, ...(args[1] === 'unique' ? { unique: 'old_bones', name: UNIQUE_OFFICERS[0].name, role: UNIQUE_OFFICERS[0].role } : {}) });
      }
      officerSays(game, s, ev, args.slice(2).join(' ') || (ev === 'new_sea' ? REGIONS[ship.region].name : ev === 'boss' ? BOSSES.lantern_maw.name : ev === 'victory' || ev === 'merchant' ? 'Salt Lady' : undefined), true);
      return null;
    }
    case 'morale': {
      // Morale to N (docs/16 #17): under 30 the men grumble; at 80 and over, out of a fight, they sing.
      ship.morale = Math.max(0, Math.min(100, num(0, 90)));
      if (ship.morale >= 80) ship.lastCombat = Math.min(ship.lastCombat, game.now - 200);
      resetTalk(s);
      return `Morale at ${Math.round(ship.morale)}.`;
    }
    case 'wounded': {
      // N wounded below (docs/16 #19), out of the crew.
      const n = Math.max(0, Math.min(ship.crew - 1, Math.floor(num(0, 10))));
      ship.crew -= n;
      ship.wounded += n;
      p.company.wounded = ship.wounded;
      ship.lastCombat = Math.min(ship.lastCombat, game.now - 60);
      game.pushSelf(s, true);
      return `${ship.wounded} wounded below.`;
    }
    case 'practice': {
      // Practice points to a trade, or to all (docs/16 #18).
      const k = args[0] as Profession;
      const pts = num(1, 700);
      for (const t of PROFESSIONS) if (!k || k === t || args[0] === 'all') p.company.practice[t] = pts;
      ship.companyKey = '';
      game.pushSelf(s, true);
      return 'Practice set.';
    }
    case 'log': {
      // A day's worth of lines in the captain's log (docs/16 #20).
      const where = game.nearestIslandName(ship.state.x, ship.state.y);
      logNote(game, s, 'storm', [REGIONS[ship.region].name]);
      logNote(game, s, 'sank', ['Black Bess', where]);
      logNote(game, s, 'sank', ['Salt Lady', where]);
      logNote(game, s, 'prize', ['Gilded Heron', where]);
      logNote(game, s, 'crew_lost', [where, '4'], 3);
      logNote(game, s, 'boss_seen', [BOSSES.lantern_maw.name]);
      logNote(game, s, 'sea', [REGIONS[ship.region].name]);
      logNote(game, s, 'level', [], p.level);
      logNote(game, s, 'wounded_died', [], 2);
      game.pushSelf(s, true);
      return 'The log is written.';
    }
    case 'auction': {
      // The trophy auction (docs/16 #13): its lots here close in seconds, or the room bids at once.
      const here = ship.docked;
      const lots = lotsOf(game).filter((l) => !here || l.port === here);
      for (const l of lots) {
        if (args[0] === 'end') l.endsAt = game.wallNow() + 5000;
        else l.roomAt = game.wallNow();
      }
      return `${lots.length} lots stirred.`;
    }
    case 'career': {
      // Deed points for a flag's career (docs/16 #26); standing comes from /rep.
      const id = args[0] as 'crown' | 'league' | 'confederacy';
      if (id !== 'crown' && id !== 'league' && id !== 'confederacy') return 'Usage: /career crown|league|confederacy N';
      rn(p).deeds[id] = Math.max(0, num(1, 500));
      sendRenown(game, s, true);
      return `Career deeds set: ${rn(p).deeds[id]}.`;
    }
    case 'feats': {
      // Tallies for a few feats (docs/16 #29): 25 League ships, 30 pirates, the Kraken; the titles come within 5 s.
      const r = rn(p);
      r.kills.league = Math.max(r.kills.league ?? 0, 25);
      r.kills.pirate = Math.max(r.kills.pirate ?? 0, 30);
      p.bossKills.kraken = Math.max(p.bossKills.kraken ?? 0, 1);
      return 'Feats counted.';
    }
    case 'album': {
      // Most of the album filled in (docs/16 #28): all fish but one, most omens, two trophies, three beasts.
      p.fishing ??= { skill: 1, xp: 0, caught: {}, traps: [] };
      for (const f of FISH_IDS.slice(0, -2)) p.fishing.caught[f] ??= { n: 3, best: 2 };
      const r = rn(p);
      for (const o of OMEN_IDS.slice(0, 7)) if (!r.omens.includes(o)) r.omens.push(o);
      for (const t of ['Kraken Eye', 'Serpent Fang']) if (!p.trophies.includes(t)) p.trophies.push(t);
      p.beasts = { ...(p.beasts ?? {}), orca: 2, shark: 4, humpback: 1 };
      p.seaLetters = [...new Set([...(p.seaLetters ?? []), 0, 1, 2])];
      sendRenown(game, s, true);
      return 'The album is filled in.';
    }
    case 'lfg': {
      // Looking for company (docs/16 #31): /lfg goal [lo hi] — one's own posting, flown over the ship.
      const goal = (args[0] ?? 'hunt') as LfgGoal;
      if (!LFG_GOALS.includes(goal)) return `Usage: /lfg ${LFG_GOALS.join('|')} [lo hi]`;
      const e = lfgPost(game, s, 'QA', goal, args[1] !== undefined ? num(1) : undefined, args[2] !== undefined ? num(2) : undefined);
      return e ?? 'Posted: looking for company.';
    }
    case 'near': {
      // Alongside another captain at sea (docs/16 #33 QA): /near name — 150 m off her beam.
      const t = game.sessionByName(args.join(' '));
      if (!t?.ship || t === s) return 'No captain of that name is at sea.';
      if (t.ship.docked) return 'That captain is in port.';
      ship.docked = null;
      p.docked = null;
      ship.state.x = t.ship.state.x + 150;
      ship.state.y = t.ship.state.y;
      ship.region = t.ship.region;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      game.pushSelf(s, true);
      return `Alongside ${t.name}.`;
    }
    case 'wgoal': {
      // The sea's goals of the week (docs/16 #32): /wgoal [n|near|done] — deeds of one's own into every goal.
      const a = args[0] === 'near' || args[0] === 'done' ? args[0] : Math.max(1, Math.round(num(0, 10)));
      worldGoalsAdd(game, s, a);
      return 'The sea’s goals are stirred.';
    }
    case 'gyard': {
      // The guild's shipyard (docs/16 #34): /gyard found — a guild of one's own, an island with a shipyard and a
      // project on the slipway; /gyard fill — the project most of the way; /gyard done — finished.
      if (args[0] === 'fill' || args[0] === 'done') return gyardFill(game, s, args[0] === 'done' ? 1 : 0.8) ?? 'The guild’s project is filled in.';
      if (!game.guilds.of(game, s.accountId)) {
        const was = ship.docked;
        ship.docked = ship.docked ?? 'admin';
        p.gold += 200_000;
        const tag = `Q${String(s.accountId % 1000).padStart(3, '0')}`.slice(0, 4);
        const e = foundGuild(game, s, s.name.slice(0, 24), tag);
        ship.docked = was;
        if (e) return e;
      }
      runAdmin(game, s, '/isle 3');
      const h = ownIsland(game, s.accountId)!;
      if (!h.buildings.some((b) => b.id === 'shipyard')) {
        const y = yardOf(game, h);
        const used = new Set<number>([...h.buildings.map((b) => b.plot ?? -1), ...y.producers.map((x) => x.plot)]);
        let plot = 0;
        while (used.has(plot) && plot < plotCount(game, h)) plot++;
        h.buildings.push({ id: 'shipyard', condition: 1, unpaid: false, plot, level: 2 });
        game.holdings.touch();
      }
      const e = gyardStart(game, s, args[1] === 'yard' ? 'yard' : 'ship');
      return e && !/already/.test(e) ? e : 'The guild’s shipyard is ready.';
    }
    case 'signal': {
      // A signal flag to the group (docs/16 #35): /signal follow|attack|help|regroup|treasure.
      const k = (args[0] ?? 'help') as SignalKind;
      if (!SIGNALS.includes(k)) return `Usage: /signal ${SIGNALS.join('|')}`;
      return sendSignal(game, s, k) ?? 'Signal hoisted.';
    }
    case 'week': {
      // The Heroes' calendar (docs/17 H3): /week next — the next week begins; /week now — where the calendar stands;
      // /week <kind> — this week named anew.
      if (args[0] && args[0] !== 'close') return adminWeek(game, args[0]);
      // The week's tables (docs/16 #27): a few rivals on each; "close" writes this week into the book as if it ended.
      const list = weeklyChallenges(weekNumber(game.wallNow()));
      list.forEach((c, i) => weeklyAdd(game, s, c.kind, c.region, 10 + i * 7));
      const board = game.db.getKv<Record<string, { name: string; v: number[] }>>(`weekly_board:${weekNumber(game.wallNow())}`) ?? {};
      ['Anne Vey', 'Morrow Kett', 'Isabel Crane'].forEach((name, k) => (board[900000 + k] = { name, v: list.map((_, i) => 30 - k * 9 + i * 3) }));
      game.db.setKv(`weekly_board:${weekNumber(game.wallNow())}`, board);
      if (args[0] === 'close') {
        const last = weekNumber(game.wallNow()) - 1;
        const lb = game.db.getKv<Record<string, { name: string; v: number[] }>>(`weekly_board:${last}`) ?? {};
        ['Anne Vey', 'Morrow Kett'].forEach((name, k) => (lb[900000 + k] = { name, v: [20 - k * 5, 14 + k, 9 - k] }));
        lb[s.accountId] = { name: s.name, v: [4, 16, 2] };
        game.db.setKv(`weekly_board:${last}`, lb);
        game.db.setKv('weekly_hist', (game.db.getKv<{ week: number }[]>('weekly_hist') ?? []).filter((h) => h.week !== last));
        closeWeek(game, last);
      }
      sendRenown(game, s, true);
      return 'The week’s tables are stirred.';
    }
    case 'away': {
      // As if she had been ashore N hours (docs/16 #30): the welcome back window and its gift.
      awayMark(game, s);
      const a = rn(p).away!;
      a.at -= num(0, 36) * 3_600_000;
      a.goods = Math.max(0, a.goods - 40);
      a.treasury = Math.max(0, a.treasury - 600);
      deliver(game, s.accountId, { from: 'The Auction House', subject: 'Sold at Tidewrack', body: 'A lot of yours sold while you were ashore.', gold: 640, goods: null });
      chronicle(game, 'Kraken was slain by Anne Vey, Morrow Kett.');
      const v = awayReturn(game, s);
      if (!v) return 'Not long enough ashore.';
      game.sendTo(s, { t: 'away', view: v });
      return null;
    }
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
    case 'dwell':
      // The dwellings in this port and on her island (docs/17 H3); `fill`: two weeks' men in each.
      return adminDwell(game, s, args[0] ?? '');
    case 'mine':
      // The mines (docs/17 H3): the nearest `take`n, `lose` to the raiders, `free`d, a dawn's `pay`, `go` to it.
      return adminMine(game, s, args[0] ?? '');
    case 'town':
      // Her island's town (docs/17 H3): every building at its greatest, or at a level; `go`: off her island.
      if (args[0] === 'go') {
        const h = ownIsland(game, s.accountId);
        if (!h) return 'You have no island of your own.';
        offIsland(game, s, h.island);
        return `Off ${game.world.islands[h.island].name}.`;
      }
      return adminTown(game, s, args[0] !== undefined && Number.isFinite(num(0)) ? Math.max(0, Math.min(3, Math.floor(num(0)))) : undefined);
    case 'guard':
      // The adventure map's guards (docs/17 H4): the nearest (of a kind); `go` to it, `beat` it, `weak` thins it, `reset` all.
      return adminGuard(game, s, args);
    case 'obj':
      // The things on the map (docs/17 H4): the nearest (of a kind); `go` to it; `reset` her visits.
      return adminObj(game, s, args);
    case 'obelisk':
      // The Grail's chart (docs/17 H4): n pieces more, `all` of them, `go` to the nearest obelisk not read.
      return adminObelisk(game, s, args);
    case 'grail':
      // The Grail (docs/17 H4): `go` off its spot, `found` at once, `reset` this season's hunt.
      return adminGrail(game, s, args);
    case 'res': {
      // The seven resources (docs/17 H3): n of each of the six goods into the hold, and into her island's yard.
      const n = Math.max(0, Math.round(num(0, 50)));
      for (const g of RES_GOODS) ship.cargo[g] = (ship.cargo[g] ?? 0) + n;
      const h = ownIsland(game, s.accountId);
      if (h?.yard) {
        for (const g of [...RES_GOODS, 'coal', 'provisions'] as GoodId[]) h.yard.res[g] = (h.yard.res[g] ?? 0) + n;
        game.holdings.touch();
      }
      game.pushSelf(s, true);
      return `${n} of each resource in the hold${h?.yard ? ' and in the island’s yard' : ''}.`;
    }
    case 'give': {
      const good = args[0] as GoodId;
      const n = Math.round(num(1, 10));
      if (!GOODS[good]) return `Goods: ${Object.keys(GOODS).join(', ')}`;
      ship.cargo[good] = (ship.cargo[good] ?? 0) + n;
      game.pushSelf(s, true);
      return `${n} ${GOODS[good].name} in the hold.`;
    }
    case 'glory':
    case 'mastery':
    case 'trial':
      // The Throne of the Sea (docs/19 E1–E3): glory ranks, the mastery tree, the trials of mastery.
      return throneAdmin(game, s, cmd.toLowerCase(), args);
    case 'reveal': {
      let n = 0;
      for (const is of game.world.islands) {
        if (s.discovered.has(is.id) || is.minor || is.hidden) continue; // the hidden ones: /isle hidden reveal (docs/18 #30)
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
/** The lair an admin last went to (docs/16 #7 play-testing). */
const lairPick = new WeakMap<PlayerSession, string>();

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
