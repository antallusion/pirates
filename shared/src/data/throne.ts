// The Throne of the Sea, part 1 (docs/19 E1–E3): the first layer past the cap (MAX_LEVEL).
//
//  E1. Glory. Past level 60 her experience flows into endless ranks of glory, each a little dearer than the last
//      (GLORY_RISE a rank). Every rank lets her choose a small boon: +1% to the effect of one of her four primaries
//      (Attack: her blows and shots; Defence: what her stacks take; Power: her orders; Will: her stores of will and
//      stamina), each up to GLORY_CAP. Every fifth rank is a point of mastery.
//  E2. Mastery. A tree of four branches — Admiral (the fleet and the broadsides), Boarder (the stacks in the boarding),
//      Mystic (orders, will, stamina), Merchant (the economy at sea and in the town) — seven nodes each, some of two
//      ranks; a node of the second tier wants two points in its branch, of the third five. Their sea side speaks the
//      talents' stat vocabulary (and shares the talents' caps, docs/03 §3.3); their battle side lies on the hero in the
//      boarding battle, as her skills' does. The Grandmaster rank of the secondary skills is in hero.ts (GM_RANK).
//  E3. Trials of mastery. A skill at expert rises to grandmaster only by beating, in the boarding battle, the legend who
//      mastered it: a hero of the cap with her path's book and the skill at grandmaster, and an army a share above hers.
//      One trial a skill; a lost one waits TRIAL_WAIT before the next; the first won is a line in the sea's chronicle.
//
// Balance (docs/19 E17, glory against might): a captain of glory 100 with every battle boon and node and her battle
// skills at grandmaster wins at most 65% against a fresh captain of the cap (tools/balance-glory.ts,
// tests/throne.test.ts); the endgame's battle lift is held under ENDGAME_CAP whatever is stacked.

import type { SealView } from './seals.ts';
import type { RaidView } from './abyssraid.ts';
import { MAX_LEVEL, xpForLevel } from '../constants.ts';
import type { CaptainId } from './captains.ts';
import type { PrimId, Prims, SkillId } from './hero.ts';
import type { StatMods } from './stats.ts';

const T = (en: string, ru: string): [string, string] => [en, ru];

// ------------------------------------------------------------------ E1. glory

/** Experience from one rank of glory to the next: GLORY_SHARE of the cap's own step (docs/26: the curve's last levels
 *  ask some ten hours each; a rank of glory about five at first, ten by the hundredth), a hundredth dearer each rank
 *  (rank 100 asks twice the first; ranks 1–100 are about six and a half times the road from level 1 to the cap). */
export const GLORY_SHARE = 0.45;
export const GLORY_BASE = Math.round((xpForLevel(MAX_LEVEL) * GLORY_SHARE) / 1000) * 1000;
export const GLORY_RISE = 0.01;
export function gloryXp(rank: number): number {
  return Math.round(GLORY_BASE * (1 + Math.max(0, rank) * GLORY_RISE));
}
/** A rank's boon: this share more of one primary's effect, each primary up to GLORY_CAP boons. */
export const GLORY_STEP = 0.01;
export const GLORY_CAP = 3;
/** Every fifth rank of glory is a point of mastery. */
export const MASTERY_EVERY = 5;
export const masteryPoints = (rank: number): number => Math.floor(Math.max(0, rank) / MASTERY_EVERY);

export const GLORY_TEXT: Record<PrimId, [string, string]> = {
  atk: T('Your blows and shots in a boarding +1%.', 'Ваши удары и выстрелы в абордаже +1%.'),
  def: T('Your stacks take 1% less in a boarding.', 'Ваши отряды получают на 1% меньше урона в абордаже.'),
  pow: T('Every order of yours +1%.', 'Каждый ваш приказ +1%.'),
  will: T('Your stores of will and stamina +1%.', 'Ваши запасы воли и выносливости +1%.'),
};

