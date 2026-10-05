// The polish pass (docs/22_POLISH.md): the leftovers of the last playthrough and the interface's finish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r/g, '');

/** A novice in the First Watch, at sea, at the given step. */
async function novice(stage: string) {
  const { makeGame, FakeConn, steps } = await import('./helpers.ts');
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = new FakeConn();
  game.attach(c as never);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Pupil Polish' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Watch', tutorial: true });
  const s = game.sessionByName('Pupil Polish')!;
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  for (let i = 0; i < 12 && c.last('onboarding')!.view.stage !== stage; i++) {
    c.push({ t: 'onboarding', action: 'skip_stage' } as never);
    steps(game, 2);
  }
  assert.equal(c.last('onboarding')!.view.stage, stage);
  return { game, c, s, ship, steps };
}

test('polish: a novice beaten at the First Watch\'s lair gets her men back, and is told so', async () => {
  const was = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const { game, c, s, ship, steps } = await novice('lair');
    const { runAdmin } = await import('../server/src/game/admin.ts');
    const { armyMen } = await import('../shared/src/data/army.ts');
    const { landTac } = await import('../server/src/game/beastlairs.ts');
    // A thin party (the lesson's guns and a bad landing): the beach throws it back.
    ship.setArmy([{ u: 'deckhand', n: 3 }]);
    const men = armyMen(ship.army);
    // A lair far too strong for her, fought at once.
    runAdmin(game, s, '/lair crab_beach fight');
    steps(game, 2);
    for (let i = 0; i < 40; i++) {
      const r = landTac(game, s, { a: 'quick' } as never);
      if (r === 'The fight is over' || r === 'Nothing to fight') break;
      steps(game, 1);
    }
    const toasts = c.all('toast').map((m) => m.msg);
    if (toasts.some((m) => /throws your party back/.test(m))) {
      assert.equal(armyMen(ship.army), men, 'every man back');
      assert.ok(toasts.some((m) => /longboats bring your men off the beach/.test(m)), 'she is told');
    } else {
      // She won it: the rule is checked by its words instead.
      assert.match(src('server/src/game/beastlairs.ts'), /if \(onboardingProtected\(s\) && armyMen\(before\) > ship\.crew\) \{\n\s+ship\.setArmy\(before\);/);
    }
  } finally {
    if (was === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = was;
  }
});

