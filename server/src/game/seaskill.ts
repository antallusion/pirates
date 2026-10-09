// The captains' sea abilities at work (docs/25 items 13–43): her rank, facets, talent and mastery give the numbers
// (shared/src/data/seaskill.ts); this module carries them into the fight — what her next broadside holds (the double
// charge, the rake, the ambush, the knife, the star fix's angles, the weather gauge), the crits it brings, the auras of
// the passives (the Admiral's chain of command, the Navigator's gauge, the Drowned's dread), the combos (item 41) and
// their cues, the numbers over the ships, the facets chosen and changed (item 38) and the ranks' news (item 37).

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { SEA_SKILLS, captainSkills, facetCost, facetKey, facetRanks, nextRank, skillNums, skillRank, volleyShare } from '../../../shared/src/data/seaskill.ts';
import type { FacetPick, SkillCtx, SkillNums } from '../../../shared/src/data/seaskill.ts';
import { dist } from '../../../shared/src/math.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import { igniteShip } from './combat.ts';
import { upwindOf } from './talentfx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** Her abilities' context: her level, facets, glory and talents (null: no captain's kit — a ship of the sea, or a bench's
 *  captain without one). */
export function kitCtx(game: Game, ship: ShipEntity): SkillCtx | null {
  if (ship.kitOff || ship.accountId === null) return null;
  const p = game.profileOf(ship);
  if (!p) return null;
  return { level: p.level, facets: p.facets ?? {}, glory: p.throne?.rank ?? 0, talents: ship.talents };
}

/** Her numbers in one of her abilities (null: not hers, not yet, or her kit is off). */
export function kitNums(game: Game, ship: ShipEntity, id: string): SkillNums | null {
  const s = SEA_SKILLS[id];
  if (!s || s.captain !== ship.captain) return null;
  const ctx = kitCtx(game, ship);
  if (!ctx) return null;
  const n = skillNums(id, ctx);
  return n.rank > 0 ? n : null;
}

/** Her passive's numbers (null when off). */
export function passiveNums(game: Game, ship: ShipEntity): SkillNums | null {
  const p = captainSkills(ship.captain).find((s) => s.key === 'P');
  return p ? kitNums(game, ship, p.id) : null;
}

// ------------------------------------------------------------------------------------------------ the cues

/** A number over a ship from an ability (her hull taken, men, hull mended). */
export function skillNumber(game: Game, target: ShipEntity, id: string, v: { dmg?: number; men?: number; heal?: number }): void {
  const ev = { k: 'skill' as const, ship: target.id, id, x: Math.round(target.state.x), y: Math.round(target.state.y) };
  if (v.dmg) Object.assign(ev, { dmg: Math.max(1, Math.round(v.dmg)) });
  if (v.men) Object.assign(ev, { men: Math.round(v.men) });
  if (v.heal) Object.assign(ev, { heal: Math.max(1, Math.round(v.heal)) });
  game.emit(ev, target.state.x, target.state.y);
}

/** A combo landed (item 41): its short cue over her (the combo's first ability names it). */
export function comboCue(game: Game, ship: ShipEntity, first: string): void {
  // (the cue is drawn over her in her captain's language: the client names the combo)
  game.emit({ k: 'skill', ship: ship.id, id: first, x: Math.round(ship.state.x), y: Math.round(ship.state.y), combo: true }, ship.state.x, ship.state.y);
}

/** A blow over time (the Deep Call's leak): its hull added up and shown once a second. */
const dots = new WeakMap<ShipEntity, Map<string, { sum: number; at: number }>>();
export function dotNumber(game: Game, target: ShipEntity, id: string, hull: number): void {
  let m = dots.get(target);
  if (!m) dots.set(target, (m = new Map()));
  const d = m.get(id) ?? { sum: 0, at: game.now };
  d.sum += hull;
  if (game.now - d.at >= 1) {
    skillNumber(game, target, id, { dmg: d.sum });
    d.sum = 0;
    d.at = game.now;
  }
  m.set(id, d);
}

// ------------------------------------------------------------------------------------------------ the broadside

/** What her captain's kit puts into a broadside. */
export interface VolleyKit {
  /** × every ball's damage. */
  mul: number;
  /** Two balls a gun (the double charge). */
  twin: boolean;
  /** A rake to the eye of the crits and the men (Hard Over, the star fix). */
  rake: boolean;
  /** The share of her armour the balls go through (the knife, the Admiral's weak side). */
  pierce: number;
  /** Past the alpha limit at full weight (Last Volley at rank 4). */
  noAlpha: boolean;
  /** Men more (× 1 + men). */
  men: number;
  /** Canvas more (× 1 + sails). */
  sails: number;
  /** One fire on the first ball home. */
  fire: boolean;
  /** One critical on the first ball home. */
  crit: 'rudder' | 'mast' | 'powder' | null;
  /** Her army's share the broadside takes besides (the frenzy's first grape). */
  army: number;
  /** Morale the broadside costs her besides. */
  morale: number;
}

