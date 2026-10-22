// The campaign laid on the world (docs/36). Owner, 2026-10-18: «чтобы я проходя ее побывал во всех локациях по очереди,
// условно там 5 квестов в одной, потом еще в другой и еще и еще… все завяжи рядышком… делай логичнее все». So the
// campaign goes LOCATION BY LOCATION: each chapter's quests fall in runs of 4–6, and each run is done at one location —
// a port and its waters, or (in the portless Abyss) an island and its waters — with every place it names within
// LOCAL_R of it: its port, the islands nearest to it, its fights put out about it (the server's foes, beasts), its lairs,
// a wreck laid for its divers, the watch kept in its waters. The first quest of a run is the voyage there from the run
// before (the only long leg). The locations go through the seas in the order of their levels: the chapter's mentor's
// port first, then the chapter's other ports of the run's ⚓ (each the nearest not yet visited), so the captain sees most
// of the harbours of each sea in turn. Counts by the quest's level; words filled in English (the client reads them in
// Russian through patterns.ts); experience and silver by the pace (pacing.ts). Deterministic: a captain's place in it is
// a number (her `campaign.at`), and a save of before a change of places finds its quest re-anchored where it now is.

import { REGIONS } from '../../world/regions.ts';
import type { RegionId } from '../../world/regions.ts';
import type { Island, Port, World } from '../../world/worldgen.ts';
import { islandLife } from '../../world/islandlife.ts';
import { isLand } from '../../world/worldgen.ts';
import { sectorAt } from '../../world/sectors.ts';
import { hashString } from '../../rng.ts';
import { GOODS } from '../goods.ts';
import { SITE_NAMES } from '../questgen.ts';
import type { QuestDef, QuestStep } from '../quests.ts';
import { shipBandOf } from '../xpcurve.ts';
import { campaignPaces } from './pacing.ts';
import { PLAN } from './plan.ts';
import { STEP_WORDS, defaultCount, parseStep, wordsOf } from './steps.ts';
import type { StepSpec } from './steps.ts';
import type { ChapterSrc, QuestSrc, StepSrc, T } from './types.ts';

/** The campaign's opening (owner, 2026-10-19): its first quests — the shops, a ship sunk, a ship boarded, a neutral stack,
 *  a town founded (ch01.ts) — whose fights are softened and whose courses the client sails by itself. */
export const OPENING_SLOTS = 5;

/** How near a location everything of its quests is (metres: an island's shore, a port's anchorage, a fight's water). */
export const LOCAL_R = 1500;

/** A place of the campaign, as its builder sees it: one quest and, at a branch, its second way. */
export interface CampaignSlot {
  slot: number;
  ch: number;
  k: number;
  gate: number;
  /** Its location (an index of Campaign.locations); the first quest of a run is the voyage there. */
  loc: number;
  travel: boolean;
  /** The quest (the first way at a branch) and the second way. */
  a: QuestDef;
  b?: QuestDef;
}

/** A location: a port and its waters, or an island of the Abyss and its waters; a run of quests there. */
export interface CampaignLoc {
  i: number;
  kind: 'port' | 'isle';
  /** The port's id, or the island's id. */
  id: string | number;
  name: string;
  x: number;
  y: number;
  region: RegionId;
  ch: number;
  from: number;
  size: number;
}

export interface Campaign {
  slots: CampaignSlot[];
  /** The slots by their place (a chapter not written leaves holes). */
  bySlot: Map<number, CampaignSlot>;
  chapters: ChapterSrc[];
  /** Every quest of it (both ways of the branches). */
  quests: QuestDef[];
  /** The first slot of each chapter (index by chapter − 1). */
  firstOf: number[];
  locations: CampaignLoc[];
}

/** A chapter's mentor's name (its giver's words before the calling): «Орен Галт». */
export const giverName = (ch: ChapterSrc, ru: 0 | 1): string => ch.giver[ru].split(',')[0].trim();

/** A text with the chapter's mentor put in ({giver} is the chapter's, the same in both tongues' patterns). */
export const withGiver = (s: string, ch: ChapterSrc, ru: 0 | 1): string => s.replace(/\{giver\}/g, giverName(ch, ru));

export function fill(t: string, v: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
}

/** Islands one may sail to and land on (not the rocks, the rafts, the hidden, the empty places or a port's own). */
const sailable = (i: Island): boolean => !i.minor && !i.raft && !i.hidden && !i.slot && !i.portId;

