// Owner, 2026-10-28: the captain splits and merges her stacks aboard (HoMM3's split), and a thank-you letter to every
// captain — 33 333 silver and a gift stack of 10 musketeers whose losses are never refilled: not by a hire, First
// Aid, the deck's rally, the record of the fallen (resurrection, the infirmary's «Пополнить»), the wounded below, a
// merge with hired men, the hands signed on by themselves, the beaten who come over. It trains and splits as any other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyAdd, armyFit, armyFromSave, armyMerge, armyRemove, armyShot, armySplit, armyTidy, stackKey } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { GIFT28_N, GIFT28_NO_ROOM, GIFT28_SILVER, GIFT28_WORDS, giftPatterns } from '../shared/src/data/gift.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { armyDismissOp, armyMergeOp, armySplitOp } from '../server/src/game/armyops.ts';
import { GIFT28_DONE, adminGift28, giftPlan, giftSend, giftSentKey } from '../server/src/game/gift28.ts';
import { mailTake } from '../server/src/game/post.ts';
import { afterBattle } from '../server/src/game/hero.ts';
import { killMen } from '../server/src/game/combat.ts';
import { fallenOf, raiseInstant, recordFallen, resView } from '../server/src/game/waystations.ts';
import { beatenJoin } from '../server/src/game/crew.ts';
import { lossesOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle } from '../server/src/game/tacbattle.ts';
import { sideOf, takeLosses } from '../server/src/game/tactical.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { makeGame, join, onHull } from './helpers.ts';

const gift = (n = GIFT28_N): ArmyStack => ({ u: 'musketeer', n, g: 1 });
const giftOf = (army: readonly ArmyStack[]) => army.find((x) => x.u === 'musketeer' && x.g);
const plainOf = (army: readonly ArmyStack[], u = 'musketeer') => army.filter((x) => x.u === u && !x.g).reduce((a, x) => a + x.n, 0);

function captain(game: Game, name: string): PlayerSession {
  join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.level = 30;
  s.profile!.gold = 1000;
  return s;
}

// ------------------------------------------------------------------------------------------------ the army's model

test('split and merge (HoMM3): a stack into two of its kind in a free slot, kept apart until merged; the slots hold; a gift keeps its mark and never merges with hired men', () => {
  const army: ArmyStack[] = [{ u: 'marine', n: 30 }, { u: 'deckhand', n: 20 }, gift()];
  const a = armySplit(army, 'marine', 10, 4);
  assert.ok(Array.isArray(a));
  const t = armyTidy(a);
  assert.equal(t.filter((x) => x.u === 'marine').length, 2, 'two marine stacks after the tidy');
  assert.deepEqual(t.filter((x) => x.u === 'marine').map((x) => x.n).sort((p, q) => p - q), [10, 20]);
  // The slots: four on this hull — full now.
  assert.equal(armySplit(t, 'deckhand', 5, 4), 'No free slot in the army for a new stack');
  assert.equal(armySplit(t, 'deckhand', 20, 7), 'Split off at least one man and leave one');
  assert.equal(armySplit(t, 'deckhand', 0, 7), 'Split off at least one man and leave one');
  // The parts merge back, and the lone part loses its tag.
  const part = t.find((x) => x.u === 'marine' && x.p)!;
  const m = armyMerge(t, stackKey(part), 'marine');
  assert.ok(Array.isArray(m));
  const t2 = armyTidy(m);
  assert.deepEqual(t2.filter((x) => x.u === 'marine'), [{ u: 'marine', n: 30 }]);
  // A gift splits into two gifts; neither merges with hired musketeers; gifts merge with each other.
  const withHired = armyTidy([...t2, { u: 'musketeer', n: 5 }]);
  assert.equal(withHired.filter((x) => x.u === 'musketeer').length, 2, 'the gift and the hired stand apart');
  const g2 = armySplit(withHired, 'musketeer!', 4, 7) as ArmyStack[];
  assert.equal(g2.filter((x) => x.g).length, 2, 'both parts of the gift are gifts');
  assert.deepEqual(g2.filter((x) => x.g).map((x) => x.n).sort((p, q) => p - q), [4, 6]);
  assert.equal(armyMerge(g2, 'musketeer!', 'musketeer'), 'A gift stack keeps to itself: it never merges with hired men');
  assert.equal(armyMerge(g2, 'musketeer', 'musketeer!#1'), 'A gift stack keeps to itself: it never merges with hired men');
  assert.equal(armyMerge(g2, 'marine', 'deckhand'), 'Only stacks of the same kind merge');
  const back = armyTidy(armyMerge(g2, 'musketeer!#1', 'musketeer!') as ArmyStack[]);
  assert.deepEqual(back.filter((x) => x.g), [gift()]);
});

