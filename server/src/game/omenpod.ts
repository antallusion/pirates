// Good omens alongside (docs/16 #9). Now and then, among the sea's small things, a school of dolphins takes station
// at the bow, a humpback swims abeam or a pod of orcas runs in the wake — the peaceful kin of the beasts (they are
// drawn beside the ship like the orca calves, never hunted). While they keep with her the crew take heart (+morale,
// a point every few seconds up to a limit) and the ship runs a little freer (+speed). They stay two or three
// minutes, and go at once when the guns speak, she is fired on or she makes port.

import type { PodKind } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isNight } from '../../../shared/src/constants.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

export interface PodDef {
  /** Speed while they swim alongside (a share of the maximum). */
  speed: number;
  /** Morale they give in all, a point every `every` seconds. */
  morale: number;
  every: number;
  /** How long they keep with her, seconds. */
  stay: [number, number];
  weight: number;
}

export const PODS: Record<PodKind, PodDef> = {
  dolphins: { speed: 0.06, morale: 8, every: 12, stay: [120, 180], weight: 6 },
  humpback: { speed: 0.04, morale: 10, every: 15, stay: [150, 210], weight: 3 },
  orcas: { speed: 0.05, morale: 6, every: 15, stay: [100, 150], weight: 1 },
};

/** Of the sea's small things (sealife.ts), this share is a good omen alongside. */
export const POD_CHANCE = 0.1;

const JOIN: Record<PodKind, string> = {
  dolphins: 'Dolphins run alongside — a good omen.',
  humpback: 'A humpback swims alongside — a good omen.',
  orcas: 'Orcas run in your wake — a good omen.',
};
const LEAVE: Record<PodKind, string> = {
  dolphins: 'The dolphins dive and are gone.',
  humpback: 'The humpback sounds and is gone.',
  orcas: 'The orcas turn away into the deep.',
};
const SCARED: Record<PodKind, string> = {
  dolphins: 'The guns scare the dolphins off.',
  humpback: 'The guns scare the humpback off.',
  orcas: 'The guns scare the orcas off.',
};

interface Pod {
  kind: PodKind;
  ship: number;
  until: number;
  given: number;
  nextMorale: number;
}

const states = new WeakMap<Game, Map<number, Pod>>();

function pods(game: Game): Map<number, Pod> {
  let m = states.get(game);
  if (!m) states.set(game, (m = new Map()));
  return m;
}

export function effectId(kind: PodKind): string {
  return `omen_pod_${kind}`;
}

/** Which kin come to her here: no dolphins by night, none of them in the strange deeps. */
function pickKind(game: Game, s: PlayerSession): PodKind | null {
  const ship = s.ship!;
  const r = REGIONS[ship.region];
  if (ship.region === 'the_abyss' || r.strangeness >= 0.5) return null;
  const kinds = (Object.keys(PODS) as PodKind[]).filter((k) => !(k === 'dolphins' && isNight(game.now)));
  return game.rng.weighted(kinds.map((k) => [k, PODS[k].weight] as [PodKind, number]));
}

/** A pod joins her (or `kind`, for the admin and the tests). False when none would come here or now. */
export function podJoins(game: Game, s: PlayerSession, kind?: PodKind): boolean {
  const ship = s.ship;
  if (!ship || !s.profile || ship.docked || !ship.alive || ship.ghost || ship.inCombat(game.now)) return false;
  const P = pods(game);
  if (P.has(s.accountId)) return false;
  const k = kind ?? pickKind(game, s);
  if (!k) return false;
  const d = PODS[k];
  const until = game.now + game.rng.range(d.stay[0], d.stay[1]);
  P.set(s.accountId, { kind: k, ship: ship.id, until, given: 1, nextMorale: game.now + d.every });
  ship.effects = ship.effects.filter((e) => !e.id.startsWith('omen_pod_'));
  ship.addEffect({ id: effectId(k), until, mods: { maxSpeed: d.speed } }, game.now);
  ship.morale = Math.min(100, ship.morale + 1);
  game.sendTo(s, { t: 'toast', msg: JOIN[k], kind: 'good' });
  game.pushSelf(s, true);
  return true;
}

function part(game: Game, s: PlayerSession, p: Pod, msg: string | null): void {
  pods(game).delete(s.accountId);
  const ship = game.ships.get(p.ship);
  if (ship) {
    ship.effects = ship.effects.filter((e) => e.id !== effectId(p.kind));
    ship.recompute(game.now);
  }
  if (msg) game.sendTo(s, { t: 'toast', msg, kind: 'info' });
  game.pushSelf(s, true);
}

/** Every second: the pods keep with their ships, cheer the crews, and go. */
export function stepPods(game: Game): void {
  const P = pods(game);
  if (!P.size) return;
  for (const [acc, p] of [...P]) {
    const s = game.sessionByAccount(acc);
    const ship = s?.ship;
    if (!s || !ship || ship.id !== p.ship || !ship.alive || ship.docked) {
      if (s) part(game, s, p, null);
      else P.delete(acc);
      continue;
    }
    if (ship.inCombat(game.now)) {
      part(game, s, p, SCARED[p.kind]);
      continue;
    }
    if (game.now >= p.until) {
      part(game, s, p, LEAVE[p.kind]);
      continue;
    }
    const d = PODS[p.kind];
    if (game.now >= p.nextMorale && p.given < d.morale) {
      p.nextMorale = game.now + d.every;
      p.given++;
      ship.morale = Math.min(100, ship.morale + 1);
    }
  }
}

/** The pod swimming beside a ship, if any (for the sea's view of her). */
export function podOfShip(game: Game, shipId: number): PodKind | undefined {
  for (const p of pods(game).values()) if (p.ship === shipId) return p.kind;
  return undefined;
}

/** Tests: a captain's pod. */
export function podOf(game: Game, accountId: number): Readonly<Pod> | undefined {
  return pods(game).get(accountId);
}
