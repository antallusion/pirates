// The First Watch's finger (docs/23 item 80, owner 2026-10-06: «всё должно быть идеально просто на мобиле»): instead of
// a paragraph, a pointing hand over the very button the step wants, the button ringed in gold. Drawn in code (an SVG
// hand, no art), it bobs a little (still under «less motion»), never takes a touch, and steps aside when the button is
// hidden, covered (a sheet, a window over it) or gone. Which button for which step: `pointerTargets`, pure and tested.

export interface PointerFacts {
  stage: string | null;
  touch: boolean;
  docked: boolean;
  /** The hex battle is on the screen (its own buttons; the finger keeps out). */
  battle: boolean;
  /** The helmsman has her (sailing her home, or «Атаковать» under way): the button was pressed, nothing to point at. */
  helmsman?: boolean;
  /** «Атаковать» under way, and how: closing for the grapples, or holding off at gun range. */
  pursuit?: 'board' | 'guns' | null;
}

/** The buttons a step's finger may point at, in order of preference (the first one shown wins). */
export function pointerTargets(f: PointerFacts): string[] {
  if (!f.stage || f.battle) return [];
  switch (f.stage) {
    case 'sail':
      // In port: the harbour's «set sail» (or «Harbour» to bring that screen back); at sea, the wheel on a phone.
      if (f.docked) return ['[data-act="undock"]', '#tc-act[data-act="harbour"]', '.act-btn.act-harbour'];
      return f.touch ? ['#tc-stick'] : [];
    case 'attack':
      // (already alongside her, «Действие» reads «На абордаж»: that is the step's battle, sooner)
      return ['#tc-act[data-act="attack"]', '.act-btn.act-attack', '#tc-act[data-act="board"]', '.act-btn.act-board'];
    case 'fire':
      return f.touch ? ['#tc-fire'] : [];
    case 'board':
      // Alongside, the grapples. Still closing (the helmsman runs in): nothing yet. Held off at gun range: «Сблизиться»
      // (the same button reads «Бортами» while he closes — pointed at then, it turned him away: QA 2026-10-06). The
      // pursuit lost (her mark gone, another come): «Атаковать» runs in again.
      if (f.pursuit === 'guns') return ['#tc-act[data-act="board"]', '.act-btn.act-board', '#tc-act[data-act="attack_mode"]', '.act-btn.act-attack_mode'];
      if (f.pursuit === 'board') return ['#tc-act[data-act="board"]', '.act-btn.act-board'];
      return ['#tc-act[data-act="board"]', '.act-btn.act-board', '#tc-act[data-act="attack"]', '.act-btn.act-attack'];
    case 'port':
      // Pressed once, the helmsman sails her home and puts in by himself: the finger waits (the newcomer's run pressed
      // «В порт» 29 times while it stood over the button all the way home).
      if (f.docked) return [];
      // Her prize's reckoning first (the gold «выкуп»: silver, and she sails on), then «В порт».
      if (f.helmsman) return ['[data-fate="ransom"]', '[data-fate="sink"]'];
      return ['[data-fate="ransom"]', '[data-fate="sink"]', '#tc-act[data-act="dock"]', '#tc-act[data-act="homeport"]', '.act-btn.act-dock', '.act-btn.act-homeport'];
  }
  return [];
}

/** Where the finger stands for a button's box, and which way it points: a button in the right part of the screen (the
 *  column of «Огонь», «Действие», the target line) gets it from the left, pointing right — above «Огонь» it lay over
 *  «Действие» and seemed to mean it (QA 2026-10-06); elsewhere it stands above, pointing down, or below, pointing up,
 *  when there is no room above. Pure. */
export type PointerDir = 'down' | 'up' | 'right';
export function pointerSpot(r: { left: number; top: number; width: number; height: number }, size: number, vw: number, vh: number): { x: number; y: number; dir: PointerDir } {
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (cx > vw * 0.6 && r.left - size - 4 >= 4) return { x: r.left - size - 4, y: Math.max(4, Math.min(vh - size - 4, cy - size / 2)), dir: 'right' };
  const x = Math.max(4, Math.min(vw - size - 4, cx - size / 2));
  const above = r.top - size - 4;
  if (above >= 4) return { x, y: above, dir: 'down' };
  return { x, y: Math.min(vh - size - 4, r.top + r.height + 4), dir: 'up' };
}

const HAND = `<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false">
  <path d="M20 4c-2.2 0-4 1.8-4 4v17.5l-2.4-2.4a3.9 3.9 0 0 0-5.6 5.5l9.6 10.4A11 11 0 0 0 25.6 43H30a10 10 0 0 0 10-10V23.5c0-2-1.6-3.6-3.6-3.6-.8 0-1.5.2-2.1.7-.3-1.8-1.9-3.1-3.7-3.1-1 0-1.9.4-2.6 1-.6-1.4-2-2.4-3.6-2.4-.5 0-.9.1-1.4.2V8c0-2.2-1.8-4-4-4Z"
    fill="#e8d9b0" stroke="#2a2118" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M24 17.5V26M30 19v7M35 22v5" stroke="#2a2118" stroke-width="1.8" stroke-linecap="round" fill="none"/>
</svg>`;

export class TutorPointer {
  private el: HTMLElement;
  private ringed: HTMLElement | null = null;
  private facts: PointerFacts = { stage: null, touch: false, docked: false, battle: false };
  private size = 44;

  constructor() {
    const el = document.createElement('div');
    el.id = 'tut-finger';
    el.className = 'hidden';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<i class="tf-hand">${HAND}</i>`;
    document.body.append(el);
    this.el = el;
  }

  set(f: PointerFacts): void {
    this.facts = f;
  }

  /** The button the finger is over now, or null. */
  get target(): HTMLElement | null {
    return this.ringed;
  }

  /** Once a frame (cheap: a few queries and one box). */
  frame(): void {
    const t = this.find();
    if (t !== this.ringed) {
      this.ringed?.classList.remove('tut-target');
      t?.classList.add('tut-target');
      this.ringed = t;
    }
    if (!t) {
      this.el.classList.add('hidden');
      return;
    }
    const r = t.getBoundingClientRect();
    const spot = pointerSpot(r, this.size, innerWidth, innerHeight);
    this.el.classList.remove('hidden');
    this.el.classList.toggle('up', spot.dir === 'up');
    this.el.classList.toggle('right', spot.dir === 'right');
    this.el.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
  }

  private find(): HTMLElement | null {
    for (const sel of pointerTargets(this.facts)) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) if (shown(el)) return el;
    }
    return null;
  }
}

/** On the screen and not under something else (a sheet, a window): the middle of its box hits it. */
function shown(el: HTMLElement): boolean {
  if (el.classList.contains('hidden') || el.closest('.hidden, .tut-hidden')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === el || el.contains(hit) || hit.id === 'tut-finger' || !!hit.closest('#tut-finger'));
}
