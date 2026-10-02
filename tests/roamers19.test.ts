// docs/19 D7: the creatures roaming the sea as HoMM3's neutral stacks. Their placement (one every 1–1.5 km of a sailing
// track, in open water clear of the harbours, the lanes, the reefs, the marks and the map's things; stable ids; the same
// on the world before its later steps), their levels by the squares, the same stack for every captain, the fight and
// its lock («в бою»), the group's share, the respawn a little way off 3–6 minutes later, the grey ones' lesson, HoMM3's
// offer at ×3, the hour's lesson against the game's usual hour, the tick's cost, the bar's buttons and every word.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED, WORLD_SIZE } from '../shared/src/constants.ts';
import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import { buildAdv } from '../shared/src/data/advmap.ts';
import {
  ROAMS, ROAM_HARBOUR, ROAM_KINDS, ROAM_LANE, ROAM_MATE_XP, ROAM_REACH, ROAM_RESPAWN, ROAM_SHIFT, ROAM_SHORE, ROAM_WANDER,
  buildRoamers, roamAt, roamPay, roamersNear, seaHourXp,
} from '../shared/src/data/roamers.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import { generateWorld, isLand, legacyWorld, portLanes, segDist } from '../shared/src/world/worldgen.ts';
import type { World } from '../shared/src/world/worldgen.ts';
import type { RoamView } from '../shared/src/roamproto.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { attackRoam, roamAtHand, roamBase, roamFighter, roamIndex, roamUp, roamWhere, roamsFor, stepRoamers } from '../server/src/game/roamers.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as REN, RU as RRU } from '../client/src/lang/ui/roamers.ts';
import { buildActs, landKeyAct } from '../client/src/ui/actbar.ts';
import { xpHour } from './balance/roamers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const world: World = generateWorld(WORLD_SEED);

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
const conn = (s: PlayerSession) => (s as unknown as { conn: { last: (t: string) => Record<string, unknown> | undefined; all: (t: string) => Record<string, unknown>[]; push: (m: unknown) => void } }).conn;
/** Her ship hove to beside another's. */
function beside(game: Game, s: PlayerSession, o: PlayerSession, dx = 60, dy = 40): void {
  if (s.ship!.docked) game.undock(s);
  s.ship!.state = { ...s.ship!.state, x: o.ship!.state.x + dx, y: o.ship!.state.y + dy, speed: 0 };
  s.ship!.input = { rudder: 0, sailTarget: 0 };
}
const roams = (s: PlayerSession): RoamView[] => (conn(s).last('roams')?.list as RoamView[] | undefined) ?? [];

// ------------------------------------------------------------------------------------------------ placement

test('D7: thousands of stacks on open water, clear of the shores, harbours, lanes, reefs, marks and the map\'s things', () => {
  const idx = buildRoamers(world);
  assert.ok(idx.list.length >= 4000, `${idx.list.length} stacks`);
  const lanes = portLanes(world.ports);
  const adv = buildAdv(world);
  for (const sp of idx.list) {
    assert.ok(!isLand(world, sp.x, sp.y), `${sp.id} on land`);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      assert.ok(!isLand(world, sp.x + Math.sin(a) * ROAM_SHORE, sp.y - Math.cos(a) * ROAM_SHORE), `${sp.id} by a shore`);
    }
    for (const p of world.ports) assert.ok(Math.hypot(p.x - sp.x, p.y - sp.y) >= ROAM_HARBOUR, `${sp.id} in ${p.name}'s harbour`);
    assert.ok(lanes.every(([ax, ay, bx, by]) => segDist(sp.x, sp.y, ax, ay, bx, by) >= ROAM_LANE), `${sp.id} on a lane`);
    assert.ok(world.reefs.every((q) => Math.abs(q.x - sp.x) > q.radius + 300 || Math.hypot(q.x - sp.x, q.y - sp.y) >= q.radius), `${sp.id} on a reef`);
    assert.ok(adv.guards.every((g) => Math.abs(g.x - sp.x) > 400 || Math.hypot(g.x - sp.x, g.y - sp.y) >= 300), `${sp.id} on a guard`);
  }
  // Each kind about; every level of the sea; the ids are the grid's cells, unique.
  for (const k of ROAM_KINDS) assert.ok(idx.list.some((sp) => sp.kind === k), k);
  for (let L = 1; L <= 10; L++) assert.ok(idx.list.some((sp) => sp.level === L), `⚓${L}`);
  assert.equal(new Set(idx.list.map((sp) => sp.id)).size, idx.list.length);
});

