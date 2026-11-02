// «Каперский патент» (owner, 2026-11-02): bought in a lawful harbour under its colours for a week; its enemies' ships, the
// captains under their flag and the pirates are her prey without a skull; its own and allied ships are protected; a
// peaceful ship of neither is piracy (the patent burnt, a skull); the issuer's fifth of the silver; the enemy's harbours
// shut and their patrols after her; three quarters of the PvP points; a young captain under her city's flag is safe.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PENNANT_SECONDS } from '../shared/src/data/colours.ts';
import { wantedLevel } from '../shared/src/data/factions.ts';
import { PATENT_CUT, PATENT_LEVEL, PATENT_MAX_MS, PATENT_MS, PATENT_PVP_MUL, PATENT_SAY, patentEnemies, patentPatterns, patentPrice, stanceOf } from '../shared/src/data/patent.ts';
import { SF } from '../shared/src/protocol.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import * as combat from '../server/src/game/combat.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import { coloursBlocked } from '../server/src/game/colours.ts';
import type { Game } from '../server/src/game/Game.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { buyPatent, markFor, patentOf, stepPatent, titheFor, titheOf } from '../server/src/game/patent.ts';
import { canDock } from '../server/src/game/player.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { legalTarget, pvpFlags, pvpView } from '../server/src/game/pvp.ts';
import { pvpRankKill, rankOf } from '../server/src/game/pvprank.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';

const CONTESTED = (Object.keys(REGIONS) as (keyof typeof REGIONS)[]).find((id) => REGIONS[id].safety === 'contested')!;
const SAFE = (Object.keys(REGIONS) as (keyof typeof REGIONS)[]).find((id) => REGIONS[id].safety === 'safe')!;

function inWater(region: keyof typeof REGIONS, ...ships: ShipEntity[]): void {
  for (const x of ships) x.region = region;
}

/** A captain of `level` under the city flag of `city`, at sea in contested water. */
function captain(game: Game, k: number, level = 30, city: 'crown' | 'league' | 'harpoon' | 'confederacy' | 'brokers' | 'free' = 'crown'): PlayerSession {
  const at = openWater(game, k);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const p = s.profile!;
  p.level = level;
  p.pvp.flag = 'faction';
  p.pvp.city = city;
  p.pvp.played = PENNANT_SECONDS + 1; // no Green Pennant unless a test asks for one
  inWater(CONTESTED, s.ship!);
  return s;
}

/** Her patent of `by`, given as the harbour would. */
function grant(game: Game, s: PlayerSession, by: 'crown' | 'league' | 'harpoon' = 'crown'): void {
  s.profile!.pvp.city = by;
  s.profile!.pvp.patent = { by, until: game.wallNow() + PATENT_MS, since: game.wallNow() };
}

function npc(game: Game, role: 'merchant' | 'fisher' | 'patrol' | 'pirate', faction: Parameters<Game['spawnNpcShip']>[2], near: ShipEntity, dx = 200): ShipEntity {
  const o = game.spawnNpcShip(role, role === 'merchant' ? 'fluyt' : 'brig', faction, near.state.x + dx, near.state.y, 0);
  game.setNpcLevel(o, 5);
  o.state.speed = 0;
  o.input = { rudder: 0, sailTarget: 0 };
  game.npcs.get(o.id)!.keep = true;
  inWater(CONTESTED, o);
  game.grid.upsert(o.id, o.state.x, o.state.y);
  return o;
}

test('the stances: the Crown hunts the Red Tide, the Brokers and the Choir; the League and the Harpoon are its allies', () => {
  assert.deepEqual(patentEnemies('crown').sort(), ['brokers', 'choir', 'confederacy']);
  assert.deepEqual(patentEnemies('league').sort(), ['brokers', 'choir', 'confederacy']);
  assert.deepEqual(patentEnemies('harpoon'), ['choir']);
  assert.equal(stanceOf('crown', 'league'), 'ally');
  assert.equal(stanceOf('crown', 'free'), 'other');
  assert.equal(stanceOf('crown', 'crown'), 'own');
  // the price climbs with her level
  assert.ok(patentPrice(10) < patentPrice(30) && patentPrice(30) < patentPrice(60));
  assert.equal(patentPrice(10) % 50, 0);
});

