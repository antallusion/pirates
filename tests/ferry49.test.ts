// «Переход» after Эдуард's post 49 in forum topic 7 (2026-11-02, the owner accepted): the pirate flag pays double, any
// skull is refused, a quest's hub costs a quarter, the cooldown is half an hour, the hold rule counts the trade goods only,
// and «Тихая гавань» — no captain attacks another within HAVEN_R of a hub, and one who came by ferry keeps that peace
// HAVEN_WARD_SEC after leaving it (server/src/game/ferry.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE } from '../shared/src/constants.ts';
import { FERRY_COOLDOWN_SEC, FERRY_HUBS, FERRY_PIRATE_MUL, FERRY_QUEST_MUL, HAVEN_R, HAVEN_WARD_FX, HAVEN_WARD_SEC, ferryPriceFor, havenAt } from '../shared/src/data/ferry.ts';
import { WANTED_THRESHOLDS } from '../shared/src/data/factions.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import { FERRY_WORDS, HAVEN_SAY, ferryCost, ferryGo, ferryQuote, ferryView, havenBlocked, inHaven, questHubs, warded } from '../server/src/game/ferry.ts';
import { finishVoyage } from '../server/src/game/passage.ts';
import { SERVER_RU_PASSAGE } from '../client/src/lang/server.ru.passage.ts';
import { RU as LF_RU } from '../client/src/lang/ui/ferry.ts';
import { RU as FX_RU } from '../client/src/lang/ui/fx.ts';
import { join, makeGame } from './helpers.ts';

function dockAt(game: Game, s: PlayerSession, id: string): void {
  const port = game.portById(id)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  game.grid.upsert(s.ship!.id, port.x, port.y);
}

function captain(game: Game, name: string, at = 'gravesend'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  dockAt(game, s, at);
  for (const id of FERRY_HUBS) if (!s.profile!.regionsSeen.includes(`visited:${id}`)) s.profile!.regionsSeen.push(`visited:${id}`);
  s.profile!.gold = 100_000;
  s.ship!.cargo = {} as NonNullable<typeof s.ship>['cargo'];
  return s;
}

/** At sea by a point, under the pirate flag (fair game to every captain), no newcomer's shelter. */
function seaAt(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
  s.profile!.pvp.flag = 'pirate';
  s.profile!.level = 30;
}

test('ferry (post 49): the pirate flag pays double, any skull is refused, the cooldown is half an hour', () => {
  const { game } = makeGame();
  const s = captain(game, 'Ferry Black');
  const base = ferryCost(game, 'gravesend', 'hollowmere')!;
  assert.equal(FERRY_COOLDOWN_SEC, 30 * 60);
  assert.equal(ferryView(game, s, 'gravesend')!.routes.find((r) => r.to === 'hollowmere')!.price, base);
  s.profile!.pvp.flag = 'pirate';
  const v = ferryView(game, s, 'gravesend')!;
  assert.equal(v.pirate, true, 'the list says why');
  const r = v.routes.find((x) => x.to === 'hollowmere')!;
  assert.equal(r.price, ferryPriceFor(base, { pirate: true }));
  assert.equal(r.price, base * FERRY_PIRATE_MUL);
  assert.equal(r.base, base);
  // one skull: refused, in her words
  s.profile!.infamy = WANTED_THRESHOLDS[1];
  assert.equal(ferryGo(game, s, 'hollowmere'), FERRY_WORDS.skulls);
  assert.equal(SERVER_RU_PASSAGE[FERRY_WORDS.skulls], 'С черепами переход не возьмёт — сначала отмойтесь.');
  s.profile!.infamy = 0;
  const gold = s.profile!.gold;
  assert.equal(ferryGo(game, s, 'hollowmere'), null);
  assert.equal(s.profile!.gold, gold - base * FERRY_PIRATE_MUL, 'paid double');
  finishVoyage(game, s.ship!);
  dockAt(game, s, 'hollowmere');
  assert.match(ferryGo(game, s, 'gravesend') ?? '', /next passage in (2\d|30) min/);
});

test('ferry (post 49): to the hub nearest an active quest\'s goal — a quarter of the price, «скидка за задание»', () => {
  const { game } = makeGame();
  const s = captain(game, 'Ferry Quest');
  // a real quest whose first goal lies by Sealhold (the tester's /fquest)
  assert.match(runAdmin(game, s, '/fquest sealhold') ?? '', /^Quest taken/);
  {
    assert.ok(questHubs(game, s).has('sealhold'));
    const v = ferryView(game, s, 'gravesend')!;
    const q = v.routes.find((r) => r.to === 'sealhold')!;
    const base = ferryCost(game, 'gravesend', 'sealhold')!;
    assert.equal(q.quest, true, 'marked in the list');
    assert.equal(q.price, ferryPriceFor(base, { quest: true }));
    assert.ok(Math.abs(q.price - base * FERRY_QUEST_MUL) <= 25, `${q.price} ≈ ${base} × 0.25`);
    assert.ok(v.routes.filter((r) => r.to !== 'sealhold').every((r) => !r.quest), 'only that hub');
    // the flag and the quest together
    s.profile!.pvp.flag = 'pirate';
    assert.equal(ferryQuote(game, s, 'gravesend', 'sealhold')!.price, ferryPriceFor(base, { pirate: true, quest: true }));
    s.profile!.pvp.flag = 'faction';
    const gold = s.profile!.gold;
    assert.equal(ferryGo(game, s, 'sealhold'), null);
    assert.equal(s.profile!.gold, gold - q.price, 'paid the quarter');
    assert.equal(LF_RU.quest, 'скидка за задание');
  }
});

