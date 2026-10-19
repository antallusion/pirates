// «Ремонт» does the repair and says so (owner, 2026-10-19: «Кнопка ремонт должна запускать фактический ремонт если есть
// необходимые ресурсы. Щас нажимая ремонт с моей стороны ниче не происходит»). Reproduced: at sea with planks and
// sailcloth aboard the carpenters did mend her — about a hundredth of the hull a second, with no word at all, no number
// over her, nothing said when they stopped; with the sails alone torn and no sailcloth aboard the button was offered
// all the same and its press only put a grey line in the toasts' queue. Now:
//  - the press says what they set to and with what (hull %, sails %, the planks and sailcloth aboard, the minutes);
//  - a green «+N» rises over her every two seconds while they work (the abilities' mend number);
//  - when they stop (all mended, out of stores, or her own «Хватит чинить») — what was mended and what it took;
//  - short of what they mend with: exactly what is wanted, as bad news, in both tongues; a part they cannot mend
//    (the sails with no sailcloth) is said while they mend the rest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE } from '../shared/src/constants.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { NO_CLOTH, NO_CLOTH_PART, NO_STORES } from '../server/src/game/searepair.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { repairState } from '../client/src/ui/dealings.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

function atSea(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = 30000;
  s.ship!.state.y = 80000;
  s.ship!.crew = s.ship!.stats.crewMax;
  return { c, s };
}

const toasts = (c: FakeConn, from = 0) => c.inbox.slice(from).filter((m) => m.t === 'toast') as { msg: string; kind: string }[];

/** The sea's emitted events of a kind about her ship, while `fn` runs. */
function emitted(game: Game, fn: () => void): { k: string; ship?: number; id?: string; heal?: number }[] {
  const out: { k: string; ship?: number; id?: string; heal?: number }[] = [];
  const was = game.emit.bind(game);
  game.emit = (ev, x, y) => {
    out.push(ev as never);
    was(ev, x, y);
  };
  try {
    fn();
  } finally {
    game.emit = was;
  }
  return out;
}

test('«Ремонт» with planks and sailcloth: said as it starts, a «+N» over her as they work, what was mended and used when done', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Mend Mira');
  const ship = s.ship!;
  ship.hull = ship.stats.hullMax * 0.4;
  ship.sails = ship.stats.sailHpMax * 0.6;
  ship.cargo.planks = 40;
  ship.cargo.sailcloth = 10;
  const from = c.inbox.length;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, true);
  const start = toasts(c, from);
  assert.equal(start.length, 1);
  assert.match(start[0].msg, /^The carpenters set to: hull 40%, sails 60%; 40 planks and 10 sailcloth aboard, about \d+ min\.$/);
  assert.equal(start[0].kind, 'good');
  const h0 = ship.hull;
  const evs = emitted(game, () => {
    for (let i = 0; i < 6 * TICK_RATE; i++) game.step();
  });
  const nums = evs.filter((e) => e.k === 'skill' && e.ship === ship.id && e.id === 'repair' && (e.heal ?? 0) > 0);
  assert.ok(nums.length >= 2, `a «+N» every two seconds: ${nums.length}`);
  assert.ok(ship.hull > h0 + ship.stats.hullMax * 0.04, 'the hull fills');
  // to the end
  const mid = c.inbox.length;
  for (let i = 0; i < 120 * TICK_RATE && ship.repairing; i++) game.step();
  assert.equal(ship.repairing, false);
  const end = toasts(c, mid).filter((t) => /^Repairs done/.test(t.msg));
  assert.equal(end.length, 1, JSON.stringify(toasts(c, mid)));
  assert.match(end[0].msg, /^Repairs done: hull 100% \(\+\d+\), sails 100% \(\+\d+\); used \d+ planks, \d+ sailcloth\.$/);
  assert.ok((ship.cargo.planks ?? 0) < 40 && (ship.cargo.sailcloth ?? 0) < 10, 'the stores used');
  // in Russian
  setLang('ru');
  try {
    assert.match(serverText(start[0].msg).replace(/\s/g, ' '), /^Плотники взялись за ремонт: корпус 40%, паруса 60%; в трюме досок 40, парусины 10, около \d+ мин\.$/);
    assert.match(serverText(end[0].msg).replace(/\s/g, ' '), /^Ремонт: корпус 100% \(\+\d+\), паруса 100% \(\+\d+\); ушло досок \d+, парусины \d+\.$/);
  } finally {
    setLang('en');
  }
});

