// The captain as a HoMM3 hero on the server (docs/17 H2): her primaries grown at every level on her own seed (and a
// captain from before them grown from her level the same way), the skill she chooses of two at every level-up, her
// order book (learnt at the ports' guilds of orders, at the drowned shrines, and — later — at her island's guild:
// `learnOrder`), her will (filled a quarter a day at sea, half in port, whole at a guild, a shrine or a spring), the
// sea orders cast from the HUD, the hero she brings to a boarding battle and what is left of her will after it, First
// Aid's patched-up men, and the artifacts: found on bosses, in hoards and lairs, won from guarded ships, sold by a few
// ports' merchants. Every roll here is on the hero's own dice (the sea's stream stays as the tests replay it).

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { DAY_LENGTH_SEC } from '../../../shared/src/constants.ts';
import { dayOf } from '../../../shared/src/data/dailies.ts';
import { STASH_SIZE } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { ARTIFACTS, ARTIFACT_IDS, artMerchantAt, artTotals, artWares, makeArtifact, rollArtifact } from '../../../shared/src/data/artifacts.ts';
import type { ART_WEIGHTS } from '../../../shared/src/data/artifacts.ts';
import {
  LEARNABLE, ORDERS, PRIM_NAMES, PRIMS, RANK_NAMES, SCHOOL_SKILL, SKILLS, SKILL_MAX, SKILL_SLOTS, WILL_DAY, WILL_PORT, growPrims, guildOf, guildPrice, heroBattle, heroSeed,
  isOrder, manaMaxOf, npcHeroBattle, orderCost, orderLevelCap, orderMul, primOfLevel, primsAtLevel, rankOf, shrineOrder, skillOffer, skillSeaMods, startingOrders,
} from '../../../shared/src/data/hero.ts';
import type { HeroBattle, HeroPortView, HeroView, OrderId, Prims, SeaOrderId, SkillPick, SkillSlot } from '../../../shared/src/data/hero.ts';
import { TREES, pointsInTree } from '../../../shared/src/data/talents.ts';
import type { TreeId } from '../../../shared/src/data/talents.ts';
import type { ModifierSource } from '../../../shared/src/data/stats.ts';
import { dist } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { takeItem } from './gear.ts';

/** What the profile keeps of the hero. */
export interface HeroRec {
  seed: number;
  /** Her grown primaries (artifacts apart), and the level they are grown to. */
  prim: Prims;
  primLv: number;
  skills: SkillSlot[];
  /** The level whose skill choice is the last one made. */
  picked: number;
  mana: number;
  orders: OrderId[];
  /** The in-game day her will was last filled for. */
  day: number;
  /** Sea orders' waits (world time). */
  cd: Partial<Record<OrderId, number>>;
  /** Artifact merchants' pieces she has bought: `day:port:index`. */
  bought: string[];
}

/** The hero's own dice (like the auction house's: server/src/game/auction.ts). */
const rngs = new WeakMap<Game, Rng>();
function hr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x4e40a2f1)));
  return r;
}

/** Her hero, made (or migrated from her level) on first sight. */
export function heroOf(p: Profile): HeroRec {
  const h = p.hero;
  if (h && typeof h.seed === 'number' && h.prim) {
    h.skills = (h.skills ?? []).filter((x) => x && SKILLS[x.id] && x.r >= 1).slice(0, SKILL_SLOTS).map((x) => ({ id: x.id, r: Math.min(SKILL_MAX, x.r) as SkillSlot['r'] }));
    h.orders = [...new Set((h.orders ?? []).filter(isOrder))];
    for (const o of startingOrders(p.captain)) if (!h.orders.includes(o)) h.orders.push(o);
    h.cd ??= {};
    h.bought ??= [];
    h.picked = Math.max(1, Math.min(p.level, h.picked ?? p.level));
    if (h.primLv < p.level) {
      h.prim = growPrims(h.prim, p.captain, h.seed, h.primLv, p.level);
      h.primLv = p.level;
    }
    h.mana = Math.max(0, Math.min(h.mana ?? 0, willMax(p, h)));
    return h;
  }
  // A captain from before the heroes: her primaries grown from her level on her own seed; every level's choice of
  // skill still hers to make; a full store of will.
  const seed = heroSeed(p.createdAt ?? 0, p.captain);
  const rec: HeroRec = { seed, prim: primsAtLevel(p.captain, seed, p.level), primLv: p.level, skills: [], picked: 1, mana: 0, orders: startingOrders(p.captain), day: -1, cd: {}, bought: [] };
  rec.mana = willMax(p, rec);
  p.hero = rec;
  return rec;
}

