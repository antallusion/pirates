// Signal flags on the server (docs/16 #35): a quick word to one's group — follow me, attacking, need help, regroup,
// treasure here — hoisted at her own ship and shown to every groupmate as a flag and a ping on the chart and the
// minimap, with a short toast. A captain hoists at most five in thirty seconds, never two within two.

import { SIGNALS, SIGNAL_WINDOW, signalAllowed } from '../../../shared/src/data/social.ts';
import type { SignalKind } from '../../../shared/src/data/social.ts';
import type { Game } from './Game.ts';
import { ignores } from './friends.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';

export function sendSignal(game: Game, s: PlayerSession, kind: SignalKind): string | null {
  if (!SIGNALS.includes(kind)) return 'Unknown signal';
  const g = groupOfAccount(game, s.accountId);
  if (!g) return 'You sail alone: there is no one to signal';
  const ship = s.ship;
  if (!ship || !ship.alive) return 'Both ships must be afloat';
  if (ship.docked) return 'Signal flags are for the open sea';
  const times = (game.social.signals.get(s.accountId) ?? []).filter((t) => game.now - t < SIGNAL_WINDOW);
  if (!signalAllowed(times, game.now)) return 'The signal halyard is still busy: wait a moment';
  times.push(game.now);
  game.social.signals.set(s.accountId, times);
  const x = Math.round(ship.state.x), y = Math.round(ship.state.y);
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (!ms || ms.disconnectedAt !== null) continue;
    if (ms !== s && ignores(ms, s.accountId)) continue;
    game.sendTo(ms, { t: 'signal', from: s.name, kind, x, y });
  }
  return null;
}
