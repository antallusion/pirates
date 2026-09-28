// Bottle mail (docs/12 P10 #6): a captain throws a bottle with a note — and a little silver, if she likes — into the
// sea. The currents carry it (and the wind's drift where there is no current); after an hour afloat any captain who
// sails within a cable of it fishes it out: the note comes to her as a letter, and the thrower hears who found it.
// A bottle nobody finds in two weeks goes to the bottom.

import { BOTTLE_COST, BOTTLE_FIND_R, BOTTLE_MAX_NOTE, BOTTLE_MAX_SILVER, BOTTLE_MIN_AGE_MS, BOTTLE_SINK_MS } from '../../../shared/src/data/bottles.ts';
import { currentAt, isLand } from '../../../shared/src/world/worldgen.ts';
import { windAt } from '../../../shared/src/sim/wind.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';

export interface Bottle {
  id: number;
  from: string;
  account: number;
  note: string;
  silver: number;
  x: number;
  y: number;
  thrown: number;
}

interface BottleState {
  list: Bottle[];
  seq: number;
  loaded: boolean;
  dirty: boolean;
}

const states = new WeakMap<Game, BottleState>();
function bs(game: Game): BottleState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { list: [], seq: 1, loaded: false, dirty: false }));
  if (!s.loaded) {
    s.loaded = true;
    const saved = game.db.getKv<{ list: Bottle[]; seq: number }>('bottles');
    if (saved) {
      s.list = saved.list;
      s.seq = saved.seq;
    }
  }
  return s;
}

function save(game: Game): void {
  const S = bs(game);
  if (!S.dirty) return;
  S.dirty = false;
  game.db.setKv('bottles', { list: S.list, seq: S.seq });
}

/** Into the sea with it. */
export function throwBottle(game: Game, s: PlayerSession, noteRaw: string, silverRaw: number): string | null {
  const p = s.profile!, ship = s.ship;
  if (!ship || ship.docked) return 'A bottle is thrown from a ship at sea.';
  const note = String(noteRaw ?? '').replace(/[<>{}`]/g, '').replace(/\s+/g, ' ').trim().slice(0, BOTTLE_MAX_NOTE);
  if (!note) return 'Write something first.';
  const silver = Math.max(0, Math.min(BOTTLE_MAX_SILVER, Math.floor(Number(silverRaw) || 0)));
  if (p.gold < silver + BOTTLE_COST) return 'Not enough silver';
  p.gold -= silver + BOTTLE_COST;
  const S = bs(game);
  const b: Bottle = { id: S.seq++, from: s.name, account: s.accountId, note, silver, x: ship.state.x, y: ship.state.y, thrown: game.wallNow() };
  S.list.push(b);
  S.dirty = true;
  game.db.ledger(s.accountId, 'bottle', -(silver + BOTTLE_COST), String(b.id));
  game.sendTo(s, { t: 'toast', msg: 'The bottle bobs away on the current.', kind: 'info' });
  game.pushSelf(s, true);
  save(game);
  return null;
}

/** Every ten seconds: the bottles drift; a captain near an old enough one fishes it out; the oldest sink. */
export function stepBottles(game: Game, dtSec = 10): void {
  const S = bs(game);
  if (!S.list.length) return;
  const wall = game.wallNow();
  for (const b of [...S.list]) {
    if (wall - b.thrown > BOTTLE_SINK_MS) {
      S.list = S.list.filter((x) => x !== b);
      S.dirty = true;
      continue;
    }
    // The current carries it, or else a slow drift before the wind; never onto land.
    const c = currentAt(game.world.currents, b.x, b.y, game.now, game.world.whirlpools);
    const w = windAt(game.world.seed, game.now, b.x, b.y);
    const nx = b.x + (c.x + Math.sin(w.dir) * w.strength * 0.03) * dtSec;
    const ny = b.y + (c.y - Math.cos(w.dir) * w.strength * 0.03) * dtSec;
    if (!isLand(game.world, nx, ny)) {
      b.x = nx;
      b.y = ny;
    }
    if (wall - b.thrown < BOTTLE_MIN_AGE_MS) continue;
    for (const s of game.sessions) {
      const ship = s.ship;
      if (!ship || ship.docked || !ship.alive || s.accountId === b.account || !s.profile) continue;
      if (Math.hypot(ship.state.x - b.x, ship.state.y - b.y) > BOTTLE_FIND_R) continue;
      found(game, s, b);
      break;
    }
  }
  if (Math.floor(game.now) % 60 === 0) S.dirty = true;
  save(game);
}

function found(game: Game, s: PlayerSession, b: Bottle): void {
  const S = bs(game);
  S.list = S.list.filter((x) => x !== b);
  S.dirty = true;
  const days = Math.max(0, Math.floor((game.wallNow() - b.thrown) / 86_400_000));
  if (b.silver) {
    s.profile!.gold += b.silver;
    game.db.ledger(s.accountId, 'bottle_found', b.silver, String(b.id));
  }
  game.sendTo(s, { t: 'toast', msg: `A bottle in the waves! A note from ${b.from}.${b.silver ? ` Inside: ${b.silver} silver.` : ''}`, kind: 'gold' });
  deliver(game, s.accountId, { from: `Bottle: ${b.from}`, subject: 'A message in a bottle', body: b.note, gold: 0, goods: null });
  deliver(game, b.account, { from: 'The sea', subject: 'Your bottle was found', body: `Your bottle was found by ${s.name} after ${days} days afloat.`, gold: 0, goods: null });
  game.pushSelf(s, true);
}

/** The bottles afloat (the tests and the admin). */
export function bottlesAfloat(game: Game): readonly Bottle[] {
  return bs(game).list;
}
