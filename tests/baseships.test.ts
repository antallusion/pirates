// The island's own ships and its power (docs/15 items 4–5): the shipyard builds a ship of her own on the base's
// clock; taken out off the island she sails at her station in the squadron and counts in its berths (two of her own
// at most, the hired escorts only in what is left); she grows seasoned from a ship sunk near her and is raised a
// level at the shipyard as far as its level lets; sunk, she is laid up at the island and mended; the merchant adds
// hold, the scout sight, the fisher nets the shoals; the island's power grows with its buildings and its ships and
// its next level asks for it; every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_RES, crewsAt } from '../shared/src/data/base.ts';
import {
  FISH_EVERY, ISLE_POWER, OWN_ROLES, OWN_ROLE_DEFS, OWN_SHIPS_MAX, POWER_CREW, SHIP_POWER, YARD_SHIP_LEVEL, hullFor, merchantHold, nextOwnLevel, ownBuildCost,
  ownRepairCost, ownUpgradeCost, ownXpNext, roleLevels, scoutSight,
} from '../shared/src/data/baseships.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../shared/src/data/estate.ts';
import { levelRange } from '../shared/src/data/shiplevel.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { baseView, crewsOf, powerOf, reckonBase, speedup, yardOf } from '../server/src/game/base.ts';
import type { Yard } from '../server/src/game/base.ts';
import { shipBuild, shipLaunch, shipRecall, shipRepair, shipUpgrade, squadronOf, stepOwnShips } from '../server/src/game/baseships.ts';
import type { OwnShip } from '../server/src/game/baseships.ts';
import { buyIsland, clearOutposts, isleLevelUp, ownIsland } from '../server/src/game/estate.ts';
import { escortSlots, escortsOf, hireEscort, repairFleet } from '../server/src/game/fleet.ts';
import { shoalNear, shoalsOf } from '../server/src/game/fishing.ts';
import type { Holding } from '../server/src/game/holdings.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { extract } from '../tools/i18n-server.ts';
import { SERVER_RU_B } from '../client/src/lang/server.ru.b.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { EN as BASE_EN, RU as BASE_RU } from '../client/src/lang/ui/base.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const MIN = 60_000;
let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function offShore(game: Game, ship: ShipEntity, is: Island): void {
  ship.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 120), y = is.y - Math.cos(a) * (is.radius + 120);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.state.speed = 0;
  ship.region = is.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function owner(game: Game, name = 'Yard Mistress', talents: TalentRanks = {}): { s: PlayerSession; ship: ShipEntity; home: Island; h: Holding; y: Yard } {
  join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 5_000_000;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id))!;
  offShore(game, s.ship!, home);
  assert.equal(buyIsland(game, s, home.id), null);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  h.level = 3;
  for (const g of BASE_RES) y.res[g] = 10_000;
  return { s, ship: s.ship!, home, h, y };
}

function withShipyard(h: Holding, level = 1): void {
  h.buildings.push({ id: 'shipyard', condition: 1, unpaid: false, level });
}

/** Build one of her own ships and finish the work for silver. */
function built(game: Game, s: PlayerSession, y: Yard, role: (typeof OWN_ROLES)[number]): OwnShip {
  assert.equal(shipBuild(game, s, role), null);
  const j = y.jobs.find((x) => x.ship && x.kind === 'build')!;
  assert.equal(speedup(game, s, j.id, 'silver'), null);
  return y.ships!.find((x) => x.id === j.ship)!;
}

const TEN: TalentRanks = { cmd_steady_voice: 3, cmd_fair_share: 2, cmd_officers_mess: 2, cmd_press_gang: 2, cmd_signal_flags: 1 };

