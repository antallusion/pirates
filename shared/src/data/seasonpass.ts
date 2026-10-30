// «Сезонная карта» — the season pass (owner, 2026-10-30: «давай сезонную карту сделаем, чтобы раз в 2 месяца менялись
// награды … для премиум юзеров которые 790 рублей заплатят для них каждые 20 уровней значимые награды … чтобы сезон
// закрыть полностью нужно примерно 300 часов геймплея … 100 ступеней … на 100 уровне можно получить корабль 7 уровня …
// и есть еще суперпропуск за 1350 рублей - там будет +20 уровней в подарок даваться и какая-то рамка специальная»).
//
// The table and the numbers; the server's side is server/src/game/seasonpass.ts, the window client/src/ui/seasonpass.ts.
//  - A season lasts two calendar months by Moscow time (the first from its launch on 2026-10-30 to the year's end), and
//    each has its own name, theme and reward table (SEASONS: the first authored in full, the second drafted).
//  - 100 tiers. Season experience («опыт сезона») comes from the substantial things only (PASS_XP: the contracts, the
//    daily orders, the quests and the campaign, a captain beaten, a boarding won, a lair or a creature fight won, the
//    bosses, a world event's ships, the island's buildings, a treasure dug) — each with a day's cap (PASS_CAP), nothing
//    by the second at sea — and from the daily and weekly «испытания сезона» (CHALLENGES).
//  - The pace (PASS_HOUR, passModel): a captain who plays about 300 hours in the season closes all 100 tiers; one who
//    plays an hour a day reaches about the 30th (tests/seasonpass.test.ts holds both).
//  - Two tracks: the free one (silver, the island's goods, maps, speed-ups, scrolls, kits — nothing that moves the
//    balance) and the premium one (PASS_PRICES: «Премиум-пропуск» 790 ₽; «Суперпропуск» 1350 ₽ is it and 20 tiers at
//    once and a frame had nowhere else; the step from the one to the other 560 ₽). Every 20th tier of the premium track
//    is a milestone: a small gift stack of tier 4–5 men, a rare artifact, a cosmetic of the pass's own, a title, and at
//    the 100th a hull of ⚓7 the doubloon shop no longer sells (PASS_SHIP).

import type { UnitId } from './army.ts';
import type { BaseRes } from './base.ts';
import type { ShipClassId } from './ships.ts';
import { STARS_PER_DOUBLOON } from './premium.ts';
import { votesOf } from './vk.ts';

type Tr = [string, string];

// ------------------------------------------------------------------------------------------------ the calendar

const H = 3_600_000;
const DAY = 24 * H;
/** Moscow is three hours ahead of UTC (no summer time). */
const MSK = 3 * H;
/** Midnight in Moscow of a calendar day (month 0-based; months past 11 roll into the next year, as Date.UTC does). */
export const mskMidnight = (y: number, m: number, d = 1): number => Date.UTC(y, m, d) - MSK;

/** The first season begins with the pass itself (2026-10-30, Moscow) and ends with the year: 2026-12-31 23:59 MSK. */
export const PASS_EPOCH = mskMidnight(2026, 9, 30);
/** From the second on, a season is two calendar months: January–February, March–April, … */
const S2_FROM = mskMidnight(2027, 0, 1);

/** The season of a wall time (1, 2, …): before the launch, the first (its tests and an early server alike). */
export function passSeasonAt(wall: number): number {
  if (wall < S2_FROM) return 1;
  const d = new Date(wall + MSK);
  const months = (d.getUTCFullYear() - 2027) * 12 + d.getUTCMonth();
  return 2 + Math.floor(months / 2);
}

/** A season's bounds (wall ms): from its first moment to the first of the next. */
export function passBounds(n: number): { from: number; until: number } {
  if (n <= 1) return { from: PASS_EPOCH, until: S2_FROM };
  const k = (n - 2) * 2;
  return { from: mskMidnight(2027, k), until: mskMidnight(2027, k + 2) };
}

// ------------------------------------------------------------------------------------------------ the tiers

export const PASS_TIERS = 100;
/** The super pass's gift: so many tiers at once. */
export const SUPER_TIERS = 20;
/** The curve: a tier costs PASS_BASE at the first and (1 + PASS_K) times as much at the hundredth (1 120 → 2 800), a
 *  straight rise — the first tiers come quicker, so a captain who plays an hour a day reaches about the 30th, and the
 *  whole hundred asks about 300 hours (passModel, tests/seasonpass.test.ts). */
export const PASS_BASE = 1120;
export const PASS_K = 1.5;

