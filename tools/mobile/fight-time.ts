// docs/23 phase 0, items 4–5, and item 47 (phase 9's «after» table): how long a sea fight of equals lasts and how many
// balls strike home, on the current combat code. Two ships alone on open water (tests/balance/duel.ts), 900 m apart and
// under way at a cruise (seven tenths of their way, as ships meet at sea; `--still`: lying still), until one is sunk:
//   bot      — a bot of her level against a bot of her level («бот против бота»), the sea's own fighting mind;
//   novice   — a new player on a phone: 1.5 s to see the mark and tap «Атаковать», then the helmsman pursues and her
//              gun captains lay and fire every broadside themselves (auto-aim, auto-fire: the phone's defaults), no
//              «Огонь» pressed, no expert hand (a real captain's session, server/src/game/pursuit.ts);
//   average  — the balance sims' average captain («живой игрок»);
//   perfect  — the sims' perfect captain («опытный»).
// For each: the fight's length from the start (median, p90; a fight still going at FIGHT_SEC is «unfinished»), its
// length from the first broadside, and the share of broadside balls that hit, for the player side and for the bot.
// And the boarding run («Атаковать → абордаж»): a captain's «Атаковать» to board a bot of her level 700 m off, both
// under way at a cruise, the stopwatch stopped when the grapples would bite (canBoard).
//
//   node --disable-warning=ExperimentalWarning tools/mobile/fight-time.ts [--n 30] [--levels 1,3,5,8] [--still] [--json out.json]

import { writeFileSync } from 'node:fs';
import { FIGHT_SEC, duel, duelSea } from '../../tests/balance/duel.ts';
import type { Craft, Side } from '../../tests/balance/duel.ts';
import { captainRun } from '../../tests/balance/seafight.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import type { VolleyRec } from '../../server/src/game/combat.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', '30'));
const LEVELS = arg('levels', '1,3,5,8').split(',').map(Number);
const OUT = arg('json', '');
/** Only these rows (`--who novice,board`): all four and the boarding run by default. */
const WHO = arg('who', 'bot,novice,average,perfect,board').split(',');
/** Both lying still at the start (`--still`) rather than under way at a cruise, as ships meet at sea. */
const STILL = process.argv.includes('--still');

/** A hull of her level that sits on the ladder there (shared/src/data/shiplevel.ts LEVEL_RANGE). */
const HULL: Record<number, ShipClassId> = { 1: 'sloop', 2: 'sloop', 3: 'schooner', 4: 'brigantine', 5: 'brig', 6: 'brig', 7: 'frigate', 8: 'frigate' };
/** A new player's moment to see her mark and tap «Атаковать». */
const NOVICE_REACT = 1.5;

type Who = 'bot' | 'novice' | 'average' | 'perfect';
const side = (lv: number, who: Exclude<Who, 'novice'>): Side => ({ cls: HULL[lv] ?? 'frigate', level: lv, craft: who as Craft });

/** The nearest-rank quantile (the same as tests/balance/seafight.ts pct). */
const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };

interface Row { level: number; who: Who | 'board'; n: number; done: number; wins: number; median: number; p90: number; fightMedian: number; fightP90: number; hitMe: number; hitBot: number; ballsMe: number; ballsBot: number; held?: { p10: number; median: number; p90: number }; byDistance?: { below: number | null; balls: number; hit: number | null }[] }