test('the data: four roles on hulls of their kind, costs that fit a young yard, levels bounded by the shipyard', () => {
  for (const r of OWN_ROLES) {
    const d = OWN_ROLE_DEFS[r];
    assert.ok(/[а-я]/i.test(d.name[1]) && /[а-я]/i.test(d.text[1]), `${r} in Russian`);
    assert.equal(hullFor(r, 1), d.hulls[0]);
    const lv = roleLevels(r);
    assert.equal(lv[0], 1);
    for (const l of lv) {
      const [lo, hi] = levelRange(hullFor(r, l));
      assert.ok(l >= lo && l <= hi, `${r} ${l}: her hull takes the level`);
    }
    const c = ownBuildCost(r);
    for (const n of Object.values(c.goods)) assert.ok((n ?? 0) <= 150 + 50, 'a level-1 yard holds it');
    assert.ok(c.silver > 0 && c.secs >= 600 && c.secs <= 1800);
    for (const l of lv.slice(1)) {
      const u = ownUpgradeCost(r, l);
      assert.ok(u.secs <= 4 * 3600 && u.silver > c.silver);
      for (const n of Object.values(u.goods)) assert.ok((n ?? 0) <= 150 + 50 * 5 + 250, `${r} ${l} fits a grown yard`);
    }
  }
  assert.deepEqual(OWN_ROLE_DEFS.war.hulls, ['cutter', 'brigantine', 'brig', 'frigate']);
  assert.equal(hullFor('war', 8), 'frigate');
  assert.equal(hullFor('merchant', 7), 'galleon');
  assert.equal(nextOwnLevel('merchant', 5), 7, 'a bigger hull skips a level');
  assert.equal(nextOwnLevel('fisher', 5), null);
  assert.ok(YARD_SHIP_LEVEL.every((l, i) => i === 0 || l > YARD_SHIP_LEVEL[i - 1]));
  assert.ok(ownRepairCost('war', 3, 0, true).secs > ownRepairCost('war', 3, 0, false).secs, 'a sunk hull takes longer');
  assert.equal(ISLE_POWER[2], 0, 'the first step asks no power');
  for (let l = 3; l <= ISLE_MAX; l++) assert.ok(ISLE_POWER[l] > ISLE_POWER[l - 1]);
});

test('the shipyard builds her own ship on the clock, one hull at a time; the builders stay free', () => {
  const game = world();
  const { s, h, y } = owner(game);
  assert.equal(shipBuild(game, s, 'war'), 'Build a shipyard on the island first.');
  withShipyard(h);
  const gold = s.profile!.gold;
  assert.equal(shipBuild(game, s, 'war'), null);
  assert.equal(s.profile!.gold, gold - ownBuildCost('war').silver);
  assert.equal(y.res.timber, 10_000 - OWN_ROLE_DEFS.war.goods.timber!);
  const x = y.ships![0];
  assert.equal(x.state, 'building');
  assert.equal(shipBuild(game, s, 'merchant'), 'The shipyard’s slipway is busy.');
  const v = baseView(game, s)!;
  assert.equal(v.crews.busy, 0, 'the shipwrights are not the builders');
  assert.equal(v.shipyard.ships[0].job?.kind, 'build');
  assert.ok(v.shipyard.offers.every((o) => o.why === 'The shipyard’s slipway is busy.'));
  clock += OWN_ROLE_DEFS.war.secs * 1000 - MIN;
  reckonBase(game, h);
  assert.equal(x.state, 'building');
  clock += MIN;
  reckonBase(game, h);
  assert.equal(x.state, 'home');
  assert.equal(x.classId, 'cutter');
  // A second, finished by a speed-up; no third.
  const m = built(game, s, y, 'merchant');
  assert.equal(m.state, 'home');
  assert.equal(shipBuild(game, s, 'fisher'), `The island keeps ${OWN_SHIPS_MAX} ships of its own.`);
});

