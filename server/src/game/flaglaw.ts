// The three flags and the sea's own ships (forum post 34, Нефигугум, 2026-10-31: «Сейчас все нпс стали дружественными…
// убило кайф хардкора — налётчиком разогнавшись "таранным ходом" снести ничего не подозревающего непися»; the owner:
// «делай как было бы круто»). The colours already ruled the quarrels of captains (colours.ts); here they rule the sea's
// peaceful ships too:
//   neutral — scouting and gathering, the hold near empty: no captain fires on her, and she fires on no captain and on
//             no peaceful ship; the sea's pirates only now and then (colours.ts, unchanged);
//   city    — the PvE colours: the merchants, the fishers and the law's patrols are no prey of hers (refused with why,
//             never another ship instead), and they never come for her — a bump is a bump; only the sea's pirates, its
//             monsters and the captains the colours allow come for her;
//   pirate  — the hardcore: she may fire on, ram and rob any merchant, fisher or patrol, and any captain but a neutral
//             one; every new victim of the law's (a peaceful ship, a captain who was no fair game) is a skull at once;
//             the merchants run from her black flag; the sea's pirates leave her be (the Brethren's honour) unless she
//             wronged one of them lately or comes to a lair; the law's patrols hunt a skulled pirate harder — further,
//             faster, and out of the harbours near her (the hue and cry).
// Skulls (the Wanted level): with any on her, her colours stay as they are (the pirate flag up for good until she is
// clean); at two and more no lawful harbour (Crown, League, Harpoon) takes her. She washes them off with time out of a
// fight (about ten minutes a skull) or a pardon bought in a pirate haven (Red Tide, Fog Brokers, Free Harbors).

import { FACTIONS, WANTED_THRESHOLDS, wantedLevel } from '../../../shared/src/data/factions.ts';
import { FLAG_LOCK_SAY, HONOUR_SEC, HUE_PORT_R, PEACE_SAY, HUE_R, HUE_SAFE_MUL, HUE_SALLY_MAX, HUE_SALLY_SEC, HUE_SPEED, MERCHANT_FLEE_R, SKULL_PAD, WASH_PER_SEC } from '../../../shared/src/data/colours.ts';
import type { Colours } from '../../../shared/src/data/colours.ts';
import type { PvpView } from '../../../shared/src/protocol.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { dist, headingOf } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { coloursOf, lawless } from './colours.ts';
import type { Game } from './Game.ts';
import { npcHostileTo, planWander, sectorLevel } from './npc.ts';
import { pardonCost } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

export { FLAG_LOCK_SAY, PEACE_SAY };

/** The hue and cry's own dice: the sea's stream is not drawn on. */
const rngs = new WeakMap<Game, Rng>();
function hr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x5c011)));
  return r;
}

/** A peaceful ship of the sea: a merchant or a fisher of any flag, or the law's own (a patrol, a hunter, a convoy's
 *  escort of a lawful flag) — not a captain's, nor a ship hired by one. */
export function peacefulNpc(game: Game, b: ShipEntity): boolean {
  if (b.isPlayer || b.accountId !== null || b.ownerId !== null || b.hiredBy !== undefined || b.caravanId || !b.npcRole) return false; // (a captain's caravan: the captains' own rules)
  // (a ship the sea itself sails: a stand-in moved by hand — a wreck's hulk, a sim's mark — is nobody's peace)
  if (!game.npcs.has(b.id)) return false;
  if (b.npcRole === 'merchant' || b.npcRole === 'fisher') return true;
  return (b.npcRole === 'patrol' || b.npcRole === 'hunter' || b.npcRole === 'escort') && b.faction !== 'player' && !!FACTIONS[b.faction]?.lawful;
}

/** The captain behind a ship: her own, or the captain of her escort, prize or hired guard. */
export function captainBehind(game: Game, ship: ShipEntity | null | undefined): ShipEntity | null {
  if (!ship) return null;
  if (ship.isPlayer) return ship;
  if (ship.ownerId !== null) {
    const o = game.ships.get(ship.ownerId);
    return o?.isPlayer ? o : null;
  }
  return null;
}

/** A ship her service sent her after (a letter of marque's quarry): hers to take under any colours. */
const sanctioned = new WeakMap<ShipEntity, number>();
export function sanction(target: ShipEntity, accountId: number): void {
  sanctioned.set(target, accountId);
}

