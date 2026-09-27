// The captain's cabin: every screen as a large tile — the phone's way into the map, ship, crew and the rest,
// and the same list the desktop micro-menu shows.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/menu.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

export type MenuItem = 'map' | 'journal' | 'ship' | 'crew' | 'talents' | 'company' | 'help' | 'options' | 'chat';
export const MENU_ITEMS: { id: MenuItem; glyph: string; art?: string }[] = [
  { id: 'map', glyph: '🗺' },
  { id: 'journal', glyph: '📜', art: 'tab_letters' },
  { id: 'ship', glyph: '⚓' },
  { id: 'crew', glyph: '☗' },
  { id: 'talents', glyph: '✦' },
  { id: 'company', glyph: '⚑' },
  { id: 'chat', glyph: '✉' },
  { id: 'help', glyph: '?' },
  { id: 'options', glyph: '⚙' },
];

export function menuLabel(id: MenuItem): string {
  return L(id);
}

export function renderMenu(root: HTMLElement, open: (m: MenuItem) => void): void {
  root.innerHTML = `<div class="modal-head"><h2>${esc(L('title'))}</h2></div>
    <div class="modal-body"><div class="menu-grid">${MENU_ITEMS.map((m) => `<button class="menu-tile" data-menu="${m.id}">${icon(m.art ?? `menu_${m.id}`, m.glyph, 'ico-lg')}<span>${esc(L(m.id))}</span></button>`).join('')}</div></div>`;
  root.querySelectorAll<HTMLElement>('[data-menu]').forEach((b) => (b.onclick = () => open(b.dataset.menu as MenuItem)));
}
