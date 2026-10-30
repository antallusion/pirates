// A long-played captain of a given level built for one account (owner, 2026-10-30, for his own «Dima 3»: «живой
// аккаунт 26 уровня с правильными и возможно выкаченным всем, что доступно под его уровень»). Never run against the
// live database: it works on a COPY, through the game's own code — the save loaded by the server's sanitizer, the
// island raised by its builders (every gate, plot and slot as a player meets them), the army hired under the might
// cap and the picked men's berths, the orders learnt at the island's guild — and writes the result into that copy.
//
//   node tools/admin/build-veteran.ts <copy.db> <accountId> [--level 26] [--silver 1000000] [--out result.json]
//
// The result (the captain's row and her island's holding) is applied to production by hand with the service stopped
// (the server keeps the holdings in memory and writes them back every few seconds). Then verify with
// tools/admin/check-veteran.ts.

import { writeFileSync } from 'node:fs';
import { Database } from '../../server/src/persistence/db.ts';
import { AuthService, hashToken } from '../../server/src/auth.ts';
import { Game } from '../../server/src/game/Game.ts';
import type { PlayerSession, Profile } from '../../server/src/game/player.ts';
import { quietAdv } from '../../server/src/game/advmap.ts';
import { currentOffer, fillWill, heroOf, pendingChoices } from '../../server/src/game/hero.ts';
import { learnOrder } from '../../server/src/game/hero.ts';
import { buildTown } from '../../server/src/game/town.ts';
import { capOf, reckonBase, startBuild, upgradeAt, yardOf } from '../../server/src/game/base.ts';
import { ownKey } from '../../server/src/game/holdings.ts';
import { checkCareers, checkFeats } from '../../server/src/game/renown.ts';
import { islePools } from '../../server/src/game/town.ts';
import { pickedMax } from '../../server/src/game/dwell.ts';
import { PROTOCOL_VERSION, xpForLevel, MAX_LEVEL } from '../../shared/src/constants.ts';
import type { WsConnection } from '../../server/src/net/websocket.ts';
import { TALENTS_BY_ID, validateBuild } from '../../shared/src/data/talents.ts';
import type { TalentRanks } from '../../shared/src/data/talents.ts';
import { MAX_COUNTED_DEEDS } from '../../shared/src/data/deeds.ts';
import type { SkillId } from '../../shared/src/data/hero.ts';
import { isleGuildOrders, ORDERS } from '../../shared/src/data/hero.ts';
import { SHIP_CLASSES, SHIP_CLASS_IDS, GUNS, MODULES, MODULE_IDS, MOUNTS } from '../../shared/src/data/ships.ts';
import type { GunId, ModuleId, MountId, ShipClassId } from '../../shared/src/data/ships.ts';
import { CAPTAIN_LEVEL_FOR_SHIP, levelRange, hullRole } from '../../shared/src/data/shiplevel.ts';
import { shipBandOf } from '../../shared/src/data/xpcurve.ts';
import { RESEARCH_COST, researchParents, needsResearch } from '../../shared/src/data/research.ts';
import { makeItem, captainIlvl, SETS, SLOT_OPENS, SHIP_SLOTS } from '../../shared/src/data/items.ts';
import type { Item, Rarity, SetId, Slot } from '../../shared/src/data/items.ts';
import { UNITS, armyPower, armyWeight, armyMen } from '../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import { TIER_SHIP_LEVEL, TIER_UNIT, mightCap, deepAllowed, TOWN_IDS, TOWN } from '../../shared/src/data/town.ts';
import type { TownId } from '../../shared/src/data/town.ts';
import { DWELL_UP_LEVEL, TREE_MAX, treePlan, isTreeTown } from '../../shared/src/data/isletree.ts';
import type { BuildingId } from '../../shared/src/data/holdings.ts';
import { producerFits, producerLimit } from '../../shared/src/data/base.ts';
import type { ProducerKind } from '../../shared/src/data/base.ts';
import { CHAPTERS } from '../../shared/src/data/campaign/chapters.ts';
import { campaignPaces } from '../../shared/src/data/campaign/pacing.ts';
import { CAMPAIGN_SIZE, PLAN } from '../../shared/src/data/campaign/plan.ts';
import { FIRST_SLOT } from '../../shared/src/data/campaign/progress.ts';
import { JOBS, QUESTS } from '../../shared/src/data/quests.ts';
import { SIDE_QUESTS } from '../../shared/src/data/sidequests.ts';
import { FOG_CELL, FOG_SIDE, fogDecode, fogEncode } from '../../shared/src/data/fog.ts';
import { regionAt } from '../../shared/src/world/worldgen.ts';
import type { RegionId } from '../../shared/src/world/regions.ts';
import { Rng } from '../../shared/src/rng.ts';
import { isCampaignId } from '../../shared/src/data/questclass.ts';

