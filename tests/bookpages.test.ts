// The order book's twenty common pages after docs/18 (owner, 2026-10-03: «около 20 новых заклинаний»): over all six
// schools and levels 1–5, taught as docs/17's orders are (the ports' guilds, the drowned shrines, her island's guild),
// the physical schools' spending Stamina; each does in the battle what its words say, and the sea's mind gives them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Rng } from '../shared/src/rng.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { LEARNABLE, ORDERS, SCHOOLS, guildOf, guildPrice, heroBattle, isleGuildOrders, npcHeroBattle, orderRes, shrineOrder, zeroPrims } from '../shared/src/data/hero.ts';
import type { HeroBattle, OrderId } from '../shared/src/data/hero.ts';
import { BOOK_PAGES, BOOK_PAGE_IDS, SCHOOL_KIND, SICK_TURNS, isBookPage } from '../shared/src/data/paths.ts';
import { TAC_SPELLS, hexNeighbors, hexY } from '../shared/src/data/tactical.ts';
import type { TacSpellId } from '../shared/src/data/tactical.ts';
import { act, blow, canShoot, castSpell, modsOf, moralePoints, moveError, newBattle, quickFinish, spellError, tacStats, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import { heroInput, heroOf, learnAtGuild, onShrine } from '../server/src/game/hero.ts';
import { SERVER_RU_PATH } from '../client/src/lang/server.ru.path.ts';
import { EN as TAC_EN, RU as TAC_RU } from '../client/src/lang/ui/tactical.ts';
import { join, makeGame } from './helpers.ts';

const ARMY: ArmyStack[] = [{ u: 'marine', n: 30 }, { u: 'sailor', n: 40 }, { u: 'musketeer', n: 16 }, { u: 'deckhand', n: 30 }, { u: 'sea_guard', n: 10 }];
const hero = (book: OrderId[]): HeroBattle => heroBattle({ ...zeroPrims(), atk: 6, def: 6, pow: 6, will: 50 }, [], null, book, 999, { path: null, level: 30 });
const side = (h?: HeroBattle): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: null, hands: 0, marines: 0, gunners: 0, army: ARMY, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(h ? { hero: h } : {}),
});
const battle = (mine: OrderId[], hers: OrderId[] = [], seed = 6): TacBattle => newBattle(side(hero(mine)), side(hero(hers)), seed, 0, new Rng(seed));
const of = (bt: TacBattle, s: 0 | 1, unit: string): TacStack => bt.stacks.find((x) => x.side === s && x.unit === unit)!;
const cast = (bt: TacBattle, s: 0 | 1, id: TacSpellId, t?: TacStack) => assert.equal(castSpell(bt, s, id, t?.id, new Rng(7)), null, id);
/** A free hex beside a stack (to bring another alongside her). */
const besideOf = (bt: TacBattle, t: TacStack) => hexNeighbors(t.hex).find((h) => bt.cells[h] === '.' && !bt.stacks.some((x) => x.count > 0 && x.hex === h))!;

// ------------------------------------------------------------------ the book

