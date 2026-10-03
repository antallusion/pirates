// The captain as a hero of Heroes of Might and Magic III, only pirate (docs/17 H2): the ship is the army, the captain
// the hero, the boarding the battle.
//
//  6. Four primary skills — Attack, Defense, Power of Orders and Will. Each level-up adds one, drawn by the captain's
//     path (the corsair leans to Attack, the Drowned to Power…); a captain from before them is grown the same way from
//     her level, on her own seed, so the numbers never depend on the sea's dice. Attack and Defense go onto every stack
//     of hers in the boarding battle (HoMM3: ±5% a point of difference, capped by the battle's own cap); Power scales
//     her orders; Will is her store of them (ten points a point).
//  7. Twelve secondary skills in eight slots, basic → advanced → expert, one of two offered at each level. They are a
//     layer of their own beside the talent trees: each is kin to one tree (its offers come more often the more of her
//     points are in that tree, and more still in her path's favoured trees), its sea side speaks the talents' own stat
//     vocabulary and shares their caps (docs/03 §3.3), and its battle side lives in the boarding battle. Talents are not
//     touched: a build keeps every point.
//  8. The order book: four schools (Fire and powder, Wind, Water and the deep, Steel and men), levels 1–5, twenty
//     orders to learn (the H1 book's four and the grenades among the first) and the six captains' own. They cost Will;
//     sea orders are cast from the HUD, battle orders once a round from the side panel. Each school's kin skill (Fire —
//     Artillery, Wind — Navigation, Water — First Aid, Steel — Leadership) makes its orders stronger and cheaper, and
//     Deep Mysticism makes all of them stronger, fills Will faster and opens the higher levels (HoMM3's Wisdom and
//     Mysticism in one). Learnt at the guilds of orders in some ports (each with its set list) and at the drowned
//     shrines on the islands (each teaches one). Twenty more common pages after docs/18 (owner, 2026-10-03) over all
//     six schools, taught the same ways (shared/src/data/paths.ts, BOOK_PAGES): theirs in the physical schools spend
//     Stamina.
//
// Artifacts (item 9) are in shared/src/data/artifacts.ts.

import type { ArtTotals } from './artifacts.ts';
import type { CaptainId } from './captains.ts';
import type { StatMods } from './stats.ts';
import type { TreeId } from './talents.ts';
import { TAC_BOOK } from './tactical.ts';
import type { TacSpellId } from './tactical.ts';
import { Rng } from '../rng.ts';
import {
  BOOK_PAGES, BOOK_PAGE_IDS, FOREIGN_COST, HOME_COST, HOME_MUL, PATH_PAGES, PATH_PAGE_IDS, PATH_SCHOOL, SCHOOL_KIND, STAM_ROUND, ULT_LEVEL, isBookPage, isPathPage, pathPagesAt, pathPatterns,
  stamMaxOf, talentBook,
} from './paths.ts';
import type { PathPageId, School } from './paths.ts';
export type { School } from './paths.ts';

// ------------------------------------------------------------------ 6. primary skills

export type PrimId = 'atk' | 'def' | 'pow' | 'will';
export const PRIMS: PrimId[] = ['atk', 'def', 'pow', 'will'];
export type Prims = Record<PrimId, number>;

export const PRIM_NAMES: Record<PrimId, [string, string]> = {
  atk: ['Attack', 'Атака'], def: ['Defense', 'Защита'], pow: ['Power of Orders', 'Сила приказов'], will: ['Will', 'Воля'],
};
export const PRIM_TEXT: Record<PrimId, [string, string]> = {
  atk: ['Added to the attack of every stack of yours in a boarding: 5% more damage for each point above the foe\'s defence.', 'Прибавляется к атаке каждого вашего отряда в абордаже: +5% урона за каждое очко сверх защиты врага.'],
  def: ['Added to the defence of every stack of yours in a boarding: 5% less damage for each point above the foe\'s attack.', 'Прибавляется к защите каждого вашего отряда в абордаже: −5% урона за каждое очко сверх атаки врага.'],
  pow: ['Every order strikes, heals and holds harder: +4% a point.', 'Каждый приказ бьёт, лечит и держится сильнее: +4% за очко.'],
  will: ['The store of orders: ten points of will for each point.', 'Запас приказов: десять единиц воли за каждое очко.'],
};
/** The painted mark of each (existing art). */
export const PRIM_ICON: Record<PrimId, string> = { atk: 'tree_boarding', def: 'mod_hull_plating', pow: 'bt_captain', will: 'ab_brine_mend' };

export const zeroPrims = (): Prims => ({ atk: 0, def: 0, pow: 0, will: 0 });

/** Each path's start (six points, as a HoMM3 class). */
export const PRIM_BASE: Record<CaptainId, Prims> = {
  corsair: { atk: 2, def: 2, pow: 1, will: 1 },
  smuggler: { atk: 1, def: 1, pow: 2, will: 2 },
  reaver: { atk: 3, def: 1, pow: 1, will: 1 },
  navigator: { atk: 1, def: 1, pow: 2, will: 2 },
  drowned: { atk: 0, def: 1, pow: 3, will: 2 },
  admiral: { atk: 1, def: 3, pow: 1, will: 1 },
};
/** The odds of each primary at a level-up, by path (per cent). Calibrated so that captains of a level stay even in a
 *  boarding whatever their paths (tests/hero.test.ts). */
export const PRIM_WEIGHTS: Record<CaptainId, Prims> = {
  corsair: { atk: 30, def: 30, pow: 20, will: 20 },
  smuggler: { atk: 25, def: 30, pow: 30, will: 15 },
  reaver: { atk: 40, def: 30, pow: 20, will: 10 },
  navigator: { atk: 25, def: 30, pow: 30, will: 15 },
  drowned: { atk: 20, def: 25, pow: 40, will: 15 },
  admiral: { atk: 25, def: 40, pow: 20, will: 15 },
};

/** Her own seed, from when she first took command and her path (the same captain grows the same way). */
export function heroSeed(createdAt: number, captain: CaptainId): number {
  let h = (Math.floor(Math.abs(createdAt)) % 2147483647) ^ 0x4e7a2b19;
  for (let i = 0; i < captain.length; i++) h = Math.imul(h ^ captain.charCodeAt(i), 16777619);
  return h >>> 0;
}

const lvRng = (seed: number, lv: number, salt: number) => new Rng((seed ^ Math.imul(lv, 0x9e3779b1) ^ salt) >>> 0);

/** The primary a level-up adds (`lv` the level reached): her path's odds on her own seed. */
export function primOfLevel(captain: CaptainId, seed: number, lv: number): PrimId {
  const w = PRIM_WEIGHTS[captain];
  return lvRng(seed, lv, 0x51).weighted(PRIMS.map((k) => [k, w[k]] as const));
}

