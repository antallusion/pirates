// The fleet of eighty (owner, 2026-10-03; docs/02 §1.A.9): eighty hulls a captain sails in four lists of twenty — the
// warships, the traders, the runners and the haulers — ten of each sold for doubloons with a gift of her own and a
// creature kind of her own; the lists keeping their trades and growing with their tiers; the premium hulls never sold
// for silver nor sailed by the sea; the purchase delivering the hull and her creatures; every gift's mechanic at work;
// the art that stands in while their own is painted; and every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, isPremiumUnit } from '../shared/src/data/army.ts';
import type { PremiumUnit, UnitId } from '../shared/src/data/army.ts';
import { DRIFTS, driftKindsFor, tamerStock } from '../shared/src/data/drifts.ts';
import { FLEET, FLEET_HULLS, FLEET_STAND_IN, HULL_STAND_IN, OLD_HULLS, deckArt, silverKin } from '../shared/src/data/fleet.ts';
import { LAIRS, lairKindsFor } from '../shared/src/data/lairs.ts';
import type { LairRole } from '../shared/src/data/lairs.ts';
import { premiumLeaks, premiumShips, premiumUnits } from '../shared/src/data/premium.ts';
import { ROAMS, roamKindsFor } from '../shared/src/data/roamers.ts';
import { SHIP_BEAST_DEFS, SHIP_BEAST_IDS, isShipBeast, ownCount } from '../shared/src/data/shipbeasts.ts';
import { GIFT_KINDS, SHIP_GIFTS, giftOf } from '../shared/src/data/shipgifts.ts';
import type { ShipGift } from '../shared/src/data/shipgifts.ts';
import { HULL_ROLE, LEVEL_RANGE, captainLevelFor, hullsFor, levelRange } from '../shared/src/data/shiplevel.ts';
import { FLEET_LISTS, SHIP_CLASSES, SHIP_CLASS_IDS } from '../shared/src/data/ships.ts';
import type { FleetClassId, FleetList, ShipClassId } from '../shared/src/data/ships.ts';
import { isNight } from '../shared/src/constants.ts';
import { Rng } from '../shared/src/rng.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { rowSpeed } from '../shared/src/sim/sailing.ts';
import { ISLE_TYPES } from '../shared/src/world/archipelago.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { buildPortView, priceMods, shipyardBuy } from '../server/src/game/ports.ts';
import { MAX_BERTHS, sellBerth } from '../server/src/game/shipbuilding.ts';
import { GIFT_FOE, GIFT_SELF, deckGift, giftOnHit, giftPriceMods, sailHolds, stepGifts } from '../server/src/game/shipgifts.ts';
import { modsOf, newBattle } from '../server/src/game/tacbattle.ts';
import { sideOf } from '../server/src/game/tactical.ts';
import { captureOffer, tamerSell } from '../server/src/game/tame.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { DATA_RU } from '../client/src/lang/data.ts';
import { EN as F_EN, RU as F_RU } from '../client/src/lang/ui/fleet.ts';
import { FakeConn, join, makeGame, onHull } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const painted = (id: string) => !!manifest.assets[id];
const sheets = JSON.parse(readFileSync(new URL('../tools/art/sheets.json', import.meta.url), 'utf8')) as Record<string, { creature?: { tier: number; body: string } }>;

const PREMIUM = SHIP_CLASS_IDS.filter((c) => SHIP_CLASSES[c].premium);
const NEW = FLEET_HULLS.filter((c) => !OLD_HULLS.includes(c)) as FleetClassId[];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const digits = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join(' ');
const cyr = (s: string) => /[а-яё]/i.test(s);

// ------------------------------------------------------------------------------------------------ the lists

test('eighty hulls a captain sails, in four lists of twenty, ten of each sold for doubloons', () => {
  assert.equal(FLEET_HULLS.length, 80);
  assert.equal(new Set(FLEET_HULLS).size, 80);
  assert.equal(NEW.length, 66);
  for (const l of FLEET_LISTS) {
    assert.equal(FLEET[l].length, 20, `${l}: twenty`);
    assert.equal(FLEET[l].filter((c) => SHIP_CLASSES[c].premium).length, 10, `${l}: ten premium`);
  }
  assert.equal(PREMIUM.length, 40);
  assert.deepEqual([...premiumShips()].sort(), [...PREMIUM].sort(), 'the shop sells every one of them');
  // The fourteen old hulls stand in the lists; the Dutchman's ship and the deep's monsters in none.
  for (const c of OLD_HULLS) assert.ok(SHIP_CLASSES[c].list && !SHIP_CLASSES[c].premium, c);
  for (const c of SHIP_CLASS_IDS) if (!FLEET_HULLS.includes(c)) assert.ok(c === 'ghost_ship' || SHIP_CLASSES[c].monster, `${c} sails in no list`);
  for (const c of FLEET_HULLS) {
    const d = SHIP_CLASSES[c];
    // Sold for silver at a yard, or for doubloons in the shop: never both, never neither.
    assert.ok(d.purchasable !== !!d.premium, `${c}: purchasable xor premium`);
    // Levels, a role by her list, and the art she is painted with.
    assert.ok(LEVEL_RANGE[c], `${c} has levels`);
    const role = HULL_ROLE[c];
    if (!OLD_HULLS.includes(c)) assert.equal(role, { combat: 'war', trade: 'trade', fast: 'all', hauler: 'trade' }[d.list!], `${c}: her list's role`);
    assert.ok(/^ship\.[a-z_]+$/.test(d.sprite) && d.tier >= 1 && d.tier <= 5, c);
    // A new hull has the levels of the old hulls of her tier.
    if (NEW.includes(c as FleetClassId)) assert.deepEqual(LEVEL_RANGE[c], { 1: [1, 3], 2: c === 'war_galley' ? [4, 6] : [3, 5], 3: [5, 7], 4: [7, 9], 5: [9, 10] }[d.tier], c);
  }
  // The Hulk sails as `holk` (the graveyard's rotten `hulk` is a wreck), painted as the art names her.
  assert.equal(SHIP_CLASSES.holk.sprite, 'ship.hulk');
  assert.equal(deckArt('holk'), 'bg.deck_hulk');
  assert.ok(SHIP_CLASSES.hulk.monster);
});

