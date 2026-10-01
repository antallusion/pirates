// The Atlas of Sea Wonders (docs/12 P10 #8). A captain who sails within 600 m of a wonder finds it (her atlas grows,
// experience); the first on the server to find one names it for everyone (and a purse of silver). Every ten found:
// a pennant colour; the first ten, the Compass Rose tattoo. The wonders near her ship are sent to be drawn.

import { unlockDeed } from './looks.ts';
import { legacyIslands } from '../../../shared/src/world/worldgen.ts';
import { WONDER_NAME_RE, WONDER_PENNANTS, WONDER_R, placeWonders } from '../../../shared/src/data/wonders.ts';
import type { WonderDef } from '../../../shared/src/data/wonders.ts';
import type { WondersView } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { tattooCount } from './tattoos.ts';
import { sagaNote } from './saga.ts';

interface Rec {
  first: string;
  account: number;
  named: string | null;
  at: number;
}

const NEAR_R = 9000;
const cache = new WeakMap<Game, WonderDef[]>();

export function wondersOf(game: Game): WonderDef[] {
  let w = cache.get(game);
  if (!w) cache.set(game, (w = placeWonders(game.world.seed, legacyIslands(game.world))));
  return w;
}

function records(game: Game): Record<string, Rec> {
  return game.db.getKv<Record<string, Rec>>('wonders') ?? {};
}

/** A wonder's name as the server says it: the finder's, or its kind's off its island. */
export function wonderName(game: Game, w: WonderDef): string {
  return records(game)[w.id]?.named ?? w.name[0];
}

function discover(game: Game, s: PlayerSession, w: WonderDef): void {
  const p = s.profile!;
  p.wonders ??= [];
  p.wonders.push(w.id);
  const recs = records(game);
  game.sendTo(s, { t: 'toast', msg: `A wonder of the sea: ${wonderName(game, w)}.`, kind: 'gold' });
  sagaNote(game, s, 'wonder', [wonderName(game, w)]);
  game.grantXp(s, 250, null);
  if (!recs[w.id]) {
    recs[w.id] = { first: s.name, account: s.accountId, named: null, at: game.wallNow() };
    game.db.setKv('wonders', recs);
    p.gold += 500;
    game.db.ledger(s.accountId, 'wonder_first', 500, w.id);
    game.grantXp(s, 500, null);
    game.sendTo(s, { t: 'toast', msg: 'You are the first to find it! Name it in the journal’s atlas.', kind: 'gold' });
  }
  if (p.wonders.length % 10 === 0) {
    const colour = WONDER_PENNANTS[Math.min(WONDER_PENNANTS.length - 1, p.wonders.length / 10 - 1)];
    if (!p.pennants.includes(colour)) p.pennants.push(colour);
    game.sendTo(s, { t: 'toast', msg: `Wonders found: ${p.wonders.length}. A new pennant colour.`, kind: 'gold' });
    unlockDeed(game, s, 'wonders');
  }
  tattooCount(game, s, 'wonders', 0); // the Compass Rose at ten (docs/12 P9)
  sendWonders(game, s, true);
}

/** Every five seconds: the wonders within sight of a captain at sea. */
export function stepWonders(game: Game): void {
  const all = wondersOf(game);
  for (const s of game.sessions) {
    const ship = s.ship, p = s.profile;
    if (!ship || !p || ship.docked || !ship.alive) continue;
    const found = new Set(p.wonders ?? []);
    for (const w of all) {
      if (found.has(w.id)) continue;
      if (Math.abs(w.x - ship.state.x) > WONDER_R || Math.abs(w.y - ship.state.y) > WONDER_R) continue;
      if (Math.hypot(w.x - ship.state.x, w.y - ship.state.y) <= WONDER_R) discover(game, s, w);
    }
    sendWonders(game, s);
  }
}

/** The first finder names it (once), for the whole server. */
export function nameWonder(game: Game, s: PlayerSession, id: string, nameRaw: string): string | null {
  const w = wondersOf(game).find((x) => x.id === id);
  const recs = records(game);
  const r = recs[id];
  if (!w || !r || r.account !== s.accountId) return 'Only its first finder names a wonder.';
  if (r.named) return 'That wonder is named already.';
  const name = String(nameRaw ?? '').trim().replace(/\s+/g, ' ');
  if (!WONDER_NAME_RE.test(name)) return 'Three to twenty-four letters, spaces or apostrophes';
  r.named = name;
  game.db.setKv('wonders', recs);
  for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} names a wonder of the sea: ${name}.`, kind: 'info' });
  sendWonders(game, s, true);
  return null;
}

export function wondersView(game: Game, s: PlayerSession): WondersView {
  const p = s.profile!;
  const recs = records(game);
  const ship = s.ship;
  const byId = new Map(wondersOf(game).map((w) => [w.id, w]));
  return {
    total: wondersOf(game).length,
    found: (p.wonders ?? []).map((id) => byId.get(id)!).filter(Boolean).map((w) => ({ id: w.id, kind: w.kind, name: wonderName(game, w), region: w.region, x: w.x, y: w.y, first: recs[w.id]?.first ?? null, canName: recs[w.id]?.account === s.accountId && !recs[w.id]?.named })),
    near: ship ? wondersOf(game).filter((w) => Math.abs(w.x - ship.state.x) < NEAR_R && Math.abs(w.y - ship.state.y) < NEAR_R).map((w) => ({ id: w.id, kind: w.kind, x: w.x, y: w.y })) : [],
  };
}

const sent = new WeakMap<PlayerSession, string>();
export function sendWonders(game: Game, s: PlayerSession, force = false): void {
  if (!s.profile) return;
  const v = wondersView(game, s);
  const key = `${v.found.length}|${v.found.filter((f) => f.canName).length}|${v.near.map((n) => n.id).join(',')}|${v.found.map((f) => f.name).join('|').length}`;
  if (!force && sent.get(s) === key) return;
  sent.set(s, key);
  game.sendTo(s, { t: 'wonders', view: v });
}
