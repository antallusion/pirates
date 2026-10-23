// «Плыть» again after a prize (owner via the coordinator, 2026-10-23): the run to a quest's place lets go when another
// order takes the helm — a struck ship's terms sailed to, a boarding, «Атаковать» — and every action stops the ship
// (allstop.ts), so nothing sails on by itself. What is left is her «Плыть» on the bar, gold, until she presses it: never
// an automatic resume. A course of her own (a mark on the chart, the pill's stop) or the goal met forgets it.

export interface ResumeFacts {
  /** The goal of the last run to a quest's place, kept until she chose another course or the goal was met. */
  key: string | null;
  /** That quest is still hers (a quest's key), or the goal has no quest behind it. */
  live: boolean;
  /** A run under way now (any). */
  routeOn: boolean;
  docked: boolean;
  autosail: boolean;
  /** A fight, a chase, a battle, a card that must be answered, a stack's run, the island's scene. */
  busy: boolean;
}

/** Whether her «Плыть» for the broken-off run is on the bar now. */
export function resumeOn(f: ResumeFacts): boolean {
  return !!f.key && f.live && !f.routeOn && !f.docked && !f.autosail && !f.busy;
}

/** How a run's end bears on the button: met — forgotten; a course of her own — forgotten; else (another order took the
 *  helm) — kept. */
export function resumeAfterEnd(key: string | null, why: 'done' | 'off' | 'none' | 'own' | undefined): string | null {
  return why === 'done' || why === 'own' || why === 'none' ? null : key;
}
