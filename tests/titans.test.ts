// docs/19 E10: the titans — five of the eighth tier, each some 12% of the ladder's ⚓10 army (over the shop's seventh
// tier, under the sea's own legends), painted faces of their own, out of the might cap; hired at the Grail of her
// island one a week, two aboard at the most, never two of a kind, for 40 000 silver and 10 pearls; a titan in a ⚓10
// army wins it more of its boardings, and the words read in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, armyForLevel, armyPower, armyWeight } from '../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { PREMIUM_BEAST_IDS } from '../shared/src/data/premiumbeasts.ts';
import { TITAN_IDS, TITAN_MAX, TITAN_NAMES, TITAN_PRICE, TITAN_STAND_IN, isTitan, titansIn } from '../shared/src/data/titans.ts';
import { mightRoom } from '../shared/src/data/town.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { parkNear, quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { h3Message } from '../server/src/game/h3.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { titanRows } from '../server/src/game/titans.ts';
import { townState } from '../server/src/game/town.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { winRate } from './balance/recruit.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const w1 = (u: UnitId) => armyWeight([{ u, n: 1 }]);

test('five titans of the eighth tier: some 12% of a ⚓10 army each, over the shop’s seventh tier, under the sea’s legends; painted, named', () => {
  assert.equal(TITAN_IDS.length, 5);
  const army = armyPower(armyForLevel(10, 600, 7, 'player'));
  const shop7 = Math.max(...PREMIUM_BEAST_IDS.filter((u) => UNITS[u].tier === 7).map(w1));
  const legends = Math.min(...(Object.keys(UNITS) as UnitId[]).filter((u) => UNITS[u].legend && !UNITS[u].titan).map(w1));
  for (const u of TITAN_IDS) {
    const d = UNITS[u];
    assert.ok(d.tier === 8 && d.titan && d.legend && d.beast && isTitan(u), u);
    const share = armyPower([{ u, n: 1 }]) / army;
    assert.ok(share >= 0.11 && share <= 0.13, `${u}: ${(share * 100).toFixed(1)}% of a ⚓10 army`);
    assert.ok(w1(u) > shop7 && w1(u) < legends, `${u}: ${w1(u).toFixed(1)} between the shop’s ${shop7.toFixed(1)} and the legends’ ${legends.toFixed(1)}`);
    assert.ok(d.art in manifest.assets, `${u}: ${d.art} painted`);
    assert.ok(UNITS[TITAN_STAND_IN[u].u as UnitId], `${u}: its stand-in a kind of the field`);
    assert.ok(/[а-яё]/i.test(TITAN_NAMES[u].name[1]) && /[а-яё]/i.test(TITAN_NAMES[u].note[1]), `${u}: in Russian`);
  }
});

test('the titans stand out of the might cap: they take no room from the picked men, and none is held back by it', () => {
  const army: ArmyStack[] = armyForLevel(10, 600, 7, 'player').slice(0, 5);
  const without = mightRoom(army, 'marine', 10, 600, 7);
  const withTitan = mightRoom([...army, { u: 'titan_kraken', n: 1 }], 'marine', 10, 600, 7);
  // (a hammock less for the deckhands the cap fills the empty ones with: a man either way — counted, a titan's weight
  // would have taken some thirty)
  assert.ok(Math.abs(withTitan - without) <= 1, `room for marines ${without} → ${withTitan}`);
  assert.ok(mightRoom([...army, { u: 'white_whale', n: 1 }], 'marine', 10, 600, 7) < without - 10, 'a creature in the cap takes room');
  assert.equal(mightRoom(army, 'titan_whale', 10, 600, 7), Infinity);
  assert.equal(titansIn([...army, { u: 'titan_whale', n: 1 }, { u: 'titan_turtle', n: 1 }]), 2);
});

test('balance: a titan in the ⚓10 ladder’s army wins it more boardings against the pirates of its level, not all of them', () => {
  const base = armyForLevel(10, 600, 7, 'player');
  const pir = armyForLevel(10, 600, 7, 'pirate');
  const plain = winRate(base, pir, 120);
  // The titan in the slot of her weakest stack.
  const one = [...base.slice(0, 6).map((x) => ({ ...x })), { u: 'titan_leviathan' as UnitId, n: 1 }];
  const lifted = winRate(one, pir, 120);
  assert.ok(lifted > plain + 0.05, `${plain} → ${lifted}`);
  assert.ok(lifted < 0.95, `not a war won: ${lifted}`);
});

