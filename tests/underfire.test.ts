// Under fire (owner, 2026-10-07: «я должен со всем взаимодействовать, ошибок типа "не под огнём" или ещё что-то быть
// не должно абсолютно» — a shark marked «далеко», and the landing at a Штурм lair and every other order answered «Не под
// огнём»): the fight that holds her orders back is another ship's fire striking her within a few seconds — never her
// own shots, nor a beast she has marked or that bites her. Even then nothing is refused: the order waits and is done the
// moment the shot stops.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { spawnBeast } from '../server/src/game/beasts.ts';
import { landFighting } from '../server/src/game/beastlairs.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { pursuitOf, startPursuit } from '../server/src/game/pursuit.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { UNDER_FIRE_SEC } from '../server/src/game/ship.ts';
import { HELD_UNDER_FIRE, UNDER_FIRE_WORDS, WAY_WORDS } from '../server/src/game/underfire.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  s.profile!.level = 30;
  ship.ammo.round = 500;
  s.autoFire = true;
  return { c, s, ship };
}

/** A shark marked with «Атаковать» close by her, her guns at it and its teeth in her, for `sec` seconds. */
function sharkFight(game: Game, s: PlayerSession, sec: number): ShipEntity {
  const ship = s.ship!;
  const shark = spawnBeast(game, 'shark', ship.state.x + 120, ship.state.y, Math.max(1, ship.combatLevel));
  shark.hull = shark.stats.hullMax * 50; // it lives through the walk
  assert.equal(startPursuit(game, s, shark.id, 'guns'), null);
  steps(game, Math.round(sec * 20));
  return shark;
}

const fireWords = (c: FakeConn, from: number) => c.inbox.slice(from).filter((m) => m.t === 'toast' && (UNDER_FIRE_WORDS.has(m.msg) || m.msg === HELD_UNDER_FIRE)).map((m) => (m as { msg: string }).msg);

test('her own shots, a beast she has marked and its bites are no fire; another ship\'s ball is, for a few seconds', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Marked Maud');
  const shark = sharkFight(game, s, 12);
  assert.ok(pursuitOf(ship), '«Атаковать» on the shark');
  assert.ok(ship.inCombat(game.now), 'the fight is on (her guns, its teeth)');
  assert.ok(shark.attackers.has(ship.id), 'her shot in it');
  assert.equal(ship.underFire(game.now), false, 'yet no ship\'s fire on her');
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x - 200, ship.state.y, 0);
  applyDamage(game, ship, { hull: 10 }, pirate);
  assert.equal(ship.underFire(game.now), true, 'a ball from a ship');
  steps(game, Math.round((UNDER_FIRE_SEC + 0.2) * 20));
  assert.equal(ship.underFire(game.now), false, 'and a few seconds after it, clear');
});

