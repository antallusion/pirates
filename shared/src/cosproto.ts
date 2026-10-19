// The wire of the cosmetics (docs/32 §12, shared/src/data/cosmetics.ts): her wardrobe's view, her orders (wear, take
// off, an emote). Kept apart from protocol.ts, which only takes these unions into its own. What other captains see
// rides elsewhere: ShipInfo.cos (her ship's name card), ChatLineView.fr / .emo (her chat lines), the cards' `fr`, and
// the `emote` event over her ship.

import type { CosEquip } from './data/cosmetics.ts';

/** Her wardrobe: what she owns (`kind:id` keys — bought, free and earned together), what she wears, and how far she
 *  is along each earned thing's road (the stats the earn conditions read). */
export interface CosView {
  own: string[];
  eq: CosEquip;
  /** The stats of the earned things: her level, boardings won, the campaign's quests done of its size, her best rating
   *  in the Colosseum. */
  stats: { level: number; boarded: number; campaign: number; campaignSize: number; arena: number };
}

export type CosClientMsg =
  | { t: 'cos'; action: 'view' }
  /** Wear a thing in its slot (id null: take it off). */
  | { t: 'cos'; action: 'equip'; slot: keyof CosEquip; id: string | null }
  /** An emote over her ship and into the local chat. */
  | { t: 'cos'; action: 'emote'; id: string };

export type CosServerMsg = { t: 'cos'; view: CosView };
