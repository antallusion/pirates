// The sea director (docs/12 P2): tension grows while a captain sails quiet water; an encounter shows as a sign on the
// horizon and opens as a card near it (or at once, aboard); the captain's choice settles it through the game's own
// systems. Every one of the forty has its words in both languages, and every outcome the server can reach is written.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS, ENCOUNTER_IDS, SEA_LETTERS, encounterPatterns } from '../shared/src/data/encounters.ts';
import type { EncounterId } from '../shared/src/data/encounters.ts';
import { chooseEncounter, fits, startEncounter, stepDirector } from '../server/src/game/director.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function atSea(game: Game, name: string, region = 'gravewater'): { c: FakeConn; s: PlayerSession } {
  game.directorOn = true;
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  // Open water in the region, clear of land and ports.
  const [cx, cy] = { gravewater: [56000, 74000], leviathan_reach: [70000, 20000], dead_mans_expanse: [80000, 60000] }[region] as [number, number];
  ship.state.x = cx;
  ship.state.y = cy;
  ship.region = region as never;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  game.grid.upsert(ship.id, cx, cy);
  return { c, s };
}

/** Puts the captain alongside an encounter's sign so its card opens. */
function alongside(game: Game, s: PlayerSession, live: { x: number; y: number }): void {
  s.ship!.state.x = live.x + 50;
  s.ship!.state.y = live.y;
  s.ship!.state.speed = 0;
  stepDirector(game);
}

test('all forty: words in both languages, choices labelled, and the letters of the sea', () => {
  assert.equal(ENCOUNTER_IDS.length, 40);
  for (const id of ENCOUNTER_IDS) {
    const d = ENCOUNTERS[id];
    for (const t of [d.title, d.text, ...d.choices.map((c) => c.label), ...Object.values(d.outcomes)]) {
      assert.ok(t[0] && t[1], `${id}: both languages`);
      assert.doesNotMatch(t[1].replace(/\{\w+\}/g, ''), /[A-Za-z]{4,}/, `${id}: ${t[1]}`);
      // Every {placeholder} of the English is in the Russian.
      for (const m of t[0].matchAll(/\{(\w+)\}/g)) assert.ok(t[1].includes(`{${m[1]}}`), `${id}: {${m[1]}}`);
    }
    assert.ok(Object.keys(d.outcomes).length >= 1);
  }
  assert.equal(SEA_LETTERS.length, 24);
});

test('each choice of each encounter, played many times, comes to an outcome the data has words for', () => {
  const { game } = makeGame();
  const { c: conn, s } = atSea(game, 'Every Eve');
  onHull(game, s.ship!, 'brig');
  s.profile!.gold = 1_000_000;
  s.ship!.cargo = { provisions: 40, dreamleaf: 3 };
  s.profile!.stolen.dreamleaf = 3;
  for (const id of ENCOUNTER_IDS) {
    const def = ENCOUNTERS[id];
    const choices = def.choices.length ? def.choices.map((c) => c.id) : [''];
    for (const ch of choices) {
      for (let k = 0; k < 8; k++) {
        s.ship!.hull = s.ship!.stats.hullMax;
        s.ship!.crew = Math.max(20, s.ship!.crew);
        s.ship!.morale = 20;
        s.profile!.stash.length = 0;
        const live = startEncounter(game, s, id as EncounterId)!;
        assert.ok(live, id);
        if (def.sight) alongside(game, s, live);
        if (def.choices.length) assert.equal(chooseEncounter(game, s, live.id, ch), null, `${id}/${ch}`);
      }
    }
  }
  // Each result told was one of the encounter's outcomes.
  const results = conn.all('encounter_result');
  assert.ok(results.length > 150);
  for (const r of results) assert.ok(ENCOUNTERS[r.def].outcomes[r.outcome], `${r.def}: ${r.outcome}`);
});

test('where things happen: ice only in the Reach, a glowing sea only by night, the Crown’s search only with hot goods', () => {
  const { game } = makeGame();
  const { s } = atSea(game, 'Where Walt');
  assert.equal(fits(game, s, ENCOUNTERS.iceberg), false);
  const { s: n } = atSea(game, 'North Nell', 'leviathan_reach');
  assert.equal(fits(game, n, ENCOUNTERS.iceberg), true);
  assert.equal(fits(game, s, ENCOUNTERS.patrol_search), false, 'nothing to find');
  s.ship!.cargo.dreamleaf = 2;
  assert.equal(fits(game, s, ENCOUNTERS.patrol_search), true);
  assert.equal(fits(game, s, ENCOUNTERS.mutiny_brewing), false);
  s.ship!.morale = 10;
  assert.equal(fits(game, s, ENCOUNTERS.mutiny_brewing), true);
});

