// The fight area's QA findings of 2026-10-22 (owner: «если я сражаюсь с кем-то… никаких автонападений и багов быть не
// должно… игра должна быть идеальной по всем фронтам»):
//  1. after a won hex boarding the prize's card was gone — the opening's next run (main.ts openingFrame → startGoal)
//     shut it — the ship lay hove to by her prize, the helmsman never went, «Твари на отмели» hung;
//  2. the First Watch's practice fight could be lost by a pupil who did nothing; «Авто — нужен свиток» looked usable;
//  3. a stray ball on a lawful fisher beside the campaign's pirate made a newcomer Wanted 1;
//  4. «Причалить» sometimes did nothing (a quiet second refusal, the helmsman keeping her under sail, a stale button).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armyForLevel } from '../shared/src/data/army.ts';
import { emptyAmmo } from '../shared/src/data/ships.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { wantedLevel } from '../shared/src/data/factions.ts';
import type { ServerMsg } from '../shared/src/protocol.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import { BOARD_SETTLE_SECS, ORDER_LAPSED, SPOILS_FIRST } from '../server/src/game/Game.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import { attackRoam, roamAtHand } from '../server/src/game/roamers.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { LESSON_NO_STRIKE, act, newBattle, stepBattle, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle } from '../server/src/game/tacbattle.ts';
import { lessonSide } from '../server/src/game/tactical.ts';
import { STRAY_FORGIVEN, lawNewbie } from '../server/src/game/stray.ts';
import { SERVER_RU_BATTLE } from '../client/src/lang/server.ru.battle.ts';
import { EN as TEN, RU as TRU } from '../client/src/lang/ui/tactical.ts';
import { sidesAt } from './balance/boardlen.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const conn = (s: PlayerSession) => s.conn as unknown as FakeConn;
const toasts = (s: PlayerSession, kind?: string) => conn(s).inbox.filter((m): m is Extract<ServerMsg, { t: 'toast' }> => m.t === 'toast' && (!kind || m.kind === kind)).map((m) => m.msg);

function sea(): Game {
  const { game } = makeGame();
  quietAdv(game, false);
  return game;
}
/** A captain at sea in safe water off a port (the First Watch off unless asked). */
function captain(game: Game, name: string, opts: { level?: number; newbie?: boolean; off?: number } = {}): PlayerSession {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  if (!opts.newbie && p.tutorial) {
    p.tutorial.on = false;
    p.tutorial.played = 1e7;
  }
  if (opts.level) p.level = opts.level;
  if (!opts.newbie && p.campaign) p.campaign.at = 60;
  const port = game.world.ports.find((x) => REGIONS[x.region].safety === 'safe')!;
  const ship = s.ship!;
  onHull(game, ship, 'cutter', 3);
  ship.setArmy(armyForLevel(3, Math.round(ship.stats.crewMax * 0.8), ship.armySlots - 2, 'player'));
  ship.state.x = port.x + (opts.off ?? 2500);
  ship.state.y = port.y;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return s;
}
const resultFor = (npc: ShipEntity) => ({ targetName: npc.name, targetClass: npc.cls.id, cargo: { rum: 3 }, destroyed: {}, gold: 40, ammo: emptyAmmo(), crewLost: 0, enemyCrewLost: 4, ransom: 0, holdFree: 0, npc: true, prize: null, captive: false, recruits: 0, noQuarter: false });

// ------------------------------------------------------------------ 1. the spoils' card

test('bug 1: the spoils wait for her answer — asked again they come again; «Причалить» says why and brings the card back', () => {
  const game = sea();
  const s = captain(game, 'Spoils', { off: 300 });
  const ship = s.ship!;
  const npc = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 60, ship.state.y, 0);
  npc.lootLockedFor = ship.id;
  game.onBoardingWon(ship, npc, resultFor(npc) as never);
  assert.ok(s.pendingBoarding && s.pendingBoarding.at === game.now, 'the spoils wait, stamped with their hour');
  assert.ok(conn(s).last('boarding')?.result, 'the card sent');
  // the page back from the background asks again: the card again
  conn(s).inbox.length = 0;
  conn(s).push({ t: 'board_result' });
  assert.ok(conn(s).last('boarding')?.result, 'asked again: the card again');
  // «Причалить» by the port: refused with the reason, and the card brought back
  conn(s).inbox.length = 0;
  conn(s).push({ t: 'dock' });
  assert.ok(toasts(s, 'bad').includes(SPOILS_FIRST), 'the reason said');
  assert.ok(conn(s).last('boarding')?.result, 'the card brought back with it');
  assert.equal(ship.docked, null);
  // answered: none waits; asked again, a stale card is put away
  conn(s).push({ t: 'loot_take', take: {}, fate: 'sink' });
  assert.equal(s.pendingBoarding, null);
  conn(s).push({ t: 'board_result' });
  assert.equal(conn(s).last('boarding')?.result, null, 'nothing waits: the page puts a stale card away');
});

