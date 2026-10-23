// Every quest chain of a world, its legs on the sea route (owner, 2026-10-23: «все квесты цепочек надо делать так, что
// они были максимум на удалении 3км друг от друга»; shared/src/data/questlegs.ts): the campaign chapter by chapter —
// its hand-over into a chapter's waters told apart, the one voyage a chapter may ask — the ports' jobs, the creature
// jobs, the islands' people's jobs, the region arcs and the written quests (tools/chain-legs.ts, tests/chainlegs.test.ts).

import type { World } from '../world/worldgen.ts';
import { buildCampaign } from './campaign/build.ts';
import type { Campaign } from './campaign/build.ts';
import { CHAPTERS } from './campaign/chapters.ts';
import { generateArcs } from './questarcs.ts';
import { generateIslandJobs, generateQuests } from './questgen.ts';
import { generateLairJobs } from './lairquests.ts';
import { QUESTS } from './quests.ts';
import type { QuestDef } from './quests.ts';
import { questLegs, stepPlace } from './questlegs.ts';
import type { At, ChainLeg } from './questlegs.ts';

export interface ChainAudit {
  byKind: Record<string, { legs: ChainLeg[] }>;
  /** The campaign's voyages into a chapter's waters (straight, metres): long by design, one a chapter. */
  handovers: { ch: number; d: number }[];
}

const portAt = (w: World, id: string): At | null => {
  const p = w.ports.find((x) => x.id === id);
  return p ? { x: p.x, y: p.y } : null;
};

/** The campaign's legs, chapter by chapter, the hand-overs apart. */
export function campaignChainLegs(w: World, c: Campaign): { legs: ChainLeg[]; handovers: { ch: number; d: number }[] } {
  const legs: ChainLeg[] = [];
  const handovers: { ch: number; d: number }[] = [];
  let at: At | null = null;
  let ch = 0;
  const home = c.locations.length - 1;
  for (const sl of c.slots) {
    // (the home-coming, the campaign's end at the start's harbour: a hand-over of its own)
    const homecoming = sl.loc === home && c.locations[home].from === sl.slot && c.locations[home - 1]?.ch === sl.ch;
    if (sl.ch !== ch || homecoming) {
      ch = sl.ch;
      // the hand-over: from where the chapter before ended to the chapter's first place
      const first = [sl.a, ...(sl.b ? [sl.b] : [])][0].steps.map((st) => stepPlace(w, st)).find((p) => p);
      if (at && first) handovers.push({ ch, d: Math.max(0, Math.hypot(first.x - at.x, first.y - at.y) - first.r) });
      if (first) at = { x: first.x, y: first.y };
    }
    const from: At = at ?? portAt(w, sl.a.port) ?? { x: 0, y: 0 };
    const a = questLegs(w, sl.a, from);
    legs.push(...a.legs);
    if (sl.b) legs.push(...questLegs(w, sl.b, from).legs);
    at = a.end;
  }
  return { legs, handovers };
}

export function chainAudit(w: World, seed: number): ChainAudit {
  const byKind: ChainAudit['byKind'] = {};
  const fromGiver = (kind: string, qs: QuestDef[], start?: (q: QuestDef) => At | null) => {
    const legs: ChainLeg[] = [];
    for (const q of qs) {
      const from = start?.(q) ?? portAt(w, q.port);
      if (from) legs.push(...questLegs(w, q, from).legs);
    }
    byKind[kind] = { legs };
  };
  const c = buildCampaign(w, seed, CHAPTERS);
  const camp = campaignChainLegs(w, c);
  byKind.campaign = { legs: camp.legs };
  fromGiver('jobs', generateQuests(w, seed));
  fromGiver('lairjobs', generateLairJobs(w, seed));
  fromGiver('islandjobs', generateIslandJobs(w, seed), (q) => {
    const i = q.island !== undefined ? w.islands[q.island] : undefined;
    return i ? { x: i.x, y: i.y } : null;
  });
  fromGiver('arcs', generateArcs(w, seed));
  fromGiver('written', QUESTS);
  return { byKind, handovers: camp.handovers };
}
