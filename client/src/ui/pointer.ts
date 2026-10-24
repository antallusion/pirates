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
  /** The campaign's opening (owner, 2026-10-19), its shop of trade: the good of this market to point at. */
  tradeGood?: string | null;
  /** No hammocks left aboard: «Нанять» cannot be done, the finger never points at the tavern for it (owner, 2026-10-21;
   *  the server counts the step — quests.ts stepMoot). */
  crewFull?: boolean;
  /** «Атаковать» would go for one of the sea's beasts (a shark): never the finger's for a ship's step (the run of
   *  2026-10-23 chased a shark four minutes and went down before «Борт о борт»). */
  markBeast?: boolean;
}

/** The harbour's way out to sea, the First Watch's own (the gold «В море» of the port window, the HUD's round one). */
/** (the «Готовы к выходу?» sheet first when «В море» brought it up — her hull mended after the First Watch's fight, the
 *  stores short: its gold «Докупить всё», else «Отплыть так»; the finger stood aside under the sheet and the opening's
 *  «Первый залп» stood still in port, the newcomer's run 2026-10-23) */
export const DEPART = ['.depart-panel [data-dp="all"]', '.depart-panel [data-dp="sail"]'];
const TO_SEA = [...DEPART, '#modal-panel [data-ptab="sea"]', '#tc-cast', '#tc-act[data-act="harbour"]', '.act-btn.act-harbour'];
/** Into the port window from the HUD in port, or into a harbour from the sea. */
/** The opening's «Плыть» (owner, 2026-10-22): its next place is sailed for only at her word — after the step's own button. */
const GOAL_SAIL = ['#tc-act[data-act="goal_sail"]', '.act-btn.act-goal_sail'];
const TO_PORT = ['#tc-act[data-act="harbour"]', '.act-btn.act-harbour', '#tc-act[data-act="dock"]', '#tc-act[data-act="homeport"]', '.act-btn.act-dock', '.act-btn.act-homeport'];

/** The advisor's own button (client/src/ui/buyadvice.ts): «Продать и купить» when a purchase found no room. */
export const ADVICE = ['#buy-advice #ba-go'];

/** The campaign's opening (owner, 2026-10-19: «обучение по покупкам разным в магазинам, дальше атака корабля, дальше
 *  абордаж, дальше нападение на нейтралов, и дальше к ближайшему острову основать свой город»): the finger through
 *  each step — the shop's tab and its row, «В море», «Атаковать», «На абордаж», the stack's «Атаковать», «Занять». */
