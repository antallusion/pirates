// Path and Legend quests (docs/00 D1, docs/02 §7): the canon captains are living legends and mentors. A captain
// keeps the Path chosen at creation; the other base Paths open through their mentor's Path quest, the premium
// Paths through a Legend quest. The First Descent opens the Abyssal tree to anyone who is not already drowned.

import type { CaptainId } from './captains.ts';
import type { FactionId } from './factions.ts';
import type { GoodId } from './goods.ts';
import type { RegionId } from '../world/regions.ts';
import type { TreeId } from './talents.ts';

export type QuestStep =
  | { type: 'visit'; port: string; text: string }
  | { type: 'deliver'; port: string; good: GoodId; qty: number; text: string }
  | { type: 'sink'; count: number; role?: 'pirate' | 'patrol' | 'merchant' | 'ghost' | 'hunter'; minTier?: number; region?: RegionId; text: string }
  /** Generated quests (docs/11 P4): take a cargo aboard at a port; land a party on an island (at one of its sites). */
  | { type: 'pickup'; port: string; good: GoodId; qty: number; text: string }
  | { type: 'land'; island: number; site?: string; text: string }
  | { type: 'board'; count: number; text: string }
  | { type: 'prize'; count: number; text: string }
  | { type: 'sell_contraband'; qty: number; port?: string; text: string }
  | { type: 'customs'; text: string }
  | { type: 'chart'; count: number; text: string }
  | { type: 'reach'; region: RegionId; north?: number; text: string }
  | { type: 'time_in'; region: RegionId; seconds: number; weather?: 'black_storm'; text: string }
  | { type: 'fleet_win'; count: number; text: string }
  | { type: 'die_in'; region: RegionId; text: string }
  | { type: 'dive'; count: number; text: string };

export interface QuestDef {
  id: string;
  kind: 'path' | 'legend' | 'story' | 'job';
  name: string;
  mentor: string;
  port: string; // where it is offered and where it ends
  summary: string;
  requires: { level?: number; rep?: Partial<Record<FactionId, number>>; treePoints?: Partial<Record<TreeId, number>>; anyOf?: boolean };
  steps: QuestStep[];
  reward: { xp: number; silver: number; path?: CaptainId; deed?: string };
  /** A generated job's category and its template (plot.flavour). */
  category?: string;
  template?: string;
}

