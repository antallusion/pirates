// Fixes found in the full playthrough (level 1 to the endgame, in the browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dict, fill, setLang } from '../client/src/i18n.ts';

test('playthrough: an abbreviation at a sentence\'s end keeps one dot («через 5 дн.», not «дн..»)', () => {
  assert.equal(fill('Next: {name}, in {left}.', { name: 'X', left: '5 дн.' }), 'Next: X, in 5 дн.');
  assert.equal(fill('in {left}.', { left: '3 h' }), 'in 3 h.');
  assert.equal(fill('{a}.{b}', { a: '1', b: '2' }), '1.2');
  assert.equal(fill('{a}', {}), '{a}');
  setLang('ru');
  const L = dict({ next: 'Next: {name}, in {left}.' }, { next: 'Следующий: {name}, через {left}.' });
  assert.ok(!L('next', { name: 'Пороховая ночь', left: '5 дн.' }).includes('..'));
  setLang('en');
});

test('playthrough: a phone on its side gives the harbour\'s page room (head in one band, no 118 px painted head)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  const m = css.match(/@media \(max-height: 520px\) and \(min-width: 600px\) and \(orientation: landscape\) \{\n  #modal-panel\[data-modal="port"\] \.modal-head \{ min-height: 0; \}[\s\S]*?\n\}/);
  assert.ok(m, 'the landscape harbour head rule');
  assert.match(m[0], /\.port-head \{ grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(m[0], /\.ph-sail \{ flex: 0 0 auto;/);
  assert.match(css, /\.skinned \.icon-tabs \.tab\.active \.ico \{ filter: brightness/);
});

test('playthrough: the First Watch\'s raider never boards her pupil, even broken, and calls no pirate pack', async () => {
  const { makeGame, FakeConn, steps } = await import('./helpers.ts');
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = new FakeConn();
  game.attach(c as never);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Pupil Pew' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Watch', tutorial: true });
  const s = game.sessionByName('Pupil Pew')!;
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(c.last('onboarding')!.view.stage, 'gunnery');
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  assert.ok(raider);
  // Two idle pirates near: no pack may come.
  const idle = [0, 1].map((i) => game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 1500 + i * 200, ship.state.y + 1500, 0));
  // The pupil broken (a third of her men, half her hull) and the raider alongside her.
  ship.crew = Math.floor(ship.stats.crewMax * 0.3);
  ship.hull = ship.stats.hullMax * 0.4;
  raider.state.x = ship.state.x + 40;
  raider.state.y = ship.state.y;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.protectedUntil = 0; // past her first seconds' grace
  for (let i = 0; i < 20 * 60; i++) {
    steps(game, 1);
    assert.ok(!ship.boarding && !raider.boarding, `no boarding at tick ${i}`);
  }
  for (const x of idle) assert.notEqual(game.npcs.get(x.id)?.target, ship.id, 'no wolf pack round the lesson');
  assert.ok(!c.all('toast').some((m) => /pirate pack/.test(m.msg)), 'no pack warning');
});

test('playthrough: the First Watch\'s lesson is never folded away, and on a short screen it sits beside the fold', async () => {
  const { readFileSync } = await import('node:fs');
  const hud = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');
  const folded = hud.match(/const FOLDED = \[([^\]]*)\]/)![1];
  assert.ok(!folded.includes('hud-watch'), 'the lesson is not behind the fold');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  const rule = css.match(/body\.hud-folded #hud-stack > :is\(([^)]*)\) \{ display: none !important; \}/)![1];
  assert.ok(!rule.includes('#hud-watch'));
  assert.match(css, /#hud #hud-stack:has\(> #hud-watch:not\(\.hidden\):not\(\.tut-hidden\)\) \{ display: grid; grid-template-columns: 40px minmax\(0, 1fr\);/);
});
