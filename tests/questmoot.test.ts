// Every step of buying, hiring or filling double-checked (owner, 2026-10-21: «если у меня уже пополнено все, то квест меня
// ведет к пополнению моряков в таверну, хотя у меня все забито. и скипнуть этот шаг нельзя. все квесты должны
// даблчекаться и если такое происходит, то пропускать шаг и не вести туда по следам обучения»): a step already done or
// impossible (a full crew, a full hold) is counted with a toast; the finger never points at «Нанять» with no hammocks;
// «Пропустить шаг» passes over a lesson of the shops, and nothing else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE } from '../shared/src/constants.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { QUESTS } from '../shared/src/data/quests.ts';
import type { QuestDef, QuestStep } from '../shared/src/data/quests.ts';
import { campaignActive, campaignOf } from '../server/src/game/campaign.ts';
import { MOOT_STEPS, stepMoot } from '../server/src/game/quests.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { pointerTargets } from '../client/src/ui/pointer.ts';
import { SERVER_RU_CAMPAIGN } from '../client/src/lang/server.ru.campaign.ts';
import { join, makeGame } from './helpers.ts';

const seconds = (game: ReturnType<typeof makeGame>['game'], n: number) => {
  for (let i = 0; i < n * TICK_RATE; i++) game.step();
};

/** Her hold filled to the last cubic foot (with a heavy good of the trade), her hammocks all taken. */
function fillUp(s: PlayerSession, crew = true, hold = true): void {
  const ship = s.ship!;
  if (crew) ship.crew = ship.stats.crewMax;
  if (hold) {
    const big = (Object.keys(GOODS) as GoodId[]).filter((g) => GOODS[g].category !== 'supply' && !GOODS[g].contraband).sort((a, b) => GOODS[b].volume - GOODS[a].volume)[0];
    ship.cargo = { [big]: Math.ceil(ship.stats.holdVolume / GOODS[big].volume) + 1 };
  }
}

test('a fresh account with a full crew and a full hold walks the opening’s shops without a purchase', () => {
  const { game } = makeGame();
  const conn = join(game, 'Fullhold');
  const s = [...game.sessions].find((x) => x.name === 'Fullhold')!;
  const p = s.profile!;
  assert.equal(campaignActive(p)?.id, 'c01_01', 'the shops under way');
  fillUp(s);
  seconds(game, 3);
  assert.equal(p.campaign!.at, 1, 'the shops counted: nothing could be bought, nobody hired');
  const toasts = conn.all('toast').map((t) => t.msg);
  for (const m of ['No room in the hold for provisions — the step is counted.', 'No room in the hold for sailcloth — the step is counted.', 'The crew is already full — the step is counted.', 'The hold is full — the step is counted.']) {
    assert.ok(toasts.includes(m), `told: ${m}`);
    assert.ok(SERVER_RU_CAMPAIGN[m] && !/[A-Za-z]/.test(SERVER_RU_CAMPAIGN[m]), `in Russian: ${m}`);
  }
  assert.equal(campaignActive(p)?.id, campaignOf(game).bySlot.get(1)!.a.id, 'the next of the opening comes: «Первый залп»');
});

test('the owner’s case: crew full, the rest bought — the tavern’s step is counted, the trade good still asked', () => {
  const { game } = makeGame();
  const conn = join(game, 'Fullcrew');
  const s = [...game.sessions].find((x) => x.name === 'Fullcrew')!;
  const p = s.profile!;
  const qs = () => p.quests.active.find((a) => a.id === 'c01_01')!;
  conn.push({ t: 'trade', good: 'provisions', qty: 1 } as never);
  conn.push({ t: 'trade', good: 'sailcloth', qty: 1 } as never);
  assert.equal(qs().step, 2, 'provisions and sailcloth bought: «пушки или матросы» now');
  fillUp(s, true, false);
  seconds(game, 2);
  assert.equal(qs().step, 3, 'no hammocks left: the step counted, not asked of the tavern');
  assert.ok(conn.all('toast').some((t) => t.msg === 'The crew is already full — the step is counted.'));
  seconds(game, 2);
  assert.equal(qs().step, 3, 'the trade good is still to buy (there is room for it)');
});

test('every step that asks to buy or hire has its check: counted when full, asked when there is room', () => {
  const { game } = makeGame();
  join(game, 'Checker');
  const s = [...game.sessions].find((x) => x.name === 'Checker')!;
  const c = campaignOf(game);
  const all: QuestDef[] = [...QUESTS, ...[...c.bySlot.values()].flatMap((x) => [x.a, ...(x.b ? [x.b] : [])])];
  const kinds = new Set<string>();
  let n = 0;
  for (const q of all) for (const st of q.steps) {
    if (st.type !== 'buy' && st.type !== 'recruit') continue;
    kinds.add(st.type === 'buy' ? `buy:${st.shop}` : st.type);
    n++;
    fillUp(s, false, false);
    s.ship!.crew = Math.max(1, s.ship!.stats.crewMax - 5);
    s.ship!.cargo = {};
    assert.equal(stepMoot(s, st), null, `${q.id} ${st.type}: asked while it can be done`);
    fillUp(s);
    assert.ok(stepMoot(s, st), `${q.id} ${st.type}: counted when full`);
  }
  assert.ok(n > 0);
  assert.deepEqual([...kinds].sort(), ['buy:arms', 'buy:provisions', 'buy:sailcloth', 'buy:trade', 'recruit'], 'every buy/hire kind of the game met');
  // the taxonomy: the step types that ask to buy, hire, fill or equip are those the check knows
  const BUY_LIKE: QuestStep['type'][] = ['buy', 'recruit'];
  assert.deepEqual([...MOOT_STEPS], BUY_LIKE);
  for (const t of BUY_LIKE) {
    const st = (t === 'buy' ? { type: 'buy', shop: 'arms', text: '' } : { type: 'recruit', count: 5, text: '' }) as QuestStep;
    fillUp(s);
    assert.ok(stepMoot(s, st), t);
  }
});

test('the finger never points at «Нанять» with no hammocks left', () => {
  assert.deepEqual(pointerTargets({ stage: 'c:buy:arms', touch: true, docked: true, battle: false, crewFull: true }), []);
  assert.ok(pointerTargets({ stage: 'c:buy:arms', touch: true, docked: true, battle: false, crewFull: false }).some((x) => x.includes('tavern')));
});

test('«Пропустить шаг»: a lesson of the shops passed over by her word; a fight is not', () => {
  const { game } = makeGame();
  const conn = join(game, 'Skipper');
  const s = [...game.sessions].find((x) => x.name === 'Skipper')!;
  const p = s.profile!;
  for (let i = 0; i < 4; i++) conn.push({ t: 'quest', action: 'skip_step', id: 'c01_01' });
  assert.equal(p.campaign!.at, 1, 'the four lessons skipped: the shops done');
  const next = campaignActive(p)!.id;
  conn.push({ t: 'quest', action: 'skip_step', id: next });
  assert.equal(p.quests.active.find((a) => a.id === next)?.step, 0, '«Первый залп» is not skipped');
  assert.ok(conn.all('toast').some((e) => e.msg === 'Only a lesson of the shops can be skipped'));
});
