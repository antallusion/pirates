// Forum, the tester Эдуард, posts 70–72 (2026-11-04):
//  70a. A privateer patent never wipes her service: a Commodore of the Crown buys the League's patent (an ally) and
//       keeps her rank, merit, title and pay; a patent of her service's ENEMY is sold only after a plain warning
//       (`confirm`), and only then she leaves the service. `/service name flag rank` puts a lost rank back.
//  71.  The ferry never carries her into a hub whose port is closed to her (her patent's enemy, her standing): marked
//       «closed» with why, the passage refused, nothing paid, no cooldown.
//  70b. A berthed ship lies in her own port: changed into only there; «Перегнать сюда» sails her round for the ferry's
//       price by the distance, a minute per 2 km (ten at least).
//  72.  The men over a smaller hull's hammocks are never paid off: they stay aboard the ship left at the berth (and come
//       back when she is changed into), or — a hull traded in — wait ashore in that port 7 days, rehired free.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASHORE_MS, BERTH_MOVE_MIN_MS, berthMoveQuote } from '../shared/src/data/berths.ts';
import { FERRY_HUBS, ferryPrice } from '../shared/src/data/ferry.ts';
import { RANK_MERIT, RANK_PAY, serviceTitle } from '../shared/src/data/marque.ts';
import { PATENT_SAY, patentClash } from '../shared/src/data/patent.ts';
import { PENNANT_SECONDS } from '../shared/src/data/colours.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { coloursSecond, setColours } from '../server/src/game/colours.ts';
import { FERRY_WORDS, ferryGo, ferryView } from '../server/src/game/ferry.ts';
import { adminService, enlist, serviceOnDock, stepService } from '../server/src/game/marque.ts';
import { buyPatent, patentOfferView } from '../server/src/game/patent.ts';
import { berthFit, settleBerths } from '../server/src/game/shipbuilding.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import type { FakeConn } from './helpers.ts';
import { berthArrives, join, knowHulls, makeGame } from './helpers.ts';

function captain(name: string, at = 'gravesend'): { game: Game; s: PlayerSession; c: FakeConn } {
  const { game } = makeGame();
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  p.level = 40;
  p.gold = 1_000_000;
  p.pvp.flag = 'faction';
  p.pvp.played = PENNANT_SECONDS + 1;
  p.reputation.crown = 60;
  p.reputation.league = 40;
  knowHulls(p);
  for (const id of FERRY_HUBS) if (!p.regionsSeen.includes(`visited:${id}`)) p.regionsSeen.push(`visited:${id}`);
  dockAt(game, s, at);
  s.ship!.cargo = {} as NonNullable<typeof s.ship>['cargo'];
  return { game, s, c };
}

function dockAt(game: Game, s: PlayerSession, id: string): void {
  const port = game.portById(id)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.profile!.lastPort = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  game.grid.upsert(s.ship!.id, port.x, port.y);
}

/** Her city's colours of the port she lies in, up at once. */
function hoist(game: Game, s: PlayerSession): void {
  assert.equal(setColours(game, s, 'faction'), null);
  s.profile!.pvp.nextAt = 0;
  coloursSecond(game, s);
}

/** A Commodore of the Crown (the tester's case). */
function commodore(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  dockAt(game, s, 'gravesend');
  hoist(game, s);
  assert.equal(enlist(game, s, game.portById('gravesend')!), null);
  p.service!.merit = RANK_MERIT[4];
  p.service!.rank = 4;
}

/** The wall clock moved on by `ms` while `fn` runs. */
function later<T>(game: Game, ms: number, fn: () => T): T {
  const wall = game.wallNow;
  const t = wall() + ms;
  game.wallNow = () => t;
  try {
    return fn();
  } finally {
    game.wallNow = wall;
  }
}

const men = (a: readonly { n: number }[] | undefined) => (a ?? []).reduce((k, x) => k + x.n, 0);
/** Her berths as her screen last had them (a self message carries them only when they changed). */
const berthsSeen = (c: FakeConn) => c.all('self').reverse().find((m) => m.self?.berths)?.self?.berths;
/** Russian as the screen sets it (no-break spaces after the short words). */
const ru = (en: string) => serverText(en).replace(/ /g, ' ');

// ------------------------------------------------------------------------------------------------ 70a. the patent