test('D7: a captain meets one every 1–1.5 km of a sailing track, in any waters', () => {
  const idx = buildRoamers(world);
  const rng = new Rng(19);
  let km = 0, met = 0;
  for (let k = 0; k < 300; k++) {
    const x0 = rng.range(6000, WORLD_SIZE - 6000), y0 = rng.range(6000, WORLD_SIZE - 6000), a = rng.range(0, Math.PI * 2);
    const seen = new Set<number>();
    for (let d = 0; d < 12000; d += 100) {
      const x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d;
      if (isLand(world, x, y)) continue;
      km += 0.1;
      // (on her screen as she passes: 600 m abeam)
      for (const sp of roamersNear(idx, x, y, 600)) seen.add(sp.id);
    }
    met += seen.size;
  }
  const per = km / met;
  assert.ok(per >= 1 && per <= 1.5, `one every ${per.toFixed(2)} km`);
});

test('D7: the levels follow the squares (⚓1 by the home ports, up to ⚓10); the same seed, the same stacks; append-only', () => {
  const idx = buildRoamers(world);
  for (const sp of idx.list) {
    const sec = sectorAt(world, sp.x, sp.y);
    assert.ok(sp.level >= sec.band[0] && sp.level <= sec.band[1], `${sp.id} ⚓${sp.level} in a square of ${sec.band}`);
    assert.ok(sp.level >= ROAMS[sp.kind].lv[0] && sp.level <= ROAMS[sp.kind].lv[1], `${sp.kind} ⚓${sp.level}`);
  }
  const again = buildRoamers(generateWorld(WORLD_SEED));
  assert.deepEqual(again.list.map((s) => [s.id, s.kind, s.level, s.size, s.n, s.x, s.y]), idx.list.map((s) => [s.id, s.kind, s.level, s.size, s.n, s.x, s.y]));
  // The world before its later steps (fewer islands and marks): a cell keeps the same stack wherever both have one.
  const old = legacyWorld(world);
  let both = 0;
  for (const sp of idx.list.slice(0, 1500)) {
    const o = roamAt(old, sp.id);
    if (!o) continue;
    both++;
    assert.deepEqual([o.kind, o.level, o.size, o.x, o.y], [sp.kind, sp.level, sp.size, sp.x, sp.y], `stack ${sp.id}`);
  }
  assert.ok(both > 1000, `${both} stacks on both`);
  // Building it is cheap (kept for the world object).
  const w2 = generateWorld(WORLD_SEED);
  const t0 = performance.now();
  buildRoamers(w2);
  assert.ok(performance.now() - t0 < 1500, `${(performance.now() - t0).toFixed(0)} ms to place`);
});

// ------------------------------------------------------------------------------------------------ the shared sea

test('D7: every captain near sees the same stack; another\'s fight is «в бою» and locked; won — the lesson, the respawn off its spot', () => {
  const game = sea();
  const a = captain(game, 'Roam Alda');
  const b = captain(game, 'Roam Brann');
  runAdmin(game, a, '/stack gull go');
  const sp = roamAtHand(game, a)!;
  assert.ok(sp, 'a stack within reach');
  beside(game, b, a);
  steps(game, 41);
  const va = roams(a).find((v) => v.id === sp.id)!, vb = roams(b).find((v) => v.id === sp.id)!;
  assert.ok(va && vb, 'both are told of it');
  assert.deepEqual([va.kind, va.level, va.n, va.x, va.y, va.seed], [vb.kind, vb.level, vb.n, vb.x, vb.y, vb.seed]);
  // Its wander: slow, round its spot.
  const p0 = roamWhere(game, sp);
  steps(game, 20 * 10);
  const p1 = roamWhere(game, sp);
  assert.ok(Math.hypot(p1.x - sp.x, p1.y - sp.y) <= ROAM_WANDER + 1 && Math.hypot(p1.x - p0.x, p1.y - p0.y) < 40, 'it drifts slowly, never far');
  // Alda attacks: Brann sees it in battle and cannot take it.
  a.ship!.state = { ...a.ship!.state, ...roamWhere(game, sp), speed: 0 };
  beside(game, b, a);
  assert.equal(attackRoam(game, a, sp.id), null);
  assert.ok(landFighting(game, a));
  assert.equal(roamFighter(game, sp.id), a.accountId);
  steps(game, 21);
  assert.equal(roams(b).find((v) => v.id === sp.id)?.fight, 'other');
  assert.equal(attackRoam(game, b, sp.id), 'Another captain is fighting them.');
  // Won by quick combat: her lesson and silver; the stack gone for 3–6 minutes.
  const xp0 = a.profile!.xp, lv0 = a.profile!.level, gold0 = a.profile!.gold;
  landTac(game, a, { a: 'quick' });
  steps(game, 2);
  const view = conn(a).last('board_tac')?.view as { over: { winner: number }; land: { lair: string }; result: { loot: { roam?: { xp: number; silver: number } } } };
  assert.equal(view.over.winner, 0);
  assert.equal(view.land.lair, `roam_${sp.kind}`);
  assert.ok(view.result.loot.roam && view.result.loot.roam.xp > 0 && view.result.loot.roam.silver > 0, JSON.stringify(view.result.loot));
  assert.ok(a.profile!.level > lv0 || a.profile!.xp > xp0, 'she learned');
  assert.ok(a.profile!.gold > gold0, 'a little silver');
  assert.ok(!roamUp(game, sp.id), 'gone');
  closeFight(game, a);
  steps(game, 21);
  assert.ok(!roams(b).some((v) => v.id === sp.id), 'gone for Brann too');
  steps(game, 20 * (ROAM_RESPAWN[0] - 5));
  assert.ok(!roamUp(game, sp.id), 'not before three minutes');
  steps(game, 20 * (ROAM_RESPAWN[1] - ROAM_RESPAWN[0] + 10));
  assert.ok(roamUp(game, sp.id), 'up again within six');
  const base = roamBase(game, sp);
  const off = Math.hypot(base.x - sp.x, base.y - sp.y);
  assert.ok(off > 0 && off <= ROAM_SHIFT + 1, `a little way off (${off.toFixed(0)} m)`);
  steps(game, 41);
  assert.ok(roams(b).some((v) => v.id === sp.id), 'Brann sees it again');
});

