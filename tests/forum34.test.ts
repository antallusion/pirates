// Forum, Нефигугум 2026-10-31 (post 34): «Сейчас все нпс стали дружественными. Выделив торговца/рыбака … нажав пробел,
// кораблик включается на автофарм и мчится искать акул» — and his three flags, built:
//  - the bug: a merchant marked under the city flag and «Огонь»/«Атаковать» is refused with why, never another ship;
//  - the city flag's peace: merchants, fishers and patrols are no prey and never come for her, a bump is a bump;
//  - the pirate flag: she fires on and rams merchants, every new victim a skull; merchants run; the sea's pirates leave
//    her be unless she wrongs them; the patrols hunt a skulled pirate (the hue and cry, sallies from the harbours);
//  - skulls: the colours locked; two and more shut the lawful harbours; washed off by time or a pardon in a haven;
//  - neutral colours as they were.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAG_LOCK_SAY, HUE_SALLY_SEC, PEACE_SAY, SKULL_PAD } from '../shared/src/data/colours.ts';
import { FACTIONS, WANTED_THRESHOLDS, wantedLevel } from '../shared/src/data/factions.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import * as combat from '../server/src/game/combat.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import { pardon } from '../server/src/game/ports.ts';
import { setColours } from '../server/src/game/colours.ts';
import { flagLocked, honourSpares, peaceBlocked, peacefulNpc, skullFor, stepHueAndCry, washView } from '../server/src/game/flaglaw.ts';
import type { Game } from '../server/src/game/Game.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { canDock } from '../server/src/game/player.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { pursuitOf } from '../server/src/game/pursuit.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as FL_EN, RU as FL_RU } from '../client/src/lang/ui/flags.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

/** A captain at sea in contested water beside a merchant (and a shark-in-waiting: a sea pirate on her), her flag given. */
function scene(flag: 'neutral' | 'faction' | 'pirate', k = 3): { game: Game; s: PlayerSession; c: FakeConn; me: ShipEntity; merchant: ShipEntity } {
  const game = duelSea();
  const at = openWater(game, k);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  s.profile!.pvp.flag = flag;
  const me = s.ship!;
  const merchant = game.spawnNpcShip('merchant', 'fluyt', 'league', at.x + 160, at.y, 0);
  game.setNpcLevel(merchant, 5);
  merchant.state.speed = 0;
  merchant.input = { rudder: 0, sailTarget: 0 };
  game.npcs.get(merchant.id)!.keep = true;
  game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
  return { game, s, c: s.conn as unknown as FakeConn, me, merchant };
}

/** Into contested water for the law's rules (the Black Coast's own safety is whatever the chart says). */
function contested(game: Game, ...ships: ShipEntity[]): void {
  const r = (Object.keys(REGIONS) as (keyof typeof REGIONS)[]).find((id) => REGIONS[id].safety === 'contested')!;
  for (const x of ships) x.region = r;
  void game;
}

test('the bug: a merchant marked under the city flag — «Огонь» and «Атаковать» are refused with why, never another ship', () => {
  const { game, s, c, me, merchant } = scene('faction');
  contested(game, me, merchant);
  // a sea pirate on her, in reach: the old fallback took the nearest foe instead of her mark
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', me.state.x - 220, me.state.y, 0);
  game.setNpcLevel(pirate, 3);
  contested(game, pirate);
  game.grid.upsert(pirate.id, pirate.state.x, pirate.state.y);
  assert.equal(peacefulNpc(game, merchant), true);
  assert.equal(damageBlocked(game, me, merchant), PEACE_SAY, 'the guns keep off her');
  const balls = game.projectiles.length;
  c.push({ t: 'volley', target: merchant.id });
  assert.equal(c.last('toast')?.msg, PEACE_SAY, '«Огонь» refused, and why');
  assert.equal(pursuitOf(me), null, 'no auto-hunt sent after another ship');
  assert.equal(game.projectiles.length, balls, 'not a ball fired at another ship');
  c.push({ t: 'attack', target: merchant.id, mode: 'guns' });
  assert.equal(c.last('toast')?.msg, PEACE_SAY, '«Атаковать» refused');
  assert.equal(pursuitOf(me), null);
  c.push({ t: 'attack', target: merchant.id, mode: 'board' });
  assert.equal(pursuitOf(me), null, 'nor the boarding run');
  // a fisher and a Crown patrol alike; a sea pirate is fair game
  const fisher = game.spawnNpcShip('fisher', 'cutter', 'free', me.state.x, me.state.y + 200, 0);
  const patrol = game.spawnNpcShip('patrol', 'brig', 'crown', me.state.x, me.state.y - 200, 0);
  assert.equal(damageBlocked(game, me, fisher), PEACE_SAY);
  assert.equal(damageBlocked(game, me, patrol), PEACE_SAY);
  assert.equal(damageBlocked(game, me, pirate), null, 'the sea’s pirates are anyone’s');
  // it reads in Russian
  setLang('ru');
  try {
    assert.match(serverText(PEACE_SAY), /^Нападение на мирных/);
    assert.match(serverText(FLAG_LOCK_SAY), /^Пока на вас черепа/);
  } finally {
    setLang('en');
  }
});

