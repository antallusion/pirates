// Boarding a senior (docs/23 phase 4, owner 2026-10-06: «надо давать возможность, но открывать какое-то окно, где будет
// сказано, что скорее всего вы проиграете»). The ladder no longer forbids the grapples; instead the captain is told her
// honest chance before they fly: the boarding battle she would fight (tactical.ts sideOf — the same stacks, officers,
// heroes and ladder) is played out by the battle's own engine (tacbattle.ts quickFinish) ODDS_SIMS times, each on dice
// of its own seeded from the two ships — never the sea's — so asking changes nothing in the world and nothing in the
// battle she then fights. Below RISK_CHANCE, or with her mark RISK_GAP levels and more above her, the window shows
// what a loss costs (as Game.boardingLost takes it) and what a win over a senior brings.

import { xpForGap } from '../../../shared/src/data/shiplevel.ts';
import type { BoardRisk } from '../../../shared/src/protocol.ts';
import { hash2, Rng } from '../../../shared/src/rng.ts';
import { cargoValue } from '../../../shared/src/sim/shipstats.ts';
import { BOARD_LOSS_PURSE } from './Game.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import { lossesOf, newBattle, quickFinish } from './tacbattle.ts';
import { sideOf } from './tactical.ts';

/** The battles played out for one chance (±3.5% at worst: the window's chance matches the outcomes it promises). */
export const ODDS_SIMS = 200;
/** Below this chance the window shows. */
export const RISK_CHANCE = 0.35;
/** Or with her mark this many levels (and more) above her own. */
export const RISK_GAP = 2;
/** A chance is kept this long while neither ship's fight has changed. */
const ODDS_TTL = 8;

export interface Odds {
  chance: number;
  /** Men lost on average over the battles lost. */
  men: number;
  sims: number;
}

const cache = new WeakMap<ShipEntity, { key: string; at: number; odds: Odds }>();

/** What the battle depends on, for the cache: the two ships, their men and heart, their army. */
function keyOf(a: ShipEntity, b: ShipEntity): string {
  const army = (s: ShipEntity) => s.army.map((x) => `${x.u}${x.n}`).join(',');
  return `${b.id}|${a.crew}|${b.crew}|${Math.round(a.morale)}|${Math.round(b.morale)}|${army(a)}|${army(b)}|${Math.round(a.hull / 50)}|${Math.round(b.hull / 50)}|${a.combatLevel}|${b.combatLevel}|${b.surrendered ? 1 : 0}`;
}

/** The dice of the `k`-th battle between `a` and `b`: their own, from the two ships alone. */
export function oddsSeed(a: ShipEntity, b: ShipEntity, k: number): number {
  return (hash2(a.id, b.id, 0x0dd5 + k) % 1_000_000_000) + 1;
}

/** `a` boarding `b`: the share of `sims` battles she wins, played by the battle's engine on dice of their own. */
export function boardOdds(game: Game, a: ShipEntity, b: ShipEntity, sims = ODDS_SIMS): Odds {
  const key = keyOf(a, b);
  const hit = cache.get(a);
  if (hit && hit.key === key && game.now - hit.at < ODDS_TTL && hit.odds.sims === sims) return hit.odds;
  const sa = sideOf(game, a, b, true), sb = sideOf(game, b, a, false);
  let won = 0, men = 0, lost = 0;
  for (let k = 0; k < sims; k++) {
    const seed = oddsSeed(a, b, k);
    const rng = new Rng(seed ^ 0x7ac7);
    const bt = newBattle(structuredClone(sa), structuredClone(sb), seed, game.now, rng);
    quickFinish(bt, game.now, rng);
    if (bt.over?.winner === 0) won++;
    else {
      lost++;
      men += lossesOf(bt, 0).reduce((n, x) => n + x.n, 0);
    }
  }
  const odds: Odds = { chance: won / sims, men: lost ? Math.round(men / lost) : 0, sims };
  cache.set(a, { key, at: game.now, odds });
  return odds;
}

/** Does this boarding want the window: a slim chance, or a mark two levels up? */
export function isRisky(a: ShipEntity, b: ShipEntity, chance: number): boolean {
  return chance < RISK_CHANCE || b.combatLevel - a.combatLevel >= RISK_GAP;
}

/** The window's whole card: the chance, a loss's cost (her hold, a share of her chest, her men), a win's reward. */
export function boardRisk(game: Game, a: ShipEntity, b: ShipEntity): BoardRisk {
  const odds = boardOdds(game, a, b);
  const p = game.sessionOf(a)?.profile;
  const gap = b.combatLevel - a.combatLevel;
  return {
    target: b.id, name: b.name, chance: odds.chance, sims: odds.sims, myLevel: a.combatLevel, theirLevel: b.combatLevel,
    cargo: Math.round(cargoValue(a.cargo)), silver: p ? Math.floor(p.gold * BOARD_LOSS_PURSE) : 0, men: Math.min(a.crew, odds.men),
    xpMul: xpForGap(gap), risky: isRisky(a, b, odds.chance),
  };
}
