// Owner, 2026-10-24 («всё должно играться идеально и просто для человека»): after the 3 km chains (docs/36 §2а) 211 of
// the 318 harbours — Saltmarrow, where a newcomer starts, among them — had no parcel and no letter to carry: their
// harbours lie farther apart than a leg. Now every harbour's board has a courier's job and a letter, within a leg on the
// sea route: to another harbour, else an island's hamlet, else a waystation of the open sea or a fishers' cove of the
// harbour's own island (shared/src/data/questgen.ts handJobs); and the board shows one of each whatever its window.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOBS } from '../shared/src/data/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import { courierJob, letterJob } from '../shared/src/data/questgen.ts';
import { CHAIN_LEG, questLegs } from '../shared/src/data/questlegs.ts';
import { JOB_ROTATION_SEC, boardJobs, questEvent } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';

test('every harbour has a parcel and a letter to carry, each within 3 km on the sea route', () => {
  const { game } = makeGame();
  const by = new Map<string, QuestDef[]>();
  for (const q of JOBS) by.set(q.port, [...(by.get(q.port) ?? []), q]);
  const noCourier: string[] = [], noLetter: string[] = [];
  for (const port of game.world.ports) {
    const mine = by.get(port.id) ?? [];
    const c = mine.filter(courierJob), l = mine.filter(letterJob);
    if (!c.length) noCourier.push(port.id);
    if (!l.length) noLetter.push(port.id);
    // the one the board puts first is near: every leg within a chain's
    for (const q of [c[0], l[0]]) {
      if (!q) continue;
      const legs = questLegs(game.world, q, port, CHAIN_LEG * 2).legs;
      assert.ok(legs.every((x) => x.d <= CHAIN_LEG + 1), `${q.id}: ${legs.map((x) => Math.round(x.d)).join(' / ')} m`);
    }
  }
  assert.deepEqual(noCourier, [], `${noCourier.length} harbours with no parcel`);
  assert.deepEqual(noLetter, [], `${noLetter.length} harbours with no letter`);
});

test('every board shows a parcel and a letter, for a newcomer and an old hand, whatever the window', () => {
  const { game } = makeGame();
  const missing: string[] = [];
  for (const level of [1, 30]) {
    const p = { level, quests: { done: [] as string[], active: [] as { id: string }[] } };
    for (const window of [0, 1, 7]) {
      for (const port of game.world.ports) {
        const board = boardJobs(p as never, port, window * JOB_ROTATION_SEC);
        if (!board.some(courierJob)) missing.push(`${port.id} L${level} w${window}: no parcel`);
        if (!board.some(letterJob)) missing.push(`${port.id} L${level} w${window}: no letter`);
      }
    }
  }
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} boards`);
});

test('Saltmarrow: a newcomer takes the letter at once, sails it out and is paid on her return', () => {
  const { game } = makeGame();
  const c = join(game, 'Letter Lou');
  const s = game.sessionByName('Letter Lou')!;
  const port = game.portById(s.ship!.docked!)!;
  assert.equal(port.id, 'saltmarrow');
  game.pushPort(s);
  const offers = c.last('port')!.view!.questOffers;
  const byId = (id: string) => JOBS.find((q) => q.id === id);
  const parcel = offers.find((o) => !o.blocked && byId(o.id) && courierJob(byId(o.id)!));
  const letter = offers.find((o) => !o.blocked && byId(o.id) && letterJob(byId(o.id)!));
  assert.ok(parcel, 'a parcel she may take');
  assert.ok(letter, 'a letter she may take');
  const q = byId(letter!.id)!;
  c.push({ t: 'quest', action: 'accept', id: q.id });
  const qs = () => s.profile!.quests.active.find((a) => a.id === q.id);
  assert.ok(qs(), 'taken');
  // out to where it goes (a spot of the sea or a harbour), and home
  const st = q.steps[0];
  const ship = s.ship!;
  c.push({ t: 'undock' });
  if (st.type === 'spot') {
    ship.state.x = st.x;
    ship.state.y = st.y;
    ship.state.speed = 0;
    game.grid.upsert(ship.id, st.x, st.y);
    questEvent(game, s, { k: 'tick', dt: 1 });
  } else if (st.type === 'visit') {
    questEvent(game, s, { k: 'dock', port: game.portById(st.port)! });
  } else if (st.type === 'land') {
    questEvent(game, s, { k: 'land', island: st.island, feature: st.site ?? 'fishers' });
  }
  assert.equal(qs()?.step, 1, `${st.type}: handed over`);
  const silver = s.profile!.gold;
  questEvent(game, s, { k: 'dock', port });
  assert.ok(!qs(), 'done');
  assert.ok(s.profile!.gold > silver, 'and paid');
});
