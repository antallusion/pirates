// A quest step's own button in port (owner, 2026-10-23: «все квесты кампании из серии "распросить" и любые другие должны
// прям показывать куда нажать в порту»). Where a step is done in the harbour she lies in (shared/src/data/questact.ts),
// its row in «Задания», in the journal and in «Цели и вести» carries the step's verb — «Расспросить», «Поговорить»,
// «Доложить», «Сдать груз»… — instead of «Плыть»; pressed, it does the step (`{t:'quest', action:'here'}`) or opens the
// port's page where it is done. In the wrong port, or at sea, «Плыть» stays and takes her to the right one.

import type { QuestAct, QuestVerb } from '../../../shared/src/data/questact.ts';
import { actHere } from '../../../shared/src/data/questact.ts';
import { dict } from '../i18n.ts';
import { esc, icon } from './dom.ts';

const L = dict({
  'v.ask': 'Ask around', 'v.talk': 'Talk', 'v.report': 'Report', 'v.deliver': 'Hand over the cargo', 'v.pickup': 'Take on the cargo', 'v.hand': 'Hand over',
  'v.arrive': 'Check in', 'v.customs': 'Pass customs', 'v.buy': 'To the shop', 'v.sell': 'To the market', 'v.recruit': 'Sign on men',
  'h.ask': 'Ask on the quays here: the step is done at once.',
  'h.talk': 'Have the word here: the step is done at once.',
  'h.report': 'Tell what you found: the step is done at once.',
  'h.deliver': 'Hand the cargo over on the quay (it must be in the hold).',
  'h.pickup': 'Take the cargo aboard from the quay (it needs room in the hold).',
  'h.hand': 'Hand over what the land gave (from your island’s store).',
  'h.arrive': 'Check in with the harbour master: the race is finished.',
  'h.customs': 'Let the customs search the ship with the contraband aboard.',
  'h.buy': 'The shop where the step’s purchase is made.',
  'h.sell': 'The market, where the contraband is sold.',
  'h.recruit': 'The port’s dwellings, where men sign on for the ship’s army.',
  hereTitle: 'To do here, in this port',
}, {
  'v.ask': 'Расспросить', 'v.talk': 'Поговорить', 'v.report': 'Доложить', 'v.deliver': 'Сдать груз', 'v.pickup': 'Принять груз', 'v.hand': 'Сдать',
  'v.arrive': 'Отметиться', 'v.customs': 'Пройти досмотр', 'v.buy': 'В лавку', 'v.sell': 'На рынок', 'v.recruit': 'Нанять',
  'h.ask': 'Расспросить на причалах здесь — шаг засчитается сразу.',
  'h.talk': 'Поговорить здесь — шаг засчитается сразу.',
  'h.report': 'Рассказать, что узнали, — шаг засчитается сразу.',
  'h.deliver': 'Сдать груз на причале (он должен быть в трюме).',
  'h.pickup': 'Принять груз с причала (нужно место в трюме).',
  'h.hand': 'Сдать добытое на суше (со склада вашего острова).',
  'h.arrive': 'Отметиться у начальника порта — гонка окончена.',
  'h.customs': 'Пустить таможню на борт с контрабандой в трюме.',
  'h.buy': 'Лавка, где делается покупка этого шага.',
  'h.sell': 'Рынок, где продают контрабанду.',
  'h.recruit': 'Жилища порта: здесь нанимают бойцов в армию корабля.',
  hereTitle: 'Сделать здесь, в этом порту',
});

/** The verb's icon (current art only). */
const ART: Record<QuestVerb, string> = {
  ask: 'tab_letters', talk: 'tab_letters', report: 'ui_quill', deliver: 'tab_market', pickup: 'tab_market', hand: 'tab_market',
  arrive: 'goal', customs: 'tab_law', buy: 'tab_market', sell: 'tab_market', recruit: 'build_barracks',
};

export const actWord = (v: QuestVerb): string => L(`v.${v}` as 'v.ask');
export const actHint = (v: QuestVerb): string => L(`h.${v}` as 'h.ask');
export const hereTitle = (): string => L('hereTitle');

/** The act of a quest that can be done where she lies now, or null. */
export function hereAct(q: { act?: QuestAct }, docked: string | null | undefined): QuestAct | null {
  return q.act && actHere(q.act, docked) ? q.act : null;
}

/** The button: `quest_here` (the server does the step) or `quest_tab` (the port's page). `cls`: the window's own button
 *  classes (the port's kit, the journal's). */
export function actButton(id: string, act: QuestAct, cls: string): string {
  const data = act.how === 'here' ? `data-act="quest_here" data-id="${esc(id)}"` : `data-act="quest_tab" data-tab="${esc(act.tab ?? 'market')}" data-id="${esc(id)}"`;
  return `<button type="button" class="${cls} q-here-btn" ${data} data-verb="${act.verb}" title="${esc(actHint(act.verb))}" data-hint="${esc(actHint(act.verb))}">${icon(ART[act.verb], '', 'ico-sm')}${esc(actWord(act.verb))}</button>`;
}
