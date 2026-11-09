// The crew while the captain was away (forum post 45, shared/src/data/crewaway.ts): settled once as she comes back
// aboard (Game.sendInit, before the rest ashore is reckoned — it reads the same `ashoreAt`). At sea they ate the
// provisions (off her own island, its provisions first); in port they drank their silver. What was short costs morale
// (nobody deserts while she is away: forum post 98), written into
// «Хроника» and shown in «Расчёт за время отсутствия».

import { LOGOUT_TIMER_SEC } from '../../../shared/src/constants.ts';
import { AWAY_SETTLE_MIN_H, settleAwayCrew } from '../../../shared/src/data/crewaway.ts';
import type { AwayCrewOut } from '../../../shared/src/data/crewaway.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { chronicleOnLogin, logNote } from './captainlog.ts';
import { reconcile, wageMul, wagesPerHour } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { creaturesAboard } from './tame.ts';
import { lyingOff, reckonBase, yardOf } from './base.ts';
import { ownIsland } from './estate.ts';

/** Forum post 98 (2026-11-09): the hands that deserted while their captain was away, given back once — by account, from
 *  the chronicle's reckonings (Эдуард's had rolled off his log: the 70 of his post). */
/** Only captains made before the fix (a test's or a new world's account 161 is someone else). */
const REFUND_BEFORE = Date.UTC(2026, 10, 9);
export const AWAY_REFUND: Record<number, number> = { 161: 70, 69: 3, 184: 3, 214: 7, 236: 1, 260: 12, 355: 2 };

/** The deserters of the old reckoning back aboard, up to her hammocks (the rest is told and lost). Once. */
function refundDeserters(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  const n = AWAY_REFUND[s.accountId];
  if (!p || !ship || !n || p.refund98 !== undefined) return;
  // (the accounts of then, not a test's or a new world's under the same id)
  if (!((game.db.seenOf?.(s.accountId)?.created ?? Infinity) < REFUND_BEFORE)) return;
  const k = Math.max(0, Math.min(n, ship.stats.crewMax - ship.crew));
  p.refund98 = k;
  if (k <= 0) return;
  ship.crew += k;
  p.crew = ship.crew;
  reconcile(game, p.company, ship.crew);
  game.toastShip(ship, `${k} hands who left while you were away are back aboard.`, 'good');
}

/** Back aboard: the chronicle's kept lines, then her crew's reckoning for the time away (null: nothing to settle). */
export function crewAwayOnLogin(game: Game, s: PlayerSession): (AwayCrewOut & { crew: number }) | null {
  chronicleOnLogin(game, s);
  refundDeserters(game, s);
  const p = s.profile, ship = s.ship;
  if (!p || !ship || p.ashoreAt === undefined) return null;
  const atSea = !ship.docked;
  // (her ship lingered at sea a while after she went: those seconds she ate as she sailed, Game.shipUpkeep)
  const hours = Math.max(0, (game.wallNow() - p.ashoreAt) / 3_600_000 - (atSea ? LOGOUT_TIMER_SEC / 3600 : 0));
  if (hours < AWAY_SETTLE_MIN_H) return null;
  // Off her own island (forum post 98): the men are home — they eat the island's provisions, not the hold's or her purse
  const own = atSea ? ownIsland(game, s.accountId) : undefined;
  const home = !!own && lyingOff(game, s, own);
  if (home) reckonBase(game, own!); // (its producers' hours first: the bread grown while she was away is on the table)
  const yard = home ? yardOf(game, own!) : null;
  const isleFood = home ? (yard!.res.provisions ?? 0) + (own!.store.provisions ?? 0) : 0;
  const st = ship.stats;
  const frontier = atSea && REGIONS[ship.region]?.safety === 'lawless' ? Math.max(0.5, 1 - 1.25 * tval(st, 'frontier')) : 1;
  const out = settleAwayCrew({
    hours, atSea, level: p.level, crew: ship.crew, crewMin: st.crewMin, eaters: ship.crew - creaturesAboard(ship), provisionUse: st.provisionUse * frontier,
    provisions: ship.cargo.provisions ?? 0, gold: p.gold, wagesPerHour: wagesPerHour(p.company) * wageMul(ship), morale: ship.morale,
  });
  if (out.food - out.isleFood > 0) {
    const left = Math.round(((ship.cargo.provisions ?? 0) - (out.food - out.isleFood)) * 100) / 100;
    if (left <= 0) delete ship.cargo.provisions;
    else ship.cargo.provisions = left;
  }
  if (out.silver > 0) {
    p.gold -= out.silver;
    game.db.ledger(s.accountId, 'wages', -out.silver, 'ashore');
  }
  if (out.deserted > 0) {
    ship.crew -= out.deserted;
    p.crew = ship.crew;
    reconcile(game, p.company, ship.crew);
  }
  ship.morale = out.morale;
  p.morale = out.morale;
  const view = { ...out, crew: ship.crew };
  // «Хроника»: one line of the reckoning (a[0] sea|port, a[1] hours, a[2] food, a[3] silver, a[4] deserted, a[5] short %)
  if (out.food > 0 || out.silver > 0 || out.short > 0) {
    logNote(game, s, 'upkeep', [home ? 'isle' : atSea ? 'sea' : 'port', String(Math.round(out.hours * 10) / 10), String(Math.round(out.food)), String(out.silver), String(out.deserted), String(Math.round(out.short * 100))]);
  }
  return view;
}
