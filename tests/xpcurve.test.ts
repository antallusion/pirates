// docs/26: the curve of experience (owner, 2026-10-08: «почти каждый бой даёт +1… чем больше уровень, тем больше
// кораблей потопить, абордажей сделать и квестов выполнить»). The curve, the colours of the prize, one kill one prize,
// the quests first in mixed play — against the model of an hour's play (tests/balance/xp.ts; node tools/balance-xp.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, killsPerLevel, xpForLevel, xpUnit } from '../shared/src/constants.ts';
import {
  QUEST_FLOOR, XP_UNITS, battleXp, levelPct, prizeXp, questGap, questXpFor, shipBandOf, targetXp, xpGap, xpThreat,
} from '../shared/src/data/xpcurve.ts';
import { GLORY_BASE } from '../shared/src/data/throne.ts';
import { CURRENT, LEGACY, LEVELS, STYLES, hoursBetween, killsPerLevel as simKills, minutesAt, mixedHour, questShare, questShareRoad, styleHour } from './balance/xp.ts';
import { TAC_XP_SHARE } from '../server/src/game/tactical.ts';
import { XP_BOARDED, XP_SUNK } from '../server/src/game/Game.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as HUD_EN, RU as HUD_RU } from '../client/src/lang/ui/hud.ts';
import { headingVec } from '../shared/src/math.ts';
import { join, makeGame, steps } from './helpers.ts';

type Credit = { creditKill(k: ShipEntity, v: ShipEntity, how: 'sunk' | 'boarded'): void };

test('the curve grows steadily: every level dearer, no step, the ships to a level always more', () => {
  for (let L = 1; L < MAX_LEVEL; L++) {
    assert.ok(xpForLevel(L + 1) > xpForLevel(L), `level ${L + 1} dearer than ${L}`);
    assert.ok(killsPerLevel(L + 1) > killsPerLevel(L), `more ships to level ${L + 1}`);
    const r = xpForLevel(L + 1) / xpForLevel(L);
    assert.ok(r < (L < 5 ? 2.1 : 1.25), `level ${L} → ${L + 1}: ×${r.toFixed(2)}, no wall`);
  }
  // Smooth: the growth of the ships a level asks changes gently from level to level (no kink).
  // (the first levels a power: the climb eases from level to level, never turns up there)
  const g = (L: number) => Math.log(killsPerLevel(L + 1) / killsPerLevel(L));
  for (let L = 2; L < 6; L++) assert.ok(g(L) < g(L - 1), `level ${L}: the first climb eases`);
  for (let L = 6; L < MAX_LEVEL - 1; L++) assert.ok(Math.abs(g(L) - g(L - 1)) < 0.02, `level ${L}: the climb turns by ${(g(L) - g(L - 1)).toFixed(3)}`);
  // Time per level of mixed play grows steadily too (the model's noise of the quest boards allowed, 4%).
  for (let L = 2; L < MAX_LEVEL; L++) assert.ok(minutesAt(CURRENT, L) >= 0.96 * minutesAt(CURRENT, L - 1), `level ${L}: ${minutesAt(CURRENT, L).toFixed(1)} min after ${minutesAt(CURRENT, L - 1).toFixed(1)}`);
  // A level is worth what the HUD says: N% to the next.
  assert.equal(levelPct(0, 300), 0);
  assert.equal(levelPct(150, 300), 50);
  assert.equal(levelPct(300, 300), 99, 'never «100%» on a level not yet reached');
});

test('the ships a level asks: five at the first, thirty at the tenth, eighty at the thirtieth, a hundred and more past fifty', () => {
  const k = (L: number) => simKills(CURRENT, L);
  assert.ok(k(1) >= 4 && k(1) <= 6, `L1: ${k(1)}`);
  assert.ok(k(10) >= 25 && k(10) <= 35, `L10: ${k(10)}`);
  assert.ok(k(30) >= 60 && k(30) <= 80, `L30: ${k(30)}`);
  for (let L = 50; L < MAX_LEVEL; L++) assert.ok(k(L) >= 100, `L${L}: ${k(L)}`);
  // Before docs/26 a level-1 captain needed two ships and a half; and a hunting hour then was a hundred ships' worth.
  assert.ok(simKills(LEGACY, 1) < 3);
  assert.ok(styleHour(LEGACY, 'hunt', 1).xp / LEGACY.sink(1, 1) > 90);
});

