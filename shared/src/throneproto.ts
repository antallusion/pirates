// The wire of the Throne of the Sea (docs/19 E1–E3, and the window's later tabs): a captain's word to it. What she
// sees of it rides on her private state (`glory`). Kept apart from protocol.ts, which only takes the union into its own.

export interface ThroneClientMsg {
  t: 'throne';
  /** glory: a boon (id = primary); node: a rank of a mastery node (id); reset: the tree forgotten in port; trial: the
   *  legend of a skill (id) alongside; view: nothing but her state again; seal: her seal's mythic depth at the lair her
   *  boats reach (docs/19 E9); raid: her raid's legend alongside at the Stair (docs/19 E11). */
  action: 'glory' | 'node' | 'reset' | 'trial' | 'view' | 'seal' | 'raid' | 'cit' | 'contract' | 'arena';
  id?: string;
  /** docs/19 E5–E7, `cit`: what she does at a citadel (`op`: declare a siege, assault it, leave `n` of her men of kind
   *  `u` in its garrison, hire its titan of kind `u`), and which (`cit`, 0–11). docs/19 E15, `contract`: a contract of the
   *  week taken at an Admiralty board (`op` take) or its legend boarded (`op` board), by its id (`id`). docs/19 E14,
   *  `arena`: ArenaOp. */
  op?: 'declare' | 'assault' | 'leave' | 'titan' | 'take' | 'board' | ArenaOp;
  cit?: number;
  u?: string;
  n?: number;
}

/** docs/19 E14, `arena`: the Colosseum's queue joined or left, a practice bout against a legend of the sea, and her
 *  draft's ban, pick (of kind `u`) and «Done». */
export type ArenaOp = 'queue' | 'leave' | 'practice' | 'ban' | 'pick' | 'pass';

/** docs/19 E4: the citadels on every chart (shared/src/data/citadels.ts CitMark), sent when they change. */
export interface CitServerMsg {
  t: 'citadels';
  list: import('./data/citadels.ts').CitMark[];
}
