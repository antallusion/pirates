// Side quests with perks (docs/12 P9): the handwritten chains and the tattoos they end with, Old Needle inking them in
// a haven of the Brethren, the places on a captain's skin, the deeds that earn tattoos and open hidden quests, a race
// against the clock, a choice of three rewards, and the generator's new plots — all in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HIDDEN_QUESTS, SIDE_QUESTS, TATTOOS, TATTOO_BY_ID, sidePatterns, tattooSlots } from '../shared/src/data/sidequests.ts';
import { PLOTS, generateQuests } from '../shared/src/data/questgen.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { questEvent, questOffers } from '../server/src/game/quests.ts';
import { setTattoo, stepTattoos, takeChoice, tattooCount } from '../server/src/game/tattoos.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { Game } from '../server/src/game/Game.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string): { s: PlayerSession; c: ReturnType<typeof join> } {
  const c = join(game, name);
  return { s: game.sessionByName(name)!, c };
}

function start(game: Game, s: PlayerSession, id: string): void {
  s.profile!.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now });
}

test('fourteen chains of three, each ending in a tattoo; every giver in a port of this sea; thirty tattoos', () => {
  const { game } = makeGame();
  assert.equal(TATTOOS.length, 30);
  assert.ok(SIDE_QUESTS.length >= 42, `${SIDE_QUESTS.length} side quests`);
  const chains = new Set(SIDE_QUESTS.map((q) => q.template));
  assert.ok(chains.size >= 14, `${chains.size} chains`);
  for (const chain of chains) {
    const qs = SIDE_QUESTS.filter((q) => q.template === chain);
    const last = qs[qs.length - 1];
    assert.ok(last.reward.tattoo && TATTOO_BY_ID[last.reward.tattoo], `${chain} ends in a tattoo`);
    assert.ok(qs.some((q) => q.reward.choice), `${chain} has a choice of three`);
  }
  for (const q of [...SIDE_QUESTS, ...HIDDEN_QUESTS]) {
    assert.ok(game.portById(q.port), `${q.id}: ${q.port} is a port`);
    assert.equal(QUESTS_BY_ID[q.id], q, 'known to the quest system');
    for (const st of q.steps) if (st.type === 'visit' || st.type === 'race') assert.ok(game.portById(st.port), `${q.id}: ${st.port}`);
  }
  assert.ok(HIDDEN_QUESTS.every((q) => q.hidden), 'hidden quests are never offered');
});

test('a chain’s quests are offered in their port in order; hidden ones never', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Chain Chloe');
  const p = s.profile!;
  p.level = 20;
  const port = game.portById('gravesend')!;
  const ids = () => questOffers(p, port).map((o) => o.q.id);
  assert.ok(ids().includes('side_hunter_1'));
  assert.ok(!ids().includes('side_hunter_2'), 'not before the first');
  p.quests.done.push('side_hunter_1');
  assert.ok(ids().includes('side_hunter_2'));
  for (const h of HIDDEN_QUESTS) assert.ok(!questOffers(p, game.portById(h.port)!).some((o) => o.q.id === h.id));
});

test('the last quest of a chain earns a tattoo; Old Needle inks it in a haven of the Brethren and it works on the ship', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Inked Ivy');
  const p = s.profile!;
  const ship = s.ship!;
  start(game, s, 'side_hunter_3');
  for (let i = 0; i < 3; i++) questEvent(game, s, { k: 'named' });
  assert.ok(p.quests.done.includes('side_hunter_3'));
  assert.deepEqual(p.tattoos!.pending, ['sabres']);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Old Needle will ink')));
  // A Crown port has no Old Needle.
  const crown = game.world.ports.find((x) => x.faction === 'crown')!;
  ship.docked = crown.id;
  stepTattoos(game);
  assert.deepEqual(p.tattoos!.pending, ['sabres'], 'still waiting');
  const haven = game.world.ports.find((x) => x.faction === 'confederacy')!;
  ship.docked = haven.id;
  stepTattoos(game);
  assert.deepEqual(p.tattoos!.owned, ['sabres']);
  assert.equal(p.tattoos!.active[0], 'sabres', 'into a free place at once');
  assert.ok(ship.hasEffect('tattoos'), 'its strength on the ship');
  assert.equal(c.last('tattoos')!.view.owned[0], 'sabres');
});

