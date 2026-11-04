// «Каперский патент» — the privateer's patent (owner, 2026-11-02: «Начинай реализацию каперского патента, только сам
// придумай, как он будет работать. Всё-таки игра у нас больше про PvP и отношения между пиратами. Поэтому нужно
// соблюдать баланс»; forum, Эдуард: «в уважающих себя гильдиях не должно быть пиратов, только каперы (корсары), которые
// за деньги покупают патенты за нападения на корабли конкурирующих гильдий или фракций»).
// A fourth way to sail, laid over the city flag: a lawful harbour (the Crown, the League, the Harpoon) sells a captain
// flying ITS colours a patent for a week. Under it:
//   - prey without a skull: every ship of the issuer's enemies (merchants, fishers, patrols, any), the sea's pirates,
//     captains flying an enemy city's flag (both ways: they may answer her) and, as ever, the pirate flag;
//   - protected: the issuer's own ships and its allies' (refused), neutral colours, the Green Pennant, the safe waters
//     and the ferry havens (the law of the sea stands);
//   - piracy: a ship neither enemy nor ally (a Free Harbors merchant for the Crown) may be fired on — but that burns the
//     patent and lands a skull, as the pirate flag would;
//   - the price of it: by her level; a fifth of the silver taken from her prey goes to the issuer; the enemy's patrols
//     hunt her in their waters and its harbours send ships after her; its ports shut to her; a kill under the patent
//     earns three quarters of the PvP points (the pirate takes the greater risk); standing up with the issuer, down with
//     the prey;
//   - it ends: in a week (renewed in any port of the issuer, up to two weeks ahead), when other colours go up, with a
//     skull on her, or on an act of piracy.

import { factionRelation } from './factions.ts';
import type { FactionId } from './factions.ts';
import { SERVICES } from './marque.ts';
import type { ServiceId } from './marque.ts';

export type PatentIssuer = 'crown' | 'league' | 'harpoon';
export const PATENT_ISSUERS: readonly PatentIssuer[] = ['crown', 'league', 'harpoon'];

/** A week of the wall clock; renewed, never more than two weeks ahead. */
export const PATENT_MS = 7 * 86_400_000;
export const PATENT_MAX_MS = 14 * 86_400_000;
/** Below this level no harbour sells one (the Green Pennant's young are not privateers). */
export const PATENT_LEVEL = 10;
/** The issuer's share of the silver taken from the patent's prey. */
export const PATENT_CUT = 0.2;
/** The PvP points of a captain beaten under a patent (the pirate flag's are whole). */
export const PATENT_PVP_MUL = 0.75;
/** Standing with the issuer for a ship of its enemies sunk / taken. */
export const PATENT_REP_SUNK = 1;
export const PATENT_REP_BOARDED = 2;
/** Two factions this far apart (−100…100) are enemies under a patent; this close, allies (protected). */
export const PATENT_ENEMY_REL = -30;
export const PATENT_ALLY_REL = 20;
/** The enemy's patrols and hunters come for her within this of a harbour of theirs; a harbour this near sends a ship out
 *  after her every PATENT_SALLY_SEC (one at a time). */
export const PATENT_WATERS_R = 9000;
export const PATENT_SALLY_R = 6000;
export const PATENT_SALLY_SEC = 150;

/** The price at her level: a sea-hour and a half of her ship's waters (6 × 320 × 1.3^(⚓−1)), in fifties. */
export function patentPrice(level: number): number {
  const anchor = Math.max(1, Math.min(10, Math.ceil(Math.max(1, level) / 6)));
  return Math.round((1.5 * 6 * 320 * 1.3 ** (anchor - 1)) / 50) * 50;
}

export function isIssuer(f: FactionId | null | undefined): f is PatentIssuer {
  return f === 'crown' || f === 'league' || f === 'harpoon';
}

/** How the issuer stands to a faction: its own or an ally (protected), an enemy (prey), or neither (piracy). */
export type Stance = 'own' | 'ally' | 'enemy' | 'other';
export function stanceOf(issuer: PatentIssuer, f: FactionId): Stance {
  if (f === issuer) return 'own';
  const r = factionRelation(issuer, f);
  if (r <= PATENT_ENEMY_REL) return 'enemy';
  if (r >= PATENT_ALLY_REL) return 'ally';
  return 'other';
}

const ALL: FactionId[] = ['crown', 'league', 'confederacy', 'harpoon', 'brokers', 'choir', 'free'];
/** The issuer's enemies (its patent's prey) and its allies (protected with it). */
export function patentEnemies(issuer: PatentIssuer): FactionId[] {
  return ALL.filter((f) => stanceOf(issuer, f) === 'enemy');
}
export function patentAllies(issuer: PatentIssuer): FactionId[] {
  return ALL.filter((f) => stanceOf(issuer, f) === 'ally');
}

/** A patent and her service (letters of marque, marque.ts; forum, Эдуард, post 70: «Я состоял в гильдии Корона,
 *  дослужился до Командора с жалованием. Купил патент Лиги и потерял все регалии и привилегии Короны, хотя Лига —
 *  союзник Короны»): a patent never touches the rank, the merit, the pay or the titles of her service — the issuer is
 *  her service's own flag, an ally or a stranger to it, and she serves on under it. Only a patent of her service's ENEMY
 *  (its declared enemies, or a flag it stands at PATENT_ENEMY_REL or worse with: the Brethren and the Crown) is
 *  incompatible with it: bought only after a plain warning, and then she leaves the service (no ban, no standing lost). */
