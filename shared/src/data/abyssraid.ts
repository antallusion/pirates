// docs/19 E11: the Abyss of the Throne — the week's last raid over the Descent's Stair (descent.ts gateOf): seven tiers
// in the Maw of the World, each a legend's ship with a hero and her army, the seventh the Master of the Abyss with the
// whole book of orders and two titans among the deep's own. A group of up to five captains of the cap takes the raid
// on together: a tier's army is the group's to wear down — each captain's boarding cuts it, what is left of it stands
// for the next of them, all week — and a tier taken pays the group by the share of it each one cut down. Everything here
// is a function of the tier alone, the same for the server, the client and the balance tools.

import { armyForLevel, armyWeight } from './army.ts';
import type { ArmyMix, ArmyStack, UnitId } from './army.ts';
import type { CaptainId } from './captains.ts';
import type { Tr } from './estate.ts';
import { rosterArmy } from './factionunits.ts';
import type { Roster } from './factionunits.ts';
import { seaHourOf } from './seamarks.ts';

export const RAID_TIERS = 7;
/** Captains in one raid at the most. */
export const RAID_GROUP = 5;
/** Within this of the Stair's gate a tier's legend comes alongside. */
export const RAID_GATE_R = 900;
/** A tier's legend orders as a captain of ⚓10 does, her crew's strength times this (the castellans' and the
 *  Admiralty's legends' rule: counted from the whole of a tier's army, the first Musket Storm swept a deck). */
export const RAID_SPELL: readonly number[] = [1, 1.05, 1.1, 1.15, 1.2, 1.3, 1.45];

export interface RaidTier {
  n: number;
  name: Tr;
  ship: Tr;
  /** Its army: the sea's mix and roster, its weight in a boarding over the ladder's ⚓10 crew (armyWeight, the square
   *  law — the men are found to it: the deep's own are worth many times a man of the sea), and what stands with them. */
  mix: ArmyMix;
  roster: Roster | null;
  weight: number;
  extra: ArmyStack[];
  /** Its hero: her path, her primaries over the cap's, her skills' rank, the share of the book she carries. */
  path: CaptainId;
  prim: number;
  rank: 1 | 2 | 3 | 4;
  book: number;
}

const T = (n: number, name: Tr, ship: Tr, mix: ArmyMix, roster: Roster | null, weight: number, extra: ArmyStack[], path: CaptainId, prim: number, rank: RaidTier['rank'], book: number): RaidTier =>
  ({ n, name, ship, mix, roster, weight, extra, path, prim, rank, book });

/** The seven (balance: tests/balance/abyssraid.ts — the boardings a tier asks of a group of the cap). */
export const RAID: readonly RaidTier[] = [
  T(1, ['The Drowned Commodore', 'Утонувший коммодор'], ['Last Breath', 'Последний вдох'], 'pirate', 'free', 1.3, [], 'corsair', 2, 2, 0.3),
  T(2, ['The Siren Admiral', 'Адмирал сирен'], ['Pale Chorus', 'Бледный хор'], 'navy', 'crown', 1.7, [], 'admiral', 4, 2, 0.4),
  T(3, ['The Hollow Bosun', 'Пустой боцман'], ['Rot Lantern', 'Гнилой фонарь'], 'deep', 'dutchman', 2.1, [], 'drowned', 6, 3, 0.5),
  T(4, ['The Coral Queen', 'Коралловая королева'], ['Reef Throne', 'Рифовый трон'], 'navy', 'league', 2.5, [{ u: 'young_kraken', n: 1 }], 'smuggler', 8, 3, 0.6),
  T(5, ['The Black Tide', 'Чёрный прилив'], ['Undertow', 'Подводное течение'], 'deep', 'choir', 2.9, [{ u: 'white_whale', n: 1 }], 'reaver', 10, 4, 0.75),
  T(6, ['The Herald of the Choir', 'Вестник Хора'], ['Bell of the Deep', 'Колокол глубин'], 'deep', 'choir', 3.3, [{ u: 'titan_leviathan', n: 1 }], 'navigator', 12, 4, 0.9),
  T(7, ['The Master of the Abyss', 'Хозяин Бездны'], ['Maw of the World', 'Пасть мира'], 'boss', 'choir', 3.8, [{ u: 'titan_kraken', n: 1 }, { u: 'titan_whale', n: 1 }], 'drowned', 15, 4, 1),
];

/** The ladder's ⚓10 crew in a boarding (the tiers' weights are its multiples). */
export const RAID_REF = armyWeight(armyForLevel(10, 600, 7, 'player'));

function build(t: RaidTier, men: number): ArmyStack[] {
  const army = armyForLevel(10, men, 7 - t.extra.length, t.mix);
  return [...rosterArmy(t.roster, army, 10).map((x) => ({ u: x.u as UnitId, n: x.n })), ...t.extra.map((x) => ({ ...x }))];
}

const armies = new Map<number, ArmyStack[]>();

/** A tier's army as it rises: the mix of the sea's own at ⚓10 under its roster with the creatures beside it (in a
 *  stack's slot each, the army's seven kept), as many men as bring it to its weight. */
export function raidArmy(tier: number): ArmyStack[] {
  const n = Math.max(1, Math.min(RAID_TIERS, tier));
  let a = armies.get(n);
  if (!a) {
    const t = RAID[n - 1], want = t.weight * RAID_REF;
    let lo = 20, hi = 6000;
    while (hi - lo > 4) {
      const mid = Math.round((lo + hi) / 2);
      if (armyWeight(build(t, mid)) < want) lo = mid;
      else hi = mid;
    }
    armies.set(n, (a = build(t, hi)));
  }
  return a.map((x) => ({ ...x }));
}

/** What a tier taken pays the group, before it is shared by what each cut down: a share of an hour at sea at ⚓10 a tier
 *  (the men it cost are each captain's own), and the lesson in units of her level; on the seventh, a relic to the one
 *  who cut most and an artifact's chance to the rest by their share (server/src/game/abyssraid.ts). */
export function raidPay(tier: number): { silver: number; units: number } {
  const t = Math.max(1, Math.min(RAID_TIERS, tier));
  return { silver: Math.round(seaHourOf(10) * (0.6 + 0.2 * t)), units: 1 + 0.5 * t };
}

/** Her raid as the Throne's tab shows it. */
export interface RaidView {
  week: number;
  /** The tier its legend waits at (RAID_TIERS + 1: the Master is down), the tiers taken. */
  tier: number;
  cleared: number[];
  /** What is left of the tier's army, and its share of the whole in hit points (%). */
  left: { u: UnitId; n: number }[];
  share: number;
  /** The Stair's gate (how far she lies from it, the client reckons — docs/19 E19). */
  gate: { x: number; y: number };
  /** Why she may not board the legend now (null: she may). */
  why: string | null;
  /** Its captains and the hit points each has cut down this week. */
  members: { name: string; cut: number; you?: boolean }[];
  board: { names: string[]; tiers: number }[];
  /** A captain of the raid aboard the legend now. */
  fighting?: string;
}