/** The boons she has chosen, a primary each (absent: none). */
export type GloryPicks = Partial<Prims>;
/** Boons still to choose: one a rank, until every primary is at its cap. */
export function gloryPending(rank: number, picks: GloryPicks): number {
  const made = (['atk', 'def', 'pow', 'will'] as PrimId[]).reduce((n, k) => n + Math.min(GLORY_CAP, picks[k] ?? 0), 0);
  return Math.max(0, Math.min(Math.max(0, rank), 4 * GLORY_CAP) - made);
}

// ------------------------------------------------------------------ E2. mastery

export type Branch = 'admiral' | 'boarder' | 'mystic' | 'merchant';
export const BRANCHES: Branch[] = ['admiral', 'boarder', 'mystic', 'merchant'];
export const BRANCH_NAMES: Record<Branch, [string, string]> = {
  admiral: T('Admiral', 'Адмирал'), boarder: T('Boarder', 'Абордажник'), mystic: T('Mystic', 'Мистик'), merchant: T('Merchant', 'Купец'),
};
export const BRANCH_TEXT: Record<Branch, [string, string]> = {
  admiral: T('The fleet and the broadsides.', 'Флот и бортовые залпы.'),
  boarder: T('The stacks in the boarding.', 'Отряды в абордаже.'),
  mystic: T('Orders, will and stamina.', 'Приказы, воля и выносливость.'),
  merchant: T('The economy at sea and in the town.', 'Хозяйство в море и в городе.'),
};
export const BRANCH_ICON: Record<Branch, string> = { admiral: 'tree_gunnery', boarder: 'tree_boarding', mystic: 'tree_abyssal', merchant: 'tree_trade' };
/** A tier's nodes want this many points already in their branch. */
export const TIER_NEED = [0, 0, 2, 5];

/** What a rank of a node does in the boarding battle (on her hero, as her skills' figures). */
export interface BattleFx {
  melee?: number;
  shot?: number;
  taken?: number;
  morale?: number;
  luck?: number;
  init1?: number;
  raise?: number;
  /** Every order this share stronger; her orders' will and stamina this share cheaper. */
  orders?: number;
  cost?: number;
  /** Her stores of will and stamina this share deeper. */
  will?: number;
  stam?: number;
  /** Her path's innate move and ultimate this share stronger. */
  innate?: number;
}
/** What a rank does elsewhere: her sea orders' will, the will a day brings, the silver of a dwelling's men. */
export interface OtherFx {
  seaCost?: number;
  willDay?: number;
  recruit?: number;
}

export interface MasteryNode {
  id: string;
  branch: Branch;
  tier: 1 | 2 | 3;
  max: number;
  icon: string;
  name: [string, string];
  /** What each rank does. */
  text: [string, string];
  sea?: StatMods;
  battle?: BattleFx;
  other?: OtherFx;
}

const N = (id: string, branch: Branch, tier: 1 | 2 | 3, max: number, icon: string, name: [string, string], text: [string, string], fx: Pick<MasteryNode, 'sea' | 'battle' | 'other'>): MasteryNode => ({ id, branch, tier, max, icon, name, text, ...fx });

