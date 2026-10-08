// docs/19 E1–E3 — the Throne of the Sea, part 1: glory past the cap (its curve, its boons, its points of mastery),
// the mastery tree (four branches, their sea and battle sides, the tiers, the reset), the grandmaster rank of the
// secondary skills, the trials of mastery (the legend alongside, the battle, the men standing again, the rank, the
// wait, the chronicle), the balance of glory against might, the tester's commands and the words in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, xpForLevel } from '../shared/src/constants.ts';
import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import { GM_RANK, GM_TEXT, SKILLS, SKILL_IDS, skillBattle, skillOffer, skillSeaMods, skillText } from '../shared/src/data/hero.ts';
import {
  BRANCHES, ENDGAME_CAP, GLORY_BASE, GLORY_CAP, LEGENDS, MASTERY, MASTERY_BY_ID, TIER_NEED, TRIAL_MEN, TRIAL_WAIT, gloryPending, gloryXp, masteryPoints, masterySea, masteryWhy, throneLift, thronePatterns,
} from '../shared/src/data/throne.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { addXp } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { heroInput, heroOf } from '../server/src/game/hero.ts';
import { stamMax } from '../server/src/game/pathbook.ts';
import { willMax } from '../server/src/game/hero.ts';
import { isTrialShip, legendArmy, throneOf } from '../server/src/game/throne.ts';
import { act } from '../server/src/game/tacbattle.ts';
import { Rng } from '../shared/src/rng.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as T_EN, RU as T_RU } from '../client/src/lang/ui/throne.ts';
import { gloryShare, trialShare } from '../tools/balance-glory.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

function capCaptain(game: Game, name: string): PlayerSession {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = MAX_LEVEL;
  ship.level = MAX_LEVEL;
  onHull(game, ship, 'brig', 6);
  ship.setArmy(armyForLevel(6, ship.stats.crewMax, ship.armySlots, 'player'));
  ship.morale = 80;
  s.profile!.gold = 200_000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  heroOf(s.profile!);
  return s;
}

const toasts = (game: Game, s: PlayerSession): string[] => ((s.conn as unknown as { inbox: { t: string; msg?: string }[] }).inbox.filter((m) => m.t === 'toast').map((m) => m.msg ?? ''));

test('E1: glory past the cap — a gentle curve, experience turned to ranks, the bar on the plate is glory', () => {
  assert.equal(GLORY_BASE, Math.round((xpForLevel(MAX_LEVEL) * 0.45) / 1000) * 1000, 'docs/26: about half the last level'); // (the cap's step itself before docs/26)
  assert.equal(gloryXp(0), GLORY_BASE);
  assert.ok(gloryXp(100) === Math.round(GLORY_BASE * 2), 'rank 100 asks twice the first');
  for (let r = 0; r < 300; r++) assert.ok(gloryXp(r + 1) >= gloryXp(r), 'never cheaper');
  assert.ok(gloryXp(1) / gloryXp(0) < 1.02, 'gently');
  assert.equal(masteryPoints(4), 0);
  assert.equal(masteryPoints(5), 1);
  assert.equal(masteryPoints(100), 20);

  const { game } = makeGame();
  const s = capCaptain(game, 'Glorious');
  const p = s.profile!;
  game.grantXp(s, gloryXp(0) + gloryXp(1) + 100, 'Test');
  assert.equal(p.level, MAX_LEVEL, 'the level stays at the cap');
  assert.equal(p.throne!.rank, 2);
  assert.equal(p.throne!.xp, 100);
  assert.ok(toasts(game, s).some((m) => m === 'Glory rank 2!'), 'the news of a rank');
  assert.ok(toasts(game, s).some((m) => /boon of glory/.test(m)), 'and the choice to make');
  game.pushSelf(s, true);
  const self = (s.conn as unknown as { last: (t: string) => { self: { xp: number; xpNext: number; glory?: { rank: number; pending: number } } } }).last('self').self;
  assert.equal(self.xp, 100, 'the bar is glory');
  assert.equal(self.xpNext, gloryXp(2));
  assert.equal(self.glory?.rank, 2);
  assert.equal(self.glory?.pending, 2);

  // A level-up into the cap: what is left goes on into glory.
  const q = { ...p, level: MAX_LEVEL - 1, xp: 0, throne: undefined } as typeof p;
  assert.equal(addXp(q, xpForLevel(MAX_LEVEL - 1) + 500), 1);
  assert.equal(q.level, MAX_LEVEL);
  assert.equal(q.xp, 0);
  assert.equal(q.throne?.xp, 500);
});