export function patentClash(service: ServiceId | null | undefined, by: PatentIssuer): boolean {
  if (!service || service === by) return false;
  return (SERVICES[service].enemies as FactionId[]).includes(by) || factionRelation(service, by) <= PATENT_ENEMY_REL;
}

/** Said (the server's sentences; their Russian is client/src/lang/server.ru.flags.ts). */
export const PATENT_SAY = {
  protectedShip: 'Your patent protects the ships of its own flag and its allies.',
  piracy: 'Piracy! You attacked a ship that is no enemy of your patent: the patent is burnt, and the law wants you.',
  notLawful: 'Privateer patents are sold only in the harbours of the Crown, the League and the Harpoon.',
  level: `A patent is sold from level ${PATENT_LEVEL}.`,
  skulls: 'No patent for a captain with skulls on her: wash them off first.',
  code: 'A captain sworn to the Code takes no lawful patent.',
  colours: 'A patent is sold to a captain under this city’s colours: hoist them first (above), then buy it.',
  other: 'You already hold another flag’s patent: it ends with its week, or when other colours go up.',
  max: 'Your patent is already paid two weeks ahead.',
  rep: 'This flag thinks too ill of you to sell you a patent.',
  enemyPort: 'Your patent is at war with this harbour: its quay is shut to you.',
  expired: 'Your privateer patent has run out.',
  struck: 'Other colours are up: your privateer patent is void.',
  wanted: 'The law wants you: your privateer patent is void.',
  hunted: 'Privateer! An enemy patrol puts out after you.',
  clash: 'This patent is your service’s enemy’s: buying it ends your service. Confirm first.',
} as const;

/** The issuer's name in a sentence: «of the Crown» / «Короны». */
const OF: Record<PatentIssuer, [string, string]> = { crown: ['the Crown', 'Короны'], league: ['the League', 'Лиги'], harpoon: ['the Harpoon', 'Гарпуна'] };

/** The toasts of a purchase and of the issuer's fifth, whole sentences each (the client's table reads whole sentences:
 *  patentPatterns). */
export function patentBought(by: PatentIssuer, days: number, cost: number, renewed: boolean): string {
  return renewed ? `Patent of ${OF[by][0]} renewed: ${days} days left (${cost} silver).` : `Privateer patent of ${OF[by][0]}: ${days} days (${cost} silver). Its enemies are your prey.`;
}
export function patentTithe(by: PatentIssuer, n: number): string {
  return `The fifth of ${OF[by][0]}: ${n} silver of the prize go to the issuer.`;
}

/** English → Russian of every sentence above. */
export function patentPatterns(): [string, string][] {
  const out: [string, string][] = [
    [PATENT_SAY.protectedShip, 'Ваш патент защищает корабли своего флага и его союзников.'],
    [PATENT_SAY.piracy, 'Пиратство! Вы напали на корабль, который не враг вашему патенту: патент сгорел, вас ищет закон.'],
    [PATENT_SAY.notLawful, 'Каперские патенты продают только в гаванях Короны, Лиги и Гарпуна.'],
    [PATENT_SAY.level, `Патент продают с ${PATENT_LEVEL}-го уровня.`],
    [PATENT_SAY.skulls, 'Капитану с черепами патент не продают: сначала отмойтесь.'],
    [PATENT_SAY.code, 'Капитан, присягнувший Кодексу, законного патента не берёт.'],
    [PATENT_SAY.colours, 'Патент продают капитану под флагом этого города: сначала поднимите его (выше), потом покупайте.'],
    [PATENT_SAY.other, 'У вас уже патент другого флага: он кончится с его неделей или когда поднимете другой флаг.'],
    [PATENT_SAY.max, 'Ваш патент уже оплачен на две недели вперёд.'],
    [PATENT_SAY.rep, 'Этот флаг слишком плохо о вас думает, чтобы продать патент.'],
    [PATENT_SAY.enemyPort, 'Ваш патент воюет с этой гаванью: её причал для вас закрыт.'],
    [PATENT_SAY.expired, 'Срок вашего каперского патента вышел.'],
    [PATENT_SAY.struck, 'Поднят другой флаг: каперский патент недействителен.'],
    [PATENT_SAY.wanted, 'Вас ищет закон: каперский патент недействителен.'],
    [PATENT_SAY.hunted, 'Капер! За вами вышел вражеский патруль.'],
    [PATENT_SAY.clash, 'Это патент врага вашей службы: купив его, вы уйдёте со службы. Сначала подтвердите.'],
    ['Patents are sold in port.', 'Патенты продают в порту.'],
  ];
  for (const by of PATENT_ISSUERS) {
    out.push(
      [`Patent of ${OF[by][0]} renewed: {0} days left ({1} silver).`, `Патент ${OF[by][1]} продлён: осталось {0} дн. ({1} серебра).`],
      [`Privateer patent of ${OF[by][0]}: {0} days ({1} silver). Its enemies are your prey.`, `Каперский патент ${OF[by][1]}: {0} дн. ({1} серебра). Её враги — ваша добыча.`],
      [`The fifth of ${OF[by][0]}: {0} silver of the prize go to the issuer.`, `Доля ${OF[by][1]}: {0} серебра с добычи ушли казне.`],
    );
  }
  return out;
}