const wornOf = (p: Profile): Item[] => Object.values(p.captainGear ?? {}).filter((x): x is Item => !!x);

/** Her primaries with her artifacts'. */
export function heroPrims(p: Profile, h = heroOf(p)): Prims {
  const a = artTotals(wornOf(p)).prim;
  return { atk: h.prim.atk + a.atk, def: h.prim.def + a.def, pow: h.prim.pow + a.pow, will: h.prim.will + a.will };
}

function willMax(p: Profile, h: HeroRec): number {
  const a = artTotals(wornOf(p)).prim;
  return manaMaxOf(h.prim.will + a.will);
}

/** What her skills and artifact sets do at sea, for her ship's stats (the talents' vocabulary and caps). */
export function heroSource(p: Profile): ModifierSource {
  return { mods: skillSeaMods(heroOf(p).skills) };
}

/** Her ship's stats again after the hero changed. */
export function applyHero(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship || !s.profile) return;
  const hf = ship.hull / Math.max(1, ship.stats.hullMax), sf = ship.sails / Math.max(1, ship.stats.sailHpMax);
  ship.hero = heroSource(s.profile);
  ship.recompute(game.now);
  ship.hull = Math.max(1, Math.round(ship.stats.hullMax * hf));
  ship.sails = Math.round(ship.stats.sailHpMax * sf);
}

function treePoints(p: Profile): Partial<Record<TreeId, number>> {
  const out: Partial<Record<TreeId, number>> = {};
  for (const t of Object.keys(TREES) as TreeId[]) out[t] = pointsInTree(p.talents, t);
  return out;
}

/** The two skills offered at her next unmade choice (empty: nothing left to raise). */
export function currentOffer(p: Profile, h = heroOf(p)): SkillPick[] {
  return skillOffer(h.skills, CAPTAINS[p.captain].favoredTrees, treePoints(p), h.seed, h.picked + 1);
}

/** Level-ups whose choice she has not made (a captain with every skill at expert has none left). */
export function pendingChoices(p: Profile, h = heroOf(p)): number {
  const full = h.skills.length >= SKILL_SLOTS && h.skills.every((x) => x.r >= SKILL_MAX);
  return full ? 0 : Math.max(0, p.level - h.picked);
}

/** A level-up (progression.ts): a primary grows by her path, and a choice of skill waits. */
export function heroLevelUp(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const before = p.hero?.primLv ?? p.level;
  const h = heroOf(p);
  // heroOf grows them to her level; say which grew.
  for (let lv = Math.max(2, before + 1); lv <= h.primLv; lv++) game.sendTo(s, { t: 'toast', msg: `${PRIM_NAMES[primOfLevel(p.captain, h.seed, lv)][0]} +1 at level ${lv}.`, kind: 'good' });
  const offer = currentOffer(p, h);
  if (pendingChoices(p, h) > 0 && offer.length === 2) game.sendTo(s, { t: 'toast', msg: `A new skill to choose: ${SKILLS[offer[0].id].name[0]} or ${SKILLS[offer[1].id].name[0]}.`, kind: 'gold' });
  h.mana = Math.min(willMax(p, h), h.mana + WILL_DAY * willMax(p, h));
}

/** She takes one of the two skills offered. */
export function pickSkill(game: Game, s: PlayerSession, i: number): string | null {
  const p = s.profile!;
  const h = heroOf(p);
  if (pendingChoices(p, h) <= 0) return 'No skill to choose now';
  const offer = currentOffer(p, h);
  const pick = offer[i];
  if (!pick) return 'No such choice';
  const had = h.skills.find((x) => x.id === pick.id);
  if (had) had.r = pick.r;
  else h.skills.push({ id: pick.id, r: pick.r });
  h.picked++;
  // A choice with nothing left to choose from moves on by itself.
  while (pendingChoices(p, h) > 0 && currentOffer(p, h).length === 0) h.picked++;
  applyHero(game, s);
  game.sendTo(s, { t: 'toast', msg: `Skill: ${SKILLS[pick.id].name[0]}, ${RANK_NAMES[pick.r - 1][0]}.`, kind: 'good' });
  return null;
}

