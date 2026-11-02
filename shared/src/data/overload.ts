// The hold and the overload (forum, Нефигугум, 2026-10-30: «трюм» under the bars and «ПЕРЕГРУЗ»). A hold whose TRADE
// cargo fills OVERLOAD_AT of her volume slows her by OVERLOAD_SLOW; past the brim (all she carries, the stores too: a
// hold can run over when a refit or a lost module shrinks it, or an old save's goods got bulkier) by OVERLOAD_SLOW_OVER.
// Owner, 2026-11-02: the line is HALF the hold (it was 90 %), and only the trade goods count — the ship's stores
// (provisions, sailcloth, planks: goods.ts isStore) take their small room but never make her overloaded. The merchantmen —
// the fleet's «trade» and «hauler» lists — keep their bonus in proportion: their line is three quarters (it was 99 %),
// so a trader decides whether to fill her to the hatches or keep her way.
// Server (ship.ts sailParams) and client (state.ts updateOwn) both multiply her speed by holdSpeedMul.

import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { cargoVolume, tradeVolume } from '../sim/shipstats.ts';
import type { Cargo, ShipStats } from '../sim/shipstats.ts';

export const OVERLOAD_AT = 0.5;
export const OVERLOAD_AT_TRADE = 0.75;
/** −20 % of her speed from the line… */
export const OVERLOAD_SLOW = 0.2;
/** …−35 % with the hold over the brim. */
export const OVERLOAD_SLOW_OVER = 0.35;
/** The hold bar turns amber at this share of her hull's line (40 % of the hold on a warship, 60 % on a merchantman). */
export const HOLD_WARN = 0.8;

/** The fill at which her hold bar turns amber. */
export function holdWarnAt(classId: ShipClassId | string): number {
  return overloadAt(classId) * HOLD_WARN;
}

/** The fill at which this hull is overloaded. */
export function overloadAt(classId: ShipClassId | string): number {
  const list = SHIP_CLASSES[classId as ShipClassId]?.list;
  return list === 'trade' || list === 'hauler' ? OVERLOAD_AT_TRADE : OVERLOAD_AT;
}

type HoldStats = Pick<ShipStats, 'holdVolume' | 'contrabandVolumeMul' | 'materialVolumeMul' | 'provisionVolumeMul' | 'cursedVolumeMul'>;

/** Her hold's TRADE fill, 0..(over 1): the trade cargo's share of the hold (the hull's volume multipliers; the ship's
 *  stores left out) — what the overload, the ferry and the neutral flag reckon. */
export function holdFill(cargo: Cargo, st: HoldStats): number {
  if (!(st.holdVolume > 0)) return 0;
  return tradeVolume(cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) / st.holdVolume;
}

/** Her hold's whole fill, the stores too: the room left for buying, and over the brim. */
export function holdTotal(cargo: Cargo, st: HoldStats): number {
  if (!(st.holdVolume > 0)) return 0;
  return cargoVolume(cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) / st.holdVolume;
}

/** 0 sails free, 1 overloaded (her trade cargo at her hull's line), 2 over the brim (all she carries past the hold). */
export function overloadLevel(classId: ShipClassId | string, fill: number, total = fill): 0 | 1 | 2 {
  if (total > 1 + 1e-6 || fill > 1 + 1e-6) return 2;
  return fill >= overloadAt(classId) - 1e-9 ? 1 : 0;
}

/** Her share of speed lost to the hold. */
export function overloadSlow(classId: ShipClassId | string, fill: number, total = fill): number {
  const lv = overloadLevel(classId, fill, total);
  return lv === 2 ? OVERLOAD_SLOW_OVER : lv === 1 ? OVERLOAD_SLOW : 0;
}

/** The multiplier on her speed. */
export function overloadMul(classId: ShipClassId | string, fill: number, total = fill): number {
  return 1 - overloadSlow(classId, fill, total);
}

/** The multiplier on her speed by what she carries (server and client alike). */
export function holdSpeedMul(classId: ShipClassId | string, cargo: Cargo, st: HoldStats): number {
  return overloadMul(classId, holdFill(cargo, st), holdTotal(cargo, st));
}

/** The hold as the HUD's fourth bar shows it (PrivateState.hold). */
export interface HoldView {
  /** m³ of TRADE cargo and the hold's volume. */
  used: number;
  max: number;
  /** m³ the ship's stores take besides (never counted against the line). */
  stores: number;
  /** Whole per cent of the hold the trade cargo fills. */
  pct: number;
  /** The per cent at which her bar turns amber (HOLD_WARN of her line). */
  warn: number;
  /** The per cent at which this hull is overloaded (50, or 75 on a merchantman). */
  at: number;
  /** 0 free, 1 overloaded, 2 over the brim. */
  over: 0 | 1 | 2;
  /** Per cent of speed lost (0, 20, 35). */
  slow: number;
}

export function holdView(classId: ShipClassId | string, cargo: Cargo, st: HoldStats): HoldView {
  const fill = holdFill(cargo, st), total = holdTotal(cargo, st);
  return {
    used: Math.round(fill * st.holdVolume * 10) / 10,
    max: Math.round(st.holdVolume),
    stores: Math.round(Math.max(0, total - fill) * st.holdVolume * 100) / 100,
    pct: Math.floor(fill * 100 + 1e-6),
    warn: Math.round(holdWarnAt(classId) * 100),
    at: Math.round(overloadAt(classId) * 100),
    over: overloadLevel(classId, fill, total),
    slow: Math.round(overloadSlow(classId, fill, total) * 100),
  };
}