test('twenty pages over all six schools and levels 1–5: taught as the common orders, fought in the battle, in both languages', () => {
  assert.equal(BOOK_PAGE_IDS.length, 20);
  for (const sc of SCHOOLS) assert.ok(BOOK_PAGE_IDS.filter((id) => BOOK_PAGES[id].school === sc).length >= 2, sc);
  for (const sc of ['board', 'fog'] as const) assert.ok(BOOK_PAGE_IDS.filter((id) => BOOK_PAGES[id].school === sc).length >= 4, `${sc}: the paths' schools get common pages`);
  assert.deepEqual([...new Set(BOOK_PAGE_IDS.map((id) => BOOK_PAGES[id].level))].sort(), [1, 2, 3, 4, 5]);
  const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets?: Record<string, unknown> };
  const painted = new Set(Object.keys(manifest.assets ?? manifest));
  for (const id of BOOK_PAGE_IDS) {
    const d = ORDERS[id], pg = BOOK_PAGES[id];
    assert.ok(LEARNABLE.includes(id) && !d.sig && !d.path && d.use === 'battle', `${id} is taught`);
    assert.equal(TAC_SPELLS[id].target, pg.fx.target, `${id} pointed as its fx says`);
    assert.equal(orderRes(id), SCHOOL_KIND[d.school] === 'phys' ? 'stam' : 'will', `${id}: its school's store`);
    assert.ok(painted.has(TAC_SPELLS[id].icon), `${id}: its stand-in icon ${TAC_SPELLS[id].icon} is painted`);
    // A cost and a wait among the orders of its level (docs/17's and the path books').
    assert.ok(d.cost >= [0, 3, 5, 8, 12, 15][d.level] && d.cost <= [0, 4, 6, 9, 12, 16][d.level], `${id}: cost ${d.cost} at level ${d.level}`);
    assert.ok(pg.cd >= 3 && pg.cd <= 5, `${id}: wait ${pg.cd}`);
    for (const [en, ru] of [d.name, d.text]) {
      assert.ok(/[а-яё]/i.test(ru) && !/[a-z]/i.test(ru), `${id}: «${ru}» is Russian`);
      assert.ok(!/[а-яё]/i.test(en), `${id}: «${en}» is English`);
      assert.deepEqual(ru.match(/\d+/g) ?? [], en.match(/\d+/g) ?? [], `${id}: the numbers keep`);
    }
  }
  // The old book stands as it was.
  assert.equal(orderRes('grenades'), 'will');
  assert.equal(LEARNABLE.filter((id) => !isBookPage(id)).length, 20);
  // The battle's new words in both languages.
  for (const k of ['sts.still', 'sts.mad', 'log.still', 'log.lost', 'log.mad', 'log.sick', 'float.still', 'float.mad', 'float.sick'] as const) assert.ok(TAC_EN[k] && TAC_RU[k], k);
  assert.ok(SERVER_RU_PATH['Your signals are lost in her fog']);
});

test('learnt the common ways: every port guild one of each of the six schools, the shrines and her island\'s guild teach them too', () => {
  const { game } = makeGame();
  const ports = game.world.ports.filter((p) => guildOf(p.id, p.size));
  for (const p of ports) assert.equal(new Set(guildOf(p.id, p.size)!.map((id) => ORDERS[id].school)).size, SCHOOLS.length, `${p.id}: every school`);
  const port = ports.find((p) => guildOf(p.id, p.size)!.some((id) => isBookPage(id) && ORDERS[id].level <= 2))!;
  assert.ok(port, 'a guild teaches a new page');
  const id = guildOf(port.id, port.size)!.filter(isBookPage).find((x) => ORDERS[x].level <= 2)!;
  join(game, 'Scholar', 'corsair');
  const s = game.sessionByName('Scholar')!;
  s.profile!.gold = 1e6;
  assert.equal(learnAtGuild(game, s, port, id), null);
  assert.ok(heroOf(s.profile!).orders.includes(id), 'into her book');
  assert.equal(s.profile!.gold, 1e6 - guildPrice(id));
  // A drowned shrine that teaches one of them, and her island's guild's floors.
  const isle = Array.from({ length: 400 }, (_, i) => i).find((i) => isBookPage(shrineOrder(i)) && ORDERS[shrineOrder(i)].level <= 2)!;
  assert.ok(isle !== undefined, 'a shrine teaches a new page');
  onShrine(game, s, isle);
  assert.ok(heroOf(s.profile!).orders.includes(shrineOrder(isle)));
  assert.ok(Array.from({ length: 40 }, (_, i) => isleGuildOrders(i, 5).flat()).some((l) => l.some((x) => isBookPage(x))), 'an island\'s guild floors');
  // In her battle book, at her school's cost.
  const hb = heroInput(game, s.ship!);
  assert.ok(hb.book.includes(id) && (hb.cost[id] ?? 0) > 0);
});

// ------------------------------------------------------------------ in the battle

