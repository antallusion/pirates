// docs/16 Batch G — company and groups: the "looking for company" flag with its goal and levels (#31), the sea's
// shared goals of the week (#32), trade alongside at sea (#33), the guild's shipyard on the leader's island (#34)
// and the signal flags a group hoists to its own (#35). The numbers and the words; the server and client read them.

import { XP_UNITS, lumpXp } from './xpcurve.ts'; // docs/26
import type { GoodId } from './goods.ts';
import { Rng } from '../rng.ts';

// ------------------------------------------------------------------ 31. looking for company

export type LfgGoal = 'hunt' | 'trade' | 'boss' | 'treasure' | 'tide';
export const LFG_GOALS: LfgGoal[] = ['hunt', 'trade', 'boss', 'treasure', 'tide'];
/** The goal's name (English, Russian) and its picture (an icon of assets/icons). */
export const LFG_GOAL_DEFS: Record<LfgGoal, { name: [string, string]; icon: string; color: string }> = {
  hunt: { name: ['Hunting', 'Охота'], icon: 'ab_mark_target', color: '#e0776b' },
  trade: { name: ['Trade run', 'Торговый рейс'], icon: 'tab_market', color: '#e8c46a' },
  boss: { name: ['A great beast', 'Большой зверь'], icon: 'map_monster', color: '#b07ae0' },
  treasure: { name: ['Treasure', 'Клад'], icon: 'map_treasure', color: '#f0d48e' },
  tide: { name: ['Tasks and quests', 'Задания и приливы'], icon: 'map_contract', color: '#7fc8d8' },
};
/** A posting stands this long unless renewed (seconds). */
export const LFG_SEC = 30 * 60;
/** The widest level range a posting may ask for, and the levels there are. */
export const LFG_LEVEL_MAX = 60;

/** A level range made sane: whole, in order, within the levels there are; by default the captain's own ±3. */
export function lfgRange(level: number, lo?: number, hi?: number): [number, number] {
  const clamp = (n: number) => Math.max(1, Math.min(LFG_LEVEL_MAX, Math.round(n)));
  let a = Number.isFinite(lo) ? clamp(lo!) : clamp(level - 3);
  let b = Number.isFinite(hi) ? clamp(hi!) : clamp(level + 3);
  if (a > b) [a, b] = [b, a];
  return [a, b];
}

/** The short tag a posting flies over the ship: "hunt:4-9". */
export function lfgTag(goal: LfgGoal, lo: number, hi: number): string {
  return `${goal}:${lo}-${hi}`;
}

export function parseLfgTag(tag: string | undefined | null): { goal: LfgGoal; lo: number; hi: number } | null {
  const m = /^([a-z]+):(\d+)-(\d+)$/.exec(tag ?? '');
  if (!m || !LFG_GOALS.includes(m[1] as LfgGoal)) return null;
  return { goal: m[1] as LfgGoal, lo: Number(m[2]), hi: Number(m[3]) };
}

// ------------------------------------------------------------------ 32. the sea's goals of the week

export type WorldGoalKind = 'choir' | 'pirates' | 'deliver' | 'beasts' | 'catch';
export const WORLD_GOAL_KINDS: WorldGoalKind[] = ['choir', 'pirates', 'deliver', 'beasts', 'catch'];
export const WORLD_GOAL_DEFS: Record<WorldGoalKind, { base: number; text: [string, string]; icon: string }> = {
  choir: { base: 500, text: ['Sink {n} ships of the Choir this week.', 'Потопить {n} кораблей Хора за неделю.'], icon: 'mod_choir_bell' },
  pirates: { base: 800, text: ['Sink {n} pirate ships this week.', 'Потопить {n} пиратских кораблей за неделю.'], icon: 'ab_mark_target' },
  deliver: { base: 20_000, text: ['Deliver {n} goods to {port}.', 'Доставить {n} товаров в {port}.'], icon: 'tab_market' },
  beasts: { base: 150, text: ['Take {n} beasts of the sea this week.', 'Добыть {n} морских зверей за неделю.'], icon: 'map_monster' },
  catch: { base: 6000, text: ['Land {n} fish this week.', 'Выловить {n} рыбы за неделю.'], icon: 'good_fish' },
};
/** Goals at once. */
export const WORLD_GOALS_AT_ONCE = 2;
/** A hand counts for the reward from this share of the goal (and at least one deed). */
export const WORLD_GOAL_SHARE = 0.005;

