// Crew with fates (docs/12 P10 #11) on the server: pasts for the officers; their requests (made every couple of game
// days, kept three) and what keeping or forgetting them does to loyalty; love in a port, the merry evenings there,
// and pining when the ship stays away.

import { DAY_LENGTH_SEC } from '../../../shared/src/constants.ts';
import { LOVERS, LOVE_PINE_DAYS, PASTS, REQUEST_EVERY_DAYS, REQUEST_KINDS, REQUEST_LASTS_DAYS } from '../../../shared/src/data/fates.ts';
import type { OfficerFate } from '../../../shared/src/data/fates.ts';
import type { Officer } from '../../../shared/src/data/crew.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

function fateOf(game: Game, o: Officer): OfficerFate {
  if (!o.fate) {
    let h = 0;
    for (const ch of o.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    o.fate = { past: h % PASTS.length, request: null, lastAsk: game.now, love: null, pinedAt: game.now };
  }
  return o.fate;
}

function loyal(o: Officer, d: number): void {
  o.loyalty = Math.max(0, Math.min(100, o.loyalty + d));
}

function ask(game: Game, s: PlayerSession, o: Officer, f: OfficerFate): void {
  const ship = s.ship!;
  const kind = REQUEST_KINDS[game.rng.int(0, REQUEST_KINDS.length - 1)];
  const near = game.world.ports.filter((p) => !p.id.includes('_v')).sort((a, b) => Math.hypot(a.x - ship.state.x, a.y - ship.state.y) - Math.hypot(b.x - ship.state.x, b.y - ship.state.y)).slice(0, 8);
  const port = near[game.rng.int(0, Math.max(0, near.length - 1))];
  const isles = game.world.islands.filter((is) => !is.portId && !is.minor && !is.hidden && is.region === ship.region);
  const island = isles.length ? isles[game.rng.int(0, isles.length - 1)] : undefined;
  const until = game.now + REQUEST_LASTS_DAYS * DAY_LENGTH_SEC;
  if (kind === 'grave' && island) f.request = { kind, island: island.id, until };
  else if (kind === 'brother') f.request = { kind, port: port?.id, n: game.rng.int(4, 16) * 50, until };
  else if (kind === 'debt') f.request = { kind, port: port?.id, n: game.rng.int(6, 24) * 50, until };
  else if (kind === 'letter') f.request = { kind: 'letter', port: port?.id, until };
  else f.request = { kind: 'rum', until };
  f.lastAsk = game.now;
  game.sendTo(s, { t: 'toast', msg: `${o.name} has a favour to ask. (Crew window.)`, kind: 'info' });
}

function done(game: Game, s: PlayerSession, o: Officer, f: OfficerFate): void {
  f.request = null;
  loyal(o, 25);
  game.sendTo(s, { t: 'toast', msg: `${o.name} will not forget this.`, kind: 'good' });
  game.pushSelf(s, true);
}

/** Every thirty seconds: requests made and forgotten, pining for a love left too long. */
export function stepFates(game: Game): void {
  for (const s of game.sessions) {
    const p = s.profile, ship = s.ship;
    if (!p || !ship) continue;
    for (const o of p.company.officers) {
      const f = fateOf(game, o);
      if (f.request && game.now > f.request.until) {
        f.request = null;
        loyal(o, -10);
        game.sendTo(s, { t: 'toast', msg: `${o.name} is hurt: the favour was forgotten.`, kind: 'bad' });
      }
      if (!f.request && o.loyalty >= 30 && game.now - f.lastAsk > REQUEST_EVERY_DAYS * DAY_LENGTH_SEC && game.rng.chance(0.08)) ask(game, s, o, f);
      if (f.love && game.now - f.love.seen > LOVE_PINE_DAYS * DAY_LENGTH_SEC && game.now - f.pinedAt > DAY_LENGTH_SEC) {
        f.pinedAt = game.now;
        loyal(o, -3);
        const port = game.portById(f.love.port);
        game.sendTo(s, { t: 'toast', msg: `${o.name} pines for ${f.love.name} of ${port?.name ?? f.love.port}.`, kind: 'bad' });
      }
    }
  }
}

/** In port: a letter delivered, rum for the lads, an evening ashore with a love — or a new love. */
export function fatesOnDock(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!, ship = s.ship!;
  for (const o of p.company.officers) {
    const f = fateOf(game, o);
    const r = f.request;
    if (r?.kind === 'letter' && r.port === port.id) done(game, s, o, f);
    else if (r?.kind === 'rum' && (ship.cargo.rum ?? 0) >= 5) {
      ship.cargo.rum = (ship.cargo.rum ?? 0) - 5;
      if (!ship.cargo.rum) delete ship.cargo.rum;
      ship.morale = Math.min(100, ship.morale + 8);
      done(game, s, o, f);
    }
    if (f.love?.port === port.id) {
      f.love.seen = game.now;
      loyal(o, 2);
      ship.morale = Math.min(100, ship.morale + 5);
      game.sendTo(s, { t: 'toast', msg: `${o.name} is ashore with ${f.love.name} tonight: the whole ship is merrier.`, kind: 'good' });
    } else if (!f.love && game.rng.chance(0.03)) {
      f.love = { port: port.id, name: LOVERS[game.rng.int(0, LOVERS.length - 1)], seen: game.now };
      game.sendTo(s, { t: 'toast', msg: `${o.name} has given their heart to ${f.love.name} of ${port.name}.`, kind: 'info' });
    }
  }
}

/** Ashore: an old captain's grave visited. */
export function fatesOnLand(game: Game, s: PlayerSession, island: number): void {
  for (const o of s.profile!.company.officers) {
    const f = fateOf(game, o);
    if (f.request?.kind === 'grave' && f.request.island === island) done(game, s, o, f);
  }
}

/** A fine or a debt paid in its port. */
export function fulfilRequest(game: Game, s: PlayerSession, id: string): string | null {
  const p = s.profile!, ship = s.ship!;
  const o = p.company.officers.find((x) => x.id === id);
  if (!o) return 'Nothing to do for that one.';
  const f = fateOf(game, o);
  const r = f.request;
  if (!r || (r.kind !== 'brother' && r.kind !== 'debt')) return 'Nothing to do for that one.';
  if (ship.docked !== r.port) return 'Not here.';
  if (p.gold < (r.n ?? 0)) return 'Not enough silver';
  p.gold -= r.n ?? 0;
  game.db.ledger(s.accountId, `officer_${r.kind}`, -(r.n ?? 0), o.id);
  done(game, s, o, f);
  return null;
}

/** The fate as the crew window shows it. */
export function fateView(game: Game, o: Officer): { past: number; request: OfficerFate['request']; love: { port: string; name: string } | null } {
  const f = fateOf(game, o);
  return { past: f.past, request: f.request ? { ...f.request } : null, love: f.love ? { port: f.love.port, name: f.love.name } : null };
}