/** Her next broadside as her kit makes it, at `mark` (her mark, if any) with `ammo`. Spends what it uses. */
export function volleyKit(game: Game, ship: ShipEntity, mark: ShipEntity | null, ammo: AmmoId): VolleyKit | null {
  if (ship.kitOff || ship.accountId === null) return null;
  const now = game.now, k = ship.kit;
  const v: VolleyKit = { mul: 1, twin: false, rake: false, pierce: 0, noAlpha: false, men: 0, sails: 0, fire: false, crit: null, army: 0, morale: 0 };
  let any = false;
  // The Corsair: the double charge, the rake of Hard Over (and the combo of the two), Last Volley at rank 4.
  const ds = k.ds.left > 0 && now <= k.ds.until;
  if (ds) {
    k.ds.left--;
    v.mul *= 1 + k.ds.bonus;
    v.twin = true;
    if (k.ds.sails) v.sails += 2;
    if (k.ds.fire) v.fire = true;
    any = true;
  }
  if (k.rake.left > 0 && now <= k.rake.until) {
    k.rake.left--;
    v.mul *= 1 + k.rake.bonus;
    v.rake = true;
    v.men += k.rake.men;
    if (ds && now - (k.cast.hard_over ?? -1e9) <= (SEA_SKILLS.hard_over.combo!.win + 3)) {
      v.mul *= 1.1;
      comboCue(game, ship, 'hard_over');
    }
    any = true;
  }
  if (now <= k.spot.until && game.rng.chance(k.spot.crit)) {
    v.crit = k.spot.on === 'any' ? (game.rng.chance(0.5) ? 'rudder' : 'mast') : k.spot.on;
    any = true;
  }
  if (ship.hasEffect('last_volley') && (kitNums(game, ship, 'last_volley')?.rank ?? 0) >= 4) v.noAlpha = true;
  // The Smuggler: the ambush out of the dark or the smoke (and the combo of «Тьма»), the knife in the fog.
  if (ship.captain === 'smuggler' && k.ambush.armed && now >= k.ambush.readyAt && (ship.hasFlag('hidden') || ship.hasFlag('dark_running'))) {
    const n = kitNums(game, ship, 'dark_running');
    if (n) {
      k.ambush.armed = false;
      k.ambush.readyAt = now + n.n.every;
      v.mul *= 1 + n.n.ambush;
      const combo = now - (k.cast.dark_running ?? -1e9) <= SEA_SKILLS.dark_running.combo!.win;
      if (combo) {
        v.mul *= 1.1;
        comboCue(game, ship, 'dark_running');
      }
      if (combo || game.rng.chance(0.6)) v.crit = n.n.powder ? 'powder' : game.rng.chance(0.5) ? 'rudder' : 'powder';
      any = true;
    }
  }
  // Smoke Pots' facet «Стрелять из дыма» (rank 3): her broadsides out of her smoke strike a tenth harder.
  if (ship.captain === 'smuggler' && ship.hasEffect('smoke_pots') && (kitNums(game, ship, 'smoke_pots')?.n.keep ?? 0) > 0) {
    v.mul *= 1.1;
    any = true;
  }
  if (k.knife.left > 0 && now <= k.knife.until) {
    k.knife.left--;
    v.mul *= 1 + k.knife.bonus;
    v.pierce = Math.max(v.pierce, k.knife.pierce);
    any = true;
  }
  // The Navigator: the star fix's angles (and its combo), the weather gauge, the current she gives them.
  if (mark && now <= k.star.until && dist(mark.state.x, mark.state.y, ship.state.x, ship.state.y) <= 1500) {
    v.mul *= 1 + k.star.bonus;
    v.rake = true;
    if (k.star.combo) {
      k.star.combo = false;
      v.mul *= 1.1;
      if (k.star.sure || game.rng.chance(0.6)) v.crit = 'rudder';
      comboCue(game, ship, 'star_fix');
    }
    any = true;
  }
  if (ship.captain === 'navigator' && mark && upwindOf(game, ship, mark)) {
    const p = kitNums(game, ship, 'reading_the_wind');
    if (p) {
      v.mul *= 1 + p.n.wind;
      any = true;
    }
  }
  if (mark) {
    const cr = mark.effects.find((e) => e.id === 'against_current' && e.source === ship.id);
    const side = cr ? kitNums(game, ship, 'current_rider')?.n.side ?? 0 : 0;
    if (side > 0) {
      v.mul *= 1 + side;
      any = true;
    }
  }
  // The Reaver: the frenzy's first grape broadside.
  if (ammo === 'grape' && ship.hasEffect('grapeshot_frenzy')) {
    if (k.frenzy.army > 0) {
      v.army = k.frenzy.army;
      k.frenzy.army = 0;
    }
    if (k.frenzy.sails) v.sails += 1;
    v.morale += k.frenzy.morale;
    any = true;
  }
  return any ? v : null;
}

