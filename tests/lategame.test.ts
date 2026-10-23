// The late-game QA (2026-10-23, assets/raw/audit/late: the campaign's chapters 6–36 driven step by step on the server as
// a player does them, and played on a phone in Telegram; the late systems): the faults found on the way, each held here.

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('«Потопите именитого капитана» in the Abyss: one of the Brethren comes to her there, and sunk counts; a baron counts too', async () => {
  const { makeGame, join, steps, shipAtLevel } = await import('./helpers.ts');
  const { campaignOf, campaignActive } = await import('../server/src/game/campaign.ts');
  const { liveNamed, wantedKill } = await import('../server/src/game/wanted.ts');
  const { regionAt } = await import('../shared/src/world/worldgen.ts');
  const { game } = makeGame();
  join(game, 'Abyssal');
  const s = game.sessionByName('Abyssal')!;
  const camp = campaignOf(game);
  // chapter 34 is the Abyss's (its named step: no Brethren of the Abyss's own — PIRATE_SEAS)
  const q = camp.quests.find((x) => x.campaign!.ch === 34 && x.steps.some((st) => st.type === 'named'))!;
  assert.ok(q, 'a named step in the Abyss’s chapter');
  const i = q.steps.findIndex((st) => st.type === 'named');
  s.profile!.level = q.requires.level ?? 56;
  shipAtLevel(game, s, 9);
  s.profile!.campaign!.at = q.campaign!.slot;
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  // the Abyss's open water off its hub
  const hub = game.portById('last_light')!;
  let at: [number, number] | null = null;
  for (let r = 800; r < 6000 && !at; r += 200) for (let k = 0; k < 24 && !at; k++) {
    const x = hub.x + Math.sin(k / 24 * Math.PI * 2) * r, y = hub.y - Math.cos(k / 24 * Math.PI * 2) * r;
    if (regionAt(game.world, x, y) === 'the_abyss' && !(await import('../shared/src/world/worldgen.ts')).isLand(game.world, x, y)) at = [x, y];
  }
  assert.ok(at, 'open water of the Abyss');
  ship.state.x = at![0]; ship.state.y = at![1];
  game.grid.upsert(ship.id, at![0], at![1]);
  assert.equal(liveNamed(game).length, 0);
  steps(game, 20 * 15);
  const live = liveNamed(game).map((l) => game.ships.get(l.ship)!).filter((o) => o?.alive);
  assert.equal(live.length, 1, 'one of the Brethren put to sea for her');
  const o = live[0];
  assert.ok(Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 4500, 'some miles off her');
  assert.equal(regionAt(game.world, o.state.x, o.state.y), 'the_abyss', 'in her waters');
  // one at a time: no second while she is about
  steps(game, 20 * 40);
  assert.equal(liveNamed(game).length, 1);
  wantedKill(game, s, o);
  assert.ok(campaignActive(s.profile!)?.id !== q.id || campaignActive(s.profile!)!.step > i, 'sunk: the step is done');

  // a baron of the Brethren is a named captain too
  const { baronOf } = await import('../shared/src/data/pirates.ts');
  const { putToSea } = await import('../server/src/game/wanted.ts');
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  const b = putToSea(game, baronOf('drowned_crown')!, ship, 'the_abyss', [2000, 4000])!;
  assert.ok(b);
  wantedKill(game, s, b);
  assert.ok(campaignActive(s.profile!)?.id !== q.id || campaignActive(s.profile!)!.step > i, 'a baron sunk: the step is done');
});

