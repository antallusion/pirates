// The captain's cabin: every screen as a large tile — the phone's way into the map, ship, crew and the rest,
// and the same list the desktop micro-menu shows. The company, guild, letters and album are «Журнал»'s tabs now
// (docs/23 item 74): its tile leads to them.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/menu.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

export type MenuItem = 'map' | 'journal' | 'ship' | 'crew' | 'talents' | 'company' | 'shop' | 'help' | 'options' | 'chat' | 'base' | 'hero' | 'throne' | 'research';
export const MENU_ITEMS: { id: MenuItem; glyph: string; art?: string }[] = [
  { id: 'map', glyph: '🗺' },
  { id: 'journal', glyph: '📜', art: 'tab_letters' },
  { id: 'ship', glyph: '⚓' },
  { id: 'crew', glyph: '☗' },
  { id: 'hero', glyph: '⚔', art: 'bt_captain' },
  { id: 'talents', glyph: '✦' },
  // The premium shop (owner, 2026-10-03): the doubloon's coin.
  { id: 'shop', glyph: '◉', art: 'doubloon' },
  { id: 'chat', glyph: '✉' },
  { id: 'help', glyph: '?' },
  { id: 'options', glyph: '⚙' },
];

export function menuLabel(id: MenuItem): string {
  return L(id);
}

/** Screens that are there only for some captains (her own island's base, docs/15). */
const EXTRA_ART: Partial<Record<MenuItem, { glyph: string; art: string }>> = { base: { glyph: '⌂', art: 'build_residents_house' }, throne: { glyph: '★', art: 'tattoo_crown' }, research: { glyph: '⚒', art: 'tab_board' } }; // docs/19 E18: the Throne past the cap

export function renderMenu(root: HTMLElement, open: (m: MenuItem) => void, extra: MenuItem[] = []): void {
  const items = [...MENU_ITEMS.slice(0, 7), ...extra.map((id) => ({ id, ...EXTRA_ART[id]! })), ...MENU_ITEMS.slice(7)];
  root.innerHTML = `<div class="modal-head"><h2>${esc(L('title'))}</h2></div>
    <div class="modal-body"><div class="menu-grid">${items.map((m) => `<button class="menu-tile" data-menu="${m.id}">${icon(m.art ?? `menu_${m.id}`, m.glyph, 'ico-lg')}<span>${esc(L(m.id))}</span></button>`).join('')}</div></div>`;
  root.querySelectorAll<HTMLElement>('[data-menu]').forEach((b) => (b.onclick = () => open(b.dataset.menu as MenuItem)));
}
