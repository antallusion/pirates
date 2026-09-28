// The ship's pets (docs/12 P10 #3): a cat, a parrot, a monkey, a dog — found at sea and ashore, bought from a
// tavern's pet seller, given by quests. One rides on deck at a time, for all to see, and does its trade: the cat
// keeps the rats down, the parrot screams at a hostile sail, the monkey robs the quay, the dog digs ashore.

import { PETS, PET_IDS, parrotCurse, petsForSale } from '../../../shared/src/data/companions.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import { compassPoint } from '../../../shared/src/data/companions.ts';
import type { PetsOwnView } from '../../../shared/src/protocol.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

const WARN_R = 2500;
const WARN_AGAIN_S = 300;
const CURSE_EVERY_S = 45;

export function sanitizePets(p: Profile): { owned: PetId[]; deck: PetId | null } {
  if (!p.pets) {
    p.pets = { owned: [], deck: null };
    // The derelict's cat of old: aboard already.
    if (p.shipCat) {
      p.pets.owned.push('cat');
      p.pets.deck = 'cat';
    }
  }
  return p.pets;
}

/** A cat on deck: the rats keep away and the stores last. */
export function catAboard(p: Profile | null | undefined): boolean {
  return !!p && sanitizePets(p).deck === 'cat';
}

/** A pet comes aboard (and to the deck, if the deck is empty). */
export function givePet(game: Game, s: PlayerSession, pet: PetId): boolean {
  const p = s.profile;
  if (!p) return false;
  const pets = sanitizePets(p);
  if (pets.owned.includes(pet)) return false;
  pets.owned.push(pet);
  if (!pets.deck) pets.deck = pet;
  if (pet === 'cat') p.shipCat = true;
  game.sendTo(s, { t: 'toast', msg: `A new pet aboard: ${PETS[pet].name[0]}.`, kind: 'gold' });
  sendPetsOwn(game, s);
  return true;
}

export function petAction(game: Game, s: PlayerSession, action: string, pet: string | null): string | null {
  const p = s.profile!;
  const pets = sanitizePets(p);
  switch (action) {
    case 'deck': {
      const id = pet === null || pet === '' ? null : (pet as PetId);
      if (id !== null && !pets.owned.includes(id)) return 'That pet is not yours.';
      pets.deck = id;
      if (id) game.sendTo(s, { t: 'toast', msg: `${PETS[id].name[0]} is on deck now.`, kind: 'good' });
      break;
    }
    case 'buy': {
      const id = pet as PetId;
      if (!PET_IDS.includes(id)) return 'Unknown pet';
      const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
      if (!port || !petsForSale(port.id, Math.floor(game.wallNow() / 86_400_000)).includes(id)) return 'No pet seller here has that one.';
      if (pets.owned.includes(id)) return 'You have that pet already.';
      if (p.gold < PETS[id].price) return 'Not enough silver';
      p.gold -= PETS[id].price;
      game.db.ledger(s.accountId, 'pet', -PETS[id].price, id);
      givePet(game, s, id);
      game.pushSelf(s, true);
      break;
    }
    default:
      return 'Unknown order';
  }
  sendPetsOwn(game, s);
  return null;
}

const warned = new WeakMap<PlayerSession, Map<number, number>>();
const cursedAt = new WeakMap<PlayerSession, number>();

/** Every second: the parrot's watch and its tongue. */
export function stepPets(game: Game): void {
  for (const s of game.sessions) {
    const p = s.profile, ship = s.ship;
    if (!p?.pets || p.pets.deck !== 'parrot' || !ship || ship.docked || !ship.alive) continue;
    const seen = warned.get(s) ?? new Map<number, number>();
    warned.set(s, seen);
    for (const [id, brain] of game.npcs) {
      if (brain.target !== ship.id) continue;
      const o = game.ships.get(id);
      if (!o?.alive) continue;
      const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
      if (d > WARN_R || game.now - (seen.get(id) ?? -1e9) < WARN_AGAIN_S) continue;
      seen.set(id, game.now);
      const pt = compassPoint(o.state.x - ship.state.x, o.state.y - ship.state.y);
      game.sendTo(s, { t: 'toast', msg: `The parrot screams: “Sail to the ${pt[0]}! Sail to the ${pt[0]}!”`, kind: 'bad' });
    }
    if (ship.inCombat(game.now) && game.now - (cursedAt.get(s) ?? -1e9) > CURSE_EVERY_S) {
      cursedAt.set(s, game.now);
      game.sendTo(s, { t: 'toast', msg: `The parrot screeches at the enemy: ${parrotCurse(game.rng.int(0, 9))[0]}`, kind: 'info' });
    }
  }
}

/** In port: the monkey works the quay. */
export function petsOnDock(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile;
  if (!p?.pets || p.pets.deck !== 'monkey') return;
  const r = game.rng.float();
  if (r < 0.06) {
    const fine = game.rng.int(50, 150);
    p.gold = Math.max(0, p.gold - fine);
    game.sendTo(s, { t: 'toast', msg: `Your monkey is caught at it: the harbour watch fines you ${fine} silver.`, kind: 'bad' });
  } else if (r < 0.45) {
    const n = game.rng.int(15, 60) * (1 + port.size);
    p.gold += n;
    game.db.ledger(s.accountId, 'monkey', n, port.id);
    game.sendTo(s, { t: 'toast', msg: `Your monkey comes back from the quay with a stolen purse: ${n} silver.`, kind: 'gold' });
  }
}

/** Ashore: the dog digs; and now and then a pet comes back with the party. */
export function petsOnLand(game: Game, s: PlayerSession, island: Island, feature: string): void {
  const p = s.profile;
  if (!p) return;
  const pets = sanitizePets(p);
  if (pets.deck === 'dog' && game.rng.chance(0.3)) {
    if (game.rng.chance(0.6)) {
      const n = game.rng.int(30, 150);
      p.gold += n;
      game.db.ledger(s.accountId, 'dog', n, String(island.id));
      game.sendTo(s, { t: 'toast', msg: `Your dog digs by a rock and barks: ${n} silver in an old tin.`, kind: 'gold' });
    } else {
      game.sendTo(s, { t: 'toast', msg: 'Your dog sniffs out a buried scrap of chart.', kind: 'info' });
      mapChance(game, s, 1, 1, 'Dug up by your dog');
    }
  }
  if (feature === 'fishers' && !pets.owned.includes('dog') && game.rng.chance(0.05)) {
    game.sendTo(s, { t: 'toast', msg: 'A hamlet’s dog follows your party back aboard.', kind: 'info' });
    givePet(game, s, 'dog');
  }
  if ((island.biome === 'jungle' || island.biome === 'mangrove') && !pets.owned.includes('monkey') && game.rng.chance(0.05)) {
    game.sendTo(s, { t: 'toast', msg: 'A monkey drops out of the trees onto your boat and will not leave.', kind: 'info' });
    givePet(game, s, 'monkey');
  }
}

export function petsOwnView(p: Profile): PetsOwnView {
  const pets = sanitizePets(p);
  return { owned: [...pets.owned], deck: pets.deck };
}

export function sendPetsOwn(game: Game, s: PlayerSession): void {
  if (s.profile) game.sendTo(s, { t: 'petsown', view: petsOwnView(s.profile) });
}