test('the gift is never refilled by the army\'s own reckoning: hired men go to a plain stack or a slot of their own, a full army\'s overflow never into the gift, a smaller hull never folds it', () => {
  const army: ArmyStack[] = [gift(7)];
  armyAdd(army, 5, 4, 'musketeer');
  assert.equal(giftOf(army)!.n, 7, 'the gift stays at its seven');
  assert.equal(plainOf(army), 5, 'the hired stand in their own stack');
  // Slots full and no plain musketeers: the overflow falls on the lowest plain stack, never on the gift.
  const full: ArmyStack[] = [gift(7), { u: 'marine', n: 10 }, { u: 'deckhand', n: 10 }];
  armyAdd(full, 4, 3, 'musketeer');
  assert.equal(giftOf(full)!.n, 7);
  assert.equal(full.reduce((a, x) => a + x.n, 0), 31);
  // A hull of fewer slots: the plain stacks fold, the gift stands.
  const big: ArmyStack[] = [gift(7), { u: 'marine', n: 10 }, { u: 'deckhand', n: 10 }, { u: 'sailor', n: 3 }, { u: 'boarder', n: 2 }];
  armyFit(big, 3);
  assert.equal(big.length, 3);
  assert.deepEqual(giftOf(big), gift(7));
  // A save keeps the mark and the parts; one that counted more men signs them on as deckhands, not into the gift.
  const saved = armyFromSave([gift(7), { u: 'marine', n: 6 }, { u: 'marine', n: 4, p: 1 }], 27, 5, 7);
  assert.deepEqual(giftOf(saved), gift(7));
  assert.equal(saved.filter((x) => x.u === 'marine').length, 2, 'the split part survives the save');
  assert.equal(saved.find((x) => x.u === 'deckhand')?.n, 10);
  // Losses are told apart: what the gift lost carries its mark (the record of the fallen passes it over).
  const lost = armyRemove([gift(10), { u: 'musketeer', n: 10 }], 6);
  assert.ok(lost.some((x) => x.g) && lost.some((x) => !x.g), JSON.stringify(lost));
  const shot = armyShot([gift(10)], 3);
  assert.ok(shot.lost.every((x) => x.g));
});

// ------------------------------------------------------------------------------------------------ the captain's hand

test('the server weighs her split, merge and dismiss: the slots, the kind, the gift; the last stack stays; never in a boarding', () => {
  const { game } = makeGame();
  const s = captain(game, 'Splitter');
  const ship = s.ship!;
  ship.setArmy([{ u: 'marine', n: 30 }, { u: 'deckhand', n: 20 }, gift()]);
  assert.equal(armySplitOp(game, s, 'marine', 12), null);
  assert.equal(ship.army.filter((x) => x.u === 'marine').length, 2);
  assert.equal(ship.crew, 60, 'a split is no hire');
  const part = ship.army.find((x) => x.u === 'marine' && x.p)!;
  assert.equal(part.n, 12);
  assert.equal(armySplitOp(game, s, 'musketeer!', 3), null);
  assert.equal(ship.army.filter((x) => x.g).length, 2, 'the gift\'s part is a gift');
  assert.equal(armyMergeOp(game, s, 'musketeer!#1', 'deckhand'), 'Only stacks of the same kind merge');
  assert.equal(armyMergeOp(game, s, stackKey(part), 'marine'), null);
  assert.deepEqual(ship.army.filter((x) => x.u === 'marine'), [{ u: 'marine', n: 30 }]);
  assert.equal(armyMergeOp(game, s, 'musketeer!#1', 'musketeer!'), null);
  assert.deepEqual(giftOf(ship.army), gift());
  // Brig: six slots. Fill them, the seventh refused.
  for (const k of ['marine', 'deckhand', 'marine', 'deckhand']) if (ship.army.length < ship.armySlots) assert.equal(armySplitOp(game, s, k, 2), null);
  assert.equal(ship.army.length, ship.armySlots);
  assert.equal(armySplitOp(game, s, 'marine', 2), 'No free slot in the army for a new stack');
  // Dismiss: a slot free again, the men gone, the pools with them.
  const men = ship.crew;
  const k = stackKey(ship.army.find((x) => x.u === 'deckhand' && x.p)!);
  assert.equal(armyDismissOp(game, s, k), null);
  assert.equal(ship.army.length, ship.armySlots - 1);
  assert.equal(ship.crew, men - 2);
  // Never in a boarding.
  Object.defineProperty(ship, 'grappled', { value: true, configurable: true });
  assert.equal(armySplitOp(game, s, 'marine', 2), 'Not in the middle of a boarding');
  delete (ship as unknown as Record<string, unknown>).grappled;
  ship.setArmy([{ u: 'marine', n: 3 }]);
  assert.equal(armyDismissOp(game, s, 'marine'), 'Keep at least one stack aboard');
});

