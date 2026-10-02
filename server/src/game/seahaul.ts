// docs/19 D1–D5: the caps on a captain's day of finds (shared/src/data/seahaul.ts). Each source keeps her count of the
// day of the finds that paid their full worth; her seconds at sea that day grow the count she may have (so many an
// hour at sea, one hour's worth from the first); past it a find pays half. Nothing here takes a find away.

import { HAUL, HAUL_SOURCES, haulDay, haulMul } from '../../../shared/src/data/seahaul.ts';
import type { HaulSource } from '../../../shared/src/data/seahaul.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

/** Her day's record, a new one with the day. */
export function haulOf(game: Game, p: Profile): NonNullable<Profile['seaHaul']> {
  const day = haulDay(game.wallNow());
  if (!p.seaHaul || p.seaHaul.day !== day) p.seaHaul = { day, sec: 0, n: {} };
  return p.seaHaul;
}

/** The share of its worth her next find of a source would pay now. */
export function haulPeek(game: Game, s: PlayerSession, src: HaulSource): number {
  if (!s.profile) return 1;
  const h = haulOf(game, s.profile);
  return haulMul(h.n[src] ?? 0, src, h.sec);
}

/** A find of a source had at a share of its worth: a full one counts toward her day. */
export function haulNote(game: Game, s: PlayerSession, src: HaulSource, mul: number): void {
  if (!s.profile) return;
  const h = haulOf(game, s.profile);
  if (mul >= 1) {
    h.n[src] = (h.n[src] ?? 0) + 1;
    return;
  }
  // The first thin one of a source in her day: the lookout's word why.
  const told = (h.told ??= {});
  if (told[src]) return;
  told[src] = 1;
  game.sendTo(s, { t: 'toast', msg: THIN_LINE[src], kind: 'info' });
}

const THIN_LINE: Record<HaulSource, string> = {
  marks: 'The sea marks are picked over today: what the boats find now pays half (more as your hours at sea grow).',
  life: 'The flotsam is thin today: what you fish up now is half a haul (more as your hours at sea grow).',
  finds: 'The small things of the sea are thin today: they give half now (more as your hours at sea grow).',
  adv: 'The chests and stores are picked over today: half their worth now (more as your hours at sea grow).',
  lairs: 'The lairs are hunted out today: their spoils are half now (the lesson is whole; more as your hours at sea grow).',
  roam: 'The roaming creatures are hunted thin today: their silver and spoils are half now (the lesson is whole; more as your hours at sea grow).',
};

/** The share of its worth her next find of a source pays — had now. */
export function haulTake(game: Game, s: PlayerSession, src: HaulSource): number {
  const mul = haulPeek(game, s, src);
  haulNote(game, s, src, mul);
  return mul;
}

/** What she may still have at the full worth today, by source (the tester's console, the tests). */
export function haulLeft(game: Game, p: Profile): Record<HaulSource, number> {
  const h = haulOf(game, p);
  const out = {} as Record<HaulSource, number>;
  for (const k of HAUL_SOURCES) out[k] = Math.max(0, Math.floor(HAUL[k] * Math.max(1, h.sec / 3600)) - (h.n[k] ?? 0));
  return out;
}

/** Every second: her time at sea of the day. */
export function stepHaul(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || ship.docked || !ship.alive) continue;
    haulOf(game, s.profile).sec += 1;
  }
}

/** `/haul [reset]`: what she may still have at the full worth today, source by source; the day forgotten. */
export function adminHaul(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  if (args.includes('reset')) {
    p.seaHaul = undefined;
    return 'The day’s count of your finds is forgotten.';
  }
  const h = haulOf(game, p);
  const left = haulLeft(game, p);
  return `At sea today ${Math.floor(h.sec / 60)} min. At the full worth still: marks ${left.marks}, flotsam ${left.life}, small things ${left.finds}, chests and stores ${left.adv}, lairs ${left.lairs}.`;
}