function siteOf(is: Island, site: string): string | undefined {
  const here = [...is.features, ...islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: Math.round(is.radius), poly: is.poly, features: is.features, portId: is.portId }).map((x) => x.kind)];
  if (site === 'fishers' || site === 'smugglers') return here.find((f) => f === site) ?? here.find((f) => f === 'fishers' || f === 'smugglers');
  if (site === 'ruins' || site === 'shrine' || site === 'bell') return here.find((f) => f === site) ?? here.find((f) => f === 'ruins' || f === 'shrine' || f === 'bell');
  if (site === 'seals' || site === 'crabs' || site === 'turtles') return here.find((f) => f === site) ?? here.find((f) => f === 'seals' || f === 'crabs' || f === 'turtles');
  return here.find((f) => f === site);
}

interface Places {
  world: World;
  ports: Port[];
  islands: Island[];
  level: Map<string | number, number>;
  /** A port's own island; the islands about a location, by its key and radius (kept). */
  portIsle: Map<string, Island>;
  near: Map<string, Island[]>;
}

function placesOf(world: World): Places {
  const level = new Map<string | number, number>();
  const ports = world.ports.filter((p) => !p.raft);
  for (const p of ports) level.set(p.id, sectorAt(world, p.x, p.y).level);
  const islands = world.islands.filter(sailable);
  for (const i of islands) level.set(i.id, sectorAt(world, i.x, i.y).level);
  const portIsle = new Map<string, Island>();
  for (const i of world.islands) if (i.portId && !portIsle.has(i.portId)) portIsle.set(i.portId, i);
  return { world, ports, islands, level, portIsle, near: new Map() };
}

/** How far an island's shore is from a point. */
export const shoreDist = (i: { x: number; y: number; radius: number }, x: number, y: number): number => Math.max(0, Math.hypot(i.x - x, i.y - y) - i.radius);

/** How far an island is from a location: from its anchorage, or from the shore of the location's own island (a port's
 *  island, an island of the Abyss) — the waters about the land the location stands on. */
export function locDist(world: World, loc: { kind: 'port' | 'isle'; id: string | number; x: number; y: number }, i: { x: number; y: number; radius: number }, portIsle?: Map<string, Island>): number {
  // (a port's: from its quay — what lies beyond its own island is far, owner 2026-10-18; an island's: from its shores)
  void portIsle;
  const own = loc.kind === 'isle' ? world.islands[loc.id as number] : undefined;
  const d = shoreDist(i, loc.x, loc.y);
  return own ? Math.min(d, Math.max(0, Math.hypot(i.x - own.x, i.y - own.y) - i.radius - own.radius)) : d;
}

/** The islands about a location, nearest first. */
function islandsNear(pl: Places, loc: { kind: 'port' | 'isle'; id: string | number; x: number; y: number }, r: number, not?: number): Island[] {
  const key = `${loc.kind}:${loc.id}:${r}`;
  let all = pl.near.get(key);
  if (!all) {
    const d = new Map<Island, number>();
    for (const i of pl.islands) {
      if (Math.abs(i.x - loc.x) > r + 6000 || Math.abs(i.y - loc.y) > r + 6000) continue;
      const x = locDist(pl.world, loc, i, pl.portIsle);
      if (x <= r) d.set(i, x);
    }
    all = [...d.keys()].sort((a, b) => d.get(a)! - d.get(b)!);
    pl.near.set(key, all);
  }
  return not === undefined ? all : all.filter((i) => i.id !== not);
}

/** The step words of a step source: its own, or one of its kind's by the quest. */
function stepWords(src: StepSrc, spec: StepSpec, qid: string, i: number, part: 'pick' | 'drop' = 'pick'): T {
  if (typeof src !== 'string' && spec.kind !== 'carry') return [src[1], src[2]];
  const w = wordsOf(spec, part);
  return w[hashString(`${qid}:${i}:${part}`) % w.length];
}

/** The words of a quest that name a harbour (a quest that must be done at a port, not at an island of the Abyss). */
function portBound(q: { b: T; d: T; s: StepSrc[] }): boolean {
  const texts = [q.b[0], q.d[0], ...q.s.map((x) => (typeof x === 'string' ? '' : x[1]))];
  if (texts.some((t) => /\{(hub|port|port2|at)\}/.test(t))) return true;
  return q.s.some((x) => /^(port|port2|at|carry|bring|recruit|customs|contraband|buy)\b/.test(typeof x === 'string' ? x : x[0]));
}