test('the blows: the stinkpot, the heated shot, raking fire, forked lightning, the belaying pin, foul water', () => {
  // Stinkpot: a blow on her stack and those beside it; she strikes a third lighter.
  let bt = battle(['stinkpot']);
  let t = of(bt, 1, 'marine');
  const mine = of(bt, 0, 'marine');
  const before = blow(bt, t, mine, 'melee', null).dmg;
  cast(bt, 0, 'stinkpot', t);
  assert.ok(t.count < t.start, 'the pot lands');
  assert.ok(blow(bt, t, mine, 'melee', null).dmg < before * 0.75, 'the fumes');
  assert.equal(orderRes('stinkpot'), 'stam');
  assert.ok(bt.heroes[0].stam < (bt.heroes[0].input.hero!.stamMax ?? 0), 'stamina spent');
  // Heated shot: a blow, and the deck under her burns.
  bt = battle(['heated_shot']);
  t = of(bt, 1, 'sailor');
  assert.equal(bt.cells[t.hex], '.');
  cast(bt, 0, 'heated_shot', t);
  assert.ok(t.count < t.start && bt.cells[t.hex] === 'F', 'a fire under her');
  // Raking fire: every stack of hers in that row, and only those.
  bt = battle(['raking_fire']);
  t = of(bt, 1, 'deckhand');
  cast(bt, 0, 'raking_fire', t);
  for (const o of bt.stacks.filter((x) => x.side === 1)) assert.equal(o.count < o.start, hexY(o.hex) === hexY(t.hex), `${o.unit} in the row or not`);
  // Forked lightning: her stack and three more, each nearest the last.
  bt = battle(['forked_lightning']);
  cast(bt, 0, 'forked_lightning', of(bt, 1, 'sailor'));
  assert.equal(bt.stacks.filter((x) => x.side === 1 && x.count < x.start).length, 4, 'it forks on three times');
  assert.equal(bt.stacks.filter((x) => x.side === 0 && x.count < x.start).length, 0, 'never on her own');
  // Belaying pin: a blow, and she is slower and later to act.
  bt = battle(['belaying_pin']);
  t = of(bt, 1, 'marine');
  const v0 = viewOf(bt, 1, 0, false).stacks.find((x) => x.id === t.id)!;
  cast(bt, 0, 'belaying_pin', t);
  const v1 = viewOf(bt, 1, 0, false).stacks.find((x) => x.id === t.id)!;
  assert.ok(t.count < t.start && v1.speed < v0.speed && v1.init < v0.init);
  // Foul water: a sickness that bites as her next three turns come.
  bt = battle(['foul_water']);
  t = of(bt, 1, 'sailor');
  cast(bt, 0, 'foul_water', t);
  assert.ok(t.poison && t.poison.sick && t.poison.left === SICK_TURNS && t.poison.dmg > 0 && t.poison.by === 0);
  assert.ok(viewOf(bt, 0, 0, false).stacks.find((x) => x.id === t.id)!.poisoned);
});

