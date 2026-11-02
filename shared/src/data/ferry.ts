// «Переход» between hub ports (owner, 2026-10-30, after Нефигугум's post 22 in forum topic 7: «несколько ключевых
// портов … с функцией ПЕРЕХОД, как телепорты … та же анимация … кулдаун 30–60 минут … за серебро, но не люто дорого»).
// The free ×10 auto-voyage for any far mark stays off (passage.ts VOYAGE.on = false); only these hub-to-hub trips are
// fast: paid in silver, one per FERRY_COOLDOWN_SEC per captain, server-validated (server/src/game/ferry.ts).

/** The hub ports: a capital or a major harbour in each corner of the sea the law or the trade holds — never the
 *  lawless waters (the Ashen Isles, Dead Man's Expanse, the Drowned Crown, the Abyss are sailed to). */
export const FERRY_HUBS: readonly string[] = [
  'gravesend', // the Black Coast, the Crown's capital (safe, south-west)
  'hollowmere', // Gravewater, the League's capital (contested, south)
  'tidewrack', // Gravewater, the free port (contested, south-east)
  'fogmouth', // the Whispering Archipelago, the Brokers' town (contested, west)
  'widows_wick', // the Whispering Archipelago, the tallest lighthouse in the fog (contested, north-west)
  'frostgate', // Leviathan Reach, the Order's walled town (contested, north)
  'sealhold', // Leviathan Reach, on the ice shelf (contested, north-east)
];

export function isFerryHub(portId: string | null | undefined): boolean {
  return !!portId && FERRY_HUBS.includes(portId);
}

/** The price (owner, 2026-10-30; softened 2026-11-02 after Эдуард's post 49 in topic 7: «Переход» was dearer than
 *  the voyage and its hour's cooldown worse): it still rises steeply with the straight distance (the power FERRY_POW) —
 *  the nearest pair of hubs (16.7 km) about 800, the farthest (78.2 km, across the whole sea) 15 000 — rounded to 50.
 *  It was 1 700 … 50 000. */
export const FERRY_TOP = 15_000;
export const FERRY_FAR_KM = 78.2;
export const FERRY_POW = 1.9;
export const FERRY_MIN = 800;

export function ferryPrice(metres: number): number {
  const t = Math.min(1, Math.max(0, metres) / 1000 / FERRY_FAR_KM);
  const raw = Math.max(FERRY_MIN, FERRY_TOP * t ** FERRY_POW);
  return Math.min(FERRY_TOP, Math.round(raw / 50) * 50);
}

/** The pirate flag pays double (post 49: the black flag is no tourist's ticket). */
export const FERRY_PIRATE_MUL = 2;
/** A passage to the hub nearest an active quest's goal pays a quarter: the trip that serves the work is cheap. */
export const FERRY_QUEST_MUL = 0.25;

/** A route's price for her: the base, ×FERRY_PIRATE_MUL under the black flag, ×FERRY_QUEST_MUL for her quest's hub —
 *  rounded to 50, never under 50. */
export function ferryPriceFor(base: number, o: { pirate?: boolean; quest?: boolean }): number {
  const v = base * (o.pirate ? FERRY_PIRATE_MUL : 1) * (o.quest ? FERRY_QUEST_MUL : 1);
  return Math.max(50, Math.round(v / 50) * 50);
}

/** One trip per captain in this many seconds (owner, 2026-10-30: «откат пусть будет 1 час, не два»; post 49, 2026-11-02:
 *  half an hour). */
export const FERRY_COOLDOWN_SEC = 30 * 60;

/** No passage with the hold's TRADE cargo fuller than this share (owner, 2026-10-30: «нельзя делать переход на груженом
 *  корабле если трюм забит более чем на 60%»; 2026-11-02: the ship's stores never count): the trader still sails her
 *  goods the long way. */
export const FERRY_HOLD_MAX = 0.6;

/** A captain wanted at this level or more is not carried (the hunters keep their prey). Since post 49 any skull is
 *  refused (FERRY_SKULLS_MAX); this stays for the older rule's tests and words. */
export const FERRY_WANTED_MAX = 3;
/** Any skull on her: the ferry refuses her («С черепами переход не возьмёт — сначала отмойтесь»). */
export const FERRY_SKULLS_MAX = 1;

// «Тихая гавань» (post 49, 2026-11-02: the hubs were camped — a trader came out of the passage into a pirate's broadside):
// about every hub a ring of HAVEN_R where no captain may attack another (no fire, no ram, no grapple); the sea's own ships
// — its pirates, its beasts — are what they always were. A captain who came by ferry keeps that peace HAVEN_WARD_SEC more
// after she leaves the ring (her effects row: «Под защитой гавани»), and while she has it she attacks no captain either.
export const HAVEN_R = 1500;
export const HAVEN_WARD_SEC = 180;
/** The ward's effect id (ship effects; the client's effects row). */
export const HAVEN_WARD_FX = 'haven_ward';

/** The hub whose quiet water a point is in, or null. `ports`: where the hubs lie. */
export function havenAt(ports: readonly { id: string; x: number; y: number }[], x: number, y: number): string | null {
  for (const p of ports) if (isFerryHub(p.id) && Math.hypot(p.x - x, p.y - y) <= HAVEN_R) return p.id;
  return null;
}