/** The season experience the tier `t` (1–100) asks for, from the tier before. */
export function tierXp(t: number): number {
  const k = Math.max(1, Math.min(PASS_TIERS, Math.floor(t)));
  return Math.round((PASS_BASE * (1 + (PASS_K * (k - 1)) / (PASS_TIERS - 1))) / 10) * 10;
}

const CUM: number[] = [0];
for (let t = 1; t <= PASS_TIERS; t++) CUM[t] = CUM[t - 1] + tierXp(t);

/** The experience from nought to the tier `t` (0 for 0; the whole season's for 100). */
export const xpToTier = (t: number): number => CUM[Math.max(0, Math.min(PASS_TIERS, Math.floor(t)))];
export const PASS_TOTAL_XP = CUM[PASS_TIERS];

/** The tier a season's experience reaches, and the progress into the next. */
export function tierOf(xp: number): { tier: number; into: number; need: number } {
  const x = Math.max(0, Math.floor(xp));
  let t = 0;
  while (t < PASS_TIERS && CUM[t + 1] <= x) t++;
  return t >= PASS_TIERS ? { tier: PASS_TIERS, into: 0, need: 0 } : { tier: t, into: x - CUM[t], need: tierXp(t + 1) };
}

// ------------------------------------------------------------------------------------------------ the season experience

/** Where season experience comes from — the substantial things only (owner: «опыт зарабатывается в основном с
 *  поручений, пвп и чего-то такого существенного»):
 *   contract    a port's contract delivered (courier, cargo, bounty);
 *   daily       one of the day's three orders done; daily_chest — all three, the chest opened;
 *   quest       a job of the port's board done; story — a story's or a side quest's step done; campaign — a step of the
 *               main campaign;
 *   pvp         a captain beaten (sunk or boarded) — not a much weaker one, not the same one twice in PVP_SAME_H;
 *   board       a boarding won against a ship of the sea that is not grey to her;
 *   lair        a fight ashore or with creatures won (a lair, a roaming stack, a drift, a guard);
 *   boss        a sea boss slain with her part in it; zboss — a zone boss; shore — a boss of the shore;
 *   event       a ship of a world event's squadron sunk or taken (an armada, a blockade, a convoy, the White Orca …);
 *   isle        a building or a producer of her island finished (a level up too);
 *   treasure    a treasure dug up;
 *   challenge   a season challenge done (CHALLENGES; the amount is the challenge's own). */
export type PassSource = 'contract' | 'daily' | 'daily_chest' | 'quest' | 'story' | 'campaign' | 'pvp' | 'board' | 'lair' | 'boss' | 'zboss' | 'shore' | 'event' | 'isle' | 'treasure' | 'challenge';
export const PASS_SOURCES: PassSource[] = ['contract', 'daily', 'daily_chest', 'quest', 'story', 'campaign', 'pvp', 'board', 'lair', 'boss', 'zboss', 'shore', 'event', 'isle', 'treasure', 'challenge'];

/** The season experience of one, by source (a boss's: the whole of it to the one who did the most, half to a small
 *  part — passBossXp). */
export const PASS_XP: Record<PassSource, number> = {
  contract: 45, daily: 20, daily_chest: 40, quest: 40, story: 55, campaign: 55, pvp: 150, board: 30, lair: 50,
  boss: 220, zboss: 300, shore: 160, event: 45, isle: 35, treasure: 45, challenge: 0,
};

/** How many of each count a UTC day (the rest teach the captain, not the pass): a day of grinding one cheap thing is not
 *  a season. Challenges have no cap of their own (three a day, four a week). */
export const PASS_CAP: Record<PassSource, number> = {
  contract: 20, daily: 3, daily_chest: 1, quest: 25, story: 30, campaign: 30, pvp: 8, board: 20, lair: 20,
  boss: 8, zboss: 6, shore: 6, event: 15, isle: 8, treasure: 8, challenge: 99,
};

/** A captain beaten counts once in so many hours (two captains trading sinkings earn nothing), and only if she is no
 *  more than PVP_LEVEL_GAP levels below the victor. */
export const PVP_SAME_H = 6;
export const PVP_LEVEL_GAP = 5;

/** A boss's season experience by her part in it (0–1): half of it for any part, the whole from a quarter. */
export function passBossXp(source: 'boss' | 'zboss' | 'shore', share: number): number {
  const s = Math.max(0, Math.min(1, share));
  return Math.round(PASS_XP[source] * (0.5 + 0.5 * Math.min(1, s * 4)));
}

// ------------------------------------------------------------------------------------------------ the challenges

/** What a challenge counts: one or more sources. */
export interface ChallengeDef {
  id: string;
  /** Daily (three a day) or weekly (four a week). */
  period: 'day' | 'week';
  src: PassSource[];
  need: number;
  xp: number;
  /** Words: «{n}» the need. */
  text: Tr;
  /** Only for a captain with an island of her own. */
  isle?: boolean;
}

