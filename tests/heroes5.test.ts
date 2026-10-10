// docs/17 H5 — the Heroes' sections wired together and the balance pass: the island's guild of orders teaching
// through the hero's learnOrder (a fixed list a floor, HoMM3's mage guild), the map's chests and the guards' chests
// holding artifacts, the altars' primary skills, the wells' will, the Grail's will, the guilds, merchants and shrines on
// the chart; the boarding battle less all-or-nothing in the head count, the picked men's might cap, the guards' chests
// each captain's once a week.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHEST_ART, GRAIL_WILL, altarPrim } from '../shared/src/data/advmap.ts';
import { UNITS, armyForLevel, armyMen, armyWeight } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { ARTIFACTS } from '../shared/src/data/artifacts.ts';
import { ISLE_GUILD_COUNT, ORDERS, isleGuildOrders } from '../shared/src/data/hero.ts';
import { MIGHT_CAP, TOWN, mightCap, mightRoom, townCost, townGate } from '../shared/src/data/town.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { advHooks, advMap, cardView, downGuard, guardBeaten, guardLooted, guardShip, parkNear, quietAdv, visit } from '../server/src/game/advmap.ts';
import { thisWeek, adminWeek } from '../server/src/game/calendar.ts';
import { recruit, train } from '../server/src/game/dwell.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { yardOf } from '../server/src/game/base.ts';
import { heroOf, heroSecond, heroView, willMax } from '../server/src/game/hero.ts';
import { chestArtifact } from '../server/src/game/h5.ts';
import { learnAtIsle, townState, townView } from '../server/src/game/town.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { blowParts, newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name = 'Wiring Tester', level = 5): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', level);
  s.ship!.setArmy(armyForLevel(level, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 2_000_000;
  return s;
}

function offShore(game: Game, s: PlayerSession, is: Island): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 100), y = is.y - Math.cos(a) * (is.radius + 100);
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

function islander(game: Game): { s: PlayerSession; home: Island } {
  const s = captain(game, 'Guild Builder');
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  offShore(game, s, home);
  assert.equal(buyIsland(game, s, home.id), null);
  return { s, home };
}

function go(game: Game, s: PlayerSession, kind: string): string {
  runAdmin(game, s, `/obj ${kind} go`);
  const ship = s.ship!;
  const o = advMap(game).objs.filter((x) => x.kind === kind).sort((a, b) => Math.hypot(a.x - ship.state.x, a.y - ship.state.y) - Math.hypot(b.x - ship.state.x, b.y - ship.state.y))[0];
  if (o.guard) downGuard(game, o.guard);
  return o.id;
}

// ------------------------------------------------------------------------------------------------ A. the wiring

test('the island\'s guild of orders: five floors, a fixed list of each floor\'s level, taught free through learnOrder while she lies off it', () => {
  assert.equal(TOWN.guild.max, 5);
  for (let L = 1; L <= 5; L++) {
    assert.ok(townCost('guild', L).silver > (L > 1 ? townCost('guild', L - 1).silver : 0), `floor ${L} dearer`);
    assert.ok(townGate('guild', L).isle >= (L > 1 ? townGate('guild', L - 1).isle : 1));
    assert.equal(TOWN.guild.names[L - 1].length, 2);
  }
  // The same island, the same list; each floor its own level's orders, none of a captain's own pages.
  const a = isleGuildOrders(77, 5), b = isleGuildOrders(77, 5);
  assert.deepEqual(a, b);
  a.forEach((list, i) => {
    assert.equal(list.length, ISLE_GUILD_COUNT[i + 1], `floor ${i + 1}`);
    assert.equal(new Set(list).size, list.length);
    for (const id of list) assert.ok(ORDERS[id].level === i + 1 && !ORDERS[id].sig, id);
  });
  assert.deepEqual(isleGuildOrders(77, 2), a.slice(0, 2), 'a higher floor keeps the lower floors\' lists');
  assert.notDeepEqual(isleGuildOrders(78, 5), a, 'each island its own');

  const game = world();
  const { s, home } = islander(game);
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  assert.match(learnAtIsle(game, s, a[0][0]) ?? '', /no guild/);
  townState(y).b.guild = 3;
  const list = isleGuildOrders(home.id, 3);
  const h = heroOf(s.profile!);
  const fresh = list[0].find((id) => !h.orders.includes(id))!;
  const gold = s.profile!.gold;
  assert.equal(learnAtIsle(game, s, fresh), null);
  assert.ok(h.orders.includes(fresh), 'into her book');
  assert.equal(s.profile!.gold, gold, 'free, as HoMM3\'s mage guild');
  assert.match(learnAtIsle(game, s, fresh) ?? '', /already/);
  assert.match(learnAtIsle(game, s, isleGuildOrders(home.id, 5)[4][0]) ?? '', /does not teach/, 'not a floor she has');
  // Her level caps the orders she may learn (level 3 at her level 1).
  s.profile!.level = 1;
  assert.match(learnAtIsle(game, s, list[2][0]) ?? '', /beyond you/);
  s.profile!.level = 30;
  // The window shows the floors.
  const tv = townView(game, s, ownIsland(game, s.accountId)!, y).things.find((x) => x.id === 'guild')!;
  assert.equal(tv.orders!.length, list.flat().length);
  assert.ok(tv.orders!.some((o) => o.id === fresh && o.known));
  // Away from the island she cannot learn there.
  s.ship!.state.x += 20_000;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  assert.match(learnAtIsle(game, s, list[1].find((id) => !h.orders.includes(id)) ?? list[1][0]) ?? '', /Lie off|already/);
});