test('the city flag: merchants, fishers and patrols never come for her — a bump, even under Ramming Speed, is a bump', () => {
  const { game, s, me, merchant } = scene('faction', 4);
  contested(game, me, merchant);
  merchant.state.x = me.state.x;
  merchant.state.y = me.state.y - 30;
  game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
  me.addEffect({ id: 'ramming_speed', until: game.now + 5 }, game.now);
  me.state.heading = 0;
  me.state.speed = me.stats.maxSpeed;
  const h0 = merchant.hull, mh0 = me.hull;
  steps(game, 20);
  assert.equal(merchant.attackers.has(me.id), false, 'no blow on the record');
  assert.equal(merchant.hull, h0, 'no hull lost');
  assert.equal(me.hull, mh0, 'nor hers');
  assert.equal(s.profile!.infamy, 0, 'no skulls');
  const patrol = game.spawnNpcShip('patrol', 'brig', 'crown', me.state.x, me.state.y + 100, 0);
  contested(game, patrol);
  assert.equal(npcHostileTo(game, patrol, me), false, 'the patrol keeps the peace');
  assert.equal(npcHostileTo(game, merchant, me), false);
});

test('the pirate flag: she fires on a merchant, and every new victim is a skull at once; the merchants run from her', () => {
  const { game, s, c, me, merchant } = scene('pirate', 5);
  contested(game, me, merchant);
  assert.equal(damageBlocked(game, me, merchant), null);
  assert.equal(skullFor(game, me, merchant, false), WANTED_THRESHOLDS[1] + SKULL_PAD, 'a skull and its pad');
  c.push({ t: 'attack', target: merchant.id, mode: 'guns' });
  assert.equal(pursuitOf(me)?.target, merchant.id, '«Атаковать» takes her');
  // a broadside lands (the blow itself, as the guns would)
  combat.applyDamage(game, merchant, { hull: 50 }, me);
  assert.equal(wantedLevel(s.profile!.infamy), 1, 'one skull');
  // a second victim: a fisher — two skulls
  const fisher = game.spawnNpcShip('fisher', 'cutter', 'free', me.state.x, me.state.y + 200, 0);
  contested(game, fisher);
  combat.applyDamage(game, fisher, { hull: 20 }, me);
  assert.equal(wantedLevel(s.profile!.infamy), 2, 'two skulls');
  // a merchant sees the black flag and runs
  const m2 = game.spawnNpcShip('merchant', 'fluyt', 'league', me.state.x + 400, me.state.y, Math.PI / 2);
  const b2 = game.npcs.get(m2.id)!;
  b2.active = true;
  contested(game, m2);
  game.grid.upsert(m2.id, m2.state.x, m2.state.y);
  c.push({ t: 'attack', stop: true }); // (her own helmsman lets the first one be)
  const ux = (m2.state.x - me.state.x) / 400, uy = (m2.state.y - me.state.y) / 400, x0 = m2.state.x, y0 = m2.state.y;
  steps(game, 20 * 8);
  const away = (m2.state.x - x0) * ux + (m2.state.y - y0) * uy;
  assert.ok(away > 40, `she ran from the black flag (${Math.round(away)} m away)`);
});

