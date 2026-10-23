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
  // (its location's waters: the step's own, else the quest's)
  const hub = game.portById(q.port)!;
  const near = [q.steps[i], ...q.steps].map((x) => (x as { near?: { x: number; y: number; r: number } }).near).find(Boolean) ?? { x: hub.x + 600, y: hub.y, r: 1500 };
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

test('a campaign landing whose beach has a campaign wreck in its shallows: the bar lands her, it does not send the divers', async () => {
  // «Высадитесь на острове …» (chapter 11): the run ended by the wreck laid for a dive step of the same location, and the
  // one button was «Нырять» — the landing could not be pressed there.
  const { makeGame, join, steps, shipAtLevel } = await import('./helpers.ts');
  const { campaignOf } = await import('../server/src/game/campaign.ts');
  const { routeFor } = await import('../server/src/game/goalroute.ts');
  const { wreckHere } = await import('../server/src/game/explorefx.ts');
  const { isLand } = await import('../shared/src/world/worldgen.ts');
  const { game } = makeGame();
  join(game, 'Lander');
  const s = game.sessionByName('Lander')!;
  const ship = s.ship!;
  let checked = 0;
  for (const q of campaignOf(game).quests) {
    const i = q.steps.findIndex((st) => st.type === 'land');
    if (i < 0) continue;
    s.profile!.level = q.requires.level ?? 1;
    s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
    const is = game.world.islands[(q.steps[i] as { island: number }).island];
    ship.docked = null;
    s.profile!.docked = null;
    ship.state.x = is.x + is.radius + 2500; ship.state.y = is.y;
    const r = routeFor(game, s, `q:${q.id}`) as { x: number; y: number };
    if (!('x' in r) || isLand(game.world, r.x, r.y)) continue;
    ship.state.x = r.x; ship.state.y = r.y; ship.state.speed = 0;
    game.grid.upsert(ship.id, r.x, r.y);
    if (!wreckHere(game, ship)) continue; // (only the beaches with a wreck by them)
    steps(game, 25);
    checked++;
    assert.equal(s.landable?.island, is.name, `${q.id}: «Высадка» on ${is.name}, not ${JSON.stringify(s.landable)}`);
    assert.notEqual(s.landable?.action, 'dive', q.id);
    void shipAtLevel;
  }
  assert.ok(checked >= 1, `a landing by a wreck checked (${checked})`);
});

test('every campaign lair step marks a lair she can storm and that counts: not on an island in the mist, within the location’s waters', async () => {
  // Chapter 35: the nearest lairs were on Glowhollow, a hidden island of the Abyss — no «Штурм» at the mark; passed over,
  // the mark went to one 4 km off, beyond the waters where a lair beaten counts.
  const { makeGame, join } = await import('./helpers.ts');
  const { campaignOf } = await import('../server/src/game/campaign.ts');
  const { lairList, lairBeach } = await import('../server/src/game/beastlairs.ts');
  const { NEAR_FIGHT } = await import('../server/src/game/quests.ts');
  const { game } = makeGame();
  (await import('../server/src/game/advmap.ts')).quietAdv(game, false);
  join(game, 'Stormer');
  const s = game.sessionByName('Stormer')!;
  const bad: string[] = [];
  let n = 0;
  for (const q of campaignOf(game).quests) q.steps.forEach((st, i) => {
    if (st.type !== 'lair' || !st.near) return;
    s.profile!.level = q.requires.level ?? 1;
    s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
    const t = game.questTargets(s)[q.id];
    const l = lairList(game).find((x) => { const b = lairBeach(game, x); return Math.hypot(b.x - t.x, b.y - t.y) < 1; });
    n++;
    if (!l) { bad.push(`${q.id}: no lair at the mark`); return; }
    if (l.island >= 0 && game.world.islands[l.island]?.hidden) bad.push(`${q.id}: ${l.id} on a hidden island`);
    const d = Math.hypot(l.x - st.near.x, l.y - st.near.y);
    if (d > st.near.r + NEAR_FIGHT) bad.push(`${q.id}: ${l.id} ${Math.round(d)} m from the location (counts within ${st.near.r + NEAR_FIGHT})`);
  });
  assert.ok(n >= 10, `${n} lair steps`);
  assert.deepEqual(bad, []);
});

