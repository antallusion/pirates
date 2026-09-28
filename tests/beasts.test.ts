// The hunt (docs/12 P4): orcas circling a wounded ship and going for its rudder, a pod losing heart at half its
// number; a whale taking fright at a loud ship; the harpoon's line played with the sails until the beast is spent —
// parted when held too hard, worked loose when too slack; the carcass flensed alongside while the blood brings the
// sharks; the White Orca's figurehead; the Choir's anger over whales in its waters; the Order's licence; the hunts
// among the quests; the migration and the White Orca among the happenings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEASTS, BEAST_IDS, LINE, beastPatterns, hullNoise, lineStep } from '../shared/src/data/beasts.ts';
import type { BeastId } from '../shared/src/data/beasts.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { JOBS } from '../shared/src/data/quests.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import { beastBrain, beastSecond, beastsAlive, carcassesOf, clearBeasts, huntOrder, huntView, lineOf, spawnBeast, spawnGroup, spawnWhiteOrca, stepBeasts } from '../server/src/game/beasts.ts';
import { stepEvents } from '../server/src/game/events.ts';
import type { Game } from '../server/src/game/Game.ts';
import { ladderBetween } from '../server/src/game/ladder.ts';
import { fireMount } from '../server/src/game/mounts.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { priceMods } from '../server/src/game/ports.ts';
import { questEvent } from '../server/src/game/quests.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const DT = 0.05;