test('bought in a lawful harbour under its colours for a week, renewed up to two; refused with why; it runs out', () => {
  const game = duelSea();
  const s = captain(game, 1, 12);
  const p = s.profile!, c = s.conn as unknown as FakeConn;
  const ship = s.ship!;
  ship.docked = 'gravesend';
  p.gold = 1_000_000;
  // the offer on the flag card
  const offer = pvpView(game, s).patentOffer!;
  assert.equal(offer.by, 'crown');
  assert.equal(offer.price, patentPrice(12));
  assert.equal(offer.blocked, null);
  assert.deepEqual(offer.enemies.sort(), ['brokers', 'choir', 'confederacy']);
  // bought
  assert.equal(buyPatent(game, s), null);
  assert.equal(p.pvp.patent?.by, 'crown');
  assert.equal(p.gold, 1_000_000 - patentPrice(12));
  assert.ok(Math.abs(p.pvp.patent!.until - (game.wallNow() + PATENT_MS)) < 1000);
  assert.match(c.last('toast')?.msg ?? '', /^Privateer patent of the Crown: 7 days/);
  assert.equal(pvpView(game, s).patent?.by, 'crown');
  // renewed: a second week, never a third
  assert.equal(buyPatent(game, s), null);
  assert.ok(Math.abs(p.pvp.patent!.until - (game.wallNow() + PATENT_MAX_MS)) < 1000);
  assert.equal(buyPatent(game, s), PATENT_SAY.max);
  // refusals: a young captain, skulls, other colours, a harbour that sells none
  p.pvp.patent = null;
  p.level = PATENT_LEVEL - 1;
  assert.equal(buyPatent(game, s), PATENT_SAY.level);
  p.level = 30;
  p.infamy = 25;
  assert.equal(buyPatent(game, s), PATENT_SAY.skulls);
  p.infamy = 0;
  p.pvp.city = 'league';
  assert.equal(buyPatent(game, s), PATENT_SAY.colours, 'a League flag in a Crown harbour');
  p.pvp.flag = 'pirate';
  assert.equal(buyPatent(game, s), PATENT_SAY.colours);
  p.pvp.flag = 'faction';
  p.pvp.city = 'crown';
  ship.docked = 'tidewrack';
  assert.equal(buyPatent(game, s), PATENT_SAY.notLawful);
  assert.equal(pvpView(game, s).patentOffer, null);
  // it runs out
  ship.docked = null;
  grant(game, s);
  p.pvp.patent!.until = game.wallNow() - 1;
  stepPatent(game);
  assert.equal(p.pvp.patent, null);
  assert.equal(c.last('toast')?.msg, PATENT_SAY.expired);
  // other colours up: void
  grant(game, s);
  p.pvp.flag = 'pirate';
  stepPatent(game);
  assert.equal(p.pvp.patent, null);
  assert.equal(c.last('toast')?.msg, PATENT_SAY.struck);
});

test('a legal target: the enemy’s merchant is hers without a skull; her own and allied ships are refused', () => {
  const game = duelSea();
  const s = captain(game, 2);
  grant(game, s);
  const me = s.ship!;
  const red = npc(game, 'merchant', 'confederacy', me);
  const brokers = npc(game, 'fisher', 'brokers', me, -200);
  assert.equal(damageBlocked(game, me, red), null);
  assert.equal(damageBlocked(game, me, brokers), null);
  combat.applyDamage(game, red, { hull: 40 }, me);
  combat.applyDamage(game, brokers, { hull: 20 }, me);
  assert.equal(s.profile!.infamy, 0, 'no crime');
  assert.equal(wantedLevel(s.profile!.infamy), 0, 'no skull');
  assert.ok(patentOf(game, s.profile), 'the patent stands');
  // her own flag's and her allies' ships: refused (the city flag's peace, said as the patent's)
  const crown = npc(game, 'merchant', 'crown', me, 300);
  const league = npc(game, 'patrol', 'league', me, -300);
  assert.equal(damageBlocked(game, me, crown), PATENT_SAY.protectedShip);
  assert.equal(damageBlocked(game, me, league), PATENT_SAY.protectedShip);
  // without the patent, the enemy's merchant is the pirate flag's prey only
  s.profile!.pvp.patent = null;
  assert.notEqual(damageBlocked(game, me, npc(game, 'merchant', 'confederacy', me, 450)), null);
  // the world sees the privateer's mark
  grant(game, s);
  assert.ok(pvpFlags(game, me) & SF.PRIVATEER);
});

test('an illegal target: a peaceful ship of neither side is piracy — the patent burnt and a skull', () => {
  const game = duelSea();
  const s = captain(game, 3);
  grant(game, s);
  const me = s.ship!, c = s.conn as unknown as FakeConn;
  const free = npc(game, 'merchant', 'free', me);
  assert.equal(markFor(game, 'crown', free), 'piracy');
  assert.equal(damageBlocked(game, me, free), null, 'her own guns may');
  combat.applyDamage(game, free, { hull: 40 }, me);
  assert.equal(s.profile!.pvp.patent, null, 'the patent burnt');
  assert.equal(wantedLevel(s.profile!.infamy), 1, 'a skull');
  assert.ok(c.all('toast').some((t) => t.msg === PATENT_SAY.piracy));
  // and without the patent she is under the city flag's peace again
  assert.notEqual(damageBlocked(game, me, npc(game, 'merchant', 'free', me, -250)), null);
});

