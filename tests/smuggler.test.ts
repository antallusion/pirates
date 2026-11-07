// «Услуга контрабандиста» (forum, Эдуард, post 92: the campaign's chapter 11 sent a Crown privateer to a port of the
// Whispering archipelago that shut its quay to her patent — the story stopped). A harbour shut for her patent or her
// standing tells the three ways in and offers the smuggler's boat; her yes pays a level-scaled fare (a quarter of a
// sea-hour for a quest's step, three quarters for trade) and puts her in with no customs; the boat takes her in and out
// again for half an hour; skulls stay the law's business.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PENNANT_SECONDS } from '../shared/src/data/colours.ts';
import { PATENT_MS } from '../shared/src/data/patent.ts';
import { QUESTS } from '../shared/src/data/quests.ts';
import { SMUGGLE_PASS_MS, SMUGGLE_SAY, smugglePatterns, smugglePrice } from '../shared/src/data/smuggler.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { canDock } from '../server/src/game/player.ts';
import { questAt, smuggleOffer } from '../server/src/game/smuggler.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { smugglerHtml } from '../client/src/ui/smuggler.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

/** A Crown privateer of level 40, hove to off Fogmouth's quay (the Fog Brokers': her patent's enemy). */
function privateer(name: string): { game: Game; s: PlayerSession; c: FakeConn } {
  const { game } = makeGame();
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  p.level = 40;
  p.gold = 100_000;
  p.pvp.flag = 'faction';
  p.pvp.city = 'crown';
  p.pvp.played = PENNANT_SECONDS + 1;
  p.pvp.patent = { by: 'crown', until: game.wallNow() + PATENT_MS, since: game.wallNow() };
  const port = game.portById('fogmouth')!;
  const ship = s.ship!;
  ship.docked = null;
  p.docked = null;
  ship.state.x = port.x;
  ship.state.y = port.y;
  ship.state.speed = 0;
  ship.lastCombat = -1000;
  ship.lastHitAt = -1000;
  ship.cargo = {} as typeof ship.cargo;
  game.grid.upsert(ship.id, port.x, port.y);
  return { game, s, c };
}

test('the fare: by her level, in fifties; a quest’s step a third of plain trade', () => {
  for (const lv of [1, 10, 20, 40, 60]) {
    const q = smugglePrice(lv, true), t = smugglePrice(lv, false);
    assert.equal(q % 50, 0);
    assert.equal(t % 50, 0);
    assert.ok(q < t && Math.abs(t / q - 3) < 0.15, `level ${lv}: ${q} / ${t}`);
  }
  assert.ok(smugglePrice(10, true) < smugglePrice(30, true) && smugglePrice(30, true) < smugglePrice(60, true));
  assert.equal(smugglePrice(20, true), 1050, 'a quarter of a sea-hour of ⚓4 waters');
});

test('a quay shut for her patent: the refusal tells the ways in and offers the boat; her yes pays, no customs, she is in; the boat again for half an hour', () => {
  const { game, s, c } = privateer('Smuggled Eduard');
  const p = s.profile!;
  assert.equal(canDock(p, 'brokers').smuggle, 'patent');
  c.push({ t: 'dock' });
  assert.equal(s.ship!.docked, null, 'refused');
  const toast = c.all('toast').find((t) => t.msg.startsWith('Your patent is at war'));
  assert.ok(toast && /Ways in: wait out the patent \(7 days\), strike its colours/.test(toast.msg), toast?.msg);
  const offer = c.all('smuggler').at(-1)?.offer;
  assert.ok(offer, 'the boat offered');
  assert.equal(offer.why, 'patent');
  assert.equal(offer.days, 7);
  assert.equal(offer.quest, false);
  assert.equal(offer.price, smugglePrice(40, false));
  // her yes: paid, in, the pass on her
  const gold = p.gold;
  s.ship!.cargo.cursed_relics = 2; // contraband: the smugglers take her past the customs
  c.push({ t: 'dock', smuggle: true });
  assert.equal(s.ship!.docked, 'fogmouth', 'in by night');
  assert.equal(p.gold, gold - offer.price);
  assert.equal(s.ship!.cargo.cursed_relics, 2, 'no search');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('The smuggler’s boat puts you in by night')));
  // out and back in within the half hour: nothing more to pay
  s.ship!.docked = null;
  p.docked = null;
  c.push({ t: 'dock' });
  assert.equal(s.ship!.docked, 'fogmouth', 'the boat again');
  assert.equal(p.gold, gold - offer.price, 'paid once');
  assert.ok(c.all('toast').some((t) => t.msg === SMUGGLE_SAY.again));
  // the half hour over: shut again
  s.ship!.docked = null;
  p.docked = null;
  game.wallSkew += SMUGGLE_PASS_MS + 1000;
  c.push({ t: 'dock' });
  assert.equal(s.ship!.docked, null, 'the pass ran out');
  // short of silver: the price said, nothing taken
  p.gold = 10;
  c.push({ t: 'dock', smuggle: true });
  assert.equal(s.ship!.docked, null);
  assert.equal(p.gold, 10);
});

test('a quest’s step in the shut harbour: the quest’s fare; a flag that holds her an enemy is got round too; skulls are not', () => {
  const { game, s } = privateer('Quest Eduard');
  const p = s.profile!;
  const port = game.portById('fogmouth')!;
  // any quest whose step names a port, pointed at Fogmouth
  const q = QUESTS.find((x) => x.steps.some((st) => st.type === 'visit'))!;
  const k = q.steps.findIndex((st) => st.type === 'visit');
  const st = q.steps[k] as { port: string };
  const was = st.port;
  st.port = 'fogmouth';
  try {
    p.quests.active = [{ id: q.id, step: k, progress: 0 } as never];
    assert.ok(questAt(p, 'fogmouth'));
    const o = smuggleOffer(game, p, port, 'patent');
    assert.equal(o.quest, true);
    assert.equal(o.price, smugglePrice(40, true));
  } finally {
    st.port = was;
  }
  // no patent, the Brokers' enemy: the boat too
  p.pvp.patent = null;
  p.reputation.brokers = -80;
  assert.equal(canDock(p, 'brokers').smuggle, 'standing');
  // skulls: the law's (a pardon, the wash) — no boat
  p.reputation.brokers = 0;
  p.reputation.crown = 0;
  p.infamy = 1e6;
  const crown = canDock(p, 'crown');
  assert.equal(crown.ok, false);
  assert.equal(crown.smuggle, undefined);
});

test('in Russian: the refusal, the question and its ways — no Latin', () => {
  setLang('ru');
  try {
    for (const [en] of smugglePatterns()) {
      const ru = serverText(en.replace('{0}', '7').replace('{1}', '30'));
      assert.ok(!/[A-Za-z]/.test(ru), `${en} → ${ru}`);
    }
    const ways = serverText(SMUGGLE_SAY.patentWays.replace('{0}', '5'));
    assert.match(ways, /дождаться\s+конца\s+патента\s+—\s+осталось\s+дней:\s+5/u);
    const html = smugglerHtml({ port: 'fogmouth', price: 1050, quest: true, why: 'patent', days: 5, mins: 30 }, 'Фогмут');
    const text = html.replace(/<[^>]+>/g, ' ');
    assert.ok(!/[A-Za-z]/.test(text), text);
    assert.match(text, /дней: 5/);
    assert.match(text, /контрабандист/);
  } finally {
    setLang('en');
  }
});
