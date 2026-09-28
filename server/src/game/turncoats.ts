// Captive captains in service (docs/12 P10 #16) on the server: a taken captain's post, traits, skipper's gifts and
// loyalty; turning him at a harbour master into an officer or a caravan skipper (he signs, refuses, or escapes); the
// skippers' pool, and a skipper of low loyalty sailing off with a hull of her caravan.

import { DAY_LENGTH_SEC } from '../../../shared/src/constants.ts';
import { OFFICER_DEFS, TRAITS } from '../../../shared/src/data/crew.ts';
import type { TraitId } from '../../../shared/src/data/crew.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import {
  DESERT_BELOW, DESERT_CHANCE, ESCAPE_BELOW, ESCAPE_CHANCE, LOYALTY_DAYS_MAX, LOYALTY_PER_DAY, LOYALTY_PER_VOYAGE, MAX_SKIPPERS,
  SKIPPER_TRAIT_IDS, TURN_COST_PER_TIER, captiveRoles,
} from '../../../shared/src/data/turncoats.ts';
import type { SkipperTrait } from '../../../shared/src/data/turncoats.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { officerBerths } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { Captive } from './prizes.ts';
import type { ShipEntity } from './ship.ts';

export interface Skipper {
  name: string;
  faction: FactionId;
  traits: SkipperTrait[];
  loyalty: number;
  voyages: number;
}

function rollInto(rng: { float(): number }, c: Captive, npcRole: string): Captive {
  const pick = <T>(a: readonly T[]) => a[Math.floor(rng.float() * a.length)];
  const roles = captiveRoles(npcRole);
  c.role ??= pick(roles);
  if (!c.traits) {
    const rollable = (Object.keys(TRAITS) as TraitId[]).filter((t) => TRAITS[t].rollable);
    const traits: TraitId[] = [];
    while (traits.length < 2) {
      const t = pick(rollable);
      if (!traits.includes(t)) traits.push(t);
    }
    c.traits = [...traits, 'former_enemy'];
  }
  c.level ??= Math.max(1, Math.min(12, 1 + c.tier * 2 + Math.floor(rng.float() * 3)));
  if (!c.skills) {
    const good = SKIPPER_TRAIT_IDS.filter((t) => t !== 'light_fingered');
    const skills: SkipperTrait[] = [pick(good)];
    if (rng.float() < 0.25) {
      const second = pick(good);
      if (!skills.includes(second)) skills.push(second);
    }
    if (rng.float() < 0.3) skills.push('light_fingered');
    c.skills = skills;
  }
  c.loyalty ??= 20 + Math.floor(rng.float() * 26);
  return c;
}

/** A captain in irons: what he commanded makes his post; his traits, gifts and loyalty are his own. */
export function rollCaptive(game: Game, target: ShipEntity): Captive {
  return rollInto(game.rng, { name: target.captainName, faction: target.faction as FactionId, tier: target.cls.tier, taken: game.now }, target.npcRole ?? '');
}