test('taken out off the island she sails at her station and counts in the squadron; two of her own at most', () => {
  const game = world();
  const { s, ship, home, h, y } = owner(game, 'Squadron Mistress', { ...TEN, cmd_escort_captain: 1 });
  withShipyard(h);
  const w = built(game, s, y, 'war');
  const m = built(game, s, y, 'merchant');
  assert.equal(escortSlots(s.profile!, ship), 2);
  // Away from the island she cannot be taken out.
  ship.state.x += 20_000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.match(shipLaunch(game, s, w.id)!, /come and lie off it/);
  offShore(game, ship, home);
  // A hired escort takes one of the two berths: then only one of her own goes.
  const port = game.world.ports.find((x) => x.shipyardTier >= 3)!;
  assert.equal(hireEscort(game, s, port, 'cutter'), null);
  assert.equal(shipLaunch(game, s, w.id), null);
  assert.match(shipLaunch(game, s, m.id)!, /squadron is full \(2\)/);
  s.profile!.fleet.escorts = s.profile!.fleet.escorts.filter((e) => e.own);
  assert.equal(shipLaunch(game, s, m.id), null);
  assert.deepEqual(squadronOf(s), { own: 2, hired: 0, berths: 2 });
  assert.match(hireEscort(game, s, port, 'cutter')!, /berths for 2/, 'no hired escort beyond the berths');
  const esc = escortsOf(game, ship);
  assert.equal(esc.length, 2);
  assert.ok(esc.every((e) => e.ownerId === ship.id && s.profile!.fleet.escorts.some((f) => f.id === e.fleetId && f.own)));
  assert.equal(w.state, 'sea');
  // She keeps station in the formation as the flagship sails.
  ship.input = { rudder: 0, sailTarget: 0.6 };
  steps(game, 20 * 20);
  for (const e of escortsOf(game, ship)) assert.ok(Math.hypot(e.state.x - ship.state.x, e.state.y - ship.state.y) < 800, 'kept station');
  // Home again: out of the squadron.
  assert.equal(shipRecall(game, s, w.id), null);
  assert.equal(w.state, 'home');
  assert.equal(escortsOf(game, ship).length, 1);
  assert.equal(squadronOf(s).own, 1);
  // A captain without Command still takes two of her own, and hires none.
  const g2 = world();
  const o2 = owner(g2, 'Plain Captain');
  withShipyard(o2.h);
  const a = built(g2, o2.s, o2.y, 'scout');
  const b = built(g2, o2.s, o2.y, 'fisher');
  assert.equal(escortSlots(o2.s.profile!, o2.ship), 0);
  assert.equal(shipLaunch(g2, o2.s, a.id), null);
  assert.equal(shipLaunch(g2, o2.s, b.id), null);
  assert.equal(escortsOf(g2, o2.ship).length, 2);
  assert.match(hireEscort(g2, o2.s, g2.world.ports.find((x) => x.shipyardTier >= 3)!, 'cutter')!, /commander/);
});

test('she grows seasoned from a ship sunk near her, and the shipyard raises her as far as its level lets', () => {
  const game = world();
  const { s, ship, h, y } = owner(game);
  withShipyard(h);
  const w = built(game, s, y, 'war');
  assert.equal(shipLaunch(game, s, w.id), null);
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 200, ship.state.y, 0);
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  foe.attackers.set(ship.id, game.now);
  foe.hull = 0;
  game.beginSinking(foe);
  assert.ok(w.xp > 0, 'seasoned by the fight');
  assert.match(shipUpgrade(game, s, w.id)!, /Bring her home/);
  assert.equal(shipRecall(game, s, w.id), null);
  assert.match(shipUpgrade(game, s, w.id)!, /more seasoning at sea/);
  w.xp = ownXpNext(w.level);
  assert.equal(shipUpgrade(game, s, w.id), null);
  assert.equal(w.state, 'refit');
  const j = y.jobs.find((x) => x.ship === w.id)!;
  assert.equal(j.level, 2);
  assert.equal(speedup(game, s, j.id, 'silver'), null);
  assert.equal(w.level, 2);
  assert.equal(w.xp, 0);
  assert.equal(w.state, 'home');
  // To the fourth level the shipyard must be raised: and she comes out a brigantine.
  w.level = 3;
  w.xp = ownXpNext(3);
  assert.equal(shipUpgrade(game, s, w.id), 'Raise the shipyard to level 2 first.');
  h.buildings.find((b) => b.id === 'shipyard')!.level = 2;
  assert.equal(shipUpgrade(game, s, w.id), null);
  speedup(game, s, y.jobs.find((x) => x.ship === w.id)!.id, 'silver');
  assert.equal(w.level, 4);
  assert.equal(w.classId, 'brigantine');
  // At sea she sails at her own level, not her captain's.
  assert.equal(shipLaunch(game, s, w.id), null);
  assert.equal(escortsOf(game, ship)[0].shipLevel, 4);
  assert.equal(escortsOf(game, ship)[0].loadout.classId, 'brigantine');
});

