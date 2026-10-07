// Any island for one's own and the raids on a rich one (docs/15 items 6–7): any wild island may be claimed (not a
// port's, not held, not worked, not a lair, not the Abyss), one a captain, priced by its size and waters; the week's
// tax by the waters and the island's level, from its treasury, and its buildings weathering when it goes unpaid;
// moving house for half the price back and a wait; robbers in lawless water under the black flag. Raids: only on a
// fat island outside safe water; ten minutes' warning (toast, letter, the HUD's pointer) while their ships lie off the
// island; driven off by the owner for their plunder; otherwise held by the island's batteries, fort and her own ships
// lying there by the odds, or lost — a share of the yard and store, capped in a day, and a building weathered.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABANDON_COOLDOWN_H, ABANDON_REFUND, AWAY_MUL, LOSS_DAY_CAP, RAID_LOSS, ROB_ISLE_SEC, TAX_DAYS, TAX_WEATHER, WATERS, claimPrice, fatMark, isleDefence, isleTax, raidDayOdds,
  raidOdds, raidPrize, raidStrength,
} from '../shared/src/data/baseclaim.ts';
import type { Waters } from '../shared/src/data/baseclaim.ts';
import { BASE_RES, baseCost, maxLevel } from '../shared/src/data/base.ts';
import { islandSize } from '../shared/src/data/holdings.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { baseView, yardOf } from '../server/src/game/base.ts';
import {
  abandonIsland, claimOf, claimPrompt, defenceOf, isleWorth, raidChance, raidNow, raidPointer, robIsland, startIsleRaid, stepIsleClaim, stepIsleRobbers,
} from '../server/src/game/baseclaim.ts';
import type { OwnShip } from '../server/src/game/baseships.ts';
import { buyIsland, buyPrice, clearOutposts, estateView, foundOutpost, ownIsland } from '../server/src/game/estate.ts';
import { rentIsland } from '../server/src/game/holdings.ts';
import type { Holding } from '../server/src/game/holdings.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { OUTPOST_BUILD, OUTPOST_KINDS, outpostFits } from '../shared/src/data/estate.ts';
import { extract } from '../tools/i18n-server.ts';
import { SERVER_RU_B } from '../client/src/lang/server.ru.b.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { EN as BASE_EN, RU as BASE_RU } from '../client/src/lang/ui/base.ts';
import { EN as CO_EN, RU as CO_RU } from '../client/src/lang/ui/company.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const HOUR = 3_600_000;
const DAY = 86_400_000;
let clock = 20_000 * DAY;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * DAY + 3 * HOUR;
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

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 3_000_000;
  return { c, s, ship: s.ship! };
}

function wild(game: Game, pred: (is: Island) => boolean): Island {
  const is = game.world.islands.find((i) => !i.portId && i.radius > 150 && pred(i) && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && i.region !== 'the_abyss');
  assert.ok(is, 'a wild island');
  return is!;
}

const inWaters = (w: Waters) => (i: Island) => REGIONS[i.region].safety === w;

/** A captain with an island of her own in the given waters, lying off it. */
function owner(game: Game, w: Waters, name = 'Isle Claimant'): { c: FakeConn; s: PlayerSession; ship: ShipEntity; isl: Island; h: Holding } {
  const cap = captain(game, name);
  const isl = wild(game, inWaters(w));
  offShore(game, cap.ship, isl);
  assert.equal(buyIsland(game, cap.s, isl.id), null);
  return { ...cap, isl, h: ownIsland(game, cap.s.accountId)! };
}

function fatten(game: Game, h: Holding): void {
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = 200;
  assert.ok(isleWorth(h) >= fatMark(h.level ?? 1), 'fat');
}

