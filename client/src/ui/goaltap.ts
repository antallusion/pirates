// Route (owner, 2026-10-15: «нажимая на цель из журнала я должен плыть к ближайшей точке выполнения … вообще все
// должно меня вести автоматом к ближайшей подходящей точке»): every goal's line wherever it is shown — the journal, the
// chart's log, «Цели и вести» — carries its key (`data-goal`, server/src/game/goalroute.ts GOAL_KEYS); a tap on it is
// the run to its nearest place.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/route.ts';

const L = dict(EN, RU);

/** Every goal line under `root` made a tap that runs to the goal's nearest place. */
export function bindGoalTaps(root: ParentNode, go: (key: string) => void): void {
  root.querySelectorAll<HTMLElement>('[data-goal]').forEach((el) => {
    el.classList.add('goal-tap');
    if (!el.title) el.title = L('tap');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.onclick = (e) => {
      e.stopPropagation();
      go(el.dataset.goal!);
    };
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go(el.dataset.goal!);
      }
    };
  });
}