test('the issuer’s fifth: off the silver of her prey, never off any other', () => {
  const game = duelSea();
  const s = captain(game, 4);
  grant(game, s);
  const me = s.ship!;
  const red = npc(game, 'merchant', 'confederacy', me);
  const pirate = npc(game, 'pirate', 'confederacy', me, -200);
  const shark = npc(game, 'patrol', 'free', me, 300);
  assert.equal(titheFor(game, s, red), 'crown');
  assert.equal(titheFor(game, s, pirate), 'crown');
  assert.equal(titheFor(game, s, shark), null);
  assert.equal(titheOf(game, s, titheFor(game, s, red), 1000), 1000 * (1 - PATENT_CUT));
  assert.equal(titheOf(game, s, titheFor(game, s, shark), 1000), 1000);
  // the wreck of her prey keeps the issuer's claim to its silver
  combat.applyDamage(game, red, { hull: 1e6 }, me);
  const wreck = [...game.loot.values()].find((l) => Math.hypot(l.x - red.state.x, l.y - red.state.y) < 5 && l.gold > 0);
  assert.ok(wreck, 'her wreck');
  assert.deepEqual(wreck!.tithe, { account: s.accountId, by: 'crown' });
});

test('the enemy’s harbours shut to her; its patrols hunt her in its waters', () => {
  const game = duelSea();
  const s = captain(game, 5);
  const p = s.profile!;
  grant(game, s);
  assert.equal(canDock(p, 'confederacy').ok, false);
  assert.equal(canDock(p, 'confederacy').reason, PATENT_SAY.enemyPort);
  assert.equal(canDock(p, 'brokers').ok, false);
  assert.equal(canDock(p, 'crown').ok, true);
  assert.equal(canDock(p, 'free').ok, true);
  // an enemy's patrol off its own harbour
  const port = game.world.ports.find((x) => x.faction === 'brokers' && !x.raft)!;
  const me = s.ship!;
  me.state.x = port.x + 3000;
  me.state.y = port.y;
  const patrol = npc(game, 'patrol', 'brokers', me, 400);
  assert.equal(npcHostileTo(game, patrol, me), true);
  p.pvp.patent = null;
  assert.equal(npcHostileTo(game, patrol, me), false, 'without the patent the Brokers leave her be');
});

test('PvP points: a kill under the patent earns three quarters of the pirate flag’s', () => {
  const run = (privateer: boolean): number => {
    const game = duelSea();
    const k = captain(game, 6);
    const v = captain(game, 7);
    k.profile!.pvp.flag = privateer ? 'faction' : 'pirate';
    if (privateer) grant(game, k);
    v.profile!.pvp.flag = 'pirate';
    v.ship!.loadout = { ...k.ship!.loadout };
    pvpRankKill(game, k.ship!, v.ship!, 'sunk');
    return rankOf(game, k.profile!).season.pts;
  };
  const pirate = run(false), privateer = run(true);
  assert.ok(pirate > 0);
  assert.equal(privateer, Math.round(pirate * PATENT_PVP_MUL));
});

test('a newcomer under her city’s flag is no privateer’s prey: same and allied cities, the Green Pennant, neutral colours, safe water', () => {
  const game = duelSea();
  const s = captain(game, 8);
  grant(game, s);
  const me = s.ship!;
  const mk = (k: number, level: number, city: 'crown' | 'league' | 'confederacy'): ShipEntity => {
    const o = captain(game, k, level, city);
    o.ship!.state.x = me.state.x + 300;
    o.ship!.state.y = me.state.y;
    return o.ship!;
  };
  const sameCity = mk(9, 8, 'crown');
  const ally = mk(10, 30, 'league');
  assert.notEqual(coloursBlocked(game, me, sameCity), null, 'a Crown newcomer');
  assert.notEqual(coloursBlocked(game, me, ally), null, 'a League captain');
  assert.equal(legalTarget(game, me, sameCity), false);
  // a young captain of an enemy city keeps the Green Pennant's shield
  const young = mk(11, 8, 'confederacy');
  game.profileOf(young)!.pvp.played = 0;
  assert.notEqual(coloursBlocked(game, me, young), null, 'the pennant holds');
  // neutral colours
  const neutral = mk(12, 30, 'confederacy');
  game.profileOf(neutral)!.pvp.flag = 'neutral';
  assert.notEqual(coloursBlocked(game, me, neutral), null);
  // a grown captain under the Fog Brokers' flag (no enmity of cities with the League — the patent makes it) is fair
  // game both ways, and no crime
  const league = captain(game, 13, 30, 'league');
  grant(game, league, 'league');
  const broker = captain(game, 14, 30, 'brokers').ship!;
  assert.equal(coloursBlocked(game, league.ship!, broker), null);
  assert.equal(coloursBlocked(game, broker, league.ship!), null, 'she may answer');
  assert.equal(legalTarget(game, league.ship!, broker), true);
  // safe water shields everyone
  const foe = mk(15, 30, 'confederacy');
  inWater(SAFE, foe, me);
  assert.notEqual(damageBlocked(game, me, foe), null);
});

test('the patent reads in Russian', () => {
  setLang('ru');
  try {
    const flat = (x: string) => x.replace(/ /g, ' ');
    for (const [en, ru] of patentPatterns()) if (!en.includes('{')) assert.equal(flat(serverText(en)), flat(ru));
    assert.match(flat(serverText('Privateer patent of the Crown: 7 days (3750 silver). Its enemies are your prey.')), /^Каперский патент Короны: 7 дн\./);
    assert.match(flat(serverText('The fifth of the League: 200 silver of the prize go to the issuer.')), /^Доля Лиги: 200/);
  } finally {
    setLang('en');
  }
});