// ------------------------------------------------------------------ the locations

interface Run {
  ch: ChapterSrc;
  from: number;
  size: number;
  gate: number;
  /** `at:` ports named by its quests (the run is held there). */
  at?: string;
  island: boolean;
}

/** A chapter's runs, of these lengths. */
function runsFrom(ch: ChapterSrc, first: number, lens: number[]): Run[] {
  const paces = campaignPaces();
  const out: Run[] = [];
  let from = first;
  for (const len of lens) {
    const qs = ch.quests.slice(from - first, from - first + len);
    const ats = qs.flatMap((q) => [q, ...(q.alt ? [q.alt] : [])]).flatMap((q) => q.s).map((x) => (typeof x === 'string' ? x : x[0])).filter((c) => c.startsWith('at:')).map((c) => c.slice(3));
    // (a run whose quests name no harbour may be held at an island's anchorage)
    const island = !qs.some((q) => portBound(q) || (q.alt ? portBound(q.alt) : false));
    out.push({ ch, from, size: len, gate: paces[Math.min(paces.length - 1, from)].gate, ...(ats.length ? { at: ats[ats.length - 1] } : {}), island });
    from += len;
  }
  return out;
}

const evenLens = (size: number, n: number): number[] => Array.from({ length: n }, (_, r) => Math.floor(size / n) + (r < size % n ? 1 : 0));

/** The Abyss's run lengths: 4–6, cut so that as many runs as may name no harbour (held at an island of the Abyss itself,
 *  not at a harbour of its edge). */
function abyssLens(ch: ChapterSrc, size: number): number[] {
  const bound = ch.quests.map((q) => portBound(q) || (q.alt ? portBound(q.alt) : false));
  const best: ({ pure: number; dev: number; cut: number[] } | null)[] = Array(size + 1).fill(null);
  best[0] = { pure: 0, dev: 0, cut: [] };
  for (let i = 0; i < size; i++) {
    const b = best[i];
    if (!b) continue;
    for (const len of [4, 5, 6]) {
      const j = i + len;
      if (j > size) continue;
      const pure = b.pure + (bound.slice(i, j).some((x) => x) ? 0 : 1), dev = b.dev + Math.abs(len - 5);
      const cur = best[j];
      if (!cur || pure > cur.pure || (pure === cur.pure && dev < cur.dev)) best[j] = { pure, dev, cut: [...b.cut, len] };
    }
  }
  return best[size]?.cut ?? evenLens(size, Math.round(size / 5));
}

/** The voyages' aim (owner, 2026-10-18: «чтобы все было недалеко»): no leg over this before the eighth level, nor this
 *  after it, where the coast allows. */
export const LEG_EARLY = 6000;
export const LEG_LATE = 8000;
export const EARLY_LEVEL = 8;

/** The islands within reach of a harbour's quay (owner: what is farther from the quay than 1.5 km is far). */
const nearCount = (pl: Places, p: Port): number => islandsNear(pl, { kind: 'port', id: p.id, x: p.x, y: p.y }, LOCAL_R).length;

/**
 * Every run's location, chapter by chapter through the seas in order. A chapter starts at its mentor's port; a run
 * whose quests name a port is held there (when it has islands about it, or it is the campaign's home-coming). The other
 * runs' harbours are a path from the last location to the next chapter's mentor's port: of the chapter's seas (or of the
 * next chapter's, to bridge the crossing) at the run's ⚓, with islands within reach of the quay, not visited before —
 * the path whose legs are shortest, with as many runs as it takes (runs of 3–6) for no leg over 6 km before the eighth
 * level and 8 km after it where the coast allows. The Abyss's runs go to its islands where their quests name no harbour,
 * to its edge's harbours where they do.
 */