export function worldGoalMin(target: number): number {
  return Math.max(1, Math.round(target * WORLD_GOAL_SHARE));
}

/** The week's goals, drawn with their own dice from the week's number (never the sea's stream). */
export function worldGoalsFor(week: number, ports: readonly string[]): { kind: WorldGoalKind; target: number; port?: string }[] {
  const rng = new Rng(0x60a15eed ^ Math.imul(week + 1, 0x9e3779b1));
  const kinds = [...WORLD_GOAL_KINDS];
  const out: { kind: WorldGoalKind; target: number; port?: string }[] = [];
  for (let i = 0; i < WORLD_GOALS_AT_ONCE && kinds.length; i++) {
    const k = kinds.splice(rng.int(0, kinds.length - 1), 1)[0];
    const def = WORLD_GOAL_DEFS[k];
    const round = def.base >= 5000 ? 500 : def.base >= 400 ? 50 : 10;
    const target = Math.max(round, Math.round((def.base * rng.range(0.8, 1.2)) / round) * round);
    out.push(k === 'deliver' && ports.length ? { kind: k, target, port: ports[rng.int(0, ports.length - 1)] } : { kind: k === 'deliver' ? 'pirates' : k, target });
  }
  return out;
}

/** A hand's pay when the goal is met: by level, and more for a bigger share (up to double). */
export function worldGoalReward(level: number, mine: number, target: number): { silver: number; xp: number } {
  const more = 1 + Math.min(1, (mine / Math.max(1, target)) * 20), k = (1 + level / 10) * more;
  return { silver: Math.round(600 * k), xp: lumpXp(level, 2 * XP_UNITS.goal * more) };
}

export function worldGoalText(kind: WorldGoalKind, target: number, port: string, lang: 0 | 1): string {
  return WORLD_GOAL_DEFS[kind].text[lang].replace('{n}', target.toLocaleString(lang ? 'ru-RU' : 'en-GB')).replace('{port}', port);
}

// ------------------------------------------------------------------ 33. trade alongside at sea

/** How close two ships must keep to trade at sea (m). */
export const TRADE_RANGE = 300;
/** Pieces of gear one side may put on the table. */
export const TRADE_ITEMS_MAX = 6;
/** Kinds of goods one side may put on the table. */
export const TRADE_GOODS_MAX = 12;

// ------------------------------------------------------------------ 34. the guild's shipyard

export type GuildProject = 'ship' | 'yard';
export const GUILD_PROJECTS: GuildProject[] = ['ship', 'yard'];
export const GUILD_PROJECT_DEFS: Record<GuildProject, { name: [string, string]; text: [string, string]; goods: Partial<Record<GoodId, number>>; silver: number }> = {
  ship: {
    name: ['A guild ship', 'Корабль гильдии'],
    text: ['A hull for the guild fleet, built at the leader’s island; any captain of the guild may take her out.', 'Корпус для флота гильдии со стапеля на острове лидера; вывести его может любой капитан гильдии.'],
    goods: { timber: 600, planks: 200, tar: 200, iron: 200, sailcloth: 150 },
    silver: 20_000,
  },
  yard: {
    name: ['A bigger yard', 'Расширение верфи'],
    text: ['The leader’s shipyard raised a level: bigger hulls for the island and the guild.', 'Верфь лидера на уровень выше: большие корпуса для острова и гильдии.'],
    goods: { timber: 400, planks: 150, iron: 150, coal: 120 },
    silver: 10_000,
  },
};
/** The share of a project a member must bring for the finishing honours (listed as a builder). */
export const GUILD_PROJECT_SHARE = 0.02;

