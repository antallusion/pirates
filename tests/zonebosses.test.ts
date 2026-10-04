// The zone bosses (owner, 2026-10-04: «на каждую зону свой босс… доступны раз в 12 часов… час плавают, соло их убить
// невозможно… убить его абордажем вообще нельзя… с этого корабля падают улучшатели для кораблей… а при абордаже
// кораблей ты получаешь улучшатели именно для героя»; docs/21).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { canBoard, startBoarding } from '../server/src/game/boarding.ts';
import { rollDrop } from '../server/src/game/gear.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { eventViews } from '../server/src/game/events.ts';
import { ZB_NO_BOARD, ZB_SLOTS, rise, zbShares } from '../server/src/game/zonebosses.ts';
import { Database } from '../server/src/persistence/db.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { engage } from '../server/src/game/npc.ts';
import { ZB_LIFE, ZB_MIN_SHARE, ZB_PERIOD, ZB_STAGGER, ZB_WARN, ZONE_BOSSES, zbNextRise, zbOffset, zbSlot, zbSlotStart } from '../shared/src/data/zonebosses.ts';
import { SHIP_CLASSES, SHIP_CLASS_IDS, isZoneBossClass } from '../shared/src/data/ships.ts';
import { LEVEL_RANGE } from '../shared/src/data/shiplevel.ts';
import { CAPTAIN_SLOTS, ITEM_BASES, isShipSlot } from '../shared/src/data/items.ts';
import { REGIONS, REGION_IDS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { averageShip, fairWeather, soloDps, squad } from './balance/zonebosses.ts';
import { duelSea, putSide } from './balance/duel.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

/** A game with the zone bosses' calendar running on a clock of our own. */
function sea(wall: number, db?: Database): { game: Game; db: Database; clock: { wall: number } } {
  const base = db ? { db, game: new Game({ db, auth: new AuthService(db), log: () => {} }) } : makeGame();
  const game = base.game;
  game.directorOn = false;
  game.tacticalBoarding = false;
  quietAdv(game);
  game.zoneBosses.on = true;
  const clock = { wall };
  game.wallNow = () => clock.wall;
  return { game, db: base.db, clock };
}

/** A captain at sea beside a point. */
function captain(game: Game, name: string, x: number, y: number): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.protectedUntil = 0;
  ship.region = REGIONS.black_coast.id;
  game.grid.upsert(ship.id, x, y);
  return { c, s, ship };
}

const world = (c: FakeConn) => c.all('toast').map((t) => t.msg).filter((m) => m.startsWith('WORLD: '));
const SLOT = 4000; // a slot of the calendar far from the epoch

test('eight hulls, one a sea at its own level, never sold, in no list, outside the tree', () => {
  const zb = SHIP_CLASS_IDS.filter(isZoneBossClass);
  assert.equal(zb.length, 8);
  for (const r of REGION_IDS) {
    const def = ZONE_BOSSES[r];
    const cls = SHIP_CLASSES[def.classId];
    assert.equal(def.classId, `zb_${r}`);
    assert.deepEqual(LEVEL_RANGE[def.classId], [def.level, def.level]);
    assert.ok(!cls.purchasable && !cls.premium && !cls.list && !cls.monster, def.classId);
    assert.equal(cls.sprite, `ship.zb_${r}`);
  }
  assert.deepEqual(REGION_IDS.map((r) => ZONE_BOSSES[r].level), [3, 5, 5, 7, 6, 8, 9, 10]);
});

