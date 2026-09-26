// Smuggling rules (docs/03_TALENT_TREES.md §4.6): signature and who can see you, customs searches and bribes,
// jettisoned casks, hidden coves, night fences and the Black Ledger, witnesses for Nobody's Ship,
// hunters losing a ghost wake, and the actives (False Colors, Slip Away, Decoy Barrels).

import { pointsInTree } from '../../../shared/src/data/talents.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { FACTIONS, wantedLevel } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { quoteSell } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

// ------------------------------------------------------------------ signature & sight

/** How visible a ship is (1 = normal). Talents are capped at −30% (03 §3.3); actives hide separately. */
export function signature(ship: ShipEntity): number {
  let sig = Math.max(-0.3, tx(ship.stats, 'signature') + (ship.captain === 'smuggler' ? -0.1 : 0));
  const silent = tx(ship.stats, 'silentRunning');
  if (silent > 0 && ship.state.speed <= ship.stats.maxSpeed * 0.5) sig -= 0.08 * silent;
  return Math.max(0.4, 1 + sig);
}

/** Range at which `target` shows up for another captain, or Infinity for an ordinary ship. */
export function visibleRange(game: Game, target: ShipEntity, observer: ShipEntity): number {
  if (target.hasFlag('dark_lanterns') && isNight(game.now)) return 250;
  const sig = signature(target);
  if (sig >= 1) return Infinity;
  const w = game.weatherOf(target);
  let r = 2200 * sig * (w === 'fog' ? 0.55 : w === 'rain' || w === 'storm' || w === 'black_storm' ? 0.8 : 1) * (isNight(game.now) ? 0.8 : 1);
  if (w === 'fog' && observer.hasFlag('fog_sense')) r *= 1.5;
  return Math.max(250, r);
}

// ------------------------------------------------------------------ customs

/** Chance that customs find contraband: an open hold ~60%, a hidden compartment ~10%, smugglers' own ships never. */
export function searchChance(ship: ShipEntity, hidden: boolean): number {
  if (ship.captain === 'smuggler') return 0; // Mara Quill's False Bottom: never found
  const base = hidden ? 0.1 * Math.max(0, 1 + tx(ship.stats, 'hiddenSearch')) : Math.max(0.05, 0.6 + tx(ship.stats, 'openSearch'));
  // The Mark of the Deep: every ten points in Abyssal, black veins in the canvas and 10% more zealous searches.
  const mark = 1 + 0.1 * Math.floor(pointsInTree(ship.talents, 'abyssal') / 10);
  return Math.min(1, (ship.hasFlag('nobodys_ship') ? base * 0.5 : base) * mark);
}

/** Customs at a lawful port. Returns the list of seized lots. */
export function customsSearch(game: Game, s: PlayerSession, port: Port): string[] {
  const ship = s.ship!;
  const p = s.profile!;
  if (!FACTIONS[port.faction].lawful) return [];
  const hidden = ship.hasFlag('false_bottom');
  const seized: string[] = [];
  for (const id in ship.cargo) {
    const g = id as GoodId;
    let n = ship.cargo[g] ?? 0;
    if (!GOODS[g].contraband || n <= 0) continue;
    // Forged Papers rank 2: the Brokers' stamp passes League customs.
    const stamped = port.faction === 'league' ? Math.min(n, p.smuggle.stamped[g] ?? 0) : 0;
    n -= stamped;
    if (n <= 0 || !game.rng.chance(searchChance(ship, hidden))) continue;
    seized.push(`${n} ${GOODS[g].name}`);
    ship.cargo[g] = (ship.cargo[g] ?? 0) - n;
    if (!ship.cargo[g]) delete ship.cargo[g];
  }
  if (seized.length) game.addInfamy(ship, 8, 'smuggling');
  return seized;
}

export function contrabandValue(ship: ShipEntity): number {
  let v = 0;
  for (const id in ship.cargo) if (GOODS[id as GoodId].contraband) v += (ship.cargo[id as GoodId] ?? 0) * GOODS[id as GoodId].basePrice;
  return v;
}

/** What the customs officer wants to look the other way (Greased Palms: −25% per rank). */
export function bribeCost(ship: ShipEntity): number {
  return Math.max(20, Math.round((contrabandValue(ship) * 0.12 + 40) * Math.max(0.2, 1 + tx(ship.stats, 'bribe'))));
}

/** Greased Palms rank 2: a bribe opens a lawful port at Wanted 1–2. Friend of the Brokers: once a voyage, Wanted 3 in a Crown port. */
export function dockOverride(ship: ShipEntity, p: Profile, port: Port, bribing: boolean): 'bribe' | 'broker' | null {
  const w = wantedLevel(p.infamy);
  const def = FACTIONS[port.faction];
  if (w <= def.dockMaxWanted) return null;
  if (bribing && def.lawful && w <= 2 && ship.rank('smg_greased_palms') >= 2) return 'bribe';
  if (port.faction === 'crown' && w <= 3 && ship.hasFlag('broker_friend') && !p.smuggle.brokerPassUsed) return 'broker';
  return null;
}

