// Forum post 98 (Эдуард, 2026-11-08): a night away off his own island — 1 500 provisions in its store — cost 31 trained
// hands, two nights 70. The island's bread is the crew's, nobody deserts while the captain is away, the lost are given back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settleAwayCrew } from '../shared/src/data/crewaway.ts';
import { AWAY_REFUND } from '../server/src/game/crewaway.ts';

const base = { hours: 12, atSea: true, level: 20, crew: 267, crewMin: 40, eaters: 267, provisionUse: 1, provisions: 0, gold: 0, wagesPerHour: 318, morale: 70 };

test('forum 98: off her own island the crew eats the island\'s provisions first, then the hold\'s, and draws no silver', () => {
  const at = settleAwayCrew({ ...base, home: true, isleFood: 1500, provisions: 50 });
  assert.ok(at.home && at.isleFood > 0);
  assert.equal(at.food, at.isleFood, 'the island fed them all: the hold untouched');
  assert.equal(at.short, 0);
  assert.equal(at.silver, 0);
  assert.equal(at.deserted, 0);
  assert.ok(at.morale >= 70, 'fed at home');
  // a lean island: the rest from the hold
  const lean = settleAwayCrew({ ...base, home: true, isleFood: 10, provisions: 1000 });
  assert.equal(lean.isleFood, 10);
  assert.ok(lean.food > 10 && lean.short === 0);
});

test('forum 98: nobody deserts while she is away — hungry at sea or penniless in port costs morale only', () => {
  const sea = settleAwayCrew({ ...base });
  assert.ok(sea.short > 0);
  assert.equal(sea.deserted, 0);
  assert.ok(sea.morale < 70);
  const port = settleAwayCrew({ ...base, atSea: false });
  assert.ok(port.short > 0);
  assert.equal(port.deserted, 0);
});

test('forum 98: the lost hands given back once (Эдуард\'s 70), and the reckoning says nobody left', () => {
  assert.equal(AWAY_REFUND[161], 70);
  const src = readFileSync(new URL('../server/src/game/crewaway.ts', import.meta.url), 'utf8');
  assert.match(src, /p\.refund98 !== undefined\) return;/);
  assert.match(src, /seenOf\?\.\(s\.accountId\)\?\.created \?\? Infinity\) < REFUND_BEFORE/);
  assert.match(src, /ship\.stats\.crewMax - ship\.crew/);
  const ru = readFileSync(new URL('../client/src/lang/ui/renown.ts', import.meta.url), 'utf8');
  assert.match(ru, /никто не сбегает/);
  assert.match(ru, /со склада острова/);
});