/** A captive taken before captives could be turned: the same man every time (by his name). */
export function sanitizeCaptive(c: Captive): Captive {
  if (c.role && c.traits && c.skills && c.loyalty !== undefined && c.level) return c;
  let h = 2166136261;
  for (const ch of c.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return rollInto(new Rng(h >>> 0), c, c.faction === 'confederacy' ? 'pirate' : c.faction === 'crown' ? 'patrol' : 'merchant');
}

/** His loyalty now: his own, softened by days in irons, and by how his flag regards her. */
export function captiveLoyalty(game: Game, p: Profile, c: Captive): number {
  sanitizeCaptive(c);
  const days = Math.max(0, Math.floor((game.now - c.taken) / DAY_LENGTH_SEC));
  const flag = Math.max(-15, Math.min(15, (p.reputation[c.faction] ?? 0) / 4));
  return Math.round(Math.max(0, Math.min(95, (c.loyalty ?? 20) + Math.min(LOYALTY_DAYS_MAX, days * LOYALTY_PER_DAY) + flag)));
}

export function turnCost(c: Captive): number {
  return TURN_COST_PER_TIER * Math.max(1, c.tier);
}

/** Offer him the articles: as an officer (a berth wanted) or a skipper of her caravans. */
export function turnCaptive(game: Game, s: PlayerSession, index: number, as: 'officer' | 'skipper'): string | null {
  const p = s.profile!;
  const c = p.captives[index];
  if (!c) return 'No such captive';
  sanitizeCaptive(c);
  const day = Math.floor(game.now / DAY_LENGTH_SEC);
  if (c.tried === day) return 'He will not hear of it again today.';
  const ship = s.ship;
  if (as === 'officer' && ship) {
    const slots = officerBerths(ship);
    if (p.company.officers.length >= slots) return `Your ship has berths for ${slots} officers`;
  }
  if (as === 'skipper' && (p.skippers ?? []).length >= MAX_SKIPPERS) return 'You have skippers enough.';
  const cost = turnCost(c);
  if (p.gold < cost) return 'Not enough silver';
  const loyalty = captiveLoyalty(game, p, c);
  const chance = Math.max(0.1, Math.min(0.9, loyalty / 100));
  if (!game.rng.chance(chance)) {
    if (loyalty < ESCAPE_BELOW && game.rng.float() < ESCAPE_CHANCE) {
      p.captives.splice(index, 1);
      game.sendTo(s, { t: 'toast', msg: `${c.name} slips his irons in the night and is gone.`, kind: 'bad' });
    } else {
      c.tried = day;
      game.sendTo(s, { t: 'toast', msg: `${c.name} spits on the deck: not yet.`, kind: 'info' });
    }
    return null;
  }
  p.gold -= cost;
  game.db.ledger(s.accountId, 'turncoat', -cost, c.name);
  p.captives.splice(index, 1);
  if (as === 'officer') {
    p.company.officers.push({
      id: `o${game.allocId()}`, name: c.name, role: c.role!, level: c.level!, xp: 0, traits: [...c.traits!],
      loyalty, wound: null, hiredAt: game.now, orderReady: 0,
    });
    if (ship) ship.companyKey = '';
    game.sendTo(s, { t: 'toast', msg: `${c.name} signs the articles: your ${OFFICER_DEFS[c.role!].name.toLowerCase()}.`, kind: 'good' });
  } else {
    p.skippers = [...(p.skippers ?? []), { name: c.name, faction: c.faction, traits: [...c.skills!], loyalty, voyages: 0 }];
    game.sendTo(s, { t: 'toast', msg: `${c.name} will skipper your caravans.`, kind: 'good' });
  }
  game.pushSelf(s, true);
  return null;
}

/** The most loyal skipper of her pool takes a caravan (out of the pool till it is home). */
export function takeSkipper(p: Profile): Skipper | null {
  const pool = p.skippers ?? [];
  if (!pool.length) return null;
  const best = [...pool].sort((a, b) => b.loyalty - a.loyalty)[0];
  p.skippers = pool.filter((x) => x !== best);
  return best;
}

/** A caravan home: her skipper back into the pool, a voyage the more loyal — or, of low loyalty, gone with a hull
 *  (the index of the hull he took, or -1). */
export function skipperHome(game: Game, account: number, rec: Skipper, hulls: { loadout: { classId: string; name: string } }[]): number {
  const s = game.sessionByAccount(account);
  if (rec.loyalty < DESERT_BELOW && hulls.length && game.rng.chance(DESERT_CHANCE)) {
    let k = 0;
    const tier = (i: number) => SHIP_CLASSES[hulls[i].loadout.classId as ShipClassId]?.tier ?? 0;
    hulls.forEach((_, i) => { if (tier(i) < tier(k)) k = i; });
    const name = hulls[k].loadout.name;
    if (s) game.sendTo(s, { t: 'toast', msg: `Skipper ${rec.name} took the ${name} and ran.`, kind: 'bad' });
    return k;
  }
  const back = { ...rec, loyalty: Math.min(95, rec.loyalty + LOYALTY_PER_VOYAGE), voyages: rec.voyages + 1 };
  if (s?.profile) s.profile.skippers = [...(s.profile.skippers ?? []), back];
  else {
    const all = game.db.getKv<Record<string, Skipper[]>>('skippers_home') ?? {};
    all[account] = [...(all[account] ?? []), back];
    game.db.setKv('skippers_home', all);
  }
  return -1;
}

/** On a captain's return: the skippers who came home while she was away. */
export function claimSkippers(game: Game, s: PlayerSession): void {
  const all = game.db.getKv<Record<string, Skipper[]>>('skippers_home');
  const mine = all?.[s.accountId];
  if (!mine?.length || !s.profile) return;
  s.profile.skippers = [...(s.profile.skippers ?? []), ...mine];
  delete all![s.accountId];
  game.db.setKv('skippers_home', all!);
}