/** Her primaries as grown from level `from` + 1 to `to` onto `start` (the migration and each level-up). */
export function growPrims(start: Prims, captain: CaptainId, seed: number, from: number, to: number): Prims {
  const out = { ...start };
  for (let lv = Math.max(2, from + 1); lv <= to; lv++) out[primOfLevel(captain, seed, lv)]++;
  return out;
}

/** A captain of `level` on her path grown from the start. */
export function primsAtLevel(captain: CaptainId, seed: number, level: number): Prims {
  return growPrims(PRIM_BASE[captain], captain, seed, 1, level);
}

/** The Power a sea captain gains a level (docs/18: a share more than H2's 0.24, against the paths' books). */
export const SEA_POW = 0.3;
/** A sea captain's (an NPC's) primaries for her ship's level: an even hand of the points a player of that band has. */
export function npcPrims(shipLevel: number): Prims {
  const lv = npcHeroLevel(shipLevel);
  const n = lv - 1;
  return { atk: 2 + Math.round(n * 0.28), def: 2 + Math.round(n * 0.28), pow: 1 + Math.round(n * SEA_POW), will: 1 + Math.round(n * 0.2) };
}
/** The captain's level a ship of this level answers to (captain gear runs a level band of six a ship level). */
export function npcHeroLevel(shipLevel: number): number {
  return Math.max(1, Math.min(60, Math.round(shipLevel) * 6 - 2));
}

/** Ten points of will a point of Will (HoMM3's knowledge). */
export const WILL_MANA = 10;
export function manaMaxOf(will: number): number {
  return WILL_MANA * Math.max(0, Math.round(will));
}
/** A day at sea (48 minutes) fills this share of the store; Deep Mysticism and the Drowned Regalia more. */
export const WILL_DAY = 0.25;
/** A port fills half of it, a port with a guild of orders all of it, a shrine or a spring all of it. */
export const WILL_PORT = 0.5;

// ------------------------------------------------------------------ 7. secondary skills

export type SkillId = 'navigation' | 'artillery' | 'boarding' | 'armor' | 'tactics' | 'leadership' | 'luck' | 'logistics' | 'scouting' | 'trading' | 'first_aid' | 'mysticism';
export const SKILL_IDS: SkillId[] = ['navigation', 'artillery', 'boarding', 'armor', 'tactics', 'leadership', 'luck', 'logistics', 'scouting', 'trading', 'first_aid', 'mysticism'];
export const SKILL_SLOTS = 8;
export const SKILL_MAX = 3;
/** docs/19 E2: the fourth rank above expert (HoMM3 HotA's grandmaster), won only in a trial (E3), never at a level. */
export const GM_RANK = 4;
export type SkillRank = 1 | 2 | 3 | 4;
export interface SkillSlot {
  id: SkillId;
  r: SkillRank;
}

export const RANK_NAMES: [string, string][] = [['Basic', 'Базовый'], ['Advanced', 'Продвинутый'], ['Expert', 'Эксперт'], ['Grandmaster', 'Грандмастер']];

export interface SkillDef {
  id: SkillId;
  name: [string, string];
  icon: string;
  /** Its kin among the talent trees: more points there, the more often it is offered. */
  tree: TreeId;
  /** What each rank does (basic, advanced, expert). */
  text: [[string, string], [string, string], [string, string]];
}

const T = (en: string, ru: string): [string, string] => [en, ru];