test('post 70: a Commodore of the Crown buys the League’s patent (an ally) and keeps her rank, merit, title and pay', () => {
  const { game, s } = captain('Eduard Crown');
  const p = s.profile!;
  commodore(game, s);
  const titles = [...p.titles];
  assert.ok(titles.some((t) => t.endsWith('of the Crown')), 'her service title');
  // to Hollowmere, the League's capital: its colours, its patent
  dockAt(game, s, 'hollowmere');
  hoist(game, s);
  assert.equal(p.pvp.city, 'league');
  const offer = patentOfferView(game, s)!;
  assert.deepEqual(offer.service, { id: 'crown', rank: 4, keeps: true }, 'the card says the service stays');
  assert.equal(buyPatent(game, s), null, 'no question asked: the League is the Crown’s ally');
  assert.equal(p.pvp.patent?.by, 'league');
  for (let i = 0; i < 5; i++) stepService(game);
  assert.equal(p.service?.id, 'crown');
  assert.equal(p.service?.rank, 4, 'still a Commodore');
  assert.equal(p.service?.merit, RANK_MERIT[4]);
  assert.deepEqual(p.titles, titles, 'the titles kept');
  // the pay is drawn at a Crown port, under the League's patent
  p.service!.payDay = -1;
  const gold = p.gold;
  dockAt(game, s, 'gravesend');
  serviceOnDock(game, s, game.portById('gravesend')!);
  assert.equal(p.gold - gold, RANK_PAY[4], 'the Commodore’s pay');
  assert.equal(p.pvp.patent?.by, 'league', 'and the patent runs on');
});

test('post 70: a patent of her service’s enemy only after the warning — then, and only then, the service ends', () => {
  assert.equal(patentClash('crown', 'league'), false);
  assert.equal(patentClash('crown', 'harpoon'), false);
  assert.equal(patentClash('league', 'crown'), false);
  assert.equal(patentClash('confederacy', 'crown'), true);
  assert.equal(patentClash('confederacy', 'league'), true);
  const { game, s } = captain('Brethren Bo');
  const p = s.profile!;
  // a lieutenant of the Brethren under the Crown's colours in Gravesend
  p.service = { id: 'confederacy', merit: RANK_MERIT[1], rank: 1, payDay: -1, order: null, bought: [] };
  hoist(game, s);
  const offer = patentOfferView(game, s)!;
  assert.deepEqual(offer.service, { id: 'confederacy', rank: 1, keeps: false });
  const gold = p.gold;
  assert.equal(buyPatent(game, s), PATENT_SAY.clash, 'refused without her yes');
  assert.equal(p.gold, gold, 'nothing paid');
  assert.equal(p.service?.rank, 1, 'nothing lost');
  assert.equal(p.pvp.patent ?? null, null);
  assert.equal(buyPatent(game, s, true), null, 'bought on her yes');
  assert.equal(p.pvp.patent?.by, 'crown');
  assert.equal(p.service ?? null, null, 'and then the service ends');
  assert.ok(!(p.serviceBan && p.serviceBan > game.wallNow()), 'no ban for it');
  setLang('ru');
  assert.equal(serverText(PATENT_SAY.clash), 'Это патент врага вашей службы: купив его, вы уйдёте со службы. Сначала подтвердите.');
  setLang('en');
});

test('post 70: /service puts a rank back — at once aboard, or when she next comes aboard', () => {
  const { game, s } = captain('Eduard');
  const p = s.profile!;
  assert.match(adminService(game, ['Eduard', 'crown', '4']), /Commodore of the Crown/);
  assert.equal(p.service?.id, 'crown');
  assert.equal(p.service?.rank, 4);
  assert.ok(p.service!.merit >= RANK_MERIT[4]);
  assert.ok(p.titles.includes(serviceTitle('crown', 4)));
  // a captain ashore: queued, put on as she comes aboard, once
  p.service = null;
  assert.match(adminService(game, ['Somebody Else', 'league', '2']), /not aboard/);
  const c2 = join(game, 'Somebody Else');
  void c2;
  stepService(game);
  const q = game.sessionByName('Somebody Else')!.profile!;
  assert.equal(q.service?.id, 'league');
  assert.equal(q.service?.rank, 2);
  q.service!.rank = 0;
  stepService(game);
  assert.equal(q.service?.rank, 0, 'once only');
});

// ------------------------------------------------------------------------------------------------ 71. the ferry

