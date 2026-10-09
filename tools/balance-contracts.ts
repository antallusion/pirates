// docs/19 E15 (the Admiralty's contracts): the boardings the rogue legend asks of a captain of the cap — her army a
// tier of the Abyss's, her hero that tier's on her own path (server/src/game/admiralty.ts legendHero) — with the heroes
// on the field both sides (the Abyss's own table, tests/balance/abyssraid.ts, fights without them). The captain: the
// ladder's ⚓10 crew times `gear` (her artifacts and her glory as a share of men), a hero of her path at the cap with
// eight skills at expert (tools/balance-glory.ts capHero), fresh for every boarding against what is left of the legend.
//   node tools/balance-contracts.ts [runs]        the boardings each tier asks (median, and the share taken in one)
//   node tools/balance-contracts.ts [runs] pay    the pay of a contract an hour against the sea's hour and the endgame's

import { armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { RAID, raidArmy, raidPay } from '../shared/src/data/abyssraid.ts';
import { ADM_LEGEND_HOURS, ADM_LEGEND_TIERS, ADM_SEAL_ASKS, admPay, runHours, sealHours } from '../shared/src/data/admiralty.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { seaHourXp } from '../shared/src/data/roamers.ts';
import { sealPay } from '../shared/src/data/seals.ts';
import { abyssPartChance, sealPartChance } from '../shared/src/data/artifacts.ts';
import { seaHourOf } from '../shared/src/data/seamarks.ts';
import { Rng } from '../shared/src/rng.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { legendHero } from '../server/src/game/admiralty.ts';
import { capHero } from './balance-glory.ts';

const side = (army: ArmyStack[], hero: HeroBattle | undefined, captain: CaptainId | null): TacSideInput => ({
  name: 'x', ship: 'y', captain, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
  morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(hero ? { hero } : {}),
});

/** The boardings a captain of each path needs to make a tier's legend strike (her army fresh each time, the legend's
 *  what was left), over `runs` seeds a path: the median, and the share taken in one boarding. `heroes` false: the
 *  Abyss's own way, no hero either side. */
export function legendBoardings(tier: number, gear: number, runs: number, heroes = true, path: CaptainId = 'admiral'): { median: number; first: number; tries: number[] } {
  const tries: number[] = [];
  let first = 0;
  for (const c of CAPTAIN_IDS) for (let run = 0; run < runs; run++) {
    let foe = raidArmy(tier), k = 0;
    for (; k < 30; k++) {
      const me = armyForLevel(10, 600, 7, 'player').map((x) => ({ ...x, n: Math.round(x.n * gear) }));
      const seed = 4000 + run * 97 + k * 13 + tier * 7 + CAPTAIN_IDS.indexOf(c) * 1009;
      const rng = new Rng(seed);
      const bt = newBattle(side(me, heroes ? capHero(c, seed) : undefined, c), side(foe, heroes ? legendHero(tier, path) : undefined, path), seed, 0, rng);
      quickFinish(bt, 0, rng);
      if (bt.over!.winner === 0) break;
      foe = bt.stacks.filter((s) => s.side === 1 && s.count > 0).map((s) => ({ u: s.unit as UnitId, n: s.count }));
      if (!foe.length) break;
    }
    if (k === 0) first++;
    tries.push(k + 1);
  }
  tries.sort((a, b) => a - b);
  return { median: tries[Math.floor(tries.length / 2)], first: first / tries.length, tries };
}

if (import.meta.main) {
  const runs = Number(process.argv[2] ?? 4);
  if (process.argv[3] === 'pay') {
    const sea = seaHourOf(10), xp = seaHourXp(10);
    console.log(`An hour at sea ⚓10: ${sea} silver, ${xp} experience.`);
    const row = (what: string, h: number) => {
      const p = admPay(h);
      console.log(`${what.padEnd(28)} ${String(h).padStart(5)} h  ${String(p.silver).padStart(6)} silver (${(p.silver / h / sea).toFixed(2)} h/h)  ${String(p.glory).padStart(6)} glory (${(p.glory / h / xp).toFixed(2)} h/h)  part ${Math.round(p.part * 100)}% (${(p.part / h * 100).toFixed(0)}%/h)`);
    };
    for (const t of ADM_LEGEND_TIERS) row(`legend, tier ${t}`, ADM_LEGEND_HOURS[t]);
    row('citadels', 2);
    for (const a of ADM_SEAL_ASKS) row(`seal ${a.lv} ×${a.count}`, sealHours(a.lv, a.count));
    for (const km of [16, 24, 32]) row(`cargo, ${km} km`, runHours(km));
    // The endgame's others, per hour.
    for (const lv of [10, 12]) {
      const s = sealPay(lv);
      console.log(`seal ${lv} depth in time (~0.25 h): ${s.silver} silver + the men paid back (${(s.silver / 0.25 / sea).toFixed(2)} h/h), artifact ${Math.round(s.art * 100)}%, part ${Math.round(sealPartChance(lv) * 100)}% (${Math.round(sealPartChance(lv) / 0.25 * 100)}%/h)`);
    }
    for (const t of [2, 4, 7]) {
      const r = raidPay(t);
      console.log(`Abyss tier ${t} to a group of five (an equal share): ${Math.round(r.silver / 5)} silver each, part ${Math.round(abyssPartChance(t, 0.2) * 100)}% each`);
    }
  } else {
    for (const t of ADM_LEGEND_TIERS) {
      const h = legendBoardings(t, 1.3, runs, true, RAID[t - 1].path);
      const no = legendBoardings(t, 1.3, runs, false, RAID[t - 1].path);
      console.log(`tier ${t}: heroes — ${h.median} boardings (one: ${Math.round(h.first * 100)}%) [${h.tries.join(' ')}]; no heroes — ${no.median} (${Math.round(no.first * 100)}%)`);
    }
  }
}
