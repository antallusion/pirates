// The beasts' sea fight (owner, 2026-10-07: «акулы всякие они не должны убивать моих людей, как они команду могут
// убить? я вот уже сражаюсь с акулой минуты 2, это не нормально вообще. где баланс?»): a captain's «Атаковать» on a
// beast of her level, her helmsman and gun captains doing the rest (beastfight.ts). No beast takes a man; an ordinary
// one dies in 10–20 s of her guns, a great whale in 20–30, a rare one in no more than 40; a beast that runs turns at
// bay, and a chase that finds nothing to hit is given up; the hunter's hour is not doubled by the quicker kill.
// `node tools/mobile/beast-time.ts` prints the whole table.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEASTS } from '../../shared/src/data/beasts.ts';
import type { BeastId } from '../../shared/src/data/beasts.ts';
import { BEAST_FLEE_SEC, beastBrain, beastsAlive, beastsPass, clearBeasts, spawnBeast, spawnGroup } from '../../server/src/game/beasts.ts';
import { pursuitOf, startPursuit } from '../../server/src/game/pursuit.ts';
import { regionAt } from '../../shared/src/world/worldgen.ts';
import { BEAST_BAND, beastRows, huntHour, q } from './beastfight.ts';
import type { BeastRow } from './beastfight.ts';
import { duelSea, openWater } from './duel.ts';
import { seaCaptain } from './seafight.ts';

/** The beasts of each level the owner's bands are weighed at (⚓1 has its sharks now; ⚓8 its great and rare ones). */
const AT: Record<number, BeastId[]> = { 1: ['shark'], 3: ['shark', 'orca'], 5: ['shark', 'orca', 'narwhal', 'humpback'], 8: ['orca', 'sperm_whale', 'young_serpent', 'white_orca'] };

let rows: BeastRow[] | null = null;
function measured(): BeastRow[] {
  if (rows) return rows;
  const game = duelSea();
  rows = [];
  for (const [lv, kinds] of Object.entries(AT)) for (const id of kinds) rows.push(beastRows(game, id, Number(lv), 3));
  return rows;
}

test('no beast takes a man: a captain fights each of them of her level and keeps every hand', () => {
  for (const r of measured()) {
    assert.equal(r.killed, r.n, `⚓${r.level} ${r.beast}: killed ${r.killed}/${r.n}`);
    assert.equal(r.menMax, 0, `⚓${r.level} ${r.beast}: men lost ${r.menMax}`);
  }
});

test('a shark bites the hull and now and then the rudder — never the men — and the hit shows on her', () => {
  const game = duelSea();
  const at = openWater(game, 77);
  const s = seaCaptain(game, 'sloop', 1, at.x, at.y, 0);
  const me = s.ship!;
  me.hull = me.stats.hullMax * 0.3; // a wounded ship: the sharks' prey
  const sharks = spawnGroup(game, 'shark', at.x + 60, at.y, 1, 3);
  assert.equal(sharks.length, 3);
  const crew0 = me.crew, hull0 = me.hull;
  let hits = 0;
  const emit = game.emit.bind(game);
  game.emit = (ev, x, y) => {
    if (ev.k === 'hit' && ev.ship === me.id && ev.dmg > 0) hits++;
    emit(ev, x, y);
  };
  for (let i = 0; i < 20 * 30; i++) game.step();
  game.emit = emit;
  assert.ok(me.hull < hull0, 'bitten');
  assert.ok(hits > 0, 'each bite a hit on her, its number over her');
  assert.equal(me.crew, crew0, 'not a man taken');
  clearBeasts(game);
});

test('the fight\'s length: an ordinary beast of her level 10–20 s of her guns, a great whale 20–30, a rare one no more than 40 (⚓1/3/5/8)', () => {
  for (const r of measured()) {
    const [lo, hi] = BEAST_BAND[r.beast];
    assert.ok(r.fightMed <= hi && r.fightMed >= lo * 0.5, `⚓${r.level} ${r.beast} ⚓${r.blevel}: ${r.fightMed} s from the first broadside (band ${lo}–${hi})`);
    assert.ok(r.secMed <= hi + 12, `⚓${r.level} ${r.beast}: ${r.secMed} s from «Атаковать»`);
  }
});

