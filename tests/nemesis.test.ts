// The nemesis (docs/12 P10 #1): a named pirate who sinks a captain, or gets away from her hurt, remembers her — a
// rank, a scar and a new name from the meeting, a mocking letter, levels above himself when he comes for her, her
// wake found at sea, her caravans fallen on; sunk by her at last, the revenge pays and his head is hers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EPITHETS, NEMESIS_LEVEL_BONUS, NEMESIS_MAX, nemesisName, nemesisPatterns } from '../shared/src/data/nemesis.ts';
import { namedPirates } from '../shared/src/data/pirates.ts';
import type { NamedPirate } from '../shared/src/data/pirates.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { nemesisEscaped, nemesisViews, sanitizeNemeses, stepNemesis } from '../server/src/game/nemesis.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { clearWanted, liveNamed, putToSea, stepWanted, wantedView } from '../server/src/game/wanted.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function captain(game: Game, name: string, region: RegionId): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, 'brig', 6);
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

const pirateOf = (region: RegionId): NamedPirate => namedPirates().find((p) => p.region === region && !p.baron)!;

function sink(game: Game, victim: ShipEntity, by: ShipEntity): void {
  victim.attackers.set(by.id, game.now);
  victim.hull = 0;
  game.beginSinking(victim);
}

test('sunk by a named pirate: he remembers her — a grudge, a new name from the meeting, a letter to mock her', () => {
  const { game } = makeGame();
  clearWanted(game);
  const { c, s, ship } = captain(game, 'Grudge Greta', 'gravewater');
  const np = pirateOf('gravewater');
  const him = putToSea(game, np, ship)!;
  sink(game, ship, him);
  const rec = s.profile!.nemeses![np.id];
  assert.ok(rec, 'a nemesis');
  assert.equal(rec.rank, 1);
  assert.equal(rec.lost, 1);
  assert.ok(rec.epithet.startsWith('sank_you:'));
  assert.ok(c.all('toast').some((t) => t.msg === `${np.name[0]} will remember you: a new nemesis.`));
  const box = game.db.getKv<{ letters: { from: string; body: string }[] }>(`mail:${s.accountId}`)!;
  const l = box.letters.at(-1)!;
  assert.ok(l.from.endsWith(', your nemesis'));
  assert.ok(l.body.includes('Grudge Greta'), 'the letter names her');
  // The name he goes by with her: his surname and the new one.
  const name = nemesisName(np, rec.epithet);
  assert.equal(name[0].split(' ')[0], np.name[0].split(' ')[0]);
  assert.ok(EPITHETS.sank_you.some((e) => name[0].endsWith(e[0])));
});

test('hurt and gone: the captains who hurt him have a grudge — his scar names him; ranks rise to five, three at most', () => {
  const { game } = makeGame();
  clearWanted(game);
  const { s, ship } = captain(game, 'Scarred Sal', 'gravewater');
  const np = pirateOf('gravewater');
  const him = putToSea(game, np, ship)!;
  him.attackers.set(ship.id, game.now);
  him.hull = him.stats.hullMax * 0.5;
  him.scar = 'fire';
  nemesisEscaped(game, np, him);
  const rec = s.profile!.nemeses![np.id];
  assert.ok(rec.epithet.startsWith('fire:'), 'burned: Scorch-Hide and the like');
  for (let i = 0; i < 8; i++) nemesisEscaped(game, np, him);
  assert.equal(rec.rank, 5, 'Doom at most');
  // Barely scratched: no grudge.
  const other = pirateOf('black_coast');
  const h2 = putToSea(game, other, ship);
  if (h2) {
    h2.attackers.set(ship.id, game.now);
    nemesisEscaped(game, other, h2);
    assert.equal(s.profile!.nemeses![other.id], undefined);
  }
  // Three grudges at most: a fourth pushes out the weakest.
  const more = namedPirates().filter((p) => p.region === 'whispering' && !p.baron).slice(0, NEMESIS_MAX);
  for (const p of more) {
    const h = putToSea(game, p, ship);
    if (!h) continue;
    h.attackers.set(ship.id, game.now);
    h.hull = h.stats.hullMax * 0.5;
    nemesisEscaped(game, p, h);
  }
  assert.ok(Object.keys(sanitizeNemeses(s.profile!)).length <= NEMESIS_MAX);
  assert.ok(s.profile!.nemeses![np.id], 'the strongest stays');
});

