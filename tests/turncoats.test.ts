// Captive captains in service (docs/12 P10 #16): a taken captain carries a post, traits, a skipper's gifts and his
// loyalty; turned at a harbour master he signs as an officer (a former enemy) or a skipper, refuses, or escapes; days
// in irons soften him; a skipper home grows more loyal, or, disloyal, runs off with the smallest hull.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { LOYALTY_PER_VOYAGE, turncoatPatterns } from '../shared/src/data/turncoats.ts';
import type { Game } from '../server/src/game/Game.ts';
import { seizeCaptain, takeCaptive } from '../server/src/game/prizes.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { captiveLoyalty, skipperHome, takeSkipper, turnCaptive, turnCost } from '../server/src/game/turncoats.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function captor(game: Game, name: string): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 50_000;
  return s;
}

function capture(game: Game, s: PlayerSession, role: 'pirate' | 'merchant' = 'pirate'): void {
  const npc = game.spawnNpcShip(role, 'brig', role === 'pirate' ? 'confederacy' : 'league', s.ship!.state.x + 400, s.ship!.state.y, 0);
  seizeCaptain(npc);
  assert.equal(takeCaptive(game, s, npc), true);
}

test('a taken captain: his post by what he commanded, his traits (a former enemy), a skipper’s gifts, his loyalty', () => {
  const { game } = makeGame();
  const s = captor(game, 'Jailer Jo');
  capture(game, s, 'pirate');
  const c = s.profile!.captives[0];
  assert.ok(['master_gunner', 'boatswain', 'lieutenant'].includes(c.role!));
  assert.ok(c.traits!.includes('former_enemy'));
  assert.equal(c.traits!.length, 3);
  assert.ok(c.skills!.length >= 1);
  assert.ok(c.loyalty! >= 20 && c.loyalty! <= 45);
  // Days in irons soften him.
  const l0 = captiveLoyalty(game, s.profile!, c);
  game.now += DAY_LENGTH_SEC * 2;
  assert.ok(captiveLoyalty(game, s.profile!, c) >= Math.min(95, l0 + 10));
});

test('turned: an officer signs (a former enemy), a refusal holds for the day, a disloyal one escapes', () => {
  const { game } = makeGame();
  const s = captor(game, 'Recruiter Rae');
  const p = s.profile!;
  capture(game, s);
  capture(game, s);
  capture(game, s);
  const [a, b, c] = p.captives;
  a.loyalty = 90;
  b.loyalty = 50;
  c.loyalty = 0;
  p.reputation.confederacy = -60;
  const officers0 = p.company.officers.length;
  const cost = turnCost(a);
  const g0 = p.gold;
  game.rng.chance = () => true;
  assert.equal(turnCaptive(game, s, 0, 'officer'), null);
  assert.equal(p.company.officers.length, officers0 + 1);
  const o = p.company.officers.at(-1)!;
  assert.equal(o.name, a.name);
  assert.ok(o.traits.includes('former_enemy'));
  assert.equal(p.gold, g0 - cost);
  assert.equal(p.captives.length, 2);
  // A refusal: he holds out for the day, and the silver stays.
  game.rng.chance = () => false;
  const g1 = p.gold;
  assert.equal(turnCaptive(game, s, 0, 'skipper'), null);
  assert.equal(p.captives.length, 2);
  assert.equal(p.gold, g1);
  assert.equal(turnCaptive(game, s, 0, 'skipper'), 'He will not hear of it again today.');
  // Disloyal: gone over the side (one time in two).
  game.rng.float = () => 0;
  assert.equal(turnCaptive(game, s, 1, 'skipper'), null);
  assert.equal(p.captives.length, 1);
  assert.equal(p.captives[0].name, b.name);
});

test('a skipper: turned into her pool, takes a caravan, comes home more loyal — or runs off with the smallest hull', () => {
  const { game } = makeGame();
  const s = captor(game, 'Owner Ola');
  const p = s.profile!;
  capture(game, s, 'merchant');
  p.captives[0].loyalty = 90;
  game.rng.chance = () => true;
  assert.equal(turnCaptive(game, s, 0, 'skipper'), null);
  assert.equal(p.skippers!.length, 1);
  const rec = takeSkipper(p)!;
  assert.equal(p.skippers!.length, 0);
  const hulls = [{ loadout: { classId: 'brig', name: 'Big' } }, { loadout: { classId: 'sloop', name: 'Small' } }];
  assert.equal(skipperHome(game, s.accountId, rec, hulls), -1, 'a loyal one comes home');
  assert.equal(p.skippers!.length, 1);
  assert.equal(p.skippers![0].loyalty, Math.min(95, rec.loyalty + LOYALTY_PER_VOYAGE));
  assert.equal(p.skippers![0].voyages, 1);
  const bad = { ...takeSkipper(p)!, loyalty: 20 };
  const c = game.sessionByName('Owner Ola')!;
  assert.equal(skipperHome(game, c.accountId, bad, hulls), 1, 'the sloop is gone');
  assert.equal(p.skippers!.length, 0);
});

test('turncoats read in Russian', () => {
  setLang('ru');
  const t = (x: string) => serverText(x).replace(/\u00a0/g, ' ');
  assert.equal(t('Hale Morrow will skipper your caravans.'), 'Капитан Хейл Морроу будет водить ваши караваны.');
  assert.equal(t('He will not hear of it again today.'), 'Сегодня он и слушать об этом не станет.');
  for (const [en, ru] of turncoatPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