export const SKILLS: Record<SkillId, SkillDef> = {
  navigation: { id: 'navigation', name: ['Navigation', 'Навигация'], icon: 'tree_navigation', tree: 'navigation', text: [
    T('Turning +5%, closer to the wind by 2°; Wind orders +15%.', 'Поворот +5%, круче к ветру на 2°; приказы Ветра +15%.'),
    T('Turning +10%, closer to the wind by 4°; Wind orders +30%.', 'Поворот +10%, круче к ветру на 4°; приказы Ветра +30%.'),
    T('Turning +15%, closer to the wind by 6°; Wind orders +50%.', 'Поворот +15%, круче к ветру на 6°; приказы Ветра +50%.')] },
  artillery: { id: 'artillery', name: ['Artillery', 'Артиллерия'], icon: 'tree_gunnery', tree: 'gunnery', text: [
    T('Guns +4%, reload −3%; shooters in a boarding +10%; Fire orders +15%.', 'Орудия +4%, перезарядка −3%; стрелки в абордаже +10%; приказы Огня +15%.'),
    T('Guns +8%, reload −6%; shooters in a boarding +20%; Fire orders +30%.', 'Орудия +8%, перезарядка −6%; стрелки в абордаже +20%; приказы Огня +30%.'),
    T('Guns +12%, reload −9%; shooters in a boarding +30%; Fire orders +50%.', 'Орудия +12%, перезарядка −9%; стрелки в абордаже +30%; приказы Огня +50%.')] },
  boarding: { id: 'boarding', name: ['Boarding', 'Абордаж'], icon: 'bt_charge', tree: 'boarding', text: [
    T('Melee blows in a boarding +10%; boarding power +5%.', 'Удары в рукопашной +10%; сила абордажа +5%.'),
    T('Melee blows in a boarding +20%; boarding power +10%.', 'Удары в рукопашной +20%; сила абордажа +10%.'),
    T('Melee blows in a boarding +30%; boarding power +15%.', 'Удары в рукопашной +30%; сила абордажа +15%.')] },
  armor: { id: 'armor', name: ['Armor', 'Броня'], icon: 'mod_hull_plating', tree: 'survival', text: [
    T('Your stacks take 5% less in a boarding; the ship 3% less at sea.', 'Ваши отряды получают на 5% меньше урона в абордаже; корабль на 3% меньше в море.'),
    T('Your stacks take 10% less in a boarding; the ship 6% less at sea.', 'Ваши отряды получают на 10% меньше урона в абордаже; корабль на 6% меньше в море.'),
    T('Your stacks take 15% less in a boarding; the ship 9% less at sea.', 'Ваши отряды получают на 15% меньше урона в абордаже; корабль на 9% меньше в море.')] },
  tactics: { id: 'tactics', name: ['Tactics', 'Тактика'], icon: 'bt_officers', tree: 'command', text: [
    T('Your line stands a hex nearer the planks (when her captain’s Tactics are lower); the first round +1 initiative.', 'Ваш строй стоит на гекс ближе к сходням (если у её капитана Тактика ниже); в первом раунде инициатива +1.'),
    T('Your line two hexes nearer the planks; the first round +2 initiative.', 'Ваш строй на два гекса ближе к сходням; в первом раунде инициатива +2.'),
    T('Your line two hexes nearer the planks; the first round +3 initiative.', 'Ваш строй на два гекса ближе к сходням; в первом раунде инициатива +3.')] },
  leadership: { id: 'leadership', name: ['Leadership', 'Лидерство'], icon: 'tree_command', tree: 'command', text: [
    T('Morale +1 in a boarding; the crew mends its heart 10% faster; Steel orders +15%.', 'Боевой дух +1 в абордаже; команда быстрее приходит в себя (+10%); приказы Стали +15%.'),
    T('Morale +2 in a boarding; the crew mends its heart 20% faster; Steel orders +30%.', 'Боевой дух +2 в абордаже; команда быстрее приходит в себя (+20%); приказы Стали +30%.'),
    T('Morale +3 in a boarding; the crew mends its heart 30% faster; Steel orders +50%.', 'Боевой дух +3 в абордаже; команда быстрее приходит в себя (+30%); приказы Стали +50%.')] },
  luck: { id: 'luck', name: ['Luck', 'Удача'], icon: 'coin', tree: 'exploration', text: [
    T('Luck +1 in a boarding; treasure finds +10%.', 'Удача +1 в абордаже; находки кладов +10%.'),
    T('Luck +2 in a boarding; treasure finds +20%.', 'Удача +2 в абордаже; находки кладов +20%.'),
    T('Luck +3 in a boarding; treasure finds +30%.', 'Удача +3 в абордаже; находки кладов +30%.')] },
  logistics: { id: 'logistics', name: ['Logistics', 'Логистика'], icon: 'ab_trim_sails', tree: 'navigation', text: [
    T('Speed at sea +3%.', 'Ход в море +3%.'),
    T('Speed at sea +6%.', 'Ход в море +6%.'),
    T('Speed at sea +9%.', 'Ход в море +9%.')] },
  scouting: { id: 'scouting', name: ['Scouting', 'Разведка'], icon: 'ab_spotters_eye', tree: 'exploration', text: [
    T('Sight +5%.', 'Обзор +5%.'),
    T('Sight +10%.', 'Обзор +10%.'),
    T('Sight +15%.', 'Обзор +15%.')] },
  trading: { id: 'trading', name: ['Trading', 'Торговля'], icon: 'tree_trade', tree: 'trade', text: [
    T('Buy 2% cheaper, sell 2% dearer.', 'Покупка на 2% дешевле, продажа на 2% дороже.'),
    T('Buy 4% cheaper, sell 4% dearer.', 'Покупка на 4% дешевле, продажа на 4% дороже.'),
    T('Buy 6% cheaper, sell 6% dearer.', 'Покупка на 6% дешевле, продажа на 6% дороже.')] },
  first_aid: { id: 'first_aid', name: ['First Aid', 'Первая помощь'], icon: 'prof_surgeon', tree: 'survival', text: [
    T('After a boarding a tenth of your fallen are patched up; Water orders +15%.', 'После абордажа десятую часть ваших павших ставят на ноги; приказы Воды +15%.'),
    T('After a boarding a fifth of your fallen are patched up; Water orders +30%.', 'После абордажа пятую часть ваших павших ставят на ноги; приказы Воды +30%.'),
    T('After a boarding three tenths of your fallen are patched up; Water orders +50%.', 'После абордажа три десятых ваших павших ставят на ноги; приказы Воды +50%.')] },
  mysticism: { id: 'mysticism', name: ['Deep Mysticism', 'Мистика глубин'], icon: 'tree_abyssal', tree: 'abyssal', text: [
    T('Every order +10%; will fills 10% faster a day; orders a level higher can be learnt.', 'Каждый приказ +10%; воля за день пополняется на 10% больше; можно учить приказы на уровень выше.'),
    T('Every order +20%; will fills 20% faster a day; orders two levels higher.', 'Каждый приказ +20%; воля за день пополняется на 20% больше; приказы на два уровня выше.'),
    T('Every order +30%; will fills 30% faster a day; any order can be learnt.', 'Каждый приказ +30%; воля за день пополняется на 30% больше; можно учить любой приказ.')] },
};

/** What a grandmaster of each skill does (docs/19 E2): the fourth rank, won in a trial of mastery. */
export const GM_TEXT: Record<SkillId, [string, string]> = {
  navigation: T('Turning +18%, closer to the wind by 7°; Wind orders +60%.', 'Поворот +18%, круче к ветру на 7°; приказы Ветра +60%.'),
  artillery: T('Guns +14%, reload −10%; shooters in a boarding +32%; Fire orders +60%.', 'Орудия +14%, перезарядка −10%; стрелки в абордаже +32%; приказы Огня +60%.'),
  boarding: T('Melee blows in a boarding +32%; boarding power +17%.', 'Удары в рукопашной +32%; сила абордажа +17%.'),
  armor: T('Your stacks take 16% less in a boarding; the ship 10% less at sea.', 'Ваши отряды получают на 16% меньше урона в абордаже; корабль на 10% меньше в море.'),
  tactics: T('Even against an expert’s Tactics your line stands two hexes nearer the planks; the first round +3 initiative.', 'Даже против Тактики эксперта ваш строй стоит на два гекса ближе к сходням; в первом раунде инициатива +3.'),
  leadership: T('Morale +3 in a boarding; the crew mends its heart 40% faster; Steel orders +60%.', 'Боевой дух +3 в абордаже; команда быстрее приходит в себя (+40%); приказы Стали +60%.'),
  luck: T('Luck +3 in a boarding; treasure finds +40%.', 'Удача +3 в абордаже; находки кладов +40%.'),
  logistics: T('Speed at sea +11%.', 'Ход в море +11%.'),
  scouting: T('Sight +18%.', 'Обзор +18%.'),
  trading: T('Buy 7% cheaper, sell 7% dearer.', 'Покупка на 7% дешевле, продажа на 7% дороже.'),
  first_aid: T('After a boarding 35 in a hundred of your fallen are patched up; Water orders +60%.', 'После абордажа 35 из сотни ваших павших ставят на ноги; приказы Воды +60%.'),
  mysticism: T('Every order +40%; will fills 40% faster a day; any order can be learnt.', 'Каждый приказ +40%; воля за день пополняется на 40% больше; можно учить любой приказ.'),
};
/** What a skill does at a rank (1–4). */
export function skillText(id: SkillId, r: number): [string, string] {
  return r >= GM_RANK ? GM_TEXT[id] : SKILLS[id].text[Math.max(1, Math.min(SKILL_MAX, r)) - 1];
}

/** A skill's rank among her slots (0: not had). */
export function rankOf(skills: readonly SkillSlot[], id: SkillId): number {
  return skills.find((x) => x.id === id)?.r ?? 0;
}

