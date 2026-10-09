// Captain abilities. Data lives in shared/src/data/captains.ts (what each is) and shared/src/data/seaskill.ts (her
// numbers by rank, facet, talent and mastery: docs/25 items 13–43); this module casts them (area damage, delayed strikes,
// summons, reveals, the state her next broadsides carry — server/src/game/seaskill.ts reads it there).

import { lairImpact } from './wanted.ts';
import { findAbility } from '../../../shared/src/data/captains.ts';
import { SEA_SKILLS, bribeCost, burstReload, escortCost, volleyShare } from '../../../shared/src/data/seaskill.ts';
import { dist, headingOf } from '../../../shared/src/math.ts';
import { applyDamage, igniteShip, mastWreck, reloadTime } from './combat.ts';
import { RESOLVE_MAX, callPower, spendDread, witnessMiracle } from './mind.ts';
import { comboCue, kitNums, skillNumber } from './seaskill.ts';
import { siegeImpact } from './siege.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

export interface DelayedStrike {
  at: number;
  x: number;
  y: number;
  radius: number;
  /** Hull a hit (a mount's mortar, a rocket): flat. */
  hull: number;
  rudder: number;
  owner: number;
  slow: number; // seconds of slow applied
  shells: number; // >1 = barrage split into shells
  fx: 'deep_call' | 'maw' | 'barrage' | 'mortar';
  /** Chance a ship struck catches fire (war rockets, incendiary shells). */
  fire?: number;
  /** A captain's ability (docs/25 item 39): a share of the hull it strikes, not a flat number — of the caster's own hull
   *  on the deep's creatures, the great ones and the wrecks, which keep their own scales. */
  share?: number;
  self?: number;
  skill?: string;
}

const NO_CAPTAIN = 'No captain';

/** Her cooldown for an ability at her rank and facets (Maw's shortens by rank; some facets take seconds off). */
function cooldownOf(base: number, n: Record<string, number>): number {
  return Math.max(5, ('cd' in n ? n.cd : base) + (n.cdDelta ?? 0));
}

