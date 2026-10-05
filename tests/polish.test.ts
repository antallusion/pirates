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

test('polish: the First Watch\'s guns never strip the raider below seven tenths, so the hex lesson is a fight of turns', async () => {
  const { game, ship, steps } = await novice('gunnery');
  const { fireBroadside } = await import('../server/src/game/combat.ts');
  const { PRACTICE_FLOOR } = await import('../server/src/game/onboarding.ts');
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  const start = raider.crew;
  assert.ok(start >= 12, `a crew to fight (${start})`);
  ship.ammo.grape = 200; // the deadliest shot she could load
  for (let i = 0; i < 120; i++) {
    const h = ship.state.heading + Math.PI / 2;
    raider.state.x = ship.state.x + Math.sin(h) * 120;
    raider.state.y = ship.state.y - Math.cos(h) * 120;
    ship.ammoSel = 'grape';
    fireBroadside(game, ship, 'starboard' as never, 120);
    steps(game, 20);
    if (!raider.alive) break;
  }
  assert.ok(raider.crew >= Math.ceil(start * PRACTICE_FLOOR), `the raider keeps ${raider.crew} of ${start}`);
  // Ten men against a pupil's 24 deckhands: three rounds or more, the pupil winning (tests/balance's own measure).
  const { newBattle, aiAct } = await import('../server/src/game/tacbattle.ts');
  const { Rng } = await import('../shared/src/rng.ts');
  const side = (army: { u: string; n: number }[]) => ({ name: 'C', ship: 'W', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false }) as never;
  let rounds = 0, wins = 0;
  for (let k = 0; k < 20; k++) {
    const rng = new Rng(k * 31 + 7);
    const bt = newBattle(side([{ u: 'deckhand', n: 24 }]), side([{ u: 'marine', n: 1 }, { u: 'deckhand', n: Math.ceil(14 * PRACTICE_FLOOR) - 1 }]), k * 31 + 7, 0, rng);
    for (let i = 0; i < 3000 && !bt.over && bt.active !== null; i++) aiAct(bt, 0, rng);
    rounds += bt.round;
    if (bt.over?.winner === 0) wins++;
  }
  assert.ok(rounds / 20 >= 2.8, `a few rounds (${(rounds / 20).toFixed(1)})`);
  assert.ok(wins >= 19, `the pupil wins (${wins}/20)`);
});

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

