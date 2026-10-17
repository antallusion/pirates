// The campaign laid on the world (docs/36): each chapter's quests, in order, given their places — the chapter's port,
// the ports and islands of its seas at the quest's level (the squares of docs/16 P2 whose ⚓ fits the quest's: her own
// band or the one below), their counts by that level, their words filled in English (the client reads them in Russian
// through the patterns of patterns.ts), their experience and silver by the pace (pacing.ts). Deterministic: the same
// world gives the same campaign, and a captain's place in it is a number (her `campaign.at`).

import { REGIONS } from '../../world/regions.ts';
import type { RegionId } from '../../world/regions.ts';
import type { Island, Port, World } from '../../world/worldgen.ts';
import { islandLife } from '../../world/islandlife.ts';
import { sectorAt } from '../../world/sectors.ts';
import { Rng, hashString } from '../../rng.ts';
import { GOODS } from '../goods.ts';
import { SITE_NAMES } from '../questgen.ts';
import type { QuestDef, QuestStep } from '../quests.ts';
import { shipBandOf } from '../xpcurve.ts';
import { campaignPaces } from './pacing.ts';
import { PLAN } from './plan.ts';
import { defaultCount, parseStep, wordsOf } from './steps.ts';
import type { StepSpec } from './steps.ts';
import type { ChapterSrc, QuestSrc, StepSrc, T } from './types.ts';

/** A place of the campaign, as its builder sees it: one quest and, at a branch, its second way. */
export interface CampaignSlot {
  slot: number;
  ch: number;
  k: number;
  gate: number;
  /** The quest (the first way at a branch) and the second way. */
  a: QuestDef;
  b?: QuestDef;
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
}

function placesOf(world: World): Places {
  const level = new Map<string | number, number>();
  const ports = world.ports.filter((p) => !p.raft);
  for (const p of ports) level.set(p.id, sectorAt(world, p.x, p.y).level);
  const islands = world.islands.filter(sailable);
  for (const i of islands) level.set(i.id, sectorAt(world, i.x, i.y).level);
  return { world, ports, islands, level };
}

/** The candidates of a kind for a quest of ⚓`band` in these seas, widening till some are found. */
function pick<X extends { region: RegionId; x: number; y: number }>(pl: Places, all: X[], key: (x: X) => string | number, seas: RegionId[], band: number, near: { x: number; y: number }, fits: (x: X) => boolean = () => true): X[] {
  const lv = (x: X) => pl.level.get(key(x)) ?? 1;
  const tiers: ((x: X) => boolean)[] = [
    (x) => seas.includes(x.region) && lv(x) <= band && lv(x) >= band - 1,
    (x) => seas.includes(x.region) && lv(x) <= band + 1 && lv(x) >= band - 2,
    (x) => seas.includes(x.region) && lv(x) <= band + 1,
    (x) => lv(x) <= band && lv(x) >= band - 1,
    (x) => lv(x) <= band + 1,
  ];
  for (const t of tiers) {
    const c = all.filter((x) => fits(x) && t(x));
    if (c.length) return c;
  }
  // nothing anywhere at her level: the nearest to the chapter's port
  return all.filter(fits).sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y)).slice(0, 6);
}

/** The step words of a step source: its own, or one of its kind's by the quest. */
function stepWords(src: StepSrc, spec: StepSpec, qid: string, i: number, part: 'pick' | 'drop' = 'pick'): T {
  if (typeof src !== 'string' && spec.kind !== 'carry') return [src[1], src[2]];
  const w = wordsOf(spec, part);
  return w[hashString(`${qid}:${i}:${part}`) % w.length];
}

export interface BuiltQuest {
  def: QuestDef;
  /** The places it was given (for the tests). */
  isles: number[];
}

