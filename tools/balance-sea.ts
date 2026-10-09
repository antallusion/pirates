// The sea table (docs/25 §1.1, items 1–12 and 68): broadsides to sink, ⚓1–10 × gear (bare / level / full / mixed) ×
// against a captain, the sea's ship of her ⚓ and an elite, and the sea's ships' own broadsides on a captain — each beside
// what the table asks (base(⚓) × defence / offence, shared/src/data/seabalance.ts). Measured by the game's own code,
// lying still, beam on, at the close fight's distance (tests/balance/seakit.ts). Seconds: one battery's reloads.
//
//   node --disable-warning=ExperimentalWarning tools/balance-sea.ts [--n 8] [--anchors 1,5,10] [--calibrate] [--moving [--duels 6]] [--md out.md]
//
// --calibrate prints SEA_HULL_PACE, NPC_SEA and ELITE_SEA re-weighed to the table (paste them into seabalance.ts and run
// again: two passes settle them). --moving: the same fights under way, each side fought by the sea's fighting mind
// (bot against bot), the seconds to a sinking and the broadsides each side landed.

import { writeFileSync } from 'node:fs';
import { gearSource } from '../shared/src/data/items.ts';
import { ELITE_SEA, NPC_SEA, SEA_HULL_PACE, defRaw, gearDefence, gearOffCeil, gearDefCeil, gearOffence, halfGearDef, halfGearOff, NPC_VOLLEYS, seaBase } from '../shared/src/data/seabalance.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { ANCHORS, bench, captainShip, clearSea, fightDistance, measure, npcShip, spot, tallyHits, underway } from '../tests/balance/seakit.ts';
import type { Gear } from '../tests/balance/seakit.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', '8'));
const LIST = arg('anchors', ANCHORS.join(',')).split(',').map(Number);
const CAL = process.argv.includes('--calibrate');
const MOVING = process.argv.includes('--moving');
const DUELS = Number(arg('duels', '6'));
const MD = arg('md', '');
const SEEDS = [11, 12, 13];

const game = bench();
const hits = tallyHits(game);
const { x: X, y: Y } = spot(game);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Her gear's realized factors (offence, defence) at her ⚓. */
function factors(ship: ShipEntity, anchor: number): { off: number; def: number } {
  const shipGear = Object.values(ship.loadout.gear ?? {}).filter((x) => !!x);
  const m = gearSource([...shipGear, ...ship.worn] as never).mods;
  return { off: gearOffence(m.gunDamageMul ?? 0, anchor), def: gearDefence(defRaw(m), anchor) };
}

interface Cell { a: number; row: string; got: number; want: number; sec: number; men: number }
const cells: Cell[] = [];
const cal: { pace: number[]; npc: { hull: number; guns: number }[]; elite: { hull: number; guns: number }[] } = { pace: [...SEA_HULL_PACE], npc: NPC_SEA.map((x) => ({ ...x })), elite: ELITE_SEA.map((x) => ({ ...x })) };

function shot(a: number, row: string, shooter: ShipEntity, target: ShipEntity, want: number): Cell {
  const d = fightDistance(shooter);
  shooter.state.x = X; shooter.state.y = Y; shooter.state.heading = 0;
  target.state.x = X + d; target.state.y = Y; target.state.heading = 0;
  game.grid.upsert(shooter.id, X, Y);
  game.grid.upsert(target.id, X + d, Y);
  const m = measure(game, shooter, target, N);
  // Out of the way of the next pair.
  shooter.state.x = X - 5000; target.state.x = X - 5600;
  game.grid.upsert(shooter.id, shooter.state.x, Y);
  game.grid.upsert(target.id, target.state.x, Y);
  const c = { a, row, got: m.volleys, want, sec: m.sec, men: m.menShare };
  cells.push(c);
  return c;
}