test('he sails levels above himself when he comes for her, finds her wake, and shows on her chart', () => {
  const { game } = makeGame();
  clearWanted(game);
  const { c, s, ship } = captain(game, 'Hunted Hana', 'gravewater');
  const np = pirateOf('gravewater');
  sanitizeNemeses(s.profile!)[np.id] = { rank: 3, epithet: 'boarding:0', scars: ['boarding'], lost: 1, fled: 1, lastAt: 0, letterAt: 0, huntAt: -1e9 };
  game.directorOn = true;
  for (let i = 0; i < 200 && !liveNamed(game).some((l) => l.id === np.id); i++) {
    game.now += 1;
    stepNemesis(game);
    s.profile!.nemeses![np.id].huntAt = -1e9;
  }
  game.directorOn = false;
  const live = liveNamed(game).find((l) => l.id === np.id);
  assert.ok(live, 'he found her');
  const him = game.ships.get(live.ship)!;
  assert.ok(him.level >= Math.min(np.level + NEMESIS_LEVEL_BONUS[3], 10) - 1, `level ${him.level} for ${np.level}`);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Your nemesis ') && t.msg.endsWith('has found your wake!')));
  // Her chart shows him (a nemesis is seen whatever her Guild rank), and the Guild's view lists him.
  him.state.x = ship.state.x + 1000;
  him.state.y = ship.state.y;
  const v = wantedView(game, s);
  assert.ok(v.sight.some((x) => x.id === np.id));
  assert.equal(v.nemeses[0].id, np.id);
  assert.deepEqual(nemesisViews(s.profile!)[0].scars, ['boarding']);
});

test('revenge: sunk by her at last, he pays by his rank — silver, a fine piece, his head among her trophies', () => {
  const { game } = makeGame();
  clearWanted(game);
  const { c, s, ship } = captain(game, 'Avenging Ava', 'gravewater');
  const p = s.profile!;
  const np = pirateOf('gravewater');
  sanitizeNemeses(p)[np.id] = { rank: 3, epithet: 'cannon:1', scars: ['cannon'], lost: 2, fled: 0, lastAt: 0, letterAt: 0, huntAt: 0 };
  const him = putToSea(game, np, ship)!;
  const gold0 = p.gold, stash0 = p.stash.length;
  sink(game, him, ship);
  assert.equal(p.nemeses![np.id], undefined, 'the grudge is settled');
  assert.equal(p.nemesisHeads, 1);
  assert.ok(p.gold >= gold0 + np.bounty + Math.round(np.bounty * 1.5), 'the bounty and the revenge');
  assert.equal(p.stash.length, stash0 + 1);
  assert.ok(p.stash.at(-1)!.rarity >= 4, 'rank three and over: an epic piece');
  assert.ok(p.trophies.some((t) => t.startsWith('The head of ') && t.endsWith(', your nemesis')));
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Revenge! ')));
  stepWanted(game);
});

test('the nemesis reads in Russian', () => {
  const { game } = makeGame();
  void game;
  setLang('ru');
  const np = pirateOf('gravewater');
  const sur = np.name[0].split(' ')[0];
  const t = serverText(`Your nemesis ${sur} Two-Fingers has found your wake!`).replace(/\u00a0/g, ' ');
  assert.equal(t, `Ваш заклятый враг ${np.name[1].split(' ')[0]} Два Пальца идёт по вашему следу!`);
  for (const [en, ru] of nemesisPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
    assert.ok(/[а-яё]/i.test(ru), en);
  }
  setLang('en');
});
