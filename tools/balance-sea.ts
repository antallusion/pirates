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
//
//   node --disable-warning=ExperimentalWarning tools/balance-sea.ts --abilities [--anchors 1,5,10] [--seeds 3] [--gear full,bare] [--captains corsair,…] [--per] [--md out.md]
//
// --abilities (docs/25 items 13–43): the captains' kits on top of the table — a fight of equals of each ⚓ by the game's
// clock (tests/balance/kitbench.ts), her kit off and on, as the one firing (shorter by it) and as the one fired upon
// (longer by it), and how far the quickest kit is ahead of the slowest; --per adds each ability alone (its share).
// The table itself (every mode but this one) is the bare sea's: the captains' kits are off on it.

import { writeFileSync } from 'node:fs';
import { CAPTAINS as CAPTAIN_DEFS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { refLevel } from '../shared/src/data/xpcurve.ts';
import { KIT_CAPTAINS, kitMedian, kitRows } from '../tests/balance/kitbench.ts';
import { gearSource } from '../shared/src/data/items.ts';
import { ELITE_SEA, NPC_SEA, SEA_CREW_PACE, SEA_GRAPE_PACE, SEA_HULL_PACE, SEA_RELOAD_BY, defRaw, gearDefence, gearOffCeil, gearDefCeil, gearOffence, halfGearDef, halfGearOff, NPC_VOLLEYS, seaBase } from '../shared/src/data/seabalance.ts';
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

if (process.argv.includes('--abilities')) abilities();

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
const cal: { pace: number[]; crew: number[]; grape: number[]; npc: { hull: number; guns: number }[]; elite: { hull: number; guns: number }[] } = { pace: [...SEA_HULL_PACE], crew: [...SEA_CREW_PACE], grape: [...SEA_GRAPE_PACE], npc: NPC_SEA.map((x) => ({ ...x })), elite: ELITE_SEA.map((x) => ({ ...x })) };
/** Her men a broadside of a bare equal (docs/25 item 8): round shot 2% on a sound side (4% through a shattered one),
 *  grape 6% (twice round on the mean side). */
const MEN_ROUND = 0.02, MEN_GRAPE = 0.06;

function shot(a: number, row: string, shooter: ShipEntity, target: ShipEntity, want: number, ammo: 'round' | 'grape' = 'round', n = N): Cell {
  const d = fightDistance(shooter);
  shooter.state.x = X; shooter.state.y = Y; shooter.state.heading = 0;
  target.state.x = X + d; target.state.y = Y; target.state.heading = 0;
  game.grid.upsert(shooter.id, X, Y);
  game.grid.upsert(target.id, X + d, Y);
  const m = measure(game, shooter, target, n, ammo);
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
  // Her men a broadside (item 8): many broadsides, a man is a whole one.
  const br = shot(a, 'bare → bare, round (men)', bare, bare2, NaN, 'round', Math.max(N, 48));
  const bg = shot(a, 'bare → bare, grape (men)', bare, bare2, NaN, 'grape', Math.max(N, 48));
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
  cal.crew[a] = SEA_CREW_PACE[a] * (MEN_ROUND / Math.max(1e-4, br.men));
  cal.grape[a] = SEA_GRAPE_PACE[a] * (MEN_GRAPE / Math.max(1e-4, bg.men));
  cal.npc[a] = { hull: NPC_SEA[a].hull * (nb.want / nb.got), guns: NPC_SEA[a].guns * (nB.got / nB.want) };
  cal.elite[a] = { hull: ELITE_SEA[a].hull * (eb.want / eb.got), guns: ELITE_SEA[a].guns * (eB.got / eB.want) };
  process.stderr.write(`⚓${a} done (${((Date.now() - t00) / 1000).toFixed(0)} s)\n`);
}

const out: string[] = [];
out.push(`## Broadsides to sink (lying still, beam on, the close fight's distance; ${N} broadsides a cell)`);
out.push('');
out.push('| ⚓ | fight | broadsides | table | off | seconds (one battery) | her men a broadside |');
out.push('|---|---|---|---|---|---|---|');
for (const c of cells) {
  const off = Number.isFinite(c.want) ? `${c.got - c.want >= 0 ? '+' : ''}${r1(c.got - c.want)}` : '–';
  out.push(`| ${c.a} | ${c.row} | ${Number.isFinite(c.want) ? r1(c.got) : '–'} | ${Number.isFinite(c.want) ? r1(c.want) : '–'} | ${off} | ${Number.isFinite(c.want) ? r1(c.sec) : '–'} | ${r1(c.men * 100)}% |`);
}
out.push('');
out.push(`Balls that struck: ${hits.hits}; reported at 0 (drawn as a splash): ${hits.zero}; past the alpha limit (grey): ${hits.capped}.`);

/** The table's seconds of a fight in full gear under way, by ⚓ (§1.1: 25–35 s at ⚓1 … about two minutes at ⚓10). */
const TIME_FULL = [0, 30, 40, 52, 60, 66, 78, 90, 102, 114, 120];
const reloadBy = [...SEA_RELOAD_BY];
if (MOVING) {
  out.push('');
  out.push(`## Under way (bot against bot, 900 m apart at a cruise, ${DUELS} duels a row): the fight from the first broadside to a sinking`);
  out.push('');
  out.push('| ⚓ | fight | sunk | median s | p90 s | from 900 m, median s | broadsides landed by the winner (median) | winner canvas left | table s (full) |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  const med = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const p90 = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)] : NaN; };
  for (const a of LIST) {
    for (const kind of ['full', 'bare', 'npc'] as const) {
      const secs: number[] = [], fights: number[] = [], landed: number[] = [], sails: number[] = [];
      let sunk = 0;
      for (let k = 0; k < DUELS; k++) {
        clearSea(game);
        const A = kind === 'npc' ? npcShip(game, a, X, Y) : captainShip(game, { anchor: a, gear: kind }, X, Y).ship;
        const Bs = kind === 'npc' ? npcShip(game, a, X + 900, Y) : captainShip(game, { anchor: a, gear: kind }, X + 900, Y).ship;
        const r = underway(game, A, Bs, 300 + a * 17 + k);
        if (r.sunk) {
          sunk++;
          secs.push(r.sec);
          fights.push(r.fight);
          if (Number.isFinite(r.sails)) sails.push(r.sails);
          landed.push(r.winner === 'a' ? r.volleysA : r.volleysB);
        }
      }
      out.push(`| ${a} | ${kind} vs ${kind} | ${sunk}/${DUELS} | ${med(fights)} | ${p90(fights)} | ${med(secs)} | ${med(landed)} | ${Math.round(med(sails) * 100)}% | ${kind === 'full' ? TIME_FULL[a] : '–'} |`);
      if (kind === 'full' && fights.length) reloadBy[a] = SEA_RELOAD_BY[a] * (TIME_FULL[a] / med(fights));
      process.stderr.write(out.at(-1) + '\n');
    }
  }
}

if (MOVING && process.argv.includes('--calibrate-reload')) {
  out.push('');
  out.push('```ts');
  out.push(`export const SEA_RELOAD_BY = [${reloadBy.map((v) => Math.round(v * 1000) / 1000).join(', ')}];`);
  out.push('```');
}

if (CAL) {
  out.push('');
  out.push('Re-weighed (paste into shared/src/data/seabalance.ts):');
  out.push('```ts');
  out.push(`export const SEA_HULL_PACE = [${cal.pace.map((v) => Math.round(v * 1000) / 1000).join(', ')}];`);
  out.push(`export const SEA_CREW_PACE = [${cal.crew.map((v) => Math.round(v * 1000) / 1000).join(', ')}];`);
  out.push(`export const SEA_GRAPE_PACE = [${cal.grape.map((v) => Math.round(v * 1000) / 1000).join(', ')}];`);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  out.push(`export const NPC_SEA_TABLE: [number, number][] = [${cal.npc.map((v) => `[${r3(v.hull)}, ${r3(v.guns)}]`).join(', ')}];`);
  out.push(`export const ELITE_SEA_TABLE: [number, number][] = [${cal.elite.map((v) => `[${r3(v.hull)}, ${r3(v.guns)}]`).join(', ')}];`);
  out.push('```');
}
const text = out.join('\n');
console.log(text);
if (MD) writeFileSync(MD, text + '\n');
process.exit(0);

/** The captains' kits at sea (--abilities): the table of shares by ⚓ and captain, and each ability's own with --per. */
function abilities(): never {
  const g = bench();
  const seeds = Array.from({ length: Number(arg('seeds', '3')) }, (_, i) => i + 1);
  const gears = arg('gear', 'full').split(',') as Gear[];
  const caps = arg('captains', KIT_CAPTAINS.join(',')).split(',') as CaptainId[];
  const anchors = process.argv.includes('--anchors') ? LIST : [1, 5, 10];
  // The band's level: its first ranks at ⚓1, its last at ⚓10, the middle of the band between.
  const lvl = (a: number) => (a === 1 ? 3 : a === 10 ? 58 : refLevel(a));
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const o: string[] = ['## The captains\' kits at sea (docs/25 §1.1: 15–25% off a fight, the Corsair\'s to 30%; the defensive as much on; no captain 15% ahead)', ''];
  o.push('| ⚓ (L) | gear | captain | plain s | kit on s | shorter | fired upon, kit on s | longer | casts a fight |');
  o.push('|---|---|---|---|---|---|---|---|---|');
  const rows = kitRows(g, anchors, gears, seeds, caps, lvl);
  for (const r of rows) o.push(`| ${r.anchor} (L${r.level}) | ${r.gear} | ${r.captain} | ${f1(r.plain)} | ${f1(r.on)} | ${pc(r.shorter)} | ${f1(r.def)} | ${pc(r.longer)} | ${Object.entries(r.casts).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
  o.push('');
  for (const a of anchors) for (const gear of gears) {
    const t = rows.filter((r) => r.anchor === a && r.gear === gear).map((r) => 1 - r.shorter);
    o.push(`⚓${a} ${gear}: the slowest kit ${pc(Math.max(...t) / Math.min(...t) - 1)} behind the quickest.`);
  }
  if (process.argv.includes('--per')) {
    o.push('', '| ⚓ (L) | captain | passive | Z | X | C | V |', '|---|---|---|---|---|---|---|');
    for (const a of anchors) for (const c of caps) {
      const L = lvl(a);
      const foe = { anchor: a, gear: 'full' as Gear, captain: 'navigator' as CaptainId, level: L, kit: false };
      const me = (kit: boolean, only?: string[]) => ({ anchor: a, gear: 'full' as Gear, captain: c, level: L, kit, only });
      const off = kitMedian(g, me(false), foe, seeds).sec, base = kitMedian(g, me(true, []), foe, seeds).sec;
      const cells = [pc(1 - base / off)];
      for (const ab of CAPTAIN_DEFS[c].abilities) cells.push(pc(1 - kitMedian(g, me(true, [ab.id]), foe, seeds).sec / base));
      o.push(`| ${a} (L${L}) | ${c} | ${cells.join(' | ')} |`);
    }
  }
  const text = o.join('\n');
  console.log(text);
  if (MD) writeFileSync(MD, text + '\n');
  process.exit(0);
}