// ------------------------------------------------------------------------------------------------ arguments

const args = process.argv.slice(2);
const opt = (k: string, d: number): number => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const PATH = args[0];
const ACC = Number(args[1]);
if (!PATH || !(ACC > 0)) {
  console.log('usage: node tools/admin/build-veteran.ts <copy.db> <accountId> [--level 26] [--silver 1000000] [--out result.json]');
  process.exit(1);
}
const LEVEL = Math.max(2, Math.min(MAX_LEVEL, Math.round(opt('level', 26))));
const SILVER = Math.max(0, Math.round(opt('silver', 1_000_000)));
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const say = (...a: unknown[]) => console.log(...a);
const must = (why: string | null, what: string) => {
  if (why) throw new Error(`${what}: ${why}`);
};

// ------------------------------------------------------------------------------------------------ the game on the copy

const db = new Database(PATH);
const game = new Game({ db, auth: new AuthService(db), log: () => {} });
game.directorOn = false;
game.tacticalBoarding = false;
quietAdv(game);
game.zoneBosses.on = false;
game.invasions.on = false;
game.prices.on = false;

const row = db.loadCaptain(ACC);
if (!row) throw new Error(`no captain for account ${ACC}`);
const p0 = JSON.parse(row.data) as Profile;
const goldBefore = p0.gold;
say(`account ${ACC}: ${p0.captain}, level ${p0.level}, ${p0.loadout.classId}, ${p0.gold} silver`);

// ------------------------------------------------------------------------------------------------ the rules for her level

const band = shipBandOf(LEVEL); // the highest ⚓ she may command
/** The best hull of her band: a warship of the silver tree whose ladder reaches her band, the highest tier, the most
 *  hull and men (the frigate at ⚓6 for 26–32). */
const HULL: ShipClassId = SHIP_CLASS_IDS.filter((id) => {
  const c = SHIP_CLASSES[id];
  const [lo, hi] = levelRange(id);
  return c.list && !c.monster && !c.premium && c.purchasable && hullRole(id) === 'war' && lo <= band && hi >= band && CAPTAIN_LEVEL_FOR_SHIP[lo] <= LEVEL;
}).sort((a, b) => SHIP_CLASSES[b].tier - SHIP_CLASSES[a].tier || SHIP_CLASSES[b].hull + SHIP_CLASSES[b].crewMax * 10 - (SHIP_CLASSES[a].hull + SHIP_CLASSES[a].crewMax * 10))[0];
const CLS = SHIP_CLASSES[HULL];
/** The heaviest long gun her deck carries that any yard of her rank casts (no faction's own; the carronade's pistol
 *  range apart): the 18-pounder hull-breaker on a frigate. */
const GUN: GunId = (Object.keys(GUNS) as GunId[]).filter((g) => GUNS[g].minTier <= CLS.tier && !GUNS[g].factions && GUNS[g].range >= 150).sort((a, b) => GUNS[b].damage - GUNS[a].damage)[0];
say(`band ⚓${band}: ${HULL} (tier ${CLS.tier}), guns ${GUN}`);

// ------------------------------------------------------------------------------------------------ the deeds and the talents

/** Deeds a captain of her record has: the prize, a hundred wrecks, the named pirates, the convoys, a hundred thousand
 *  sold, the grand circuit, the last plank, the Whispering's chart, the ice edge, a leviathan. */
const DEEDS = ['deed_first_prize', 'deed_hundred_wrecks', 'deed_captain_killer', 'deed_convoy_breaker', 'deed_hundred_thousand', 'deed_grand_circuit', 'deed_last_plank', 'deed_whispering_chart', 'deed_ice_edge', 'deed_leviathan_slain'];

/** The drowned's build: the Abyssal tree to its keystone (the crew that never falls below 40%), the rest in Survival. */
const BUILD: [string, number][] = [
  ['abs_grasp_of_the_deep', 1], ['abs_whispers_below', 3], ['abs_salt_ward', 2], ['abs_drowned_eyes', 1],
  ['abs_drowned_shot', 2], ['abs_hymn_of_the_choir', 1], ['abs_small_bargain', 2],
  ['abs_rising_dead', 2], ['abs_black_water', 1], ['abs_creeping_horror', 2],
  ['abs_krakens_embrace', 1], ['abs_hollow_men', 2], ['abs_sea_rot', 2],
  ['abs_voice_of_the_choir', 1], ['abs_pact_of_salt_and_bone', 2],
  ['abs_crew_of_the_drowned', 1],
  ['srv_carpenters', 3], ['srv_ships_surgeon', 2], ['srv_iron_hull', 3], ['srv_storm_lashings', 1],
];

