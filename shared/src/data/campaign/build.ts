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

import { LANDING_R, REACH_OBJ } from '../reach.ts';
import { REGIONS } from '../../world/regions.ts';
import type { RegionId } from '../../world/regions.ts';
import type { Island, Port, World } from '../../world/worldgen.ts';
import { islandLife } from '../../world/islandlife.ts';
import { isLand } from '../../world/worldgen.ts';
import { sectorAt } from '../../world/sectors.ts';
import { navLen } from '../../world/navlen.ts';
import { hashString } from '../../rng.ts';
import { GOODS, portTrades } from '../goods.ts';
import type { GoodId } from '../goods.ts';
import { SITE_NAMES } from '../questgen.ts';
import { CHAIN_LEG, legTo, nearestSellerByRoute, questLegs } from '../questlegs.ts';
import type { At } from '../questlegs.ts';
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
  /** A chapter's first place (or the home-coming) farther than a chain's leg from where the one before ended (owner,
   *  2026-10-23: «никто за 6-10 и тем более 20 км никуда не поплывет»): a ship takes her there, free (server campaign.ts
   *  campaignPassage) — she never sails the crossing herself. */
  passage?: boolean;
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
  /** The sea routes asked for between places (kept). */
  routes: Map<string, number>;
}

function placesOf(world: World): Places {
  const level = new Map<string | number, number>();
  const ports = world.ports.filter((p) => !p.raft);
  for (const p of ports) level.set(p.id, sectorAt(world, p.x, p.y).level);
  const islands = world.islands.filter(sailable);
  for (const i of islands) level.set(i.id, sectorAt(world, i.x, i.y).level);
  const portIsle = new Map<string, Island>();
  for (const i of world.islands) if (i.portId && !portIsle.has(i.portId)) portIsle.set(i.portId, i);
  return { world, ports, islands, level, portIsle, near: new Map(), routes: new Map() };
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

/** The sea route from a location (its quay, or its island's shore facing it) into an island's waters. */
export function isleRoute(world: World, loc: { kind: 'port' | 'isle'; id: string | number; x: number; y: number }, i: Island, cap: number): number {
  const from = locPoint(world, loc, i);
  return legTo(world, from, { x: i.x, y: i.y, r: i.radius + 40, name: '' }, cap).d;
}

/** The islands about a location, nearest first: their shore within `r` of it, and the sea route there too (owner,
 *  2026-10-23: a chain's legs on the route — an island across its port's own island is far whatever the line says). */
function islandsNear(pl: Places, loc: { kind: 'port' | 'isle'; id: string | number; x: number; y: number }, r: number, not?: number): Island[] {
  const key = `${loc.kind}:${loc.id}:${r}`;
  let all = pl.near.get(key);
  if (!all) {
    const d = new Map<Island, number>();
    for (const i of pl.islands) {
      if (Math.abs(i.x - loc.x) > r + 6000 || Math.abs(i.y - loc.y) > r + 6000) continue;
      if (loc.kind === 'isle' && i.id === loc.id) continue;
      const x = locDist(pl.world, loc, i, pl.portIsle);
      if (x > r) continue;
      const route = isleRoute(pl.world, loc, i, r + 500);
      if (route <= r) d.set(i, route);
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
  /** `at:` ports named by its quests (the run is held there when it is near: mid-game QA 2026-10-23, chapter 6 sent her
   *  26 km to Gravesend for its first quest — the words name the location's own harbour, whatever the code's port). */
  at?: string;
  island: boolean;
  /** The goods its `bring:` steps ask for, bought at the nearest harbour that trades them (a seller near is a pull; a
   *  strong one for a good the quest's words name, which nearGood never trades for another). */
  goods: { good: GoodId; named: boolean }[];
  /** A delivery from its harbour to the nearest other (`carry:`): drawn to a harbour with another near. */
  carry: boolean;
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
    const goods = qs.flatMap((q) => [q, ...(q.alt ? [q.alt] : [])]).flatMap((q) => {
      const told = [q.t[0], q.b[0], q.d[0]].join(' ').toLowerCase();
      return q.s.map((x) => parseStep(typeof x === 'string' ? x : x[0])).flatMap((x) => (typeof x !== 'string' && x.kind === 'bring' && x.good ? [{ good: x.good as GoodId, named: !goodSwaps(x.good as GoodId, told) }] : []));
    });
    const carry = qs.flatMap((q) => [q, ...(q.alt ? [q.alt] : [])]).some((q) => q.s.some((x) => (typeof x === 'string' ? x : x[0]).startsWith('carry:')));
    out.push({ ch, from, size: len, gate: paces[Math.min(paces.length - 1, from)].gate, ...(ats.length ? { at: ats[ats.length - 1] } : {}), island, goods, carry });
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

/** The chain's limit (owner, 2026-10-23: «все квесты цепочек надо делать так, что они были максимум на удалении 3км друг
 *  от друга, никто за 6-10 и тем более 20 км никуда не поплывет»): within a chapter, no voyage between two of its
 *  locations over this on the sea route — the one voyage it may ask is its hand-over, into its waters. Under the
 *  chain's 3 km (CHAIN_LEG): where she ends a run and where the next one's first place lies are a little off each. */
export const CHAPTER_LEG = 2500;
/** A run held where the run before it was (no harbour or island near enough): allowed, a little dearer than a new place. */
const REPEAT = 4000;
/** A hand-over too long to sail (a passage): as dear as this many metres more (a chapter's seas with a place near
 *  where the one before ended take it). */
const PASSAGE_COST = 20000;
/** A place visited in a chapter before: allowed (the chain comes first), dearer than a new one. */
const USED = 1500;
/** A run held in the seas of the chapter before (on its way from them): allowed, dearer than its own seas. */
const OTHER_SEA = 2000;
/** How hard a chapter's first run is drawn to its mentor's harbour, and its last to the next one's. */
const HUB_PULL = 0.1;

/** The islands within reach of a harbour's quay (owner: what is farther from the quay than 1.5 km is far). */
const nearCount = (pl: Places, p: Port): number => islandsNear(pl, { kind: 'port', id: p.id, x: p.x, y: p.y }, LOCAL_R).length;

/** A location's own point toward another place: a harbour's quay, an island's shore facing it. */
export function locPoint(world: World, n: { kind: 'port' | 'isle'; id: string | number; x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  if (n.kind === 'port') return { x: n.x, y: n.y };
  const i = world.islands[n.id as number];
  const dx = to.x - i.x, dy = to.y - i.y, k = Math.hypot(dx, dy) || 1;
  return { x: i.x + (dx / k) * (i.radius + 40), y: i.y + (dy / k) * (i.radius + 40) };
}

/** The sea route between two locations (their quay or shore), within `cap` (Infinity past it). */
function locRoute(pl: Places, a: Node, b: Node, cap = CHAPTER_LEG): number {
  if (a.id === b.id && a.kind === b.kind) return 0;
  if (Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r > cap) return Infinity;
  const key = `${a.kind}:${a.id}|${b.kind}:${b.id}|${cap}`;
  let d = pl.routes.get(key);
  if (d === undefined) {
    const from = locPoint(pl.world, a, b);
    d = b.kind === 'port' ? navLen(pl.world, from.x, from.y, b.x, b.y, cap) : legTo(pl.world, from, { x: b.x, y: b.y, r: b.r, name: '' }, cap).d;
    pl.routes.set(key, d);
  }
  return d;
}

/**
 * Every run's location, chapter by chapter through the seas in order (owner, 2026-10-23: a chain's legs 3 km at most).
 * A chapter's first run is its hand-over: the place of its seas at its ⚓ nearest the last location (its mentor's port a
 * pull). Each run after it is held within CHAPTER_LEG of the run before on the sea route — a harbour or an island's
 * anchorage of the chapter's seas, not visited before, or the same place again where nothing new lies near enough. A run
 * that asks for a good is drawn to a harbour with a seller within reach of its quay, a delivery's run to one with
 * another harbour near. The Abyss's runs go to its islands where their quests name no harbour, to its edge's harbours
 * where they do. The home-coming's harbour is the campaign's end, however far.
 */
function placeAll(pl: Places, chapters: { ch: ChapterSrc; first: number; size: number }[]): { runs: Run[]; locations: CampaignLoc[] } {
  const byId = (id: string) => pl.ports.find((p) => p.id === id)!;
  const used = new Map<string | number, number>();
  const seller = new Map<string, number>();
  const others = new Map<string | number, boolean>();
  const runs: Run[] = [];
  const locations: CampaignLoc[] = [];
  let prev: Node | null = null;
  const lv = (k: string | number) => pl.level.get(k) ?? 1;
  const isleLoc = (i: Island): Node => ({ kind: 'isle', id: i.id, name: i.name, x: i.x, y: i.y, r: i.radius + 40, region: i.region, near: islandsNear(pl, { kind: 'isle', id: i.id, x: i.x, y: i.y }, LOCAL_R, i.id).length + 1 });
  const portNode = (p: Port): Node => ({ kind: 'port', id: p.id, name: p.name, x: p.x, y: p.y, r: 0, region: p.region, near: nearCount(pl, p) });
  // the islands that may hold a run: of a cluster (another within reach), the empty places and the rafts aside
  const isleNodes = pl.islands.filter((i) => islandsNear(pl, { kind: 'isle', id: i.id, x: i.x, y: i.y }, LOCAL_R, i.id).length >= 1).map(isleLoc);
  const portNodes = pl.ports.map(portNode);
  const byPort = new Map(portNodes.map((n) => [n.id, n]));
  // a harbour with another harbour within a delivery's reach of its quay
  const otherNear = (n: Node): boolean => {
    let hit = others.get(n.id);
    if (hit === undefined) others.set(n.id, (hit = portNodes.some((o) => o.id !== n.id && locRoute(pl, n, o) <= CHAPTER_LEG)));
    return hit;
  };
  chapters.forEach(({ ch, first, size }, ci) => {
    const next = chapters[ci + 1];
    const nextHub = next ? byId(next.ch.hub) : undefined;
    const lastOfAll = ci === chapters.length - 1;
    const abyss = ch.region === 'the_abyss';
    const fixedOf = (run: Run, r: number, n: number): Node | undefined => {
      // (the home-coming's harbour is the campaign's end, however far; any other `at:` a pull below, not a must)
      const at = run.at ? byId(run.at) : undefined;
      if (at && lastOfAll && r === n - 1) return byPort.get(at.id);
      // the start, Saltmarrow: the newcomer's own
      return r === 0 && ci === 0 ? byPort.get(ch.hub) : undefined;
    };
    const seas: RegionId[] = abyss ? ['drowned_crown'] : [ch.region, ...(ch.more ?? [])];
    const isleSeas: RegionId[] = abyss ? ['the_abyss'] : [ch.region, ...(ch.more ?? [])];
    const bridge: RegionId[] = next && !abyss ? [next.ch.region === 'the_abyss' ? 'drowned_crown' : next.ch.region] : [];
    // (the seas the chapter before ended in: its start may lie there, on the way, so it begins near where that one ended)
    const before = ci > 0 ? chapters[ci - 1].ch : null;
    const back: RegionId[] = before ? (before.region === 'the_abyss' ? ['drowned_crown', 'the_abyss'] : [before.region, ...(before.more ?? [])]) : [];
    const ownSea = (r: RegionId) => isleSeas.includes(r) || seas.includes(r);
    // a good's nearest seller by the route from a harbour's quay (within reach of it; past it, dear)
    const sellerCost = (n: Node, g: GoodId, strong: boolean): number => {
      const k = `${n.id}|${g}`;
      let d = seller.get(k);
      if (d === undefined) seller.set(k, (d = nearestSellerByRoute(pl.world, n, g, undefined, CHAPTER_LEG)?.d ?? Infinity));
      return Number.isFinite(d) ? d * 0.5 + (d > LOCAL_R ? 2000 : 0) : strong ? 4000 : 3000;
    };
    const start = prev as Node | null;
    // the next chapter's seas: its places, whose nearest the chapter drifts to, so the hand-over is a short sail
    const nextSeas: RegionId[] = next ? (next.ch.region === 'the_abyss' ? ['drowned_crown'] : [next.ch.region, ...(next.ch.more ?? [])]) : [];
    const nextPorts = portNodes.filter((n) => nextSeas.includes(n.region));
    const toNext = (p: Node): number => {
      if (!nextPorts.length || lastOfAll) return 0;
      let d = Infinity;
      for (const q of nextPorts) d = Math.min(d, Math.hypot(q.x - p.x, q.y - p.y));
      return d;
    };
    // the hand-over (owner, 2026-10-23): a sail within a chain's leg of where the chapter before ended; past it, a passage
    // (a ship takes her there) — dear, so a place near is taken wherever the chapter's seas have one
    const handover = (p: Node): number => {
      if (!start) return 0;
      if (start.id === p.id && start.kind === p.kind) return 0;
      const d = locRoute(pl, start, p);
      return Number.isFinite(d) ? d : PASSAGE_COST + Math.hypot(p.x - start.x, p.y - start.y);
    };
    const hub = byId(ch.hub);
    let pick: { runs: Run[]; nodes: Node[]; cost: number } | null = null;
    const base = Math.max(1, Math.round(size / 5)), most = Math.max(base, Math.floor(size / 2));
    const tries = abyss ? [abyssLens(ch, size)] : Array.from({ length: Math.min(3, most - base + 1) }, (_, k) => evenLens(size, base + k));
    for (const lens of tries) {
      const rs = runsFrom(ch, first, lens);
      // the candidates of each run: fixed; or the harbours of its seas (and the next's) at its ⚓, and — for a run whose
      // quests name no harbour — the islands of its seas at its ⚓ (an island's anchorage)
      const cands: Node[][] = rs.map((run, r) => {
        const fix = fixedOf(run, r, rs.length);
        if (fix) return [fix];
        const band = shipBandOf(run.gate);
        const fits = (n: Node) => lv(n.id) <= band + 2 && lv(n.id) >= band - 2;
        const c = [
          ...portNodes.filter((n) => (seas.includes(n.region) || bridge.includes(n.region) || back.includes(n.region)) && fits(n)),
          ...(run.island ? isleNodes.filter((n) => (isleSeas.includes(n.region) || bridge.includes(n.region) || back.includes(n.region)) && fits(n)) : []),
        ];
        // a chapter's first run: also where the chapter before ended, and every place a chain's leg from it (whatever its
        // sea or its ⚓ — the campaign drifts across the world step by step, owner 2026-10-23)
        if (r === 0 && start) {
          const near = [...portNodes, ...(run.island ? isleNodes : [])].filter((n) => (n.kind === 'port' || run.island) && Math.hypot(n.x - start.x, n.y - start.y) - n.r - start.r <= CHAPTER_LEG && locRoute(pl, start, n) <= CHAPTER_LEG);
          if ((start.kind === 'port' || run.island) && !near.some((n) => n.id === start.id && n.kind === start.kind)) near.push(start);
          for (const n of near) if (!c.some((x) => x.id === n.id && x.kind === n.kind)) c.push(n);
        }
        return c.length ? c : portNodes.filter((n) => seas.includes(n.region) && n.near >= 1);
      });
      const node = (n: Node, run: Run) => {
        const band = shipBandOf(run.gate), l = lv(n.id);
        // a delivery's good: its nearest seller within reach of the quay (QA 2026-10-23: the pearls for Shell Creek
        // were sold 15 km off); a carry's other harbour near; the `at:` harbour its quests name, a pull
        let need = 0;
        if (n.kind === 'port') {
          for (const g of run.goods) need += sellerCost(n, g.good, g.named);
          if (run.carry && !otherNear(n)) need += 1000;
        }
        return (run.at === n.id ? -1500 : 0) + need + (run === rs[0] && !abyss ? HUB_PULL * Math.hypot(n.x - hub.x, n.y - hub.y) : 0) + (start && n.id === start.id && run === rs[0] ? 0 : (used.get(n.id) ?? 0) * USED) + (n.near === 0 ? 2500 : n.near === 1 ? 1000 : 0)
          + (l > band + 1 ? 6000 : l > band || l < band - 1 ? 3000 : 0) + (ownSea(n.region) ? 0 : bridge.includes(n.region) ? 1500 : OTHER_SEA) + (n.kind === 'isle' && !abyss ? 1200 : 0);
      };
      // the path: best[r][j] the cost of the runs up to r ending at its j-th candidate; a voyage within the chapter
      // over the chain's limit is barred (a run may stay where the run before it was, whatever its own candidates)
      const best: { cost: number; from: number }[][] = [cands[0].map((p) => ({ cost: handover(p) + node(p, rs[0]), from: -1 }))];
      for (let r = 1; r < rs.length; r++) {
        const prevC = cands[r - 1], prevB = best[r - 1];
        const fixed = !!fixedOf(rs[r], r, rs.length);
        if (!fixed) for (const q of prevC) if ((q.kind === 'port' || rs[r].island) && !cands[r].some((x) => x.id === q.id && x.kind === q.kind)) cands[r].push(q);
        const own = cands[r];
        best[r] = own.map((p) => {
          const here = node(p, rs[r]);
          let bc = Infinity, bi = -1;
          for (let i = 0; i < prevC.length; i++) {
            if (prevB[i].cost === Infinity) continue;
            const q = prevC[i];
            if (prevB[i].cost + here >= bc) continue;
            const same = q.id === p.id && q.kind === p.kind;
            // (the home-coming's last run lies where it lies: its voyage is not the chapter's)
            const d = same ? REPEAT : fixed && lastOfAll ? Math.hypot(p.x - q.x, p.y - q.y) : locRoute(pl, q, p);
            const c = prevB[i].cost + d;
            if (c < bc) [bc, bi] = [c, i];
          }
          return { cost: bc + here, from: bi };
        });
      }
      const last = rs.length - 1;
      let bj = -1, bc = Infinity;
      cands[last].forEach((p, j) => {
        const c = best[last][j].cost + (nextHub ? HUB_PULL * Math.hypot(nextHub.x - p.x, nextHub.y - p.y) : 0) + toNext(p);
        if (c < bc) [bc, bj] = [c, j];
      });
      if (bj < 0 || bc === Infinity) continue;
      const nodes: Node[] = [];
      for (let r = last, j = bj; r >= 0; j = best[r][j].from, r--) nodes.unshift(cands[r][j]);
      if (!pick || bc < pick.cost) pick = { runs: rs, nodes, cost: bc };
    }
    const chosen = pick!;
    chosen.runs.forEach((run, r) => {
      const n = chosen.nodes[r];
      const far = r === 0 && !!start && !(start.id === n.id && start.kind === n.kind) && !(locRoute(pl, start, n, CHAIN_LEG) <= CHAIN_LEG);
      const home = lastOfAll && r === chosen.runs.length - 1 && r > 0 && !(locRoute(pl, chosen.nodes[r - 1], n, CHAIN_LEG) <= CHAIN_LEG);
      const loc: CampaignLoc = { i: locations.length, kind: n.kind, id: n.id, name: n.name, x: n.x, y: n.y, region: n.region, ch: ch.n, from: run.from, size: run.size, ...(far || home ? { passage: true } : {}) };
      if (r === 0 || chosen.nodes[r - 1].id !== n.id) used.set(loc.id, (used.get(loc.id) ?? 0) + 1);
      prev = n;
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
  /** An island's waters' reach from its middle (0: a harbour's quay). */
  r: number;
  region: RegionId;
  /** Islands within reach (an island's own counted). */
  near: number;
}

// ------------------------------------------------------------------ a quest at its location

/** How near a coast's marked place her ship must come: her hull within REACH_OBJ of it (owner, 2026-10-22: 300 m from
 *  her middle → 30 m from her hull, reach.ts; the step checks it so — quests.ts — this is the ring her chart draws). */
export const SPOT_R = REACH_OBJ + LANDING_R;

/** The coves and spits of a harbour's own island within reach of its quay (water off its shore, 0.5–1.45 km from the
 *  anchorage), round the island in order. */
function coastSpots(pl: Places, port: Port, own: Island): { x: number; y: number }[] {
  const out: { x: number; y: number; a: number }[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    for (const off of [160, 260, 380]) {
      const x = own.x + Math.cos(a) * (own.radius + off), y = own.y + Math.sin(a) * (own.radius + off);
      const d = Math.hypot(x - port.x, y - port.y);
      if (d < 500 || d > LOCAL_R - 50 || isLand(pl.world, x, y) || navLen(pl.world, port.x, port.y, x, y, LOCAL_R) > LOCAL_R) continue;
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
  /** Where the chain stands as the quest begins (where the one before it ended): its places are picked within a
   *  chain's leg of it where the location has them (owner, 2026-10-23). */
  at: At;
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
  // a delivery's other end: the harbour nearest to this one by the sea route (a short run along the coast)
  const byRoute = (from: { x: number; y: number }, not?: string) => {
    let best: Port | null = null, bd = Infinity;
    for (const p of pl.ports) {
      if (p.id === not || Math.hypot(p.x - from.x, p.y - from.y) > Math.min(bd, CHAIN_LEG)) continue;
      // (there and back: the mentor waits at the quay it set out from)
      const d = Math.max(navLen(pl.world, from.x, from.y, p.x, p.y, CHAIN_LEG), navLen(pl.world, p.x, p.y, from.x, from.y, CHAIN_LEG));
      if (d < bd) [best, bd] = [p, d];
    }
    return best;
  };
  // a harbour within a chain's leg of both her and the quay (the nearer of the two legs' longer)
  const between = (from: At, to: Port): Port | null => {
    let best: Port | null = null, bd = Infinity;
    for (const p of pl.ports) {
      if (p.id === to.id || Math.hypot(p.x - to.x, p.y - to.y) > CHAIN_LEG || Math.hypot(p.x - from.x, p.y - from.y) > CHAIN_LEG) continue;
      const d = Math.max(navLen(pl.world, from.x, from.y, p.x, p.y, CHAIN_LEG), navLen(pl.world, p.x, p.y, to.x, to.y, CHAIN_LEG));
      if (d < bd) [best, bd] = [p, d];
    }
    return best;
  };
  // (none within a chain's leg: the carry is a delivery to the mentor's own quay — a `bring` — owner, 2026-10-23)
  const other = port ? byRoute(port, port.id) : null;
  const carries = specs.some((s) => s.kind === 'carry') && !!other;
  const home = port ?? pl.world.ports.find((p) => p.id === ch.hub)!;
  // The islands about the location, its own first for an island's run, in turn by the quest (a run's quests see them all).
  const anchor = loc.kind === 'isle' ? pl.world.islands[loc.id as number] : null;
  const isles = islandsNear(pl, loc, LOCAL_R, anchor?.id);
  // A harbour with no island within reach of its quay (owner, 2026-10-18: «чтобы все было недалеко»): its own island's
  // coast stands for them — a cove to round to, a spit to land a party on, within reach of the quay.
  // (the ones within a chain's leg of where she stands — and from there back to the location: the mentor waits there)
  const legFrom = (i: Island) => legTo(pl.world, c.at, { x: i.x, y: i.y, r: i.radius + 40, name: '' }, CHAIN_LEG * 2).d;
  const back = (i: Island) => {
    const l = legTo(pl.world, c.at, { x: i.x, y: i.y, r: i.radius + 40, name: '' }, CHAIN_LEG * 2);
    if (l.d > CHAIN_LEG) return Infinity;
    return anchor ? (i === anchor ? 0 : legTo(pl.world, l.at, { x: anchor.x, y: anchor.y, r: anchor.radius + 40, name: '' }, CHAIN_LEG).d) : navLen(pl.world, l.at.x, l.at.y, loc.x, loc.y, CHAIN_LEG);
  };
  const near0 = (anchor ? [anchor, ...isles] : isles).filter((i) => legFrom(i) <= CHAIN_LEG);
  const near1 = near0.filter((i) => back(i) <= CHAIN_LEG);
  // A harbour with no island within reach of its quay (owner, 2026-10-18: «чтобы все было недалеко»), or none within a
  // chain's leg of her: its own island's coast stands for them — a cove to round to, a spit to land a party on, within
  // reach of the quay. An island's run with none near: its own island.
  const ownIsle = port && (!isles.length || !near0.length) ? pl.portIsle.get(port.id) : undefined;
  const coast = ownIsle ? coastSpots(pl, port!, ownIsle) : [];
  const ring0 = anchor ? [anchor, ...isles] : ownIsle ? [ownIsle] : isles;
  const reach = ownIsle ? ring0 : near1.length ? near1 : near0.length ? near0 : anchor ? [anchor] : [];
  const ring = reach.length ? [...reach, ...ring0.filter((i) => !reach.includes(i))] : [...ring0].sort((a, b) => legFrom(a) - legFrom(b));
  const at = (i: number) => ring[(c.turn + i) % Math.max(1, reach.length || 1)] ?? anchor ?? pl.islands[0];
  const pool = reach.length ? reach : ring;
  const withSite = (site: string | undefined, not?: Island): { is: Island; site?: string } => {
    if (site) {
      // a site of the location's own waters: the one asked for, else another of its islands' sites (the words name it)
      const s = pool.find((i) => i !== not && siteOf(i, site));
      if (s) return { is: s, site: siteOf(s, site) };
      for (const other of Object.keys(SITE_NAMES)) {
        const o = pool.find((i) => i !== not && siteOf(i, other) === other);
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
  const told = [src.t[0], src.b[0], src.d[0]].join(' ').toLowerCase();
  src.s.forEach((x, i) => {
    let s = specs[i];
    if (!s) return;
    if (s.kind === 'carry' && !other) s = { ...s, kind: 'bring' };
    // a delivery's good sold nowhere near (and not named by the quest's words): the nearest of its kind
    let waits: Port | null = null;
    if (s.kind === 'bring' && s.good) {
      const g = nearGood(pl.world, home, s.good, told);
      if (g !== s.good) s = { ...s, good: g };
      // none sold within a chain's leg of her and of the quay: it waits at a neighbour's quay between (else on the
      // quay itself, in its warehouse), taken on there
      const sold = nearestSellerByRoute(pl.world, c.at, s.good!, undefined, CHAIN_LEG);
      if (!sold || navLen(pl.world, sold.port.x, sold.port.y, home.x, home.y, CHAIN_LEG) > CHAIN_LEG) waits = between(c.at, home) ?? home;
    }
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
          const close = coast.filter((p) => legTo(pl.world, c.at, { ...p, r: SPOT_R, name: '' }, CHAIN_LEG).d <= CHAIN_LEG);
          const pool = close.length ? close : coast;
          const spot = pool[(c.turn + i) % Math.max(1, pool.length)] ?? { x: port!.x, y: port!.y };
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
        steps.push({ type: 'deliver', port: other!.id, good: s.good!, qty: n, text: text('drop') });
        break;
      case 'bring':
        if (waits) {
          const w = STEP_WORDS.bring_pick[hashString(`${id}:${i}:pick`) % STEP_WORDS.bring_pick.length];
          steps.push({ type: 'pickup', port: waits.id, good: s.good!, qty: n, text: fill(w[0], { ...sv, port2: waits.name }) });
        }
        steps.push({ type: 'deliver', port: home.id, good: s.good!, qty: n, text: text() });
        break;
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

/** Goods a delivery may stand in for one another with, by kind — and the words that name each in a quest's English (a
 *  quest whose words name its good keeps it: «bring powder» is not to bring muskets). */
const KIN: GoodId[][] = [
  ['pearls', 'spices', 'tobacco', 'scrimshaw', 'ambergris', 'narwhal_tusk'],
  ['coal', 'timber', 'tar', 'whale_oil'],
  ['drowned_silk', 'leviathan_bone', 'kraken_ink', 'sulfur_iron'],
  ['rum', 'sugar', 'salt', 'cloth'],
];
const NAMED: Partial<Record<GoodId, RegExp>> = {
  pearls: /\bpearls?\b/, spices: /\bspices?\b/, tobacco: /\btobacco\b/, scrimshaw: /\bscrimshaw\b/, ambergris: /\bambergris\b/, narwhal_tusk: /\b(narwhal|tusks?)\b/,
  coal: /\b(coal|colliers?)\b/, timber: /\b(timber|logs?|lumber)\b/, tar: /\b(tar|pitch)\b/, whale_oil: /\b(whale oil|oil)\b/,
  drowned_silk: /\bsilk\b/, leviathan_bone: /\bleviathan bone\b/, kraken_ink: /\bink\b/, sulfur_iron: /\bsul(f|ph)ur\b/,
  rum: /\brum\b/, sugar: /\bsugar\b/, salt: /\bsalt\b/, cloth: /\bcloth\b/,
};

/** Whether a delivery's good may be traded for another of its kind (it has kin, and the quest's words do not name it). */
export const goodSwaps = (good: GoodId, told: string): boolean => !!KIN.find((k) => k.includes(good)) && !(NAMED[good]?.test(told) ?? true);

/** The good a `bring:` step asks for at a harbour (mid-game QA 2026-10-23: the pearls for Shell Creek were sold 15 km
 *  off; owner: a chain's legs 3 km at most): its own while a harbour trades it within reach of the quay (LOCAL_R on the
 *  sea route), or the quest's words name it; else the one of its kind sold nearest. */
export function nearGood(world: World, home: { x: number; y: number; id: string }, good: GoodId, told: string): GoodId {
  if (!goodSwaps(good, told)) return good;
  const own = nearestSellerByRoute(world, home, good, undefined, CHAIN_LEG)?.d ?? Infinity;
  if (own <= LOCAL_R) return good;
  let best = good, bd = own;
  for (const g of KIN.find((k) => k.includes(good))!) {
    const d = nearestSellerByRoute(world, home, g, undefined, CHAIN_LEG)?.d ?? Infinity;
    if (d < bd - 300) [best, bd] = [g, d];
  }
  return best;
}

/** Where she comes to a place from afar (a passage puts her there; a chapter's start is reckoned from it): a harbour's
 *  quay, an island's shore facing where she came from. */
export function arrival(world: World, loc: { kind: 'port' | 'isle'; id: string | number; x: number; y: number }, from: { x: number; y: number }): { x: number; y: number } {
  if (loc.kind === 'port') return { x: loc.x, y: loc.y };
  const i = world.islands[loc.id as number];
  const k = Math.hypot(from.x - i.x, from.y - i.y) || 1;
  return { x: i.x + ((from.x - i.x) / k) * (i.radius + 40), y: i.y + ((from.y - i.y) / k) * (i.radius + 40) };
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
  // The quests laid on the places; a run whose first quest still runs over a chain's leg from where she ended the run
  // before (the places a little off each other's quays and shores) is held where that one was — or, a harbour's run
  // after an island's, that one is held at its harbour — and all laid again (owner, 2026-10-23: 3 km at most).
  const lay = (): number[] => {
    slots.length = 0;
    quests.length = 0;
    const far: number[] = [];
    let chain: At | null = null;
    runs.forEach((run, r) => {
      const loc = locations[r];
      const fresh = !chain || r === 0 || locations[r - 1].ch !== loc.ch;
      const ctx: QuestCtx = { pl, ch: run.ch, loc, turn: 0, at: !chain ? { x: loc.x, y: loc.y } : fresh || (loc.passage && r > 0) ? arrival(world, loc, chain) : chain };
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
        const legs = questLegs(world, a, ctx.at);
        if (s === run.from && !fresh && !loc.passage && legs.legs.some((l) => l.d > CHAIN_LEG)) far.push(r);
        // (a chapter's first quest farther than a leg from where the one before ended: a ship takes her — a passage)
        if (s === run.from && fresh && r > 0 && chain && !loc.passage && questLegs(world, a, chain).legs.some((l) => l.d > CHAIN_LEG)) loc.passage = true;
        ctx.at = legs.end;
        slots.push({ slot: s, ch: run.ch.n, k, gate: pace.gate, loc: loc.i, travel, a, ...(b ? { b } : {}) });
        quests.push(a);
        if (b) quests.push(b);
      }
      chain = ctx.at;
    });
    return far;
  };
  const hold = (to: CampaignLoc, from: CampaignLoc) => Object.assign(to, { kind: from.kind, id: from.id, name: from.name, x: from.x, y: from.y, region: from.region });
  for (let pass = 0; pass < 6; pass++) {
    const far = lay();
    let moved = false;
    for (const r of far) {
      const was = locations[r - 1], loc = locations[r];
      if (was.id === loc.id && was.kind === loc.kind) continue;
      if (r === runs.length - 1 && runs[r].at) continue; // (the home-coming lies where it lies)
      if (was.kind === 'port' || runs[r].island) hold(loc, was);
      else if (loc.kind === 'port') hold(was, loc);
      else continue;
      moved = true;
    }
    if (!moved) break;
  }
  // what no holding mends (a run's first quest still over a leg from where the one before ended): a ship takes her
  const left = lay();
  if (left.length) {
    for (const r of left) locations[r].passage = true;
    lay();
  }
  return { slots, bySlot: new Map(slots.map((x) => [x.slot, x])), chapters: PLAN.map((p) => byN.get(p.n)).filter((c): c is ChapterSrc => !!c), quests, firstOf, locations };
}