test('a merchant’s cry for help: one toast a minute for a captain, not one for every merchant of a lawless sea; «4,4 км» in Russian', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { onNpcHit, HEARD_SEC } = await import('../server/src/game/npcwars.ts');
  const { game } = makeGame();
  const c = join(game, 'Listener');
  const s = game.sessionByName('Listener')!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 54000; ship.state.y = 44000;
  const cries = () => c.all('toast').filter((t) => /calls for help/.test(t.msg)).length;
  for (let k = 0; k < 6; k++) {
    const m = game.spawnNpcShip('merchant', 'fluyt', 'league', 54000 + 1500 + k * 200, 44000, 0);
    const pr = game.spawnNpcShip('pirate', 'sloop', 'confederacy', 54000 + 1500 + k * 200, 44200, 0);
    onNpcHit(game, m, pr);
  }
  assert.equal(cries(), 1, 'six cries at once: one toast');
  game.now += HEARD_SEC + 1;
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', 55800, 44000, 0);
  onNpcHit(game, m, game.spawnNpcShip('pirate', 'sloop', 'confederacy', 55800, 44200, 0));
  assert.equal(cries(), 2, 'a minute on: the next is heard');
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  try {
    assert.match(serverText('Pirates attack Grey Widow, 4.4 km south: she calls for help!'), /4,4\s?км/);
  } finally {
    setLang('en');
  }
});

test('the lookout’s sighting reads in Russian for a ship of any gender («замечен Чёрная цапля»)', async () => {
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  try {
    const t = serverText('Lookout: Black Heron sighted.');
    assert.doesNotMatch(t, /замечен /, t);
    assert.match(t, /^Впередсмотрящий: на горизонте\s—\s/, t);
  } finally {
    setLang('en');
  }
});

test('the season path’s rewards read whole in Russian (the title and the pennant were glued in English)', async () => {
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  const { trackReward } = await import('../shared/src/data/seasons.ts');
  const src = (await import('node:fs')).readFileSync(new URL('../server/src/game/seasons.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\(Legends tab\)`/, 'no glued line');
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const theme of ['migration', 'war', 'storm', 'dead_tide'] as const) {
    const r = trackReward(40, theme)!;
    for (const msg of [`Season path 40: the title “${r.title}” and a new pennant colour (the Legends tab).`, `Season path 5: the title “${r.title}” (the Legends tab).`, 'Season path 10: a new pennant colour (the Legends tab).']) {
      const ru = serverText(msg);
      assert.doesNotMatch(ru, /[A-Za-z]{3,}/, ru);
    }
    }
  } finally {
    setLang('en');
  }
});

test('the landing’s line on the bar names what her boats are at, in Russian: never a feature’s id («у цели «wreck»»)', async () => {
  const { landingName } = await import('../server/src/game/player.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  const { LANDABLE } = await import('../server/src/game/exploration.ts');
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const f of [...LANDABLE, 'tidal', 'dig', 'dive', 'haul', 'turtle', 'flag']) {
      const ru = serverText(landingName(f, 7));
      assert.doesNotMatch(ru, /[A-Za-z]{3,}/, `${f}: ${ru}`);
    }
  } finally {
    setLang('en');
  }
  assert.equal(landingName('wreck', 1), 'beached wreck');
});

test('a wreck to dive on is named once on the bar («wreck of the wreck of the Saint Brendan»), and in Russian', async () => {
  const { makeGame, join, steps } = await import('./helpers.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  const { game } = makeGame();
  join(game, 'Diver');
  const s = game.sessionByName('Diver')!;
  const w = game.wrecks[game.wrecks.length - 1];
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = w.x; s.ship!.state.y = w.y;
  game.grid.upsert(s.ship!.id, w.x, w.y);
  steps(game, 25);
  assert.equal(s.landable?.action, 'dive', JSON.stringify(s.landable));
  assert.doesNotMatch(s.landable!.feature, /wreck of the wreck/, s.landable!.feature);
  setLang('ru');
  applyDataLocale('ru');
  try {
    const ru = serverText(s.landable!.feature);
    assert.doesNotMatch(ru, /wreck|остов «остов/, ru);
  } finally {
    setLang('en');
  }
});

test('«Плыть» on the campaign’s named step never runs 30 km to a Brethren captain of another sea: hers comes to her', async () => {
  const { steps } = await import('./helpers.ts');
  const { routeFor } = await import('../server/src/game/goalroute.ts');
  const { putToSea, liveNamed } = await import('../server/src/game/wanted.ts');
  const { namedPirates } = await import('../shared/src/data/pirates.ts');
  const { game, s, q, ship } = await onCampaignStep('c34_14', 'named');
  // a far one, in another sea (a decoy ship put there)
  const decoy = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x - 30000 > 4000 ? ship.state.x - 30000 : ship.state.x + 30000, ship.state.y, 0);
  const np = namedPirates().find((x) => !x.baron && x.region === 'gravewater')!;
  const far = putToSea(game, np, decoy, 'gravewater', [100, 3000]);
  if (far) {
    const r = routeFor(game, s, `q:${q.id}`) as { ship?: number };
    assert.notEqual(r.ship, far.id, 'not the far one');
  }
  steps(game, 20 * 12);
  const near = liveNamed(game).map((l) => game.ships.get(l.ship)!).find((o) => o && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 9000);
  assert.ok(near, 'one came to her');
  const r2 = routeFor(game, s, `q:${q.id}`) as { ship?: number };
  assert.equal(r2.ship, near!.id, '«Плыть» goes for her');
});