function openingTargets(f: PointerFacts, op: string): string[] {
  const t = openingTargets0(f, op);
  return f.markBeast && (op === 'sink' || op === 'board') ? t.filter((x) => !/act="attack|act-attack/.test(x)) : t;
}
function openingTargets0(f: PointerFacts, op: string): string[] {
  if (op.startsWith('buy:')) {
    if (op === 'buy:arms' && f.crewFull) return [];
    if (!f.docked) return TO_PORT;
    // a purchase refused for room: the advisor's «Продать и купить» first (owner, 2026-10-21: the guide points to the
    // sell suggestion, not to a button that cannot be done)
    const shop = op.slice(4);
    // (the tavern's own «Нанять N» first: the sailors' row is folded under «Мастера и прочее» — QA 2026-10-22, the finger
    // stood on the tavern's tab already open and the step went nowhere)
    if (shop === 'arms') return ['#modal-panel [data-act="hire_n"]:not([disabled])', '#modal-panel [data-act="crew"][data-prof="sailor"][data-n="1"]:not([disabled])', '#modal-panel [data-act="hire_short"]', '#modal-panel [data-act="gun"]:not([disabled])', '#modal-panel [data-ptab="tavern"]', ...TO_PORT];
    const good = shop === 'trade' ? f.tradeGood : shop;
    return [...ADVICE, ...(good ? [`#modal-panel .mk-row[data-good="${good}"] [data-act="buy"]:not([disabled])`] : []), '#modal-panel [data-ptab="market"]', ...TO_PORT];
  }
  if (f.docked) return TO_SEA;
  switch (op) {
    // (the opening's softened foe strikes her colours soon: on her card the step's own choice — «Забрать всё и
    // затопить» sinks her, the gold «отпустить» counts as a boarding only and «Первый залп» stood still, QA 2026-10-22)
    case 'sink':
      return ['[data-sur="sink"]:not([disabled])', '#tc-act[data-act="attack"]', '.act-btn.act-attack', ...(f.touch && f.pursuit ? ['#tc-fire'] : []), ...GOAL_SAIL];
    case 'board':
      return ['[data-sur="release"]:not([disabled])', ...targetsOf({ ...f, stage: 'board' }), ...GOAL_SAIL];
    case 'neutral':
      return ['#tc-act[data-act="roam"]', '.act-btn.act-roam', ...GOAL_SAIL];
    case 'found':
      return ['#modal-panel [data-est="claim"]', '.confirm-panel [data-yes]', '#tc-act[data-act="claim"]', '.act-btn.act-claim', ...GOAL_SAIL];
  }
  return [];
}

/** The buttons a step's finger may point at, in order of preference (the first one shown wins). On a phone the action
 *  row's other buttons are `.tc-act2` pills, not the desk's `.act-btn`: each gold `#tc-act[data-act=…]` brings its pill
 *  after it (QA 2026-10-22: «Занять» second to an «Атаковать» had no finger on a phone, and the town step stood). */
export function pointerTargets(f: PointerFacts): string[] {
  const out: string[] = [];
  for (const sel of targetsOf(f)) {
    out.push(sel);
    const m = /^#tc-act\[data-act="(\w+)"\]$/.exec(sel);
    if (m) out.push(`.tc-act2[data-act="${m[1]}"]`);
  }
  return out;
}

/** A quest step done in the port she lies in (owner, 2026-10-23: «должны прям показывать куда нажать в порту»): stage
 *  `h:<quest id>:<page>` — its own button wherever it is drawn (the port's «Задания», the journal, «Цели и вести»), else
 *  the port window's page it stands on, else the HUD's way into the port window. */
export function hereTargets(f: PointerFacts, id: string, tab: string, good = ''): string[] {
  if (!f.docked) return [];
  const q = id.replace(/[^a-z0-9_]/gi, '');
  // the cargo to hand over is not aboard: its row at this market first, never «Сдать груз» that cannot be done
  const g = good.replace(/[^a-z0-9_]/gi, '');
  if (g) return [...ADVICE, `#modal-panel .mk-row[data-good="${g}"] [data-act="buy"]:not([disabled])`, '#modal-panel [data-ptab="market"]', ...TO_PORT];
  return [...(TAB_INSIDE[tab] ?? []), `[data-act="quest_here"][data-id="${q}"]`, `[data-act="quest_tab"][data-id="${q}"]`, ...(tab ? [`#modal-panel [data-ptab="${tab}"]`] : []), '#modal-panel [data-ptab="quests"]', ...TO_PORT];
}

/** Inside a port page, the way through it (the newcomer's run of 2026-10-23: «Джори Пенн», «наймите в армию 6» — the
 *  finger led to «Армия», found nothing there to point at, went back to «Задания» and its «Нанять» led to «Армия» again,
 *  round and round): the army's dwellings, a kind of men, «Макс», «Нанять». */
export const TAB_INSIDE: Record<string, string[]> = {
  army: ['[data-rcgo]:not([disabled])', '.rc-pick [data-rcmax]:not([disabled])', '.rc-unit:not(.off):not(.sel)', '#modal-panel [data-dwell]'],
};

function targetsOf(f: PointerFacts): string[] {
  if (!f.stage || f.battle) return [];
  if (f.stage.startsWith('c:')) return openingTargets(f, f.stage.slice(2));
  if (f.stage.startsWith('h:')) {
    const [, id, tab, good] = f.stage.split(':');
    return hereTargets(f, id ?? '', tab ?? '', good ?? '');
  }
  switch (f.stage) {
    case 'go':
      // the story's next place (main.ts storyFrame): out of port, then its «Плыть»; quiet while the helmsman has her
      return f.docked ? TO_SEA : f.helmsman ? [] : GOAL_SAIL;
    case 'go:sink':
    case 'go:board':
    case 'go:neutral':
      // the story's fight: as the opening's (its own button, a struck ship's choice, else «Плыть»)
      return openingTargets(f, f.stage.slice(3));
    case 'go:land':
      return f.docked ? TO_SEA : ['#tc-act[data-act="land"]', '.act-btn.act-land', ...GOAL_SAIL];
    case 'men':
      // no men for the step's fight: a harbour, its «Армия» and the way through it
      // (at sea far from any harbour «Плыть» takes her to the nearest — server goalroute.ts NEEDS_MEN)
      return f.docked ? [...TAB_INSIDE.army, '#modal-panel [data-ptab="army"]', '#tc-act[data-act="harbour"]', '.act-btn.act-harbour'] : [...TO_PORT, ...GOAL_SAIL];
    case 'go:dock':
      // …and at the step's harbour, its «Причалить»
      return f.docked ? [] : ['#tc-act[data-act="dock"]', '.act-btn.act-dock', ...GOAL_SAIL];
    case 'sail':
      // In port: the harbour's gold «В море» on its rail (docs/23 phase 6; the old «Поднять паруса» is gone — the finger
      // pointed at nothing and the watch's first step stood still, e2e 2026-10-07), else the HUD's big round «В море».
      if (f.docked) return TO_SEA;
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

/** Where the finger stands for a button's box, and which way it points: from the left, pointing right, when there is
 *  room (above «Огонь» it lay over «Действие» and seemed to mean it, QA 2026-10-06); a button at the left edge (the
 *  wheel) gets it from above, pointing down, or from below, pointing up, when there is no room above. Pure. */
export type PointerDir = 'down' | 'up' | 'right';
export function pointerSpot(r: { left: number; top: number; width: number; height: number }, size: number, vw: number, vh: number, covers: (x: number, y: number) => boolean = () => false): { x: number; y: number; dir: PointerDir } {
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  // From the left, pointing right, whenever there is room: above a button in a column or a grid of choices (the
  // prize's five) it lay over the button above and seemed to mean that one (QA 2026-10-07).
  // (Not over another button there: by «В море» it lay over «В гавань» and hid its word, docs/30.)
  const ly = Math.max(4, Math.min(vh - size - 4, cy - size / 2));
  if (r.left - size - 4 >= 4 && !covers(r.left - size / 2 - 4, ly + size / 2)) return { x: r.left - size - 4, y: ly, dir: 'right' };
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
    const spot = pointerSpot(r, this.size, innerWidth, innerHeight, (x, y) => {
      const under = document.elementFromPoint(x, y)?.closest('button, [role="button"]');
      return !!under && under !== t && !t.contains(under) && !under.closest('#tut-finger');
    });
    this.el.classList.remove('hidden');
    this.el.classList.toggle('up', spot.dir === 'up');
    this.el.classList.toggle('right', spot.dir === 'right');
    this.el.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
  }

  private find(): HTMLElement | null {
    const opening = !!this.facts.stage?.startsWith('c:');
    for (const sel of pointerTargets(this.facts)) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (shown(el)) return el;
        // the opening's row of a shop below the window's fold (the market's sailcloth): brought into sight once
        if (opening && el !== this.scrolled && el.closest('#modal-panel') && el.getClientRects().length) {
          this.scrolled = el;
          el.scrollIntoView({ block: 'center' });
          if (shown(el)) return el;
        }
      }
    }
    return null;
  }
  private scrolled: HTMLElement | null = null;
}

/** On the screen and not under something else (a sheet, a window): the middle of its box hits it. A tab already open
 *  is no target: a tap on it does nothing (QA 2026-10-22: the finger stood on the open tavern's tab). */
function shown(el: HTMLElement): boolean {
  if (el.classList.contains('hidden') || el.closest('.hidden, .tut-hidden')) return false;
  if (el.getAttribute('aria-selected') === 'true') return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === el || el.contains(hit) || hit.id === 'tut-finger' || !!hit.closest('#tut-finger'));
}
