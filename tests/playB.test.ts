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
