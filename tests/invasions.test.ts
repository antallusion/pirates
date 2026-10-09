// docs/19 E16: the Choir's invasions — every few hours by the wall clock the Choir gathers off a port of a region (never
// the Black Coast), told to the whole sea ahead; it comes in waves of its own ships (the Choir's roster aboard), each
// when the last has fallen; the defence a common cause with a bar and every hand's part, paid when the last wave falls
// in time; lost, the region lies a day under the black tide — the Choir's patrols, dear prices, the chart darkened.
// A wave of the waters' level falls to a group of 3–5 captains of that level; the words read in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTION_KINDS } from '../shared/src/data/factionunits.ts';
import { INV_EVERY, INV_GAP, INV_REGIONS, INV_TIME, INV_WARN, INV_WAVES, INV_WAVE_SHIPS, TIDE_PATROLS, TIDE_PRICE, TIDE_TIME, invPay, invTotal } from '../shared/src/data/invasions.ts';
import { seaHourOf } from '../shared/src/data/seamarks.ts';
import { regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { parkNear } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { eventViews } from '../server/src/game/events.ts';
import { invasionView, stepInvasions, tideOn } from '../server/src/game/invasions.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { priceMods } from '../server/src/game/ports.ts';
import { serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { duelSea } from './balance/duel.ts';
import { waveShare } from './balance/invasions.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

test('the invasion’s shape: three waves of three, a flagship at the last; every region but the starting waters; an hour of the waters’ pay at most', () => {
  assert.equal(INV_WAVES, 3);
  assert.deepEqual(INV_WAVE_SHIPS, [3, 3, 3]);
  assert.equal(invTotal(), 9);
  assert.ok(!INV_REGIONS.includes('black_coast') && INV_REGIONS.length === 7);
  assert.ok(INV_EVERY[0] >= 4 * 3600_000 && INV_EVERY[1] <= 6 * 3600_000);
  assert.equal(TIDE_TIME, 24 * 3600_000);
  assert.equal(invPay(40, 6, 0).silver, Math.round(seaHourOf(6) * 0.2));
  assert.equal(invPay(40, 6, 4).silver, Math.round(seaHourOf(6) * 0.6));
  assert.equal(invPay(40, 6, 40).silver, Math.round(seaHourOf(6) * 1.2), 'an hour and a fifth at most');
  assert.ok(invPay(40, 6, 6).xp > invPay(40, 6, 1).xp);
});

/** A sea whose invasions run, a captain of ⚓6 in the Gravewater Sea. */
function sea(): { game: Game; s: PlayerSession; wall: { t: number } } {
  const { game } = makeGame();
  const wall = { t: Date.now() };
  game.wallNow = () => wall.t;
  join(game, 'Choir Watch');
  const s = game.sessionByName('Choir Watch')!;
  onHull(game, s.ship!, 'brig', 6);
  runAdmin(game, s, '/level 30');
  const port = game.world.ports.find((p) => !p.raft && regionAt(game.world, p.x, p.y) === 'gravewater')!;
  parkNear(game, s, port.x, port.y, 2200);
  return { game, s, wall };
}

const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const said = (s: PlayerSession, from: number) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');
const second = (game: Game, wall: { t: number }, ms = 1000) => {
  wall.t += ms;
  stepInvasions(game);
};

test('the calendar: the Choir told of ahead, then its first wave — the Choir’s ships with the Choir’s roster, hostile to every captain', () => {
  const { game, s, wall } = sea();
  game.invasions.on = true;
  stepInvasions(game);
  assert.ok(game.invasions.store!.next > wall.t, 'the first in four to six hours');
  wall.t = game.invasions.store!.next;
  const n = inbox(s).length;
  stepInvasions(game);
  const cur = game.invasions.store!.cur!;
  assert.ok(cur && cur.wave === 0, 'told of');
  assert.ok(INV_REGIONS.includes(cur.region));
  assert.ok(said(s, n).some((m) => /^WORLD: The Choir gathers off .+ in .+: its fleet comes in 10 min\.$/.test(m)), said(s, n).join(' | '));
  assert.equal(invasionView(game, s).cur?.stage, 'warn');
  second(game, wall, INV_WARN);
  assert.equal(cur.wave, 1);
  const ships = [...game.invasions.live].map((id) => game.ships.get(id)!);
  assert.equal(ships.length, INV_WAVE_SHIPS[0]);
  for (const sh of ships) {
    assert.equal(sh.faction, 'choir');
    assert.equal(sh.invader?.inv, cur.id);
    assert.ok(sh.army.some((x) => (FACTION_KINDS as Record<string, { roster: string }>)[x.u]?.roster === 'choir'), JSON.stringify(sh.army));
    assert.equal(npcHostileTo(game, sh, s.ship!), true, 'every captain at sea');
  }
  assert.ok(eventViews(game).some((e) => e.kind === 'invasion' && e.stage === '1/3'));
});

test('the waves beaten in time: each the next after a minute, the last beaten — every hand paid, the chronicle, the calendar on', () => {
  const { game, s, wall } = sea();
  runAdmin(game, s, '/invasion start');
  const cur = game.invasions.store!.cur!;
  assert.equal(cur.wave, 1);
  for (let w = 1; w <= INV_WAVES; w++) {
    assert.equal(runAdmin(game, s, '/invasion wave'), `Wave ${w} sunk.`);
    const n = inbox(s).length;
    second(game, wall);
    if (w < INV_WAVES) {
      assert.ok(said(s, n).some((m) => m.startsWith(`WORLD: Wave ${w} of the Choir is broken off`)), said(s, n).join(' | '));
      second(game, wall, INV_GAP);
      assert.equal(cur.wave, w + 1);
      if (w + 1 === INV_WAVES) assert.ok([...game.invasions.live].some((id) => game.ships.get(id)?.invader?.flag), 'the flagship at the last');
    } else {
      assert.ok(said(s, n).some((m) => m.startsWith('WORLD: ') && m.includes('holds: the Choir')), said(s, n).join(' | '));
      assert.ok(said(s, n).some((m) => /^Your part in the defence against the Choir: \d+ ships, \d+ silver\.$/.test(m)), said(s, n).join(' | '));
    }
  }
  assert.equal(game.invasions.store!.cur, null);
  assert.equal(game.invasions.store!.won, 1);
  assert.ok(cur.beaten === invTotal() && (cur.hands[String(s.accountId)] ?? 0) >= invTotal());
  assert.ok((game.db.getKv<{ msg: string }[]>('world_chronicle') ?? []).some((c) => c.msg.includes('beaten off')));
});

test('the time runs out: the black tide a day — its patrols, its ports dear, the chart dark over it; then it ebbs', () => {
  const { game, s, wall } = sea();
  runAdmin(game, s, '/invasion start');
  const region = game.invasions.store!.cur!.region;
  const n = inbox(s).length;
  second(game, wall, INV_TIME + 1000);
  assert.ok(said(s, n).some((m) => m.startsWith('WORLD: The Choir holds ')), said(s, n).join(' | '));
  assert.equal(tideOn(game, region), true);
  assert.equal(game.invasions.live.size, 0, 'the wave gone into the dark water');
  for (let i = 0; i < 12; i++) second(game, wall, 2500);
  const patrols = [...game.ships.values()].filter((x) => x.invader?.tide === region);
  assert.equal(patrols.length, TIDE_PATROLS);
  const port = game.world.ports.find((p) => !p.raft && regionAt(game.world, p.x, p.y) === region)!;
  const tide = priceMods(s.ship!, port, s.profile!, game.now, game);
  wall.t += TIDE_TIME + 1;
  const after = priceMods(s.ship!, port, s.profile!, game.now, game);
  assert.ok(Math.abs(tide.buyMul / after.buyMul - TIDE_PRICE.buy) < 1e-9 && Math.abs(tide.sellMul / after.sellMul - TIDE_PRICE.sell) < 1e-9);
  wall.t -= TIDE_TIME + 1;
  const ev = eventViews(game).find((e) => e.kind === 'black_tide')!;
  assert.ok(ev && ev.region === region && (ev.sectors?.length ?? 0) > 3);
  assert.deepEqual(invasionView(game, s).tides.map((t) => t.region), [region]);
  const m = inbox(s).length;
  second(game, wall, TIDE_TIME);
  assert.ok(said(s, m).some((x) => x.startsWith('WORLD: The black tide ebbs from ')), said(s, m).join(' | '));
  assert.equal(tideOn(game, region), false);
  assert.equal([...game.ships.values()].filter((x) => x.invader?.tide === region && x.alive).length, 0);
});

test('balance: a wave of the waters’ level falls to a group of 3–5 captains of that level', () => {
  const game = duelSea();
  const three = waveShare(game, 5, 3, 3, false, 10, 500), four = waveShare(game, 5, 4, 3, false, 10, 520), five = waveShare(game, 5, 5, 3, true, 10, 540);
  assert.ok(three >= 0.4, `three captains against a wave: ${three}`);
  assert.ok(four >= 0.7, `four: ${four}`);
  assert.ok(five >= 0.8, `five against the flagship’s wave: ${five}`);
  assert.ok(waveShare(game, 5, 1, 3, false, 6, 560) <= 0.2, 'alone, a wave is too much');
});

test('every new word in Russian: the news, the pay, the Choir’s ships, the console; the help command for command', () => {
  const { game, s } = sea();
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.includes('/invasion [region|start|wave|win|fail|clear]') && help.includes('/relic [id|parts id|all|drop [N]|clear]'));
  assert.ok(SERVER_RU_ADMIN[help]?.includes('/invasion [регион|start|wave|win|fail|clear]'));
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const line of [
      'WORLD: The Choir gathers off Saltmarrow in The Ashen Isles: its fleet comes in 10 min.', 'WORLD: The Choir invades The Ashen Isles! Its first wave off Saltmarrow: 3 ships. Captains, defend it!',
      "WORLD: The Choir's wave 3 of 3 rises off Saltmarrow: 3 ships, the Black Choir at their head.", "WORLD: The Ashen Isles holds: the Choir's fleet is broken. Every hand in its defence is paid.",
      'WORLD: The Choir holds The Ashen Isles: the black tide lies on its waters for a day.', 'WORLD: The black tide ebbs from The Ashen Isles.',
      'WORLD: Wave 1 of the Choir is broken off Saltmarrow: the next comes in a minute.', 'Your part in the defence against the Choir: 4 ships, 9000 silver.',
      "The Choir's invasion of The Ashen Isles is beaten off.", 'The Choir takes The Ashen Isles; the black tide lies on it.', 'Hymn of the Drowned', 'The Precentor of the Abyss',
      'No invasion now; the next in 240 min. Black tides: 0. Beaten 1, lost 0.', 'Invasion of The Ashen Isles (⚓7): wave 2 of 3, 3 afloat, 3 of 9 fallen. Black tides: 1.',
      "The Choir's first wave: 3 ships.", 'Wave 2 sunk.', 'The invasion is beaten off.', 'The black tide lies on the region.', 'No invasion, no black tide.', 'No water for the Choir here.',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru), `${line} → ${ru}`);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
  void steps;
});
