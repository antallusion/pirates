// The pay of one's choice (docs/11 P6): a job is paid all in silver, or a part in fine shot (worth more than the
// silver forgone), or a part in the port's favour — chosen at the giver's, kept in the journal, paid on the deed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMMO } from '../shared/src/data/ships.ts';
import { JOBS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import { PAY_KEPT, STORES_WORTH, questPayOf, questRep } from '../shared/src/data/questpay.ts';
import { payOptions, questEvent } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';

test('the three pays: all silver; seven tenths and fine shot worth more than the rest; seven tenths and double favour', () => {
  const all = questPayOf('silver', 1000, 30), shot = questPayOf('stores', 1000, 30), fav = questPayOf('favour', 1000, 30);
  assert.deepEqual(all, { silver: 1000, rep: questRep(30), heavy: 0, incendiary: 0 });
  assert.equal(shot.silver, 1000 * PAY_KEPT);
  const worth = shot.heavy * AMMO.heavy.price + shot.incendiary * AMMO.incendiary.price;
  assert.ok(worth > 1000 - shot.silver, `the shot is worth more than the silver forgone: ${worth}`);
  assert.ok(worth <= (1000 - shot.silver) * STORES_WORTH);
  assert.equal(fav.silver, 1000 * PAY_KEPT);
  assert.equal(fav.rep, questRep(30) * 2 + 2);
});

test('the board offers the choice; the pay chosen is kept with the job and paid on the deed', () => {
  const { game } = makeGame();
  const c = join(game, 'Paid Right');
  const s = game.sessionByName('Paid Right')!;
  const port = game.portById(s.ship!.docked!)!;
  const offer = c.last('port')!.view!.questOffers.find((o) => o.kind === 'job' && o.silver >= 200);
  assert.ok(offer?.pays, 'a job on the board offers the pay to choose');
  assert.equal(offer!.pays!.faction, port.faction);
  assert.ok(offer!.pays!.favour && offer!.pays!.stores.heavy > 0);
  // Taken for shot: kept in the journal with what it comes to.
  c.push({ t: 'quest', action: 'accept', id: offer!.id, pay: 'stores' });
  const qs = s.profile!.quests.active.find((a) => a.id === offer!.id);
  assert.ok(qs, 'under way');
  assert.equal(qs.pay, 'stores');
});

test('done: shot put aboard, or the favour doubled and more', () => {
  const { game } = makeGame();
  const c = join(game, 'Stores Sam');
  const s = game.sessionByName('Stores Sam')!;
  const port = game.portById(s.ship!.docked!)!;
  const quest: QuestDef = { id: 'test_pay', kind: 'job', name: 'Paid In Kind', mentor: 'Test', port: port.id, summary: '', requires: { level: 20 }, steps: [{ type: 'chart', count: 1, text: 'Chart an island.' }], reward: { xp: 100, silver: 1000 } };
  QUESTS_BY_ID[quest.id] = quest;
  const o = payOptions(game, quest)!;
  // Shot.
  const heavy0 = s.ship!.ammo.heavy ?? 0, fire0 = s.ship!.ammo.incendiary ?? 0;
  s.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now, pay: 'stores' });
  questEvent(game, s, { k: 'chart' });
  let done = c.last('quest_done')!;
  assert.equal(done.silver, o.stores.silver);
  assert.deepEqual(done.stores, { heavy: o.stores.heavy, incendiary: o.stores.incendiary });
  assert.equal((s.ship!.ammo.heavy ?? 0) - heavy0, o.stores.heavy);
  assert.equal((s.ship!.ammo.incendiary ?? 0) - fire0, o.stores.incendiary);
  // Favour.
  s.profile!.quests.done = [];
  const rep0 = s.profile!.reputation[port.faction] ?? 0;
  s.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now, pay: 'favour' });
  questEvent(game, s, { k: 'chart' });
  done = c.last('quest_done')!;
  assert.equal(done.silver, o.favour!.silver);
  assert.equal(done.rep?.n, o.favour!.rep);
  assert.ok((s.profile!.reputation[port.faction] ?? 0) - rep0 >= o.favour!.rep - 1, 'the standing doubled and more');
  delete QUESTS_BY_ID[quest.id];
});

test('taking a job at the board with a pay: the journal shows it; a pay the job does not offer is silver', () => {
  const { game } = makeGame();
  const c = join(game, 'Board Pay');
  const s = game.sessionByName('Board Pay')!;
  // A job that sends the captain elsewhere (so it is not done on the spot).
  const offers = c.last('port')!.view!.questOffers.filter((o) => o.kind === 'job' && o.pays && !o.blocked);
  const job = offers.map((o) => JOBS.find((q) => q.id === o.id)!).find((q) => q && q.steps[0].type !== 'visit' && q.steps[0].type !== 'pickup')!;
  assert.ok(job, 'a job on the board that sends the captain elsewhere');
  c.push({ t: 'quest', action: 'accept', id: job.id, pay: 'favour' });
  const qs = s.profile!.quests.active.find((a) => a.id === job.id);
  assert.equal(qs?.pay, 'favour');
  const shown = (c.last('self')?.self ?? c.last('init')!.self).quests.find((q) => q.id === job.id);
  assert.equal(shown?.pay, 'favour', 'the journal shows the pay chosen');
  assert.ok(shown?.paid && shown.paid.silver < job.reward.silver && shown.paid.rep > 0);
  // Set aside and taken again with a made-up pay: all silver.
  c.push({ t: 'quest', action: 'abandon', id: job.id });
  c.push({ t: 'quest', action: 'accept', id: job.id, pay: 'gold' as never });
  const again = s.profile!.quests.active.find((a) => a.id === job.id);
  assert.ok(again, 'taken again');
  assert.equal(again.pay, undefined);
});