test('every order with a beast marked nearby is answered — a sea mark, a find, a stack, a lair, the land, the harbour, the carpenters, a talent — none refused for the fight', () => {
  const walk: [string, (game: Game, c: FakeConn, s: PlayerSession, ship: ShipEntity) => (() => void) | void][] = [
    ['a sea mark', (game, c, s) => {
      const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark go') ?? '')?.[1]);
      assert.ok(id >= 0);
      sharkFight(game, s, 6);
      c.push({ t: 'seamark', action: 'work', id });
    }],
    ['a find', (game, c, s) => {
      const id = Number(/find (\d+)/.exec(runAdmin(game, s, '/find bottle go') ?? '')?.[1]);
      assert.ok(id >= 0);
      sharkFight(game, s, 6);
      c.push({ t: 'seafind', action: 'work', id });
    }],
    ['a stack', (game, c, s) => {
      const id = Number(/stack (\d+)/.exec(runAdmin(game, s, '/stack go') ?? '')?.[1]);
      assert.ok(id >= 0);
      sharkFight(game, s, 6);
      c.push({ t: 'roam', action: 'attack', id });
    }],
    ['a lair (the owner\'s «Штурм»)', (game, c, s) => {
      quietAdv(game, false); // the land's creatures awake (makeGame keeps them still)
      runAdmin(game, s, '/lair go');
      steps(game, 40);
      const id = c.last('lair_card')?.card?.id;
      assert.ok(id, 'a lair\'s card');
      sharkFight(game, s, 6);
      c.push({ t: 'lair', action: 'fight', id: String(id) });
      // At way under «Атаковать»: she heaves to and the boats go for the lair when she lies still.
      return () => {
        steps(game, 20 * 15);
        assert.ok(landFighting(game, s), 'the boats go for the lair: the battle ashore');
      };
    }],
    ['the land', (game, c, s, ship) => {
      const is = game.world.islands.find((i) => !i.portId && i.radius > 250 && i.radius < 600)!;
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const x = is.x + Math.sin(a) * (is.radius + 120), y = is.y - Math.cos(a) * (is.radius + 120);
        if (isLand(game.world, x, y)) continue;
        ship.state = { ...ship.state, x, y, speed: 0, sail: 0 };
        break;
      }
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      sharkFight(game, s, 6);
      c.push({ t: 'land' });
      // At way under «Атаковать»: she heaves to for the boats and they go (no «Heave to first»).
      return () => {
        steps(game, 20 * 15);
        assert.ok(ship.landing, 'the boats ashore');
        assert.equal(pursuitOf(ship), null, 'the chase given up for the land');
      };
    }],
    ['the harbour', (game, c, s, ship) => {
      const port = game.world.ports[0];
      ship.state = { ...ship.state, x: port.x + 150, y: port.y + 150, speed: 0, sail: 0 };
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      sharkFight(game, s, 6);
      c.push({ t: 'dock' });
      return () => {
        steps(game, 20 * 12);
        assert.ok(ship.docked, 'in harbour');
      };
    }],
    ['the carpenters', (game, c, s, ship) => {
      sharkFight(game, s, 6);
      ship.hull = ship.stats.hullMax * 0.6;
      ship.cargo.planks = 20;
      c.push({ t: 'repair', on: true });
      assert.equal(ship.repairing, true, 'the carpenters at work');
    }],
    ['a talent', (game, c, s) => {
      sharkFight(game, s, 6);
      c.push({ t: 'learn_talent', id: 'gun_quick_hands' });
    }],
  ];
  for (const [what, go] of walk) {
    const { game } = makeGame();
    const { c, s, ship } = captain(game, 'Busy Bess');
    ship.state.x = 30000;
    ship.state.y = 80000;
    const from = c.inbox.length;
    const after = go(game, c, s, ship);
    steps(game, 2);
    assert.ok(ship.inCombat(game.now), `${what}: in the shark's fight`);
    after?.();
    const said = c.inbox.slice(from).filter((m) => m.t === 'toast').map((m) => (m as { msg: string }).msg);
    assert.deepEqual(fireWords(c, from), [], `${what}: refused for the fight (${JSON.stringify(said)})`);
    assert.ok(!said.some((m) => WAY_WORDS.has(m)), `${what}: refused for her way (${JSON.stringify(said)})`);
    assert.equal(s.whenClear, null, `${what}: nothing left waiting`);
  }
});

test('under a ship\'s fire an order is held, not refused, and done the moment the shot stops', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Harried Hal');
  const port = game.world.ports[0];
  ship.state = { ...ship.state, x: port.x + 150, y: port.y + 150, speed: 0, sail: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x - 300, ship.state.y, 0);
  game.npcs.delete(pirate.id);
  applyDamage(game, ship, { hull: 5 }, pirate);
  const from = c.inbox.length;
  c.push({ t: 'dock' });
  const said = c.inbox.slice(from).filter((m) => m.t === 'toast').map((m) => m as { msg: string; kind: string });
  assert.ok(!said.some((m) => m.kind === 'bad'), `no refusal: ${JSON.stringify(said)}`);
  assert.ok(said.some((m) => m.msg === HELD_UNDER_FIRE && m.kind === 'info'), 'told once that it waits');
  assert.ok(s.whenClear, 'held');
  assert.equal(ship.docked, null, 'not yet');
  steps(game, Math.round((UNDER_FIRE_SEC + 1.5) * 20));
  assert.ok(ship.docked, 'in harbour once the shot stopped');
  assert.equal(s.whenClear, null);
});

test('no order of hers is refused for the fight on anything but another ship\'s fire (every gate reads underFire)', () => {
  const dir = 'server/src/game';
  const bad: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const lines = readFileSync(`${dir}/${f}`, 'utf8').split('\n');
    lines.forEach((l, i) => {
      for (const w of UNDER_FIRE_WORDS) if (l.includes(`'${w}'`) && l.includes('inCombat(')) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
