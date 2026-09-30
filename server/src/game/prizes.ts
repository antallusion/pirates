// What happens to a ship after she strikes: prizes sailed home under a prize crew and sold to a prize court,
// captive captains held for ransom, jolly-boat raids and ships that strike on terms (docs/03 §4.3).

import { FACTIONS, FACTION_IDS, factionRelation } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { dist } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { TrophyHistory } from '../../../shared/src/sim/shipstats.ts';
import { MAX_BERTHS } from './shipbuilding.ts';
import { boardingRangeBetween, canBoard, claimPrize, startBoatBoarding } from './boarding.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { changeRep } from './player.ts';
import { plunderShare } from './crew.ts';
import { questEvent } from './quests.ts';
import type { OfficerRole, TraitId } from '../../../shared/src/data/crew.ts';
import type { SkipperTrait } from '../../../shared/src/data/turncoats.ts';
import { rollCaptive } from './turncoats.ts';
import type { ShipEntity } from './ship.ts';

export const MAX_PRIZES = 2;
export const MAX_CAPTIVES = 3;

/** Men needed to sail her home, or null when she cannot be taken as a prize. */
export function prizeCrewNeeded(a: ShipEntity, b: ShipEntity): number | null {
  if (b.isPlayer || a.hasFlag('no_quarter') || b.sinkAt) return null;
  return Math.max(2, Math.ceil(b.cls.crewMin * 0.5 * Math.max(0.2, 1 - tx(a.stats, 'prizeCrew'))));
}

/** What a prize court pays: a quarter of her value by condition, plus her hold at half price. */
export function prizeValue(prize: ShipEntity, owner: ShipEntity | null): number {
  let v = SHIP_CLASSES[prize.loadout.classId].price * 0.25 * Math.max(0.2, prize.hull / prize.stats.hullMax);
  for (const id in prize.cargo) v += (prize.cargo[id as GoodId] ?? 0) * GOODS[id as GoodId].basePrice * 0.5;
  const broker = owner?.rank('trd_prize_broker') ? 1.15 : 1;
  return Math.round(v * broker);
}

export function prizesOf(game: Game, owner: ShipEntity): ShipEntity[] {
  const out: ShipEntity[] = [];
  for (const s of game.ships.values()) if (s.prize && s.ownerId === owner.id && s.alive) out.push(s);
  return out;
}

/** Who she was, and where, when and by whom she was taken: the story a trophy ship keeps (docs/16 #5). */
export function trophyHistory(game: Game, s: PlayerSession, target: ShipEntity, how: TrophyHistory['how']): TrophyHistory {
  return {
    was: target.name, cls: target.loadout.classId, faction: target.faction, ...(target.npcRole ? { role: target.npcRole } : {}), ...(target.captainName ? { captain: target.captainName } : {}),
    by: s.name, region: target.region, place: game.nearestIslandName(target.state.x, target.state.y), at: Date.now(), how,
  };
}

/** Put a prize crew aboard; she follows you and sells in the next port with a prize court — or, kept as a trophy
 *  (`keep`, docs/16 #5), she keeps her name and her story and goes to a berth there. */
export function takePrize(game: Game, s: PlayerSession, target: ShipEntity, keep?: TrophyHistory['how']): string | null {
  const ship = s.ship!;
  const need = prizeCrewNeeded(ship, target);
  if (need === null) return 'She cannot be taken as a prize';
  if (prizesOf(game, ship).length >= MAX_PRIZES) return `You can shepherd at most ${MAX_PRIZES} prizes`;
  if (ship.crew - need < Math.max(4, ship.stats.crewMin * 0.5)) return `A prize crew of ${need} would leave you short-handed`;
  if (keep && s.profile!.berths.length + prizesOf(game, ship).filter((p) => p.trophy).length >= MAX_BERTHS) return `No berth free for a trophy (${MAX_BERTHS} at most)`;
  if (keep) target.trophy = trophyHistory(game, s, target, keep);
  ship.crew -= need;
  target.crew = need;
  target.prize = true;
  target.ownerId = ship.id;
  target.faction = 'free';
  target.surrendered = false;
  target.lootLockedFor = null;
  target.morale = 60;
  if (!keep) target.name = `Prize ${target.name}`; // a trophy keeps her own
  // Prize Crew: patched up on the spot (Prize Refit: fully).
  target.hull = ship.hasFlag('prize_refit') ? target.stats.hullMax : Math.min(target.stats.hullMax, target.hull + target.stats.hullMax * (tx(ship.stats, 'prizeCrew') / 2));
  const brain = game.npcs.get(target.id);
  if (brain) {
    brain.active = true;
    brain.fleeFrom = null;
    brain.target = null;
    brain.chase = null;
    brain.path = null;
  }
  target.attackers.clear();
  if (keep) game.toastShip(ship, `${need} hands take the ${target.name} as your trophy. She will lie in a berth at the next port with a yard.`, 'good');
  else game.toastShip(ship, `${need} hands take ${target.name} as your prize. Bring her to any port with a yard.`, 'good');
  return null;
}

