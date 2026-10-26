// The game's avatar: a portrait in its ring, the one way everywhere (the HUD, the chat, the player's card, the tables,
// the wardrobe, the battle). The arithmetic and the markup are shared with the site: shared/src/data/portraitfit.ts.

import { avatarHtml, portraitKey } from '../../../../shared/src/data/portraitfit.ts';
import type { StockRing } from '../../../../shared/src/data/portraitfit.ts';
import { frameOf } from '../../../../shared/src/data/cosmetics.ts';
import { assetUrl } from '../../assets.ts';
import { portraitUrl } from '../dom.ts';

export interface AvatarArgs {
  /** A captain's portrait id (`portrait.reaver`), a portrait's key (`pirate_07`), or an asset id / picture address. */
  face: string;
  /** The picture, when the caller has it already (else the portrait's own, or its stand-in's). */
  url?: string | null;
  /** The box's side (a CSS length); none: the stylesheet's `--pav`. */
  size?: string;
  /** Her cosmetic frame (`gold`), worn over the stock ring's place. */
  frame?: string | null;
  /** The stock ring: the game's ring (default), the unit frame's, or none (a thin rim; a table's small faces). */
  ring?: Exclude<StockRing, 'site'> | null;
  cls?: string; attrs?: string; inner?: string;
  tag?: 'span' | 'button';
}

/** An avatar's markup. */
export function avatar(a: AvatarArgs): string {
  const key = portraitKey(a.face);
  const url = a.url !== undefined ? a.url : (a.face.includes('/') ? a.face : portraitUrl(key) ?? assetUrl(a.face));
  // the face box of the picture shown (a stand-in's own when the portrait is not painted yet)
  const shown = url && /portraits\//.test(url) ? portraitKey(url) : key;
  const stock = a.ring === undefined ? 'ui' : a.ring;
  const fr = frameOf(a.frame);
  const frUrl = fr ? assetUrl(`cos.frame_${fr.id}`) : null;
  const ring = fr && frUrl ? `frame.${fr.id}` : stock;
  const ringUrl = fr && frUrl ? frUrl : stock === 'ui' ? assetUrl('ui.ring') : stock === 'portrait' ? assetUrl('ui.portrait_ring') : null;
  return avatarHtml({ face: shown, url, size: a.size, ring, ringUrl, stock: stock ?? 'ui', cls: a.cls, attrs: a.attrs, inner: a.inner, tag: a.tag });
}
