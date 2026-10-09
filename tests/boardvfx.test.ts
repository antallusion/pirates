// docs/25 §3 (2026-10-09, batch-boardvfx): the boarding field's looks — what holds their clockwork. The hit-stop and the
// shake answer «меньше движения»; the knock goes by the share of the army a blow takes; the field's clock never runs
// ahead of the battle's (the play queue never waits on it); a stack's count rolls down to the server's number; the
// weather is read off the sea. Measured in the browser by tools/mobile/fight/boardvfx.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FieldClock, FieldShake, KNOCK_MAX, STOP_CATCH, STOP_MAX, STOP_MIN, boardKnockPx, deckRoll, finaleZoom, fxLevel, introZoom, lightning, motionOf, rollCount, skyOf, stopMs, ultZoom } from '../client/src/ui/tacfx.ts';
import { TAC_PACE, tacSchedule } from '../shared/src/data/tactical.ts';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('«меньше движения» turns off the shake and the hit-stop (and the zooms and the opening with them); the shake switch the shake alone', () => {
  const calm = motionOf({ reduceMotion: true, screenShake: true, reduceFlashes: false });
  assert.equal(calm.still, true);
  assert.equal(calm.shake, false);
  assert.equal(motionOf({ reduceMotion: false, screenShake: true, reduceFlashes: false }, true).still, true, 'the system\'s reduced motion too');
  const noShake = motionOf({ reduceMotion: false, screenShake: false, reduceFlashes: false });
  assert.equal(noShake.still, false);
  assert.equal(noShake.shake, false);
  const all = motionOf({ reduceMotion: false, screenShake: true, reduceFlashes: true });
  assert.equal(all.shake, true);
  assert.ok(all.flash < 1, '«меньше вспышек» softens the flashes');
  // Off, the clock is the battle's and the knock nothing.
  const clock = new FieldClock();
  clock.off = true;
  clock.stop(1000, 80);
  for (const t of [1000, 1040, 1080, 1200]) assert.equal(clock.at(t), t);
  assert.equal(clock.held(1040), false);
  const shake = new FieldShake();
  shake.off = true;
  shake.kick(1000, 0.2, 1, 0);
  assert.deepEqual(shake.at(1050), { x: 0, y: 0 });
  assert.equal(shake.busy(1050), false);
  // The panel feeds them so (ui/tactical.ts).
  const src = read('client/src/ui/tactical.ts');
  assert.match(src, /this\.clock\.off = this\.mo\.still;/);
  assert.match(src, /this\.shake\.off = !this\.mo\.shake;/);
  assert.match(src, /if \(!this\.mo\.still && !v\.land && !v\.siege && !v\.arena && !v\.over\) this\.intro = /);
});

test('the knock goes by the share of the struck side\'s army: 1 % — 2 px, 10 % and more — 6 px, a scratch none', () => {
  assert.equal(boardKnockPx(0), 0);
  assert.equal(boardKnockPx(0.001), 0);
  assert.equal(boardKnockPx(0.01), 2);
  assert.equal(boardKnockPx(0.1), 6);
  assert.equal(boardKnockPx(0.4), 6);
  assert.ok(boardKnockPx(0.05) > 2 && boardKnockPx(0.05) < 6);
  for (let s = 0.002; s < 0.3; s += 0.003) assert.ok(boardKnockPx(s + 0.003) >= boardKnockPx(s), 'never less for a harder blow');
  // Blows at once add up, never past the most; the knock is done in 0.4 s.
  const shake = new FieldShake();
  for (let i = 0; i < 5; i++) shake.kick(1000, 0.3, 1, 0);
  let most = 0;
  for (let t = 1000; t < 1400; t += 5) most = Math.max(most, Math.hypot(shake.at(t).x, shake.at(t).y));
  assert.ok(most <= KNOCK_MAX + 1e-9 && most > 5, `${most}`);
  assert.deepEqual(shake.at(1401), { x: 0, y: 0 });
  assert.equal(shake.busy(1401), false);
});