test('the hue and cry: the law’s patrols hunt a skulled pirate — her chase, more way, and a patrol out of a harbour near her', () => {
  const { game } = makeGame();
  join(game, 'Hue Hester');
  const s = game.sessionByName('Hue Hester')!;
  const p = s.profile!;
  const me = s.ship!;
  const port = game.world.ports.find((pt) => pt.faction === 'crown' && REGIONS[pt.region]?.safety !== 'lawless' && game.inZone(pt.x, pt.y))!;
  me.docked = null;
  p.docked = null;
  me.state.x = port.x + 1500;
  me.state.y = port.y;
  me.region = port.region;
  game.grid.upsert(me.id, me.state.x, me.state.y);
  p.pvp.flag = 'pirate';
  p.infamy = WANTED_THRESHOLDS[1] + SKULL_PAD;
  me.wantedCache = 1;
  const patrol = game.spawnNpcShip('patrol', 'brig', 'harpoon', me.state.x + 900, me.state.y, 0);
  patrol.region = me.region;
  game.grid.upsert(patrol.id, patrol.state.x, patrol.state.y);
  assert.equal(npcHostileTo(game, patrol, me), true, 'with a skull even the Harpoon’s patrol comes for her');
  const before = game.ships.size;
  stepHueAndCry(game);
  const brain = game.npcs.get(patrol.id)!;
  assert.equal(brain.chase?.id, me.id, 'the patrol takes her for its chase');
  assert.ok(patrol.hasEffect('hue_and_cry'), 'and crowds on sail');
  const sallied = [...game.ships.values()].filter((x) => x.npcRole === 'patrol' && game.npcs.get(x.id)?.chase?.id === me.id && x.id !== patrol.id);
  assert.ok(game.ships.size > before && sallied.length >= 1, 'a patrol puts out of the harbour after her');
  assert.equal(sallied[0].faction, port.faction);
  // not again before HUE_SALLY_SEC; again after (up to her skulls' worth)
  const n1 = sallied.length;
  stepHueAndCry(game);
  assert.equal([...game.ships.values()].filter((x) => x.npcRole === 'patrol' && game.npcs.get(x.id)?.chase?.id === me.id && x.id !== patrol.id).length, n1, 'no second sally at once');
  void HUE_SALLY_SEC;
  // clean: nothing
  p.infamy = 0;
  me.wantedCache = 0;
  brain.chase = null;
  stepHueAndCry(game);
  assert.equal(brain.chase, null, 'a clean pirate flag raises no hue and cry');
});

test('two skulls shut every lawful harbour, with where to go and how to wash them; the havens take her', () => {
  const { game } = makeGame();
  join(game, 'Docker Dora');
  const s = game.sessionByName('Docker Dora')!;
  const p = s.profile!;
  p.infamy = WANTED_THRESHOLDS[2] + SKULL_PAD;
  for (const f of ['crown', 'league', 'harpoon'] as const) {
    assert.equal(FACTIONS[f].dockMaxWanted, 1);
    const r = canDock(p, f);
    assert.equal(r.ok, false, f);
    assert.match(r.reason!, / harbours take no ship with 2 skulls: a pirate haven will .* \(about \d+ min\)\.$/);
  }
  for (const f of ['confederacy', 'brokers', 'free'] as const) assert.equal(canDock(p, f).ok, true, f);
  // one skull: the lawful harbours still take her
  p.infamy = WANTED_THRESHOLDS[1] + SKULL_PAD;
  assert.equal(canDock(p, 'crown').ok, true);
  // the harbour says so from its approach, before the helmsman takes her in
  p.infamy = WANTED_THRESHOLDS[2] + SKULL_PAD;
  const me = s.ship!;
  const port = game.world.ports.find((pt) => pt.faction === 'crown' && game.inZone(pt.x, pt.y))!;
  me.docked = null;
  p.docked = null;
  me.state.x = port.x + 250;
  me.state.y = port.y + 250;
  me.state.speed = 0;
  const c = s.conn as unknown as FakeConn;
  c.push({ t: 'dock' });
  assert.match(c.last('toast')!.msg, / harbours take no ship with 2 skulls/);
  setLang('ru');
  try {
    assert.match(serverText(c.last('toast')!.msg), /^Порты\s\(.+\)\sне\sпринимают\sкорабль\sс\sчерепами:\s2\.\sПримут\sпиратские\sгавани/);
  } finally {
    setLang('en');
  }
});

test('skulls lock the colours: only the pirate flag goes up over them; washed off by time or a pardon in a haven', () => {
  const { game } = makeGame();
  join(game, 'Locked Lou');
  const s = game.sessionByName('Locked Lou')!;
  const p = s.profile!;
  p.pvp.flag = 'pirate';
  p.infamy = WANTED_THRESHOLDS[1] + SKULL_PAD; // one skull
  assert.equal(flagLocked(p, 'faction'), FLAG_LOCK_SAY);
  assert.equal(flagLocked(p, 'neutral'), FLAG_LOCK_SAY);
  assert.equal(flagLocked(p, 'pirate'), null);
  assert.ok(s.ship!.docked, 'in port');
  assert.equal(setColours(game, s, 'faction'), FLAG_LOCK_SAY, 'the city flag refused');
  assert.equal(p.pvp.next, null, 'nothing ordered');
  const w = washView(game, s) as Required<ReturnType<typeof washView>>;
  assert.equal(w.skulls, 1);
  assert.equal(w.locked, true);
  assert.ok(w.washMin >= 9 && w.washMin <= 11, `about ten minutes a skull (${w.washMin})`);
  assert.ok((w.pardon ?? 0) > 0);
  // time out of a fight washes it
  for (let i = 0; i < w.washMin * 60 + 5; i++) (game as unknown as { shipUpkeep(x: ShipEntity): void }).shipUpkeep(s.ship!);
  assert.equal(wantedLevel(p.infamy), 0, 'washed off');
  assert.equal(flagLocked(p, 'faction'), null);
  assert.equal(setColours(game, s, 'faction'), null, 'the city flag may be ordered again');
  // a pardon in a pirate haven: at once
  p.infamy = WANTED_THRESHOLDS[2] + SKULL_PAD;
  p.gold = 1_000_000;
  const haven = game.world.ports.find((pt) => pt.faction === 'confederacy')!;
  assert.equal(pardon(game, s, haven), null);
  assert.equal(wantedLevel(p.infamy), 0, 'the pardon washes them');
  // the card's words in both languages
  for (const k of ['fl.skulls', 'fl.locked', 'fl.wash', 'fl.peace', 'fl.peaceHint'] as const) assert.ok(FL_EN[k] && FL_RU[k], k);
  assert.equal(FL_RU['fl.pirateSub'].split('|').length, 3, 'the pirate flag in three short lines');
});