/** The hull a guild ship takes by the leader's shipyard level. */
export function guildShipClass(yardLevel: number): 'brigantine' | 'brig' | 'frigate' {
  return yardLevel >= 5 ? 'frigate' : yardLevel >= 3 ? 'brig' : 'brigantine';
}

/** All the units a project asks, and all brought so far (silver counted as a unit per 100). */
export function projectUnits(p: GuildProject): number {
  const d = GUILD_PROJECT_DEFS[p];
  return Object.values(d.goods).reduce((a, n) => a + (n ?? 0), 0) + Math.round(d.silver / 100);
}

// ------------------------------------------------------------------ 35. signal flags

export type SignalKind = 'follow' | 'attack' | 'help' | 'regroup' | 'treasure';
export const SIGNALS: SignalKind[] = ['follow', 'attack', 'help', 'regroup', 'treasure'];
export const SIGNAL_DEFS: Record<SignalKind, { name: [string, string]; icon: string; color: string; key: string }> = {
  follow: { name: ['Follow me', 'За мной'], icon: 'ab_form_line', color: '#7fd08a', key: '1' },
  attack: { name: ['Attacking', 'Атакую'], icon: 'ab_mark_target', color: '#e0655a', key: '2' },
  help: { name: ['Need help', 'Нужна помощь'], icon: 'ab_call_escort', color: '#f0a040', key: '3' },
  regroup: { name: ['Regroup', 'Сбор'], icon: 'anchor', color: '#8fc3e8', key: '4' },
  treasure: { name: ['Treasure here', 'Здесь клад'], icon: 'map_treasure', color: '#e8c46a', key: '5' },
};
/** A flag stays on the charts this long (s). */
export const SIGNAL_TTL = 20;
/** No two flags from one captain closer than this (s), and at most SIGNAL_BURST in SIGNAL_WINDOW seconds. */
export const SIGNAL_GAP = 2;
export const SIGNAL_BURST = 5;
export const SIGNAL_WINDOW = 30;

/** Whether a new signal is allowed at `now`, given the times of the captain's recent ones (kept by the caller). */
export function signalAllowed(times: number[], now: number): boolean {
  const recent = times.filter((t) => now - t < SIGNAL_WINDOW);
  if (recent.length && now - recent[recent.length - 1] < SIGNAL_GAP) return false;
  return recent.length < SIGNAL_BURST;
}

// ------------------------------------------------------------------ the server's lines, English → Russian

export function socialPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const d of Object.values(WORLD_GOAL_DEFS)) {
    const en = d.text[0].replace('{n}', '{0}').replace('{port}', '{1}');
    const ru = d.text[1].replace('{n}', '{0}').replace('{port}', '{1}');
    out.push([`The sea’s goal is met: ${en} Every hand in it is paid.`, `Общая цель моря достигнута: ${ru} Каждому, кто внёс вклад, заплачено.`]);
    out.push([`The sea’s goal was met: ${en}`, `Общая цель моря достигнута: ${ru}`]);
    out.push([en, ru]);
  }
  out.push(['WORLD: The sea’s goal is met: {0} Every hand in it is paid.', 'Вести: общая цель моря достигнута: {0} Каждому, кто внёс вклад, заплачено.']);
  out.push(['The sea’s goal is met: {0} Every hand in it is paid.', 'Общая цель моря достигнута: {0} Каждому, кто внёс вклад, заплачено.']);
  out.push(['The sea’s goal was met: {0}', 'Общая цель моря достигнута: {0}']);
  for (const d of Object.values(GUILD_PROJECT_DEFS)) out.push([d.name[0], d.name[1]]);
  for (const d of Object.values(SIGNAL_DEFS)) out.push([d.name[0], d.name[1]]);
  for (const d of Object.values(LFG_GOAL_DEFS)) out.push([d.name[0], d.name[1]]);
  return out;
}
