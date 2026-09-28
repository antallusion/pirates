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

export function sagaPatterns(): [string, string][] {
  return [
    ['A new chapter of your saga.', 'Новая глава вашей саги.'],
    ['No such chapter.', 'Такой главы нет.'],
    ['Wait a little before sharing another chapter.', 'Подождите немного, прежде чем делиться следующей главой.'],
  ];
}
