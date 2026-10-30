// «Где взять» (owner, 2026-10-30: «строя остров и развивая его, там написано нужен жемчуг, нужно еще там что-то, я хочу
// нажать на то что надо и в тултипе посмотреть где это можно купить или выбить»). For every good and land resource a
// building, a dwelling, a ship of the island's yard or a man of the hire may ask, the places it is had — read off the
// game's own data, never written by hand:
//  - SOLD: the island's own market (town.ts MARKET_GOODS), the barge to the yard (base.ts BARGE), the harbours that make
//    it (world/regions.ts KEY_PORTS, world/newports.ts NEW_PORTS: their market sells it cheapest) or the harbours every
//    one / the great ones trade it in (goods.ts portTrades);
//  - MADE: the island's producers (base.ts PRODUCERS), the mines ashore and the windmills (mines.ts, advmap.ts);
//  - DROPPED: the lairs (lairs.ts: their creatures' BEAST_RES, the island kind's supply), the shore bosses
//    (shorebosses.ts), the wrecks afloat (wrecks.ts), the landing parties' finds (isles.ts TREK_EVENTS).
// Each list at most SRC_MAX lines, the most practical first; the client words them (client/src/ui/srctip.ts).

import { BARGE, PRODUCERS, PRODUCER_KINDS, STONE } from './base.ts';
import type { ProducerKind } from './base.ts';
import { BEAST_RES, LAND_RES } from './bestiary.ts';
import type { LandRes } from './bestiary.ts';
import { ALWAYS_TRADED, GOODS, SUPPLY_GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import { LAIRS, LAIR_KINDS } from './lairs.ts';
import type { LairKind } from './lairs.ts';
import { MINES } from './mines.ts';
import type { MineKind } from './mines.ts';
import { MILL_GOODS } from './advmap.ts';
import { SHORE_BOSSES, SHORE_BOSS_IDS } from './shorebosses.ts';
import type { ShoreBossId } from './shorebosses.ts';
import { MARKET_GOODS } from './town.ts';
import { TREK_EVENTS } from './isles.ts';
import type { TrekPath } from './isles.ts';
import { WRECK_GOODS } from './wrecks.ts';
import { KEY_PORTS } from '../world/regions.ts';
import { NEW_PORTS } from '../world/newports.ts';
import { ISLE_TYPE_DEFS } from '../world/archipelago.ts';
import type { IsleType } from '../world/archipelago.ts';

/** The most lines a tooltip shows. */
export const SRC_MAX = 4;
/** The most harbours, lairs named on one line. */
export const SRC_NAMES = 3;

/** A thing a cost may ask: a good (`g:pearls`) or a land resource (`l:bone`). */
export type SrcId = `g:${GoodId}` | `l:${LandRes}`;

export type SrcLine =
  /** The island's own market (its Market building) sells it into the yard. */
  | { k: 'market' }
  /** The barge brings it to the yard for silver (the island window's «Баржа»). */
  | { k: 'barge' }
  /** An island producer makes it by the hour. */
  | { k: 'producer'; id: ProducerKind }
  /** Harbours sell it: the ones that make it (cheapest) by name; `every`: every harbour trades it; `big`: the great
   *  harbours do. `key`: the route to the nearest seller (server goalroute.ts `sg:`). */
  | { k: 'ports'; ports: string[]; every: boolean; big: boolean; key: string }
  /** A mine ashore on a wild island (flag it: a day's yield), and the windmills of the adventure map. */
  | { k: 'mine'; id: MineKind; mill: boolean }
  /** Lairs ashore whose creatures leave it (their names). */
  | { k: 'lairs'; lairs: LairKind[] }
  /** The lairs of these kinds of island pay it (the island kind's own resource). */
  | { k: 'isles'; types: IsleType[] }
  /** The shore bosses who leave it. */
  | { k: 'bosses'; ids: ShoreBossId[] }
  /** The wrecks afloat in the sea. */
  | { k: 'wreck' }
  /** A landing party's finds on these paths. */
  | { k: 'trek'; paths: TrekPath[] };

interface PortLike { name: string; size: number; produces: GoodId[] }

const PORTS: PortLike[] = [
  ...KEY_PORTS.map((p) => ({ name: p.name, size: p.size, produces: (Object.entries(p.profile.produces) as [GoodId, number][]).sort((a, b) => b[1] - a[1]).map(([g]) => g) })),
  ...NEW_PORTS.map((p) => ({ name: p.name, size: p.size, produces: p.produces })),
];

/** The harbours that make a good: by the rank of the good among what each makes, then the biggest. */
function makers(good: GoodId): string[] {
  return PORTS.filter((p) => p.produces.includes(good))
    .sort((a, b) => a.produces.indexOf(good) - b.produces.indexOf(good) || b.size - a.size)
    .map((p) => p.name);
}

/** How much of a land resource (or pearls) a lair's creatures leave by its might. */
function lairYield(kind: LairKind, r: LandRes | 'pearls'): number {
  return LAIRS[kind].mix.reduce((a, [u, share]) => a + share * (BEAST_RES[u]?.[r] ?? 0), 0);
}

/** The lairs that leave a land resource most, the lowest-levelled first (the nearest a young captain beats). */
function lairsOf(r: LandRes | 'pearls'): LairKind[] {
  const all = LAIR_KINDS.map((k) => ({ k, y: lairYield(k, r) })).filter((x) => x.y > 0);
  if (!all.length) return [];
  const top = Math.max(...all.map((x) => x.y));
  // (a lair whose creatures leave it only by the way is no place to go for it)
  return all.filter((x) => x.y >= Math.min(0.1, top * 0.5))
    .sort((a, b) => LAIRS[a.k].lv[0] - LAIRS[b.k].lv[0] || b.y - a.y)
    .slice(0, SRC_NAMES).map((x) => x.k);
}

function trekPaths(good: GoodId): TrekPath[] {
  const paths = new Set<TrekPath>();
  const pays = (o: unknown): boolean => {
    if (!o || typeof o !== 'object') return false;
    const g = (o as { pay?: { goods?: unknown[] } }).pay?.goods;
    if (Array.isArray(g) && g[0] === good) return true;
    return Object.values(o as Record<string, unknown>).some((v) => (Array.isArray(v) ? v.some(pays) : typeof v === 'object' && pays(v)));
  };
  for (const ev of Object.values(TREK_EVENTS)) if (pays(ev)) for (const p of ev.paths) paths.add(p);
  return [...paths];
}

const memo = new Map<string, SrcLine[]>();

/** Where a good or a land resource is had: at most SRC_MAX lines, the most practical first. */
export function sourcesOf(id: string): SrcLine[] {
  const hit = memo.get(id);
  if (hit) return hit;
  const out: SrcLine[] = [];
  const [kind, what] = id.split(':') as ['g' | 'l', string];
  if (kind === 'g' && what in GOODS) {
    const g = what as GoodId;
    const prod = PRODUCER_KINDS.find((k) => PRODUCERS[k].good === g || (k === 'quarry' && g === STONE));
    if (prod) out.push({ k: 'producer', id: prod });
    if (MARKET_GOODS.includes(g)) out.push({ k: 'market' });
    if (BARGE[g as keyof typeof BARGE]) out.push({ k: 'barge' });
    const def = GOODS[g];
    const names = makers(g).slice(0, SRC_NAMES);
    const every = ALWAYS_TRADED.includes(g) || SUPPLY_GOODS.includes(g);
    const big = !every && def.category !== 'rare' && !def.contraband;
    if (names.length || every || big) out.push({ k: 'ports', ports: names, every, big, key: `sg:${g}` });
    if (g in MINES) out.push({ k: 'mine', id: g as MineKind, mill: MILL_GOODS.includes(g) });
    const types = (Object.keys(ISLE_TYPE_DEFS) as IsleType[]).filter((t) => ISLE_TYPE_DEFS[t].supply === g);
    if (g === 'pearls') {
      const lairs = lairsOf('pearls');
      if (lairs.length) out.push({ k: 'lairs', lairs });
    }
    if (types.length) out.push({ k: 'isles', types });
    if (g === 'pearls') {
      const ids = SHORE_BOSS_IDS.filter((b) => (SHORE_BOSSES[b].res.pearls ?? 0) > 0);
      if (ids.length) out.push({ k: 'bosses', ids });
    }
    if (WRECK_GOODS.some(([w]) => w === g)) out.push({ k: 'wreck' });
    const paths = trekPaths(g);
    if (paths.length) out.push({ k: 'trek', paths });
  } else if (kind === 'l' && (LAND_RES as string[]).includes(what)) {
    const r = what as LandRes;
    const lairs = lairsOf(r);
    if (lairs.length) out.push({ k: 'lairs', lairs });
    const ids = SHORE_BOSS_IDS.filter((b) => (SHORE_BOSSES[b].res[r] ?? 0) > 0);
    if (ids.length) out.push({ k: 'bosses', ids });
  }
  const list = out.slice(0, SRC_MAX);
  memo.set(id, list);
  return list;
}
