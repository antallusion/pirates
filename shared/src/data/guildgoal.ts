// The guild's order of the week (docs/11 P6): every guild has one goal a week (UTC), sized by its members; their
// deeds fill it, and when it is done the treasury gains and every member who put a hand to it is paid.

export type GuildGoalKind = 'pirates' | 'charts' | 'landings' | 'prizes' | 'boardings' | 'quests';

export const GUILD_GOALS: Record<GuildGoalKind, { base: number; text: [string, string] }> = {
  pirates: { base: 30, text: ['Sink pirate ships: {n}.', 'Потопить пиратские корабли: {n}.'] },
  charts: { base: 40, text: ['Chart islands: {n}.', 'Нанести острова на карту: {n}.'] },
  landings: { base: 40, text: ['Land parties ashore: {n}.', 'Высадить десанты на берег: {n}.'] },
  prizes: { base: 10, text: ['Bring prizes home: {n}.', 'Привести призы домой: {n}.'] },
  boardings: { base: 15, text: ['Take ships by boarding: {n}.', 'Взять корабли на абордаж: {n}.'] },
  quests: { base: 12, text: ['Finish quests: {n}.', 'Выполнить задания: {n}.'] },
};
export const GUILD_GOAL_KINDS = Object.keys(GUILD_GOALS) as GuildGoalKind[];

export function weekOf(day: number): number {
  return Math.floor(day / 7);
}

/** The week's order for a guild: the kind turns with the week (each guild its own turn), the size with its members. */
export function guildGoalFor(week: number, guildId: number, members: number): { kind: GuildGoalKind; target: number } {
  const n = GUILD_GOAL_KINDS.length;
  const kind = GUILD_GOAL_KINDS[(((week + guildId) % n) + n) % n];
  return { kind, target: Math.round(GUILD_GOALS[kind].base * Math.max(1, members / 4)) };
}

/** What the treasury gains for the order done. */
export function guildTreasuryReward(target: number): number {
  return target * 60;
}

/** A member's share: by level, more for more deeds (up to double). */
export function guildMemberReward(level: number, mine: number): { silver: number; xp: number } {
  const k = (1 + level / 10) * (1 + Math.min(1, mine / 8));
  return { silver: Math.round(200 * k), xp: Math.round(300 * k) };
}

export function guildGoalText(kind: GuildGoalKind, target: number, lang: 0 | 1): string {
  return GUILD_GOALS[kind].text[lang].replace('{n}', String(target));
}

/** The server's lines about it, English → Russian ({0} a count, {1} silver). */
export function guildGoalPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const d of Object.values(GUILD_GOALS)) {
    out.push([`The guild's order of the week is done: ${d.text[0].replace('{n}', '{0}')} The treasury gains {1} silver.`, `Заказ гильдии на неделю выполнен: ${d.text[1].replace('{n}', '{0}')} Казна получает {1} серебра.`]);
  }
  out.push(["Your share of the guild's order: {0} silver.", 'Ваша доля за заказ гильдии: {0} серебра.']);
  return out;
}