/** On docking: the prize court buys every prize close by, and the prize crews come home. */
export function sellPrizes(game: Game, s: PlayerSession, port: Port): void {
  const ship = s.ship!;
  if (port.shipyardTier < 1) return;
  for (const prize of prizesOf(game, ship)) {
    if (dist(prize.state.x, prize.state.y, port.x, port.y) > 3000) continue;
    // A trophy (docs/16 #5): into a berth here, her name and her story with her — unless every berth is taken.
    if (prize.trophy && s.profile!.berths.length < MAX_BERTHS) {
      const { gear: _gear, ...rest } = prize.loadout;
      void _gear;
      s.profile!.berths.push({ port: port.id, loadout: { ...rest, name: prize.trophy.was, trophy: prize.trophy }, hull: Math.max(0.2, prize.hull / prize.stats.hullMax) });
      ship.crew = Math.min(ship.stats.crewMax, ship.crew + prize.crew);
      game.sendTo(s, { t: 'toast', msg: `The ${prize.trophy.was} is warped into a berth at ${port.name}: your trophy, her name and her story kept.`, kind: 'gold' });
      game.removeShip(prize.id);
      questEvent(game, s, { k: 'prize' });
      continue;
    }
    if (prize.trophy) game.sendTo(s, { t: 'toast', msg: `No berth free for the ${prize.trophy.was}: the prize court buys her.`, kind: 'info' });
    const value = plunderShare(game, s, Math.round(prizeValue(prize, ship) * (ship.hasFlag('prize_refit') && (port.faction === 'free' || port.faction === 'confederacy') ? 1.2 : 1)));
    s.profile!.gold += value;
    ship.crew = Math.min(ship.stats.crewMax, ship.crew + prize.crew);
    game.db.ledger(s.accountId, 'prize', value, prize.loadout.classId);
    game.sendTo(s, { t: 'toast', msg: `The prize court of ${port.name} condemns ${prize.name}: ${value} silver.`, kind: 'gold' });
    game.removeShip(prize.id);
    questEvent(game, s, { k: 'prize' });
  }
}

/** The captor sank or left: prize crews are overwhelmed and the prizes are lost. */
export function losePrizes(game: Game, owner: ShipEntity): void {
  for (const prize of prizesOf(game, owner)) {
    game.toastShip(owner, `${prize.name} is retaken by her own people.`, 'bad');
    game.removeShip(prize.id);
  }
}

// ------------------------------------------------------------------ captives (Ransom)

export interface Captive {
  name: string;
  faction: FactionId;
  tier: number;
  taken: number;
  /** What he would make if turned (docs/12 P10 #16): an officer's post, traits and level, a skipper's gifts, and his
   *  loyalty in irons; the game day he last refused. */
  role?: OfficerRole;
  traits?: TraitId[];
  level?: number;
  skills?: SkipperTrait[];
  loyalty?: number;
  tried?: number;
}

/** Captains a boarding party brought back without the Ransom talent (half of them are taken; the talent takes all). */
const seized = new WeakSet<ShipEntity>();
export function seizeCaptain(target: ShipEntity): void {
  seized.add(target);
}

export function takeCaptive(game: Game, s: PlayerSession, target: ShipEntity): boolean {
  const p = s.profile!;
  if (!(s.ship!.hasFlag('ransom') || seized.has(target)) || s.ship!.hasFlag('no_quarter') || target.isPlayer || target.faction === 'player' || target.prize) return false;
  if (target.npcRole === 'ghost' || target.cls.monster) return false;
  if (p.captives.length >= MAX_CAPTIVES) return false;
  p.captives.push(rollCaptive(game, target));
  game.sendTo(s, { t: 'toast', msg: `${target.captainName} is clapped in irons below.`, kind: 'info' });
  return true;
}

export function captiveRansom(c: Captive, broker: boolean): number {
  return Math.round([200, 200, 500, 900, 1400, 2000][Math.min(5, c.tier)] * (broker ? 1.15 : 1));
}

