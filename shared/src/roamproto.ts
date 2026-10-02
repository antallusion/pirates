// The wire of docs/19 D7 (the creatures roaming the sea as HoMM3's neutral stacks): the stacks about a captain, as
// every captain sees them, and her orders at one. Kept apart from protocol.ts, which only takes these unions in.

import type { RoamKind, RoamSize } from './data/roamers.ts';

/** A stack as her sea and her minimap show it (its wander is drawn from its spot and its seed by the world's clock). */
export interface RoamView {
  id: number;
  kind: RoamKind;
  level: number;
  size: RoamSize;
  /** Its creatures now. */
  n: number;
  /** The spot it wanders round (after its last beating's shift), and its wander's phase. */
  x: number;
  y: number;
  seed: number;
  /** Another captain's party is fighting it («в бою»); hers or her group mate's: 'mate'. */
  fight?: 'other' | 'mate';
  /** HoMM3's offer when she is three times the stronger (only for the near ones): some would sign on, or they flee. */
  offer?: 'join' | 'flee';
  /** Those who would sign on (hammocks and slots allowing). */
  joinN?: number;
  /** Her landing party's might against its, rounded to a tenth (only for the near ones). */
  ratio?: number;
}

export type RoamClientMsg = { t: 'roam'; action: 'attack' | 'join' | 'flee'; id: number };

export type RoamServerMsg =
  /** The stacks about her now. */
  { t: 'roams'; list: RoamView[] };