export function useAbility(game: Game, ship: ShipEntity, abilityId: string, tx?: number, ty?: number): string | null {
  const profile = game.profileOf(ship);
  if (!profile) return NO_CAPTAIN;
  const def = findAbility(ship.captain, abilityId);
  if (!def) return 'Unknown ability';
  const now = game.now;
  if ((profile.cooldowns[def.id] ?? 0) > now) return `${def.name} is not ready`;
  if (!ship.alive || ship.docked) return 'Not at sea';
  if (def.kind === 'ultimate' && profile.level < 6) return 'Ultimates unlock at level 6';
  // Her numbers at her rank (docs/25 items 13–43); a bench's captain without her kit has the first rank's.
  const nums = kitNums(game, ship, def.id);
  const n: Record<string, number> = { ...(nums?.n ?? {}) };
  const goldCost = def.id === 'call_escort' ? escortCost(profile.level) : def.id === 'bribe_signal' ? Math.round(bribeCost(profile.level) * (1 - (n.cheap ?? 0))) : def.goldCost ?? 0;
  if (goldCost && profile.gold < goldCost) return `Needs ${goldCost} silver`;
  if (def.kind === 'ultimate' && ship.resolve < RESOLVE_MAX) return `${def.name} needs full resolve (${Math.floor(ship.resolve)}/100) — trade blows to build it`;
  const dreadCost = n.dread ?? def.dreadCost ?? 0;
  if (dreadCost && ship.dread < dreadCost) return `${def.name} needs ${dreadCost} Dread (${Math.floor(ship.dread)})`;
  const power = callPower(ship);
  const dur = n.dur ?? def.duration;
  const k = ship.kit;
  // Her ⚓ (the unit of what she does again and again: a broadside of it, docs/25 item 39).
  const anchor = ship.shipLevel;

  let x = tx ?? ship.state.x, y = ty ?? ship.state.y;
  if (def.targeting === 'point' || def.targeting === 'ship') {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'Choose a target';
    const d = dist(ship.state.x, ship.state.y, x, y);
    const range = def.range ?? 400;
    if (d > range) {
      // Clamp to max range along the aim direction.
      x = ship.state.x + ((x - ship.state.x) / d) * range;
      y = ship.state.y + ((y - ship.state.y) / d) * range;
    }
  }
  // The effect she wears for it (mods by her numbers; flags as the ability's data).
  let mods: Record<string, number> | undefined = def.mods ? { ...def.mods } : undefined;

  // Ability-specific validation and effects.
  switch (def.id) {
    // -------------------------------------------------------------------------------- the Corsair
    case 'double_shot':
      ship.doubleShotArmed = true;
      k.ds = { left: n.twice ? 2 : 1, bonus: n.bonus ?? 0.25, until: now + (n.win ?? 12), sails: !!n.sails, fire: !!n.fire };
      break;
    case 'hard_over':
      mods = { turnRate: n.turn ?? 0.8, maxSpeed: n.keepWay ? 0 : -0.1 };
      // The rake (item 16): the broadside in its window, once in her rake's time (the helm itself is ready sooner).
      if (now >= k.rake.readyAt) k.rake = { until: now + dur + (n.win ?? 3), left: n.twice ? 2 : 1, bonus: n.rake ?? 0.2, men: n.men ?? 0, readyAt: now + (n.every ?? 45) };
      if (n.evade) ship.addEffect({ id: 'evasive', until: now + 1.5, flags: ['evasive'] }, now);
      break;
    case 'spotters_eye':
      mods = { spreadMul: -(n.spread ?? 0.2), skillDamage: n.dmg ?? 0.08, rangeMul: n.range ?? 0.15 };
      k.spot = { until: now + dur, crit: n.crit ?? 0.15, on: n.mast ? 'mast' : n.rudder ? 'rudder' : 'any' };
      break;
    case 'last_volley': {
      // As many broadsides more as a share of a fight of her ⚓ (docs/25 items 15, 39): the reload cut by her guns.
      const cut = burstReload(n.q ?? 0.1, dur, reloadTime(ship, 'starboard', now), anchor);
      mods = { skillReload: -cut, skillDamage: n.dmg ?? 0.2 };
      break;
    }
    // -------------------------------------------------------------------------------- the Black Admiral
    case 'form_line': {
      mods = { spreadMul: -(n.spread ?? 0.3), skillReload: -(n.reload ?? 0.1), ...(n.dmg ? { skillDamage: n.dmg } : {}) };
      const m = mods;
      game.forShipsNear(ship.state.x, ship.state.y, 500, (o) => {
        if (o.id !== ship.id && (o.ownerId === ship.id || game.areAllies(o, ship))) o.addEffect({ id: 'form_line', until: now + dur, mods: m, source: ship.id }, now);
      });
      break;
    }
    case 'mark_target': {
      const found: ShipEntity[] = [];
      game.forShipsNear(x, y, 260, (o) => {
        if (o.id !== ship.id && o.alive && o.ownerId !== ship.id && dist(o.state.x, o.state.y, x, y) <= 260) found.push(o);
      });
      found.sort((a, b) => dist(a.state.x, a.state.y, x, y) - dist(b.state.x, b.state.y, x, y));
      if (!found.length) return 'No ship near the mark';
      for (const t of found.slice(0, n.two ? 2 : 1)) {
        t.addEffect({ id: 'marked', until: now + dur, mods: { skillIncoming: n.mark ?? 0.1 }, source: ship.id }, now);
        // From rank 3 her weak side shows: everyone is ranged in on her; the facet's balls go through her armour.
        if ((nums?.rank ?? 1) >= 3) t.addEffect({ id: 'ranged_in', until: now + dur, source: ship.id }, now);
        if (n.pierce) t.addEffect({ id: 'weak_side', until: now + dur, source: ship.id }, now);
      }
      k.cast.markOn = found[0].id;
      break;
    }
    case 'call_escort': {
      const err = game.spawnEscort(ship, dur, { guns: n.guns ?? 0.36, heavy: !!n.heavy, two: !!n.two || profile.level >= 60 });
      if (err) return err;
      break;
    }
    case 'admiralty_barrage': {
      // Into the ship she marked (the combo, item 41): the shells home on her (within 60 m), 15% harder.
      const marked = k.cast.markOn !== undefined ? game.ships.get(k.cast.markOn) : undefined;
      const combo = !!marked && marked.alive && now - (k.cast.mark_target ?? -1e9) <= (SEA_SKILLS.mark_target.combo?.win ?? 5) && dist(marked.state.x, marked.state.y, x, y) <= 200;
      if (combo) {
        x = marked!.state.x;
        y = marked!.state.y;
        comboCue(game, ship, 'mark_target');
      }
      game.strikes.push({ at: now + 3, x, y, radius: combo ? Math.min(60, n.radius ?? 90) : n.radius ?? 90, hull: 0, rudder: 0, owner: ship.id, slow: 0, shells: Math.round(n.shells ?? 12), fx: 'barrage', share: (n.shell ?? 0.008) * (combo ? 1.15 : 1), self: ship.stats.hullMax, skill: def.id, ...(n.fire ? { fire: n.fire } : {}) });
      break;
    }
    // -------------------------------------------------------------------------------- the Reaver
    case 'grapeshot_frenzy':
      mods = { crewKillMul: n.crew ?? 0.3 };
      k.frenzy = { army: n.army ?? 0.05, sails: !!n.sails, morale: n.morale ?? 0 };
      break;
    case 'ramming_speed':
      mods = { maxSpeed: n.speed ?? 0.35, accel: 1.0 };
      break;
    case 'war_cry': {
      ship.morale = Math.min(100, ship.morale + 20);
      const r = n.r ?? 300;
      game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
        if (o.id === ship.id || !game.isHostile(o, ship) || dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > r) return;
        o.morale = Math.max(0, o.morale - (n.morale ?? 15));
        // Spirit → rate of fire (item 24): shaken, she loads slower — twice while her morale is under 30.
        const slow = (n.slow ?? 0.12) * (o.morale < 30 ? 2 : 1);
        o.addEffect({ id: 'shaken', until: now + dur, mods: { skillReload: slow }, source: ship.id }, now);
      });
      if (n.heart) ship.addEffect({ id: 'war_heart', until: now + 6, mods: { skillReload: -0.1 } }, now);
      game.emit({ k: 'fx', fx: 'war_cry', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r }, ship.state.x, ship.state.y);
      break;
    }
    case 'red_hook_boarding':
      mods = { boardingRange: n.range ?? 1, boardingPower: n.power ?? 0.3 };
      break;
    // -------------------------------------------------------------------------------- the Smuggler
    case 'smoke_pots':
      mods = { skillIncoming: -(n.cut ?? 0.4) };
      k.ambush.armed = true;
      game.emit({ k: 'fx', fx: 'smoke', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 110 }, ship.state.x, ship.state.y);
      break;
    case 'dark_running':
      mods = { maxSpeed: n.silent ? 0 : -0.1 };
      ship.talentReady.darkSeen = n.seen ?? 0.4;
      k.ambush.armed = true;
      break;
    case 'bribe_signal':
      // From rank 3 the sea's pirates take her money too; the facet of rank 5, its hunters.
      ship.talentReady.bribeReach = n.hunters ? 2 : (nums?.rank ?? 1) >= 3 ? 1 : 0;
      break;
    case 'vanish_into_fog':
      mods = { maxSpeed: n.speed ?? 0.25 };
      k.ambush.armed = true;
      // The knife in the fog (item 28): her next broadsides out of it go through her armour.
      k.knife = { left: Math.round(n.knives ?? 2), until: now + dur + 8, bonus: n.knife ?? 0.2, pierce: n.pierce ?? 0.5 };
      break;
    // -------------------------------------------------------------------------------- the Navigator
    case 'trim_sails':
      mods = { maxSpeed: n.speed ?? 0.2, ...(n.accel ? { accel: n.accel } : {}), ...(n.turn ? { turnRate: n.turn } : {}) };
      break;
    case 'current_rider':
      mods = { currentMul: 1.5, turnRate: 0.2, ...(n.own ? { maxSpeed: n.own } : {}) };
      break;
    case 'star_fix': {
      const found = game.revealAround(ship, 7000);
      game.toastShip(ship, `Star fix taken: ${found} new islands charted.`, 'good');
      game.emit({ k: 'fx', fx: 'star_fix', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 7000 }, ship.state.x, ship.state.y);
      // The weak angles of the foes within 1.5 km (item 31), and the combo's broadside (item 41).
      k.star = { until: now + dur, bonus: n.rake ?? 0.2, combo: true, sure: !!n.sure };
      if (n.range) mods = { rangeMul: n.range };
      break;
    }
    case 'storm_chaser': {
      // On the best course her guns load faster (item 32): a share of a fight of her ⚓, as Last Volley's.
      const cut = burstReload(n.q ?? 0.1, dur, reloadTime(ship, 'starboard', now), anchor);
      mods = { maxSpeed: n.speed ?? 0.3, skillReload: -cut, ...(n.dmg ? { skillDamage: n.dmg } : {}) };
      break;
    }
    // -------------------------------------------------------------------------------- the Drowned
    case 'brine_mend': {
      // Her hull back by broadsides of her ⚓ over the seconds (item 39), the rest as before.
      ship.talentReady.brinePower = power;
      ship.talentReady.brineHeal = ((n.heal ?? 0.8) * volleyShare(anchor) * power) / Math.max(1, dur);
      if (!n.free) {
        const lost = Math.max(1, Math.round(ship.crew * 0.02)); // two in a hundred go into the water: the sea's fee
        if (ship.crew > lost + 1) ship.crew -= lost;
      }
      ship.leaks = Math.max(0, ship.leaks - 1 - (n.leaks ?? 0));
      ship.rudderHp = Math.min(1, ship.rudderHp + 0.3 * power);
      break;
    }
    case 'undertow': {
      const dir = headingOf(x - ship.state.x, y - ship.state.y);
      // The race starts at your bow and runs 400 m toward the mark.
      const cx = ship.state.x + Math.sin(dir) * 200, cy = ship.state.y - Math.cos(dir) * 200;
      game.zones.push({ kind: 'undertow', x: cx, y: cy, r: 200, dir, start: now, until: now + dur, owner: ship.id, power: power * (n.pull ?? 1), hit: [], ...(n.wide ? { width: 50 } : {}), ...(n.rip ? { rip: n.rip } : {}), ...(n.ride ? { ride: n.ride } : {}) });
      game.emit({ k: 'fx', fx: 'undertow', x: Math.round(cx), y: Math.round(cy), r: 200, dir: Math.round(dir * 1000) / 1000 }, cx, cy);
      break;
    }
    case 'deep_call': {
      // The hands hole every ship they catch, and she leaks broadsides of the Drowned's ⚓ over their seconds (item 34).
      const r = n.r ?? 60, hold = n.dur ?? 6;
      game.zones.push({ kind: 'hands', x, y, r, start: now + 1, until: now + 1 + hold, owner: ship.id, power, hit: [], leak: ((n.leak ?? 0.5) * volleyShare(anchor) * power) / hold });
      game.strikes.push({ at: now + 1, x, y, radius: r, hull: 0, rudder: 0, owner: ship.id, slow: 0, shells: 1, fx: 'deep_call' });
      break;
    }
    case 'maw_of_the_deep': {
      // On a ship the hands hold (the combo, item 41): 15% more.
      const held = game.zones.some((z) => z.kind === 'hands' && z.owner === ship.id && z.until >= now && dist(z.x, z.y, x, y) <= z.r + 30);
      if (held) comboCue(game, ship, 'deep_call');
      game.strikes.push({ at: now + 3, x, y, radius: n.r ?? 45, hull: 0, rudder: 0, owner: ship.id, slow: 0, shells: 1, fx: 'maw', share: (n.hull ?? 0.2) * power * (held ? 1.15 : 1), self: ship.stats.hullMax, skill: def.id });
      game.emit({ k: 'fx', fx: 'maw_warn', x: Math.round(x), y: Math.round(y), r: n.r ?? 45 }, x, y);
      break;
    }
    default:
      break;
  }
  k.cast[def.id] = now;

  if (goldCost) game.spendGold(ship, goldCost, `ability:${def.id}`);
  const moraleCost = def.id === 'brine_mend' && n.free ? 3 : def.moraleCost ?? 0;
  if (moraleCost) ship.morale = Math.max(0, ship.morale - moraleCost);
  if (def.kind === 'ultimate') ship.resolve = 0;
  if (dreadCost) spendDread(ship, dreadCost);
  if (ship.captain === 'drowned') witnessMiracle(game, ship, def.kind === 'ultimate');
  // What she wears for it: an ability with a time of its own on her (an instant one only if her numbers gave her mods).
  const selfDur = def.duration > 0 || mods ? dur : 0;
  if (selfDur > 0 && (mods || def.flags)) {
    ship.addEffect({ id: def.id, until: now + selfDur, mods, flags: def.flags }, now);
  } else if (selfDur > 0) {
    ship.addEffect({ id: def.id, until: now + selfDur }, now);
  }
  // Faster cooldowns (the Signal Hoist banner and the like) count on Z/X/C/V as on the talents (docs/25 item 10).
  profile.cooldowns[def.id] = now + cooldownOf(def.cooldown, n) * ship.stats.cooldownMul;
  game.emit({ k: 'ability', ship: ship.id, id: def.id, x: Math.round(x), y: Math.round(y) }, ship.state.x, ship.state.y);
  return null;
}

