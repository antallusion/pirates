// The captain's log (docs/16 #20): the chronicle of her days, written by itself — the ships sunk and taken, the storms,
// the seas and harbours found, the great beasts seen and fought, the dead, the levels. Each line is kept as its facts
// (the day, the hour of the sea's clock, what and where); the reader's client tells it in its own tongue. The saga's
// chapters (saga.ts) come into it too, as the day's great moments. Only the last few days are kept.

import type { SagaKind } from './saga.ts';

export type LogKind =
  | 'sank' | 'prize' | 'storm' | 'sea' | 'port' | 'boss_seen' | 'boss' | 'officer_dead' | 'crew_lost' | 'wounded_died' | 'level' | 'saga';

export interface LogEntry {
  /** Wall-clock ms. */
  at: number;
  /** The day of her voyages (game days since she first sailed). */
  day: number;
  /** The hour on the sea's clock, 0..1 of the day. */
  tod: number;
  kind: LogKind;
  /** Names as the server says them; for a saga chapter a[0] is its kind. */
  a: string[];
  n?: number;
}

/** Days kept (the current and the ones before it), and a cap on the lines. */
export const LOG_DAYS = 5;
export const LOG_MAX = 160;

export const LOG_ICON: Record<LogKind, string> = {
  sank: 'map_wreck', prize: 'tree_boarding', storm: 'weather_storm', sea: 'map_port', port: 'anchor', boss_seen: 'danger', boss: 'danger',
  officer_dead: 'danger', crew_lost: 'stat_crew', wounded_died: 'stat_crew', level: 'xp', saga: 'tab_legends',
};

export type { SagaKind };
