// Tasks of the sea (docs/11 P6), as WoW's world quests: a few at a time about the map, each by an island for three
// quarters of an hour — a nest of pirates to sink, a field of wreckage to fish crates out of, or haunted waters where
// the drowned sail again. No one takes them:
// every captain moves on their own count (a groupmate's kill counts too), and each is paid once when theirs is full.

import type { RegionId } from '../world/regions.ts';

export type TaskKind = 'nest' | 'wreck' | 'haunt';
export const TASK_KINDS: TaskKind[] = ['nest', 'wreck', 'haunt'];

/** How many a task wants: pirates sunk, crates fished up, ghost ships laid to rest. */
export function taskNeed(kind: TaskKind): number {
  return kind === 'haunt' ? 2 : TASK_NEED;
}

export const TASKS_AT_ONCE = 4;
export const TASK_SEC = 45 * 60;
export const TASK_RADIUS = 1600;
export const TASK_NEED = 4;

/** A task's strength and pay by the safety of its waters. */
const LEVEL: Record<string, number> = { safe: 4, contested: 12, lawless: 22 };
export function taskLevel(safety: string): number {
  return LEVEL[safety] ?? 4;
}
export function taskReward(level: number): { silver: number; xp: number } {
  return { silver: Math.round(260 * (1 + level / 10)), xp: Math.round(360 * (1 + level / 10)) };
}

export interface TaskView {
  id: number;
  kind: TaskKind;
  /** The island the nest or the field is by. */
  island: string;
  region: RegionId;
  x: number;
  y: number;
  r: number;
  need: number;
  mine: number;
  done: boolean;
  /** Seconds left. */
  endsIn: number;
}

/** A task's name as the server writes it (translated on the client). */
export function taskName(kind: TaskKind, island: string): string {
  return kind === 'wreck' ? `Wreck field off ${island}` : kind === 'haunt' ? `Haunted waters off ${island}` : `Pirate nest off ${island}`;
}

/** The server's lines about them, English → Russian. */
export function taskPatterns(): [string, string][] {
  return [
    ['Pirate nest off {0}', 'Пиратское гнездо у острова {0}'],
    ['News of the sea: pirates nest off {0} in {1}. Sink {2} of them there within 45 min — anyone may.', 'Вести моря: пираты свили гнездо у острова {0} в водах «{1}». Потопите там {2} из них за 45 минут — может любой.'],
    ['Task of the sea done — Pirate nest off {0}: +{1} silver, +{2} XP.', 'Задание моря выполнено — Пиратское гнездо у острова {0}: +{1} серебра, +{2} опыта.'],
    ['Pirate nest off {0}: {1}/{2}.', 'Пиратское гнездо у острова {0}: {1}/{2}.'],
    ['Wreck field off {0}', 'Поле обломков у острова {0}'],
    ['News of the sea: a wreck field off {0} in {1}. Fish {2} crates out of it within 45 min — anyone may.', 'Вести моря: поле обломков у острова {0} в водах «{1}». Выловите оттуда {2} ящика за 45 минут — может любой.'],
    ['Task of the sea done — Wreck field off {0}: +{1} silver, +{2} XP.', 'Задание моря выполнено — Поле обломков у острова {0}: +{1} серебра, +{2} опыта.'],
    ['Wreck field off {0}: {1}/{2}.', 'Поле обломков у острова {0}: {1}/{2}.'],
    ['Haunted waters off {0}', 'Проклятые воды у острова {0}'],
    ['News of the sea: the drowned sail again off {0} in {1}. Sink {2} of their ships within 45 min — anyone may.', 'Вести моря: утопленники снова вышли в море у острова {0} в водах «{1}». Потопите {2} их корабля за 45 минут — может любой.'],
    ['Task of the sea done — Haunted waters off {0}: +{1} silver, +{2} XP.', 'Задание моря выполнено — Проклятые воды у острова {0}: +{1} серебра, +{2} опыта.'],
    ['Haunted waters off {0}: {1}/{2}.', 'Проклятые воды у острова {0}: {1}/{2}.'],
  ];
}