test('E1: a boon a rank, each primary to its cap; the boons lie on her hero in a boarding', () => {
  const { game } = makeGame();
  const s = capCaptain(game, 'Boonful');
  const p = s.profile!;
  const t = throneOf(p);
  t.rank = 20;
  t.told = 20;
  const before = heroInput(game, s.ship!);
  const conn = s.conn as unknown as { push: (m: unknown) => void };
  for (let i = 0; i < GLORY_CAP; i++) conn.push({ t: 'throne', action: 'glory', id: 'atk' });
  assert.equal(t.picks.atk, GLORY_CAP);
  conn.push({ t: 'throne', action: 'glory', id: 'atk' });
  assert.equal(t.picks.atk, GLORY_CAP, 'not past its cap');
  assert.ok(toasts(game, s).includes('That boon is at its height'));
  for (const k of ['def', 'pow', 'will'] as const) for (let i = 0; i < GLORY_CAP; i++) conn.push({ t: 'throne', action: 'glory', id: k });
  assert.equal(gloryPending(t.rank, t.picks), 0, 'every boon at its height: nothing more to choose');
  const after = heroInput(game, s.ship!);
  assert.ok(Math.abs(after.melee - before.melee - 0.03) < 1e-9, 'Attack: her blows +3%');
  assert.ok(Math.abs(after.taken - before.taken - Math.min(ENDGAME_CAP.taken, 0.03)) < 1e-9, 'Defence: what her stacks take');
  assert.ok(after.mul.fire > before.mul.fire, 'Power: her orders');
  assert.ok(after.manaMax > before.manaMax && willMax(p, heroOf(p)) >= after.manaMax - 1, 'Will: her store');
  assert.equal(after.stamMax, stamMax(p), 'and her stamina, as deep as her store');
  // The lift is held under the endgame cap whatever is stacked.
  const all = throneLift({ atk: 9, def: 9, pow: 9, will: 9 }, Object.fromEntries(MASTERY.map((n) => [n.id, n.max])));
  assert.ok(all.melee <= ENDGAME_CAP.melee && all.shot <= ENDGAME_CAP.shot && all.taken <= ENDGAME_CAP.taken && all.orders <= ENDGAME_CAP.orders);
});