/** Sell a captive back for silver, or hand him to his enemies for standing. */
export function captiveAction(game: Game, s: PlayerSession, port: Port, index: number, mode: 'ransom' | 'hand_over'): string | null {
  const p = s.profile!;
  const c = p.captives[index];
  if (!c) return 'No such captive';
  if (mode === 'ransom') {
    const v = plunderShare(game, s, captiveRansom(c, (s.ship?.rank('trd_prize_broker') ?? 0) > 0));
    p.gold += v;
    game.db.ledger(s.accountId, 'ransom', v, c.name);
    game.sendTo(s, { t: 'toast', msg: `${c.name}'s people pay ${v} silver for him.`, kind: 'gold' });
  } else {
    // His enemies pay in standing; his own flag does not forget.
    const enemies = FACTION_IDS.filter((f) => factionRelation(f, c.faction) <= -40 && f === port.faction);
    if (!enemies.length) return `${FACTIONS[port.faction].short} has no quarrel with ${FACTIONS[c.faction].short}`;
    changeRep(p, port.faction, 4 + c.tier * 2);
    changeRep(p, c.faction, -5);
    game.sendTo(s, { t: 'toast', msg: `${c.name} is handed to ${FACTIONS[port.faction].name}.`, kind: 'good' });
  }
  p.captives.splice(index, 1);
  return null;
}

// ------------------------------------------------------------------ Surrender Terms

/** Once a second: crippled NPCs in boarding range may strike on terms and hand over an intact hold. */
export function surrenderTerms(game: Game, ship: ShipEntity): void {
  if (!ship.hasFlag('surrender_terms') || ship.hasFlag('no_quarter') || ship.boarding) return;
  const s = game.sessionOf(ship);
  if (!s || s.pendingBoarding) return;
  game.forShipsNear(ship.state.x, ship.state.y, 200, (o) => {
    if (o.isPlayer || !o.alive || o.surrendered || o.boarding || o.prize || o.ownerId !== null) return;
    if (o.morale >= 20 || o.hull >= o.stats.hullMax * 0.4) return;
    if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > boardingRangeBetween(ship, o)) return;
    const key = `terms:${o.id}`;
    if (ship.talentReady[key]) return;
    ship.talentReady[key] = 1;
    if (!game.rng.chance(0.35) || s.pendingBoarding) return;
    o.surrendered = true;
    game.toastNear(o, `${o.name} strikes her colours without a fight!`);
    claimPrize(game, ship, o, 0, 0, 0, 'careful');
  });
}

// ------------------------------------------------------------------ Jolly Boat Raid

export interface JollyBoat {
  owner: number;
  target: number;
  party: number;
  arrive: number;
}

export function launchJollyBoat(game: Game, ship: ShipEntity): string | null {
  let target: ShipEntity | null = null;
  let bd = 150;
  game.forShipsNear(ship.state.x, ship.state.y, 180, (o) => {
    if (o.id === ship.id || !o.alive || o.docked || o.boarding) return;
    const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y) - o.stats.length / 2;
    if (d > bd) return;
    // The same conditions as a boarding, except distance and speed.
    const why = canBoard(game, ship, o);
    if (why && !/Too far|Match her speed/.test(why)) return;
    bd = d;
    target = o;
  });
  if (!target) return 'No crippled ship within 150 m for the boat';
  const party = Math.floor(ship.crew * 0.15);
  if (party < 3) return 'Too few hands to man the boat';
  ship.crew -= party;
  const t = target as ShipEntity;
  game.boats.push({ owner: ship.id, target: t.id, party, arrive: game.now + Math.max(4, bd / 6) });
  game.toastShip(ship, `The jolly boat pulls away with ${party} men for ${t.name}.`, 'info');
  return null;
}

/** Boats reach their target — or her guns reach the boat first. */
export function stepBoats(game: Game): void {
  const keep: JollyBoat[] = [];
  for (const b of game.boats) {
    if (b.arrive > game.now) {
      keep.push(b);
      continue;
    }
    const owner = game.ships.get(b.owner), target = game.ships.get(b.target);
    if (!owner || !owner.alive) continue;
    if (!target || !target.alive || target.boarding || owner.boarding) {
      owner.crew += b.party; // nothing to board: row home
      continue;
    }
    // Grape and swivels sweep a boat; a struck ship does not fire.
    const risk = target.surrendered ? 0 : 0.1 + (tx(target.stats, 'swivels') > 0 ? 0.3 : 0) + (target.ammo.grape > 0 && (target.reload.port <= 0 || target.reload.starboard <= 0) ? 0.15 : 0);
    if (game.rng.chance(risk)) {
      game.toastShip(owner, `${target.name}'s guns smash the jolly boat — ${b.party} men lost.`, 'bad');
      game.emit({ k: 'hit', x: Math.round(target.state.x), y: Math.round(target.state.y), ship: target.id, dmg: 0, ammo: 'grape' }, target.state.x, target.state.y);
      continue;
    }
    startBoatBoarding(game, owner, target, b.party);
  }
  game.boats = keep;
}