test('each list keeps its trade, and within a list the hulls grow with their tier', () => {
  const at = (l: FleetList, t: number) => FLEET[l].filter((c) => SHIP_CLASSES[c].tier === t);
  const tiers = (l: FleetList) => [1, 2, 3, 4, 5].filter((t) => at(l, t).length);
  const grows = (l: FleetList, what: string, f: (c: ShipClassId) => number) => {
    const ts = tiers(l);
    for (let i = 1; i < ts.length; i++) {
      const a = mean(at(l, ts[i - 1]).map(f)), b = mean(at(l, ts[i]).map(f));
      assert.ok(b > a, `${l}: ${what} at tier ${ts[i]} (${b.toFixed(1)}) over tier ${ts[i - 1]} (${a.toFixed(1)})`);
    }
  };
  const d = (c: ShipClassId) => SHIP_CLASSES[c];
  // The warships: guns, hull and men.
  grows('combat', 'guns', (c) => d(c).gunPortsPerSide);
  grows('combat', 'hull', (c) => d(c).hull);
  grows('combat', 'crew', (c) => d(c).crewMax);
  // The traders: the hold, and cheap to run (a trait that cuts wages or provisions, or a merchant's hold for her men).
  grows('trade', 'hold', (c) => d(c).holdVolume);
  // The runners: a hull that grows, on a speed that never falls below a brigantine's.
  grows('fast', 'hull', (c) => d(c).hull);
  // The haulers: the hold and the hull, and slow.
  grows('hauler', 'hold', (c) => d(c).holdVolume);
  grows('hauler', 'hull', (c) => d(c).hull);
  for (const c of FLEET.fast) assert.ok(d(c).maxSpeed >= 15.5, `${c} is fast (${d(c).maxSpeed})`);
  for (const c of FLEET.hauler) assert.ok(d(c).maxSpeed <= 11.5, `${c} is slow (${d(c).maxSpeed})`);
  // Tier for tier, each list's mark: the warships the heaviest battery (her broadsides and chasers, the best of each
  // list: the fireship's guns are her charges), the runners the most speed, the haulers the most hold.
  const guns = (c: ShipClassId) => 2 * d(c).gunPortsPerSide + d(c).bowChasers + d(c).sternChasers;
  for (const t of [1, 2, 3, 4, 5]) {
    const m = (l: FleetList, f: (c: ShipClassId) => number) => (at(l, t).length ? mean(at(l, t).map(f)) : null);
    const others = (l: FleetList, f: (c: ShipClassId) => number) => FLEET_LISTS.filter((x) => x !== l).map((x) => m(x, f)).filter((x): x is number => x !== null);
    const best = (l: FleetList) => Math.max(0, ...at(l, t).map(guns));
    const speed = m('fast', (c) => d(c).maxSpeed), hold = m('hauler', (c) => d(c).holdVolume);
    if (at('combat', t).length) assert.ok(FLEET_LISTS.every((l) => best('combat') >= best(l)), `tier ${t}: the warships carry the heaviest battery`);
    if (speed !== null) assert.ok(others('fast', (c) => d(c).maxSpeed).every((x) => speed > x), `tier ${t}: the runners are the fastest`);
    if (hold !== null) assert.ok(others('hauler', (c) => d(c).holdVolume).every((x) => hold > x), `tier ${t}: the haulers carry the most`);
  }
  // The silver hulls cost more a tier up; a yard's new hull is priced among the old ones of her tier.
  for (const l of FLEET_LISTS) grows(l, 'price', (c) => d(c).price);
  // A premium hull's price in doubloons by her tier (the shop's packs: 100 to 7000), and dearer a tier up.
  const band: Record<number, [number, number]> = { 1: [300, 600], 2: [600, 1000], 3: [1000, 1800], 4: [2000, 3000], 5: [3000, 5000] };
  for (const c of PREMIUM) {
    const p = d(c).premium!.price, [lo, hi] = band[d(c).tier];
    assert.ok(p >= lo && p <= hi, `${c}: ${p} doubloons for tier ${d(c).tier}`);
  }
  for (const l of FLEET_LISTS) {
    const prem = FLEET[l].filter((c) => d(c).premium);
    for (const a of prem) for (const b of prem) if (d(b).tier > d(a).tier) assert.ok(d(b).premium!.price > d(a).premium!.price, `${b} dearer than ${a}`);
  }
  // A trait's lines are real stats: a trader's thrift shows in her wages and provisions.
  const st = (c: ShipClassId) => computeShipStats({ classId: c, name: 'x', guns: { port: 'light_6', starboard: 'light_6' }, modules: {} }, 'corsair', {});
  assert.ok(st('tartane').provisionUse < st('sloop').provisionUse && st('tartane').x.wages < 0);
  assert.ok(st('turtle_barge').hullMax > SHIP_CLASSES.turtle_barge.hull, 'the living shell');
  // The oared hulls row as the xebec does.
  for (const c of FLEET_HULLS) if (d(c).passive.id === 'sweeps') assert.equal(rowSpeed(c, false, false), 3, `${c} rows`);
});