test('E2: the mastery tree — four branches of seven, every node does something, tiers want points in their branch', () => {
  assert.deepEqual(BRANCHES, ['admiral', 'boarder', 'mystic', 'merchant']);
  for (const b of BRANCHES) {
    const list = MASTERY.filter((n) => n.branch === b);
    assert.ok(list.length >= 6 && list.length <= 8, `${b}: 6–8 nodes`);
    assert.ok(list.some((n) => n.tier === 1) && list.some((n) => n.tier === 3), `${b}: three tiers`);
  }
  for (const n of MASTERY) {
    const fx = { ...(n.sea ?? {}), ...(n.battle ?? {}), ...(n.other ?? {}) };
    assert.ok(Object.values(fx).some((v) => typeof v === 'number' && v !== 0), `${n.id} does something`);
    assert.ok(n.name[1] && n.text[1] && /[а-я]/i.test(n.text[1]), `${n.id} in Russian`);
  }
  assert.equal(masteryWhy({}, 1, 'adm_broadside'), null);
  assert.equal(masteryWhy({}, 0, 'adm_broadside'), 'No point of mastery to spend');
  assert.match(masteryWhy({}, 5, 'adm_long')!, /wants 2 points/);
  assert.equal(masteryWhy({ adm_broadside: 2 }, 5, 'adm_long'), null);
  assert.match(masteryWhy({ adm_broadside: 2, adm_long: 1 }, 9, 'adm_line')!, new RegExp(`wants ${TIER_NEED[3]}`));
  assert.equal(masteryWhy({ adm_broadside: 2 }, 5, 'adm_broadside'), 'That node is whole');
  assert.ok((masterySea({ adm_broadside: 2 }).gunDamageMul ?? 0) > 0.039);

  const { game } = makeGame();
  const s = capCaptain(game, 'Masterful');
  const p = s.profile!;
  const t = throneOf(p);
  t.rank = 10;
  t.told = 10;
  const ship = s.ship!;
  const g0 = ship.stats.gunDamageMul;
  const conn = s.conn as unknown as { push: (m: unknown) => void };
  conn.push({ t: 'throne', action: 'node', id: 'adm_broadside' });
  conn.push({ t: 'throne', action: 'node', id: 'adm_broadside' });
  assert.equal(t.nodes.adm_broadside, 2);
  assert.ok(ship.stats.gunDamageMul > g0, 'the broadsides on her ship');
  conn.push({ t: 'throne', action: 'node', id: 'brd_cutlass' });
  assert.equal(t.nodes.brd_cutlass, undefined, 'two points of rank 10, both spent');
  // The tree forgotten in port, for silver.
  conn.push({ t: 'throne', action: 'reset' });
  assert.equal(t.nodes.adm_broadside, 2, 'not at sea');
  ship.docked = 'gravesend';
  const gold = p.gold;
  conn.push({ t: 'throne', action: 'reset' });
  assert.deepEqual(t.nodes, {});
  assert.equal(p.gold, gold - 2000);
  ship.docked = null;
  // The Merchant's sea side and the Mystic's battle side.
  t.nodes = { mer_haggle: 2, mys_well: 2 };
  const hb0 = heroInput(game, ship);
  assert.ok(willMax(p, heroOf(p)) > 0 && hb0.manaMax >= Math.round(10 * heroOf(p).prim.will * 1.1) - 1, 'a deeper well');
  assert.ok(masterySea(t.nodes).sellMul! > 0);
});

test('E2: the grandmaster rank — a fourth over expert, modest, never offered at a level, kept in the save', () => {
  for (const id of SKILL_IDS) {
    assert.ok(GM_TEXT[id][0] && /[а-я]/i.test(GM_TEXT[id][1]), `${id}: a grandmaster's words`);
    assert.equal(skillText(id, GM_RANK), GM_TEXT[id]);
    assert.equal(skillText(id, 3), SKILLS[id].text[2]);
  }
  const ex = skillBattle([{ id: 'boarding', r: 3 }, { id: 'artillery', r: 3 }, { id: 'armor', r: 3 }, { id: 'leadership', r: 3 }]);
  const gm = skillBattle([{ id: 'boarding', r: 4 }, { id: 'artillery', r: 4 }, { id: 'armor', r: 4 }, { id: 'leadership', r: 4 }]);
  assert.ok(gm.melee > ex.melee && gm.melee - ex.melee <= 0.05, 'a little more');
  assert.ok(gm.shot > ex.shot && gm.taken > ex.taken);
  assert.equal(gm.morale, 3, 'morale stops at +3');
  assert.ok((skillSeaMods([{ id: 'logistics', r: 4 }]).maxSpeed ?? 0) > (skillSeaMods([{ id: 'logistics', r: 3 }]).maxSpeed ?? 0));
  // A level-up's offer never holds the fourth rank.
  for (let lv = 2; lv < 200; lv++) for (const o of skillOffer([{ id: 'boarding', r: 3 }, { id: 'armor', r: 2 }], [], {}, 77, lv)) assert.ok(o.r <= 3);
  const { game } = makeGame();
  const s = capCaptain(game, 'Grand');
  const h = heroOf(s.profile!);
  h.skills = [{ id: 'boarding', r: 4 }];
  assert.equal(heroOf(s.profile!).skills[0].r, 4, 'a grandmaster stays one');
});

