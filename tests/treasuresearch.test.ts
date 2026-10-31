// Forum post 34 (Нефигугум): the exact spot on the chart killed the fun and «Кладоискатель» with it. The chart draws a
// search circle (the tier's radius, the perk shrinking it), «Плыть к кладу» takes her into the circle, the spot is a
// scroll on the water the server only names within her lookouts' sight, warm/cold inside the circle, the dig as before;
// the chart's own «Сокровища» layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import { makeMap } from '../server/src/game/explorefx.ts';
import type { TreasureMap } from '../server/src/game/explorefx.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { TM_SIGHT, mapView, searchCircle } from '../server/src/game/treasure.ts';
import { circleAim, resolveGoal, routeOf } from '../server/src/game/goalroute.ts';
import { defaultLayers, keptLayers, toggleLayer } from '../client/src/ui/worldmap.ts';
import { searchMemo, searchStep } from '../client/src/ui/tmsearch.ts';
import { scrollsOf } from '../client/src/render/treasurescroll.ts';
import type { MapView } from '../shared/src/protocol.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks = {}) {
  const c = join(game, name, 'navigator');
  const s = game.sessionByName(name)!;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.explore.maps = [];
  return { c, s, ship: s.ship!, p: s.profile! };
}

function toSea(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.lastCombat = -999;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, x, y);
}

/** Out to sea from the spot (away from its island), `d` metres. */
function offSpot(game: Game, m: TreasureMap, d: number): { x: number; y: number } {
  const is = game.world.islands[m.island!];
  const dx = m.sx - is.x, dy = m.sy - is.y, l = Math.hypot(dx, dy) || 1;
  return { x: m.sx + (dx / l) * d, y: m.sy + (dy / l) * d };
}

test('the search circle: the tier\'s radius, «Кладоискатель» 20% smaller a rank; the spot always inside it', () => {
  const { game } = makeGame();
  const plain = captain(game, 'Plain Pat');
  const one = captain(game, 'One Rank', { exp_treasure_hunter: 1 });
  const two = captain(game, 'Two Ranks', { exp_treasure_hunter: 2 });
  for (const [tier, base] of [[1, 900], [2, 1400], [3, 2000]] as const) {
    for (let i = 0; i < 12; i++) {
      const m = makeMap(game, tier);
      const a = mapView(game, plain.s, m), b = mapView(game, one.s, m), c = mapView(game, two.s, m);
      assert.equal(a.r, base);
      assert.equal(b.r, Math.round(base * 0.8));
      assert.equal(c.r, Math.round(base * 0.6));
      for (const v of [a, b, c]) assert.ok(Math.hypot(v.x - m.sx, v.y - m.sy) <= v.r + 1, 'the spot lies in the circle');
      assert.ok(Math.hypot(a.x - m.sx, a.y - m.sy) > 0.15 * a.r, 'the circle is not centred on the spot');
    }
  }
  // the riddles, drawings and landmarks draw it too (their words on top); a cursed map keeps its needle
  for (const kind of ['riddle', 'drawing', 'landmark'] as const) assert.ok(mapView(game, plain.s, makeMap(game, 2, { kind })).r > 0, kind);
  const cursed = mapView(game, plain.s, makeMap(game, 3, { kind: 'cursed' }));
  assert.equal(cursed.r, -1);
  assert.equal(typeof cursed.bearing, 'number');
});

test('the spot is never sent to the client out of sight: only the scroll within TM_SIGHT, or a circle drawn to a point', () => {
  const { game } = makeGame();
  const { c, s, p } = captain(game, 'Peek Pia');
  const m = makeMap(game, 1);
  p.explore.maps = [m];
  const far = offSpot(game, m, TM_SIGHT + 900);
  toSea(game, s, far.x, far.y);
  game.pushSelf(s, true);
  const sent = c.last('self')!.self;
  const v = sent.maps.find((x) => x.id === m.id)!;
  assert.ok(v && v.r > 0, 'the circle goes');
  assert.equal(v.spot, undefined, 'the spot does not');
  const json = JSON.stringify(sent);
  assert.ok(!(json.includes(String(Math.round(m.sx))) && json.includes(String(Math.round(m.sy)))), 'the spot\'s numbers are nowhere in the payload');
  // in her lookouts' sight: the scroll's place comes
  const near = offSpot(game, m, TM_SIGHT - 60);
  toSea(game, s, near.x, near.y);
  game.pushSelf(s, true);
  const seen = c.last('self')!.self.maps.find((x) => x.id === m.id)!;
  assert.deepEqual(seen.spot, [Math.round(m.sx), Math.round(m.sy)]);
  assert.equal(seen.heat, undefined, 'no warm/cold once the scroll is in sight');
  // in port: nothing in sight
  s.ship!.docked = game.world.ports[0].id;
  assert.equal(mapView(game, s, m).spot, undefined);
  // a circle drawn to a point (Legend Seeker on a legendary map): the spot at once, wherever she is
  const seeker = captain(game, 'Seeker Sol', { exp_legend_seeker: 1 });
  const leg = makeMap(game, 3, { legendary: true });
  toSea(game, seeker.s, 1000, 1000);
  const lv = mapView(game, seeker.s, leg);
  assert.equal(lv.r, 0);
  assert.deepEqual(lv.spot, [Math.round(leg.sx), Math.round(leg.sy)]);
});

