// The task card (forum 2026-11-07, Эдуард: «Победите в 3 боях с существами: логова, стаи или дрейфы — что это и где
// почитать?»; the owner: «при нажатии на задания надо модалку открывать где все написано и может даже
// автодобраться… кнопки подсвечивай только нужные»): a tap on a season trial or a goal of the HUD opens one card in
// the kit's bottom sheet — what to do in plain words, where, how far she is, the reward, how it works, a link to the
// Pilot's Book's article, and one gold «Плыть» that starts the run to the nearest suitable place (main.ts startGoal,
// the server's goalroute.ts). Only «Плыть» is gold; the book's link is a plain one.
// RU and EN: client/src/lang/ui/taskcard.ts.

import { guideArticle } from '../../../shared/src/data/guide/index.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/taskcard.ts';
import { esc, icon } from './dom.ts';
import { buttonHtml } from './kit/button.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';

const L = dict(EN, RU);

export interface TaskCard {
  /** The sheet's small title (a trial, a goal). */
  kind: 'trial' | 'goal';
  /** The task's own name, large. */
  name: string;
  /** A line under the name (a period, a giver). */
  sub?: string;
  what?: string;
  where?: string;
  /** How far: done of need, or words. */
  progress?: { n: number; need: number } | string;
  reward?: string;
  how?: string;
  /** The Pilot's Book's article (only one that exists is shown). */
  guide?: string;
  /** Done: no «Плыть». */
  done?: boolean;
  /** The run to the nearest place; absent: not done at sea. */
  sail?: () => void;
}

export interface TaskCardHooks {
  guide: (id: string) => void;
}

let open: SheetHandle | null = null;

/** The card's body (pure markup: the tests read it). */
export function taskCardHtml(c: TaskCard): string {
  const row = (k: 'what' | 'where' | 'reward' | 'how', v: string | undefined, ico: string) =>
    v ? `<div class="tk-row tk-${k}">${icon(ico, '', 'ico ico-sm tk-ico')}<div><b>${esc(L(k))}</b><p>${esc(v)}</p></div></div>` : '';
  let prog = '';
  if (c.progress !== undefined) {
    if (typeof c.progress === 'string') prog = `<div class="tk-prog"><b>${esc(L('progress'))}</b> <span>${esc(c.progress)}</span></div>`;
    else {
      const { n, need } = c.progress;
      const pct = need > 0 ? Math.round((Math.min(n, need) / need) * 100) : 0;
      prog = `<div class="tk-prog"><b>${esc(L('progress'))}</b> <span class="tk-bar"><i style="width:${pct}%"></i></span><span class="tk-n">${c.done ? `✓ ${esc(L('doneAll'))}` : `${n} / ${need}`}</span></div>`;
    }
  }
  const art = c.guide ? guideArticle(c.guide) : undefined;
  const book = art ? `<button type="button" class="tk-book" data-tkguide="${esc(art.id)}">${icon('ui_scroll', '', 'ico ico-sm')}<span>${esc(L('guide'))}: «${esc(art.title[lang() === 'ru' ? 1 : 0])}»</span></button>` : '';
  const sea = !c.done && !c.sail ? `<p class="tk-nosea muted">${esc(L('noSea'))}</p>` : '';
  return `<div class="tk-card">
    <h3 class="tk-name">${esc(c.name)}</h3>${c.sub ? `<p class="tk-sub muted">${esc(c.sub)}</p>` : ''}
    ${prog}
    ${row('what', c.what !== c.name ? c.what : undefined, 'map_contract')}${row('where', c.where, 'menu_map')}${row('reward', c.reward, 'ui_chest')}${row('how', c.how, 'menu_help')}
    ${book}${sea}
  </div>`;
}

/** Open the card (one at a time: a second tap replaces it). */
export function openTaskCard(c: TaskCard, hooks: TaskCardHooks): SheetHandle {
  open?.close('code');
  const sail = !c.done && c.sail;
  // (the owner: «кнопки подсвечивай только нужные» — one gold «Плыть», or none; the head's × closes it)
  const foot = sail ? buttonHtml({ kind: 'primary', label: L('sail'), data: { tksail: '1' }, cls: 'tk-sail' }) : undefined;
  const h = openSheet({ title: L(c.kind), body: taskCardHtml(c), ...(foot ? { foot } : {}), height: 'auto', cls: 'tk-sheet', id: 'task-card', passKeys: true, onClose: () => { if (open === h) open = null; } });
  open = h;
  h.root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const g = t.closest<HTMLElement>('[data-tkguide]');
    if (g) {
      h.close('button');
      hooks.guide(g.dataset.tkguide!);
      return;
    }
    if (t.closest('[data-tksail]') && c.sail) {
      h.close('button');
      c.sail();
      return;
    }
    if (t.closest('[data-tkclose]')) h.close('button');
  });
  if (sail) h.root.querySelector<HTMLElement>('.tk-sail')?.setAttribute('title', L('sailHint'));
  return h;
}

/** The card open now, if any (the tests', and a window that opens over it closes it). */
export function taskCardOpen(): boolean {
  return !!open?.open;
}

export function closeTaskCard(): void {
  open?.close('code');
}
