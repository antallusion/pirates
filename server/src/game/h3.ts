// The Heroes' economy on the wire (docs/17 H3): the recruit window, the island's town, its market, the mines' chart.

import type { UnitId } from '../../../shared/src/data/army.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { H3ClientMsg } from '../../../shared/src/h3proto.ts';
import { baseView } from './base.ts';
import { stepCalendar } from './calendar.ts';
import { dwellView, recruit, saveDwellings, train } from './dwell.ts';
import type { Game } from './Game.ts';
import { minesView } from './mines.ts';
import type { PlayerSession } from './player.ts';
import { buildTown, learnAtIsle, marketTrade } from './town.ts';

export function h3Message(game: Game, s: PlayerSession, msg: H3ClientMsg): void {
  const err = (e: string | null) => {
    if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
  };
  const src = (x: unknown): 'port' | 'isle' => (x === 'isle' ? 'isle' : 'port');
  const refresh = (where: 'port' | 'isle' | null) => {
    if (where) game.sendTo(s, { t: 'dwell', view: dwellView(game, s, where) });
    if (where !== 'port') game.sendTo(s, { t: 'base', view: baseView(game, s) });
    if (s.ship?.docked) game.pushPort(s);
    game.pushSelf(s, true);
  };
  switch (msg.action) {
    case 'dwell':
      return void game.sendTo(s, { t: 'dwell', view: dwellView(game, s, src(msg.src)) });
    case 'recruit':
      err(recruit(game, s, src(msg.src), String(msg.u) as UnitId, Math.trunc(Number(msg.n))));
      return refresh(src(msg.src));
    case 'train':
      err(train(game, s, src(msg.src), String(msg.u) as UnitId, Math.trunc(Number(msg.n))));
      return refresh(src(msg.src));
    case 'build':
      err(buildTown(game, s, String(msg.id) as TownId));
      return refresh(null);
    case 'learn':
      err(learnAtIsle(game, s, String(msg.id)));
      return refresh(null);
    case 'market':
      err(marketTrade(game, s, String(msg.give) as GoodId | 'silver', String(msg.get) as GoodId | 'silver', Math.trunc(Number(msg.n))));
      return refresh(null);
    case 'mines':
      return void game.sendTo(s, { t: 'mines', list: minesView(game, s) });
  }
}

/** Every five seconds: the calendar's dawns and weeks, the ports' dwellings kept. */
export function stepH3(game: Game): void {
  stepCalendar(game);
  saveDwellings(game);
}
