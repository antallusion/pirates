// The QA playthrough B (docs/30_PLAYTHROUGH_B.md): the mid game, levels 20–40 — the faults found on the way that are
// not covered by a system's own test file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lacking } from '../server/src/game/base.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';

test('the yard lacking goods her own hold carries says so: lie off the island and build from there', () => {
  const h = { store: {} } as never, y = { res: { gunpowder: 2 } } as never;
  const s = { ship: { cargo: { gunpowder: 10, pearls: 1 } } } as never;
  const away = lacking(h, y, s, false, { gunpowder: 8 })!;
  assert.match(away, /^The yard lacks 6 gunpowder: your hold has it/);
  assert.equal(lacking(h, y, s, true, { gunpowder: 8 }), null, 'lying off: the hold counts');
  assert.equal(lacking(h, y, s, false, { pearls: 2 }), 'The yard lacks 2 pearls.', 'not in the hold either: as before');
  setLang('ru');
  applyDataLocale('ru');
  try {
    const ru = serverText(away);
    assert.ok(/порох/.test(ru) && /трюме/.test(ru) && /\b6\b/.test(ru), ru);
    assert.doesNotMatch(ru, /[A-Za-z]/, 'no English left');
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
});

test('a lair beaten counts on one job only, the one that names that lair first (not every «break 3 lairs» taken)', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { questEvent } = await import('../server/src/game/quests.ts');
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { game } = makeGame();
  join(game, 'Lair Lu');
  const s = game.sessionByName('Lair Lu')!;
  const p = s.profile!;
  const cull = QUESTS_BY_ID['lj_hollowmere_cull'], cull2 = QUESTS_BY_ID['lj_hollowmere_cull_2'], clear = QUESTS_BY_ID['lj_hollowmere_clear'];
  assert.ok(cull && cull2 && clear, 'the harbour posts two culls and a clearing');
  const at = clear.steps[0] as { island: number; kind: string };
  p.quests.active.push({ id: cull.id, step: 0, progress: 0, startedAt: game.now }, { id: cull2.id, step: 0, progress: 0, startedAt: game.now }, { id: clear.id, step: 0, progress: 0, startedAt: game.now });
  questEvent(game, s, { k: 'lair', island: at.island, kind: at.kind } as never);
  const st = (id: string) => p.quests.active.find((q) => q.id === id) ?? { step: 9, progress: 9 };
  assert.equal(st(clear.id).step, 1, 'the clearing of that very lair is done');
  assert.equal(st(cull.id).progress + st(cull2.id).progress, 0, 'the culls are not filled by the same fight');
  questEvent(game, s, { k: 'lair', island: at.island + 1, kind: at.kind } as never);
  assert.equal(st(cull.id).progress + st(cull2.id).progress, 1, 'another lair: one cull counts it');
});