test('places: two, and one more at 15, 30 and 45, and one for Old Needle’s mark; changed only in port', () => {
  assert.equal(tattooSlots(1, []), 2);
  assert.equal(tattooSlots(15, []), 3);
  assert.equal(tattooSlots(45, []), 5);
  assert.equal(tattooSlots(45, ['needle']), 6);
  const { game } = makeGame();
  const { s } = captain(game, 'Swallow Sue');
  const p = s.profile!;
  const ship = s.ship!;
  p.tattoos = { owned: ['swallow', 'fish'], pending: [], active: [], counts: {} };
  ship.docked = null;
  assert.equal(setTattoo(game, s, 0, 'swallow'), 'Tattoos are changed in a tavern.');
  ship.docked = game.world.ports[0].id;
  assert.equal(setTattoo(game, s, 2, 'swallow'), 'That place is not yours yet.');
  assert.equal(setTattoo(game, s, 0, 'anchor'), 'No tattoo of that kind is yours.');
  const speed0 = ship.stats.maxSpeed;
  assert.equal(setTattoo(game, s, 0, 'swallow'), null);
  assert.ok(ship.stats.maxSpeed > speed0, 'the Swallow: faster');
  // The same tattoo moved: the old place is emptied.
  assert.equal(setTattoo(game, s, 1, 'swallow'), null);
  assert.deepEqual(p.tattoos.active.slice(0, 2), [null, 'swallow']);
  assert.equal(setTattoo(game, s, 1, null), null);
  assert.ok(ship.stats.maxSpeed <= speed0 + 1e-9, 'off again');
});

test('deeds earn tattoos: fifty fish fought, a hundred bottles… and three skulls begin a hidden quest', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Deed Dora');
  const p = s.profile!;
  tattooCount(game, s, 'fought', 50);
  assert.ok(p.tattoos!.pending.includes('hook'), 'the Hook');
  tattooCount(game, s, 'skulls', 2);
  assert.ok(!p.quests.active.some((a) => a.id === 'hidden_curse'));
  tattooCount(game, s, 'skulls');
  assert.ok(p.quests.active.some((a) => a.id === 'hidden_curse'), 'the Fisherman’s Curse');
  assert.ok(c.all('toast').some((t) => t.msg === 'A new quest begins: The Fisherman’s Curse.'));
  // Ten souls saved: the Grateful Drowned.
  p.rescued = 10;
  stepTattoos(game);
  assert.ok(p.quests.active.some((a) => a.id === 'hidden_grateful'));
});

test('the new steps move with their deeds: a named pirate, tribute, a letter, souls saved', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Step Stella');
  const p = s.profile!;
  p.level = 30;
  start(game, s, 'side_qm_1'); // tribute ×2
  start(game, s, 'side_letters_1'); // a letter
  start(game, s, 'side_cat_3'); // three souls
  questEvent(game, s, { k: 'tribute' });
  questEvent(game, s, { k: 'tribute' });
  assert.ok(p.quests.done.includes('side_qm_1'));
  questEvent(game, s, { k: 'letter' });
  assert.ok(p.quests.done.includes('side_letters_1'));
  questEvent(game, s, { k: 'rescue', n: 2 });
  assert.ok(!p.quests.done.includes('side_cat_3'));
  questEvent(game, s, { k: 'rescue', n: 1 });
  assert.ok(p.quests.done.includes('side_cat_3'));
  assert.ok(p.tattoos!.pending.includes('cat'));
});

