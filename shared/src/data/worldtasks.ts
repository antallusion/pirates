// Tasks of the sea (docs/11 P6), as WoW's world quests: a few at a time about the map, each a nest of pirates by an
// island for three quarters of an hour. No one takes them: every captain who sinks pirates there moves on their
// own count (a groupmate's kill counts too), and each is paid once when theirs is full.

import type { RegionId } from '../world/regions.ts';

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
  /** The island the nest is by. */
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

export function taskName(island: string, lang: 0 | 1): string {
  return lang ? `Пиратское гнездо у острова ${island}` : `Pirate nest off ${island}`;
}

/** The server's lines about them, English → Russian. */
export function taskPatterns(): [string, string][] {
  return [
    ['Pirate nest off {0}', 'Пиратское гнездо у острова {0}'],
    ['News of the sea: pirates nest off {0} in {1}. Sink {2} of them there within 45 min — anyone may.', 'Вести моря: пираты свили гнездо у острова {0} в водах «{1}». Потопите там {2} из них за 45 минут — может любой.'],
    ['Task of the sea done — Pirate nest off {0}: +{1} silver, +{2} XP.', 'Задание моря выполнено — Пиратское гнездо у острова {0}: +{1} серебра, +{2} опыта.'],
    ['Pirate nest off {0}: {1}/{2}.', 'Пиратское гнездо у острова {0}: {1}/{2}.'],
  ];
}
