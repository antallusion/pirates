// The seaux batch (owner, 2026-10-11): «я должен нажать и плыть к цели … я должен плыть туда куда нажал» — an order at a
// thing out of its reach is refused there and done on arrival (approach.ts), the server's own rule; the auto-battle only
// in gun range; her own wreckage, 48 hours a spot, kept on her profile; every piece on the water can be taken (none on a
// hulk, a full hold takes it too); castaways join her crew, never past its room, at the hour's rate; the captain's menu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIND_REACH } from '../shared/src/data/seafinds.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import { MARK_REACH } from '../shared/src/data/seamarks.ts';
import { CAST_HOURLY, WRECK_AGAIN_MS, WRECK_CELL, WRECK_CLEAR } from '../shared/src/data/wrecks.ts';
import { clearAt } from '../shared/src/world/solids.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { approachOf } from '../server/src/game/approach.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import { castawaysOf, castRoomHour, haulCastaway, putCastaway, setCastRng, stepCastaways } from '../server/src/game/castaways.ts';
import { findById, findsOf, putFind } from '../server/src/game/seafinds.ts';
import { markBusy, markById } from '../server/src/game/seamarks.ts';
import { autoReach, startPursuit } from '../server/src/game/pursuit.ts';
import { cellSpots, lootSpot, openSea, stepWrecks, wrecksOf } from '../server/src/game/wrecks.ts';
import { Rng } from '../shared/src/rng.ts';
import { captainDot, capMenuHtml, CAP_ITEMS } from '../client/src/ui/capmenu.ts';
import { claimNear, claimSpot } from '../client/src/ui/sailto.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import { openWater, putSide, duelSea } from './balance/duel.ts';
import { LEVEL_HULL, seaCaptain } from './balance/seafight.ts';

function captain(game: Game, name: string): { s: PlayerSession; c: FakeConn } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 1000;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  onHull(game, s.ship!, 'brig', 4);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  return { s, c };
}

/** Puts her at a point, still in the water. */
function place(game: Game, s: PlayerSession, x: number, y: number, speed = 0): void {
  const ship = s.ship!;
  ship.state = { ...ship.state, x, y, speed };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, x, y);
}

/** Open water `d` metres east of her that the helmsman can sail to. */
function eastOf(game: Game, s: PlayerSession, d: number): { x: number; y: number } {
  const ship = s.ship!;
  for (let k = 0; k < 40; k++) {
    const x = ship.state.x + d, y = ship.state.y + k * 300;
    if (openSea(game, x, y) && openSea(game, ship.state.x, y)) {
      place(game, s, ship.state.x, y);
      return { x, y };
    }
  }
  throw new Error('no open water east of her');
}

test('sail-to: a find out of reach is not worked from afar — the helmsman sails her there, and alongside it is done', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Far Finder');
  const ship = s.ship!;
  const at = eastOf(game, s, 900);
  const f = putFind(game, s, 'bottle', at)!;
  assert.ok(f, 'a bottle 900 m off');
  const toasts0 = c.all('toast').length;
  c.push({ t: 'seafind', action: 'work', id: f.id });
  assert.ok(findById(game, f.id), 'still on the water: nothing done from 900 m');
  assert.equal(c.last('seafinds')?.busy ?? null, null, 'the boats did not go');
  const wait = approachOf(game, s);
  assert.ok(wait && wait.msg.t === 'seafind', 'the order waits for her arrival');
  assert.ok(autosailOf(ship), 'the helmsman has the wheel for it');
  assert.ok(c.all('toast').slice(toasts0).some((t) => /Course set/.test(t.msg)), 'she is told the course is set');
  // A message straight from a client, the order given again, is still refused from afar (no remote work by message).
  place(game, s, at.x - 600, at.y);
  steps(game, 2);
  assert.ok(findById(game, f.id), 'nothing done at 600 m either');
  // Alongside, lying still: the order goes by itself.
  place(game, s, at.x - FIND_REACH.bottle * 0.5, at.y, 0);
  steps(game, 2);
  assert.equal(approachOf(game, s), null, 'the order was given');
  assert.ok(c.last('seafinds')?.busy || !findById(game, f.id), 'the boats are at it');
});

