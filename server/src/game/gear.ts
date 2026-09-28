// Gear on the server (docs/12 P1): the captain's locker, putting items on and taking them off, the chandler's wares,
// selling, mending and breaking things down, what sunk ships leave in the water, and the wear of a sinking.
//
// Ship gear is carried by the ship (loadout.gear: it stays with her in a berth); the captain's own is the captain's
// (profile.captainGear). A ship item's level may not pass her level, a captain's item may not pass the captain's
// band; a ship's slot opens at a level of hers. Gear is changed out of a fight.

import {
  CAPTAIN_SLOTS, ITEM_BASES, RARITY_NAMES, SHIP_SLOTS, SLOT_NAMES, SLOT_OPENS, STASH_SIZE, TEMPER_MAX, captainIlvl, isShipSlot, itemName, itemSlot, itemValue, makeItem, mendCost,
  reforgeCost, reforgeLine, salvageYield, temperCost,
} from '../../../shared/src/data/items.ts';
import type { CaptainSlot, Item, Rarity, Slot } from '../../../shared/src/data/items.ts';
import { dayOf } from '../../../shared/src/data/dailies.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { watersBand } from '../../../shared/src/data/shiplevel.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

export function sanitizeGear(p: Profile): void {
  p.stash = (p.stash ?? []).filter((it) => it && ITEM_BASES[it.base]);
  p.captainGear ??= {};
  for (const k of Object.keys(p.captainGear) as CaptainSlot[]) if (!p.captainGear[k] || !ITEM_BASES[p.captainGear[k]!.base]) delete p.captainGear[k];
  p.itemSeq ??= 1;
  for (const l of [p.loadout, ...(p.berths ?? []).map((b) => b.loadout)]) if (l) l.gear ??= {};
}

/** Everything the captain has worn, in one list (ship's and own). */
export function wornItems(p: Profile): Item[] {
  return [...Object.values(p.loadout.gear ?? {}), ...Object.values(p.captainGear ?? {})].filter((x): x is Item => !!x);
}

/** The captain's own gear onto her ship's entity (the stats count it with the rest). */
export function applyWorn(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const ship = s.ship;
  if (!ship) return;
  ship.worn = Object.values(p.captainGear).filter((x): x is Item => !!x);
  ship.loadout = p.loadout;
  const frac = ship.hull / Math.max(1, ship.stats.hullMax);
  const sails = ship.sails / Math.max(1, ship.stats.sailHpMax);
  ship.recompute(game.now);
  ship.hull = Math.max(1, Math.round(frac * ship.stats.hullMax));
  ship.sails = Math.round(sails * ship.stats.sailHpMax);
}

function newUid(p: Profile): number {
  return p.itemSeq++;
}

/** Puts an item from the locker on (whatever was in its slot goes back into the locker). */
export function equip(game: Game, s: PlayerSession, uid: number): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const i = p.stash.findIndex((x) => x.uid === uid);
  if (i < 0) return 'No such item in your locker';
  if (ship.inCombat(game.now)) return 'Not in the middle of a fight';
  const it = p.stash[i];
  const slot = itemSlot(it);
  if (isShipSlot(slot)) {
    p.loadout.gear ??= {};
    if (ship.shipLevel < SLOT_OPENS[slot]) return `The ${SLOT_NAMES[slot][0]} slot opens at ship level ${SLOT_OPENS[slot]}`;
    if (it.ilvl > ship.shipLevel) return `Made for a ship of level ${it.ilvl}: yours is level ${ship.shipLevel}`;
    const was = p.loadout.gear![slot];
    p.stash.splice(i, 1);
    if (was) p.stash.push(was);
    p.loadout.gear![slot] = it;
  } else {
    const band = captainIlvl(p.level);
    if (it.ilvl > band) return `Made for a captain of level ${(it.ilvl - 1) * 6 + 1} and up`;
    const was = p.captainGear[slot];
    p.stash.splice(i, 1);
    if (was) p.stash.push(was);
    p.captainGear[slot] = it;
  }
  applyWorn(game, s);
  game.pushSelf(s, true);
  return null;
}

/** Takes an item off into the locker. */
export function unequip(game: Game, s: PlayerSession, slot: Slot): string | null {
  const p = s.profile!;
  if (s.ship!.inCombat(game.now)) return 'Not in the middle of a fight';
  p.loadout.gear ??= {};
  const it = isShipSlot(slot) ? p.loadout.gear[slot] : p.captainGear[slot];
  if (!it) return 'Nothing worn there';
  if (p.stash.length >= STASH_SIZE) return 'Your locker is full';
  if (isShipSlot(slot)) delete p.loadout.gear![slot];
  else delete p.captainGear[slot];
  p.stash.push(it);
  applyWorn(game, s);
  game.pushSelf(s, true);
  return null;
}

