// Crew as people (docs/02 §8): professional pools with shared veterancy, named officers with traits,
// wages, loyalty and the Codex share, the morale ladder, wounds and deaths of officers, betrayal and
// the three-phase road to mutiny, tavern hiring, press gangs and prisoners who sign on.

import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { levelNear } from './npc.ts';
import { FACTIONS, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import {
  FIRST_NAMES, LAST_NAMES, OFFICER_DEFS, OFFICER_ROLES, PROFESSIONS, PROFESSION_DEFS, TRAITS, UNIQUE_OFFICERS, officerSlots, skillMul,
} from '../../../shared/src/data/crew.ts';
import type { Officer, OfficerRole, Profession, TraitId } from '../../../shared/src/data/crew.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { Flag, StatKey, StatMods } from '../../../shared/src/data/stats.ts';
import { dist } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { changeRep } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { escortUpkeep } from './fleet.ts';
import { grantDeed } from './progression.ts';
import { onboardingProtected } from './onboarding.ts';
import { PRACTICE_PER_LEVEL, practiceLevel } from '../../../shared/src/data/crewtalk.ts';
import { logNote } from './captainlog.ts';

export type Pools = Record<Profession, number>;

export interface Company {
  pools: Pools;
  skill: number; // 1..5 stars
  loyalty: number; // 0..100, the crew's
  share: number; // Codex: 0..50% of plunder to the crew
  officers: Officer[];
  traits: TraitId[]; // the crew's character
  fights: number; // since the crew last changed a lot
  owed: number; // wages owed
  unpaid: number; // seconds of unpaid wages
  unrest: { phase: 0 | 1 | 2 | 3; t: number };
  voyageStartCrew: number;
  voyageLost: number;
  memoryUntil: number;
  memorial: { name: string; role: OfficerRole; t: number; cause: string }[];
  mutiny: { at: number; mutineers: number; ringleader: string } | null;
  course: string | null; // after yielding to a mutiny: the port they steer for
  uniquesGone: string[];
  ghostsSeen: boolean;
  seaHours: number;
  /** The trades' practice points (docs/16 #18): grown by doing the work. */
  practice: Pools;
  /** The wounded below, kept with her between voyages (docs/16 #19), and the fractions of healing, dying, medicine. */
  wounded: number;
  woundAcc: { heal: number; die: number; med: number };
}

export const MUTINY_TIMEOUT = 60;
const PHASE_TIME = 600;
const PHASE_NAMES = ['', 'murmuring', 'disobedient', 'in mutiny'];

// ------------------------------------------------------------------ composition

/** The crew a new captain starts with: mostly sailors, a few gunners, a carpenter and a cook. */
export function startingPools(captain: CaptainId, crew: number): Pools {
  const p: Pools = { sailor: 0, gunner: 0, helmsman: 0, carpenter: 0, surgeon: 0, marine: 0, cook: 0 };
  const gunners = Math.round(crew * (captain === 'corsair' || captain === 'admiral' ? 0.25 : 0.18));
  const marines = Math.round(crew * (captain === 'reaver' ? 0.2 : 0.05));
  p.gunner = gunners;
  p.marine = marines;
  p.carpenter = Math.max(1, Math.round(crew * 0.05));
  p.cook = 1;
  p.helmsman = captain === 'navigator' ? 1 : 0;
  p.sailor = Math.max(0, crew - gunners - marines - p.carpenter - p.cook - p.helmsman);
  return p;
}

export function newCompany(captain: CaptainId, crew: number): Company {
  return {
    pools: startingPools(captain, crew), skill: 2, loyalty: 60, share: 25, officers: [], traits: [], fights: 0, owed: 0, unpaid: 0,
    unrest: { phase: 0, t: 0 }, voyageStartCrew: crew, voyageLost: 0, memoryUntil: 0, memorial: [], mutiny: null, course: null, uniquesGone: [], ghostsSeen: false, seaHours: 0,
    practice: emptyPools(), wounded: 0, woundAcc: { heal: 0, die: 0, med: 0 },
  };
}

export function sanitizeCompany(p: Profile): void {
  const c = (p.company ??= newCompany(p.captain, p.crew));
  c.pools ??= startingPools(p.captain, p.crew);
  for (const k of PROFESSIONS) c.pools[k] = Math.max(0, Math.floor(c.pools[k] ?? 0));
  c.skill = Math.max(1, Math.min(5, c.skill ?? 2));
  c.loyalty = Math.max(0, Math.min(100, c.loyalty ?? 60));
  c.share = Math.max(0, Math.min(50, c.share ?? 25));
  c.officers ??= [];
  c.traits ??= [];
  c.fights ??= 0;
  c.owed ??= 0;
  c.unpaid ??= 0;
  c.unrest ??= { phase: 0, t: 0 };
  c.voyageStartCrew ??= p.crew;
  c.voyageLost ??= 0;
  c.memoryUntil ??= 0;
  c.memorial ??= [];
  c.mutiny ??= null;
  c.course ??= null;
  c.uniquesGone ??= [];
  c.ghostsSeen ??= false;
  c.seaHours ??= 0;
  c.practice = { ...emptyPools(), ...(c.practice ?? {}) };
  for (const k of PROFESSIONS) c.practice[k] = Math.max(0, Number(c.practice[k]) || 0);
  c.wounded = Math.max(0, Math.floor(c.wounded ?? 0));
  c.woundAcc ??= { heal: 0, die: 0, med: 0 };
}

export function emptyPools(): Pools {
  return { sailor: 0, gunner: 0, helmsman: 0, carpenter: 0, surgeon: 0, marine: 0, cook: 0 };
}

export function poolTotal(pools: Pools): number {
  let n = 0;
  for (const k of PROFESSIONS) n += pools[k];
  return n;
}

/** Keep the pools in step with the head count: losses and returns fall across trades by their share. */
export function reconcile(game: Game, c: Company, crew: number): void {
  let diff = crew - poolTotal(c.pools);
  if (diff === 0) return;
  if (poolTotal(c.pools) === 0) {
    c.pools.sailor += Math.max(0, diff);
    return;
  }
  const rng = game.rng;
  while (diff !== 0) {
    // Pick a trade weighted by its head count (sailors take most of it).
    const total = poolTotal(c.pools);
    let r = rng.float() * Math.max(1, total);
    let pick: Profession = 'sailor';
    for (const k of PROFESSIONS) {
      r -= c.pools[k];
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    if (diff > 0) {
      c.pools[pick]++;
      diff--;
    } else {
      if (c.pools[pick] <= 0) pick = PROFESSIONS.find((k) => c.pools[k] > 0) ?? 'sailor';
      if (c.pools[pick] <= 0) break;
      c.pools[pick]--;
      diff++;
    }
  }
}

// ------------------------------------------------------------------ what the crew does to the ship

export function officerFactor(o: Officer, now: number): number {
  if (o.awayUntil && o.awayUntil > now) return 0;
  const w = o.wound && o.wound.until > now ? (o.wound.heavy ? 0.5 : 0.75) : 1;
  return w * (1 + (o.level - 1) * 0.02);
}

/** Officer berths: by hull, the wardroom, and Veteran Officers. */
export function officerBerths(ship: ShipEntity): number {
  return officerSlots(ship.cls.tier, ship.loadout.modules.crew_quarters ?? 0) + (tx(ship.stats, 'veteranOfficers') >= 1 ? 1 : 0);
}

/** Morale lost to hits and deaths (Steady Voice, Inspiring Presence). */
export function moraleLossMul(ship: ShipEntity): number {
  return Math.max(0.1, 1 + tx(ship.stats, 'moraleLoss'));
}

export function hasOfficer(c: Company | undefined, role: OfficerRole, now: number): boolean {
  return !!c?.officers.some((o) => o.role === role && officerFactor(o, now) > 0);
}

/** The company's standing modifiers: trades against their norms, veterancy, officers and traits. */
export function companyMods(ship: ShipEntity, c: Company, now: number): { mods: StatMods; flags: Flag[] } {
  const mods: StatMods = {};
  const flags: Flag[] = [];
  const add = (k: StatKey, v: number) => (mods[k] = (mods[k] ?? 0) + v);
  const q = skillMul(c.skill);
  // Drill Master: a veteran crew (three stars or better) works faster.
  const drill = tx(ship.stats, 'drill');
  if (drill > 0 && c.skill >= 3) {
    add('reloadMul', -0.02 * drill);
    add('repairRate', 0.02 * drill);
  }
  const crew = Math.max(1, ship.crew);
  const P = c.pools;
  // Gunners: one per gun on a side is a full battery; veterancy sharpens it.
  const g = Math.min(1, P.gunner / Math.max(1, ship.stats.gunsPerSide));
  add('reloadMul', (1 - g) * 0.15 - (q - 1) * 0.25 * g);
  add('spreadMul', -(q - 1) * 0.3 * g);
  // Helmsman: +2% turn per star above three.
  if (P.helmsman > 0) add('turnRate', Math.max(0, c.skill - 3) * 0.02 + 0.02);
  // Carpenters: about one in twenty.
  const carp = Math.min(1.5, P.carpenter / Math.max(1, crew * 0.05));
  add('repairRate', (carp - 1) * 0.3 + (q - 1) * 0.2);
  // Surgeons: each per fifty men turns 15% of the dead into wounded (to 60%).
  if (!ship.hasFlag('crew_of_drowned')) add('surgeon', Math.min(0.6, (P.surgeon / Math.max(1, crew / 50)) * 0.15));
  // Marines: double weight in a boarding.
  add('boardingPower', (P.marine / crew) * q);
  // Cooks: one per forty men.
  if (P.cook >= Math.max(1, Math.ceil(crew / 40))) {
    add('moraleBase', 5);
    add('provisionUse', -0.1);
    flags.push('well_fed');
  }
  for (const o of c.officers) {
    // Field Promotion: in a fight a sailor stands in for a fallen officer at 50/75%. Veteran Officers rank 2: +10%.
    const promo = ship.inCombat(now) ? [0, 0.5, 0.75][Math.min(2, tx(ship.stats, 'fieldPromotion'))] : 0;
    const f = Math.max(officerFactor(o, now), promo) * (tx(ship.stats, 'veteranOfficers') >= 2 ? 1.1 : 1);
    if (f <= 0) continue;
    const def = OFFICER_DEFS[o.role];
    for (const k in def.mods ?? {}) add(k as StatKey, (def.mods![k as StatKey] ?? 0) * f);
    for (const fl of def.flags ?? []) flags.push(fl);
    for (const t of o.traits) {
      const td = TRAITS[t];
      for (const k in td.mods ?? {}) add(k as StatKey, (td.mods![k as StatKey] ?? 0) * f);
      if (t === 'fog_born') flags.push('fog_born');
    }
  }
  for (const t of c.traits) for (const k in TRAITS[t].mods ?? {}) add(k as StatKey, TRAITS[t].mods![k as StatKey] ?? 0);
  // The trades' practice (docs/16 #18): a small edge a level, while any of that trade are aboard.
  for (const k of PROFESSIONS) {
    const lv = P[k] > 0 ? practiceLevel(c.practice?.[k] ?? 0) : 0;
    const e = PRACTICE_PER_LEVEL[k];
    if (lv > 0 && e.key !== 'heal') add(e.key, e.v * lv);
  }
  // Superstition: cursed cargo and black storms unsettle them.
  const superstitious = c.traits.includes('superstitious') || c.officers.some((o) => o.traits.includes('superstitious'));
  if (superstitious && ((ship.cargo.cursed_relics ?? 0) > 0)) add('moraleBase', -5);
  // Memory of a fallen officer steadies them.
  return { mods, flags };
}

/** Morale ladder (docs/02 §8.A.4) for any ship. */
export function stepSpirit(game: Game, ship: ShipEntity): void {
  const m = ship.morale;
  const mods: StatMods = m >= 80 ? { reloadMul: -0.1, boardingPower: 0.1 }
    : m >= 50 ? {}
    : m >= 30 ? { reloadMul: 0.1, repairRate: -0.1 }
    : m >= 15 ? { reloadMul: 0.25, repairRate: -0.25, boardingPower: -0.1 }
    : { reloadMul: 0.4, repairRate: -0.4, boardingPower: -0.2 };
  const cur = ship.effects.find((e) => e.id === 'spirit');
  const key = JSON.stringify(mods);
  if (cur && JSON.stringify(cur.mods ?? {}) === key) return;
  ship.effects = ship.effects.filter((e) => e.id !== 'spirit');
  if (Object.keys(mods).length) ship.effects.push({ id: 'spirit', until: Infinity, mods });
  ship.recompute(game.now);
}

export function moraleWord(m: number): string {
  return m >= 80 ? 'inspired' : m >= 50 ? 'steady' : m >= 30 ? 'anxious' : m >= 15 ? 'panicking' : 'broken';
}

export function applyCompany(game: Game, ship: ShipEntity, c: Company): void {
  const { mods, flags } = companyMods(ship, c, game.now);
  const key = JSON.stringify([mods, flags]);
  if (ship.companyKey === key) return;
  ship.companyKey = key;
  ship.effects = ship.effects.filter((e) => e.id !== 'company');
  ship.effects.push({ id: 'company', until: Infinity, mods, flags });
  ship.recompute(game.now);
}

// ------------------------------------------------------------------ wages, loyalty, unrest

/** Fair Share trims the wage bill. */
export function wageMul(ship: ShipEntity | null): number {
  return ship ? Math.max(0.2, 1 + tx(ship.stats, 'wages')) : 1;
}

export function wagesPerHour(c: Company): number {
  let w = 0;
  for (const k of PROFESSIONS) w += c.pools[k] * PROFESSION_DEFS[k].wage;
  for (const o of c.officers) w += OFFICER_DEFS[o.role].wage + o.level;
  return w;
}

/** The share the crew thinks fair: greedy officers want half again; a quartermaster talks them down. */
export function expectedShare(c: Company, now: number): number {
  let e = 20;
  if (c.officers.some((o) => o.traits.includes('greedy'))) e *= 1.5;
  if (hasOfficer(c, 'quartermaster', now)) e -= 5;
  for (const o of c.officers) {
    const u = UNIQUE_OFFICERS.find((x) => x.id === o.unique);
    if (u?.minShare) e = Math.max(e, u.minShare);
  }
  return e;
}

function loyaltyGrowth(c: Company, now: number): number {
  let m = hasOfficer(c, 'quartermaster', now) ? 1.2 : 1;
  if (c.traits.includes('pressed')) m *= 0.5;
  return m;
}

export function changeLoyalty(c: Company, delta: number, now: number): void {
  const d = delta > 0 ? delta * loyaltyGrowth(c, now) : delta;
  c.loyalty = Math.max(0, Math.min(100, c.loyalty + d));
  for (const o of c.officers) o.loyalty = Math.max(0, Math.min(100, o.loyalty + d * (o.traits.includes('pressed') ? 0.5 : 1)));
}

/** Effective loyalty (a fallen officer's memory adds 5 for a week). */
export function loyaltyOf(c: Company, now: number): number {
  return Math.min(100, c.loyalty + (c.memoryUntil > now ? 5 : 0));
}

/** Plunder comes in: the Codex share goes to the crew, and they judge it. Returns what the captain keeps. */
export function plunderShare(game: Game, s: PlayerSession, amount: number): number {
  const p = s.profile!;
  const c = p.company;
  if (amount <= 0) return amount;
  const now = game.now;
  const paid = Math.round(amount * c.share / 100);
  const exp = expectedShare(c, now);
  if (c.share >= exp) changeLoyalty(c, 2 * Math.max(0.5, (c.share - exp) / 10 + 0.5), now);
  else if (c.share < exp - 5) changeLoyalty(c, -3, now);
  return amount - paid;
}

/** Once a second for a player: the life of the crew. */
export function stepCompany(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const p = s.profile!;
  const c = p.company;
  const now = game.now;
  reconcile(game, c, ship.crew);
  applyCompany(game, ship, c);
  // Officers come back from captivity; wounds heal (twice as fast with surgeons aboard).
  for (const o of c.officers) {
    if (o.awayUntil && o.awayUntil <= now) {
      o.awayUntil = undefined;
      game.toastShip(ship, `${o.name} is back aboard — ransomed out of a prison hulk.`, 'good');
    }
    if (o.wound && c.pools.surgeon > 0 && o.wound.until > now) o.wound.until -= 1;
    if (o.wound && o.wound.until <= now) o.wound = null;
  }
  // The dead weigh on the living: −1 loyalty for every 5% of the crew lost.
  // Acting officers step down when the fight is over.
  if (!ship.inCombat(now) && c.officers.some((o) => o.acting)) {
    c.officers = c.officers.filter((o) => !o.acting);
    ship.companyKey = '';
  }
  if (ship.crewDeaths > 0) {
    c.voyageLost += ship.crewDeaths;
    changeLoyalty(c, -(ship.crewDeaths / Math.max(1, ship.stats.crewMax)) * 20, now);
    ship.crewDeaths = 0;
  }
  if (ship.docked) {
    c.unrest = { phase: 0, t: 0 };
    return;
  }
  // Wages accrue at sea and are paid every ten minutes.
  c.owed += (wagesPerHour(c) * wageMul(ship) + escortUpkeep(p, ship)) / 3600;
  c.seaHours += 1 / 3600;
  if ((ship.talentReady.payday ?? 0) === 0) ship.talentReady.payday = now + 600;
  if (now >= ship.talentReady.payday) {
    ship.talentReady.payday = now + 600;
    const due = Math.round(c.owed);
    if (due > 0 && p.gold >= due) {
      p.gold -= due;
      game.db.ledger(s.accountId, 'wages', -due, '');
      c.owed -= due;
      c.unpaid = 0;
    } else if (due > 0) {
      game.toastShip(ship, `Wages are due and the chest is short (${due} silver). The crew remembers.`, 'bad');
    }
  }
  if (c.owed >= 1 && p.gold < c.owed) c.unpaid++;
  changeLoyalty(c, c.unpaid > 0 ? -5 / 3600 : 1 / 3600, now);
  // Crown sailors sour on a wanted captain; ex-convicts on a Crown licence.
  const wanted = wantedLevel(p.infamy);
  for (const o of c.officers) {
    if (o.traits.includes('crown_sailor') && wanted >= 2) o.loyalty = Math.max(0, o.loyalty - 1 / 3600);
    if (o.traits.includes('ex_convict') && (p.licences.crown ?? 0) > now) o.loyalty = Math.max(0, o.loyalty - 1 / 3600);
    if (o.traits.includes('coward') && game.weatherOf(ship) === 'fog') ship.morale = Math.max(0, ship.morale - 0.05);
  }
  // Veterancy grows with hours at sea (a star in ~20 h) and storms.
  const w = game.weatherOf(ship);
  c.skill = Math.min(5, c.skill + (w === 'storm' || w === 'black_storm' ? 0.0003 : 0.00005) * (1 + 0.25 * tx(ship.stats, 'drill')));
  if (!c.ghostsSeen) {
    game.forShipsNear(ship.state.x, ship.state.y, 900, (o) => {
      if (o.npcRole === 'ghost' && !c.ghostsSeen) {
        c.ghostsSeen = true;
        if (!c.traits.includes('superstitious')) c.traits.push('superstitious');
        game.toastShip(ship, 'The crew has seen a dead ship sail. They will never be quite the same (trait: Superstitious).', 'bad');
      }
    });
  }
  stepUnrest(game, s);
  stepBetrayalWarnings(game, s);
}

function stepUnrest(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const c = s.profile!.company;
  const now = game.now;
  if (c.mutiny) {
    if (now - c.mutiny.at >= MUTINY_TIMEOUT) resolveMutiny(game, s, 'yield');
    return;
  }
  const loyal = loyaltyOf(c, now);
  const bad = !ship.hasFlag('crew_of_drowned') && loyal < 25 && ship.morale < (ship.hasFlag('fear_and_respect') ? 15 : 30);
  const slow = hasOfficer(c, 'quartermaster', now) ? 1.5 : 1;
  if (!bad) {
    if (c.unrest.phase > 0 || c.unrest.t > 0) {
      c.unrest.t = Math.max(0, c.unrest.t - 2);
      if (c.unrest.t === 0 && c.unrest.phase > 0) {
        c.unrest.phase = 0;
        game.toastShip(ship, 'The muttering dies down. The crew is back to its work.', 'good');
      }
    }
  } else {
    c.unrest.t++;
    if (c.unrest.t >= PHASE_TIME * slow && c.unrest.phase < 3) {
      c.unrest.phase = (c.unrest.phase + 1) as 1 | 2 | 3;
      c.unrest.t = 0;
      if (c.unrest.phase === 3) startMutiny(game, s, 'the grievances boiled over');
      else game.toastShip(ship, c.unrest.phase === 1
        ? 'The crew is murmuring. Loyalty and morale are low: rum, pay or a course for port will help.'
        : 'The crew is disobedient: orders come late and a fifth of the men will not board.', 'bad');
    }
  }
  // Losing four in ten on one voyage is a mutiny all by itself.
  if (!c.mutiny && !ship.hasFlag('crew_of_drowned') && c.voyageStartCrew > 5 && c.voyageLost > c.voyageStartCrew * 0.4 && loyal < 60) {
    c.voyageLost = 0;
    startMutiny(game, s, 'too many dead this voyage');
  }
  if (c.unrest.phase >= 2 && !c.mutiny) ship.addEffect({ id: 'disobedience', until: now + 1.6, mods: { reloadMul: 0.1, boardingPower: -0.2 } }, now);
}

export function unrestWord(c: Company): string {
  return c.mutiny ? 'MUTINY' : PHASE_NAMES[c.unrest.phase] ?? '';
}

/** Madness of the deep (sanity 0–10) tests loyalty every minute. */
export function madnessCheck(game: Game, s: PlayerSession): void {
  const c = s.profile!.company;
  if (c.mutiny || s.ship?.hasFlag('crew_of_drowned')) return;
  const chance = (loyaltyOf(c, game.now) < 50 ? 0.25 : 0.08) * (hasOfficer(c, 'quartermaster', game.now) ? 0.5 : 1);
  if (game.rng.chance(chance)) startMutiny(game, s, 'the deep called and they answered');
}

export function startMutiny(game: Game, s: PlayerSession, why: string): void {
  const c = s.profile!.company;
  const ship = s.ship!;
  if (c.mutiny || ship.docked) return;
  // With boarders on deck the crew fights first and settles its grievances after.
  if (ship.boarding) return;
  // The First Watch is a lesson: no crew rises against a captain still learning the ropes.
  if (onboardingProtected(s)) return;
  // The mutineers already hold the helm (a mutiny given in to, bound for port): there is nobody left to rise.
  if (c.course) return;
  const mutineers = Math.max(1, Math.round(ship.crew * Math.min(0.8, 0.3 + (100 - loyaltyOf(c, game.now)) / 200)));
  const ringleader = `${game.rng.pick(FIRST_NAMES)} ${game.rng.pick(LAST_NAMES)}`;
  c.mutiny = { at: game.now, mutineers, ringleader };
  c.unrest = { phase: 3, t: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.toastShip(ship, `MUTINY! ${ringleader} and ${mutineers} men seize the waist — ${why}.`, 'bad');
  game.sendTo(s, { t: 'mutiny', ringleader, mutineers, payCost: mutinyPayCost(c), timeout: MUTINY_TIMEOUT });
}

export function mutinyPayCost(c: Company): number {
  return Math.round(wagesPerHour(c) * 3);
}

/** Pay them off, put it down, give in, or fight the ringleader. */
export function resolveMutiny(game: Game, s: PlayerSession, choice: 'pay' | 'suppress' | 'yield' | 'duel'): string | null {
  const p = s.profile!;
  const c = p.company;
  const ship = s.ship!;
  const now = game.now;
  const m = c.mutiny;
  if (!m) return 'There is no mutiny';
  const end = (msg: string, kind: 'good' | 'bad' | 'info') => {
    c.mutiny = null;
    grantDeed(game, s, 'deed_mutiny'); // put down, paid off or lived through
    c.unrest = { phase: 0, t: 0 };
    game.toastShip(ship, msg, kind);
    game.sendTo(s, { t: 'mutiny', ringleader: '', mutineers: 0, payCost: 0, timeout: 0 });
  };
  if (choice === 'pay') {
    const cost = mutinyPayCost(c);
    if (p.gold < cost) return `Three hours' wages is ${cost} silver`;
    p.gold -= cost;
    game.db.ledger(s.accountId, 'mutiny', -cost, 'paid');
    c.owed = 0;
    c.unpaid = 0;
    changeLoyalty(c, 15, now);
    ship.morale = Math.min(100, ship.morale + 10);
    end(`Silver on the capstan: ${cost}. The men go back to their stations.`, 'info');
    return null;
  }
  if (choice === 'suppress') {
    // Marines and officers (and whoever stays loyal) against the mutineers, by the boarding weights.
    const loyalMen = Math.max(0, ship.crew - m.mutineers);
    const marines = Math.min(c.pools.marine, loyalMen);
    const ours = (loyalMen - marines) * 1 + marines * 2 + c.officers.filter((o) => officerFactor(o, now) > 0).length * 3;
    const theirs = m.mutineers * 1.1 / (ship.hasFlag('fear_and_respect') ? 1.25 : 1);
    const win = game.rng.chance(ours / Math.max(1, ours + theirs));
    if (win) {
      const lost = Math.max(1, Math.round(m.mutineers * 0.2));
      ship.crew = Math.max(1, ship.crew - lost);
      changeLoyalty(c, 20, now);
      ship.morale = Math.max(0, ship.morale - 15);
      end(`The mutiny is put down. ${m.ringleader} and ${lost - 1} others hang from the yard or lie in irons.`, 'good');
      return null;
    }
    resolveMutiny(game, s, 'yield');
    return null;
  }
  if (choice === 'duel') {
    const skill = 0.35 + p.level / 150 + 0.02 * (countTree(p, 'command') + countTree(p, 'boarding'));
    if (game.rng.chance(Math.min(0.9, skill))) {
      ship.crew = Math.max(1, ship.crew - 1);
      changeLoyalty(c, 10, now);
      ship.morale = Math.min(100, ship.morale + 10);
      end(`You cut ${m.ringleader} down on the quarterdeck. Nobody else steps forward.`, 'good');
      return null;
    }
    ship.hull = Math.max(1, ship.hull - ship.stats.hullMax * 0.02);
    game.toastShip(ship, `${m.ringleader} beats you in front of the whole crew.`, 'bad');
    resolveMutiny(game, s, 'yield');
    return null;
  }
  // Yield: they sail her to the nearest port, where half of them walk away.
  let best: Port | null = null;
  let bd = Infinity;
  for (const pt of game.world.ports) {
    const d = dist(pt.x, pt.y, ship.state.x, ship.state.y);
    if (d < bd) {
      bd = d;
      best = pt;
    }
  }
  c.course = best?.id ?? null;
  end(`You give in. The crew sets course for ${best?.name ?? 'the nearest port'}; half of them will walk off there.`, 'bad');
  return null;
}

function countTree(p: Profile, tree: string): number {
  let n = 0;
  for (const id in p.talents) if (id.startsWith(tree === 'command' ? 'cmd_' : 'brd_')) n += p.talents[id] ?? 0;
  return n;
}

/** After yielding, the mutineers steer; returns the port they are bound for. */
export function mutinyCourse(game: Game, ship: ShipEntity, c: Company): Port | null {
  if (!c.course) return null;
  return game.portById(c.course) ?? null;
}

// ------------------------------------------------------------------ betrayal

function stepBetrayalWarnings(game: Game, s: PlayerSession): void {
  const c = s.profile!.company;
  const now = game.now;
  for (const o of c.officers) {
    if (o.traits.includes('greedy') && o.loyalty < 15 && o.warnedAt === undefined) {
      o.warnedAt = now;
      game.toastShip(s.ship!, `${o.name} counts the silver in the chest a little too often. (Loyalty ${Math.round(o.loyalty)} — a game day to win him back.)`, 'bad');
    }
    // A turned enemy of low loyalty looks to his old flag (docs/12 P10 #16).
    if (o.traits.includes('former_enemy') && o.loyalty < 15 && o.warnedAt === undefined) {
      o.warnedAt = now;
      game.toastShip(s.ship!, `${o.name} watches the horizon for his old flag. (Loyalty ${Math.round(o.loyalty)} — a game day to win him back.)`, 'bad');
    }
    if (o.warnedAt !== undefined && o.loyalty >= 25) o.warnedAt = undefined;
  }
}

/** On docking: panicked crews desert, mutineers walk off, and a greedy officer may betray you. */
export function onDockCrew(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!;
  const c = p.company;
  const ship = s.ship!;
  const now = game.now;
  // A mutiny still on when she makes port ends there: the harbour watch comes aboard and the ringleaders go ashore.
  if (c.mutiny) {
    c.mutiny = null;
    c.unrest = { phase: 0, t: 0 };
    c.course = c.course ?? port.id;
    game.sendTo(s, { t: 'mutiny', ringleader: '', mutineers: 0, payCost: 0, timeout: 0 });
  }
  if (c.course) {
    const gone = Math.floor(ship.crew * 0.5);
    ship.crew = Math.max(1, ship.crew - gone);
    c.course = null;
    c.loyalty = Math.max(c.loyalty, 40);
    game.toastShip(ship, `${gone} mutineers walk down the gangway at ${port.name} and do not look back.`, 'bad');
  } else if (ship.morale < 30 && ship.morale >= 15) {
    const gone = Math.max(1, Math.floor(ship.crew * 0.05));
    ship.crew = Math.max(1, ship.crew - gone);
    game.toastShip(ship, `${gone} frightened men desert in ${port.name}.`, 'bad');
  }
  for (const o of [...c.officers]) {
    if (o.warnedAt === undefined || now - o.warnedAt < 7200 || o.loyalty >= 15) continue;
    c.officers = c.officers.filter((x) => x !== o);
    if (o.unique) c.uniquesGone.push(o.unique);
    if (game.rng.chance(0.5)) {
      const took = Math.round(p.gold * 0.05);
      p.gold -= took;
      game.db.ledger(s.accountId, 'betrayal', -took, o.name);
      game.toastShip(ship, `${o.name} is gone in the night — with ${took} silver from the chest.`, 'bad');
    } else {
      p.crewAmbush = now;
      game.toastShip(ship, `${o.name} is gone — and the Fog Brokers have bought your sailing plans from him.`, 'bad');
    }
  }
  c.voyageStartCrew = ship.crew;
  c.voyageLost = 0;
  c.unrest = { phase: 0, t: 0 };
}

/** A sold route: when she next puts to sea, hunters are waiting. */
export function springAmbush(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  if (!p.crewAmbush) return;
  p.crewAmbush = 0;
  const ship = s.ship!;
  for (let i = 0; i < 2; i++) {
    const a = game.rng.float() * Math.PI * 2;
    const x = ship.state.x + Math.sin(a) * 1600, y = ship.state.y - Math.cos(a) * 1600;
    const lv = levelNear(game, ship, game.regionAt(x, y));
    const hunter = game.spawnNpcShip('pirate', game.rng.pick(hullsFor('pirate', lv)), 'confederacy', x, y, a + Math.PI);
    game.setNpcLevel(hunter, lv);
    const b = game.npcs.get(hunter.id);
    if (b) b.chase = { id: ship.id, until: game.now + 300 };
  }
  game.toastShip(ship, 'Sails on the horizon, closing fast. Somebody knew where you would be.', 'bad');
}

// ------------------------------------------------------------------ officers: wounds, deaths, orders

export function woundOfficer(game: Game, s: PlayerSession, heavy: boolean, why: string, who?: Officer): void {
  const c = s.profile!.company;
  const now = game.now;
  const pool = c.officers.filter((o) => officerFactor(o, now) > 0);
  if (!pool.length && !who) return;
  const o = who ?? game.rng.pick(pool);
  const light = o.traits.includes('lucky') && heavy && game.rng.chance(0.5);
  o.wound = { until: now + (heavy && !light ? 1800 : 600), heavy: heavy && !light };
  game.toastShip(s.ship!, `${o.name} is ${heavy && !light ? 'badly' : 'lightly'} wounded (${why}).`, 'bad');
}

export function killOfficer(game: Game, s: PlayerSession, o: Officer, cause: string): void {
  const c = s.profile!.company;
  c.officers = c.officers.filter((x) => x !== o);
  if (o.acting) return;
  // Field Promotion: someone steps into his shoes until the fight is over.
  const ship = s.ship!;
  if (tx(ship.stats, 'fieldPromotion') > 0 && ship.inCombat(game.now)) {
    c.officers.push({ ...o, id: `acting-${o.id}`, name: `Acting ${OFFICER_DEFS[o.role].name.toLowerCase()}`, traits: [], wound: { until: 0, heavy: true }, acting: true, unique: undefined, orderReady: game.now + 30 });
  }
  if (o.unique) c.uniquesGone.push(o.unique);
  c.memorial.push({ name: o.name, role: o.role, t: Date.now(), cause });
  if (c.memorial.length > 30) c.memorial.shift();
  c.memoryUntil = game.now + 7 * 86400;
  logNote(game, s, 'officer_dead', [o.name, cause]); // the captain's log (docs/16 #20)
  game.toastShip(s.ship!, `${o.name}, your ${OFFICER_DEFS[o.role].name.toLowerCase()}, is dead — ${cause}. The crew will remember.`, 'bad');
}

/** Powder goes up: the officer nearest the magazine may die (1 in 5, 1 in 10 if lucky). */
export function onMagazineBlast(game: Game, s: PlayerSession): void {
  const c = s.profile!.company;
  const o = c.officers.find((x) => x.role === 'master_gunner' || x.role === 'alchemist') ?? c.officers[0];
  if (!o) return;
  if (game.rng.chance(o.traits.includes('lucky') ? 0.1 : 0.2)) killOfficer(game, s, o, 'the magazine went up under him');
  else woundOfficer(game, s, true, 'the magazine blast');
}

/** She goes down: officers are wounded, some taken, and in lawless water without boats a few drown. */
export function onSunkCrew(game: Game, s: PlayerSession): void {
  const c = s.profile!.company;
  const ship = s.ship!;
  const now = game.now;
  const lawless = REGIONS[ship.region].safety === 'lawless';
  const boats = tx(ship.stats, 'lifeboats');
  for (const o of [...c.officers]) {
    if (lawless && !boats && game.rng.chance(o.traits.includes('lucky') ? 0.05 : 0.1)) {
      killOfficer(game, s, o, 'lost when the ship went down');
      continue;
    }
    o.wound = { until: now + 1800, heavy: true };
    if (game.rng.chance(0.15)) o.awayUntil = now + 3600;
  }
  changeLoyalty(c, -5, now);
  c.fights = 0;
}

/** A fight won: veterancy, officer experience and — over fifty fights together — a seasoned crew. */
export function onFightWon(game: Game, s: PlayerSession): void {
  const c = s.profile!.company;
  c.skill = Math.min(5, c.skill + 0.03 * (1 + 0.25 * tx(s.ship!.stats, 'drill')));
  c.fights++;
  changeLoyalty(c, 1, game.now);
  if (c.fights >= 50 && !c.traits.includes('seasoned')) {
    c.traits.push('seasoned');
    game.toastShip(s.ship!, 'Fifty fights without breaking up: your crew is Seasoned.', 'good');
  }
  for (const o of c.officers) {
    o.xp += 20 * (1 + tx(s.ship!.stats, 'officerXp'));
    const need = 60 + o.level * 40;
    if (o.xp >= need && o.level < 20) {
      o.xp -= need;
      o.level++;
      game.toastShip(s.ship!, `${o.name} is now level ${o.level}.`, 'good');
    }
  }
  if (game.rng.chance(0.08)) woundOfficer(game, s, false, 'in the fight');
}

export function officerOrder(game: Game, s: PlayerSession, officerId: string): string | null {
  const c = s.profile!.company;
  const ship = s.ship!;
  const now = game.now;
  const o = c.officers.find((x) => x.id === officerId);
  if (!o) return 'No such officer';
  if (officerFactor(o, now) <= 0) return `${o.name} is not aboard`;
  if (o.orderReady > now) return `${OFFICER_DEFS[o.role].order.name} is not ready`;
  if (c.unrest.phase >= 2 || c.mutiny) return 'The crew will not take orders';
  const f = officerFactor(o, now);
  switch (o.role) {
    case 'lieutenant':
      ship.morale = Math.min(100, ship.morale + 15 * f);
      break;
    case 'boatswain':
      ship.addEffect({ id: 'all_hands', until: now + 15, mods: { repairRate: 0.25 * f, leakInflow: -0.25 * f } }, now);
      break;
    case 'quartermaster': {
      const p = s.profile!;
      const cost = Math.round(p.gold * 0.02);
      p.gold -= cost;
      if (cost) game.db.ledger(s.accountId, 'shares', -cost, o.name);
      changeLoyalty(c, 8 * f, now);
      break;
    }
    case 'master_gunner':
      ship.addEffect({ id: 'lay_true', until: now + 20, mods: { spreadMul: -0.3 * f } }, now);
      break;
    case 'pilot':
      ship.addEffect({ id: 'sound_ahead', until: now + 12, mods: { turnRate: 0.2 * f } }, now);
      break;
    case 'alchemist':
      if ((ship.cargo.whale_oil ?? 0) < 1 || (ship.cargo.gunpowder ?? 0) < 1) return 'Needs a barrel of whale oil and one of powder';
      ship.cargo.whale_oil! -= 1;
      ship.cargo.gunpowder! -= 1;
      if (!ship.cargo.whale_oil) delete ship.cargo.whale_oil;
      if (!ship.cargo.gunpowder) delete ship.cargo.gunpowder;
      ship.ammo.incendiary += 10;
      break;
    case 'deep_pastor':
      ship.sanity = Math.min(100, ship.sanity + 12 * f);
      ship.morale = Math.min(100, ship.morale + 5);
      break;
    case 'sailmaker':
      ship.sails = Math.min(ship.stats.sailHpMax, ship.sails + ship.stats.sailHpMax * 0.15 * f);
      break;
    case 'harpooner':
      if (!ship.loadout.mount) return 'No deck mount to load';
      ship.mountReload = 0;
      break;
  }
  o.orderReady = now + OFFICER_DEFS[o.role].order.cooldown;
  game.toastShip(ship, `${o.name}: “${OFFICER_DEFS[o.role].order.name}”`, 'info');
  return null;
}

// ------------------------------------------------------------------ taverns: recruits, officers, press gangs

export interface OfficerOffer {
  id: string;
  name: string;
  role: OfficerRole;
  level: number;
  traits: TraitId[];
  price: number;
  loyalty: number;
  unique?: string;
  story?: string;
  rep?: number;
}

export interface Tavern {
  epoch: number;
  stars: number;
  stock: Partial<Record<Profession, number>>;
  officers: OfficerOffer[];
  hired: string[];
}

function seeded(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The tavern's company for this half hour: specialists by region, visiting officers, and the local legend. */
export function tavernOf(game: Game, port: Port): Tavern {
  const epoch = Math.floor(game.now / 1800);
  const cur = game.taverns.get(port.id);
  if (cur && cur.epoch === epoch) return cur;
  const r = seeded(hash(`${port.id}:${epoch}:${game.world.seed}`));
  const region = port.region;
  const stars = region === 'black_coast' ? 1 + r() : port.id === 'cinderhold' ? 2 + r() : 1.5 + r() * 1.5;
  const stock: Partial<Record<Profession, number>> = {
    gunner: 2 + port.size + (port.faction === 'confederacy' ? 3 : 0),
    carpenter: 1 + Math.floor(port.size / 2),
    surgeon: port.size >= 2 ? 1 : 0,
    marine: 1 + (port.faction === 'confederacy' ? 4 : port.faction === 'crown' ? 2 : 0),
    cook: 1,
    helmsman: port.size >= 2 ? 1 : 0,
  };
  const officers: OfficerOffer[] = [];
  const favoured: OfficerRole[] = port.id === 'harpoon_rest' ? ['harpooner'] : port.id === 'saint_maw' ? ['deep_pastor', 'alchemist'] : port.id === 'fogmouth' ? ['pilot'] : [];
  const visitors = (port.size >= 2 ? 1 : 0) + (r() < 0.6 ? 1 : 0);
  const danger = REGIONS[region].safety === 'safe' ? 1 : REGIONS[region].safety === 'contested' ? 3 : 5;
  for (let i = 0; i < visitors; i++) {
    const role: OfficerRole = favoured.length && r() < 0.6 ? favoured[Math.floor(r() * favoured.length)] : r() < 0.45 ? 'lieutenant' : OFFICER_ROLES[1 + Math.floor(r() * (OFFICER_ROLES.length - 1))];
    const rollable = (Object.keys(TRAITS) as TraitId[]).filter((t) => TRAITS[t].rollable);
    const traits: TraitId[] = [];
    const nt = 2 + (r() < 0.4 ? 1 : 0);
    while (traits.length < nt) {
      const t = rollable[Math.floor(r() * rollable.length)];
      if (!traits.includes(t)) traits.push(t);
    }
    const level = 1 + Math.floor(r() * (danger + 3));
    officers.push({
      id: `${port.id}:${epoch}:${i}`, name: `${FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]}`,
      role, level, traits, price: Math.round((150 + level * 60) * (OFFICER_DEFS[role].rare ? 1.6 : 1)), loyalty: port.faction === 'confederacy' ? 35 : 50,
      rep: OFFICER_DEFS[role].rare ? 5 : 0,
    });
  }
  for (const u of UNIQUE_OFFICERS) {
    if (u.port !== port.id) continue;
    officers.push({ id: `unique:${u.id}`, name: u.name, role: u.role, level: u.level, traits: [...u.traits], price: 900 + u.level * 100, loyalty: 50, unique: u.id, story: u.story, rep: u.rep });
  }
  const t: Tavern = { epoch, stars, stock, officers, hired: cur?.epoch === epoch ? cur.hired : [] };
  game.taverns.set(port.id, t);
  return t;
}

export function recruitCost(game: Game, port: Port, p: Profile, prof: Profession, ship: ShipEntity | null = null): number {
  const base = 22 + p.level * 1.5 + (port.size >= 3 ? 6 : 0) + (FACTIONS[port.faction].lawful ? 4 : 0);
  let mul = PROFESSION_DEFS[prof].hireMul;
  // Press Gang: sailors cheaper; Legend at the Helm: the Confederacy signs for less.
  if (ship && prof === 'sailor') mul *= Math.max(0.3, 1 + tx(ship.stats, 'hireCost'));
  if (ship?.hasFlag('legend_at_helm') && port.faction === 'confederacy') mul *= 0.8;
  return Math.max(1, Math.round(base * mul));
}

/** Hire men of a trade. Sailors come from the waterfront; specialists from the tavern's stock. */
export function hireTrade(game: Game, s: PlayerSession, port: Port, prof: Profession, qty: number, dregs = false): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const c = p.company;
  if (!PROFESSIONS.includes(prof) || !Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 400) return 'Bad number';
  reconcile(game, c, ship.crew);
  if (qty < 0) {
    const n = Math.min(-qty, c.pools[prof], ship.crew - 1);
    if (n <= 0) return `No ${PROFESSION_DEFS[prof].name.toLowerCase()} to discharge`;
    c.pools[prof] -= n;
    ship.crew -= n;
    return null;
  }
  // Crew of the Drowned: lawful ports will not sign the living onto a dead ship.
  if (ship.hasFlag('crew_of_drowned') && (port.faction === 'crown' || port.faction === 'league')) return 'No living sailor here will sign onto a ship of the dead';
  const tav = tavernOf(game, port);
  const avail = prof === 'sailor' ? Math.floor(game.tavernCrew.get(port.id) ?? 0) : Math.floor(tav.stock[prof] ?? 0);
  const room = ship.stats.crewMax - ship.crew;
  const n = Math.min(qty, avail, room);
  if (n <= 0) return room <= 0 ? 'No hammocks left aboard' : `No ${PROFESSION_DEFS[prof].name.toLowerCase()} looking for a berth here`;
  // Press Gang rank 2: the dregs of a lawless port, at half price and morale 30.
  const scum = dregs && prof === 'sailor' && ship.rank('cmd_press_gang') >= 2 && REGIONS[port.region].safety === 'lawless';
  if (dregs && !scum) return 'Only a practised press-gang captain finds the dregs, and only in lawless ports';
  const cost = Math.round(n * recruitCost(game, port, p, prof, ship) * (scum ? 0.5 : 1));
  if (p.gold < cost) return 'Not enough silver';
  p.gold -= cost;
  game.db.ledger(s.accountId, 'crew', -cost, `${port.id}:${prof}`);
  const newMorale = scum ? 30 : ship.hasFlag('legend_at_helm') ? 80 : 62;
  ship.morale = (ship.morale * ship.crew + newMorale * n) / (ship.crew + n);
  // New hands dilute veterancy and loyalty by their share.
  const total = ship.crew + n;
  c.skill = (c.skill * ship.crew + tav.stars * n) / total;
  c.loyalty = (c.loyalty * ship.crew + (port.faction === 'confederacy' ? 35 : 50) * n) / total;
  if (n > ship.crew * 0.2) c.fights = 0;
  // New hands of a trade thin its practice by their share (docs/16 #18).
  c.practice[prof] = (c.practice[prof] ?? 0) * c.pools[prof] / Math.max(1, c.pools[prof] + n);
  // Into the army (docs/17 H1): marines to the marines' stack, gunners to the musketeers', the rest as deckhands —
  // or as seasoned sailors from a tavern of veterans.
  ship.addMen(prof === 'marine' ? 'marine' : prof === 'gunner' ? 'musketeer' : tav.stars >= 3.5 ? 'sailor' : 'deckhand', n);
  c.pools[prof] += n;
  if (prof === 'sailor') game.tavernCrew.set(port.id, avail - n);
  else tav.stock[prof] = avail - n;
  return null;
}

export function hireOfficer(game: Game, s: PlayerSession, port: Port, offerId: string): string | null {
  const p = s.profile!;
  const c = p.company;
  const ship = s.ship!;
  const tav = tavernOf(game, port);
  const offer = tav.officers.find((o) => o.id === offerId);
  if (!offer || tav.hired.includes(offerId)) return 'Nobody by that name is drinking here';
  if (offer.unique && (c.uniquesGone.includes(offer.unique) || c.officers.some((o) => o.unique === offer.unique))) return `${offer.name} will not sail with you`;
  const slots = officerBerths(ship);
  if (c.officers.length >= slots) return `Your ship has berths for ${slots} officer${slots === 1 ? '' : 's'}`;
  if (offer.rep && (p.reputation[port.faction as FactionId] ?? 0) < offer.rep) return `${offer.name} wants a captain ${FACTIONS[port.faction].short} trusts (${offer.rep}+)`;
  if (p.gold < offer.price) return `${offer.name} wants ${offer.price} silver to sign`;
  p.gold -= offer.price;
  game.db.ledger(s.accountId, 'officer', -offer.price, offer.name);
  const u = UNIQUE_OFFICERS.find((x) => x.id === offer.unique);
  c.officers.push({
    id: `o${game.allocId()}`, name: offer.name, role: offer.role, level: offer.level, xp: 0, traits: [...offer.traits],
    loyalty: Math.min(100, offer.loyalty + (u?.loyaltyFor === p.captain ? 20 : 0)), wound: null, unique: offer.unique, hiredAt: game.now, orderReady: 0,
  });
  if (!offer.unique) tav.hired.push(offerId);
  ship.companyKey = '';
  game.toastShip(ship, `${offer.name} signs the articles as your ${OFFICER_DEFS[offer.role].name.toLowerCase()}.`, 'good');
  return null;
}

export function dismissOfficer(game: Game, s: PlayerSession, officerId: string): string | null {
  const c = s.profile!.company;
  const o = c.officers.find((x) => x.id === officerId);
  if (!o) return 'No such officer';
  c.officers = c.officers.filter((x) => x !== o);
  s.ship!.companyKey = '';
  game.toastShip(s.ship!, `${o.name} is paid off and goes ashore.`, 'info');
  return null;
}

/** Press gang (lawless ports only): cheap, fast, and the men hate you for it. */
export function pressGang(game: Game, s: PlayerSession, port: Port, qty: number): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const c = p.company;
  if (REGIONS[port.region].safety !== 'lawless') return 'Only lawless ports turn a blind eye to press gangs';
  const room = ship.stats.crewMax - ship.crew;
  const n = Math.min(qty, room, 20);
  if (n <= 0) return 'No hammocks left aboard';
  const cost = n * 6;
  if (p.gold < cost) return 'Not enough silver for the cudgels and rum';
  p.gold -= cost;
  reconcile(game, c, ship.crew);
  const total = ship.crew + n;
  c.loyalty = (c.loyalty * ship.crew + 10 * n) / total;
  c.skill = (c.skill * ship.crew + 1 * n) / total;
  if (n > ship.crew * 0.25 && !c.traits.includes('pressed')) c.traits.push('pressed');
  ship.crew += n;
  c.pools.sailor += n;
  ship.morale = Math.max(0, ship.morale - n * 0.5);
  return null;
}

/** Prisoners after a boarding: up to 30% of her surviving crew sign on (not with a cruel officer aboard). */
export function recruitPrisoners(game: Game, s: PlayerSession, target: ShipEntity, want: number): number {
  const ship = s.ship!;
  const c = s.profile!.company;
  if (c.officers.some((o) => o.traits.includes('cruel'))) return 0;
  const n = Math.max(0, Math.min(Math.floor(want), Math.floor(target.crew * 0.3), ship.stats.crewMax - ship.crew));
  if (n <= 0) return 0;
  reconcile(game, c, ship.crew);
  const total = ship.crew + n;
  c.loyalty = (c.loyalty * ship.crew + 20 * n) / total;
  // They sign on as the men they are (docs/17 H1, as HoMM3's creatures that join): her deckhands as deckhands, her
  // marines as marines.
  for (const x of target.loseMen(n)) ship.addMen(x.u, x.n);
  c.pools.sailor += n;
  return n;
}

export function maxRecruits(ship: ShipEntity, target: ShipEntity, c: Company): number {
  if (c.officers.some((o) => o.traits.includes('cruel'))) return 0;
  return Math.max(0, Math.min(Math.floor(target.crew * 0.3), ship.stats.crewMax - ship.crew));
}
