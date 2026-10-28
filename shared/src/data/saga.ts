// A captain's saga (docs/12 P10 #20): the journal writes the chronicle of her play by itself — the day (of her voyages,
// or of the holiday then on), what she did and where. Each chapter is kept as its facts; every reader's client tells it
// in its own tongue, and the best can be shared in the chat as a postcard with its picture and her flag.

import type { HolidayId } from './holidays.ts';

export type SagaKind =
  | 'storm_heart' | 'descent' | 'named' | 'nemesis' | 'beast' | 'record_fish' | 'regatta' | 'promotion' | 'wonder'
  | 'dutchman' | 'holiday_flag' | 'sunk' | 'turncoat' | 'island';

export interface SagaEntry {
  id: number;
  /** Wall-clock ms. */
  at: number;
  /** The day of her voyages (game days since she first sailed), or of the holiday then on. */
  day: number;
  holiday: HolidayId | null;
  kind: SagaKind;
  /** Names as the server says them (places, beasts, pirates, titles), translated by the reader's client. */
  a: string[];
  n?: number;
}

/** The chapters she keeps (the oldest go), and how often she may share one in the chat (seconds). */
export const SAGA_MAX = 80;
export const SHARE_EVERY_SEC = 60;
/** The picture on a chapter's card. */
export const SAGA_ICON: Record<SagaKind, string> = {
  storm_heart: 'weather_storm', descent: 'danger', named: 'wanted', nemesis: 'danger', beast: 'role_harpooner',
  record_fish: 'build_fishing_village', regatta: 'wind', promotion: 'map_contract', wonder: 'map_port', dutchman: 'tab_legends',
  holiday_flag: 'xp', sunk: 'map_wreck', turncoat: 'stat_crew', island: 'tab_empire',
};

/** Each chapter told in both tongues ({d} the day, {c} the captain, {n} a number, {0} {1} the names): the game's journal
 *  (client/src/ui/saga.ts) and the website's captain card (server/src/game/siteprofile.ts). */
export const SAGA_TELL: Record<SagaKind, [string, string]> = {
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

export function sagaPatterns(): [string, string][] {
  return [
    ['A new chapter of your saga.', 'Новая глава вашей саги.'],
    ['No such chapter.', 'Такой главы нет.'],
    ['Wait a little before sharing another chapter.', 'Подождите немного, прежде чем делиться следующей главой.'],
  ];
}
