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

/** The price: a base and a little a kilometre, rounded to 5, never above the cap (a newcomer's 200–400 silver
 *  pays the near ones; the farthest, 70+ km across the sea, is 200). */
export const FERRY_BASE = 30;
export const FERRY_PER_KM = 2.5;
export const FERRY_CAP = 200;

export function ferryPrice(metres: number): number {
  const raw = FERRY_BASE + (Math.max(0, metres) / 1000) * FERRY_PER_KM;
  return Math.min(FERRY_CAP, Math.round(raw / 5) * 5);
}

/** One trip per captain in this many seconds (owner: «кулдаун 30–60 минут»). */
export const FERRY_COOLDOWN_SEC = 45 * 60;

/** A captain wanted at this level or more is not carried (the hunters keep their prey). */
export const FERRY_WANTED_MAX = 3;