/** An order into her book (the guilds, the shrines, and her island's guild of orders — H3 calls this). */
export function learnOrder(game: Game, s: PlayerSession, id: string, silent = false): string | null {
  const p = s.profile!;
  const h = heroOf(p);
  if (!isOrder(id) || ORDERS[id].sig) return 'No such order';
  if (h.orders.includes(id)) return 'You know that order already';
  const cap = orderLevelCap(p.level, rankOf(h.skills, 'mysticism'));
  if (ORDERS[id].level > cap) return `Orders of level ${ORDERS[id].level} are beyond you yet (Deep Mysticism or more levels open them)`;
  h.orders.push(id);
  if (!silent) game.sendTo(s, { t: 'toast', msg: `Learnt: ${ORDERS[id].name[0]}.`, kind: 'gold' });
  return null;
}

/** Taught at a port's guild of orders, for silver. */
export function learnAtGuild(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const p = s.profile!;
  const list = guildOf(port.id, port.size);
  if (!list) return 'No guild of orders here';
  if (!isOrder(id) || !list.includes(id)) return 'This guild does not teach that order';
  const price = guildPrice(id);
  if (p.gold < price) return `Needs ${price} silver`;
  const why = learnOrder(game, s, id);
  if (why) return why;
  p.gold -= price;
  game.db.ledger(s.accountId, 'guild_order', -price, id);
  return null;
}

/** A drowned shrine on an island (the landing's 'shrine', exploration.ts): its order, and her will whole again. */
export function onShrine(game: Game, s: PlayerSession, islandId: number): void {
  const p = s.profile!;
  const h = heroOf(p);
  const id = shrineOrder(islandId);
  h.mana = willMax(p, h);
  if (!h.orders.includes(id) && !learnOrder(game, s, id, true)) game.sendTo(s, { t: 'toast', msg: `The shrine teaches you ${ORDERS[id].name[0]}.`, kind: 'gold' });
  else game.sendTo(s, { t: 'toast', msg: 'The shrine has nothing more to teach you; your will is restored.', kind: 'info' });
}

/** A spring ashore (HoMM3's well): her will whole again. */
export function onSpring(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const h = heroOf(p);
  h.mana = willMax(p, h);
  game.sendTo(s, { t: 'toast', msg: 'The spring restores your will.', kind: 'info' });
}

/** Where she was docked on the last beat (a new port fills her will). */
const lastDock = new WeakMap<PlayerSession, string | null>();

/** Once a second: a new day at sea fills a quarter of her will; a port half, a guild's port all of it. */
export function heroSecond(game: Game, s: PlayerSession): void {
  const p = s.profile;
  const ship = s.ship;
  if (!p || !ship) return;
  const h = heroOf(p);
  const max = willMax(p, h);
  const day = Math.floor(game.now / DAY_LENGTH_SEC);
  if (h.day !== day) {
    if (h.day >= 0 && h.mana < max) {
      const a = artTotals(wornOf(p));
      h.mana = Math.min(max, h.mana + max * WILL_DAY * (1 + 0.1 * rankOf(h.skills, 'mysticism') + a.willDay));
      game.sendTo(s, { t: 'toast', msg: `A new day: your will grows to ${Math.floor(h.mana)}.`, kind: 'info' });
    }
    h.day = day;
  }
  const docked = ship.docked ?? null;
  if (docked && lastDock.get(s) !== docked && lastDock.has(s)) {
    const port = game.portById(docked);
    const full = port && guildOf(port.id, port.size);
    if (h.mana < max) {
      h.mana = Math.min(max, h.mana + max * (full ? 1 : WILL_PORT));
      if (h.mana >= max) game.sendTo(s, { t: 'toast', msg: 'Your will is restored.', kind: 'info' });
    }
  }
  lastDock.set(s, docked);
}

// ------------------------------------------------------------------ sea orders

/** How much a sea order does: half the battle's lift from her Power, her school's skill and artifacts. */
function seaMul(p: Profile, h: HeroRec, id: OrderId): number {
  const prim = heroPrims(p, h);
  const a = artTotals(wornOf(p)).battle;
  const sc = ORDERS[id].school;
  return 1 + (orderMul(prim.pow, rankOf(h.skills, SCHOOL_SKILL[sc]), rankOf(h.skills, 'mysticism'), a.orders + a.school[sc]) - 1) * 0.5;
}

