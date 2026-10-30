// «Где взять» (owner, 2026-10-30: «я хочу нажать на то что надо и в тултипе посмотреть где это можно купить или
// выбить»): every good and land resource any island cost asks — a producer, a building, a town building, the yard's
// ships, the workshop, the fittings, the dwellings' settling, the hire's men — has at least one place to be had
// (shared/src/data/sources.ts), at most four lines; the pearls name a harbour that really makes them; the route `sg:`
// takes her to a harbour whose market sells the good; the tooltip's words in both tongues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../shared/src/data/holdings.ts';
import { PRODUCER_KINDS, baseCost } from '../shared/src/data/base.ts';
import { TOWN_IDS, UNIT_GOODS, townCost } from '../shared/src/data/town.ts';
import { CRAFTS, DWELL_UP, FITTINGS, townLand } from '../shared/src/data/landecon.ts';
import { OWN_ROLES, ownBuildCost, ownUpgradeCost } from '../shared/src/data/baseships.ts';
import { LAND_RES } from '../shared/src/data/bestiary.ts';
import { SRC_MAX, sourcesOf } from '../shared/src/data/sources.ts';
import { KEY_PORTS } from '../shared/src/world/regions.ts';
import { NEW_PORTS } from '../shared/src/world/newports.ts';
import { EN, RU } from '../client/src/lang/ui/srctip.ts';
import { resolveGoal } from '../server/src/game/goalroute.ts';
import { ownStockOf } from '../server/src/game/ownstock.ts';
import { join, makeGame } from './helpers.ts';

/** Every thing any island cost asks: `g:<good>` and `l:<land res>`. */
function asked(): Set<string> {
  const out = new Set<string>();
  const add = (c: { goods?: object; land?: object } | null | undefined) => {
    for (const g of Object.keys(c?.goods ?? {})) out.add(`g:${g}`);
    for (const r of Object.keys(c?.land ?? {})) out.add(`l:${r}`);
  };
  for (let lv = 1; lv <= 5; lv++) {
    for (const k of PRODUCER_KINDS) add(baseCost(`p:${k}`, lv));
    for (const b of Object.keys(BUILDINGS)) add(baseCost(b, lv));
    for (const t of TOWN_IDS) {
      add(townCost(t, lv));
      add({ land: townLand(t, lv) });
    }
    for (const r of OWN_ROLES) {
      add(ownBuildCost(r));
      add(ownUpgradeCost(r, lv));
    }
  }
  for (const c of CRAFTS) add(c);
  for (const f of Object.values(FITTINGS)) out.add(`l:${f.res}`);
  for (let t = 1; t <= 7; t++) add(DWELL_UP.cost(t));
  for (const g of Object.values(UNIT_GOODS)) add({ goods: g });
  return out;
}

test('every good and land resource of an island cost has somewhere to be had (≤ 4 lines)', () => {
  const ids = asked();
  for (const r of LAND_RES) assert.ok(ids.has(`l:${r}`), `the costs ask ${r}`);
  for (const k of ['g:pearls', 'g:iron', 'g:timber', 'g:coal', 'g:tar']) assert.ok(ids.has(k), `the costs ask ${k}`);
  for (const id of ids) {
    const s = sourcesOf(id);
    assert.ok(s.length >= 1, `${id}: no source`);
    assert.ok(s.length <= SRC_MAX, `${id}: ${s.length} lines`);
  }
});

test('the sources come from the game data: the pearls, the bone, the iron', () => {
  const makers = new Set([...KEY_PORTS.filter((p) => (p.profile.produces.pearls ?? 0) > 0).map((p) => p.name), ...NEW_PORTS.filter((p) => p.produces.includes('pearls')).map((p) => p.name)]);
  const pearls = sourcesOf('g:pearls');
  const ports = pearls.find((s) => s.k === 'ports');
  assert.ok(ports && ports.k === 'ports' && ports.ports.length > 0 && ports.ports.every((n) => makers.has(n)), 'pearls: harbours that make them');
  assert.ok(pearls.some((s) => s.k === 'market'), 'pearls: the island market');
  const bone = sourcesOf('l:bone');
  assert.equal(bone[0].k, 'lairs');
  const iron = sourcesOf('g:iron');
  assert.deepEqual(iron[0], { k: 'producer', id: 'mine' });
  assert.ok(iron.some((s) => s.k === 'barge'));
  assert.deepEqual(sourcesOf('g:nonsense'), []);
});

test('«Плыть»: the route sg:<good> takes her to a harbour whose market sells it', () => {
  const { game } = makeGame();
  join(game, 'Seller');
  const s = game.sessionByName('Seller')!;
  s.ship!.docked = null;
  const r = resolveGoal(game, s, 'sg:pearls');
  assert.ok('cands' in r && r.cands.length > 0, 'some harbour sells pearls');
  if ('cands' in r) {
    const named = new Set(r.cands.map((c) => c.name));
    const sellers = game.world.ports.filter((pt) => ownStockOf(game, s.profile!, pt, 'pearls') > 0);
    assert.ok(sellers.every((pt) => named.has(pt.name) || r.cands.some((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < 2000)));
  }
  assert.ok('none' in resolveGoal(game, s, 'sg:nonsense'));
});

test('the tooltip speaks both tongues', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) assert.ok(!/[A-Za-z]{3}/.test(v.replace(/\{[a-z]+\}/g, '')), `RU ${k} has Latin`);
});
