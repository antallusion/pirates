// Dead Man's Dice (docs/12 P10 #4): liar's dice at a tavern table — the rules of a raise, the wild ones, the lie
// called and the cups turned up, the regulars' play, the pot (less the house's cut) to the last cup, a table joined
// and left, the week's board, and Davy Jones only at midnight in the Abyss.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICE_HOUSE_CUT, DICE_START, countFace, dicePatterns, npcMove, validRaise } from '../shared/src/data/dice.ts';
import { diceJoin, diceLeave, diceOpen, stepDice, weekBoard } from '../server/src/game/dice.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('the rules: a raise says more dice or a higher face; ones are wild; a regular calls an absurd bid', () => {
  assert.ok(validRaise(null, { q: 2, f: 3 }, 9));
  assert.ok(validRaise({ q: 2, f: 3 }, { q: 2, f: 4 }, 9));
  assert.ok(validRaise({ q: 2, f: 6 }, { q: 3, f: 2 }, 9));
  assert.ok(!validRaise({ q: 2, f: 4 }, { q: 2, f: 3 }, 9));
  assert.ok(!validRaise(null, { q: 2, f: 1 }, 9), 'ones are not bid');
  assert.ok(!validRaise(null, { q: 10, f: 3 }, 9));
  assert.equal(countFace([[1, 3, 5], [3, 3, 2]], 3), 4, 'the one stands for a three');
  let r = 0;
  const roll = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  assert.deepEqual(npcMove([2, 2, 2], 9, { q: 9, f: 6 }, 0.5, roll), { liar: true });
  const m = npcMove([5, 5, 1], 9, { q: 2, f: 3 }, 0.2, roll);
  assert.ok('bid' in m && validRaise({ q: 2, f: 3 }, m.bid, 9), 'a sound raise on its fives');
});

test('a table: open at a stake, the regulars sit, the cups go round until one is left; the pot, less the house, to the last', () => {
  const { game } = makeGame();
  const c = join(game, 'Dicer Dot');
  const s = game.sessionByName('Dicer Dot')!;
  const port = game.world.ports[0];
  s.ship!.docked = port.id;
  s.profile!.gold = 1000;
  assert.equal(diceOpen(game, s, 50), null);
  assert.equal(s.profile!.gold, 950);
  assert.equal(diceOpen(game, s, 50), 'You are at a table already.');
  // Nobody else comes: the regulars fill the seats and she dawdles through every turn (the table bids for her).
  let v = c.last('dice')!.view!;
  assert.equal(v.phase, 'open');
  for (let i = 0; i < 2000; i++) {
    game.now += 1;
    stepDice(game);
    v = c.last('dice')?.view ?? v;
    if (v.phase === 'done') break;
  }
  assert.equal(v.phase, 'done');
  assert.equal(v.seats.length, 3, 'two regulars');
  const pot = 3 * 50;
  const won = v.winner === 0;
  assert.equal(s.profile!.gold, won ? 950 + Math.floor(pot * (1 - DICE_HOUSE_CUT)) : 950);
  assert.ok(v.log.some((l) => l.includes('calls it a lie!')));
  assert.ok(v.seats.filter((x) => x.dice > 0).length === 1);
  if (won) assert.ok(weekBoard(game).some((w) => w.name === 'Dicer Dot'));
  // The table clears.
  for (let i = 0; i < 20; i++) {
    game.now += 1;
    stepDice(game);
  }
  assert.equal(c.last('dice')!.view, null);
  assert.ok(v.seats.every((x) => x.dice <= DICE_START));
});

test('a captain in port joins an open table; getting up from an open table returns the stake', () => {
  const { game } = makeGame();
  const port = game.world.ports[0];
  join(game, 'Host Hal');
  const host = game.sessionByName('Host Hal')!;
  host.ship!.docked = port.id;
  host.profile!.gold = 500;
  join(game, 'Guest Gia');
  const guest = game.sessionByName('Guest Gia')!;
  guest.ship!.docked = port.id;
  guest.profile!.gold = 500;
  assert.equal(diceOpen(game, host, 200), null);
  assert.equal(diceJoin(game, guest, 1), null);
  assert.equal(guest.profile!.gold, 300);
  assert.equal(diceLeave(game, guest), null);
  assert.equal(guest.profile!.gold, 500, 'the stake back');
  // The host gets up: the table breaks up.
  assert.equal(diceLeave(game, host), null);
  assert.equal(host.profile!.gold, 500);
});

test('Davy Jones plays only at midnight in the Abyss', () => {
  const { game } = makeGame();
  join(game, 'Bold Bo');
  const s = game.sessionByName('Bold Bo')!;
  s.ship!.docked = game.world.ports.find((p) => p.region !== 'the_abyss')!.id;
  s.profile!.gold = 5000;
  assert.equal(diceOpen(game, s, 0, true), 'Davy Jones plays only at midnight, and only in the Abyss.');
});

test('the dice read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('One-Eyed Mags bids 3 fives.').replace(/\u00a0/g, ' '), 'Одноглазая Мэгс: пятёрок — 3.');
  assert.equal(serverText('The cups come up: 2 of them. Old Tobias loses a die.').replace(/\u00a0/g, ' '), 'Кружки подняты: таких 2. Старый Тобиас теряет кость.');
  for (const [en, ru] of dicePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
