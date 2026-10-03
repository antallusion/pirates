// The great ones ashore against the captains of their levels (owner, 2026-10-03; shared/src/data/shorebosses.ts): each
// fought out on the battle ashore by the reference captain of the level (tests/balance/lairs.ts's party, landing all
// but her watch), both sides played by the sea's mind and the great one's moves by its director — a captain who knows
// none of the counterplay — and the multiple of the great one (SHORE_CAL) that costs her SHORE_LOSS of her men.
//
// Rebuild the table: node --disable-warning=ExperimentalWarning -e "import('./tests/balance/shore.ts').then((m) => console.log(JSON.stringify(m.calibrateShore(), null, 1)))"

import { SHORE_BOSSES, SHORE_BOSS_IDS, SHORE_CAL, SHORE_LOSS } from '../../shared/src/data/shorebosses.ts';
import type { ShoreBossId } from '../../shared/src/data/shorebosses.ts';
import { simulateShore } from '../../server/src/game/shorebosses.ts';
import { refParty } from './lairs.ts';

export interface ShoreFight {
  win: number;
  /** Her landed men lost on average (a lost fight counting as all of them), and the rounds the fight ran. */
  loss: number;
  rounds: number;
}

/** `n` battles ashore of the reference captain of ⚓L against the great one. */
export function shoreFight(kind: ShoreBossId, L: number, n = 16): ShoreFight {
  let win = 0, loss = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateShore(kind, L, refParty(L), 1000 + i * 31);
    if (r.won) {
      win++;
      loss += r.lost;
    } else loss += 1;
    rounds += r.rounds;
  }
  return { win: win / n, loss: loss / n, rounds: rounds / n };
}

/** The levels a great one stands at. */
export const shoreLevels = (kind: ShoreBossId): number[] => {
  const out: number[] = [];
  for (let L = SHORE_BOSSES[kind].lv[0]; L <= SHORE_BOSSES[kind].lv[1]; L++) out.push(L);
  return out;
};

/** Rebuild SHORE_CAL by bisection on the battle itself (the table is changed in place while it runs, then restored). */
export function calibrateShore(kinds: ShoreBossId[] = SHORE_BOSS_IDS, log?: (s: string) => void): Record<ShoreBossId, number[]> {
  const out = {} as Record<ShoreBossId, number[]>;
  for (const kind of kinds) {
    const keep = [...SHORE_CAL[kind]];
    const row = keep.map(() => 0);
    for (const L of shoreLevels(kind)) {
      let lo = Math.log(0.15), hi = Math.log(8);
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        SHORE_CAL[kind][L] = Math.exp(mid);
        if (shoreFight(kind, L).loss > SHORE_LOSS) hi = mid;
        else lo = mid;
      }
      row[L] = Math.round(Math.exp((lo + hi) / 2) * 100) / 100;
      SHORE_CAL[kind][L] = row[L];
      log?.(`${kind} ⚓${L}: ${row[L]}`);
    }
    SHORE_CAL[kind].splice(0, keep.length, ...keep);
    out[kind] = row;
  }
  return out;
}