test('sail-to: arriving at full sail she heaves to first, then the boats go', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Fast Arriver');
  const at = eastOf(game, s, 800);
  const f = putFind(game, s, 'boat', at)!;
  c.push({ t: 'seafind', action: 'work', id: f.id });
  assert.ok(approachOf(game, s));
  place(game, s, at.x - 30, at.y, 8); // (her hull's thirty metres — owner, 2026-10-22, reach.ts)
  s.ship!.state.heading = Math.PI / 2;
  steps(game, 1);
  assert.ok(approachOf(game, s), 'at 8 m/s the boats wait');
  assert.equal(s.ship!.input.sailTarget, 0, 'sail in');
  s.ship!.state.speed = 0;
  steps(game, 2);
  assert.equal(approachOf(game, s), null, 'lying still: given');
  assert.ok(c.last('seafinds')?.busy || !findById(game, f.id), 'the boats are at the sinking boat');
  void findsOf;
});

test('sail-to: a sea mark from afar waits for her arrival; within a cable it is worked', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Mark Sailer');
  const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark drift go') ?? '')?.[1]);
  const m = markById(game, id)!;
  assert.ok(m, 'a driftwood mark');
  const ship = s.ship!;
  // 700 m off it, the way she came (open water: /seamark go put her alongside it)
  const dx = ship.state.x - m.x, dy = ship.state.y - m.y, d = Math.max(1, Math.hypot(dx, dy));
  place(game, s, m.x + (dx / d) * (m.r + 700), m.y + (dy / d) * (m.r + 700));
  c.push({ t: 'seamark', action: 'work', id });
  assert.equal(markBusy(game, s), null, 'not worked from 700 m');
  assert.ok(approachOf(game, s)?.msg.t === 'seamark', 'waiting for her arrival');
  place(game, s, m.x + (dx / d) * (m.r + MARK_REACH * 0.5), m.y + (dy / d) * (m.r + MARK_REACH * 0.5));
  steps(game, 2);
  assert.equal(approachOf(game, s), null);
  assert.ok(markBusy(game, s)?.id === id, 'the boats are at the mark');
});

test('sail-to: the pill\'s stop drops the order waiting for arrival', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Mind Changer');
  const at = eastOf(game, s, 900);
  const f = putFind(game, s, 'bottle', at)!;
  c.push({ t: 'seafind', action: 'work', id: f.id });
  assert.ok(approachOf(game, s));
  c.push({ t: 'autosail', stop: true });
  assert.equal(approachOf(game, s), null, 'dropped');
  place(game, s, at.x - 40, at.y, 0);
  steps(game, 2);
  assert.ok(findById(game, f.id), 'nothing done on arriving later by herself');
});

