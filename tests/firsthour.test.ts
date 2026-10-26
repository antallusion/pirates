// The first hour as a newcomer plays it (owner, 2026-10-23: «все должно играться идеально и просто для человека»):
// the regressions the playthrough robot (tools/mobile/ux/firsthour.mjs) found in the Telegram layout at 1093×481.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointerTargets, DEPART } from '../client/src/ui/pointer.ts';

test('«В море» brings up «Готовы к выходу?»: the finger goes on into the sheet, the gold «Докупить всё» first', () => {
  // the run of 2026-10-23: the hull 81% after the First Watch, «В море» opened the sheet, the finger stood aside under
  // it and «Первый залп» stood in port for twelve minutes
  for (const stage of ['c:sink', 'c:board', 'c:neutral', 'c:found', 'sail']) {
    const t = pointerTargets({ stage, touch: true, docked: true, battle: false });
    assert.equal(t[0], DEPART[0], `${stage}: «Докупить всё» first`);
    assert.equal(t[1], DEPART[1], `${stage}: «Отплыть так» when there is nothing to buy`);
    assert.ok(t.includes('#modal-panel [data-ptab="sea"]'), `${stage}: «В море» behind it`);
  }
  // at sea there is no sheet to point into
  assert.ok(!pointerTargets({ stage: 'c:sink', touch: true, docked: false, battle: false }).some((x) => x.includes('depart')));
});

test('the First Watch\'s «Атакуйте»: «Атаковать» on its raider from afar, and the raider put out nearer', async () => {
  const { attackRelevant, WATCH_RAIDER } = await import('../client/src/ui/actbar.ts');
  // 560 m off, out of her guns' reach and off her screen: the lesson's button is there all the same
  assert.equal(attackRelevant(false, false, true), true);
  assert.equal(attackRelevant(false, true, false), false, 'any other ship: only within her guns');
  const { readFileSync } = await import('node:fs');
  const onb = readFileSync('server/src/game/onboarding.ts', 'utf8');
  assert.ok(onb.includes(`ship: '${WATCH_RAIDER}'`), 'the client knows the raider by the name the server gives her');
  const { WATCH_RAIDER_OFF } = await import('../server/src/game/onboarding.ts');
  assert.ok(WATCH_RAIDER_OFF <= 600, 'no 40–50 s of open sea before the raider is near');
  const main = readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /attackRelevant\(gunLeft <= 0, tgtSeen, state\.onboarding\?\.stage === 'attack' && tgt\?\.info\?\.name === WATCH_RAIDER(, targetPinned)?\)/); // (a pinned target's 4th argument since)
});

test('the story after the opening: «Плыть» on the bar and the finger on it in the first two chapters', () => {
  // «Соль и туман»: at sea «Плыть», in port «В море» first; quiet while the helmsman has her
  assert.deepEqual(pointerTargets({ stage: 'go', touch: true, docked: false, battle: false }), ['#tc-act[data-act="goal_sail"]', '.tc-act2[data-act="goal_sail"]', '.act-btn.act-goal_sail']);
  assert.equal(pointerTargets({ stage: 'go', touch: true, docked: true, battle: false })[0], DEPART[0]);
  assert.ok(pointerTargets({ stage: 'go', touch: true, docked: true, battle: false }).includes('#modal-panel [data-ptab="sea"]'));
  assert.deepEqual(pointerTargets({ stage: 'go', touch: true, docked: false, battle: false, helmsman: true }), []);
  assert.deepEqual(pointerTargets({ stage: 'go', touch: true, docked: false, battle: true }), [], 'never over a battle');
});

