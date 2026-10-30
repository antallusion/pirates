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

/** The price (owner, 2026-10-30: «через всю карту надо сделать 50000 серебра, 200 это смешно … соседний узел где-то
 *  1500-2000 и далее по увеличению … это всё дорого должно быть»): it rises steeply with the straight distance — the
 *  nearest pair of hubs (16.7 km) about 1 700, the farthest (78.2 km, across the whole sea) 50 000 — rounded to 50. */
export const FERRY_TOP = 50_000;
export const FERRY_FAR_KM = 78.2;
export const FERRY_POW = 2.2;
export const FERRY_MIN = 1_500;

export function ferryPrice(metres: number): number {
  const t = Math.min(1, Math.max(0, metres) / 1000 / FERRY_FAR_KM);
  const raw = Math.max(FERRY_MIN, FERRY_TOP * t ** FERRY_POW);
  return Math.min(FERRY_TOP, Math.round(raw / 50) * 50);
}

/** One trip per captain in this many seconds (owner, 2026-10-30: «откат пусть будет 1 час, не два»). */
export const FERRY_COOLDOWN_SEC = 60 * 60;

/** No passage with the hold fuller than this share (owner, 2026-10-30: «нельзя делать переход на груженом корабле если
 *  трюм забит более чем на 60%»): the trader still sails her goods the long way. */
export const FERRY_HOLD_MAX = 0.6;

/** A captain wanted at this level or more is not carried (the hunters keep their prey). */
export const FERRY_WANTED_MAX = 3;
