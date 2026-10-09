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
import { lairDwellView, lairRecruit, penRecruit } from './beastlairs.ts';
import { isBeast } from '../../../shared/src/data/bestiary.ts';
import { isTitan } from '../../../shared/src/data/titans.ts';
import { titanRecruit } from './titans.ts';
import { buyFitting, craftArtifact, forgeArtifact, forgeKeep, sellLand } from './landecon.ts';

export function h3Message(game: Game, s: PlayerSession, msg: H3ClientMsg): void {
  const err = (e: string | null) => {
    if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
  };
  const src = (x: unknown): 'port' | 'isle' | 'lair' => (x === 'isle' ? 'isle' : x === 'lair' ? 'lair' : 'port');
  const view = (where: 'port' | 'isle' | 'lair') => (where === 'lair' ? lairDwellView(game, s) : dwellView(game, s, where));
  const refresh = (where: 'port' | 'isle' | 'lair' | null) => {
    if (where) game.sendTo(s, { t: 'dwell', view: view(where) });
    if (where !== 'port') game.sendTo(s, { t: 'base', view: baseView(game, s) });
    if (s.ship?.docked) game.pushPort(s);
    game.pushSelf(s, true);
  };
  switch (msg.action) {
    case 'dwell':
      return void game.sendTo(s, { t: 'dwell', view: view(src(msg.src)) });
    case 'recruit': {
      // docs/18 II: the creatures of a dwelling flagged over a lair, and of the town's pen.
      const where = src(msg.src), u = String(msg.u) as UnitId, n = Math.trunc(Number(msg.n));
      err(where === 'lair' ? lairRecruit(game, s, u, n) : where === 'isle' && isTitan(u) ? titanRecruit(game, s, u) : where === 'isle' && isBeast(u) ? penRecruit(game, s, u, n) : where === 'port' ? recruit(game, s, 'port', u, n) : recruit(game, s, 'isle', u, n));
      return refresh(where);
    }
    case 'train': {
      const where = src(msg.src);
      if (where === 'lair') return refresh(where);
      err(train(game, s, where, String(msg.u) as UnitId, Math.trunc(Number(msg.n))));
      return refresh(where);
    }
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
    // docs/18 #43: the land's resources at the island's workshop, the carpenters and the market.
    case 'craft':
      err(craftArtifact(game, s, Math.trunc(Number(msg.i))));
      return refresh(null);
    case 'fit':
      err(buyFitting(game, s, String(msg.id)));
      return refresh(null);
    case 'sellres':
      err(sellLand(game, s, String(msg.r), Math.trunc(Number(msg.n))));
      return refresh(null);
    // docs/19 E13: the workshop's anvil.
    case 'forge':
      err(forgeArtifact(game, s, Math.trunc(Number(msg.uid)), String(msg.what)));
      return refresh(null);
    case 'forgekeep':
      err(forgeKeep(game, s, Math.trunc(Number(msg.uid)), String(msg.keep)));
      return refresh(null);
  }
}

/** Every five seconds: the calendar's dawns and weeks, the ports' dwellings kept. */
export function stepH3(game: Game): void {
  stepCalendar(game);
  saveDwellings(game);
}
