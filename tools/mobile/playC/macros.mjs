// Band C (levels 40–60 and the endgame, docs/30_PLAYTHROUGH_C.md): playA's in-process hands, and the endgame's on top.
//   sh data/c-start.sh — CPORT=58996 DB=data/inproc-c.db … MACROS=../playC/macros.mjs node tools/mobile/playA/inproc.mjs
export * from '../playA/inproc-macros.mjs';
import { refit as refitA, auto as autoA, reflex as reflexA } from '../playA/inproc-macros.mjs';
import { TALENTS, canLearn } from '../../../shared/src/data/talents.ts';
import { learnContext } from '../../../server/src/game/progression.ts';

const R = (globalThis.__inC ??= { tAt: -99 });

/** Her reflexes, and a talent point spent as it comes (the gunnery tree first, then the hull's, then the rest by tier). */
export function reflex(B) {
  reflexA(B);
  const p = B.s.profile, ship = B.s.ship;
  if (!p || !ship || B.game.now - R.tAt < 3 || ship.underFire?.(B.game.now)) return;
  const pts = B.game.talentPoints(p);
  if (pts <= 0) return;
  R.tAt = B.game.now;
  const ctx = learnContext(p);
  const order = [...TALENTS].sort((a, b) => pref(a.id) - pref(b.id) || (a.tier ?? 0) - (b.tier ?? 0));
  const t = order.find((x) => !canLearn(p.talents, x.id, pts, ctx));
  if (t) B.send({ t: 'learn_talent', id: t.id });
}
const pref = (id) => (/^gun_/.test(id) ? 0 : /^srv_|^shp_/.test(id) ? 1 : /^brd_|^cmd_/.test(id) ? 2 : 3);

/** A late captain's stores: round shot for 16 broadsides of her battery (a fight of her ⚓ takes 8–14), food for 25 min
 *  of her crew (a third of the hold at most). */
export async function refitC(B, a = {}) {
  const ship = B.s.ship;
  const gps = ship.stats.gunsPerSide ?? 10;
  const food = Math.min(Math.round(ship.stats.holdVolume / 3), Math.ceil((ship.stats.crewMax / 40) * 25));
  return refitA(B, { round: gps * 16, food, ...a });
}

/** playA's working rounds with a late captain's stores. */
export async function autoC(B, a = {}) {
  const ship = B.s.ship;
  const gps = ship.stats.gunsPerSide ?? 10;
  const food = Math.min(Math.round(ship.stats.holdVolume / 3), Math.ceil((ship.stats.crewMax / 40) * 25));
  return autoA(B, { round: gps * 16, food, ...a });
}
