// ux2 (owner, 2026-10-11): «после взятия квеста должна быть метка куда плыть, нажатие на эту метку корабль начинает
// плавание до места. вообще нужно максимум автоматизировать все»; «журнал иногда подзаедает и не переключает вкладки»;
// «полукруглая обводка появляется на кнопках»; «в талантах гиганские шрифты … я бы сделал 10 шрифт по умолчанию».
// The quests' places and what is done there, the run to a goal (re-targeted after each step, docked, landed, let go by
// her own hand), a course broken off by a fight and taken up again, the newly taken quest followed, the taps that are
// never lost to a redraw, the phone's type scale, the focus ring off on touch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { TICK_RATE } from '../shared/src/constants.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { RESUME_CALM, RESUME_WORDS, autosailOf, pausedCourse, startAutosail, stopAutosail } from '../server/src/game/autosail.ts';
import { lairList, lairUp } from '../server/src/game/beastlairs.ts';
import { openSea } from '../server/src/game/wrecks.ts';
import { GoalRun, goalTarget, goalsNear } from '../client/src/ui/goalrun.ts';
import type { GoalState, GoalView } from '../client/src/ui/goalrun.ts';
import { trackedQuest } from '../client/src/ui/track.ts';
import { keyOf, TAB_SEL } from '../client/src/ui/kit/taps.ts';
import { EN as UX2_EN, RU as UX2_RU } from '../client/src/lang/ui/ux2.ts';
import { SERVER_RU_H } from '../client/src/lang/server.ru.h.ts';
import { defaults, sanitize } from '../client/src/settings.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function captain(game: Game, name: string): { s: PlayerSession; c: FakeConn } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 1000;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  onHull(game, s.ship!, 'brig', 4);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  return { s, c };
}

/** A test quest of one step, put on her log. */
function give(game: Game, s: PlayerSession, id: string, step: QuestDef['steps'][number]): void {
  QUESTS_BY_ID[id] = { id, kind: 'job', name: `Test ${id}`, mentor: 'Tester', port: 'gravewater', summary: '', requires: {}, steps: [step], reward: { xp: 1, silver: 1 } };
  s.profile!.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now });
}

test('a quest’s place says what is done there: a port to put in at, an island to land on, a lair, a wreck', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Waypoint Wren');
  const port = game.world.ports.find((p) => p.id !== 'gravewater')!;
  const isle = game.world.islands.findIndex((i) => !i.minor && !i.hidden);
  give(game, s, 'ux2_visit', { type: 'visit', port: port.id, text: 'Visit.' });
  give(game, s, 'ux2_race', { type: 'race', port: port.id, seconds: 900, text: 'Race.' });
  give(game, s, 'ux2_landres', { type: 'landres', port: port.id, res: 'shell', qty: 2, text: 'Shells.' });
  give(game, s, 'ux2_land', { type: 'land', island: isle, text: 'Land.' });
  give(game, s, 'ux2_lair', { type: 'lair', count: 1, text: 'A lair.' });
  give(game, s, 'ux2_dive', { type: 'dive', count: 1, text: 'Dive.' });
  give(game, s, 'ux2_sink', { type: 'sink', count: 3, text: 'Sink three.' });
  const t = game.questTargets(s);
  for (const id of ['ux2_visit', 'ux2_race', 'ux2_landres']) {
    assert.deepEqual([t[id]?.port, t[id]?.act, t[id]?.x, t[id]?.y], [port.id, 'dock', Math.round(port.x), Math.round(port.y)], id);
  }
  assert.equal(t.ux2_land.island, isle);
  assert.equal(t.ux2_land.act, 'land');
  assert.ok(t.ux2_land.r! > game.world.islands[isle].radius, 'within the shore’s reach');
  // the nearest lair still standing, wherever she is
  const ship = s.ship!;
  const up = lairList(game).filter((l) => lairUp(game, l));
  const best = up.reduce((a, b) => (Math.hypot(b.x - ship.state.x, b.y - ship.state.y) < Math.hypot(a.x - ship.state.x, a.y - ship.state.y) ? b : a));
  assert.ok(t.ux2_lair, 'a lair step points somewhere');
  assert.ok(Math.hypot(t.ux2_lair.x - best.x, t.ux2_lair.y - best.y) < 2, 'at the nearest lair standing');
  // the nearest wreck her divers can go down to
  assert.ok(t.ux2_dive && t.ux2_dive.r === 120, 'a dive points at a wreck');
  assert.ok(game.wrecks.some((w) => Math.hypot(w.x - t.ux2_dive.x, w.y - t.ux2_dive.y) < 2));
  assert.equal(t.ux2_sink, undefined, 'a count of ships anywhere has no place');
  // the private state carries it to the journal
  const view = (game as unknown as { worldView(s: PlayerSession): { questTargets: Record<string, unknown> } }).worldView(s);
  assert.ok(view.questTargets.ux2_visit);
  for (const id of ['ux2_visit', 'ux2_race', 'ux2_landres', 'ux2_land', 'ux2_lair', 'ux2_dive', 'ux2_sink']) delete QUESTS_BY_ID[id];
});