test('a chest on the map may hold an artifact for her this week, on its own dice: the card shows it, the boats bring it', () => {
  const game = world();
  const s = captain(game);
  // Over many chests and weeks, the share is the chance (guarded more often than open).
  let open = 0, guarded = 0;
  for (let k = 0; k < 4000; k++) {
    if (chestArtifact(k % 40, 7, `o${k}`, false)) open++;
    if (chestArtifact(k % 40, 7, `o${k}`, true)) guarded++;
  }
  assert.ok(Math.abs(open / 4000 - CHEST_ART.open) < 0.025 && Math.abs(guarded / 4000 - CHEST_ART.guarded) < 0.03, `${open} / ${guarded}`);
  assert.equal(chestArtifact(3, 7, 'o9', true), chestArtifact(3, 7, 'o9', true), 'the same chest, week and captain: the same');
  // A chest that holds one for her this week.
  const chests = advMap(game).objs.filter((o) => o.kind === 'chest');
  let found: (typeof chests)[number] | undefined;
  for (let w = 0; w < 8 && !found; w++) {
    found = chests.find((o) => chestArtifact(thisWeek(game), s.accountId, o.id, !!o.guard));
    if (!found) adminWeek(game, 'next');
  }
  assert.ok(found, 'some chest holds an artifact');
  if (found!.guard) downGuard(game, found!.guard);
  parkNear(game, s, found!.x, found!.y, 120);
  const card = cardView(game, s)!.obj!;
  assert.equal(card.id, found!.id);
  const art = chestArtifact(thisWeek(game), s.accountId, found!.id, !!found!.guard)!;
  assert.equal(card.chest!.extra!.id, 'art');
  assert.ok(card.chest!.extra!.label[0].includes(ARTIFACTS[art].name[0]) && card.chest!.extra!.label[1].includes(ARTIFACTS[art].name[1]));
  const n = s.profile!.stash.length, gold = s.profile!.gold;
  const probe = game.rng.float;
  let drawn = 0;
  game.rng.float = () => (drawn++, probe.call(game.rng));
  assert.equal(visit(game, s, found!.id, 'art'), null);
  assert.equal(s.profile!.stash.length, n + 1, 'into the locker');
  assert.equal(s.profile!.stash[n].art, art, 'the artifact the card showed');
  assert.equal(s.profile!.gold, gold, 'instead of the silver');
  assert.equal(drawn, 0, "the sea's rng untouched");
  game.rng.float = probe;
  assert.equal(visit(game, s, found!.id, 'silver'), 'Nothing new here yet.', 'once a week');
});