test('main.ts: the opening is not interrupted — the level card waits for a run to end, the gift and offers wait out the opening, the stack is marked', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync('client/src/main.ts', 'utf8');
  // «Новый уровень» came up while the helmsman sailed her at the tender, 90 m off
  assert.match(main, /!hostileNear\(\) && !underWay\(\)\) \{\s*heroSeen = waiting;/);
  assert.match(main, /function underWay\(\): boolean \{\s*return !!state\.autosail \|\| !!state\.pursuit \|\| state\.roamRun !== null/);
  // «Награда за вход» over «Плыть» between «Борт о борт» and «Твари на отмели»
  assert.match(main, /new DailyGift\(\{[^\n]*busy: \(\) => [^\n]*openingFrame\(\) !== null \}\)/);
  assert.match(main, /new Promos\(\{[^\n]*openingFrame\(\) !== null, held/);
  // «Твари на отмели»: «Плыть» stopped her 60 m off the stack and nothing lit — the stack on her screen is marked
  assert.match(main, /\(openingFrame\(\) \?\? storyQuest\(\)\?\.does\) === 'neutral' && !state\.autosail && state\.roamRun === null \? openingStack\(own\)/);
  // the story's «Плыть» and its finger; the prologue's «Выслушать» puts the window under it away
  assert.match(main, /if \(!q\?\.op\) return storySail\(\);/);
  assert.match(main, /hereFrame\(\) \?\? storyFrame\(\)/);
  assert.match(main, /campaignLore\('prologue', [^\n]*closeModal\(\)/);
});

test('the toast of a campaign quest names «Плыть», not a mark to find (RU and EN)', async () => {
  const { EN, RU } = await import('../client/src/lang/ui/ux2.ts');
  assert.match(RU['goal.trackedSail'], /«Плыть»/);
  assert.match(EN['goal.trackedSail'], /“Sail”/);
});

test('at the story\'s harbour the finger is on «Причалить»; in port nothing to dock', () => {
  const t = pointerTargets({ stage: 'go:dock', touch: true, docked: false, battle: false, helmsman: true });
  assert.equal(t[0], '#tc-act[data-act="dock"]');
  assert.ok(t.includes('.tc-act2[data-act="dock"]'), 'the phone\'s pill too');
  assert.deepEqual(pointerTargets({ stage: 'go:dock', touch: true, docked: true, battle: false }), []);
});

test('«Плыть» hurt with stores aboard: the carpenters mend her on the way; sound, or under fire, nothing', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { mendUnderWay } = await import('../server/src/game/searepair.ts');
  const { game } = makeGame();
  join(game, 'Mender', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Mender')!;
  const ship = s.ship!;
  ship.docked = null as never;
  ship.cargo.planks = 10;
  ship.cargo.sailcloth = 10;
  assert.equal(mendUnderWay(game, s), false, 'sound: nothing to mend');
  ship.sails = ship.stats.sailHpMax * 0.4;
  assert.equal(mendUnderWay(game, s), true, 'sails at 40 %: the carpenters at work');
  assert.equal(ship.repairing, true);
  ship.repairing = false;
  ship.cargo.sailcloth = 0;
  ship.cargo.planks = 0;
  assert.equal(mendUnderWay(game, s), false, 'nothing to mend with: no order, no refusal toast');
  const src = (await import('node:fs')).readFileSync('server/src/game/Game.ts', 'utf8');
  assert.match(src, /const e = gotoGoal\(this, s, [^\n]+\);\s*if \(!e\) mendUnderWay\(this, s\);/);
});

test('the story’s fights and landings: the server names the step, the finger goes to its own button (lit while the helmsman closes)', async () => {
  const { storyStep } = await import('../server/src/game/player.ts');
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const story = Object.values(QUESTS_BY_ID).filter((d) => d.kind === 'campaign');
  const kinds = new Set<string>();
  for (const d of story) d.steps.forEach((st, i) => { const k = storyStep(d, i); if (k) kinds.add(`${st.type}>${k}`); });
  assert.ok(kinds.has('board>board') && kinds.has('land>land') && kinds.has('dive>land'), [...kinds].join(' '));
  // the opening's own steps keep their `op`
  const c2 = QUESTS_BY_ID['c01_02'];
  assert.equal(storyStep(c2, 0), null);
  // «Сомнения патруля»: a pirate 40 m off, «Атаковать» lit, the helmsman on — the finger on it
  const t = pointerTargets({ stage: 'go:board', touch: true, docked: false, battle: false, helmsman: true, pursuit: null });
  assert.ok(t.indexOf('#tc-act[data-act="attack"]') >= 0 && t.indexOf('#tc-act[data-act="attack"]') < t.indexOf('#tc-act[data-act="goal_sail"]'));
  assert.equal(pointerTargets({ stage: 'go:land', touch: true, docked: false, battle: false })[0], '#tc-act[data-act="land"]');
  assert.equal(pointerTargets({ stage: 'go:sink', touch: true, docked: true, battle: false })[0], DEPART[0], 'in port: out to sea first');
  assert.match((await import('node:fs')).readFileSync('client/src/main.ts', 'utf8'), /if \(q\.does\) return `go:\$\{q\.does\}`;/);
});

test('the step’s own stack 18 m off: «Атаковать» on the bar from afar; any other stack only within 30 m', async () => {
  const { buildActs } = await import('../client/src/ui/actbar.ts');
  const rm = { id: 7, icon: 'x', name: 'Тюлени', word: 'Горстка', lv: 1, far: true };
  assert.ok(!buildActs({ roam: rm }).some((a) => a.id === 'roam'), 'a stack of no quest: «Осмотреть» and «ещё N м»');
  assert.ok(buildActs({ roam: { ...rm, quest: true } }).some((a) => a.id === 'roam'), 'the step’s stack: «Атаковать»');
  const main = (await import('node:fs')).readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /focus\.marked && focus\.far && \(openingFrame\(\) \?\? storyQuest\(\)\?\.does\) === 'neutral' \? \{ quest: true \}/);
});

test('«Джори Пенн» — men for the army: the finger goes through the army page (dwellings, a kind, «Макс», «Нанять»), never round to «Задания»', () => {
  const t = pointerTargets({ stage: 'h:c01_11:army', touch: true, docked: true, battle: false });
  const at = (sel: string) => t.indexOf(sel);
  assert.ok(at('[data-rcgo]:not([disabled])') === 0, '«Нанять» first once it can be pressed');
  assert.ok(at('.rc-pick [data-rcmax]:not([disabled])') < at('.rc-unit:not(.off):not(.sel)'));
  assert.ok(at('#modal-panel [data-dwell]') >= 0 && at('#modal-panel [data-dwell]') < at('#modal-panel [data-ptab="quests"]'), 'the dwellings before the way back to «Задания»');
  // other pages keep their old way
  assert.equal(pointerTargets({ stage: 'h:x:market', touch: true, docked: true, battle: false })[0], '[data-act="quest_here"][data-id="x"]');
});

test('a lair lost and no men left: the refusal says where to get them, and the finger goes to a harbour\'s «Армия»', async () => {
  const { NO_MEN } = await import('../server/src/game/beastlairs.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  setLang('ru');
  assert.match(serverText(NO_MEN), /Армия/);
  setLang('en');
  assert.equal(pointerTargets({ stage: 'men', touch: true, docked: false, battle: false })[0], '#tc-act[data-act="harbour"]');
  const t = pointerTargets({ stage: 'men', touch: true, docked: true, battle: false });
  assert.ok(t.includes('#modal-panel [data-dwell]') && t.includes('#modal-panel [data-ptab="army"]'));
  assert.match((await import('node:fs')).readFileSync('client/src/main.ts', 'utf8'), /if \(q\.does && q\.does !== 'sink' && \(men < 3 \|\| \(state\.you\?\.crew \?\? 99\) < 3\)\) return state\.self\?\.dockedAt \|\| !state\.autosail \? 'men' : null;/);
});

test('a ship\'s step and a shark at hand: no «Атаковать» finger on the shark, the target frame takes a ship first', async () => {
  for (const stage of ['c:sink', 'c:board', 'go:sink', 'go:board']) {
    const t = pointerTargets({ stage, touch: true, docked: false, battle: false, markBeast: true });
    assert.ok(!t.some((x) => /attack/.test(x) && !/attack_mode/.test(x)), `${stage}: ${t.join(' ')}`);
    assert.ok(t.includes('#tc-act[data-act="goal_sail"]'), `${stage}: «Плыть» instead`);
    assert.ok(pointerTargets({ stage, touch: true, docked: false, battle: false }).includes('#tc-act[data-act="attack"]'), 'a ship: «Атаковать»');
  }
  assert.ok(pointerTargets({ stage: 'c:neutral', touch: true, docked: false, battle: false, markBeast: true }).length > 0);
  const main = (await import('node:fs')).readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /if \(shipsFirst && s\.info\.npcRole === 'beast'\)/);
  assert.match(main, /return best \?\? beast;/);
});

test('«Что говорят старики» — rum to hand over, none aboard: the finger on the market\'s rum, not on «Сдать груз»', async () => {
  const { questAct } = await import('../shared/src/data/questact.ts');
  const a = questAct({ type: 'deliver', port: 'saltmarrow', good: 'rum', qty: 6, text: 'Bring Rum × 6 to Saltmarrow.' } as never);
  assert.equal(a?.good, 'rum');
  assert.equal(a?.qty, 6);
  const t = pointerTargets({ stage: 'h:c01_14:market:rum', touch: true, docked: true, battle: false });
  assert.ok(t.includes('#modal-panel .mk-row[data-good="rum"] [data-act="buy"]:not([disabled])'));
  assert.ok(!t.some((x) => x.includes('quest_here')), 'never «Сдать груз» with nothing to hand over');
  assert.ok(pointerTargets({ stage: 'h:c01_14:', touch: true, docked: true, battle: false })[0].includes('quest_here'), 'aboard: «Сдать груз»');
  assert.match((await import('node:fs')).readFileSync('client/src/main.ts', 'utf8'), /return sold \? `h:\$\{q\.id\}:market:\$\{a\.good\}` : null;/);
});

test('no men for the story’s fight: «Плыть» takes her to a harbour first (the server’s goal), the finger on it at sea', async () => {
  const { NEEDS_MEN } = await import('../server/src/game/goalroute.ts');
  for (const k of ['board', 'prize', 'neutral', 'lair']) assert.ok(NEEDS_MEN.has(k), k);
  assert.ok(!NEEDS_MEN.has('sink'), 'the guns need no landing party');
  const src = (await import('node:fs')).readFileSync('server/src/game/goalroute.ts', 'utf8');
  assert.match(src, /if \(cmp && NEEDS_MEN\.has\(st\.type\) && \(armyMen\(ship\.army\) < 3 \|\| ship\.crew < 3\)\) return \{ cands: ports\(game\) \};/);
  assert.ok(pointerTargets({ stage: 'men', touch: true, docked: false, battle: false }).includes('#tc-act[data-act="goal_sail"]'));
});

test('the story’s fork with its card closed: the finger on «Цели и вести», never on one of the two ways', async () => {
  assert.deepEqual(pointerTargets({ stage: 'fork', touch: true, docked: false, battle: false }), ['#tc-news']);
  assert.match((await import('node:fs')).readFileSync('client/src/main.ts', 'utf8'), /\(state\.self\?\.campaign\?\.ways\?\.length \?\? 0\) > 1 && !state\.self\?\.campaign\?\.active\) return 'fork';/);
});

test('two hands left aboard: the refusal names the tavern, the finger leads to its «Нанять» first', async () => {
  const { NO_HANDS } = await import('../server/src/game/beastlairs.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  setLang('ru');
  assert.match(serverText(NO_HANDS), /таверне/);
  setLang('en');
  const t = pointerTargets({ stage: 'men', touch: true, docked: true, battle: false, crewShort: true });
  assert.equal(t[0], '#modal-panel [data-act="hire_n"]:not([disabled])');
  assert.ok(t.indexOf('#modal-panel [data-ptab="tavern"]') < t.indexOf('#modal-panel [data-dwell]'));
});

test('the story’s run on but the ship lying still: «Плыть» is back on the bar', async () => {
  const main = (await import('node:fs')).readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /if \(state\.autosail \|\| \(goalRun\?\.key === key && state\.route\?\.key === key && \(state\.ownDisplay\?\.speed \?\? 0\) > 0\.5\)\) return null;/);
});

test('the opening’s fights never begin with an empty locker; the guns empty on a ship’s step: the finger to «Припасы»', async () => {
  // the run of 2026-10-24 at 844×390: the First Watch and «Первый залп» fired the start's sixty round shot, «Борт о борт»
  // began with ammo 0 and the chase for the tender took 4.5 minutes
  const { makeGame, join } = await import('./helpers.ts');
  const { campaignNext, campaignActive, OPENING_SHOT } = await import('../server/src/game/campaign.ts');
  const { game } = makeGame();
  const conn = join(game, 'Gunner', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Gunner')!;
  const p = s.profile!, ship = s.ship!;
  for (const slot of [1, 2]) {
    p.quests.active = [];
    p.campaign!.at = slot;
    for (const a of Object.keys(ship.ammo) as (keyof typeof ship.ammo)[]) ship.ammo[a] = 0;
    ship.ammoSel = 'chain';
    campaignNext(game, s);
    assert.equal(campaignActive(p)?.id, slot === 1 ? 'c01_02' : 'c01_03');
    assert.ok(ship.ammo.round >= OPENING_SHOT && OPENING_SHOT >= 60, `slot ${slot}: ${ship.ammo.round} round shot aboard`);
    assert.equal(ship.ammoSel, 'round', 'and loaded');
  }
  assert.ok(conn.all('toast').some((t) => /round shot carried aboard/.test(t.msg)), 'told so');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  setLang('ru');
  assert.match(serverText('Galt has round shot carried aboard: your guns are fed.'), /ядра/);
  setLang('en');
  // the neutral stack and the town: none given
  p.quests.active = [];
  p.campaign!.at = 3;
  ship.ammo.round = 0;
  campaignNext(game, s);
  assert.equal(ship.ammo.round, 0);
  // her own shot spent: the gun crews load the next she has
  const { SPARE_SHOT } = await import('../server/src/game/pursuit.ts');
  assert.deepEqual([...SPARE_SHOT], ['round', 'heavy', 'chain', 'grape']);
  // the finger: «Припасы» in port (then the sheet's «Докупить всё»), the way into a harbour at sea
  const { shotStage, SUPPLIES } = await import('../client/src/ui/pointer.ts');
  const empty = { round: 0, chain: 0, grape: 0, heavy: 0 };
  for (const op of ['sink', 'board']) assert.equal(shotStage(op, empty), 'shot', op);
  assert.equal(shotStage('sink', { ...empty, chain: 4 }), null, 'any shot aboard: the fight’s own button');
  assert.equal(shotStage('neutral', empty), null, 'a fight ashore wants no shot');
  const inPort = pointerTargets({ stage: 'shot', touch: true, docked: true, battle: false });
  assert.equal(inPort[0], SUPPLIES);
  assert.ok(inPort.indexOf(DEPART[0]) > 0);
  assert.ok(pointerTargets({ stage: 'shot', touch: true, docked: false, battle: false }).includes('#tc-act[data-act="harbour"]'));
  assert.deepEqual(pointerTargets({ stage: 'shot', touch: true, docked: false, battle: true }), []);
  const main = (await import('node:fs')).readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /const shot = shotStage\(op \?\? storyQuest\(\)\?\.does, state\.self\?\.ammo\);\s*tutorPointer\.set\(\{ stage: state\.onboarding\?\.stage \?\? shot \?\?/);
  assert.match((await import('node:fs')).readFileSync('client/src/ui/port.ts', 'utf8'), /data: \{ act: 'supplies' \}/, '«Припасы» is the market’s button the finger names');
});

test('«Твари дюн»: a lair of her band, clear of the pirate fortresses; Jory Penn’s six signed on win it, a bare crew may lose', async () => {
  // the first-hour run of 2026-10-24: at the fourth level the step's lair was Widowwick Isle's iguanas, on the island of a
  // ⚓4 pirate fortress — «Высадка» rowed to its camp and the battery drove the boats off, twice. docs/31: a bare captain
  // may fail, a sensibly built one should win about 75–90 % — measured on the real battle (tactical.ts sideOf, tacbattle.ts)
  const { makeGame, join } = await import('./helpers.ts');
  const { campaignNext, campaignOf, FORT_CLEAR } = await import('../server/src/game/campaign.ts');
  const { lairList, lairBeach, lairMen } = await import('../server/src/game/beastlairs.ts');
  const { lairsAll, LAIR_BATTERY_R } = await import('../server/src/game/wanted.ts');
  const { sideOf } = await import('../server/src/game/tactical.ts');
  const { landParty, LAIRS } = await import('../shared/src/data/lairs.ts');
  const { ladder } = await import('../shared/src/data/shiplevel.ts');
  const { newBattle, quickFinish } = await import('../server/src/game/tacbattle.ts');
  const { Rng } = await import('../shared/src/rng.ts');
  const { shipBandOf } = await import('../shared/src/data/xpcurve.ts');
  const { game } = makeGame();
  join(game, 'Duneclear', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Duneclear')!;
  const p = s.profile!, ship = s.ship!;
  const slot = campaignOf(game).slots.find((x) => x.a.id === 'c01_16')!;
  p.quests.active = [];
  p.campaign!.at = slot.slot;
  while (p.level < 4) game.grantXp(s, 2000, 'admin');
  campaignNext(game, s);
  const t = game.questTargets(s).c01_16;
  const l = lairList(game).find((x) => { const b = lairBeach(game, x); return Math.hypot(b.x - t.x, b.y - t.y) < 5; })!;
  assert.ok(l, 'the step marks a lair');
  const band = shipBandOf(slot.gate);
  assert.ok(l.level <= band && l.size !== 'strong', `${l.kind} ⚓${l.level} ${l.size}`);
  assert.ok(FORT_CLEAR > LAIR_BATTERY_R + 400);
  for (const f of lairsAll(game)) {
    assert.notEqual(f.island, l.island, `not on ${f.name}, a fortress's island`);
    assert.ok(Math.hypot(f.x - l.x, f.y - l.y) > FORT_CLEAR, `clear of ${f.name}'s battery`);
  }
  const st = slot.a.steps[0] as { near: { x: number; y: number; r: number } };
  assert.ok(Math.hypot(l.x - st.near.x, l.y - st.near.y) <= st.near.r, 'within the step’s waters (it counts)');
  // her party ashore against it, as beastlairs.ts startFight lands it
  const odds = (army: { u: 'deckhand' | 'marine'; n: number }[], n = 40): number => {
    ship.setArmy(army);
    let win = 0;
    for (let k = 0; k < n; k++) {
      const base = sideOf(game, ship, ship, true);
      const a = { ...base, army: landParty(base.army ?? []), holes: 0, gunsOut: 0, fire: false, castle: false, struck: false, dealt: ladder(ship.shipLevel, l.level, false).dealt || 0.1 };
      const men = lairMen(game, l);
      const b = { name: 'Lair', ship: 'Island', captain: null, hands: 0, marines: 0, gunners: 0, army: men.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3, morale: 50, dealt: ladder(l.level, ship.shipLevel, false).dealt || 0.1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, noBook: true };
      const seed = 1000 + k * 7919;
      const rng = new Rng((seed ^ 0x1a7d) >>> 0);
      const bt = newBattle(a as never, b as never, seed, 0, rng, { land: LAIRS[l.kind].types[0] });
      quickFinish(bt, 0, rng);
      if (bt.over!.winner === 0) win++;
    }
    return win / n;
  };
  // the opening leaves her 23 deckhands; Saltmarrow's dwellings sign on deckhands and marines (Jory Penn's step: six)
  const built = odds([{ u: 'marine', n: 6 }, { u: 'deckhand', n: 20 }]);
  const hands = odds([{ u: 'deckhand', n: 26 }]);
  const bare = odds([{ u: 'deckhand', n: 20 }]);
  assert.ok(built >= 0.75, `six marines signed on: wins ${built}`);
  assert.ok(hands >= 0.75, `six deckhands signed on: wins ${hands}`);
  assert.ok(bare < 0.75, `none signed on: may lose (${bare})`);
});

test('«Потопите N»: the step’s foes put out within a minute’s sail of her, the next one six seconds after one goes down', async () => {
  // the first-hour run of 2026-10-24: c01_19 ×3, c01_21 ×3, c02_01 ×2, c02_06 ×2 took 6–11 minutes — a foe put out in
  // the location's waters, the next 35 s later and only once she was out of the fight
  const { makeGame, join } = await import('./helpers.ts');
  const { campaignNext, campaignOf, campaignActive, campaignFoes, FOE_NEXT, FOE_SEND_R } = await import('../server/src/game/campaign.ts');
  const { TICK_RATE } = await import('../shared/src/constants.ts');
  const { game } = makeGame();
  join(game, 'Escortbane', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Escortbane')!;
  const p = s.profile!, ship = s.ship!;
  const slot = campaignOf(game).slots.find((x) => x.a.id === 'c01_19')!;
  p.quests.active = [];
  p.campaign!.at = slot.slot;
  while (p.level < slot.gate) game.grantXp(s, 2000, 'admin');
  campaignNext(game, s);
  assert.equal(campaignActive(p)?.id, 'c01_19');
  game.undock(s);
  const run = (sec: number, done: () => boolean) => {
    for (let i = 0; i < sec * TICK_RATE && !done(); i++) {
      game.step();
      ship.hull = ship.stats.hullMax; // (she holds: the measure is of the foes' coming, not of the fight)
    }
  };
  const foes = () => campaignFoes(game, s).map((id) => game.ships.get(id)!).filter((o) => o?.alive && !o.surrendered);
  const off = (o: { state: { x: number; y: number } }) => Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
  run(12, () => foes().length > 0);
  const first = foes()[0];
  assert.ok(first, 'the first comes within 12 s at sea');
  assert.ok(off(first) <= FOE_SEND_R, `${Math.round(off(first))} m off: in sight, not across the location's waters`);
  assert.equal(foes().length, 1, 'one at a time');
  // she fights it (in a fight): sunk — the next soon, in the fight's wake too
  ship.lastCombat = game.now;
  game.removeShip(first.id);
  const t0 = game.now;
  run(FOE_NEXT + 3, () => foes().some((o) => o.id !== first.id));
  const next = foes().find((o) => o.id !== first.id);
  assert.ok(next, 'the next one comes');
  assert.ok(game.now - t0 <= FOE_NEXT + 2, `${(game.now - t0).toFixed(1)} s after`);
  assert.ok(off(next) <= FOE_SEND_R + 200, `${Math.round(off(next))} m off`);
  // a struck one fights no more: the next comes for her
  next.surrendered = true;
  const t1 = game.now;
  run(FOE_NEXT + 3, () => foes().length > 0);
  assert.ok(foes().length === 1 && game.now - t1 <= FOE_NEXT + 2, 'after a struck ship, the next');
});

test('the first hour’s raiders never outclass her own ship: chapter 2 on the start’s ⚓1 sloop meets ⚓1 ships', async () => {
  // measured on the real sea (a newcomer played through chapter 2’s first fights, eight runs a quest, 2026-10-25):
  // ⚓2 raiders against the start’s sloop at the fourth level sank her in half the runs
  const { makeGame, join } = await import('./helpers.ts');
  const { campaignNext, campaignOf, campaignFoes } = await import('../server/src/game/campaign.ts');
  const { TICK_RATE } = await import('../shared/src/constants.ts');
  const { shipBandOf } = await import('../shared/src/data/xpcurve.ts');
  const { game } = makeGame();
  join(game, 'Sloopkeep', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Sloopkeep')!;
  const p = s.profile!, ship = s.ship!;
  const slot = campaignOf(game).slots.find((x) => x.a.id === 'c02_01')!;
  assert.equal(shipBandOf(slot.gate), 2, 'the step is of ⚓2');
  p.quests.active = [];
  p.campaign!.at = slot.slot;
  while (p.level < slot.gate) game.grantXp(s, 2000, 'admin');
  campaignNext(game, s);
  game.undock(s);
  assert.equal(ship.shipLevel, 1, 'still on the start’s sloop');
  for (let i = 0; i < 15 * TICK_RATE && !campaignFoes(game, s).length; i++) game.step();
  const foe = game.ships.get(campaignFoes(game, s)[0])!;
  assert.ok(foe, 'a raider comes');
  assert.equal(foe.shipLevel, 1);
});

test('the starting sea is calm for a newcomer: few sharks, alone, far, off the first chapters’ ways; a captain past it keeps hers', async () => {
  // the first-hour run of 2026-10-24: the shallows round Saltmarrow swarmed with sharks (the sea kept three of her level
  // within 2.5 km of her, in packs of up to three)
  const { makeGame, join } = await import('./helpers.ts');
  const { beastBrain, onFirstWays, CALM_NEAR_CAP, CLOSE_WANT, SHELTER_LEVEL } = await import('../server/src/game/beasts.ts');
  const { TICK_RATE } = await import('../shared/src/constants.ts');
  const watch = (level: number, sec: number) => {
    const { game } = makeGame();
    game.directorOn = true; // (the living sea)
    join(game, 'Calmwater', 'corsair');
    const s = [...game.sessions].find((x) => x.name === 'Calmwater')!;
    while (s.profile!.level < level) game.grantXp(s, 5000, 'admin');
    game.undock(s);
    const ship = s.ship!;
    const lane = (game as unknown as { questTargets: (x: unknown) => Record<string, { x: number; y: number }> });
    void lane;
    // she lies off Saltmarrow in its waters (the opening's lane), the sea's beasts rising about her
    const born: number[] = [];
    let most = 0;
    for (let i = 0; i < sec * TICK_RATE; i++) {
      game.step();
      if (i % TICK_RATE) continue;
      ship.state.speed = 0;
      let n = 0;
      for (const o of game.ships.values()) {
        if (!o.alive || o.npcRole !== 'beast') continue;
        if (!born.includes(o.id)) born.push(o.id);
        if (Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 5000) n++;
      }
      most = Math.max(most, n);
    }
    return { game, born, most };
  };
  const calm = watch(3, 300);
  assert.ok(calm.most <= CALM_NEAR_CAP, `${calm.most} beasts within 5 km of a newcomer`);
  for (const id of calm.born) {
    const br = beastBrain(calm.game, id)!;
    assert.equal(br.pack, 0, 'alone, not a pack');
    assert.ok(!onFirstWays(calm.game, br.home.x, br.home.y), 'risen off the first chapters’ ways');
  }
  assert.ok(onFirstWays(calm.game, calm.game.portById('saltmarrow')!.x, calm.game.portById('saltmarrow')!.y), 'Saltmarrow’s quay is on them');
  const past = watch(SHELTER_LEVEL, 60);
  assert.ok(past.most >= CLOSE_WANT, `a captain of the ${SHELTER_LEVEL}th level keeps her sea’s beasts (${past.most})`);
});

test('a newcomer’s helmsman brushing a Crown patrol in the starting sea: they fend off — no blow, no enemy made', async () => {
  // the first-hour runs: a patrol bumped at Saltmarrow's mouth took it for a ram, turned on her and sank her
  const { makeGame, join } = await import('./helpers.ts');
  const { game } = makeGame();
  join(game, 'Fendoff', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Fendoff')!;
  game.undock(s);
  const ship = s.ship!;
  const h = ship.state.heading;
  const pt = game.spawnNpcShip('patrol', 'gunboat', 'crown', ship.state.x + Math.sin(h) * 6, ship.state.y - Math.cos(h) * 6, h + Math.PI);
  game.npcs.get(pt.id)!.active = true;
  ship.protectedUntil = 0;
  game.grid.upsert(pt.id, pt.state.x, pt.state.y);
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const h0 = ship.hull, p0 = pt.hull;
  // her way into the patrol's bow, his into hers: the hulls meet (the collisions' own pass of the tick)
  ship.state.speed = 8;
  pt.state.speed = 6;
  (game as unknown as { collideShips(): void }).collideShips();
  assert.ok(ship.state.speed < 8, 'the hulls met');
  assert.equal(ship.hull, h0, 'no blow to her');
  assert.equal(pt.hull, p0, 'nor to the patrol');
  assert.ok(!pt.attackers.has(ship.id) && !ship.attackers.has(pt.id), 'no enemy made');
  assert.equal(game.isHostile(pt, ship), false);
});
