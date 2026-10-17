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
  const own = loc.kind === 'isle' ? world.islands[loc.id as number] : portIsle ? portIsle.get(loc.id as string) : world.islands.find((x) => x.portId === loc.id);
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
  return q.s.some((x) => /^(port|port2|at|carry|bring|recruit|customs|contraband)\b/.test(typeof x === 'string' ? x : x[0]));
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

/** A chapter's run lengths: about five (4–6) each; in the Abyss cut so that as many runs as may name no harbour (they are
 *  held at an island of the Abyss itself, not at a harbour of its edge). */
function runLengths(ch: ChapterSrc, size: number): number[] {
  const n = Math.max(1, Math.round(size / 5));
  const even = Array.from({ length: n }, (_, r) => Math.floor(size / n) + (r < size % n ? 1 : 0));
  if (ch.region !== 'the_abyss') return even;
  const bound = ch.quests.map((q) => portBound(q) || (q.alt ? portBound(q.alt) : false));
  // best[i]: the most harbourless runs over the first i quests (and how), runs of 4–6
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
  return best[size]?.cut ?? even;
}

/** A chapter's runs: its quests in runs of about five (4–6). */
function runsOf(ch: ChapterSrc, first: number, size: number): Run[] {
  const paces = campaignPaces();
  const lens = runLengths(ch, size);
  const out: Run[] = [];
  let from = first;
  for (const len of lens) {
    const qs = ch.quests.slice(from - first, from - first + len);
    const ats = qs.flatMap((q) => [q, ...(q.alt ? [q.alt] : [])]).flatMap((q) => q.s).map((x) => (typeof x === 'string' ? x : x[0])).filter((c) => c.startsWith('at:')).map((c) => c.slice(3));
    const island = ch.region === 'the_abyss' && !qs.some((q) => portBound(q) || (q.alt ? portBound(q.alt) : false));
    out.push({ ch, from, size: len, gate: paces[Math.min(paces.length - 1, from)].gate, ...(ats.length ? { at: ats[ats.length - 1] } : {}), island });
    from += len;
  }
  return out;
}

/** Every run's location, through the seas in order: a run at its chapter's mentor's port first (or the port its quests
 *  name), then the nearest port of the chapter's seas at the run's ⚓ not yet visited (an island of the Abyss for a run
 *  of the Abyss that names no harbour). */
/** A newcomer's chapters (before the eighth level): their free runs' harbours chosen as a path from the mentor's port to
 *  the next chapter's, the longest leg as short as the coast allows (owner's QA, 2026-10-18: a new captain must not sail
 *  far before she has learned the sea — under 5 km where it may be). */
function earlyPaths(pl: Places, runs: Run[]): Map<Run, Port> {
  const out = new Map<Run, Port>();
  const byId = (id: string) => pl.ports.find((p) => p.id === id);
  const chs = [...new Set(runs.map((r) => r.ch.n))];
  const taken = new Set<string>();
  for (const n of chs) {
    const group = runs.filter((r) => r.ch.n === n);
    if (group[0].gate >= 8 || group.some((r) => r.island || r.at)) continue;
    const start = byId(group[0].ch.hub)!;
    const nextRun = runs[runs.indexOf(group[group.length - 1]) + 1];
    const end = nextRun ? byId(nextRun.ch.hub) : undefined;
    const free = group.slice(1);
    if (!free.length) continue;
    const band = shipBandOf(free[0].gate);
    const seas: RegionId[] = [group[0].ch.region, ...(group[0].ch.more ?? [])];
    const isles = (p: Port) => islandsNear(pl, { kind: 'port', id: p.id, x: p.x, y: p.y }, LOCAL_R).length;
    let cands = pl.ports.filter((p) => seas.includes(p.region) && (pl.level.get(p.id) ?? 1) <= band && p.id !== start.id && p.id !== end?.id && !taken.has(p.id) && isles(p) >= 1);
    const mid = end ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } : start;
    cands = cands.sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y)).slice(0, 16);
    let best: { cost: number; path: Port[] } | null = null;
    const walk = (path: Port[], from: Port, max: number, sum: number) => {
      if (path.length === free.length) {
        const last = end ? Math.hypot(end.x - from.x, end.y - from.y) : 0;
        const m = Math.max(max, last), cost = m * 10 + sum + last + path.reduce((a, p) => a + (isles(p) === 1 ? 3000 : 0), 0);
        if (!best || cost < best.cost) best = { cost, path: [...path] };
        return;
      }
      for (const c of cands) {
        if (path.includes(c)) continue;
        const leg = Math.hypot(c.x - from.x, c.y - from.y);
        if (best && Math.max(max, leg) * 10 > best.cost) continue;
        path.push(c);
        walk(path, c, Math.max(max, leg), sum + leg);
        path.pop();
      }
    };
    walk([], start, 0, 0);
    const found = best as { cost: number; path: Port[] } | null;
    if (found) found.path.forEach((p, i) => {
      out.set(free[i], p);
      taken.add(p.id);
    });
  }
  return out;
}

