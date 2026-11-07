// Forum, Эдуард, post 93: the castaways past her hammocks ride as the rescued (a cap, the sea's hourly cap), each batch
// rolls small risks once — fever with no surgeon and no medicine, a mutiny with no marines, a cursed sea-chest — and a
// floating waystation takes them: silver a head, three for a trained man in a sailor's place (a helmsman or a cook at a
// tavern, a surgeon at a chapel, a carpenter at a market), and its kind's help with the hold (rum against fear, medicine
// against the curse, the overload sold at half price), each once in half an hour. «Плыть к плавучему дому» hands her to
// the helmsman and moors her on arrival.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { holdFill, overloadAt } from '../shared/src/data/overload.ts';
import {
  AID_CASKS, AID_COOLDOWN_MS, CARGO_MUL, MED_CURSE, RESCUE_CAP, RESCUE_CURSE, RESCUE_FEVER, RESCUE_MUTINY, RESCUE_SWAP, RUM_FEAR, WAY_AIDS, rescueHead, rescuePatterns,
} from '../shared/src/data/rescue.ts';
import { waterHour } from '../shared/src/data/smuggler.ts';
import { CAST_HOURLY } from '../shared/src/data/wrecks.ts';
import { waystations } from '../shared/src/world/waystations.ts';
import type { Waystation, WayKind } from '../shared/src/world/waystations.ts';
import type { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import { haulCastaway, putCastaway } from '../server/src/game/castaways.ts';
import { aidRows, doAid, rescueOf, rescueView, setRescueRng } from '../server/src/game/rescue.ts';
import { moor, mooredAt, wayView } from '../server/src/game/waystations.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { castawayNotes, rescueText } from '../client/src/ui/fxrow.ts';
import { aidHtml } from '../client/src/ui/waystation.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull } from './helpers.ts';

/** Dice that always come up `v`. */
const dice = (v: number): Rng => ({ float: () => v, range: (a: number) => a, int: (a: number) => a }) as unknown as Rng;

function captain(game: Game, name: string, kind: WayKind = 'tavern'): { s: PlayerSession; c: FakeConn; w: Waystation } {
  const c = join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  const p = s.profile!;
  p.gold = 10_000;
  p.level = 20;
  s.ship!.docked = null;
  p.docked = null;
  const w = waystations(game.world).list.find((x) => x.region === 'gravewater' && x.kind === kind)!;
  at(game, s, w.x + 30, w.y);
  return { s, c, w };
}

function at(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.lastCombat = -1000;
  ship.lastHitAt = -1000;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, x, y);
}

/** Her hammocks full, her crew a bare one (no surgeon, no marine, no medicine). */
function full(game: Game, s: PlayerSession, pools: Partial<Record<'surgeon' | 'marine', number>> = {}): void {
  const ship = s.ship!, p = s.profile!;
  ship.crew = ship.stats.crewMax;
  for (const k of Object.keys(p.company.pools) as (keyof typeof p.company.pools)[]) p.company.pools[k] = 0;
  p.company.pools.sailor = ship.crew - (pools.surgeon ?? 0) - (pools.marine ?? 0);
  p.company.pools.surgeon = pools.surgeon ?? 0;
  p.company.pools.marine = pools.marine ?? 0;
  delete ship.cargo.medicine;
  ship.curse = 0;
}

function haul(game: Game, s: PlayerSession, n: number): number {
  const c = putCastaway(game, s, { x: s.ship!.state.x + 100, y: s.ship!.state.y }, n)!;
  return haulCastaway(game, s, c);
}