// ------------------------------------------------------------------------------------------------ the premium forty

test('every premium hull has her gift — one of seven kinds, its card saying what it does — and her own creature kind', () => {
  assert.deepEqual(Object.keys(SHIP_GIFTS).sort(), [...PREMIUM].sort(), 'a gift for each premium hull and none other');
  const kinds = new Set<string>();
  for (const c of PREMIUM) {
    const g = giftOf(c)!;
    kinds.add(g.kind);
    assert.ok(GIFT_KINDS.includes(g.kind), `${c}: ${g.kind}`);
    assert.ok(g.name[0] && g.text[0].length > 20 && cyr(g.name[1]) && cyr(g.text[1]), `${c}: named and told in both languages`);
    assert.equal(digits(g.text[1]), digits(g.text[0]), `${c}: the same numbers in Russian`);
    assert.ok(!/\b(blood|skeleton|bone)s?\b/i.test(g.text[0]), c);
    // The card says what the gift does: its numbers are the gift's own.
    const says = (n: number) => assert.ok(new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(g.text[0]), `${c}: the card says ${n} (“${g.text[0]}”)`);
    if (g.kind === 'rally') {
      assert.ok(g.below > 0 && g.below < 1 && g.cd >= 30 && (g.secs > 0 || g.mend) && cyr(g.cry[1]));
      if (g.below === 0.5) assert.match(g.text[0], /below half her hull/, c);
      else says(Math.round(g.below * 100));
      says(g.cd);
      if (g.secs > 0) says(g.secs);
      if (g.mend) says(Math.round(g.mend * 100));
    } else if (g.kind === 'strike') {
      assert.ok(g.chance > 0 && g.chance < 1 && g.cd > 0 && g.secs > 0 && (g.foe || g.fire));
      says(g.cd);
    } else if (g.kind === 'toll') {
      assert.ok(g.cd >= 15 && g.r >= 200 && g.r <= 500 && (g.hull || g.morale || g.foe));
      says(g.cd);
      says(g.r);
      if (g.hull) says(Math.round(g.hull * 100));
      if (g.morale) says(g.morale);
      if (g.secs > 0) says(g.secs);
    } else if (g.kind === 'deck') {
      assert.ok(g.rounds >= 1 && (g.mine || g.theirs));
      if (g.rounds < 99) says(g.rounds);
    } else if (g.kind === 'sail') {
      assert.ok(Object.keys(g.self).length > 0);
    } else if (g.kind === 'trade') {
      assert.ok(g.goods === 'all' || g.goods.length > 0);
      assert.ok(g.sell || g.buy || g.duty);
      if (g.sell) says(Math.round((g.sell - 1) * 100));
      if (g.buy) says(Math.round((1 - g.buy) * 100));
    } else if (g.kind === 'muster') {
      assert.ok(g.every > 0 && cyr(g.cry[1]));
      says(g.every);
    }
    // Her own creatures: one kind, hers alone, in a number her hammocks and slots hold.
    const p = SHIP_CLASSES[c].premium!;
    assert.ok(cyr(p.note[1]) && p.note[0].length > 10, `${c}: her card's line`);
    assert.equal(p.beasts?.length, 1, `${c}: one kind of her own`);
    const b = p.beasts![0];
    assert.ok(isShipBeast(b.u) && SHIP_BEAST_DEFS[b.u].hull === c, `${c}: ${b.u} is hers`);
    assert.ok(b.n >= 1 && b.n <= SHIP_CLASSES[c].crewMax / 3, `${c}: ${b.n} of them, no more than a third of her hammocks`);
    assert.equal(ownCount(b.u), b.n);
  }
  assert.deepEqual([...kinds].sort(), [...GIFT_KINDS].sort(), 'every kind of mechanic is somebody\'s gift');
  // The forty kinds as units: each its hull's, premium (no free source hands it out), its numbers by its tier.
  assert.equal(SHIP_BEAST_IDS.length, 40);
  assert.deepEqual(SHIP_BEAST_IDS.map((u) => SHIP_BEAST_DEFS[u].hull).sort(), [...PREMIUM].sort());
  for (const u of SHIP_BEAST_IDS) {
    const d = UNITS[u], s = SHIP_BEAST_DEFS[u];
    assert.ok(d && isPremiumUnit(u) && d.premium!.n === ownCount(u) && !d.beast, u);
    assert.ok(d.dmin <= d.dmax && d.hp > 0 && d.speed > 0 && d.init > 0 && d.specials.length === 2, u);
    assert.ok(!d.specials.includes('shooter') || d.shots > 0, `${u}: a shooter carries shots`);
    assert.ok(d.cost >= 25 * d.tier && d.cost <= 140 * d.tier, `${u}: ${d.cost} silver at tier ${d.tier}`);
    assert.ok(cyr(s.names[1]) && cyr(s.names[3]) && s.names[2].length > 20, `${u} named in both languages`);
    // The game and the painter agree on the creature (tools/art/creatures.py, faction premium_ship).
    assert.equal(sheets[`anim_${u}`]?.creature?.tier, d.tier, `${u}: its painted tier`);
    assert.equal(sheets[`anim_${u}`]?.creature?.body, s.body, `${u}: its painted body`);
  }
  // A tier's stats over the plain kinds' (a premium kind is a little better than the upgraded man of its tier).
  for (const u of SHIP_BEAST_IDS) {
    const d = UNITS[u];
    const men = (['deckhand', 'marine', 'musketeer', 'gunner', 'boarder', 'guard', 'drowned'] as UnitId[])[d.tier - 1];
    assert.ok(d.hp * (d.dmin + d.dmax) >= UNITS[men].hp * (UNITS[men].dmin + UNITS[men].dmax) * 0.9, `${u} is worth a ${men} or more`);
  }
});