/** The client's goals over a little sea. */
function sea(): GoalState & { self: NonNullable<GoalState['self']> } {
  return {
    self: {
      quests: [
        { id: 'far', name: 'Far', target: { x: 9000, y: 0, r: 400, port: 'p2', act: 'dock' } },
        { id: 'near', name: 'Near', target: { x: 1000, y: 0, r: 400, island: 7, act: 'land' } },
        { id: 'none', name: 'Nowhere' },
      ],
      contracts: [{ id: 'c1', title: 'Cargo', toPort: 'p2' }, { id: 'c2', title: 'Bounty' }],
    },
    ports: [{ id: 'p2', x: 9000, y: 0 }],
    tasks: [{ id: 3, kind: 'nest', island: 'Isle', x: 0, y: 4000, r: 300, done: false }],
  };
}

test('the goals: a quest’s place, a contract’s port, a task; the nearest followed by default, a new one followed', () => {
  const st = sea();
  assert.deepEqual(goalTarget(st, 'q:far'), { x: 9000, y: 0, r: 400, port: 'p2', act: 'dock', key: 'q:far', title: 'Far' });
  assert.equal(goalTarget(st, 'q:none'), null, 'no place');
  assert.deepEqual([goalTarget(st, 'c:c1')?.port, goalTarget(st, 'c:c1')?.act], ['p2', 'dock']);
  assert.equal(goalTarget(st, 'c:c2'), null);
  assert.equal(goalTarget(st, 't:3')?.r, 300);
  assert.deepEqual(goalsNear(st, { x: 0, y: 0 }).map((g) => g.key), ['q:near', 't:3', 'q:far', 'c:c1']);
  // the journal's default: the nearest quest that points somewhere
  globalThis.localStorage?.removeItem('gravetide.track');
  assert.equal(trackedQuest(st.self.quests as never, { x: 0, y: 0 })?.id, 'near');
  assert.equal(trackedQuest(st.self.quests as never, { x: 9500, y: 0 })?.id, 'far');
  const main = src('client/src/main.ts');
  assert.ok(main.includes('noteNewQuests(); // ux2'), 'a quest just taken is followed');
  assert.ok(/function noteNewQuests[\s\S]*?setTracked\(fresh\.id\)/.test(main));
});

/** A moment of the sea for the run. */
const view = (o: Partial<GoalView> & { target: GoalView['target'] }): GoalView => ({ now: 0, docked: null, own: { x: 0, y: 0 }, region: 'r', autosail: null, stop: null, landable: false, ...o });