test('«Хватит чинить»: what was mended so far', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Stop Stella');
  const ship = s.ship!;
  ship.hull = ship.stats.hullMax * 0.3;
  ship.cargo.planks = 40;
  c.push({ t: 'repair', on: true });
  for (let i = 0; i < 4 * TICK_RATE; i++) game.step();
  const from = c.inbox.length;
  c.push({ t: 'repair', on: false });
  assert.equal(ship.repairing, false);
  assert.ok(toasts(c, from).some((t) => /^Repairs done: hull \d+% \(\+\d+\)/.test(t.msg) && t.kind === 'good'), JSON.stringify(toasts(c, from)));
});

test('short of what they mend with: exactly what is wanted, as bad news, RU and EN; a part they cannot mend is said while they mend the rest', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Short Sasha');
  const ship = s.ship!;
  // the sails alone torn, no sailcloth
  ship.cargo = { planks: 20 };
  ship.sails = ship.stats.sailHpMax * 0.4;
  let from = c.inbox.length;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, false);
  assert.deepEqual(toasts(c, from).map((t) => [t.msg, t.kind]), [[NO_CLOTH, 'bad']]);
  // nothing at all aboard
  ship.cargo = {};
  ship.hull = ship.stats.hullMax * 0.5;
  from = c.inbox.length;
  c.push({ t: 'repair', on: true });
  assert.deepEqual(toasts(c, from).map((t) => [t.msg, t.kind]), [[NO_STORES, 'bad']]);
  // hull and sails, planks only: the hull mended, the sails said
  ship.cargo = { planks: 20 };
  from = c.inbox.length;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, true);
  const t = toasts(c, from);
  assert.match(t[0].msg, /^The carpenters set to/);
  assert.deepEqual([t[1].msg, t[1].kind], [NO_CLOTH_PART, 'bad']);
  setLang('ru');
  try {
    for (const m of [NO_CLOTH, NO_STORES, NO_CLOTH_PART]) assert.ok(!/[A-Za-z]/.test(serverText(m)), `RU: ${serverText(m)}`);
  } finally {
    setLang('en');
  }
});

test('the button: hurt, «Ремонт» is there — short of stores too (its press says what is wanted); «short» means nothing of her harm can be mended', () => {
  const self = (planks: number, cloth: number, needP: number, needC: number) => ({ dockedAt: null, seaRepair: { hullPerMin: 1, sailsPerMin: 1, minutes: 1, planks: needP, cloth: needC, havePlanks: planks, haveCloth: cloth } }) as never;
  const you = (hull: number, sails: number) => ({ hull, hullMax: 100, sails, sailsMax: 100, flags: 0 });
  // the sails alone torn, planks but no sailcloth: short (it was «not short», and the press did nothing)
  assert.equal(repairState(self(10, 0, 0, 3), you(100, 40), false)!.short, true);
  // the hull hurt, planks aboard: not short
  assert.equal(repairState(self(10, 0, 2, 3), you(50, 40), false)!.short, false);
  // the sails, sailcloth aboard: not short
  assert.equal(repairState(self(0, 5, 0, 3), you(100, 40), false)!.short, false);
  const a = buildActs({ repair: { repairing: false, combat: false, hurt: true, short: true } });
  assert.equal(a[0]?.id, 'repair');
  assert.notEqual(a[0].title, buildActs({ repair: { repairing: false, combat: false, hurt: true } })[0].title, 'its title says the stores are short');
});
