// Captain progression (docs/03_TALENT_TREES.md §2): talent points from levels and Legend Deeds, respec
// (free under level 20, Forget a Lesson, Clean Slate, Clean Logbook tokens) and talent loadouts.

import { questEvent } from './quests.ts';
import { DEEDS_BY_ID, MAX_COUNTED_DEEDS } from '../../../shared/src/data/deeds.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { TALENTS_BY_ID, TREES, canUnlearn, totalPointsSpent, validateBuild } from '../../../shared/src/data/talents.ts';
import type { LearnContext, TalentRanks } from '../../../shared/src/data/talents.ts';
import type { Game } from './Game.ts';
import { heroLevelUp } from './hero.ts';
import type { PlayerSession, Profile } from './player.ts';

export const FREE_RESPEC_LEVEL = 20;
export const TOKEN_LEVELS = [20, 30, 40, 50, 60];
export const MAX_TOKENS = 3;
export const TOKEN_OVERFLOW_SILVER = 5000;
export const CLEAN_SLATE_CD = 24 * 3600;
export const LOADOUT_SWITCH_CD = 600;

export function learnContext(p: Profile): LearnContext {
  return { level: p.level, abyssOpen: p.captain === 'drowned' || p.deeds.includes('deed_first_descent') };
}

export function totalTalentPoints(p: Profile): number {
  return Math.max(0, p.level - 1) + Math.min(p.deeds.length, MAX_COUNTED_DEEDS);
}

export function unspentPoints(p: Profile): number {
  return totalTalentPoints(p) - totalPointsSpent(p.talents);
}

export function loadoutSlots(level: number): number {
  return level >= 45 ? 3 : level >= 20 ? 2 : 1;
}

/** Grants a deed once. Returns true when it was new. */
export function grantDeed(game: Game, s: PlayerSession, id: string): boolean {
  const p = s.profile;
  const def = DEEDS_BY_ID[id];
  if (!p || !def || p.deeds.includes(id)) return false;
  p.deeds.push(id);
  const counts = p.deeds.length <= MAX_COUNTED_DEEDS;
  game.sendTo(s, { t: 'toast', msg: `LEGEND DEED — ${def.name}. ${counts ? 'A talent point is yours.' : 'Your legend grows (16 deeds already count).'}`, kind: 'gold' });
  game.grantXp(s, 400, null);
  return true;
}

/** Level milestones hand out Clean Logbook tokens; a full purse of tokens pays out silver instead. */
export function onLevelUp(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  heroLevelUp(game, s); // docs/17 H2: a primary grows, a skill to choose
  for (const lvl of TOKEN_LEVELS) {
    if (p.level < lvl || p.tokenLevels.includes(lvl)) continue;
    p.tokenLevels.push(lvl);
    if (p.tokens < MAX_TOKENS) {
      p.tokens++;
      game.sendTo(s, { t: 'toast', msg: 'A Clean Logbook token: one free full respec.', kind: 'good' });
    } else {
      p.gold += TOKEN_OVERFLOW_SILVER;
      game.db.ledger(s.accountId, 'token_overflow', TOKEN_OVERFLOW_SILVER, String(lvl));
    }
  }
}

function applyTalents(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const hf = ship.hull / Math.max(1, ship.stats.hullMax), sf = ship.sails / Math.max(1, ship.stats.sailHpMax), cf = ship.crew / Math.max(1, ship.stats.crewMax);
  ship.talents = s.profile!.talents;
  ship.recompute(game.now);
  // Pools keep their share of the maximum: switching builds neither heals nor wounds the ship.
  ship.hull = Math.max(1, Math.round(ship.stats.hullMax * hf));
  ship.sails = Math.round(ship.stats.sailHpMax * sf);
  ship.crew = Math.max(1, Math.round(ship.stats.crewMax * cf));
}

export function cleanSlateCost(p: Profile, now: number): number {
  const recent = p.cleanSlates.filter((t) => now - t < 7 * 86400).length;
  return Math.round(20 * p.level * p.level * Math.min(3, Math.pow(1.5, recent)));
}

export function forgetCost(p: Profile, talentId: string): number {
  const def = TALENTS_BY_ID[talentId];
  if (def && def.tree !== 'bridge' && TREES[def.tree].native.includes(p.captain)) return 0;
  return 50 * p.level;
}

export type RespecMode = 'full' | 'forget' | 'token';

/** Must be called with the ship in port and out of combat. */
export function respec(game: Game, s: PlayerSession, mode: RespecMode, talentId?: string): string | null {
  const p = s.profile!;
  const now = game.now;
  if (mode === 'forget') {
    const id = String(talentId ?? '');
    const def = TALENTS_BY_ID[id];
    if (!def) return 'Unknown talent';
    if (def.keystone) return 'A keystone cannot be forgotten — only a Clean Slate removes it';
    const why = canUnlearn(p.talents, id, learnContext(p));
    if (why) return why;
    const cost = p.level < FREE_RESPEC_LEVEL ? 0 : forgetCost(p, id);
    if (p.gold < cost) return `Forgetting ${def.name} costs ${cost} silver`;
    p.gold -= cost;
    if (cost) game.db.ledger(s.accountId, 'respec', -cost, `forget:${id}`);
    delete p.talents[id];
    applyTalents(game, s);
    return null;
  }
  if (mode === 'token') {
    if (p.tokens <= 0) return 'You have no Clean Logbook token';
    p.tokens--;
  } else if (p.level >= FREE_RESPEC_LEVEL) {
    const last = p.cleanSlates.length ? p.cleanSlates[p.cleanSlates.length - 1] : -Infinity;
    if (now - last < CLEAN_SLATE_CD) return `The next Clean Slate is possible in ${Math.ceil((CLEAN_SLATE_CD - (now - last)) / 3600)} h (or use a token)`;
    const cost = cleanSlateCost(p, now);
    if (p.gold < cost) return `A Clean Slate costs ${cost} silver`;
    p.gold -= cost;
    p.cleanSlates = [...p.cleanSlates.filter((t) => now - t < 7 * 86400), now];
    game.db.ledger(s.accountId, 'respec', -cost, 'clean_slate');
  }
  p.talents = {};
  applyTalents(game, s);
  return null;
}

