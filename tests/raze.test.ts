// Pulling a building of one's own island down (owner, 2026-10-28: «дай возможность сноса здания (удаления) на острове»):
// server/src/game/raze.ts — half of the standing levels back (silver to the treasury, resources to the yard), the work
// under way cancelled and refunded whole, blocked while something stands on it, the hall never; a dwelling's tier
// closes for hire in the ports too; the plot is free at once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lairIsland } from '../server/src/game/wanted.ts';
import type { Game } from '../server/src/game/Game.ts';
import { baseView, reckonBase, startBuild, yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { buildTown, townLevel } from '../server/src/game/town.ts';
import { RAZE_BACK, raze, razeView } from '../server/src/game/raze.ts';
import { dwellView } from '../server/src/game/dwell.ts';
import { townCost, portDwellings } from '../shared/src/data/town.ts';
import { PRODUCER_KINDS, baseCost, producerFits } from '../shared/src/data/base.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function owner(game: Game, name: string) {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 4);
  s.profile!.gold = 100_000;
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
  s.ship!.docked = null;
  assert.ok(offCoast(game, s.ship!, home));
  s.ship!.state.speed = 0;
  s.ship!.region = home.region;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  s.ship!.state.x += 20_000; // far away: razed from anywhere, as built
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  y.res = { timber: 2_000, coal: 2_000, iron: 500, tar: 500, gunpowder: 200, stone: 1_000, rum: 200 } as typeof y.res;
  return { s, h, y };
}

function finishAll(game: Game, h: ReturnType<typeof ownIsland>) {
  clock += 30 * 86_400_000;
  reckonBase(game, h!);
}

test('a producer: half of its level back to the treasury and the yard, the plot free for anything else', () => {
  const game = world();
  const { s, h, y } = owner(game, 'Razer One');
  const isl = game.world.islands.find((i) => i.id === h.island)!;
  const kind = PRODUCER_KINDS.find((k) => producerFits(k, isl.biome))!;
  assert.equal(startBuild(game, s, null, `p:${kind}`), null);
  finishAll(game, h);
  const p = y.producers.find((x) => x.kind === kind)!;
  assert.ok(p, 'the producer stands');
  const plot = p.plot;
  const cost = baseCost(`p:${kind}`, 1);
  const v = razeView(h, y, { plot })!;
  assert.equal(v.why, null);
  assert.equal(v.silver, Math.floor(cost.silver * RAZE_BACK));
  const tre = h.treasury, gold = s.profile!.gold;
  const res = { ...y.res };
  assert.equal(raze(game, s, { plot }), null);
  assert.equal(y.producers.some((x) => x.plot === plot), false, 'gone');
  assert.equal(h.treasury - tre, Math.floor(cost.silver * RAZE_BACK), 'half the silver to the treasury');
  assert.equal(s.profile!.gold, gold, 'not to the purse');
  for (const [g, n] of Object.entries(cost.goods)) assert.equal((y.res[g as keyof typeof y.res] ?? 0) - (res[g as keyof typeof res] ?? 0), Math.floor(n! * RAZE_BACK), `half the ${g}`);
  // the plot takes something else at once
  assert.equal(startBuild(game, s, plot, 'tavern'), null);
  assert.equal(y.jobs.some((j) => j.plot === plot && j.what === 'tavern'), true);
  // the card shows it: «Снести» on the plot's building, the refund
  const cell = baseView(game, s)!.cells[plot];
  assert.ok(cell.raze, 'the work under way may be cancelled from its card');
  assert.equal(cell.raze!.cancel, true);
});

test('work under way: cancelled and refunded whole, the builders freed', () => {
  const game = world();
  const { s, h, y } = owner(game, 'Razer Two');
  const gold = s.profile!.gold, tre = h.treasury;
  assert.equal(buildTown(game, s, 'dw1'), null);
  const paid = gold + tre - s.profile!.gold - h.treasury;
  assert.equal(paid, townCost('dw1', 1).silver);
  assert.equal(y.jobs.length, 1);
  assert.equal(raze(game, s, { town: 'dw1' }), null);
  assert.equal(y.jobs.length, 0, 'the builders freed');
  assert.equal(townLevel(y, 'dw1'), 0);
  assert.equal(s.profile!.gold + h.treasury, gold + tre, 'the whole cost back (to the treasury)');
});

test('a dwelling: blocked while the next stands on it; then razed — its men gone, its tier shut in the ports, the hired stay', () => {
  setLang('ru');
  const game = world();
  const { s, h, y } = owner(game, 'Razer Three');
  assert.equal(buildTown(game, s, 'dw1'), null);
  finishAll(game, h);
  assert.equal(buildTown(game, s, 'dw2'), null);
  finishAll(game, h);
  assert.equal(townLevel(y, 'dw2'), 1);
  // the bunkhouse carries the marines' barracks: blocked, and the answer names it
  const v = razeView(h, y, { town: 'dw1' })!;
  assert.ok(v.why, 'blocked');
  assert.deepEqual(v.need.map((n) => n.id), ['dw2']);
  const why = raze(game, s, { town: 'dw1' })!;
  assert.match(why, /Other buildings stand on it: .+ 1\./);
  assert.match(serverText(why), /^Снести нельзя/);
  assert.equal(townLevel(y, 'dw1'), 1, 'still stands');
  // the hall: never
  assert.ok(razeView(h, y, { town: 'hall' })!.why);
  assert.equal(serverText(raze(game, s, { town: 'hall' })!), 'Ратуша держит весь остров: её снести нельзя.');
  // a port without marines of its own: the island's barracks open them there
  const port = game.world.ports.find((p) => !portDwellings(p).some((d) => d.tier === 2));
  assert.ok(port, 'a port with no marines of its own');
  s.ship!.docked = port!.id;
  assert.ok(dwellView(game, s, 'port')!.rows.some((r) => r.tier === 2), 'open in the port by the island');
  s.ship!.setArmy([...s.ship!.army.filter((x) => x.u !== 'marine'), { u: 'marine', n: 3 }]);
  y.town!.pool[2] = 7;
  const tre = h.treasury;
  assert.equal(raze(game, s, { town: 'dw2' }), null);
  assert.equal(townLevel(y, 'dw2'), 0);
  assert.equal(y.town!.pool[2], 0, 'the men waiting in it are gone');
  assert.equal(h.treasury - tre, Math.floor(townCost('dw2', 1).silver * RAZE_BACK));
  assert.equal(dwellView(game, s, 'port')!.rows.some((r) => r.tier === 2), false, 'shut in the port');
  assert.ok(s.ship!.army.some((x) => x.u === 'marine' && x.n >= 3), 'the hired stay');
  // now the bunkhouse may go
  assert.equal(razeView(h, y, { town: 'dw1' })!.why, null);
  // and the barracks may rise again from level 1
  s.ship!.docked = null;
  assert.equal(buildTown(game, s, 'dw2'), null);
  setLang('en');
});

test('the card: «Снести» data on the town things and the plots, none on empty ones', () => {
  const game = world();
  const { s } = owner(game, 'Razer Four');
  const v = baseView(game, s)!;
  assert.ok(v.town!.things.find((t) => t.id === 'hall')!.raze?.why, 'the hall shows why not');
  assert.equal(v.town!.things.find((t) => t.id === 'dw7')!.raze, null, 'nothing standing: nothing to raze');
  assert.ok(v.cells.filter((c) => !c.what).every((c) => !c.raze));
});
