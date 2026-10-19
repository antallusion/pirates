// Torn sails and no sailcloth (owner, 2026-10-20: «без парусины корабль ваще не плывет, надо что-то с этим сделать.
// может какое-то самоуничтожение»). The numbers and the rules: shared/src/data/adrift.ts.
//  - The jury rig: once a second, a captain at sea whose sails are under a fifth with no sailcloth aboard has her crew
//    rig a sail of spars and hammocks — up to a quarter of her sails in a minute, for nothing; under fire they leave it
//    and go back to it when the shot stops. Each time the sails are shot away again they rig again; never above a quarter.
//  - Stranded: the sails under a fifth, no sailcloth, and lying still for 20 s or far from any harbour — her client
//    shows «Корабль без парусов» with the rig's progress and «Затопить и вернуться в порт».
//  - Her own scuttling (`scuttle_home`): out of the fight only, once in ten minutes; she goes down by the sinking's own
//    rules (Game.playerDeath: the yard's fee, a tenth of the purse, the hold, a third of the crew, half the shot, the
//    wear on her gear) and wakes at the nearest harbour that will have her.

import {
  JURY_TO, STRANDED_KN, isStranded, juryLeft, juryStep, juryWanted, scuttleWhy,
} from '../../../shared/src/data/adrift.ts';
import type { AdriftView } from '../../../shared/src/data/adrift.ts';
import { SCUTTLE_CD_MS } from '../../../shared/src/data/adrift.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { canDock } from './player.ts';
import type { ShipEntity } from './ship.ts';

interface Drift {
  rig: boolean;
  slowFor: number;
  sent: string;
}

const drift = new WeakMap<ShipEntity, Drift>();
/** Ships going down by their captain's own hand: she wakes at the nearest harbour (Game.playerDeath). */
export const scuttledHome = new WeakSet<ShipEntity>();

export const JURY_START = 'Sails shot away and no sailcloth aboard: the crew rigs a jury sail from spars and hammocks.';
export const JURY_DONE = 'The jury sail is set: a quarter of her sails. Buy sailcloth or make port for the rest.';
export const SCUTTLED = 'You open her seacocks. She goes down; the boats take you to the nearest harbour.';

/** Her rig's state (for the tests and the admin). */
export function juryRigging(ship: ShipEntity): boolean {
  return drift.get(ship)?.rig ?? false;
}

/** The nearest harbour that will have her and how far (metres). */
function friendlyPort(game: Game, s: PlayerSession, ship: ShipEntity): { id: string | null; d: number } {
  const p = s.profile!;
  const port = game.nearestPort(ship.state.x, ship.state.y, (q) => canDock(p, q.faction).ok) ?? game.nearestPort(ship.state.x, ship.state.y);
  return port ? { id: port.id, d: dist(port.x, port.y, ship.state.x, ship.state.y) } : { id: null, d: Infinity };
}

/** Once a second for each captain (Game.sessionSecond): the rig, stranded, and her view when it changed. */
export function stepAdrift(game: Game, s: PlayerSession, dt = 1): void {
  const ship = s.ship;
  if (!ship || !s.profile) return;
  let d = drift.get(ship);
  if (!d) drift.set(ship, (d = { rig: false, slowFor: 0, sent: '' }));
  const atSea = ship.alive && !ship.docked && !ship.sinkingUntil && !ship.ghost;
  let view: AdriftView | null = null;
  if (atSea) {
    const max = Math.max(1, ship.stats.sailHpMax);
    const cloth = ship.cargo.sailcloth ?? 0;
    let frac = ship.sails / max;
    const want = juryWanted(frac, cloth, d.rig);
    const paused = ship.underFire(game.now) || !!ship.boarding;
    if (want && !d.rig) {
      d.rig = true;
      game.toastShip(ship, JURY_START, 'info');
    } else if (!want && d.rig) d.rig = false; // sailcloth came aboard, or the yard or the carpenters mended her
    if (d.rig && !paused) {
      frac = juryStep(frac, dt);
      ship.sails = Math.max(ship.sails, frac * max);
      if (frac >= JURY_TO - 1e-9) {
        ship.sails = Math.max(ship.sails, JURY_TO * max);
        d.rig = false;
        game.toastShip(ship, JURY_DONE, 'good');
      }
    }
    d.slowFor = Math.abs(ship.state.speed) < STRANDED_KN ? d.slowFor + dt : 0;
    const port = friendlyPort(game, s, ship);
    const stranded = isStranded({ sails: ship.sails / max, cloth, slowFor: d.slowFor, portDist: port.d });
    if (d.rig || stranded) {
      const since = game.wallNow() - (s.profile.scuttledAt ?? 0);
      view = {
        jury: d.rig ? Math.min(1, ship.sails / max / JURY_TO) : null,
        left: d.rig ? juryLeft(ship.sails / max) : 0,
        stranded,
        paused: d.rig && paused,
        cd: Math.max(0, Math.ceil((SCUTTLE_CD_MS - since) / 1000)),
        port: port.id,
      };
    }
  } else {
    d.rig = false;
    d.slowFor = 0;
  }
  // (the progress by twentieths, the wait by minutes: a message only when something she sees changed)
  const key = view ? `${view.jury === null ? '-' : Math.round(view.jury * 20)}|${view.stranded ? 1 : 0}|${view.paused ? 1 : 0}|${Math.ceil(view.cd / 60)}|${view.port}` : '';
  if (key === d.sent) return;
  d.sent = key;
  game.sendTo(s, { t: 'adrift', v: view });
}

/** «Затопить и вернуться в порт»: why not, or she goes down by her own hand (null). */
export function scuttleHome(game: Game, s: PlayerSession): string | null {
  const ship = s.ship, p = s.profile;
  if (!ship || !p) return 'No ship';
  const why = scuttleWhy({
    docked: !!ship.docked,
    sinking: !!ship.sinkingUntil || !ship.alive,
    boarding: !!ship.boarding,
    combat: ship.inCombat(game.now) || ship.underFire(game.now),
    landing: !!ship.landing,
    sinceMs: game.wallNow() - (p.scuttledAt ?? 0),
  });
  if (why) return why;
  p.scuttledAt = game.wallNow();
  scuttledHome.add(ship);
  game.toastShip(ship, SCUTTLED, 'bad');
  ship.hull = 0;
  game.beginSinking(ship);
  return null;
}
