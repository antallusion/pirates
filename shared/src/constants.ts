// Global tunables shared by server and client. Changing anything here that affects the
// simulation requires bumping PROTOCOL_VERSION so stale clients are rejected.

export const GAME_NAME = 'GRAVETIDE';
export const PROTOCOL_VERSION = 29;

export const TICK_RATE = 20; // server simulation Hz
export const TICK_DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY_TICKS = 2; // 10 Hz snapshots

export const WORLD_SEED = 0x6a7e71de;
export const WORLD_SIZE = 96_000; // meters, square world
export const CHUNK_SIZE = 3_000; // meters, static-data & interest chunk
export const CHUNKS_PER_SIDE = WORLD_SIZE / CHUNK_SIZE;
export const NAV_CELL = 400; // meters, coarse navigation grid for NPC routing

// The pace of the sea (owner, 2026-09-28: "the ships are far too slow — six times faster"). A ship's way is reckoned on
// the old scale — the knots in the HUD, the stats, every "heave to under 1.5 m/s", ramming and grounding — and carried
// across the world SPEED_SCALE times as fast; the shot flies as much faster, so a lead is the same length as before.
// The helm answers TURN_SCALE times as quick, so a fast ship still comes about in a sane circle.
// Owner, 2026-09-30: "too fast, I can't even aim" — halved from 6, the helm eased from 2.5 to match.
export const SPEED_SCALE = 3;
export const TURN_SCALE = 1.8;
// A following wind drives her on, a head wind holds her back: up to this share of her way in a full breeze.
export const WIND_PUSH = 0.45;
// …and a head wind holds her back by up to this share (docs/23 item 40: softer, so a chase is not a beat to windward).
export const WIND_HEAD = 0.22;

export const INTEREST_RADIUS = 2_200; // dynamic entities replicated within this radius
export const SNAP_NEAR = 700; // closer: every snapshot (10 Hz)
export const SNAP_MID = 1_600; // closer: every second snapshot; beyond: every fourth
// In a crowd, rank matters too: the nearest SNAP_RANK_NEAR ships at full rate, up to SNAP_RANK_MID at half, the rest a quarter.
export const SNAP_RANK_NEAR = 40;
export const SNAP_RANK_MID = 100;
// More ships than this in view: snapshots every SNAP_CROWD_EVERY ticks (5 Hz) for that captain.
export const SNAP_CROWD = 150;
export const SNAP_CROWD_EVERY = 4;
export const CHUNK_STREAM_RADIUS = 2; // chunks around the player whose static data is streamed
export const NPC_ACTIVE_RADIUS = 3_200; // NPCs promote from abstract to full physics inside this range

export const PORT_DOCK_RADIUS = 420; // distance from port anchor at which docking is allowed
export const DAY_LENGTH_SEC = 48 * 60; // one in-game day = 48 real minutes
export const LOOT_LIFETIME_SEC = 180;
export const LOGOUT_TIMER_SEC = 30; // ship lingers at sea after disconnect (anti combat-log)
export const COMBAT_TAG_SEC = 20;

export const MAX_LEVEL = 60;
export const SAIL_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

// The curve of experience (docs/26, owner 2026-10-08: «чем больше уровень, тем больше кораблей потопить, абордажей
// сделать и квестов выполнить»). Everything is reckoned in one unit: what a ship of her own level sunk teaches a captain
// (XP_UNIT). A level asks a number of such ships that grows with the level — five at the first, about thirty at the
// tenth, seventy at the thirtieth, two hundred and more past the fiftieth — so the time to a level grows smoothly from
// minutes to hours, as in WoW. Every source of experience is a number of these units (shared/src/data/xpcurve.ts).

/** What one ship of her own level sunk teaches a captain of this level. */
export function xpUnit(level: number): number {
  return 40 + 10 * Math.max(1, Math.min(MAX_LEVEL, level));
}

/** Ships of her own level sunk from `level` to the next (docs/26): K(L) = 6·L^0.7 — five at the first, thirty at the
 *  tenth, eighty at the thirtieth — and past the thirtieth a climb of 6.5% more a level, eased in over a few levels
 *  (a softplus about the 32nd: the slope of ln K grows smoothly, no step) — about 150 at the fortieth, 300 at the
 *  fiftieth, 600 at the last. */
export function killsPerLevel(level: number): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, level));
  const soft = (x: number): number => Math.log1p(Math.exp(x));
  return KPL_BASE * Math.pow(L, KPL_POW) * Math.exp(KPL_CLIMB * KPL_EASE * (soft((L - KPL_FROM) / KPL_EASE) - soft((1 - KPL_FROM) / KPL_EASE)));
}
export const KPL_BASE = 5.9;
export const KPL_POW = 0.7;
export const KPL_CLIMB = 0.065;
export const KPL_FROM = 32;
export const KPL_EASE = 6;

/** XP required to go from `level` to `level + 1`: her own level's ships to the next level × what each teaches, rounded
 *  to two or three figures (the captain reads it on her sheet). */
export function xpForLevel(level: number): number {
  const x = killsPerLevel(level) * xpUnit(level);
  const step = x < 1000 ? 10 : x < 10000 ? 50 : x < 100000 ? 100 : 1000;
  return Math.round(x / step) * step;
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
