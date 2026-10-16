// Owner, 2026-10-16 («Журнал боя и повтор»): a boarding kept to be played again. After a fight between two captains, or
// one that matters (a legend, the raid, a citadel, a trial, the Colosseum, an elite ship of the sea), each captain at
// the helm keeps its record — what the battle was laid out from and every hand on it (tacbattle.ts TacRec) — among her
// last REPLAY_KEEP; a record past REPLAY_MAX characters is not kept. «Повтор» on the end screen asks for it: the server
// plays it again on its own dice (the same battle, blow for blow) and sends the field as it opened and each step after.

import type { Game } from './Game.ts';
import type { ServerMsg, TacReplayFrame, TacView } from '../../../shared/src/protocol.ts';
import { battleWhy, lossesOf, recFromJson, recToJson, replayBattle, replayFrame, viewOf } from './tacbattle.ts';
import type { TacBattle, TacRec } from './tacbattle.ts';

/** How many fights a captain keeps, the longest record kept (characters), the most steps a replay sends. */
export const REPLAY_KEEP = 20;
export const REPLAY_MAX = 120_000;
export const REPLAY_FRAMES = 1500;

export interface ReplayMeta {
  id: string;
  slot: number;
  at: number;
  vs: string;
  won: boolean;
  pvp: boolean;
  side: 0 | 1;
  /** Rounds it ran. */
  rounds?: number;
}
interface ReplayIndex {
  n: number;
  list: ReplayMeta[];
}

const indexKey = (acc: number) => `tacrep:${acc}`;
const itemKey = (acc: number, slot: number) => `tacrep:${acc}:${slot}`;

/** Her last fights kept, the newest first. */
export function replayList(game: Game, acc: number): ReplayMeta[] {
  return [...(game.db.getKv<ReplayIndex>(indexKey(acc))?.list ?? [])].sort((a, b) => b.at - a.at);
}

/** Keep a battle's record for captain `acc` (who fought on `side`): its id, or null when it is too long to keep. The
 *  oldest of her twenty gives up its place. */
export function keepReplay(game: Game, acc: number, rec: TacRec, meta: { side: 0 | 1; vs: string; won: boolean; pvp: boolean; rounds?: number }): string | null {
  const text = recToJson(rec);
  if (text.length > REPLAY_MAX) return null;
  const idx = game.db.getKv<ReplayIndex>(indexKey(acc)) ?? { n: 0, list: [] };
  const n = idx.n + 1;
  const slot = n % REPLAY_KEEP;
  const id = String(n);
  game.db.setKv(itemKey(acc, slot), text);
  const list = idx.list.filter((x) => x.slot !== slot);
  list.push({ id, slot, at: game.wallNow(), vs: meta.vs, won: meta.won, pvp: meta.pvp, side: meta.side, ...(meta.rounds ? { rounds: meta.rounds } : {}) });
  game.db.setKv(indexKey(acc), { n, list: list.slice(-REPLAY_KEEP) });
  return id;
}

/** A kept fight as the screen plays it again: the field as round one opens (the side she fought on), each step after,
 *  and the reckoning at its end in the view. */
export function replayOf(game: Game, acc: number, id: string): Extract<ServerMsg, { t: 'tac_replay' }> {
  const meta = replayList(game, acc).find((x) => x.id === id);
  const text = meta ? game.db.getKv<string>(itemKey(acc, meta.slot)) : undefined;
  const rec = text ? recFromJson(text) : null;
  if (!meta || !rec) return { t: 'tac_replay', error: 'That fight is no longer kept' };
  return { t: 'tac_replay', ...replayFrames(rec, meta.side) };
}

/** The frames of a record played again (tests: the same battle, step by step). */
export function replayFrames(rec: TacRec, side: 0 | 1): { base: TacView; frames: TacReplayFrame[] } {
  let base: TacView | null = null;
  let seen = 0;
  const frames: TacReplayFrame[] = [];
  const open = (bt: TacBattle) => {
    base = viewOf(bt, side, 0, false, { canStrike: false });
    base.log = [];
    base.replay = true;
    seen = bt.events;
  };
  const end = replayBattle(rec, (bt) => {
    if (bt.deploy) return;
    if (!base) return open(bt);
    if (frames.length >= REPLAY_FRAMES) return;
    frames.push(replayFrame(bt, seen));
    seen = bt.events;
  }, (bt) => {
    if (!bt.deploy) open(bt);
  });
  if (!base) open(end);
  const b = base as unknown as TacView;
  b.result = { lost: lossesOf(end, side, 0), killed: lossesOf(end, (1 - side) as 0 | 1), xp: 0, why: battleWhy(end) };
  return { base: b, frames };
}