test('the auto-battle against the weak only within her guns\' reach: from far off the helmsman runs her in first', () => {
  const game = duelSea();
  const at = openWater(game, 3);
  const s = seaCaptain(game, LEVEL_HULL[5] ?? 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const foe = putSide(game, { cls: LEVEL_HULL[3] ?? 'brig', level: 3, craft: 'bot' }, at.x + 2200, at.y, Math.PI / 2).ship;
  s.autoWeak = true;
  s.autoFire = false;
  assert.ok(autoReach(me) < 2000, `her guns reach ${Math.round(autoReach(me))} m`);
  const hull0 = foe.hull;
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  let far = 0;
  for (let k = 0; k < 20 * 5; k++) {
    game.step();
    if (Math.hypot(foe.state.x - me.state.x, foe.state.y - me.state.y) <= autoReach(me) * 0.98) break;
    far++;
    assert.equal(foe.hull, hull0, 'no broadside lands from beyond her guns');
  }
  assert.ok(far > 20 * 3, 'she was out of reach for seconds (before, the weak one was settled in three from 2.2 km)');
});

test('wreckage per captain: her own spots, on clear water, others see theirs; taken as she passes, gone 48 h, kept on the profile', () => {
  const { game, db } = makeGame();
  const { s } = captain(game, 'Wreck Rita');
  const { s: t } = captain(game, 'Other Olga');
  const ship = s.ship!;
  // Her spots round her: each on open water clear of solids (every one reachable).
  stepWrecks(game);
  let mine = wrecksOf(game, s);
  for (let k = 0; mine.length === 0 && k < 30; k++) {
    place(game, s, ship.state.x + WRECK_CELL * 3, ship.state.y);
    stepWrecks(game);
    mine = wrecksOf(game, s);
  }
  assert.ok(mine.length > 0, 'spots of wreckage about her');
  for (const sp of mine) {
    assert.ok(!isLand(game.world, sp.x, sp.y) && clearAt(game.world, sp.x, sp.y, WRECK_CLEAR), `spot ${sp.id} on clear water`);
    assert.ok(sp.value > 0, 'worth something on its plate');
  }
  // Another captain at the same place sees spots of her own (her own dice).
  place(game, t, ship.state.x, ship.state.y);
  stepWrecks(game);
  const hers = wrecksOf(game, t);
  const same = hers.filter((h) => mine.some((m) => m.x === h.x && m.y === h.y)).length;
  assert.ok(same < Math.max(1, mine.length), 'not the same spots');
  assert.ok(s.conn.closed === false && (s.conn as unknown as FakeConn).last('wrecks')?.list.length === mine.length, 'sent to her');
  // She sails through one: taken, in the hold or for silver, gone for her.
  const sp = mine[0];
  const gold = s.profile!.gold, cargo = JSON.stringify(ship.cargo);
  place(game, s, sp.x - 100, sp.y, 8);
  stepWrecks(game);
  place(game, s, sp.x + 100, sp.y, 8); // the line she sailed passes through it
  stepWrecks(game);
  assert.ok(!wrecksOf(game, s).some((x) => x.id === sp.id), 'gone for her');
  assert.ok(s.profile!.gold > gold || JSON.stringify(ship.cargo) !== cargo, 'aboard');
  assert.ok(s.profile!.wrecks?.[String(sp.id)], 'kept on her profile');
  // Saved with her captain: a restart forgets nothing.
  game.saveAll();
  const row = db.loadCaptain(s.accountId)!;
  const saved = JSON.parse(row.data) as { wrecks?: Record<string, number> };
  assert.ok(saved.wrecks?.[String(sp.id)], 'in the database');
  // A day on: still gone; two days on: hers again.
  const real = game.wallNow;
  game.wallNow = () => real() + 24 * 3_600_000;
  assert.ok(!wrecksOf(game, s).some((x) => x.id === sp.id), 'a day on, not back');
  game.wallNow = () => real() + WRECK_AGAIN_MS + 60_000;
  assert.ok(wrecksOf(game, s).some((x) => x.id === sp.id), '48 hours on, back for her');
  game.wallNow = real;
});

test('every piece on the water can be taken: none dropped on a hulk stays there, a full hold still takes it', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Salvage Sal');
  // A wreck field's hulk: loot dropped on it is moved out to water a hull comes to.
  const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark wreck go') ?? '')?.[1]);
  const m = markById(game, id)!;
  assert.ok(!clearAt(game.world, m.x, m.y, 45), 'the hulk is solid');
  game.dropPrivateLoot(s.accountId, m.x, m.y, { timber: 3 }, 240);
  const l = [...game.loot.values()].find((x) => x.ownerOnly === s.accountId)!;
  assert.ok(clearAt(game.world, l.x, l.y, 45) && !isLand(game.world, l.x, l.y), 'moved out to open water');
  assert.ok(Math.hypot(l.x - m.x, l.y - m.y) < 600, 'near where it fell');
  assert.equal(lootSpot(game, l.x, l.y), null, 'its new place will do');
  // A full hold: the rest is broken up for silver, nothing left afloat.
  const ship = s.ship!;
  ship.cargo = { timber: Math.ceil(ship.stats.holdVolume / GOODS.timber.volume) + 10 };
  const gold = s.profile!.gold;
  place(game, s, l.x, l.y);
  steps(game, 25);
  assert.ok(!game.loot.has(l.id), 'taken');
  assert.ok(s.profile!.gold > gold, 'broken up for its silver');
  // Her own spots of wreckage are never on solid water either (a sweep over many cells and captains).
  let n = 0;
  for (const acc of [3, 17, 101]) for (let cx = 5; cx < 35; cx += 3) for (let cy = 5; cy < 35; cy += 3) for (const sp of cellSpots(game, acc, cx, cy)) {
    n++;
    assert.ok(clearAt(game.world, sp.x, sp.y, WRECK_CLEAR) && !isLand(game.world, sp.x, sp.y), `spot ${acc}:${sp.id}`);
  }
  assert.ok(n > 50, `${n} spots checked`);
});