test('sunk, she is laid up at the island, counts for nothing, and is mended for time and timber; a port mends her for silver', () => {
  const game = world();
  const { s, ship, h, y } = owner(game);
  withShipyard(h);
  const w = built(game, s, y, 'war');
  const before = powerOf(h);
  assert.equal(shipLaunch(game, s, w.id), null);
  const [e] = escortsOf(game, ship);
  e.hull = 0;
  game.beginSinking(e);
  steps(game, 20 * 12);
  assert.equal(w.state, 'laid_up');
  assert.equal(y.ships!.length, 1, 'not lost');
  assert.equal(s.profile!.fleet.escorts.length, 0);
  assert.equal(powerOf(h), before - SHIP_POWER * w.level);
  assert.match(shipLaunch(game, s, w.id)!, /laid up/);
  const timber = y.res.timber!;
  assert.equal(shipRepair(game, s, w.id), null);
  assert.ok(y.res.timber! < timber, 'timber for the mending');
  const j = y.jobs.find((x) => x.ship === w.id && x.kind === 'repair')!;
  assert.equal(j.end - j.start, ownRepairCost('war', 1, 0, true).secs * 1000);
  clock += j.end - j.start;
  reckonBase(game, h);
  assert.equal(w.state, 'home');
  assert.equal(w.hull, 1);
  assert.equal(powerOf(h), before);
  // Damaged at sea, she is mended in a port's yard for silver.
  assert.equal(shipLaunch(game, s, w.id), null);
  const f = s.profile!.fleet.escorts[0];
  f.hull = 0.5;
  const gold = s.profile!.gold;
  repairFleet(game, s);
  assert.equal(f.hull, 1);
  assert.ok(s.profile!.gold < gold);
});

test('the merchant adds hold, the scout sight, the fisher nets the shoals she passes', () => {
  const game = world();
  const { s, ship, h, y } = owner(game);
  withShipyard(h);
  const m = built(game, s, y, 'merchant');
  const sc = built(game, s, y, 'scout');
  const hold0 = ship.stats.holdVolume, sight0 = ship.stats.detection;
  assert.equal(shipLaunch(game, s, m.id), null);
  assert.equal(shipLaunch(game, s, sc.id), null);
  stepOwnShips(game, s);
  assert.ok(Math.abs(ship.stats.holdVolume - (hold0 + merchantHold(m.classId, m.level))) < 0.5, 'half her hold added');
  assert.ok(Math.abs(ship.stats.detection - sight0 * (1 + scoutSight(sc.level))) < 1, 'her lookouts');
  const v = baseView(game, s)!;
  assert.equal(v.shipyard.ships.find((x) => x.id === m.id)!.bonus.hold, merchantHold(m.classId, m.level));
  // Home again: the hold is her own again.
  shipRecall(game, s, m.id);
  shipRecall(game, s, sc.id);
  stepOwnShips(game, s);
  assert.ok(Math.abs(ship.stats.holdVolume - hold0) < 0.5);
  // The fisher (the scout gives her berth up).
  y.ships = y.ships!.filter((x) => x !== sc);
  const fi = built(game, s, y, 'fisher');
  assert.equal(shipLaunch(game, s, fi.id), null);
  const [ent] = escortsOf(game, ship).filter((e) => e.fleetId === fi.id);
  let sh = shoalsOf(game).find((k) => Math.hypot(k.x - ship.state.x, k.y - ship.state.y) < 3000);
  if (!sh) {
    for (let k = 0; k < 20 && !sh; k++) if (shoalNear(game, ship.state.x, ship.state.y, ship.region)) sh = shoalsOf(game).at(-1);
  }
  assert.ok(sh, 'a shoal to fish');
  ent.state.x = sh!.x;
  ent.state.y = sh!.y;
  ent.lastCombat = -999;
  ship.cargo = {};
  const stock = sh!.stock;
  game.now = Math.ceil(game.now / FISH_EVERY) * FISH_EVERY;
  stepOwnShips(game, s);
  assert.ok(sh!.stock < stock, 'the shoal thins');
  assert.ok(Object.values(ship.cargo).reduce((a, n) => a + (n ?? 0), 0) > 0, 'the catch in her hold');
  assert.ok(fi.xp > 0);
});