/** The will a sea order costs her. */
export function seaCost(p: Profile, h: HeroRec, id: OrderId): number {
  const a = artTotals(wornOf(p));
  return orderCost(id, rankOf(h.skills, SCHOOL_SKILL[ORDERS[id].school]), Math.max(0.25, 1 - a.battle.cost - a.seaCost));
}

/** A sea order cast from the HUD. */
export function castSea(game: Game, s: PlayerSession, id: string): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const h = heroOf(p);
  if (!isOrder(id)) return 'No such order';
  if (!h.orders.includes(id)) return 'You do not know that order';
  const def = ORDERS[id];
  if (def.use !== 'sea') return 'That order is for the boarding battle';
  if (ship.docked) return 'Not in port';
  if (ship.boarding) return 'Not while boarding';
  const now = game.now;
  if ((h.cd[id] ?? 0) > now) return 'That order is not ready yet';
  const cost = seaCost(p, h, id);
  if (h.mana < cost) return `Not enough will: ${cost} needed`;
  const k = seaMul(p, h, id);
  const dur = def.dur ?? 0;
  const others = (r: number): ShipEntity[] => {
    const out: ShipEntity[] = [];
    game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
      if (o !== ship && o.alive && !o.docked && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) <= r) out.push(o);
    });
    return out;
  };
  switch (id as SeaOrderId) {
    case 'fair_wind':
      ship.addEffect({ id: 'order_fair_wind', until: now + dur, mods: { maxSpeed: 0.15 * k } }, now);
      break;
    case 'fog_bank':
      ship.addEffect({ id: 'order_fog_bank', until: now + dur, mods: { incomingDamageMul: -0.25 * k }, flags: ['hidden'] }, now);
      break;
    case 'deep_sight':
      ship.addEffect({ id: 'order_deep_sight', until: now + dur, mods: { detection: 0.4 * k } }, now);
      break;
    case 'mend_hull':
      if (ship.hull >= ship.stats.hullMax) return 'The hull is whole';
      ship.hull = Math.min(ship.stats.hullMax, ship.hull + ship.stats.hullMax * 0.1 * k);
      break;
    case 'becalm': {
      const near = others(700);
      if (!near.length) return 'No ship near to becalm';
      for (const o of near) o.addEffect({ id: 'becalmed', until: now + dur, mods: { maxSpeed: -0.4 }, source: ship.id }, now);
      break;
    }
    case 'gale':
      ship.addEffect({ id: 'order_gale', until: now + dur, mods: { maxSpeed: 0.3 * k } }, now);
      for (const o of others(700)) o.sails = Math.max(0, o.sails - o.stats.sailHpMax * 0.125);
      break;
  }
  h.mana -= cost;
  h.cd[id] = now + (def.cd ?? 60);
  game.sendTo(s, { t: 'toast', msg: `${def.name[0]}: ${cost} will.`, kind: 'info' });
  return null;
}

// ------------------------------------------------------------------ the boarding battle

/** The hero a ship brings aboard: a captain's from her profile, the sea's by her ship's level. */
export function heroInput(game: Game, ship: ShipEntity): HeroBattle {
  const s = game.sessionOf(ship);
  const p = s?.profile;
  if (!p) return npcHeroBattle(ship.shipLevel, ship.captain ?? null);
  const h = heroOf(p);
  return heroBattle(heroPrims(p, h), h.skills, artTotals(wornOf(p)), h.orders, h.mana);
}

/** After a battle: the will she spent, and the fallen her First Aid patches up. */
export function afterBattle(game: Game, ship: ShipEntity, left: number, lost: { u: string; n: number }[], raise: number): void {
  const s = game.sessionOf(ship);
  const p = s?.profile;
  if (!s || !p) return;
  const h = heroOf(p);
  if (left >= 0) h.mana = Math.max(0, Math.min(willMax(p, h), left));
  if (raise <= 0 || !ship.alive) return;
  let room = Math.max(0, ship.stats.crewMax - ship.crew), n = 0;
  for (const x of lost) {
    const k = Math.min(room, Math.floor(x.n * raise));
    if (k <= 0) continue;
    ship.addMen(x.u as never, k);
    room -= k;
    n += k;
  }
  if (n > 0) game.sendTo(s, { t: 'toast', msg: `First aid: ${n} of your fallen stand again.`, kind: 'good' });
}

// ------------------------------------------------------------------ artifacts