// ------------------------------------------------------------------------------------------------ the letter

test('the thank-you letter: to every captain there was (no bots, QA, tests, nor those who sign up after), once — across restarts too; a dry run counts who has no room', () => {
  const { game } = makeGame();
  let clock = Date.now();
  game.wallNow = () => clock;
  const a = captain(game, 'Anne Bonny');
  const b = captain(game, 'Mary Read');
  captain(game, 'bot_17');
  captain(game, 'QA Rook');
  for (const s of game.sessions) game.saveSession(s);
  // Mary's ship full: no slot for the musketeers.
  b.ship!.setArmy([{ u: 'marine', n: 5 }, { u: 'deckhand', n: 5 }, { u: 'sailor', n: 5 }, { u: 'boarder', n: 2 }, { u: 'gunner', n: 2 }, { u: 'sea_guard', n: 2 }]);
  game.saveSession(b);
  clock += 1000;
  const plan = giftPlan(game.db, clock);
  assert.deepEqual(plan.map((r) => r.name).sort(), ['Anne Bonny', 'Mary Read']);
  assert.equal(plan.find((r) => r.name === 'Mary Read')!.room, false);
  assert.equal(plan.find((r) => r.name === 'Anne Bonny')!.room, true);
  assert.match(adminGift28(game, ['dry']), /^Gift dry run: 2 captains would get the letter; 1 of them have no room/);
  assert.equal(giftSend(game), 2);
  assert.ok(game.db.getKv(giftSentKey(a.accountId)) !== undefined);
  assert.ok(game.db.getKv(GIFT28_DONE) !== undefined);
  // Again — nothing; a captain who signs up later gets nothing either.
  assert.equal(giftSend(game), 0);
  // (her account made after the send's moment: the accounts' clock is the real one)
  game.db.setKv(GIFT28_DONE, { at: Date.now() - 1, n: 2 });
  for (const t = Date.now(); Date.now() <= t + 2; );
  const late = captain(game, 'Late Comer');
  game.saveSession(late);
  assert.equal(giftPlan(game.db, clock).length, 0, 'nobody after the cut-off');
  assert.equal(giftSend(game), 0);
  assert.equal(adminGift28(game, ['status']), 'Gift letters sent so far: 2.');
});