/** A strike's blow on a ship: a captain's share of her hull (of the caster's own on one off the table), or flat. */
function strikeHull(s: DelayedStrike, o: ShipEntity, table: boolean): number {
  if (s.share === undefined) return s.hull;
  return s.share * (table ? o.stats.hullMax : Math.min(o.stats.hullMax, s.self ?? o.stats.hullMax));
}

export function stepStrikes(game: Game): void {
  const now = game.now;
  const keep: DelayedStrike[] = [];
  for (const s of game.strikes) {
    if (s.at > now) {
      keep.push(s);
      continue;
    }
    const owner = game.ships.get(s.owner) ?? null;
    if (s.shells > 1) {
      const dealt = new Map<ShipEntity, number>();
      // On an island or a lair a shell strikes as on a ship of the caster's own size (docs/25 item 39).
      const flat = s.share !== undefined ? s.share * (s.self ?? 1000) : s.hull;
      for (let i = 0; i < s.shells; i++) {
        const a = game.rng.float() * Math.PI * 2, r = Math.sqrt(game.rng.float()) * s.radius;
        const sx = s.x + Math.sin(a) * r, sy = s.y - Math.cos(a) * r;
        siegeImpact(game, sx, sy, flat, s.owner, true); // mortar shells on a besieged island
        lairImpact(game, sx, sy, flat, s.owner);
        game.forShipsNear(sx, sy, 60, (o) => {
          if (o.id === s.owner || !o.alive) return;
          if (dist(o.state.x, o.state.y, sx, sy) >= o.stats.length / 2 + 12) return;
          const h0 = o.hull;
          applyDamage(game, o, { hull: strikeHull(s, o, onTable(o)), crew: 1, morale: 2 }, owner);
          dealt.set(o, (dealt.get(o) ?? 0) + Math.max(0, h0 - o.hull));
          if (s.fire && game.rng.chance(s.fire)) igniteShip(game, o, 10, owner);
        });
      }
      if (s.skill) for (const [o, h] of dealt) if (h > 0) skillNumber(game, o, s.skill, { dmg: h });
    } else if (s.fx === 'maw') {
      // The Maw: a share of every hull inside (through armour and the volley cap; on the deep's creatures and the great
      // ones, of the Drowned's own hull — docs/25 item 35, was «to 4 000»), a mast and two leaks.
      game.forShipsNear(s.x, s.y, s.radius + 40, (o) => {
        if (o.id === s.owner || !o.alive) return;
        if (dist(o.state.x, o.state.y, s.x, s.y) > s.radius + o.stats.length / 3) return;
        const h0 = o.hull;
        applyDamage(game, o, { hull: strikeHull(s, o, onTable(o)), crew: 2, morale: 8 }, owner);
        if (s.skill && h0 > o.hull) skillNumber(game, o, s.skill, { dmg: h0 - o.hull });
        o.leaks = Math.min(8, o.leaks + 2);
        if (!o.hasFlag('ironbound_masts') && !o.hasEffect('broken_mast')) {
          o.addEffect({ id: 'broken_mast', until: now + 1e9, mods: { maxSpeed: -0.3 }, source: s.owner }, now);
          mastWreck(game, o);
        }
      });
      game.zones.push({ kind: 'maw_pull', x: s.x, y: s.y, r: s.radius * 2, inner: s.radius * 0.5, start: now, until: now + 3, owner: s.owner, power: 1, hit: [] });
      // Everything in the deep within 2 km heard it.
      for (const [id, b] of game.npcs) {
        const o = game.ships.get(id);
        if (b.role === 'ghost' && o && owner && dist(o.state.x, o.state.y, s.x, s.y) < 2000) b.chase = { id: owner.id, until: now + 120 };
      }
    } else if (s.fx === 'deep_call') {
      game.emit({ k: 'fx', fx: 'drowned_hands', x: Math.round(s.x), y: Math.round(s.y), r: s.radius }, s.x, s.y);
    } else {
      siegeImpact(game, s.x, s.y, s.hull, s.owner, true);
      lairImpact(game, s.x, s.y, s.hull, s.owner);
      game.forShipsNear(s.x, s.y, s.radius + 40, (o) => {
        if (o.id === s.owner || !o.alive) return;
        if (dist(o.state.x, o.state.y, s.x, s.y) > s.radius + o.stats.length / 3) return;
        applyDamage(game, o, { hull: strikeHull(s, o, onTable(o)), rudder: s.rudder, crew: 2, morale: 8 }, owner);
        if (s.slow > 0) o.addEffect({ id: 'maw_slow', until: now + s.slow, mods: { maxSpeed: -0.4, turnRate: -0.3 }, source: s.owner }, now);
      });
    }
    game.emit({ k: 'fx', fx: s.fx, x: Math.round(s.x), y: Math.round(s.y), r: s.radius }, s.x, s.y);
  }
  game.strikes = keep;
}

/** A ship of the broadside table (combat.ts onSeaTable, as the strikes need it). */
function onTable(o: ShipEntity): boolean {
  return o.onLadder && !o.zoneBoss && o.npcRole !== 'beast' && !o.cls.monster;
}