test('no endless beast chase: a whale that bolts turns at bay inside her guns\' reach; a chase that hits nothing for 40 s is given up', () => {
  const game = duelSea();
  const at = openWater(game, 91);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const whale = spawnBeast(game, 'humpback', at.x + 350, at.y, 5);
  assert.equal(startPursuit(game, s, whale.id, 'guns'), null);
  let bayAt = -1;
  const near: number[] = [];
  const t0 = game.now;
  while (game.now - t0 < 40 && whale.alive && game.ships.has(whale.id)) {
    game.step();
    const br = beastBrain(game, whale.id);
    if (br?.bay && bayAt < 0) bayAt = game.now - t0;
    assert.ok(!whale.hasEffect('submerged') || bayAt < 0, 'no sounding once she is on it');
    if (bayAt >= 0) near.push(Math.hypot(whale.state.x - me.state.x, whale.state.y - me.state.y));
  }
  assert.ok(bayAt >= 0 && bayAt <= BEAST_FLEE_SEC + 12, `at bay after ${bayAt.toFixed(1)} s`);
  assert.ok(q(near, 0.5) < 300, `inside her guns' reach: median ${Math.round(q(near, 0.5))} m`);
  clearBeasts(game);
  // A beast out of every ball's reach (under the water the whole time): the helmsman gives the chase up in forty seconds.
  const s2 = seaCaptain(game, 'brig', 5, at.x + 5000, at.y, 0);
  const shark = spawnBeast(game, 'shark', at.x + 5300, at.y, 5);
  shark.addEffect({ id: 'submerged', until: game.now + 1e6 }, game.now);
  assert.equal(startPursuit(game, s2, shark.id, 'guns'), null);
  const t1 = game.now;
  while (game.now - t1 < 60 && pursuitOf(s2.ship)) game.step();
  assert.equal(pursuitOf(s2.ship), null, 'given up');
  assert.ok(game.now - t1 <= 45, `after ${Math.round(game.now - t1)} s`);
  clearBeasts(game);
});

test('the beasts that rise about a captain are of her level or below: a ⚓1 captain meets ⚓1 sharks', () => {
  const game = duelSea();
  let at = openWater(game, 0);
  for (let k = 0; k < 60 && regionAt(game.world, at.x, at.y) !== 'black_coast'; k++) at = openWater(game, k);
  assert.equal(regionAt(game.world, at.x, at.y), 'black_coast');
  const s = seaCaptain(game, 'sloop', 1, at.x, at.y, 0);
  s.ship!.region = 'black_coast';
  let risen = 0;
  for (let i = 0; i < 40; i++) if (beastsPass(game, s.ship!)) risen++;
  assert.ok(risen > 0, 'sharks rise in the Black Coast for a ⚓1 captain');
  for (const b of beastsAlive(game)) assert.ok(b.shipLevel <= 1, `${b.loadout.classId} ⚓${b.shipLevel}`);
  assert.deepEqual([...new Set(beastsAlive(game).map((b) => b.loadout.classId))], ['shark']);
  clearBeasts(game);
});

/** The fights from «Атаковать» as they were before the beasts were weighed for the quick sea fight (2026-10-07, docs/23a,
 *  ten fights each: the share killed within 180 s, the median of those), and the carcass at the yields of then. */
const BEFORE: { beast: BeastId; level: number; blevel: number; sec: number; kill: number; value: number }[] = [
  { beast: 'shark', level: 1, blevel: 2, sec: 55.4, kill: 1, value: 143 },
  { beast: 'shark', level: 3, blevel: 3, sec: 14.9, kill: 1, value: 166 },
  { beast: 'orca', level: 3, blevel: 3, sec: 18.2, kill: 1, value: 469 },
  { beast: 'humpback', level: 5, blevel: 5, sec: 153.3, kill: 0.8, value: 599 },
  { beast: 'narwhal', level: 5, blevel: 5, sec: 30.4, kill: 1, value: 442 },
  { beast: 'sperm_whale', level: 8, blevel: 8, sec: 71.6, kill: 1, value: 1101 },
  { beast: 'young_serpent', level: 8, blevel: 8, sec: 63.2, kill: 1, value: 1006 },
];

test('the hunter\'s hour: the quicker kill does not double what a kind is worth an hour hunted', () => {
  for (const b of BEFORE) {
    const r = measured().find((x) => x.beast === b.beast && x.level === b.level)!;
    assert.ok(r, `${b.beast} ⚓${b.level} measured`);
    const before = (3600 / (90 + b.kill * (b.sec + BEASTS[b.beast].flense) + (1 - b.kill) * 180)) * b.kill * b.value;
    const after = huntHour(r.beast, r.blevel, r.secMed, r.killed / r.n);
    assert.ok(after <= before * 1.5, `${b.beast} ⚓${b.level}: ${Math.round(before)} → ${after} silver an hour (×${(after / before).toFixed(2)})`);
  }
});