test('the run to a goal: the course, the next step’s course, putting in, the landing, her own hand ends it', () => {
  const st = sea();
  const run = new GoalRun('q:far', 0, 420);
  let t = goalTarget(st, 'q:far');
  assert.deepEqual(run.step(view({ target: t })), { do: 'sail', x: 9000, y: 0 }, 'a port: to the quay, no near');
  assert.deepEqual(run.step(view({ now: 100, target: t, autosail: { x: 9000, y: 0 } })), { do: 'none' }, 'on her way');
  // in the harbour's reach she puts in (once in a while, not every frame)
  assert.deepEqual(run.step(view({ now: 5000, target: t, own: { x: 8800, y: 0 } })), { do: 'dock' });
  assert.deepEqual(run.step(view({ now: 5100, target: t, own: { x: 8800, y: 0 } })), { do: 'none' });
  // docked: the step is the server's; the next step points elsewhere — in port she waits, off the quay she sails
  st.self.quests[0].target = { x: 0, y: 6000, r: 400, island: 2, act: 'land' };
  t = goalTarget(st, 'q:far');
  assert.deepEqual(run.step(view({ now: 9000, target: t, docked: 'p2', own: { x: 8800, y: 0 } })), { do: 'none' });
  assert.deepEqual(run.step(view({ now: 15000, target: t, own: { x: 8800, y: 100 } })), { do: 'sail', x: 0, y: 6000, near: 150 });
  // at the island with a landing in reach: the party goes, once; then she is there
  assert.deepEqual(run.step(view({ now: 30000, target: t, own: { x: 0, y: 5700 }, landable: true, autosail: null, stop: { why: 'arrived', at: 29000 } })), { do: 'land' });
  assert.deepEqual(run.step(view({ now: 30100, target: t, own: { x: 0, y: 5700 }, landable: true, stop: { why: 'arrived', at: 29000 } })), { do: 'arrived', title: 'Far' });
  // the quest done: the run ends
  st.self.quests.shift();
  assert.deepEqual(run.step(view({ now: 31000, target: goalTarget(st, 'q:far') })), { do: 'end', why: 'done' });
  // a run let go by her hand on the wheel, or by another course; a fight is the server's to take up again
  const r2 = new GoalRun('q:near', 0, 420);
  const t2 = goalTarget(st, 'q:near');
  assert.equal(r2.step(view({ now: 0, target: t2, own: { x: -5000, y: 0 } })).do, 'sail');
  assert.equal(r2.step(view({ now: 1000, target: t2, own: { x: -4800, y: 0 }, stop: { why: 'hostile', at: 900 } })).do, 'none', 'broken off by a fight: waits');
  assert.equal(r2.step(view({ now: 9000, target: t2, own: { x: -4800, y: 0 }, autosail: { x: 1000, y: 0 } })).do, 'none', 'taken up again by the server');
  assert.deepEqual(r2.step(view({ now: 9500, target: t2, own: { x: -4700, y: 0 }, stop: { why: 'manual', at: 9400 } })), { do: 'end', why: 'helm' });
  const r3 = new GoalRun('q:near', 0, 420);
  r3.step(view({ now: 0, target: t2, own: { x: -5000, y: 0 } }));
  assert.deepEqual(r3.step(view({ now: 500, target: t2, own: { x: -5000, y: 0 }, autosail: { x: -9000, y: 300 } })), { do: 'end', why: 'helm' }, 'another course');
  // refused twice (the helmsman never took the wheel): let go, no order every few seconds for ever
  const r4 = new GoalRun('q:near', 0, 420);
  assert.equal(r4.step(view({ now: 0, target: t2, own: { x: -5000, y: 0 } })).do, 'sail');
  assert.equal(r4.step(view({ now: 3000, target: t2, own: { x: -5000, y: 0 } })).do, 'none');
  assert.equal(r4.step(view({ now: 4100, target: t2, own: { x: -5000, y: 0 } })).do, 'sail');
  assert.deepEqual(r4.step(view({ now: 7000, target: t2, own: { x: -5000, y: 0 } })), { do: 'end', why: 'helm' });
  // docs/30: there (a lair on an island), then carried a little off by her way: no new course onto the shore
  const r5 = new GoalRun('q:near', 0, 420);
  assert.equal(r5.step(view({ now: 0, target: t2, own: { x: -5000, y: 0 } })).do, 'sail');
  const at = { x: t2!.x, y: t2!.y + Math.max(150, t2!.r * 0.6) - 10 };
  assert.equal(r5.step(view({ now: 60000, target: t2, own: at, stop: { why: 'arrived', at: 59000 } })).do, 'arrived');
  assert.equal(r5.step(view({ now: 70000, target: t2, own: { x: at.x, y: at.y + 120 }, stop: { why: 'arrived', at: 59000 } })).do, 'none', 'drifted a little: no new course');
  assert.equal(r5.step(view({ now: 90000, target: t2, own: { x: at.x, y: at.y + 3000 }, stop: { why: 'arrived', at: 59000 } })).do, 'sail', 'gone far off: the course again');
});

/** Open water `d` metres east of her. */
function eastOf(game: Game, s: PlayerSession, d: number): { x: number; y: number } {
  const ship = s.ship!;
  for (let k = 0; k < 40; k++) {
    const x = ship.state.x + d, y = ship.state.y + k * 300;
    if (openSea(game, x, y) && openSea(game, ship.state.x, y)) {
      ship.state = { ...ship.state, y, speed: 0 };
      game.grid.upsert(ship.id, ship.state.x, y);
      return { x, y };
    }
  }
  throw new Error('no open water east of her');
}

