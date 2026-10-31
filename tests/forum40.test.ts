// Forum post 40 (approved by the owner): «Хроника» — the journal's chronicle of everything that happened, with the
// time; the chart's layers («Всё» with «Верфи», the whispers in «Сокровища», the goods by the ports, the quests'
// places in «Цели»); a beaten lair's return; the navigator's charting perks once every island is charted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOG_MAX, logIn, toastKind } from '../shared/src/data/captainlog.ts';
import type { LogEntry } from '../shared/src/data/captainlog.ts';
import { LAIR_RESPAWN } from '../shared/src/data/lairs.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { toPrivateState } from '../server/src/game/player.ts';
import { sunkByNote } from '../server/src/game/captainlog.ts';
import { SOUNDING_PAGE, soundings } from '../server/src/game/charting.ts';
import { useAbility } from '../server/src/game/abilities.ts';
import { chronGroups } from '../client/src/ui/chronicle.ts';
import { defaultLayers, keptLayers, toggleLayer } from '../client/src/ui/worldmap.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string, cap: Parameters<typeof join>[2] = 'corsair'): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s };
}

const log = (s: PlayerSession): LogEntry[] => s.profile!.log ?? [];

test('the chronicle mirrors the gold and good toasts by their kind; the world\'s shouts and plain notices stay out', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Chronicler');
  game.sendTo(s, { t: 'toast', msg: 'Salvaged: 4 Rum, 120 silver.', kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: 'A bottle in the waves! A note from Old Tom. Inside: 40 silver.', kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: 'The bell comes up from the Grey Hulks: 300 silver.', kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: 'Season card: tier 3!', kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: 'The shipyard on Tern Isle is finished.', kind: 'good' });
  game.sendTo(s, { t: 'toast', msg: 'Sold to you: Brass Compass for 900 silver at Port Royal.', kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: 'WORLD: someone took the White Orca!', kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: 'Not at sea', kind: 'bad' });
  game.sendTo(s, { t: 'toast', msg: 'Shoal water ahead.', kind: 'info' });
  const kinds = log(s).map((e) => e.kind);
  assert.deepEqual(kinds, ['loot', 'find', 'find', 'reward', 'build', 'trade']);
  assert.equal(log(s)[0].a[0], 'Salvaged: 4 Rum, 120 silver.', 'the server\'s own sentence, told by the client\'s table');
  // The same words again within the hour: one line, counted.
  game.sendTo(s, { t: 'toast', msg: 'Sold to you: Brass Compass for 900 silver at Port Royal.', kind: 'gold' });
  assert.equal(log(s).length, 6);
  assert.equal(log(s).at(-1)!.x, 2);
  // Each line goes to her client as it is written; the whole on asking.
  assert.ok(c.inbox.some((m) => m.t === 'chron' && !m.full && m.entries[0].kind === 'loot'));
  c.inbox.length = 0;
  c.onMessage(JSON.stringify({ t: 'chron' }));
  const full = c.inbox.find((m) => m.t === 'chron' && m.full);
  assert.ok(full && full.t === 'chron' && full.entries.length === 6);
  // The kinds' filters.
  assert.ok(logIn('loot', 'loot') && logIn('find', 'loot') && !logIn('build', 'loot') && logIn('build', 'isle') && logIn('sunk_by', 'fight') && logIn('quest_done', 'quest'));
  assert.equal(toastKind('The party returns from the ruins on Gull Rock: 3 rum.'), 'find');
  assert.equal(toastKind('Daily order done: Sink 3 pirates +200 silver.'), 'quest');
});

test('the chronicle writes from their facts: a quest\'s pay, a boarding won, her ship taken, who sank her — once each', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Writer');
  game.sendTo(s, { t: 'quest_done', name: 'The Salt Debt', silver: 450, xp: 120 });
  const result = { targetName: 'Gilded Heron', targetClass: 'brig', cargo: {}, destroyed: {}, gold: 230, ammo: {}, crewLost: 4, enemyCrewLost: 19, ransom: 0, holdFree: 10, npc: true, prize: null, captive: false, recruits: 0, noQuarter: false } as never;
  game.sendTo(s, { t: 'boarding', result });
  game.sendTo(s, { t: 'boarding', result }); // the page asking for its spoils again: no second line
  game.sendTo(s, { t: 'sunk_self', lost: { cargoValue: 100, crew: 3, repairFee: 0 }, respawnPort: 'port_royal', boarded: { by: 'Black Bess', silver: 75 } });
  const q = log(s).find((e) => e.kind === 'quest_done')!;
  assert.deepEqual([q.a[0], q.a[1], q.n], ['The Salt Debt', '120', 450]);
  assert.equal(log(s).filter((e) => e.kind === 'boarded').length, 1);
  assert.deepEqual(log(s).find((e) => e.kind === 'boarded')!.a, ['Gilded Heron', '4', '19']);
  assert.deepEqual(log(s).find((e) => e.kind === 'taken_by')!.a, ['Black Bess']);
  // «А ещё кто тебя убил»: the last ship to hit her within two minutes.
  const foe = game.spawnNpcShip('pirate', 'sloop', 'confederacy', s.ship!.state.x + 300, s.ship!.state.y, 0);
  s.ship!.attackers.set(foe.id, game.now);
  sunkByNote(game, s, s.ship!);
  const sb = log(s).at(-1)!;
  assert.equal(sb.kind, 'sunk_by');
  assert.equal(sb.a[0], foe.name);
  assert.ok(sb.a[1].length > 0, 'where');
  s.ship!.attackers.clear();
  sunkByNote(game, s, s.ship!);
  assert.equal(log(s).at(-1)!.a[0], '', 'the sea itself');
});