test('sailing quiet water brings something within a few minutes; a harbour and a fight keep the sea still', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Sailor Sid');
  const ship = s.ship!;
  let saw = false;
  for (let t = 0; t < 400 && !saw; t++) {
    ship.state.speed = 8;
    ship.lastCombat = -1000;
    stepDirector(game);
    game.now += 1;
    saw = c.all('sights').some((m) => m.list.length > 0) || c.all('encounter').some((m) => !!m.view) || c.all('encounter_result').length > 0;
  }
  assert.ok(saw, 'something happened within 400 s of sailing');
  // In a fight: no tension.
  const { c: c2, s: s2 } = atSea(game, 'Fighter Fay');
  for (let t = 0; t < 400; t++) {
    s2.ship!.state.speed = 8;
    s2.ship!.lastCombat = game.now;
    stepDirector(game);
    game.now += 1;
  }
  assert.equal(c2.all('sights').filter((m) => m.list.length).length + c2.all('encounter').filter((m) => m.view).length, 0);
});

test('a sign opens as a card near it; the choice pays out; a raft’s castaways sign on, a bottle holds a letter', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Rescuer Ro');
  const ship = s.ship!;
  ship.crew = 5;
  const live = startEncounter(game, s, 'raft')!;
  stepDirector(game);
  assert.ok(c.last('sights')!.list.some((x) => x.id === live.id && x.kind === 'raft'));
  assert.equal(c.all('encounter').length, 0, 'not open till she is near');
  alongside(game, s, live);
  assert.equal(c.last('encounter')!.view!.def, 'raft');
  const crew0 = ship.crew;
  assert.equal(chooseEncounter(game, s, live.id, 'take'), null);
  assert.ok(ship.crew > crew0);
  assert.match(c.last('encounter_result')!.outcome, /^taken/);
  assert.equal(chooseEncounter(game, s, live.id, 'take'), 'That moment has passed');
  // A bottle, fished out: a letter (or a chart, or sand).
  let letters = 0;
  for (let i = 0; i < 12; i++) {
    const b = startEncounter(game, s, 'bottle')!;
    alongside(game, s, b);
    chooseEncounter(game, s, b.id, 'fish');
    letters = s.profile!.seaLetters?.length ?? 0;
  }
  assert.ok(letters > 0);
  assert.equal(new Set(s.profile!.seaLetters).size, letters, 'no letter twice');
});

test('aboard: an ambush puts pirates out; a mutiny is paid off; dolphins give way; a card lapses when she sails off', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Aboard Abe');
  const ship = s.ship!;
  const before = [...game.ships.values()].filter((x) => x.npcRole === 'pirate').length;
  startEncounter(game, s, 'ambush');
  assert.ok([...game.ships.values()].filter((x) => x.npcRole === 'pirate').length > before);
  ship.morale = 10;
  s.profile!.gold = 5000;
  const m = startEncounter(game, s, 'mutiny_brewing')!;
  assert.equal(c.last('encounter')!.view!.def, 'mutiny_brewing', 'aboard: open at once');
  chooseEncounter(game, s, m.id, 'pay');
  assert.ok(ship.morale >= 30);
  const d = startEncounter(game, s, 'dolphins')!;
  alongside(game, s, d);
  assert.ok(ship.hasEffect('enc_dolphins'));
  // Sailing away from an open card: it lapses.
  const r = startEncounter(game, s, 'raft')!;
  alongside(game, s, r);
  ship.state.x += 6000;
  stepDirector(game);
  assert.equal(c.last('encounter')!.view, null);
  void steps;
});

test('the director’s lines read in Russian', () => {
  setLang('ru');
  const lines = ['That moment has passed', 'No such choice', 'Wanted 1: Suspect (ran from a Crown patrol).'].map((l) => serverText(l));
  setLang('en');
  assert.deepEqual(lines.slice(0, 2).filter((l) => /[A-Za-z]{3,}/.test(l)), []);
  assert.ok(encounterPatterns().length >= 5);
});