function placeAll(pl: Places, chapters: { ch: ChapterSrc; first: number; size: number }[]): { runs: Run[]; locations: CampaignLoc[] } {
  const byId = (id: string) => pl.ports.find((p) => p.id === id)!;
  const used = new Map<string | number, number>();
  const runs: Run[] = [];
  const locations: CampaignLoc[] = [];
  let prev: { x: number; y: number } | null = null;
  const lv = (k: string | number) => pl.level.get(k) ?? 1;
  const isleLoc = (i: Island): Node => ({ kind: 'isle', id: i.id, name: i.name, x: i.x, y: i.y, region: i.region, near: islandsNear(pl, { kind: 'isle', id: i.id, x: i.x, y: i.y }, LOCAL_R, i.id).length + 1 });
  const portNode = (p: Port): Node => ({ kind: 'port', id: p.id, name: p.name, x: p.x, y: p.y, region: p.region, near: nearCount(pl, p) });
  // the islands that may hold a run: of a cluster (another within reach), the empty places and the rafts aside
  const isleNodes = pl.islands.filter((i) => islandsNear(pl, { kind: 'isle', id: i.id, x: i.x, y: i.y }, LOCAL_R, i.id).length >= 1).map(isleLoc);
  const portNodes = pl.ports.map(portNode);
  chapters.forEach(({ ch, first, size }, ci) => {
    const next = chapters[ci + 1];
    const nextHub = next ? byId(next.ch.hub) : undefined;
    const lastOfAll = ci === chapters.length - 1;
    const abyss = ch.region === 'the_abyss';
    const fixedOf = (run: Run, r: number, n: number): Node | undefined => {
      const at = run.at ? byId(run.at) : undefined;
      if (at && (nearCount(pl, at) >= 2 || (lastOfAll && r === n - 1))) return portNode(at);
      // the mentor's port, where it has islands within reach of its quay (or it is the start, Saltmarrow: the newcomer's
      // own); else the run goes to the nearest place about it that has (the path's pull below)
      const hub = byId(ch.hub);
      return r === 0 && ci === 0 ? portNode(hub) : undefined;
    };
    const seas: RegionId[] = abyss ? ['drowned_crown'] : [ch.region, ...(ch.more ?? [])];
    const isleSeas: RegionId[] = abyss ? ['the_abyss'] : [ch.region, ...(ch.more ?? [])];
    const bridge: RegionId[] = next && !abyss ? [next.ch.region === 'the_abyss' ? 'drowned_crown' : next.ch.region] : [];
    const target = (campaignPaces()[first]?.gate ?? 1) < EARLY_LEVEL ? LEG_EARLY : LEG_LATE;
    const legCost = (d: number) => d + 30 * Math.max(0, d - target);
    const start = prev as { x: number; y: number } | null;
    const hub = byId(ch.hub);
    let pick: { runs: Run[]; nodes: Node[]; max: number } | null = null;
    const base = Math.max(1, Math.round(size / 5)), most = Math.max(base, Math.floor(size / 2));
    const tries = abyss ? [abyssLens(ch, size)] : Array.from({ length: most - base + 1 }, (_, k) => evenLens(size, base + k));
    for (const lens of tries) {
      const rs = runsFrom(ch, first, lens);
      // the candidates of each run: fixed; or the harbours of its seas (and the next's) at its ⚓ with islands at the quay,
      // and — for a run whose quests name no harbour — the islands of its seas at its ⚓ (an island's anchorage)
      const cands: Node[][] = rs.map((run, r) => {
        const fix = fixedOf(run, r, rs.length);
        if (fix) return [fix];
        const band = shipBandOf(run.gate);
        const fits = (n: Node) => lv(n.id) <= band + 2 && lv(n.id) >= band - 2;
        const c = [
          ...portNodes.filter((n) => (seas.includes(n.region) || bridge.includes(n.region)) && fits(n)),
          ...(run.island ? isleNodes.filter((n) => (isleSeas.includes(n.region) || bridge.includes(n.region)) && fits(n)) : []),
        ];
        return c.length ? c : portNodes.filter((n) => seas.includes(n.region) && n.near >= 1);
      });
      const node = (n: Node, run: Run) => {
        const band = shipBandOf(run.gate), l = lv(n.id);
        return (run === rs[0] && !abyss ? 0.3 * Math.hypot(n.x - hub.x, n.y - hub.y) : 0) + (used.get(n.id) ?? 0) * 1e5 + (n.near === 0 ? 2500 : n.near === 1 ? 1000 : 0)
          + (l > band + 1 ? 6000 : l > band || l < band - 1 ? 3000 : 0) + (isleSeas.includes(n.region) || seas.includes(n.region) ? 0 : 1500) + (n.kind === 'isle' && !abyss ? 1200 : 0);
      };
      // the path: best[r][j] the cost of the runs up to r ending at its j-th candidate
      const best: { cost: number; from: number }[][] = cands.map((c) => c.map(() => ({ cost: Infinity, from: -1 })));
      cands[0].forEach((p, j) => (best[0][j] = { cost: (start ? legCost(Math.hypot(p.x - start.x, p.y - start.y)) : 0) + node(p, rs[0]), from: -1 }));
      for (let r = 1; r < rs.length; r++) {
        const prevC = cands[r - 1], prevB = best[r - 1];
        cands[r].forEach((p, j) => {
          const own = node(p, rs[r]);
          let bc = Infinity, bi = -1;
          for (let i = 0; i < prevC.length; i++) {
            const q = prevC[i];
            if (q.id === p.id || prevB[i].cost === Infinity) continue;
            const dx = p.x - q.x, dy = p.y - q.y;
            const c = prevB[i].cost + legCost(Math.sqrt(dx * dx + dy * dy));
            if (c < bc) [bc, bi] = [c, i];
          }
          best[r][j] = { cost: bc + own, from: bi };
        });
      }
      const last = rs.length - 1;
      let bj = -1, bc = Infinity;
      cands[last].forEach((p, j) => {
        const c = best[last][j].cost + (nextHub ? 0.3 * Math.hypot(nextHub.x - p.x, nextHub.y - p.y) : 0);
        if (c < bc) [bc, bj] = [c, j];
      });
      if (bj < 0) continue;
      const nodes: Node[] = [];
      for (let r = last, j = bj; r >= 0; j = best[r][j].from, r--) nodes.unshift(cands[r][j]);
      const pts: { x: number; y: number }[] = [...(start ? [start] : []), ...nodes];
      void nextHub;
      let max = 0;
      for (let i = 1; i < pts.length; i++) max = Math.max(max, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      if (!pick || max < pick.max - 1500) pick = { runs: rs, nodes, max };
      if (max <= target) break;
    }
    const chosen = pick!;
    chosen.runs.forEach((run, r) => {
      const n = chosen.nodes[r];
      const loc: CampaignLoc = { i: locations.length, kind: n.kind, id: n.id, name: n.name, x: n.x, y: n.y, region: n.region, ch: ch.n, from: run.from, size: run.size };
      used.set(loc.id, (used.get(loc.id) ?? 0) + 1);
      prev = loc;
      runs.push(run);
      locations.push(loc);
    });
  });
  return { runs, locations };
}

interface Node {
  kind: 'port' | 'isle';
  id: string | number;
  name: string;
  x: number;
  y: number;
  region: RegionId;
  /** Islands within reach (an island's own counted). */
  near: number;
}

// ------------------------------------------------------------------ a quest at its location

/** How near a coast's marked place her ship must come (metres). */
export const SPOT_R = 300;

/** The coves and spits of a harbour's own island within reach of its quay (water off its shore, 0.5–1.45 km from the
 *  anchorage), round the island in order. */
function coastSpots(pl: Places, port: Port, own: Island): { x: number; y: number }[] {
  const out: { x: number; y: number; a: number }[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    for (const off of [160, 260, 380]) {
      const x = own.x + Math.cos(a) * (own.radius + off), y = own.y + Math.sin(a) * (own.radius + off);
      const d = Math.hypot(x - port.x, y - port.y);
      if (d < 500 || d > LOCAL_R - 50 || isLand(pl.world, x, y)) continue;
      out.push({ x, y, a });
      break;
    }
  }
  // spread: every fourth of them round the island
  return out.filter((_, i) => i % 4 === 0).map(({ x, y }) => ({ x, y }));
}

interface QuestCtx {
  pl: Places;
  ch: ChapterSrc;
  loc: CampaignLoc;
  /** The run's turn among its islands (each quest of a run starts at the next of them). */
  turn: number;
}

/** The island a town is founded on from a location (the opening's, owner 2026-10-19: «к ближайшему острову основать свой
 *  город»): the nearest one may sail to and claim — not a port's — by its shore. */
export function foundIsle(pl: { islands: Island[] }, at: { x: number; y: number }): Island {
  let best = pl.islands[0], bd = Infinity;
  for (const i of pl.islands) {
    const d = shoreDist(i, at.x, at.y);
    if (d < bd) [best, bd] = [i, d];
  }
  return best;
}

function buildQuest(c: QuestCtx, src: { t: T; b: T; d: T; s: StepSrc[]; lane?: { at: number; r: number } }, id: string, slot: number, k: number, gate: number, xp: number, silver: number, travel: boolean, way?: { key: string; way: 'a' | 'b'; label: T }): QuestDef {
  const { pl, ch, loc } = c;
  const band = shipBandOf(gate);
  const specs = src.s.map((x) => parseStep(typeof x === 'string' ? x : x[0])).filter((x): x is StepSpec => typeof x !== 'string');
  const near = { x: Math.round(loc.x), y: Math.round(loc.y), r: LOCAL_R };
  const port = loc.kind === 'port' ? pl.world.ports.find((p) => p.id === loc.id)! : null;
  // a delivery's other end: the harbour nearest to this one (a short run along the coast)
  const other = port ? pl.ports.filter((p) => p.id !== port.id).sort((a, b) => Math.hypot(a.x - port.x, a.y - port.y) - Math.hypot(b.x - port.x, b.y - port.y))[0] : null;
  const carries = specs.some((s) => s.kind === 'carry');
  const home = port ?? pl.world.ports.find((p) => p.id === ch.hub)!;
  // The islands about the location, its own first for an island's run, in turn by the quest (a run's quests see them all).
  const anchor = loc.kind === 'isle' ? pl.world.islands[loc.id as number] : null;
  const isles = islandsNear(pl, loc, LOCAL_R, anchor?.id);
  // A harbour with no island within reach of its quay (owner, 2026-10-18: «чтобы все было недалеко»): its own island's
  // coast stands for them — a cove to round to, a spit to land a party on, within reach of the quay.
  const ownIsle = port && !isles.length ? pl.portIsle.get(port.id) : undefined;
  const coast = ownIsle ? coastSpots(pl, port!, ownIsle) : [];
  const ring = anchor ? [anchor, ...isles] : ownIsle ? [ownIsle] : isles;
  const at = (i: number) => ring[(c.turn + i) % Math.max(1, ring.length)] ?? anchor ?? pl.islands[0];
  const withSite = (site: string | undefined, not?: Island): { is: Island; site?: string } => {
    if (site) {
      // a site of the location's own waters: the one asked for, else another of its islands' sites (the words name it)
      const s = ring.find((i) => i !== not && siteOf(i, site));
      if (s) return { is: s, site: siteOf(s, site) };
      for (const other of Object.keys(SITE_NAMES)) {
        const o = ring.find((i) => i !== not && siteOf(i, other) === other);
        if (o) return { is: o, site: other };
      }
    }
    const is = at(0) === not ? at(1) : at(0);
    return { is };
  };
  const landSite = specs.find((s) => s.kind === 'land' && s.site)?.site;
  const land2Site = specs.find((s) => s.kind === 'land2' && s.site)?.site;
  const i1 = withSite(landSite);
  const i2 = withSite(land2Site, i1.is);
  // the opening: the island its town is founded on is the one its {isle} names, and its fights put out on the lane
  // from the quay to that island (types.ts QuestSrc.lane)
  const founding = specs.some((x) => x.kind === 'found') || !!src.lane;
  const town = founding ? foundIsle(pl, loc) : null;
  if (town && specs.some((x) => x.kind === 'found')) i1.is = town;
  const laneNear = town && src.lane ? { x: Math.round(loc.x + (town.x - loc.x) * src.lane.at), y: Math.round(loc.y + (town.y - loc.y) * src.lane.at), r: src.lane.r } : null;
  if (i2.is === i1.is && ring.length > 1) i2.is = ring.find((i) => i !== i1.is)!;
  c.turn++;
  const minShip = Math.max(1, band - 1);
  const placeName = port ? port.name : anchor!.name;
  const v: Record<string, string> = {
    hub: placeName, port: placeName, port2: carries && other ? other.name : placeName, at: placeName,
    isle: i1.is.name, isle2: i2.is.name, region: REGIONS[loc.region].name, giver: giverName(ch, 0),
  };
  const steps: QuestStep[] = [];
  src.s.forEach((x, i) => {
    const s = specs[i];
    if (!s) return;
    const n = s.kind === 'dive' ? 1 : s.n ?? defaultCount(s.kind, band); // (one wreck is laid for a dive at a location)
    const sv: Record<string, string> = { ...v, n: String(n), ...(s.good ? { good: GOODS[s.good].name } : {}) };
    if (s.kind === 'land' && i1.site) sv.site = SITE_NAMES[i1.site] ?? i1.site;
    if (s.kind === 'land2' && i2.site) sv.site = SITE_NAMES[i2.site] ?? i2.site;
    let words = stepWords(x, s, id, i);
    // a landing at a site the location's islands have none of: a landing on the island (its words without the site)
    if ((s.kind === 'land' && s.site && !i1.site) || (s.kind === 'land2' && s.site && !i2.site)) if (typeof x === 'string') words = STEP_WORDS[s.kind][hashString(`${id}:${i}`) % STEP_WORDS[s.kind].length];
    // a harbour without islands: its own island's coast (the words of a cove, a spit)
    if (ownIsle && typeof x === 'string' && (s.kind === 'isle' || s.kind === 'isle2' || s.kind === 'land' || s.kind === 'land2')) {
      const w = STEP_WORDS[s.kind.startsWith('land') ? 'land_coast' : 'isle_coast'];
      words = w[hashString(`${id}:${i}`) % w.length];
    }
    // an island's run of the Abyss: the mentor's ship rides at anchor off its island, not in a harbour
    if (!port && s.kind === 'hub' && typeof x === 'string') words = STEP_WORDS.hub_isle[hashString(`${id}:${i}`) % STEP_WORDS.hub_isle.length];
    // (its words name the anchorage's island — the one the step's mark is on — not the run's {isle}: QA 2026-10-22,
    // «Kitty Marsh … off Veilislet Isle» marked Sallowwisp Rock)
    if (!port && anchor && (s.kind === 'hub' || s.kind === 'at' || s.kind === 'port' || s.kind === 'port2')) sv.isle = anchor.name;
    const text = (part: 'pick' | 'drop' = 'pick') => fill(withGiver((part === 'drop' ? stepWords(x, s, id, i, 'drop') : words)[0], ch, 0), sv);
    const visitHere = () => (port ? steps.push({ type: 'visit', port: port.id, text: text() }) : steps.push({ type: 'isle', island: anchor!.id, text: text() }));
    switch (s.kind) {
      case 'hub':
      case 'at':
      case 'port':
      case 'port2': visitHere(); break;
      case 'isle':
      case 'isle2':
      case 'land':
      case 'land2':
        if (ownIsle) {
          const spot = coast[(c.turn + i) % Math.max(1, coast.length)] ?? { x: port!.x, y: port!.y };
          steps.push({ type: 'spot', x: Math.round(spot.x), y: Math.round(spot.y), r: SPOT_R, island: ownIsle.id, text: text() });
          break;
        }
        if (s.kind === 'isle') steps.push({ type: 'isle', island: i1.is.id, text: text() });
        else if (s.kind === 'isle2') steps.push({ type: 'isle', island: i2.is.id, text: text() });
        else if (s.kind === 'land') steps.push({ type: 'land', island: i1.is.id, ...(s.site && i1.site ? { site: i1.site } : {}), text: text() });
        else steps.push({ type: 'land', island: i2.is.id, ...(s.site && i2.site ? { site: i2.site } : {}), text: text() });
        break;
      case 'board': steps.push({ type: 'board', count: n, minShip, near: laneNear ?? near, text: text() }); break;
      case 'sink': steps.push({ type: 'sink', count: n, ...(s.role ? { role: s.role } : {}), minShip, near: laneNear ?? near, text: text() }); break;
      case 'lair': steps.push({ type: 'lair', count: n, near, text: text() }); break;
      case 'beast': steps.push({ type: 'beast', count: n, group: s.group ?? 'any', near, text: text() }); break;
      case 'chart': steps.push({ type: 'chart', count: n, text: text() }); break;
      case 'dive': steps.push({ type: 'dive', count: 1, near, text: text() }); break;
      case 'catch': steps.push({ type: 'catch', count: n, text: text() }); break;
      case 'named': steps.push({ type: 'named', count: 1, text: text() }); break;
      case 'rescue': steps.push({ type: 'rescue', count: n, text: text() }); break;
      case 'prize': steps.push({ type: 'prize', count: 1, text: text() }); break;
      case 'tribute': steps.push({ type: 'tribute', count: n, text: text() }); break;
      case 'carry':
        steps.push({ type: 'pickup', port: home.id, good: s.good!, qty: n, text: text('pick') });
        steps.push({ type: 'deliver', port: (other ?? home).id, good: s.good!, qty: n, text: text('drop') });
        break;
      case 'bring': steps.push({ type: 'deliver', port: home.id, good: s.good!, qty: n, text: text() }); break;
      case 'escort': steps.push({ type: 'time_in', region: loc.region, seconds: n * 60, near, text: text() }); break;
      case 'reach': steps.push({ type: 'reach', region: loc.region, text: text() }); break;
      case 'claim': steps.push({ type: 'claim', text: text() }); break;
      case 'build': steps.push({ type: 'build', count: n, text: text() }); break;
      case 'recruit': steps.push({ type: 'recruit', count: n, text: text() }); break;
      case 'customs': steps.push({ type: 'customs', text: text() }); break;
      case 'contraband': steps.push({ type: 'sell_contraband', qty: n, text: text() }); break;
      // the opening (owner, 2026-10-19): the shops of any harbour (the words name the start's), a neutral stack on the
      // lane, the town founded on the nearest island
      case 'buy': steps.push({ type: 'buy', shop: s.shop!, text: text() }); break;
      case 'neutral': steps.push({ type: 'neutral', count: n, near: laneNear ?? near, text: text() }); break;
      case 'found': steps.push({ type: 'claim', island: (town ?? i1.is).id, text: text() }); break;
    }
  });
  const en = (p: T) => fill(withGiver(p[0], ch, 0), v);
  return {
    id, kind: 'campaign', name: src.t[0], mentor: ch.giver[0], port: home.id, summary: en(src.b), requires: { level: gate }, steps,
    reward: { xp, silver }, category: 'campaign', portrait: ch.portrait,
    campaign: { slot, ch: ch.n, k, done: en(src.d), loc: loc.i, ...(travel ? { travel: true } : {}), ...(way ? { key: way.key, way: way.way, label: way.label[0] } : {}) },
  };
}

/** The campaign of these chapters on this world. Chapters are taken in the plan's order; the pace is the whole plan's. */
export function buildCampaign(world: World, _seed: number, chapters: ChapterSrc[]): Campaign {
  const pl = placesOf(world);
  const paces = campaignPaces();
  const slots: CampaignSlot[] = [];
  const quests: QuestDef[] = [];
  const firstOf: number[] = [];
  const byN = new Map(chapters.map((c) => [c.n, c]));
  // the runs of every written chapter, and their locations through the seas in order
  const written: { ch: ChapterSrc; first: number; size: number }[] = [];
  let slot = 0;
  for (const plan of PLAN) {
    firstOf[plan.n - 1] = slot;
    const ch = byN.get(plan.n);
    if (ch && ch.quests.length === plan.size) written.push({ ch, first: slot, size: plan.size });
    slot += plan.size;
  }
  const { runs, locations } = placeAll(pl, written);
  runs.forEach((run, r) => {
    const loc = locations[r];
    const ctx: QuestCtx = { pl, ch: run.ch, loc, turn: 0 };
    for (let s = run.from; s < run.from + run.size; s++) {
      const k = s - firstOf[run.ch.n - 1];
      const q: QuestSrc = run.ch.quests[k];
      const pace = paces[s];
      const id = `c${String(run.ch.n).padStart(2, '0')}_${String(k + 1).padStart(2, '0')}`;
      const travel = s === run.from && r > 0;
      const a = buildQuest(ctx, q, id, s, k, pace.gate, pace.xp, pace.silver, travel, q.alt ? { key: q.alt.key, way: 'a', label: q.alt.label[0] } : undefined);
      const turn = ctx.turn;
      if (q.alt) ctx.turn--;
      const b = q.alt ? buildQuest(ctx, q.alt, `${id}b`, s, k, pace.gate, pace.xp, pace.silver, travel, { key: q.alt.key, way: 'b', label: q.alt.label[1] }) : undefined;
      ctx.turn = turn;
      slots.push({ slot: s, ch: run.ch.n, k, gate: pace.gate, loc: loc.i, travel, a, ...(b ? { b } : {}) });
      quests.push(a);
      if (b) quests.push(b);
    }
  });
  return { slots, bySlot: new Map(slots.map((x) => [x.slot, x])), chapters: PLAN.map((p) => byN.get(p.n)).filter((c): c is ChapterSrc => !!c), quests, firstOf, locations };
}