/** A captain on a campaign quest's step in its location's waters, her ship of the quest's band. */
async function onCampaignStep(id: string, type: string) {
  const { makeGame, join, shipAtLevel } = await import('./helpers.ts');
  const { campaignOf } = await import('../server/src/game/campaign.ts');
  const { shipBandOf } = await import('../shared/src/data/xpcurve.ts');
  const { game } = makeGame();
  join(game, 'Latecomer');
  const s = game.sessionByName('Latecomer')!;
  const q = campaignOf(game).quests.find((x) => x.id === id)!;
  const i = q.steps.findIndex((st) => st.type === type);
  assert.ok(i >= 0, `${id}: a ${type} step`);
  s.profile!.level = q.requires.level ?? 1;
  shipAtLevel(game, s, shipBandOf(q.requires.level ?? 1));
  s.profile!.campaign!.at = q.campaign!.slot;
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  const near = (q.steps[i] as { near: { x: number; y: number; r: number } }).near;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = near.x; ship.state.y = near.y;
  game.grid.upsert(ship.id, near.x, near.y);
  return { game, s, q, i, ship };
}

test('the epilogue’s «drowned guard over the Great Bell» puts out off Saltmarrow and stays: a ⚓10 sent after her wanders any water', async () => {
  // The guard (⚓9+ to board) was put out by the campaign's fight off Saltmarrow (⚓1–3 water) and gone the next second:
  // a pirate wanders only a square of her level (npc.ts squareFor) — the step could never be done.
  const { steps } = await import('./helpers.ts');
  const { campaignFoes, campaignActive } = await import('../server/src/game/campaign.ts');
  const { questEvent } = await import('../server/src/game/quests.ts');
  const { game, s, q, i, ship } = await onCampaignStep('c36_17', 'board');
  let seen = 0;
  for (let t = 0; t < 60; t++) {
    steps(game, 20);
    ship.hull = ship.stats.hullMax;
    seen = Math.max(seen, campaignFoes(game, s).length);
  }
  const foes = campaignFoes(game, s).map((id) => game.ships.get(id)!);
  assert.ok(seen >= 1 && foes.length >= 1, `the guard about her (${seen} seen, ${foes.length} now)`);
  assert.ok(foes.every((o) => o.alive && o.shipLevel >= 9), foes.map((o) => `⚓${o.shipLevel}`).join(','));
  questEvent(game, s, { k: 'board', victim: foes[0] });
  assert.equal(campaignActive(s.profile!)?.progress, 1, 'boarded: counted');
  assert.equal(campaignActive(s.profile!)?.id, q.id);
  assert.equal(campaignActive(s.profile!)?.step, i);
});

test('«Sink the hunters on your trail», «Sink patrol ships»: the campaign sends them after her, of the quest’s level, and they count', async () => {
  // The sea's own hunters are of their waters' level (a ⚓3 whaler at the 24th level) and the patrols keep to the law's
  // water: neither step could be done in its location.
  const { steps } = await import('./helpers.ts');
  const { campaignFoes, campaignActive } = await import('../server/src/game/campaign.ts');
  const { questEvent } = await import('../server/src/game/quests.ts');
  const { campaignOf } = await import('../server/src/game/campaign.ts');
  const { makeGame } = await import('./helpers.ts');
  const ids = (role: string) => campaignOf(makeGame().game).quests.filter((x) => x.steps.some((st) => st.type === 'sink' && st.role === role)).map((x) => x.id);
  for (const [role, id] of [['hunter', ids('hunter').find((x) => x >= 'c13')!], ['patrol', ids('patrol')[0]]] as const) {
    const { game, s, i, ship } = await onCampaignStep(id, 'sink');
    let foe = null;
    for (let t = 0; t < 30 && !foe; t++) {
      steps(game, 20);
      ship.hull = ship.stats.hullMax;
      foe = campaignFoes(game, s).map((x) => game.ships.get(x)!).find((o) => o.npcRole === role) ?? null;
    }
    assert.ok(foe, `${id}: a ${role} sent after her`);
    assert.ok(game.isHostile(foe!, ship), 'and hostile to her');
    questEvent(game, s, { k: 'sink', victim: foe! });
    assert.equal(campaignActive(s.profile!)?.progress, 1, `${id}: sunk, counted`);
    assert.equal(campaignActive(s.profile!)?.step, i);
  }
});
