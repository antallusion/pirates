// The dense sea's marks at work (owner, 2026-10-02): every mark that is not land has its small thing to do — driftwood,
// a wreck field, a lane buoy, a lantern float, floating bones, an ice floe — within a cable, hove to, a few seconds;
// what it gives is two to five hundredths of an hour at sea, once a day a captain a mark; the boats are called back
// when she makes way; the admin's command; every word in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS } from '../shared/src/data/goods.ts';
import { MARK_AGAIN_MS, MARK_KINDS, MARK_REACH, MARK_SHARE, MARK_TIME, markInReach, markWorth, seaHourOf } from '../shared/src/data/seamarks.ts';
import type { MarkKind } from '../shared/src/data/seamarks.ts';
import { driftKindsFor } from '../shared/src/data/drifts.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import { regionAt } from '../shared/src/world/worldgen.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { driftList } from '../server/src/game/drifts.ts';
import { landStore } from '../server/src/game/landecon.ts';
import { markAgain, markBusy, markWithin, setMarkRng, startMark, workMark } from '../server/src/game/seamarks.ts';
import { seaHour } from './balance/island.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, steps } from './helpers.ts';

function world(): Game {
  const { game } = makeGame();
  return game;
}

function captain(game: Game, name = 'Mark Tester'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 1000;
  return s;
}

const conn = (s: PlayerSession) => (s as unknown as { conn: { last: (t: string) => Record<string, unknown> | undefined } }).conn;
const toasts = (s: PlayerSession) => (s as unknown as { conn: { all: (t: string) => { msg: string; kind: string }[] } }).conn.all('toast');

/** Hove to by the nearest mark of a kind; the mark. */
function by(game: Game, s: PlayerSession, kind: MarkKind) {
  const out = runAdmin(game, s, `/seamark ${kind} go`)!;
  assert.match(out, /Hove to by the/, out);
  const m = markWithin(game, s);
  assert.ok(m && m.kind === kind, `${kind}: within reach (${out})`);
  return m!;
}

/** The boats at the mark until they are done. */
function work(game: Game, s: PlayerSession, id: number): void {
  assert.equal(startMark(game, s, id), null);
  assert.ok(markBusy(game, s), 'the boats are away');
  steps(game, 20 * 6);
  assert.equal(markBusy(game, s), null, 'and back');
}

test('the marks: six kinds, each with its time, a reach of a cable, a worth of two to five hundredths of a sea hour', () => {
  assert.deepEqual([...MARK_KINDS].sort(), ['bones', 'buoy', 'drift', 'floe', 'lantern', 'wreck']);
  for (const k of MARK_KINDS) assert.ok(MARK_TIME[k] >= 2 && MARK_TIME[k] <= 4, k);
  assert.ok(MARK_REACH >= 120 && MARK_REACH <= 200);
  assert.equal(MARK_AGAIN_MS, 24 * 3_600_000);
  for (let L = 1; L <= 10; L++) {
    assert.equal(seaHourOf(L), seaHour(L), `the island's sea hour at ⚓${L}`);
    assert.equal(markWorth(L, 0), Math.round(seaHour(L) * MARK_SHARE[0]));
    assert.equal(markWorth(L, 0.9999999), Math.round(seaHour(L) * MARK_SHARE[1]));
  }
  assert.deepEqual(MARK_SHARE, [0.02, 0.05]);
  assert.ok(markInReach({ x: 0, y: 0, r: 40 }, 0, 190) && !markInReach({ x: 0, y: 0, r: 40 }, 0, 210));
});