function buildQuest(pl: Places, ch: ChapterSrc, src: { t: T; b: T; d: T; s: StepSrc[] }, id: string, slot: number, k: number, gate: number, xp: number, silver: number, seed: number, recent: Set<number>, way?: { key: string; way: 'a' | 'b'; label: T }): QuestDef {
  const rng = new Rng((hashString(id) ^ (seed * 2654435761)) >>> 0);
  const band = shipBandOf(gate);
  const seas: RegionId[] = [ch.region, ...(ch.more ?? [])];
  const hub = pl.world.ports.find((p) => p.id === ch.hub) ?? pl.ports[0];
  const specs = src.s.map((x) => parseStep(typeof x === 'string' ? x : x[0])).filter((x): x is StepSpec => typeof x !== 'string');
  // The ports: two of the chapter's seas at the quest's level, not the hub (a harbour of the drowned edge for the Abyss).
  const portSeas = seas.includes('the_abyss') ? [...seas, 'drowned_crown' as RegionId] : seas;
  const portCands = pick(pl, pl.ports, (p) => p.id, portSeas, band, hub, (p) => p.id !== hub.id);
  const port = rng.pick(portCands);
  const port2 = rng.pick(portCands.filter((p) => p.id !== port.id).length ? portCands.filter((p) => p.id !== port.id) : portCands);
  // The islands: of a site where a landing asks one, not those of the chapter's last few quests.
  const isleFor = (site?: string, not?: Island): { is: Island; site?: string } => {
    const fits = (i: Island) => i !== not && (!site || !!siteOf(i, site));
    let cands = pick(pl, pl.islands, (i) => i.id, seas, band, hub, fits);
    if (site && !cands.length) cands = pick(pl, pl.islands, (i) => i.id, seas, band, hub, (i) => i !== not);
    const fresh = cands.filter((i) => !recent.has(i.id));
    const is = rng.pick(fresh.length ? fresh : cands);
    return { is, site: site ? siteOf(is, site) : undefined };
  };
  const landSite = specs.find((s) => s.kind === 'land' && s.site)?.site;
  const land2Site = specs.find((s) => s.kind === 'land2' && s.site)?.site;
  const i1 = isleFor(landSite);
  const i2 = isleFor(land2Site, i1.is);
  recent.add(i1.is.id);
  recent.add(i2.is.id);
  if (recent.size > 8) recent.delete(recent.values().next().value!);
  const minShip = Math.max(1, band - 1);
  const atPort = specs.find((x) => x.kind === 'at');
  const atName = atPort ? (pl.world.ports.find((p) => p.id === atPort.port) ?? hub).name : hub.name;
  const v: Record<string, string> = {
    hub: hub.name, port: port.name, port2: port2.name, isle: i1.is.name, isle2: i2.is.name, region: REGIONS[ch.region].name, giver: giverName(ch, 0), at: atName,
  };
  const steps: QuestStep[] = [];
  src.s.forEach((x, i) => {
    const s = specs[i];
    if (!s) return;
    const n = s.n ?? defaultCount(s.kind, band);
    const at = s.kind === 'at' ? pl.world.ports.find((p) => p.id === s.port) ?? hub : undefined;
    const sv: Record<string, string> = { ...v, n: String(n), ...(s.good ? { good: GOODS[s.good].name } : {}), ...(at ? { at: at.name } : {}) };
    if (s.kind === 'land' && i1.site) sv.site = SITE_NAMES[i1.site] ?? i1.site;
    if (s.kind === 'land2' && i2.site) sv.site = SITE_NAMES[i2.site] ?? i2.site;
    const text = (part: 'pick' | 'drop' = 'pick') => fill(withGiver(stepWords(x, s, id, i, part)[0], ch, 0), sv);
    switch (s.kind) {
      case 'hub': steps.push({ type: 'visit', port: hub.id, text: text() }); break;
      case 'at': steps.push({ type: 'visit', port: at!.id, text: text() }); break;
      case 'port': steps.push({ type: 'visit', port: port.id, text: text() }); break;
      case 'port2': steps.push({ type: 'visit', port: port2.id, text: text() }); break;
      case 'isle': steps.push({ type: 'isle', island: i1.is.id, text: text() }); break;
      case 'isle2': steps.push({ type: 'isle', island: i2.is.id, text: text() }); break;
      case 'land': steps.push({ type: 'land', island: i1.is.id, ...(s.site && i1.site ? { site: i1.site } : {}), text: text() }); break;
      case 'land2': steps.push({ type: 'land', island: i2.is.id, ...(s.site && i2.site ? { site: i2.site } : {}), text: text() }); break;
      case 'board': steps.push({ type: 'board', count: n, minShip, text: text() }); break;
      case 'sink': steps.push({ type: 'sink', count: n, ...(s.role ? { role: s.role } : {}), minShip, text: text() }); break;
      case 'lair': steps.push({ type: 'lair', count: n, text: text() }); break;
      case 'beast': steps.push({ type: 'beast', count: n, group: s.group ?? 'any', text: text() }); break;
      case 'chart': steps.push({ type: 'chart', count: n, text: text() }); break;
      case 'dive': steps.push({ type: 'dive', count: n, text: text() }); break;
      case 'catch': steps.push({ type: 'catch', count: n, text: text() }); break;
      case 'named': steps.push({ type: 'named', count: 1, text: text() }); break;
      case 'rescue': steps.push({ type: 'rescue', count: n, text: text() }); break;
      case 'prize': steps.push({ type: 'prize', count: 1, text: text() }); break;
      case 'tribute': steps.push({ type: 'tribute', count: n, text: text() }); break;
      case 'carry':
        steps.push({ type: 'pickup', port: port.id, good: s.good!, qty: n, text: text('pick') });
        steps.push({ type: 'deliver', port: port2.id, good: s.good!, qty: n, text: text('drop') });
        break;
      case 'bring': steps.push({ type: 'deliver', port: hub.id, good: s.good!, qty: n, text: text() }); break;
      case 'escort': steps.push({ type: 'time_in', region: ch.region, seconds: n * 60, text: text() }); break;
      case 'reach': steps.push({ type: 'reach', region: ch.region, text: text() }); break;
      case 'claim': steps.push({ type: 'claim', text: text() }); break;
      case 'build': steps.push({ type: 'build', count: n, text: text() }); break;
      case 'recruit': steps.push({ type: 'recruit', count: n, text: text() }); break;
      case 'customs': steps.push({ type: 'customs', text: text() }); break;
      case 'contraband': steps.push({ type: 'sell_contraband', qty: n, text: text() }); break;
    }
  });
  const en = (p: T) => fill(withGiver(p[0], ch, 0), v);
  return {
    id, kind: 'campaign', name: src.t[0], mentor: ch.giver[0], port: hub.id, summary: en(src.b), requires: { level: gate }, steps,
    reward: { xp, silver }, category: 'campaign', portrait: ch.portrait,
    campaign: { slot, ch: ch.n, k, done: en(src.d), ...(way ? { key: way.key, way: way.way, label: way.label[0] } : {}) },
  };
}

