// QA playthrough of a fresh Telegram captain (2026-10-22, owner: «баги еще встречаются и они отбивают желание играть»):
// one regression test per logic bug found by tools/mobile/isleqa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointerTargets } from '../client/src/ui/pointer.ts';
import { TICK_RATE } from '../shared/src/constants.ts';
import { campaignActive, campaignFoes } from '../server/src/game/campaign.ts';
import { join, makeGame } from './helpers.ts';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the opening\'s tavern step: the finger on the tavern\'s own «Нанять N», never on its open tab', () => {
  const t = pointerTargets({ stage: 'c:buy:arms', touch: true, docked: true, battle: false, crewFull: false });
  assert.match(t[0], /data-act="hire_n"/, 'the tavern\'s «Нанять N» first (the sailors\' row is folded)');
  assert.ok(t.indexOf(t.find((x) => x.includes('hire_n'))!) < t.indexOf(t.find((x) => x.includes('data-ptab="tavern"'))!));
  // the port renders that very button
  assert.match(src('client/src/ui/port.ts'), /data: \{ act: 'hire_n', n: this\.hire \}/);
  // an open tab is no target (a tap on it does nothing)
  assert.match(src('client/src/ui/pointer.ts'), /getAttribute\('aria-selected'\) === 'true'\) return false/);
});

test('«Первый залп»: the tender sent after her is her foe in Saltmarrow’s safe water (the frame and «Атаковать» take her, not a shark)', () => {
  const { game } = makeGame();
  const conn = join(game, 'Tender', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Tender')!;
  const p = s.profile!;
  const good = (Object.entries(game.markets.get('saltmarrow')!.goods) as [string, { stock: number }][]).map(([g]) => g).find((g) => !['provisions', 'sailcloth', 'planks', 'timber', 'tar'].includes(g) && (game.markets.get('saltmarrow')!.goods[g as 'rum']?.stock ?? 0) > 1)!;
  for (const m of [{ t: 'trade', good: 'provisions', qty: 1 }, { t: 'trade', good: 'sailcloth', qty: 1 }, { t: 'hire_crew', qty: 1, prof: 'sailor' }, { t: 'trade', good, qty: 1 }] as const) {
    conn.push(m as never);
    for (let i = 0; i < 15 * TICK_RATE; i++) game.step();
  }
  assert.equal(campaignActive(p)?.id, 'c01_02');
  conn.push({ t: 'undock' });
  conn.push({ t: 'goto', key: 'q:c01_02' });
  for (let i = 0; i < 240 * TICK_RATE && !campaignFoes(game, s).length; i++) game.step();
  const foe = game.ships.get(campaignFoes(game, s)[0]!)!;
  assert.ok(foe, 'the tender came');
  assert.ok(game.isHostile(foe, s.ship!), 'the tender is her foe (the HOSTILE bit her target frame reads)');
  // …and hers alone: a Crown patrol beside her leaves the tender be (one sank her struck under the card, the kill the patrol's)
  const patrol = game.spawnNpcShip('patrol', 'cutter', 'crown', foe.state.x + 200, foe.state.y, 0);
  assert.equal(game.isHostile(patrol, foe), false, 'no patrol goes for the campaign’s foe');
});

test('the opening’s struck foe: the finger on the card’s choice that does the step (sink for «Первый залп»)', () => {
  const f = { touch: true, docked: false, battle: false } as const;
  assert.equal(pointerTargets({ ...f, stage: 'c:sink' })[0], '[data-sur="sink"]:not([disabled])');
  assert.equal(pointerTargets({ ...f, stage: 'c:board' })[0], '[data-sur="release"]:not([disabled])');
  assert.match(src('client/src/ui/surrender.ts'), /data-sur="\$\{fate\}"/, 'the card’s buttons carry data-sur');
});