test('a race: in port within the time wins; too late, the quest is lost', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Racing Rae');
  const p = s.profile!;
  start(game, s, 'side_clerk_2');
  const st = QUESTS_BY_ID.side_clerk_2.steps[0];
  assert.equal(st.type, 'race');
  game.now += 60;
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.ok(p.quests.active.some((a) => a.id === 'side_clerk_2'), 'still in time');
  questEvent(game, s, { k: 'dock', port: game.portById('blackwater')! });
  assert.ok(p.quests.done.includes('side_clerk_2'), 'won');
  // Once more, too slow.
  p.quests.done = p.quests.done.filter((x) => x !== 'side_clerk_2');
  start(game, s, 'side_clerk_2');
  game.now += 2000;
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.ok(!p.quests.active.some((a) => a.id === 'side_clerk_2'));
  assert.ok(c.all('toast').some((t) => t.msg === 'Too late: A Race to Market is lost.'));
});

test('a choice of three: three pieces for different places, the one taken goes to the locker', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Choosy Cass');
  const p = s.profile!;
  start(game, s, 'side_clerk_2');
  questEvent(game, s, { k: 'dock', port: game.portById('blackwater')! });
  const ch = p.choice!;
  assert.equal(ch.items.length, 3);
  assert.equal(new Set(ch.items.map((it) => it.base)).size, 3);
  assert.ok(ch.items.every((it) => it.rarity >= 2), 'fine or better');
  assert.ok(c.last('choice')!.view);
  const stash0 = p.stash.length;
  const want = ch.items[1];
  assert.equal(takeChoice(game, s, 1), null);
  assert.equal(p.stash.length, stash0 + 1);
  assert.equal(p.stash[p.stash.length - 1].base, want.base);
  assert.equal(p.choice, null);
  assert.equal(takeChoice(game, s, 0), 'Nothing to choose from.');
  assert.equal(c.last('choice')!.view, null);
});

test('the generator’s new plots: over six hundred new jobs, their steps real, all in Russian', () => {
  const world = generateWorld(1337);
  const quests = generateQuests(world, 1337);
  const P9 = ['fish_order', 'trophy_fish', 'whale_hunt', 'orca_cull', 'shark_bounty', 'save_whale', 'named_trail', 'merchant_tip', 'caravan_guard', 'outpost_defense', 'resident_request', 'bottle_letter', 'pet', 'regatta'];
  for (const id of P9) assert.ok(PLOTS.some((p) => p.id === id), id);
  const fresh = quests.filter((q) => P9.includes(q.template!.split('.')[0]));
  assert.ok(fresh.length >= 600, `${fresh.length} new jobs`);
  const race = fresh.find((q) => q.steps[0].type === 'race')!;
  assert.ok(race.steps[0].type === 'race' && race.steps[0].seconds >= 300);
  assert.ok(fresh.some((q) => q.steps.some((st) => st.type === 'named')));
  assert.ok(fresh.some((q) => q.steps.some((st) => st.type === 'tribute')));
  assert.ok(fresh.some((q) => q.steps.some((st) => st.type === 'letters')));
  setLang('ru');
  for (const q of fresh.filter((_, i) => i % 7 === 0)) {
    for (const t of [q.name, q.summary, ...q.steps.map((st) => st.text)]) assert.ok(/[а-яё]/i.test(serverText(t)), `${q.id}: ${t}`);
  }
  setLang('en');
});

test('the side quests read in Russian', () => {
  setLang('ru');
  for (const [en, ru] of sidePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  for (const q of [...SIDE_QUESTS, ...HIDDEN_QUESTS]) {
    for (const t of [q.name, q.summary, q.mentor, ...q.steps.map((st) => st.text)]) assert.ok(/[а-яё]/i.test(serverText(t)), `${q.id}: ${t}`);
  }
  assert.equal(serverText('Old Needle will ink Crossed Sabres for you in any haven of the Brethren.').replace(/\u00a0/g, ' '), 'Старая Игла набьёт вам «Скрещённые сабли» в любой гавани Братства.');
  assert.equal(serverText('A skull in the net.').replace(/\u00a0/g, ' '), 'В сети — череп.');
  setLang('en');
});
