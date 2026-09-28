// A captain's saga on the client (docs/12 P10 #20): the chronicle her journal writes by itself, told in the reader's
// tongue from each chapter's facts; the window of her chapters (the newest first), and a chapter as a postcard in the
// chat — its picture, her flag, the telling.

import { HOLIDAYS } from '../../../shared/src/data/holidays.ts';
import { SAGA_ICON } from '../../../shared/src/data/saga.ts';
import type { SagaEntry, SagaKind } from '../../../shared/src/data/saga.ts';
import type { ClientMsg, SagaCard } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { personName } from '../lang/names.ts';
import { serverText } from '../lang/server.ts';
import { flagCanvas } from '../render/flag.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { placeName } from './maps.ts';

const TELL: Record<SagaKind, [string, string]> = {
  storm_heart: ['{d}, Captain {c} caught the heart of the storm over {0}.', '{d} капитан {c} ловит сердце шторма над водами «{0}».'],
  descent: ['{d}, Captain {c} went down the Maelstrom Stair to tier {n}.', '{d} капитан {c} спускается по Лестнице Мальстрёма до {n}-го яруса.'],
  named: ['{d}, Captain {c} sank {0}, the pirate wanted in {1}.', '{d} капитан {c} топит пирата {0}, которого разыскивали в водах «{1}».'],
  nemesis: ['{d}, Captain {c} settled the old score with {0}.', '{d} заклятый враг {0} повержен: старый счёт капитана {c} закрыт.'],
  beast: ['{d}, Captain {c} took a {0} off {1}.', '{d} у острова {1} капитану {c} достаётся добыча — {0}.'],
  record_fish: ['{d}, Captain {c} landed a record {0} of {n} kg.', '{d} капитан {c} вытаскивает рекордную рыбу — {0}, {n} кг.'],
  regatta: ['{d}, Captain {c} won the Regatta of Equal Waters off {0}.', '{d} регата «Равные воды» ({0}): первым приходит корабль капитана {c}.'],
  promotion: ['{d}, Captain {c} was made {0}.', '{d} капитан {c} получает чин: {0}.'],
  wonder: ['{d}, Captain {c} found a wonder of the sea: {0}.', '{d} капитан {c} находит чудо моря: {0}.'],
  dutchman: ['{d}, Captain {c} sent the Flying Dutchman to his rest.', '{d} капитан {c} упокаивает Летучего Голландца.'],
  holiday_flag: ['{d}, Captain {c} won the flag of {0}.', '{d} капитан {c} получает флаг праздника «{0}».'],
  sunk: ['{d}, the sea took Captain {c}’s {0} off {1}.', '{d} у острова {1} море забирает «{0}», корабль капитана {c}.'],
  turncoat: ['{d}, {0}, once an enemy, signed on with Captain {c}.', '{d} {0}, бывший враг, подписывает договор с капитаном {c}.'],
  island: ['{d}, the island of {0} passed to Captain {c}.', '{d} остров {0} переходит к капитану {c}.'],
};

const L = dict({
  title: 'The saga of Captain {name}',
  sub: 'Your journal writes the chronicle of your voyages by itself. Share the best chapters in the chat as a postcard.',
  none: 'Nothing worth the telling yet: the sea is waiting.',
  share: 'Share in the chat',
  button: 'Saga',
}, {
  title: 'Сага капитана {name}',
  sub: 'Журнал сам пишет летопись ваших плаваний. Лучшими главами можно поделиться в чате — открыткой.',
  none: 'Пока нечего рассказать: море ждёт.',
  share: 'Поделиться в чате',
  button: 'Сага',
});

export const sagaButton = (): string => L('button');

const ru = () => (lang() === 'ru' ? 1 : 0);

function ordinal(n: number): string {
  const t = n % 100, u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
}

function dayPhrase(e: SagaEntry): string {
  if (ru()) return e.holiday ? `В ${e.day}-й день праздника «${HOLIDAYS[e.holiday].name[1]}»` : `На ${e.day}-й день в море`;
  return e.holiday ? `On the ${ordinal(e.day)} day of ${HOLIDAYS[e.holiday].name[0]}` : `On the ${ordinal(e.day)} day at sea`;
}

const name = (x: string) => {
  const t = placeName(x);
  return t === x ? personName(serverText(x)) : t;
};

/** A chapter told in the reader's tongue. */
export function tellSaga(e: SagaEntry, captain: string): string {
  return TELL[e.kind][ru()].replace('{d}', dayPhrase(e)).replace('{c}', personName(captain)).replace('{n}', String(e.n ?? '')).replace(/\{(\d)\}/g, (_, i: string) => name(e.a[Number(i)] ?? ''));
}

function flagImg(flag: number | null, w: number, h: number): string {
  if (flag === null) return '';
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  c.getContext('2d')!.drawImage(flagCanvas(flag), 0, 0, c.width, c.height);
  return `<img class="saga-flag" src="${c.toDataURL()}" alt="" width="${w}" height="${h}">`;
}

/** Her chapters, the newest first. */
export function renderSaga(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const self = state.self;
  if (!self) return;
  const list = [...(self.saga ?? [])].reverse();
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title', { name: personName(self.name) }))}</h2><div class="sub">${esc(L('sub'))}</div></div></div>
    <div class="modal-body saga">${list.length ? list.map((e) => `<div class="saga-ch">${icon(SAGA_ICON[e.kind], '', 'ico-md')}<p>${esc(tellSaga(e, self.name))}</p><button class="btn btn-small" data-sshare="${e.id}">${esc(L('share'))}</button></div>`).join('') : `<p class="muted">${esc(L('none'))}</p>`}</div>`;
  root.querySelectorAll<HTMLElement>('[data-sshare]').forEach((b) => (b.onclick = () => send({ t: 'saga', action: 'share', id: Number(b.dataset.sshare) })));
}

/** A shared chapter in the chat: a postcard with its picture and the captain's flag. */
export function sagaCardHtml(card: SagaCard): string {
  return `<div class="saga-card">${icon(SAGA_ICON[card.entry.kind], '', 'saga-pic')}<div class="saga-text">${flagImg(card.flag, 27, 18)}${esc(tellSaga(card.entry, card.name))}</div></div>`;
}
