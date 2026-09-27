// Boarding 2.0 (docs/11 P1): the deck fight is played round by round. Each round both sides pick a tactic at
// once; the four basic ones go round in a circle — each beats the next and falls to the one before it — and two
// special orders and the captain's own move are paid for with momentum («натиск») won in earlier rounds.

import type { CaptainId } from './captains.ts';

export type BoardTactic = 'volley' | 'charge' | 'grenades' | 'hold' | 'officers' | 'colours' | 'captain';
export const BASIC_TACTICS = ['volley', 'charge', 'grenades', 'hold'] as const;
export type BasicTactic = (typeof BASIC_TACTICS)[number];

export interface TacticDef {
  id: BoardTactic;
  name: string;
  /** Which basic tactic this one beats (the circle); specials beat nothing and fall to nothing. */
  beats: BasicTactic | null;
  /** Momentum it costs (0 for the basic four). */
  cost: number;
  /** Multipliers on the enemies it kills and on the own men it loses. */
  kill: number;
  loss: number;
  description: string;
}

export const TACTICS: Record<BoardTactic, TacticDef> = {
  volley: { id: 'volley', name: 'Musket volley', beats: 'charge', cost: 0, kill: 1, loss: 0.85, description: 'A wall of lead from the rail. Mows down a charge; men behind the waist barricade shrug it off.' },
  charge: { id: 'charge', name: 'Cutlass charge', beats: 'grenades', cost: 0, kill: 1.25, loss: 1.2, description: 'Over the rail with steel. Reaches the grenadiers before the fuses burn; runs into a volley.' },
  grenades: { id: 'grenades', name: 'Grenades', beats: 'hold', cost: 0, kill: 1.1, loss: 1, description: 'Powder pots over the side. Blows a barricade apart; a charge reaches you first.' },
  hold: { id: 'hold', name: 'Hold the waist', beats: 'volley', cost: 0, kill: 0.7, loss: 0.65, description: 'Hammocks and chests across the waist. Soaks up a volley; grenades break it.' },
  officers: { id: 'officers', name: 'Hunt the officers', beats: null, cost: 40, kill: 0.7, loss: 1, description: 'Marksmen pick off her mates and bosun: her crew loses heart and the momentum she built.' },
  colours: { id: 'colours', name: 'Strike her colours', beats: null, cost: 70, kill: 0.5, loss: 1, description: 'A party fights up to her ensign and cuts it down: a blow to her nerve, crushing if it already wavers.' },
  captain: { id: 'captain', name: "Captain's move", beats: null, cost: 100, kill: 1, loss: 1, description: 'Your captain leads the fight in person — each captain in their own way.' },
};

/** The tactic that beats `t` (what an enemy who expects `t` would pick). */
export function counterTo(t: BasicTactic): BasicTactic {
  return BASIC_TACTICS.find((x) => TACTICS[x].beats === t)!;
}

/** +1 when `mine` beats `theirs`, −1 when it falls to it, 0 otherwise (the specials, a mirror, the far side). */
export function edgeOf(mine: BoardTactic, theirs: BoardTactic): 1 | 0 | -1 {
  if (TACTICS[mine].beats === theirs) return 1;
  if (TACTICS[theirs].beats === mine) return -1;
  return 0;
}

export interface CaptainMove {
  id: string;
  name: string;
  description: string;
}

/** The captain's own move at full momentum. */
export const CAPTAIN_MOVES: Record<CaptainId, CaptainMove> = {
  corsair: { id: 'point_blank', name: 'Point-blank volley', description: 'Pistols at arm\'s length: twice the dead this round, and the round is yours whatever they chose.' },
  smuggler: { id: 'smoke_and_knives', name: 'Smoke and knives', description: 'Smoke pots on her deck and knives in the smoke: the round is yours at a third of the usual losses.' },
  reaver: { id: 'red_harvest', name: 'Red harvest', description: 'Red Hook goes first: much more of her crew falls, your men roar (+20 morale), hers falter (−15).' },
  navigator: { id: 'turn_the_flank', name: 'Turn the flank', description: 'You read the deck like a chart: the round is yours and 40 momentum comes back.' },
  drowned: { id: 'call_of_the_deep', name: 'Call of the deep', description: 'Drowned hands rise over her rail: a tenth of her crew is dragged under, her morale −25.' },
  admiral: { id: 'iron_discipline', name: 'Iron discipline', description: 'Ranks close at the admiral\'s word: +30 morale, losses much lower, the dead a third higher.' },
};

/** Seconds a round waits for the choices; a fight is over after this many rounds at most. */
export const ROUND_WINDOW = 3.5;
export const FIRST_ROUND = 1.5;
export const MAX_ROUNDS = 8;
/** The captains' duel: three exchanges, each a sweep of the blade the duellist strikes at the right moment. */
export const DUEL_EXCHANGES = 3;
export const DUEL_SWEEP = 1.4;
export const DUEL_GAP = 0.9;
