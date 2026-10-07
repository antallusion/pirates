// The owner, 2026-10-07: «я должен быть рядом с целью очень близко, чтобы попадать, а плаваю я очень далеко». How many
// balls of a captain's laid broadside (auto-fire's and «Огонь»'s: the gun captains lay it on the mark's lead,
// server/src/game/pursuit.ts) strike a ship of her level, by the distance it is fired at — the real gunnery
// (combat.ts fireBroadside, the projectiles, the hulls), a captain of her level's hull with her default guns and round
// shot, the mark a bot of the same hull. The mark lies broadside on (her whole length to the guns), bow on (her beam
// only) or anything between, still or under way at a cruise; the captain under way at a cruise too, the mark on her beam.
// Prints, per level and distance, the share of balls that hit (auto-fire's volley, and «Огонь»'s tighter one), and the
// distance below which three in four strike — the gun's real «effective» range for the helmsman to hold.
//
//   node --disable-warning=ExperimentalWarning tools/mobile/hit-range.ts [--n 60] [--levels 1,3,5,8]

import { AIMED_SPREAD, leadPoint } from '../../shared/src/data/gunnery.ts';
import { AMMO } from '../../shared/src/data/ships.ts';
import { tx as tval } from '../../shared/src/sim/shipstats.ts';
import { effectiveRange, fireBroadside } from '../../server/src/game/combat.ts';
import { pursuitHold } from '../../server/src/game/pursuit.ts';
import { duelSea, openWater, putSide } from '../../tests/balance/duel.ts';
import { LEVEL_HULL, seaCaptain } from '../../tests/balance/seafight.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', '60'));
const LEVELS = arg('levels', '1,3,5,8').split(',').map(Number);
const DIST = [60, 100, 140, 180, 220, 260, 300, 340, 380, 420, 460];

const game = duelSea();
const at = openWater(game, 7);
const shooter = seaCaptain(game, 'sloop', 1, at.x, at.y, 0);
const me = shooter.ship!;
let hits = 0;
const emit = game.emit.bind(game);
game.emit = ((ev, x, y) => {
  if (ev.k === 'hit' && !ev.evaded && ev.ship !== me.id) hits++;
  emit(ev, x, y);
}) as typeof game.emit;

for (const lv of LEVELS) {
  const cls = LEVEL_HULL[lv] ?? 'frigate';
  me.loadout.classId = cls;
  me.loadout.level = lv;
  me.recompute(game.now);
  const range = effectiveRange(me, 'port', 'round');
  const row: string[] = [], aimedRow: string[] = [];
  let eff = 0, effAimed = 0;
  for (const d of DIST) {
    if (d > range) break;
    let balls = 0, struck = 0, ballsA = 0, struckA = 0;
    for (let k = 0; k < N; k++) {
      for (const aimed of [false, true]) {
        // The captain at the spot, heading north under way; the mark due east of her (on her starboard beam), at an
        // angle to the line of fire anything from bow on to broadside on, still (a third of the time) or at a cruise.
        me.state.x = at.x;
        me.state.y = at.y;
        me.state.heading = 0;
        me.state.speed = me.stats.maxSpeed * 0.7;
        me.reload.port = me.reload.starboard = 0;
        me.hull = me.stats.hullMax;
        me.crew = me.stats.crewMax;
        me.morale = 80;
        me.ammo.round = 999;
        me.gunsDisabled.port = me.gunsDisabled.starboard = 0;
        game.projectiles.length = 0;
        for (const id of [...game.ships.keys()]) if (id !== me.id) game.removeShip(id); // (a pirate the sea brings to an idle newcomer)
        me.lastCombat = -1e9;
        const h = (k * 2.399 + (aimed ? 1 : 0)) % (Math.PI * 2);
        const B = putSide(game, { cls, level: lv, craft: 'bot' }, at.x + d, at.y, h);
        B.ship.state.speed = k % 3 === 0 ? 0 : B.ship.stats.maxSpeed * 0.7;
        B.ship.input = { rudder: 0, sailTarget: k % 3 === 0 ? 0 : 0.75 };
        const speed = AMMO[me.ammoSel].speed * (1 + tval(me.stats, 'shotSpeed'));
        const lead = leadPoint(me.state, B.ship.state, speed);
        hits = 0;
        const n0 = game.projectiles.length;
        fireBroadside(game, me, 'starboard', lead.d, lead, 1, aimed ? { spread: AIMED_SPREAD } : {});
        const fired = game.projectiles.length - n0;
        for (let i = 0; i < 200 && game.projectiles.length; i++) {
          game.step();
          me.state.x = at.x; // she keeps the spot (the step moves her on)
        }
        if (aimed) { ballsA += fired; struckA += hits; } else { balls += fired; struck += hits; }
        if (game.ships.has(B.ship.id)) game.removeShip(B.ship.id);
      }
    }
    const p = struck / Math.max(1, balls), pa = struckA / Math.max(1, ballsA);
    if (p >= 0.75) eff = d;
    if (pa >= 0.75) effAimed = d;
    row.push(`${d}:${Math.round(p * 100)}%`);
    aimedRow.push(`${d}:${Math.round(pa * 100)}%`);
  }
  // (Before 2026-10-07 the helmsman held 70–92% of the reach, engageHelm's FIGHT_NEAR–FIGHT_HOLD: 322–423 m.)
  const hold = pursuitHold(me);
  console.log(`⚓${lv} ${cls} (guns' reach ${Math.round(range)} m; the helmsman lies at ${Math.round(hold.best)} m, ${Math.round(hold.near)}–${Math.round(hold.best * 1.3)} m; her gun captains fire inside ${Math.round(hold.far)} m)`);
  console.log(`  auto-fire  ${row.join('  ')}   ≥75% within ${eff} m`);
  console.log(`  «Огонь»    ${aimedRow.join('  ')}   ≥75% within ${effAimed} m`);
}