/** Store the active build in its slot and load another. In port, 10 min cooldown, free. */
export function switchLoadout(game: Game, s: PlayerSession, slot: number): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const slots = loadoutSlots(p.level);
  if (!Number.isInteger(slot) || slot < 0 || slot >= slots) return slots > 1 ? `You have ${slots} loadout slots` : 'Loadouts open at level 20';
  if (slot === p.activeLoadout) return 'That loadout is already active';
  if (game.now < p.loadoutSwitchAt) return `Loadouts can be switched again in ${Math.ceil((p.loadoutSwitchAt - game.now) / 60)} min`;
  const next: TalentRanks = { ...(p.loadouts[slot] ?? {}) };
  const why = validateBuild(next, totalTalentPoints(p), learnContext(p));
  if (why) return `That loadout no longer fits: ${why}`;
  const contraband = (Object.keys(ship.cargo) as GoodId[]).some((g) => GOODS[g].contraband && (ship.cargo[g] ?? 0) > 0);
  if ((next.trd_honest_merchant ?? 0) > 0 && contraband) return 'An Honest Merchant cannot sail with contraband aboard';
  while (p.loadouts.length < slots) p.loadouts.push({});
  p.loadouts[p.activeLoadout] = { ...p.talents };
  p.activeLoadout = slot;
  p.talents = next;
  p.loadoutSwitchAt = game.now + LOADOUT_SWITCH_CD;
  applyTalents(game, s);
  return null;
}

// ------------------------------------------------------------------ deed checks driven by the world

/** Once a second per online captain: region crossings, storms, ice, wanted time, charting. */
export function checkDeeds(game: Game, s: PlayerSession, dt: number): void {
  const p = s.profile!;
  const ship = s.ship!;
  if (ship.docked || !ship.alive) return;
  const region = ship.region;
  // Expanse Crossing: enter from the south, leave to the north, no port in between.
  const prev = p.deedState.region;
  if (prev !== region) {
    if (region === 'dead_mans_expanse') p.deedState.crossing = prev === 'gravewater' || ship.state.y > 50000 ? 'south' : '';
    else if (prev === 'dead_mans_expanse' && p.deedState.crossing === 'south' && ship.state.y < 36000) grantDeed(game, s, 'deed_expanse_crossing');
    if (region !== 'dead_mans_expanse') p.deedState.crossing = '';
    p.deedState.region = region;
  }
  // Ice Edge: the far north of Leviathan Reach.
  if (region === 'leviathan_reach' && ship.state.y < 4500) grantDeed(game, s, 'deed_ice_edge');
  // Black Storm in the Abyss, ridden out for two minutes.
  if (region === 'the_abyss' && game.weatherOf(ship) === 'black_storm') {
    p.deedState.blackStorm += dt;
    if (p.deedState.blackStorm >= 120) grantDeed(game, s, 'deed_black_storm');
  } else p.deedState.blackStorm = 0;
  // Wanted Legend: two unbroken hours at Wanted 4+.
  if (ship.wantedCache >= 4) {
    p.deedState.wantedTime += dt;
    if (p.deedState.wantedTime >= 7200) grantDeed(game, s, 'deed_wanted_legend');
  } else p.deedState.wantedTime = 0;
  checkStatDeeds(game, s);
}

/** Deeds that follow from running totals and standing. */
export function checkStatDeeds(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  if ((p.reputation.league ?? 0) >= 50) grantDeed(game, s, 'deed_ledger_partner');
  if (p.stats.sunk >= 100) grantDeed(game, s, 'deed_hundred_wrecks');
  if (p.stats.sold >= 100000) grantDeed(game, s, 'deed_hundred_thousand');
  if (p.stats.fogContraband >= 1000) grantDeed(game, s, 'deed_fog_courier');
  if (p.stats.harpoonContracts >= 10) grantDeed(game, s, 'deed_harpoon_contracts');
}

/** Whispering Chart: called when islands are charted. */
export function checkChartDeed(game: Game, s: PlayerSession): void {
  const islands = game.world.islands.filter((i) => i.region === 'whispering' && !i.minor);
  if (!islands.length) return;
  let known = 0;
  for (const i of islands) if (s.discovered.has(i.id)) known++;
  if (known / islands.length >= 0.9) grantDeed(game, s, 'deed_whispering_chart');
}

/** On arrival in port. */
export function onDockDeeds(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  if (ship.hull < ship.stats.hullMax * 0.05) grantDeed(game, s, 'deed_last_plank');
  s.profile!.deedState.crossing = '';
}

/** After a sale in port. */
export function onSaleDeeds(game: Game, s: PlayerSession, portId: string, good: GoodId, qty: number, price: number): void {
  const p = s.profile!;
  p.stats.sold += price;
  if (!p.deedState.voyagePorts.includes(portId)) p.deedState.voyagePorts.push(portId);
  if (p.deedState.voyagePorts.length >= 6) grantDeed(game, s, 'deed_grand_circuit');
  if (portId === 'fogmouth' && GOODS[good].contraband) p.stats.fogContraband += qty;
  if (GOODS[good].contraband) questEvent(game, s, { k: 'sell_contraband', qty, port: portId });
  checkStatDeeds(game, s);
}

