// The crew while the captain is away (forum post 45, approved by the owner): «на море команда ест провизию, а в порту
// они бухают и тратят». Settled once, when she comes back aboard, by where her ship lay:
//   · at sea — the men eat the provisions, on short rations at anchor (SEA_FOOD_SHARE of the sailing mess an hour);
//   · in port — no provisions, they draw silver ashore instead (PORT_WAGE_SHARE of their sea wages an hour).
// Gentle by design: at most AWAY_CAP_H hours are counted, the purse and the hold never go below zero, and what is short
// costs morale and a few deserters (at most DESERT_MAX of the crew, never under her sailing minimum) — never her ship.
// A newcomer (level < NEWCOMER_LEVEL) pays half and loses no one. Pure: the server settles by it (crewaway.ts), the
// tests weigh it.

import { provisionsPerMinute } from './voyage.ts';

/** Hours counted at most, however long she was away. */
export const AWAY_CAP_H = 24;
/** Under this many hours away there is nothing to settle (a reconnect, a short break). */
export const AWAY_SETTLE_MIN_H = 0.25;
/** At sea, at anchor on short rations: this share of the sailing mess an hour. */
export const SEA_FOOD_SHARE = 0.25;
/** In port, ashore: this share of the sea wages an hour, drunk and spent. */
export const PORT_WAGE_SHARE = 0.25;
/** The most of the crew that deserts when nothing at all was paid or eaten (a part short: a part of it). */
export const DESERT_MAX = 0.15;
/** Morale lost when nothing at all was paid or eaten (a part short: a part of it), never under MORALE_FLOOR. */
export const MORALE_LOSS = 30;
export const MORALE_FLOOR = 25;
/** A newcomer's grace: below this level the bill is halved and nobody deserts. */
export const NEWCOMER_LEVEL = 6;

export interface AwayCrewIn {
  /** Hours since she went ashore. */
  hours: number;
  /** Where her ship lay: at sea (provisions) or in port (silver). */
  atSea: boolean;
  level: number;
  crew: number;
  crewMin: number;
  /** The mouths on provisions (the crew less the creatures aboard, who eat their own). */
  eaters: number;
  provisionUse: number;
  provisions: number;
  gold: number;
  /** Her sea wages an hour (crew.ts wagesPerHour × Fair Share). */
  wagesPerHour: number;
  morale: number;
}

export interface AwayCrewOut {
  /** The hours counted (capped). */
  hours: number;
  capped: boolean;
  atSea: boolean;
  /** Provisions eaten, and what more they wanted. */
  food: number;
  foodShort: number;
  /** Silver drawn, and what more they wanted. */
  silver: number;
  silverShort: number;
  /** The share of the bill unmet, 0..1. */
  short: number;
  deserted: number;
  morale: number;
  newcomer: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What her crew ate or drank while she was away, what was short, and what it cost her. */
export function settleAwayCrew(o: AwayCrewIn): AwayCrewOut {
  const hours = Math.max(0, Math.min(AWAY_CAP_H, o.hours));
  const newcomer = o.level < NEWCOMER_LEVEL;
  const ease = newcomer ? 0.5 : 1;
  let food = 0, foodShort = 0, silver = 0, silverShort = 0, want = 0, got = 0;
  if (o.atSea) {
    want = provisionsPerMinute(Math.max(0, o.eaters), o.provisionUse) * 60 * hours * SEA_FOOD_SHARE * ease;
    food = r2(Math.min(Math.max(0, o.provisions), want));
    foodShort = r2(Math.max(0, want - food));
    got = food;
  } else {
    want = Math.round(Math.max(0, o.wagesPerHour) * hours * PORT_WAGE_SHARE * ease);
    silver = Math.min(Math.floor(Math.max(0, o.gold)), want);
    silverShort = want - silver;
    got = silver;
  }
  const short = want > 0 ? Math.max(0, Math.min(1, (want - got) / want)) : 0;
  const room = Math.max(0, o.crew - Math.max(1, o.crewMin));
  const deserted = newcomer || short <= 0 ? 0 : Math.min(room, Math.floor(o.crew * DESERT_MAX * short));
  let morale = o.morale;
  if (short > 0) morale = Math.min(morale, Math.max(MORALE_FLOOR, morale - MORALE_LOSS * short));
  else if (hours > 0) morale = Math.max(morale, Math.min(o.atSea ? 70 : 80, morale + 5 * hours)); // fed at anchor, merry ashore
  return { hours: r2(hours), capped: o.hours > AWAY_CAP_H, atSea: o.atSea, food, foodShort, silver, silverShort, short: r2(short), deserted, morale: Math.round(morale), newcomer };
}