test('the road in hours of mixed play: 1→2 five to eight minutes, 1→10 two to three hours, 10→20 six to eight, 20→30 about twelve, 1→60 150–250', () => {
  const m12 = hoursBetween(CURRENT, 1, 2) * 60, h10 = hoursBetween(CURRENT, 1, 10), h20 = hoursBetween(CURRENT, 10, 20), h30 = hoursBetween(CURRENT, 20, 30), all = hoursBetween(CURRENT, 1, 60);
  assert.ok(m12 >= 5 && m12 <= 8, `1→2: ${m12.toFixed(1)} min`);
  assert.ok(h10 >= 2 && h10 <= 3, `1→10: ${h10.toFixed(2)} h`);
  assert.ok(h20 >= 6 && h20 <= 8, `10→20: ${h20.toFixed(2)} h`);
  assert.ok(h30 >= 10 && h30 <= 14, `20→30: ${h30.toFixed(2)} h`);
  assert.ok(all >= 150 && all <= 250, `1→60: ${all.toFixed(0)} h`);
  // Every way of playing makes its way, none ten times another's (the stacks and the explorer slower, by design).
  for (const L of LEVELS) {
    const hs = STYLES.map((s) => styleHour(CURRENT, s, L).xp);
    assert.ok(Math.max(...hs) / Math.min(...hs) < 4, `L${L}: ${hs.map(Math.round).join(' / ')}`);
  }
});

test('quests are the main steady source: at least 40% of the mixed hour at every level, about half of the road', () => {
  for (let L = 1; L < MAX_LEVEL; L++) assert.ok(questShare(CURRENT, L) >= 0.4, `L${L}: ${Math.round(questShare(CURRENT, L) * 100)}%`);
  const road = questShareRoad(CURRENT);
  assert.ok(road >= 0.4 && road <= 0.65, `the road: ${Math.round(road * 100)}%`);
  // Questing keeps pace with hunting (its legs are longer in the wide seas): the steadier road, not a slower one.
  for (const L of [5, 20, 45]) assert.ok(styleHour(CURRENT, 'quests', L).xp >= 0.75 * styleHour(CURRENT, 'hunt', L).xp, `L${L}`);
  void mixedHour;
});

test('the colours of the prize: grey gives nothing, green less, her own ⚓ yellow, above her more; a level-4 captain learns a fifth from a ⚓1 ship', () => {
  assert.equal(shipBandOf(1), 1);
  assert.equal(shipBandOf(4), 2);
  assert.equal(shipBandOf(60), 10);
  assert.equal(xpThreat(4, 2), 'even');
  assert.equal(xpThreat(4, 1), 'easy');
  assert.ok(xpGap(4, 1) > 0 && xpGap(4, 1) <= 0.25, `L4 ⚓1: ×${xpGap(4, 1)}`);
  assert.ok(prizeXp(4, 1, 'sunk') <= 0.25 * prizeXp(4, 2, 'sunk'), 'tiny next to a ship of her level');
  for (const [L, v] of [[5, 1], [7, 1], [12, 2], [30, 4], [45, 5], [59, 7]]) {
    assert.equal(xpThreat(L, v), 'trivial', `L${L} ⚓${v}`);
    assert.equal(prizeXp(L, v, 'sunk'), 0, `L${L} ⚓${v}: grey`);
    assert.equal(prizeXp(L, v, 'boarded'), 0);
    assert.equal(targetXp(L, v, 5), 0);
  }
  // Green falls off with the levels past the band's top (WoW's zero difference grows with the level).
  assert.ok(xpGap(19, 4) > xpGap(21, 4) && xpGap(21, 4) > xpGap(23, 4) && xpGap(23, 4) > 0);
  // Above her: orange, red, a skull — more each.
  assert.deepEqual([xpThreat(4, 3), xpThreat(4, 4), xpThreat(4, 6)], ['hard', 'deadly', 'skull']);
  assert.ok(xpGap(4, 3) > 1 && xpGap(4, 4) > xpGap(4, 3) && xpGap(4, 6) > xpGap(4, 4) && xpGap(4, 9) <= 1.5);
  // Bosses and hulks stand off the ladder: even.
  assert.equal(xpGap(30, null), 1);
  // A quest far below her: never nothing, but little.
  assert.equal(questGap(40, 10), QUEST_FLOOR);
  assert.equal(questGap(20, 20), 1);
  // A quest pays at her level within its waters, green above them.
  assert.equal(questXpFor(10, 600, 5, 12), Math.round((600 * xpUnit(10)) / xpUnit(5)));
  assert.ok(questXpFor(20, 600, 5, 12) < questXpFor(12, 600, 5, 12));
});

