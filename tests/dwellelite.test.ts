// docs/38 §2.4 variant B (owner, 2026-11-03): the elite kinds are hired only at her island's own dwelling of their tier
// raised to level 8 — a row of their own under the dwelling's in the island's recruit window, from a pool of their own
// (half the dwelling's growth), at the dwelling's share off (6–10) — never in a port, at a waystation or by the
// island's boats; their names in both languages, their figure the upgraded kind's until their own is painted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELITE_IDS, TIER_ELITE, UNITS } from '../shared/src/data/army.ts';
import { ELITE_GROWTH } from '../shared/src/data/town.ts';
import { DWELL_HIRE_OFF } from '../shared/src/data/isletree.ts';
import { FIGURES, figureStandIn } from '../shared/src/data/unitart.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { adminWeek, thisWeek } from '../server/src/game/calendar.ts';
import { dwellView, recruit } from '../server/src/game/dwell.ts';
import { isleEliteGrowth, townState } from '../server/src/game/town.ts';
import { reckonBase, yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { boatsDwellView } from '../server/src/game/isleboats.ts';
import { EN, RU } from '../client/src/lang/ui/army.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';

function islander(): { game: Game; s: PlayerSession } {
  const { game } = makeGame();
  game.wallNow = () => 20_000 * 86_400_000;
  clearOutposts(game);
  join(game, 'Elite Tester');
  const s = game.sessionByName('Elite Tester')!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  assert.ok(offCoast(game, ship, home));
  ship.state.speed = 0;
  ship.region = home.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  return { game, s };
}

test('docs/38 §2.4 B: the elite at her island’s dwelling of level 8 only — its own row and pool, the dwelling’s share off; not below 8, not in a port', () => {
  const { game, s } = islander();
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  const t = townState(y);
  t.b = { hall: 1, keep: 1, dw1: 7, dw2: 8 };
  t.w = thisWeek(game);
  t.pool = [0, 20, 20, 0, 0, 0, 0, 0];
  t.elite = [0, 6, 6, 0, 0, 0, 0, 0];
  y.res.gunpowder = 50;
  reckonBase(game, h);
  s.ship!.setArmy([{ u: 'deckhand', n: 10 }]);
  // the bunkhouse at 7: no bosuns yet
  assert.match(recruit(game, s, 'isle', 'bosun', 1) ?? '', /level 8/);
  // the barracks at 8: its row, then the grenadiers' own right under it
  const v = dwellView(game, s, 'isle')!;
  const i = v.rows.findIndex((r) => r.name === 'dw2' && !r.elite);
  const e = v.rows[i + 1];
  assert.ok(e && e.elite && e.tier === 2 && e.units.length === 1 && e.units[0].u === 'sea_grenadier', 'the elite row right under its dwelling');
  assert.equal(e.pool, 6);
  assert.ok(!v.rows.some((r) => r.elite && r.tier === 1), 'none at the bunkhouse of level 7');
  assert.deepEqual(v.rows[i].units.map((x) => x.u), ['marine', 'sea_guard']);
  const gold = s.profile!.gold;
  assert.equal(recruit(game, s, 'isle', 'sea_grenadier', 4), null);
  assert.equal(s.profile!.gold, gold - Math.round(4 * UNITS.sea_grenadier.cost * (1 - DWELL_HIRE_OFF[8])), 'the dwelling’s share off');
  assert.equal(t.elite[2], 2, 'from the elite’s own pool');
  assert.equal(t.pool[2], 20, 'the dwelling’s pool untouched');
  assert.ok(s.ship!.army.some((x) => x.u === 'sea_grenadier' && x.n === 4));
  assert.equal(recruit(game, s, 'isle', 'sea_grenadier', 5), null, 'the two left');
  assert.equal(t.elite[2], 0);
  assert.match(recruit(game, s, 'isle', 'sea_grenadier', 1) ?? '', /Nobody waiting/);
  // the boats never carry them
  assert.ok(!(boatsDwellView(game, s)?.rows ?? []).some((r) => r.elite));
  // the week grows its pool: half the dwelling's growth
  assert.ok(isleEliteGrowth(game, y, 2) > 0 && ELITE_GROWTH === 0.5);
  assert.equal(isleEliteGrowth(game, y, 1), 0, 'none under 8');
  const before = t.elite[2];
  adminWeek(game, 'next');
  dwellView(game, s, 'isle');
  assert.ok(t.elite[2] > before, 'a new week, new grenadiers');
  // in a port: never
  const port = game.world.ports[0];
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  assert.match(recruit(game, s, 'port', 'sea_grenadier', 1) ?? '', /only at your island/);
  assert.ok(!dwellView(game, s, 'port')!.rows.some((r) => r.elite));
});

test('docs/38 §2.4 B: the elites named in both languages, the server’s words too; their figure the upgraded kind’s until painted', () => {
  for (const e of ELITE_IDS) {
    for (const k of [`u.${e}`, `ud.${e}`]) {
      assert.ok((EN as Record<string, string>)[k]?.length > 3, `${k} in English`);
      const ru = (RU as Record<string, string>)[k];
      assert.ok(ru && /[а-яё]/i.test(ru) && !/[a-z]/i.test(ru), `${k} in Russian: ${ru}`);
    }
    const f = FIGURES[e]!;
    const up = UNITS[UNITS[e].base].upgrade!;
    assert.equal(f.like?.[0], up, `${e}: stands in as ${up}`);
    assert.equal(figureStandIn(e, (k) => k === up), up);
    assert.equal(figureStandIn(e, (k) => k === e || k === up), null, 'its own figure once painted');
  }
  setLang('ru');
  assert.ok(/[а-яё]/i.test(serverText('The elite are hired only at your island’s own dwelling of their tier, raised to level 8.')));
  assert.match(serverText('4 sea grenadiers sign on for 400 silver.'), /армию вступают морские гренадеры: 4 за 400\sсеребра/);
  setLang('en');
  assert.equal(TIER_ELITE[7], 'deep_horror');
  assert.ok(UNITS.deep_horror.deep);
});