test('ferry (post 49): the hold rule counts the trade goods only — a hold full of stores sails', () => {
  const { game } = makeGame();
  const s = captain(game, 'Ferry Stores');
  const st = s.ship!.stats;
  s.ship!.cargo = { provisions: Math.floor((st.holdVolume * 0.7) / (GOODS.provisions.volume * st.provisionVolumeMul)), sailcloth: 100, planks: 100 } as NonNullable<typeof s.ship>['cargo'];
  assert.equal(ferryView(game, s, 'gravesend')!.why, null, 'the stores never count');
  s.ship!.cargo = { rum: Math.ceil((st.holdVolume * 0.65) / GOODS.rum.volume) } as NonNullable<typeof s.ship>['cargo'];
  assert.equal(ferryView(game, s, 'gravesend')!.why, FERRY_WORDS.laden);
});

test('«Тихая гавань»: within 1.5 km of a hub no captain attacks another; out of it they may; the sea\'s ships are as ever', () => {
  const { game } = makeGame();
  const A = captain(game, 'Haven A', 'hollowmere'), B = captain(game, 'Haven B', 'hollowmere');
  const hub = game.portById('hollowmere')!;
  assert.notEqual(REGIONS[hub.region].safety, 'safe', 'a contested hub: captains may fight there otherwise');
  assert.equal(HAVEN_R, 1500);
  assert.equal(havenAt(game.world.ports, hub.x + 1000, hub.y), 'hollowmere');
  // by the hub
  seaAt(game, A, hub.x + 600, hub.y);
  seaAt(game, B, hub.x + 900, hub.y);
  assert.ok(inHaven(game, A.ship!.state.x, A.ship!.state.y));
  assert.equal(havenBlocked(game, A.ship!, B.ship!), HAVEN_SAY);
  assert.equal(damageBlocked(game, A.ship!, B.ship!), HAVEN_SAY, 'no fire, no ram, no grapple');
  assert.equal(damageBlocked(game, B.ship!, A.ship!), HAVEN_SAY, 'both ways');
  // one inside, one outside: still not (no sniping into the quiet water)
  seaAt(game, B, hub.x + HAVEN_R + 400, hub.y);
  assert.equal(damageBlocked(game, B.ship!, A.ship!), HAVEN_SAY);
  // both out of it: the colours' own law (both under the pirate flag: fair game)
  seaAt(game, A, hub.x + HAVEN_R + 600, hub.y);
  assert.ok(!inHaven(game, A.ship!.state.x, A.ship!.state.y));
  assert.equal(havenBlocked(game, A.ship!, B.ship!), null);
  assert.equal(damageBlocked(game, A.ship!, B.ship!), null, 'fair game again');
  // a ship of the sea by the hub: not kept off, either way
  const npc = [...game.ships.values()].find((x) => !x.isPlayer && x.ownerId === null && x.accountId === null)!;
  seaAt(game, A, hub.x + 300, hub.y);
  assert.equal(havenBlocked(game, A.ship!, npc), null);
  assert.equal(havenBlocked(game, npc, A.ship!), null);
  assert.equal(SERVER_RU_PASSAGE[HAVEN_SAY], 'Тихая гавань: у порта-узла капитаны друг на друга не нападают.');
});

test('«Под защитой гавани»: a captain who came by ferry keeps the peace 3 minutes after leaving the ring, then is the sea\'s again', () => {
  const { game } = makeGame();
  const s = captain(game, 'Ferry Ward');
  assert.equal(ferryGo(game, s, 'hollowmere'), null);
  const ship = s.ship!;
  assert.ok(warded(game, ship), 'warded from the passage on');
  const ward = () => ship.effects.find((e) => e.id === HAVEN_WARD_FX)!;
  assert.ok(ward(), 'an effect in her row');
  assert.equal(FX_RU['n.haven'], 'Под защитой гавани');
  finishVoyage(game, ship);
  // out of the ring: the clock runs from there
  const hub = game.portById('hollowmere')!;
  const H = captain(game, 'Ferry Hunter', 'hollowmere');
  seaAt(game, s, hub.x + HAVEN_R + 2000, hub.y);
  seaAt(game, H, hub.x + HAVEN_R + 2300, hub.y);
  for (let i = 0; i < 2 * TICK_RATE; i++) game.step();
  assert.ok(warded(game, ship), 'still warded out of the ring');
  const left = ward().until - game.now;
  assert.ok(left > HAVEN_WARD_SEC - 5 && left <= HAVEN_WARD_SEC, `about three minutes left: ${left}`);
  for (let i = 0; i < 3 * TICK_RATE; i++) game.step();
  assert.ok(ward().until - game.now < left - 2, 'the clock runs out of the ring');
  assert.equal(damageBlocked(game, H.ship!, ship), HAVEN_SAY, 'nobody attacks her');
  assert.equal(damageBlocked(game, ship, H.ship!), HAVEN_SAY, 'nor she anybody');
  // its time out: fair game again
  ward().until = game.now - 0.1;
  for (let i = 0; i < 2 * TICK_RATE; i++) game.step();
  assert.ok(!warded(game, ship));
  assert.equal(havenBlocked(game, H.ship!, ship), null);
});