/** The campaign of these chapters on this world. Chapters are taken in the plan's order; the pace is the whole plan's. */
export function buildCampaign(world: World, seed: number, chapters: ChapterSrc[]): Campaign {
  const pl = placesOf(world);
  const paces = campaignPaces();
  const slots: CampaignSlot[] = [];
  const quests: QuestDef[] = [];
  const firstOf: number[] = [];
  let slot = 0;
  const byN = new Map(chapters.map((c) => [c.n, c]));
  for (const plan of PLAN) {
    firstOf[plan.n - 1] = slot;
    const ch = byN.get(plan.n);
    const recent = new Set<number>();
    for (let k = 0; k < plan.size; k++, slot++) {
      const q: QuestSrc | undefined = ch?.quests[k];
      if (!ch || !q) continue; // a chapter not written yet: its places wait (the pace is the plan's)
      const pace = paces[slot];
      const id = `c${String(plan.n).padStart(2, '0')}_${String(k + 1).padStart(2, '0')}`;
      const a = buildQuest(pl, ch, q, id, slot, k, pace.gate, pace.xp, pace.silver, seed, recent, q.alt ? { key: q.alt.key, way: 'a', label: q.alt.label[0] } : undefined);
      const b = q.alt ? buildQuest(pl, ch, q.alt, `${id}b`, slot, k, pace.gate, pace.xp, pace.silver, seed, recent, { key: q.alt.key, way: 'b', label: q.alt.label[1] }) : undefined;
      slots.push({ slot, ch: plan.n, k, gate: pace.gate, a, ...(b ? { b } : {}) });
      quests.push(a);
      if (b) quests.push(b);
    }
  }
  return { slots, bySlot: new Map(slots.map((x) => [x.slot, x])), chapters: PLAN.map((p) => byN.get(p.n)).filter((c): c is ChapterSrc => !!c), quests, firstOf };
}