const t00 = Date.now();
for (const a of LIST) {
  clearSea(game);
  const mk = (gear: Gear, seed = 1) => captainShip(game, { anchor: a, gear, seed }, X - 5000, Y).ship;
  const bare = mk('bare'), bare2 = mk('bare'), full = mk('full'), full2 = mk('full');
  const lvl = SEEDS.map((s) => mk('level', s)), lvl2 = SEEDS.map((s) => mk('level', s));
  const fB = factors(bare, a), fF = factors(full, a), fL = lvl.map((s) => factors(s, a));
  const B = seaBase(a);
  const npc = npcShip(game, a, X - 5600, Y), elite = npcShip(game, a, X - 5600, Y, true);
  const avg = (xs: Cell[], row: string) => {
    const c = { a, row, got: xs.reduce((s, x) => s + x.got, 0) / xs.length, want: xs.reduce((s, x) => s + x.want, 0) / xs.length, sec: xs.reduce((s, x) => s + x.sec, 0) / xs.length, men: xs.reduce((s, x) => s + x.men, 0) / xs.length };
    for (const x of xs) cells.splice(cells.indexOf(x), 1);
    cells.push(c);
    return c;
  };
  // Captain against captain.
  const bb = shot(a, 'bare → bare', bare, bare2, B * fB.def / fB.off);
  avg(lvl.map((s, i) => shot(a, 'level → level', s, lvl2[i], B * fL[i].def / fL[i].off)), 'level → level');
  shot(a, 'full → full', full, full2, B * fF.def / fF.off);
  shot(a, 'full → bare', full, bare2, B * fB.def / fF.off);
  shot(a, 'bare → full', bare, full2, B * fF.def / fB.off);
  // Against the sea's ship of her ⚓ and an elite.
  const nb = shot(a, 'bare → NPC', bare, npc, B * NPC_VOLLEYS * halfGearDef(a) / fB.off);
  avg(lvl.map((s, i) => shot(a, 'level → NPC', s, npc, B * NPC_VOLLEYS * halfGearDef(a) / fL[i].off)), 'level → NPC');
  shot(a, 'full → NPC', full, npc, B * NPC_VOLLEYS * halfGearDef(a) / fF.off);
  const eb = shot(a, 'bare → elite', bare, elite, B * gearDefCeil(a) / fB.off);
  shot(a, 'full → elite', full, elite, B * gearDefCeil(a) / fF.off);
  // The sea's ships' broadsides on her.
  const nB = shot(a, 'NPC → bare', npc, bare, B * fB.def / halfGearOff(a));
  shot(a, 'NPC → full', npc, full, B * fF.def / halfGearOff(a));
  const eB = shot(a, 'elite → bare', elite, bare, B * fB.def / gearOffCeil(a));
  shot(a, 'elite → full', elite, full, B * fF.def / gearOffCeil(a));
  // Re-weighing: a ball's pace by her ⚓ from bare against bare; the sea's hulls from a bare captain's broadsides on
  // them, their guns from theirs on a bare captain.
  cal.pace[a] = SEA_HULL_PACE[a] * (bb.got / bb.want);
  cal.npc[a] = { hull: NPC_SEA[a].hull * (nb.want / nb.got), guns: NPC_SEA[a].guns * (nB.got / nB.want) };
  cal.elite[a] = { hull: ELITE_SEA[a].hull * (eb.want / eb.got), guns: ELITE_SEA[a].guns * (eB.got / eB.want) };
  process.stderr.write(`⚓${a} done (${((Date.now() - t00) / 1000).toFixed(0)} s)\n`);
}

const out: string[] = [];
out.push(`## Broadsides to sink (lying still, beam on, the close fight's distance; ${N} broadsides a cell)`);
out.push('');
out.push('| ⚓ | fight | broadsides | table | off | seconds (one battery) | her men a broadside |');
out.push('|---|---|---|---|---|---|---|');
for (const c of cells) out.push(`| ${c.a} | ${c.row} | ${r1(c.got)} | ${r1(c.want)} | ${c.got - c.want >= 0 ? '+' : ''}${r1(c.got - c.want)} | ${r1(c.sec)} | ${r1(c.men * 100)}% |`);
out.push('');
out.push(`Balls that struck: ${hits.hits}; reported at 0 (drawn as a splash): ${hits.zero}; past the alpha limit (grey): ${hits.capped}.`);

if (MOVING) {
  out.push('');
  out.push(`## Under way (bot against bot, 900 m apart at a cruise, ${DUELS} duels a row): seconds to a sinking, broadsides landed`);
  out.push('');
  out.push('| ⚓ | fight | sunk | median s | p90 s | landed by the winner (median) |');
  out.push('|---|---|---|---|---|---|');
  const med = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const p90 = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)] : NaN; };
  for (const a of LIST) {
    for (const kind of ['full', 'bare', 'npc'] as const) {
      const secs: number[] = [], landed: number[] = [];
      let sunk = 0;
      for (let k = 0; k < DUELS; k++) {
        clearSea(game);
        const A = kind === 'npc' ? npcShip(game, a, X, Y) : captainShip(game, { anchor: a, gear: kind }, X, Y).ship;
        const Bs = kind === 'npc' ? npcShip(game, a, X + 900, Y) : captainShip(game, { anchor: a, gear: kind }, X + 900, Y).ship;
        const r = underway(game, A, Bs, 300 + a * 17 + k);
        if (r.sunk) {
          sunk++;
          secs.push(r.sec);
          landed.push(r.winner === 'a' ? r.volleysA : r.volleysB);
        }
      }
      out.push(`| ${a} | ${kind} vs ${kind} | ${sunk}/${DUELS} | ${med(secs)} | ${p90(secs)} | ${med(landed)} |`);
      process.stderr.write(out.at(-1) + '\n');
    }
  }
}

if (CAL) {
  out.push('');
  out.push('Re-weighed (paste into shared/src/data/seabalance.ts):');
  out.push('```ts');
  out.push(`export const SEA_HULL_PACE = [${cal.pace.map((v) => r2(v * 1000) / 1000).join(', ')}];`);
  out.push(`const NPC_SEA_TABLE = [${cal.npc.map((v) => `[${r2(v.hull * 100) / 100}, ${r2(v.guns * 100) / 100}]`).join(', ')}];`);
  out.push(`const ELITE_SEA_TABLE = [${cal.elite.map((v) => `[${r2(v.hull * 100) / 100}, ${r2(v.guns * 100) / 100}]`).join(', ')}];`);
  out.push('```');
}
const text = out.join('\n');
console.log(text);
if (MD) writeFileSync(MD, text + '\n');
process.exit(0);
