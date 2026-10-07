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

/** Where a choice's word stands: right of it, left of it, below it, above it. */
export type TmLabelAt = 'r' | 'l' | 'b' | 't';

/** A box on the screen the choices keep off (the HUD's own controls). */
export interface TmRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where the choices stand beside a target at (x, y) whose picture reaches `r` px from its middle: on an arc of radius
 *  r + gap round her, from level with her down and round under her (her name and bars are drawn over her: the arc keeps
 *  off them), on her right — or, of the four ways (right or left, down or up), the one that keeps the choices and their
 *  words on the screen and off the HUD's controls (`avoid`) best, the right and down first, the left first when she is
 *  in the screen's right third. `label` is each word's width (it stands on the arc's outer side). `crowded`: even the
 *  best way lies over the HUD's controls (she is in among them: the choices are not offered there). Pure. */
export function menuLayout(n: number, x: number, y: number, r: number, vw: number, vh: number, item: number, avoid: readonly TmRect[] = [], label: readonly number[] = []): { side: 'right' | 'left'; items: { x: number; y: number; lp: TmLabelAt }[]; crowded: boolean } {
  const R = Math.max(r, 16) + item / 2 + 16;
  const step = (46 * Math.PI) / 180, from = (6 * Math.PI) / 180;
  const m = item / 2 + 6;
  const h = item / 2;
  /** A word's box for a choice at p, its word at `lp`. */
  const wordBox = (p: { x: number; y: number }, lw: number, lp: TmLabelAt): TmRect =>
    lp === 'r' ? { left: p.x + h + 9, top: p.y - 10, right: p.x + h + 9 + lw, bottom: p.y + 10 }
      : lp === 'l' ? { left: p.x - h - 9 - lw, top: p.y - 10, right: p.x - h - 9, bottom: p.y + 10 }
        : lp === 'b' ? { left: p.x - lw / 2, top: p.y + h + 5, right: p.x + lw / 2, bottom: p.y + h + 25 }
          : { left: p.x - lw / 2, top: p.y - h - 25, right: p.x + lw / 2, bottom: p.y - h - 5 };
  const lay = (side: 'right' | 'left', up: 1 | -1) => {
    const items = Array.from({ length: n }, (_, i) => {
      const a = from + i * step;
      // each word on the arc's outer side: beside a choice at her side, under (over) one that has come round under
      // (over) her — never across the next choice
      const lp: TmLabelAt = a > (66 * Math.PI) / 180 ? (up === 1 ? 'b' : 't') : side === 'right' ? 'r' : 'l';
      return { x: x + Math.cos(a) * R * (side === 'right' ? 1 : -1), y: y + Math.sin(a) * R * up, lp };
    });
    // on the screen: the arc moved up or down and in from the side as a whole (a finger apart still)
    const top = Math.min(...items.map((p) => p.y)), bottom = Math.max(...items.map((p) => p.y));
    const left = Math.min(...items.map((p) => p.x)), right = Math.max(...items.map((p) => p.x));
    const dy = top < m ? m - top : bottom > vh - m ? vh - m - bottom : 0;
    const dx = left < m ? m - left : right > vw - m ? vw - m - right : 0;
    for (const p of items) {
      p.y += dy;
      p.x += dx;
    }
    // what it costs: a word off the screen, a choice or a word over the HUD or over another choice, a choice pressed
    // onto her
    let cost = 0;
    const own = items.map((p) => ({ left: p.x - h, top: p.y - h, right: p.x + h, bottom: p.y + h }));
    items.forEach((p, i) => {
      const lw = label[i] ?? 0;
      const boxes: TmRect[] = [own[i]];
      if (lw) {
        const w = wordBox(p, lw, p.lp);
        boxes.push(w);
        for (const [j, o] of own.entries()) if (j !== i) cost += Math.max(0, Math.min(o.right, w.right) - Math.max(o.left, w.left)) * Math.max(0, Math.min(o.bottom, w.bottom) - Math.max(o.top, w.top)) * 4;
      }
      for (const bx of boxes) {
        cost += (Math.max(0, -bx.left) + Math.max(0, bx.right - vw) + Math.max(0, -bx.top) + Math.max(0, bx.bottom - vh)) * 20;
        for (const av of avoid) cost += Math.max(0, Math.min(av.right, bx.right) - Math.max(av.left, bx.left)) * Math.max(0, Math.min(av.bottom, bx.bottom) - Math.max(av.top, bx.top));
      }
      cost += Math.max(0, r + h - Math.hypot(p.x - x, p.y - y)) * 400;
    });
    return { side, items, cost };
  };
  const first: 'right' | 'left' = x > vw * 0.66 ? 'left' : 'right';
  const other: 'right' | 'left' = first === 'right' ? 'left' : 'right';
  const low = y + R + m > vh;
  const tries = [lay(first, low ? -1 : 1), lay(first, low ? 1 : -1), lay(other, low ? -1 : 1), lay(other, low ? 1 : -1)];
  // the preferred way unless another is clearly better
  let best = tries[0];
  for (const t of tries.slice(1)) if (t.cost < best.cost * 0.6 - 1) best = t;
  return { side: best.side, items: best.items, crowded: best.cost > item * item * 0.35 };
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

  /** A desk, every frame: is the mouse (at x, y) on a choice or its word? On them or on the target they stay; off both
   *  they go a moment later. Measured, not left to the pointer's enter and leave: the choices follow a sailing target,
   *  and a choice that slides from under a still mouse says nothing. */
  hoverAt(x: number, y: number, onTarget: boolean): void {
    if (!this.isOpen) return;
    const near = (r: DOMRect) => x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4;
    this.hoverIn = [...this.el.querySelectorAll<HTMLElement>('.tm-pic, .tm-l')].some((e) => near(e.getBoundingClientRect()));
    if (this.hoverIn || onTarget) this.keep();
    else this.leave();
  }

  /** Open (or redraw) the choices about a target. */
  show(about: string, choices: TmChoice[], name: string): void {
    if (!choices.length) return this.hide();
    const key = `${about}|${choices.map((c) => `${c.id}:${c.art}:${c.label}:${c.on ? 1 : 0}`).join(',')}`;
    if (!this.isOpen || this.about !== about) {
      this.openedAt = performance.now();
      this.keep();
    }
    this.about = about;
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

  /** Stand beside the target where she is now (screen px, her picture's reach), off the HUD's controls (`avoid`). */
  place(x: number, y: number, r: number, avoid: readonly TmRect[] = []): void {
    if (!this.isOpen) return;
    const items = [...this.el.querySelectorAll<HTMLElement>('.tm-item')];
    if (!items.length) return;
    const size = items[0].offsetWidth || 44;
    const g = menuLayout(items.length, x, y, r, innerWidth, innerHeight, size, avoid, items.map((b) => b.querySelector<HTMLElement>('.tm-l')?.offsetWidth ?? 0));
    // in among the HUD's own controls the choices would lie over them: none there (the action button has her)
    if (g.crowded) return this.hide();
    this.el.dataset.side = g.side;
    items.forEach((b, i) => {
      b.style.transform = `translate(${Math.round(g.items[i].x - size / 2)}px, ${Math.round(g.items[i].y - size / 2)}px)`;
      if (b.dataset.lp !== g.items[i].lp) b.dataset.lp = g.items[i].lp;
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