test('castaways: hauled aboard as she passes, never past her crew\'s room', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Rescue Rosa');
  const ship = s.ship!;
  setCastRng(game, new Rng(7));
  const room0 = ship.stats.crewMax - ship.crew;
  assert.ok(room0 >= 3, 'berths free');
  const k = putCastaway(game, s, undefined, 3)!;
  assert.ok(k, 'a castaway ahead of her');
  assert.ok((c.last('castaways')?.list ?? []).some((x: { id: number }) => x.id === k.id), 'sent to her');
  const men = ship.crew;
  place(game, s, k.x - 100, k.y, 8);
  stepCastaways(game);
  place(game, s, k.x + 100, k.y, 8);
  stepCastaways(game);
  assert.equal(ship.crew, men + 3, 'three deckhands aboard');
  assert.equal(castawaysOf(game, s).length, 0);
  assert.ok(c.all('toast').some((t) => /castaways hauled aboard/.test(t.msg)));
  // One berth left: one comes aboard.
  ship.crew = ship.stats.crewMax - 1;
  const k2 = putCastaway(game, s, undefined, 3)!;
  assert.equal(haulCastaway(game, s, k2), 1);
  assert.equal(ship.crew, ship.stats.crewMax, 'never past her crew\'s room');
  const k3 = putCastaway(game, s, undefined, 2)!;
  assert.equal(haulCastaway(game, s, k3), 0, 'no hammocks');
  assert.equal(ship.crew, ship.stats.crewMax);
});

test('castaways: a few each ten minutes for a thin crew, none past the hour\'s cap — the tavern stays the place for men', () => {
  const { game } = makeGame();
  game.directorOn = true;
  const { s } = captain(game, 'Thin Crew Tess');
  const ship = s.ship!;
  setCastRng(game, new Rng(11));
  ship.crew = Math.floor(ship.stats.crewMax * 0.3);
  const start = ship.crew;
  let seen = 0, firstTen = 0;
  const known = new Set<number>();
  for (let t = 0; t < 3600; t++) {
    ship.state.speed = 8;
    ship.lastCombat = -1000;
    stepCastaways(game);
    for (const k of castawaysOf(game, s)) {
      if (known.has(k.id)) continue;
      known.add(k.id);
      seen++;
      if (t < 600) firstTen++;
      haulCastaway(game, s, k); // she sails by each
    }
    game.now += 1;
  }
  const got = ship.crew - start;
  assert.ok(firstTen >= 2 && firstTen <= 5, `${firstTen} castaways in the first ten minutes`);
  assert.ok(got <= CAST_HOURLY, `${got} men in the hour (cap ${CAST_HOURLY})`);
  assert.ok(got >= Math.min(CAST_HOURLY, 6), `${got} men in the hour: it eases a short crew`);
  assert.ok(castRoomHour(game, s) >= 0);
  assert.ok(seen >= 4, `${seen} castaways in the hour`);
});