test('E3: the trial — the legend alongside with an army above hers, the boarding battle; lost: her men stand again and the legend waits', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const s = capCaptain(game, 'Challenger');
  const p = s.profile!;
  const ship = s.ship!;
  const conn = s.conn as unknown as { push: (m: unknown) => void };
  heroOf(p).skills = [{ id: 'boarding', r: 2 }];
  conn.push({ t: 'throne', action: 'trial', id: 'boarding' });
  assert.ok(toasts(game, s).includes('The legend fights only an expert of her skill'));
  heroOf(p).skills = [{ id: 'boarding', r: 3 }, { id: 'armor', r: 3 }];
  const men0 = armyMen(ship.army);
  const army0 = ship.army.map((x) => ({ ...x }));
  conn.push({ t: 'throne', action: 'trial', id: 'boarding' });
  const bt = ship.boarding?.fight.tac;
  assert.ok(bt, 'the battle is laid out');
  const legend = game.ships.get(ship.boarding!.with)!;
  assert.ok(isTrialShip(legend));
  assert.ok(armyMen(legend.army) > men0, 'her army above yours');
  assert.deepEqual(legendArmy(army0, 'boarding').map((x) => x.u), army0.map((x) => x.u));
  assert.ok(LEGENDS.boarding.men >= TRIAL_MEN);
  assert.equal(bt.heroes[1].input.name, LEGENDS.boarding.name[0]);
  assert.ok(bt.heroes[1].input.hero!.melee > bt.heroes[0].input.hero!.melee, 'a grandmaster of Boarding');
  conn.push({ t: 'throne', action: 'trial', id: 'armor' });
  assert.ok(toasts(game, s).some((m) => /middle of a boarding|under way/.test(m)), 'one trial at a time');
  // She strikes (the test's word): the trial is lost.
  act(bt, 0, { a: 'surrender' }, game.now, new Rng(1));
  steps(game, 80);
  assert.equal(ship.boarding, null);
  assert.equal(game.ships.has(legend.id), false, 'the legend is gone');
  assert.equal(armyMen(ship.army), men0, 'her men stand again');
  assert.equal(heroOf(p).skills[0].r, 3);
  const rec = throneOf(p).trials.boarding!;
  assert.equal(rec.tries, 1);
  assert.ok(rec.next! > game.now && rec.next! <= game.now + TRIAL_WAIT);
  conn.push({ t: 'throne', action: 'trial', id: 'boarding' });
  assert.ok(toasts(game, s).some((m) => /will fight you again in \d+ min/.test(m)), 'the wait');
});

test('E3: the trial won — grandmaster, the chronicle once, and no plunder', () => {
  const { game, db } = makeGame();
  game.tacticalBoarding = true;
  const s = capCaptain(game, 'Victor');
  const p = s.profile!;
  const ship = s.ship!;
  heroOf(p).skills = [{ id: 'armor', r: 3 }];
  const gold = p.gold;
  const conn = s.conn as unknown as { push: (m: unknown) => void };
  conn.push({ t: 'throne', action: 'trial', id: 'armor' });
  const bt = ship.boarding!.fight.tac!;
  act(bt, 1, { a: 'surrender' }, game.now, new Rng(1));
  steps(game, 80);
  assert.equal(ship.boarding, null);
  assert.equal(heroOf(p).skills[0].r, GM_RANK, 'a grandmaster of Armor');
  assert.ok(throneOf(p).trials.armor!.won);
  assert.ok(p.gold >= gold, 'no ransom, no loss');
  const chron = (db.getKv<{ msg: string }[]>('world_chronicle') ?? []).filter((x) => /grandmaster of Armor/.test(x.msg));
  assert.equal(chron.length, 1, 'a line in the chronicle');
  assert.equal(chron[0].msg, `Victor beat ${LEGENDS.armor.name[0]} and became a grandmaster of Armor.`);
  conn.push({ t: 'throne', action: 'trial', id: 'armor' });
  assert.ok(toasts(game, s).includes('You are a grandmaster of that skill already'));
  assert.equal([...game.ships.values()].filter((x) => isTrialShip(x)).length, 0);
});