test('the Brethren’s honour: the sea’s pirates leave a pirate-flag captain be — unless she fired on one of them lately', () => {
  const { game, s, me } = scene('pirate', 6);
  contested(game, me);
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', me.state.x + 300, me.state.y, 0);
  contested(game, pirate);
  assert.equal(honourSpares(game, pirate, me), true);
  assert.equal(npcHostileTo(game, pirate, me), false, 'one of their own');
  // under the city flag they come for her
  s.profile!.pvp.flag = 'faction';
  assert.equal(npcHostileTo(game, pirate, me), true);
  s.profile!.pvp.flag = 'pirate';
  // she fires on another of them: the whole sea's pirates take her for a foe a while
  const other = game.spawnNpcShip('pirate', 'sloop', 'confederacy', me.state.x - 300, me.state.y, 0);
  contested(game, other);
  combat.applyDamage(game, other, { hull: 10 }, me);
  assert.equal(honourSpares(game, pirate, me), false, 'honour broken');
  assert.equal(npcHostileTo(game, pirate, me), true);
  // a lair's garrison holds its island whatever her flag
  pirate.lairGuard = 'x';
  assert.equal(honourSpares(game, pirate, me), false);
});

test('neutral colours as they were: no captain fires on her, she on none and on no peaceful ship; the sea’s pirates may', () => {
  const { game, s, me, merchant } = scene('neutral', 7);
  contested(game, me, merchant);
  assert.equal(damageBlocked(game, me, merchant), PEACE_SAY, 'no peaceful ship');
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', me.state.x + 300, me.state.y, 0);
  contested(game, pirate);
  assert.equal(damageBlocked(game, me, pirate), null, 'a sea pirate she may fight');
  assert.equal(honourSpares(game, pirate, me), false, 'no pirate honour for a neutral');
  join(game, 'Other Olga');
  const o = game.sessionByName('Other Olga')!;
  o.ship!.docked = null;
  o.profile!.docked = null;
  o.profile!.pvp.flag = 'pirate';
  o.ship!.state.x = me.state.x;
  o.ship!.state.y = me.state.y + 200;
  contested(game, o.ship!);
  assert.match(damageBlocked(game, o.ship!, me) ?? '', /neutral colours/, 'no captain fires on her');
  assert.match(damageBlocked(game, me, o.ship!) ?? '', /neutral colours/, 'she fires on none');
  void s;
});

test('a bump between ships at peace still counts for nothing, under any flag but a pirate’s meant ram', () => {
  for (const flag of ['neutral', 'faction', 'pirate'] as const) {
    const { game, s, me, merchant } = scene(flag, 8);
    contested(game, me, merchant);
    merchant.state.x = me.state.x;
    merchant.state.y = me.state.y - 30;
    game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
    me.state.heading = 0;
    me.state.speed = me.stats.maxSpeed;
    steps(game, 20);
    assert.equal(merchant.attackers.has(me.id), false, `${flag}: no blow from a bump`);
    assert.equal(s.profile!.infamy, 0, `${flag}: no skull from a bump`);
  }
  // the pirate flag's ram under Ramming Speed is one, and a skull
  const { game, s, me, merchant } = scene('pirate', 9);
  contested(game, me, merchant);
  merchant.state.x = me.state.x;
  merchant.state.y = me.state.y - 30;
  game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
  me.addEffect({ id: 'ramming_speed', until: game.now + 5 }, game.now);
  me.state.heading = 0;
  me.state.speed = me.stats.maxSpeed;
  steps(game, 20);
  assert.equal(merchant.attackers.has(me.id), true, 'a ram she meant');
  assert.equal(wantedLevel(s.profile!.infamy), 1, 'and a skull');
  assert.equal(peaceBlocked(game, me, merchant), null);
});
