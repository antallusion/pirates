// Every quest step done in a harbour has its own button there (owner, 2026-10-23: «все квесты кампании из серии
// "распросить" и любые другие должны прям показывать куда нажать в порту, потому что я не знаю как делать квест из
// журнала, я все кнопки нажал и нету сдачи нигде»). The audit: every step type is either done in port (questact.ts —
// a button, or a page of the port window) or at sea/ashore; every in-port step of every campaign chapter, of the story,
// the arcs, the side chains and the boards' jobs has its action; pressed in the right port it does the step, in the
// wrong one it says why; the rows draw the verb instead of «Плыть»; the finger points at it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARC_QUESTS, ISLAND_JOBS, JOBS, QUESTS } from '../shared/src/data/quests.ts';
import type { QuestDef, QuestStep } from '../shared/src/data/quests.ts';
import { SIDE_QUESTS, HIDDEN_QUESTS } from '../shared/src/data/sidequests.ts';
import { PORT_STEPS, actHere, questAct, visitVerb } from '../shared/src/data/questact.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { FACTIONS } from '../shared/src/data/factions.ts';
import { campaignOf } from '../server/src/game/campaign.ts';
import { questHere } from '../server/src/game/quests.ts';
import { hereTargets, pointerTargets } from '../client/src/ui/pointer.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_HERE } from '../client/src/lang/server.ru.here.ts';
import { goalSheetView } from '../client/src/ui/goalsheet.ts';
import { join, makeGame } from './helpers.ts';

const CONTRA = (Object.keys(GOODS) as GoodId[]).find((g) => GOODS[g].contraband)!;

/** The step types done at sea, ashore or on her island: «Плыть» takes her there (no button in port). */
const AWAY = ['sink', 'land', 'board', 'prize', 'chart', 'reach', 'time_in', 'fleet_win', 'die_in', 'dive', 'catch', 'beast', 'named', 'tribute', 'letters', 'rescue', 'lair', 'legend', 'seal', 'citadel', 'isle', 'claim', 'neutral', 'spot', 'build'];

test('the audit: every step type is either done in port (with its action) or away (with «Плыть»), never neither', () => {
  const { game } = makeGame();
  const all: QuestDef[] = [...QUESTS, ...ARC_QUESTS, ...SIDE_QUESTS, ...HIDDEN_QUESTS, ...JOBS, ...ISLAND_JOBS.values(), ...campaignOf(game).quests];
  const seen = new Set<string>();
  for (const q of all) for (const st of q.steps) {
    seen.add(st.type);
    const act = questAct(st);
    if ((PORT_STEPS as readonly string[]).includes(st.type)) assert.ok(act, `${q.id}: «${st.text}» (${st.type}) has its action in port`);
    else {
      assert.ok(AWAY.includes(st.type), `${q.id}: a step type nobody sorted: ${st.type}`);
      // (a step done on her own island: its screen opened from «Цели и вести» while she lies by it — batchboard.test.ts)
      if (st.type === 'build') assert.deepEqual(act, { verb: 'build', how: 'isle' });
      else assert.equal(act, null, `${q.id}: ${st.type} is done away`);
    }
  }
  for (const t of ['visit', 'deliver', 'pickup', 'sink', 'land']) assert.ok(seen.has(t), t);
});

test('«Колокольчик на ручке»: the campaign’s «ask along the quays» is «Расспросить» in its port and done at a press', () => {
  const { game } = makeGame();
  const c = join(game, 'Bell Ringer');
  const s = game.sessionByName('Bell Ringer')!;
  const p = s.profile!;
  const bell = campaignOf(game).quests.find((q) => q.name === 'A Bell on the Handle')!;
  assert.ok(bell, 'the quest');
  const st = bell.steps[0] as Extract<QuestStep, { type: 'visit' }>;
  assert.equal(st.type, 'visit');
  const act = questAct(st)!;
  assert.equal(act.how, 'here');
  // The quest came while she lay in that very port (the owner's case: the arrival had already happened).
  p.quests.active = [{ id: bell.id, step: 0, progress: 0, startedAt: game.now }];
  const ship = s.ship!;
  ship.docked = null;
  assert.match(questHere(game, s, bell.id) ?? '', /^Put in at .+ first\.$/, 'at sea: put in first');
  const other = game.world.ports.find((x) => x.id !== st.port)!;
  ship.docked = other.id;
  assert.match(questHere(game, s, bell.id) ?? '', /^That is done at .+: «Sail» takes you there\.$/, 'the wrong port: says where');
  assert.equal(actHere(act, other.id), false, 'no button in the wrong port («Плыть» stays)');
  ship.docked = st.port;
  assert.equal(actHere(act, st.port), true, 'the button in its port');
  assert.equal(questHere(game, s, bell.id), null);
  assert.equal(p.quests.active.find((a) => a.id === bell.id)?.step, 1, 'the step done at once');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith(`${bell.name}: `)), 'the next step told');
  // The second step (back to the giver) is a step of its own: one press, one step.
  const st2 = bell.steps[1];
  if (st2.type === 'visit' && st2.port !== st.port) assert.notEqual(questHere(game, s, bell.id), null, 'not done in the first port');
  // The words in Russian.
  setLang('ru');
  assert.equal(serverText(`That is done at ${other.name}: «Sail» takes you there.`).includes('«Плыть»'), true);
  for (const [en, ru] of Object.entries(SERVER_RU_HERE)) assert.ok(/[а-яё]/i.test(ru) && !/[A-Za-z]/.test(ru.replace(/\{\d\}/g, '')), en);
  setLang('en');
});