test('the terms by the waters: safe dear and taxed and never raided, contested between, lawless cheap and dangerous', () => {
  for (const size of ['small', 'medium', 'large'] as const) {
    assert.ok(claimPrice(size, 'safe') > claimPrice(size, 'contested') && claimPrice(size, 'contested') > claimPrice(size, 'lawless'), `${size}: dear, middling, cheap`);
  }
  assert.ok(claimPrice('large', 'lawless') > claimPrice('small', 'safe') / 2, 'size tells too');
  assert.ok(isleTax('safe', 3) > isleTax('contested', 3) && isleTax('contested', 3) > 0 && isleTax('lawless', 3) === 0);
  assert.equal(isleTax('safe', 4), 4 * isleTax('safe', 1), 'by the island level');
  assert.equal(WATERS.safe.raidDay, 0);
  assert.equal(raidStrength('safe', 5), 0);
  assert.ok(WATERS.lawless.raidDay > WATERS.contested.raidDay && raidStrength('lawless', 3) > raidStrength('contested', 3), 'oftener and stronger in lawless water');
  assert.ok(WATERS.lawless.raiders > WATERS.contested.raiders);
  assert.ok(raidDayOdds('contested') > 0.3 && raidDayOdds('contested') < 0.6 && raidDayOdds('lawless') < 0.9);
  assert.ok(WATERS.lawless.robbable && !WATERS.contested.robbable && !WATERS.safe.robbable);
  assert.ok(fatMark(5) > fatMark(1), 'the mark grows with the island');
  // The defence odds (after the caravans'): nothing to put up holds nothing; more holds more, to a cap.
  assert.equal(raidOdds(0, 10), 0);
  assert.ok(raidOdds(5, 10) < raidOdds(10, 10) && raidOdds(10, 10) < raidOdds(40, 10));
  assert.ok(raidOdds(1000, 10) <= 0.92 && raidOdds(1, 1000) >= 0.1);
  assert.ok(raidOdds(10, 10, 0.5) > raidOdds(10, 10), 'raiders sunk before they land count no more');
  assert.equal(isleDefence({ batteries: [{ level: 2, condition: 1 }], forts: [], ships: [] }), 6);
  assert.ok(isleDefence({ batteries: [], forts: [{ level: 1, condition: 1 }], ships: [{ level: 5, hull: 1 }] }) > isleDefence({ batteries: [{ level: 1, condition: 1 }], forts: [], ships: [] }));
  // Batteries and forts are raised by level at the base, their costs fitting the yard.
  assert.equal(maxLevel('battery'), 5);
  assert.equal(maxLevel('fort'), 5);
  assert.ok(baseCost('fort', 3).silver > baseCost('battery', 3).silver);
});

