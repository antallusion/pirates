// Retention (2026-10-25: of 44 new accounts 5 left on the captain's screen and more than half never finished the First
// Watch): the newcomers' funnel in the telemetry's file, the /ops line in both languages, «Пропустить обучение» with its
// confirm, the watch kept short (the «Огонь» step's grace, the pilot that takes her in, no deployment phase, the free
// quick fight under the finger), the opening's shops counted when already satisfied, the battle's loading screen
// waiting only for its opening frame.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { FIRE_GRACE, STAGES } from '../server/src/game/onboarding.ts';
import { stepMoot } from '../server/src/game/quests.ts';
import { autosailOf, pausedCourse } from '../server/src/game/autosail.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { Telemetry, funnelLine, funnelLineRu, setTelemetry } from '../server/src/http/telemetry.ts';
import { pointerTargets, WATCH_BATTLE } from '../client/src/ui/pointer.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as LANG_EN } from '../client/src/lang/en.ts';
import { RU as LANG_RU } from '../client/src/lang/ru.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, makeGame, steps } from './helpers.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function recruit(game: Game, name: string, tutorial = true): { c: FakeConn; s: PlayerSession } {
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'Retained', tutorial });
  return { c, s: game.sessionByName(name)! };
}

test('the funnel: steps counted once a day per account or page, kept only as hashes; the page may report only its captain screen', () => {
  const t = new Telemetry(':memory:');
  const day = Date.UTC(2026, 9, 25, 12);
  t.mark('captain', 'acc:1', day);
  t.mark('captain', 'acc:1', day + 1000); // the same account again: once
  t.mark('captain', 'acc:2', day);
  t.mark('captain', 'acc:1', day + 86400_000); // the next day: counted on its day
  t.mark('Bad Kind!', 'acc:3', day);
  t.ingest({ id: 'device-one-xyz', funnel: ['cap_screen', 'captain', 'fw_done'] }, 'Mozilla/5.0 (Windows NT 10.0)', day);
  t.ingest({ id: 'device-one-xyz', funnel: ['cap_screen'] }, 'Mozilla/5.0 (Windows NT 10.0)', day);
  t.ingest({ funnel: ['cap_screen'] }, 'Mozilla/5.0 (Windows NT 10.0)', day); // no id: not counted
  const f = t.funnel(2, day + 86400_000);
  assert.equal(f.total.captain, 3);
  assert.equal(f.byDay['2026-10-25'].captain, 2);
  assert.equal(f.byDay['2026-10-26'].captain, 1);
  assert.equal(f.total.cap_screen, 1, 'a page counts its captain screen once a day');
  assert.equal(f.total.fw_done, undefined, 'a page cannot report the server’s steps');
  assert.ok(!Object.keys(f.total).some((k) => /bad/i.test(k)));
  assert.ok(!JSON.stringify(f).includes('device-one-xyz') && !JSON.stringify(f).includes('acc:'), 'no ids in the summary');
  const html = t.html(t.summary(7, day));
  assert.match(html, /Воронка новичков/);
  t.close();
});

test('the funnel from the game: captain, each First Watch step reached, its end; a skip; the shops’ steps; 5 minutes aboard; /ops shows it in EN and RU', () => {
  const was = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  const t = new Telemetry(':memory:');
  setTelemetry(t);
  try {
    const { game } = makeGame();
    const a = recruit(game, 'Funnel Ann');
    let f = t.funnel(1, game.wallNow());
    assert.equal(f.total.captain, 1);
    assert.equal(f.total.fw0, 1, 'the watch’s first step reached');
    // two steps passed one by one, then the rest skipped at once
    a.c.push({ t: 'onboarding', action: 'skip_stage' });
    a.c.push({ t: 'onboarding', action: 'skip_stage' });
    a.c.push({ t: 'onboarding', action: 'skip_all' });
    f = t.funnel(1, game.wallNow());
    assert.equal(f.total.fw1, 1);
    assert.equal(f.total.fw2, 1);
    assert.equal(f.total.fw3, undefined, 'the steps skipped all at once are not reached');
    assert.equal(f.total.fw_skip, 1);
    assert.equal(f.total.fw_done, undefined);
    // «I know the sea»: a captain and a skip
    recruit(game, 'Old Hand', false);
    // the opening's first step reached once the watch is behind her, and five minutes aboard
    a.s.profile!.tutorial.aboard = 5 * 60 - 3;
    steps(game, 20 * 4);
    f = t.funnel(1, game.wallNow());
    assert.equal(f.total.captain, 2);
    assert.equal(f.total.fw_skip, 2);
    assert.equal(f.total['c01_01:0'], 2, 'the shops’ first step reached by both (the steps passed at once count as reached)');
    assert.equal(f.total.play5, 1);
    // /ops: the funnel's own line (live ops off here: its line follows)
    a.c.push({ t: 'chat', text: '/ops' });
    const line = a.c.all('toast').map((m) => m.msg).find((m) => m.startsWith('Newcomers’ funnel') || m.startsWith("Newcomers' funnel"))!;
    assert.ok(line, 'the funnel line');
    assert.match(line, /captain screen 0 → captain 2; First Watch steps 1–5 1\/1\/1\/0\/0, done 0, skipped 2;/);
    assert.equal(line, funnelLine(t.funnel(3, game.wallNow())));
    setLang('ru');
    try {
      const ru = serverText(line).replace(/ /g, ' ');
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/c01|fw/g, '')), ru);
      assert.match(ru, /^Воронка новичков за 3 дн\.: экран капитана 0 → капитан 2;/);
      assert.equal(ru, funnelLineRu(t.funnel(3, game.wallNow())).replace(/ /g, ' '), 'the console’s Russian is the bot’s');
    } finally {
      setLang('en');
    }
  } finally {
    setTelemetry(null);
    t.close();
    if (was === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = was;
  }
});

