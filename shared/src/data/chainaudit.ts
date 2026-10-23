// Every quest chain of a world, its legs on the sea route (owner, 2026-10-23: «все квесты цепочек надо делать так, что
// они были максимум на удалении 3км друг от друга»; shared/src/data/questlegs.ts): the campaign chapter by chapter —
// its hand-over into a chapter's waters told apart, the one voyage a chapter may ask — the ports' jobs, the creature
// jobs, the islands' people's jobs, the region arcs and the written quests (tools/chain-legs.ts, tests/chainlegs.test.ts).

import type { World } from '../world/worldgen.ts';
import { arrival, buildCampaign } from './campaign/build.ts';
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
  handovers: { ch: number; d: number; passage: boolean }[];
}

const portAt = (w: World, id: string): At | null => {
  const p = w.ports.find((x) => x.id === id);
  return p ? { x: p.x, y: p.y } : null;
};

/** The campaign's legs, one chain from the first quest to the last (owner, 2026-10-23: a chapter starts within 3 km of
 *  where the one before ended). A chapter's start (and the home-coming) is its hand-over: sailed — its first leg, kept
 *  among the legs — or, where its place lies farther, a passage: a ship takes her there (she sails none of it). */
export function campaignChainLegs(w: World, c: Campaign): { legs: ChainLeg[]; handovers: { ch: number; d: number; passage: boolean }[] } {
  const legs: ChainLeg[] = [];
  const handovers: { ch: number; d: number; passage: boolean }[] = [];
  let at: At | null = null;
  let ch = 0;
  const home = c.locations.length - 1;
  for (const sl of c.slots) {
    const loc = c.locations[sl.loc];
    const homecoming = sl.loc === home && loc.from === sl.slot && c.locations[home - 1]?.ch === sl.ch;
    const handover = !!at && (sl.ch !== ch || homecoming);
    ch = sl.ch;
    if (at && loc.passage && loc.from === sl.slot) {
      // (the ship that takes her puts her off its quay, or off its island's shore facing where she came from)
      handovers.push({ ch: sl.ch, d: Math.hypot(loc.x - at.x, loc.y - at.y), passage: true });
      at = arrival(w, loc, at);
    }
    const from: At = at ?? portAt(w, sl.a.port) ?? { x: 0, y: 0 };
    const a = questLegs(w, sl.a, from);
    if (handover && !loc.passage) handovers.push({ ch: sl.ch, d: a.legs[0]?.d ?? 0, passage: false });
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
