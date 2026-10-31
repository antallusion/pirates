// batch-pc (2026-10-26): the desk's mouse and keys — the choices are pure (client/src/ui/deskinput.ts) and wired in
// main.ts; the wiring is checked by its text, the way the other client tests do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rightClickAct } from '../client/src/ui/deskinput.ts';

const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');

test('the right button: the mount when fitted, else the helmsman to the spot; nothing when docked', () => {
  assert.equal(rightClickAct({ docked: false, mount: true }), 'mount');
  assert.equal(rightClickAct({ docked: false, mount: false }), 'sail', 'no mount: no «Палубная установка не стоит» at every press');
  assert.equal(rightClickAct({ docked: true, mount: true }), null);
  assert.equal(rightClickAct({ docked: true, mount: false }), null);
  // main.ts sends the course through the chart's helmsman when rightClickAct says so
  const rmb = main.slice(main.indexOf('e.button !== 2'), main.indexOf('e.button !== 2') + 700);
  assert.match(rmb, /rightClickAct\(/);
  assert.match(rmb, /sailToScreen\(/);
  const sts = main.slice(main.indexOf('function sailToScreen('), main.indexOf('function sailToScreen(') + 1000);
  // (owner, 2026-10-29) the point itself as the arrival: the helmsman's own 150 m made a near tap «already there»
  assert.match(sts, /autosailTo\(wp, SCREEN_ARRIVE\)/);
  assert.match(main, /const SCREEN_ARRIVE = (\d+);/);
  assert.ok(Number(/const SCREEN_ARRIVE = (\d+);/.exec(main)![1]) < 150 && Number(/const SCREEN_ARRIVE = (\d+);/.exec(main)![1]) >= 20, 'under AUTOSAIL_ARRIVE, at or over the server’s least');
  const at = main.slice(main.indexOf('function autosailTo('), main.indexOf('function autosailTo(') + 600);
  assert.match(at, /net\.send\(\{ \.\.\.autosailRequest\(state, wp\), \.\.\.\(near !== undefined \? \{ near \} : \{\}\) \}\)/);
  assert.match(sts, /fx\.add\(\{ kind: 'ring'/, 'a small marker where the click fell');
});

test('a left click on the open sea sails her there (simple HUD); a drag pans, a window or the HUD never leaks', async () => {
  const { leftClickSea, CLICK_SLOP } = await import('../client/src/ui/deskinput.ts');
  const base = { docked: false, simple: true, modal: false, moved: 0 };
  assert.equal(leftClickSea(base), 'sail');
  assert.equal(leftClickSea({ ...base, moved: CLICK_SLOP + 1 }), null, 'a drag is the view\'s');
  assert.equal(leftClickSea({ ...base, modal: true }), null);
  assert.equal(leftClickSea({ ...base, docked: true }), null);
  assert.equal(leftClickSea({ ...base, simple: false }), 'fire', 'the detailed HUD fires as it always did');
  // the press is only kept with nothing under it, and the lift must land on the sea itself (not the HUD, not a window)
  assert.match(main, /seaPress = !mk && !pl \? \{ x: e\.clientX, y: e\.clientY \} : null;/);
  const upAt = main.search(/addEventListener\('mouseup', \(e\) => \{\r?\n  const p = seaPress;/);
  assert.ok(upAt > 0);
  const up = main.slice(upAt, upAt + 400);
  assert.match(up, /e\.target !== canvas/);
  assert.match(up, /leftClickSea\(/);
  assert.match(up, /sailToScreen\(e\.clientX, e\.clientY\)/);
});

test('Tab over an open window walks the window, not the sea\'s targets, and comes before the fields\' own keys', () => {
  const at = main.indexOf("e.key === 'Tab' && modal");
  assert.ok(at > 0, 'the window\'s Tab trap is wired');
  assert.match(main.slice(at, at + 260), /windowTab\(\$\('modal-panel'\), e\.shiftKey\)/);
  // before `if (typing()) return;` (a field's Tab must not walk out onto the HUD) and before the keymap's «target»
  const handler = main.indexOf('// Autofill, an IME and some gamepad bridges');
  const typingAt = main.indexOf('  if (typing()) return;', handler);
  assert.ok(handler > 0 && at > handler && at < typingAt);
});

test('the wheel zoom: a mouse notch is one step, a touchpad stroke of tiny deltas is not a step per event', async () => {
  const { wheelZoom } = await import('../client/src/ui/deskinput.ts');
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  near(wheelZoom(-100, 0, 1.12), 1.12); // Chrome on Windows, one notch in
  near(wheelZoom(100, 0, 1.12), 1 / 1.12);
  near(wheelZoom(-3, 1, 1.12), 1.12); // Firefox, lines
  near(wheelZoom(-300, 0, 1.12), 1.12); // a fast spin: still a notch per event
  assert.equal(wheelZoom(0, 0, 1.12), 1);
  // a touchpad stroke: 30 events of 4 px — about one notch and a fifth, not 1.12^30 (×30)
  let z = 1;
  for (let i = 0; i < 30; i++) z *= wheelZoom(-4, 0, 1.12);
  assert.ok(z > 1.1 && z < 1.2, `a light stroke zooms ×${z.toFixed(2)}`);
  // Ctrl + the wheel (a touchpad's pinch) never zooms the page: the sea's handler and a window-wide one take it
  assert.match(main, /canvas\.addEventListener\('wheel', \(e\) => \{[\s\S]{0,200}e\.preventDefault\(\);[\s\S]{0,500}\{ passive: false \}\);/);
  assert.match(main, /addEventListener\('wheel', \(e\) => \{\s*if \(inGame && e\.ctrlKey\) e\.preventDefault\(\);\s*\}, \{ passive: false \}\);/);
});

test('Enter over an open window never opens the chat hidden under it (the keys went into an unseen field)', () => {
  const at = main.indexOf('hud.chatPanel.focusInput();');
  const line = main.slice(main.lastIndexOf('\n', at), at);
  assert.match(line, /!typing\(\) && !modal\)/);
});

test('Esc in a window\'s field leaves the field and closes the window like Esc anywhere in it', () => {
  const at = main.indexOf("if (e.key === 'Escape' && modal && typing())");
  assert.ok(at > 0);
  assert.ok(main.indexOf('  if (typing()) return;', at) - at < 200, 'the blur comes right before the fields keep their keys');
});

test('Esc over a window closes the window first, not the chat folded under its veil', () => {
  assert.match(main, /e\.key === 'Escape' && hud\.chatPanel\.isOpen && \(!modal \|\| document\.activeElement === chatInput\)/);
});

test('the mini-games\' Space (the net, the fish) leaves a field\'s spaces alone', async () => {
  const { inField } = await import('../client/src/ui/deskinput.ts');
  assert.equal(inField({ target: { tagName: 'INPUT' } as unknown as EventTarget }), true);
  assert.equal(inField({ target: { tagName: 'TEXTAREA' } as unknown as EventTarget }), true);
  assert.equal(inField({ target: { tagName: 'CANVAS' } as unknown as EventTarget }), false);
  assert.equal(inField({ target: null }), false);
  for (const f of ['nethaul', 'fishfight']) {
    const src = readFileSync(new URL(`../client/src/ui/${f}.ts`, import.meta.url), 'utf8');
    assert.match(src, /e\.code !== 'Space'[^\n]*inField\(e\)/, f);
  }
});

test('a Russian layout: the punctuation keys are bound by their place («б» is the comma, «ё» the backquote)', async () => {
  const { keyOf, actionFor, PRESETS } = await import('../client/src/settings.ts');
  assert.equal(keyOf({ key: 'б', code: 'Comma' }), ',');
  assert.equal(keyOf({ key: 'ю', code: 'Period' }), '.');
  assert.equal(keyOf({ key: '.', code: 'Slash' }), '/');
  assert.equal(keyOf({ key: 'ё', code: 'Backquote' }), '`');
  assert.equal(actionFor(PRESETS.arrows, keyOf({ key: 'б', code: 'Comma' })), 'firePort');
  assert.equal(actionFor(PRESETS.arrows, keyOf({ key: 'ю', code: 'Period' })), 'fireStarboard');
  assert.equal(actionFor(PRESETS.arrows, keyOf({ key: '.', code: 'Slash' })), 'fire', 'the RU «.» on the slash key is «Огонь», not the starboard');
  assert.equal(actionFor(PRESETS.classic, keyOf({ key: 'ё', code: 'Backquote' })), 'target');
  // the rest by name, as before
  assert.equal(keyOf({ key: 'Tab', code: 'Tab' }), 'tab');
  assert.equal(keyOf({ key: ' ', code: 'Space' }), ' ');
  assert.equal(keyOf({ key: 'F3', code: 'F3' }), 'f3');
});

test('Alt+Shift / Ctrl+Shift (a Windows layout switch) is no Shift tap, no dash', async () => {
  const { soloModifier } = await import('../client/src/ui/deskinput.ts');
  const f = (o: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>) => ({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...o });
  assert.equal(soloModifier('shift', f({ shiftKey: true })), true, 'Shift alone: the dash');
  assert.equal(soloModifier('shift', f({ shiftKey: true, altKey: true })), false, 'Alt held, then Shift');
  assert.equal(soloModifier('shift', f({ shiftKey: true, ctrlKey: true })), false, 'Ctrl held, then Shift');
  assert.equal(soloModifier('shift', f({ altKey: true })), false, 'Shift up with Alt still down');
  assert.equal(soloModifier('shift', f({})), true, 'Shift up alone');
  assert.match(main, /modTap = soloModifier\(k, e\) \?/);
  assert.match(main, /modTap\?\.k === k && [^\n]*soloModifier\(k, e\)/);
});

test('the handbook names every window key (the journal F3, H, P, F2, Esc, Home were in no list)', async () => {
  const src = readFileSync(new URL('../client/src/ui/dialogs.ts', import.meta.url), 'utf8');
  for (const a of ['journal', 'help', 'harbour', 'readAloud', 'map', 'talents', 'ship', 'crew', 'company']) assert.ok(src.includes(`kb('${a}')`), a);
  assert.ok(src.includes("'Esc · Home'"));
  const { EN, RU } = await import('../client/src/lang/ui/dialogs.ts');
  for (const k of ['help.screens2', 'help.escHome'] as const) {
    assert.ok(EN[k] && RU[k], k);
    assert.doesNotMatch(RU[k], /[A-Za-z]/, `${k}: no Latin in the Russian`);
  }
});

test('no forced layout each frame: the nav plate by an observer, its text only when it changes, the hint\'s stack check throttled', () => {
  const hud = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');
  assert.ok(!hud.includes("$('hud-nav').offsetParent"), 'the nav plate is not asked by offsetParent in the frame');
  assert.match(hud, /new ResizeObserver\(\(es\) => \{ for \(const e of es\) this\.navShown =/);
  assert.match(hud, /if \(nav !== this\.navHtml\) \$\('nav-text'\)\.innerHTML = this\.navHtml = nav;/);
  const ease = readFileSync(new URL('../client/src/ui/ease.ts', import.meta.url), 'utf8');
  assert.match(ease, /if \(now - this\.stackAskedAt < 500\) return this\.stackWas;/);
});

test('the level-up card is not modal for the game\'s keys: WASD, Space, the hotkeys go on; Esc and Enter are the card\'s', async () => {
  const { keyPasses } = await import('../client/src/ui/kit/layer.ts');
  for (const k of ['w', 'a', 's', 'd', 'ArrowUp', ' ', 'f', 'Tab', '1', 'Shift']) assert.equal(keyPasses(true, k, false), true, k);
  assert.equal(keyPasses(true, 'Escape', false), false);
  assert.equal(keyPasses(true, 'Enter', false), false);
  assert.equal(keyPasses(true, ' ', true), false, 'the focus in the card (Enter, a click): its keys are the card\'s');
  assert.equal(keyPasses(undefined, 'w', false), false, 'every other sheet stays modal');
  const hero = readFileSync(new URL('../client/src/ui/hero.ts', import.meta.url), 'utf8');
  assert.match(hero, /cls: 'lu-sheet', passKeys: true/);
  const layer = readFileSync(new URL('../client/src/ui/kit/layer.ts', import.meta.url), 'utf8');
  assert.match(layer, /if \(layer\.passKeys\) return;/, 'it takes no focus as it opens (Space would press a pick)');
  const sheet = readFileSync(new URL('../client/src/ui/kit/sheet.ts', import.meta.url), 'utf8');
  assert.match(sheet, /passKeys: o\.passKeys/);
});

test('a window open (the settings, any other): F and every ship\'s key wait; only the windows\' own keys and Esc act', async () => {
  const { keyActsInWindow } = await import('../client/src/ui/deskinput.ts');
  for (const a of ['dock', 'fire', 'firePort', 'sailUp', 'rudderLeft', 'dash', 'board', 'land', 'repair', 'target', 'talent1', 'abilityZ']) assert.equal(keyActsInWindow(a), false, a);
  for (const a of ['map', 'journal', 'help', 'mute']) assert.equal(keyActsInWindow(a), true, a);
  const at = main.indexOf('if (modal && !keyActsInWindow(act)) return;');
  assert.ok(at > 0, 'wired in the keymap\'s handler');
  // after the keymap's lookup and Esc's own branch, before the key is held or the switch acts
  assert.ok(at > main.indexOf("if (k === 'escape') {") && at < main.indexOf('  keys.add(k);', at) && at < main.indexOf("    case 'dock': {"));
});

test('any finger tap on the sea sails her (owner, 2026-10-29: «тапнуть куда мне надо и начать плыть. порт или еще куда-то, куда угодно»)', async () => {
  const { seaTapPlan } = await import('../client/src/ui/deskinput.ts');
  const base = { mark: null, again: false, thing: false, place: null, modal: false, blocked: false } as const;
  assert.equal(seaTapPlan(base), 'sea', 'the open sea: a course there');
  assert.equal(seaTapPlan({ ...base, mark: 'ship' }), 'target', 'another ship: the target, the one exception');
  assert.equal(seaTapPlan({ ...base, mark: 'ship', again: true }), 'chase', 'the target tapped again: sail to her');
  assert.equal(seaTapPlan({ ...base, mark: 'roam', again: true }), 'chase');
  assert.equal(seaTapPlan({ ...base, thing: true }), 'thing');
  assert.equal(seaTapPlan({ ...base, place: 'port' }), 'port', 'a harbour: sailed to and put in');
  assert.equal(seaTapPlan({ ...base, place: 'isle' }), 'place');
  assert.equal(seaTapPlan({ ...base, place: 'wreck' }), 'place');
  assert.equal(seaTapPlan({ ...base, modal: true }), 'none');
  assert.equal(seaTapPlan({ ...base, blocked: true }), 'blocked', 'a long passage / a boarding: a word why, never silent');
  assert.equal(seaTapPlan({ ...base, mark: 'ship', blocked: true }), 'target', 'a ship is still marked in a fight');
  // main.ts: touch.ts's tap → seaTap; in a harbour's roads the course first, then the casting off; a port by its run
  assert.match(main, /aim: \(px, py\) => seaTap\(px, py\),/);
  const st = main.slice(main.indexOf('function seaTap('), main.indexOf('function sailToSpot('));
  assert.match(st, /if \(plan === 'blocked'\) return void hud\.toast\(seaTapWhy\(/);
  // (forum 40: a harbour's town tapped opens its ring — «Войти в порт» among it — the run in if the ring has no room)
  assert.match(st, /if \(plan === 'port'\) return void \(openPortRing\(String\(pl!\.id\)\) \|\| startGoal\(`p:\$\{pl!\.id\}`\)\);/);
  assert.ok(st.lastIndexOf("if (docked) net.send({ t: 'undock' });") > st.lastIndexOf('else sailToScreen(px, py);'), 'in port: the course, then she casts off');
  assert.doesNotMatch(st, /dockedAt\) return/, 'never a silent «in port: nothing»');
  // the chart: a finger's tap at sea is the course at once (the mouse keeps its mark and «Плыть»)
  const wm = readFileSync(new URL('../client/src/ui/worldmap.ts', import.meta.url), 'utf8');
  assert.match(wm, /this\.tapAt\(state, e\.clientX, e\.clientY, showClear, e\.pointerType === 'touch'\)/);
  assert.match(wm, /if \(finger && this\.markAt && this\.onAutosail && !state\.self\?\.dockedAt\) return this\.onAutosail\(this\.markAt\);/);
});