test('the calendar: every 12 hours by the wall clock, the seas 90 minutes apart, an hour at sea', () => {
  assert.equal(ZB_PERIOD, 12 * 3_600_000);
  assert.equal(ZB_STAGGER, 90 * 60_000);
  assert.equal(ZB_LIFE, 60 * 60_000);
  const starts = REGION_IDS.map((r) => zbSlotStart(SLOT, r));
  REGION_IDS.forEach((r, i) => {
    assert.equal(zbOffset(r), i * 90 * 60_000, r);
    assert.equal(zbSlot(starts[i], r), SLOT);
    assert.equal(zbSlot(starts[i] - 1, r), SLOT - 1);
    assert.equal(zbSlotStart(SLOT + 1, r) - starts[i], ZB_PERIOD);
    assert.equal(zbNextRise(starts[i] + 59 * 60_000, r), starts[i], 'still her hour');
    assert.equal(zbNextRise(starts[i] + 61 * 60_000, r), starts[i] + ZB_PERIOD, 'the next');
  });
  // No two seas rise together: every 90 minutes one of them, the eight in the twelve hours.
  for (let i = 1; i < starts.length; i++) assert.equal(starts[i] - starts[i - 1], ZB_STAGGER);
  // On the sea: up at the start of her slot, not a second before.
  const { game, clock } = sea(zbSlotStart(SLOT, 'gravewater') - 1000);
  steps(game, 25);
  assert.equal(game.zoneBosses.live.get('gravewater'), undefined);
  clock.wall += 2000;
  steps(game, 25);
  const live = game.zoneBosses.live.get('gravewater')!;
  assert.ok(live, 'risen');
  const ship = game.ships.get(live.id)!;
  assert.equal(ship.loadout.classId, 'zb_gravewater');
  assert.equal(ship.shipLevel, 5);
  assert.equal(ship.npcRole, 'boss');
  assert.deepEqual(ship.zoneBoss, { region: 'gravewater', slot: SLOT, endsAt: zbSlotStart(SLOT, 'gravewater') + ZB_LIFE });
  assert.equal(ship.region, 'gravewater');
  assert.ok(!game.npcs.has(ship.id), 'no LOD brain: she is always awake');
  // She sails her sea with nobody near (no LOD puts her to sleep).
  const x0 = ship.state.x, y0 = ship.state.y;
  steps(game, 20 * 60);
  assert.ok(Math.hypot(ship.state.x - x0, ship.state.y - y0) > 100, 'she sails');
  assert.equal(ship.region, 'gravewater');
});

test('fifteen minutes ahead the world hears of her; as she rises, and as she leaves into the fog', () => {
  const start = zbSlotStart(SLOT, 'whispering');
  const { game, clock } = sea(start - ZB_WARN - 2000);
  const { c } = captain(game, 'Lookout', 21000, 79000);
  steps(game, 25);
  assert.ok(!world(c).some((m) => m.includes('The Fog Mother')), 'not yet');
  clock.wall = start - ZB_WARN + 1000;
  steps(game, 25);
  steps(game, 25);
  const warn = world(c).filter((m) => m.startsWith('WORLD: On the horizon of Whispering Archipelago: The Fog Mother sets sail in'));
  assert.equal(warn.length, 1, 'once');
  assert.match(warn[0], /in 15 min\.$/);
  clock.wall = start + 500;
  steps(game, 25);
  assert.ok(world(c).includes('WORLD: The Fog Mother has risen in Whispering Archipelago. Captains, to her! Guns only — she leaves in an hour.'));
  const live = game.zoneBosses.live.get('whispering')!;
  // Her mark on the chart: her name, the time till she leaves.
  const mark = eventViews(game).find((e) => e.kind === 'zone_boss')!;
  assert.equal(mark.title, 'The Fog Mother');
  assert.equal(mark.region, 'whispering');
  assert.ok(Math.abs(mark.endsIn - 3600) <= 2, `${mark.endsIn}`);
  // Her hour is up: she goes into the fog, and does not rise again in the same slot.
  clock.wall = live.endsAt + 1000;
  steps(game, 25);
  assert.ok(!game.ships.has(live.id), 'gone');
  assert.ok(world(c).includes('WORLD: The Fog Mother has gone into the fog of Whispering Archipelago, unbeaten.'));
  assert.ok(!eventViews(game).some((e) => e.kind === 'zone_boss'));
  steps(game, 25);
  assert.equal(game.zoneBosses.live.get('whispering'), undefined);
});