export const DAILY_CHALLENGES = 3;
export const WEEKLY_CHALLENGES = 4;

const ch = (id: string, period: 'day' | 'week', src: PassSource[], need: number, xp: number, text: Tr, isle = false): ChallengeDef => ({ id, period, src, need, xp, text, ...(isle ? { isle: true } : {}) });

/** The pools. A day's need is about forty minutes of the mixed play (PASS_HOUR), a week's about three hours. */
export const CHALLENGES: ChallengeDef[] = [
  ch('d_jobs', 'day', ['quest', 'story', 'campaign', 'contract'], 6, 150, ['Finish {n} commissions: quests, contracts or the campaign', 'Выполните {n} поручения: задания, контракты или кампанию']),
  ch('d_contract', 'day', ['contract'], 3, 150, ['Deliver {n} port contracts', 'Выполните {n} контракта порта']),
  ch('d_board', 'day', ['board', 'pvp'], 4, 150, ['Win {n} boardings', 'Победите в {n} абордажах']),
  ch('d_lair', 'day', ['lair'], 3, 150, ['Win {n} fights with creatures: lairs, stacks or drifts', 'Победите в {n} боях с существами: логова, стаи или дрейфы']),
  ch('d_orders', 'day', ['daily_chest'], 1, 150, ['Open the chest of the daily orders', 'Откройте сундук ежедневных поручений']),
  ch('d_treasure', 'day', ['treasure'], 1, 150, ['Dig up a treasure', 'Откопайте клад']),
  ch('d_isle', 'day', ['isle'], 1, 150, ['Finish a building on your island', 'Завершите стройку на своём острове'], true),
  ch('w_jobs', 'week', ['quest', 'story', 'campaign', 'contract'], 35, 900, ['Finish {n} commissions this week', 'Выполните {n} поручений за неделю']),
  ch('w_board', 'week', ['board', 'pvp'], 25, 900, ['Win {n} boardings this week', 'Победите в {n} абордажах за неделю']),
  ch('w_lair', 'week', ['lair'], 15, 900, ['Win {n} fights with creatures this week', 'Победите в {n} боях с существами за неделю']),
  ch('w_pvp', 'week', ['pvp'], 3, 900, ['Beat {n} captains this week', 'Победите {n} капитанов за неделю']),
  ch('w_boss', 'week', ['boss', 'zboss', 'shore', 'event'], 5, 900, ['Fight in {n} hunts: bosses or world events', 'Поучаствуйте в {n} охотах: боссы или события мира']),
  ch('w_orders', 'week', ['daily_chest'], 5, 900, ['Open the chest of the daily orders {n} times', 'Откройте сундук ежедневных поручений {n} раза']),
  ch('w_treasure', 'week', ['treasure'], 6, 900, ['Dig up {n} treasures this week', 'Откопайте {n} клада за неделю']),
  ch('w_isle', 'week', ['isle'], 6, 900, ['Finish {n} buildings on your island this week', 'Завершите {n} стройки на острове за неделю'], true),
];
export const challengeOf = (id: string): ChallengeDef | undefined => CHALLENGES.find((c) => c.id === id);

/** A small hash (FNV-1a) for the picks: the same account, the same day — the same three. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The challenges of a day (the UTC day) or a week (the shop's week) for an account: drawn without repeats from the
 *  pool, the island's only for a captain who has one. */
