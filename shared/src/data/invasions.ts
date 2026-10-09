// docs/19 E16: the Choir's invasions. Every few hours (INV_EVERY, by the wall clock) the Choir of the Deep gathers off
// a port of one of the sea's regions — never the Black Coast, where every captain starts, never a region already
// under the black tide — and the whole sea hears of it INV_WARN ahead. Then it comes in INV_WAVES waves of its ships
// (the Choir's own roster aboard: factionunits.ts rosterArmy('choir')), each wave rising when the last is sunk or
// taken; the last wave led by a flagship a level above the waters. Its defence is a common cause of the server (as
// docs/11 P6's): a bar every captain sees, every hand that fired on a ship of the Choir or sank or took one counted,
// and when the last wave falls in time every hand is paid by her part. If the time runs out first, the Choir holds
// the region: the black tide lies on it for TIDE_TIME — the Choir's patrols sail its waters, its ports buy dear and
// pay little (TIDE_PRICE), and the chart darkens over it.
//
// Balance (tests/balance/invasions.ts, `node tools/balance-invasions.ts`): a wave of the waters' level falls to a
// group of 3–5 captains of that level (INV_WAVE_SHIPS against 3, 4, 5).

import type { RegionId } from '../world/regions.ts';
import { seaHourOf } from './seamarks.ts';
import { XP_UNITS, lumpXp } from './xpcurve.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Between one invasion's end and the next's news (wall ms). */
export const INV_EVERY: [number, number] = [4 * HOUR, 6 * HOUR];
/** The news before the first wave. */
export const INV_WARN = 10 * MIN;
/** From the first wave: the time to beat them all. */
export const INV_TIME = 45 * MIN;
/** The waves, and the ships in each (the last led by a flagship a level up). */
export const INV_WAVES = 3;
export const INV_WAVE_SHIPS = [3, 3, 3];
/** A wave beaten: the next rises after this. */
export const INV_GAP = MIN;
/** The black tide's day, its patrols, its prices. */
export const TIDE_TIME = 24 * HOUR;
export const TIDE_PATROLS = 4;
export const TIDE_PRICE = { buy: 1.15, sell: 0.85 };
/** A patrol of the tide sunk: the next puts out after this. */
export const TIDE_RESPAWN = 3 * MIN;
/** Where the Choir gathers: off a port of the region, in open water this far out. */
export const INV_OFFSHORE = 2600;

/** The regions the Choir invades (the starting waters are spared). */
export const INV_REGIONS: RegionId[] = ['gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'dead_mans_expanse', 'drowned_crown', 'the_abyss'];

export const invTotal = (): number => INV_WAVE_SHIPS.reduce((a, b) => a + b, 0);

/** What a hand in a beaten invasion is paid: a share of an hour at sea of the waters' level by her part (each ship of
 *  the Choir she fired on or sank counts), up to an hour and a fifth; the lesson of a common cause, more for more. */
export function invPay(captainLevel: number, waterLevel: number, hands: number): { silver: number; xp: number } {
  const h = Math.max(0, hands);
  return {
    silver: Math.round(seaHourOf(waterLevel) * Math.min(1.2, 0.2 + 0.1 * h)),
    xp: lumpXp(captainLevel, XP_UNITS.goal * (1 + Math.min(1.5, h / 4))),
  };
}

/** The Choir's ships' names and their captains' (the sea's lines: client/src/lang/server.ru.relics.ts). */
export const CHOIR_SHIPS = ['Hymn of the Drowned', 'Psalm of Brine', 'The Tolling Deep', 'Canticle of Salt', 'The Kneeling Tide', 'Vesper of the Abyss', 'The Choirmaster’s Bell', 'Litany of the Wrecks', 'The Hushed Anthem', 'Requiem Below'];
export const CHOIR_CAPTAINS = ['Cantor Ilse', 'Deacon of the Deep', 'Sister Brinewater', 'The Pale Precentor', 'Abbot Morrow', 'Chanter Vael'];
export const CHOIR_FLAGSHIP = { ship: 'The Black Choir', captain: 'The Precentor of the Abyss' };

/** What a captain sees of the invasion (WorldView.invasion). */
export interface InvasionView {
  /** The invasion afoot: told of (`warn`, endsIn to its first wave), or come (`on`, endsIn to its end). */
  cur?: {
    stage: 'warn' | 'on';
    region: RegionId;
    x: number;
    y: number;
    level: number;
    wave: number;
    waves: number;
    afloat: number;
    beaten: number;
    total: number;
    mine: number;
    endsIn: number;
    leaders: { name: string; n: number }[];
  };
  /** The regions under the black tide, the seconds left of each. */
  tides: { region: RegionId; endsIn: number }[];
}
