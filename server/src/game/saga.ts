// A captain's saga (docs/12 P10 #20) on the server: a chapter noted when she does something worth the telling (the day
// of her voyages or of the holiday then on, what, where), kept with her; a chapter shared in the chat as a postcard.

import { worldSay } from './chat.ts';
import { SAGA_MAX, SHARE_EVERY_SEC } from '../../../shared/src/data/saga.ts';
import type { SagaEntry, SagaKind } from '../../../shared/src/data/saga.ts';
import type { Game } from './Game.ts';
import { currentHoliday } from './holidays.ts';
import type { PlayerSession } from './player.ts';
import { logNote, voyageDay } from './captainlog.ts';

const shared = new WeakMap<PlayerSession, number>();

/** A chapter of her saga. */
export function sagaNote(game: Game, s: PlayerSession, kind: SagaKind, a: string[] = [], n?: number): void {
  const p = s.profile;
  if (!p) return;
  const h = currentHoliday(game);
  const now = game.wallNow();
  const day = h ? Math.floor((now - h.start) / 86_400_000) + 1 : voyageDay(game, p.createdAt);
  p.saga ??= [];
  const id = (p.saga.at(-1)?.id ?? 0) + 1;
  const e: SagaEntry = { id, at: now, day, holiday: h?.id ?? null, kind, a, ...(n !== undefined ? { n } : {}) };
  p.saga.push(e);
  if (p.saga.length > SAGA_MAX) p.saga.splice(0, p.saga.length - SAGA_MAX);
  logNote(game, s, 'saga', [kind, ...a], n); // the day's great moment in her log too (docs/16 #20)
  game.sendTo(s, { t: 'toast', msg: 'A new chapter of your saga.', kind: 'info' });
  game.pushSelf(s, true);
}

/** She shares a chapter in the chat: a postcard for everyone, with its picture and her flag. */
export function shareSaga(game: Game, s: PlayerSession, id: number): string | null {
  const p = s.profile!;
  const e = (p.saga ?? []).find((x) => x.id === id);
  if (!e) return 'No such chapter.';
  const last = shared.get(s) ?? -Infinity;
  if (game.now - last < SHARE_EVERY_SEC) return 'Wait a little before sharing another chapter.';
  shared.set(s, game.now);
  const card = { name: s.name, entry: e, flag: p.look?.emblem ?? null };
  // into the world's channel (docs/28): kept in its history, heard in every zone
  return worldSay(game, s, '', card);
}
