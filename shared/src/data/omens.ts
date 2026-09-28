// Omens of the day (docs/12 P10 #9): each morning of game time the sea gives one omen to the whole server. Some change
// the day for everyone; some ask a thing of a captain — keep it, and fortune smiles on her for an hour; break it, and
// misfortune (a cursed hour) follows.

import { DAY_LENGTH_SEC } from '../constants.ts';
import type { StatMods } from './stats.ts';

type Tr = [string, string];

export type OmenId = 'albatross' | 'whistle' | 'dolphins' | 'st_elmo' | 'drowned_bell' | 'new_moon' | 'black_cat' | 'whale_spout' | 'red_sky' | 'coin_mast';

export interface OmenDef {
  name: Tr;
  text: Tr;
  /** What the day is for everyone at sea. */
  mods?: StatMods;
  /** What she must do for fortune ('keep'), or must not do ('break'). */
  keep?: 'fish' | 'ghost' | 'storm' | 'coin';
  breaks?: 'merchant' | 'no_cat';
}

export const OMENS: Record<OmenId, OmenDef> = {
  albatross: { name: ['The Albatross', 'Альбатрос'], text: ['An albatross follows the ships: sink no merchantman today, or misfortune follows.', 'За кораблями летит альбатрос: не топите сегодня торговцев — иначе жди беды.'], breaks: 'merchant' },
  whistle: { name: ['Whistling on Deck', 'Свист на палубе'], text: ['Someone whistled on deck and called the wind: every ship is faster today, and every gunner jumpier.', 'Кто-то свистнул на палубе и накликал ветер: сегодня все корабли быстрее, а канониры — нервнее.'], mods: { maxSpeed: 0.05, spreadMul: 0.06 } },
  dolphins: { name: ['Dolphins at the Bow', 'Дельфины у носа'], text: ['Dolphins ran at the bow at dawn: the first fish you land today brings good luck.', 'На рассвете у носа шли дельфины: первая рыба, что вы вытащите сегодня, принесёт удачу.'], keep: 'fish' },
  st_elmo: { name: ['St Elmo’s Fire', 'Огни святого Эльма'], text: ['St Elmo’s fire burned in the rigging: fortune favours the bold — treasure is easier to find today.', 'В снастях горели огни святого Эльма: удача любит смелых — клады сегодня находятся легче.'], mods: { treasureHunter: 0.15 } },
  drowned_bell: { name: ['Bells under the Sea', 'Колокола под водой'], text: ['Bells rang under the sea at night: the drowned are restless. Send a ghost ship down for good luck.', 'Ночью под водой звонили колокола: утопленники неспокойны. Отправьте на дно корабль-призрак — будет удача.'], keep: 'ghost' },
  new_moon: { name: ['The New Moon', 'Новолуние'], text: ['A moonless night ahead: the customs men and the watch see less today.', 'Впереди безлунная ночь: таможня и дозоры сегодня видят хуже.'], mods: { signature: -0.15 } },
  black_cat: { name: ['The Black Cat', 'Чёрный кот'], text: ['A black cat walked the quay: whoever puts to sea without a cat on deck invites misfortune.', 'По причалу прошёл чёрный кот: кто выйдет в море без кота на палубе — накличет беду.'], breaks: 'no_cat' },
  whale_spout: { name: ['A Spout at Dawn', 'Фонтан на рассвете'], text: ['A whale spouted at dawn: a whaler’s day — every carcass gives more.', 'На рассвете кит пустил фонтан: день китобоя — каждая туша даёт больше.'] },
  red_sky: { name: ['Red Sky at Morning', 'Красное утро'], text: ['Red sky at morning, sailors take warning: ride out a storm at sea today, and fortune is yours.', 'Красное небо поутру — моряку не к добру: переждите сегодня шторм в море, и удача будет вашей.'], keep: 'storm' },
  coin_mast: { name: ['A Coin under the Mast', 'Монета под мачтой'], text: ['An old custom: nail a coin under the mast in port (50 silver) for a fair wind all day.', 'Старый обычай: прибейте в порту монету под мачту (50 серебра) — и весь день будет попутный ветер.'], keep: 'coin' },
};
export const OMEN_IDS = Object.keys(OMENS) as OmenId[];

export const FORTUNE: StatMods = { treasureHunter: 0.1, moraleRegen: 0.1 };
export const MISFORTUNE: StatMods = { treasureHunter: -0.1, moraleRegen: -0.1 };
export const FAIR_WIND: StatMods = { maxSpeed: 0.04 };
export const COIN_COST = 50;

/** The game day's number (a day begins at six in the morning). */
export function omenDay(worldTimeSec: number): number {
  return Math.floor(worldTimeSec / DAY_LENGTH_SEC + 0.35 - 0.25);
}

/** The day's omen (the same for everyone, never the same two days running). */
export function omenOf(day: number): OmenId {
  const h = (d: number) => (((d * 2654435761) >>> 0) % OMEN_IDS.length);
  let i = h(day);
  if (i === h(day - 1)) i = (i + 1) % OMEN_IDS.length;
  return OMEN_IDS[i];
}

export function omenPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const o of Object.values(OMENS)) out.push(o.name, o.text);
  out.push(
    ['The omen of the day: {0}', 'Примета дня: {0}'],
    ['The omen is kept: fortune smiles on you for an hour.', 'Примета исполнена: час удача на вашей стороне.'],
    ['The omen is broken: misfortune follows you for an hour.', 'Примета нарушена: час за вами ходит беда.'],
    ['A coin is nailed under the mast: a fair wind all day.', 'Монета прибита под мачту — попутный ветер на весь день.'],
    ['The coin is nailed already.', 'Монета уже прибита.'],
    ['Not today’s custom.', 'Сегодня не тот обычай.'],
  );
  return out;
}