test('driftwood: planks or timber for about its worth, then not again today; a day later it is hers again', () => {
  const game = world();
  const s = captain(game);
  const m = by(game, s, 'drift');
  const before = { planks: s.ship!.cargo.planks ?? 0, timber: s.ship!.cargo.timber ?? 0 };
  work(game, s, m.id);
  const gotP = (s.ship!.cargo.planks ?? 0) - before.planks, gotT = (s.ship!.cargo.timber ?? 0) - before.timber;
  assert.ok(gotP > 0 || gotT > 0, 'wood aboard');
  const lv = s.ship!.shipLevel;
  const value = gotP * GOODS.planks.basePrice + gotT * GOODS.timber.basePrice;
  assert.ok(value >= seaHour(lv) * 0.02 * 0.5 && value <= seaHour(lv) * 0.05 * 1.6, `worth ${value} at ⚓${lv}`);
  assert.match(toasts(s).at(-1)!.msg, /Driftwood hauled aboard/);
  // Once a day a captain a mark.
  assert.equal(startMark(game, s, m.id), 'Your boats worked this one today already.');
  assert.ok(markAgain(game, s.profile!, m.id) > 23 * 3_600_000);
  const sent = conn(s).last('seamarks') as { done: number[]; busy: unknown } | undefined;
  assert.ok(sent?.done.includes(m.id) && sent.busy === null, 'her sea marks it searched');
  // Another captain may work it the same day.
  const t = captain(game, 'Second Mate');
  runAdmin(game, t, '/seamark drift go');
  assert.equal(markWithin(game, t)?.id, m.id);
  assert.equal(startMark(game, t, m.id), null);
  // A day on: hers again.
  const real = game.wallNow;
  game.wallNow = () => real() + MARK_AGAIN_MS + 1000;
  assert.equal(markAgain(game, s.profile!, m.id), 0);
  assert.equal(startMark(game, s, m.id), null);
  game.wallNow = real;
});

