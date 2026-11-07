// The rescued aboard and the floating waystations' help (forum, Эдуард, post 93: «спасённые матросы … если есть
// свободное койко-место — в команду, если нет — доставить на ближайшую плавучую таверну/рынок/часовню и высадить там
// (вознаграждение); риски: нет лекаря/лекарств — лихорадка, нет морпехов — бунт, спасённый груз может быть проклят …
// таверна: обмен спасённых на рулевых или коков, ром в трюме снижает «Страх»; часовня: воскрешение, обмен на лекарей,
// лекарства снижают проклятие; рынок: обмен на плотников, часть груза — снять перегруз»).
//
// - Castaways hauled aboard sign on while she has hammocks (castaways.ts); the rest — before, given water and a course
//   home and lost — now come aboard as the RESCUED, up to RESCUE_CAP of them, within the same hourly cap of the sea.
// - Each batch taken aboard so rolls its risks once, small, and each has its answer: fever with no surgeon and no
//   medicine aboard, a mutiny with no marine, and a cursed sea-chest whatever she carries.
// - At any waystation she sets them down for silver a head; or leaves RESCUE_SWAP of them there for a trained man in the
//   place of one of her sailors (no berth needed): a helmsman or a cook at a tavern, a surgeon at a chapel, a carpenter
//   at a market. Each waystation also offers what its kind does with the hold: rum against the crew's fear (a tavern),
//   medicine against the hull's curse (a chapel), a market's buyer for the cargo past the overload line — each once per
//   AID_COOLDOWN_MS a captain, each capped a use. The chapel raises the fallen as every waystation already does.

import type { WayKind } from '../world/waystations.ts';
import { waterHour } from './smuggler.ts';

/** The rescued she carries at most (past them, water and a course home as before). */
export const RESCUE_CAP = 12;
/** Rescued left at a waystation for one trained man in the place of one of her sailors. */
export const RESCUE_SWAP = 3;
/** Silver a head set down: this share of a sea-hour of her waters (12 a sea-hour at most come: under a fifth of it). */
export const RESCUE_HEAD = 0.015;

/** The risks of a batch taken aboard as the rescued (rolled once a batch), and what each costs. */
export const RESCUE_FEVER = 0.12;
export const RESCUE_MUTINY = 0.08;
export const RESCUE_CURSE = 0.1;
/** Of her crew the fever lays in their hammocks for good / the mutineers take away in the castaways' boat. */
export const FEVER_LOSS = 0.04;
export const MUTINY_LOSS = 0.03;
/** Curse a cursed sea-chest puts on the hull (0–100; copper sheathing halves it). */
export const CHEST_CURSE = 8;

/** A tavern's rum: fear (100 − sanity) down by this a cask, at most AID_CASKS casks a use. */
export const RUM_FEAR = 5;
/** A chapel's medicine: curse down by this a chest, at most AID_CASKS chests a use. */
export const MED_CURSE = 5;
export const AID_CASKS = 6;
/** A market takes the cargo past the overload line at this share of its base price. */
export const CARGO_MUL = 0.5;
/** Each of the hold's services once in so long a captain (wall ms). */
export const AID_COOLDOWN_MS = 30 * 60_000;

export type SwapProf = 'helmsman' | 'cook' | 'surgeon' | 'carpenter';
export type WayAid = 'land' | SwapProf | 'rum' | 'medicine' | 'cargo';
/** What each kind of waystation does (the window's lines, in this order). */
export const WAY_AIDS: Record<WayKind, WayAid[]> = {
  tavern: ['land', 'helmsman', 'cook', 'rum'],
  chapel: ['land', 'surgeon', 'medicine'],
  market: ['land', 'carpenter', 'cargo'],
};
export const SWAP_PROFS: readonly SwapProf[] = ['helmsman', 'cook', 'surgeon', 'carpenter'];
export const isSwap = (a: WayAid): a is SwapProf => (SWAP_PROFS as readonly string[]).includes(a);

/** Silver a head set down at her level. */
export function rescueHead(level: number): number {
  return Math.max(10, Math.round(waterHour(level) * RESCUE_HEAD));
}

