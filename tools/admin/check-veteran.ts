// Checks a captain as the server will meet her (tools/admin/build-veteran.ts builds one): on a COPY of the database,
// a fresh game loads her save through its own sanitizer and her island through its own migrations, and every rule a
// player meets is asked again — her level and points, her hull's band, her gear's levels, her army against the might
// cap, the picked men's berths and the tiers her ship carries, the island's tree and plots — and the site's profile
// is built as https://gravetidegame.com/site/captain/<name> builds it. Nothing is written back.
//
//   node tools/admin/check-veteran.ts <copy.db> <accountId>

import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { Database } from '../../server/src/persistence/db.ts';
import { AuthService, hashToken } from '../../server/src/auth.ts';
import { Game } from '../../server/src/game/Game.ts';
import type { PlayerSession, Profile } from '../../server/src/game/player.ts';
import { sanitizeProfile } from '../../server/src/game/player.ts';
import { quietAdv } from '../../server/src/game/advmap.ts';
import { migrateHoldings, ownKey } from '../../server/src/game/holdings.ts';
import type { Holding } from '../../server/src/game/holdings.ts';
import { yardOf, plotCount } from '../../server/src/game/base.ts';
import { treeWhy } from '../../server/src/game/town.ts';
import { ownedSlots } from '../../server/src/game/estate.ts';
import { mightNow, pickedMax } from '../../server/src/game/dwell.ts';
import { SiteProfile } from '../../server/src/game/siteprofile.ts';
import { SiteRating } from '../../server/src/game/siterating.ts';
import { PROTOCOL_VERSION, xpForLevel } from '../../shared/src/constants.ts';
import type { WsConnection } from '../../server/src/net/websocket.ts';
import { validateBuild } from '../../shared/src/data/talents.ts';
import { MAX_COUNTED_DEEDS } from '../../shared/src/data/deeds.ts';
import { CAPTAIN_LEVEL_FOR_SHIP } from '../../shared/src/data/shiplevel.ts';
import { shipBandOf } from '../../shared/src/data/xpcurve.ts';
import { GUNS, MODULES, MOUNTS, SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { captainIlvl, SLOT_OPENS, itemSlot, isShipSlot } from '../../shared/src/data/items.ts';
import type { ShipSlot } from '../../shared/src/data/items.ts';
import { UNITS, armyPower } from '../../shared/src/data/army.ts';
import { TIER_SHIP_LEVEL, mightCap, PICKED_TIER, TOWN } from '../../shared/src/data/town.ts';
import type { TownId } from '../../shared/src/data/town.ts';
import { DWELL_UP_LEVEL, isTree } from '../../shared/src/data/isletree.ts';
import type { TreeId } from '../../shared/src/data/isletree.ts';
import { BUILDINGS } from '../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../shared/src/data/holdings.ts';
import { producerLimit } from '../../shared/src/data/base.ts';
import { isResearched } from '../../shared/src/data/research.ts';

const [src, accArg] = process.argv.slice(2);
const ACC = Number(accArg);
if (!src || !(ACC > 0)) {
  console.log('usage: node tools/admin/check-veteran.ts <copy.db> <accountId>');
  process.exit(1);
}
const work = `${src}.check.db`;
for (const x of ['', '-wal', '-shm']) rmSync(work + x, { force: true });
copyFileSync(src, work);
for (const x of ['-wal', '-shm']) if (existsSync(src + x)) copyFileSync(src + x, work + x); // (a copy in WAL mode: its last writes too)
const db = new Database(work);
const bad: string[] = [];
const ok = (cond: boolean, what: string) => {
  if (!cond) bad.push(what);
};

// The save as it lies, and as the sanitizer makes it: nothing of hers «repaired».
const raw = JSON.parse(db.loadCaptain(ACC)!.data) as Profile;
const clean = sanitizeProfile(JSON.parse(db.loadCaptain(ACC)!.data) as Profile);
for (const k of ['level', 'xp', 'gold', 'crew', 'talents', 'army', 'loadout', 'captainGear', 'deeds', 'campaign', 'stats'] as const) {
  ok(JSON.stringify(raw[k]) === JSON.stringify(clean[k]), `the sanitizer changed ${k}`);
}
// Her island as the holdings' migration finds it: unchanged.
const all = db.getKv<Record<string, Holding>>('holdings')!;
const before = JSON.stringify(all[ownKey(ACC)]);
migrateHoldings(all, Date.now());
ok(JSON.stringify(all[ownKey(ACC)]) === before, 'the holdings migration changed her island');

const game = new Game({ db, auth: new AuthService(db), log: () => {} });
game.directorOn = false;
quietAdv(game);
game.zoneBosses.on = false;
game.invasions.on = false;
const TOKEN = `check-${ACC}-${'y'.repeat(30)}`;
(db as unknown as { setTokenHash(a: number, h: string): void }).setTokenHash(ACC, hashToken(TOKEN));
const inbox: { t: string; msg?: string }[] = [];
const conn = { remote: 'check', bytesOut: 0, buffered: 0, closed: false, onMessage: (_: string) => {}, onClose: () => {}, send: (t: string) => inbox.push(JSON.parse(t)), sendBinary: () => {}, close() {} };
const s = game.attach(conn as unknown as WsConnection) as PlayerSession;
conn.onMessage(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: TOKEN }));
const p = s.profile!;
const ship = s.ship!;
ok(!!p && !!ship, 'she did not load');
ok(!inbox.some((m) => m.t === 'err'), `errors on login: ${JSON.stringify(inbox.filter((m) => m.t === 'err'))}`);

