// The wire of the Blighted Sea (docs/40; its §9 lists every field for the client): what a cleared captain sees of the
// green water (PrivateState.blight), her orders at the Raft, the dealer's hand, the zone's events. Kept apart from
// protocol.ts, which only takes these unions into its own. All of it is additive: a client that knows none of it sees
// a new optional field and three message kinds it never asks for (the protocol version is not raised).

import type { BjCoin, BjResult, BlightStep, BlightWare } from './data/blight.ts';

/** A quest or a contract of hers under way: where she is in its steps. */
export interface BlightTaskView {
  /** The step she is on (0-based; = steps: every step done, ready to hand in). */
  step: number;
  steps: number;
  /** The count of the step she is on, and what it counts to (seconds for a «survive» step). */
  progress: number;
  need: number;
}

/** The chapter «Глава XXXVII. Зелёный огонь» (shared/src/data/blight.ts BLIGHT_CHAPTER, BLIGHT_QUESTS — the texts are
 *  the client's to read there by `at`). */
export interface BlightChapterView {
  /** Quests behind her (0–14; 14: the chapter done, the contracts come). */
  at: number;
  size: number;
  /** The quest `at` taken and under way, or null (not taken yet: «Взять»; the chapter done). */
  cur: BlightTaskView | null;
  /** She may hand it in now: every step done and she is moored at the Raft. */
  canClaim: boolean;
}

/** One of the day's three contracts (only after the chapter). */
export interface BlightContractView extends BlightTaskView {
  id: number;
  /** Its one step (the words: shared/src/data/blight.ts stepText). */
  ask: BlightStep;
  marks: number;
  /** The experience it pays her now. */
  xp: number;
  /** Paid today already. */
  paid: boolean;
}

/** A ware of the Raft's shop as priced for her this week. */
export interface BlightWareView {
  id: BlightWare;
  /** Banked marks, now (a quarter dearer with each one bought this week). */
  price: number;
  /** Had for good (a title, a pennant): not sold again. */
  owned: boolean;
}

/** A row of the week's board. */
export interface BlightWeekRow {
  name: string;
  /** The highest tier reached this week, marks banked, captains sunk. */
  tier: number;
  banked: number;
  sunk: number;
  me?: true;
}

/** PrivateState.blight: null for a captain the green water has not taken (she knows nothing of it). */
export interface BlightView {
  /** The circle and the Raft, for the chart and the sea (world metres). */
  zone: { x: number; y: number; r: number };
  raft: { x: number; y: number };
  /** Her ship is inside the circle now: the fel water, the HUD. */
  inside: boolean;
  /** Her tier (1…), her Taint within it (0…per), and the Taint a tier takes. */
  tier: number;
  taint: number;
  per: number;
  /** Marks riding in her hold (lost if she is sunk inside), and her banked marks (the shop's and the table's coin). */
  hold: number;
  marks: number;
  /** Her multipliers now: marks (the lantern and the Chosen's share in it) and experience (capped at 4). */
  mul: number;
  xpMul: number;
  /** The best tier she has ever reached. */
  best: number;
  /** The Dark Lantern burns until (wall ms; 0 or past: unlit). */
  lantern: number;
  /** Moored at the Raft; the world second the lines are fast at (0: not mooring — world seconds as `welcome.time` and
   *  the snapshots count them); within reach of it now. */
  moored: boolean;
  mooring: number;
  atRaft: boolean;
  /** «Избранник Скверны» (only while she is inside): who, where, at what tier; `me`: it is she. */
  chosen: { name: string; x: number; y: number; tier: number; me?: true } | null;
  /** The Blight's Heart: `at` — the wall ms she rises at (told from ten minutes before), or risen — her ship's id,
   *  where she lies, her hull left (0–1) and the world second she leaves at. Null: more than ten minutes off. */
  heart: { at: number } | { id: number; x: number; y: number; hp: number; until: number } | null;
  /** Green casks afloat near her (only while inside): [x, y, marks]. */
  casks: [number, number, number][];
  /** A green cask is aboard (for the «carry a cask out» step: lost with the hold if she is sunk). */
  cask: boolean;
  /** The ids of the ships sent after her (the hunters: the client may tint them). */
  hunters: number[];
  ch: BlightChapterView;
  /** The day's contracts (empty until the chapter is done). */
  contracts: BlightContractView[];
  shop: BlightWareView[];
  /** The dealer's limits for her: hands left this hour, silver she may still lose today. */
  bj: { hands: number; silver: number };
  /** The week's board (top ten) and her own row if she is not among them. */
  week: BlightWeekRow[];
  /** The titles of the week she holds now. */
  weekTitle: string | null;
  /** Dead Man's Dice may be opened here (moored: the port's own `dice` orders and `dice` views serve the Raft too),
   *  Davy Jones' table (moored, at the sea's midnight), and the tables open at the Raft now, to join. */
  dice: boolean;
  davy: boolean;
  tables: { id: number; host: string; stake: number; seats: number }[];
}

/** The dealer's table as she sees it. The dealer's second card is hidden (`-1`) until the hand is over. */
export interface BjView {
  coin: BjCoin;
  stake: number;
  /** Doubled down: the stake above is already the doubled one. */
  doubled: boolean;
  player: number[];
  dealer: number[];
  /** Her count, and the dealer's shown count. */
  total: number;
  soft: boolean;
  dealerTotal: number;
  /** She may double (her first two cards, and the coin for it). */
  canDouble: boolean;
  /** Over: how it ended and what came back to her (the stake with it; 0: lost). Null: her move. */
  result: BjResult | null;
  back: number;
}

export type BlightClientMsg =
  /** Moor at the Raft (five seconds hove to within its reach). */
  | { t: 'blight'; action: 'moor' }
  /** Cast off. */
  | { t: 'blight'; action: 'leave' }
  /** Blackjack: a hand at a stake of the slate (BJ_STAKES) in silver or banked marks; then her moves. */
  | { t: 'blight'; action: 'bj'; op: 'deal'; coin: BjCoin; stake: number }
  | { t: 'blight'; action: 'bj'; op: 'hit' | 'stand' | 'double' }
  /** The shop: a ware for banked marks; a re-forge names the piece (its uid) and its extra line (0-based). */
  | { t: 'blight'; action: 'buy'; id: BlightWare; uid?: number; line?: number }
  /** The chapter: take the next quest (anywhere), hand in the one done (moored at the Raft). */
  | { t: 'blight'; action: 'take' }
  | { t: 'blight'; action: 'claim' }
  /** A contract of the day handed in (moored at the Raft). */
  | { t: 'blight'; action: 'contract'; id: number };

export type BlightServerMsg =
  /** The dealer's table (null: no hand). */
  | { t: 'blight_bj'; view: BjView | null }
  /** Something happened to her in the green water, for the HUD's flourish (the words come as a toast beside it):
   *  marks banked (`n`, the Raft's `cut`), her hold lost (`n`), a tier reached (`n`), a quest or contract done (`n`
   *  marks), the Veil turned her back, a thing bought (`id`). */
  | { t: 'blight_ev'; ev: 'bank' | 'lost' | 'tier' | 'quest' | 'contract' | 'veil' | 'bought' | 'cask'; n?: number; cut?: number; id?: string };