// ------------------------------------------------------------------------------------------------ never for silver, never the sea's

test('a premium hull is never sold for silver: no yard lists her, builds her, buys her or takes her in trade', () => {
  const { game } = makeGame();
  const conn = join(game, 'Yard Hand');
  const s = game.sessionByName('Yard Hand')!;
  const p = s.profile!, ship = s.ship!;
  p.level = 60;
  p.gold = 10_000_000;
  const port = game.portById('gravesend')!;
  for (const c of PREMIUM) assert.equal(SHIP_CLASSES[c].purchasable, false, c);
  // The yard's list: her silver hulls by its rank, none of the premium.
  const listed = buildPortView(game, s, port).shipyard.ships.map((x) => x.classId);
  assert.ok(listed.some((c) => NEW.includes(c as FleetClassId)), 'the new silver hulls are on the ways');
  assert.ok(!listed.some((c) => SHIP_CLASSES[c].premium), 'no premium hull at a yard');
  assert.equal(shipyardBuy(game, s, port, 'black_corsair'), 'Not for sale');
  // Sailing a premium hull, a yard's hull is paid in full and she goes to a berth here — never traded in.
  onHull(game, ship, 'phantom_brig');
  p.loadout = ship.loadout;
  const berths = p.berths.length, gold = p.gold;
  assert.equal(shipyardBuy(game, s, port, 'corvette'), null);
  assert.equal(ship.loadout.classId, 'corvette');
  assert.equal(p.gold, gold - SHIP_CLASSES.corvette.price, 'no trade-in for her');
  assert.equal(p.berths.length, berths + 1);
  assert.equal(p.berths.at(-1)!.loadout.classId, 'phantom_brig', 'she is berthed at the quay');
  // No yard buys her from her berth.
  assert.match(sellBerth(game, s, port, p.berths.length - 1)!, /No yard buys a hull bought with doubloons/);
  assert.equal(p.berths.at(-1)!.loadout.classId, 'phantom_brig');
  // Every berth taken: the yard will not leave her nowhere.
  onHull(game, ship, 'crimson_tide');
  p.berths.push(...Array.from({ length: MAX_BERTHS - p.berths.length }, () => ({ port: port.id, loadout: { ...ship.loadout, classId: 'sloop' as ShipClassId }, hull: 1 })));
  assert.match(shipyardBuy(game, s, port, 'brig')!, /You already berth/);
  void conn;
});

test('the sea never sails a premium hull, so none is ever a prize: her silver kin sails in her place', () => {
  for (const role of ['pirate', 'merchant', 'patrol', 'hunter', 'fisher', 'escort', 'ghost', 'nobody']) {
    for (let l = 1; l <= 10; l++) for (const c of hullsFor(role, l)) assert.ok(!SHIP_CLASSES[c].premium, `${role} ⚓${l}: ${c}`);
  }
  for (const c of PREMIUM) {
    const k = silverKin(c);
    assert.ok(!SHIP_CLASSES[k].premium && SHIP_CLASSES[k].purchasable && SHIP_CLASSES[k].list === SHIP_CLASSES[c].list, `${c} → ${k}`);
    assert.ok(Math.abs(SHIP_CLASSES[k].tier - SHIP_CLASSES[c].tier) <= 1, `${c} → ${k}: her tier or near it`);
  }
  assert.equal(silverKin('brig'), 'brig', 'a silver hull is herself');
  // Whoever asks the sea for one gets the silver kin.
  const { game } = makeGame();
  for (const c of PREMIUM) {
    const npc = game.spawnNpcShip('pirate', c, 'confederacy', 40000, 40000, 0);
    assert.ok(!npc.cls.premium, `${c}: the sea sails a ${npc.loadout.classId}`);
    assert.equal(npc.loadout.classId, silverKin(c));
    game.removeShip(npc.id);
  }
});