/** A rank's figure: basic, advanced, expert and (docs/19 E2) grandmaster — a fourth figure, or the expert's. */
const at = (r: number, v: readonly number[]) => (r > 0 ? v[Math.min(v.length, r) - 1] : 0);

/** What her skills do at sea, in the talents' own stat vocabulary (so they share the talents' caps). */
export function skillSeaMods(skills: readonly SkillSlot[]): StatMods {
  const r = (id: SkillId) => rankOf(skills, id);
  const m: StatMods = {};
  const add = (k: keyof StatMods, v: number) => {
    if (v) m[k] = (m[k] ?? 0) + v;
  };
  add('turnRate', at(r('navigation'), [0.05, 0.1, 0.15, 0.18]));
  add('noGoDeg', at(r('navigation'), [-2, -4, -6, -7]));
  add('gunDamageMul', at(r('artillery'), [0.04, 0.08, 0.12, 0.14]));
  add('reloadMul', at(r('artillery'), [-0.03, -0.06, -0.09, -0.1]));
  add('boardingPower', at(r('boarding'), [0.05, 0.1, 0.15, 0.17]));
  add('incomingDamageMul', at(r('armor'), [-0.03, -0.06, -0.09, -0.1]));
  add('moraleRegen', at(r('leadership'), [0.04, 0.08, 0.12, 0.16]));
  add('treasureHunter', at(r('luck'), [0.1, 0.2, 0.3, 0.4]));
  add('maxSpeed', at(r('logistics'), [0.03, 0.06, 0.09, 0.11]));
  add('detection', at(r('scouting'), [0.05, 0.1, 0.15, 0.18]));
  add('buyMul', at(r('trading'), [-0.02, -0.04, -0.06, -0.07]));
  add('sellMul', at(r('trading'), [0.02, 0.04, 0.06, 0.07]));
  return m;
}

/** A grandmaster's figures in the boarding (docs/19 E2), modest over the expert's 30/30/15%: weighed by
 *  tools/balance-glory.ts so that a captain far past the cap stays within 15 points of a fresh one. */
export const GM_BATTLE = { melee: 0.32, shot: 0.32, taken: 0.16 };

/** What her skills do in a boarding battle. */
export function skillBattle(skills: readonly SkillSlot[]): { melee: number; shot: number; taken: number; morale: number; luck: number; tactics: number; init1: number; raise: number; mystic: number } {
  const r = (id: SkillId) => rankOf(skills, id);
  return {
    melee: at(r('boarding'), [0.1, 0.2, 0.3, GM_BATTLE.melee]),
    shot: at(r('artillery'), [0.1, 0.2, 0.3, GM_BATTLE.shot]),
    taken: at(r('armor'), [0.05, 0.1, 0.15, GM_BATTLE.taken]),
    morale: Math.min(SKILL_MAX, r('leadership')), // a grandmaster's heart is an expert's: HoMM3's morale stops at +3
    luck: Math.min(SKILL_MAX, r('luck')),
    tactics: r('tactics'),
    init1: Math.min(SKILL_MAX, r('tactics')),
    raise: at(r('first_aid'), [0.1, 0.2, 0.3, 0.35]),
    mystic: r('mysticism'),
  };
}

/** One choice at a level-up. */
export interface SkillPick {
  id: SkillId;
  r: SkillRank;
}

/** The two skills offered at level `lv` (HoMM3: one of those she has, raised, and one she has not, while a slot is
 *  free), drawn on her seed: her path's favoured trees and her talent points weigh on it. Empty when all are expert. */
export function skillOffer(skills: readonly SkillSlot[], favoured: readonly TreeId[], treePts: Partial<Record<TreeId, number>>, seed: number, lv: number): SkillPick[] {
  const rng = lvRng(seed, lv, 0x5c);
  const weight = (id: SkillId) => 10 + (favoured.includes(SKILLS[id].tree) ? 8 : 0) + Math.min(12, (treePts[SKILLS[id].tree] ?? 0) / 2);
  const ups: SkillPick[] = skills.filter((x) => x.r < SKILL_MAX).map((x) => ({ id: x.id, r: (x.r + 1) as SkillRank }));
  const news: SkillPick[] = skills.length < SKILL_SLOTS ? SKILL_IDS.filter((id) => !skills.some((x) => x.id === id)).map((id) => ({ id, r: 1 as SkillRank })) : [];
  const draw = (list: SkillPick[]): SkillPick | null => (list.length ? rng.weighted(list.map((x) => [x, weight(x.id)] as const)) : null);
  const a = draw(ups.length ? ups : news);
  if (!a) return [];
  const rest = (news.length && ups.length ? news : [...ups, ...news]).filter((x) => x.id !== a.id);
  const b = draw(rest);
  return b ? [a, b] : [a];
}

// ------------------------------------------------------------------ 8. the order book

/** The six schools (docs/18 item 2): H2's four, and the hook and the boarding, fog and shadow, which the paths
 *  bring. Fire, steel and the hook are physical (Stamina); wind, water and fog magical (Will). */
export const SCHOOLS: School[] = ['fire', 'steel', 'board', 'wind', 'water', 'fog'];
/** H2's four, which docs/17's common orders are in (the pages after docs/18 are in all six). */
export const COMMON_SCHOOLS: School[] = ['fire', 'wind', 'water', 'steel'];
export const SCHOOL_NAMES: Record<School, [string, string]> = {
  fire: ['Fire and powder', 'Огонь и порох'], wind: ['Wind', 'Ветер'], water: ['Water and the deep', 'Вода и глубина'], steel: ['Steel and men', 'Сталь и люди'],
  board: ['The hook and the boarding', 'Крюк и абордаж'], fog: ['Fog and shadow', 'Туман и тень'],
};
export const SCHOOL_ICON: Record<School, string> = { fire: 'bt_grenades', wind: 'ab_storm_chaser', water: 'ab_undertow', steel: 'bt_charge', board: 'ab_red_hook_boarding', fog: 'ab_vanish_into_fog' };
/** Each school's kin skill: it raises the school's orders and eases their cost. */
export const SCHOOL_SKILL: Record<School, SkillId> = { fire: 'artillery', wind: 'navigation', water: 'first_aid', steel: 'leadership', board: 'boarding', fog: 'scouting' };
/** What an order spends (docs/18 item 4): the path books' physical moves Stamina, their magical ones and every
 *  common order of docs/17 Will (as before); the common pages after docs/18 by their school, as the path books'. */
export type OrderRes = 'stam' | 'will';
export function orderRes(id: string): OrderRes {
  const d = ORDERS[id as OrderId];
  return d && (d.path || isBookPage(id)) && SCHOOL_KIND[d.school] === 'phys' ? 'stam' : 'will';
}