test('a course broken off by a fight is taken up again once the sea is quiet; her own stop drops it', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Resume Rhea');
  const ship = s.ship!;
  const to = eastOf(game, s, 2500);
  assert.equal(startAutosail(game, s, to.x, to.y), null);
  // a hostile sail: the helmsman hands the wheel back and keeps the mark
  stopAutosail(game, s, 'hostile');
  assert.equal(autosailOf(ship), null);
  assert.deepEqual([pausedCourse(ship)?.x, pausedCourse(ship)?.y], [to.x, to.y]);
  // her hand on the wheel keeps it hers
  const tps = TICK_RATE;
  // (an input twice a second, as a held stick sends it: the flood guard drops more than 90 a second)
  for (let i = 0; i < (RESUME_CALM * 2 + 1) * tps; i++) {
    if (i % 10 === 0) c.push({ t: 'input', rudder: 0.5, sail: 3, seq: i });
    game.step();
  }
  assert.equal(autosailOf(ship), null, 'not while she steers');
  // the sea quiet and the wheel let go: he takes it again
  steps(game, (RESUME_CALM * 2 + 1) * tps);
  assert.ok(autosailOf(ship), 'the course is taken up again');
  assert.equal(pausedCourse(ship), null);
  assert.ok(c.all('toast').some((m) => (m as { msg: string }).msg === RESUME_WORDS), 'she is told');
  // a stop of her own drops a broken-off course
  stopAutosail(game, s, 'attack');
  assert.ok(pausedCourse(ship));
  c.push({ t: 'autosail', stop: true });
  game.step();
  assert.equal(pausedCourse(ship), null, 'the pill’s stop drops it');
  steps(game, (RESUME_CALM * 2 + 1) * tps);
  assert.equal(autosailOf(ship), null);
  // a weak hull, port, her ship lost: dropped too
  startAutosail(game, s, to.x, to.y);
  stopAutosail(game, s, 'storm');
  ship.hull = ship.stats.hullMax * 0.1;
  game.step();
  assert.equal(pausedCourse(ship), null, 'a weak hull is not left to the helmsman');
  assert.equal(SERVER_RU_H[RESUME_WORDS], 'Бой позади: рулевой снова ведёт корабль к метке.');
});