export const QUESTS: QuestDef[] = [
  // ---------------------------------------------------------------- the way into the Abyss (docs/02 §14.A.1)
  {
    id: 'q_last_leaf', kind: 'story', name: 'The Last Leaf', mentor: 'Tobias Wren', port: 'wrecktide',
    summary: 'Wren\'s great chart has one leaf he never drew: the sea past the Maelstrom Wall, where the stars are wrong. He will give it only to a captain who has seen the edges of everything else.',
    requires: { level: 45 },
    steps: [
      { type: 'chart', count: 40, text: 'Chart forty islands you have never seen.' },
      { type: 'time_in', region: 'dead_mans_expanse', seconds: 600, text: 'Spend ten minutes at sea in Dead Man\'s Expanse.' },
      { type: 'reach', region: 'drowned_crown', text: 'Sail into the Drowned Crown.' },
      { type: 'dive', count: 2, text: 'Send divers down to two sunken wrecks.' },
      { type: 'visit', port: 'wrecktide', text: 'Bring your log to Tobias Wren at Wrecktide.' },
    ],
    reward: { xp: 6000, silver: 3000 },
  },
  // ---------------------------------------------------------------- base Paths
  {
    id: 'q_path_corsair', kind: 'path', name: 'The Last Volley', mentor: 'Edric Vane', port: 'gravesend',
    summary: 'Vane teaches only those who fire on the word, not from fear. Prove your guns, and he will teach you the Corsair\'s discipline.',
    requires: { level: 5 },
    steps: [
      { type: 'sink', count: 4, role: 'pirate', text: 'Sink four pirate ships.' },
      { type: 'deliver', port: 'blackwater', good: 'gunpowder', qty: 20, text: 'Bring 20 barrels of powder to the battery at Porto Blackwater.' },
      { type: 'sink', count: 1, minTier: 2, text: 'Sink a ship of the second rate or larger.' },
      { type: 'visit', port: 'gravesend', text: 'Report to Edric Vane at Gravesend.' },
    ],
    reward: { xp: 2500, silver: 1500, path: 'corsair' },
  },
  {
    id: 'q_path_smuggler', kind: 'path', name: 'The Fog Ledger', mentor: 'Mara Quill', port: 'fogmouth',
    summary: 'Mara Quill keeps two ledgers. Earn a line in the true one.',
    requires: { level: 5 },
    steps: [
      { type: 'sell_contraband', qty: 40, port: 'fogmouth', text: 'Sell 40 units of contraband in Fogmouth.' },
      { type: 'customs', text: 'Make port at a lawful harbour with contraband aboard — and keep it.' },
      { type: 'deliver', port: 'wrecktide', good: 'dreamleaf', qty: 10, text: 'Carry 10 bales of dreamleaf to Wrecktide.' },
      { type: 'visit', port: 'fogmouth', text: 'Settle the ledger with Mara Quill in Fogmouth.' },
    ],
    reward: { xp: 2500, silver: 1500, path: 'smuggler' },
  },
  {
    id: 'q_path_reaver', kind: 'path', name: 'Red Hook', mentor: 'Hask Morrow', port: 'cinderhold',
    summary: 'Morrow does not care for your guns. He wants to see your crew go over the rail.',
    requires: { level: 5 },
    steps: [
      { type: 'board', count: 3, text: 'Take three ships by boarding.' },
      { type: 'prize', count: 1, text: 'Bring a prize home to a prize court.' },
      { type: 'sink', count: 2, role: 'patrol', text: 'Sink two Crown or League patrols.' },
      { type: 'visit', port: 'cinderhold', text: 'Drink with Hask Morrow in Cinderhold.' },
    ],
    reward: { xp: 2500, silver: 1500, path: 'reaver' },
  },
  {
    id: 'q_path_navigator', kind: 'path', name: 'The Stargazer', mentor: 'Tobias Wren', port: 'wrecktide',
    summary: 'Wren charts the rivers in the ocean. Follow them where he did.',
    requires: { level: 5 },
    steps: [
      { type: 'chart', count: 25, text: 'Chart 25 islands you have never seen.' },
      { type: 'reach', region: 'leviathan_reach', north: 4500, text: 'Reach the ice edge in the far north of Leviathan Reach.' },
      { type: 'reach', region: 'dead_mans_expanse', text: 'Sail into Dead Man\'s Expanse.' },
      { type: 'visit', port: 'wrecktide', text: 'Show your log to Tobias Wren at Wrecktide.' },
    ],
    reward: { xp: 2500, silver: 1500, path: 'navigator' },
  },
  // ---------------------------------------------------------------- premium Paths: Legend quests
  {
    id: 'q_legend_drowned', kind: 'legend', name: 'Drown Once', mentor: 'Ilse Harrow', port: 'saint_maw',
    summary: 'Ilse Harrow went down with two hundred souls and came back. She will teach no one who has not gone under.',
    requires: { level: 25, rep: { choir: 20 }, treePoints: { abyssal: 10 }, anyOf: true },
    steps: [
      { type: 'deliver', port: 'saint_maw', good: 'cursed_relics', qty: 6, text: 'Bring six cursed relics to the Choir at Saint Maw.' },
      { type: 'sink', count: 3, role: 'ghost', text: 'Send three ghost ships back under.' },
      { type: 'time_in', region: 'the_abyss', seconds: 120, weather: 'black_storm', text: 'Ride out two minutes of a black storm in the Abyss.' },
      { type: 'die_in', region: 'drowned_crown', text: 'Go down with your ship in the Drowned Crown.' },
      { type: 'visit', port: 'saint_maw', text: 'Return to Ilse Harrow at Saint Maw, dripping.' },
    ],
    reward: { xp: 12000, silver: 5000, path: 'drowned', deed: 'deed_legend_quest' },
  },
  {
    id: 'q_legend_admiral', kind: 'legend', name: "The Admiralty's Verdict", mentor: 'Cassius Dray', port: 'gravesend',
    summary: 'Cassius Dray still signs his letters "Admiral". Earn the right to sign yours the same way.',
    requires: { level: 25, treePoints: { command: 10 } },
    steps: [
      { type: 'fleet_win', count: 3, text: 'Win three fleet actions: sink a ship with two escorts at your side.' },
      { type: 'sink', count: 1, minTier: 4, text: 'Sink a frigate or larger.' },
      { type: 'deliver', port: 'cinderhold', good: 'weapons', qty: 20, text: 'Deliver 20 crates of arms to Cinderhold — the Admiral keeps his debts.' },
      { type: 'visit', port: 'gravesend', text: 'Hear the Verdict at Gravesend.' },
    ],
    reward: { xp: 12000, silver: 5000, path: 'admiral', deed: 'deed_legend_quest' },
  },
  // ---------------------------------------------------------------- the Abyss
  {
    id: 'q_first_descent', kind: 'story', name: 'The First Descent', mentor: 'the Deep Pastor of Saint Maw', port: 'saint_maw',
    summary: 'The Choir will show you the way down — if you can find your way back.',
    requires: { level: 20 },
    steps: [
      { type: 'deliver', port: 'saint_maw', good: 'abyssal_ore', qty: 3, text: 'Bring three ingots of abyssal ore as your tithe.' },
      { type: 'dive', count: 1, text: 'Send your divers down to a sunken wreck.' },
      { type: 'time_in', region: 'the_abyss', seconds: 120, text: 'Spend two minutes at sea in the Abyss.' },
      { type: 'visit', port: 'saint_maw', text: 'Return to Saint Maw.' },
    ],
    reward: { xp: 5000, silver: 2000, deed: 'deed_first_descent' },
  },
];

export const QUESTS_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** The generated jobs of this world (the server registers them at start). */
export const JOBS: QuestDef[] = [];
export function registerJobs(list: QuestDef[]): void {
  JOBS.length = 0;
  JOBS.push(...list);
  for (const q of list) QUESTS_BY_ID[q.id] = q;
}

/** The Captain's Houses where a captain may change Path (docs/02 §7). */
export const CAPTAINS_HOUSES = ['gravesend', 'cinderhold', 'fogmouth', 'tidewrack', 'saint_maw'];
