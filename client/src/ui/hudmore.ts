// «⋯» — the sea HUD's one brass button for everything that is not steering, the chart, the guns and her own plate
// (owner, 2026-10-29: «на мобиле лютый графический перегруз, надо все как-то прятать в подменюшки, оставить только
// самое важное. и нажимая на эту подменюшку будут выезжать все остальные кнопочки»).
//   - Folded (MORE_ITEMS): the menu, the chat, «Остров», her offer, the day's gift, the parrot's emotes and the weak
//     army's pill. A wide desk keeps the menu under the chart (it has the room; its key is a chip) and the chat by the
//     helm (chat.css).
//   - Out under the chart: «Цели и вести», the quests (owner, 2026-10-29: «иконка квеста должна быть вместо иконки
//     чата, их надо поменять» — the chat went into the tray in its place).
//   - The button stands first in the row under her plate; a tap slides the row out of it in a brass tray (transform and
//     opacity only: cheap on a phone), the weak army's pill under the row. A tap outside, Esc, or any of them picked
//     folds it again.
//   - Their counts and «!» gather on the button as one badge, so nothing that asks for her is lost.
//   - Off in the First Watch (its lessons show the HUD a block at a time and point at these very buttons), in a boarding
//     and with the detailed interface.
// The chat's unread count (chat.ts #chat-unread) feeds the button's badge too.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seahud.ts';
import { badgeText, buttonHtml } from './kit/button.ts';

const L = dict(EN, RU);

/** What folds behind «⋯», in the tray's order. */
export const MORE_ITEMS = ['#touch > #tc-menu', '#hud-chat > #chat-toggle', '#touch > #tc-isle', '#touch > #tc-offer', '#touch > #tc-daily', '#hud-chat > #cos-qbtn', '#hud-advice'] as const;
/** A wide desk keeps these out (its keys on their rims, the room under the chart). */
const DESK_OUT = new Set<string>(['#touch > #tc-menu', '#hud-chat > #chat-toggle']);
const DESK_WIDE = '(min-width: 1100px) and (min-height: 600px)';

/** The badge the button carries for what is folded: the counts summed, else «!» for a mark with no number. */
export function moreBadge(marks: readonly string[]): string {
  let n = 0, flag = false;
  for (const m of marks) {
    const t = m.trim();
    if (!t) continue;
    const k = Number(t.replace(/\+$/, ''));
    if (Number.isFinite(k) && k > 0) n += k;
    else flag = true;
  }
  return n > 0 ? badgeText(n) : flag ? '!' : '';
}

export class HudMore {
  readonly btn: HTMLButtonElement;
  private tray: HTMLElement;
  private on = false;
  private open = false;
  private at = 0;
  private badgeKey = '';

  constructor(root: HTMLElement) {
    const t = document.createElement('template');
    t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-more', aria: L('moreHud'), cls: 'sea-round tc-more' }).trim();
    this.btn = t.content.firstElementChild as HTMLButtonElement;
    this.btn.insertAdjacentHTML('beforeend', '<span class="tc-more-dots" aria-hidden="true"><i></i><i></i><i></i></span><b class="k-badge tc-more-b hidden" aria-hidden="true"></b>');
    this.btn.setAttribute('aria-expanded', 'false');
    this.tray = document.createElement('div');
    this.tray.id = 'tc-more-tray';
    this.tray.setAttribute('aria-hidden', 'true');
    root.prepend(this.tray);
    root.append(this.btn);
    this.btn.addEventListener('click', () => this.set(!this.open));
    // a tap outside folds it; a button in it picked folds it after its own click has run (the weak army's pill opens
    // its card in place: only its «Нанять»/«Остров» fold the tray)
    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      const el = e.target as Element | null;
      if (!el || this.btn.contains(el) || this.tray.contains(el) || this.items().some((x) => x.contains(el))) return;
      this.set(false);
    }, true);
    document.addEventListener('click', (e) => {
      if (!this.open) return;
      const el = e.target as Element | null;
      const hit = el && this.items().find((x) => x.contains(el));
      if (!hit) return;
      if (hit.id === 'hud-advice' && !el!.closest('[data-advgo]')) return;
      setTimeout(() => this.set(false), 0);
    });
    document.addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') {
        e.stopPropagation();
        this.set(false);
      }
    }, true);
  }

  /** The folded elements as they stand now (each a button or the pill). */
  private items(): HTMLElement[] {
    const desk = document.body.classList.contains('more-desk');
    const out: HTMLElement[] = [];
    for (const sel of MORE_ITEMS) {
      if (desk && DESK_OUT.has(sel)) continue;
      const el = document.querySelector<HTMLElement>(sel);
      if (el) out.push(el);
    }
    return out;
  }

  /** Every frame from the sea's frame (the work itself four times a second): on with the simple HUD at sea. */
  frame(on: boolean): void {
    const now = performance.now();
    if (on === this.on && now - this.at < 250) return;
    this.at = now;
    const body = document.body;
    const blocked = body.classList.contains('tac') || body.classList.contains('chat-open') || !document.getElementById('modal')?.classList.contains('hidden');
    if (this.on !== on) {
      this.on = on;
      body.classList.toggle('hud-more', on);
      if (!on) {
        this.set(false);
        for (const el of document.querySelectorAll('.more-fold')) el.classList.remove('more-fold');
        return;
      }
    }
    if (!on) return;
    if (this.open && blocked) this.set(false);
    const desk = !body.classList.contains('touch') && matchMedia(DESK_WIDE).matches;
    if (body.classList.contains('more-desk') !== desk) body.classList.toggle('more-desk', desk);
    const items = this.items();
    for (const sel of MORE_ITEMS) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      const fold = items.includes(el);
      if (el.classList.contains('more-fold') !== fold) el.classList.toggle('more-fold', fold);
    }
    // the badge: the counts and marks of what is folded and out
    const marks: string[] = [];
    for (const el of items) {
      if (el.classList.contains('hidden')) continue;
      if (el.id === 'hud-advice') { marks.push('!'); continue; }
      // (her offers' count is a shop's, not a call: it glows in the tray, it does not add to the button)
      if (el.id === 'tc-offer') continue;
      for (const b of el.querySelectorAll<HTMLElement>('.k-badge, .chat-unread')) if (!b.classList.contains('hidden')) marks.push(b.textContent || '!');
    }
    const text = moreBadge(marks);
    if (text !== this.badgeKey) {
      this.badgeKey = text;
      const b = this.btn.querySelector<HTMLElement>('.tc-more-b')!;
      b.textContent = text;
      b.classList.toggle('hidden', !text);
    }
    if (this.open) this.lay();
  }

  /** Each folded one that is out gets its place in the row (--mi), the tray its length (--mn). */
  private lay(): void {
    let i = 0;
    for (const el of this.items()) {
      if (el.id === 'hud-advice') continue;
      if (el.classList.contains('hidden')) continue;
      i++;
      if (el.style.getPropertyValue('--mi') !== String(i)) el.style.setProperty('--mi', String(i));
    }
    const n = String(i);
    if (document.body.style.getPropertyValue('--mn') !== n) document.body.style.setProperty('--mn', n);
  }

  set(open: boolean): void {
    if (open && !this.on) return;
    if (open === this.open) return;
    this.open = open;
    if (open) this.lay();
    document.body.classList.toggle('more-open', open);
    this.btn.setAttribute('aria-expanded', String(open));
    const words = L(open ? 'moreHudClose' : 'moreHud');
    this.btn.setAttribute('aria-label', words);
    this.btn.title = words;
  }

  isOpen(): boolean {
    return this.open;
  }
}