test('a premium hull\'s own kind is had only with her: no tamer, lair, drift, roaming stack, capture, shop shelf nor tamer\'s purse', () => {
  assert.deepEqual(premiumLeaks(), []);
  for (const u of SHIP_BEAST_IDS) assert.ok(!premiumUnits().includes(u), `${u}: not on the shop's shelf`);
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const beasts = new Set<string>(SHIP_BEAST_IDS);
  for (let w = 0; w < 40; w++) for (const L of [3, 6, 9]) assert.ok(!tamerStock(`port_${w % 9}`, L, w, true).some((x) => beasts.has(x.u)), 'the tamer');
  for (const r of REGION_IDS) for (const L of levels) {
    assert.ok(!driftKindsFor(L, r).some(([k]) => beasts.has(DRIFTS[k].u)), 'the drifts');
    assert.ok(!roamKindsFor(L, r).some(([k]) => beasts.has(ROAMS[k].u)), 'the roaming stacks');
  }
  for (const t of ISLE_TYPES) for (const L of levels) for (const role of ['shore', 'grotto', 'guardian'] as LairRole[]) assert.ok(!lairKindsFor(t, L, role).some((k) => LAIRS[k].mix.some(([u]) => beasts.has(u))), 'the lairs');
  const { game } = makeGame();
  const conn = join(game, 'Collector');
  const s = game.sessionByName('Collector')!;
  onHull(game, s.ship!, 'brig', 5);
  s.ship!.setArmy([{ u: 'deckhand', n: 30 }]);
  s.ship!.morale = 80;
  assert.equal(captureOffer(game, s, [{ u: 'great_white', n: 6 }, { u: 'sea_chimera', n: 1 }], 4, 'yes'), undefined, 'the beaten\'s offer');
  // Not off the shelf, even asked by name.
  creditPremium(game, s.accountId, 5000, 'pay', 'p-shelf');
  conn.push({ t: 'premium', action: 'buy_unit', id: 'corsair_phantom' });
  assert.equal(conn.last('toast')?.msg, 'Not for sale');
  assert.ok(!s.ship!.army.some((x) => x.u === 'corsair_phantom'));
  // The tamer buys nothing that came for doubloons (a premium creature of the shop's marked for the test).
  s.ship!.docked = 'saint_maw';
  const was = UNITS.sea_turtle.premium;
  UNITS.sea_turtle.premium = { price: 100, n: 4, note: ['A test.', 'Проверка.'] } as PremiumUnit;
  try {
    s.ship!.setArmy([{ u: 'deckhand', n: 30 }, { u: 'sea_turtle', n: 4 }]);
    assert.match(tamerSell(game, s, 'sea_turtle', 4)!, /buys no creature that came for doubloons/);
    assert.equal(s.ship!.army.find((x) => x.u === 'sea_turtle')?.n, 4);
  } finally {
    if (was) UNITS.sea_turtle.premium = was;
    else delete UNITS.sea_turtle.premium;
  }
});

// ------------------------------------------------------------------------------------------------ the purchase

/** A captain who may command any hull, with doubloons on her account, in port. */
function captain(name: string, sea?: Game): { game: Game; conn: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const game = sea ?? makeGame().game;
  const conn = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 60;
  creditPremium(game, s.accountId, 100_000, 'pay', `p-${name}`);
  return { game, conn, s, ship: s.ship! };
}

test('a premium purchase delivers the hull and her own creatures — hands paid off at the quay if her hammocks are full', () => {
  const { game, conn, s, ship } = captain('Corsair Buyer');
  ship.setArmy([{ u: 'deckhand', n: 20 }, { u: 'marine', n: 10 }]);
  const before = game.db.doubloons(s.accountId);
  conn.push({ t: 'premium', action: 'buy_ship', id: 'black_corsair' });
  assert.equal(ship.loadout.classId, 'black_corsair');
  assert.equal(ship.army.find((x) => x.u === 'corsair_phantom')?.n, 14, 'her phantoms aboard');
  assert.equal(game.db.doubloons(s.accountId), before - SHIP_CLASSES.black_corsair.premium!.price);
  assert.equal(ship.stats.hullMax, SHIP_CLASSES.black_corsair.hull, 'her own stats');
  // Every one of the forty, delivered with her own (her level asked of the captain, and nothing else in the way).
  for (const [i, c] of PREMIUM.entries()) {
    const x = captain(`Buyer ${i + 1}`, game); // one sea, forty captains
    x.ship.setArmy([{ u: 'deckhand', n: 8 }]);
    assert.ok(x.s.profile!.level >= captainLevelFor(levelRange(c)[0]));
    x.conn.push({ t: 'premium', action: 'buy_ship', id: c });
    assert.equal(x.ship.loadout.classId, c, `${c} delivered`);
    const b = SHIP_CLASSES[c].premium!.beasts![0];
    assert.equal(x.ship.army.find((y) => y.u === b.u)?.n, b.n, `${c}: ${b.n} ${b.u} aboard`);
  }
  // A full crew: as many of her lowest hands as her own need are paid off, and she is sold.
  const f = captain('Full Crew');
  onHull(f.game, f.ship, 'frigate', 6);
  f.ship.setArmy([{ u: 'deckhand', n: 200 }, { u: 'marine', n: 20 }]);
  f.conn.push({ t: 'premium', action: 'buy_ship', id: 'dragon_junk' });
  assert.equal(f.ship.loadout.classId, 'dragon_junk');
  assert.equal(f.ship.army.find((x) => x.u === 'dragon_lancer')?.n, 16, 'her lancers aboard');
  assert.equal(f.ship.crew, f.ship.stats.crewMax, 'every hammock full, none over');
  assert.ok(f.conn.all('toast').some((t) => /^16 hands are paid off at the quay/.test(t.msg)), 'sixteen hands paid off for sixteen lancers');
});