function placeRuns(pl: Places, runs: Run[]): CampaignLoc[] {
  const byIdOf = (id: string) => pl.ports.find((p) => p.id === id);
  const early = earlyPaths(pl, runs);
  const used = new Map<string | number, number>();
  const out: CampaignLoc[] = [];
  let prev: { x: number; y: number } | null = null;
  let lastCh = 0;
  for (const run of runs) {
    const ch = run.ch;
    const band = shipBandOf(run.gate);
    const seas: RegionId[] = [ch.region, ...(ch.more ?? [])];
    const lv = (k: string | number) => pl.level.get(k) ?? 1;
    // (a newcomer's legs short — under 5 km before the fifth level — and each chapter's runs drift toward the next
    // chapter's mentor's port, so the voyage there is short too)
    const ri = runs.indexOf(run);
    const nextCh = runs.slice(ri + 1).find((x) => x.ch.n !== ch.n);
    const nextHub = nextCh ? byIdOf(nextCh.ch.hub) : undefined;
    const score = (k: string | number, x: number, y: number, nearIsles: number) => {
      const leg = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
      return (used.get(k) ?? 0) * 1e6 + leg + (run.gate < 5 && leg > 5000 ? 40000 : 0) + (nextHub ? (run.gate < 6 ? 2 : 0.6) * Math.hypot(x - nextHub.x, y - nextHub.y) : 0)
        + (nearIsles === 0 ? 60000 : nearIsles === 1 ? 15000 : 0) - Math.min(3, nearIsles) * 2500;
    };
    let loc: CampaignLoc | null = null;
    const byId = (id: string) => pl.ports.find((p) => p.id === id);
    // a run whose quests name a port is held there when its waters have islands enough (or it is the campaign's last: home);
    // a chapter's first run at its mentor's port
    const atPort = run.at ? byId(run.at) : undefined;
    const roomy = (p: Port | undefined) => !!p && islandsNear(pl, { kind: 'port', id: p.id, x: p.x, y: p.y }, LOCAL_R).length >= 2;
    const last = run === runs[runs.length - 1];
    const fixed = atPort && (roomy(atPort) || last) ? atPort : ch.n !== lastCh ? byId(ch.hub) : undefined;
    const planned = early.get(run);
    if (planned && !fixed) loc = { i: out.length, kind: 'port', id: planned.id, name: planned.name, x: planned.x, y: planned.y, region: planned.region, ch: ch.n, from: run.from, size: run.size };
    else if (fixed && !run.island) loc = { i: out.length, kind: 'port', id: fixed.id, name: fixed.name, x: fixed.x, y: fixed.y, region: fixed.region, ch: ch.n, from: run.from, size: run.size };
    else if (run.island) {
      const pool = pl.islands.filter((i) => i.region === 'the_abyss');
      const tiers = [(i: Island) => lv(i.id) <= band && lv(i.id) >= band - 1, () => true];
      for (const t of tiers) {
        const c = pool.filter(t);
        if (!c.length) continue;
        const best = c.map((i) => ({ i, s: score(i.id, i.x, i.y, islandsNear(pl, { kind: 'isle', id: i.id, x: i.x, y: i.y }, LOCAL_R, i.id).length) })).sort((a, b) => a.s - b.s)[0].i;
        loc = { i: out.length, kind: 'isle', id: best.id, name: best.name, x: best.x, y: best.y, region: best.region, ch: ch.n, from: run.from, size: run.size };
        break;
      }
    }
    if (!loc) {
      const portSeas = seas.includes('the_abyss') ? [...seas, 'drowned_crown' as RegionId] : seas;
      const tiers = [
        (p: Port) => portSeas.includes(p.region) && lv(p.id) <= band && lv(p.id) >= band - 1,
        (p: Port) => portSeas.includes(p.region) && lv(p.id) <= band + 1 && lv(p.id) >= band - 2,
        (p: Port) => portSeas.includes(p.region),
        () => true,
      ];
      for (const t of tiers) {
        // (a harbour with islands in its waters: the location's landings and visits are all close)
        const c = pl.ports.filter((p) => t(p) && islandsNear(pl, { kind: 'port', id: p.id, x: p.x, y: p.y }, LOCAL_R).length >= 1);
        if (!c.length) continue;
        const best = c.map((p) => ({ p, s: score(p.id, p.x, p.y, islandsNear(pl, { kind: 'port', id: p.id, x: p.x, y: p.y }, LOCAL_R).length) })).sort((a, b) => a.s - b.s)[0].p;
        loc = { i: out.length, kind: 'port', id: best.id, name: best.name, x: best.x, y: best.y, region: best.region, ch: ch.n, from: run.from, size: run.size };
        break;
      }
    }
    used.set(loc!.id, (used.get(loc!.id) ?? 0) + 1);
    prev = loc!;
    lastCh = ch.n;
    out.push(loc!);
  }
  return out;
}