test('post 71: with the League’s patent the ferry list marks the Brokers’ Fogmouth closed and refuses it; nothing paid', () => {
  const { game, s, c } = captain('Ferry Eduard');
  const p = s.profile!;
  // plain Crown colours: every hub open
  hoist(game, s);
  assert.ok(!ferryView(game, s, 'gravesend')!.routes.some((r) => r.closed), 'no patent: nothing closed');
  // the League's patent (bought at Hollowmere), back in Gravesend
  dockAt(game, s, 'hollowmere');
  hoist(game, s);
  assert.equal(buyPatent(game, s), null);
  dockAt(game, s, 'gravesend');
  const view = ferryView(game, s, 'gravesend')!;
  const fog = view.routes.find((r) => r.to === 'fogmouth')!;
  assert.equal(fog.closed, PATENT_SAY.enemyPort, 'closed, with why');
  assert.ok(!view.routes.find((r) => r.to === 'frostgate')!.closed, 'the Harpoon’s port is open to a League privateer');
  const gold = p.gold;
  assert.equal(ferryGo(game, s, 'fogmouth'), FERRY_WORDS.closed);
  assert.equal(p.gold, gold, 'nothing paid');
  assert.ok(!p.ferryAt, 'no cooldown');
  assert.equal(s.ship!.docked, 'gravesend', 'still in port');
  assert.ok(c.inbox.some((m) => m.t === 'toast' && m.msg === PATENT_SAY.enemyPort), 'the harbour master’s reason said');
  // the closed hubs go to the end of the list
  const open = view.routes.filter((r) => !r.locked && !r.closed).length;
  assert.ok(view.routes.slice(open).every((r) => r.closed || r.locked));
  setLang('ru');
  assert.match(ru(FERRY_WORDS.closed), /^Порт назначения закрыт для вас — вы оказались бы в море без гавани/);
  setLang('en');
});

// ------------------------------------------------------------------------------------------------ 70b. the berths

test('post 70: a berthed ship lies in her own port — changed into only there; «Перегнать сюда» for the ferry’s price, a minute per 2 km', () => {
  const { game, s, c } = captain('Berth Eduard');
  const p = s.profile!;
  const ship = s.ship!;
  ship.crew = 10;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'cutter', keep: true });
  assert.equal(p.berths[0].port, 'gravesend');
  const fast = ship.loadout.classId;
  // far away, at another yard
  const far = game.portById('frostgate')!;
  dockAt(game, s, far.id);
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.match(c.last('toast')!.msg, /lies at Port Gravesend: change into her there/);
  assert.equal(ship.loadout.classId, fast, 'no ship from the other end of the sea');
  assert.equal(p.berthCall ?? null, null, 'nothing sent for');
  // the delivery: the ferry's price by the straight distance, a minute per 2 km (ten at least)
  const g = game.portById('gravesend')!;
  const d = Math.hypot(g.x - far.x, g.y - far.y);
  const q = berthMoveQuote(d);
  assert.equal(q.price, ferryPrice(d));
  assert.equal(q.ms, Math.max(BERTH_MOVE_MIN_MS, Math.round((d / 1000) * 30_000)));
  assert.equal(berthMoveQuote(500).ms, BERTH_MOVE_MIN_MS, 'ten minutes at least');
  const gold = p.gold;
  c.push({ t: 'berth', action: 'move', index: 0 });
  assert.equal(p.gold, gold - q.price, 'paid');
  assert.equal(p.berths[0].move?.to, far.id);
  assert.ok(Math.abs(p.berths[0].move!.at - (game.wallNow() + q.ms)) < 1000);
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.match(c.last('toast')!.msg, /is on her way to Frostgate/, 'not before she comes');
  c.push({ t: 'berth', action: 'move', index: 0 });
  assert.match(c.last('toast')!.msg, /already on her way/);
  assert.equal(p.gold, gold - q.price, 'paid once');
  // her card says where she is going
  game.pushSelf(s, true);
  assert.equal(berthsSeen(c)?.[0]?.move?.to, far.id);
  // she comes in
  later(game, q.ms + 1000, () => settleBerths(game, p, s));
  assert.equal(p.berths[0].port, far.id);
  assert.equal(p.berths[0].move ?? null, null);
  c.push({ t: 'berth', action: 'swap', index: 0 });
  berthArrives(game, s);
  assert.equal(ship.loadout.classId, 'sloop', 'changed into her here now');
  assert.equal(p.berths[0].port, far.id, 'the old ship lies here');
  // a berth of an older save naming no harbour: her last port with a yard
  p.berths.push({ port: 'nowhere', loadout: { ...p.berths[0].loadout, name: 'Lost Lass' }, hull: 1 });
  settleBerths(game, p);
  assert.equal(p.berths[1].port, far.id);
  // too poor: refused, nothing moves
  dockAt(game, s, 'gravesend');
  p.gold = 10;
  c.push({ t: 'berth', action: 'move', index: 0 });
  assert.equal(p.berths[0].move ?? null, null);
  assert.equal(p.gold, 10);
});