test('the letter in port: the silver at once; the musketeers as a gift stack when a slot and ten hammocks are free — else they wait in the letter, «нет места»; taken once', () => {
  const { game } = makeGame();
  const s = captain(game, 'Grace');
  game.saveSession(s);
  giftSend(game);
  const ship = s.ship!;
  ship.docked = game.world.ports[0].id;
  const box = () => game.db.getKv<{ letters: { id: number; taken: boolean; units?: unknown; unitsTaken?: boolean; goldTaken?: boolean; subject: string }[] }>(`mail:${s.accountId}`)!;
  const id = box().letters[0].id;
  assert.equal(box().letters[0].subject, GIFT28_WORDS.en.subject);
  // No room: six stacks on a brig.
  ship.setArmy([{ u: 'marine', n: 5 }, { u: 'deckhand', n: 5 }, { u: 'sailor', n: 5 }, { u: 'boarder', n: 2 }, { u: 'gunner', n: 2 }, { u: 'sea_guard', n: 2 }]);
  const gold = s.profile!.gold;
  assert.equal(mailTake(game, s, id), GIFT28_NO_ROOM);
  assert.equal(s.profile!.gold, gold + GIFT28_SILVER, 'the silver at once');
  assert.ok(!giftOf(ship.army));
  assert.equal(box().letters[0].taken, false, 'the musketeers still wait');
  assert.equal(mailTake(game, s, id), GIFT28_NO_ROOM);
  assert.equal(s.profile!.gold, gold + GIFT28_SILVER, 'the silver only once');
  // Room made in the Crew window: a stack dismissed.
  assert.equal(armyDismissOp(game, s, 'sea_guard'), null);
  assert.equal(mailTake(game, s, id), null);
  assert.deepEqual(giftOf(ship.army), gift());
  assert.equal(box().letters[0].taken, true);
  assert.equal(mailTake(game, s, id), 'Nothing to collect');
  assert.equal(ship.army.filter((x) => x.g).length, 1);
  // Kept across a save.
  game.saveSession(s);
  assert.deepEqual(giftOf(s.profile!.army ?? []), gift());
});

test('the letter\'s words, the refusal and the replies read in Russian', () => {
  setLang('ru');
  try {
    const flat = (x: string) => x.replace(/\s+/g, ' ');
    for (const [en, ru] of giftPatterns()) if (!en.includes('{')) assert.equal(flat(serverText(en)), flat(ru));
    assert.equal(serverText(GIFT28_WORDS.en.subject), 'Бонус от команды GRAVETIDE');
    assert.match(flat(serverText(GIFT28_WORDS.en.body)), /^Спасибо, что играете и помогаете развивать проект!/);
    assert.equal(flat(serverText(GIFT28_NO_ROOM)), 'Нет места на корабле — увольте кого-нибудь, чтобы забрать мушкетёров.');
    assert.equal(flat(serverText('Collected 33333 silver from the letter.')), 'Из письма получено серебра: 33333.');
    assert.equal(flat(serverText('A gift stack keeps to itself: it never merges with hired men')), 'Подарочный отряд не объединяется с нанятыми бойцами');
  } finally {
    setLang('en');
  }
});

// ------------------------------------------------------------------------------------------------ every refill path

test('refill paths: a hire, First Aid, the record of the fallen (resurrection, the infirmary), the wounded below, the hands signed on, the beaten who come over — none of it fills the gift stack', () => {
  const { game } = makeGame();
  const s = captain(game, 'Keeper');
  const ship = s.ship!;
  ship.docked = null;
  ship.setArmy([{ u: 'marine', n: 30 }, gift(10)]);
  // A boarding: 4 of the gift fell, and 6 marines; First Aid and the won deck raise a half.
  ship.loseFrom('musketeer', 4, 'musketeer!');
  ship.loseFrom('marine', 6);
  assert.equal(giftOf(ship.army)!.n, 6);
  afterBattle(game, ship, -1, [{ u: 'musketeer', n: 4, g: 1 }, { u: 'marine', n: 6 }], 0.5, -1, [], true, false);
  assert.equal(giftOf(ship.army)!.n, 6, 'First Aid passes the gift over');
  assert.equal(plainOf(ship.army), 0, 'nor are its dead raised into a hired stack');
  assert.equal(ship.army.find((x) => x.u === 'marine')!.n, 27, 'the marines\' half stands again');
  // The record of the fallen: no musketeers on it — nothing to resurrect, nothing for the infirmary.
  const rec = fallenOf(game, s);
  assert.equal(rec.list.filter((e) => e.u === 'musketeer').length, 0);
  recordFallen(game, s, [{ u: 'musketeer', n: 3, g: 1 }]);
  assert.equal(fallenOf(game, s).list.filter((e) => e.u === 'musketeer').length, 0);
  assert.equal(resView(game, s).rows.filter((r) => r.u === 'musketeer').length, 0, 'no «Воскресить» row for them');
  // The infirmary's instant raise of musketeers (were any on a record) lands in a hired stack, never the gift.
  raiseInstant(game, s, [{ u: 'musketeer', n: 2 }]);
  assert.equal(giftOf(ship.army)!.n, 6);
  assert.equal(plainOf(ship.army), 2);
  ship.setArmy([{ u: 'marine', n: 27 }, gift(6)]);
  // The guns: the gift's dead never go below as wounded, nor on the record.
  ship.setArmy([gift(6)]);
  const w0 = ship.wounded;
  const fell = killMen(game, ship, 2, null);
  assert.ok(fell > 0);
  assert.equal(ship.wounded, w0, 'none of the gift carried below');
  assert.equal(fallenOf(game, s).list.filter((e) => e.u === 'musketeer').length, 0);
  // Hands signed on by themselves (the head count raised): deckhands, not the gift.
  ship.setArmy([{ u: 'marine', n: 10 }, gift(4)]);
  ship.crew = ship.crew + 5;
  assert.equal(giftOf(ship.army)!.n, 4);
  // A hire of musketeers: their own stack.
  ship.addMen('musketeer', 7);
  assert.equal(giftOf(ship.army)!.n, 4);
  assert.equal(plainOf(ship.army), 7);
  // The beaten who come over as musketeers: into the hired stack.
  beatenJoin(game, ship, [{ u: 'musketeer', n: 40 }]);
  assert.equal(giftOf(ship.army)!.n, 4);
});