export type SeaOrderId = 'fair_wind' | 'fog_bank' | 'becalm' | 'gale' | 'mend_hull' | 'deep_sight';
export type OrderId = TacSpellId | SeaOrderId;

export interface OrderDef {
  id: OrderId;
  school: School;
  level: 1 | 2 | 3 | 4 | 5;
  use: 'sea' | 'battle';
  /** Will it costs. */
  cost: number;
  /** A sea order's wait in seconds and how long it holds (a battle order's wait is TAC_SPELLS' rounds). */
  cd?: number;
  dur?: number;
  icon: string;
  name: [string, string];
  text: [string, string];
  /** A captain's own page (her path's move): always in her book, never taught. */
  sig?: CaptainId;
  /** A page of a path book (docs/18 item 3): open to her path by her level; to another's at a guild, dearer. */
  path?: CaptainId;
}

const O = (id: OrderId, school: School, level: OrderDef['level'], use: OrderDef['use'], cost: number, icon: string, name: [string, string], text: [string, string], rest: Partial<OrderDef> = {}): OrderDef => ({ id, school, level, use, cost, icon, name, text, ...rest });

export const ORDERS: Record<OrderId, OrderDef> = Object.fromEntries([
  // Fire and powder.
  O('grenades', 'fire', 1, 'battle', 4, 'bt_grenades', ['Grenades', 'Гранаты'], ['Powder pots on her stack and those beside it.', 'Пороховые горшки по её отряду и соседним.']),
  O('double_shot', 'fire', 2, 'battle', 5, 'ab_double_shot', ['Double shot', 'Двойной заряд'], ['A shot more for every shooter; two rounds of shots a third harder.', 'Каждому стрелку выстрел сверх; два раунда выстрелы на треть сильнее.']),
  O('musket_storm', 'fire', 3, 'battle', 9, 'bt_volley', ['Musket storm', 'Мушкетная буря'], ['Every hand with a pistol fires at once: every stack of hers is hit.', 'Все, у кого есть пистоль, стреляют разом: достаётся каждому её отряду.']),
  O('powder_keg', 'fire', 5, 'battle', 16, 'ab_admiralty_barrage', ['Powder keg', 'Пороховая бочка'], ['A keg rolled into her ranks: a terrible blow on one stack, and a lesser on those beside it.', 'Бочка, закатившаяся в её ряды: страшный удар по одному отряду и слабее — по соседним.']),
  // Wind.
  O('fair_wind', 'wind', 1, 'sea', 5, 'ab_trim_sails', ['Fair wind', 'Попутный ветер'], ['The wind comes round to your quarter: speed +15% for a minute and a half.', 'Ветер заходит вам в корму: ход +15% на полторы минуты.'], { cd: 120, dur: 90 }),
  O('following_wind', 'wind', 1, 'battle', 4, 'ab_current_rider', ['Following wind', 'Ветер в спину'], ['Two rounds: your men a hex faster and two points quicker to act.', 'Два раунда: ваши люди на гекс быстрее и на два очка раньше в очереди.']),
  O('fog_bank', 'wind', 2, 'sea', 8, 'ab_vanish_into_fog', ['Fog bank', 'Полоса тумана'], ['A fog rolls over her: hidden, and a quarter of the shot misses, for half a minute.', 'Туман накрывает корабль: его не видно, четверть ядер летит мимо — полминуты.'], { cd: 180, dur: 30 }),
  O('head_wind', 'wind', 2, 'battle', 6, 'ab_hard_over', ['Head wind', 'Встречный ветер'], ['Two rounds: her men a hex slower and two points later to act.', 'Два раунда: её люди на гекс медленнее и на два очка позже в очереди.']),
  O('becalm', 'wind', 3, 'sea', 10, 'ab_dark_running', ['Becalm', 'Штиль'], ['The wind dies about the ships near you: their speed −40% for twenty seconds.', 'Ветер стихает вокруг ближних кораблей: их ход −40% на двадцать секунд.'], { cd: 120, dur: 20 }),
  O('gale', 'wind', 5, 'sea', 16, 'ab_storm_chaser', ['Gale', 'Шквал'], ['A gale at your back: speed +30% for half a minute; the ships near you lose an eighth of their canvas.', 'Шквал в корму: ход +30% на полминуты; ближние корабли теряют восьмую часть парусов.'], { cd: 300, dur: 30 }),
  // Water and the deep.
  O('brine_mend', 'water', 1, 'battle', 5, 'ab_brine_mend', ['Brine mend', 'Солёная вода'], ['The brine closes wounds: every stack of yours heals an eighth.', 'Солёная вода затягивает раны: каждый ваш отряд лечится на восьмую.']),
  O('mend_hull', 'water', 1, 'sea', 6, 'prof_carpenter', ['Mend the hull', 'Залатать корпус'], ['The sea knits the planks: a tenth of her hull comes back.', 'Море сращивает доски: возвращается десятая часть корпуса.'], { cd: 120 }),
  O('deep_sight', 'water', 2, 'sea', 4, 'ab_spotters_eye', ['Deep sight', 'Взгляд глубины'], ['The drowned lend you their eyes: sight +40% for two minutes.', 'Утопленники одалживают глаза: обзор +40% на две минуты.'], { cd: 120, dur: 120 }),
  O('tide_returns', 'water', 3, 'battle', 10, 'prof_surgeon', ['The tide returns', 'Прилив возвращается'], ['A quarter of every stack of yours stands again.', 'Четверть каждого вашего отряда снова на ногах.']),
  O('maelstrom', 'water', 5, 'battle', 15, 'ab_maw_of_the_deep', ['Maelstrom', 'Водоворот'], ['The sea boils over her deck: every stack of hers is hurt and her heart sinks.', 'Море вскипает на её палубе: ранен каждый её отряд, её дух падает.']),
  // Steel and men.
  O('mark_target', 'steel', 1, 'battle', 3, 'ab_mark_target', ['Mark target', 'Метка цели'], ['Two rounds: every blow and shot of yours on her stack a third harder.', 'Два раунда: каждый ваш удар и выстрел по её отряду на треть сильнее.']),
  O('war_cry', 'steel', 1, 'battle', 4, 'ab_war_cry', ['War cry', 'Боевой клич'], ['Two rounds: your morale +1, hers −1.', 'Два раунда: ваш дух +1, её −1.']),
  O('shield_wall', 'steel', 2, 'battle', 6, 'ab_smoke_pots', ['Shield wall', 'Стена щитов'], ['Two rounds: every stack of yours stands a third firmer.', 'Два раунда: каждый ваш отряд стоит на треть крепче.']),
  O('fury', 'steel', 3, 'battle', 9, 'ab_red_hook_boarding', ['Fury', 'Ярость'], ['Two rounds: every melee blow of yours a third harder.', 'Два раунда: каждый ваш удар в рукопашной на треть сильнее.']),
  O('dread', 'steel', 4, 'battle', 12, 'ab_deep_call', ['Dread', 'Ужас'], ['Two rounds: her morale −2, and a fifth of her turns lost to fear.', 'Два раунда: её дух −2, а пятая часть её ходов теряется от страха.']),
  // The captains' own pages (their paths' moves, docs/11 P1).
  O('point_blank', 'fire', 3, 'battle', 6, 'bt_volley', ['Point-blank volley', 'Залп в упор'], ['Pistols at arm\'s length: a heavy blow on one stack, no answer.', 'Пистолеты в упор: тяжёлый удар по одному отряду, без ответа.'], { sig: 'corsair' }),
  O('smoke_and_knives', 'fog', 3, 'battle', 6, 'bt_hold', ['Smoke and knives', 'Дым и ножи'], ['Smoke on her deck: her blows at half this round.', 'Дым на её палубе: её удары вдвое слабее в этом раунде.'], { sig: 'smuggler' }),
  O('red_harvest', 'board', 3, 'battle', 6, 'bt_charge', ['Blood frenzy', 'Кровавый угар'], ['Your blows +25% for two rounds; her morale −1.', 'Ваши удары +25% на два раунда; её боевой дух −1.'], { sig: 'reaver' }),
  O('turn_the_flank', 'wind', 3, 'battle', 6, 'bt_officers', ['Turn the flank', 'Обход с фланга'], ['Two rounds: your men faster, first to act, every blow a flank.', 'Два раунда: ваши люди быстрее, ходят первыми, каждый удар — с фланга.'], { sig: 'navigator' }),
  O('call_of_the_deep', 'water', 3, 'battle', 6, 'bt_colours', ['Call of the deep', 'Зов бездны'], ['The drowned drag a twelfth of every stack of hers under; her morale −1.', 'Утопленники утаскивают двенадцатую часть каждого её отряда; её дух −1.'], { sig: 'drowned' }),
  O('iron_discipline', 'steel', 3, 'battle', 6, 'bt_captain', ['Iron discipline', 'Железная дисциплина'], ['Two rounds: your stacks stand firm and strike harder; morale +1.', 'Два раунда: ваши отряды стоят крепче и бьют сильнее; дух +1.'], { sig: 'admiral' }),
  // The path books (docs/18 item 3): six pages a path, levels 1–5.
  ...PATH_PAGE_IDS.map((id) => {
    const pg = PATH_PAGES[id];
    return O(id, pg.school, pg.level, 'battle', pg.cost, pg.icon, pg.name, pg.text, { path: pg.path });
  }),
  // The common pages after docs/18 (owner, 2026-10-03): twenty more over the six schools, taught as docs/17's.
  ...BOOK_PAGE_IDS.map((id) => {
    const pg = BOOK_PAGES[id];
    return O(id, pg.school, pg.level, 'battle', pg.cost, pg.icon, pg.name, pg.text);
  }),
].map((o) => [o.id, o])) as Record<OrderId, OrderDef>;

