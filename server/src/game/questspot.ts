// A quest's quarry is put out where no captain sees it (forum post 55: «когда у тебя есть квест, при нажатии "плыть" моб
// появляется из ниоткуда»). «Плыть» on a quest whose quarry was not yet about its port put the quarry out at once
// 500–1 275 m off that port (questlocal.ts putOut, forced) — and the captain who pressed it was in that port or by it, so
// the ship popped up beside her. Now every quest's quarry (a port's quest, a day's order, a bounty, a hunt's leader, the
// campaign's foe) is put out beyond the sight of every captain — at sea or in port (a docked ship lies at the quay):
// QUEST_SIGHT_R off each, three times her screen (it shows some 300 m about her at the sea's own zoom: min(w, h) / 260
// px a metre; still off a 1366 px screen zoomed out to 0.9 px a metre).
// Within the quest's waters (its 1.5 km, the owner's rule) when there is such a spot; else the nearest one beyond, from
// where it sails into them; only on a sea crowded with captains, the spot farthest from them all.

import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';

/** No captain is nearer than this to a quarry put out (three times her screen at the sea's own zoom). */
export const QUEST_SIGHT_R = 900;
/** How far past the quest's waters a hidden spot is looked for. */
export const HIDE_REACH = 3200;

/** The spots' own dice: the sea's stream is not drawn on. */
const rngs = new WeakMap<Game, Rng>();
function sr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x9e5705)));
  return r;
}

/** How far the nearest captain (at sea or at a quay) is from the spot. */
export function nearestCaptain(game: Game, x: number, y: number): number {
  let best = Infinity;
  for (const s of game.sessions) {
    const sh = s.ship;
    if (!sh || !sh.alive) continue;
    const d = Math.hypot(sh.state.x - x, sh.state.y - y);
    if (d < best) best = d;
  }
  return best;
}

/** No captain would be sent this spot's ship: it is beyond every one's sight. */
export function unseen(game: Game, x: number, y: number): boolean {
  return nearestCaptain(game, x, y) >= QUEST_SIGHT_R;
}

/** A spot for a quarry about `home` (`ok`: open water and whatever else the quest asks): `r0`–`r1` off it out of every
 *  captain's sight; else the nearest such spot out to `r1` + HIDE_REACH; else the one farthest from the captains. */
export function hiddenSpot(game: Game, home: { x: number; y: number }, r0: number, r1: number, ok: (x: number, y: number) => boolean): { x: number; y: number } | null {
  const rng = sr(game);
  const fb: { far: { x: number; y: number; d: number } | null } = { far: null };
  const look = (a0: number, a1: number, n: number): { x: number; y: number } | null => {
    let best: { x: number; y: number; r: number } | null = null;
    for (let k = 0; k < n; k++) {
      const a = rng.float() * Math.PI * 2, r = a0 + rng.float() * Math.max(1, a1 - a0);
      const x = home.x + Math.cos(a) * r, y = home.y + Math.sin(a) * r;
      if (!ok(x, y)) continue;
      const d = nearestCaptain(game, x, y);
      if (d >= QUEST_SIGHT_R) {
        if (!best || r < best.r) best = { x, y, r };
        if (a1 - a0 < 1500) break; // (the quest's own waters: the first unseen spot will do)
      } else if (!fb.far || d > fb.far.d) fb.far = { x, y, d };
    }
    return best;
  };
  const inside = look(r0, r1, 40);
  if (inside) return inside;
  const beyond = look(r1, r1 + HIDE_REACH, 48);
  if (beyond) return beyond;
  return fb.far ? { x: fb.far.x, y: fb.far.y } : null;
}