/** A captain at sea in open water of a region, on a hull at a level. */
function hunter(game: Game, name: string, region: RegionId, cls = 'schooner', level = 3): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, cls, level);
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 400; k++) {
    const x = cx + ((k * 7919) % 16000) - 8000, y = cy + ((k * 104729) % 16000) - 8000;
    let clear = regionAt(game.world, x, y) === region;
    for (let a = 0; a < 8 && clear; a++) for (const r of [300, 700, 1200]) if (isLand(game.world, x + Math.cos(a) * r, y + Math.sin(a) * r)) clear = false;
    if (!clear) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = region;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.cargo = {};
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

function run(game: Game, sec: number, each?: () => void): void {
  for (let t = 0; t < sec; t += DT) {
    each?.();
    stepBeasts(game, DT);
    game.now += DT;
    if (Math.floor(game.now) !== Math.floor(game.now - DT)) beastSecond(game);
  }
}

function kill(game: Game, b: ShipEntity, by: ShipEntity): void {
  b.attackers.set(by.id, game.now);
  b.hull = 0;
  game.beginSinking(b);
}

test('the beasts: seven kinds in both tongues, each a monster class with a level on the ladder', () => {
  assert.equal(BEAST_IDS.length, 7);
  for (const id of BEAST_IDS) {
    const d = BEASTS[id];
    assert.ok(SHIP_CLASSES[d.cls].monster, `${id} is a monster class`);
    assert.ok(/[а-яё]/i.test(d.name[1]));
    assert.ok(d.level[0] >= 1 && d.level[1] <= 10 && d.level[0] <= d.level[1]);
    assert.ok(d.flense >= 20 && d.flense <= 60);
  }
  const { game } = makeGame();
  const { ship } = hunter(game, 'Ladder Lark', 'leviathan_reach', 'sloop', 1);
  const orca = spawnBeast(game, 'orca', ship.state.x + 400, ship.state.y, 3);
  assert.ok(orca.onLadder, 'a beast stands on the ladder');
  assert.equal(orca.shipLevel, 3);
  const lad = ladderBetween(game, ship, orca);
  assert.ok(lad.dealt < 1, 'a first-level captain does less to a third-level orca');
  // The noise of a ship: her way and her guns.
  assert.ok(hullNoise(2, 16, 999) < 0.4);
  assert.ok(hullNoise(14, 16, 999) > 0.6);
  assert.ok(hullNoise(4, 16, 2) > hullNoise(4, 16, 999));
});

test('a pod of orcas circles a wounded ship, bites and goes for the rudder; at half its number it loses heart', () => {
  const { game } = makeGame();
  const { c, ship } = hunter(game, 'Wounded Wren', 'leviathan_reach', 'schooner', 3);
  ship.hull = ship.stats.hullMax * 0.5;
  const pod = spawnGroup(game, 'orca', ship.state.x + 400, ship.state.y, 3, 4);
  assert.equal(pod.length, 4);
  const hull0 = ship.hull;
  run(game, 40);
  assert.ok(ship.hull < hull0 - 60, `bitten: ${hull0 - ship.hull}`);
  assert.ok(c.all('toast').some((t) => t.msg === 'The orcas go for your rudder!'));
  // A whole ship is left alone by a pod that is not hungry.
  const { ship: whole } = hunter(game, 'Whole Wynn', 'leviathan_reach', 'schooner', 3);
  const pod2 = spawnGroup(game, 'orca', whole.state.x + 300, whole.state.y, 3, 3);
  const w0 = whole.hull;
  run(game, 20);
  assert.equal(whole.hull, w0, 'a whole ship is not prey');
  void pod2;
  // Two of four gone: the rest scatter.
  kill(game, pod[0], ship);
  kill(game, pod[1], ship);
  assert.ok(c.all('toast').some((t) => t.msg === 'The orcas lose heart and scatter.'));
  assert.equal(beastBrain(game, pod[2].id)?.mode, 'flee');
});

test('a whale takes fright at a loud ship and sounds; a quiet one comes close', () => {
  const { game } = makeGame();
  const { c, ship } = hunter(game, 'Loud Lowell', 'gravewater', 'schooner', 4);
  const whale = spawnBeast(game, 'humpback', ship.state.x, ship.state.y - 500, 4);
  ship.state.speed = ship.stats.maxSpeed * 0.3;
  run(game, 3);
  assert.equal(beastBrain(game, whale.id)?.mode, 'roam', 'quiet: it keeps on');
  ship.state.speed = ship.stats.maxSpeed * 0.9;
  run(game, 2, () => {
    ship.state.speed = ship.stats.maxSpeed * 0.9;
  });
  assert.equal(beastBrain(game, whale.id)?.mode, 'flee');
  assert.ok(whale.hasEffect('submerged'));
  assert.ok(c.all('toast').some((t) => t.msg === 'Humpback Whale takes fright and sounds!'));
});

test('the line: played in the fair band the whale tires until it is spent; the spent whale dies to a carcass', () => {
  const { game } = makeGame();
  const { c, s, ship } = hunter(game, 'Harpooner Hale', 'gravewater', 'schooner', 4);
  ship.loadout.mount = 'harpoon';
  const whale = spawnBeast(game, 'humpback', ship.state.x, ship.state.y - 120, 4);
  assert.equal(fireMount(game, ship, whale.state.x, whale.state.y), null);
  assert.ok(lineOf(game, ship), 'the line is in');
  assert.ok(c.all('toast').some((t) => t.msg === 'The harpoon bites! Humpback Whale is on the line — work her with the sails.'));
  // A good hand: away from it under sail, easing the sheets when it surges and the line comes taut.
  let inBand = 0, n = 0, sail = 0.6;
  run(game, 120, () => {
    const dx = whale.state.x - ship.state.x, dy = whale.state.y - ship.state.y;
    ship.state.heading = Math.atan2(-dx, dy); // straight away from it
    const l = lineOf(game, ship);
    if (l) sail = l.tension > 75 ? 0 : l.tension < 50 ? 0.8 : sail;
    ship.state.sail = sail;
    ship.state.speed = 5;
    if (l && l.stamina > 0) {
      n++;
      if (l.tension >= LINE.SLACK && l.tension <= LINE.SNAP) inBand++;
    }
  });
  assert.ok(inBand / Math.max(1, n) > 0.9, `held in the band: ${inBand}/${n}`);
  assert.ok(c.all('toast').some((t) => t.msg === 'Humpback Whale is spent and lies still. Finish her.'), 'spent');
  const v = huntView(game, ship);
  assert.equal(v?.line?.spent, true);
  // Finish it.
  kill(game, whale, ship);
  assert.equal(lineOf(game, ship), undefined, 'the line is off a dead beast');
  const carc = carcassesOf(game);
  assert.equal(carc.length, 1);
  assert.equal(carc[0].beast, 'humpback');
  assert.equal(s.profile!.beasts?.humpback, 1);
  assert.ok(c.all('toast').some((t) => t.msg === 'Humpback Whale is dead. Heave to alongside to flense her.'));
});

test('the line parts under a surge held hard, and the iron works loose when it is slack', () => {
  const { game } = makeGame();
  const { c, ship } = hunter(game, 'Hard Hand', 'dead_mans_expanse', 'brig', 6);
  ship.loadout.mount = 'harpoon';
  const whale = spawnBeast(game, 'sperm_whale', ship.state.x, ship.state.y - 150, 6);
  assert.equal(fireMount(game, ship, whale.state.x, whale.state.y), null);
  const br = beastBrain(game, whale.id) as unknown as { surgeUntil: number; nextSurge: number; nextBite: number };
  run(game, 4, () => {
    br.surgeUntil = game.now + 10;
    br.nextBite = game.now + 100;
    const dx = whale.state.x - ship.state.x, dy = whale.state.y - ship.state.y;
    ship.state.heading = Math.atan2(-dx, dy);
    ship.state.sail = 1;
    ship.state.speed = 8;
  });
  assert.equal(lineOf(game, ship), undefined);
  assert.ok(c.all('toast').some((t) => t.msg === 'The line parts! Sperm Whale is away with your iron in her.'));
  // Slack: steer for it with all sail on.
  const hump = spawnBeast(game, 'humpback', ship.state.x + 150, ship.state.y, 4);
  ship.cargo = {};
  ship.mountReload = 0;
  assert.equal(fireMount(game, ship, hump.state.x, hump.state.y), null);
  const hb = beastBrain(game, hump.id) as unknown as { surgeUntil: number; nextSurge: number };
  run(game, 14, () => {
    hb.surgeUntil = 0;
    hb.nextSurge = game.now + 100;
    const dx = hump.state.x - ship.state.x, dy = hump.state.y - ship.state.y;
    ship.state.heading = Math.atan2(dx, -dy); // straight at it
    ship.state.sail = 1;
    ship.state.speed = 6;
  });
  assert.equal(lineOf(game, ship), undefined);
  assert.ok(c.all('toast').some((t) => t.msg === 'The iron works loose and Humpback Whale is free.'));
  // Paying out: the tension drops, then the winch must wait.
  const pure = lineStep(90, 0.7, true, 1, 1, false, 1);
  assert.ok(pure.tension > 90, 'a surge held hard climbs');
  assert.ok(lineStep(60, 0.7, false, 0, 0, false, 0.1).drain > lineStep(5, 0.7, false, 0, 0, false, 0.1).drain, "a taut line tires it faster");
});

test('flensing alongside: hove to it fills the hold; under way it stops; the blood brings the sharks', () => {
  const { game } = makeGame();
  const { c, s, ship } = hunter(game, 'Flenser Fay', 'gravewater', 'schooner', 4);
  const whale = spawnBeast(game, 'humpback', ship.state.x + 30, ship.state.y, 4);
  kill(game, whale, ship);
  const carc = carcassesOf(game)[0];
  assert.ok(huntView(game, ship)?.carcass, 'a carcass alongside to flense');
  assert.equal(huntOrder(game, s, 'flense', carc.id), null);
  run(game, 10);
  assert.ok(carcassesOf(game)[0].progress > 0.15);
  // Under way: it stops.
  ship.state.speed = 5;
  run(game, 1.2);
  assert.ok(c.all('toast').some((t) => t.msg === 'Flensing stopped: stay alongside and hove to.'));
  ship.state.speed = 0;
  assert.equal(huntOrder(game, s, 'flense', carc.id), null);
  let sharks = 0;
  run(game, 60, () => {
    ship.state.speed = 0;
    sharks = Math.max(sharks, beastsAlive(game).filter((b) => b.loadout.classId === 'shark').length);
  });
  assert.equal(carcassesOf(game).length, 0, 'flensed');
  assert.ok((ship.cargo.whale_oil ?? 0) >= 6, `whale oil: ${ship.cargo.whale_oil}`);
  assert.ok((ship.cargo.baleen ?? 0) >= 3);
  assert.ok(c.all('toast').some((t) => t.msg === 'Flensed: Humpback Whale.'));
  // The blood: sharks came (or were sure to, over longer).
  if (!sharks) {
    const w2 = spawnBeast(game, 'humpback', ship.state.x + 30, ship.state.y, 4);
    kill(game, w2, ship);
    const c2 = carcassesOf(game)[0] as unknown as { freshUntil: number };
    run(game, 200, () => {
      c2.freshUntil = game.now + 10;
      sharks = Math.max(sharks, beastsAlive(game).filter((b) => b.loadout.classId === 'shark').length);
    });
  }
  assert.ok(sharks > 0, 'the sharks came for the blood');
  assert.ok(c.all('toast').some((t) => t.msg === 'The sharks smell the blood.'));
});

test('the White Orca: her figurehead to the one who takes her, and the whole sea hears', () => {
  const { game } = makeGame();
  const { c, s, ship } = hunter(game, 'Queen Taker', 'leviathan_reach', 'frigate', 8);
  const queen = spawnWhiteOrca(game, ship.state.x + 500, ship.state.y);
  assert.equal(queen.shipLevel, 8);
  assert.equal(beastsAlive(game).length, 5, 'she and her pod');
  kill(game, queen, ship);
  assert.ok(s.profile!.figureheads.includes('fh_white_orca'));
  assert.ok(c.all('toast').some((t) => t.msg === 'WORLD: Queen Taker took the White Orca!'));
  // Her pod does not lose heart while she lives — and she is gone: they may.
  clearBeasts(game);
});

test('the Choir will not forgive whales taken in its waters; the Order eases the duty on the catch', () => {
  const { game } = makeGame();
  const { c, s, ship } = hunter(game, 'Choir Crossed', 'drowned_crown', 'brig', 6);
  const rep0 = s.profile!.reputation.choir ?? 0;
  const whale = spawnBeast(game, 'sperm_whale', ship.state.x + 200, ship.state.y, 6);
  kill(game, whale, ship);
  assert.equal((s.profile!.reputation.choir ?? 0), rep0 - 4);
  assert.ok(c.all('toast').some((t) => t.msg === 'The Choir will not forgive whaling in its waters.'));
  // The licence.
  const port = game.world.ports.find((p) => p.faction === 'crown')!;
  const plain = priceMods(ship, port, s.profile!, game.now, game);
  s.profile!.licences.harpoon = game.now + 3600;
  const eased = priceMods(ship, port, s.profile!, game.now, game);
  assert.ok(plain.duty > 0);
  assert.ok((eased.goodSell?.whale_oil ?? 1) > (plain.goodSell?.whale_oil ?? 1));
  assert.equal(eased.goodSell?.rum ?? 1, plain.goodSell?.rum ?? 1);
});

test('the hunts among the quests and the day’s orders', () => {
  const { game } = makeGame();
  const { s } = hunter(game, 'Quest Quinn', 'gravewater', 'schooner', 5);
  const hunt = JOBS.find((q) => q.template?.startsWith('orca_cull.'))!;
  const whaling = JOBS.find((q) => q.template?.startsWith('whale_hunt.'))!;
  const sharks = JOBS.find((q) => q.template?.startsWith('shark_bounty.'))!;
  assert.ok(hunt && whaling && sharks, 'the three hunting plots are dealt');
  for (const q of [hunt, whaling, sharks]) {
    const port = game.world.ports.find((p) => p.id === q.port)!;
    const plot = q.template!.split('.')[0];
    const where: Record<string, RegionId[]> = { orca_cull: ['gravewater', 'leviathan_reach'] };
    if (where[plot]) assert.ok(where[plot].includes(port.region), `${plot} only where the orcas are`);
  }
  const p = s.profile!;
  p.quests.active.push({ id: hunt.id, step: 0, progress: 0, startedAt: game.now });
  const need = hunt.steps[0].type === 'beast' ? hunt.steps[0].count : 0;
  questEvent(game, s, { k: 'beast', beast: 'humpback' });
  assert.equal(p.quests.active.find((q) => q.id === hunt.id)!.progress, 0, 'a whale is no orca');
  for (let i = 0; i < need; i++) questEvent(game, s, { k: 'beast', beast: 'orca' as BeastId });
  assert.equal(p.quests.active.find((q) => q.id === hunt.id)!.step, 1);
  p.daily.orders = [{ kind: 'beast', need: 2, progress: 0, done: false }];
  questEvent(game, s, { k: 'beast', beast: 'shark' });
  questEvent(game, s, { k: 'beast', beast: 'narwhal' });
  assert.ok(p.daily.orders[0].done);
});

test('the orca migration fills a cold sea with pods; the White Orca rises in the Reach and is rumoured', () => {
  const { game } = makeGame();
  const { ship } = hunter(game, 'Migrant Mae', 'leviathan_reach', 'brig', 6);
  const st = game.worldEvents.data(game);
  const all = ['silver_convoy', 'brethren', 'star', 'eclipse', 'festival', 'herring_run', 'red_tide', 'orca_migration', 'white_orca'];
  const due = (kind: string) => {
    for (const k of all) st.next[k] = game.wallNow() + 1e12;
    st.next[kind] = game.wallNow() - 1;
    for (let i = 0; i < 10; i++) stepEvents(game);
  };
  due('white_orca');
  const e = game.worldEvents.active(game).find((x) => x.kind === 'white_orca')!;
  assert.ok(e, 'she rises');
  assert.ok(beastsAlive(game).some((b) => b.loadout.classId === 'white_orca'));
  due('orca_migration');
  const m = game.worldEvents.active(game).find((x) => x.kind === 'orca_migration')!;
  assert.ok(m && ['leviathan_reach', 'gravewater'].includes(m.region));
  // With the living sea on, pods rise about a captain in the migrating sea.
  ship.region = m.region;
  const [x, y] = REGIONS[m.region].center;
  ship.state.x = x;
  ship.state.y = y;
  game.directorOn = true;
  const before = beastsAlive(game).length;
  for (let i = 0; i < 120; i++) {
    game.now += 1;
    beastSecond(game);
  }
  assert.ok(beastsAlive(game).length > before, 'beasts rise about her');
  setLang('ru');
  assert.match(serverText('The Orca Migration'), /Миграция касаток/);
  assert.match(serverText('The White Orca'), /Белая касатка/);
  assert.match(serverText('The harpoon bites! Orca is on the line — work her with the sails.'), /Касатка на лине/);
  setLang('en');
});

test('the hunt reads in Russian', () => {
  setLang('ru');
  for (const [en, ru] of beastPatterns()) {
    assert.ok(/[а-яё]/i.test(ru), en);
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
