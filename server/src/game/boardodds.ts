// Boarding a senior (docs/23 phase 4, owner 2026-10-06: «надо давать возможность, но открывать какое-то окно, где будет
// сказано, что скорее всего вы проиграете»). The ladder no longer forbids the grapples; instead the captain is told her
// honest chance before they fly: the boarding battle she would fight (tactical.ts sideOf — the same stacks, officers,
// heroes and ladder) is played out by the battle's own engine (tacbattle.ts quickFinish) ODDS_SIMS times, each on dice
// of its own seeded from the two ships — never the sea's — so asking changes nothing in the world and nothing in the
// battle she then fights. Below RISK_CHANCE, or with her mark RISK_GAP levels and more above her, the window shows
// what a loss costs (as Game.boardingLost takes it) and what a win over a senior brings.

import { xpGap } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import type { BoardRisk } from '../../../shared/src/protocol.ts';
import { hash2, Rng } from '../../../shared/src/rng.ts';
import { cargoValue } from '../../../shared/src/sim/shipstats.ts';
import { BOARD_LOSS_PURSE } from './Game.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import { lossesOf, newBattle, quickFinish } from './tacbattle.ts';
import { boardLen, sideOf } from './tactical.ts';

/** The battles played out for one chance (±3.5% at worst: the window's chance matches the outcomes it promises). */
export const ODDS_SIMS = 200;
/** Below this chance the window shows. */
export const RISK_CHANCE = 0.35;
/** Or with her mark this many levels (and more) above her own. */
export const RISK_GAP = 2;
/** A chance is kept (and its battles go on) this long while neither ship's fight has changed. */
const ODDS_TTL = 60;
/** What one ask may take of the server's thread when the game asks (ms; at least one battle a call): the battles go on
 *  where the last ask left them while the fight is the same. Playthrough C (owner 2026-10-12: «пройти игру … находить
 *  косяки … и сразу чинить по ходу»): 200 battles in one go held the whole server 5–24 s at level 40 — at every press
 *  of «На абордаж» and every 4 s the target frame asked. */
export const ODDS_BUDGET_MS = 12;
/** The window's ask before the grapples: a little more, on top of what the target frame has played already. */
export const RISK_BUDGET_MS = 150;

export interface Odds {
  chance: number;
  /** Men lost on average over the battles lost. */
  men: number;
  sims: number;
}

const cache = new WeakMap<ShipEntity, { key: string; at: number; won: number; lost: number; men: number; done: number }>();

/** What the battle depends on, for the cache: the two ships, their men and heart, their army. */
function keyOf(a: ShipEntity, b: ShipEntity): string {
  const army = (s: ShipEntity) => s.army.map((x) => `${x.u}${x.n}`).join(',');
  // (men, heart and hull in steps — a twentieth of her men, ten of heart, a tenth of her hull — so a volley's scratch
  // does not throw away the battles already played)
  const men = (s: ShipEntity) => Math.round(s.crew / Math.max(1, s.stats.crewMax * 0.05));
  const hull = (s: ShipEntity) => Math.round((s.hull / Math.max(1, s.stats.hullMax)) * 10);
  return `${b.id}|${men(a)}|${men(b)}|${Math.round(a.morale / 10)}|${Math.round(b.morale / 10)}|${army(a)}|${army(b)}|${hull(a)}|${hull(b)}|${a.combatLevel}|${b.combatLevel}|${b.surrendered ? 1 : 0}`;
}

/** The dice of the `k`-th battle between `a` and `b`: their own, from the two ships alone. */
export function oddsSeed(a: ShipEntity, b: ShipEntity, k: number): number {
  return (hash2(a.id, b.id, 0x0dd5 + k) % 1_000_000_000) + 1;
}

/** `a` boarding `b`: the share of `sims` battles she wins, played by the battle's engine on dice of their own — all
 *  at once, or as many as `budgetMs` allows (at least one), going on from the last ask while the fight is the same. */
export function boardOdds(game: Game, a: ShipEntity, b: ShipEntity, sims = ODDS_SIMS, budgetMs = Infinity): Odds {
  const key = keyOf(a, b);
  let c = cache.get(a);
  if (!c || c.key !== key || game.now - c.at >= ODDS_TTL || c.done > sims) c = { key, at: game.now, won: 0, lost: 0, men: 0, done: 0 };
  cache.set(a, c);
  if (c.done >= sims) return { chance: c.won / c.done, men: c.lost ? Math.round(c.men / c.lost) : 0, sims: c.done };
  const t0 = performance.now();
  const sa = sideOf(game, a, b, true), sb = sideOf(game, b, a, false);
  let won = 0, men = 0, lost = 0;
  for (let k = c.done, ran = 0; k < sims && (ran === 0 || performance.now() - t0 < budgetMs); k++, ran++) {
    const seed = oddsSeed(a, b, k);
    const rng = new Rng(seed ^ 0x7ac7);
    const bt = newBattle(structuredClone(sa), structuredClone(sb), seed, game.now, rng, { len: boardLen(a, b) }); // docs/25: as the boarding is fought
    quickFinish(bt, game.now, rng);
    if (bt.over?.winner === 0) won++;
    else {
      lost++;
      men += lossesOf(bt, 0).reduce((n, x) => n + x.n, 0);
    }
  }
  c.done += won + lost;
  c.won += won;
  c.lost += lost;
  c.men += men;
  return { chance: c.won / c.done, men: c.lost ? Math.round(c.men / c.lost) : 0, sims: c.done };
}

/** Does this boarding want the window: a slim chance, or a mark two levels up? */
export function isRisky(a: ShipEntity, b: ShipEntity, chance: number): boolean {
  return chance < RISK_CHANCE || b.combatLevel - a.combatLevel >= RISK_GAP;
}

/** The window's whole card: the chance, a loss's cost (her hold, a share of her chest, her men), a win's reward. */
export function boardRisk(game: Game, a: ShipEntity, b: ShipEntity, budgetMs = Infinity): BoardRisk {
  const odds = boardOdds(game, a, b, ODDS_SIMS, budgetMs);
  const p = game.sessionOf(a)?.profile;
  return {
    target: b.id, name: b.name, chance: odds.chance, sims: odds.sims, myLevel: a.combatLevel, theirLevel: b.combatLevel,
    cargo: Math.round(cargoValue(a.cargo)), silver: p ? Math.floor(p.gold * BOARD_LOSS_PURSE) : 0, men: Math.min(Math.max(0, a.crew - Math.max(2, Math.round(a.crew * 0.1))), odds.men), // (some always live to strike, tactical.ts sync)
    xpMul: xpGap(p?.level ?? 1, b.onLadder ? b.combatLevel : null), risky: isRisky(a, b, odds.chance), // her lesson by her level (docs/26)
  };
}