export const MASTERY: MasteryNode[] = [
  // Admiral: the fleet and the broadsides (her sea side, within the talents' caps).
  N('adm_broadside', 'admiral', 1, 2, 'bt_volley', T('Weight of metal', 'Вес залпа'), T('Guns +2% a rank.', 'Орудия +2% за ранг.'), { sea: { gunDamageMul: 0.02 } }),
  N('adm_drill', 'admiral', 1, 2, 'ab_double_shot', T('Gun drill', 'Орудийная муштра'), T('Reload 2% quicker a rank.', 'Перезарядка на 2% быстрее за ранг.'), { sea: { reloadMul: -0.02 } }),
  N('adm_long', 'admiral', 2, 1, 'tree_gunnery', T('Long nines', 'Длинные девятифунтовки'), T('Gun range +4%.', 'Дальность орудий +4%.'), { sea: { rangeMul: 0.04 } }),
  N('adm_grape', 'admiral', 2, 1, 'ab_admiralty_barrage', T('Grape and canister', 'Картечь и картуши'), T('Shot kills 6% more of her men.', 'Ядра и картечь выбивают на 6% больше людей.'), { sea: { crewKillMul: 0.06 } }),
  N('adm_chain', 'admiral', 2, 1, 'ab_hard_over', T('Chain and bar', 'Книппели'), T('Her canvas takes 6% more.', 'Её паруса получают на 6% больше.'), { sea: { sailDamageMul: 0.06 } }),
  N('adm_squadron', 'admiral', 3, 1, 'bt_officers', T('Squadron', 'Эскадра'), T('Escorts’ upkeep −10%.', 'Содержание конвоя −10%.'), { sea: { fleetLogistics: 0.5 } }),
  N('adm_line', 'admiral', 3, 1, 'bt_captain', T('Line of battle', 'Линия баталии'), T('Shooters in a boarding +1%; guns +1%.', 'Стрелки в абордаже +1%; орудия +1%.'), { sea: { gunDamageMul: 0.01 }, battle: { shot: 0.01 } }),
  // Boarder: the stacks in the boarding.
  N('brd_cutlass', 'boarder', 1, 2, 'bt_charge', T('Cutlass drill', 'Выучка абордажной саблей'), T('Melee blows in a boarding +1% a rank.', 'Удары в рукопашной +1% за ранг.'), { battle: { melee: 0.01 } }),
  N('brd_muskets', 'boarder', 1, 2, 'bt_grenades', T('Muskets on the rail', 'Мушкеты у борта'), T('Shooters in a boarding +1% a rank.', 'Стрелки в абордаже +1% за ранг.'), { battle: { shot: 0.01 } }),
  N('brd_hold', 'boarder', 2, 2, 'ab_smoke_pots', T('Hold the deck', 'Удержать палубу'), T('Your stacks take 1% less a rank.', 'Ваши отряды получают на 1% меньше урона за ранг.'), { battle: { taken: 0.01 } }),
  N('brd_nerve', 'boarder', 2, 1, 'ab_war_cry', T('Iron nerve', 'Железные нервы'), T('Morale +1 in a boarding.', 'Боевой дух +1 в абордаже.'), { battle: { morale: 1 } }),
  N('brd_luck', 'boarder', 2, 1, 'coin', T('Lucky blade', 'Счастливый клинок'), T('Luck +1 in a boarding.', 'Удача +1 в абордаже.'), { battle: { luck: 1 } }),
  N('brd_first', 'boarder', 3, 1, 'ab_red_hook_boarding', T('First over the rail', 'Первым через борт'), T('Melee blows and shots in a boarding +1%; boarding power +3%.', 'Удары и выстрелы в абордаже +1%; сила абордажа +3%.'), { sea: { boardingPower: 0.03 }, battle: { melee: 0.01, shot: 0.01 } }),
  N('brd_surgeons', 'boarder', 3, 1, 'prof_surgeon', T('Surgeons below', 'Лекари в трюме'), T('After a boarding 5 in a hundred more of your fallen stand again.', 'После абордажа ещё 5 из сотни павших встают на ноги.'), { battle: { raise: 0.05 } }),
  // Mystic: orders, will and stamina.
  N('mys_well', 'mystic', 1, 2, 'ab_brine_mend', T('Deep well', 'Глубокий колодец'), T('Your store of will +5% a rank.', 'Запас воли +5% за ранг.'), { battle: { will: 0.05 } }),
  N('mys_wind', 'mystic', 1, 2, 'ab_storm_chaser', T('Second wind', 'Второе дыхание'), T('Your stamina +5% a rank.', 'Выносливость +5% за ранг.'), { battle: { stam: 0.05 } }),
  N('mys_sharp', 'mystic', 2, 2, 'bt_captain', T('Sharp orders', 'Чёткие приказы'), T('Every order +1% a rank.', 'Каждый приказ +1% за ранг.'), { battle: { orders: 0.01 } }),
  N('mys_thrift', 'mystic', 2, 1, 'ab_mark_target', T('Thrift', 'Бережливость'), T('Battle orders cost 5% less.', 'Боевые приказы на 5% дешевле.'), { battle: { cost: 0.05 } }),
  N('mys_sea', 'mystic', 2, 1, 'ab_trim_sails', T('Sea witch', 'Морская ведьма'), T('Sea orders cost 15% less.', 'Морские приказы на 15% дешевле.'), { other: { seaCost: 0.15 } }),
  N('mys_tide', 'mystic', 3, 1, 'ab_undertow', T('Tide of will', 'Прилив воли'), T('A day at sea brings 20% more will.', 'За день в море воли прибывает на 20% больше.'), { other: { willDay: 0.2 } }),
  N('mys_echo', 'mystic', 3, 1, 'ab_deep_call', T('Echo of the path', 'Эхо пути'), T('Your path’s innate move and ultimate +3%.', 'Сила пути и высший приём +3%.'), { battle: { innate: 0.03 } }),
  // Merchant: the economy at sea and in the town.
  N('mer_haggle', 'merchant', 1, 2, 'tree_trade', T('Haggler', 'Торгаш'), T('Buy 1% cheaper and sell 1% dearer a rank.', 'Покупка на 1% дешевле и продажа на 1% дороже за ранг.'), { sea: { buyMul: -0.01, sellMul: 0.01 } }),
  N('mer_hold', 'merchant', 1, 2, 'mod_hold_expansion', T('Deep holds', 'Глубокие трюмы'), T('Hold +3% a rank.', 'Трюм +3% за ранг.'), { sea: { holdVolume: 0.03 } }),
  N('mer_duty', 'merchant', 2, 1, 'item_signet', T('Friend of the customs', 'Друг таможни'), T('Port duties −10%.', 'Портовые пошлины −10%.'), { sea: { dutyMul: -0.1 } }),
  N('mer_wages', 'merchant', 2, 1, 'coin', T('Fair shares', 'Честная доля'), T('Wages −10%.', 'Жалованье −10%.'), { sea: { wages: -0.1 } }),
  N('mer_stores', 'merchant', 2, 1, 'good_provisions', T('Dry stores', 'Сухие кладовые'), T('Goods spoil 20% slower.', 'Товары портятся на 20% медленнее.'), { sea: { spoilage: -0.2 } }),
  N('mer_recruit', 'merchant', 3, 1, 'build_residents_house', T('Recruiter’s purse', 'Кошель вербовщика'), T('Men from the dwellings of ports and of your town cost 5% less silver.', 'Бойцы из жилищ портов и вашего города на 5% дешевле серебром.'), { other: { recruit: 0.05 } }),
  N('mer_nose', 'merchant', 3, 1, 'talent_exp_keen_spyglass', T('Nose for gold', 'Нюх на золото'), T('Treasure finds +10%.', 'Находки кладов +10%.'), { sea: { treasureHunter: 0.1 } }),
];
export const MASTERY_BY_ID: Record<string, MasteryNode> = Object.fromEntries(MASTERY.map((n) => [n.id, n]));
export const MASTERY_RANKS = MASTERY.reduce((n, x) => n + x.max, 0);