test('every campaign chapter: each in-port step has its action, and the action does it in its port', () => {
  const { game } = makeGame();
  join(game, 'Walker');
  const s = game.sessionByName('Walker')!;
  const p = s.profile!;
  const ship = s.ship!;
  const camp = campaignOf(game);
  const chapters = new Set<number>();
  let walked = 0;
  for (const q of camp.quests) {
    q.steps.forEach((st, i) => {
      const act = questAct(st);
      if (!(PORT_STEPS as readonly string[]).includes(st.type)) return;
      assert.ok(act, `${q.id} step ${i + 1}: «${st.text}» has its action`);
      if (act!.how !== 'here') return;
      chapters.add(q.campaign!.ch);
      // her own quest at this step, lying in the step's port (or a lawful one for customs), what the step wants aboard
      p.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: game.now }];
      ship.docked = act!.port ?? game.world.ports[0].id;
      ship.cargo = {};
      if (st.type === 'deliver') ship.cargo[st.good] = st.qty;
      let why = questHere(game, s, q.id);
      if (st.type === 'customs') {
        // a customs search: in a lawful harbour, with contraband aboard (a search may seize it: then again)
        assert.equal(why, 'Take contraband aboard first: the step wants it past an inspection.');
        ship.docked = game.world.ports.find((x) => !FACTIONS[x.faction].lawful)!.id;
        ship.cargo = { [CONTRA]: 5 };
        assert.equal(questHere(game, s, q.id), 'No customs in this harbour: put in at a lawful one.');
        ship.docked = game.world.ports.find((x) => FACTIONS[x.faction].lawful)!.id;
        for (let k = 0; k < 40 && p.quests.active.some((a) => a.id === q.id && a.step === i); k++) {
          ship.cargo = { [CONTRA]: 5 };
          why = questHere(game, s, q.id);
          assert.equal(why, null);
        }
      }
      assert.equal(why, null, `${q.id} step ${i + 1} (${st.type}): ${why}`);
      const now = p.quests.active.find((a) => a.id === q.id);
      assert.ok(!now || now.step > i, `${q.id} step ${i + 1} (${st.type}) done by its button`);
      walked++;
    });
  }
  assert.ok(walked > 100, `${walked} in-port steps walked`);
  assert.ok(chapters.size >= 20, `${chapters.size} chapters with in-port steps`);
});

test('a delivery short of its cargo is refused with the reason; with the cargo aboard it is handed over', () => {
  const { game } = makeGame();
  const c = join(game, 'Carrier');
  const s = game.sessionByName('Carrier')!;
  const q = campaignOf(game).quests.find((x) => x.steps.some((st) => st.type === 'deliver'))!;
  const i = q.steps.findIndex((st) => st.type === 'deliver');
  const st = q.steps[i] as Extract<QuestStep, { type: 'deliver' }>;
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: game.now }];
  s.ship!.docked = st.port;
  s.ship!.cargo = {};
  assert.equal(questHere(game, s, q.id), null);
  assert.equal(s.profile!.quests.active[0].step, i, 'not yet');
  assert.ok(c.all('toast').some((t) => t.msg === `They are waiting for ${st.qty} ${st.good.replace('_', ' ')} here.`), 'told what is wanted');
  s.ship!.cargo = { [st.good]: st.qty };
  assert.equal(questHere(game, s, q.id), null);
  assert.ok((s.profile!.quests.active[0]?.step ?? 99) > i, 'handed over');
  assert.ok(GOODS[st.good], 'a good of the market');
});

test('the verbs: «ask» for asking about, «report» for coming back, «talk» for the rest', () => {
  assert.equal(visitVerb('Make for Coral Watch and ask along the quays.'), 'ask');
  assert.equal(visitVerb('Make for Saltmarrow and ask there.'), 'ask');
  assert.equal(visitVerb('Return to Galt at Cinderhold.'), 'report');
  assert.equal(visitVerb('Report to Edric Vane at Gravesend.'), 'report');
  assert.equal(visitVerb('Drink with Hask Morrow in Cinderhold.'), 'talk');
  assert.equal(visitVerb('Put in at Fogmouth.'), 'talk');
});

test('the rows: «Цели и вести» draws the verb in its port and «Плыть» elsewhere; the finger points at the button', () => {
  const act = { verb: 'ask' as const, how: 'here' as const, port: 'coral_watch' };
  const q = { id: 'c01_06', name: 'A Bell on the Handle', kind: 'campaign' as const, step: 1, steps: 2, text: 'x', progress: 0, need: 1, act };
  const there = goalSheetView({ quests: [q], dockedAt: 'coral_watch' });
  assert.deepEqual(there.campaign?.line?.here, act, 'the verb in its port');
  const away = goalSheetView({ quests: [q], dockedAt: 'fogmouth' });
  assert.equal(away.campaign?.line?.here, undefined, '«Плыть» in another');
  const facts = { stage: 'h:c01_06:', touch: true, docked: true, battle: false };
  const t = pointerTargets(facts);
  assert.equal(t[0], '[data-act="quest_here"][data-id="c01_06"]', 'its own button first');
  assert.ok(t.includes('#modal-panel [data-ptab="quests"]'), 'then the port’s «Задания»');
  assert.deepEqual(hereTargets({ ...facts, docked: false }, 'c01_06', ''), [], 'at sea: no finger for it');
  assert.ok(hereTargets(facts, 'c01_06', 'market').includes('#modal-panel [data-ptab="market"]'), 'a page’s step: its tab');
});
