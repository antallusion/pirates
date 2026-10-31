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
/** Neutral colours only with the hold at least this empty (owner, 2026-10-29: «нейтральным можно быть только если трюм
 *  свободен на 85%, по-другому в мирный режим зайти нельзя»): a trader who carries a hold's worth sails under colours
 *  that can be fought. */
export const NEUTRAL_HOLD_FREE = 0.85;

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

// The three flags and the sea's own ships (forum post 34, 2026-10-31; server/src/game/flaglaw.ts).
/** A skull lands her this much infamy into the next Wanted level: about ten minutes out of a fight to wash it off. */
export const SKULL_PAD = 30;
/** Infamy washed off a second out of a fight (Game.shipUpkeep; the Wanted talents add to it). */
export const WASH_PER_SEC = 0.05;
/** The Brethren's honour: a pirate-flag captain who fired on one of the sea's pirates is fair game to them this long. */
export const HONOUR_SEC = 600;
/** A merchant or a fisher runs from a pirate-flag captain this near. */
export const MERCHANT_FLEE_R = 650;
/** The hue and cry after a skulled pirate: the patrols this near take her for their chase and crowd on sail (+15% way);
 *  in the Crown's safe water half again as far. */
export const HUE_R = 3200;
export const HUE_SAFE_MUL = 1.5;
export const HUE_SPEED = 0.15;
/** …and a lawful harbour this near sends a patrol out after her every HUE_SALLY_SEC, her skulls' worth at once (one more
 *  in safe water), HUE_SALLY_MAX at most. */
export const HUE_PORT_R = 6000;
export const HUE_SALLY_SEC = 75;
export const HUE_SALLY_MAX = 3;
/** Said when the colours keep her guns off a peaceful ship (the client adds its «Поднять пиратский флаг»). */
export const PEACE_SAY = 'Attacking peaceful ships is for the pirate flag only: hoist it in port.';
/** Said when her skulls keep her colours up. */
export const FLAG_LOCK_SAY = 'With skulls on you, your colours stay as they are: wash them off first — time out of fights, or a pardon in a pirate haven.';