test('a hit-stop holds the field 50–90 ms and never puts it ahead of the battle\'s clock: level again after the catch-up', () => {
  assert.equal(stopMs(0.02), 0, 'a light blow does not stop');
  assert.equal(stopMs(0.05), STOP_MIN);
  assert.equal(stopMs(0.5), STOP_MAX);
  assert.equal(stopMs(0, true), STOP_MAX, 'a stack\'s fall');
  for (let s = 0.05; s < 0.4; s += 0.01) assert.ok(stopMs(s) >= STOP_MIN && stopMs(s) <= STOP_MAX);
  const c = new FieldClock();
  c.stop(1000, 80);
  assert.equal(c.at(999), 999);
  assert.equal(c.at(1000), 1000);
  assert.equal(c.at(1080), 1000, 'held');
  assert.equal(c.held(1050), true);
  let last = -Infinity;
  for (let t = 900; t < 1600; t += 1) {
    const f = c.at(t);
    assert.ok(f <= t + 1e-9, 'never ahead');
    assert.ok(f >= last - 1e-9, 'never back');
    assert.ok(t - f <= STOP_MAX + 1e-9, 'never more than a hold behind');
    last = f;
  }
  assert.equal(c.at(1080 + STOP_CATCH), 1080 + STOP_CATCH, 'level again');
  // A second hold inside the catch-up is let go (the field would fall further behind), unless it is the longer.
  c.stop(1150, 50);
  assert.equal(c.at(1200), c.at(1200));
  assert.ok(c.at(1200) > 1150);
  // The play queue is the server's pace: the schedule knows nothing of the field's clock.
  const { total } = tacSchedule([{ k: 'hit' }, { k: 'ret' }, { k: 'die' }]);
  assert.ok(Math.abs(total - (TAC_PACE.lunge + TAC_PACE.hit + TAC_PACE.answer + TAC_PACE.lunge + TAC_PACE.hit)) < 1e-9, 'a fall adds no beat');
  assert.doesNotMatch(read('shared/src/data/tactical.ts'), /hitstop|hit-stop|FieldClock/i);
});

test('a stack\'s count rolls down to the server\'s number: whole men, never past it, exact at the end', () => {
  for (const [from, to] of [[23, 11], [5, 0], [400, 377], [1, 1], [7, 9]] as const) {
    assert.equal(rollCount(from, to, 0), from);
    assert.equal(rollCount(from, to, 1), to, `${from} → ${to}`);
    assert.equal(rollCount(from, to, 3), to);
    let last: number = from;
    for (let k = 0; k <= 1.0001; k += 0.01) {
      const n = rollCount(from, to, k);
      assert.equal(n, Math.round(n), 'whole men');
      if (to < from) {
        assert.ok(n <= last && n >= to, `${from} → ${to} at ${k}: ${n}`);
      } else assert.ok(n >= last && n <= to);
      last = n;
    }
  }
  // The panel shows the rolled number on the plate, from the count the battle shows.
  assert.match(read('client/src/ui/tactical.ts'), /rollCount\(r\.from, r\.to, /);
});

test('the camera\'s moves stay small: the opening from 6 % near, an ultimate 6–8 % nearer, the end drawn back', () => {
  assert.ok(Math.abs(introZoom(0) - 1.06) < 1e-9);
  assert.equal(introZoom(1), 1);
  let most = 1;
  for (let k = 0; k <= 1; k += 0.01) most = Math.max(most, ultZoom(k));
  assert.ok(most >= 1.06 && most <= 1.08, `${most}`);
  assert.equal(ultZoom(0), 1);
  assert.equal(ultZoom(1), 1);
  assert.equal(finaleZoom(0), 1);
  assert.ok(finaleZoom(1) < 1 && finaleZoom(1) >= 0.94);
});

test('a phone draws the lighter field: fewer particles, less rain, no parallax', () => {
  const desk = fxLevel(false, false), phone = fxLevel(true, false), low = fxLevel(false, true);
  assert.ok(phone.parts < desk.parts && phone.rain < desk.rain && phone.burst < desk.burst);
  assert.equal(phone.parallax, false);
  assert.equal(desk.parallax, true);
  assert.ok(low.parts <= phone.parts);
});

test('the weather and the hour come off the sea: rain, a storm\'s lightning, fog, night', () => {
  assert.equal(skyOf('breeze', 0.1, 0, [3, 0]).rain, 0);
  assert.ok(skyOf('rain', 0.1, 0, [3, 0]).rain > 0);
  const st = skyOf('storm', 0.1, 0.9, [0, -4]);
  assert.equal(st.storm, true);
  assert.ok(st.rain >= 0.9);
  assert.equal(st.night, 0.9);
  assert.ok(Math.abs(st.wy + 1) < 1e-9, 'the wind\'s way');
  assert.ok(skyOf('fog', 0.1, 0, undefined).fog > 0.5);
  assert.ok(skyOf('breeze', 0.9, 0, undefined).fog > 0.5, 'the sea\'s own fog');
  // A storm's strokes come every 7 s, each a flash and a smaller after it.
  let flashes = 0, was = 0;
  for (let t = 0; t < 70000; t += 5) {
    const f = lightning(t);
    if (f > 0.6 && was <= 0.6) flashes++;
    was = f;
  }
  assert.equal(flashes, 10);
  // The two decks roll out of step.
  let apart = 0;
  for (let t = 0; t < 20000; t += 100) apart = Math.max(apart, Math.abs(deckRoll(t, 0, 2) - deckRoll(t, 1, 2)));
  assert.ok(apart > 1.5);
});