test('her own creatures come back to her in port, up to the number she came with, aboard her only', () => {
  const { game, conn, ship } = captain('Homecoming');
  conn.push({ t: 'premium', action: 'buy_ship', id: 'storm_reaver' });
  assert.equal(ship.army.find((x) => x.u === 'storm_berserker')?.n, 16);
  const port = game.portById(ship.docked!)!;
  conn.push({ t: 'undock' });
  ship.loseFrom('storm_berserker', 10);
  assert.equal(ship.army.find((x) => x.u === 'storm_berserker')?.n, 6);
  ship.state = { ...ship.state, x: port.x, y: port.y, speed: 0 };
  ship.lastCombat = -999;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  conn.push({ t: 'dock', bribe: false });
  assert.ok(ship.docked);
  assert.equal(ship.army.find((x) => x.u === 'storm_berserker')?.n, 16, 'mustered back to sixteen');
  assert.ok(conn.all('toast').some((t) => /come back aboard the Storm Reaver/.test(t.msg)));
});

// ------------------------------------------------------------------------------------------------ every gift at work

/** A captain at sea on a hull, out of a fight, cooldowns clear. */
function atSea(name: string, c: ShipClassId): { game: Game; conn: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const x = captain(name);
  onHull(x.game, x.ship, c);
  x.s.profile!.loadout = x.ship.loadout;
  x.conn.push({ t: 'undock' });
  x.ship.setArmy([{ u: 'deckhand', n: Math.round(x.ship.stats.crewMax * 0.5) }]);
  x.ship.talentReady = {};
  x.ship.lastCombat = -999;
  x.ship.state.x = 40000;
  x.ship.state.y = 40000;
  x.game.grid.upsert(x.ship.id, x.ship.state.x, x.ship.state.y);
  return x;
}

/** A ship of the sea alongside her, in a fight with her. */
function foe(game: Game, ship: ShipEntity, d = 200): ShipEntity {
  const o = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + d, ship.state.y, 0);
  game.grid.upsert(o.id, o.state.x, o.state.y);
  o.attackers.set(ship.id, game.now);
  ship.lastCombat = game.now;
  return o;
}