// ------------------------------------------------------------------ a quest at its location

interface QuestCtx {
  pl: Places;
  ch: ChapterSrc;
  loc: CampaignLoc;
  /** The run's turn among its islands (each quest of a run starts at the next of them). */
  turn: number;
}

function buildQuest(c: QuestCtx, src: { t: T; b: T; d: T; s: StepSrc[] }, id: string, slot: number, k: number, gate: number, xp: number, silver: number, travel: boolean, way?: { key: string; way: 'a' | 'b'; label: T }): QuestDef {
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
  let isles = islandsNear(pl, loc, LOCAL_R, anchor?.id);
  if (!isles.length && !anchor) isles = islandsNear(pl, loc, 4000).slice(0, 2); // (a port with none within reach: its two nearest)
  const ring = anchor ? [anchor, ...isles] : isles;
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
    // an island's run of the Abyss: the mentor's ship rides at anchor off its island, not in a harbour
    if (!port && s.kind === 'hub' && typeof x === 'string') words = STEP_WORDS.hub_isle[hashString(`${id}:${i}`) % STEP_WORDS.hub_isle.length];
    const text = (part: 'pick' | 'drop' = 'pick') => fill(withGiver((part === 'drop' ? stepWords(x, s, id, i, 'drop') : words)[0], ch, 0), sv);
    const visitHere = () => (port ? steps.push({ type: 'visit', port: port.id, text: text() }) : steps.push({ type: 'isle', island: anchor!.id, text: text() }));
    switch (s.kind) {
      case 'hub':
      case 'at':
      case 'port':
      case 'port2': visitHere(); break;
      case 'isle': steps.push({ type: 'isle', island: i1.is.id, text: text() }); break;
      case 'isle2': steps.push({ type: 'isle', island: i2.is.id, text: text() }); break;
      case 'land': steps.push({ type: 'land', island: i1.is.id, ...(s.site && i1.site ? { site: i1.site } : {}), text: text() }); break;
      case 'land2': steps.push({ type: 'land', island: i2.is.id, ...(s.site && i2.site ? { site: i2.site } : {}), text: text() }); break;
      case 'board': steps.push({ type: 'board', count: n, minShip, near, text: text() }); break;
      case 'sink': steps.push({ type: 'sink', count: n, ...(s.role ? { role: s.role } : {}), minShip, near, text: text() }); break;
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
  const runs: Run[] = [];
  let slot = 0;
  for (const plan of PLAN) {
    firstOf[plan.n - 1] = slot;
    const ch = byN.get(plan.n);
    if (ch && ch.quests.length === plan.size) runs.push(...runsOf(ch, slot, plan.size));
    slot += plan.size;
  }
  const locations = placeRuns(pl, runs);
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
