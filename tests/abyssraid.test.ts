// docs/19 E11: the Abyss of the Throne — seven tiers rising by weight, the Master with the whole book and two titans;
// a legend alongside at the Stair's gate, grappled at once; struck, the tier is taken and paid; held, what was cut stays
// cut; one boarding of a raid at a time, a group's raid shared; the balance of the boardings a tier asks; Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyForLevel, armyWeight } from '../shared/src/data/army.ts';
import { MAX_LEVEL } from '../shared/src/constants.ts';
import { RAID, RAID_REF, RAID_TIERS, raidArmy, raidPay } from '../shared/src/data/abyssraid.ts';
import { ORDER_IDS, heroBattle } from '../shared/src/data/hero.ts';
import { isTitan } from '../shared/src/data/titans.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { raidHero, raidView } from '../server/src/game/abyssraid.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { isTrialShip } from '../server/src/game/throne.ts';
import { act } from '../server/src/game/tacbattle.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { raidBoardings } from './balance/abyssraid.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

test('seven tiers, each weightier than the last; the Master with two titans and the whole book of orders', () => {
  assert.equal(RAID.length, RAID_TIERS);
  let last = 0;
  for (let t = 1; t <= RAID_TIERS; t++) {
    const w = armyWeight(raidArmy(t)) / RAID_REF;
    assert.ok(Math.abs(w - RAID[t - 1].weight) / RAID[t - 1].weight < 0.03, `tier ${t}: ${w.toFixed(2)} of ${RAID[t - 1].weight}`);
    assert.ok(w > last, `tier ${t} weightier`);
    last = w;
    assert.ok(raidArmy(t).length <= 7, 'seven stacks at the most');
    assert.ok(raidPay(t).silver > (t > 1 ? raidPay(t - 1).silver : 0));
    assert.ok(/[а-яё]/i.test(RAID[t - 1].name[1]) && /[а-яё]/i.test(RAID[t - 1].ship[1]));
  }
  assert.equal(raidArmy(7).filter((x) => isTitan(x.u)).length, 2, 'two titans with the Master');
  const whole = heroBattle({ atk: 1, def: 1, pow: 1, will: 1 }, [], null, ORDER_IDS, 10).book.length;
  assert.equal(raidHero(7).book.length, whole, 'the whole book');
  assert.ok(raidHero(1).book.length < raidHero(7).book.length);
});

test('balance: a geared captain of the cap takes the tiers in more boardings the deeper she goes; the Master asks most', () => {
  const b = raidBoardings(1.3, 6);
  for (let t = 2; t <= RAID_TIERS; t++) assert.ok(b[t - 1] >= b[t - 2] - 1, `tier ${t}: ${b.join(', ')}`);
  assert.ok(b[0] <= 2, `tier 1 at once: ${b[0]}`);
  assert.ok(b[RAID_TIERS - 1] >= 4, `the Master asks a group: ${b[RAID_TIERS - 1]}`);
  assert.equal(Math.max(...b), b[RAID_TIERS - 1]);
});

// ------------------------------------------------------------------ the server

function capped(game: Game, name: string): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'man_o_war', 10);
  s.profile!.level = MAX_LEVEL;
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  return s;
}

const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const said = (s: PlayerSession, from: number) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');
const push = (s: PlayerSession, m: unknown) => (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push(m);

test('a tier at the gate: the legend alongside and grappled; held, nothing is lost of hers but her men; struck, the tier is taken and paid', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const s = capped(game, 'Maw Diver');
  const ship = s.ship!;
  // Away from the gate: told where.
  let n = inbox(s).length;
  push(s, { t: 'throne', action: 'raid' });
  assert.ok(said(s, n).some((m) => /gate of the Stair|Put to sea/.test(m)), said(s, n).join(' | '));
  if (ship.docked) game.undock(s);
  assert.equal(runAdmin(game, s, '/maw go'), 'At the gate of the Stair.');
  steps(game, 2);
  assert.equal(raidView(game, s)!.why, null);
  // Tier 1: she strikes at once — the legend holds the Maw.
  push(s, { t: 'throne', action: 'raid' });
  const bt = ship.boarding?.fight.tac;
  assert.ok(bt, 'the battle is laid out');
  const legend = game.ships.get(ship.boarding!.with)!;
  assert.ok(isTrialShip(legend), 'no artifact on her, none of hers joins');
  assert.equal(bt.heroes[1].input.name, RAID[0].name[0]);
  // Her orders as a captain's of ⚓10, not her whole army's (a deck swept by the first Musket Storm).
  assert.ok(bt.heroes[1].input.spellHp! > 0 && bt.heroes[1].input.spellHp! < bt.heroes[1].startHp, `${bt.heroes[1].input.spellHp} of ${bt.heroes[1].startHp}`);
  assert.equal(raidView(game, s)!.fighting, 'Maw Diver');
  act(bt, 0, { a: 'surrender' }, game.now, new Rng(1));
  steps(game, 80);
  assert.equal(ship.boarding, null);
  assert.equal(game.ships.has(legend.id), false, 'the legend gone back into the Maw');
  let v = raidView(game, s)!;
  assert.equal(v.tier, 1);
  assert.equal(v.fighting, undefined);
  assert.equal(ship.docked, null, 'not sent home');
  // Again: the legend strikes — the tier is taken, its pay hers (she cut it all).
  const gold = s.profile!.gold;
  n = inbox(s).length;
  push(s, { t: 'throne', action: 'raid' });
  act(ship.boarding!.fight.tac!, 1, { a: 'surrender' }, game.now, new Rng(2));
  steps(game, 80);
  v = raidView(game, s)!;
  assert.deepEqual(v.cleared, [1]);
  assert.equal(v.tier, 2);
  assert.equal(v.share, 100, 'the next legend whole');
  assert.ok(s.profile!.gold >= gold + raidPay(1).silver - 1, `paid: ${s.profile!.gold - gold}`);
  assert.ok(said(s, n).some((m) => m.startsWith('Tier 1 of the Abyss is taken')), said(s, n).join(' | '));
  assert.equal(v.members[0].name, 'Maw Diver');
  assert.ok(v.members[0].cut > 0);
});