test('the captain\'s portrait opens her menu: six tiles, the bead\'s news first, the bead out once seen', () => {
  const html = capMenuHtml({ name: 'Anne', level: 7, pts: 2 }, { pts: 0, lv: 6 });
  for (const it of CAP_ITEMS) assert.match(html, new RegExp(`data-cap="${it.id}"`), it.id);
  assert.match(html, /cap-news fresh/, 'the talent points first');
  assert.match(html, /data-cap="talents"[^>]*>[^<]*<\/button>|k-badge/, 'the talents tile marked');
  assert.ok(captainDot(2, 7, { pts: 0, lv: 6 }), 'the bead: points not seen');
  assert.ok(!captainDot(2, 7, { pts: 2, lv: 7 }), 'seen: out');
  assert.ok(captainDot(3, 7, { pts: 2, lv: 7 }), 'a new point: lit again');
  assert.ok(captainDot(0, 8, { pts: 0, lv: 7 }), 'a new level: lit');
  // Her portrait is a button on a phone too (it was pointer-events: none on touch), and its click opens the menu.
  const css = readFileSync(new URL('../client/seahud.css', import.meta.url), 'utf8');
  assert.match(css, /body\.simple\.touch #hud-captain \{ pointer-events: auto;/);
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /hud\.onCaptain = \(\) => \{[\s\S]{0,200}toggleCaptainMenu\(/);
  const hud = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');
  assert.match(hud, /el\.setAttribute\('role', 'button'\);\s*el\.tabIndex = 0;/);
});

test('«Занять» sails her in to the island\'s shore first; the claim\'s terms open within reach', () => {
  const isl = { x: 10000, y: 10000, r: 400 };
  const far = { x: 13000, y: 10000 };
  assert.ok(!claimNear(isl, far));
  const p = claimSpot(isl, far);
  assert.ok(claimNear(isl, p), 'the helmsman\'s mark is within the claim\'s reach');
  assert.ok(Math.hypot(p.x - isl.x, p.y - isl.y) > isl.r, 'off the shore, on the water');
});

test('the windows scroll with a finger: the pager is not installed, the panes scroll (iOS too)', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(!/^installPager\(\);/m.test(main), 'no pager');
  const fit = readFileSync(new URL('../client/fit.css', import.meta.url), 'utf8');
  assert.match(fit, /#modal-panel \.modal-body, #modal-panel #company-body, #modal-panel \.tal-main, \.k-sheet-root \.k-sheet-body, \.w-rail \{\s*overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: auto; \}/);
  const sheet = readFileSync(new URL('../client/src/ui/kit/sheet.ts', import.meta.url), 'utf8');
  assert.match(sheet, /if \(dy < -6 && !panel\.classList\.contains\('k-dragging'\)\)/, 'a stroke up is the list\'s scroll, not the sheet\'s drag');
});

test('the new lines in Russian: the sail-to, the wreckage, the castaways', async () => {
  const { SERVER_RU_SEAUX } = await import('../client/src/lang/server.ru.seaux.ts');
  const A = await import('../server/src/game/approach.ts');
  for (const w of [A.APPROACH_SET, A.APPROACH_OWN, A.APPROACH_GONE, A.APPROACH_LATE, 'Come alongside it first.', 'The hold is full: the rest of the salvage is broken up for {0} silver.', '{0} castaways hauled aboard off a spar: they sign on as deckhands.']) {
    assert.ok(SERVER_RU_SEAUX[w], w);
    assert.ok(!/[A-Za-z]{3,}/.test(SERVER_RU_SEAUX[w]), `no Latin: ${SERVER_RU_SEAUX[w]}`);
  }
});