export const ORDER_IDS = Object.keys(ORDERS) as OrderId[];
/** The orders a guild or a shrine can teach (the captains' own pages are not taught). */
export const LEARNABLE: OrderId[] = ORDER_IDS.filter((id) => !ORDERS[id].sig && !ORDERS[id].path);
export const isOrder = (id: string): id is OrderId => id in ORDERS;

/** The book a captain starts with: her H1 book (her own move, the grenades and two pages after her abilities). */
export function startingOrders(captain: CaptainId): OrderId[] {
  return [...TAC_BOOK[captain]];
}

/** The highest level of order she can learn: two, one more at levels 15, 30 and 45, and one more a rank of Deep
 *  Mysticism (HoMM3's Wisdom). */
export function orderLevelCap(level: number, mystic: number): number {
  return Math.min(5, 2 + Math.floor(Math.max(1, level) / 15) + Math.max(0, mystic));
}

/** How much stronger her orders are: her Power (+4% a point, to double at most), her school's kin skill and Deep
 *  Mysticism, and what artifacts add. */
export function orderMul(pow: number, schoolRank: number, mystic: number, extra = 0): number {
  return Math.min(3, 1 + 0.07 * Math.max(0, pow)) * (1 + [0, 0.15, 0.3, 0.5, 0.6][Math.max(0, Math.min(GM_RANK, schoolRank))] + 0.1 * Math.max(0, mystic) + extra);
}

/** The will an order costs her: the school's kin skill eases it (−15/−25/−35%), and some artifacts. */
export function orderCost(id: OrderId, schoolRank: number, costMul = 1): number {
  const def = ORDERS[id];
  return Math.max(1, Math.round(def.cost * (1 - [0, 0.15, 0.25, 0.35, 0.4][Math.max(0, Math.min(GM_RANK, schoolRank))]) * costMul));
}

/** A port's guild of orders (some ports keep one) and what it teaches: its set list, by the port's size. */
export function guildOf(portId: string, size: number): OrderId[] | null {
  let h = 0x6d11d;
  for (let i = 0; i < portId.length; i++) h = Math.imul(h ^ portId.charCodeAt(i), 16777619);
  const rng = new Rng(h >>> 0);
  if (rng.float() > 0.45 && size < 3) return null;
  const top = Math.min(5, 2 + Math.max(0, size));
  const pool = LEARNABLE.filter((id) => ORDERS[id].level <= top);
  const out: OrderId[] = [];
  // One of each school first (the hook and the boarding, fog and shadow too, since they have common pages), then the
  // rest.
  for (const sc of SCHOOLS) {
    const list = pool.filter((id) => ORDERS[id].school === sc && !out.includes(id));
    if (list.length) out.push(rng.pick(list));
  }
  while (out.length < 6) {
    const left = pool.filter((id) => !out.includes(id));
    if (!left.length) break;
    out.push(rng.pick(left));
  }
  return out.sort((a, b) => ORDERS[a].level - ORDERS[b].level || a.localeCompare(b));
}

/** Silver a guild asks for teaching an order. */
/** The orders each floor of her island's guild of orders teaches (docs/17 H5), as HoMM3's mage guild: a fixed list
 *  of the floor's own level, drawn once for the island — three on the first and second floors, two on the third, one
 *  on the fourth and the fifth. Taught free, as far as her level and Deep Mysticism let her learn them. */
export const ISLE_GUILD_COUNT = [0, 3, 3, 2, 1, 1];
export const ISLE_GUILD_MAX = 5;