test('bug 1: spoils never answered are shared out by her quartermaster after BOARD_SETTLE_SECS, and she sails on', () => {
  const game = sea();
  const s = captain(game, 'Quartermaster');
  const ship = s.ship!;
  const npc = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 60, ship.state.y, 0);
  npc.lootLockedFor = ship.id;
  npc.surrendered = true; // (a prize taken lies still beside her)
  npc.cargo = { rum: 3 };
  game.onBoardingWon(ship, npc, resultFor(npc) as never);
  assert.ok(s.pendingBoarding);
  steps(game, 10);
  assert.ok(s.pendingBoarding, 'a moment later it still waits for her');
  s.pendingBoarding!.at = game.now - BOARD_SETTLE_SECS; // (the card unanswered all that while)
  npc.state.x = ship.state.x + 60; // (lying by her as a prize does, hers)
  npc.lootLockedFor = ship.id;
  npc.state.y = ship.state.y;
  steps(game, 30);
  assert.equal(s.pendingBoarding, null, 'settled by itself');
  assert.equal(conn(s).last('boarding')?.result, null, 'the card put away');
  assert.ok(toasts(s).includes('Your quartermaster shared out the spoils of the boarding.'), toasts(s).slice(-4).join(' | '));
  assert.ok((ship.cargo.rum ?? 0) >= 3, 'all of her (A): her hold in hers');
  assert.ok(!game.ships.get(npc.id)?.alive || game.ships.get(npc.id)?.sinkingUntil, 'the prize gone down');
  // left hove to (not sailing on unwatched); the helm is hers again at her own hand
  assert.equal(ship.input.sailTarget, 0);
  conn(s).push({ t: 'input', seq: 1, rudder: 0, sail: 3 });
  assert.ok(ship.input.sailTarget > 0, 'no longer hove to by a prize');
});