test('the island’s power grows with its buildings and its ships; its next level asks for it and opens plots and a crew', () => {
  const game = world();
  const { s, h, y } = owner(game);
  h.level = 2;
  assert.equal(powerOf(h), 0);
  const need = ISLE_LEVELS[3];
  for (const [g, n] of Object.entries(need.goods)) h.store[g as 'planks'] = n ?? 0;
  h.treasury = need.silver;
  assert.match(isleLevelUp(game, s, h.island)!, new RegExp(`power is 0 of the ${ISLE_POWER[3]}`));
  const v0 = baseView(game, s)!;
  assert.equal(v0.power.need, ISLE_POWER[3]);
  assert.match(v0.levelUp!.why!, /power/);
  // A shipyard (1) and a producer (1)…
  withShipyard(h);
  y.producers.push({ kind: 'lumber', plot: 3, level: 1 });
  assert.equal(powerOf(h), 2);
  // …and a ship of her own (three times her level): the island may grow.
  const w = built(game, s, y, 'war');
  assert.equal(powerOf(h), 2 + SHIP_POWER * w.level);
  w.level = 2;
  assert.equal(powerOf(h), 2 + SHIP_POWER * 2);
  assert.ok(powerOf(h) >= ISLE_POWER[3]);
  const plots = baseView(game, s)!.plots;
  assert.equal(isleLevelUp(game, s, h.island), null);
  assert.equal(h.level, 3);
  assert.ok(baseView(game, s)!.plots > plots, 'more plots');
  assert.equal(crewsOf(h), crewsAt(3), 'the second crew at level 3');
  // Great power brings a third crew.
  for (let k = 0; k < 12; k++) y.producers.push({ kind: 'fishery', plot: 10 + k, level: 5 });
  assert.ok(powerOf(h) >= POWER_CREW);
  assert.equal(crewsOf(h), crewsAt(3) + 1);
  assert.equal(baseView(game, s)!.crews.n, crewsAt(3) + 1);
});

test('both languages: every word of the shipyard in English and Russian', () => {
  const table = { ...serverTable(), ...SERVER_RU_B };
  const said = extract().filter((p) => /shipyard|slipway|her station|seasoning|laid up|mend|squadron is full|own ships|power is/i.test(p));
  assert.ok(said.length >= 10, 'the shipyard speaks');
  for (const p of said) assert.ok(table[p], `Russian for ${JSON.stringify(p)}`);
  assert.deepEqual(Object.keys(BASE_RU).sort(), Object.keys(BASE_EN).sort());
  for (const k of Object.keys(BASE_EN).filter((k) => k.startsWith('sy_'))) assert.ok(/[а-яё]/i.test((BASE_RU as Record<string, string>)[k]), `${k} in Russian`);
});
