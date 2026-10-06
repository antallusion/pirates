// docs/23 phase 0, items 4–5 (and phase 9's «after» table): how long a sea fight of equals lasts and how many balls
// strike home, on the CURRENT combat code — measured, not changed. Two ships alone on open water (tests/balance/duel.ts),
// steered and fought by the sea's own fighting mind under a scripted captain's craft:
//   bot      — a bot of her level against a bot of her level («бот против бота»);
//   novice   — a new player: late on the trigger, a poor lead and range, a wide spread (human delay 1.5 s);
//   average  — the balance sims' average captain («живой игрок»);
//   perfect  — the sims' perfect captain («опытный»).
// For each: the fight's length to a sinking (median, p10, p90; a fight still going at FIGHT_SEC is «unfinished»),
// the first moment the two are within the grapples' reach (the boarding window), and the share of broadside balls
// that hit, for the player side and for the bot.
//
//   node --disable-warning=ExperimentalWarning tools/mobile/fight-time.ts [--n 8] [--levels 1,3,5,8] [--json out.json]

import { writeFileSync } from 'node:fs';
import { CRAFT, FIGHT_SEC, duel, duelSea } from '../../tests/balance/duel.ts';
import type { Craft, Side } from '../../tests/balance/duel.ts';
import type { NpcSkill } from '../../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { boardingRangeBetween } from '../../server/src/game/boarding.ts';
import type { VolleyRec } from '../../server/src/game/combat.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', '8'));
const LEVELS = arg('levels', '1,3,5,8').split(',').map(Number);
const OUT = arg('json', '');

/** A hull of her level that sits on the ladder there (shared/src/data/shiplevel.ts LEVEL_RANGE). */
const HULL: Record<number, ShipClassId> = { 1: 'sloop', 2: 'sloop', 3: 'schooner', 4: 'brigantine', 5: 'brig', 6: 'brig', 7: 'frigate', 8: 'frigate' };
/** A new player: a human's delay, a poor lead and range, a wide spread. */
const NOVICE: NpcSkill = { lead: 0.5, rangeErr: 0.2, arcDeg: 25, spread: 0.3, react: 1.5, dash: false };

type Who = 'bot' | 'novice' | 'average' | 'perfect';
const side = (lv: number, who: Who): Side => {
  const cls = HULL[lv] ?? 'frigate';
  if (who === 'novice') return { cls, level: lv, craft: 'bot' as Craft, skill: NOVICE };
  return { cls, level: lv, craft: who as Craft };
};
void CRAFT;

const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };

interface Row { level: number; who: Who; n: number; done: number; wins: number; median: number; p10: number; p90: number; reach: number; reached: number; hitMe: number; hitBot: number; ballsMe: number; ballsBot: number }

const game = duelSea();
// Instruments: which ship is which (the first put is A), the first moment within the grapples' reach, and every
// broadside's balls and hits as it settles (combat.ts deletes its record after the last ball lands).
let ids: number[] = [];
const spawn = game.spawnNpcShip.bind(game);
game.spawnNpcShip = ((...a: Parameters<typeof game.spawnNpcShip>) => { const s = spawn(...a); ids.push(s.id); return s; }) as typeof game.spawnNpcShip;
let reachAt = -1, t0 = 0;
const step = game.step.bind(game);
game.step = (() => {
  step();
  if (reachAt < 0 && ids.length === 2) {
    const a = game.ships.get(ids[0]), b = game.ships.get(ids[1]);
    if (a && b && Math.hypot(a.state.x - b.state.x, a.state.y - b.state.y) <= boardingRangeBetween(a, b)) reachAt = game.now - t0;
  }
}) as typeof game.step;
const tally = new Map<number, { balls: number; hits: number }>();
const vol = game.volleys as Map<number, VolleyRec>;
const del = vol.delete.bind(vol);
vol.delete = (k: number) => {
  const rec = vol.get(k);
  if (rec) {
    const t = tally.get(rec.owner) ?? { balls: 0, hits: 0 };
    t.balls += rec.total;
    for (const n of rec.hits.values()) t.hits += n;
    tally.set(rec.owner, t);
  }
  return del(k);
};

const rows: Row[] = [];
const t00 = Date.now();
for (const lv of LEVELS) {
  for (const who of ['bot', 'novice', 'average', 'perfect'] as Who[]) {
    const secs: number[] = [], reach: number[] = [];
    let wins = 0, done = 0;
    const me = { balls: 0, hits: 0 }, bot = { balls: 0, hits: 0 };
    for (let k = 0; k < N; k++) {
      ids = [];
      reachAt = -1;
      t0 = game.now;
      tally.clear();
      const r = duel(game, side(lv, who), side(lv, 'bot'), 1000 + lv * 100 + k);
      if (r.winner !== 'draw') { done++; secs.push(r.sec); }
      if (r.winner === 'a') wins++;
      if (reachAt >= 0) reach.push(reachAt);
      const a = tally.get(ids[0]), b = tally.get(ids[1]);
      if (a) { me.balls += a.balls; me.hits += a.hits; }
      if (b) { bot.balls += b.balls; bot.hits += b.hits; }
    }
    const row: Row = {
      level: lv, who, n: N, done, wins,
      median: q(secs, 0.5), p10: q(secs, 0.1), p90: q(secs, 0.9), reach: Math.round(q(reach, 0.5)), reached: reach.length,
      hitMe: me.balls ? me.hits / me.balls : NaN, hitBot: bot.balls ? bot.hits / bot.balls : NaN, ballsMe: me.balls, ballsBot: bot.balls,
    };
    rows.push(row);
    console.log(`⚓${lv} ${who.padEnd(7)} finished ${done}/${N} (won ${wins})  median ${row.median}s  p10 ${row.p10}s  p90 ${row.p90}s  in grapple reach ${reach.length}/${N} (median ${row.reach}s)  balls that hit: player ${(row.hitMe * 100).toFixed(0)}% of ${me.balls}, bot ${(row.hitBot * 100).toFixed(0)}% of ${bot.balls}   [${Math.round((Date.now() - t00) / 1000)}s]`);
  }
}
console.log(`FIGHT_SEC (a fight's cap in the sims) = ${FIGHT_SEC}s`);
if (OUT) writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), fightSec: FIGHT_SEC, n: N, rows }, null, 1));