const game = duelSea();
// Instruments for the bots' duels: which ship is which (the first put is A), the first broadside, and every broadside's
// balls and hits as it settles (combat.ts deletes its record after the last ball lands).
let ids: number[] = [];
const spawn = game.spawnNpcShip.bind(game);
game.spawnNpcShip = ((...a: Parameters<typeof game.spawnNpcShip>) => { const s = spawn(...a); ids.push(s.id); if (!STILL) s.state.speed = s.stats.maxSpeed * 0.7; return s; }) as typeof game.spawnNpcShip;
let first = -1;
const emit = game.emit.bind(game);
game.emit = ((ev, x, y) => {
  if (first < 0 && ev.k === 'volley' && (ev.side === 'port' || ev.side === 'starboard')) first = game.now;
  emit(ev, x, y);
}) as typeof game.emit;
const tally = new Map<number, { balls: number; hits: number }>();
const vol = game.volleys as Map<number, VolleyRec>;
// The owner, 2026-10-07 («я должен быть рядом с целью очень близко, чтобы попадать, а плаваю я очень далеко»): each
// broadside's distance as it is fired (to the nearest other ship: the duels are one against one), and the captain's
// balls and hits by that distance; the distance her helmsman holds once the guns speak (sampled every half second).
const firedAt = new Map<number, number>();
const BANDS = [150, 250, 350, Infinity];
const band = () => BANDS.map(() => ({ balls: 0, hits: 0 }));
let byD = band();
let captain = -1;
const set = vol.set.bind(vol);
vol.set = (k: number, rec: VolleyRec) => {
  const o = game.ships.get(rec.owner);
  if (o) {
    let bd = Infinity;
    for (const x of game.ships.values()) if (x !== o && x.alive && !x.docked) bd = Math.min(bd, Math.hypot(x.state.x - o.state.x, x.state.y - o.state.y));
    firedAt.set(k, bd);
  }
  return set(k, rec);
};
const del = vol.delete.bind(vol);
vol.delete = (k: number) => {
  const rec = vol.get(k);
  if (rec) {
    const t = tally.get(rec.owner) ?? { balls: 0, hits: 0 };
    t.balls += rec.total;
    let h = 0;
    for (const n of rec.hits.values()) h += n;
    t.hits += h;
    tally.set(rec.owner, t);
    const d = firedAt.get(k);
    if (rec.owner === captain && d !== undefined) {
      const b = byD[BANDS.findIndex((x) => d < x)];
      b.balls += rec.total;
      b.hits += h;
    }
  }
  firedAt.delete(k);
  return del(k);
};
let held: number[] = [];
let sampleAt = 0;
const step = game.step.bind(game);
game.step = (...a: Parameters<typeof game.step>) => {
  const r = step(...a);
  if (captain >= 0 && first >= 0 && game.now >= sampleAt) {
    sampleAt = game.now + 0.5;
    const me = game.ships.get(captain);
    let bd = Infinity;
    if (me) for (const x of game.ships.values()) if (x !== me && x.alive && !x.docked) bd = Math.min(bd, Math.hypot(x.state.x - me.state.x, x.state.y - me.state.y));
    if (Number.isFinite(bd)) held.push(bd);
  }
  return r;
};

