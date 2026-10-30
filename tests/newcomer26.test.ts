// Forum topic «Я - НОВИЧЕК(НУБ)», post 26 (Нефигугум): treasure maps mark their dig spot and one button sails there and
// digs; the yard's «Снять» says what it costs; the «Верфи» filter of the chart; the yards' hull levels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMap } from '../server/src/game/explorefx.ts';
import { mapView } from '../server/src/game/treasure.ts';
import { resolveGoal, routeOf } from '../server/src/game/goalroute.ts';
import { buildPortView, unfitFee } from '../server/src/game/ports.ts';
import { toggleLayer } from '../client/src/ui/worldmap.ts';
import { yardSpan } from '../shared/src/data/yardhulls.ts';
import { join, makeGame, steps } from './helpers.ts';

test('a treasure map marks its dig spot; a cursed one keeps its needle', () => {
  const { game } = makeGame();
  join(game, 'Spot Sal', 'navigator');
  const s = game.sessionByName('Spot Sal')!;
  for (const kind of ['circle', 'riddle', 'drawing'] as const) {
    const m = makeMap(game, 1, { kind });
    const v = mapView(game, s, m);
    assert.deepEqual(v.spot, [Math.round(m.sx), Math.round(m.sy)], kind);
  }
  const cursed = makeMap(game, 1, { kind: 'cursed' });
  assert.equal(mapView(game, s, cursed).spot, undefined);
});

test('«Плыть к кладу»: the goal tm:<map> is its spot; brought there, the boats dig by themselves; dug, the goal is met', () => {
  const { game } = makeGame();
  const c = join(game, 'Dig Dora', 'navigator');
  const s = game.sessionByName('Dig Dora')!;
  const p = s.profile!;
  const m = makeMap(game, 1);
  p.explore.maps = [m];
  const r = resolveGoal(game, s, `tm:${m.id}`);
  assert.ok('cands' in r);
  assert.equal(Math.round(r.cands[0].x), Math.round(m.sx));
  // put her at sea a few hundred metres off the spot (the run's last stretch)
  const ship = s.ship!;
  ship.docked = null;
  p.docked = null;
  const is = game.world.islands[m.island!];
  const dx = m.sx - is.x, dy = m.sy - is.y, l = Math.hypot(dx, dy) || 1;
  ship.state.x = m.sx + (dx / l) * 600; // out to sea from the spot: the helmsman brings her in
  ship.state.y = m.sy + (dy / l) * 600;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.lastCombat = -999;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  c.push({ t: 'goto', key: `tm:${m.id}` });
  for (let i = 0; i < 60 && !ship.landing; i++) {
    for (const id of [...game.npcs.keys()]) game.removeShip(id);
    steps(game, 20);
  }
  assert.equal(ship.landing?.feature, 'dig', 'the boats went digging on their own');
  assert.equal(ship.landing?.mapId, m.id);
  // the boats come back with the hoard (not «nothing but sand»: the run brought her within the boats' reach)
  for (let i = 0; i < 200 && p.explore.maps.length; i++) {
    for (const id of [...game.npcs.keys()]) game.removeShip(id);
    steps(game, 20);
  }
  assert.equal(p.explore.maps.length, 0, 'the chest was dug up');
  assert.ok('done' in resolveGoal(game, s, `tm:${m.id}`));
  void routeOf;
});

test('the yard says what taking out a fitting costs', () => {
  const { game } = makeGame();
  join(game, 'Fit Finn', 'navigator');
  const s = game.sessionByName('Fit Finn')!;
  const port = game.world.ports.find((x: { shipyardTier: number; id: string }) => x.shipyardTier >= 1 && x.id === s.ship!.docked) ?? game.world.ports.find((x) => x.shipyardTier >= 1)!;
  s.ship!.loadout.modules.hull_plating = 2;
  s.ship!.recompute(game.now);
  const fee = unfitFee(s.ship!, 'hull_plating');
  assert.ok(fee > 0);
  const row = buildPortView(game, s, port).shipyard.modules.find((x) => x.module === 'hull_plating');
  if (row) assert.equal(row.unfit, fee);
});

test('the chart\'s «Верфи» filter toggles on its own; yards of rank 2 sell up to ⚓6', () => {
  const ess = new Set(['ports', 'goals'] as const);
  const on = toggleLayer(ess, 'yards');
  assert.deepEqual([...on].sort(), ['goals', 'ports', 'yards']);
  assert.deepEqual([...toggleLayer(on, 'yards')].sort(), ['goals', 'ports']);
  assert.deepEqual([...toggleLayer(on, 'all')].sort(), ['all', 'yards'], '«Всё» keeps the filter');
  assert.deepEqual([...toggleLayer(new Set(['yards'] as const), 'yards')], ['ports'], 'never none');
  assert.deepEqual(yardSpan(1, 'crown'), [1, 3]);
  assert.deepEqual(yardSpan(2, 'crown'), [1, 6]);
  assert.equal(yardSpan(0, 'crown'), null);
});
