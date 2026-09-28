// The sea's holidays (docs/12 P10 #18): every weekend one of four by turns; the drowned's cursed gifts; the Herring
// Run's tournament and its prizes by letter; Powder Night's kegs burst by gunfire; League Day's prices and seal; the
// pet sellers' fair; each holiday's flag won only while it lasts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, FAIR_PRICE, HOLIDAYS, HOLIDAY_IDS, KEGS_PER_PORT, TOURNAMENT_PRIZES, holidayAt, holidayPatterns, nextHoliday } from '../shared/src/data/holidays.ts';
import type { HolidayId } from '../shared/src/data/holidays.ts';
import { PETS, PET_IDS } from '../shared/src/data/companions.ts';
import type { Game } from '../server/src/game/Game.ts';
import { currentHoliday, holidayCatch, holidayGhostSunk, holidaySale, kegImpact, leagueDayMods, petOffers, stepHolidays } from '../server/src/game/holidays.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function force(game: Game, id: HolidayId): void {
  game.db.setKv('holiday_force', { id, until: game.wallNow() + 2 * 3600_000 });
}

function captain(game: Game, name: string): { s: PlayerSession; c: ReturnType<typeof join> } {
  const c = join(game, name);
  return { s: game.sessionByName(name)!, c };
}

test('the calendar: Saturday and Sunday are a holiday, the four by turns; weekdays none', () => {
  const sat = 2 * DAY_MS; // 1970-01-03 was a Saturday
  const seen = new Set<string>();
  for (let w = 0; w < 8; w++) {
    const t = sat + w * 7 * DAY_MS + 3600_000;
    const h = holidayAt(t)!;
    assert.ok(h, `week ${w}`);
    assert.equal(holidayAt(t + DAY_MS)!.id, h.id, 'Sunday too');
    assert.equal(holidayAt(t + 2 * DAY_MS), null, 'Monday is not');
    assert.equal(h.end - h.start, 2 * DAY_MS);
    seen.add(h.id);
  }
  assert.equal(seen.size, HOLIDAY_IDS.length);
  const n = nextHoliday(sat + 3 * DAY_MS);
  assert.equal(n.start, sat + 7 * DAY_MS);
});

test('the Night of the Drowned: a ghost’s gift is a fine piece and a little curse, and the holiday’s flag', () => {
  const { game } = makeGame();
  force(game, 'drowned_night');
  const { s } = captain(game, 'Gift Gale');
  const p = s.profile!;
  const n0 = p.stash.length, c0 = p.curse ?? 0;
  const ghost = game.spawnNpcShip('ghost', 'brig', 'choir', 1000, 1000, 0);
  holidayGhostSunk(game, s, ghost);
  assert.equal(p.stash.length, n0 + 1);
  assert.ok(p.stash.at(-1)!.rarity >= 3);
  assert.equal(p.curse, c0 + 6);
  assert.ok(p.unlocks!.includes(`emblem:${HOLIDAYS.drowned_night.flag}`));
  // Not on another holiday.
  force(game, 'league_day');
  holidayGhostSunk(game, s, game.spawnNpcShip('ghost', 'brig', 'choir', 1000, 1000, 0));
  assert.equal(p.stash.length, n0 + 1);
});

test('the Herring Run: the catch’s weight to the tournament, the flag at 60 kg, the prizes by letter when it ends', () => {
  const { game } = makeGame();
  const t0 = game.wallNow();
  force(game, 'herring_run');
  stepHolidays(game);
  const { s: a } = captain(game, 'Angler Ann');
  const { s: b } = captain(game, 'Angler Bo');
  holidayCatch(game, a, 45);
  holidayCatch(game, b, 20);
  assert.ok(!a.profile!.unlocks?.includes('emblem:61'));
  holidayCatch(game, a, 20);
  assert.ok(a.profile!.unlocks!.includes('emblem:61'), '60 kg: the flag');
  // The holiday ends: the first two have their prizes by letter.
  game.wallNow = () => t0 + 3 * 3600_000;
  stepHolidays(game);
  const mail = (id: number) => game.db.getKv<{ letters: { gold: number }[] }>(`mail:${id}`)?.letters ?? [];
  assert.ok(mail(a.accountId).some((l) => l.gold === TOURNAMENT_PRIZES[0]), 'first: the first prize');
  assert.ok(mail(b.accountId).some((l) => l.gold === TOURNAMENT_PRIZES[1]), 'second: the second');
});

test('Powder Night: kegs off a harbour a captain is near; a ball falling on one bursts it; five for the flag', () => {
  const { game } = makeGame();
  force(game, 'powder_night');
  const { s, c } = captain(game, 'Gunner Gus');
  const port = game.portById(s.ship!.docked!)!;
  s.ship!.docked = null;
  s.ship!.state.x = port.x + 300;
  s.ship!.state.y = port.y;
  const kegs = () => (c.last('holiday') as { view: { kegs: [number, number][] } }).view.kegs;
  for (let k = 0; k < 5; k++) {
    stepHolidays(game);
    const near = kegs();
    assert.ok(near.length >= KEGS_PER_PORT, 'the kegs lie off the harbour');
    kegImpact(game, near[0][0] + 5, near[0][1], s.ship!.id);
  }
  assert.ok(c.all('toast').some((t) => t.msg === 'A keg bursts! (5 this holiday)'));
  assert.ok(s.profile!.unlocks!.includes(`emblem:${HOLIDAYS.powder_night.flag}`));
  const before = c.all('toast').length;
  kegImpact(game, 0, 0, s.ship!.id);
  assert.equal(c.all('toast').length, before, 'a ball in open water bursts nothing');
});

test('League Day: kinder prices in League ports and the seal for 3 000 of sales; the fair: all four pets at half price', () => {
  const { game } = makeGame();
  game.wallNow = () => (7 * 3000 + 5) * DAY_MS + 3600_000; // a Tuesday: no holiday by the calendar
  const league = game.world.ports.find((p) => p.faction === 'league')!;
  const crown = game.world.ports.find((p) => p.faction === 'crown')!;
  assert.equal(leagueDayMods(game, league), null, 'not on a weekday by force');
  force(game, 'league_day');
  assert.deepEqual(leagueDayMods(game, league), { buy: 0.9, sell: 1.06 });
  assert.equal(leagueDayMods(game, crown), null);
  const { s } = captain(game, 'Trader Tia');
  holidaySale(game, s, crown, 'spices', 100);
  assert.ok(!s.profile!.unlocks?.includes('emblem:63'), 'a Crown port is not the League’s');
  holidaySale(game, s, league, 'spices', 100);
  assert.ok(s.profile!.unlocks!.includes('emblem:63'));
  const fair = petOffers(game, league.id);
  assert.equal(fair.length, PET_IDS.length);
  for (const o of fair) assert.equal(o.price, Math.round(PETS[o.pet].price * FAIR_PRICE));
});

test('the holidays read in Russian', () => {
  setLang('ru');
  const t = (x: string) => serverText(x).replace(/\u00a0/g, ' ');
  assert.equal(t('A keg bursts! (3 this holiday)'), 'Бочка взорвалась! (за праздник: 3)');
  assert.equal(t(`WORLD: The holiday begins: Powder Night. ${HOLIDAYS.powder_night.text[0]}`).startsWith('Вести: Начинается праздник: Пороховая ночь.'), true);
  for (const [en, ru] of holidayPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
