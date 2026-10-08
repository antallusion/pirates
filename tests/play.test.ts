// The playthrough of 2026-10-09 (a new captain from the login to the late screens, 1500×600 by mouse and 812×375 by
// touch): what got in her way, each fixed thing held here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import type { Game } from '../server/src/game/Game.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { FakeConn, makeGame, steps } from './helpers.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { EN as CAP_EN, RU as CAP_RU } from '../client/src/lang/ui/captain.ts';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function pupil(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Watch', tutorial: true });
  return { c, s: game.sessionByName(name)! };
}

test('the First Watch\'s raider and a prize under the card of spoils: the sea\'s other ships leave them be', () => {
  const { game } = makeGame();
  const { c, s } = pupil(game, 'Nell Pupil');
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice');
  assert.ok(raider, 'the lesson\'s raider comes');
  const patrol = game.spawnNpcShip('patrol', 'sloop', 'crown', raider!.state.x + 300, raider!.state.y, 0);
  assert.equal(npcHostileTo(game, patrol, raider!), false, 'a Crown patrol off the harbour does not shoot the pupil\'s lesson');
  assert.equal(npcHostileTo(game, raider!, ship), true, 'the raider still comes for her pupil');
  // An ordinary rover is the patrol's as before.
  const rover = game.spawnNpcShip('pirate', 'sloop', 'confederacy', raider!.state.x + 600, raider!.state.y, 0);
  assert.equal(npcHostileTo(game, patrol, rover), true);
  // …but not while a captain who took her chooses her fate (the prize slipped away under the card).
  rover.lootLockedFor = ship.id;
  assert.equal(npcHostileTo(game, patrol, rover), false);
  rover.lootLockedFor = null;
  assert.equal(npcHostileTo(game, patrol, rover), true);
});

test('the watch\'s «В порт»: the harbour\'s button leads the bar, whatever else is at hand', () => {
  setLang('ru');
  const facts = { roam: { id: 1, icon: 'prof_marine', name: 'Застава', word: 'горстка', lv: 1, lead: true }, homeport: { name: 'Солтмарроу' }, repair: { repairing: false, combat: false, hurt: true } };
  assert.equal(buildActs(facts)[0].id, 'roam', 'out of the watch a stack a cable off leads, as before');
  const acts = buildActs({ ...facts, watchHome: true });
  assert.equal(acts[0].id, 'homeport');
  assert.equal(acts.length, buildActs(facts).length, 'nothing lost, only the order');
  const near = buildActs({ attack: { name: 'Застава', pursuing: false, mode: 'board' }, port: { name: 'Солтмарроу' }, watchHome: true });
  assert.equal(near[0].id, 'dock');
  setLang('en');
});

test('no skull on screen: the warning\'s picture is the red sky at morning, everywhere it was the skull lantern', () => {
  const dom = read('client/src/ui/dom.ts');
  assert.match(dom, /NO_SKULL: Record<string, string> = \{ danger: 'omen_red_sky' \}/);
  assert.match(dom, /id = NO_SKULL\[id\] \?\? id;/);
  assert.ok(existsSync(new URL('../assets/icons/omen_red_sky.webp', import.meta.url)));
  assert.ok(!read('client/src/ui/worldmap.ts').includes("'icon.danger'"), 'the chart\'s canvas marks too');
  // The dice chip has its painted coin (the «⚂» glyph stood in for a picture that does not exist).
  assert.ok(read('client/src/ui/port.ts').includes("{ id: 'dice', icon: 'st_luck_up'"));
  assert.ok(existsSync(new URL('../assets/icons/st_luck_up.webp', import.meta.url)));
});

test('a block the watch draws in keeps no clip after it: the key chips under «Огонь» and «Цель» are whole', () => {
  const css = read('client/styles.css');
  assert.match(css, /\.tut-reveal \{ animation: tut-draw 900ms ease-out backwards; \}/);
  assert.ok(!/\.tut-reveal \{[^}]*\bboth\b/.test(css));
});

