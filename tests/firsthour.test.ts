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
  assert.match(main, /attackRelevant\(gunLeft <= 0, tgtSeen, state\.onboarding\?\.stage === 'attack' && tgt\?\.info\?\.name === WATCH_RAIDER\)/);
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