// ------------------------------------------------------------------------------------------------ phase A: the save

const p = p0;
p.level = LEVEL;
p.xp = Math.round(xpForLevel(LEVEL) * 0.37);
p.deeds = [...new Set([...(p.deeds ?? []), ...DEEDS])];
const points = Math.max(0, LEVEL - 1) + Math.min(p.deeds.length, MAX_COUNTED_DEEDS);
const talents: TalentRanks = {};
for (const [id, r] of BUILD) {
  if (!TALENTS_BY_ID[id]) throw new Error(`no talent ${id}`);
  talents[id] = r;
}
const spent = Object.values(talents).reduce((a, b) => a + b, 0);
if (spent > points) throw new Error(`the build asks ${spent} points of ${points}`);
must(validateBuild(talents, points, { level: LEVEL, abyssOpen: true }), 'talents');
p.talents = talents;
p.loadouts = [{}];
p.activeLoadout = 0;
p.tokenLevels = [20, 30, 40, 50, 60].filter((l) => l <= LEVEL);
p.tokens = Math.min(3, p.tokenLevels.length);
say(`talents: ${spent} of ${points} points`);

// The hero: her primaries grown to her level by her own seed (heroOf), every level's skill chosen as a drowned
// boarder would — the fighting skills first, raised before new ones are taken.
const WANT: SkillId[] = ['boarding', 'armor', 'tactics', 'leadership', 'artillery', 'first_aid', 'mysticism', 'luck', 'logistics', 'navigation', 'scouting', 'trading'];
const h = heroOf(p);
for (let guard = 0; guard < 200 && pendingChoices(p, h) > 0; guard++) {
  const offer = currentOffer(p, h);
  if (!offer.length) {
    h.picked++;
    continue;
  }
  const score = (o: { id: SkillId; r: number }) => WANT.indexOf(o.id) * 10 - o.r;
  const pick = [...offer].sort((a, b) => score(a) - score(b))[0];
  const had = h.skills.find((x) => x.id === pick.id);
  if (had) had.r = pick.r;
  else h.skills.push({ id: pick.id, r: pick.r });
  h.picked++;
}
say(`hero: ${JSON.stringify(h.prim)} at ${h.primLv}; skills ${h.skills.map((x) => `${x.id} ${x.r}`).join(', ')}`);

// The yard's tree of hulls: what led her to the frigate known, and the frigate's own experience.
const research = (p.research ??= { xp: {}, free: 0, done: [] });
const known = new Set(research.done);
const learn = (id: ShipClassId) => {
  for (const par of researchParents(id)) if (!SHIP_CLASSES[par].premium && needsResearch(par) && !known.has(par)) learn(par);
  known.add(id);
};
learn(HULL);
known.add('brig'); // the brig she sailed between the war galley and the frigate
for (const id of SHIP_CLASS_IDS) {
  const c = SHIP_CLASSES[id];
  if (c.list && !c.premium && c.purchasable && c.tier <= 2 && (c.list === 'combat' || c.list === 'fast')) known.add(id);
}
research.done = [...known];
research.xp = { ...research.xp, [HULL]: Math.round(RESEARCH_COST[CLS.tier + 1] * 0.41), brig: 6200, war_galley: 2100 };
research.free = Math.round(9_400);

