// A captain's colours (docs/24 D1–D3, owner 2026-10-07): «нейтральный флаг, который можно вешать в портах, чтобы просто
// заниматься PvE. Пиратский флаг — на вас напасть могут все. И флаг какого-то там города или гильдии — могут нападать
// пираты и игроки. На нейтральный флаг только пираты NPC могут нападать иногда, очень редко».
// A new captain (and an old save) flies her city's colours, under the Green Pennant while she is young.
//   neutral — peace: no captain may fire on her or board her, and she fires on no captain and boards none; of the sea's
//             own captains only the pirates come for her, ten times more seldom than for anyone else;
//   faction — her city's colours (the port's she hoisted them in) or her guild's: pirates may come for her (the sea's,
//             and captains under the pirate flag), and the captains of a city at enmity with hers or of a guild at war
//             with hers;
//   pirate  — the black flag: any captain may come for her, and she for any captain (but one under neutral colours).
// The colours are hoisted only in port, and go up a while after they are ordered (no hiding under new ones mid-fight).
// The rest of the law stands as it was: no fighting between captains in the Crown's safe waters, the duels by consent,
// a group and a guild do not fire on their own, infamy for an attack that is no fair game.

import { factionRelation } from './factions.ts';
import type { FactionId } from './factions.ts';

export type Colours = 'neutral' | 'faction' | 'pirate';
export const COLOURS: readonly Colours[] = ['neutral', 'faction', 'pirate'];

/** New colours go up this long after they are ordered in port (wall-clock ms): leaving port before strikes the order. */
export const COLOURS_HOIST_MS = 60_000;
/** …and never sooner than this after her last fight with a captain (wall-clock ms): no running into port from a fight
 *  to come out under colours nobody may fire on. */
export const COLOURS_FIGHT_MS = 10 * 60_000;
/** A neutral captain is a pirate's prey this many times as often as anyone else (owner: «иногда, очень редко»). */
export const NEUTRAL_PIRATE_RATE = 0.1;
/** How long one of the sea's pirates keeps his mind about a neutral captain he has seen (world seconds). */
export const NEUTRAL_MIND_SEC = 600;
/** Two cities this far apart (factions.ts relation, −100…100) are at enmity: their captains are fair game for each
 *  other (the Crown and the Red Tide, the Crown and the Fog Brokers, the Choir and the lawful). */
export const CITY_ENMITY = -50;
/** The Green Pennant (docs/02 §10), now the colours' own: a young captain under her city's flag — below this level and
 *  this much time at sea, and no captain fired on by her in half an hour — is neutral to other captains in contested
 *  water; she may still fire first, and that strikes it for half an hour. */
export const PENNANT_LEVEL = 15;
export const PENNANT_SECONDS = 20 * 3600;
export const PENNANT_AGGRESSED_MS = 30 * 60_000;
/** Neutral colours are refused a captain the law wants this much (Wanted «Known Pirate»), and struck when she gets so. */
export const NEUTRAL_WANTED_MAX = 1;

export function isColours(v: unknown): v is Colours {
  return v === 'neutral' || v === 'faction' || v === 'pirate';
}

/** Two cities at enmity (never a city with itself). */
export function citiesHostile(a: FactionId, b: FactionId): boolean {
  return a !== b && factionRelation(a, b) <= CITY_ENMITY;
}

/** Why the colours bar `a` from attacking `b` between two captains, or null when they let her: `enemies` — their cities
 *  are at enmity or their guilds at war. The same both ways: whoever may attack may be attacked back. */
export type ColoursBar = 'own_neutral' | 'their_neutral' | 'not_enemies';
export function coloursBar(a: Colours, b: Colours, enemies: boolean): ColoursBar | null {
  if (a === 'neutral') return 'own_neutral';
  if (b === 'neutral') return 'their_neutral';
  if (a === 'pirate' || b === 'pirate') return null;
  return enemies ? null : 'not_enemies';
}