/** Sells an item from the locker to the port's chandler for a quarter of its worth. */
export function sellItem(game: Game, s: PlayerSession, uid: number): string | null {
  const p = s.profile!;
  const i = p.stash.findIndex((x) => x.uid === uid);
  if (i < 0) return 'No such item in your locker';
  const it = p.stash[i];
  const price = Math.max(1, Math.round(itemValue(it) / 4));
  p.stash.splice(i, 1);
  p.gold += price;
  game.db.ledger(s.accountId, 'item_sold', price, it.base);
  game.sendTo(s, { t: 'toast', msg: `Sold ${itemName(it)} for ${price} silver.`, kind: 'gold' });
  game.pushSelf(s, true);
  return null;
}

/** Breaks an item down at a yard: timber, iron, canvas by its level; bone of the deep from an epic or better. */
export function salvageItem(game: Game, s: PlayerSession, port: Port, uid: number): string | null {
  const p = s.profile!;
  if (port.shipyardTier <= 0) return 'No yard here to break it down';
  const i = p.stash.findIndex((x) => x.uid === uid);
  if (i < 0) return 'No such item in your locker';
  const it = p.stash[i];
  p.stash.splice(i, 1);
  const cargo = s.ship!.cargo;
  for (const y of salvageYield(it)) cargo[y.good] = (cargo[y.good] ?? 0) + y.qty;
  game.sendTo(s, { t: 'toast', msg: `Broken down: ${itemName(it)}.`, kind: 'info' });
  game.pushSelf(s, true);
  return null;
}

/** A piece by its number: in the locker or worn. */
function findPiece(p: Profile, uid: number): Item | undefined {
  return p.stash.find((x) => x.uid === uid) ?? wornItems(p).find((x) => x.uid === uid);
}

/** A yard of the second rank or better keeps a forge. */
function forgeAt(port: Port): boolean {
  return port.shipyardTier >= 2;
}