test('a group’s raid is shared: one boarding at a time; the Master down — the relic, the chronicle, the week’s table', () => {
  const { game, db } = makeGame();
  game.tacticalBoarding = true;
  const a = capped(game, 'Abyss Leader'), b = capped(game, 'Abyss Second');
  game.social.groups.set(9001, { id: 9001, leader: a.accountId, members: [a.accountId, b.accountId], convoy: false });
  game.social.groupOf.set(a.accountId, 9001);
  game.social.groupOf.set(b.accountId, 9001);
  for (const s of [a, b]) {
    if (s.ship!.docked) game.undock(s);
    runAdmin(game, s, '/maw go');
  }
  steps(game, 2);
  push(a, { t: 'throne', action: 'raid' });
  assert.ok(a.ship!.boarding);
  assert.equal(raidView(game, b)!.why, 'Another captain of your raid is aboard the legend now.');
  act(a.ship!.boarding!.fight.tac!, 1, { a: 'surrender' }, game.now, new Rng(3));
  steps(game, 80);
  assert.equal(raidView(game, b)!.tier, 2, 'the same raid: tier 2 for the second too');
  // The second boards tier 2 and strikes: one of the raid now, with nothing cut.
  push(b, { t: 'throne', action: 'raid' });
  assert.ok(b.ship!.boarding, 'the second aboard tier 2');
  act(b.ship!.boarding!.fight.tac!, 0, { a: 'surrender' }, game.now, new Rng(4));
  steps(game, 80);
  assert.equal(raidView(game, a)!.tier, 2, 'held');
  assert.deepEqual(raidView(game, a)!.members.map((m) => m.name).sort(), ['Abyss Leader', 'Abyss Second']);
  // The rest taken by the tester's word; the Master's fall.
  const stash = a.profile!.stash.length;
  for (let t = 2; t <= RAID_TIERS; t++) runAdmin(game, a, '/maw win');
  steps(game, 2);
  assert.equal(raidView(game, a)!.tier, RAID_TIERS + 1);
  assert.equal(raidView(game, b)!.why, 'The Master of the Abyss is down: the Maw opens again next week.');
  assert.ok(a.profile!.stash.length > stash, 'a relic to the one who cut most');
  assert.ok((db.getKv<{ msg: string }[]>('world_chronicle') ?? []).some((x) => x.msg === 'The Master of the Abyss falls to Abyss Leader, Abyss Second.'));
  assert.match(runAdmin(game, a, '/maw board') ?? '', /^1\. Abyss Leader, Abyss Second/);
});

test('the Abyss’s words read in Russian', () => {
  setLang('ru');
  try {
    for (const line of [
      'The Drowned Commodore comes up out of the Maw aboard the Last Breath: tier 1 of the Abyss.',
      'The Siren Admiral holds the Maw. Your raid has cut 42% of the tier; what is left of it waits for the next boarding.',
      'Tier 3 of the Abyss is taken: The Hollow Bosun is down.',
      'The Master of the Abyss falls to Ann, Bea.',
      'Your share of tier 2 of the Abyss: 1200 silver.',
      'Come to the gate of the Stair: the Maw opens there.',
      'Another captain of your raid is aboard the legend now.',
      'The Master of the Abyss is down: the Maw opens again next week.',
      'Tier 4: The Coral Queen, 61% of its army.',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/Ann|Bea/g, '')), `${line} → ${ru}`);
    }
  } finally {
    setLang('en');
  }
});