test('her own: hammock nettings, the kelp poultice, double grog, St Elmo\'s fire, colours nailed to the mast, swinging aboard, no quarter, muffled oars', () => {
  let bt = battle(['hammock_nettings']);
  const gun = of(bt, 1, 'musketeer');
  let mine = of(bt, 0, 'marine');
  const shot = blow(bt, gun, mine, 'shot', null).dmg;
  cast(bt, 0, 'hammock_nettings', mine);
  assert.ok(Math.abs(blow(bt, gun, mine, 'shot', null).dmg - shot / 2) <= 1, 'half from her shots');
  bt = battle(['kelp_poultice']);
  mine = of(bt, 0, 'sailor');
  mine.count = 20;
  cast(bt, 0, 'kelp_poultice', mine);
  assert.ok(mine.count > 20 && mine.count <= mine.start, 'the stack pointed at heals');
  assert.equal(of(bt, 0, 'deckhand').count, of(bt, 0, 'deckhand').start);
  bt = battle(['double_grog']);
  const m0 = moralePoints(bt, 0);
  cast(bt, 0, 'double_grog');
  assert.ok(moralePoints(bt, 0) > m0 && modsOf(bt, 0).melee > 0 && modsOf(bt, 0).init < 0, 'bolder, harder, later');
  bt = battle(['st_elmos_fire']);
  cast(bt, 0, 'st_elmos_fire');
  assert.equal(modsOf(bt, 0).luck, 2);
  bt = battle(['nail_colours']);
  const foe = of(bt, 1, 'marine');
  mine = of(bt, 0, 'marine');
  const hit = blow(bt, foe, mine, 'melee', null).dmg;
  cast(bt, 0, 'nail_colours');
  const nm = modsOf(bt, 0);
  assert.ok(nm.steady && nm.morale === 2 && nm.melee > 0 && blow(bt, foe, mine, 'melee', null).dmg < hit, 'steady, bold, hard and firm');
  bt = battle(['swing_aboard']);
  mine = of(bt, 0, 'marine');
  const sp0 = viewOf(bt, 0, 0, false).stacks.find((x) => x.id === mine.id)!.speed;
  cast(bt, 0, 'swing_aboard', mine);
  const sv = viewOf(bt, 0, 0, false).stacks.find((x) => x.id === mine.id)!;
  assert.ok(sv.again && sv.noRet && sv.speed === sp0 + 2, 'once more, two hexes further, unanswered');
  bt = battle(['no_quarter']);
  const her = moralePoints(bt, 1);
  cast(bt, 0, 'no_quarter');
  assert.ok(bt.heroes[0].free === 4 && moralePoints(bt, 1) < her);
  bt = battle(['muffled_oars']);
  cast(bt, 0, 'muffled_oars');
  assert.equal(bt.heroes[0].free, 2);
});

test('against her captain: the Jonah, the clearing wind, the rain squall, the silent fog', () => {
  let bt = battle(['jonah']);
  const m0 = moralePoints(bt, 1);
  cast(bt, 0, 'jonah');
  assert.ok(modsOf(bt, 1).luck === -2 && moralePoints(bt, 1) < m0);
  // The clearing wind: her fury, her mark on yours and her free blows gone.
  bt = battle(['clearing_wind'], ['fury', 'mark_target']);
  cast(bt, 1, 'fury');
  bt.heroes[1].cast = 0;
  cast(bt, 1, 'mark_target', of(bt, 0, 'marine'));
  bt.heroes[1].free = 2;
  const mine = of(bt, 0, 'marine'), foe = of(bt, 1, 'marine');
  const furious = blow(bt, foe, mine, 'melee', null).dmg;
  cast(bt, 0, 'clearing_wind');
  assert.ok(bt.heroes[1].fx.length === 0 && bt.heroes[1].free === 0, 'all she laid is gone');
  assert.ok(blow(bt, foe, mine, 'melee', null).dmg < furious && !viewOf(bt, 0, 0, false).stacks.find((x) => x.id === mine.id)!.marked);
  // The rain squall: her shooters cannot fire this round, and the fires go out.
  bt = battle(['rain_squall']);
  const gun = of(bt, 1, 'musketeer');
  assert.ok(canShoot(bt, gun));
  const fire = bt.cells.findIndex((c, i) => c === '.' && !bt.stacks.some((x) => x.hex === i));
  bt.cells[fire] = 'F';
  cast(bt, 0, 'rain_squall');
  assert.ok(!canShoot(bt, gun) && !bt.cells.includes('F'), 'wet powder, no fire');
  bt.round++;
  assert.ok(canShoot(bt, gun), 'the next round she fires again');
  // The silent fog: no order nor path move of hers this round or the next.
  bt = newBattle(side(hero(['silent_fog'])), side(npcHeroBattle(5, 'admiral')), 6, 0, new Rng(6));
  const hers = bt.heroes[1].spells[0].id;
  cast(bt, 0, 'silent_fog');
  assert.equal(spellError(bt, 1, hers), 'Your signals are lost in her fog');
  assert.equal(moveError(bt, 1, 'innate'), 'Your signals are lost in her fog');
  assert.ok(viewOf(bt, 1, 0, false).heroes[1].cast, 'her book shut on her panel');
  bt.round += 2;
  assert.notEqual(spellError(bt, 1, hers), 'Your signals are lost in her fog', 'two rounds, no more');
});