// The ship.
const rng = new Rng((ACC * 2654435761) >>> 0);
const items: Item[] = [];
const item = (base: string, slot: Slot, ilvl: number, rarity: Rarity, set?: SetId, temper = 0): Item => {
  const it = makeItem(rng, p.itemSeq++, { base, ilvl, rarity });
  // (the set chosen here, not the dice's: a stray single piece of another set is nothing a captain would keep on)
  delete it.set;
  if (set) {
    if (!SETS[set].pieces[slot]) throw new Error(`the ${set} set has no ${slot}`);
    it.set = set;
  }
  if (temper) it.temper = temper;
  items.push(it);
  return it;
};
const ship = band; // ⚓ of her hull
const shipGear: Partial<Record<(typeof SHIP_SLOTS)[number], Item>> = {
  sails: item('storm_sails', 'sails', ship, 3, 'drowned', 2),
  rigging: item('iron_rigging', 'rigging', ship, 2, undefined, 1),
  plating: item('oak_plating', 'plating', ship, 3, undefined, 3),
  rudder: item('iron_rudder', 'rudder', ship, 2),
  hold: item('deep_hold', 'hold', ship, 2),
  quarters: item('marines_berth', 'quarters', ship, 3, 'sea_terror', 2),
  battery: item('double_charge', 'battery', ship, 4, undefined, 2), // the Crown's Thunder
  banner: item('black_flag', 'banner', ship, 3, 'sea_terror', 1),
  relic: item('saint_bone', 'relic', ship, 3, 'drowned', 1),
  tackle: item('trolling_rods', 'tackle', ship, 2),
};
for (const sl of SHIP_SLOTS) if (SLOT_OPENS[sl] > ship) delete shipGear[sl];
const ci = captainIlvl(LEVEL);
p.captainGear = {
  hat: item('tricorne', 'hat', ci, 3, 'sea_terror', 2),
  coat: item('longcoat', 'coat', ci, 3, 'drowned', 2),
  sash: item('baldric', 'sash', ci, 3, 'sea_terror', 1),
  boots: item('pilot_boots', 'boots', ci, 3, undefined, 1),
  blade: item('cutlass', 'blade', ci, 4, undefined, 3), // Mara Quill's Cutlass
  pistols: item('duelling_pistols', 'pistols', ci, 3, undefined, 1),
  spyglass: item('brass_glass', 'spyglass', ci, 2),
  compass: item('dead_compass', 'compass', ci, 3, 'drowned', 1),
  charm: item('orca_tooth', 'charm', ci, 3, 'drowned', 1),
  ring: item('skull_ring', 'ring', ci, 3, 'drowned', 2),
};
// A few pieces in the locker, as any captain keeps (the old sloop's net among them).
p.stash = [...(p.stash ?? []).filter((x) => x.uid !== shipGear.tackle?.uid), item('canvas_sails', 'sails', 5, 2), item('rapier', 'blade', ci, 2), item('witch_bottle', 'charm', ci, 2), item('copper_sheathing', 'plating', 5, 2)];
if (p.loadout.gear?.tackle) p.stash.push(p.loadout.gear.tackle);
for (const it of items) it.dur = 100;
const legend = [shipGear.battery!, p.captainGear.blade!].map((x) => x.legendary);
if (legend.some((x) => !x)) throw new Error('a legendary piece came out without its legend');

// Every fitting a yard of her rank sells, at its greatest (the merchant's false bulwark and the mortar's bed apart:
// no warship's captain fits them), and the leviathan's bone culverins from its hoard's plans.
p.blueprints = [...new Set([...(p.blueprints ?? []), 'bone_culverin'])];
const modules: Partial<Record<ModuleId, number>> = {};
for (const m of MODULE_IDS) {
  const d = MODULES[m];
  if (m === 'false_bulwark' || m === 'mortar_bed') continue;
  if (d.blueprint && !p.blueprints.includes(m)) continue;
  modules[m] = d.maxLevel;
}
const MOUNT: MountId = (['abyssal_lance', 'long_tom'] as MountId[]).find((m) => MOUNTS[m].minTier <= CLS.tier)!;
p.loadout = {
  classId: HULL, name: p.shipName, guns: { port: GUN, starboard: GUN }, modules, mount: MOUNT, level: ship,
  excellent: ['hull_plating'], gear: shipGear,
};
p.hull = -1; // whole (the ship is made whole against her stats on loading)
p.sails = -1;
p.rudderHp = 1;
p.gunsDisabled = { port: 0, starboard: 0 };
p.morale = 88;
p.sanity = 94;
p.refit = null;

// The record.
p.stats = { ...p.stats, sunk: 912, boarded: 534, tradeProfit: 186_400, distance: 4_612_000, sold: 141_300, fogContraband: 140, harpoonContracts: 4, recruited: 3_860 };
p.reputation = { crown: -38, league: 42, confederacy: 18, harpoon: 24, brokers: 16, choir: 61, free: 33 };
p.infamy = Math.max(p.infamy ?? 0, 120);
const r = (p.renown ??= { kills: {}, deeds: {}, ranks: {}, omens: [], sets: [], feats: [], won: [] });
const away = r.away ?? null; // her «welcome back» kept for her own first login
const ashore = { at: p.ashoreAt, inPort: p.ashoreInPort, rested: p.rested }; // and her rest ashore since she left
r.kills = { pirate: 640, crown: 260, league: 190, confederacy: 230, brokers: 76, ghost: 50 };
r.deeds = { crown: 0, league: 620, confederacy: 410 };
p.piracy = { fame: 2_150, honour: 46, tributes: 31, convoys: 7 } as Profile['piracy'];
p.hunter = { ...(p.hunter ?? { points: 0, captains: 0, seas: {} }), points: 1_340, captains: 14 } as Profile['hunter'];
p.bossKills = { ...(p.bossKills ?? {}), leviathan: 2, drowned_whale: 1, old_moorings: 3, fog_changeling: 1 };
p.trophies = [...new Set([...(p.trophies ?? []), 'Leviathan Skull', 'Bell of the Whale', 'Jaw of Old Moorings'])];
p.nemesisHeads = Math.max(p.nemesisHeads ?? 0, 3);
p.roamWins = Math.max(p.roamWins ?? 0, 46);
p.rescued = Math.max(p.rescued ?? 0, 17);
p.company = {
  ...p.company, skill: 4.3, loyalty: 84, fights: 1_446, owed: 0, unpaid: 0, unrest: { phase: 0, t: 0 }, mutiny: null, voyageLost: 0,
  seaHours: 312,
} as Profile['company'];
p.tutorial = { ...p.tutorial, on: false };
p.speedups = Math.max(p.speedups ?? 0, 12);

