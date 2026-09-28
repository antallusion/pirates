// A ship's look (docs/12 P10 #12): the flag's field, colours and one of sixty emblems, the hull's paint, the sails'
// pattern, the lanterns — encoded for the sea to see; changed in port, only from what is hers; opened by deeds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEED_UNLOCKS, DEFAULT_LOOK, EMBLEM_COUNT, STARTING_UNLOCKS, decodeLook, encodeLook, lookPatterns } from '../shared/src/data/looks.ts';
import { sanitizeLooks, setLook, unlockDeed } from '../server/src/game/looks.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('sixty emblems; a look is encoded and read back; nonsense is refused', () => {
  assert.equal(EMBLEM_COUNT, 60);
  const l = { field: 3, c1: 2, c2: 1, c3: 5, emblem: 42, hull: 3, sail: 4, lamp: 2 };
  assert.deepEqual(decodeLook(encodeLook(l)), l);
  assert.equal(decodeLook('1.2.3'), null);
  assert.equal(decodeLook('99.0.0.0.0.0.0.0'), null);
  assert.equal(decodeLook('0.0.0.0.60.0.0.0'), null);
});

test('changed in port, only from what is hers; flown for all to see', () => {
  const { game } = makeGame();
  join(game, 'Painter Pia');
  const s = game.sessionByName('Painter Pia')!;
  const p = s.profile!;
  sanitizeLooks(p);
  assert.deepEqual(p.unlocks, STARTING_UNLOCKS);
  s.ship!.docked = null;
  const mine = { ...DEFAULT_LOOK, field: 1, c1: 3, emblem: 6 };
  assert.equal(setLook(game, s, encodeLook(mine)), 'The look is changed in port.');
  s.ship!.docked = game.world.ports[0].id;
  assert.equal(setLook(game, s, encodeLook({ ...mine, sail: 7 })), 'That is not yours yet.');
  assert.equal(setLook(game, s, encodeLook(mine)), null);
  assert.equal(s.ship!.look, encodeLook(mine));
  assert.equal(s.ship!.info().look, encodeLook(mine));
});

test('deeds open more: a regatta’s sails; three things for ten wonders; one for a chain’s quest', () => {
  const { game } = makeGame();
  join(game, 'Opener Ola');
  const s = game.sessionByName('Opener Ola')!;
  const p = s.profile!;
  sanitizeLooks(p);
  unlockDeed(game, s, 'regatta');
  for (const k of DEED_UNLOCKS.regatta) assert.ok(p.unlocks!.includes(k), k);
  const n0 = p.unlocks!.length;
  unlockDeed(game, s, 'wonders');
  assert.equal(p.unlocks!.length, n0 + 3);
  unlockDeed(game, s, 'quest');
  assert.equal(p.unlocks!.length, n0 + 4);
  const n1 = p.unlocks!.length;
  unlockDeed(game, s, 'regatta');
  assert.equal(p.unlocks!.length, n1, 'nothing twice');
});

test('the look reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText('A new look for your ship: sails.').replace(/\u00a0/g, ' '), 'Новое для облика корабля: паруса.');
  for (const [en, ru] of lookPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
