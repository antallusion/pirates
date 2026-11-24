// docs/40 §7: the Blighted Sea's balance run — a reference ⚓10 captain against the hunters of tiers I–VIII.
//
// What is measured, with the sea bench's own tools (seakit.ts: `captainShip` — a ⚓10 warship of the line with a level's
// talents and hero, bare or in full gear with her captain's kit on; `underway` — two ships under way from 900 m, each
// fought by the sea's fighting mind, broadsides only, until one is down):
//  - a tier's hunters as blight.ts makes them (`blightHunterAt`: ⚓8 / ⚓9 / ⚓10, then a ⚓10 ship with more hull and
//    guns), as many as the tier keeps on her (hunterSpec.n);
//  - a run is won when she has sunk them all one after another WITHOUT mending between them (in the live sea the next
//    one puts out 25 s after the last and they may overlap, a captain mends with her crew and her abilities, and she
//    may leave across the rim at any moment: the bench is the stricter single-file case with no repair);
//  - the share of runs won, her hull left at the end of a won run, and the seconds a run took.
// Not measured here: boarding (a hunter may be taken, and may board), other captains, the Heart, the island's bonuses.
//
// Run it:  node --disable-warning=ExperimentalWarning tests/balance/blight.ts [runs]

import { hunterSpec } from '../../shared/src/data/blight.ts';
import { blightHunterAt } from '../../server/src/game/blight.ts';
import type { Game } from '../../server/src/game/Game.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { bench, captainShip, restore, underway } from './seakit.ts';
import type { Gear } from './seakit.ts';

export interface BlightRow {
  tier: number;
  anchor: number;
  hunters: number;
  hull: number;
  guns: number;
  /** Runs won of `runs`; her hull left after a won run (mean share); seconds a run took (mean). */
  wins: number;
  runs: number;
  left: number;
  sec: number;
}

/** One run: the tier's hunters one after another, no mending between. */
export function blightRun(game: Game, cap: ShipEntity, tier: number, k: number): { won: boolean; left: number; sec: number } {
  restore(cap);
  const spec = hunterSpec(tier);
  let sec = 0;
  for (let i = 0; i < spec.n; i++) {
    const foe = blightHunterAt(game, tier, cap.state.x + 900, cap.state.y, 0);
    // (her hull as the last fight left it: `underway` only places the two and fights)
    const r = underway(game, cap, foe, k * 7 + i, 420);
    sec += r.sec;
    if (game.ships.has(foe.id)) game.removeShip(foe.id);
    game.projectiles.length = 0;
    if (r.winner !== 'a') {
      restore(cap); // (afloat again before the sea's clock takes her to a port the bench has not)
      return { won: false, left: 0, sec };
    }
    // (afloat: her leaks stopped and the fight's effects off, her hull not mended)
    const keep = cap.hull;
    restore(cap);
    cap.hull = Math.min(cap.stats.hullMax, keep);
  }
  return { won: true, left: cap.hull / cap.stats.hullMax, sec };
}

/** The table: tiers `from`…`to` for a captain in `gear`, `runs` runs a tier. */
export function blightTable(gear: Gear, runs: number, from = 1, to = 8, seed = 0): BlightRow[] {
  const out: BlightRow[] = [];
  for (let tier = from; tier <= to; tier++) {
    const spec = hunterSpec(tier);
    let wins = 0, left = 0, sec = 0;
    let game = bench();
    let ship = captainShip(game, { anchor: 10, gear, kit: gear === 'full' }, 30000, 30000).ship;
    for (let k = 0; k < runs; k++) {
      // A fresh sea and a fresh captain every FRESH runs: the bench's clock runs on through the runs, and a captain
      // hours at sea is another captain (her stores, her men) — the first table had tier VI at 2 % for that alone.
      if (k > 0 && k % FRESH === 0) {
        game = bench();
        ship = captainShip(game, { anchor: 10, gear, kit: gear === 'full' }, 30000, 30000).ship;
      }
      const r = blightRun(game, ship, tier, seed + tier * 100 + k);
      if (r.won) {
        wins++;
        left += r.left;
      }
      sec += r.sec;
    }
    out.push({ tier, anchor: spec.anchor, hunters: spec.n, hull: spec.hull, guns: spec.guns, wins, runs, left: wins ? left / wins : 0, sec: sec / runs });
  }
  return out;
}

/** Runs on one sea before it is made anew. */
const FRESH = 10;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function blightMarkdown(bare: BlightRow[], full: BlightRow[]): string {
  const lines = ['| Tier | Hunters | ⚓ | hull × | guns × | bare ⚓10: won | full build ⚓10: won | hull left (full) | a run, s (full) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [i, f] of full.entries()) {
    const b = bare[i];
    lines.push(`| ${ROMAN[f.tier] ?? f.tier} | ${f.hunters} | ${f.anchor} | ${f.hull.toFixed(2)} | ${f.guns.toFixed(2)} | ${b ? `${Math.round((b.wins / b.runs) * 100)} % (${b.wins}/${b.runs})` : '—'} | ${Math.round((f.wins / f.runs) * 100)} % (${f.wins}/${f.runs}) | ${f.wins ? `${Math.round(f.left * 100)} %` : '—'} | ${Math.round(f.sec)} |`);
  }
  return lines.join('\n');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tests/balance/blight.ts')) {
  const runs = Math.max(1, Math.trunc(Number(process.argv[2] ?? 6)) || 6);
  const from = Math.trunc(Number(process.argv[3] ?? 1)) || 1, to = Math.trunc(Number(process.argv[4] ?? 8)) || 8;
  const t0 = Date.now();
  const seed = Math.trunc(Number(process.argv[5] ?? 0)) || 0;
  const full = blightTable('full', runs, from, to, seed);
  const bare = blightTable('bare', runs, from, to, seed);
  console.log(blightMarkdown(bare, full));
  console.log(`\n${runs} runs a tier, ${Math.round((Date.now() - t0) / 1000)} s`);
}