test('her turns: the Siren Song holds her stack spellbound till a blow wakes it unanswered; Fog Madness turns hers on her own', () => {
  let bt = battle(['siren_song']);
  let t = of(bt, 1, 'marine');
  cast(bt, 0, 'siren_song', t);
  assert.ok(viewOf(bt, 0, 0, false).stacks.find((x) => x.id === t.id)!.still);
  // Her turn comes: it is lost.
  bt.queue = [t.id, ...bt.queue.filter((id) => id !== t.id)];
  const by = bt.stacks.find((x) => x.id === bt.active)!;
  act(bt, by.side, { a: 'defend' }, 0, new Rng(3));
  assert.ok(bt.log.some((e) => e.k === 'fear' && e.id === 'still' && e.s === t.id) && bt.active !== t.id, 'spellbound');
  // A blow wakes her, and draws no answer.
  const mine = of(bt, 0, 'marine');
  mine.hex = besideOf(bt, t);
  bt.active = mine.id;
  bt.queue = bt.queue.filter((id) => id !== mine.id);
  assert.equal(act(bt, 0, { a: 'attack', target: t.id, from: mine.hex }, 0, new Rng(4)), null);
  const after = bt.log.slice(bt.log.findLastIndex((e) => e.k === 'hit' && e.s === mine.id));
  assert.ok(!after.some((e) => e.k === 'ret'), 'no answer to the blow that wakes her');
  assert.ok(!modsOf(bt, 1, t.id).still, 'awake');
  // Fog Madness: as her turn comes she falls on her own.
  bt = battle(['fog_madness'], [], 8);
  t = of(bt, 1, 'marine');
  cast(bt, 0, 'fog_madness', t);
  assert.ok(viewOf(bt, 0, 0, false).stacks.find((x) => x.id === t.id)!.mad);
  const theirs = bt.stacks.filter((x) => x.side === 1 && x !== t).reduce((n, x) => n + x.count, 0);
  bt.queue = [t.id, ...bt.queue.filter((id) => id !== t.id)];
  act(bt, bt.stacks.find((x) => x.id === bt.active)!.side, { a: 'defend' }, 0, new Rng(3));
  const e = bt.log.find((x) => x.id === 'mad');
  assert.ok(e && e.s === t.id && e.k === 'hit', 'her turn is the madness\'s: she falls on the nearest of hers she can reach');
  assert.equal(bt.stacks.find((x) => x.id === e.t)!.side, 1, 'on her own');
  assert.ok(bt.stacks.filter((x) => x.side === 1 && x !== t).reduce((n, x) => n + x.count, 0) < theirs && bt.heroes[0].kills > 0, 'her fallen are yours');
});

test('the sea\'s mind gives every page when it is worth it', () => {
  tacStats.on = true;
  try {
    for (const id of BOOK_PAGE_IDS) {
      tacStats.casts.clear();
      for (let k = 0; k < 4 && !tacStats.casts.get(`sea:${id}`); k++) {
        const rng = new Rng(300 + k);
        // Against a captain with a book (the clearing wind and the silent fog want one), on a deck afire for the rain.
        const bt = newBattle(side(hero([id])), side(hero(['fury', 'shield_wall', 'mark_target', 'grenades'])), k + 3, 0, rng);
        if (id === 'rain_squall') for (const s of bt.stacks) if (s.side === 0) bt.cells[s.hex] = 'F';
        quickFinish(bt, 0, rng);
      }
      assert.ok((tacStats.casts.get(`sea:${id}`) ?? 0) > 0, `${id} given`);
    }
  } finally {
    tacStats.on = false;
    tacStats.casts.clear();
  }
});