/** The critical a broadside of her kit brings, on the first ball home. */
export function kitCrit(game: Game, shooter: ShipEntity | null, target: ShipEntity, crit: 'rudder' | 'mast' | 'powder'): string {
  const now = game.now;
  if (crit === 'rudder') {
    if (!target.hasFlag('iron_tiller')) target.rudderHp = Math.max(0, target.rudderHp - 0.3);
    return 'rudder';
  }
  if (crit === 'mast') {
    if (!target.hasFlag('ironbound_masts') && !target.hasEffect('topmast_down') && !target.hasEffect('broken_mast')) {
      target.addEffect({ id: 'topmast_down', until: now + 20, mods: { maxSpeed: -0.1 }, source: shooter?.id }, now);
      target.sails = Math.max(0, target.sails - target.stats.sailHpMax * 0.06);
    }
    return 'mast';
  }
  // Her powder: a flash below — a fire, and her crew's nerve.
  igniteShip(game, target, 8, shooter);
  target.morale = Math.max(0, target.morale - 8);
  return 'fire';
}

// ------------------------------------------------------------------------------------------------ once a second

/** Once a second for a captain's ship at sea: her passive's aura and the fields of her abilities. */
export function stepSeaSkills(game: Game, ship: ShipEntity): void {
  if (!ship.alive || ship.docked || ship.kitOff || ship.accountId === null) return;
  const now = game.now;
  const pulse = (o: ShipEntity, id: string, mods: Record<string, number>, flags?: string[]) =>
    o.addEffect({ id, until: now + 1.6, mods, source: ship.id, ...(flags ? { flags: flags as never } : {}) }, now);
  const mates = (r: number, fn: (o: ShipEntity) => void) => game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
    if (o.id !== ship.id && o.alive && !o.docked && (o.ownerId === ship.id || game.areAllies(o, ship))) fn(o);
  });
  const foes = (r: number, fn: (o: ShipEntity) => void) => game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
    if (o.id !== ship.id && o.alive && !o.docked && game.isHostile(o, ship) && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) <= r) fn(o);
  });
  switch (ship.captain) {
    case 'admiral': {
      // Chain of Command (item 17): allies and escorts within 500 m reload faster; in her line (Form Line at rank 5,
      // «Цепь команды») twice, and she herself too.
      const p = passiveNums(game, ship);
      if (!p) break;
      const line = ship.hasEffect('form_line') && (kitNums(game, ship, 'form_line')?.n.chain ?? 0) > 0;
      const r = p.n.reload * (line ? 2 : 1);
      mates(500, (o) => pulse(o, 'chain_of_command', { skillReload: -r }));
      if (line) pulse(ship, 'chain_of_command', { skillReload: -p.n.reload });
      break;
    }
    case 'navigator': {
      // The weather gauge (item 30): upwind of her mark, her range too (the damage is laid on the broadside).
      const p = passiveNums(game, ship);
      if (!p) break;
      let gauge = false;
      foes(1500, (o) => {
        if (!gauge && upwindOf(game, ship, o)) gauge = true;
      });
      if (gauge) pulse(ship, 'weather_gauge_nav', { rangeMul: p.n.wind });
      // Current Rider (item 33): the foes in her stream fight her current.
      const cr = ship.hasEffect('current_rider') ? kitNums(game, ship, 'current_rider') : null;
      if (cr) foes(cr.n.r, (o) => o.addEffect({ id: 'against_current', until: now + 1.6, mods: { maxSpeed: -cr.n.slow, turnRate: -cr.n.turn }, source: ship.id }, now));
      // Storm Chaser at rank 4: her allies sail her wind.
      const sc = ship.hasEffect('storm_chaser') ? kitNums(game, ship, 'storm_chaser') : null;
      if (sc && sc.rank >= 4) mates(500, (o) => pulse(o, 'storm_wind', { maxSpeed: 0.15 }, ['personal_wind']));
      // The star fix «for all» (rank 5): her allies see the angles too.
      if (now <= ship.kit.star.until && (kitNums(game, ship, 'star_fix')?.n.all ?? 0) > 0) mates(500, (o) => {
        o.kit.star.until = Math.max(o.kit.star.until, ship.kit.star.until);
        o.kit.star.bonus = Math.max(o.kit.star.bonus, ship.kit.star.bonus * 0.5);
      });
      break;
    }
    case 'drowned': {
      // Dread as a weapon (item 36): every 25 Dread costs the foes within 400 m 5 morale each 15 s; below 30 they are
      // shaken, and reload slower (item 24's link: spirit → rate of fire).
      const p = passiveNums(game, ship);
      if (!p) break;
      const bite = Math.floor(ship.dread / 25) * 5;
      const tick = (ship.talentReady.dreadBite ?? 0) <= now;
      if (tick && bite > 0) ship.talentReady.dreadBite = now + 15;
      foes(400, (o) => {
        if (tick && bite > 0) o.morale = Math.max(0, o.morale - bite);
        if (o.morale < 30) o.addEffect({ id: 'dread_shaken', until: now + 1.6, mods: { skillReload: p.n.shake }, source: ship.id }, now);
      });
      break;
    }
    case 'smuggler': {
      // Smoke Pots' facets: the acrid smoke (rank 3) and the cover of her own (rank 5).
      if (!ship.hasEffect('smoke_pots')) break;
      const n = kitNums(game, ship, 'smoke_pots');
      if (n?.n.acrid) foes(150, (o) => o.addEffect({ id: 'acrid_smoke', until: now + 1.6, mods: { spreadMul: n.n.acrid }, source: ship.id }, now));
      if (n?.n.allies) mates(150, (o) => pulse(o, 'smoke_cover', { skillIncoming: -n.n.allies }));
      break;
    }
    case 'corsair': {
      // The Spotter's Eye «for all» (rank 5): her mark ranged in for everyone and a little the more hurt.
      if (now > ship.kit.spot.until || !(kitNums(game, ship, 'spotters_eye')?.n.all ?? 0)) break;
      let best: ShipEntity | null = null, bd = 1e9;
      foes(1200, (o) => {
        const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      });
      if (best) {
        const b = best as ShipEntity;
        b.addEffect({ id: 'ranged_in', until: now + 1.6, source: ship.id }, now);
        b.addEffect({ id: 'spotted', until: now + 1.6, mods: { skillIncoming: 0.06 }, source: ship.id }, now);
      }
      break;
    }
    case 'reaver':
      break;
  }
}