test('D7: a group shares a stack beaten — her mate near has his share of the lesson and of the silver', () => {
  const game = sea();
  const a = captain(game, 'Group Ysolde');
  const b = captain(game, 'Group Tarrant');
  conn(b).push({ t: 'group', action: 'invite', name: 'Group Ysolde' });
  conn(a).push({ t: 'group', action: 'accept', id: (conn(a).last('party') as { invites: { id: number }[] }).invites[0].id });
  runAdmin(game, a, '/stack go');
  const sp = roamAtHand(game, a)!;
  beside(game, b, a, 80, 0);
  steps(game, 41);
  assert.equal(attackRoam(game, a, sp.id), null);
  steps(game, 21);
  assert.equal(roams(b).find((v) => v.id === sp.id)?.fight, 'mate', 'his group in battle');
  assert.match(attackRoam(game, b, sp.id) ?? '', /group mate/);
  const xpB = b.profile!.xp + b.profile!.level * 1e6, goldB = b.profile!.gold;
  landTac(game, a, { a: 'quick' });
  steps(game, 2);
  const won = (conn(a).last('board_tac')?.view as { over: { winner: number } }).over.winner === 0;
  assert.ok(won, 'her party beats them');
  const loot = (conn(a).last('board_tac')?.view as { result: { loot: { roam: { mates: number } } } }).result.loot.roam;
  assert.equal(loot.mates, 1);
  assert.ok(b.profile!.xp + b.profile!.level * 1e6 > xpB, 'his share of the lesson');
  assert.ok(b.profile!.gold > goldB, 'his share of the silver');
  assert.ok(ROAM_MATE_XP > 0 && ROAM_MATE_XP < 1);
});

test('D7: a grey stack (three levels below her ship) teaches nothing; HoMM3\'s offer at ×3 — some sign on', () => {
  const game = sea();
  const s = captain(game, 'Grey Ship', 6, 'frigate');
  runAdmin(game, s, '/stack gull go');
  const sp = roamAtHand(game, s)!;
  assert.ok(sp.level <= 3);
  steps(game, 41);
  const v = roams(s).find((x) => x.id === sp.id)!;
  assert.ok(v.ratio !== undefined && v.ratio >= 3, `×${v.ratio}`);
  assert.ok(v.offer === 'join' || v.offer === 'flee');
  const xp0 = s.profile!.xp + s.profile!.level * 1e6;
  assert.equal(attackRoam(game, s, sp.id), null);
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  const view = conn(s).last('board_tac')?.view as { result: { loot: { roam: { xp: number; grey?: boolean } } } };
  assert.equal(view.result.loot.roam.xp, 0);
  assert.equal(view.result.loot.roam.grey, true);
  assert.equal(s.profile!.xp + s.profile!.level * 1e6, xp0, 'no lesson from a grey one');
  closeFight(game, s);
  // A stack that would sign on: half of it follows her.
  runAdmin(game, s, '/stack reset');
  for (const sp2 of roamIndex(game).list.filter((x) => x.kind === 'seal' || x.kind === 'gull').slice(0, 400)) {
    s.ship!.state = { ...s.ship!.state, ...roamWhere(game, sp2), speed: 0 };
    const near = roamsFor(game, s).find((x) => x.id === sp2.id);
    if (near?.offer !== 'join' || !near.joinN) continue;
    const men = armyMen(s.ship!.army);
    conn(s).push({ t: 'roam', action: 'join', id: sp2.id });
    assert.ok(armyMen(s.ship!.army) > men, 'they follow her ship');
    assert.ok(!roamUp(game, sp2.id));
    return;
  }
  assert.fail('no stack would sign on');
});