test('«Take tribute from merchants»: a merchant boarded and let go has paid it — once a merchant; «Плыть» says how', async () => {
  // The step was left with a button only a struck merchant's target frame shows (and a merchant strikes only to the
  // boarding, whose card then covers the frame): the campaign's eight tribute steps could not be done on a phone.
  const { campaignActive } = await import('../server/src/game/campaign.ts');
  const { raidFate } = await import('../server/src/game/raiding.ts');
  const { routeFor } = await import('../server/src/game/goalroute.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { game, s, i } = await onCampaignStep('c19_02', 'tribute');
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', s.ship!.state.x + 40, s.ship!.state.y, 0);
  raidFate(game, s, m, 'release');
  assert.equal(campaignActive(s.profile!)?.progress, 1, 'let go: her tribute paid');
  raidFate(game, s, m, 'release');
  assert.equal(campaignActive(s.profile!)?.progress, 1, 'the same merchant pays once');
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', s.ship!.state.x + 60, s.ship!.state.y, 0);
  raidFate(game, s, pirate, 'release');
  assert.equal(campaignActive(s.profile!)?.progress, 1, 'a pirate let go is no tribute');
  const m2 = game.spawnNpcShip('merchant', 'fluyt', 'league', s.ship!.state.x + 80, s.ship!.state.y, 0);
  const r = routeFor(game, s, `q:c19_02`) as { hint?: string };
  assert.match(r.hint ?? '', /let her go/, JSON.stringify(r));
  setLang('ru');
  try {
    assert.doesNotMatch(serverText(r.hint!), /[A-Za-z]{3,}/);
  } finally {
    setLang('en');
  }
  raidFate(game, s, m2, 'release');
  assert.ok(campaignActive(s.profile!)?.id !== 'c19_02' || campaignActive(s.profile!)!.step > i, 'two merchants: the step is done');
});

test('a chart step with every island of the sea already on her chart is counted, not left with nowhere to sail', async () => {
  const { steps } = await import('./helpers.ts');
  const { campaignActive } = await import('../server/src/game/campaign.ts');
  const { chartableLeft } = await import('../server/src/game/quests.ts');
  const { game, s, q, i } = await onCampaignStep('c34_01', 'chart');
  assert.ok(chartableLeft(game, s) > 0);
  steps(game, 40);
  assert.equal(campaignActive(s.profile!)?.step, i, 'islands left: the step waits for her charts');
  for (const is of game.world.islands) s.discovered.add(is.id);
  assert.equal(chartableLeft(game, s), 0);
  steps(game, 40);
  const a = campaignActive(s.profile!);
  assert.ok(a?.id !== q.id || a.step > i, `counted (${JSON.stringify(a)})`);
});

test('a run to a quest broken off by a prize: «Плыть» stays on the bar, gold, until pressed — never a resume by itself', async () => {
  const { resumeOn, resumeAfterEnd } = await import('../client/src/ui/resumesail.ts');
  const { buildActs } = await import('../client/src/ui/actbar.ts');
  // another order took the helm (a struck ship's terms): the key is kept; met, or a course of her own: forgotten
  assert.equal(resumeAfterEnd('q:c19_02', 'off'), 'q:c19_02');
  assert.equal(resumeAfterEnd('q:c19_02', 'done'), null);
  assert.equal(resumeAfterEnd('q:c19_02', 'own'), null);
  const f = { key: 'q:c19_02', live: true, routeOn: false, docked: false, autosail: false, busy: false };
  assert.equal(resumeOn(f), true, 'after the prize: on');
  assert.equal(resumeOn({ ...f, busy: true }), false, 'while the card or the fight is up: off');
  assert.equal(resumeOn({ ...f, routeOn: true }), false, 'on her way: off');
  assert.equal(resumeOn({ ...f, autosail: true }), false);
  assert.equal(resumeOn({ ...f, live: false }), false, 'the quest gone: off');
  // the gold (first) button of the bar, unless a fight's own is up
  const acts = buildActs({ docked: false, goalSail: { name: 'The Toll', resume: true }, looks: [{ kind: 'obj', name: 'x' }] } as never);
  assert.equal(acts[0].id, 'goal_sail', acts.map((a) => a.id).join(','));
  const fight = buildActs({ docked: false, goalSail: { name: 'The Toll', resume: true }, attack: { name: 'Gull', pursuing: false, mode: 'guns' } } as never);
  assert.equal(fight[0].id, 'attack');
  assert.ok(fight.some((a) => a.id === 'goal_sail'));
  // the opening's own «Плыть» keeps its place after the step's button
  const op = buildActs({ docked: false, goalSail: { name: 'The Toll' }, looks: [{ kind: 'obj', name: 'x' }] } as never);
  assert.equal(op[op.length - 1].id, 'goal_sail');
});
