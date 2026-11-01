// The crew while the captain was away (forum post 45, shared/src/data/crewaway.ts): settled once as she comes back
// aboard (Game.sendInit, before the rest ashore is reckoned — it reads the same `ashoreAt`). At sea they ate the
// provisions; in port they drank their silver. What was short costs morale and a few deserters, written into
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

/** Back aboard: the chronicle's kept lines, then her crew's reckoning for the time away (null: nothing to settle). */
export function crewAwayOnLogin(game: Game, s: PlayerSession): (AwayCrewOut & { crew: number }) | null {
  chronicleOnLogin(game, s);
  const p = s.profile, ship = s.ship;
  if (!p || !ship || p.ashoreAt === undefined) return null;
  const atSea = !ship.docked;
  // (her ship lingered at sea a while after she went: those seconds she ate as she sailed, Game.shipUpkeep)
  const hours = Math.max(0, (game.wallNow() - p.ashoreAt) / 3_600_000 - (atSea ? LOGOUT_TIMER_SEC / 3600 : 0));
  if (hours < AWAY_SETTLE_MIN_H) return null;
  const st = ship.stats;
  const frontier = atSea && REGIONS[ship.region]?.safety === 'lawless' ? Math.max(0.5, 1 - 1.25 * tval(st, 'frontier')) : 1;
  const out = settleAwayCrew({
    hours, atSea, level: p.level, crew: ship.crew, crewMin: st.crewMin, eaters: ship.crew - creaturesAboard(ship), provisionUse: st.provisionUse * frontier,
    provisions: ship.cargo.provisions ?? 0, gold: p.gold, wagesPerHour: wagesPerHour(p.company) * wageMul(ship), morale: ship.morale,
  });
  if (out.food > 0) {
    const left = Math.round(((ship.cargo.provisions ?? 0) - out.food) * 100) / 100;
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
    logNote(game, s, 'upkeep', [atSea ? 'sea' : 'port', String(Math.round(out.hours * 10) / 10), String(Math.round(out.food)), String(out.silver), String(out.deserted), String(Math.round(out.short * 100))]);
  }
  return view;
}