// ------------------------------------------------------------------------------------------------ the balance and the tick

test('D7: an hour of steady fighting teaches 0.6–0.8 of the game\'s usual hour at every level, and about pays for its men', () => {
  for (let L = 1; L <= 10; L++) {
    const h = xpHour(L);
    assert.ok(h.share >= 0.6 && h.share <= 0.8, `⚓${L}: ${Math.round(h.share * 100)}% of ${Math.round(seaHourXp(L))}`);
    assert.ok(h.fights >= 15, `⚓${L}: ${h.fights} fights an hour`);
    const net = h.silver - h.refill;
    assert.ok(net >= 0.05 && net <= 0.4, `⚓${L}: net ${net.toFixed(2)} h at sea`);
  }
  // The lesson grows with the waters and the size.
  for (let L = 2; L <= 10; L++) assert.ok(roamPay(L, 'avg').xp >= 5);
  assert.ok(roamPay(5, 'strong').xp > roamPay(5, 'weak').xp);
});

test('D7: forty captains at sea among the stacks cost the tick little (told every other second, nothing else runs)', () => {
  const game = sea();
  const list: PlayerSession[] = [];
  for (let i = 0; i < 40; i++) {
    const s = captain(game, `Tick ${i}`);
    runAdmin(game, s, '/tp gravewater');
    s.ship!.state.x += (i % 8) * 2600;
    s.ship!.state.y += Math.floor(i / 8) * 2600;
    list.push(s);
  }
  for (let k = 0; k < 4; k++) game.now += 1, stepRoamers(game);
  const t0 = performance.now();
  for (let k = 0; k < 60; k++) {
    game.now += 1;
    stepRoamers(game);
  }
  const ms = (performance.now() - t0) / 60;
  assert.ok(ms < 1.5, `${ms.toFixed(3)} ms a second for 40 captains`);
  assert.ok(list.every((s) => roams(s).length > 0), 'every one of them told');
});

// ------------------------------------------------------------------------------------------------ the bar and the words

test('D7: the action bar — «Атаковать» (the land key\'s), «Осмотреть», «Принять» at the offer; none while another fights it', () => {
  const roam = { id: 7, icon: 'creature.gull', name: 'Gulls', word: 'Pack', lv: 2 };
  const acts = buildActs({ roam });
  assert.deepEqual(acts.map((a) => a.id), ['roam', 'roam_look']);
  assert.equal(landKeyAct(acts)?.id, 'roam');
  assert.equal(buildActs({ roam: { ...roam, offer: 'join', joinN: 4 } }).map((a) => a.id).join(), 'roam,roam_join,roam_look');
  assert.deepEqual(buildActs({ roam: { ...roam, fight: 'other' } }).map((a) => a.id), ['roam_look']);
  assert.equal(ROAM_REACH, 250);
});

test('D7: /stack in both HELPs, every new server line and every word of the client in Russian', () => {
  const helpEn = Object.keys(SERVER_RU_ADMIN).find((k) => k.startsWith('/speed N'))!;
  assert.ok(helpEn.includes('/stack [kind] [go|fight|beat|reset]'));
  assert.ok(SERVER_RU_ADMIN[helpEn].includes('/stack [вид] [go|fight|beat|reset]'));
  const cmds = (s: string) => s.split(' · ').map((c) => c.split(' ')[0]);
  assert.deepEqual(cmds(SERVER_RU_ADMIN[helpEn]), cmds(helpEn), 'the Russian HELP command for command');
  const table = serverTable();
  const lines = extract().filter((p) => /roaming|Roaming|stack \{1\}|No stack|falls on the \{0\} \(|throw your party back into the sea|follow your ship|see your strength and scatter|fighting them|at them already|within a cable of them|hauled back from the water|Your share of the \{0\}|Gulls on the Swell|Seals at Sea|Sharks of the Open|Tentacles from|Drowned Adrift|Lantern Maws|A Leviathan|Ancient Turtles/.test(p));
  assert.ok(lines.length >= 20, `${lines.length} lines`);
  assert.deepEqual(lines.filter((p) => table[p] === undefined), []);
  for (const k of Object.keys(REN) as (keyof typeof REN)[]) assert.ok(RRU[k] && !/[a-z]{3,}/i.test(RRU[k].replace(/\{\w+\}/g, '')), `RU ${k}: ${RRU[k]}`);
});
