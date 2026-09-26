import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/src/auth.ts';
import { BOSSES } from '../shared/src/data/bosses.ts';
import { SEASON_DAYS, SEASON_EPOCH, TRACK_XP } from '../shared/src/data/seasons.ts';
import { seasonal } from '../server/src/game/bosses.ts';
import { Game } from '../server/src/game/Game.ts';
import { closeSeason, seasonId, seasonMods, seasonStat, seasonTheme, shanty } from '../server/src/game/seasons.ts';
import { Database } from '../server/src/persistence/db.ts';
import { join, makeGame, steps } from './helpers.ts';

const DAY = 24 * 3600_000;

function atSeason(game: Game, n: number): { add: (ms: number) => void } {
  let wall = SEASON_EPOCH + n * SEASON_DAYS * DAY + 5 * DAY;
  game.wallNow = () => wall;
  return { add: (ms) => (wall += ms) };
}

test('seasons turn every three months, each with its theme and what it does to the world', () => {
  const { game } = makeGame();
  atSeason(game, 0);
  assert.equal(seasonId(game), 0);
  assert.equal(seasonTheme(game), 'migration');
  assert.equal(seasonMods(game).migration, true);
  const lev = seasonal(game, BOSSES.leviathan);
  assert.equal(lev.every, BOSSES.leviathan.every / 2);
  assert.ok(lev.regions.includes('gravewater'));
  atSeason(game, 2);
  assert.equal(seasonTheme(game), 'storm');
  assert.equal(seasonMods(game).stormMul, 2.5);
  atSeason(game, 3);
  assert.equal(seasonTheme(game), 'dead_tide');
  assert.equal(seasonMods(game).ghostMul, 4);
  assert.equal(seasonMods(game).ghostsEverywhere, true);
});

test('the season path: a tenth of experience walks it; titles and pennants, nothing stronger', () => {
  const { game } = makeGame();
  atSeason(game, 1);
  const c = join(game, 'Path Walker');
  const s = game.sessionByName('Path Walker')!;
  game.grantXp(s, TRACK_XP * 10 * 5 + 10, null);
  assert.equal(s.profile!.season.level, 5);
  assert.ok(s.profile!.titles.some((t) => /Sea-Dog/.test(t)));
  game.grantXp(s, TRACK_XP * 10 * 5, null);
  assert.equal(s.profile!.pennants.length, 1);
  // Wear them: the ship's card carries them.
  c.push({ t: 'season', action: 'title', value: s.profile!.titles[0] });
  c.push({ t: 'season', action: 'pennant', value: s.profile!.pennants[0] });
  assert.equal(s.ship!.info().title, s.profile!.titles[0]);
  assert.equal(s.ship!.info().pennant, s.profile!.pennants[0]);
  c.push({ t: 'season', action: 'title', value: 'Admiral of Everything' });
  assert.match(c.last('toast')!.msg, /not earned/);
  // A new season starts a fresh path; the titles stay.
  atSeason(game, 2);
  game.grantXp(s, 10, null);
  assert.equal(s.profile!.season.id, 2);
  assert.equal(s.profile!.season.level, 0);
  assert.ok(s.profile!.titles.length >= 1);
});

test('the season ends: tables into the book, the top three of each hall into the Pantheon; they may name an island', () => {
  const db = new Database(':memory:');
  const game = new Game({ db, auth: new AuthService(db), log: () => {} });
  const clock = atSeason(game, 1); // the War
  const caps = ['Ada Law', 'Ben Law', 'Cy Law', 'Dee Law'].map((n) => {
    const c = join(game, n);
    return { c, s: game.sessionByName(n)! };
  });
  caps.forEach(({ s }, i) => seasonStat(game, s, 'lawful', 10 * (i + 1)));
  seasonStat(game, caps[0].s, 'plunder', 5);
  seasonStat(game, caps[1].s, 'sunk', 7);
  // The war: Crown ships sunk count for the Confederacy.
  const crownShip = game.spawnNpcShip('patrol', 'brig', 'crown', 30000, 30000, 0);
  for (let i = 0; i < 3; i++) {
    crownShip.attackers.set(caps[0].s.ship!.id, game.now);
    (game as unknown as { creditKill(a: unknown, b: unknown, how: string): void }).creditKill(caps[0].s.ship!, crownShip, 'sunk');
  }
  steps(game, 20 * 61); // the tables are written
  clock.add(SEASON_DAYS * DAY);
  steps(game, 21);
  const pantheon = game.db.getKv<{ name: string; hall: string }[]>('pantheon')!;
  const hall = pantheon.filter((m) => m.hall === 'gravesend').map((m) => m.name).sort();
  assert.deepEqual(hall, ['Ben Law', 'Cy Law', 'Dee Law']);
  assert.ok(pantheon.some((m) => m.hall === 'cinderhold' && m.name === 'Ada Law'));
  const war = game.db.getKv<{ winner: string; season: number }>('war_outcome')!;
  assert.equal(war.winner, 'confederacy');
  assert.equal(seasonMods(game).pirateMul, 1.4, 'the Confederacy won: more pirates this season');
  // The Pantheon's due: a title and the right to name an island.
  const dee = caps[3].s;
  assert.ok(dee.profile!.titles.some((t) => /Admiralty Hall/.test(t)));
  assert.equal(dee.profile!.nameRights, 1);
  const is = game.world.islands.find((i) => !i.portId && i.radius > 300)!;
  caps[3].c.push({ t: 'season', action: 'name', value: 'Deeholm', islandId: is.id });
  assert.match(caps[3].c.last('toast')!.msg, /charted/);
  dee.discovered.add(is.id);
  caps[3].c.push({ t: 'season', action: 'name', value: 'D33', islandId: is.id });
  assert.match(caps[3].c.last('toast')!.msg, /letters/);
  caps[3].c.push({ t: 'season', action: 'name', value: 'Deeholm', islandId: is.id });
  assert.equal(is.name, 'Deeholm');
  assert.equal(dee.profile!.nameRights, 0);
  // The name stays with the world.
  const again = new Game({ db, auth: new AuthService(db), log: () => {} });
  assert.equal(again.world.islands[is.id].name, 'Deeholm');
  // The bard knows them.
  assert.match(String(shanty(game)), /Ben Law/);
});

test('closing a season twice changes nothing', () => {
  const { game } = makeGame();
  atSeason(game, 0);
  const c = join(game, 'Once Only');
  seasonStat(game, game.sessionByName('Once Only')!, 'abyss', 50);
  steps(game, 20 * 61);
  closeSeason(game, 0);
  closeSeason(game, 0);
  assert.equal((game.db.getKv<unknown[]>('pantheon') ?? []).length, 1);
  void c;
});