test('any wild island may be claimed — a lawless one, cheap — but not a port’s, another’s, a worked one, the Abyss; one a captain', () => {
  const game = world();
  const { c, s, ship, isl, h } = owner(game, 'lawless');
  assert.ok(h.owned && h.claim, 'hers for ever, with its claim kept');
  assert.equal(h.claim!.paid, buyPrice(isl));
  assert.equal(buyPrice(isl), claimPrice(islandSize(isl.radius), 'lawless'));
  assert.ok(c.all('toast').some((t) => t.msg.includes('is yours for ever')));
  // One a captain.
  const other = wild(game, (i) => i.id !== isl.id && inWaters('contested')(i));
  offShore(game, ship, other);
  assert.equal(buyIsland(game, s, other.id), 'A captain may hold one island of their own');
  // Another's island.
  const { s: b, ship: bs } = captain(game, 'Second Claimant');
  offShore(game, bs, isl);
  assert.equal(buyIsland(game, b, isl.id), `${isl.name} is held by ${s.name}.`);
  // A port's island.
  const port = game.world.islands.find((i) => i.portId)!;
  assert.equal(buyIsland(game, b, port.id), 'No such island');
  // An island an outpost works.
  const site = wild(game, (i) => i.id !== other.id && inWaters('contested')(i) && OUTPOST_KINDS.some((k) => outpostFits(k, i)));
  offShore(game, ship, site);
  ship.cargo = { ...OUTPOST_BUILD } as never;
  assert.equal(foundOutpost(game, s, OUTPOST_KINDS.find((k) => outpostFits(k, site))!), null);
  offShore(game, bs, site);
  assert.equal(buyIsland(game, b, site.id), 'Someone already works this island.');
  // The Abyss.
  const abyss = game.world.islands.find((i) => !i.portId && i.region === 'the_abyss');
  if (abyss) {
    offShore(game, bs, abyss);
    assert.equal(buyIsland(game, b, abyss.id), 'Nobody claims land in the Abyss.');
  }
  // The terms off the bow, and the prompt: a claimable island, its price and waters.
  offShore(game, bs, other);
  const v = estateView(game, b);
  assert.ok(v.claim && v.claim.island === other.id && v.claim.waters === 'contested' && v.claim.why === null);
  assert.equal(v.claim!.price, claimPrice(islandSize(other.radius), 'contested'));
  assert.equal(v.claim!.tax, WATERS.contested.tax);
  assert.ok(v.claim!.raidDay > 0 && !v.claim!.robbable);
  assert.deepEqual(claimPrompt(game, b), { island: other.id, name: other.name, price: v.claim!.price, waters: 'contested' });
  const g0 = b.profile!.gold;
  assert.equal(buyIsland(game, b, other.id), null);
  assert.equal(g0 - b.profile!.gold, claimPrice(islandSize(other.radius), 'contested'), 'paid by size and waters');
  assert.equal(claimPrompt(game, b), null, 'no prompt once she has one');
  // A lease bought out counts what is left of it.
  const { s: l, ship: ls } = captain(game, 'Lease Buyer');
  const leased = wild(game, (i) => inWaters('safe')(i) && !game.holdings.get(game, i.id) && i.region === 'black_coast' && islandSize(i.radius) !== 'large');
  offShore(game, ls, leased);
  assert.equal(rentIsland(game, l, leased.id, 30), null);
  const t = estateView(game, l).claim!;
  assert.ok(t.credit > 0 && t.price < claimPrice(islandSize(leased.radius), 'safe'));
});

test('the week’s tax: from the treasury by the island level in safe and contested water; unpaid, the buildings weather; none in lawless water', () => {
  const game = world();
  const { c, s, h } = owner(game, 'contested');
  h.level = 3;
  h.buildings.push({ id: 'warehouse', condition: 1, unpaid: false, level: 1 });
  h.treasury = 5000;
  clock += TAX_DAYS * DAY + HOUR;
  h.lastUpkeep = clock; // the buildings' own upkeep apart
  stepIsleClaim(game, h);
  assert.equal(h.treasury, 5000 - isleTax('contested', 3), 'paid a week');
  assert.equal(h.claim!.unpaid, 0);
  const v = baseView(game, s)!;
  assert.equal(v.claim.waters, 'contested');
  assert.equal(v.claim.tax, isleTax('contested', 3));
  assert.ok(v.claim.taxAt > clock);
  // Unpaid.
  h.treasury = 10;
  clock += TAX_DAYS * DAY;
  h.lastUpkeep = clock;
  stepIsleClaim(game, h);
  assert.equal(h.treasury, 10, 'nothing taken it could not pay');
  assert.equal(h.claim!.unpaid, 1);
  assert.ok(Math.abs(h.buildings[0].condition - (1 - TAX_WEATHER)) < 1e-9, 'weathered');
  assert.ok(c.all('toast').some((t) => t.msg.endsWith('the week’s tax is unpaid')));
  // Lawless: none.
  const { h: lh } = owner(game, 'lawless', 'Free Holder');
  lh.treasury = 1000;
  clock += TAX_DAYS * DAY;
  stepIsleClaim(game, lh);
  assert.equal(lh.treasury, 1000);
  assert.equal(lh.claim!.unpaid, 0);
});

