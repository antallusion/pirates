import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spatial } from '../client/src/audio.ts';

test('positional audio: louder when close, silent past hearing range, panned by side', () => {
  const near = spatial(0, 0, 50, 0);
  const far = spatial(0, 0, 1200, 0);
  assert.ok(near.gain > far.gain && far.gain > 0);
  assert.equal(spatial(0, 0, 5000, 0).gain, 0);
  assert.ok(spatial(0, 0, 300, 0).pan > 0.5, 'east is right');
  assert.ok(spatial(0, 0, -300, 0).pan < -0.5, 'west is left');
});
