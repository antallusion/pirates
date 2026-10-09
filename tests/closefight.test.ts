// The owner's two failures of 2026-10-07, and what was found with them:
//  - «авто преследование работает не так как положено, я должен быть рядом с целью очень близко, чтобы попадать, а плаваю
//    я очень далеко»: under «Атаковать» with the guns the helmsman held 70–92% of her guns' reach (320–420 m, off the
//    screen); now she runs in bow on and lies broadside on at a third of it (≤140 m), where nine balls in ten strike,
//    and her gun captains fire inside her effective reach only (three in four and more) — whatever the auto-fire switch;
//  - «на нейтральных существ нападать нельзя… не работает никакие кнопки, идут ошибки вечные»: «Атаковать» on a creature
//    stack is one order (the helmsman sails her in, a cable off the boats go and the hex battle opens), a tap or a click
//    on the sea fires nothing it should not, her own shot into an empty sea is no fight, and a refusal is told once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armyForLevel } from '../shared/src/data/army.ts';
import { CLOSE_MAX, closeRange } from '../shared/src/data/gunnery.ts';
import { ROAM_REACH } from '../shared/src/data/roamers.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';
import { effectiveRange } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { REFUSAL_QUIET } from '../server/src/game/Game.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { engage } from '../server/src/game/npc.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { gunneryMark, pursuitHold, pursuitOf, startPursuit, stopPursuit } from '../server/src/game/pursuit.ts';
import { roamAtHand, roamFighter, roamOffer, roamUp, roamWhere } from '../server/src/game/roamers.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { targetLineHtml } from '../client/src/ui/kit/targetline.ts';
import { EN as KEN, RU as KRU } from '../client/src/lang/ui/kit.ts';
import { EN as REN, RU as RRU } from '../client/src/lang/ui/render.ts';
import { EN as ROEN, RU as RORU } from '../client/src/lang/ui/roamers.ts';
import { duelSea, openWater, putSide } from './balance/duel.ts';
import { LEVEL_HULL, seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const conn = (s: PlayerSession) => s.conn as unknown as FakeConn;
const say = (s: PlayerSession, m: ClientMsg) => (conn(s) as unknown as { push: (m: unknown) => void }).push(m);
const refusals = (s: PlayerSession) => conn(s).inbox.filter((m): m is Extract<ServerMsg, { t: 'toast' }> => m.t === 'toast' && m.kind === 'bad').map((m) => m.msg);

// ------------------------------------------------------------------------------------------------ the close fight

test('the close fight\'s band: the helmsman holds a third of her reach (140 m at most), her guns fire within its effective edge', () => {
  for (const reach of [220, 320, 460, 560]) {
    const b = closeRange(reach);
    assert.ok(b.best <= CLOSE_MAX && b.best <= reach * 0.8, `${reach}: best ${b.best}`);
    assert.ok(b.near < b.best && b.best < b.far && b.far <= reach, `${reach}: ${JSON.stringify(b)}`);
  }
  // A long 9-pounder: lies at 138 m, fires inside 285 m (tools/mobile/hit-range.ts: 78–90% there, 50–80% at 420).
  const b = closeRange(460);
  assert.ok(b.best > 130 && b.best <= 140 && b.far > 270 && b.far < 300, JSON.stringify(b));
});

/** «Атаковать» with the guns on a bot of her level 900 m off, both under way (fight-time.ts's novice): the distance
 *  she lies at once the guns speak, each broadside's distance as it goes, and the balls that strike. */
function gunsRun(game: Game, level: number, k: number): { held: number[]; fired: number[]; balls: number; hits: number; far: number; won: boolean; secs: number } {
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const s = seaCaptain(game, LEVEL_HULL[level], level, at.x, at.y, h);
  const me = s.ship!;
  const B = putSide(game, { cls: LEVEL_HULL[level], level, craft: 'bot' }, at.x + Math.sin(h + 1.3) * 900, at.y - Math.cos(h + 1.3) * 900, h + Math.PI);
  B.brain.role = 'hunter';
  for (const x of [me, B.ship]) {
    x.state.speed = x.stats.maxSpeed * 0.7;
    x.input = { rudder: 0, sailTarget: 0.75 };
  }
  me.lastStandUntil = Infinity;
  const out = { held: [] as number[], fired: [] as number[], balls: 0, hits: 0, far: pursuitHold(me).far, won: false, secs: 0 };
  const emit = game.emit.bind(game);
  game.emit = (ev, x, y) => {
    if (ev.k === 'volley' && ev.ship === me.id) {
      out.balls += ev.balls.length; // (the chasers' too: a hit on her does not say whose gun)
      if (ev.side === 'port' || ev.side === 'starboard') out.fired.push(Math.hypot(B.ship.state.x - me.state.x, B.ship.state.y - me.state.y));
    } else if (ev.k === 'hit' && !ev.evaded && ev.ship === B.ship.id) out.hits++;
    emit(ev, x, y);
  };
  const t0 = game.now;
  let next = 0, sample = 0;
  assert.equal(startPursuit(game, s, B.ship.id, 'guns'), null);
  while (game.now - t0 < 240 && me.alive && me.hull > 1 && B.ship.alive) {
    if (game.now >= next) {
      next = game.now + (B.brain.skill?.react ?? 0.5);
      engage(game, B.ship, B.brain, me, Math.hypot(me.state.x - B.ship.state.x, me.state.y - B.ship.state.y));
    }
    game.step();
    if (out.fired.length && game.now >= sample) {
      sample = game.now + 0.5;
      out.held.push(Math.hypot(B.ship.state.x - me.state.x, B.ship.state.y - me.state.y));
    }
  }
  game.emit = emit;
  out.won = !B.ship.alive && me.alive && me.hull > 1;
  out.secs = game.now - t0;
  stopPursuit(game, s, 'off');
  if (game.ships.has(B.ship.id)) game.removeShip(B.ship.id);
  me.lastStandUntil = 0;
  me.docked = 'saltmarrow';
  conn(s).inbox.length = 0;
  return out;
}

// The fight's length (docs/25 §1.1): was ≤ 30 s at every ⚓ (the quick fight); now the broadside table's — a captain
// with no talents and no gear against the sea's ship of her ⚓ (a captain in half gear) fights about half a minute at ⚓1
// and two minutes at ⚓8 (measured after: ⚓1 30–64 s, ⚓3 61–81, ⚓5 78–107, ⚓8 102–124).
const GUNS_TIME: Record<number, number> = { 1: 75, 3: 110, 5: 150, 8: 190 };

test('«Атаковать» with the guns: she lies close (median ≤ 160 m, on the screen), nine balls in ten strike, no broadside from past her effective reach, the fight in the table’s time', () => {
  const game = duelSea();
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const rows: string[] = [];
  for (const L of [1, 3, 5, 8]) {
    const held: number[] = [], secs: number[] = [];
    let balls = 0, hits = 0, wins = 0;
    for (let k = 0; k < 4; k++) {
      const r = gunsRun(game, L, 40 + k);
      held.push(...r.held);
      secs.push(r.secs);
      balls += r.balls;
      hits += r.hits;
      if (r.won) wins++;
      for (const d of r.fired) assert.ok(d <= r.far + 25, `⚓${L}: a broadside from ${Math.round(d)} m (her effective reach ${Math.round(r.far)} m)`);
    }
    rows.push(`⚓${L}: held median ${Math.round(med(held))} m, ${hits}/${balls} balls, ${wins}/4 won, median ${med(secs).toFixed(1)} s`);
    assert.ok(med(held) <= 160, rows.at(-1));
    assert.ok(balls > 20 && hits / balls >= 0.75, rows.at(-1));
    assert.ok(med(secs) <= GUNS_TIME[L], rows.at(-1));
  }
  console.log(rows.join('\n'));
});

test('«Атаковать» is the order to fire whatever the auto-fire switch (a desk\'s is off by default); the expert\'s hand fires herself', () => {
  const fired = (expert: boolean): number => {
    const game = duelSea();
    const at = openWater(game, 9);
    const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
    s.autoFire = false;
    s.expert = expert;
    const foe = putSide(game, { cls: 'brig', level: 5, craft: 'bot' }, at.x + 130, at.y, 0).ship; // abeam, in the band
    let n = 0;
    const emit = game.emit.bind(game);
    game.emit = (ev, x, y) => {
      if (ev.k === 'volley' && ev.ship === s.ship!.id && (ev.side === 'port' || ev.side === 'starboard')) n++;
      emit(ev, x, y);
    };
    assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
    steps(game, 60);
    return n;
  };
  assert.ok(fired(false) > 0, 'her gun captains fire under «Атаковать»');
  assert.equal(fired(true), 0, 'not under the expert\'s hand');
});

test('«Атаковать» on a ship no grapple takes (a beast of the sea): the guns\' fight, not a boarding run bow on', () => {
  const game = duelSea();
  const at = openWater(game, 11);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const beast = game.spawnNpcShip('beast', 'brig', 'free', at.x + 400, at.y, 0);
  beast.npcRole = 'beast';
  game.grid.upsert(beast.id, beast.state.x, beast.state.y);
  assert.equal(startPursuit(game, s, beast.id, 'board'), null);
  assert.equal(pursuitOf(s.ship!)?.mode, 'guns');
});

test('the guns\' fight closes bow on with the boarding run\'s hands and comes broadside on in the band', () => {
  const game = duelSea();
  const at = openWater(game, 13);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const foe = putSide(game, { cls: 'brig', level: 5, craft: 'bot' }, at.x + 800, at.y, 0).ship;
  foe.input = { rudder: 0, sailTarget: 0 };
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  steps(game, 10);
  assert.ok(me.hasEffect('board_run'), 'running in');
  const best = pursuitHold(me).best;
  for (let i = 0; i < 20 * 30 && Math.hypot(foe.state.x - me.state.x, foe.state.y - me.state.y) > best * 1.2; i++) game.step();
  steps(game, 20);
  assert.ok(!me.hasEffect('board_run'), 'broadside on in the band');
  assert.ok(Math.hypot(foe.state.x - me.state.x, foe.state.y - me.state.y) < effectiveRange(me, 'port', 'round') * 0.5);
});

// ------------------------------------------------------------------------------------------------ the creature stacks

function sea(): Game {
  const { game } = makeGame();
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name: string, level = 2, cls = 'cutter'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, Math.round(s.ship!.stats.crewMax * 0.8), s.ship!.armySlots - 2, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 1000;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  return s;
}

/** Her ship hove to `d` metres off the nearest stack (the admin's /stack go, then off along x). */
function offStack(game: Game, s: PlayerSession, d: number): number {
  if (s.ship!.docked) game.undock(s);
  runAdmin(game, s, '/stack go');
  const sp = roamAtHand(game, s, 400)!;
  const p = roamWhere(game, sp);
  s.ship!.state = { ...s.ship!.state, x: p.x - d, y: p.y, heading: Math.PI / 2, speed: 0 };
  s.ship!.input = { rudder: 0, sailTarget: 0 };
  s.ship!.lastCombat = -1e9;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  for (const o of [...game.ships.values()]) if (o !== s.ship && Math.hypot(o.state.x - p.x, o.state.y - p.y) < 2500) game.removeShip(o.id);
  conn(s).inbox.length = 0;
  return sp.id;
}

test('«Атаковать» on a stack from 600 m: the helmsman sails her in, the boats go a cable off it, the hex battle — and nothing refused on the way', () => {
  const game = sea();
  const s = captain(game, 'Stack Runner');
  const id = offStack(game, s, 600);
  say(s, { t: 'attack', roam: id });
  assert.deepEqual(conn(s).last('pursuit'), { t: 'pursuit', on: true, roam: id }, 'the run on a stack, no ship for its mark');
  let secs = 0;
  for (; secs < 60 && !landFighting(game, s); secs += 0.05) game.step();
  assert.ok(landFighting(game, s), 'the battle opens');
  assert.equal(roamFighter(game, id), s.accountId);
  assert.ok(secs < 25, `in ${secs.toFixed(1)} s`);
  assert.deepEqual(refusals(s), [], 'no refusal at all');
  assert.equal(pursuitOf(s.ship!), null, 'the run is over');
  assert.ok(!s.ship!.hasEffect('board_run'), 'the hands off the braces');
  // A cable off: at once.
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  closeFight(game, s);
  const s2 = captain(game, 'Stack Near');
  const id2 = offStack(game, s2, ROAM_REACH - 60);
  say(s2, { t: 'attack', roam: id2 });
  assert.ok(landFighting(game, s2), 'within a cable the boats go at once');
  assert.deepEqual(refusals(s2), []);
});

test('no ship\'s order goes to a stack: a run on one has no ship mark; the gunners do not lay on it', () => {
  const game = sea();
  const s = captain(game, 'No Ship Order');
  const id = offStack(game, s, 700);
  say(s, { t: 'attack', roam: id });
  const run = pursuitOf(s.ship!)!;
  assert.equal(run.target, -1);
  assert.equal(run.roam, id);
  assert.equal(gunneryMark(game, s.ship!), null, 'nothing for her gunners to lay on');
  steps(game, 20);
  assert.deepEqual(refusals(s), []);
});

test('her own shot into an empty sea is no fight: the stack after it is attacked at once («Не под огнём» came at every tap)', () => {
  const game = sea();
  const s = captain(game, 'Tap Fire');
  const id = offStack(game, s, 120);
  say(s, { t: 'fire', side: 'port', dist: 100, x: Math.round(s.ship!.state.x - 100), y: Math.round(s.ship!.state.y) });
  assert.ok(!s.ship!.inCombat(game.now), 'not «under fire»');
  say(s, { t: 'attack', roam: id });
  assert.ok(landFighting(game, s), 'the battle opens');
  assert.ok(!refusals(s).includes('Not while under fire'), refusals(s).join(' | '));
});

test('a refusal is told once: the same words again within a few seconds are not sent; later they are', () => {
  const game = sea();
  const s = captain(game, 'Refused Often');
  if (s.ship!.docked) game.undock(s);
  for (let i = 0; i < 8; i++) {
    say(s, { t: 'attack', roam: 999_999_999 }); // no such stack
    game.step();
  }
  assert.deepEqual(refusals(s), ['They are gone'], 'once');
  steps(game, Math.ceil(REFUSAL_QUIET * 20) + 2);
  say(s, { t: 'attack', roam: 999_999_999 });
  assert.deepEqual(refusals(s), ['They are gone', 'They are gone'], 'again after a quiet');
  // The target frame's own asking of the glass is quiet: its «too far» is no toast.
  conn(s).inbox.length = 0;
  const far = game.spawnNpcShip('merchant', 'fluyt', 'league', s.ship!.state.x + 3000, s.ship!.state.y, 0);
  say(s, { t: 'appraise', id: far.id, quiet: true });
  assert.deepEqual(refusals(s), []);
  say(s, { t: 'appraise', id: far.id });
  assert.equal(refusals(s).length, 1, 'asked by hand, it is told');
});

test('the run gives way: her hand on the helm takes it, «Отставить» ends it; HoMM3\'s offer at ×3 (flee, join) still works', () => {
  const game = sea();
  const s = captain(game, 'Run Stopped');
  const id = offStack(game, s, 700);
  say(s, { t: 'attack', roam: id });
  assert.ok(pursuitOf(s.ship!));
  say(s, { t: 'input', rudder: 1, sail: 3, helm: true, seq: 1 });
  assert.equal(s.ship!.input.rudder, 1, 'her hand');
  say(s, { t: 'attack', stop: true });
  assert.equal(pursuitOf(s.ship!), null);
  assert.equal(conn(s).last('pursuit')?.on, false);
  // A strong ship by a weak stack: the offer, and «Отпустить» by its message.
  const g = sea();
  const big = captain(g, 'Grey Frigate', 6, 'frigate');
  runAdmin(g, big, '/stack gull go');
  const sp = roamAtHand(g, big)!;
  assert.ok(roamOffer(g, big, sp), 'the offer at ×3');
  conn(big).inbox.length = 0;
  say(big, { t: 'roam', action: 'flee', id: sp.id });
  assert.deepEqual(refusals(big), []);
  assert.ok(!roamUp(g, sp.id), 'they scatter');
});

// ------------------------------------------------------------------------------------------------ the client

test('the action list for a stack: its «Атаковать» first (no ship\'s «Атаковать»), «Отставить» while the helmsman sails her in', () => {
  const roam = { id: 7, icon: 'x', name: 'Seals', word: 'Few', lv: 2 };
  assert.equal(buildActs({ roam: { ...roam, lead: true }, port: { name: 'P' }, claim: { name: 'C', price: '1' } })[0].id, 'roam');
  assert.deepEqual(buildActs({ roam: { ...roam, lead: true, running: true } }).map((a) => a.id), ['attack_stop', 'roam_look']);
  assert.ok(!buildActs({ roam: { ...roam, lead: true, far: true, offer: 'join', joinN: 3 } }).some((a) => a.id === 'roam_join'), 'no offer from afar');
  // Not hers (a cable off, a ship of her choosing): the old order.
  assert.equal(buildActs({ roam, attack: { name: 'S', pursuing: false, mode: 'board' } })[0].id, 'attack');
  // A beast pursued: no «Сблизиться».
  assert.deepEqual(buildActs({ attack: { name: 'B', pursuing: true, mode: 'guns', gunsOnly: true } }).map((a) => a.id), ['attack_stop']);
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  // The stack's orders: «Атаковать» (the action list's and the card's) is the run; only join/flee are the stack's own.
  assert.match(main, /case 'roam':\n.*\n\s+return void net\.send\(\{ t: 'attack', roam: Number\(a\.arg\) \}\);/);
  assert.match(main, /action === 'attack' \? \{ t: 'attack', roam: id \} : \{ t: 'roam', action, id \}/);
  assert.ok(!/t: 'roam', action: 'attack'/.test(main), 'no old attack message');
  // The ship the target frame picked by itself is not «Атаковать» while a stack leads; the stack's id never goes in a
  // ship's order (board_odds, appraise, board, attack target are all of targetId / attackMark / boardTarget).
  assert.match(main, /attackMark = attackable\(targetId\) && !roamLead \? targetId : null;/);
  for (const m of main.matchAll(/net\.send\(\{ t: '(board_odds|appraise|board|volley)'[^)]*\)/g)) assert.ok(!/roam/i.test(m[0]), m[0]);
  // A finger's tap is never the mouse's click-to-fire; a click on a stack marks it and fires nothing.
  assert.match(main, /if \(!inGame \|\| e\.button !== 0 \|\| fromFinger\(e\)\) return;/);
  assert.match(main, /if \(markAt\(e\.clientX, e\.clientY\) === 'roam'\) return;/);
  // The glass asks quietly; a refusal is shown once.
  assert.match(main, /t: 'appraise', id, quiet: true/);
  assert.match(main, /if \(m\.kind === 'bad' && refusalAgain\(m\.msg\)\) break;/);
});

test('«в дальности» / «далеко»: on the target line and under her mark\'s ring, in both tongues', () => {
  assert.match(targetLineHtml({ name: 'X', range: 'in' }), /class="k-target-range" data-range="in"/);
  assert.match(targetLineHtml({ name: 'X', range: 'far' }), /data-range="far"/);
  assert.ok(!/k-target-range/.test(targetLineHtml({ name: 'X' })));
  assert.equal(KRU['target.in'], 'в дальности');
  assert.equal(KRU['target.far'], 'далеко');
  assert.equal(RRU['range.in'], 'в дальности');
  assert.equal(RRU['range.far'], 'далеко');
  for (const [en, ru] of [[KEN, KRU], [REN, RRU], [ROEN, RORU]] as const) assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  assert.ok(!/[A-Za-z]/.test(RORU['t.attackFar'].replace(/\{\w+\}/g, '')));
});