test('no hammocks: the castaways ride as the rescued (a cap, the hourly cap), before they were given water and lost', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Rescue Ruth');
  full(game, s, { surgeon: 1, marine: 1 });
  setRescueRng(game, dice(0.99));
  const crew = s.ship!.crew;
  assert.equal(haul(game, s, 3), 0, 'none into the crew');
  assert.equal(s.ship!.crew, crew);
  assert.equal(rescueOf(s.profile!).aboard, 3, 'three ride as the rescued');
  const v = rescueView(game, s)!;
  assert.equal(v.aboard, 3);
  assert.equal(v.head, rescueHead(20));
  // the cap
  rescueOf(s.profile!).aboard = RESCUE_CAP - 1;
  haul(game, s, 3);
  assert.equal(rescueOf(s.profile!).aboard, RESCUE_CAP, 'never past the cap');
  haul(game, s, 2);
  assert.equal(rescueOf(s.profile!).aboard, RESCUE_CAP);
  // the sea's hourly cap holds the rescued too
  const { game: g2 } = makeGame();
  const { s: s2 } = captain(g2, 'Hourly Hal');
  full(g2, s2, { surgeon: 1, marine: 1 });
  setRescueRng(g2, dice(0.99));
  for (let i = 0; i < 10; i++) haul(g2, s2, 3);
  assert.equal(rescueOf(s2.profile!).aboard, Math.min(RESCUE_CAP, CAST_HOURLY));
});

test('the risks of a batch: a bare crew may take a fever (no surgeon, no medicine) and a mutiny (no marine); a full one only the cursed chest', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Bare Bea');
  full(game, s);
  assert.equal(rescueView(game, s)!.aboard, 0, 'none aboard (the row shows nothing)');
  setRescueRng(game, dice(0)); // every risk comes up
  const crew = s.ship!.crew;
  haul(game, s, 3);
  assert.ok(s.ship!.crew < crew, 'the fever and the mutiny took men');
  assert.ok(crew - s.ship!.crew <= Math.round(crew * 0.04) + Math.round(crew * 0.03) + 2, 'a few per cent, no more');
  assert.equal(rescueOf(s.profile!).aboard, 0, 'the mutineers took the batch away');
  assert.ok(s.ship!.curse > 0, 'the cursed chest');
  // a full build: surgeon and marines aboard
  const { game: g2 } = makeGame();
  const { s: s2 } = captain(g2, 'Full Fay');
  full(g2, s2, { surgeon: 2, marine: 4 });
  setRescueRng(g2, dice(0));
  const c2 = s2.ship!.crew;
  haul(g2, s2, 3);
  assert.equal(s2.ship!.crew, c2, 'no fever, no mutiny');
  assert.equal(rescueOf(s2.profile!).aboard, 3);
  assert.ok(s2.ship!.curse > 0, 'only the chest is chance');
  const v = rescueView(g2, s2)!;
  assert.deepEqual([v.fever, v.mutiny, v.curse], [0, 0, RESCUE_CURSE]);
  // a chest of medicine answers the fever too
  const { game: g3 } = makeGame();
  const { s: s3 } = captain(g3, 'Med Mo');
  full(g3, s3);
  s3.ship!.cargo.medicine = 1;
  rescueOf(s3.profile!).aboard = 1;
  assert.equal(rescueView(g3, s3)!.fever, 0);
  assert.equal(rescueView(g3, s3)!.mutiny, RESCUE_MUTINY);
  delete s3.ship!.cargo.medicine;
  assert.equal(rescueView(g3, s3)!.fever, RESCUE_FEVER);
});

test('the reward is fair: a sea-hour of the rescued is under a fifth of a sea-hour', () => {
  for (const lv of [5, 20, 40, 60]) {
    const hour = Math.min(RESCUE_CAP, CAST_HOURLY) * rescueHead(lv);
    assert.ok(hour <= waterHour(lv) * 0.2, `level ${lv}: ${hour} of ${waterHour(lv)}`);
  }
});