export type MasteryRanks = Record<string, number>;
export const masterySpent = (m: MasteryRanks): number => Object.entries(m).reduce((n, [id, r]) => n + (MASTERY_BY_ID[id] ? Math.max(0, Math.min(MASTERY_BY_ID[id].max, r)) : 0), 0);
export const branchPoints = (m: MasteryRanks, b: Branch): number => MASTERY.filter((x) => x.branch === b).reduce((n, x) => n + Math.min(x.max, m[x.id] ?? 0), 0);

/** Why she cannot take a rank of a node now (null: she can). */
export function masteryWhy(m: MasteryRanks, points: number, id: string): string | null {
  const n = MASTERY_BY_ID[id];
  if (!n) return 'No such node';
  if ((m[id] ?? 0) >= n.max) return 'That node is whole';
  if (points - masterySpent(m) <= 0) return 'No point of mastery to spend';
  if (branchPoints(m, n.branch) < TIER_NEED[n.tier]) return `It wants ${TIER_NEED[n.tier]} points in its branch first`;
  return null;
}

/** Her mastery's sea mods (in the talents' vocabulary: they share the talents' caps). */
export function masterySea(m: MasteryRanks): StatMods {
  const out: StatMods = {};
  for (const n of MASTERY) {
    const r = Math.min(n.max, m[n.id] ?? 0);
    if (!r || !n.sea) continue;
    for (const [k, v] of Object.entries(n.sea) as [keyof StatMods, number][]) out[k] = (out[k] ?? 0) + v * r;
  }
  return out;
}