export function isleGuildOrders(islandId: number, floors: number): OrderId[][] {
  const rng = new Rng((Math.imul(islandId + 7, 0x1b873593) ^ 0x6a11d) >>> 0);
  const out: OrderId[][] = [];
  for (let lv = 1; lv <= Math.min(ISLE_GUILD_MAX, Math.max(0, floors)); lv++) {
    const pool = LEARNABLE.filter((id) => ORDERS[id].level === lv);
    const pick: OrderId[] = [];
    while (pick.length < Math.min(ISLE_GUILD_COUNT[lv], pool.length)) {
      const id = rng.pick(pool);
      if (!pick.includes(id)) pick.push(id);
    }
    out.push(pick);
  }
  return out;
}

export function guildPrice(id: OrderId): number {
  const l = ORDERS[id].level;
  return 150 * l * l;
}

/** The order a drowned shrine teaches (each its own). */
export function shrineOrder(islandId: number): OrderId {
  const rng = new Rng((Math.imul(islandId + 1, 0x2c1b3c6d) ^ 0x5a17e) >>> 0);
  return rng.pick(LEARNABLE.filter((id) => ORDERS[id].level <= 4));
}

/** Hexes her line stands nearer the planks by her Tactics (HoMM3: the higher Tactics has the field, the lower none). */
export const TACTICS_DEPLOY = [0, 1, 2, 2, 2];

// ------------------------------------------------------------------ the hero in the boarding battle

/** The captain as a hero in the boarding battle (server/src/game/tacbattle.ts): her primaries with her artifacts', her
 *  will, her book, and what her skills and artifacts do there. */
export interface HeroBattle {
  atk: number;
  def: number;
  pow: number;
  will: number;
  mana: number;
  manaMax: number;
  book: TacSpellId[];
  /** Melee and shots a share harder; damage taken a share less. */
  melee: number;
  shot: number;
  taken: number;
  morale: number;
  luck: number;
  /** Her Tactics' rank, and the first round's initiative it gives. */
  tactics: number;
  init1: number;
  /** A share of her fallen patched up after the battle (First Aid, artifacts). */
  raise: number;
  /** Each school's orders: how much stronger; each order's will (or stamina, by its school). */
  mul: Record<School, number>;
  cost: Partial<Record<TacSpellId, number>>;
  /** docs/18: her path (null: a captain of the sea without one) and her hero level. */
  path?: CaptainId | null;
  level?: number;
  /** Stamina for the physical moves (docs/18 item 4): now, at most, back each round. */
  stam?: number;
  stamMax?: number;
  stamRegen?: number;
  /** Her path's innate move and (from level 20) her ultimate, as strong as this (talents lift them); her path
   *  book's pages as strong as this (talents). */
  innateMul?: number;
  pageMul?: number;
  ult?: boolean;
  /** Scrolls she carries of pages she does not know (docs/18 item 10): a battle cast each, free. */
  scroll?: Partial<Record<TacSpellId, number>>;
}

/** Her home school's own moves (docs/18 item 2): the path pages of her path's school (another path's too, learnt) —
 *  cheaper and stronger for her, as HoMM3's native magic; her innate move and ultimate land with the same lift. The
 *  common orders of docs/17 and the captains' own pages stay as they are for every path (the balance of H2 holds). */
export function isHome(path: CaptainId | null | undefined, id: OrderId): boolean {
  const d = ORDERS[id];
  return !!path && !!d && PATH_SCHOOL[path] === d.school && !!d.path;
}
/** How much stronger an order lands for her: her school's lift, her home school's. */
export function homeMul(path: CaptainId | null | undefined, id: OrderId): number {
  return isHome(path, id) ? HOME_MUL : 1;
}

/** What the paths add to her battle self (docs/18): her path and level, her talents, her stamina now, her scrolls. */
export interface HeroPathInput {
  path: CaptainId | null;
  level: number;
  talents?: Record<string, number> | null;
  stam?: number;
  scrolls?: Partial<Record<string, number>> | null;
}

/** Her battle self from her primaries (artifacts' included), skills, artifacts, book and will now — and, with
 *  `ext`, her path's book, home school, stamina, innate move and ultimate (docs/18). */
export function heroBattle(prim: Prims, skills: readonly SkillSlot[], art: ArtTotals | null, book: readonly OrderId[], mana: number, ext?: HeroPathInput): HeroBattle {
  const sb = skillBattle(skills);
  const ab = art?.battle;
  const path = ext?.path ?? null;
  const lift = talentBook(ext?.talents);
  const mul = {} as Record<School, number>;
  for (const sc of SCHOOLS) mul[sc] = orderMul(prim.pow, rankOf(skills, SCHOOL_SKILL[sc]), sb.mystic, (ab?.orders ?? 0) + (ab?.school[sc] ?? 0));
  // Her path's pages open at her level; scrolls add pages for a cast each.
  const all: OrderId[] = [...book];
  if (ext && path) for (const id of pathPagesAt(path, ext.level)) if (!all.includes(id)) all.push(id);
  const scroll: Partial<Record<TacSpellId, number>> = {};
  for (const [id, n] of Object.entries(ext?.scrolls ?? {})) {
    // A scroll of a page she knows stays in her bag.
    if (!isPathPage(id) || !(Number(n) > 0) || all.includes(id)) continue;
    scroll[id] = Math.floor(Number(n));
    all.push(id);
  }
  const battleBook = all.filter((id): id is TacSpellId => ORDERS[id]?.use === 'battle');
  const cost: Partial<Record<TacSpellId, number>> = {};
  for (const id of battleBook) {
    const d = ORDERS[id];
    let k = 1 - (ab?.cost ?? 0);
    if (path && isHome(path, id)) k *= HOME_COST;
    if (d.path && d.path !== path) k *= FOREIGN_COST;
    if (d.path && d.path === path) k *= 1 - lift.cost;
    cost[id] = orderCost(id, rankOf(skills, SCHOOL_SKILL[d.school]), k);
  }
  const manaMax = manaMaxOf(prim.will) + (ext ? lift.will : 0);
  const out: HeroBattle = {
    atk: Math.max(0, prim.atk), def: Math.max(0, prim.def), pow: Math.max(0, prim.pow), will: Math.max(0, prim.will),
    mana: Math.max(0, Math.min(manaMax, mana + (ext ? lift.will : 0))), manaMax, book: battleBook,
    melee: sb.melee + (ab?.melee ?? 0), shot: sb.shot + (ab?.shot ?? 0), taken: Math.min(0.5, sb.taken + (ab?.taken ?? 0)),
    morale: sb.morale + (ab?.morale ?? 0), luck: sb.luck + (ab?.luck ?? 0), tactics: sb.tactics, init1: sb.init1,
    raise: Math.min(0.5, sb.raise + (ab?.raise ?? 0)), mul, cost,
  };
  if (ext) {
    const stamMax = stamMaxOf(out.atk, out.def) + lift.stam;
    out.path = path;
    out.level = Math.max(1, Math.round(ext.level));
    out.stamMax = stamMax;
    out.stam = Math.max(0, Math.min(stamMax, ext.stam ?? stamMax));
    out.stamRegen = Math.max(1, Math.round(stamMax * STAM_ROUND));
    out.innateMul = 1 + lift.innate;
    out.ult = !!path && out.level >= ULT_LEVEL;
    out.pageMul = 1 + lift.mul;
    if (Object.keys(scroll).length) out.scroll = scroll;
  }
  return out;
}

