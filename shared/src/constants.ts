// Global tunables shared by server and client. Changing anything here that affects the
// simulation requires bumping PROTOCOL_VERSION so stale clients are rejected.

export const GAME_NAME = 'GRAVETIDE';
export const PROTOCOL_VERSION = 4;

export const TICK_RATE = 20; // server simulation Hz
export const TICK_DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY_TICKS = 2; // 10 Hz snapshots

export const WORLD_SEED = 0x6a7e71de;
export const WORLD_SIZE = 96_000; // meters, square world
export const CHUNK_SIZE = 3_000; // meters, static-data & interest chunk
export const CHUNKS_PER_SIDE = WORLD_SIZE / CHUNK_SIZE;
export const NAV_CELL = 400; // meters, coarse navigation grid for NPC routing

export const INTEREST_RADIUS = 2_200; // dynamic entities replicated within this radius
export const CHUNK_STREAM_RADIUS = 2; // chunks around the player whose static data is streamed
export const NPC_ACTIVE_RADIUS = 3_200; // NPCs promote from abstract to full physics inside this range

export const PORT_DOCK_RADIUS = 420; // distance from port anchor at which docking is allowed
export const DAY_LENGTH_SEC = 48 * 60; // one in-game day = 48 real minutes
export const LOOT_LIFETIME_SEC = 180;
export const LOGOUT_TIMER_SEC = 30; // ship lingers at sea after disconnect (anti combat-log)
export const COMBAT_TAG_SEC = 20;

export const MAX_LEVEL = 30; // MVP cap; full game: 60
export const SAIL_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export function xpForLevel(level: number): number {
  // XP required to go from `level` to `level + 1`.
  return Math.round(120 * Math.pow(level, 1.55));
}

export function talentPointsForLevel(level: number): number {
  return Math.max(0, level - 1);
}

/** 0..1 where 0 = midnight, 0.5 = noon. */
export function timeOfDay(worldTimeSec: number): number {
  return ((worldTimeSec / DAY_LENGTH_SEC) + 0.35) % 1;
}

/** 0 at noon .. 1 at deep night. The world is mostly dusk and night by art direction. */
export function nightFactor(worldTimeSec: number): number {
  const t = timeOfDay(worldTimeSec);
  const c = Math.cos(t * Math.PI * 2); // 1 at midnight, -1 at noon
  return Math.min(1, Math.max(0, 0.55 + c * 0.6));
}

export function isNight(worldTimeSec: number): boolean {
  return nightFactor(worldTimeSec) > 0.7;
}