// The seas she has sailed: the campaign's to her chapter (the Black Coast, the Gravewater, the Whispering, the Dead
// Man's Expanse, Leviathan Reach), every port in them made, every island charted, their fog lifted.
const SEAS = [...new Set(PLAN.filter((c, i) => campaignPaces()[FIRST_SLOT[i]].gate <= LEVEL).map((c) => c.region))] as RegionId[];
const ports = game.world.ports.filter((x) => SEAS.includes(x.region as RegionId) && !x.raft);
p.regionsSeen = [...new Set([...(p.regionsSeen ?? []).filter((x) => !x.includes(':') || x.startsWith('visited:')), ...SEAS, ...ports.map((x) => `visited:${x.id}`)])];
const isles = game.world.islands.filter((i) => SEAS.includes(i.region as RegionId)).map((i) => i.id);
p.discovered = [...new Set([...(p.discovered ?? []), ...isles])];
const bits = fogDecode(p.fog);
for (let j = 0; j < FOG_SIDE; j++) for (let i = 0; i < FOG_SIDE; i++) {
  if (SEAS.includes(regionAt(game.world, (i + 0.5) * FOG_CELL, (j + 0.5) * FOG_CELL) as RegionId)) bits[(j * FOG_SIDE + i) >> 3] |= 1 << ((j * FOG_SIDE + i) & 7);
}
p.fog = fogEncode(bits);
say(`seas: ${SEAS.join(', ')}; ${ports.length} ports, ${isles.length} islands`);

// The campaign: every quest whose level she has passed done (her ways at its branches chosen), the next one hers.
const paces = campaignPaces();
let at = 0;
for (let i = 0; i < CAMPAIGN_SIZE; i++) if (paces[i].gate <= LEVEL) at = i;
at = Math.max(p.campaign?.at ?? 0, at - 4); // the middle of her chapter, a few quests before its gate's end
const picks: Record<string, 'a' | 'b'> = { ...(p.campaign?.picks ?? {}) };
let slot = 0, k = 0;
const titles = new Set(p.titles ?? []);
for (const ch of CHAPTERS) {
  for (const q of ch.quests) {
    if (slot < at && q.alt && !picks[q.alt.key]) picks[q.alt.key] = k++ % 3 === 1 ? 'b' : 'a';
    slot++;
  }
  if (slot <= at && ch.reward?.title) titles.add(ch.reward.title[0]);
}
p.campaign = { at, picks, started: true, from: p.campaign?.from ?? 0 };
p.quests.active = (p.quests.active ?? []).filter((q) => !isCampaignId(q.id));
const hubPort = game.portById(PLAN.find((c, i) => FIRST_SLOT[i] <= at && FIRST_SLOT[i] + c.size > at)!.hub)!;
// The quests of the ports she has worked: the side quests and the boards' jobs of her seas up to her level, every
// arc in order (what an earlier chapter asks done first).
const done = new Set(p.quests.done ?? []);
const pool = [...SIDE_QUESTS, ...QUESTS.filter((q) => q.kind === 'story'), ...JOBS].filter((q) => (q.requires.level ?? 1) <= LEVEL - 2 && !q.hidden && !q.group && !q.campaign);
const jobsHere = JOBS.filter((q) => (q.requires.level ?? 1) <= LEVEL - 2 && SEAS.includes(game.world.ports.find((x) => x.id === q.port)?.region as RegionId)).length;
const JOB_SHARE = Math.round((1000 * 200) / Math.max(200, jobsHere));
const portSea = new Map(game.world.ports.map((x) => [x.id, x.region as RegionId]));
for (let pass = 0; pass < 6; pass++) {
  for (const q of pool) {
    if (done.has(q.id) || !SEAS.includes(portSea.get(q.port) as RegionId)) continue;
    if ((q.requires.done ?? []).some((d) => !done.has(d))) continue;
    if (q.reward.path || q.reward.deed) continue;
    if (JOBS.includes(q) && hashOf(q.id) % 1000 >= JOB_SHARE) continue; // a share of the boards' jobs (~200)
    done.add(q.id);
  }
}
p.quests.done = [...done];
p.titles = [...titles];
say(`campaign: slot ${at} (chapter hub ${hubPort.id}); quests done ${p.quests.done.length}`);