test('E17: glory against might — far past the cap within 15 points of a fresh captain; trials hard but winnable', () => {
  const g0 = gloryShare(0, 30), g100 = gloryShare(100, 30);
  assert.ok(Math.abs(g0 - 0.5) <= 0.06, `equal captains of the cap ${g0}`);
  assert.ok(g100 - 0.5 <= 0.15, `glory 100 against a fresh captain ${g100}`);
  assert.ok(g100 >= g0, 'glory is worth something');
  for (const id of ['boarding', 'artillery', 'trading'] as const) {
    const x = trialShare(id, 20);
    assert.ok(x >= 0.12 && x <= 0.48, `the trial of ${id}: ${x}`);
  }
});

test('the tester\'s commands and the words in Russian', () => {
  const { game } = makeGame();
  const s = capCaptain(game, 'Tester');
  assert.match(runAdmin(game, s, '/glory 25')!, /^Glory 25/);
  assert.equal(throneOf(s.profile!).rank, 25);
  assert.match(runAdmin(game, s, '/mastery boarder')!, /brd_cutlass 2/);
  assert.match(runAdmin(game, s, '/mastery reset')!, /none/);
  assert.match(runAdmin(game, s, '/trial luck win')!, /Grandmaster of Luck/);
  assert.equal(heroOf(s.profile!).skills.find((x) => x.id === 'luck')?.r, GM_RANK);
  assert.match(runAdmin(game, s, '/trial')!, /luck won/);
  assert.match(runAdmin(game, s, '/trial tactics lose')!, /waits 3 h/);
  assert.match(runAdmin(game, s, '/help')!, /\/glory \[n\|xp N\|reset\] · \/mastery \[node\|branch\|all\|reset\] · \/trial \[skill\] \[go\|win\|lose\|reset\]/);
  // The Russian help: command for command.
  const help = runAdmin(game, s, '/help')!;
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the help has its twin');
  const cmds = (x: string) => [...x.matchAll(/\/[a-z]+/g)].map((m) => m[0]);
  assert.deepEqual(cmds(ru), cmds(help));
  // Every sentence of the Throne in Russian.
  const table = serverTable();
  const mine = extract().filter((x) => /glory|Glory|mastery|Mastery|legend|trial|grandmaster|Grandmaster|boon/.test(x));
  assert.ok(mine.length >= 15, `the Throne's sentences found (${mine.length})`);
  for (const x of mine) assert.ok(table[x] !== undefined, `untranslated: ${x}`);
  for (const [en, ru2] of thronePatterns()) assert.ok(en && /[а-яё]/i.test(ru2));
  setLang('ru');
  assert.equal(serverText(`Victor beat ${LEGENDS.armor.name[0]} and became a grandmaster of Armor.`).replace(/ /g, ' '), `Victor стал грандмастером навыка «Броня», одолев легенду: ${LEGENDS.armor.name[1]}.`);
  setLang('en');
  assert.deepEqual(Object.keys(T_RU).sort(), Object.keys(T_EN).sort());
  for (const n of Object.values(MASTERY_BY_ID)) assert.ok(n.icon);
});

test('E18: reaching the cap, the Throne opens with a word, once', () => {
  const { game } = makeGame();
  const s = capCaptain(game, 'Climber');
  const p = s.profile!;
  p.level = MAX_LEVEL - 1;
  p.xp = 0;
  p.throne = undefined;
  game.pushSelf(s, true);
  game.grantXp(s, xpForLevel(MAX_LEVEL - 1), 'Test');
  assert.equal(p.level, MAX_LEVEL);
  const said = toasts(game, s).filter((m) => /Throne of the Sea opens/.test(m));
  assert.equal(said.length, 1);
  assert.equal(throneOf(p).hailed, true);
});