/** Why her colours keep `a` (a captain's ship, or one of hers) off the peaceful ship `b`, or null. Under the pirate
 *  flag nothing; under any other, a peaceful ship is no prey — unless it came for her (self-defence, a ship sent after
 *  her, the law after a wanted captain) or her service sent her after it. */
export function peaceBlocked(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  if (!peacefulNpc(game, b)) return null;
  const cap = captainBehind(game, a);
  const p = cap ? game.profileOf(cap) : null;
  if (!cap || !p || coloursOf(p) === 'pirate') return null;
  if ((cap.attackers.get(b.id) ?? -999) > game.now - 120 || (a.attackers.get(b.id) ?? -999) > game.now - 120) return null;
  if (cap.accountId !== null && sanctioned.get(b) === cap.accountId) return null;
  if (npcHostileTo(game, b, cap)) return null;
  return PEACE_SAY;
}

/** A captain's ship (or one of hers) under the pirate flag. */
export function pirateFlagged(game: Game, ship: ShipEntity): boolean {
  const cap = captainBehind(game, ship);
  return !!cap && coloursOf(game.profileOf(cap)) === 'pirate';
}

/** Her skulls (the Wanted level). */
export function skullsOf(p: Profile | null | undefined): number {
  return p ? wantedLevel(p.infamy) : 0;
}

/** Why her colours may not be changed to `to` now, or null: with any skull on her only the pirate flag goes up. */
export function flagLocked(p: Profile, to: Colours): string | null {
  return to !== 'pirate' && skullsOf(p) >= 1 ? FLAG_LOCK_SAY : null;
}

/** An attack that is a skull: a pirate-flag captain's first blow on a peaceful ship, or on a captain who was no fair
 *  game — the infamy it lands her at (one Wanted level up and SKULL_PAD into it), else 0. Lawless water knows no crime.
 *  Once per victim a fight (registerAggression's own «same engagement» keeps the rest). */
export function skullFor(game: Game, a: ShipEntity, b: ShipEntity, fairGame: boolean): number {
  const p = game.profileOf(a);
  if (!p || coloursOf(p) !== 'pirate' || lawless(b)) return 0;
  if (b.isPlayer ? fairGame : !peacefulNpc(game, b)) return 0;
  const lvl = wantedLevel(p.infamy);
  if (lvl >= WANTED_THRESHOLDS.length - 1) return 0;
  return Math.max(0, WANTED_THRESHOLDS[lvl + 1] + SKULL_PAD - p.infamy);
}

/** The Brethren's honour (owner, «делай как было бы круто»): the sea's pirates let a pirate-flag captain be — unless she
 *  fired on one of them within HONOUR_SEC (a wrong the whole sea hears of), or comes to a lair (its garrison holds). */
const wronged = new WeakMap<ShipEntity, number>();
export function wrongBrethren(game: Game, a: ShipEntity, b: ShipEntity): void {
  if (b.npcRole !== 'pirate') return;
  const cap = captainBehind(game, a);
  if (cap) wronged.set(cap, game.now);
}
export function honourSpares(game: Game, npc: ShipEntity, other: ShipEntity): boolean {
  if (npc.npcRole !== 'pirate' || npc.lairGuard || !other.isPlayer) return false;
  if (coloursOf(game.profileOf(other)) !== 'pirate') return false;
  return (wronged.get(other) ?? -Infinity) < game.now - HONOUR_SEC;
}

/** A merchant or a fisher sees a black flag coming: a pirate-flag captain (or one of hers) this near is her danger. */
export function fleesFrom(game: Game, npc: ShipEntity, o: ShipEntity, d: number): boolean {
  return (npc.npcRole === 'merchant' || npc.npcRole === 'fisher') && d < MERCHANT_FLEE_R && pirateFlagged(game, o) && !o.docked && o.alive;
}

/** The law's patrol and a pirate-flag captain with skulls: the hue and cry is on her. */
export function hueOn(game: Game, ship: ShipEntity): boolean {
  if (!ship.isPlayer || !ship.alive || ship.docked || lawless(ship)) return false;
  const p = game.profileOf(ship);
  return !!p && coloursOf(p) === 'pirate' && skullsOf(p) >= 1;
}

/** When a harbour last sent a patrol out after her (captain's ship id → world seconds), and the ships it sent. */
const sallied = new WeakMap<Game, Map<number, { at: number; ships: number[] }>>();