// Level and points.
ok(p.xp >= 0 && p.xp < xpForLevel(p.level), 'xp out of her level');
const points = Math.max(0, p.level - 1) + Math.min(p.deeds.length, MAX_COUNTED_DEEDS);
const why = validateBuild(p.talents, points, { level: p.level, abyssOpen: p.captain === 'drowned' || p.deeds.includes('deed_first_descent') });
ok(!why, `talents: ${why}`);
// The ship: her band, her class's ladder, the guns and fittings her deck and yards allow, her gear's levels.
const cls = SHIP_CLASSES[p.loadout.classId];
ok(ship.shipLevel <= shipBandOf(p.level) && CAPTAIN_LEVEL_FOR_SHIP[ship.shipLevel] <= p.level, `ship level ${ship.shipLevel} above her band`);
ok(isResearched(p.research!, p.loadout.classId), 'her hull is not researched');
for (const side of ['port', 'starboard'] as const) ok(GUNS[p.loadout.guns[side]].minTier <= cls.tier, `${side} guns too heavy for her deck`);
for (const [m, l] of Object.entries(p.loadout.modules)) {
  const d = MODULES[m as keyof typeof MODULES];
  ok(!!d && (l ?? 0) <= d.maxLevel && (!d.blueprint || p.blueprints.includes(m)), `fitting ${m} ${l}`);
}
if (p.loadout.mount) ok(MOUNTS[p.loadout.mount].minTier <= cls.tier, 'mount too heavy');
for (const [sl, it] of Object.entries(p.loadout.gear ?? {})) {
  ok(!!it && isShipSlot(itemSlot(it!)) && itemSlot(it!) === sl && it!.ilvl <= ship.shipLevel && SLOT_OPENS[sl as ShipSlot] <= ship.shipLevel, `ship gear ${sl}`);
}
for (const [sl, it] of Object.entries(p.captainGear)) ok(!!it && itemSlot(it!) === sl && it!.ilvl <= captainIlvl(p.level), `captain gear ${sl}`);
ok(Math.round(ship.hull) === Math.round(ship.stats.hullMax), 'hull not whole');
// The army.
const cap = mightCap(ship.shipLevel, ship.stats.crewMax, ship.armySlots);
const might = mightNow(s);
ok(might <= cap + 1e-6, `might ${might.toFixed(1)} over ${cap.toFixed(1)}`);
ok(ship.army.length <= ship.armySlots, 'stacks over her slots');
ok(ship.crew <= ship.stats.crewMax, 'men over her hammocks');
const pickedN = ship.army.filter((x) => UNITS[x.u].tier >= PICKED_TIER).reduce((a, x) => a + x.n, 0);
ok(pickedN <= pickedMax(s), 'picked men over her berths');
ok(JSON.stringify(ship.army) === JSON.stringify(raw.army), 'the army changed on loading');
const h = game.holdings.own(game, ACC)!;
const y = yardOf(game, h);
for (const x of ship.army) {
  const d = UNITS[x.u];
  ok(ship.shipLevel >= TIER_SHIP_LEVEL[d.tier], `${x.u}: tier ${d.tier} not for ⚓${ship.shipLevel}`);
  if (d.tier >= 2) {
    const L = y.town?.b[`dw${d.tier}` as TownId] ?? 0;
    ok(L > 0 && (!d.up || L >= DWELL_UP_LEVEL), `${x.u}: her island does not open it`);
  }
}
// The island: every level of the tree upon what it asks, the plots and slots, the producers.
for (const [id, L] of Object.entries(y.town?.b ?? {})) {
  if (!isTree(id)) continue;
  for (let l = 2; l <= (L ?? 0); l++) ok(!treeWhy(h, y, id as TreeId, l), `${id} ${l}: ${treeWhy(h, y, id as TreeId, l)}`);
  ok((L ?? 0) <= TOWN[id as TownId].max, `${id} above its max`);
}
const isl = game.world.islands[h.island];
const slotsUsed = h.buildings.reduce((a, b) => a + BUILDINGS[b.id as BuildingId].slots, 0);
ok(slotsUsed <= ownedSlots(h, isl), `slots ${slotsUsed} of ${ownedSlots(h, isl)}`);
const plots = [...h.buildings.map((b) => b.plot), ...y.producers.map((x) => x.plot)];
ok(new Set(plots).size === plots.length && plots.every((x) => x !== undefined && x >= 0 && x < plotCount(game, h)), 'plots');
for (const kind of new Set(y.producers.map((x) => x.kind))) ok(y.producers.filter((x) => x.kind === kind).length <= producerLimit(h.level ?? 1), `too many ${kind}`);
for (const b of h.buildings) if (isTree(b.id)) for (let l = 1; l <= (b.level ?? 1); l++) ok(!treeWhy(h, y, b.id as TreeId, l), `${b.id} ${l}`);