// ------------------------------------------------------------------ black market prices

/** Sale multipliers for smuggling talents, folded into PriceMods.goodSell. */
export function smugglingSellMul(ship: ShipEntity, port: Port, good: GoodId): number {
  let m = 1;
  const contraband = GOODS[good].contraband;
  if (contraband && port.blackMarket) m *= 1 + tx(ship.stats, 'fence');
  const dg = tx(ship.stats, 'dangerousGoods');
  if (dg > 0 && (good === 'cursed_relics' || (good === 'gunpowder' && REGIONS[port.region].safety === 'safe'))) m *= 1 + dg;
  if (ship.hasFlag('black_ledger')) m *= contraband ? 1.2 : 0.8;
  return m;
}

/** A fence away from Fogmouth: night markets, Black Ledger contacts and hidden coves pay against Fogmouth's book. */
export function fenceSale(game: Game, s: PlayerSession, good: GoodId, qty: number, factor: number, where: string): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!GOODS[good]?.contraband) return 'The fence only deals in contraband';
  const have = Math.floor(ship.cargo[good] ?? 0);
  const n = Math.min(have, Math.max(1, Math.floor(qty)));
  if (n <= 0) return 'You carry none';
  const fog = game.markets.get('fogmouth')?.goods[good];
  if (!fog) return 'No one buys that';
  const mods = { buyMul: 1, sellMul: ship.stats.sellMul, lawfulPort: false, honest: false, duty: 0 };
  const price = Math.floor(quoteSell(good, fog, n, mods) * factor * (1 + tx(ship.stats, 'fence')) * (ship.hasFlag('black_ledger') ? 1.2 : 1));
  ship.cargo[good] = have - n;
  if (!ship.cargo[good]) delete ship.cargo[good];
  if (p.stolen[good]) p.stolen[good] = Math.max(0, p.stolen[good]! - n);
  p.gold += price;
  p.stats.sold += price;
  game.db.ledger(s.accountId, 'sell', price, `${n} ${good} @ ${where}`);
  game.sendTo(s, { t: 'toast', msg: `The fence takes ${n} ${GOODS[good].name.toLowerCase()} for ${price} silver.`, kind: 'gold' });
  return null;
}

/** Is there a fence in this port for this captain right now? Returns the price factor against Fogmouth. */
export function portFence(game: Game, ship: ShipEntity, port: Port): number | null {
  if (port.blackMarket) return null; // the real black market is on the market board
  const safety = REGIONS[port.region].safety;
  if (safety === 'safe') return null;
  if (ship.hasFlag('black_ledger')) return 1;
  if (ship.hasFlag('night_market') && isNight(game.now)) return 0.85;
  return null;
}

// ------------------------------------------------------------------ hidden coves

export interface Cove {
  id: number;
  name: string;
  x: number;
  y: number;
}

/** Six coves among the Whispering islands, the same in every world with this seed. */
export function buildCoves(game: Game): Cove[] {
  const isles = game.world.islands.filter((i) => i.region === 'whispering' && !i.portId && i.radius > 250);
  const out: Cove[] = [];
  const step = Math.max(1, Math.floor(isles.length / 6));
  for (let k = 0; k < 6 && k * step < isles.length; k++) {
    const is: Island = isles[k * step];
    // A notch on the lee shore: push the first coast vertex out to deep enough water.
    const px = is.poly[0], py = is.poly[1];
    const dx = px - is.x, dy = py - is.y, d = Math.hypot(dx, dy) || 1;
    out.push({ id: k, name: `${is.name} Cove`, x: px + (dx / d) * 90, y: py + (dy / d) * 90 });
  }
  return out;
}

export function coveAt(game: Game, ship: ShipEntity): Cove | null {
  for (const c of game.coves) if (dist(c.x, c.y, ship.state.x, ship.state.y) < 300) return c;
  return null;
}

/** Once a second: coves are found by sailing close. */
export function discoverCoves(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  for (const c of game.coves) {
    if (s.profile!.smuggle.coves.includes(c.id)) continue;
    if (dist(c.x, c.y, ship.state.x, ship.state.y) < 450) {
      s.profile!.smuggle.coves.push(c.id);
      game.sendTo(s, { t: 'toast', msg: `A hidden cove behind ${c.name.replace(' Cove', '')}: smugglers' water.`, kind: 'good' });
    }
  }
}

/** L in a cove: every piece of contraband goes to the cove's buyers at 90% of Fogmouth. */
export function coveSell(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const cove = coveAt(game, ship);
  if (!cove) return 'No cove here';
  if (ship.state.speed > 2.5) return 'Heave to first';
  let any = false;
  for (const id of Object.keys(ship.cargo) as GoodId[]) {
    if (!GOODS[id].contraband || (ship.cargo[id] ?? 0) < 1) continue;
    fenceSale(game, s, id, Math.floor(ship.cargo[id] ?? 0), 0.9, `cove ${cove.id}`);
    any = true;
  }
  return any ? null : 'Nothing the cove buyers want';
}