// ------------------------------------------------------------------ the Grail

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

/** A captain of ⚓10 with an island of her own and the Grail raised over its town, lying off it, pearls in her hold. */
function grailed(game: Game): PlayerSession {
  join(game, 'Titan Keeper');
  const s = game.sessionByName('Titan Keeper')!;
  onHull(game, s.ship!, 'man_o_war', 10);
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player').slice(0, 5));
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  parkNear(game, s, home.x, home.y, home.radius + 120);
  s.profile!.gold = 1_000_000;
  assert.equal(buyIsland(game, s, home.id), null);
  townState(yardOf(game, ownIsland(game, s.accountId)!)).b.grail = 1;
  s.ship!.cargo.pearls = 40;
  return s;
}

const hire = (game: Game, s: PlayerSession, u: UnitId) => h3Message(game, s, { t: 'h3', action: 'recruit', src: 'isle', u, n: 1 });
const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const said = (s: PlayerSession, from: number) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');

test('the Grail’s titans: in the island’s window, one a week, never two of a kind, two at the most, for silver and pearls', () => {
  const game = world();
  const s = grailed(game);
  steps(game, 2);
  const rows = titanRows(game, s);
  assert.deepEqual(rows.map((r) => r.units[0].u), TITAN_IDS, 'a row each');
  assert.ok(rows.every((r) => r.pool === 1 && r.tier === 8 && !r.why), JSON.stringify(rows.map((r) => r.why)));
  const gold = s.profile!.gold;
  hire(game, s, 'titan_kraken');
  assert.deepEqual(s.ship!.army.find((x) => x.u === 'titan_kraken'), { u: 'titan_kraken', n: 1 }, 'aboard');
  assert.equal(s.profile!.gold, gold - TITAN_PRICE.silver, 'its silver');
  assert.equal(s.ship!.cargo.pearls, 40 - TITAN_PRICE.pearls, 'its pearls, from the hold (the new island’s store holds none)');
  // One a week.
  let n = inbox(s).length;
  hire(game, s, 'titan_whale');
  assert.ok(said(s, n).includes('The Grail gives one titan a week: come again next week.'), said(s, n).join(' | '));
  assert.ok(!s.ship!.army.some((x) => x.u === 'titan_whale'));
  // Next week: never two of a kind; a second of another; then two at the most.
  runAdmin(game, s, '/titan reset');
  n = inbox(s).length;
  hire(game, s, 'titan_kraken');
  assert.ok(said(s, n).some((m) => /never two of a kind/.test(m)), said(s, n).join(' | '));
  hire(game, s, 'titan_whale');
  assert.equal(titansIn(s.ship!.army), 2);
  runAdmin(game, s, '/titan reset');
  n = inbox(s).length;
  hire(game, s, 'titan_turtle');
  assert.ok(said(s, n).includes('Two titans aboard at the most.'), said(s, n).join(' | '));
  assert.equal(titansIn(s.ship!.army), TITAN_MAX);
});

test('no Grail, no titans; a ship below ⚓9 is told why', () => {
  const game = world();
  const s = grailed(game);
  townState(yardOf(game, ownIsland(game, s.accountId)!)).b.grail = 0;
  assert.deepEqual(titanRows(game, s), []);
  townState(yardOf(game, ownIsland(game, s.accountId)!)).b.grail = 1;
  onHull(game, s.ship!, 'brig', 7);
  assert.ok(titanRows(game, s).every((r) => r.why === 'A titan serves a ship of level 9 and up.'));
});

test('the titans’ words read in Russian', () => {
  setLang('ru');
  try {
    for (const line of [
      'The Kraken rises at the Grail and follows your ship.',
      'The White Whale serves you already: never two of a kind.',
      'The Grail gives one titan a week: come again next week.',
      'Two titans aboard at the most.',
      'A titan serves a ship of level 9 and up.',
      'Raise the Grail over your town first.',
      'The Mother of Wrecks joins your army.',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru), `${line} → ${ru}`);
    }
  } finally {
    setLang('en');
  }
});