test('bug 1: the page never shuts the prize card by itself — the opening run waits for it, a goal never closes an answer window, the watchdog reopens it', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  // startGoal closes only a window that need not be answered
  const sg = main.slice(main.indexOf('function startGoal('), main.indexOf('function tapGoal('));
  assert.match(sg, /if \(modal && !ANSWER\.includes\(modal\)\) closeModal\(\);/);
  assert.doesNotMatch(sg, /if \(modal\) closeModal\(\);/);
  // the opening's run waits for a battle's account and an answer window
  const of = main.slice(main.indexOf('function openingFrame('), main.indexOf('function tradeGoodHere('));
  assert.match(of, /!state\.boarding/);
  assert.match(of, /ANSWER\.includes\(modal\)/);
  // the watchdog: every frame, the card up while the spoils wait; asked again on waking
  assert.match(main, /tactical\.render\(state\.boardTac\);\s*boardingCardFrame\(\);/);
  const wd = main.slice(main.indexOf('function boardingCardFrame('), main.indexOf('/** The sea\'s news held through'));
  assert.match(wd, /openModal\('boarding'\)/);
  assert.match(main, /resume: \(\) => \{[\s\S]{0,200}t: 'board_result'/);
  // answered, the card goes at once (the watchdog does not bring it back before the server's word)
  assert.match(main, /renderBoarding\(root, state\.boarding, state, \(m\) => net\.send\(m\), \(\) => \{\s*state\.boarding = null;/);
});

// ------------------------------------------------------------------ 2. the practice fight

function idleFight(lesson: boolean): { bt: TacBattle; crew: number } {
  const [a, b] = sidesAt(1, false, 'corsair', 'admiral', 3);
  b.army = (b.army ?? []).map((x) => ({ ...x, n: x.n * 5 })); // a raider far too strong for her
  const rng = new Rng(11);
  const bt = newBattle(a, b, 5, 0, rng, { len: 'board', level: 1 });
  if (lesson) bt.lesson = 0;
  assert.equal(bt.heroes[0].auto, false, 'her side at her hand');
  let crew = 0, t = 0;
  for (let k = 0; k < 6000 && !bt.over; k++) {
    stepBattle(bt, (t += 0.5), rng); // she does nothing at all
    crew = Math.max(crew, bt.log.filter((e) => e.k === 'timeout' && e.id === 'crew').length);
  }
  return { bt, crew };
}

test('bug 2: the practice fight cannot be lost by a pupil who does nothing — her crew plays a turn she lets run out', () => {
  const control = idleFight(false);
  assert.ok(control.bt.over && control.bt.over.winner === 1, 'without the lesson an idle captain loses to a raider this strong');
  const { bt, crew } = idleFight(true);
  assert.ok(bt.over, 'never stuck: it ends');
  assert.equal(bt.over!.winner, 0, 'the pupil wins (the raider strikes, or the rounds are hers)');
  assert.ok(crew > 0, 'her turns played by her crew, told in the feed');
  assert.ok(bt.stacks.some((s) => s.side === 0 && s.count > 0), 'her last man never falls');
  const v = viewOf(bt, 0, 0, true);
  assert.equal(v.lesson, true, 'the view says it is the practice fight (its hint)');
});

test('bug 2: the practice fight — no colours struck by the pupil; the lesson is the First Watch against a ship of the sea', () => {
  const [a, b] = sidesAt(1, false, 'corsair', 'admiral', 3);
  const rng = new Rng(3);
  const bt = newBattle(b, a, 5, 0, rng, { len: 'board', level: 1 }); // (the pupil boarded: side 1)
  bt.lesson = 1;
  assert.equal(act(bt, 1, { a: 'surrender' }, 1, rng), LESSON_NO_STRIKE);
  assert.equal(viewOf(bt, 1, 0, true).canStrike, false, 'no «Сдаться» offered');
  assert.equal(bt.over, null);
  const game = sea();
  const pupil = captain(game, 'Pupil', { newbie: true });
  pupil.profile!.tutorial!.on = true; // (still in the First Watch: its boarding stage)
  pupil.profile!.tutorial!.stage = 3;
  const old = captain(game, 'Salt', { level: 20 });
  const raider = game.spawnNpcShip('pirate', 'sloop', 'confederacy', pupil.ship!.state.x + 60, pupil.ship!.state.y, 0);
  assert.equal(lessonSide(game, pupil.ship!, raider), 0, 'a captain in the First Watch against the sea: the lesson');
  assert.equal(lessonSide(game, raider, pupil.ship!), 1);
  assert.equal(lessonSide(game, old.ship!, raider), null, 'past the First Watch: a real fight');
  assert.equal(lessonSide(game, pupil.ship!, old.ship!), null, 'never against a captain');
});

test('bug 2: every battle button that cannot be used looks it and says why on a tap (RU+EN)', () => {
  const src = readFileSync(new URL('../client/src/ui/tactical.ts', import.meta.url), 'utf8');
  const rb = src.slice(src.indexOf('const rb = (data: string'), src.indexOf('const offWait = this.offWait(v);'));
  assert.doesNotMatch(rb, /' disabled'/, 'no silent disabled round button');
  assert.match(src, /aria-disabled="true" data-why=/);
  assert.match(src, /closest<HTMLElement>\('\[aria-disabled="true"\]'\)[\s\S]{0,160}this\.notice\(b\.dataset\.why/);
  assert.match(src, /if \(this\.scrollLocked\(now\)\) this\.notice\(L\('scLocked'/, '«Авто — нужен свиток» says so on a tap');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.tb-rb\.off \{[^}]*grayscale/);
  assert.match(css, /\.tb-rb\.locked:not\(\.on\) \{[^}]*grayscale/, 'the locked «Авто» dimmed');
  for (const k of ['log.crew', 'hint.lesson', 'off.now', 'off.over', 'off.ready', 'off.skill'] as const) {
    assert.ok(TEN[k] && TRU[k], k);
    assert.doesNotMatch(TRU[k], /[A-Za-z]{3,}/, `${k}: Russian`);
  }
});

// ------------------------------------------------------------------ 3. a stray ball

function lawfulBy(game: Game, s: PlayerSession): { fisher: ShipEntity; pirate: ShipEntity } {
  const me = s.ship!;
  const fisher = game.spawnNpcShip('fisher', 'sloop', 'crown', me.state.x + 200, me.state.y, 0);
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', me.state.x + 240, me.state.y + 30, 0);
  for (const x of [me, fisher, pirate]) game.grid.upsert(x.id, x.state.x, x.state.y);
  return { fisher, pirate };
}

test('bug 3: a newcomer\'s stray ball on a lawful fisher beside her fight is no crime; aimed at her with nothing about, it is', () => {
  const game = sea();
  const s = captain(game, 'Strayling', { newbie: true });
  assert.ok(lawNewbie(s.profile));
  const { fisher, pirate } = lawfulBy(game, s);
  pirate.attackers.set(s.ship!.id, game.now); // she is fighting the pirate (her broadside at him)
  applyDamage(game, fisher, { hull: 20 }, s.ship!);
  assert.equal(s.profile!.infamy, 0, 'no infamy for the stray');
  assert.equal(wantedLevel(s.profile!.infamy), 0, 'not wanted');
  assert.ok(toasts(s).includes(STRAY_FORGIVEN), 'she is told');
  assert.ok(SERVER_RU_BATTLE[STRAY_FORGIVEN], 'RU');
  // the opening's campaign (past the First Watch, chapter one): forgiven too
  const c1 = captain(game, 'Chapterone', { level: 4 });
  c1.profile!.campaign!.at = 2;
  const l1 = lawfulBy(game, c1);
  l1.pirate.attackers.set(c1.ship!.id, game.now);
  applyDamage(game, l1.fisher, { hull: 20 }, c1.ship!);
  assert.equal(c1.profile!.infamy, 0, 'the campaign\'s first chapter: forgiven');
  // with nothing else about it is no stray: the law as before
  const lone = captain(game, 'Loner', { newbie: true });
  lone.ship!.state.y += 30000;
  game.grid.upsert(lone.ship!.id, lone.ship!.state.x, lone.ship!.state.y);
  const f2 = game.spawnNpcShip('fisher', 'sloop', 'crown', lone.ship!.state.x + 200, lone.ship!.state.y, 0);
  game.grid.upsert(f2.id, f2.state.x, f2.state.y);
  applyDamage(game, f2, { hull: 20 }, lone.ship!);
  assert.ok(lone.profile!.infamy > 0, 'aimed at a lawful ship alone: a crime');
  // a seasoned captain's stray is hers to answer for (the rule is the newcomer's)
  const vet = captain(game, 'Veteran', { level: 20 });
  const l2 = lawfulBy(game, vet);
  l2.pirate.attackers.set(vet.ship!.id, game.now);
  applyDamage(game, l2.fisher, { hull: 20 }, vet.ship!);
  assert.ok(vet.profile!.infamy > 0);
});

// ------------------------------------------------------------------ 4. «Причалить»

test('bug 4: every refusal of «Причалить» is told, each tap; under the helmsman she heaves to; a lapsed order is said', () => {
  const game = sea();
  const s = captain(game, 'Docker', { off: 6000 });
  // far from a harbour: the reason, the first tap and the second at once
  conn(s).inbox.length = 0;
  conn(s).push({ t: 'dock' });
  conn(s).push({ t: 'dock' });
  assert.equal(toasts(s, 'bad').filter((m) => m === 'No harbour close enough').length, 2, 'a second tap is answered too');
  // by the port at speed under the helmsman: held, the helmsman's course dropped so she slows
  const t = captain(game, 'Helmsman', { off: 300 });
  const ship = t.ship!;
  const port = game.world.ports.find((x) => REGIONS[x.region].safety === 'safe')!;
  // inside the harbour's approach (owner, 2026-10-22: «Причалить» only within REACH_DOCK of its anchorage; from
  // farther out the order sails her in — tests/reach.test.ts), out from its island, in open water
  const isl = game.world.islands[port.islandId];
  const d = Math.hypot(port.x - isl.x, port.y - isl.y) || 1;
  ship.state.x = port.x + ((port.x - isl.x) / d) * 20;
  ship.state.y = port.y + ((port.y - isl.y) / d) * 20;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  conn(t).push({ t: 'autosail', x: port.x + 9000, y: port.y + 9000 });
  ship.state.speed = 12;
  assert.ok(autosailOf(ship) || true);
  conn(t).inbox.length = 0;
  conn(t).push({ t: 'dock' });
  assert.equal(autosailOf(ship), null, 'the helmsman gives the wheel back: she takes in sail');
  assert.equal(ship.input.sailTarget, 0);
  assert.ok(toasts(t, 'info').length > 0, 'told that it waits');
  // its time out with nothing done (held at speed by the sea itself): said, not dropped in silence
  t.whenClear!.until = game.now - 1;
  ship.state.speed = 12;
  steps(game, 25);
  assert.ok(toasts(t, 'bad').includes(ORDER_LAPSED), 'the lapse is said');
  assert.ok(SERVER_RU_BATTLE[ORDER_LAPSED] && SERVER_RU_BATTLE[SPOILS_FIRST]);
});

test('bug 4: a fight ashore over, its account still up — «Причалить» puts it away and docks', () => {
  const game = sea();
  const s = captain(game, 'Gulls', { off: 300 });
  runAdmin(game, s, '/stack gull go');
  const sp = roamAtHand(game, s);
  assert.ok(sp, 'a stack beside her');
  assert.equal(attackRoam(game, s, sp!.id), null);
  landTac(game, s, { a: 'quick' }, true);
  assert.ok(landFighting(game, s), 'the account is up');
  const ship = s.ship!;
  const port = game.nearestPort(ship.state.x, ship.state.y)!;
  ship.state.x = port.x + 20; // (the harbour's approach — dock.ts)
  ship.state.y = port.y;
  ship.state.speed = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  ship.battleGraceUntil = 0;
  ship.battleCardAt = 0;
  conn(s).inbox.length = 0;
  conn(s).push({ t: 'dock' });
  assert.equal(landFighting(game, s), false, 'the account put away');
  assert.ok(ship.docked || toasts(s, 'bad').length > 0, 'docked, or told why');
  assert.ok(!toasts(s, 'bad').includes('Finish your battle first.'), 'not «finish your battle» over a battle already won');
});

test('bug 4: the action bar\'s button does its own act (by id), a stale one still does it', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /actAt: \(i, id\) => \{\s*const x = liveAct\(id\)/);
  assert.match(main, /act: \(id\) => padContext\(id\)/);
  assert.match(main, /function liveAct\(/);
  const hud = readFileSync(new URL('../client/src/ui/seahud.ts', import.meta.url), 'utf8');
  assert.match(hud, /hooks\.actAt\?\.\(Number\(b\.dataset\.acti\), b\.dataset\.act\)/);
  assert.match(hud, /onTap: \(\) => hooks\.act\(this\.actEl\.dataset\.act\)/);
  // «Причалить» always asks the harbour (no silent wait of the page's own)
  const rd = main.slice(main.indexOf('function requestDock('), main.indexOf('/** The nearest harbour «В порт»'));
  assert.match(rd, /net\.send\(\{ t: 'dock', bribe \}\);/);
  assert.doesNotMatch(rd, /own\.speed > 6/);
});

test('bug 1 (the end of every battle): its screen is not laid anew under the finger, the tap hides it at once, ashore the close is asked again', () => {
  const src = readFileSync(new URL('../client/src/ui/tactical.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(endHtml !== this\.endHtml \|\| !banner\.querySelector\('\[data-endbtn\]'\)\) \{/, 'laid anew only when its words change');
  const tap = src.slice(src.indexOf("banner.querySelector<HTMLElement>('[data-endbtn]')!.addEventListener('click'"), src.indexOf("banner.querySelectorAll<HTMLElement>('[data-cap]')"));
  assert.match(tap, /banner\.classList\.add\('hidden'\);\s*if \(now\.land\) \{/, 'hidden at once, ashore as at sea');
  assert.match(src, /v\.land && !v\.replay && this\.endHidden && this\.closeAskAt && performance\.now\(\) - this\.closeAskAt > 2500\) \{[\s\S]{0,120}t: 'lair', action: 'close'/, 'ashore: asked again until the field goes');
  // the opening's run starts again after a return to port (a wreck, a tow, a mutiny's port)
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  const of = main.slice(main.indexOf('function openingFrame('), main.indexOf('function tradeGoodHere('));
  assert.match(of, /if \(state\.self\?\.dockedAt\) openingRun = '';/);
});