test('moving house: half the price back, the island left behind, another only after the wait; not while raiders lie off it', () => {
  const game = world();
  const { s, ship, isl, h } = owner(game, 'contested');
  const paid = h.claim!.paid;
  // Not with her own ship at sea.
  yardOf(game, h).ships = [{ id: 'o1', role: 'war', classId: 'cutter', level: 2, xp: 0, name: 0, hull: 1, state: 'sea' } as OwnShip];
  assert.equal(abandonIsland(game, s), 'Bring your own ships home to the island first.');
  yardOf(game, h).ships = [];
  // Not during a raid.
  assert.equal(startIsleRaid(game, h), null);
  assert.equal(abandonIsland(game, s), 'Not while raiders lie off the island.');
  for (const id of h.claim!.raid!.ships) game.removeShip(id);
  h.claim!.raid = null;
  const g0 = s.profile!.gold;
  assert.equal(abandonIsland(game, s), null);
  assert.equal(s.profile!.gold - g0, Math.round(paid * ABANDON_REFUND));
  assert.equal(ownIsland(game, s.accountId), undefined);
  assert.equal(game.holdings.get(game, isl.id), undefined, 'the island is wild again');
  // The wait.
  const next = wild(game, (i) => i.id !== isl.id && inWaters('lawless')(i));
  offShore(game, ship, next);
  assert.match(buyIsland(game, s, next.id)!, /^You may claim another island in \d+ h\.$/);
  clock += ABANDON_COOLDOWN_H * HOUR + 1;
  assert.equal(buyIsland(game, s, next.id), null);
});

test('raids come only for a fat island outside safe water, rarer while the owner is long away, never in the cooldown', () => {
  const game = world();
  const { h: safe } = owner(game, 'safe', 'Crown Tenant');
  const { h: cont } = owner(game, 'contested', 'Border Holder');
  for (const h of [safe, cont]) claimOf(game, h).calmUntil = 0;
  assert.equal(raidChance(game, cont), 0, 'a lean island draws nobody');
  fatten(game, safe);
  fatten(game, cont);
  assert.equal(raidChance(game, safe), 0, 'never in safe water');
  assert.equal(startIsleRaid(game, safe), 'Safe water: the Crown’s patrols keep raiders off the island.');
  const near = raidChance(game, cont);
  assert.ok(near > 0);
  claimOf(game, cont).seen = clock - 13 * HOUR;
  assert.ok(Math.abs(raidChance(game, cont) - near * AWAY_MUL) < 1e-12, 'a quarter as often while she is long away');
  claimOf(game, cont).seen = clock;
  claimOf(game, cont).calmUntil = clock + HOUR;
  assert.equal(raidChance(game, cont), 0, 'the cooldown');
  claimOf(game, cont).calmUntil = 0;
  // By the hour on the clock (the sea's director at work): contested water comes in time, safe water never.
  game.directorOn = true;
  let hours = 0;
  for (; hours < 2000 && !cont.claim!.raid; hours++) {
    clock += HOUR;
    for (const h of [safe, cont]) {
      h.lastUpkeep = clock;
      fatten(game, h);
      stepIsleClaim(game, h);
    }
  }
  assert.ok(cont.claim!.raid, `raiders came to the contested island (${hours} h)`);
  assert.equal(safe.claim!.raid, null, 'and never to the safe one');
});