test('a wreck field: goods or a drowned purse; a lane buoy charts an island near or reads the way to port', () => {
  const game = world();
  const s = captain(game);
  const m = by(game, s, 'wreck');
  const g0 = s.profile!.gold, cargo0 = JSON.stringify(s.ship!.cargo);
  work(game, s, m.id);
  const silver = s.profile!.gold - g0;
  assert.ok(silver > 0 || JSON.stringify(s.ship!.cargo) !== cargo0, 'something found');
  if (silver > 0) assert.ok(silver <= seaHour(s.ship!.shipLevel) * 0.05 + 1, `a purse of ${silver}`);
  assert.match(toasts(s).map((x) => x.msg).join('\n'), /The wreck field searched/);

  const b = by(game, s, 'buoy');
  s.discovered.clear();
  s.profile!.discovered = [];
  const xp0 = s.profile!.xp, gold0 = s.profile!.gold;
  work(game, s, b.id);
  const line = toasts(s).at(-1)!.msg;
  if (/charts/.test(line)) {
    const name = /charts (.+), \d+ m to the/.exec(line)![1];
    assert.ok([...s.discovered].some((id) => game.world.islands[id].name === name), `${name} on her chart`);
    assert.ok(s.profile!.xp >= xp0);
  } else {
    assert.match(line, /The lane mark reads: .+, \d+ km to the [a-z-]+\. A pilot's tin on the buoy: \d+ silver\./);
    assert.ok(s.profile!.gold > gold0);
  }
});

test('a lantern float lifts morale; floating bones are bone for the store or an omen; an ice floe gives water, or seals', () => {
  const game = world();
  quietAdv(game, false);
  const s = captain(game);
  const l = by(game, s, 'lantern');
  s.ship!.morale = 50;
  work(game, s, l.id);
  assert.ok(s.ship!.morale >= 53 && s.ship!.morale <= 56, `morale ${s.ship!.morale}`);

  // Bones: with the dice low, an omen (good or ill); high, bone into the store.
  const b = by(game, s, 'bones');
  class High extends Rng {
    override float(): number { return 0.99; }
    override chance(): boolean { return false; }
  }
  setMarkRng(game, new High(1));
  const bone0 = landStore(s.profile!).bone;
  workMark(game, s, b);
  assert.ok(landStore(s.profile!).bone > bone0, 'bone for the store');
  class Low extends Rng {
    override float(): number { return 0.01; }
    override chance(): boolean { return true; }
  }
  setMarkRng(game, new Low(1));
  s.ship!.morale = 50;
  workMark(game, s, b);
  assert.equal(s.ship!.morale, 54, 'a good omen');

  // A floe: with the dice low, seals hauled out on it where its waters know them; otherwise ice for water.
  const f = by(game, s, 'floe');
  const fits = driftKindsFor(sectorAt(game.world, f.x, f.y).level, regionAt(game.world, f.x, f.y)).some(([k]) => k === 'seal_floe');
  const p0 = s.ship!.cargo.provisions ?? 0;
  workMark(game, s, f);
  if (fits) assert.ok(driftList(game).some((d) => d.kind === 'seal_floe' && d.owner === s.accountId), 'seals on the floe');
  else assert.ok((s.ship!.cargo.provisions ?? 0) > p0, 'fresh water');
  setMarkRng(game, new High(1));
  const p1 = s.ship!.cargo.provisions ?? 0;
  workMark(game, s, f);
  assert.ok((s.ship!.cargo.provisions ?? 0) > p1, 'ice cut for water');
});

test('the boats go only hove to, within reach, out of the fight; making way calls them back and the mark stays hers', () => {
  const game = world();
  const s = captain(game);
  const m = by(game, s, 'drift');
  s.ship!.state.speed = 6;
  assert.match(startMark(game, s, m.id) ?? '', /Shorten sail first/);
  s.ship!.state.speed = 0;
  assert.equal(startMark(game, s, 99_999_999), 'Nothing there to work.');
  s.ship!.lastHitAt = game.now; // another ship's fire on her (her own fight is no fire: owner, 2026-10-07)
  assert.equal(startMark(game, s, m.id), 'Not under fire.');
  s.ship!.lastHitAt = -999;
  assert.equal(startMark(game, s, m.id), null);
  steps(game, 20);
  s.ship!.state.speed = 7;
  s.ship!.input = { rudder: 0, sailTarget: 1 };
  steps(game, 25);
  assert.equal(markBusy(game, s), null);
  assert.ok(toasts(s).some((x) => /The boats are called back/.test(x.msg)));
  assert.equal(markAgain(game, s.profile!, m.id), 0, 'not worked');
  // Far off: out of reach.
  s.ship!.state = { ...s.ship!.state, x: m.x + 2000, speed: 0 };
  assert.equal(startMark(game, s, m.id), 'Come within a cable of it first.');
  // A full hold: the boats leave it and it stays hers to work.
  s.ship!.state = { ...s.ship!.state, x: m.x, y: m.y + m.r + 90, speed: 0 };
  s.ship!.cargo.iron = 1e6;
  workMark(game, s, m);
  assert.match(toasts(s).at(-1)!.msg, /Your hold is full/);
  assert.equal(markAgain(game, s.profile!, m.id), 0);
});

test('the sea marks over the wire, the admin command in HELP in both languages, and every line in Russian', () => {
  const game = world();
  const s = captain(game);
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.includes('/seamark [drift|wreck|buoy|lantern|bones|floe] [go|done|reset]'));
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the Russian HELP');
  assert.equal(ru.split(' · ').length, help.split(' · ').length, 'command for command');
  const m = by(game, s, 'wreck');
  (s as unknown as { conn: { push: (x: unknown) => void } }).conn.push({ t: 'seamark', action: 'work', id: m.id });
  assert.ok(markBusy(game, s));
  (s as unknown as { conn: { push: (x: unknown) => void } }).conn.push({ t: 'seamark', action: 'cancel' });
  assert.equal(markBusy(game, s), null);
  setLang('ru');
  try {
    for (const line of ['/seamark', '/seamark done', '/seamark', '/seamark reset', '/seamark bones go', '/seamark done', '/seamark lantern go', '/seamark done', '/seamark floe go', '/seamark done', '/seamark buoy go', '/seamark done', '/seamark drift go', '/seamark done']) {
      const out = runAdmin(game, s, line)!;
      const t = serverText(out);
      assert.ok(!/[A-Za-z]{3,}/.test(t.replace(/⚓/g, '')) || /[А-Яа-я]/.test(t), `${line}: ${t}`);
    }
    for (const x of toasts(s)) {
      const t = serverText(x.msg);
      assert.ok(!/\b(the|and|your|boats|silver|morale)\b/i.test(t), `${x.msg} → ${t}`);
    }
  } finally {
    setLang('en');
  }
  const table = serverTable();
  const mine = extract('server/src').filter((p) => /mark|wreck field|lane|lantern float|floating bones|floe|Driftwood|boats are called|Shorten sail first|within a cable|oilskin/i.test(p));
  const missing = mine.filter((p) => table[p] === undefined);
  assert.deepEqual(missing, []);
});