test('one kill, one prize: sunk 1, taken 2 of her level\'s ship; the battle a bonus of a tenth; a grey ship nothing — no streak, no bounty', () => {
  assert.equal(XP_SUNK, 1);
  assert.ok(XP_BOARDED >= XP_SUNK * 2, 'a ship carried teaches twice a ship sunk');
  assert.ok(TAC_XP_SHARE <= 0.1 * 2 * XP_BOARDED && TAC_XP_SHARE > 0, 'the battle\'s own lesson a small bonus on the prize');
  const L = 22, u = xpUnit(L);
  assert.equal(battleXp(L, 5, 900, 900, TAC_XP_SHARE), Math.round(TAC_XP_SHARE * u));
  assert.equal(battleXp(L, 5, 450, 900, TAC_XP_SHARE), Math.round(TAC_XP_SHARE * u * 0.5));
  // In the game: a pirate of her ⚓ sunk pays one unit; one taken two; a grey one nothing and keeps no streak.
  const { game } = makeGame();
  const c = join(game, 'Prize Paula');
  const s = game.sessionByName('Prize Paula')!;
  const p = s.profile!;
  p.level = L;
  p.xp = 0;
  p.deeds.push('deed_first_prize', 'deed_hundred_wrecks');
  p.tutorial.goals.hidden = true;
  c.push({ t: 'undock' });
  const ship = s.ship!;
  ship.docked = null;
  const pirate = (lv: number): ShipEntity => {
    const npc = game.spawnNpcShip('pirate', lv <= 3 ? 'sloop' : 'brig', 'confederacy', ship.state.x + 400, ship.state.y, 0);
    game.setNpcLevel(npc, lv);
    npc.attackers.set(ship.id, game.now);
    return npc;
  };
  const credit = (v: ShipEntity, how: 'sunk' | 'boarded'): number => {
    const before = p.xp + cumulative(p.level);
    (game as unknown as Credit).creditKill(ship, v, how);
    return p.xp + cumulative(p.level) - before;
  };
  const v = shipBandOf(L);
  assert.equal(credit(pirate(v), 'sunk'), u, 'one unit for a pirate of her level sunk');
  assert.equal(credit(pirate(v), 'boarded'), 2 * u, 'two for one taken');
  const streak = p.streak ?? 0;
  p.contracts.push({ id: 'b1', kind: 'bounty', title: 'Bounty: 1 pirate ship', fromPort: 'gravesend', targetFaction: 'confederacy', kills: 1, progress: 0, reward: 300, xp: 0, units: 0.6, expiresAt: game.now + 3600, description: '' });
  const grey = pirate(2);
  assert.equal(grey.shipLevel, 2);
  assert.equal(credit(grey, 'sunk'), 0, 'a grey pirate teaches nothing');
  assert.equal(p.streak ?? 0, streak, 'nor adds to her streak');
  assert.equal(p.contracts.find((x) => x.id === 'b1')?.progress, 0, 'nor counts on her bounty');
  void steps;
});

/** Experience from level 1 to the start of `level`. */
function cumulative(level: number): number {
  let n = 0;
  for (let i = 1; i < level; i++) n += xpForLevel(i);
  return n;
}

test('a ship sunk counts on one quest only: two hunts that each want a pirate are not done by one pirate', () => {
  const { game } = makeGame();
  const c = join(game, 'Hunter Hal');
  const s = game.sessionByName('Hunter Hal')!;
  const p = s.profile!;
  c.push({ t: 'undock' });
  const ship = s.ship!;
  ship.docked = null;
  const hunt = (id: string): QuestDef => ({
    id, kind: 'job', name: id, mentor: 'Test', port: 'saltmarrow', summary: '', requires: { level: 1 },
    steps: [{ type: 'sink', count: 1, text: 'Sink a ship.' }, { type: 'visit', port: 'saltmarrow', text: 'Home.' }], reward: { xp: 100, silver: 10 },
  });
  for (const id of ['t_hunt_a', 't_hunt_b']) {
    QUESTS_BY_ID[id] = hunt(id);
    p.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now } as (typeof p.quests.active)[number]);
  }
  const npc = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 400, ship.state.y, 0);
  npc.attackers.set(ship.id, game.now);
  (game as unknown as Credit).creditKill(ship, npc, 'sunk');
  const steps0 = p.quests.active.filter((a) => a.id.startsWith('t_hunt_')).map((a) => a.step);
  assert.deepEqual(steps0.sort(), [0, 1], `one quest moved on: ${steps0}`);
  const npc2 = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 400, ship.state.y, 0);
  npc2.attackers.set(ship.id, game.now);
  (game as unknown as Credit).creditKill(ship, npc2, 'sunk');
  assert.deepEqual(p.quests.active.filter((a) => a.id.startsWith('t_hunt_')).map((a) => a.step), [1, 1], 'the next ship, the other');
  for (const id of ['t_hunt_a', 't_hunt_b']) delete QUESTS_BY_ID[id];
});