test('a slain slot is kept: a restart in the same hour does not raise her again; the next slot does', () => {
  const start = zbSlotStart(SLOT, 'black_coast');
  const { game, db, clock } = sea(start + 1000);
  steps(game, 25);
  const live = game.zoneBosses.live.get('black_coast')!;
  const boss = game.ships.get(live.id)!;
  const { ship } = captain(game, 'Gunner', boss.state.x + 400, boss.state.y);
  applyDamage(game, boss, { hull: boss.hull + 10 }, ship);
  assert.ok(boss.sinkingUntil > 0, 'she goes down');
  assert.deepEqual(db.getKv<{ slot: number }>('zboss:black_coast')?.slot, SLOT);
  // No wreck of her: the spoils are by letter and into the locker.
  assert.ok(![...game.loot.values()].some((l) => Math.hypot(l.x - boss.state.x, l.y - boss.state.y) < 50 && !l.ownerOnly), 'no wreckage');
  // The server restarts within her hour: the same database, a new game.
  const again = sea(clock.wall + 60_000, db);
  steps(again.game, 25);
  assert.equal(again.game.zoneBosses.live.get('black_coast'), undefined, 'not twice in a slot');
  // A restart while she sails (not slain) raises her again for the rest of her hour.
  const wg = sea(zbSlotStart(SLOT, 'gravewater') + 10 * 60_000, db);
  steps(wg.game, 25);
  const g = wg.game.zoneBosses.live.get('gravewater')!;
  assert.ok(g && g.endsAt === zbSlotStart(SLOT, 'gravewater') + ZB_LIFE);
  // The next slot she rises again.
  const next = sea(zbSlotStart(SLOT + 1, 'black_coast') + 1000, db);
  steps(next.game, 25);
  assert.ok(next.game.zoneBosses.live.get('black_coast'), 'the next slot');
  // A server raises only the bosses of its own zone's seas.
  const zoned = sea(start + 1000);
  (zoned.game as unknown as { zone: unknown }).zone = { regions: new Set<RegionId>(['gravewater']), inZone: () => true, afterStep: () => {} };
  assert.deepEqual(zoned.game.zoneBosses.regions(zoned.game), ['gravewater']);
  zoned.game.zoneBosses.second(zoned.game); // the Black Coast's hour, on a server of Gravewater alone
  assert.equal(zoned.game.zoneBosses.live.get('black_coast'), undefined);
});

test('her decks cannot be taken: no grapples, whatever the way', () => {
  const { game, clock } = sea(zbSlotStart(SLOT, 'black_coast') + 1000);
  steps(game, 25);
  const boss = game.ships.get(game.zoneBosses.live.get('black_coast')!.id)!;
  const { c, ship } = captain(game, 'Boarder', boss.state.x + 30, boss.state.y);
  ship.state.speed = boss.state.speed;
  assert.equal(canBoard(game, ship, boss), ZB_NO_BOARD);
  assert.equal(ZB_NO_BOARD, 'Her decks cannot be taken — guns only');
  c.push({ t: 'board', target: boss.id, aggression: 'standard' });
  assert.equal(ship.boarding, null);
  assert.ok(c.all('err').some((e) => e.msg === ZB_NO_BOARD) || c.all('toast').some((t) => t.msg === ZB_NO_BOARD), 'told why');
  startBoarding(game, ship, boss, 'standard');
  assert.equal(ship.boarding, null, 'no other path either');
  assert.equal(boss.boarding, null);
  void clock;
});

test('each captain\'s part: the hull her guns took off, by account (an escort\'s to her captain)', () => {
  const { game } = sea(zbSlotStart(SLOT, 'black_coast') + 1000);
  steps(game, 25);
  const live = game.zoneBosses.live.get('black_coast')!;
  const boss = game.ships.get(live.id)!;
  const a = captain(game, 'Anna', boss.state.x + 400, boss.state.y);
  const b = captain(game, 'Bram', boss.state.x - 400, boss.state.y);
  const escort = game.spawnNpcShip('escort', 'brig', 'free', boss.state.x, boss.state.y + 400, 0);
  escort.ownerId = b.ship.id;
  applyDamage(game, boss, { hull: 1000 }, a.ship);
  applyDamage(game, boss, { hull: 300 }, b.ship);
  applyDamage(game, boss, { hull: 200 }, escort);
  applyDamage(game, boss, { hull: 50 }, null); // the sea's own: nobody's part
  assert.equal(live.contrib.get(a.s.accountId)!.dmg, 1000);
  assert.equal(live.contrib.get(b.s.accountId)!.dmg, 500);
  assert.equal(live.contrib.size, 2);
  // Her broadsides answer those who fired on her, the round spread over them all.
  const hullA = a.ship.hull, hullB = b.ship.hull;
  steps(game, 20 * 10);
  assert.ok(a.ship.hull < hullA && b.ship.hull < hullB, 'both under her guns');
  const quiet = captain(game, 'Bystander', boss.state.x, boss.state.y - 500);
  const h0 = quiet.ship.hull;
  steps(game, 20 * 10);
  assert.equal(quiet.ship.hull, h0, 'one who never fired on her is let be');
});

