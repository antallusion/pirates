// The wanted (docs/12 P5): seventy-odd named pirates and seven barons, the same on every world; a named captain
// puts to sea in her waters with two lieutenants; sunk, her head pays and the Hunters' Guild counts her, and she is
// back under a new flag half a day later; three of a sea's captains bring its baron; the informant's minute; the
// lair's battery and the storming of the lair; the guild's ranks; the trail of a wanted captain for a licensed
// hunter; the false bulwark's first broadside.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARON_AFTER, HUNTER_PENNANT, HUNTER_RANKS, HUNTER_TITLE, PIRATE_SEAS, bountyFor, hunterRank, namedPirates, piratePatterns, pirateById } from '../shared/src/data/pirates.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { clearWanted, lairImpact, lairLanding, lairOf, liveNamed, namedRecord, payInformant, putToSea, stepWanted, wantedBoard, wantedView } from '../server/src/game/wanted.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function hunter(game: Game, name: string, region: RegionId, cls = 'brig', level = 6): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, cls, level);
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 400; k++) {
    const x = cx + ((k * 7919) % 16000) - 8000, y = cy + ((k * 104729) % 16000) - 8000;
    if (regionAt(game.world, x, y) !== region || isLand(game.world, x, y)) continue;
    let clear = true;
    for (let a = 0; a < 8 && clear; a++) if (isLand(game.world, x + Math.cos(a) * 1500, y + Math.sin(a) * 1500)) clear = false;
    if (!clear) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

function sink(game: Game, victim: ShipEntity, by: ShipEntity): void {
  victim.attackers.set(by.id, game.now);
  victim.hull = 0;
  game.beginSinking(victim);
}

test('the roster: ten captains and a baron in each of seven seas, named in both tongues, levelled to their waters', () => {
  const all = namedPirates();
  assert.equal(all.length, PIRATE_SEAS.length * 11);
  assert.equal(new Set(all.map((p) => p.name[0])).size, all.length, 'every name its own');
  for (const p of all) {
    assert.ok(/[а-яё]/i.test(p.name[1]) && /[а-яё]/i.test(p.ship[1]));
    assert.ok(p.level >= 1 && p.level <= 10);
    assert.equal(p.lieutenants.length, p.baron ? 3 : 2);
    assert.equal(p.bounty, bountyFor(p.level, p.baron));
  }
  const safe = all.filter((p) => REGIONS[p.region].safety === 'safe' && !p.baron);
  assert.ok(safe.every((p) => p.level <= 3), 'the Black Coast keeps small fry');
  assert.equal(all.filter((p) => p.baron).length, 7);
  assert.equal(hunterRank(0), 0);
  assert.equal(hunterRank(HUNTER_RANKS[5]), 5);
  assert.equal(hunterRank(99999), 10);
});

test('a named captain puts to sea with her lieutenants; sunk, her head pays, the guild counts her, she comes back later', () => {
  const { game } = makeGame();
  const { c, s, ship } = hunter(game, 'Head Hunter', 'gravewater');
  const np = namedPirates().find((p) => p.region === 'gravewater' && !p.baron)!;
  const her = putToSea(game, np, ship)!;
  assert.ok(her, 'she sails');
  assert.equal(her.named, np.id);
  assert.equal(her.shipLevel, np.level);
  assert.equal(her.captainName, np.name[0]);
  const live = liveNamed(game).find((l) => l.id === np.id)!;
  assert.equal(live.lts.length, 2);
  assert.ok(her.info().named === np.id);
  const gold0 = s.profile!.gold;
  sink(game, her, ship);
  assert.equal(s.profile!.gold - gold0, np.bounty, 'the bounty');
  assert.equal(s.profile!.hunter!.captains, 1);
  assert.equal(s.profile!.hunter!.points, 10);
  assert.ok(c.all('toast').some((t) => t.msg === `The bounty on ${np.name[0]}: ${np.bounty} silver.`));
  const rec = namedRecord(game, np.id)!;
  const hours = (rec.respawnAt! - game.wallNow()) / 3_600_000;
  assert.ok(hours >= 12 && hours <= 24, `back in ${hours} h`);
  // A lieutenant pays a little.
  const mate = game.ships.get(live.lts[0])!;
  const g1 = s.profile!.gold;
  sink(game, mate, ship);
  assert.ok(s.profile!.gold > g1);
  assert.equal(s.profile!.hunter!.points, 13);
  // The board shows her sunk, and when she was last seen.
  const port = game.world.ports.find((p) => p.region === 'gravewater')!;
  const board = wantedBoard(game, s.profile!, port);
  const poster = board.find((b) => b.id === np.id)!;
  assert.ok(poster.down);
  assert.ok(poster.seen && poster.seen.ago <= 1);
  assert.ok(!board.some((b) => b.baron), 'the baron is not on the board yet');
});

test('three captains of a sea bring its baron, who comes for the hunter; his fall pays a fortune and the Terror of the Seas', () => {
  const { game } = makeGame();
  const { c, s, ship } = hunter(game, 'Baron Breaker', 'ashen_isles', 'frigate', 8);
  const caps = namedPirates().filter((p) => p.region === 'ashen_isles' && !p.baron).slice(0, BARON_AFTER);
  for (const np of caps) {
    const her = putToSea(game, np, ship)!;
    sink(game, her, ship);
  }
  const baron = namedPirates().find((p) => p.region === 'ashen_isles' && p.baron)!;
  assert.ok(c.all('toast').some((t) => t.msg.startsWith(`Three of his captains are sunk: ${baron.name[0]}`)));
  const port = game.world.ports.find((p) => p.region === 'ashen_isles')!;
  assert.ok(wantedBoard(game, s.profile!, port).some((b) => b.baron), 'the baron on the board now');
  clearWanted(game);
  game.directorOn = true;
  for (let i = 0; i < 400 && !liveNamed(game).some((l) => l.id === baron.id); i++) {
    game.now += 1;
    stepWanted(game);
  }
  const live = liveNamed(game).find((l) => l.id === baron.id);
  assert.ok(live, 'the baron puts to sea for the hunter');
  const b = game.ships.get(live!.ship)!;
  assert.ok(b.elite);
  assert.equal(live!.lts.length, 3);
  const stash0 = s.profile!.stash.length;
  sink(game, b, ship);
  assert.ok(c.all('toast').some((t) => t.msg === `WORLD: Baron Breaker sank ${baron.name[0]}, baron of the Brethren in ${REGIONS.ashen_isles.name}!`));
  const got = s.profile!.stash.slice(stash0);
  assert.ok(got.some((it) => it.set === 'sea_terror' || it.legendary), 'a piece of the Terror of the Seas');
  const days = (namedRecord(game, baron.id)!.respawnAt! - game.wallNow()) / 86_400_000;
  assert.ok(days >= 6.9, 'a week');
});

test('the informant sells her place for a minute; the licensed hunter sees the trail of a wanted captain', () => {
  const { game } = makeGame();
  const { s, ship } = hunter(game, 'Paying Pip', 'whispering');
  const np = namedPirates().find((p) => p.region === 'whispering' && !p.baron)!;
  const her = putToSea(game, np, ship)!;
  const port = game.world.ports.find((p) => p.region === 'whispering')!;
  s.profile!.gold = 10000;
  assert.equal(payInformant(game, s, port, np.id), null);
  const v = wantedView(game, s);
  assert.equal(v.informed?.id, np.id);
  assert.ok(Math.hypot(v.informed!.x - her.state.x, v.informed!.y - her.state.y) < 5);
  game.now += 61;
  stepWanted(game);
  assert.equal(wantedView(game, s).informed, null, 'a minute');
  // A wanted captain and a hunter with the Crown's licence.
  const { s: rogue } = hunter(game, 'Rogue Rafe', 'whispering');
  rogue.profile!.infamy = 400;
  s.profile!.reputation.crown = 100;
  game.now += 60;
  stepWanted(game);
  const tr = wantedView(game, s).rogues.find((r) => r.name === 'Rogue Rafe');
  assert.ok(tr, 'the circle of the rogue');
  assert.ok(Math.hypot(tr!.x - rogue.ship!.state.x, tr!.y - rogue.ship!.state.y) <= 3000);
  assert.equal(wantedView(game, rogue).rogues.length, 0, 'no licence, no trail');
});

test('the lair: its battery fires on ships near and drives boats off; silenced from the sea, the lair is stormed', () => {
  const { game } = makeGame();
  const np = namedPirates().find((p) => p.region === 'dead_mans_expanse' && !p.baron && lairOf(game, p.id))!;
  const lair = lairOf(game, np.id)!;
  assert.ok(lair, 'a lair on an island of her sea');
  const { c, s, ship } = hunter(game, 'Lair Stormer', 'dead_mans_expanse', 'frigate', 8);
  ship.state.x = lair.x + 300;
  ship.state.y = lair.y;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const hull0 = ship.hull;
  for (let i = 0; i < 12; i++) {
    game.now += 1;
    stepWanted(game);
  }
  assert.ok(ship.hull < hull0, 'the battery fires');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('The lair’s battery on')));
  const island = game.world.islands[lair.island];
  const crew0 = ship.crew;
  assert.equal(lairLanding(game, s, island), true);
  assert.ok(ship.crew < crew0, 'the boats driven off');
  // Silence it.
  for (let i = 0; i < 400; i++) lairImpact(game, lair.x + 20, lair.y, 100, ship.id);
  assert.ok(c.all('toast').some((t) => t.msg.includes('is silenced')));
  const gold0 = s.profile!.gold;
  ship.crew = 20;
  assert.equal(lairLanding(game, s, island), true);
  assert.ok(s.profile!.gold > gold0 + 1000, 'the chest');
  assert.ok(ship.crew > 20, 'the prisoners join');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith(`The lair of ${np.name[0]} is stormed`)));
});