/** Every second: the hue and cry. The law's patrols within HUE_R of a skulled pirate (half again in the Crown's safe
 *  water) take her for their chase and crowd on sail (HUE_SPEED); a lawful harbour within HUE_PORT_R of her sends a
 *  patrol out after her every HUE_SALLY_SEC — up to her skulls' worth of them at once (HUE_SALLY_MAX at most). */
export function stepHueAndCry(game: Game): void {
  const now = game.now;
  let book = sallied.get(game);
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !hueOn(game, ship)) continue;
    const p = s.profile!;
    const skulls = skullsOf(p);
    const safe = REGIONS[ship.region]?.safety === 'safe';
    const r = HUE_R * (safe ? HUE_SAFE_MUL : 1);
    game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
      if (o.npcRole !== 'patrol' || !o.alive || o.docked || o.ownerId !== null || o.hiredBy !== undefined) return;
      if (o.faction === 'player' || !FACTIONS[o.faction]?.lawful) return;
      const brain = game.npcs.get(o.id);
      if (!brain || !npcHostileTo(game, o, ship)) return;
      brain.active = true;
      if (!brain.chase || brain.chase.until < now + 30) brain.chase = { id: ship.id, until: now + 120 };
      if (brain.chase.id === ship.id) o.addEffect({ id: 'hue_and_cry', until: now + 2.5, mods: { maxSpeed: HUE_SPEED } }, now);
    });
    // The harbour's own sally.
    const port = game.nearestPort(ship.state.x, ship.state.y, (pt) => FACTIONS[pt.faction].lawful && !pt.raft);
    if (!port || dist(port.x, port.y, ship.state.x, ship.state.y) > HUE_PORT_R * (safe ? HUE_SAFE_MUL : 1)) continue;
    if (!book) sallied.set(game, (book = new Map()));
    const rec = book.get(ship.id) ?? { at: -Infinity, ships: [] };
    rec.ships = rec.ships.filter((id) => game.ships.get(id)?.alive);
    if (now - rec.at < HUE_SALLY_SEC || rec.ships.length >= Math.min(HUE_SALLY_MAX, skulls + (safe ? 1 : 0))) {
      book.set(ship.id, rec);
      continue;
    }
    const made = sally(game, port, ship);
    if (made) {
      rec.at = now;
      rec.ships.push(made.id);
      game.toastShip(ship, `The law is out after you: a patrol puts out of ${port.name}.`, 'bad');
    }
    book.set(ship.id, rec);
  }
}

/** A patrol out of a lawful harbour after a skulled pirate: a level above the waters, on her chase, gone in ten minutes. */
function sally(game: Game, port: { x: number; y: number; faction: import('../../../shared/src/data/factions.ts').FactionId; name: string }, prey: ShipEntity): ShipEntity | null {
  const rng = hr(game);
  for (let k = 0; k < 24; k++) {
    const a = rng.float() * Math.PI * 2, r = 500 + rng.float() * 700;
    const x = port.x + Math.sin(a) * r, y = port.y - Math.cos(a) * r;
    if (isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const level = Math.min(10, Math.max(sectorLevel(game, x, y) + 1, prey.combatLevel));
    const ship = game.spawnNpcShip('patrol', rng.pick(hullsFor('patrol', level)), port.faction, x, y, headingOf(prey.state.x - x, prey.state.y - y));
    game.setNpcLevel(ship, level);
    game.grid.upsert(ship.id, x, y);
    const brain = game.npcs.get(ship.id)!;
    brain.active = true;
    brain.destPort = null;
    brain.area = { x: port.x, y: port.y, r: HUE_PORT_R * 1.5 };
    brain.chase = { id: prey.id, until: game.now + 240 };
    brain.expiresAt = game.now + 600;
    planWander(game, ship, brain);
    return ship;
  }
  return null;
}

/** Her skulls and the ways to wash them, for the flag card and the HUD. */
export function washView(game: Game, s: PlayerSession): Pick<PvpView, 'skulls' | 'washMin' | 'washAllMin' | 'pardon' | 'locked'> {
  const p = s.profile!;
  const skulls = skullsOf(p);
  const rate = WASH_PER_SEC * 60;
  const floor = WANTED_THRESHOLDS[skulls] ?? 0;
  return {
    skulls,
    washMin: skulls ? Math.max(1, Math.ceil((p.infamy - floor + 1) / rate)) : 0,
    washAllMin: skulls ? Math.max(1, Math.ceil((p.infamy - WANTED_THRESHOLDS[1] + 1) / rate)) : 0,
    pardon: skulls ? pardonCost(p) : 0,
    locked: skulls >= 1,
  };
}