/** A sea captain's battle self for her ship's level: an even hand of primaries, a full store; a named captain of the
 *  sea (docs/18 item 8) her path's book, home school, stamina, innate move and ultimate, as a captain of her level;
 *  the rest the sea's own book. */
export function npcHeroBattle(shipLevel: number, path: CaptainId | null): HeroBattle {
  const prim = npcPrims(shipLevel);
  if (!path) return heroBattle(prim, [], null, npcBook(shipLevel), manaMaxOf(prim.will), { path: null, level: npcHeroLevel(shipLevel) });
  return heroBattle(prim, [], null, startingOrders(path), manaMaxOf(prim.will), { path, level: npcHeroLevel(shipLevel) });
}

/** A sea captain's book without a path of her own: the grenades, and the common pages as her waters grow harder. */
export function npcBook(shipLevel: number): OrderId[] {
  return SEA_BOOK.filter(([lv, , top]) => shipLevel >= lv && shipLevel <= (top ?? 99)).map(([, id]) => id);
}
/** The sea's book by her waters (docs/18: weighed against the paths' books, tools/balance-paths.ts): from a level,
 *  and some pages only up to one. */
export const SEA_BOOK: [number, OrderId, number?][] = [[1, 'grenades'], [2, 'mark_target'], [2, 'point_blank'], [2, 'double_shot'], [4, 'war_cry'], [4, 'brine_mend'], [5, 'shield_wall'], [5, 'fury'], [5, 'dread']];

// ------------------------------------------------------------------ what the captain sees

export interface HeroView {
  /** Her primaries, and what her artifacts add to them. */
  prim: Prims;
  artPrim: Prims;
  will: number;
  willMax: number;
  skills: SkillSlot[];
  /** Level-ups whose skill is still to choose, and the two offered at the first of them. */
  pending: number;
  offer: SkillPick[];
  orders: OrderId[];
  /** The level of order she can learn. */
  cap: number;
  /** A sea order's wait: order → world time it is ready. */
  cd: Partial<Record<OrderId, number>>;
  /** Each order's will as her skills and artifacts make it. */
  costs: Partial<Record<OrderId, number>>;
  /** Her full artifact sets. */
  sets: string[];
  /** docs/18: her stamina now and at most; the scrolls she carries; the pages of her path open to her; the talents
   *  that lift her book and by how much. */
  stam?: number;
  stamMax?: number;
  scrolls?: Partial<Record<OrderId, number>>;
  pages?: OrderId[];
  lift?: { mul: number; cost: number; stam: number; will: number; innate: number; nodes: string[] };
  /** Her captain's blast with her army as it is (a twentieth-odd of its strength), and how much her schools, her
   *  path's pages and her moves lift it: the Path book shows each move's blow in hit points. */
  blast?: number;
  mul?: Record<School, number>;
  pageMul?: number;
  innateMul?: number;
}

/** What a port offers the hero: its guild's list and prices, and its artifact merchant's pieces today. */
export interface HeroPortView {
  port: string;
  guild: { id: OrderId; price: number }[] | null;
  wares: { art: string; price: number }[] | null;
  /** Other paths' pages the guild teaches, at twice the price (docs/18 item 10). */
  foreign?: { id: OrderId; price: number }[] | null;
}

/** The server's words about the hero, English → Russian. */
export function heroPatterns(): [string, string][] {
  const out: [string, string][] = [
    ['Level {0}! {1} +1. A new talent point awaits.', 'Уровень {0}! {1} +1. Вас ждёт новое очко таланта.'],
    ['A new skill to choose: {0} or {1}.', 'Выберите навык: {0} или {1}.'],
    ['Learnt: {0}.', 'Выучено: {0}.'],
    ['Skill: {0}, {1}.', 'Навык: {0}, {1}.'],
    ['No skill to choose now', 'Сейчас выбирать нечего'],
    ['No such choice', 'Такого выбора нет'],
    ['No such order', 'Такого приказа нет'],
    ['You know that order already', 'Этот приказ вам уже известен'],
    ['Orders of level {0} are beyond you yet (Deep Mysticism or more levels open them)', 'Приказы уровня {0} вам пока не по силам (их открывают Мистика глубин или новые уровни)'],
    ['No guild of orders here', 'Здесь нет гильдии приказов'],
    ['This guild does not teach that order', 'Эта гильдия такому приказу не учит'],
    ['You do not know that order', 'Вам не известен этот приказ'],
    ['That order is for the boarding battle', 'Этот приказ — для абордажного боя'],
    ['Not in port', 'Не в порту'],
    ['Not while boarding', 'Не во время абордажа'],
    ['That order is not ready yet', 'Этот приказ ещё не готов'],
    ['Not enough will: {0} needed', 'Не хватает воли: нужно {0}'],
    ['{0}: {1} will.', '{0}: {1} воли.'],
    ['Your will is restored.', 'Воля восстановлена.'],
    ['A new day: your will grows to {0}.', 'Новый день: воля выросла до {0}.'],
    ['The shrine teaches you {0}.', 'Святилище учит вас приказу «{0}».'],
    ['The shrine has nothing more to teach you; your will is restored.', 'Святилищу больше нечему вас учить; воля восстановлена.'],
    ['The spring restores your will.', 'Родник восстанавливает волю.'],
    ['No ship near to becalm', 'Рядом нет кораблей, чтобы наслать штиль'],
    ['The hull is whole', 'Корпус цел'],
    ['No artifact merchant here', 'Здесь нет торговца артефактами'],
    ['An artifact: {0}!', 'Артефакт: {0}!'],
    ['Paid {0} silver.', 'Заплачено серебра: {0}.'],
  ];
  for (const p of PRIMS) out.push(PRIM_NAMES[p]);
  for (const s of SKILL_IDS) out.push(SKILLS[s].name);
  for (const r of RANK_NAMES) out.push(r);
  for (const o of ORDER_IDS) out.push(ORDERS[o].name);
  out.push(...pathPatterns());
  return out;
}