test('a guard\'s chest: each captain\'s once a week while the guard stands for all; an artifact now and then on the hero\'s dice', () => {
  const game = world();
  const s = captain(game);
  const t = captain(game, 'Second Captain');
  runAdmin(game, s, '/guard go');
  steps(game, 60);
  const g = advMap(game).guards.find((x) => guardShip(game, x.id))!;
  const ship = guardShip(game, g.id)!;
  const gold = s.profile!.gold;
  assert.ok(guardBeaten(game, s.ship!, ship));
  assert.ok(s.profile!.gold > gold, 'its chest');
  assert.ok(guardLooted(game, s.profile!, g), 'hers this week');
  assert.ok(!guardLooted(game, t.profile!, g), 'not the other captain\'s');
  // It stands again; beaten again the same week, only the lesson.
  game.now += 2 * 48 * 60 + 1;
  const gold2 = s.profile!.gold;
  assert.ok(guardBeaten(game, s.ship!, ship));
  assert.equal(s.profile!.gold, gold2, 'no second chest this week');
  // The other captain beats it: her chest.
  game.now += 2 * 48 * 60 + 1;
  const tg = t.profile!.gold;
  assert.ok(guardBeaten(game, t.ship!, ship));
  assert.ok(t.profile!.gold > tg);
  adminWeek(game, 'next');
  assert.ok(!guardLooted(game, s.profile!, g), 'a new week, a new chest');
  // The artifact: on the hero's own dice, by the guard's size (a strong guard's chest a third of the time or so).
  let arts = 0;
  const before = s.profile!.stash.length;
  for (let k = 0; k < 60; k++) {
    s.profile!.stash.length = Math.min(s.profile!.stash.length, before);
    const n = s.profile!.stash.length;
    advHooks.guardChest!(game, s, { ...g, size: 'strong' });
    if (s.profile!.stash.length > n) arts++;
  }
  assert.ok(arts >= 8 && arts <= 36, `${arts}/60 strong guards' chests held an artifact`);
});

test('an altar teaches a primary skill of the hero\'s, once, by its own kind; a well fills her will; the Grail deepens it', () => {
  const game = world();
  const s = captain(game);
  const p = s.profile!;
  const id = go(game, s, 'altar');
  const prim = altarPrim(id);
  assert.equal(cardView(game, s)!.obj!.altar!.prim, prim, 'the card says which');
  const before = heroOf(p).prim[prim];
  assert.equal(visit(game, s, id), null);
  assert.equal(heroOf(p).prim[prim], before + 1, `${prim} +1`);
  assert.equal(visit(game, s, id), 'You have been here already.');
  // It survives the level's growth (heroOf grows from her level on).
  p.level += 1;
  assert.ok(heroOf(p).prim[prim] >= before + 1);
  // The altars between them teach every primary.
  assert.equal(new Set(advMap(game).objs.filter((o) => o.kind === 'altar').map((o) => altarPrim(o.id))).size, 4);

  const w = go(game, s, 'well');
  const h = heroOf(p);
  h.mana = 0;
  assert.equal(visit(game, s, w), null);
  assert.equal(h.mana, willMax(p, h), 'her will whole');

  // The Grail in her town: +10 to her store of will.
  const plain = willMax(p, h);
  assert.equal(GRAIL_WILL, 10);
  const is = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  offShore(game, s, is);
  assert.equal(buyIsland(game, s, is.id), null);
  townState(yardOf(game, ownIsland(game, s.accountId)!)).b.grail = 1;
  heroSecond(game, s);
  assert.equal(willMax(p, h), plain + GRAIL_WILL);
  assert.equal(heroView(p).willMax, plain + GRAIL_WILL, 'the captain\'s window shows it');
});

test('every new line of H5 reads in Russian', () => {
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const l of [
      'The Rotting Hulk is beaten. You emptied its chest this week already. The Treasure Chest lies open.',
      'The bell’s note stays with you: Attack +1.',
      `In the chest: ${ARTIFACTS.kelp_coat.name[0]}.`,
      'Lie off your island to learn at its guild.',
      'Your crew is as strong as a ship of level 5 carries: raise her level for better men.',
    ]) {
      const r = serverText(l);
      assert.notEqual(r, l, l);
      assert.ok(!/[A-Za-z]{3,}/.test(r), `${l} → ${r}`);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});

// ------------------------------------------------------------------------------------------------ B. the balance

const side = (army: ArmyStack[]): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