test('«Пропустить обучение» asks first; the prologue is one line and short; RU and EN for every new word', () => {
  const ui = read('client/src/ui/onboarding.ts');
  assert.match(ui, /skip_all'\) void ask\(t\('watch\.skipAsk'\)/, 'the whole watch is skipped only after a «yes»');
  assert.match(ui, /PROLOGUE_MS = 3500/);
  assert.ok(!/prologue\.1|prologue\.2/.test(ui.slice(ui.indexOf('export function playPrologue'))), 'one line, not three');
  for (const k of ['watch.skipAsk', 'watch.skipYes', 'watch.skipNo', 'rotate.tap'] as const) {
    assert.ok((LANG_EN as Record<string, string>)[k] && (LANG_RU as Record<string, string>)[k], k);
    assert.ok(!/[A-Za-z]/.test((LANG_RU as Record<string, string>)[k]), `${k}: Russian`);
  }
  // the captain's screen: «Начать» always starts (a premium one looked at: with the free one chosen before)
  const cap = read('client/src/ui/captain.ts');
  assert.match(cap, /const who = captainOpen\(current\) \? current : lastFree;/);
  assert.match(read('client/src/lang/ui/captain.ts'), /takeCommand: 'Начать'/);
  assert.match(cap, /telemetryFunnel\('cap_screen'\)/);
});

test('the watch kept short: «Огонь» counts FIRE_GRACE s after her press; «В порт» brings her in at once; no deployment phase while fresh', () => {
  assert.ok(FIRE_GRACE > 0 && FIRE_GRACE <= 5);
  const { game } = makeGame();
  const { c, s } = recruit(game, 'Quick Kate');
  const stage = () => c.last('onboarding')!.view.stage;
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(stage(), 'attack');
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  raider.state = { ...raider.state, x: ship.state.x + 600, y: ship.state.y };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  c.push({ t: 'attack', target: raider.id, mode: 'board' });
  steps(game, 21);
  assert.equal(stage(), 'fire');
  // her press of «Огонь» with nothing bearing (the guns laid on her): no hit, and the step ends all the same
  c.push({ t: 'attack', target: raider.id, mode: 'guns' });
  steps(game, 20 * (FIRE_GRACE + 2));
  assert.equal(stage(), 'board', 'the press is the lesson');
  // «В порт»: skip to it, then the helmsman's course for the harbour — the pilot takes her in
  c.push({ t: 'onboarding', action: 'skip_stage' });
  steps(game, 21);
  assert.equal(stage(), 'port');
  for (const x of [...game.ships.values()]) if (x.name === 'Red Novice') game.removeShip(x.id);
  steps(game, 40); // (her pursuit of the raider gone lets go)
  const home = game.portById('saltmarrow')!;
  // (out at sea, a fair way off: the helmsman's course home)
  for (const [dx, dy] of [[1500, 0], [-1500, 0], [0, 1500], [0, -1500]]) {
    ship.state = { ...ship.state, x: home.x + dx, y: home.y + dy, speed: 0 };
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
    c.push({ t: 'autosail', x: home.x, y: home.y });
    // (on, or held back by the fight just over: either way her course for the harbour)
    if (c.last('autosail')) break;
  }
  steps(game, 20 * 3);
  assert.equal(ship.docked, 'saltmarrow', `in at once ${JSON.stringify([c.all('autosail').slice(-1), pausedCourse(ship), autosailOf(ship)?.x])}`);
  assert.equal(c.last('onboarding')!.view.stage, null, 'the watch is over');
  // the deployment phase skipped while fresh
  assert.match(read('server/src/game/tactical.ts'), /ses\.deployStacks && ses\.disconnectedAt === null && !fresh\(ses\.profile\)/);
  assert.match(read('server/src/game/tactical.ts'), /if \(pupil !== null\) bt\.quick\[pupil\] = true;/);
  assert.equal(STAGES.length, 5);
});

test('the finger: «Огонь» on a desk too, «Быстрый бой» in the watch’s battle, nothing in other battles', () => {
  const base = { touch: false, docked: false, battle: false };
  assert.deepEqual(pointerTargets({ ...base, stage: 'fire' }), ['#tc-fire']);
  assert.deepEqual(pointerTargets({ ...base, stage: 'board', battle: true }), WATCH_BATTLE);
  assert.deepEqual(pointerTargets({ ...base, stage: 'c:sink', battle: true }), []);
  assert.deepEqual(pointerTargets({ ...base, stage: null, battle: true }), []);
});

test('the opening’s shops counted when already satisfied (after the watch): sailcloth, a trade good (the provisions stay a lesson)', () => {
  const { game } = makeGame();
  const { c, s } = recruit(game, 'Shop Sue', false);
  const q = QUESTS_BY_ID.c01_01;
  assert.ok(q, 'the opening’s shops');
  const step = (shop: string) => q.steps.find((x) => x.type === 'buy' && x.shop === shop)!;
  const ship = s.ship!;
  ship.cargo = {};
  assert.equal(stepMoot(s, step('sailcloth'), game, true), null);
  assert.equal(stepMoot(s, step('trade'), game, true), null);
  ship.cargo = { sailcloth: 2 };
  assert.equal(stepMoot(s, step('sailcloth'), game, false), null, 'a job’s purchase is not the opening’s lesson');
  ship.cargo = { provisions: 999, sailcloth: 2, rum: 3 };
  assert.ok(!/aboard/.test(stepMoot(s, step('provisions'), game, true) ?? ''), 'the provisions are the buying’s lesson (owner, 2026-10-21)');
  assert.match(stepMoot(s, step('sailcloth'), game, true)!, /Sailcloth is aboard/);
  assert.match(stepMoot(s, step('trade'), game, true)!, /A good to trade is aboard/);
  // in the First Watch the lesson goes on
  const w = recruit(game, 'Watch Will');
  w.s.ship!.cargo = { provisions: 5, sailcloth: 2, rum: 3 };
  assert.equal(stepMoot(w.s, step('sailcloth'), game, true), null);
  // the Russian of the toasts
  const ru = read('client/src/lang/server.ru.campaign.ts');
  for (const k of ['Sailcloth is aboard — the step is counted.', 'A good to trade is aboard — the step is counted.']) assert.ok(ru.includes(`'${k}'`), k);
  void c;
});

test('a battle’s loading screen waits for its opening frame only; the rest streams; the First Watch warms its battle', () => {
  const main = read('client/src/main.ts');
  assert.match(main, /beginLoad\('battle', BATTLE_LOAD_MS\)\.need\(first\)\.settle\(BATTLE_SETTLE_MS\)/);
  assert.match(main, /ensureAssets\(later, \{ prio: 1 \}\)/);
  const tac = read('client/src/ui/tactical.ts');
  const split = tac.slice(tac.indexOf('export function tacArtSplit'), tac.indexOf('/** The hulls whose decks are painted'));
  assert.match(split, /const later: string\[\] = \[\.\.\.assetIds\('part\.'\), \.\.\.assetIds\('fx\.bt_'\), 'bg\.spellbook'\]/, 'the effects are not waited for');
  assert.match(split, /for \(const pose of \['_atk', '_b', '_hit'\]\) later\.push/, 'the poses stream in');
  assert.match(read('client/src/ui/loader.ts'), /settle\(capMs\?: number\): Handle;/);
  assert.match(read('client/src/scenewarm.ts'), /stage === 'sail' \|\| stage === 'attack' \|\| stage === 'fire' \|\| stage === 'board'/);
});