test('a raid: warning toast and letter, their ships off the island, the HUD’s pointer; driven off, their plunder is hers', () => {
  const game = world();
  const { c, s, ship, isl, h } = owner(game, 'contested');
  fatten(game, h);
  assert.equal(startIsleRaid(game, h), null);
  const r = h.claim!.raid!;
  assert.ok(c.all('toast').some((t) => t.msg.startsWith(`Pirates are making for ${isl.name} — 10 minutes`)), 'warned');
  assert.ok(r.until - clock === 10 * 60_000, 'ten minutes');
  assert.ok(r.ships.length >= 1 && r.ships.length <= WATERS.contested.raiders, `raiders at sea: ${r.ships.length}`);
  for (const id of r.ships) {
    const o = game.ships.get(id)!;
    assert.equal(o.npcRole, 'pirate');
    assert.ok(Math.hypot(o.state.x - isl.x, o.state.y - isl.y) < isl.radius + 900, 'off the island');
  }
  const ptr = raidPointer(game, s)!;
  assert.ok(ptr && ptr.x === r.x && ptr.y === r.y && ptr.name === isl.name && ptr.until > game.now + 500);
  const v = baseView(game, s)!;
  assert.ok(v.claim.raid && v.claim.raid.until === r.until && v.claim.raid.alive === r.ships.length);
  assert.equal(startIsleRaid(game, h), 'Raiders already lie off the island.');
  // She sinks them all before they land.
  for (const id of r.ships) {
    const o = game.ships.get(id)!;
    o.hull = 0;
    game.beginSinking(o);
    game.removeShip(id);
  }
  const g0 = s.profile!.gold, iron0 = yardOf(game, h).res.iron ?? 0;
  offShore(game, ship, isl);
  stepIsleClaim(game, h);
  assert.equal(h.claim!.raid, null);
  const prize = raidPrize('contested', h.level ?? 1);
  assert.equal(s.profile!.gold - g0, prize.silver, 'their plunder to her purse');
  assert.ok((yardOf(game, h).res.iron ?? 0) >= iron0, 'their iron to the yard (to its cap)');
  assert.ok(h.claim!.calmUntil > clock, 'a cooldown after');
  assert.equal(raidPointer(game, s), null);
});

test('without her the island holds by its guns and ships at home, by the odds; lost, a share goes — capped in a day — and a building weathers', () => {
  const game = world();
  const { s, h } = owner(game, 'lawless');
  h.level = 3;
  const y = yardOf(game, h);
  h.buildings.push({ id: 'warehouse', condition: 1, unpaid: false, level: 1 });
  const land = () => {
    assert.equal(startIsleRaid(game, h), null);
    for (const id of h.claim!.raid!.ships) game.removeShip(id);
    h.claim!.raid!.ships = [];
    raidNow(game, h);
    stepIsleClaim(game, h);
    assert.equal(h.claim!.raid, null);
  };
  // Nothing to put up: lost, every time — but no more than the day's cap is lost, however many come.
  fatten(game, h);
  const before = isleWorth(h);
  land();
  const one = 1 - isleWorth(h) / before;
  assert.ok(one >= RAID_LOSS[0] - 0.03 && one <= RAID_LOSS[1] + 0.02, `a share gone: ${one}`);
  assert.ok(h.buildings[0].condition < 1, 'a building weathered');
  for (let k = 0; k < 5; k++) land();
  assert.ok(isleWorth(h) >= before * (1 - LOSS_DAY_CAP) - 50, `capped in a day: ${isleWorth(h)} of ${before}`);
  assert.ok(h.claim!.lossShare <= LOSS_DAY_CAP + 1e-9);
  assert.equal(raidChance(game, h), 0, 'no more raids once the day’s cap is lost');
  // Batteries, a fort and her own ships lying at the island: the odds; her ships at sea do not count.
  h.buildings.push({ id: 'battery', condition: 1, unpaid: false, level: 3 }, { id: 'fort', condition: 1, unpaid: false, level: 3 });
  y.ships = [
    { id: 'o1', role: 'war', classId: 'brig', level: 5, xp: 0, name: 0, hull: 1, state: 'home' },
    { id: 'o2', role: 'scout', classId: 'schooner', level: 4, xp: 0, name: 1, hull: 1, state: 'sea' },
  ] as OwnShip[];
  const d = defenceOf(h);
  assert.equal(d.ships, 1, 'only the ship lying at the island');
  assert.equal(d.batteries, 1);
  assert.equal(d.forts, 1);
  assert.ok(d.rating === 3 * 3 + 8 * 3 + 2 * 5, `rating ${d.rating}`);
  assert.ok(baseView(game, s)!.claim.odds >= 0.5, 'a good chance against a lawless raid at level 3');
  // A new day: raided twenty times with a strong defence, most are beaten off, and each one beaten pays.
  let wins = 0;
  for (let k = 0; k < 20; k++) {
    clock += DAY;
    fatten(game, h);
    for (const b of h.buildings) b.condition = 1; // mended between raids (a lost one weathers the guns too)
    const t0 = h.treasury, xp0 = y.ships![0].xp;
    land();
    if (h.treasury > t0) {
      wins++;
      assert.equal(h.treasury - t0, raidPrize('lawless', 3).silver, 'the plunder to the treasury');
      assert.ok(y.ships![0].xp > xp0, 'her ship at home seasoned');
    }
  }
  const odds = raidOdds(defenceOf(h).rating, raidStrength('lawless', 3));
  assert.ok(wins >= 20 * odds - 7 && wins > 8, `held ${wins} of 20 at odds ${odds}`);
});