/** An artifact found: a boss's, a hoard's, a stormed lair's or a guarded ship's (into the locker, if there is room). */
export function artifactFind(game: Game, s: PlayerSession, source: keyof typeof ART_WEIGHTS, id?: string): Item | null {
  const art = id && ARTIFACTS[id] ? id : rollArtifact(hr(game), source);
  const it = makeArtifact(art, 0);
  if (!takeItem(game, s, it)) return null;
  game.sendTo(s, { t: 'toast', msg: `An artifact: ${ARTIFACTS[art].name[0]}!`, kind: 'gold' });
  return s.profile!.stash[s.profile!.stash.length - 1];
}

/** A chance at one: a hoard dug up, a guarded ship taken. */
export function maybeArtifact(game: Game, s: PlayerSession, source: 'chest' | 'guard', chance: number): void {
  if (hr(game).chance(chance)) artifactFind(game, s, source);
}

/** Buys one of a port's artifact merchant's three pieces. */
export function buyArtifact(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const h = heroOf(p);
  if (!artMerchantAt(port.id, port.size)) return 'No artifact merchant here';
  const day = dayOf(game.wallNow());
  const id = artWares(port.id, day)[index];
  const key = `${day}:${port.id}:${index}`;
  if (!id || h.bought.includes(key)) return 'That is sold';
  if (p.stash.length >= STASH_SIZE) return 'Your locker is full';
  const price = ARTIFACTS[id].price;
  if (p.gold < price) return `Needs ${price} silver`;
  p.gold -= price;
  game.db.ledger(s.accountId, 'artifact', -price, id);
  p.stash.push(makeArtifact(id, p.itemSeq++));
  h.bought = [...h.bought.filter((x) => Number(x.split(':')[0]) >= day - 1), key];
  game.sendTo(s, { t: 'toast', msg: `Bought ${ARTIFACTS[id].name[0]}.`, kind: 'gold' });
  return null;
}

// ------------------------------------------------------------------ what she sees

export function heroView(p: Profile): HeroView {
  const h = heroOf(p);
  const a = artTotals(wornOf(p));
  const costs: Partial<Record<OrderId, number>> = {};
  const bs = heroBattle(heroPrims(p, h), h.skills, a, h.orders, h.mana);
  for (const id of h.orders) costs[id] = ORDERS[id].use === 'sea' ? seaCost(p, h, id) : bs.cost[id as keyof typeof bs.cost] ?? ORDERS[id].cost;
  const pending = pendingChoices(p, h);
  return {
    prim: { ...h.prim }, artPrim: a.prim, will: Math.floor(h.mana), willMax: willMax(p, h), skills: h.skills.map((x) => ({ ...x })),
    pending, offer: pending > 0 ? currentOffer(p, h) : [], orders: [...h.orders], cap: orderLevelCap(p.level, rankOf(h.skills, 'mysticism')),
    cd: { ...h.cd }, costs, sets: a.sets,
  };
}

export function heroPortView(game: Game, s: PlayerSession): HeroPortView | null {
  const ship = s.ship;
  const port = ship?.docked ? game.portById(ship.docked) : undefined;
  if (!port || !s.profile) return null;
  const h = heroOf(s.profile);
  const g = guildOf(port.id, port.size);
  const day = dayOf(game.wallNow());
  return {
    port: port.id,
    guild: g ? g.map((id) => ({ id, price: guildPrice(id) })) : null,
    wares: artMerchantAt(port.id, port.size) ? artWares(port.id, day).map((art, i) => ({ art, price: h.bought.includes(`${day}:${port.id}:${i}`) ? -1 : ARTIFACTS[art].price })) : null,
  };
}

/** A captain's word to her hero. */
export function heroAction(game: Game, s: PlayerSession, msg: { action?: string; pick?: number; id?: string; index?: number }): string | null {
  const ship = s.ship!;
  const port = ship.docked ? game.portById(ship.docked) : undefined;
  let why: string | null = null;
  switch (msg.action) {
    case 'skill':
      why = pickSkill(game, s, Math.trunc(Number(msg.pick)));
      break;
    case 'learn':
      why = port ? learnAtGuild(game, s, port, String(msg.id ?? '')) : 'No guild of orders here';
      break;
    case 'cast':
      why = castSea(game, s, String(msg.id ?? ''));
      break;
    case 'buy':
      why = port ? buyArtifact(game, s, port, Math.trunc(Number(msg.index))) : 'No artifact merchant here';
      break;
    case 'view':
      break;
    default:
      return 'No such order';
  }
  game.sendTo(s, { t: 'hero_port', view: heroPortView(game, s) });
  game.pushSelf(s, true);
  return why;
}