// The site's profile.
const prof = new SiteProfile(game, new SiteRating(game)).get(s.name);
ok(!!prof, 'no site profile');
const out = {
  name: s.name, level: p.level, xp: `${p.xp}/${xpForLevel(p.level)}`, gold: p.gold,
  ship: `${p.loadout.classId} ⚓${ship.shipLevel}, hull ${Math.round(ship.stats.hullMax)}, ${ship.stats.gunsPerSide}×2 ${p.loadout.guns.port}, crew ${ship.crew}/${ship.stats.crewMax}`,
  army: ship.army.map((x) => `${x.u} ${x.n}`).join(', '), might: `${might.toFixed(1)} / ${cap.toFixed(1)}`, power: Math.round(armyPower(ship.army)), picked: `${pickedN}/${pickedMax(s)}`,
  site: prof && { level: prof.level, ship: prof.ship && `${prof.ship.clsName[0]} ⚓${prof.ship.level}`, army: prof.army.stacks.map((x) => `${x.u} ${x.n}`).join(', '), armyPower: prof.army.power, gear: prof.hero.gear.length + (prof.ship?.gear.length ?? 0), stats: prof.stats, island: prof.island && `${prof.island.name[0]} level ${prof.island.level}, town ${prof.island.town.length}, buildings ${prof.island.buildings.length}, producers ${prof.island.producers.length}`, deeds: prof.feats.deeds.length, titles: prof.titles.length, campaign: prof.feats.campaign && `ch ${prof.feats.campaign.ch} ${prof.feats.campaign.at}/${prof.feats.campaign.of}` },
};
console.log(JSON.stringify(out, null, 1));
if (bad.length) {
  console.log(`PROBLEMS (${bad.length}):\n  ${bad.join('\n  ')}`);
  process.exit(2);
}
console.log('ALL GOOD');
process.exit(0);
