// The wire of the Throne of the Sea (docs/19 E1–E3, and the window's later tabs): a captain's word to it. What she
// sees of it rides on her private state (`glory`). Kept apart from protocol.ts, which only takes the union into its own.

export interface ThroneClientMsg {
  t: 'throne';
  /** glory: a boon (id = primary); node: a rank of a mastery node (id); reset: the tree forgotten in port; trial: the
   *  legend of a skill (id) alongside; view: nothing but her state again. */
  action: 'glory' | 'node' | 'reset' | 'trial' | 'view';
  id?: string;
}
