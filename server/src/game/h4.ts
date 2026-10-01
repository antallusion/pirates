// The adventure map on the wire (docs/17 H4): the visit card's answers, the guard's offer, the Grail's puzzle and dig.

import type { H4ClientMsg } from '../../../shared/src/h4proto.ts';
import { guardChoice, sendAdv, sendCard, stepAdv, visit } from './advmap.ts';
import type { Game } from './Game.ts';
import { sendPuzzle, startDig, stepGrail } from './grail.ts';
import type { PlayerSession } from './player.ts';

export function h4Message(game: Game, s: PlayerSession, msg: H4ClientMsg): void {
  if (!s.profile || !s.ship) return;
  const err = (e: string | null) => {
    if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
  };
  switch (msg.action) {
    case 'visit':
      err(visit(game, s, String(msg.id), msg.choice === undefined ? undefined : String(msg.choice)));
      return;
    case 'guard':
      err(guardChoice(game, s, String(msg.id), String(msg.choice)));
      sendCard(game, s, true);
      return;
    case 'puzzle':
      sendAdv(game, s, true);
      return sendPuzzle(game, s);
    case 'dig':
      err(startDig(game, s));
      return sendPuzzle(game, s);
  }
}

/** Every second: the guards, what the captains see and their cards; the Grail's diggers. */
export function stepH4(game: Game): void {
  stepAdv(game);
  stepGrail(game);
}
