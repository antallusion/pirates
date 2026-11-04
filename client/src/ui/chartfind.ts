// «Найти» on the sea chart (Эдуард, forum post 65: «Где на карте кнопка поиска известного острова по ИМЕНИ? Пока ищешь
// по просьбе офицера остров, куда его отвезти, он успевает обидеться и поднять бунт»): a name typed — the places she
// knows that it begins (an island she has charted, a port she has found, a lighthouse on a charted island, a hidden cove
// she was told of), each with how far and which way; a tap turns the chart onto it and offers «Проложить курс». Never a
// place she has not found: the search reads only what her chart already shows (the fog and the discovered set).
// Pure here (tests/chartfind.test.ts); the chart's field and list are worldmap.ts's.

import { fogSeen } from '../../../shared/src/data/fog.ts';

export type PlaceKind = 'port' | 'island' | 'light' | 'cove';

export interface ChartPlace {
  /** `p:<port id>`, `i:<island id>`, `c:<n>` — what it is (a port's key is the course that puts her in). */
  key: string;
  kind: PlaceKind;
  /** The name as she reads it (her language's). */
  name: string;
  /** The server's own (English) name, matched too: a Russian captain who read «Port Gravesend» on the forum finds it. */
  en?: string;
  x: number;
  y: number;
}

export interface PlaceHit extends ChartPlace {
  /** Metres from her ship (0 with no ship). */
  d: number;
  /** Which way from her ship: 0 north, clockwise (radians). */
  bearing: number;
}

/** Most rows the list shows (a phone's chart under the keyboard has room for a few). */
export const FIND_MAX = 8;

/** A name as the search compares it: lower case, «ё» as «е», no quotes, dashes or stops — words by single spaces. */
export function foldName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'’‘`´.,!?()[\]{}:;]/g, '')
    .replace(/[\s\-–—_/]+/g, ' ')
    .trim();
}

/** How a folded name answers a folded query: 0 — the name begins with it, 1 — a word of it does, -1 — no. */
function rankOf(name: string, q: string): number {
  if (!name) return -1;
  if (name.startsWith(q)) return 0;
  // a later word begins it («грейв» finds «Порт Грейвсенд»); a query of several words is matched from a word's start
  for (let i = name.indexOf(' '); i >= 0; i = name.indexOf(' ', i + 1)) if (name.startsWith(q, i + 1)) return 1;
  return -1;
}

/** The places that answer a query (prefix match, «ё» = «е», her language's names and the English), the name's own
 *  beginning before a word's, then the nearest. Empty for an empty query. Pure. */
export function findPlaces(places: readonly ChartPlace[], query: string, own: { x: number; y: number } | null, limit = FIND_MAX): PlaceHit[] {
  const q = foldName(query);
  if (!q) return [];
  const hits: (PlaceHit & { rank: number })[] = [];
  const seen = new Set<string>();
  for (const p of places) {
    if (seen.has(p.key)) continue;
    const r1 = rankOf(foldName(p.name), q);
    const r2 = p.en ? rankOf(foldName(p.en), q) : -1;
    const rank = r1 < 0 ? r2 : r2 < 0 ? r1 : Math.min(r1, r2);
    if (rank < 0) continue;
    seen.add(p.key);
    const dx = own ? p.x - own.x : 0, dy = own ? p.y - own.y : 0;
    hits.push({ ...p, rank, d: Math.hypot(dx, dy), bearing: own ? Math.atan2(dx, -dy) : 0 });
  }
  hits.sort((a, b) => a.rank - b.rank || a.d - b.d || a.name.localeCompare(b.name));
  return hits.slice(0, limit).map(({ rank: _r, ...h }) => h);
}

/** What her chart shows that has a name, as the search needs it. */
export interface ChartKnown {
  /** Her fog's bits (null: no fog yet — all seen). */
  seen: Uint8Array | null | undefined;
  /** The islands she has charted. */
  discovered: ReadonlySet<number>;
  islands: ReadonlyMap<number, { id: number; name: string; x: number; y: number; portId?: string; town?: string; minor?: boolean }>;
  ports: readonly { id: string; name: string; x: number; y: number }[];
  /** The lighthouses about her (docs/16 batch E) — named by their island. */
  lights?: readonly { island: number; name: string; x: number; y: number }[];
  /** Her hidden coves. */
  coves?: readonly { name: string; x: number; y: number }[];
  /** The server's (English) name of a port or an island (ClientState.enName). */
  enName?: (o: { name: string }) => string;
}

/** A key port is on every chart once out of the fog; a village or a harbour town (ids `_v…`, `<sea>_t<n>`) once its
 *  island is charted — the chart's own rule (worldmap.ts portKnown). */
function keyPort(id: string): boolean {
  return !id.includes('_v') && !/_t[0-9]+$/.test(id);
}

/** Every named place she knows of now (pure): the ports she has found, the islands she has charted (a port's island
 *  is its port), the lighthouses on charted islands, her coves. Nothing under her fog, nothing not found. */
export function chartPlaces(k: ChartKnown): ChartPlace[] {
  const out: ChartPlace[] = [];
  const en = (o: { name: string }) => {
    const e = k.enName?.(o);
    return e && e !== o.name ? { en: e } : {};
  };
  const found = new Set<string>();
  for (const id of k.discovered) {
    const is = k.islands.get(id);
    if (is?.portId) found.add(is.portId);
    if (is?.town) found.add(is.town);
  }
  const portIds = new Set<string>();
  for (const p of k.ports) {
    if (!fogSeen(k.seen, p.x, p.y) || !(keyPort(p.id) || found.has(p.id))) continue;
    portIds.add(p.id);
    out.push({ key: `p:${p.id}`, kind: 'port', name: p.name, ...en(p), x: p.x, y: p.y });
  }
  const lit = new Set((k.lights ?? []).map((l) => l.island));
  for (const id of k.discovered) {
    const is = k.islands.get(id);
    if (!is || is.minor || !is.name || !fogSeen(k.seen, is.x, is.y)) continue;
    if (is.portId && portIds.has(is.portId)) continue; // (its port stands for it)
    out.push({ key: `i:${is.id}`, kind: lit.has(is.id) ? 'light' : 'island', name: is.name, ...en(is), x: is.x, y: is.y });
  }
  (k.coves ?? []).forEach((c, i) => out.push({ key: `c:${i}`, kind: 'cove', name: c.name, x: c.x, y: c.y }));
  return out;
}