test('the chronicle keeps the last 300 lines; a save grows by some 40 KB at most', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Keeper');
  for (let i = 0; i < LOG_MAX + 40; i++) game.sendTo(s, { t: 'toast', msg: `The party returns from the ruins on Isle ${i}: ${i} silver, 3 rum, and a map in an oilcloth wrapper, the ink still fresh enough to read.`, kind: 'gold' });
  assert.equal(log(s).length, LOG_MAX);
  const bytes = JSON.stringify(log(s)).length;
  assert.ok(bytes < 60_000, `${bytes} bytes`);
  // Not in the private state any more (300 lines at every patch): it comes by {t:'chron'}.
  assert.ok(!('log' in toPrivateState(s, game.now)));
});

test('the chronicle page: newest first, by day, under its filter', () => {
  const now = new Date(2026, 9, 31, 15, 0).getTime();
  const e = (kind: LogEntry['kind'], at: number): LogEntry => ({ at, day: 1, tod: 0, kind, a: ['x'] });
  const list = [e('loot', now - 2 * 86_400_000), e('sunk_by', now - 86_400_000), e('build', now - 3_600_000), e('loot', now - 60_000)];
  const all = chronGroups(list, 'all', now);
  assert.equal(all.length, 3);
  assert.equal(all[0].rows[0].at, now - 60_000, 'newest first');
  assert.equal(all[0].rows.length, 2);
  assert.deepEqual(chronGroups(list, 'loot', now).flatMap((g) => g.rows.map((r) => r.kind)), ['loot', 'loot']);
  assert.deepEqual(chronGroups(list, 'isle', now).flatMap((g) => g.rows.map((r) => r.kind)), ['build']);
});

test('the chart: «Всё» is the yards too; a kept «Всё» gets them once', () => {
  assert.deepEqual([...defaultLayers(false)].sort(), ['all', 'yards']);
  assert.deepEqual([...toggleLayer(new Set(['ports', 'goals'] as const), 'all')].sort(), ['all', 'yards']);
  assert.deepEqual([...keptLayers(['all'], true, false)].sort(), ['all', 'yards']);
  assert.deepEqual([...keptLayers(['all'], true, true)], ['all'], 'once: turned off after, it stays off');
});

test('lairs come back: shore 2, grotto 3, guardian 4 sea days (96, 144, 192 real minutes)', () => {
  assert.equal(DAY_LENGTH_SEC, 48 * 60);
  assert.deepEqual([LAIR_RESPAWN.shore / 60, LAIR_RESPAWN.grotto / 60, LAIR_RESPAWN.guardian / 60], [96, 144, 192]);
});

test('the navigator\'s charting once every island is charted: pages of soundings, the star fix\'s exact reckoning', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Navi', 'navigator');
  const ship = s.ship!;
  s.profile!.talents.exp_pathfinder = 2;
  s.profile!.talents.exp_cartographer = 2;
  ship.talents = s.profile!.talents;
  ship.recompute(game.now);
  ship.morale = 50;
  const xp0 = s.profile!.xp + s.profile!.level * 1e9;
  soundings(game, s, SOUNDING_PAGE - 1);
  assert.ok(!ship.effects.some((e) => e.id === 'pathfinder'), 'not yet a page');
  soundings(game, s, 1);
  assert.ok(ship.effects.some((e) => e.id === 'pathfinder'), '«Первопроходец» on a page of soundings');
  assert.equal(ship.morale, 55);
  assert.equal(s.profile!.soundingPages, 1);
  assert.ok(s.profile!.xp + s.profile!.level * 1e9 > xp0, '«Картограф»: a page\'s experience');
  // Every island within 7 km charted already: the star fix's reckoning.
  for (const is of game.world.islands) if (Math.hypot(is.x - ship.state.x, is.y - ship.state.y) < 8000) s.discovered.add(is.id);
  s.profile!.cooldowns = {};
  const why = useAbility(game, ship, 'star_fix');
  assert.equal(why, null);
  assert.ok(ship.effects.some((e) => e.id === 'star_reckoning'), 'the exact reckoning');
});