test('the boarding battle on the hexes: its lesson a bonus by the share cut down, then the prize — one kill, about 2.2 of her level\'s ship', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = join(game, 'Hex Helga', 'corsair');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === 'Hex Helga')!;
  const p = s.profile!;
  const ship = s.ship!;
  Object.assign(ship.state, { x: 30000, y: 80000, heading: 0, speed: 0 });
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  p.level = 22;
  p.deeds.push('deed_first_prize');
  p.tutorial.goals.hidden = true;
  ship.loadout.classId = 'brig';
  ship.loadout.level = 5;
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.setNpcLevel(npc, 5);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.crew = 30;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  const bt = ship.boarding?.fight.tac;
  assert.ok(bt, 'boarded');
  c.push({ t: 'tac', act: { a: 'quick' } });
  assert.equal(bt.over?.winner, 0, 'her brig carries the day');
  // The end is held while its last blows play (TAC_END_WINDOW) and 2.5 s more: a fight ending on a walk and a mark plays
  // ~2.2 s of it (docs/25: a boarding against the sea at ⚓5 ends in round 2 now) — six seconds, not four; and since
  // docs/25 block Д the sea's captain answers in his level's kit and the last turn carries the moves of both books
  // (their names, a page that the deck covers from) — eight.
  steps(game, 160);
  const toasts = c.all('toast').filter((t) => t.kind === 'xp').map((t) => t.msg);
  const amount = (re: RegExp): number => {
    const m = toasts.map((t) => /^\+(\d+) XP — (.*)$/.exec(t)).find((x) => x && re.test(x[2]));
    return m ? Number(m[1]) : 0;
  };
  const u = xpUnit(p.level);
  const battle = amount(/^Won the boarding battle/);
  assert.ok(battle > 0 && battle <= Math.round(TAC_XP_SHARE * u), `the battle: ${battle} (${toasts.join(' | ')})`);
  const prize = amount(/^Took /);
  assert.equal(prize, 2 * u, `the prize: two of her level's ship (${toasts.join(' | ')})`);
  assert.ok(battle + prize <= 2.2 * u + 1, 'one kill: about 2.2 units, never two prizes');
});

test('glory past the cap: a rank at first about half the last level, rank 100 twice that; ranks 1–100 about six and a half roads', () => {
  assert.equal(GLORY_BASE, Math.round((xpForLevel(MAX_LEVEL) * 0.45) / 1000) * 1000);
  let road = 0;
  for (let L = 1; L < MAX_LEVEL; L++) road += xpForLevel(L);
  let ranks = 0;
  for (let r = 0; r < 100; r++) ranks += Math.round(GLORY_BASE * (1 + r * 0.01));
  assert.ok(ranks / road > 5.5 && ranks / road < 8, `ranks 1–100: ${(ranks / road).toFixed(1)} roads`);
  // A rank at the cap's hour: some hours, not days.
  const hours = GLORY_BASE / mixedHour(CURRENT, 59).xp;
  assert.ok(hours > 2 && hours < 8, `a rank of glory: ${hours.toFixed(1)} h`);
});

test('the HUD reads «N% to the next level» in both tongues', () => {
  assert.ok(HUD_EN.xpToNext.includes('{n}%') && HUD_RU.xpToNext.includes('{n}%'));
  assert.ok(!/[A-Za-z]/.test(HUD_RU.xpToNext.replace(/\{\w+\}/g, '')), HUD_RU.xpToNext);
  assert.ok(!/[A-Za-z]/.test(HUD_RU.xpOf.replace(/\{\w+\}/g, '')), HUD_RU.xpOf);
  setLang('en');
  void (null as unknown as Game);
});