test('taps are never lost to a redraw: the window waits for the tap, a tab drawn away is pressed again, a long press still switches', () => {
  // a tab is found again by what it was
  const el = { attributes: [{ name: 'class', value: 'w-tab on' }, { name: 'role', value: 'tab' }, { name: 'data-jtab', value: 'company' }, { name: 'data-hint', value: 'x' }] } as unknown as HTMLElement;
  assert.equal(keyOf(el), '[data-jtab="company"]');
  assert.equal(keyOf({ attributes: [{ name: 'class', value: 'tab' }] } as unknown as HTMLElement), '');
  assert.match(TAB_SEL, /role="tab"/);
  const main = src('client/src/main.ts');
  assert.ok(/function refreshModal\(\): void \{\s*holdRedraw\(drawModal\);/.test(main), 'every window’s redraw waits for the finger');
  assert.ok(main.includes('installTapGuard(') && main.includes('rescueTaps();'));
  const hint = src('client/src/ui/kit/hint.ts');
  assert.ok(hint.includes('!el.matches(TAB_SEL)'), 'a long press on a tab shows its hint and still switches');
  const fit = src('client/fit.css');
  assert.ok(/#modal-panel \{ transition-duration: 120ms; \}/.test(fit), 'the window slides up in 120 ms');
  assert.ok(fit.includes('-webkit-touch-callout: none'), 'no system menu on a long press of a tab');
  assert.ok(src('tools/mobile/ux2/tabs.mjs').includes('Input.dispatchTouchEvent'), 'the QA script taps with touch');
});

test('the phone’s type: 10 px text, 8–9 secondary, headings 12–14, iOS keeps the sizes, no focus ring on touch', () => {
  const fit = src('client/fit.css');
  const px = (name: string, u: number) => {
    const m = new RegExp(`${name}: calc\\(([\\d.]+)px \\+ ([\\d.]+) \\* var\\(--u\\)\\)`).exec(fit);
    assert.ok(m, name);
    return Number(m[1]) + Number(m[2]) * u;
  };
  // at 360 px tall and over (--u = 1 px) and at 270 px (0)
  assert.deepEqual([px('--f-fs', 1), px('--f-fs-s', 1), px('--f-fs-xs', 1), px('--f-fs-h', 1), px('--f-fs-t', 1)], [10, 9, 8, 13, 14]);
  assert.deepEqual([px('--f-fs', 0), px('--f-fs-s', 0), px('--f-fs-xs', 0), px('--f-fs-h', 0), px('--f-fs-t', 0)], [9, 8, 7, 12, 12.5]);
  assert.ok(fit.includes('html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }'), 'iOS blows nothing up sideways');
  assert.ok(fit.includes('body.touch :focus, body.touch :focus-visible { outline: none !important; }'), 'no ring on touch');
  assert.ok(src('client/styles.css').includes(':focus-visible { outline: 2px solid var(--gold)'), 'the desk keeps its keyboard ring');
  const audit = src('tools/mobile/fit/measure.js');
  assert.ok(audit.includes('minText = 6') && audit.includes('const BIG = 14.5'), 'the audit’s tiny and big');
});

test('settings: «Всегда докупать» off, «Курс к заданию» on; every new line in both tongues', () => {
  assert.equal(defaults().autoTopUp, false);
  assert.equal(defaults().autoGoal, true);
  assert.equal(sanitize({ autoTopUp: 'yes' as never }).autoTopUp, false);
  assert.equal(sanitize({ autoGoal: false }).autoGoal, false);
  assert.deepEqual(Object.keys(UX2_RU).sort(), Object.keys(UX2_EN).sort());
  for (const [k, v] of Object.entries(UX2_RU)) {
    assert.ok(v && !/[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, '')), `${k}: Russian`);
    assert.deepEqual(v.match(/\{\w+\}/g) ?? [], (UX2_EN as Record<string, string>)[k].match(/\{\w+\}/g) ?? [], `${k}: placeholders`);
  }
});

test('Telegram: fullscreen asked after ready, again and on the first tap, the answers logged; the Main Mini App link opens it fullscreen', async () => {
  const tg = src('client/src/tg.ts');
  assert.ok(/if \(at\('8\.0'\)\) \{\s*watchFullscreen\(w, phone\);\s*if \(phone\) askFullscreen\(w, 'ready'\);/.test(tg), 'after ready()');
  assert.ok(tg.includes("askFullscreen(w, 'again')") && tg.includes("askFullscreen(w, 'first tap')"), 'again, and on the first tap');
  assert.ok(tg.includes("'fullscreenChanged'") && tg.includes("'fullscreenFailed'") && tg.includes('console.warn(`[tg] fullscreenFailed: ${why}`)'), 'logged');
  assert.ok(tg.includes('android_x'), 'Telegram X is a phone');
  const { TelegramService, fakeBotApi, telegramFromEnv } = await import('../server/src/telegram.ts');
  const { game, db } = makeGame();
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const mk = (mainApp: boolean) => new TelegramService({ db, auth: game.auth, game, token: '1:t', fetch: fakeBotApi(calls), publicUrl: 'https://gravetidegame.com', webappUrl: 'https://tg.gravetidegame.com', log: () => {}, mainApp });
  assert.deepEqual(mk(false).playButton('ru'), { text: 'Играть', web_app: { url: 'https://tg.gravetidegame.com' } });
  assert.deepEqual(mk(true).playButton('en'), { text: 'Play', url: 'https://t.me/gravetide_bot?startapp=play&mode=fullscreen' });
  await mk(true).handleUpdate({ update_id: 1, message: { message_id: 1, from: { id: 5, first_name: 'Anne', language_code: 'ru' }, chat: { id: 5, type: 'private' }, text: '/start' } } as never);
  const kb = (calls.findLast((c) => c.method === 'sendMessage')!.params.reply_markup as { inline_keyboard: unknown[][] }).inline_keyboard[0][0];
  assert.deepEqual(kb, { text: 'Играть', url: 'https://t.me/gravetide_bot?startapp=play&mode=fullscreen' });
  assert.equal(telegramFromEnv({ db, auth: game.auth, game, publicUrl: 'https://x' }, { TELEGRAM_BOT_TOKEN: '1:t', TELEGRAM_FAKE: '1', TG_MAIN_APP: '1' })?.mainApp, true);
  assert.ok(src('docs/27_TELEGRAM.md').includes('Configure Mini App') && src('docs/27_TELEGRAM.md').includes('TG_MAIN_APP=1'), 'the owner’s BotFather steps');
});