test('warm/cold inside the circle: «тепло» far in it, hotter nearer the scroll; none outside', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Warm Wes');
  // a big circle (a legendary map) so all three steps fit inside it
  const m = makeMap(game, 3);
  p.explore.maps = [m];
  const c = searchCircle(game, s, m)!;
  const heatAt = (x: number, y: number) => {
    toSea(game, s, x, y);
    return mapView(game, s, m).heat;
  };
  // outside the circle: nothing
  const ux = (c.x - m.sx) / (Math.hypot(c.x - m.sx, c.y - m.sy) || 1), uy = (c.y - m.sy) / (Math.hypot(c.x - m.sx, c.y - m.sy) || 1);
  assert.equal(heatAt(c.x + ux * (c.r + 300), c.y + uy * (c.r + 300)), undefined);
  // along the line from the far edge to the spot: never colder as she nears it
  const edge = { x: c.x + ux * (c.r - 20), y: c.y + uy * (c.r - 20) };
  let last = 0;
  const seen = new Set<number>();
  for (let f = 0; f <= 1; f += 0.02) {
    const x = edge.x + (m.sx - edge.x) * f, y = edge.y + (m.sy - edge.y) * f;
    const h = heatAt(x, y);
    if (Math.hypot(m.sx - x, m.sy - y) <= TM_SIGHT) {
      assert.equal(h, undefined);
      continue;
    }
    assert.ok(h !== undefined && h >= last, `heat ${h} after ${last}`);
    last = h!;
    seen.add(h!);
  }
  assert.ok(seen.has(3), 'hot before the scroll is in sight');
});

test('«Плыть к кладу» into the circle: she lies in it and does not dig; the scroll in sight, the run takes her there and the boats dig', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Search Sue');
  // a map whose circle's aim is well out of sight of its spot: she must search
  let m = makeMap(game, 1);
  for (let i = 0; i < 200; i++) {
    const a = circleAim(game, searchCircle(game, s, m)!);
    if (Math.hypot(a.x - m.sx, a.y - m.sy) > TM_SIGHT + 250) break;
    m = makeMap(game, 1);
  }
  p.explore.maps = [m];
  const circ = searchCircle(game, s, m)!;
  const r = resolveGoal(game, s, `tm:${m.id}`);
  assert.ok('cands' in r);
  const aim = circleAim(game, circ);
  assert.equal(Math.round(r.cands[0].x), Math.round(aim.x));
  assert.ok(Math.hypot(aim.x - circ.x, aim.y - circ.y) <= circ.r, 'the aim lies in the circle');
  assert.ok(!isLand(game.world, aim.x, aim.y), 'the aim is water');
  // started a mile off the circle's aim, on the far side from the spot
  const ux = (aim.x - m.sx) / (Math.hypot(aim.x - m.sx, aim.y - m.sy) || 1), uy = (aim.y - m.sy) / (Math.hypot(aim.x - m.sx, aim.y - m.sy) || 1);
  let start = { x: aim.x + ux * (circ.r + 500), y: aim.y + uy * (circ.r + 500) };
  if (isLand(game.world, start.x, start.y)) start = { x: aim.x, y: aim.y };
  toSea(game, s, start.x, start.y);
  c.push({ t: 'goto', key: `tm:${m.id}` });
  let inside = false;
  for (let i = 0; i < 150; i++) {
    for (const id of [...game.npcs.keys()]) game.removeShip(id);
    steps(game, 20);
    if (Math.hypot(ship.state.x - circ.x, ship.state.y - circ.y) <= circ.r) inside = true;
    if (inside && Math.hypot(ship.state.x - aim.x, ship.state.y - aim.y) < 160) break;
  }
  assert.ok(inside, 'brought into the circle');
  assert.ok(Math.hypot(ship.state.x - m.sx, ship.state.y - m.sy) > TM_SIGHT, 'lying at the aim, the scroll out of sight');
  assert.ok(!ship.landing, 'no digging in the middle of a circle');
  assert.ok(routeOf(game, s), 'the run keeps the goal');
  assert.ok(mapView(game, s, m).heat, 'warm/cold says she is in its waters');
  // she searches on her own and comes in sight of the scroll
  const near = offSpot(game, m, TM_SIGHT - 80);
  toSea(game, s, near.x, near.y);
  for (let i = 0; i < 80 && !ship.landing; i++) {
    for (const id of [...game.npcs.keys()]) game.removeShip(id);
    steps(game, 20);
  }
  const dig = ship.landing as { feature: string; mapId?: string } | null;
  assert.equal(dig?.feature, 'dig', 'the scroll seen, the boats dig');
  assert.equal(dig?.mapId, m.id);
  for (let i = 0; i < 220 && p.explore.maps.length; i++) {
    for (const id of [...game.npcs.keys()]) game.removeShip(id);
    steps(game, 20);
  }
  assert.equal(p.explore.maps.length, 0, 'dug up at the spot');
});