function wins(a: ArmyStack[], b: ArmyStack[], n: number): number {
  let w = 0;
  for (let k = 0; k < n; k++) {
    const rng = new Rng(k * 31 + 7);
    const bt = newBattle(side(a), side(b), k * 31 + 7, 0, rng);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return w / n;
}

function thin(a: ArmyStack[], share: number): ArmyStack[] {
  const out = a.map((x) => ({ ...x }));
  let left = Math.round(armyMen(a) * share);
  for (const s of out) {
    const k = Math.min(s.n - 1, Math.round(s.n * share), left);
    s.n -= k;
    left -= k;
  }
  return out;
}

// docs/17 H5's «backs to the rail» (the side with less strength left struck up to 40% harder, so a tenth fewer men lost
// seven fights in ten) is gone — owner, 2026-10-10: «9 матросов убили 20 моих матросов с одного удара … чини атаку всем».
// It was a lift no card showed, on the weaker side. A tenth fewer men is HoMM3's square law again: lost most of the time.
test('a tenth fewer men: the square law, no lift for the weaker side; a third fewer is lost', () => {
  const a = armyForLevel(5, 100, 6, 'pirate');
  const tenth = 1 - wins(thin(a, 0.1), a, 120);
  assert.ok(tenth >= 0.7, `a tenth fewer: lost ${Math.round(tenth * 100)}%`);
  assert.ok(1 - wins(thin(a, 0.34), a, 60) >= 0.9, 'a third shot away: lost');
  // The same stack strikes the same whether her side is half the other's or whole.
  const half = newBattle(side(a), side(thin(a, 0.5)), 3, 0, new Rng(1)), whole = newBattle(side(a), side(a), 3, 0, new Rng(1));
  const mul = (bt: ReturnType<typeof newBattle>) => blowParts(bt, bt.stacks.find((x) => x.side === 1)!, bt.stacks.find((x) => x.side === 0)!, 'melee').mul;
  assert.ok(Math.abs(mul(half) - mul(whole)) < 1e-9);
});

test('the picked men\'s might cap: a ship\'s trained men and upgrades held to her level\'s weight; deckhands always sign on', () => {
  for (let L = 2; L <= 10; L++) assert.ok(MIGHT_CAP[L] >= MIGHT_CAP[L - 1] && MIGHT_CAP[L] >= 1, `⚓${L}`);
  const lad = armyForLevel(7, 220, 7, 'player');
  assert.ok(armyWeight(lad) <= mightCap(7, 220, 7) + 1e-9, "the ladder's crew is not over it (×1 to ⚓7 after H5)");
  assert.equal(mightRoom(lad, 'deckhand', 7, 220, 7), Infinity, 'tier 1 never held back');
  assert.ok(armyWeight([{ u: 'life_guard', n: 220 }]) > mightCap(7, 220, 7), 'a crew of life guards is over it');
  // On her island's dwellings: over the cap no marines, deckhands all the same; under it, marines.
  const game = world();
  const { s } = islander(game);
  const ship = s.ship!;
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  const t = townState(y);
  t.b = { keep: 1, dw1: 1, dw2: 2 };
  t.w = thisWeek(game);
  t.pool = [0, 50, 50, 0, 0, 0, 0, 0];
  const M = ship.stats.crewMax;
  ship.setArmy([{ u: 'cutthroat', n: Math.floor(M * 0.2) }, { u: 'sharpshooter', n: Math.floor(M * 0.6) }]);
  assert.ok(armyWeight(ship.army) > mightCap(ship.shipLevel, M, ship.armySlots), 'over the cap');
  assert.match(recruit(game, s, 'isle', 'marine', 5) ?? '', /as strong as a ship of level/);
  assert.match(train(game, s, 'isle', 'marine', 1) ?? '', /None of them|as strong/);
  assert.equal(recruit(game, s, 'isle', 'deckhand', 5), null, 'deckhands always');
  ship.setArmy(armyForLevel(ship.shipLevel, Math.floor(M * 0.7), ship.armySlots, 'player'));
  const room = mightRoom(ship.army, 'marine', ship.shipLevel, M, ship.armySlots);
  assert.ok(room > 0 && room < M);
  assert.equal(recruit(game, s, 'isle', 'marine', 5), null, 'under the cap: marines');
  // Upgrades are held too: train every marine aboard into a sea guard only as far as the cap allows.
  const n = ship.army.find((x) => x.u === 'marine')!.n;
  assert.equal(train(game, s, 'isle', 'marine', n), null);
  assert.ok(armyWeight(ship.army) <= mightCap(ship.shipLevel, M, ship.armySlots) + 1e-6 || !ship.army.some((x) => x.u === 'marine'));
  void UNITS;
});