export function rollChallenges(acc: number, period: 'day' | 'week', index: number, isle: boolean): string[] {
  const pool = CHALLENGES.filter((c) => c.period === period && (isle || !c.isle)).map((c) => c.id);
  const n = period === 'day' ? DAILY_CHALLENGES : WEEKLY_CHALLENGES;
  const out: string[] = [];
  let seed = hash(`${acc}:${period}:${index}`);
  while (out.length < n && pool.length) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the rewards

/** A reward of a tier. Silver is in minutes of the sea's silver at her ship's level (hourSilver: a reward worth the
 *  same to every captain); creatures come by letter as a gift's stack (they fight, train and split, but their losses
 *  are never made good — the gift of 2026-10-28's rule), and wait in it for a slot and the hammocks. */
export type PassReward =
  | { k: 'silver'; min: number }
  | { k: 'res'; good: BaseRes; n: number }
  | { k: 'speed'; min: number }
  | { k: 'map'; n: number }
  | { k: 'scrolls'; n: number }
  | { k: 'kit'; n: number }
  | { k: 'charm'; n: number }
  | { k: 'xp'; hours: number }
  | { k: 'wind'; hours: number }
  | { k: 'prod'; hours: number }
  | { k: 'rscroll'; n: number }
  | { k: 'cos'; key: string }
  | { k: 'units'; u: UnitId; n: number }
  | { k: 'art'; id: string }
  | { k: 'ship'; c: ShipClassId };

export interface PassTier {
  /** 1–100. */
  t: number;
  free: PassReward[];
  premium: PassReward[];
}

export interface PassSeasonDef {
  /** 1, 2, … (a season past the authored ones reruns one of them: passSeason). */
  n: number;
  name: Tr;
  theme: Tr;
  /** The milestone pictures of the window (an asset id of the manifest). */
  art: string;
  tiers: PassTier[];
  /** Drafted, not yet final (the owner looks it over before it starts). */
  draft?: boolean;
}

/** The hull of the 100th tier (owner: «можно вывести один из продажи за дублоны и ввести его только в батлпас»): the
 *  Thunderer, a storm frigate of ⚓7, off the doubloon shop since 2026-10-30 (ships.ts `pass`; captains who bought her
 *  keep her). */
export const PASS_SHIP: ShipClassId = 'thunderer';
/** The frame of the super pass alone (owner: «одну рамку можешь так же вывести из продажи и давать только за покупку»):
 *  the Abyssal, off the shop since 2026-10-30 (cosmetics.ts `only`). */
export const SUPER_FRAME = 'frame:abyss';
/** The ownership key of a cosmetic had from the pass alone (cosmetics.ts `only`). */
export const PASS_ONLY = 'spass';
export const SUPER_ONLY = 'spass_super';

/** A second hull of the season when she has one already (sailing or berthed): instead of her, these. */
export const PASS_SHIP_DUP: PassReward[] = [{ k: 'silver', min: 600 }, { k: 'rscroll', n: 5 }, { k: 'scrolls', n: 20 }, { k: 'kit', n: 10 }];

const S = (min: number): PassReward => ({ k: 'silver', min });
const R = (good: BaseRes, n: number): PassReward => ({ k: 'res', good, n });
const SP = (min: number): PassReward => ({ k: 'speed', min });
const MAP = (n = 1): PassReward => ({ k: 'map', n });
const SC = (n: number): PassReward => ({ k: 'scrolls', n });
const KIT = (n: number): PassReward => ({ k: 'kit', n });
const CH = (n: number): PassReward => ({ k: 'charm', n });
const XP = (hours: number): PassReward => ({ k: 'xp', hours });
const WIND = (hours: number): PassReward => ({ k: 'wind', hours });
const PROD = (hours: number): PassReward => ({ k: 'prod', hours });
const RS = (n: number): PassReward => ({ k: 'rscroll', n });
const COS = (key: string): PassReward => ({ k: 'cos', key });
const MEN = (u: UnitId, n: number): PassReward => ({ k: 'units', u, n });
const ART = (id: string): PassReward => ({ k: 'art', id });
const SHIP = (c: ShipClassId): PassReward => ({ k: 'ship', c });

type Row = [number, PassReward[], PassReward[]];
const table = (rows: Row[]): PassTier[] => rows.map(([t, free, premium]) => ({ t, free, premium }));

/** Season 1, «Шторм над Гравуотером» (2026-10-30 — 2026-12-31): the storm's season — the Thunderer and her copper
 *  rods at the top, the Stormcaller's glass and ring at 40 and 80, the storm's wake and titles. Every tier written out. */
const S1: PassSeasonDef = {
  n: 1, art: 'ship.thunderer',
  name: ['Storm over Gravewater', 'Шторм над Гравуотером'],
  theme: ['The storms come in from the deep: lightning over the masts, prizes for those who sail through it.', 'С глубины идут шторма: молнии над мачтами и добыча для тех, кто прорвётся сквозь бурю.'],
  tiers: table([
    [1, [S(10)], [SC(3), XP(2)]],
    [2, [R('timber', 120)], [SP(60)]],
    [3, [SC(1)], [KIT(2)]],
    [4, [S(10)], []],
    [5, [MAP()], [S(20), CH(2)]],
    [6, [R('coal', 80)], [R('iron', 60)]],
    [7, [SP(30)], []],
    [8, [KIT(1)], [SC(3)]],
    [9, [S(12)], [WIND(4)]],
    [10, [R('timber', 150), R('tar', 60)], [RS(1), S(30)]],
    [11, [CH(1)], []],
    [12, [S(12)], [SP(90)]],
    [13, [R('iron', 50)], [KIT(2)]],
    [14, [], [XP(3)]],
    [15, [MAP(), SC(1)], [SC(4)]],
    [16, [S(12)], [PROD(6)]],
    [17, [SP(30)], []],
    [18, [R('provisions', 120)], [CH(3)]],
    [19, [S(14)], [S(25)]],
    [20, [SC(2), R('tar', 80)], [MEN('gunner', 6), COS('title:stormwolf')]],
    [21, [S(14)], []],
    [22, [R('timber', 160)], [SC(3)]],
    [23, [KIT(1)], [XP(3)]],
    [24, [], [R('coal', 120)]],
    [25, [COS('cloth:thunder'), S(15)], [SP(120)]],
    [26, [R('iron', 60)], [KIT(2)]],
    [27, [SP(45)], []],
    [28, [S(15)], [WIND(6)]],
    [29, [CH(1)], [SC(4)]],
    [30, [MAP(), R('coal', 100)], [RS(1), S(35)]],
    [31, [S(16)], []],
    [32, [R('tar', 90)], [PROD(8)]],
    [33, [SC(1)], [CH(3)]],
    [34, [], [XP(4)]],
    [35, [S(16), SP(30)], [R('iron', 90)]],
    [36, [R('timber', 180)], [SC(4)]],
    [37, [KIT(1)], []],
    [38, [S(17)], [SP(120)]],
    [39, [R('provisions', 150)], [KIT(3)]],
    [40, [MAP(), SC(2)], [MEN('bombardier', 6), ART('squall_glass')]],
    [41, [S(18)], []],
    [42, [R('coal', 110)], [S(30)]],
    [43, [SP(45)], [SC(4)]],
    [44, [], [XP(4)]],
    [45, [S(18), CH(1)], [R('tar', 120)]],
    [46, [R('iron', 70)], [WIND(8)]],
    [47, [KIT(1)], []],
    [48, [S(19)], [CH(3)]],
    [49, [R('timber', 200)], [SP(150)]],
    [50, [COS('title:stormborn'), MAP(), S(20)], [RS(2), SC(5)]],
    [51, [S(20)], []],
    [52, [R('tar', 100)], [KIT(3)]],
    [53, [SC(1)], [S(35)]],
    [54, [], [PROD(8)]],
    [55, [S(20), SP(45)], [R('iron', 110)]],
    [56, [R('coal', 120)], [SC(4)]],
    [57, [CH(1)], []],
    [58, [S(21)], [XP(5)]],
    [59, [R('provisions', 180)], [CH(4)]],
    [60, [MAP(), SC(2), R('timber', 200)], [MEN('boarder', 8), COS('trail:storm')]],
    [61, [S(22)], []],
    [62, [R('iron', 80)], [SP(150)]],
    [63, [KIT(1)], [SC(5)]],
    [64, [], [S(40)]],
    [65, [S(22), SP(60)], [R('coal', 160)]],
    [66, [R('tar', 110)], [KIT(3)]],
    [67, [SC(1)], []],
    [68, [S(23)], [WIND(8)]],
    [69, [R('timber', 220)], [XP(5)]],
    [70, [MAP(), R('iron', 90), S(25)], [RS(2), CH(4)]],
    [71, [S(24)], []],
    [72, [R('coal', 130)], [SC(5)]],
    [73, [SP(60)], [PROD(10)]],
    [74, [], [S(40)]],
    [75, [S(25), CH(2)], [R('tar', 150), SP(120)]],
    [76, [R('provisions', 200)], [KIT(3)]],
    [77, [KIT(2)], []],
    [78, [S(26)], [SC(5)]],
    [79, [R('iron', 100)], [XP(6)]],
    [80, [MAP(), SC(3)], [MEN('cutthroat', 6), ART('ring_of_the_gale')]],
    [81, [S(27)], []],
    [82, [R('timber', 240)], [CH(4)]],
    [83, [SP(60)], [S(45)]],
    [84, [], [SC(5)]],
    [85, [S(28), R('tar', 120)], [WIND(10)]],
    [86, [R('coal', 150)], [R('iron', 140)]],
    [87, [CH(2)], []],
    [88, [S(29)], [SP(180)]],
    [89, [R('iron', 110)], [KIT(4)]],
    [90, [MAP(2), SC(3), S(30)], [RS(3), XP(6)]],
    [91, [S(30)], []],
    [92, [R('timber', 260)], [SC(6)]],
    [93, [KIT(2)], [PROD(12)]],
    [94, [], [S(50)]],
    [95, [S(32), SP(90)], [CH(5)]],
    [96, [R('provisions', 240)], [SC(6)]],
    [97, [SC(2)], []],
    [98, [S(34)], [SP(240)]],
    [99, [R('iron', 120), R('coal', 160)], [S(60)]],
    [100, [MAP(2), S(45), SC(5)], [SHIP(PASS_SHIP), COS('title:stormlord')]],
  ]),
};

/** Season 2, «Ледяной прилив» (2027-01-01 — 2027-02-28), DRAFTED: the winter's season — the Drowned Regalia's needle
 *  and coat at 40 and 80, the aurora's wake, the frozen titles. The hull of its 100th tier is the Thunderer again until
 *  the owner names another (a captain who has her takes PASS_SHIP_DUP). Its filler tiers follow the first season's
 *  rhythm (draftFiller); its milestones are written out. */
const S2_MILESTONES: Record<number, { free: PassReward[]; premium: PassReward[] }> = {
  10: { free: [R('timber', 150), R('tar', 60)], premium: [RS(1), S(30)] },
  20: { free: [SC(2), R('tar', 80)], premium: [MEN('gunner', 6), COS('title:icewolf')] },
  25: { free: [COS('cloth:glacier'), S(15)], premium: [SP(120)] },
  30: { free: [MAP(), R('coal', 100)], premium: [RS(1), S(35)] },
  40: { free: [MAP(), SC(2)], premium: [MEN('bombardier', 6), ART('needle_of_the_deep')] },
  50: { free: [COS('title:frostborn'), MAP(), S(20)], premium: [RS(2), SC(5)] },
  60: { free: [MAP(), SC(2), R('timber', 200)], premium: [MEN('boarder', 8), COS('trail:aurora')] },
  70: { free: [MAP(), R('iron', 90), S(25)], premium: [RS(2), CH(4)] },
  80: { free: [MAP(), SC(3)], premium: [MEN('cutthroat', 6), ART('kelp_coat')] },
  90: { free: [MAP(2), SC(3), S(30)], premium: [RS(3), XP(6)] },
  100: { free: [MAP(2), S(45), SC(5)], premium: [SHIP(PASS_SHIP), COS('title:icelord')] },
};
function draftFiller(): PassTier[] {
  return S1.tiers.map((x) => S2_MILESTONES[x.t] ? { t: x.t, ...S2_MILESTONES[x.t] } : { t: x.t, free: x.free.map((r) => ({ ...r })), premium: x.premium.map((r) => ({ ...r })) });
}
const S2: PassSeasonDef = {
  n: 2, art: 'ship.thunderer', draft: true,
  name: ['The Frozen Tide', 'Ледяной прилив'],
  theme: ['Winter grips the northern seas: the drowned stir under the ice, and the aurora lights the way home.', 'Зима сковала северные моря: под льдом шевелятся утопленники, а полярное сияние освещает путь домой.'],
  tiers: draftFiller(),
};

/** The authored seasons, in order. */
export const SEASONS: PassSeasonDef[] = [S1, S2];

/** A season's table: an authored one, or past them a rerun of one (its number its own, its name «Сезон N»). */
export function passSeason(n: number): PassSeasonDef {
  const k = Math.max(1, Math.floor(n));
  const own = SEASONS[k - 1];
  if (own) return own;
  const base = SEASONS[(k - 1) % SEASONS.length];
  return { ...base, n: k, name: [`Season ${k}: ${base.name[0]}`, `Сезон ${k}: ${base.name[1]}`] };
}

export const passTier = (n: number, t: number): PassTier | undefined => passSeason(n).tiers.find((x) => x.t === t);

/** The milestones of the premium track (every 20th tier). */
export const MILESTONES = [20, 40, 60, 80, 100];

// ------------------------------------------------------------------------------------------------ the prices

export type PassKind = 'premium' | 'super';
export type PassProductId = 'pass_premium' | 'pass_super' | 'pass_upgrade';
export interface PassProduct {
  id: PassProductId;
  /** What it leaves her with. */
  grants: PassKind;
  rub: number;
  /** Telegram Stars at the top-up's rate (¾ of a star a rouble's doubloon: premium.ts STARS_PER_DOUBLOON). */
  stars: number;
  /** VK votes at seven roubles a vote (vk.ts votesOf). */
  votes: number;
  name: Tr;
}
const product = (id: PassProductId, grants: PassKind, rub: number, name: Tr): PassProduct => ({ id, grants, rub, stars: Math.round(rub * STARS_PER_DOUBLOON), votes: votesOf(rub), name });

/** «Премиум-пропуск» 790 ₽; «Суперпропуск» 1350 ₽; the step from the first to the second 560 ₽ (the difference). */
export const PASS_PRICES: Record<PassProductId, PassProduct> = {
  pass_premium: product('pass_premium', 'premium', 790, ['Premium Pass', 'Премиум-пропуск']),
  pass_super: product('pass_super', 'super', 1350, ['Super Pass', 'Суперпропуск']),
  pass_upgrade: product('pass_upgrade', 'super', 560, ['Premium to Super Pass', 'Улучшение до Суперпропуска']),
};
export const PASS_PRODUCT_IDS = Object.keys(PASS_PRICES) as PassProductId[];
export const passProduct = (id: unknown): PassProduct | undefined => (typeof id === 'string' && Object.hasOwn(PASS_PRICES, id) ? PASS_PRICES[id as PassProductId] : undefined);

/** Whether a product may be bought by a captain who holds `has` this season (null: nothing yet). */
export function passProductOpen(p: PassProduct, has: PassKind | null): boolean {
  if (p.id === 'pass_upgrade') return has === 'premium';
  if (p.id === 'pass_premium') return has === null;
  return has !== 'super';
}

// ------------------------------------------------------------------------------------------------ the pace model

/** A typical captain's hour of the mixed play, counted by what the pass pays for (tests/balance/xp.ts MIX and PACE at
 *  ⚓5: quests 45% of the time — a job about every 7 minutes with the legs shared, a contract on the way of every
 *  other; boardings 15% — a fight about every 2.6 minutes; creatures 10% and the lairs ashore within exploring; the
 *  island's builders run while she sails; a captain fought one hour in eight; a boss or an event every few hours). */
export const PASS_HOUR: Record<Exclude<PassSource, 'daily' | 'daily_chest' | 'challenge'>, number> = {
  quest: 2.2, story: 0.6, campaign: 0.4, contract: 1.1, board: 2.6, lair: 1.4, pvp: 0.12,
  boss: 0.06, zboss: 0.05, shore: 0.05, event: 0.3, isle: 0.35, treasure: 0.35,
};

/** A model season: every day `hours` of play — what the hour teaches (PASS_HOUR, each source's day capped), the day's
 *  orders and their chest when she plays an hour or more, and the challenges done when the day's (the week's) counts
 *  reach them (rollChallenges of a model account). The season experience at its end and the hours played. */
export function passModel(hoursPerDay: number, days = 61, acc = 7, isle = true): { xp: number; hours: number; tier: number; byDay: number[] } {
  let xp = 0;
  const byDay: number[] = [];
  let week = -1;
  let weekCount: Partial<Record<PassSource, number>> = {};
  let weekDone = new Set<string>();
  for (let d = 0; d < days; d++) {
    const w = Math.floor(d / 7);
    if (w !== week) {
      week = w;
      weekCount = {};
      weekDone = new Set();
    }
    const count: Partial<Record<PassSource, number>> = {};
    for (const [src, rate] of Object.entries(PASS_HOUR) as [PassSource, number][]) {
      const n = rate * hoursPerDay;
      count[src] = n;
      xp += Math.min(n, PASS_CAP[src]) * PASS_XP[src];
    }
    if (hoursPerDay >= 1) {
      count.daily = 3;
      count.daily_chest = 1;
      xp += 3 * PASS_XP.daily + PASS_XP.daily_chest;
    }
    for (const [k, v] of Object.entries(count) as [PassSource, number][]) weekCount[k] = (weekCount[k] ?? 0) + v;
    const sum = (c: ChallengeDef, from: Partial<Record<PassSource, number>>) => c.src.reduce((a, s) => a + (from[s] ?? 0), 0);
    for (const id of rollChallenges(acc, 'day', d, isle)) {
      const c = challengeOf(id)!;
      if (sum(c, count) >= c.need) xp += c.xp;
    }
    for (const id of rollChallenges(acc, 'week', w, isle)) {
      const c = challengeOf(id)!;
      if (!weekDone.has(id) && sum(c, weekCount) >= c.need) {
        weekDone.add(id);
        xp += c.xp;
      }
    }
    byDay.push(xp);
  }
  return { xp, hours: hoursPerDay * days, tier: tierOf(xp).tier, byDay };
}

/** The hours of play a day that close the season in `days` (found by halving), and their sum. */
export function passFullHours(days = 61): { perDay: number; hours: number } {
  let lo = 0, hi = 24;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (passModel(m, days).xp >= PASS_TOTAL_XP) hi = m;
    else lo = m;
  }
  return { perDay: hi, hours: hi * days };
}

