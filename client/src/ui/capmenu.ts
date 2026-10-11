// The captain's menu (seaux, owner 2026-10-11: «Нажимая на иконку капитана должны быть какие-то окошки настроек и
// посмотреть вообще можно что-то, щас ничего не происходит вообще. Хотя там горит желтая фигнюшка как будто привлекая
// нажать»). A tap or a click on her portrait (top left) opens a small sheet: what the gold bead was about first (talent
// points to spend, a new level — seen here, the bead goes out until there is news again), then her sheet, «Умения»,
// the talents, the journal, the settings and the account (a letter to the support desk, another account).

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/capmenu.ts';
import { esc, icon } from './dom.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';

const L = dict(EN, RU);

export type CapItem = 'hero' | 'skills' | 'talents' | 'journal' | 'options' | 'account';
export const CAP_ITEMS: readonly { id: CapItem; art: string; glyph: string }[] = [
  { id: 'hero', art: 'bt_captain', glyph: '⚔' },
  { id: 'skills', art: 'ab_mark_target', glyph: '✦' },
  { id: 'talents', art: 'menu_talents', glyph: '✧' },
  { id: 'journal', art: 'tab_letters', glyph: '📜' },
  { id: 'options', art: 'menu_options', glyph: '⚙' },
  { id: 'account', art: 'menu_cabin', glyph: '☗' },
];

export interface CapHooks {
  open(item: Exclude<CapItem, 'account'>): void;
  /** A letter to the support desk (the title screen's own endpoint). */
  support(email: string, message: string): Promise<{ ok?: boolean; error?: string }>;
  /** Leave this account on this device (the sign-in screen comes back). */
  logout(): void;
  confirm(q: string): Promise<boolean>;
  text(s: string): string;
}

const SEEN_KEY = 'gravetide.capSeen';

function seen(): { pts: number; lv: number } {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as { pts?: number; lv?: number };
    return { pts: Number(v.pts) || 0, lv: Number(v.lv) || 0 };
  } catch {
    return { pts: 0, lv: 0 };
  }
}

/** The gold bead on her portrait: talent points she has not looked at yet, or a level she has not seen. */
export function captainDot(pts: number, level: number, was = seen()): boolean {
  return (pts > 0 && pts > was.pts) || (was.lv > 0 && level > was.lv);
}

/** She has looked: the bead goes out until there is news again. */
export function markCaptainSeen(pts: number, level: number): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ pts, lv: level }));
  } catch { /* private mode */ }
}

/** The menu's body: the news first (a row with its button), then the six tiles. */
export function capMenuHtml(o: { name: string; level: number; pts: number }, was = seen()): string {
  const news: string[] = [];
  if (o.pts > 0) news.push(`<div class="cap-news${o.pts > was.pts ? ' fresh' : ''}"><i class="cs-pts" aria-hidden="true"></i><span>${esc(L('pts', { n: o.pts }))}</span><button type="button" class="k-btn k-btn--primary k-btn--sm" data-cap="talents">${esc(L('ptsGo'))}</button></div>`);
  if (was.lv > 0 && o.level > was.lv) news.push(`<div class="cap-news fresh"><i class="cs-pts" aria-hidden="true"></i><span>${esc(L('rank', { n: o.level }))}</span><button type="button" class="k-btn k-btn--secondary k-btn--sm" data-cap="hero">${esc(L('rankGo'))}</button></div>`);
  const tiles = CAP_ITEMS.map((x) => `<button type="button" class="k-btn k-btn--secondary cap-tile" data-cap="${x.id}" title="${esc(L(`${x.id}T`))}">${icon(x.art, x.glyph, 'cap-ico')}<span class="k-btn-l">${esc(L(x.id))}</span>${x.id === 'talents' && o.pts > 0 ? `<b class="k-badge" aria-hidden="true">${o.pts}</b>` : ''}</button>`).join('');
  return `<div class="cap-menu-body"><div class="cap-who"><b>${esc(o.name)}</b> <span class="muted">${esc(L('lv', { n: o.level }))}</span></div>${news.join('')}<div class="cap-tiles">${tiles}</div></div>`;
}

/** The account's page: a letter to the support desk, another account. */
function accountHtml(): string {
  return `<form class="cap-acc" novalidate>
    <p class="muted">${esc(L('accLead'))}</p>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <label class="cap-f"><span>${esc(L('email'))}</span><input type="email" name="email" autocomplete="email" required /></label>
    <label class="cap-f"><span>${esc(L('message'))}</span><textarea name="message" rows="3" maxlength="2000"></textarea></label>
    <p class="cap-msg muted" role="status"></p>
    <div class="cap-row"><button type="button" class="k-btn k-btn--secondary k-btn--sm" data-acc="back">${esc(L('back'))}</button><button type="submit" class="k-btn k-btn--primary k-btn--sm">${esc(L('send'))}</button></div>
    <button type="button" class="k-btn k-btn--ghost k-btn--sm cap-switch" data-acc="switch">${esc(L('switch'))}</button>
  </form>`;
}

let sheet: SheetHandle | null = null;

export const captainMenuOpen = (): boolean => !!sheet?.open;

/** Opens (or, open, closes) the captain's menu; what the bead was about is seen. */
export function toggleCaptainMenu(o: { name: string; level: number; pts: number }, hooks: CapHooks): void {
  if (sheet?.open) return void sheet.close('code');
  const was = seen();
  sheet = openSheet({ title: L('title'), body: capMenuHtml(o, was), height: 'auto', cls: 'cap-menu', id: 'cap-menu' });
  markCaptainSeen(o.pts, o.level);
  const body = sheet.body;
  const wire = () => {
    body.querySelectorAll<HTMLElement>('[data-cap]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.cap as CapItem;
      if (id === 'account') return account();
      sheet?.close('button');
      hooks.open(id);
    }));
  };
  const account = () => {
    body.innerHTML = accountHtml();
    const form = body.querySelector<HTMLFormElement>('form')!;
    const msg = form.querySelector<HTMLElement>('.cap-msg')!;
    form.querySelector<HTMLElement>('[data-acc="back"]')!.addEventListener('click', () => {
      body.innerHTML = capMenuHtml(o, { pts: o.pts, lv: o.level });
      wire();
    });
    form.querySelector<HTMLElement>('[data-acc="switch"]')!.addEventListener('click', async () => {
      if (await hooks.confirm(L('switchQ'))) hooks.logout();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
      const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim();
      if (!email) return void (msg.textContent = L('emailFirst'));
      const r = await hooks.support(email, message);
      msg.textContent = r.ok ? L('sent') : r.error ? hooks.text(r.error) : L('noAnswer');
      if (r.ok) (form.elements.namedItem('message') as HTMLTextAreaElement).value = '';
    });
  };
  wire();
}