/** The rescued aboard, for her screen (PrivateState.rescue): how many, the cap, and the risks a batch runs now. */
export interface RescueView {
  aboard: number;
  cap: number;
  /** Silver a head at a waystation. */
  head: number;
  /** The chance a new batch brings each (0 when her crew answers it). */
  fever: number;
  mutiny: number;
  curse: number;
}

/** One line of the waystation's window. */
export interface AidRow {
  id: WayAid;
  /** May be done now. */
  on: boolean;
  /** `land`: the rescued and the silver; a swap: the rescued it takes; rum/medicine: the casks and the points; cargo:
   *  the units, the silver and the overload's per cent let off. */
  n: number;
  gain: number;
  /** Minutes until it may be done again (the hold's services), 0 when free. */
  wait: number;
  /** Why not (server words), or absent. */
  why?: string;
}

export const SWAP_WORD: Record<SwapProf, string> = { helmsman: 'a helmsman', cook: 'a cook', surgeon: 'a surgeon', carpenter: 'a carpenter' };

/** Said (their Russian: rescuePatterns, in the client's table). */
export function rescuePatterns(): [string, string][] {
  const out: [string, string][] = [
    ['The castaways brought a fever aboard: {0} men down in their hammocks. A surgeon or a chest of medicine keeps it out.', 'Спасённые занесли на борт лихорадку, и команда потеряла людей: {0}. Лекарь или ящик лекарств уберегли бы от неё.'],
    ['The castaways stirred up trouble: {0} of your men went off with them in their boat. Marines keep the deck.', 'Спасённые подняли смуту и увели на своей лодке ваших людей: {0}. Морпехи не допустили бы бунта.'],
    ['A castaway’s sea-chest was cursed: the hull darkens. Medicine at a floating chapel takes it off.', 'Сундук спасённого оказался проклят: корпус темнеет. Лекарства в плавучей часовне снимут проклятие.'],
    ['No hammocks: {0} rescued ride as passengers ({1} aboard). Set them down at a floating tavern, market or chapel for a reward.', 'Коек нет, и спасённые плывут пассажирами: {0}, всего на борту {1}. Высадите их у плавучей таверны, рынка или часовни за награду.'],
    ['{0} rescued set down at the waystation: they pay you {1} silver.', 'Спасённых высадили у плавучего дома ({0}): они заплатили вам {1} серебра.'],
    ['{0} casks of rum go round the tavern: the crew’s fear down by {1} %.', 'Ром пошёл по кругу (бочек: {0}): страх команды снизился на {1} %.'],
    ['The chapel’s brothers burn {0} chests of medicine over the hull: the curse down by {1} %.', 'Братья часовни окурили корпус лекарствами (ящиков: {0}): проклятие снизилось на {1} %.'],
    ['The market takes {0} of your goods for {1} silver: the hold is under the overload line.', 'Рынок забрал часть груза ({0} ед.) за {1} серебра: трюм теперь ниже черты перегруза.'],
    ['No rescued aboard.', 'На борту нет спасённых.'],
    [`Needs ${RESCUE_SWAP} rescued aboard.`, `Нужно ${RESCUE_SWAP} спасённых на борту.`],
    ['No sailor of yours to stand down.', 'Нет матроса, которого можно заменить.'],
    ['Again in {0} min.', 'Снова через {0} мин.'],
    ['Your crew is not afraid.', 'Команда ничего не боится.'],
    ['No rum in the hold.', 'В трюме нет рома.'],
    ['The hull is not cursed.', 'Корпус не проклят.'],
    ['No medicine in the hold.', 'В трюме нет лекарств.'],
    ['Your hold is not overloaded.', 'Трюм не перегружен.'],
    ['Not here.', 'Здесь этого нет.'],
    ['No waystation within reach of the helmsman.', 'Рядом нет плавучего дома, куда мог бы довести рулевой.'],
  ];
  const ru: Record<string, string> = { helmsman: 'рулевой', cook: 'кок', surgeon: 'лекарь', carpenter: 'плотник' };
  for (const [k, en] of Object.entries(SWAP_WORD)) {
    out.push([`${RESCUE_SWAP} rescued stay at the waystation; in the place of one of your sailors ${en} comes aboard.`, `${RESCUE_SWAP} спасённых остаются в плавучем доме, а вместо одного вашего матроса на борт поднимается ${ru[k]}.`]);
  }
  return out;
}

