// The island's residents and their trades' knacks (forum post 129): a resident adds her +40% only where it tells — the
// producing buildings, the tavern's takings, an outpost (a fisher +50% at the fishing village or the smokehouse) — and is
// not sent where she would add nothing; each trade's knack works while she lives on the island: the carpenter halves
// the weathering, the smith tempers Excellent work at the island's forge, the cook keeps a crew lying by it from losing
// heart, the cartographer copies maps for nothing, the gunner's guns fire a third more often.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARPENTER_WEAR, GUNNER_RELOAD, PROFESSIONS, PROFESSION_DEFS, RESIDENT_WORK, SMITH_EXCELLENT, estatePatterns, residentHand } from '../shared/src/data/estate.ts';
import type { Profession } from '../shared/src/data/estate.ts';
import { ITEM_BASES } from '../shared/src/data/items.ts';
import type { Item, ItemBaseId } from '../shared/src/data/items.ts';
import { TAX_WEATHER } from '../shared/src/data/baseclaim.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { claimOf, stepTax } from '../server/src/game/baseclaim.ts';
import { assignResident, buyIsland, clearOutposts, isleForge, ownIsland, residentMul } from '../server/src/game/estate.ts';
import { SALVO_SEC, islandService, stepHoldings } from '../server/src/game/holdings.ts';
import type { Holding } from '../server/src/game/holdings.ts';
import { temperItem } from '../server/src/game/gear.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';

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
  assert.ok(offCoast(game, ship, is), 'water off its coast');
  ship.state.speed = 0;
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function captain(game: Game, name: string): { s: PlayerSession; ship: ShipEntity } {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  return { s, ship: s.ship! };
}

function owner(game: Game): { s: PlayerSession; ship: ShipEntity; home: Island; h: Holding } {
  const cap = captain(game, 'Isle Owner');
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
  offShore(game, cap.ship, home);
  assert.equal(buyIsland(game, cap.s, home.id), null);
  const h = ownIsland(game, cap.s.accountId)!;
  h.residents = [];
  claimOf(game, h).calmUntil = 1e15; // no raid between the counts
  return { ...cap, home, h };
}

function resident(h: Holding, prof: Profession, at: Holding['buildings'][number]['id'] | null = null): void {
  h.residents!.push({ id: h.residents!.length + 1, prof, at: at ? { b: at } : null, since: clock });
}

const build = (h: Holding, ...ids: Holding['buildings'][number]['id'][]) => {
  for (const id of ids) h.buildings.push({ id, condition: 1, unpaid: false });
};

test('a resident works only where her hand tells: refused elsewhere; one already there gives nothing; a fisher +50% at the fishery', () => {
  const game = world();
  const { s, h } = owner(game);
  build(h, 'warehouse', 'tavern', 'fishing_village', 'smokehouse', 'farm', 'lighthouse');
  resident(h, 'fisher');
  resident(h, 'smith');
  const [fisher, smith] = h.residents!;
  assert.match(assignResident(game, s, smith.id, 'warehouse') ?? '', /adds nothing there/);
  assert.match(assignResident(game, s, smith.id, 'lighthouse') ?? '', /adds nothing there/);
  assert.equal(smith.at, null, 'not moved');
  assert.equal(assignResident(game, s, smith.id, 'tavern'), null);
  assert.equal(residentMul(h, 'tavern'), 1.4);
  assert.equal(assignResident(game, s, fisher.id, 'fishing_village'), null);
  assert.equal(residentMul(h, 'fishing_village'), 1.5);
  assert.equal(assignResident(game, s, fisher.id, 'farm'), null);
  assert.equal(residentMul(h, 'farm'), 1.4, 'a fisher on a farm is anyone');
  // One put in the warehouse before (an old save) stays, and adds nothing.
  smith.at = { b: 'warehouse' };
  assert.equal(residentMul(h, 'warehouse'), 1);
  assert.equal(residentHand('fisher', 'smokehouse'), 0.5);
  assert.equal(residentHand('cook', 'smokehouse'), 0.4);
  assert.equal(residentHand('cook', 'shipyard'), 0);
  for (const id of ['farm', 'fishing_village', 'mine', 'plantation', 'sawmill', 'distillery', 'powder_mill', 'smokehouse', 'try_works', 'tavern'] as const) assert.ok(RESIDENT_WORK[id], id);
  assert.equal(RESIDENT_WORK.shipyard, undefined);
  setLang('ru');
  assert.match(serverText('A resident adds nothing there: send her to a producing building, the tavern or an outpost.'), /ничего не даёт/);
  assert.match(serverText('Cutlass +2 is Excellent work: the smith of your island tempered it.'), /отличная работа/);
  setLang('en');
  for (const [en, ru] of estatePatterns()) assert.equal((en.match(/\{\d\}/g) ?? []).sort().join(), (ru.match(/\{\d\}/g) ?? []).sort().join(), en);
  for (const p of PROFESSIONS) assert.ok(PROFESSION_DEFS[p].knack[1] && !/[a-z]/i.test(PROFESSION_DEFS[p].knack[1]), p);
});

