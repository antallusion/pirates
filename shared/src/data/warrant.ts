// The Admiralty's warrants for the two highest rates (owner, 2026-11-23: «9 и 10 корабли это самое желанное… для новых
// игроков эта веха должна быть почти невыполнима и требовать минимум 400 часов игры непрерывной с 8 по 9 и ещё сверху
// 600 часов до 10 и очень много ресурсов и денег»). A ship of ⚓9 — whichever way she comes: a refit, a hull bought new,
// a premium hull, one launched or taken out of a berth — is commanded only under the Warrant of the First Rate; a ship
// of ⚓10 only under the Admiral's Warrant. A warrant is earned by experience gained in command of a ship of the rate
// below (⚓8 for the first, ⚓9 for the admiral's — tests/warrant.test.ts holds it at 400 and 600 hours of mixed play at
// the fastest pace there is, the Throne's level), and bought at a great yard's Admiralty office (a yard of tier 4 or
// more) with a fortune in silver, the great beasts' and the deep's rarest goods, and hearts of the storm — handed in a
// part at a time, as a captain brings them. The captains who held such ships on the day the rule came keep them: their
// warrants are given (server/src/game/warrant.ts).

import type { GoodId } from './goods.ts';

export type WarrantRate = 9 | 10;

export interface WarrantDef {
  rate: WarrantRate;
  name: string;
  /** Experience in command of a ship of this level or more counts toward the warrant. */
  earnedOn: number;
  /** The experience it asks (the captain's own, as she earns it, in command of a ship of `earnedOn`). */
  xp: number;
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  hearts: number;
}

/** The fastest mixed hour there is (tests/balance/xp.ts mixedHour at the Throne's level, where xpUnit stops growing):
 *  24 500. 400 such hours to the first rate, 600 more to the admiral's; slower captains take longer. */
export const WARRANT_XP_HOUR = 24_500;

export const WARRANTS: Record<WarrantRate, WarrantDef> = {
  9: {
    rate: 9, name: 'Warrant of the First Rate', earnedOn: 8, xp: 400 * WARRANT_XP_HOUR,
    // ~210 hours of a ⚓8 captain's income at sea (seaHour 12 000), and some 330 000 more in goods
    silver: 2_500_000,
    goods: { leviathan_bone: 300, abyssal_ore: 200, kraken_ink: 120, sulfur_iron: 250, narwhal_tusk: 80, ambergris: 60 },
    hearts: 2,
  },
  10: {
    rate: 10, name: 'Admiral’s Warrant', earnedOn: 9, xp: 600 * WARRANT_XP_HOUR,
    // ~380 hours of a ⚓9 captain's income at sea (seaHour 15 700), and some 1 000 000 more in goods
    silver: 6_000_000,
    goods: { leviathan_bone: 800, abyssal_ore: 500, kraken_ink: 300, drowned_silk: 300, cursed_relics: 200, narwhal_tusk: 150, ambergris: 150 },
    hearts: 5,
  },
};

/** The warrant a ship of this level asks (null: none). */
export function warrantFor(shipLevel: number): WarrantRate | null {
  return shipLevel >= 10 ? 10 : shipLevel >= 9 ? 9 : null;
}

/** A captain's warrants: the highest held, the experience toward each, what she has handed in. */
export interface WarrantState {
  /** The highest warrant held: 0, 9 or 10. */
  has: number;
  /** Experience toward each warrant. */
  xp: Partial<Record<WarrantRate, number>>;
  /** Handed in toward each: silver, goods, hearts. */
  paid: Partial<Record<WarrantRate, { silver: number; goods: Partial<Record<GoodId, number>>; hearts: number }>>;
  /** The day the rule came: her ships of ⚓9–10 then looked at once (given the warrants they need). */
  seen?: 1;
}

/** What the port's shipyard shows of the warrant she works toward (none: below ⚓8, or both held). */
export interface WarrantView {
  rate: WarrantRate;
  name: string;
  xp: number;
  xpNeed: number;
  silver: number;
  silverNeed: number;
  goods: { good: GoodId; paid: number; need: number; have: number }[];
  hearts: number;
  heartsNeed: number;
  heartsHave: number;
  /** The office is here (a great yard). */
  here: boolean;
}