test('a raft tavern: set them down for silver, three for a helmsman or a cook, rum against fear once in half an hour', () => {
  const { game } = makeGame();
  const { s, w } = captain(game, 'Tavern Tess', 'tavern');
  const p = s.profile!, ship = s.ship!;
  full(game, s, { surgeon: 1, marine: 1 });
  assert.equal(moor(game, s, w.id), null);
  assert.equal(mooredAt(game, s)?.id, w.id);
  assert.deepEqual(wayView(game, s, w).aid.map((a) => a.id), WAY_AIDS.tavern);
  // nothing to do: every line dimmed, with why
  assert.ok(aidRows(game, s, w).every((a) => !a.on && a.why), 'only the lines that matter are lit');
  rescueOf(p).aboard = 7;
  // three for a helmsman: the head count stays, a sailor stands down
  const crew = ship.crew, sail = p.company.pools.sailor, helm = p.company.pools.helmsman;
  assert.equal(doAid(game, s, w, 'helmsman'), null);
  assert.equal(rescueOf(p).aboard, 7 - RESCUE_SWAP);
  assert.equal(p.company.pools.helmsman, helm + 1);
  assert.equal(p.company.pools.sailor, sail - 1);
  assert.equal(ship.crew, crew, 'no berth needed');
  assert.match(doAid(game, s, w, 'surgeon')!, /Not here/, 'a surgeon is a chapel’s');
  // the rest set down for silver
  const gold = p.gold;
  assert.equal(doAid(game, s, w, 'land'), null);
  assert.equal(p.gold, gold + 4 * rescueHead(20));
  assert.equal(rescueOf(p).aboard, 0);
  assert.match(doAid(game, s, w, 'cook')!, /Needs 3 rescued/);
  // rum against fear: six casks at most, once in half an hour
  ship.sanity = 40;
  ship.cargo.rum = 20;
  const rum = aidRows(game, s, w).find((a) => a.id === 'rum')!;
  assert.equal(rum.on, true);
  assert.equal(rum.n, AID_CASKS);
  assert.equal(doAid(game, s, w, 'rum'), null);
  assert.equal(ship.cargo.rum, 20 - AID_CASKS);
  assert.ok(ship.sanity >= 40 + AID_CASKS * RUM_FEAR - 0.01, `sanity ${ship.sanity}`);
  assert.match(doAid(game, s, w, 'rum')!, /Again in 30 min/);
  game.wallSkew += AID_COOLDOWN_MS + 1000;
  assert.equal(doAid(game, s, w, 'rum'), null, 'again after the half hour');
});

test('a hulk chapel: a surgeon for three, medicine against the hull’s curse', () => {
  const { game } = makeGame();
  const { s, w } = captain(game, 'Chapel Cy', 'chapel');
  const p = s.profile!, ship = s.ship!;
  full(game, s);
  assert.equal(moor(game, s, w.id), null);
  rescueOf(p).aboard = 3;
  assert.equal(doAid(game, s, w, 'surgeon'), null);
  assert.equal(p.company.pools.surgeon, 1);
  ship.curse = 40;
  ship.cargo.medicine = 3;
  const row = aidRows(game, s, w).find((a) => a.id === 'medicine')!;
  assert.deepEqual([row.on, row.n, row.gain], [true, 3, 3 * MED_CURSE]);
  assert.equal(doAid(game, s, w, 'medicine'), null);
  assert.equal(ship.curse, 40 - 3 * MED_CURSE);
  assert.equal(ship.cargo.medicine, undefined);
});

