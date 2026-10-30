// The hold and the overload (forum, Нефигугум, 2026-10-30: «трюм» under the bars and «ПЕРЕГРУЗ»). A hold filled to
// OVERLOAD_AT of her volume slows her by OVERLOAD_SLOW; past the brim (a hold can run over when a refit or a lost module
// shrinks it) by OVERLOAD_SLOW_OVER. The merchantmen — the fleet's «trade» and «hauler» lists — are built to sail deep:
// theirs is OVERLOAD_AT_TRADE, so a trader decides whether to fill her to the hatches or keep room for salvage.
// Server (ship.ts sailParams) and client (state.ts updateOwn) both multiply her speed by overloadMul.

import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { cargoVolume } from '../sim/shipstats.ts';
import type { Cargo, ShipStats } from '../sim/shipstats.ts';

export const OVERLOAD_AT = 0.9;
export const OVERLOAD_AT_TRADE = 0.99;
/** −20 % of her speed from the line… */
export const OVERLOAD_SLOW = 0.2;
/** …−35 % with the hold over the brim. */
export const OVERLOAD_SLOW_OVER = 0.35;
/** The hold bar turns amber here. */
export const HOLD_WARN = 0.8;

/** The fill at which this hull is overloaded. */
export function overloadAt(classId: ShipClassId | string): number {
  const list = SHIP_CLASSES[classId as ShipClassId]?.list;
  return list === 'trade' || list === 'hauler' ? OVERLOAD_AT_TRADE : OVERLOAD_AT;
}

/** Her hold's fill, 0..(over 1), as every hold check reckons it (the hull's volume multipliers). */
export function holdFill(cargo: Cargo, st: Pick<ShipStats, 'holdVolume' | 'contrabandVolumeMul' | 'materialVolumeMul' | 'provisionVolumeMul' | 'cursedVolumeMul'>): number {
  if (!(st.holdVolume > 0)) return 0;
  return cargoVolume(cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) / st.holdVolume;
}

/** 0 sails free, 1 overloaded, 2 over the brim. */
export function overloadLevel(classId: ShipClassId | string, fill: number): 0 | 1 | 2 {
  if (fill > 1 + 1e-6) return 2;
  return fill >= overloadAt(classId) - 1e-9 ? 1 : 0;
}

/** Her share of speed lost to the hold. */
export function overloadSlow(classId: ShipClassId | string, fill: number): number {
  const lv = overloadLevel(classId, fill);
  return lv === 2 ? OVERLOAD_SLOW_OVER : lv === 1 ? OVERLOAD_SLOW : 0;
}

/** The multiplier on her speed. */
export function overloadMul(classId: ShipClassId | string, fill: number): number {
  return 1 - overloadSlow(classId, fill);
}

/** The hold as the HUD's fourth bar shows it (PrivateState.hold). */
export interface HoldView {
  /** m³ used and the hold's volume. */
  used: number;
  max: number;
  /** Whole per cent of the hold filled. */
  pct: number;
  /** The per cent at which this hull is overloaded (90 or 99). */
  at: number;
  /** 0 free, 1 overloaded, 2 over the brim. */
  over: 0 | 1 | 2;
  /** Per cent of speed lost (0, 20, 35). */
  slow: number;
}

export function holdView(classId: ShipClassId | string, cargo: Cargo, st: Pick<ShipStats, 'holdVolume' | 'contrabandVolumeMul' | 'materialVolumeMul' | 'provisionVolumeMul' | 'cursedVolumeMul'>): HoldView {
  const fill = holdFill(cargo, st);
  return {
    used: Math.round(fill * st.holdVolume * 10) / 10,
    max: Math.round(st.holdVolume),
    pct: Math.floor(fill * 100 + 1e-6),
    at: Math.round(overloadAt(classId) * 100),
    over: overloadLevel(classId, fill),
    slow: Math.round(overloadSlow(classId, fill) * 100),
  };
}
