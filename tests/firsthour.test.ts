// The first hour as a newcomer plays it (owner, 2026-10-23: «все должно играться идеально и просто для человека»):
// the regressions the playthrough robot (tools/mobile/ux/firsthour.mjs) found in the Telegram layout at 1093×481.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointerTargets, DEPART } from '../client/src/ui/pointer.ts';

test('«В море» brings up «Готовы к выходу?»: the finger goes on into the sheet, the gold «Докупить всё» first', () => {
  // the run of 2026-10-23: the hull 81% after the First Watch, «В море» opened the sheet, the finger stood aside under
  // it and «Первый залп» stood in port for twelve minutes
  for (const stage of ['c:sink', 'c:board', 'c:neutral', 'c:found', 'sail']) {
    const t = pointerTargets({ stage, touch: true, docked: true, battle: false });
    assert.equal(t[0], DEPART[0], `${stage}: «Докупить всё» first`);
    assert.equal(t[1], DEPART[1], `${stage}: «Отплыть так» when there is nothing to buy`);
    assert.ok(t.includes('#modal-panel [data-ptab="sea"]'), `${stage}: «В море» behind it`);
  }
  // at sea there is no sheet to point into
  assert.ok(!pointerTargets({ stage: 'c:sink', touch: true, docked: false, battle: false }).some((x) => x.includes('depart')));
});