test('a floating market: a carpenter for three, the cargo past the overload line taken at half price', () => {
  const { game } = makeGame();
  const { s, w } = captain(game, 'Market Mae', 'market');
  const p = s.profile!, ship = s.ship!;
  full(game, s);
  assert.equal(moor(game, s, w.id), null);
  rescueOf(p).aboard = 3;
  assert.equal(doAid(game, s, w, 'carpenter'), null);
  assert.equal(p.company.pools.carpenter, 1);
  // overloaded with cheap and dear goods
  const line = overloadAt(ship.loadout.classId);
  const cheap: GoodId = 'rum', dear: GoodId = 'medicine';
  ship.cargo[dear] = 5;
  ship.cargo[cheap] = Math.ceil(((line + 0.2) * ship.stats.holdVolume) / GOODS[cheap].volume);
  assert.ok(holdFill(ship.cargo, ship.stats) >= line);
  const row = aidRows(game, s, w).find((a) => a.id === 'cargo')!;
  assert.ok(row.on && row.n > 0);
  const gold = p.gold, before = ship.cargo[cheap]!;
  assert.equal(doAid(game, s, w, 'cargo'), null);
  assert.ok(holdFill(ship.cargo, ship.stats) < line, 'under the line');
  assert.equal(ship.cargo[dear], 5, 'the cheapest by room went first');
  const took = before - (ship.cargo[cheap] ?? 0);
  assert.equal(took, row.n);
  assert.equal(p.gold - gold, Math.floor(took * GOODS[cheap].basePrice * CARGO_MUL));
  assert.match(doAid(game, s, w, 'cargo')!, /Again in|not overloaded/);
});

test('«Плыть к плавучему дому»: the helmsman takes her to the nearest and she moors on arrival', () => {
  const { game } = makeGame();
  const { s, c, w } = captain(game, 'Course Cora');
  at(game, s, w.x + 260, w.y);
  c.push({ t: 'way', action: 'nearest' });
  assert.equal(mooredAt(game, s), null, 'not moored from afar');
  assert.ok(autosailOf(s.ship!), 'the helmsman has the course');
  at(game, s, w.x + 25, w.y);
  c.push({ t: 'way', action: 'nearest' });
  assert.ok(mooredAt(game, s), 'alongside: moored');
});

test('in Russian: the toasts, the card of the rescued and the window’s lines — no Latin', () => {
  setLang('ru');
  try {
    for (const [en, ru] of rescuePatterns()) {
      assert.ok(!/[A-Za-z]/.test(ru), ru);
      const t = serverText(en.replace('{0}', '3').replace('{1}', '7'));
      assert.ok(!/[A-Za-z]/.test(t), `${en} → ${t}`);
    }
    const text = rescueText({ aboard: 4, cap: 12, head: 63, fever: 0.12, mutiny: 0.08, curse: 0.1 });
    assert.ok(!/[A-Za-z]/.test(text), text);
    assert.match(text, /лихорадка 12\s?%/u);
    assert.match(text, /бунт 8\s?%/u);
    const notes = castawayNotes({ aboard: 2, cap: 12, head: 63, fever: 0.12, mutiny: 0, curse: 0.1 }, 0).join(' ');
    assert.ok(!/[A-Za-z]/.test(notes), notes);
    assert.match(notes, /лихорадка 12\s?%/u);
    assert.doesNotMatch(notes, /бунт/, 'marines aboard: no mutiny named');
    assert.match(castawayNotes({ aboard: 12, cap: 12, head: 63, fever: 0, mutiny: 0, curse: 0.1 }, 0).join(' '), /курс\s+к\s+берегу/u);
    const html = aidHtml({ id: 1, kind: 'tavern', res: null as never, repair: null, hire: 0, rescued: 4, aid: [
      { id: 'land', on: true, n: 4, gain: 252, wait: 0 }, { id: 'helmsman', on: true, n: 3, gain: 1, wait: 0 }, { id: 'cook', on: true, n: 3, gain: 1, wait: 0 },
      { id: 'rum', on: false, n: 0, gain: 0, wait: 0, why: 'No rum in the hold.' },
    ] });
    const words = html.replace(/<[^>]+>/g, ' ');
    assert.ok(!/[A-Za-z]/.test(words), words);
    assert.match(words, /трюме\s+нет\s+рома/u);
    assert.equal((html.match(/btn-primary/g) ?? []).length, 3, 'three lit, the rum dimmed');
  } finally {
    setLang('en');
  }
});