function sumFx<K extends 'battle' | 'other'>(m: MasteryRanks, key: K): Required<NonNullable<MasteryNode[K]>> {
  const out: Record<string, number> = {};
  for (const n of MASTERY) {
    const r = Math.min(n.max, m[n.id] ?? 0);
    const fx = n[key] as Record<string, number> | undefined;
    if (!r || !fx) continue;
    for (const [k, v] of Object.entries(fx)) out[k] = (out[k] ?? 0) + v * r;
  }
  return out as Required<NonNullable<MasteryNode[K]>>;
}
export const masteryOther = (m: MasteryRanks): OtherFx => sumFx(m, 'other');

// ------------------------------------------------------------------ glory and mastery on the hero

/** The endgame's lift of her blows, shots and armour in a boarding is held under this, whatever is stacked
 *  (glory boons, nodes): so the cap and far past it stay one game. */
export const ENDGAME_CAP = { melee: 0.03, shot: 0.03, taken: 0.02, orders: 0.05 };

/** What glory and mastery add to her hero in the boarding battle, on top of her skills and artifacts. */
export interface ThroneLift {
  melee: number;
  shot: number;
  taken: number;
  morale: number;
  luck: number;
  init1: number;
  raise: number;
  orders: number;
  cost: number;
  will: number;
  stam: number;
  innate: number;
}
export function throneLift(picks: GloryPicks, m: MasteryRanks): ThroneLift {
  const b = sumFx(m, 'battle') as BattleFx;
  const g = (k: PrimId) => Math.min(GLORY_CAP, Math.max(0, picks[k] ?? 0)) * GLORY_STEP;
  return {
    melee: Math.min(ENDGAME_CAP.melee, g('atk') + (b.melee ?? 0)),
    shot: Math.min(ENDGAME_CAP.shot, g('atk') + (b.shot ?? 0)),
    taken: Math.min(ENDGAME_CAP.taken, g('def') + (b.taken ?? 0)),
    morale: b.morale ?? 0,
    luck: b.luck ?? 0,
    init1: b.init1 ?? 0,
    raise: b.raise ?? 0,
    orders: Math.min(ENDGAME_CAP.orders, g('pow') + (b.orders ?? 0)),
    cost: b.cost ?? 0,
    will: g('will') + (b.will ?? 0),
    stam: g('will') + (b.stam ?? 0),
    innate: b.innate ?? 0,
  };
}

// ------------------------------------------------------------------ E3. trials of mastery

/** A lost trial waits this long (world seconds: three hours) before the legend will fight her again. */
export const TRIAL_WAIT = 3 * 3600;
/** The legend's army: hers, a share stronger in every stack (above yours, docs/19 E3) — at least this much, and as
 *  much more as her legend's path and skills need for a trial the fresh captain of the cap wins about TRIAL_TARGET of
 *  the time by auto-battle (each legend's `men`, calibrated by tools/balance-glory.ts --calibrate). */
export const TRIAL_MEN = 1.02;
export const TRIAL_TARGET = 0.3;
/** The legend's primaries over hers, each. */
export const TRIAL_PRIM = 2;

export interface Legend {
  skill: SkillId;
  name: [string, string];
  /** Her ship's name. */
  ship: [string, string];
  path: CaptainId;
  /** Her two other skills at expert (beside the trial's at grandmaster). */
  also: [SkillId, SkillId];
  /** Her army over the challenger's (calibrated, never under TRIAL_MEN). */
  men: number;
}

const Lg = (skill: SkillId, name: [string, string], ship: [string, string], path: CaptainId, also: [SkillId, SkillId], men: number): Legend => ({ skill, name, ship, path, also, men: Math.max(TRIAL_MEN, men) });

