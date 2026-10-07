// The target's choices (owner, 2026-10-07: «наводя на кого-то пальцем или на десктопе мышкой, надо предлагать захват
// цели и преследование и бой»): beside a ship, a beast or a creature stack she points at, three painted round choices
// in the porthole ring — «Захват цели» (the spyglass), «Преследовать» (a boat on a ship's wake), «Бой» (the red grapple
// when the grapples reach her, the broadside when only the guns can, the charge against a stack) — each with its word.
//   a desk    the mouse resting on the target opens them (with the attack cursor); a click picks; they stay while the
//             mouse is on the target or on them, and go a moment after it leaves both
//   a phone   a tap on the target opens them (and marks her); a second tap picks; a tap on the open sea puts them away
// They stand on an arc on the side of the target with room, clear of her (never over her), on the screen, and follow
// her as she sails. A choice the server would refuse now is not offered (main.ts decides); a tap that opened them
// cannot pick one (the finger lifting over a choice that came up under it).

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seahud.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

export type TmId = 'lock' | 'pursue' | 'fight';

export interface TmChoice {
  id: TmId;
  /** Art id for icon(). */
  art: string;
  /** The word under the choice («Захват цели», «Преследовать», «Бой»). */
  label: string;
  /** Its tooltip and spoken name (what exactly it does here). */
  title: string;
  /** In force now (she is the mark, the pursuit is hers): the ring lit. */
  on?: boolean;
}

/** A tap that opened the choices cannot pick one this soon (the same finger lifting). */
export const TM_ARM_MS = 350;

/** Where the choices stand beside a target at (x, y) whose picture reaches `r` px from its middle: on an arc of radius
 *  r + gap round her, on the right unless she is in the screen's right third (then the left), from level with her down
 *  and round under her (her name and bars are drawn over her: the arc keeps off them) — up round her when she is low on
 *  the screen — kept on the screen. Pure. */
export function menuLayout(n: number, x: number, y: number, r: number, vw: number, vh: number, item: number): { side: 'right' | 'left'; items: { x: number; y: number }[] } {
  const side: 'right' | 'left' = x > vw * 0.66 ? 'left' : 'right';
  const R = Math.max(r, 16) + item / 2 + 16;
  const step = (47 * Math.PI) / 180, from = (-10 * Math.PI) / 180;
  const m = item / 2 + 6;
  // low on the screen the arc turns up round her instead (her name over her is the lesser loss than a choice off-screen)
  const up = y + R + m > vh ? -1 : 1;
  const items = Array.from({ length: n }, (_, i) => {
    const a = from + i * step;
    const dx = Math.cos(a) * R * (side === 'right' ? 1 : -1);
    return { x: x + dx, y: y + Math.sin(a) * R * up };
  });
  // on the screen: the arc moved up or down (and in from the side) as a whole
  const top = Math.min(...items.map((p) => p.y)), bottom = Math.max(...items.map((p) => p.y));
  const dy = top < m ? m - top : bottom > vh - m ? vh - m - bottom : 0;
  for (const p of items) p.y += dy;
  for (const p of items) p.x = Math.max(m, Math.min(vw - m, p.x));
  return { side, items };
}

export class TargetMenu {
  readonly el: HTMLElement;
  /** What it is about (`ship:12`, `roam:3`); '' when shut. */
  about = '';
  private choicesKey = '';
  private openedAt = 0;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverIn = false;
  onPick: (id: TmId, about: string) => void = () => {};

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'tmenu';
    this.el.className = 'tm hidden';
    this.el.setAttribute('role', 'menu');
    document.body.append(this.el);
    // A press on a choice never reaches the sea under it, nor takes the keyboard's focus from the ship.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.preventDefault());
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tm]');
      if (!b || performance.now() - this.openedAt < TM_ARM_MS) return;
      const about = this.about;
      this.hide();
      this.onPick(b.dataset.tm as TmId, about);
    });
    this.el.addEventListener('pointerenter', () => {
      this.hoverIn = true;
      this.keep();
    });
    this.el.addEventListener('pointerleave', (e) => {
      this.hoverIn = false;
      if (e.pointerType === 'mouse') this.leave();
    });
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** How long the choices have been up (ms). */
  get age(): number {
    return this.isOpen ? performance.now() - this.openedAt : 0;
  }

  /** The mouse (or a finger) is over the choices now. */
  get hovered(): boolean {
    return this.hoverIn;
  }

  /** Open (or redraw) the choices about a target. */
  show(about: string, choices: TmChoice[], name: string): void {
    if (!choices.length) return this.hide();
    const key = `${about}|${choices.map((c) => `${c.id}:${c.art}:${c.label}:${c.on ? 1 : 0}`).join(',')}`;
    if (!this.isOpen || this.about !== about) this.openedAt = performance.now();
    this.about = about;
    this.keep();
    if (key !== this.choicesKey || !this.isOpen) {
      this.choicesKey = key;
      this.el.setAttribute('aria-label', L('tm.aria', { name }));
      this.el.innerHTML = choices.map((c, i) => `<button type="button" class="tm-item${c.on ? ' on' : ''}" role="menuitem" data-tm="${c.id}" style="--tm-i:${i}" aria-label="${esc(c.title)}" title="${esc(c.title)}"${c.on ? ' aria-pressed="true"' : ''}>`
        + `<span class="tm-pic">${icon(c.art, '•', 'tm-ico')}</span><span class="tm-l">${esc(c.label)}</span></button>`).join('');
    }
    if (!this.isOpen) {
      this.el.classList.remove('hidden', 'tm-open');
      requestAnimationFrame(() => this.el.classList.add('tm-open'));
    }
  }

  /** Stand beside the target where she is now (screen px, her picture's reach). */
  place(x: number, y: number, r: number): void {
    if (!this.isOpen) return;
    const items = [...this.el.querySelectorAll<HTMLElement>('.tm-item')];
    if (!items.length) return;
    const size = items[0].offsetWidth || 44;
    const g = menuLayout(items.length, x, y, r, innerWidth, innerHeight, size);
    this.el.dataset.side = g.side;
    items.forEach((b, i) => {
      b.style.transform = `translate(${Math.round(g.items[i].x - size / 2)}px, ${Math.round(g.items[i].y - size / 2)}px)`;
    });
  }

  /** The mouse has left the target: the choices go a moment later, unless it comes onto them (or back). */
  leave(ms = 450): void {
    if (!this.isOpen || this.hoverIn || this.closeTimer) return;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      if (!this.hoverIn) this.hide();
    }, ms);
  }

  /** Stay: the mouse is on the target or the choices again. */
  keep(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  hide(): void {
    this.keep();
    this.hoverIn = false;
    if (!this.isOpen) return;
    this.el.classList.add('hidden');
    this.el.classList.remove('tm-open');
    this.about = '';
    this.choicesKey = '';
  }
}