test('the tavern’s takings: a resident there brings in +40%', () => {
  const day = (game: Game, h: Holding): number => {
    const t0 = h.treasury;
    h.lastWork = clock;
    clock += 24 * 3_600_000;
    for (let i = 0; i < 10; i++) {
      game.now += 1;
      stepHoldings(game);
    }
    return h.treasury - t0;
  };
  const game = world();
  const { s, h } = owner(game);
  build(h, 'tavern');
  game.rng.float = () => 0.5; // the takings' chance held still
  h.treasury = 1000;
  const alone = day(game, h);
  resident(h, 'cook');
  assert.equal(assignResident(game, s, 1, 'tavern'), null);
  const worked = day(game, h);
  assert.ok(alone > 0 && Math.abs(worked - alone * 1.4) <= 2, `${worked} vs ${alone}`);
});

test('the carpenter: an unpaid tax weathers the buildings half as much', () => {
  const game = world();
  const { h, home } = owner(game);
  build(h, 'farm');
  const weather = (): number => {
    const c = claimOf(game, h);
    for (const b of h.buildings) b.condition = 1;
    h.treasury = 0;
    c.taxAt = clock - 1;
    stepTax(game, h, home, c, clock);
    return 1 - h.buildings[0].condition;
  };
  const bare = weather();
  assert.ok(bare > 0, 'the waters ask a tax');
  assert.ok(Math.abs(bare - TAX_WEATHER) < 1e-9);
  resident(h, 'carpenter');
  assert.ok(Math.abs(weather() - TAX_WEATHER * CARPENTER_WEAR) < 1e-9);
});

test('the smith: at her island’s forge one tempering in five comes out Excellent; elsewhere never', () => {
  const game = world();
  const { s, ship, home, h } = owner(game);
  build(h, 'forge');
  offShore(game, ship, home);
  const forge = isleForge(game, s)!;
  assert.ok(forge);
  const base = Object.keys(ITEM_BASES)[0] as ItemBaseId;
  const temperMany = (n: number): number => {
    let fine = 0;
    for (let i = 0; i < n; i++) {
      const it: Item = { uid: 10_000 + i + (h.residents!.length ? n : 0), base, ilvl: 1, rarity: 0, affixes: [], dur: 100 };
      s.profile!.stash.push(it);
      ship.cargo.iron = 1000;
      ship.cargo.planks = 1000;
      s.profile!.gold = 10_000_000;
      assert.equal(temperItem(game, s, forge, it.uid), null);
      if (it.excellent) fine++;
      s.profile!.stash = s.profile!.stash.filter((x) => x !== it);
    }
    return fine;
  };
  assert.equal(temperMany(40), 0, 'no smith, no Excellent work');
  resident(h, 'smith');
  const fine = temperMany(200);
  assert.ok(fine >= 200 * SMITH_EXCELLENT * 0.5 && fine <= 200 * SMITH_EXCELLENT * 1.6, `${fine} of 200`);
});

test('the cook: a crew lying by her island does not lose heart; away from it, it does', () => {
  const game = world();
  const { ship, home, h } = owner(game);
  const upkeep = (): number => {
    ship.morale = 95;
    ship.cargo.provisions = 500;
    (game as unknown as { shipUpkeep(x: ShipEntity): void }).shipUpkeep(ship);
    return ship.morale;
  };
  offShore(game, ship, home);
  assert.ok(upkeep() < 95, 'no cook: spirits drift down to the baseline');
  resident(h, 'cook');
  assert.equal(upkeep(), 95, 'the cook keeps them');
  ship.state.x += 40_000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.ok(upkeep() < 95, 'away from the island the knack is not there');
});

test('the cartographer: the chart house copies a map for nothing', () => {
  const game = world();
  const { s, ship, home, h } = owner(game);
  build(h, 'chart_house');
  offShore(game, ship, home);
  const p = s.profile!;
  p.explore.maps = [{ id: 'm1', name: 'Old map' } as unknown as (typeof p.explore.maps)[number]];
  p.gold = 10_000;
  assert.equal(islandService(game, s, home.id, 'copy_map', 'm1'), null);
  assert.ok(p.gold < 10_000, 'paid without a cartographer');
  resident(h, 'cartographer');
  const g = p.gold;
  assert.equal(islandService(game, s, home.id, 'copy_map', 'm1'), null);
  assert.equal(p.gold, g, 'free with one');
  assert.equal(p.explore.maps.length, 3);
});

test('the gunner: the island’s guns reload in three quarters of the time', () => {
  const game = world();
  const { s, home, h } = owner(game);
  build(h, 'battery');
  const { ship: foe } = captain(game, 'Foe Fenn');
  offShore(game, foe, home);
  const key = -1 - s.accountId;
  const salvo = (): number => {
    game.holdings.nextSalvo.delete(key);
    game.holdings.aggressors.set(home.id, new Map([[foe.id, game.now + 600]]));
    game.now += 1;
    stepHoldings(game);
    return (game.holdings.nextSalvo.get(key) ?? 0) - game.now;
  };
  assert.equal(salvo(), SALVO_SEC);
  resident(h, 'gunner');
  assert.equal(salvo(), SALVO_SEC * GUNNER_RELOAD);
});