const rows: Row[] = [];
const t00 = Date.now();
const r1 = (x: number) => Math.round(x * 10) / 10;
for (const lv of LEVELS) {
  for (const who of (['bot', 'novice', 'average', 'perfect'] as Who[]).filter((w) => WHO.includes(w))) {
    const secs: number[] = [], fights: number[] = [];
    let wins = 0, done = 0;
    byD = band();
    held = [];
    const me = { balls: 0, hits: 0 }, bot = { balls: 0, hits: 0 };
    for (let k = 0; k < N; k++) {
      const seed = 1000 + lv * 100 + k;
      if (who === 'novice') {
        captain = -2; // (set once her ship is put: the first session's ship of the run)
        first = -1;
        const sessions0 = new Set(game.sessions);
        const findCaptain = game.step;
        game.step = (...a: Parameters<typeof game.step>) => {
          if (captain === -2) for (const s of game.sessions) if (!sessions0.has(s) && s.ship) captain = s.ship.id;
          return findCaptain(...a);
        };
        const r = captainRun(game, HULL[lv] ?? 'frigate', lv, seed, 'guns', FIGHT_SEC, { from: 900, cruise: !STILL, react: NOVICE_REACT });
        game.step = findCaptain;
        captain = -1;
        if (r.end >= 0) { done++; secs.push(r.end); fights.push(r.end - r.first); }
        if (r.won) wins++;
        me.balls += r.balls; me.hits += r.hits; bot.balls += r.ballsBot; bot.hits += r.hitsBot;
        continue;
      }
      ids = [];
      first = -1;
      tally.clear();
      const t0 = game.now;
      const r = duel(game, side(lv, who), side(lv, 'bot'), seed);
      // Finished before the cap: one sunk, or both at once (the duel calls that a draw).
      if (r.sec < FIGHT_SEC) { done++; secs.push(r.sec); fights.push(game.now - (first >= 0 ? first : t0)); }
      if (r.winner === 'a') wins++;
      const a = tally.get(ids[0]), b = tally.get(ids[1]);
      if (a) { me.balls += a.balls; me.hits += a.hits; }
      if (b) { bot.balls += b.balls; bot.hits += b.hits; }
    }
    const row: Row = {
      level: lv, who, n: N, done, wins, median: r1(q(secs, 0.5)), p90: r1(q(secs, 0.9)), fightMedian: r1(q(fights, 0.5)), fightP90: r1(q(fights, 0.9)),
      hitMe: me.balls ? me.hits / me.balls : NaN, hitBot: bot.balls ? bot.hits / bot.balls : NaN, ballsMe: me.balls, ballsBot: bot.balls,
    };
    if (who === 'novice') {
      row.held = { p10: Math.round(q(held, 0.1)), median: Math.round(q(held, 0.5)), p90: Math.round(q(held, 0.9)) };
      row.byDistance = BANDS.map((x, i) => ({ below: Number.isFinite(x) ? x : null, balls: byD[i].balls, hit: byD[i].balls ? Math.round((byD[i].hits / byD[i].balls) * 100) / 100 : null }));
      console.log(`   novice: distance held once the guns speak p10/median/p90 ${row.held.p10}/${row.held.median}/${row.held.p90} m; balls by the distance fired: ${row.byDistance.map((b) => `<${b.below ?? '∞'} m ${b.balls} balls ${b.hit === null ? '-' : Math.round(b.hit * 100) + '%'}`).join(', ')}`);
    }
    rows.push(row);
    console.log(`⚓${lv} ${who.padEnd(7)} sunk ${done}/${N} (won ${wins})  from the start: median ${row.median}s p90 ${row.p90}s  from the first broadside: median ${row.fightMedian}s p90 ${row.fightP90}s  balls that hit: player ${(row.hitMe * 100).toFixed(0)}% of ${me.balls}, bot ${(row.hitBot * 100).toFixed(0)}% of ${bot.balls}   [${Math.round((Date.now() - t00) / 1000)}s]`);
  }
  // «Атаковать → абордаж»: the stopwatch to the grapples.
  if (!WHO.includes('board')) continue;
  const t: number[] = [];
  for (let k = 0; k < N; k++) t.push(captainRun(game, HULL[lv] ?? 'frigate', lv, 3000 + lv * 100 + k, 'board', 40).sec);
  const ok = t.filter((x) => x >= 0);
  const row: Row = { level: lv, who: 'board', n: N, done: ok.length, wins: ok.length, median: r1(q(ok, 0.5)), p90: r1(q(ok, 0.9)), fightMedian: NaN, fightP90: NaN, hitMe: NaN, hitBot: NaN, ballsMe: 0, ballsBot: 0 };
  rows.push(row);
  console.log(`⚓${lv} «Атаковать → абордаж» alongside ${ok.length}/${N}: median ${row.median}s p90 ${row.p90}s  (${t.join(' ')})`);
}
console.log(`FIGHT_SEC (a fight's cap in the sims) = ${FIGHT_SEC}s`);
if (OUT) writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), fightSec: FIGHT_SEC, n: N, rows }, null, 1));