test('refill paths in the hexes: the gift goes to battle marked, its losses come off it, the rally and the fight\'s raising never stand it up again, its dead are told apart', () => {
  const { game } = makeGame();
  const s = captain(game, 'Hexer');
  const other = captain(game, 'Foe');
  const ship = s.ship!;
  ship.setArmy([{ u: 'musketeer', n: 8 }, gift(10)]);
  const side = sideOf(game, ship, other.ship!, true);
  const g = side.army!.find((x) => x.gift)!;
  assert.equal(g.sk, 'musketeer!');
  assert.equal(side.army!.find((x) => x.u === 'musketeer' && !x.gift)!.sk, 'musketeer');
  // The deck: the gift's stack 10 → 6, the hired 8 → 8.
  const mk = (id: number, sk: string, gift: boolean, start: number, count: number) => ({ id, side: 0, src: 'musketeer', unit: 'musketeer', sk, ...(gift ? { gift: 1 } : {}), start, count }) as unknown as TacBattle['stacks'][number];
  const seen = new Map<number, number>();
  const st = [mk(1, 'musketeer!', true, 10, 6), mk(2, 'musketeer', false, 8, 8)];
  takeLosses(game, ship, other.ship!, st, seen, 1, 18);
  assert.equal(giftOf(ship.army)!.n, 6, 'the gift\'s losses off the gift');
  assert.equal(plainOf(ship.army), 8, 'not off the hired');
  // A raising in the fight (6 → 9) never stands aboard; the raised falling again (9 → 7) cost the ship nothing.
  st[0] = mk(1, 'musketeer!', true, 10, 9);
  takeLosses(game, ship, other.ship!, st, seen, 1, 18);
  assert.equal(giftOf(ship.army)!.n, 6, 'the fight\'s raising passes the gift over');
  st[0] = mk(1, 'musketeer!', true, 10, 7);
  takeLosses(game, ship, other.ship!, st, seen, 1, 18);
  assert.equal(giftOf(ship.army)!.n, 6);
  assert.equal(plainOf(ship.army), 8);
  // A hired stack's rally stands it up again as before.
  st[1] = mk(2, 'musketeer', false, 8, 5);
  takeLosses(game, ship, other.ship!, st, seen, 1, 18);
  assert.equal(plainOf(ship.army), 5);
  st[1] = mk(2, 'musketeer', false, 8, 7);
  takeLosses(game, ship, other.ship!, st, seen, 1, 18);
  assert.equal(plainOf(ship.army), 7);
  // The battle's losses tell the gift's dead apart (First Aid and the record pass them over).
  const bt = { stacks: [{ ...st[0], summoned: false, own: 0 }, { ...st[1], summoned: false, own: 0 }] } as unknown as TacBattle;
  const lost = lossesOf(bt, 0);
  assert.deepEqual(lost.find((x) => x.g), { u: 'musketeer', n: 3, g: 1 });
  assert.deepEqual(lost.find((x) => !x.g), { u: 'musketeer', n: 1 });
});
