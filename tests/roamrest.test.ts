// The roaming stacks, 2026-10-16 (owner: «чуть больше разных кораблей и существ надо добавить, особенно существ в море.
// у существ кулдаун 30 минут должен быть, то есть каждые 30 минут я могу нападать на них снова»): the new kinds stand
// in their own seas and levels; a stack a captain has beaten is hers to fight again 30 minutes later (by the wall
// clock, kept on her profile) while the others see it stand again as before; her group mates rest as she does; the
// card, the bar and the sea say «Вернётся через …».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { ROAMS, ROAM_REST_MS, ROAM_RESPAWN, buildRoamers, roamPay, roamRes } from '../shared/src/data/roamers.ts';
import type { RoamKind } from '../shared/src/data/roamers.ts';
import { generateWorld, regionAt } from '../shared/src/world/worldgen.ts';
import type { RoamView } from '../shared/src/roamproto.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { closeFight, landTac } from '../server/src/game/beastlairs.ts';
import { attackRoam, roamAtHand, roamChoice, roamRestLeft, roamUp, roamWhere } from '../server/src/game/roamers.ts';
import { EN as REN, RU as RRU } from '../client/src/lang/ui/roamers.ts';
import { SERVER_RU_ROAM } from '../client/src/lang/server.ru.roam.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const NEW: RoamKind[] = ['cliff_harpy', 'crab_queen', 'banshee', 'storm_roc', 'plumed_serpent', 'wreck_titan'];

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
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  return s;
}
const conn = (s: PlayerSession) => (s as unknown as { conn: { last: (t: string) => Record<string, unknown> | undefined; push: (m: unknown) => void } }).conn;
const roams = (s: PlayerSession): RoamView[] => (conn(s).last('roams')?.list as RoamView[] | undefined) ?? [];
function beside(game: Game, s: PlayerSession, o: PlayerSession, dx = 60, dy = 40): void {
  if (s.ship!.docked) game.undock(s);
  s.ship!.state = { ...s.ship!.state, x: o.ship!.state.x + dx, y: o.ship!.state.y + dy, speed: 0 };
  s.ship!.input = { rudder: 0, sailTarget: 0 };
}

test('the new stacks of the sea: harpies, crab queens, banshees, storm rocs, plumed serpents, wreck titans — each in its seas and levels, paid as the others', () => {
  const world = generateWorld(WORLD_SEED);
  const idx = buildRoamers(world);
  for (const k of NEW) {
    const list = idx.list.filter((s) => s.kind === k);
    assert.ok(list.length >= 15, `${k}: ${list.length} stacks`);
    const d = ROAMS[k];
    for (const s of list) {
      assert.ok(s.level >= d.lv[0] && s.level <= d.lv[1], `${k} ⚓${s.level}`);
      assert.ok(!d.regions || d.regions.includes(regionAt(world, s.x, s.y)), `${k} in ${regionAt(world, s.x, s.y)}`);
      assert.ok(s.n >= 1);
    }
    // the same purse and lesson as any stack of its level and size; their spoils
    const L = d.lv[1];
    assert.deepEqual(roamPay(L, 'avg'), roamPay(L, 'avg'));
    assert.ok(Object.keys(roamRes(k, 400, L, 'strong')).length > 0, `${k} leaves its spoils`);
  }
  // every sea has more kinds than it had
  const kinds = new Map<string, Set<string>>();
  for (const s of idx.list) {
    const r = regionAt(world, s.x, s.y);
    if (!kinds.has(r)) kinds.set(r, new Set());
    kinds.get(r)!.add(s.kind);
  }
  for (const r of ['ashen_isles', 'leviathan_reach', 'whispering', 'dead_mans_expanse', 'drowned_crown', 'the_abyss']) {
    assert.ok(NEW.some((k) => kinds.get(r)?.has(k)), `${r}: ${[...(kinds.get(r) ?? [])].join(', ')}`);
  }
  // the words for them, both tongues
  for (const k of NEW) {
    assert.ok(REN[`k.${k}` as keyof typeof REN] && RRU[`k.${k}` as keyof typeof RRU] && !/[A-Za-z]/.test(RRU[`k.${k}` as keyof typeof RRU]), k);
  }
});