// In harbour at her chapter's hub, as she would leave the game.
p.docked = hubPort.id;
p.lastPort = hubPort.id;
p.cargo = { provisions: 140, rum: 40, medicine: 12, planks: 30, sailcloth: 12, gunpowder: 20 } as Profile['cargo'];
p.ammo = { ...p.ammo, round: 420, chain: 120, grape: 220, heavy: 80, cursed: 90, incendiary: 30 };
p.ammoSel = 'round';

function hashOf(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

db.saveCaptain(ACC, p, hubPort.x, hubPort.y, 0);

// ------------------------------------------------------------------------------------------------ phase B: in the game

const TOKEN = `veteran-${ACC}-${'x'.repeat(24)}`;
(db as unknown as { setTokenHash(a: number, h: string): void }).setTokenHash(ACC, hashToken(TOKEN));
const inbox: { t: string; msg?: string }[] = [];
const conn = { remote: 'builder', bytesOut: 0, buffered: 0, closed: false, onMessage: (_: string) => {}, onClose: () => {}, send: (t: string) => inbox.push(JSON.parse(t)), sendBinary: () => {}, close() {} };
const s = game.attach(conn as unknown as WsConnection) as PlayerSession;
conn.onMessage(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: TOKEN }));
if (!s.authed || !s.profile || !s.ship) throw new Error(`could not load the captain: ${JSON.stringify(inbox.filter((m) => m.t === 'err'))}`);
const P = s.profile;
const S = s.ship;
say(`loaded: level ${P.level}, ${S.loadout.classId} ⚓${S.shipLevel}, crew max ${S.stats.crewMax}, slots ${S.armySlots}`);