test('the spoils: 2% earns a share of ship gear (the best part a second piece), experience and silver by the part', () => {
  const def = ZONE_BOSSES.gravewater;
  const parts = new Map([[1, { name: 'A', dmg: 600 }], [2, { name: 'B', dmg: 380 }], [3, { name: 'C', dmg: 19.9 }], [4, { name: 'D', dmg: 0.1 }]]);
  const shares = zbShares(def, parts);
  assert.deepEqual(shares.map((x) => [x.account, x.items]), [[1, 2], [2, 1]], 'C (1.99%) and D get nothing');
  assert.ok(Math.abs(shares[0].share - 0.6) < 1e-9);
  assert.equal(shares[0].xp, Math.round(def.xp * 0.6));
  assert.equal(shares[1].silver, Math.round(def.silver * 0.38));
  assert.equal(ZB_MIN_SHARE, 0.02);
  assert.ok(zbShares(def, new Map([[5, { name: 'E', dmg: 2 }], [6, { name: 'F', dmg: 98 }]])).some((x) => x.account === 5), '2% exactly is a share');
  // On the sea: three captains fire on her, she sinks.
  const { game } = sea(zbSlotStart(SLOT, 'gravewater') + 1000);
  steps(game, 25);
  const live = game.zoneBosses.live.get('gravewater')!;
  const boss = game.ships.get(live.id)!;
  const cs = ['Top', 'Mid', 'Tail'].map((n, i) => captain(game, n, boss.state.x + 300 + i * 50, boss.state.y));
  const stash0 = cs.map((x) => x.s.profile!.stash.length);
  const xp0 = cs.map((x) => x.s.profile!.xp);
  const wall0 = game.wallNow();
  applyDamage(game, boss, { hull: boss.hull * 0.6 }, cs[0].ship);
  applyDamage(game, boss, { hull: boss.hull * 0.99 }, cs[1].ship);
  applyDamage(game, boss, { hull: boss.hull + 1 }, cs[2].ship); // the last blow, a sliver of her
  assert.ok(boss.sinkingUntil > 0);
  const total = [...live.contrib.values()].reduce((a, p) => a + p.dmg, 0);
  assert.ok(live.contrib.get(cs[2].s.accountId)!.dmg / total < 0.02, 'the last blow is under 2%');
  const got = cs.map((x, i) => x.s.profile!.stash.slice(stash0[i]));
  assert.equal(got[0].length, 2, 'the best part: two pieces');
  assert.equal(got[1].length, 1, 'the second: one');
  assert.equal(got[2].length, 0, 'the last blow alone earns nothing');
  for (const it of [...got[0], ...got[1]]) {
    const slot = ITEM_BASES[it.base].slot;
    assert.ok(isShipSlot(slot) && slot !== 'tackle' && ZB_SLOTS.includes(slot), `${it.base}: ship gear`);
    assert.equal(it.ilvl, 5, 'at her level');
  }
  assert.ok(cs[0].s.profile!.xp > xp0[0] || cs[0].s.profile!.level > 1, 'experience by the part');
  const letters = lettersSince(game, cs[0].s.accountId, wall0);
  const l = letters.find((x) => x.subject === 'The spoils of The Gilded Leviathan')!;
  assert.ok(l && l.gold > 0, 'the prize money by letter');
  assert.ok(cs[0].c.all('toast').some((t) => /^The Gilded Leviathan is sunk! Your part \d+%, \+\d+ XP, ship gear ×2, prize money by letter\.$/.test(t.msg)));
  assert.ok(world(cs[0].c).some((m) => m.startsWith('WORLD: The Gilded Leviathan is sunk in Gravewater Sea by ')));
});

test('boarding gives the captain\'s gear, the guns the ship\'s (docs/21 §5)', () => {
  const { game } = makeGame();
  for (let i = 0; i < 30; i++) {
    const npc = game.spawnNpcShip(['pirate', 'merchant', 'patrol', 'hunter', 'ghost'][i % 5] as 'pirate', 'brig', 'confederacy', 30_000, 30_000, 0);
    npc.elite = true;
    const sunk = rollDrop(game, npc, 'sunk')!, taken = rollDrop(game, npc, 'boarded')!;
    assert.ok(isShipSlot(ITEM_BASES[sunk.base].slot) && ITEM_BASES[sunk.base].slot !== 'tackle', `guns: ${sunk.base}`);
    assert.ok((CAPTAIN_SLOTS as string[]).includes(ITEM_BASES[taken.base].slot), `boarding: ${taken.base}`);
    game.removeShip(npc.id);
  }
});