test('a cursed map: no circle, no run until its scroll is in sight; then the run to it', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Cursed Cal');
  const m = makeMap(game, 3, { kind: 'cursed' });
  p.explore.maps = [m];
  const far = offSpot(game, m, 3000);
  toSea(game, s, far.x, far.y);
  assert.ok('none' in resolveGoal(game, s, `tm:${m.id}`));
  const near = offSpot(game, m, 200);
  toSea(game, s, near.x, near.y);
  const r = resolveGoal(game, s, `tm:${m.id}`);
  assert.ok('cands' in r && Math.round(r.cands[0].x) === Math.round(m.sx));
});

test('circleAim: a circle\'s middle ashore — the open water nearest it, inside the circle', () => {
  const { game } = makeGame();
  const is = game.world.islands.find((i) => !i.portId && i.radius > 300)!;
  const aim = circleAim(game, { x: is.x, y: is.y, r: is.radius + 900 });
  assert.ok(!isLand(game.world, aim.x, aim.y));
  assert.ok(Math.hypot(aim.x - is.x, aim.y - is.y) <= is.radius + 900);
  const sea = circleAim(game, { x: aim.x, y: aim.y, r: 900 });
  assert.deepEqual(sea, aim, 'a middle on the water is the aim itself');
});

test('the chart\'s «Сокровища» layer: its own toggle, in the essentials, and added to a chart kept from before', () => {
  assert.ok(defaultLayers(true).has('treasure'));
  assert.deepEqual([...defaultLayers(false)], ['all']);
  const ess = defaultLayers(true);
  const off = toggleLayer(ess, 'treasure');
  assert.ok(!off.has('treasure') && off.has('goals'), 'off without touching «Цели»');
  assert.ok(toggleLayer(off, 'treasure').has('treasure'));
  assert.deepEqual([...toggleLayer(new Set(['all'] as const), 'all')].sort(), ['goals', 'lairs', 'ports', 'treasure']);
  assert.deepEqual([...toggleLayer(new Set(['all'] as const), 'treasure')], ['treasure'], 'from «Всё», the one layer');
  assert.deepEqual([...toggleLayer(new Set(['treasure'] as const), 'treasure')], ['treasure'], 'never none');
  // a chart kept before the layer was: its maps were under «Цели», so it gets «Сокровища» once
  assert.ok(keptLayers(['ports', 'goals'], false).has('treasure'));
  assert.ok(!keptLayers(['ports', 'goals'], true).has('treasure'), 'once: turned off after, it stays off');
  assert.deepEqual([...keptLayers(['all'], false)], ['all']);
});

test('the client: «в районе клада» once on entering a circle (not on its edge every second), the scroll\'s sighting once', () => {
  const m: MapView = { id: 'm1', name: 'Stained map — Isle', tier: 1, kind: 'circle', x: 0, y: 0, r: 900 };
  const memo = searchMemo();
  assert.equal(searchStep(memo, [m], 2000, 0).entered.length, 0);
  assert.equal(searchStep(memo, [m], 890, 0).entered.length, 1);
  assert.equal(searchStep(memo, [m], 600, 0).entered.length, 0);
  assert.equal(searchStep(memo, [m], 905, 0).entered.length, 0, 'just over the edge: still in');
  assert.equal(searchStep(memo, [m], 895, 0).entered.length, 0);
  searchStep(memo, [m], 1200, 0); // well out
  assert.equal(searchStep(memo, [m], 800, 0).entered.length, 1, 'back in: said again');
  const seen = { ...m, spot: [300, 0] as [number, number] };
  assert.equal(searchStep(memo, [seen], 500, 0).sighted.length, 1);
  assert.equal(searchStep(memo, [seen], 450, 0).sighted.length, 0);
  // the scroll is drawn for a sighted spot, never for a circle drawn to a point (the chart's ✕ is that one)
  assert.equal(scrollsOf([seen]).length, 1);
  assert.equal(scrollsOf([{ ...m, r: 0, spot: [0, 0] }]).length, 0);
  assert.equal(scrollsOf([m]).length, 0);
});
