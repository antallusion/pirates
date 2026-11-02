// «Шлюпы с острова» (owner, 2026-11-02: «Если я нахожусь где-то далеко, то я могу нанять прямо в море существ со своего
// острова, которые будут на шлюпах плыть в мою сторону. И мощность этого шлюпа, его скорость будет обусловлена уровнем
// здания… имеет смысл сделать это в ратуше… Скорость у шлюпов должна быть очень большая, где-то раз в 10 быстрее, чем у
// корабля»). No building of its own: the town hall's level drives it. The server's rules: server/src/game/isleboats.ts.
//
// Far from her island (at sea, not in port, not lying off it, not in a boarding) she opens her island's hire window: the
// men waiting in its dwellings at the island's own prices (no port's markup), paid from the purse and the island's yard
// and store. What she picks goes into the boats instead of aboard; «Отправить шлюпы» sends them. The boats put out from
// the island and run her down wherever she sails, round the land; within ARRIVE_M of her hull the men come aboard as a
// hire does (their stacks by the same rules; the gift stacks untouched).
//
// The town hall's level (1–5):
//  - the boats' way: BOAT_MUL × her hull's top speed — ×10 at the first level, ×14 at the fifth;
//  - a trip's load: BOAT_STACKS kinds of men and BOAT_MEN_SHARE of her hammocks (BOAT_MEN_MIN at least);
//  - the boats on the water (BOAT_COUNT: what is seen);
//  - the wait between two trips, from the one sent: BOAT_COOLDOWN_MIN minutes;
//  - the delivery's fee in silver: a share of the men's price, BOAT_FEE_BASE and BOAT_FEE_KM a kilometre of the run, no
//    more than BOAT_FEE_MAX, the hall's discount BOAT_FEE_HALL on it; BOAT_FEE_MIN silver at least.

/** The town hall's levels. */
export const BOAT_HALL_MAX = 5;
/** The boats' way, × her hull's top speed. */
export const BOAT_MUL = [10, 11, 12, 13, 14] as const;
/** Kinds of men (stacks) a trip carries. */
export const BOAT_STACKS = [1, 1, 2, 2, 3] as const;
/** Men a trip carries, as a share of her hammocks. */
export const BOAT_MEN_SHARE = [0.25, 0.35, 0.5, 0.7, 1] as const;
/** …and at least this many. */
export const BOAT_MEN_MIN = 6;
/** Boats on the water. */
export const BOAT_COUNT = [1, 2, 2, 3, 3] as const;
/** Minutes between two trips (from the one sent). */
export const BOAT_COOLDOWN_MIN = [10, 8, 6, 4.5, 3] as const;
/** The fee: a share of the men's price. */
export const BOAT_FEE_BASE = 0.05;
export const BOAT_FEE_KM = 0.01;
export const BOAT_FEE_MAX = 0.3;
/** The hall's discount on the fee (× by level). */
export const BOAT_FEE_HALL = [1, 0.9, 0.8, 0.7, 0.6] as const;
export const BOAT_FEE_MIN = 10;
/** The boats come alongside within this of her hull (metres); in port, within PORT_M of her berth. */
export const ARRIVE_M = 60;
export const PORT_M = 600;

const lv = (hall: number) => Math.max(1, Math.min(BOAT_HALL_MAX, Math.floor(hall))) - 1;

/** The boats' speed, m/s: her hull's top speed (m/s) × the hall's multiplier. */
export const boatSpeed = (hall: number, shipTop: number): number => BOAT_MUL[lv(hall)] * Math.max(1, shipTop);
export const boatStacks = (hall: number): number => BOAT_STACKS[lv(hall)];
export const boatCount = (hall: number): number => BOAT_COUNT[lv(hall)];
/** Men a trip carries for her hammocks. */
export const boatMen = (hall: number, crewMax: number): number => Math.max(BOAT_MEN_MIN, Math.floor(crewMax * BOAT_MEN_SHARE[lv(hall)]));
/** Seconds between two trips. */
export const boatCooldown = (hall: number): number => Math.round(BOAT_COOLDOWN_MIN[lv(hall)] * 60);
/** The fee's share of the men's price for a run of `km`. */
export const boatFeeShare = (hall: number, km: number): number => Math.min(BOAT_FEE_MAX, BOAT_FEE_BASE + BOAT_FEE_KM * Math.max(0, km)) * BOAT_FEE_HALL[lv(hall)];
/** The fee in silver for men worth `silver`, a run of `km`. */
export const boatFee = (hall: number, km: number, silver: number): number => Math.max(BOAT_FEE_MIN, Math.ceil(Math.max(0, silver) * boatFeeShare(hall, km)));

/** What the hire window shows in its boats' mode (DwellView.boat). */
export interface BoatsInfo {
  /** The town hall's level. */
  hall: number;
  /** Her ship's level (the might cap of the men loaded together, counted in the window). */
  level: number;
  /** A trip's load: kinds of men and men. */
  stacks: number;
  men: number;
  /** Boats on the water. */
  boats: number;
  /** The boats' multiplier and way (m/s). */
  mul: number;
  v: number;
  /** The run from the island to her now (km) and its time (s, straight). */
  km: number;
  eta: number;
  /** The fee's share of the men's price now. */
  fee: number;
  /** Seconds between two trips; seconds until the next may go (0: now). */
  cooldown: number;
  readyIn: number;
  /** A trip under way already. */
  busy: boolean;
}

/** The boats under way, for her HUD (PrivateState.boats): where they are on the sea's clock and where they run. */
export interface BoatsView {
  /** Their place at `at` (world seconds), their way (m/s), the way ahead (the last point her hull then). */
  x: number;
  y: number;
  at: number;
  v: number;
  path: [number, number][];
  /** Metres to her and the seconds left (straight along the way). */
  left: number;
  eta: number;
  /** When they put out (world seconds), the boats on the water, the men aboard them. */
  started: number;
  boats: number;
  men: number;
  units: { u: string; n: number }[];
  /** Waiting for her: a boarding, her ship lost, her mooring. */
  wait?: boolean;
}

/** «0:42»: minutes and seconds (hours over an hour). */
export function boatsClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Where the boats are at world time `now`: carried from their last place along the way ahead. */
export function boatsAt(v: Pick<BoatsView, 'x' | 'y' | 'at' | 'v' | 'path' | 'wait'>, now: number): { x: number; y: number; h: number } {
  let d = v.wait ? 0 : Math.max(0, now - v.at) * v.v;
  let x = v.x, y = v.y, h = 0;
  for (const [qx, qy] of v.path) {
    const L = Math.hypot(qx - x, qy - y);
    if (L > 1e-6) h = Math.atan2(qx - x, -(qy - y));
    if (L >= d) {
      const t = L > 0 ? d / L : 0;
      return { x: x + (qx - x) * t, y: y + (qy - y) * t, h };
    }
    d -= L;
    x = qx;
    y = qy;
  }
  return { x, y, h };
}