/** Puts a gift of each kind to work on its hull and says what came of it. */
function exercise(c: ShipClassId, g: ShipGift): void {
  const { game, s, ship } = atSea(`Gift ${PREMIUM.indexOf(c) + 1}`, c);
  const now = game.now;
  switch (g.kind) {
    case 'rally': {
      foe(game, ship, 600);
      ship.hull = ship.stats.hullMax * (g.below - 0.1);
      ship.leaks = 2;
      const hull0 = ship.hull;
      stepGifts(game, ship);
      assert.ok((ship.talentReady.gift ?? 0) > now, `${c}: it came`);
      if (g.secs > 0 && (g.self || g.selfFlags)) assert.ok(ship.hasEffect(GIFT_SELF), `${c}: her effect`);
      for (const f of g.selfFlags ?? []) assert.ok(ship.hasFlag(f), `${c}: ${f}`);
      if (g.self?.reloadMul) assert.ok(ship.stats.reloadMul < 1, `${c}: reloads faster`);
      if (g.self?.maxSpeed) assert.ok(ship.stats.maxSpeed > SHIP_CLASSES[c].maxSpeed, `${c}: faster`);
      if (g.self?.incomingDamageMul) assert.ok(ship.stats.incomingDamageMul < 1, `${c}: takes less`);
      if (g.mend) assert.ok(ship.hull > hull0 && ship.leaks === 0, `${c}: mended`);
      // Not again before its cooldown.
      const until = ship.talentReady.gift;
      stepGifts(game, ship);
      assert.equal(ship.talentReady.gift, until, `${c}: once in ${g.cd} s`);
      return;
    }
    case 'strike': {
      const o = foe(game, ship);
      for (let i = 0; i < 400 && !(ship.talentReady.gift ?? 0); i++) giftOnHit(game, ship, o);
      assert.ok((ship.talentReady.gift ?? 0) > now, `${c}: it struck`);
      if (g.foe) assert.ok(o.hasEffect(GIFT_FOE), `${c}: on her target`);
      if (g.fire) assert.ok(o.hasEffect('fire'), `${c}: afire`);
      if (g.foe?.maxSpeed) assert.ok(o.stats.maxSpeed < o.cls.maxSpeed * 1.2, `${c}: slowed`);
      if (g.foe?.reloadMul) assert.ok(o.stats.reloadMul > 1, `${c}: her reloads slowed`);
      if (g.foe?.incomingDamageMul) assert.ok(o.stats.incomingDamageMul > 1, `${c}: her wound opened`);
      return;
    }
    case 'toll': {
      const o = foe(game, ship);
      const far = foe(game, ship, g.r + 400);
      const bystander = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x - 150, ship.state.y, 0);
      game.grid.upsert(bystander.id, bystander.state.x, bystander.state.y);
      const [h, m] = [o.hull, o.morale], [hb, mb] = [bystander.hull, bystander.morale], hf = far.hull;
      stepGifts(game, ship);
      assert.ok((ship.talentReady.gift ?? 0) > now, `${c}: it tolled`);
      if (g.hull) assert.ok(o.hull < h, `${c}: her hull struck`);
      if (g.morale) assert.ok(o.morale < m, `${c}: her heart struck`);
      if (g.foe && g.secs > 0) assert.ok(o.hasEffect(GIFT_FOE), `${c}: her effect`);
      assert.equal(far.hull, hf, `${c}: beyond her reach`);
      assert.ok(bystander.hull === hb && bystander.morale === mb && !bystander.attackers.has(ship.id), `${c}: a bystander out of her fight is untouched`);
      return;
    }
    case 'deck': {
      const o = foe(game, ship);
      const side = sideOf(game, ship, o, true);
      assert.deepEqual(side.gift, deckGift(ship), `${c}: her side brings it`);
      const bt = newBattle(side, sideOf(game, o, ship, false), 7, game.now, new Rng(7));
      const mine = modsOf(bt, 0), theirs = modsOf(bt, 1);
      for (const [k, v] of Object.entries(g.mine ?? {})) assert.equal(mine[k as keyof typeof mine], v, `${c}: her side's ${k}`);
      for (const [k, v] of Object.entries(g.theirs ?? {})) assert.equal(theirs[k as keyof typeof theirs], v, `${c}: the other side's ${k}`);
      // It holds its rounds, and no longer.
      if (g.rounds < 99) {
        bt.round = g.rounds + 1;
        assert.equal(modsOf(bt, 0).melee + modsOf(bt, 0).init + modsOf(bt, 1).morale + modsOf(bt, 1).init + modsOf(bt, 1).melee, 0, `${c}: after ${g.rounds} rounds`);
      }
      return;
    }
    case 'sail': {
      const st0 = { ...ship.stats };
      // The sea as she likes it.
      if (g.when === 'storm') (game as unknown as { weatherOf: () => string }).weatherOf = () => 'storm';
      if (g.when === 'fog') (game as unknown as { weatherOf: () => string }).weatherOf = () => 'fog';
      if (g.when === 'calm') (game as unknown as { windFor: () => { dir: number; strength: number } }).windFor = () => ({ dir: 0, strength: 0.3 });
      if (g.when === 'night') {
        let t = game.now;
        while (!isNight(t)) t += 60;
        game.now = t;
      }
      assert.ok(sailHolds(game, ship, g.when), `${c}: her sea (${g.when})`);
      stepGifts(game, ship);
      assert.ok(ship.hasEffect(GIFT_SELF), `${c}: her gift under sail`);
      if (g.self.maxSpeed) assert.ok(ship.stats.maxSpeed > st0.maxSpeed, `${c}: faster`);
      if (g.self.signature) assert.ok((ship.stats.x.signature ?? 0) < (st0.x.signature ?? 0), `${c}: harder to see`);
      // Out of her sea, nothing.
      if (g.when === 'open') {
        foe(game, ship, 800);
        assert.ok(!sailHolds(game, ship, 'open'), `${c}: an enemy near`);
      }
      return;
    }
    case 'trade': {
      const port = game.portById('gravesend')!;
      const goods = g.goods === 'all' ? (['rum', 'spices', 'iron'] as const) : g.goods;
      // Her prices as they would be without her gift (her stats are hers either way), and with it.
      ship.loadout.classId = 'fluyt';
      const base = priceMods(ship, port, s.profile!, game.now, game);
      ship.loadout.classId = c;
      const mods = giftPriceMods(ship, base);
      for (const x of goods) {
        const sell = (mods.goodSell?.[x] ?? 1) * (1 - mods.duty), sell0 = (base.goodSell?.[x] ?? 1) * (1 - base.duty);
        if (g.sell || (g.duty && base.duty > 0)) assert.ok(sell > sell0, `${c}: ${x} sells dearer`);
        if (g.buy) assert.ok((mods.goodBuy?.[x] ?? 1) < (base.goodBuy?.[x] ?? 1), `${c}: ${x} costs her less`);
      }
      // In her own port's market too.
      const full = priceMods(ship, port, s.profile!, game.now, game);
      if (g.sell) assert.ok((full.goodSell?.[goods[0]] ?? 1) > 1);
      return;
    }
    case 'muster': {
      if (g.who === 'own') {
        const b = SHIP_CLASSES[c].premium!.beasts![0];
        ship.setArmy([{ u: 'deckhand', n: 20 }, { u: b.u, n: Math.max(0, b.n - 1) }]);
        stepGifts(game, ship);
        assert.equal(ship.army.find((x) => x.u === b.u)?.n, b.n, `${c}: one grows back`);
        game.now += g.every + 1;
        stepGifts(game, ship);
        assert.equal(ship.army.find((x) => x.u === b.u)?.n, b.n, `${c}: never beyond her number`);
      } else {
        const n0 = ship.crew;
        stepGifts(game, ship);
        assert.equal(ship.crew, n0 + 1, `${c}: a hand signs on`);
        foe(game, ship, 600);
        game.now += g.every + 1;
        stepGifts(game, ship);
        assert.equal(ship.crew, n0 + 1, `${c}: not in a fight`);
      }
      return;
    }
  }
}

test('every premium hull\'s gift works at sea, in the boarding battle or in port, as its card says', () => {
  for (const c of PREMIUM) exercise(c, giftOf(c)!);
});

