// Forum 45/46 (Нефигугум): no window shields a ship at sea; the effects by her portrait; the nameplates — captains in a
// colour of their own, skulled ones bold red, the pirate flag keeping her level from the others' eyes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SF } from '../shared/src/protocol.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as FX_EN, RU as FX_RU } from '../client/src/lang/ui/fx.ts';
import { effectCard, fxList, fxRowHtml, noteFx, shortLeft } from '../client/src/ui/fxrow.ts';
import type { FxInput } from '../client/src/ui/fxrow.ts';
import { exitClock, exitWhyText } from '../client/src/ui/exit.ts';
import { playerNameColor } from '../client/src/render/renderer.ts';
import { setColours } from '../server/src/game/colours.ts';
import { join, makeGame, steps } from './helpers.ts';

const base = (): FxInput => ({
  self: { captain: 'corsair', effects: [], protectedUntil: 0, wanted: 0, rested: 0, curse: 0, hold: null, company: {}, berthCall: null, boosts: { xp: 0, wind: 0, prod: 0, ferry: 0 }, pvp: { flag: 'faction', next: null, nextAt: 0, pennant: false, shameUntil: 0 }, dockedAt: null },
  you: { flags: 0, rudderHp: 1, sails: 100, sailsMax: 100, morale: 60, leaks: 0 },
  now: 1000,
  wall: 1_700_000_000_000,
});

test('the effects row: every kind asked for shows, banes first, timers and numbers on the icons', () => {
  setLang('ru');
  const i = base();
  i.self.effects = [
    { id: 'torn_rigging', until: 1003 }, // the ram's «снасти сорваны»
    { id: 'order_fair_wind', until: 1090, mods: { maxSpeed: 0.15 } },
    { id: 'isle_light', until: 1001.6 }, // an aura renewed each second: not shown
    { id: 'double_shot', until: 1012 }, // her own ability: its own name
  ];
  i.self.protectedUntil = 1300;
  i.self.wanted = 2;
  i.self.rested = 500;
  i.self.hold = { over: 1, slow: 20 };
  i.self.boosts = { xp: i.wall + 3_600_000, wind: i.wall + 600_000, prod: i.wall + 60_000, ferry: i.wall + 1_200_000 };
  i.self.berthCall = { at: i.wall + 90_000 };
  i.self.pvp!.next = 'pirate';
  i.self.pvp!.nextAt = i.wall + 30_000;
  i.you = { flags: SF.FIRE | SF.TETHERED, rudderHp: 0.5, sails: 30, sailsMax: 100, morale: 90, leaks: 2 };
  const l = fxList(i);
  const ids = l.map((f) => f.id);
  for (const id of ['torn_rigging', 'order_fair_wind', 'double_shot', 'protected', 'skulls', 'rested', 'overload', 'elixir', 'wind', 'harvest', 'ferry', 'berth', 'flag', 'fire', 'grapple', 'rudder', 'canvas', 'leaks', 'moraleHigh']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('isle_light'), 'an aura is not an effect of the row');
  const firstGood = l.findIndex((f) => !f.bad);
  assert.ok(l.slice(firstGood).every((f) => !f.bad), 'banes first');
  assert.equal(l.find((f) => f.id === 'skulls')?.n, '2');
  assert.equal(l.find((f) => f.id === 'overload')?.n, '−20%');
  assert.ok((l.find((f) => f.id === 'order_fair_wind')?.frac ?? 0) > 0.9, 'a fresh effect: its ring full');
  // at most 8, then «+N»
  const html = fxRowHtml(l, 8);
  assert.equal((html.match(/class="fx-i /g) ?? []).length, 9);
  assert.match(html, />\+\d+</);
  assert.match(html, /data-detail="effect:torn_rigging"/);
  // the cards: its own words, «+N»'s whole list
  noteFx(l);
  assert.equal(effectCard('torn_rigging')?.name[0], 'Снасти сорваны');
  assert.equal(effectCard('protected')?.name[1], 'Под защитой');
  assert.equal(effectCard('all')?.rows?.length, l.length);
  assert.equal(shortLeft(45), '45');
  assert.equal(shortLeft(170), '3м');
  setLang('en');
});

test('the words of the row and of «Выход» in both languages, no Latin in the Russian', () => {
  for (const k of Object.keys(FX_EN) as (keyof typeof FX_EN)[]) {
    assert.ok(FX_RU[k], k);
    assert.ok(!/[A-Za-z]/.test(FX_RU[k].replace(/\{\w+\}/g, '')), `${k}: ${FX_RU[k]}`);
  }
  setLang('ru');
  assert.equal(exitClock(30), '0:30');
  assert.equal(exitClock(4.2), '0:05');
  assert.match(exitWhyText('action'), /отменён/);
  assert.equal(exitWhyText('cancel'), '');
  setLang('en');
});

test('nameplates: a captain in a colour no NPC lantern has, a skulled one red', () => {
  assert.equal(playerNameColor(true), '#ff4b3a');
  assert.equal(playerNameColor(false), '#6fc3ff');
  for (const lantern of ['#dfe8f0', '#f2b35a', '#d2473a', '#e8d27a', '#7fa38a', '#2ee6c8', '#e0a060']) assert.notEqual(playerNameColor(false), lantern);
});

test('under the pirate flag her level and ⚓ are not told to the world; her city flag tells them again', () => {
  const { game } = makeGame();
  join(game, 'Флажный');
  const s = game.sessionByName('Флажный')!;
  const ship = s.ship!;
  s.profile!.pvp.flag = 'pirate';
  steps(game, 25);
  assert.equal(ship.masked, true);
  const i = ship.info() as { masked?: boolean; level?: number; shipLevel?: number; units?: unknown };
  assert.equal(i.masked, true);
  assert.equal(i.level, undefined);
  assert.equal(i.shipLevel, undefined);
  assert.equal(i.units, undefined, 'nor her army');
  s.profile!.pvp.flag = 'faction';
  steps(game, 25);
  const j = ship.info() as { masked?: boolean; level?: number };
  assert.ok(!j.masked);
  assert.equal(j.level, s.profile!.level);
  void setColours;
});

test('no window shields a ship at sea: halted at her island with a hidden cove, a captain still sees her', () => {
  const { game } = makeGame();
  join(game, 'Островной');
  const s = game.sessionByName('Островной')!;
  const ship = s.ship!;
  ship.docked = null;
  // a cove's shelter on her (as her island's hidden cove gives a moored ship): hidden from the sea's ships only
  ship.addEffect({ id: 'isle_cove', until: game.now + 1.6, flags: ['sheltered'] }, game.now);
  assert.equal(ship.flagsFor(null, false, game.now) & SF.HIDDEN, 0, 'not grey, not untargetable');
  // the island's window, its «halt» and its view change nothing of her flags
  const c = join(game, 'Смотрящий');
  void c;
  const before = ship.flagsFor(null, false, game.now);
  game.halt(s);
  assert.equal(ship.flagsFor(null, false, game.now) & (SF.HIDDEN | SF.IN_BATTLE | SF.PROTECTED), before & (SF.HIDDEN | SF.IN_BATTLE | SF.PROTECTED));
});