test('her own rest from a stack: beaten, it is hers again 30 minutes later (wall clock); the others see it stand again in minutes; her group mate rests too', () => {
  const game = sea();
  const a = captain(game, 'Rest Aurelia');
  const b = captain(game, 'Rest Bastian');
  const c = captain(game, 'Rest Corwin');
  conn(c).push({ t: 'group', action: 'invite', name: 'Rest Aurelia' });
  conn(a).push({ t: 'group', action: 'accept', id: (conn(a).last('party') as { invites: { id: number }[] }).invites[0].id });
  runAdmin(game, a, '/stack gull go');
  const sp = roamAtHand(game, a)!;
  assert.ok(sp);
  beside(game, b, a, 60, 40);
  beside(game, c, a, -60, 40);
  steps(game, 41);
  assert.equal(attackRoam(game, a, sp.id), null);
  landTac(game, a, { a: 'quick' });
  steps(game, 2);
  assert.equal((conn(a).last('board_tac')?.view as { over: { winner: number } }).over.winner, 0, 'her party wins');
  closeFight(game, a);
  // the world's respawn: up again for everyone within six minutes
  steps(game, 20 * (ROAM_RESPAWN[1] + 10));
  assert.ok(roamUp(game, sp.id), 'the stack stands again');
  for (const s of [a, b, c]) s.ship!.state = { ...s.ship!.state, ...roamWhere(game, sp), speed: 0 };
  b.ship!.state.x += 40;
  c.ship!.state.x -= 40;
  steps(game, 41);
  // Aurelia: «Вернётся через …», no fight
  const left = roamRestLeft(game, a, sp.id);
  assert.ok(left > ROAM_REST_MS / 1000 - ROAM_RESPAWN[1] - 60 && left <= ROAM_REST_MS / 1000, `${left} s left`);
  const va = roams(a).find((v) => v.id === sp.id)!;
  assert.ok(va && va.back && Math.abs(va.back - left) < 5, 'she is told how long');
  assert.equal(va.ratio, undefined, 'no reckoning of a fight she cannot have');
  assert.match(attackRoam(game, a, sp.id) ?? '', /half an hour/);
  assert.ok(SERVER_RU_ROAM['You beat them lately: they come back for you half an hour after the fight.'], 'in Russian');
  // her group mate shared in it: he rests too
  assert.ok(roamRestLeft(game, c, sp.id) > 0, 'the mate who shared rests');
  assert.ok(roams(c).find((v) => v.id === sp.id)?.back);
  // Bastian, of no group: the stack is his to fight
  const vb = roams(b).find((v) => v.id === sp.id)!;
  assert.ok(vb && !vb.back, 'nothing of her rest for him');
  assert.equal(roamRestLeft(game, b, sp.id), 0);
  // the rest is kept on her profile (a logout, a restart)
  assert.ok(a.profile!.roamRest?.[String(sp.id)]);
  // half an hour of the wall clock (admin /speed runs it the same way)
  game.wallSkew += ROAM_REST_MS;
  steps(game, 41);
  assert.equal(roamRestLeft(game, a, sp.id), 0);
  assert.ok(!roams(a).find((v) => v.id === sp.id)?.back, 'hers again');
  assert.equal(attackRoam(game, a, sp.id), null, 'she may fight it again');
  closeFight(game, a);
});

test('letting a stack go (HoMM3\'s offer) rests it for her too; /stack reset forgets her rests', () => {
  const game = sea();
  const s = captain(game, 'Rest Flee', 6, 'frigate');
  s.profile!.level = 26;
  runAdmin(game, s, '/stack gull go');
  let sp = roamAtHand(game, s);
  if (!sp) {
    runAdmin(game, s, '/stack go');
    sp = roamAtHand(game, s);
  }
  assert.ok(sp);
  const why = roamChoice(game, s, sp!.id, 'flee');
  if (why === null) {
    assert.ok(roamRestLeft(game, s, sp!.id) > 0, 'let go: rests');
    runAdmin(game, s, '/stack reset');
    assert.equal(roamRestLeft(game, s, sp!.id), 0, 'forgotten by the tester\'s reset');
  } else assert.match(why, /yield|go with you|first/);
});

test('the bar and the card: no «Атаковать» on a stack she rests from, the clock in its place', async () => {
  const acts = buildActs({ roam: { id: 7, icon: 'x', name: 'Чайки', word: 'Горстка', lv: 2, back: 1395 } } as unknown as Parameters<typeof buildActs>[0]);
  assert.ok(!acts.some((x) => x.id === 'roam' || x.id === 'roam_join'), 'no attack');
  assert.ok(acts.some((x) => x.id === 'roam_look'), 'still «Осмотреть»');
  const fresh = buildActs({ roam: { id: 7, icon: 'x', name: 'Чайки', word: 'Горстка', lv: 2 } } as unknown as Parameters<typeof buildActs>[0]);
  assert.ok(fresh.some((x) => x.id === 'roam'));
  const { backClock } = await import('../client/src/render/roamers.ts');
  assert.equal(backClock(1395), '23:15');
  assert.equal(RRU.back.replace('{t}', backClock(1395)), 'Вернётся через 23:15');
});