/** The legend of each skill: who mastered it before her (their faces are their paths' portraits). */
export const LEGENDS: Record<SkillId, Legend> = {
  navigation: Lg('navigation', T('Hollis Wake, the Windreader', 'Холлис Уэйк, Читающий Ветер'), T('Last Bearing', 'Последний Пеленг'), 'navigator', ['tactics', 'leadership'], 1.02),
  artillery: Lg('artillery', T('Mother Cinder', 'Матушка Зола'), T('Ninety Guns', 'Девяносто Пушек'), 'smuggler', ['armor', 'boarding'], 1.06),
  boarding: Lg('boarding', T('Grim Halloran', 'Мрачный Хэллоран'), T('Red Ladder', 'Красный Трап'), 'reaver', ['armor', 'leadership'], 1.27),
  armor: Lg('armor', T('Iron Abbess Morwen', 'Железная аббатиса Морвен'), T('Unbroken', 'Несломленная'), 'admiral', ['boarding', 'tactics'], 1.27),
  tactics: Lg('tactics', T('Commodore Vane', 'Коммодор Вейн'), T('Long Patience', 'Долгое Терпение'), 'admiral', ['artillery', 'armor'], 1.15),
  leadership: Lg('leadership', T('Old Saint Gideon', 'Старый Святой Гидеон'), T('Brotherhood', 'Братство'), 'admiral', ['boarding', 'armor'], 1.27),
  luck: Lg('luck', T('Lucky Bess Tarrow', 'Счастливица Бесс Тэрроу'), T('Double Six', 'Две Шестёрки'), 'smuggler', ['artillery', 'tactics'], 1.07),
  logistics: Lg('logistics', T('Quartermaster Ashby', 'Квартирмейстер Эшби'), T('Full Larder', 'Полная Кладовая'), 'navigator', ['boarding', 'armor'], 1.02),
  scouting: Lg('scouting', T('Silent Mara', 'Безмолвная Мара'), T('Far Eye', 'Дальний Глаз'), 'smuggler', ['artillery', 'leadership'], 1.08),
  trading: Lg('trading', T('Factor Lisbet Crane', 'Фактор Лисбет Крейн'), T('Golden Scale', 'Золотые Весы'), 'admiral', ['armor', 'artillery'], 1.27),
  first_aid: Lg('first_aid', T('Doctor Thessaly Rook', 'Доктор Тессали Рук'), T('Mercy', 'Милосердие'), 'drowned', ['armor', 'leadership'], 1.05),
  mysticism: Lg('mysticism', T('The Pale Cantor', 'Бледный Кантор'), T('Hymn Below', 'Гимн Глубин'), 'drowned', ['leadership', 'tactics'], 1.05),
};

// ------------------------------------------------------------------ what she sees

export interface TrialView {
  skill: SkillId;
  /** Her rank in the skill now (0: not had). */
  rank: number;
  state: 'locked' | 'ready' | 'wait' | 'won';
  /** World seconds until the legend fights her again (state 'wait'). */
  wait?: number;
  tries: number;
}

export interface GloryView {
  /** Level 60 reached: the Throne is open. */
  open: boolean;
  rank: number;
  xp: number;
  need: number;
  picks: Prims;
  pending: number;
  points: number;
  spent: number;
  nodes: MasteryRanks;
  trials: TrialView[];
  /** Silver to forget her mastery (in port). */
  reset: number;
  /** What glory and mastery add in a boarding now. */
  lift: ThroneLift;
  /** A trial under way (its skill). */
  fighting?: SkillId;
  /** docs/19 E9: her seal of the deep. */
  seal?: SealView;
  /** docs/19 E11: her raid of the Abyss. */
  raid?: RaidView;
}

/** Silver to forget the mastery tree in a port: a thousand a point spent. */
export const resetCost = (spent: number): number => 1000 * Math.max(0, spent);

/** The server's words of the Throne, English → Russian (names the sentences carry). */
export function thronePatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const n of MASTERY) out.push(n.name);
  for (const b of BRANCHES) out.push(BRANCH_NAMES[b]);
  for (const l of Object.values(LEGENDS)) out.push(l.name, l.ship);
  return out;
}
