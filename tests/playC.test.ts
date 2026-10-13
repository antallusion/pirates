// The QA playthrough C (docs/30_PLAYTHROUGH_C.md): the late game, levels 40–60 and the endgame — the faults found on the
// way that are not covered by a system's own test file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTOR_SIZE, SECTORS_PER_SIDE, sectorGrid } from '../shared/src/world/sectors.ts';
import { planWander, squareFor } from '../server/src/game/npc.ts';
import { makeGame } from './helpers.ts';

test('a pirate of the wild waters keeps her beat out of the calm square under a friendly harbour next door', () => {
  const { game } = makeGame();
  const grid = sectorGrid(game.world);
  // A calm square (⚓3–5 under a friendly harbour) beside one of ⚓8 or more.
  let calm = null, wild = null;
  for (const c of grid) {
    if (c.pocket !== 'calm') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = grid[(c.sy + dy) * SECTORS_PER_SIDE + c.sx + dx];
      if (n && n.level >= 8 && c.band[1] + 1 < n.level) { calm = c; wild = n; break; }
    }
    if (calm) break;
  }
  assert.ok(calm && wild, 'the sea has such a pair');
  // A pirate of the wild square at its edge toward the calm one, her beat (6 km, spawnTraffic's) reaching across it.
  const x = ((calm.sx + wild.sx) / 2 + 0.5) * SECTOR_SIZE, y = ((calm.sy + wild.sy) / 2 + 0.5) * SECTOR_SIZE;
  const ship = game.spawnNpcShip('pirate', 'frigate', 'confederacy', x + (wild.sx - calm.sx) * 300, y + (wild.sy - calm.sy) * 300, 0);
  game.setNpcLevel(ship, wild.level);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x, y, r: 6000 };
  let planned = 0, inCalm = 0;
  for (let i = 0; i < 200; i++) {
    if (!planWander(game, ship, brain)) continue;
    planned++;
    const end = brain.path![brain.path!.length - 1];
    const ex = Array.isArray(end) ? end[0] : (end as { x: number }).x, ey = Array.isArray(end) ? end[1] : (end as { y: number }).y;
    if (!squareFor(game, ex, ey, ship.shipLevel)) inCalm++;
  }
  assert.ok(planned > 100, `she still finds her beat (${planned}/200)`);
  assert.equal(inCalm, 0, 'no waypoint in the calm square');
});

test('hunting the Confederacy\'s pirates never makes her the enemy of the Free Harbors or the Brokers; her own deeds against them do', async () => {
  const { changeRep, canDock, SPILL_FLOOR } = await import('../server/src/game/player.ts');
  const p = { reputation: {}, talents: {}, infamy: 0 } as never as Parameters<typeof changeRep>[0];
  for (let i = 0; i < 400; i++) changeRep(p, 'confederacy', -6); // 400 pirates sunk
  assert.equal(p.reputation.confederacy, -100);
  assert.ok((p.reputation.free ?? 0) >= SPILL_FLOOR && (p.reputation.brokers ?? 0) >= SPILL_FLOOR, JSON.stringify(p.reputation));
  assert.ok(canDock(p, 'free').ok && canDock(p, 'brokers').ok, 'their harbours still have her');
  assert.ok(!canDock(p, 'confederacy').ok, 'the Confederacy\'s do not');
  for (let i = 0; i < 4; i++) changeRep(p, 'free', -6); // a Free Harbors ship sunk four times over
  assert.ok(!canDock(p, 'free').ok, 'her own deeds make her their enemy');
});

test('the recruiting window leaves a job\'s cargo aboard: the Admiralty\'s powder is not the musketeers\' (and she is told why)', async () => {
  const { join } = await import('./helpers.ts');
  const { recruit } = await import('../server/src/game/dwell.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  const { game } = makeGame();
  join(game, 'Powder Keeper');
  const s = game.sessionByName('Powder Keeper')!;
  const p = s.profile!, ship = s.ship!;
  p.level = 40;
  ship.level = 40;
  ship.loadout.classId = 'frigate';
  ship.loadout.level = 7;
  ship.recompute(game.now);
  ship.docked = 'slagport';
  p.docked = 'slagport';
  p.gold = 50000;
  ship.setArmy([{ u: 'deckhand', n: 40 }]);
  ship.cargo = { gunpowder: 41 };
  p.contracts.push({ id: 'cX', kind: 'delivery', title: 'Deliver 40 Gunpowder', fromPort: 'slagport', toPort: 'cinderhold', good: 'gunpowder', qty: 40, reward: 100, xp: 10, expiresAt: game.now + 9999 } as never);
  const why = recruit(game, s, 'port', 'musketeer', 14);
  assert.match(why ?? '', /^The hold lacks 3 gunpowder: 40 of it is a job's cargo\.$/);
  assert.equal(ship.cargo.gunpowder, 41, 'the powder still aboard');
  setLang('ru');
  applyDataLocale('ru');
  try {
    const ru = serverText(why!);
    assert.ok(/груз задания/.test(ru) && /порох/.test(ru), ru);
    assert.doesNotMatch(ru, /[A-Za-z]/);
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
  // her own powder is hers to spend
  p.contracts.length = 0;
  assert.equal(recruit(game, s, 'port', 'musketeer', 14), null);
  assert.ok((ship.cargo.gunpowder ?? 0) < 41);
});