// ------------------------------------------------------------------ the tester's console

/** `/prim`, `/skill`, `/order`, `/art`, `/will` (admin.ts). */
export function heroAdmin(game: Game, s: PlayerSession, cmd: string, args: string[]): string {
  const p = s.profile!;
  const h = heroOf(p);
  const n = (i: number) => Number(args[i]);
  switch (cmd) {
    case 'prim': {
      if (args[0] === 'reset') {
        h.prim = primsAtLevel(p.captain, h.seed, p.level);
        h.primLv = p.level;
      } else if (PRIMS.includes(args[0] as never) && Number.isFinite(n(1))) h.prim[args[0] as keyof Prims] = Math.max(0, Math.round(n(1)));
      else if (args.length) return 'Usage: /prim [atk|def|pow|will N | reset]';
      const t = heroPrims(p, h);
      return `Attack ${t.atk} · Defense ${t.def} · Power ${t.pow} · Will ${t.will} (${Math.floor(h.mana)}/${willMax(p, h)}).`;
    }
    case 'skill': {
      if (args[0] === 'clear') {
        h.skills = [];
        h.picked = 1;
      } else if (args[0] === 'offer') {
        h.picked = Math.max(1, p.level - Math.max(1, Math.round(n(1) || 1)));
      } else if (args[0] && SKILLS[args[0] as never]) {
        const r = Math.max(0, Math.min(3, Math.round(Number.isFinite(n(1)) ? n(1) : 1)));
        const had = h.skills.find((x) => x.id === args[0]);
        if (!r) h.skills = h.skills.filter((x) => x.id !== args[0]);
        else if (had) had.r = r as SkillSlot['r'];
        else if (h.skills.length < SKILL_SLOTS) h.skills.push({ id: args[0] as SkillSlot['id'], r: r as SkillSlot['r'] });
        else return 'All eight slots are taken.';
      } else if (args.length) return `Usage: /skill id [0-3] | offer [n] | clear · ${Object.keys(SKILLS).join(' ')}`;
      applyHero(game, s);
      return `Skills: ${h.skills.map((x) => `${SKILLS[x.id].name[0]} ${x.r}`).join(', ') || 'none'}; choices waiting ${pendingChoices(p, h)}.`;
    }
    case 'order': {
      if (args[0] === 'all') {
        for (const id of LEARNABLE) if (!h.orders.includes(id)) h.orders.push(id);
      } else if (args[0] === 'clear') h.orders = startingOrders(p.captain);
      else if (args[0] && isOrder(args[0])) {
        if (!h.orders.includes(args[0])) h.orders.push(args[0]);
      } else if (args.length) return `Usage: /order id | all | clear · ${LEARNABLE.join(' ')}`;
      h.cd = {};
      return `Orders: ${h.orders.length}.`;
    }
    case 'art': {
      if (args[0] === 'set') {
        const sets: Record<string, string[]> = { regalia: ['drowned_bicorne', 'kelp_coat', 'needle_of_the_deep'], hook: ['red_hook_axe', 'hook_brace', 'bloodied_baldric'], storm: ['squall_glass', 'deck_grip_boots', 'ring_of_the_gale'] };
        const list = sets[args[1] ?? 'regalia'];
        if (!list) return 'Usage: /art set regalia|hook|storm';
        for (const id of list) artifactFind(game, s, 'boss', id);
        return `The locker holds ${p.stash.length}.`;
      }
      if (args[0] === 'list') return ARTIFACT_IDS.join(' ');
      const id = args[0] && ARTIFACTS[args[0]] ? args[0] : undefined;
      if (args[0] && !id) return 'Usage: /art [id | set regalia|hook|storm | list]';
      artifactFind(game, s, 'boss', id);
      return `The locker holds ${p.stash.length}.`;
    }
    case 'will': {
      const max = willMax(p, h);
      h.mana = args[0] === undefined || args[0] === 'full' ? max : Math.max(0, Math.min(max, n(0) || 0));
      h.cd = {};
      return `Will ${Math.floor(h.mana)}/${max}.`;
    }
  }
  return 'Unknown command.';
}