test('a robber in lawless water: under the black flag, five minutes ashore, a quarter of the yard, the owner warned and her guns on him', () => {
  const game = world();
  const { c, s, isl, h } = owner(game, 'lawless');
  fatten(game, h);
  const { s: rob, ship: rs } = captain(game, 'Island Robber');
  offShore(game, rs, isl);
  assert.equal(robIsland(game, rob, isl.id), 'Hoist the black flag to rob a captain’s island.');
  rob.profile!.pvp.flag = 'pirate';
  assert.equal(robIsland(game, rob, isl.id), 'Its captain sails under the Green Pennant.', 'a new captain is left alone');
  s.profile!.level = 60;
  s.profile!.pvp.flag = 'neutral';
  assert.equal(robIsland(game, rob, isl.id), 'Its captain sails under neutral colours.', 'and one under neutral colours (docs/24)');
  s.profile!.pvp.flag = 'faction';
  assert.equal(robIsland(game, rob, isl.id), null);
  assert.ok(c.all('toast').some((t) => t.msg === `${rob.name} has landed on ${isl.name} to rob it!`), 'the owner warned');
  assert.ok((game.holdings.aggressors.get(isl.id)?.get(rs.id) ?? 0) > game.now, 'the island’s guns on him');
  assert.ok(estateView(game, rob).rob?.robbing !== null);
  const timber = yardOf(game, h).res.timber!;
  rs.cargo = {};
  game.now += ROB_ISLE_SEC + 1;
  stepIsleRobbers(game);
  const took = timber - yardOf(game, h).res.timber!;
  assert.ok(took > 0 && took <= Math.floor(timber * 0.25), `a quarter at most, as the hold takes: ${took}`);
  assert.equal(rs.cargo.timber, took);
  assert.match(robIsland(game, rob, isl.id)!, /stripped lately/, 'not twice in a row');
  // Not in contested water.
  const { isl: ci } = owner(game, 'contested', 'Border Holder');
  offShore(game, rs, ci);
  assert.equal(robIsland(game, rob, ci.id), 'An island is robbed only in lawless waters.');
});

test('both languages: every word of the claim, the tax and the raids in English and Russian', () => {
  const table = { ...serverTable(), ...SERVER_RU_B };
  const said = extract().filter((p) => /raider|Raiders|tax|claim another|Abyss|lair|given up|rob|black flag|island watch|Green Pennant|stripped lately|berthed at the island|caravans home/.test(p));
  assert.ok(said.length > 25, `the sentences: ${said.length}`);
  for (const p of said) assert.ok(table[p], `Russian for ${JSON.stringify(p)}`);
  for (const k of Object.keys(BASE_EN).filter((k) => /^(w_|def_|raid_|abandon)/.test(k))) assert.ok((BASE_RU as Record<string, string>)[k], k);
  for (const k of Object.keys(CO_EN).filter((k) => /^(ct_|est_claim|est_rob)/.test(k))) assert.ok((CO_RU as Record<string, string>)[k], k);
  for (const w of Object.keys(WATERS) as Waters[]) assert.ok(WATERS[w].name[1] && WATERS[w].name[1] !== WATERS[w].name[0]);
  void (null as unknown as RegionId);
});