// ------------------------------------------------------------------ Nobody's Ship: witnesses

export interface PendingCrime {
  account: number;
  amount: number;
  reason: string;
  witnesses: number[];
  due: number;
}

/** Instead of Wanted now, a crime in contested waters waits to see if anyone lives to tell. */
export function deferCrime(game: Game, ship: ShipEntity, amount: number, reason: string): boolean {
  if (!ship.hasFlag('nobodys_ship') || REGIONS[ship.region].safety !== 'contested' || ship.accountId === null) return false;
  const witnesses: number[] = [];
  game.forShipsNear(ship.state.x, ship.state.y, 800, (o) => {
    if (o.id !== ship.id && o.alive && o.ownerId !== ship.id) witnesses.push(o.id);
  });
  game.crimes.push({ account: ship.accountId, amount, reason, witnesses, due: game.now + 600 });
  return true;
}

export function settleCrimes(game: Game): void {
  const keep: PendingCrime[] = [];
  for (const c of game.crimes) {
    if (c.due > game.now) {
      keep.push(c);
      continue;
    }
    // A witness who sailed away still talks; only the drowned keep quiet.
    const told = c.witnesses.some((id) => !game.sunkRecently.has(id));
    const ship = game.shipOfAccount(c.account);
    const p = ship ? game.profileOf(ship) : null;
    if (!told || !ship || !p) continue;
    p.infamy = Math.min(900, p.infamy + c.amount);
    ship.wantedCache = wantedLevel(p.infamy);
    game.toastShip(ship, `A witness lived to talk: Wanted ${ship.wantedCache} (${c.reason}).`, 'bad');
  }
  game.crimes = keep;
}

// ------------------------------------------------------------------ hunters and ghost wakes

/** Called every think of a hunter: out of sight, a ghost wake may throw it off the trail. */
export function loseTrail(game: Game, hunter: ShipEntity, hunted: ShipEntity): boolean {
  const gw = tx(hunted.stats, 'ghostWake');
  if (gw <= 0 || hunter.talentReady.trail > game.now) return false;
  hunter.talentReady.trail = game.now + 10;
  if (dist(hunter.state.x, hunter.state.y, hunted.state.x, hunted.state.y) < hunter.stats.detection * signature(hunted)) return false;
  return game.rng.chance(Math.min(0.9, gw));
}

// ------------------------------------------------------------------ actives

export function falseColors(game: Game, ship: ShipEntity): string | null {
  let patrolNear = false;
  game.forShipsNear(ship.state.x, ship.state.y, 300, (o) => {
    if (o.npcRole === 'patrol' && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) < 150) patrolNear = true;
  });
  if (patrolNear) return 'Not under the nose of a patrol';
  ship.addEffect({ id: 'false_colors', until: game.now + 1800, flags: ['false_colors'] }, game.now);
  game.refreshInfo(ship);
  return null;
}

/** Unmask False Colors (firing, or a patrol alongside). */
export function unmask(game: Game, ship: ShipEntity, why: string): void {
  if (!ship.hasEffect('false_colors')) return;
  ship.effects = ship.effects.filter((e) => e.id !== 'false_colors');
  ship.recompute(game.now);
  game.refreshInfo(ship);
  const p = game.profileOf(ship);
  if (p) p.talentCooldowns.smg_false_colors = game.now + 300 * ship.stats.cooldownMul;
  game.toastShip(ship, `Your false colours are struck: ${why}.`, 'bad');
}

export function slipAway(game: Game, ship: ShipEntity): string | null {
  const w = game.weatherOf(ship);
  if (!isNight(game.now) && w !== 'fog') return 'Slip Away needs night or fog';
  let enemyNear = false;
  game.forShipsNear(ship.state.x, ship.state.y, 220, (o) => {
    if (o.id !== ship.id && o.alive && game.isHostile(o, ship) && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) < 200) enemyNear = true;
  });
  if (enemyNear) return 'Too close to an enemy to slip away';
  ship.addEffect({ id: 'slip_away', until: game.now + 20, flags: ['hidden'] }, game.now);
  // Pursuers lose the lock.
  for (const [id, b] of game.npcs) {
    if (b.target === ship.id || b.chase?.id === ship.id) {
      b.target = null;
      b.chase = null;
      b.spared.set(ship.id, game.now + 20);
      void id;
    }
  }
  return null;
}

export function decoyBarrels(game: Game, ship: ShipEntity): string | null {
  const back = { x: -Math.sin(ship.state.heading), y: Math.cos(ship.state.heading) };
  for (let i = 0; i < 3; i++) {
    game.dropDecoy(ship.state.x + back.x * (30 + i * 15) + (game.rng.float() - 0.5) * 20, ship.state.y + back.y * (30 + i * 15) + (game.rng.float() - 0.5) * 20);
  }
  for (const b of game.npcs.values()) {
    if ((b.target === ship.id || b.chase?.id === ship.id) && game.rng.chance(0.5)) {
      b.target = null;
      b.chase = null;
      b.spared.set(ship.id, game.now + 8);
    }
  }
  return null;
}