// ------------------------------------------------------------------------------------------------ facets and ranks

/** She chooses (or changes) a facet of an ability at its rank (item 38): free the first time, anywhere; a change of
 *  one chosen before in a port, for silver. */
export function chooseFacet(game: Game, s: PlayerSession, id: string, rank: number, pick: FacetPick): string | null {
  const p = s.profile;
  if (!p) return 'No captain';
  const def = SEA_SKILLS[id];
  if (!def || def.captain !== p.captain) return 'Not your ability';
  if (!facetRanks(def.key).includes(rank) || !def.facets?.[rank as 3 | 5]) return 'No facet at that rank';
  if (pick !== 'a' && pick !== 'b') return 'Choose one of the two';
  if (skillRank(p.level, def.key) < rank) return `That facet opens at rank ${rank}`;
  p.facets ??= {};
  const key = facetKey(id, rank);
  const was = p.facets[key];
  if (was === pick) return null;
  if (was) {
    if (!s.ship?.docked) return 'A facet chosen is changed in a port';
    const cost = facetCost(p.level);
    if (p.gold < cost) return `Needs ${cost} silver`;
    p.gold -= cost;
    game.db.ledger(s.accountId, 'spend', -cost, `facet:${key}`);
  }
  p.facets[key] = pick;
  s.ship?.recompute(game.now);
  game.sendTo(s, { t: 'toast', msg: 'Facet chosen.', kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** Her abilities' ranks that a level-up raised (item 37): a word each, and a facet waiting where one opened. */
export function kitLevelUp(game: Game, s: PlayerSession, before: number): void {
  const p = s.profile;
  if (!p) return;
  for (const sk of captainSkills(p.captain)) {
    const r0 = skillRank(before, sk.key), r1 = skillRank(p.level, sk.key);
    if (r1 <= r0) continue;
    const name = sk.key === 'P' ? CAPTAINS[p.captain].passive.name : CAPTAINS[p.captain].abilities.find((a) => a.id === sk.id)?.name ?? sk.id;
    const facet = facetRanks(sk.key).some((fr) => fr > r0 && fr <= r1 && !p.facets?.[facetKey(sk.id, fr)]);
    game.sendTo(s, { t: 'toast', msg: facet ? `${name} — rank ${r1}: choose its facet in the Captain window.` : `${name} — rank ${r1}.`, kind: 'gold' });
  }
}

/** The next rank of one of her abilities, for a word on her sheet. */
export function nextOf(level: number, id: string): { rank: number; level: number } | null {
  return nextRank(level, SEA_SKILLS[id].key);
}

/** A broadside of her ⚓ as hull of the ship `t` (the unit of what an ability does again and again). */
export function volleyHull(t: ShipEntity, anchor: number): number {
  return t.stats.hullMax * volleyShare(anchor);
}