test('a desk\'s short screen shows every fate of a boarded ship without scrolling (two to a row)', () => {
  const css = read('client/styles.css');
  const at = css.indexOf('@media (min-height: 521px) and (max-height: 820px) and (min-width: 1000px) {');
  assert.ok(at > 0);
  const block = css.slice(at, css.indexOf('\n}', at));
  assert.match(block, /#modal-panel\[data-modal="boarding"\] \.choice-grid\.one \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(block, /\.cols > div:last-child \{ display: contents; \}/);
});

test('the watch on a phone: the title and the finger, no cut line; the skips a finger\'s 44 px', () => {
  const css = read('client/feel.css');
  assert.match(css, /body\.touch #hud-watch \.w-body \{ display: none; \}/);
  assert.match(css, /body\.touch #hud-watch \.w-act \.btn::after \{ inset: -11px -3px; \}/);
});

test('a path\'s move on the battle\'s panel: its name on the plate, «Сила пути» in the line under it', () => {
  const src = read('client/src/ui/tactical.ts');
  assert.ok(src.includes("<span><b>${esc(moveName(me.path, kind === 'ult'))}</b><small>${esc(L(kind))} · ${esc(note)}</small></span>"));
});

test('one pair of guillemets round a name quoted in its own Russian', () => {
  setLang('ru');
  const line = serverText('attacked Wick and Tallow').replace(/ /g, ' ');
  assert.ok(!line.includes('««') && !line.includes('»»'), line);
  assert.ok(line.includes('«Фитиль и сало»'), line);
  setLang('en');
});

test('the ship\'s name offered on the captain screen is in the reader\'s language', () => {
  for (const id of ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'] as const) {
    const k = `ship.${id}` as const;
    assert.ok(CAP_EN[k] && /^[A-Za-z ]+$/.test(CAP_EN[k]));
    assert.ok(CAP_RU[k] && /^[А-Яа-яЁё ]+$/.test(CAP_RU[k]), CAP_RU[k]);
    assert.ok(CAP_RU[k].length >= 3 && CAP_RU[k].length <= 20, 'the server takes 3–20 letters');
  }
  assert.ok(!read('client/src/ui/captain.ts').includes("'Iron Verdict'"));
});

test('a boarded ship\'s fates in a word on a narrow phone, whole on a wider screen', async () => {
  const { EN, RU } = await import('../client/src/lang/ui/dialogs.ts');
  for (const k of ['board.scuttleShort', 'board.releaseShort', 'board.ransomShort', 'board.prizeShort', 'board.trophyShort'] as const) {
    assert.ok(EN[k] && RU[k], k);
    assert.ok(RU[k].replace(/\{\w+\}/g, '').trim().split(/\s+/).length <= 2, `${k}: a word (and its sum)`);
  }
  const src = read('client/src/ui/dialogs.ts');
  assert.equal((src.match(/\$\{two\(/g) ?? []).length, 5, 'every fate has its word');
  const css = read('client/styles.css');
  assert.match(css, /\.choice \.ch-short \{ display: none; \}\r?\n@media \(max-width: 699px\) \{\r?\n  #modal-panel\[data-modal="boarding"\] \.choice \.ch-long \{ display: none; \}/);
});

test('the battle\'s end band at sea: a label and its «нет» on one line; with the labels hidden no lone «нет»', () => {
  const css = read('client/styles.css');
  assert.ok(css.includes('.tb-end.sea .tb-er { align-items: center; }'));
  assert.ok(css.includes('.tb-end.sea .tb-er > small { padding-top: 0; }'));
  assert.ok(css.includes('.tb-end.sea .tb-er:has(> div > em.muted:only-child) { display: none; }'));
});

test('a struck ship\'s terms on a desk: wide enough for two-line choices, no toast under the card', () => {
  const css = read('client/styles.css').replace(/\r\n/g, '\n');
  const at = css.indexOf('@media (min-width: 1100px) and (min-height: 521px) {\n  #surrender');
  assert.ok(at > 0);
  const block = css.slice(at, at + 300);
  assert.match(block, /#surrender \{ width: min\(640px, calc\(100vw - 600px\)\); \}/);
  assert.match(block, /body\.simple:not\(\.touch\):has\(#surrender:not\(\.hidden\)\) #toasts \{ display: none !important; \}/);
});

test('a tap on «Отчалить гостем» before the game\'s script is in is kept and answered', () => {
  const html = read('client/index.html');
  assert.ok(html.includes('<form id="login-form" onsubmit="return false">'), 'still no native submit');
  assert.match(html, /if \(e\.target && e\.target\.id === 'login-form' && !window\.__gtReady\) window\.__earlySubmit = 'login';/);
  const main = read('client/src/main.ts');
  const at = main.indexOf("($('login-form') as HTMLFormElement).onsubmit");
  const replay = main.indexOf("early.__earlySubmit === 'login' && !net.live");
  assert.ok(at > 0 && replay > at, 'answered once the handler is in');
  assert.ok(main.includes("($('login-form') as HTMLFormElement).requestSubmit();"));
});

test('the First Watch on a desk: two rows (the step, then its line beside the short skips)', () => {
  const css = read('client/feel.css').replace(/\r\n/g, '\n');
  const at = css.indexOf("/* A desk's lesson in two rows");
  assert.ok(at > 0);
  const block = css.slice(at, css.indexOf('\n}\n', at));
  assert.match(block, /@media \(min-height: 521px\) \{/);
  assert.match(block, /#hud-watch \.w-head \{ flex: 1 1 100%; \}/);
  assert.match(block, /#hud-watch \.w-short \{ display: inline; \}/);
});
