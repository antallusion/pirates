// A ship's look (docs/12 P10 #12) on the server: what a captain has opened, the look she flies (changed in port,
// only from what is hers), and the deeds that open more.

import { DEED_UNLOCKS, DEFAULT_LOOK, STARTING_UNLOCKS, decodeLook, encodeLook } from '../../../shared/src/data/looks.ts';
import type { Look } from '../../../shared/src/data/looks.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

export function sanitizeLooks(p: Profile): { look: Look; unlocks: string[] } {
  p.look ??= { ...DEFAULT_LOOK };
  p.unlocks ??= [...STARTING_UNLOCKS];
  return { look: p.look, unlocks: p.unlocks };
}

const KIND_WORD: Record<string, string> = { sail: 'sails', hull: 'a hull paint', lamp: 'lanterns', emblem: 'an emblem', color: 'a colour', field: 'a flag field' };

/** A deed opens a part of the look (a few at random for the wonders and quests). */
export function unlockDeed(game: Game, s: PlayerSession, deed: keyof typeof DEED_UNLOCKS | string): void {
  const p = s.profile;
  if (!p) return;
  const { unlocks } = sanitizeLooks(p);
  let keys = (DEED_UNLOCKS[deed] ?? []).filter((k) => !unlocks.includes(k));
  const n = deed === 'wonders' ? 3 : deed === 'quest' ? 1 : keys.length;
  keys = [...keys].sort(() => game.rng.float() - 0.5).slice(0, n);
  for (const k of keys) {
    unlocks.push(k);
    game.sendTo(s, { t: 'toast', msg: `A new look for your ship: ${KIND_WORD[k.split(':')[0]] ?? k}.`, kind: 'gold' });
  }
}

/** She flies a new look (in port; only what is hers). */
export function setLook(game: Game, s: PlayerSession, raw: string): string | null {
  const p = s.profile!, ship = s.ship;
  if (!ship?.docked) return 'The look is changed in port.';
  const l = decodeLook(raw);
  if (!l) return 'That is not yours yet.';
  const { unlocks } = sanitizeLooks(p);
  const need = [`field:${l.field}`, `color:${l.c1}`, `color:${l.c2}`, `color:${l.c3}`, `emblem:${l.emblem}`, `hull:${l.hull}`, `sail:${l.sail}`, `lamp:${l.lamp}`];
  if (need.some((k) => !unlocks.includes(k))) return 'That is not yours yet.';
  p.look = l;
  ship.look = encodeLook(l);
  game.refreshInfo(ship);
  game.sendTo(s, { t: 'toast', msg: 'Her new colours are flown.', kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** The look a captain's ship flies (on putting to sea, on logging in). */
export function lookOf(p: Profile): string | null {
  return p.look ? encodeLook(p.look) : null;
}