// ------------------------------------------------------------------------------------------------ the server's lines

/** Russian forms of the server's lines about the pass (client/src/lang/server.ts). */
export function passPatterns(): [string, string][] {
  return [
    ['Season card: tier {0}!', 'Сезонная карта: ступень {0}!'],
    ['Season card: tier {0}! Rewards are waiting.', 'Сезонная карта: ступень {0}! Награды ждут.'],
    ['Season challenge done: {0} (+{1} season XP).', 'Испытание сезона выполнено: {0} (+{1} опыта сезона).'],
    ['Season card rewards taken: tier {0}.', 'Награды сезонной карты получены: ступень {0}.'],
    ['Season card rewards taken: {0} tiers.', 'Награды сезонной карты получены: ступеней — {0}.'],
    ['Nothing to take yet.', 'Пока нечего забирать.'],
    ['That tier is not reached yet.', 'Эта ступень ещё не открыта.'],
    ['That reward is taken already.', 'Эта награда уже получена.'],
    ['The premium track needs the Premium Pass.', 'Премиум-дорожка открывается Премиум-пропуском.'],
    ['Your locker is full: make room for the artifact first.', 'Сундук артефактов полон: освободите место.'],
    ['Your chest of maps is full: dig one up first.', 'Сундук карт полон: сначала откопайте клад.'],
    ['You already berth {0} ships — sell or take one out first.', 'У причалов уже {0} корабля — продайте или заберите один.'],
    ['Captain level {0} is needed to command her.', 'Чтобы командовать ею, нужен {0}-й уровень капитана.'],
    ['Not in the middle of a fight.', 'Только вне боя.'],
    ['The {0} waits for you in her berth at {1}: take her out at the yard.', '«{0}» ждёт вас у причала в порту {1}: заберите её на верфи.'],
    ['Premium Pass is yours for this season!', 'Премиум-пропуск на этот сезон — ваш!'],
    ['Super Pass is yours for this season: +{0} tiers and the Abyssal frame!', 'Суперпропуск на этот сезон — ваш: +{0} ступеней и рамка «Бездна»!'],
    ['You hold this pass already: its {0} doubloons are on your account.', 'Этот пропуск у вас уже есть: его {0} дубл. зачислены на ваш счёт.'],
    ['The season pass', 'Сезонная карта'],
    ['The season card', 'Сезонная карта'],
    ['Season {0} is over: your rewards', 'Сезон {0} завершён: ваши награды'],
    ['The season «{0}» is over. The rewards you earned and did not take are sent to you: {1}. Silver is in this letter; the rest is already on your account.', 'Сезон «{0}» завершён. Награды, которые вы заработали, но не забрали, отправлены вам: {1}. Серебро — в этом письме, остальное уже на вашем счету.'],
    ['Season card reward: {0}', 'Награда сезонной карты: {0}'],
    ['A new season begins: «{0}». The season card starts again.', 'Начался новый сезон: «{0}». Сезонная карта начинается заново.'],
    ['Season card: +{0} season XP.', 'Сезонная карта: +{0} опыта сезона.'],
    ['Season card: tier {0}.', 'Сезонная карта: ступень {0}.'],
    ['Season card: season {0} begins.', 'Сезонная карта: начинается сезон {0}.'],
    ['Season card: {0} granted to {1}.', 'Сезонная карта: {0} выдан капитану {1}.'],
    ['No such captain.', 'Нет такого капитана.'],
    ['No such account', 'Нет такого счёта'],
    ['Season card: season {0}, tier {1}, {2} season XP, {3}.', 'Сезонная карта: сезон {0}, ступень {1}, опыта сезона — {2}, {3}.'],
    ['Usage: /pass [grant premium|super name|xp N|tier N|season next|reset]', 'Так: /pass [grant premium|super имя|xp N|tier N|season next|reset]'],
    ['free track', 'бесплатная дорожка'],
    ['Premium Pass', 'Премиум-пропуск'],
    ['Super Pass', 'Суперпропуск'],
    ['Premium to Super Pass', 'Улучшение до Суперпропуска'],
    ['Season card reward', 'Награда сезонной карты'],
    ['Men of the season card: a stack of their own. Collect this letter in any port; if there is no room aboard, make room in the Crew window.', 'Бойцы сезонной карты — отдельным отрядом. Заберите письмо в любом порту; если на корабле нет места, освободите его в окне «Команда».'],
    ['The season «{0}» is over. The rewards you earned and did not take are sent to you: {1}. Silver is in this letter; the rest is already on your account.', 'Сезон «{0}» завершён. Награды, которые вы заработали, но не забрали, отправлены вам: {1}. Серебро — в этом письме, остальное уже на вашем счету.'],
    ['No room aboard: dismiss someone in the Crew window to take them.', 'Нет места на корабле — увольте кого-нибудь в окне «Команда», чтобы их забрать.'],
    // the seasons' names and the challenges as the toasts fill them (their {n})
    ...[1, 2].flatMap((n) => { const x = passSeason(n); return [[x.name[0], x.name[1]] as [string, string]]; }),
    ...CHALLENGES.map((c) => [c.text[0].replace('{n}', String(c.need)), c.text[1].replace('{n}', String(c.need))] as [string, string]),
  ];
}
