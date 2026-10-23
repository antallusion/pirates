// The late-game QA (2026-10-23, assets/raw/audit/late: the campaign's chapters 6–36 driven step by step on the server as
// a player does them, and played on a phone in Telegram; the late systems): the faults found on the way, each held here.

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('«Потопите именитого капитана» in the Abyss: one of the Brethren comes to her there, and sunk counts; a baron counts too', async () => {
  const { makeGame, join, steps, shipAtLevel } = await import('./helpers.ts');
  const { campaignOf, campaignActive } = await import('../server/src/game/campaign.ts');
  const { liveNamed, wantedKill } = await import('../server/src/game/wanted.ts');
  const { regionAt } = await import('../shared/src/world/worldgen.ts');
  const { game } = makeGame();
  join(game, 'Abyssal');
  const s = game.sessionByName('Abyssal')!;
  const camp = campaignOf(game);
  // chapter 34 is the Abyss's (its named step: no Brethren of the Abyss's own — PIRATE_SEAS)
  const q = camp.quests.find((x) => x.campaign!.ch === 34 && x.steps.some((st) => st.type === 'named'))!;
  assert.ok(q, 'a named step in the Abyss’s chapter');
  const i = q.steps.findIndex((st) => st.type === 'named');
  s.profile!.level = q.requires.level ?? 56;
  shipAtLevel(game, s, 9);
  s.profile!.campaign!.at = q.campaign!.slot;
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  // the Abyss's open water off its hub
  const hub = game.portById('last_light')!;
  let at: [number, number] | null = null;
  for (let r = 800; r < 6000 && !at; r += 200) for (let k = 0; k < 24 && !at; k++) {
    const x = hub.x + Math.sin(k / 24 * Math.PI * 2) * r, y = hub.y - Math.cos(k / 24 * Math.PI * 2) * r;
    if (regionAt(game.world, x, y) === 'the_abyss' && !(await import('../shared/src/world/worldgen.ts')).isLand(game.world, x, y)) at = [x, y];
  }
  assert.ok(at, 'open water of the Abyss');
  ship.state.x = at![0]; ship.state.y = at![1];
  game.grid.upsert(ship.id, at![0], at![1]);
  assert.equal(liveNamed(game).length, 0);
  steps(game, 20 * 15);
  const live = liveNamed(game).map((l) => game.ships.get(l.ship)!).filter((o) => o?.alive);
  assert.equal(live.length, 1, 'one of the Brethren put to sea for her');
  const o = live[0];
  assert.ok(Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 4500, 'some miles off her');
  assert.equal(regionAt(game.world, o.state.x, o.state.y), 'the_abyss', 'in her waters');
  // one at a time: no second while she is about
  steps(game, 20 * 40);
  assert.equal(liveNamed(game).length, 1);
  wantedKill(game, s, o);
  assert.ok(campaignActive(s.profile!)?.id !== q.id || campaignActive(s.profile!)!.step > i, 'sunk: the step is done');

  // a baron of the Brethren is a named captain too
  const { baronOf } = await import('../shared/src/data/pirates.ts');
  const { putToSea } = await import('../server/src/game/wanted.ts');
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  const b = putToSea(game, baronOf('drowned_crown')!, ship, 'the_abyss', [2000, 4000])!;
  assert.ok(b);
  wantedKill(game, s, b);
  assert.ok(campaignActive(s.profile!)?.id !== q.id || campaignActive(s.profile!)!.step > i, 'a baron sunk: the step is done');
});