test('the Hunters’ Guild: rank five pays more, seven gives the pennant, ten the title; ten captains make the deed', () => {
  const { game } = makeGame();
  const { s, ship } = hunter(game, 'Guild Gwen', 'drowned_crown', 'frigate', 9);
  s.profile!.hunter = { points: HUNTER_RANKS[5], captains: 0, seas: {} };
  const np = namedPirates().find((p) => p.region === 'drowned_crown' && !p.baron)!;
  const g0 = s.profile!.gold;
  sink(game, putToSea(game, np, ship)!, ship);
  assert.equal(s.profile!.gold - g0, Math.round(np.bounty * 1.15));
  s.profile!.hunter!.points = HUNTER_RANKS[7] - 1;
  s.profile!.hunter!.captains = 9;
  const np2 = namedPirates().filter((p) => p.region === 'drowned_crown' && !p.baron)[1];
  sink(game, putToSea(game, np2, ship)!, ship);
  assert.ok(s.profile!.pennants.includes(HUNTER_PENNANT));
  assert.ok(s.profile!.deeds.includes('deed_captain_killer'));
  s.profile!.hunter!.points = HUNTER_RANKS[10] - 1;
  const np3 = namedPirates().filter((p) => p.region === 'drowned_crown' && !p.baron)[2];
  sink(game, putToSea(game, np3, ship)!, ship);
  assert.ok(s.profile!.titles.includes(HUNTER_TITLE));
});

test('the hunt of the wanted reads in Russian', () => {
  setLang('ru');
  const np = pirateById('np_1_3')!;
  assert.equal(serverText(np.name[0]), np.name[1]);
  assert.match(serverText(`The bounty on ${np.name[0]}: 1480 silver.`), /Награда за голову/);
  assert.equal(serverText(HUNTER_TITLE), 'Гроза Берегового братства');
  for (const [en, ru] of piratePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