/** Tempering a piece at a forge: +3% to its main line, up to five times; iron and planks from the hold. */
export function temperItem(game: Game, s: PlayerSession, port: Port, uid: number): string | null {
  const p = s.profile!;
  if (!forgeAt(port)) return 'No forge here: tempering and reforging want a yard of the second rank or better';
  const it = findPiece(p, uid);
  if (!it) return 'No such piece';
  if ((it.temper ?? 0) >= TEMPER_MAX) return 'Tempered to the full';
  const c = temperCost(it);
  if (p.gold < c.silver) return `Needs ${c.silver} silver`;
  const cargo = s.ship!.cargo;
  if ((cargo.iron ?? 0) < c.iron || (cargo.planks ?? 0) < c.planks) return `Needs ${c.iron} iron and ${c.planks} planks (in the hold)`;
  p.gold -= c.silver;
  cargo.iron = (cargo.iron ?? 0) - c.iron;
  cargo.planks = (cargo.planks ?? 0) - c.planks;
  if (!cargo.iron) delete cargo.iron;
  if (!cargo.planks) delete cargo.planks;
  game.db.ledger(s.accountId, 'temper', -c.silver, it.base);
  it.temper = (it.temper ?? 0) + 1;
  applyWorn(game, s);
  game.sendTo(s, { t: 'toast', msg: `Tempered: ${itemName(it)} +${it.temper}.`, kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** Reforging one extra line of a piece at a forge: another line in its place, at the piece's level and rarity. */
export function reforgeItem(game: Game, s: PlayerSession, port: Port, uid: number, line: number): string | null {
  const p = s.profile!;
  if (!forgeAt(port)) return 'No forge here: tempering and reforging want a yard of the second rank or better';
  const it = findPiece(p, uid);
  if (!it) return 'No such piece';
  const roll = reforgeLine(game.rng, it, line);
  if (!roll) return 'No such line to reforge';
  const cost = reforgeCost(it);
  if (p.gold < cost) return `Needs ${cost} silver`;
  p.gold -= cost;
  game.db.ledger(s.accountId, 'reforge', -cost, it.base);
  it.affixes[line] = roll;
  applyWorn(game, s);
  game.sendTo(s, { t: 'toast', msg: `Reforged: ${itemName(it)}.`, kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** Mends every worn item at a yard. */
export function mendGear(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  if (port.shipyardTier <= 0) return 'No yard here';
  const worn = wornItems(p).filter((it) => it.dur < 100);
  if (!worn.length) return 'Your gear is sound';
  const cost = worn.reduce((a, it) => a + mendCost(it), 0);
  if (p.gold < cost) return `Needs ${cost} silver`;
  p.gold -= cost;
  game.db.ledger(s.accountId, 'gear_mend', -cost, String(worn.length));
  for (const it of worn) it.dur = 100;
  applyWorn(game, s);
  game.pushSelf(s, true);
  return null;
}

/** A hull leaving the captain's hands (sold, traded in): her gear back into the locker, if there is room for it. */
export function takeGearBack(p: Profile, loadout: { gear?: Partial<Record<string, Item>> }): string | null {
  const items = Object.values(loadout.gear ?? {}).filter((x): x is Item => !!x);
  if (p.stash.length + items.length > STASH_SIZE) return `Clear your locker first: her gear needs ${items.length} places`;
  p.stash.push(...items);
  loadout.gear = {};
  return null;
}

/** Wear from a sinking: a tenth off every worn item. */
export function wearOnSinking(p: Profile): void {
  for (const it of wornItems(p)) it.dur = Math.max(0, it.dur - 10);
}

// ------------------------------------------------------------------------------------------------ the chandler

/** The port chandler's wares today: common and fine pieces of the waters' levels, the same for everyone all day. */
export function chandlerWares(game: Game, port: Port): Item[] {
  if (port.shipyardTier <= 0 && port.size < 2) return [];
  const day = dayOf(game.wallNow());
  let h = day * 2654435761;
  for (let i = 0; i < port.id.length; i++) h = Math.imul(h ^ port.id.charCodeAt(i), 16777619);
  const rng = new Rng(h >>> 0);
  const band = watersBand(REGIONS[port.region].safety, port.region === 'the_abyss');
  const sold = Object.values(ITEM_BASES).filter((b) => b.sold);
  const out: Item[] = [];
  for (let k = 0; k < 6; k++) {
    const base = sold[rng.int(0, sold.length - 1)];
    const lv = rng.int(band[0], band[1]);
    out.push(makeItem(rng, -(k + 1), { base: base.id, ilvl: isShipSlot(base.slot) ? lv : lv, rarity: (rng.float() < 0.3 ? 1 : 0) as Rarity }));
  }
  return out;
}

/** Buys one of the chandler's wares (by its place on the list). */
export function buyWare(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const ware = chandlerWares(game, port)[index];
  if (!ware) return 'That is sold';
  if (p.stash.length >= STASH_SIZE) return 'Your locker is full';
  const price = itemValue(ware);
  if (p.gold < price) return `Needs ${price} silver`;
  p.gold -= price;
  game.db.ledger(s.accountId, 'item_bought', -price, ware.base);
  p.stash.push({ ...ware, uid: newUid(p), affixes: ware.affixes.map((a) => ({ ...a })) });
  game.sendTo(s, { t: 'toast', msg: `Bought ${itemName(ware)}.`, kind: 'info' });
  game.pushSelf(s, true);
  return null;
}

// ------------------------------------------------------------------------------------------------ loot

const DROP: Partial<Record<string, number>> = { pirate: 0.35, merchant: 0.25, patrol: 0.3, hunter: 0.45, ghost: 0.45, escort: 0.1 };

/** What a sunk ship of the sea leaves in the water besides her cargo: an item now and then (an elite's always). */
export function rollDrop(game: Game, victim: ShipEntity): Item | null {
  if (victim.isPlayer || !victim.onLadder || !victim.npcRole) return null;
  const elite = victim.elite;
  if (!elite && !game.rng.chance(DROP[victim.npcRole] ?? 0)) return null;
  // Merchants carry trade gear, warships the gun deck's, pirates the captain's own.
  const slots: Slot[] = victim.npcRole === 'merchant' ? ['hold', 'ring', 'banner', 'compass', 'coat'] : victim.npcRole === 'pirate' ? [...CAPTAIN_SLOTS, 'battery', 'banner', 'quarters'] : [...SHIP_SLOTS.filter((x) => x !== 'tackle'), 'spyglass', 'hat', 'pistols'];
  return makeItem(game.rng, 0, { ilvl: victim.shipLevel, source: elite ? 'elite' : 'common', slots });
}

/** An item fished out of the water into the locker; a full locker leaves it floating. */
export function takeItem(game: Game, s: PlayerSession, it: Item): boolean {
  const p = s.profile!;
  if (p.stash.length >= STASH_SIZE) {
    game.sendTo(s, { t: 'toast', msg: `Your locker is full: ${itemName(it)} is left in the water.`, kind: 'bad' });
    return false;
  }
  p.stash.push({ ...it, uid: newUid(p) });
  game.sendTo(s, { t: 'toast', msg: `Found: ${itemName(it)} (${RARITY_NAMES[it.rarity][0]}, level ${it.ilvl}).`, kind: it.rarity >= 3 ? 'gold' : 'good' });
  return true;
}