// The island: every building of the tree to its greatest, the base's on its plots, the producers — raised by the
// builders as a captain raises them (each gate, plot and slot), the works finished at once.
const h0 = game.holdings.own(game, ACC);
if (!h0) throw new Error('she has no island');
const H = h0;
const Y = yardOf(game, H);
P.gold = 50_000_000;
const RICH = 5_000_000;
// (the higher dwellings ask the lairs' shell, bone and venom too: lent for the building, her own store put back after)
const lairStore = { ...(P.lairs?.res ?? {}) };
if (P.lairs) P.lairs.res = { shell: RICH, bone: RICH, venom: RICH } as typeof P.lairs.res;
const stockUp = () => {
  for (const g of ['timber', 'coal', 'tar', 'iron', 'provisions', 'gunpowder', 'pearls', 'rum'] as const) Y.res[g] = RICH;
};
const finishAll = () => {
  const now = game.wallNow();
  for (const j of Y.jobs) j.end = Math.min(j.end, now);
  reckonBase(game, H);
};
const town = (id: TownId) => Y.town?.b[id] ?? 0;
// the tree, step by step (its own order: every level after all it asks)
for (const [id, n] of treePlan(TREE_MAX)) {
  stockUp();
  const have = isTreeTown(id) ? town(id as TownId) : (H.buildings.find((b) => b.id === id)?.level ?? 0);
  if (have >= n) continue;
  let why: string | null;
  if (isTreeTown(id)) why = buildTown(game, s, id as TownId);
  else {
    const b = H.buildings.find((x) => x.id === id);
    why = b ? upgradeAt(game, s, b.plot!) : startBuild(game, s, null, id);
  }
  must(why, `tree ${id} ${n}`);
  finishAll();
}
// the town's buildings the hall does not ask (the higher dwellings and their chains, the guild, the pen), round and
// round till nothing more may rise
for (let round = 0; round < 12; round++) {
  let any = false;
  for (const id of TOWN_IDS.filter((x) => x !== 'grail')) {
    if (town(id) >= TOWN[id].max) continue;
    stockUp();
    if (buildTown(game, s, id)) continue;
    finishAll();
    any = true;
  }
  if (!any) break;
}
for (const id of TOWN_IDS.filter((x) => x !== 'grail' && town(x) < TOWN[x].max)) {
  stockUp();
  say(`  ${id} stops at ${town(id)}: ${buildTown(game, s, id)}`);
}
// the base's buildings, as many as her slots hold, a drowned captain's choice first
const WANT_B: BuildingId[] = ['dry_dock', 'tavern', 'forge', 'chapel', 'trophy_hall', 'lighthouse', 'signal_tower', 'caravan_office', 'chart_house', 'residents_house', 'workshop'];
for (const id of WANT_B) {
  if (H.buildings.some((b) => b.id === id)) continue;
  stockUp();
  const why = startBuild(game, s, null, id);
  if (why) {
    say(`  ${id}: ${why}`);
    continue;
  }
  finishAll();
}
// the producers her land bears, on the plots left
const isl = game.world.islands[H.island];
const KINDS = (['quarry', 'mine', 'fishery', 'lumber', 'tar'] as ProducerKind[]).filter((x) => producerFits(x, isl.biome));
for (let guard = 0; guard < 30; guard++) {
  let any = false;
  for (const kind of KINDS) {
    if (Y.producers.filter((x) => x.kind === kind).length >= Math.min(2, producerLimit(H.level ?? 1))) continue;
    stockUp();
    if (startBuild(game, s, null, `p:${kind}`)) continue;
    finishAll();
    any = true;
  }
  if (!any) break;
}
// everything on a plot to its greatest
for (let guard = 0; guard < 400; guard++) {
  let any = false;
  const plots = [...H.buildings.map((b) => b.plot!), ...Y.producers.map((x) => x.plot)];
  for (const plot of plots) {
    stockUp();
    if (upgradeAt(game, s, plot)) continue;
    finishAll();
    any = true;
  }
  if (!any) break;
}
finishAll();
if (P.lairs) P.lairs.res = { ...lairStore, shell: Math.max(lairStore.shell ?? 0, 14), bone: Math.max(lairStore.bone ?? 0, 22), venom: Math.max(lairStore.venom ?? 0, 9) } as typeof P.lairs.res;
// What a captain keeps on her island: the yard three-quarters full, a treasury, her dwellings' men waiting.
const cap = capOf(H);
for (const g of ['timber', 'coal', 'tar', 'iron', 'provisions'] as const) Y.res[g] = Math.round(cap * (0.55 + 0.3 * rng.float()));
Y.res.gunpowder = 260;
Y.res.pearls = 38;
Y.res.rum = 180;
H.treasury = 86_400;
islePools(game, Y);
game.holdings.touch();
say(`island ${isl.name}: level ${H.level}, town ${JSON.stringify(Y.town?.b)}`);
say(`  buildings ${H.buildings.map((b) => `${b.id} ${b.level}`).join(', ')}; producers ${Y.producers.map((x) => `${x.kind} ${x.level}`).join(', ')}`);

// The orders her island's guild teaches, as far as her level allows.
for (const id of isleGuildOrders(H.island, town('guild')).flat()) if (!heroOf(P).orders.includes(id)) learnOrder(game, s, id, true);
say(`orders: ${heroOf(P).orders.map((o) => `${o} (${ORDERS[o].level})`).join(', ')}`);