test('the squad sim (docs/21 §4): ten sink her in 15–20 min, five in 35–45, one alone never — and sinks', () => {
  const rows: string[] = [];
  for (const r of REGION_IDS) {
    const def = ZONE_BOSSES[r];
    const dps = soloDps(r);
    const ship = averageShip(def.level);
    const hull = SHIP_CLASSES[def.classId].hull;
    const ten = squad(def, hull, 10, dps, ship), five = squad(def, hull, 5, dps, ship), one = squad(def, hull, 1, dps, ship);
    rows.push(`${r} ⚓${def.level}: ${dps.toFixed(2)}/s · 10 → ${(ten.killSec! / 60).toFixed(1)} min · 5 → ${(five.killSec! / 60).toFixed(1)} min · 1 sinks at ${(one.sunkSec! / 60).toFixed(1)} min`);
    assert.ok(ten.killSec !== null && ten.killSec >= 15 * 60 && ten.killSec <= 20 * 60, `${r}: ten in ${ten.killSec}s`);
    assert.equal(ten.alive, 10, `${r}: the ten live`);
    assert.ok(five.killSec !== null && five.killSec >= 35 * 60 && five.killSec <= 45 * 60, `${r}: five in ${five.killSec}s`);
    assert.equal(five.alive, 5, `${r}: the five live`);
    assert.ok(five.hullLost > 0.3 && five.hullLost < 0.9, `${r}: five hard pressed (${five.hullLost})`);
    assert.equal(one.killSec, null, `${r}: one alone never sinks her`);
    assert.ok(one.sunkSec !== null && one.sunkSec < 3600, `${r}: one alone sinks`);
  }
  console.log(rows.join('\n'));
});

test('one alone on the real sea: an average captain on an average ship of her level sinks, and she sails on', () => {
  const game = duelSea();
  fairWeather(game);
  game.zoneBosses.on = false;
  const boss = rise(game, 'gravewater', 0, game.wallNow() + ZB_LIFE)!;
  const { cls } = averageShip(5);
  const me = putSide(game, { cls, level: 5, craft: 'average' }, boss.state.x + 1100, boss.state.y, Math.PI * 1.5);
  me.ship.accountId = 9001;
  const t0 = game.now;
  let next = 0;
  while (game.now - t0 < 3600 && me.ship.alive && boss.alive) {
    if (game.now >= next) {
      next = game.now + 1;
      engage(game, me.ship, me.brain, boss, Math.hypot(boss.state.x - me.ship.state.x, boss.state.y - me.ship.state.y));
    }
    game.step();
  }
  assert.ok(!me.ship.alive || me.ship.sinkingUntil > 0, 'he sinks');
  assert.ok(boss.alive && boss.hull > boss.stats.hullMax * 0.7, `she sails on (${Math.round((boss.hull / boss.stats.hullMax) * 100)}%)`);
  assert.ok(game.now - t0 < 30 * 60, `within the half hour (${Math.round(game.now - t0)} s)`);
});

