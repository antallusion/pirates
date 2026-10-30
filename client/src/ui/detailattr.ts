// The detail card's attribute (client/src/ui/detail.ts), on its own so every window may write it without importing
// the card (and its imports): `data-detail="kind:id[:n]"` opens the card on a tap; `data-detail-hold` on a long press or
// a right click (an element whose own tap does something else). `buy`/`sell`: a market's prices for a good's card.

import { esc } from './dom.ts';

export function detailAttr(key: string, o: { hold?: boolean; buy?: number; sell?: number } = {}): string {
  return ` ${o.hold ? 'data-detail-hold' : 'data-detail'}="${esc(key)}"${o.buy ? ` data-dbuy="${Math.round(o.buy)}"` : ''}${o.sell ? ` data-dsell="${Math.round(o.sell)}"` : ''}`;
}

/** The ⓘ button that opens a card where the element's own tap does something else. */
export function infoBtn(key: string, title: string, cls = ''): string {
  return `<button type="button" class="dc-info${cls ? ` ${cls}` : ''}"${detailAttr(key)} aria-label="${esc(title)}" title="${esc(title)}">ⓘ</button>`;
}