test('a gift is her hull\'s: an always-on line on her stats, and nothing on a silver hull', () => {
  const st = (c: ShipClassId) => computeShipStats({ classId: c, name: 'x', guns: { port: 'light_6', starboard: 'light_6' }, modules: {} }, 'corsair', {});
  assert.equal(st('tea_clipper').x.spoilage, -0.5, 'the Tea Race keeps her cargo');
  assert.equal(st('treasure_fluyt').x.lifeboats, 2.5, 'the strongroom\'s boats');
  assert.ok(st('ghost_clipper').flags.has('fog_sense'));
  assert.ok(st('silver_arrow').x.shotSpeed > 0);
  for (const c of FLEET_HULLS.filter((x) => !SHIP_CLASSES[x].premium)) assert.equal(giftOf(c), undefined, c);
  // A captain on a silver hull: no gift step, no strike, no deck, no trade.
  const { game, ship } = atSea('Plain Sailor', 'brig');
  const o = foe(game, ship);
  ship.hull = ship.stats.hullMax * 0.2;
  stepGifts(game, ship);
  for (let i = 0; i < 50; i++) giftOnHit(game, ship, o);
  assert.ok(!ship.hasEffect(GIFT_SELF) && !o.hasEffect(GIFT_FOE) && !ship.talentReady.gift);
  assert.equal(deckGift(ship), undefined);
});

// ------------------------------------------------------------------------------------------------ the art and the words

test('every new hull, deck and creature has a picture: its own once painted, a painted kindred till then', () => {
  for (const c of NEW) {
    const d = SHIP_CLASSES[c];
    const stand = HULL_STAND_IN[c];
    assert.ok(OLD_HULLS.includes(stand) && SHIP_CLASSES[stand].list === d.list, `${c} → ${stand}: an old hull of her list`);
    const near = Math.min(...OLD_HULLS.filter((x) => SHIP_CLASSES[x].list === d.list).map((x) => Math.abs(SHIP_CLASSES[x].tier - d.tier)));
    assert.ok(Math.abs(SHIP_CLASSES[stand].tier - d.tier) <= Math.max(1, near), `${c} → ${stand}: a tier near hers`);
    for (const id of [d.sprite, deckArt(c)]) {
      assert.ok(painted(id) || (FLEET_STAND_IN[id] && painted(FLEET_STAND_IN[id])), `${id}: neither painted nor stood in for`);
      assert.ok(FLEET_STAND_IN[id], `${id}: a stand-in waits for it, so it switches over when painted`);
    }
  }
  for (const u of SHIP_BEAST_IDS) {
    assert.equal(UNITS[u].art, `unit.${u}`);
    const stand = SHIP_BEAST_DEFS[u].stand.replace(/^unit\./, '');
    assert.equal(sheets[`anim_${stand}`]?.creature?.body, SHIP_BEAST_DEFS[u].body, `${u} → ${stand}: a figure of the same body`);
    for (const f of ['', '_b', '_atk', '_hit']) {
      const id = `unit.${u}${f}`;
      assert.ok(painted(id) || painted(FLEET_STAND_IN[id]), `${id}: neither painted nor stood in for`);
    }
  }
  // Every stand-in is painted art.
  for (const [id, stand] of Object.entries(FLEET_STAND_IN)) assert.ok(painted(stand), `${id} → ${stand}`);
});

test('every word of the fleet in both languages: the hulls, the gifts, the creatures, the server\'s lines, the window', () => {
  for (const c of NEW) for (const k of ['name', 'role', 'passive.name', 'passive.description']) {
    const ru = DATA_RU[`ships.SHIP_CLASSES.${c}.${k}`];
    assert.ok(ru && cyr(ru), `${c}.${k} in Russian`);
  }
  for (const c of NEW) assert.equal(digits(DATA_RU[`ships.SHIP_CLASSES.${c}.passive.description`]), digits(k(c)), `${c}: the trait's numbers`);
  function k(c: ShipClassId) {
    return SHIP_CLASSES[c].passive.description;
  }
  const ru = new Set(NEW.map((c) => DATA_RU[`ships.SHIP_CLASSES.${c}.name`]));
  assert.equal(ru.size, NEW.length, 'no two new hulls share a Russian name');
  assert.ok(!ru.has(DATA_RU['ships.SHIP_CLASSES.man_o_war.name']), 'nor one of the old');
  const table = serverTable();
  const mine = extract('server/src/game').filter((x) => /come back aboard the|paid off at the quay|bought with doubloons|came for doubloons/.test(x));
  assert.ok(mine.length >= 4, `the fleet's sentences found (${mine.length})`);
  for (const x of mine) assert.ok(table[x] !== undefined, `untranslated: ${x}`);
  for (const c of PREMIUM) {
    const g = giftOf(c)!;
    if (g.kind === 'rally' || g.kind === 'muster') assert.equal(table[`${g.name[0]}! ${g.cry[0]}`], `${g.name[1]}! ${g.cry[1]}`, `${c}: her cry`);
  }
  assert.deepEqual(Object.keys(F_RU).sort(), Object.keys(F_EN).sort());
  for (const l of FLEET_LISTS) assert.ok(cyr(F_RU[`list.${l}`]));
  for (const kind of GIFT_KINDS) assert.ok(cyr(F_RU[`kind.${kind}`]));
});
