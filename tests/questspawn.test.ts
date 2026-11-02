// Forum post 55: «когда у тебя есть квест, при нажатии "плыть" моб появляется из ниоткуда». A quest's quarry was put out
// 500–1 275 m off its port the moment «Плыть» was pressed — on the screen of the captain who pressed it in that port. Now
// every quest's quarry is put out beyond every captain's sight (questspot.ts): never within QUEST_SIGHT_R (four times her
// screen) of one, at sea or at the quay; about the quest's port when it can be, else beyond, sailing in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_R } from '../server/src/game/questlocal.ts';
import { ensureDailyQuarry } from '../server/src/game/questlocal.ts';
import { spawnCampaignFoe, spawnPackLeader, spawnQuestFoe } from '../server/src/game/npc.ts';
import { QUEST_SIGHT_R, unseen } from '../server/src/game/questspot.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { regionAt } from '../shared/src/world/worldgen.ts';
import { join, makeGame } from './helpers.ts';

function far(me: ShipEntity, o: ShipEntity | null): number {
  assert.ok(o, 'the quarry is out');
  return Math.hypot(o!.state.x - me.state.x, o!.state.y - me.state.y);
}

test('«Плыть» in the quest’s port: its quarry is put out beyond her sight, never on her screen', () => {
  const { game } = makeGame();
  join(game, 'Quest Captain');
  const s = game.sessionByName('Quest Captain')!;
  const me = s.ship!;
  const port = game.portById('gravesend')!;
  // in port (a docked ship lies at the quay), then just outside it
  for (const at of [{ x: port.x, y: port.y, docked: 'gravesend' as string | null }, { x: port.x + 400, y: port.y + 300, docked: null }]) {
    me.state.x = at.x;
    me.state.y = at.y;
    me.docked = at.docked;
    for (let k = 0; k < 12; k++) {
      const foe = spawnQuestFoe(game, port, 'pirate', 3, LOCAL_R);
      assert.ok(far(me, foe) >= QUEST_SIGHT_R, `a quest's raider ${Math.round(far(me, foe))} m off her`);
      assert.ok(Math.hypot(foe!.state.x - port.x, foe!.state.y - port.y) <= LOCAL_R, 'and still in the quest’s own waters');
      game.removeShip(foe!.id);
    }
    // the day's orders and a port's bounties (forced on «Плыть»), the beasts too
    for (const kind of ['sink', 'beast']) {
      const out = ensureDailyQuarry(game, s, kind, 1, port);
      assert.ok(out.length, `${kind}: put out`);
      for (const o of out) {
        assert.ok(far(me, o) >= QUEST_SIGHT_R, `${kind}: ${Math.round(far(me, o))} m off her`);
        game.removeShip(o.id);
      }
    }
  }
});

test('with the captain far off, the quarry is still put out about the quest’s port (its own waters)', () => {
  const { game } = makeGame();
  join(game, 'Far Captain');
  const me = game.sessionByName('Far Captain')!.ship!;
  const port = game.portById('gravesend')!;
  me.docked = null;
  me.state.x = port.x + 9000;
  me.state.y = port.y;
  for (let k = 0; k < 8; k++) {
    const foe = spawnQuestFoe(game, port, 'pirate', 3, LOCAL_R)!;
    assert.ok(Math.hypot(foe.state.x - port.x, foe.state.y - port.y) <= LOCAL_R, 'within the quest’s 1.5 km');
    game.removeShip(foe.id);
  }
});

test('the campaign’s foe and a hunt’s leader come out of sight too', () => {
  const { game } = makeGame();
  join(game, 'Story Captain');
  const s = game.sessionByName('Story Captain')!;
  const me = s.ship!;
  const port = game.portById('gravesend')!;
  me.docked = null;
  me.state.x = port.x + 600;
  me.state.y = port.y + 600;
  for (let k = 0; k < 6; k++) {
    const foe = spawnCampaignFoe(game, me, s.accountId, 3, 'pirate');
    assert.ok(far(me, foe) >= QUEST_SIGHT_R, `the campaign's raider ${Math.round(far(me, foe))} m off`);
    assert.ok(unseen(game, foe!.state.x, foe!.state.y));
    game.removeShip(foe!.id);
    const at = { x: me.state.x, y: me.state.y, r: 1600 };
    const near = spawnCampaignFoe(game, me, s.accountId, 3, 'pirate', at);
    assert.ok(far(me, near) >= QUEST_SIGHT_R, `in the location's waters: ${Math.round(far(me, near))} m off`);
    game.removeShip(near!.id);
    const leader = spawnPackLeader(game, regionAt(game.world, port.x, port.y), 12, { x: port.x, y: port.y, r: LOCAL_R });
    assert.ok(far(me, leader) >= QUEST_SIGHT_R, `a hunt's leader ${Math.round(far(me, leader))} m off`);
    game.removeShip(leader!.id);
  }
});
