// Owner, 2026-10-23: «все квесты цепочек надо делать так, что они были максимум на удалении 3км друг от друга, никто за
// 6-10 и тем более 20 км никуда не поплывет». Every chain of both worlds — the campaign's 720 quests (its hand-over into
// a chapter's waters apart), the ports' jobs, the creature jobs, the islands' people's jobs, the region arcs, the written
// quests — no leg over 3 km on the sea route (shared/src/data/chainaudit.ts); a port's contracts likewise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { chainAudit } from '../shared/src/data/chainaudit.ts';
import { CHAIN_LEG } from '../shared/src/data/questlegs.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { navLen } from '../shared/src/world/navlen.ts';
import { generateContracts } from '../server/src/game/ports.ts';
import { makeGame } from './helpers.ts';

for (const seed of [WORLD_SEED, 1337]) {
  test(`every quest chain of world ${seed}: no leg over 3 km on the sea route`, () => {
    const w = generateWorld(seed);
    const a = chainAudit(w, seed);
    for (const [kind, r] of Object.entries(a.byKind)) {
      assert.ok(r.legs.length > 0, `${kind}: legs`);
      const over = r.legs.filter((l) => !(l.d <= CHAIN_LEG + 1));
      assert.deepEqual(over.map((l) => `${l.quest} #${l.step} → ${l.to}: ${Number.isFinite(l.d) ? (l.d / 1000).toFixed(2) : '>6'} km`), [], kind);
    }
    assert.equal(a.byKind.campaign.legs.length > 1000, true, 'the campaign followed');
    assert.ok(a.handovers.length >= 35, 'a hand-over a chapter (and the home-coming)');
  });
}

test('the sea route is no shorter than the line, and goes round the land (not through it)', () => {
  const w = generateWorld(1337);
  const p = w.ports.find((x) => x.id === 'saltmarrow')!;
  const isl = w.islands[p.islandId];
  // from the quay to the water just off the far side of its own island
  const far = { x: isl.x + (isl.x - p.x) / Math.hypot(isl.x - p.x, isl.y - p.y) * (isl.radius + 300), y: isl.y + (isl.y - p.y) / Math.hypot(isl.x - p.x, isl.y - p.y) * (isl.radius + 300) };
  const line = Math.hypot(far.x - p.x, far.y - p.y);
  const route = navLen(w, p.x, p.y, far.x, far.y, 20000);
  assert.ok(route >= line, `${route} ≥ ${line}`);
  assert.ok(route > line * 1.1, 'round the island');
});

test('a port’s letters and cargoes go to harbours within 3 km on the sea route', () => {
  const { game } = makeGame();
  let n = 0;
  for (const port of game.world.ports.filter((p) => !p.raft).slice(0, 60)) {
    for (const c of generateContracts(game, port)) {
      if (!c.toPort) continue;
      const to = game.portById(c.toPort)!;
      n++;
      assert.ok(navLen(game.world, port.x, port.y, to.x, to.y, CHAIN_LEG) <= CHAIN_LEG, `${port.id} → ${to.id}`);
    }
  }
  assert.ok(n > 10, `${n} contracts`);
});