test('the admin\'s hand: /zboss in HELP in both tongues, command for command; rise, here, leave, kill, announce', () => {
  const { game, clock } = sea(zbSlotStart(SLOT, 'black_coast') + ZB_LIFE + 60_000); // between her hours
  const { c, s, ship } = captain(game, 'Admiral', 22000, 78000);
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.includes('/zboss [region] [rise|here|leave|kill|announce|reset]'));
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the Russian HELP');
  assert.equal(ru.split(' · ').length, help.split(' · ').length, 'command for command');
  assert.ok(ru.includes('/zboss [море] [rise|here|leave|kill|announce|reset]'));
  assert.match(runAdmin(game, s, '/zboss')!, /^Zone bosses: \d+ at sea of 8\.$/);
  assert.match(runAdmin(game, s, '/zboss black_coast here')!, /^The Iron Lion rises in The Black Coast/);
  const live = game.zoneBosses.live.get('black_coast')!;
  const boss = game.ships.get(live.id)!;
  assert.ok(Math.hypot(boss.state.x - ship.state.x, boss.state.y - ship.state.y) < 1500, 'beside her');
  assert.ok(c.all('film').some((f) => f.id === 'cut_zboss_black_coast'), 'her film, to a captain in her sea');
  assert.equal(runAdmin(game, s, '/zboss black_coast rise'), 'The Iron Lion is already at sea.');
  assert.equal(runAdmin(game, s, '/zboss black_coast leave'), 'The Iron Lion goes into the fog.');
  assert.equal(game.zoneBosses.live.get('black_coast'), undefined);
  runAdmin(game, s, '/zboss black_coast here');
  const stash = s.profile!.stash.length;
  assert.equal(runAdmin(game, s, '/zboss black_coast kill'), 'The Iron Lion is sunk by your guns alone.');
  assert.equal(s.profile!.stash.length, stash + 2, 'the whole part: two pieces');
  assert.equal(runAdmin(game, s, '/zboss black_coast announce'), 'The Iron Lion: announced.');
  assert.ok(world(c).some((m) => m.startsWith('WORLD: On the horizon of The Black Coast: The Iron Lion')));
  assert.equal(runAdmin(game, s, '/zboss black_coast reset'), 'The Iron Lion: her slain slot is forgotten.');
  void clock;
});

test('her lines read in Russian', () => {
  setLang('ru');
  applyDataLocale('ru');
  try {
    const lines = [
      'WORLD: On the horizon of The Black Coast: The Iron Lion sets sail in 15 min.',
      'WORLD: The Fog Mother has risen in Whispering Archipelago. Captains, to her! Guns only — she leaves in an hour.',
      'WORLD: The Abyssal Ark has gone into the fog of The Abyss, unbeaten.',
      'WORLD: The White Harrow is sunk in Leviathan Reach by Anna, Bram +3.',
      'Her decks cannot be taken — guns only',
      'The Cinder Throne is sunk! Your part 12%, +4100 XP, ship gear ×2, prize money by letter.',
      'A letter from The Admiralty Prize Court: “The spoils of The Iron Lion” — 8450 silver enclosed. [Y]',
      'The spoils of The Drowned Regent',
      'Your part of her: 12%. Pieces of ship gear taken from her: 1. Your share of her prize money is enclosed.',
      'The Admiralty Prize Court',
      'The Gilded Leviathan sails Gravewater Sea.',
      "The Iron Lion was sunk in The Black Coast by Anna.",
      'The Iron Lion lies on the bottom of The Black Coast.',
      'Zone bosses: 1 at sea of 8.',
      'The Gilded Leviathan: at sea, 54% hull, 37 min left',
      'The Iron Lion: rises in 640 min',
      'The Iron Lion is already at sea.',
      'The Iron Lion is not at sea.',
      'The Iron Lion rises in The Black Coast: an hour at sea.',
      'The Iron Lion goes into the fog.',
      'The Iron Lion is sunk by your guns alone.',
      'The Iron Lion: announced.',
      'The Iron Lion: her slain slot is forgotten.',
      'Usage: /zboss [region] [rise|here|leave|kill|announce|reset]',
    ].map((l) => serverText(l));
    // (the names of captains stay as they are)
    assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Anna|Bram|\/zboss|rise\|here\|leave\|kill\|announce\|reset|\[Y\]/g, ''))), []);
    assert.equal(serverText('Her decks cannot be taken — guns only').replace(/ /g, ' '), 'Её не взять на абордаж — только пушками');
    for (const r of REGION_IDS) assert.doesNotMatch(serverText(SHIP_CLASSES[ZONE_BOSSES[r].classId].name), /[A-Za-z]/, r);
    // QA, 2026-10-04: «Письмо от Призовой суд Адмиралтейства» — the sender after «от» stays in the nominative; the
    // sender's name stands after a colon, for every sender.
    for (const from of ['The Admiralty Prize Court', 'The Auction House', 'The Harbour Master', 'The League Bounty Office', 'The sea', 'Your supply routes']) {
      const ru = serverText(`A letter from ${from}: “The spoils of The Iron Lion” — 8450 silver enclosed. [Y]`);
      assert.match(ru, /^Письмо: [^:]+\. «/, ru);
      assert.doesNotMatch(ru, /Письмо от/, ru);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