// The army: the best her island's dwellings open and her ship may carry — the plain kinds trained up — under the
// picked men's berths and the might cap, every hammock filled; the melee and the shooters both.
const deep = deepAllowed(P.curse ?? 0, P.reputation.choir ?? 0, false) || P.captain === 'drowned';
const kinds: UnitId[] = [];
for (let t = 2; t <= 7; t++) {
  if (S.shipLevel < TIER_SHIP_LEVEL[t] || (t === 7 && !deep)) continue;
  const L = town(`dw${t}` as TownId);
  if (L <= 0) continue;
  kinds.push(L >= DWELL_UP_LEVEL ? UNITS[TIER_UNIT[t]].upgrade! : TIER_UNIT[t]);
}
const slots = S.armySlots;
const crewMax = S.stats.crewMax;
const mightMax = mightCap(S.shipLevel, crewMax, slots);
const picked = pickedMax(s);
// one slot for the seasoned sailors who fill the hammocks; the rest for the strongest kinds, a shooter kept among them
const pickKinds = (() => {
  const room = slots - 1;
  const byTier = [...kinds].sort((a, b) => UNITS[b].tier - UNITS[a].tier);
  const out = byTier.slice(0, room);
  const shooters = kinds.filter((u) => UNITS[u].shots > 0);
  if (!out.some((u) => UNITS[u].shots > 0) && shooters.length) out[out.length - 1] = shooters[0];
  return out;
})();
const weightOf = (army: ArmyStack[]) => {
  const men = armyMen(army);
  return armyWeight(men < crewMax ? [...army, { u: 'deckhand', n: crewMax - men }] : army);
};
// The hire: first a stack of each kind worth its slot (the shooters among them), then the rest of the might to whichever
// kind adds the most power for the might it costs — the empty hammocks counted as deckhands, as the cap counts them.
const army: ArmyStack[] = pickKinds.map((u) => ({ u, n: 0 }));
const pickedNow = () => army.filter((x) => UNITS[x.u].tier >= 4).reduce((a, x) => a + x.n, 0);
const FLOOR: Partial<Record<UnitId, number>> = { sharpshooter: 10, bombardier: 5, cutthroat: 4, life_guard: 3, sea_guard: 8, musketeer: 10, gunner: 5, boarder: 4, guard: 3 };
const fits = () => armyMen(army) <= crewMax && pickedNow() <= picked && weightOf(army) <= mightMax * 0.995;
for (const x of army) {
  const want = FLOOR[x.u] ?? 0;
  while (x.n < want) {
    x.n++;
    if (!fits()) {
      x.n--;
      break;
    }
  }
}
for (let guard = 0; guard < 5000; guard++) {
  const base = { p: armyPower(army), w: weightOf(army) };
  let best = -1, bestK = -Infinity;
  for (let i = 0; i < army.length; i++) {
    army[i].n++;
    const ok = fits();
    const w = weightOf(army), pw = armyPower(army);
    army[i].n--;
    if (!ok) continue;
    const k = (pw - base.p) / Math.max(1e-6, w - base.w);
    if (k > bestK) {
      bestK = k;
      best = i;
    }
  }
  if (best < 0) break;
  army[best].n++;
}
const hands = crewMax - armyMen(army);
const finalArmy = army.filter((x) => x.n > 0);
// (the hammocks left to deckhands: weighed as the empty hammocks are, so the cap holds — seasoned sailors would carry
// her past it, the «Сила 333/30» the owner would see in the hire window)
if (hands > 0) finalArmy.push({ u: 'deckhand', n: hands });
S.setArmy(finalArmy);
P.army = S.army.map((x) => ({ ...x }));
P.crew = S.crew;
const mightNow = weightOf(S.army.map((x) => ({ ...x })));
say(`army (${S.army.length}/${slots} stacks, ${S.crew}/${crewMax} men, picked ${pickedNow()}/${picked}): ${S.army.map((x) => `${x.u} ${x.n}`).join(', ')}`);
say(`  might ${Math.round(mightNow)} of ${Math.round(mightMax)}; power ${Math.round(armyPower(S.army))}`);
if (mightNow > mightMax + 1e-6) throw new Error('the army is over the might cap');
// The men's trades in step with the army: gunners for both batteries, the rest as a warship's company.
const pools = { sailor: 0, gunner: 0, helmsman: 0, carpenter: 0, surgeon: 0, marine: 0, cook: 0 };
const men = S.crew;
pools.gunner = Math.min(Math.round(men * 0.34), S.stats.gunsPerSide * 2 * GUNS[GUN].crewPerGun);
pools.marine = Math.round(men * 0.22);
pools.carpenter = Math.round(men * 0.06);
pools.surgeon = Math.round(men * 0.04);
pools.cook = Math.round(men * 0.04);
pools.helmsman = Math.round(men * 0.03);
pools.sailor = men - pools.gunner - pools.marine - pools.carpenter - pools.surgeon - pools.cook - pools.helmsman;
P.company.pools = pools;
P.company.voyageStartCrew = men;

// The ranks and the feats her record has earned (their titles and the flags' gifts), her will whole, her silver.
checkCareers(game, s);
checkFeats(game, s);
const tl = P.titles;
P.title = tl.includes('Sea Wolf') ? 'Sea Wolf' : tl[tl.length - 1] ?? null;
fillWill(P);
P.gold = SILVER;
if (away) (P.renown ??= r).away = away;
if (ashore.at !== undefined) {
  P.ashoreAt = ashore.at;
  P.ashoreInPort = ashore.inPort;
  P.rested = ashore.rested;
}
S.hull = S.stats.hullMax;
S.sails = S.stats.sailHpMax;
game.saveSession(s);
game.holdings.save(game);
const out = { account: ACC, goldBefore, gold: P.gold, captain: db.loadCaptain(ACC), holding: game.holdings.map(game)[ownKey(ACC)] };
if (OUT) writeFileSync(OUT, JSON.stringify(out));
say(`saved: ${P.gold} silver (was ${goldBefore}); hull ${Math.round(S.hull)}/${Math.round(S.stats.hullMax)}`);
process.exit(0);