// ------------------------------------------------------------------------------------------------ 72. the crew

test('post 72: into a smaller berthed hull the extra men stay aboard the ship she leaves — and come back with her', () => {
  const { game, s, c } = captain('Crew Eduard');
  const p = s.profile!;
  const ship = s.ship!;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'brig', keep: true });
  assert.equal(ship.loadout.classId, 'brig');
  ship.crew = ship.stats.crewMax;
  const big = ship.crew;
  const small = berthFit(s, p.berths[0].loadout).crewMax;
  assert.ok(big > small, 'the brig sleeps more');
  c.push({ t: 'berth', action: 'swap', index: 0 });
  const ask = c.last('berth_ask')!;
  assert.equal(ask.men, big - small);
  assert.equal(ask.stay, ship.loadout.name, 'the dialog says: they stay aboard her');
  assert.equal(ask.ashore, undefined);
  c.push({ ...ask.again, force: true });
  berthArrives(game, s);
  assert.equal(ship.loadout.classId, 'sloop');
  assert.equal(ship.crew, small);
  assert.equal(p.berths[0].loadout.classId, 'brig');
  assert.equal(men(p.berths[0].army), big - small, 'nobody paid off');
  game.pushSelf(s, true);
  assert.equal(berthsSeen(c)?.[0]?.crew, big - small, 'the card shows them aboard');
  // back into the brig: every man aboard again
  c.push({ t: 'berth', action: 'swap', index: 0 });
  berthArrives(game, s);
  assert.equal(ship.loadout.classId, 'brig');
  assert.equal(ship.crew, big, 'they came back');
  assert.equal(men(p.berths[0].army), 0);
});

test('post 72: a hull traded in with more men than the new one sleeps — they wait ashore 7 days and sign on again free', () => {
  const { game, s, c } = captain('Ashore Eduard');
  const p = s.profile!;
  const ship = s.ship!;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'brig', keep: true });
  ship.crew = ship.stats.crewMax;
  const big = ship.crew;
  p.berths.length = 0;
  c.inbox.length = 0;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'cutter' }); // traded in
  const ask = c.last('berth_ask')!;
  assert.ok(ask, 'asked first');
  assert.deepEqual(ask.ashore, { port: 'Port Gravesend', days: 7 }, 'the dialog says: ashore here, seven days');
  c.push({ ...ask.again, force: true });
  assert.equal(ship.loadout.classId, 'cutter');
  const small = ship.stats.crewMax;
  assert.equal(ship.crew, small);
  assert.equal(men(p.ashore?.[0]?.army), big - small, 'ashore, not paid off');
  game.pushPort(s);
  assert.equal(c.last('port')?.view?.tavern.ashore?.n, big - small, 'the tavern shows them');
  // room aboard: some come back free, the rest wait
  ship.crew = small - 5;
  const gold = p.gold;
  c.push({ t: 'crew_ashore' });
  assert.equal(ship.crew, small);
  assert.equal(p.gold, gold, 'free');
  assert.equal(men(p.ashore?.[0]?.army), big - small - 5);
  c.push({ t: 'crew_ashore' });
  assert.match(c.last('toast')!.msg, /No hammocks free aboard/);
  // in another port they are not here
  dockAt(game, s, 'hollowmere');
  game.pushPort(s);
  assert.equal(c.last('port')?.view?.tavern.ashore, undefined);
  // seven days on, gone
  dockAt(game, s, 'gravesend');
  later(game, ASHORE_MS + 1000, () => game.pushPort(s));
  assert.equal(c.last('port')?.view?.tavern.ashore, undefined);
});

test('posts 70–72 read in Russian', () => {
  setLang('ru');
  assert.match(ru('The Sea Lark lies at Port Gravesend: change into her there, or have her brought here.'), /^«Sea Lark» стоит в порту .+: пересесть можно только там — или перегоните его сюда\.$/);
  assert.match(ru('12 men stay aboard the Sea Lark at the berth: they come back aboard when you change into her again.'), /^12 чел\. остались на борту «Sea Lark» у причала/);
  assert.match(ru('5 of your men come back aboard.'), /На борт вернулись ваши люди: 5 чел\./);
  assert.match(ru('The Admiralty restores your rank: Commodore of the Crown.'), /^Звание на службе восстановлено: /);
  setLang('en');
});
