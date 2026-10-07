// The sea director (docs/12 P2): so the sea is never empty. While a captain sails on in quiet water, a tension grows;
// when it is high enough something happens — a sign on the horizon (smoke, birds, a spout, a glint) a mile off, which
// opens as a card when she comes near, or a thing aboard that opens at once. The pick weighs the waters, the time,
// the weather, the land near, the ship's state and what happened lately; the outcome goes through the systems the
// game already has (silver, the hold, the crew, standing, the law, effects, gear, charts, the sea's own ships).
//
// Sailing faster brings things sooner; a harbour's waters and a fight keep the director still.

import { catAboard, givePet, sanitizePets } from './pets.ts';
import { tattooCount } from './tattoos.ts';
import { questEvent } from './quests.ts';
import { eclipseOn, lostFleetIn, redTideAt } from './happenings.ts';
import { onboardingProtected } from './onboarding.ts';
import { siteViews } from './expeditions.ts';
import { ENCOUNTERS, ENCOUNTER_IDS, SEA_LETTERS } from '../../../shared/src/data/encounters.ts';
import type { EncounterDef, EncounterId, SightKind } from '../../../shared/src/data/encounters.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { gearSource, makeItem } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import type { EncounterView, SightView } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { applyDamage, igniteShip } from './combat.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { levelNear, newBrain, spawnPirate } from './npc.ts';
import { pirateSworn } from './colours.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { groupOfAccount } from './party.ts';
import { isBeast } from './beasts.ts';
import { SEA_MINI_CHANCE, openMinigame, seaMinigame } from './minigames.ts';
import { inDescent } from './descent.ts';

/** How close a sign must be for its card to open, and how far a captain may leave it before it is gone. */
export const OPEN_R = 380;
const LOSE_R = 4500;
const LIFE_SEC = 6 * 60;
/** No encounters within this of a port. */
const HARBOUR_R = 1500;
/** Encounters that lead on (owner, 2026-09-29: one thing should lead to the next): what she chose, what may follow,
 * how likely, and after how many seconds. The follow-up still has to fit her waters; it shows as a sign as usual. */
export const FOLLOW: Partial<Record<EncounterId, { choice: string; next: EncounterId; chance: number; after: number }[]>> = {
  raft: [{ choice: 'take', next: 'bottle', chance: 0.5, after: 40 }],
  bottle: [{ choice: 'fish', next: 'flotsam', chance: 0.45, after: 35 }],
  flotsam: [{ choice: 'gather', next: 'barrel', chance: 0.45, after: 30 }],
  barrel: [{ choice: 'fish', next: 'derelict', chance: 0.3, after: 45 }],
  derelict: [{ choice: 'search', next: 'ambush', chance: 0.4, after: 25 }],
  burning_ship: [{ choice: 'grab', next: 'ambush', chance: 0.35, after: 25 }],
  fishermen: [{ choice: 'help', next: 'peddler', chance: 0.4, after: 40 }, { choice: 'help', next: 'bird_shoal', chance: 0.3, after: 30 }],
  mapmaker: [{ choice: 'rescue', next: 'sunken_bell', chance: 0.35, after: 50 }],
  smuggler: [{ choice: 'buy', next: 'patrol_search', chance: 0.45, after: 45 }],
  sinking_merchant: [{ choice: 'save', next: 'raft', chance: 0.35, after: 40 }],
  dolphins: [{ choice: '', next: 'bird_shoal', chance: 0.3, after: 30 }],
  albatross: [{ choice: 'shoot', next: 'squall', chance: 0.6, after: 30 }],
};

/** The same encounter not again within this. */
const REPEAT_SEC = 12 * 60;

interface Pace {
  tension: number;
  threshold: number;
  /** The next link of a chain (FOLLOW): what comes of what she chose, and when. */
  chain?: { def: EncounterId; at: number } | null;
  last: Partial<Record<EncounterId, number>>;
  sightsKey: string;
}

export interface Live {
  id: number;
  def: EncounterId;
  account: number;
  x: number;
  y: number;
  until: number;
  opened: boolean;
  resolved: boolean;
}

interface DirectorState {
  pace: Map<number, Pace>;
  live: Map<number, Live>;
  seq: number;
}

const states = new WeakMap<Game, DirectorState>();

function st(game: Game): DirectorState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { pace: new Map(), live: new Map(), seq: 1 }));
  return s;
}

/** The quiet sea's patience before the next thing happens, by the safety of the waters (tension: ~0.8 s of sailing
 * each at a cruising speed). Between these the small life of the sea (sealife.ts) keeps her company. */
function newThreshold(game: Game, safety: string): number {
  // docs/19 D3: twice as often as it was (70–110 and 50–90).
  return (safety === 'safe' ? game.rng.range(70, 110) : game.rng.range(50, 90)) / DIRECTOR_MUL;
}
/** docs/19 D3: the sea's events twice as often. */
export const DIRECTOR_MUL = 2;

function nearestIsland(game: Game, x: number, y: number): { is: Island | null; d: number } {
  let best: Island | null = null, bd = Infinity;
  for (const is of game.world.islands) {
    if (is.minor) continue;
    const d = dist(is.x, is.y, x, y) - is.radius;
    if (d < bd) {
      bd = d;
      best = is;
    }
  }
  return { is: best, d: bd };
}

function nearPort(game: Game, x: number, y: number): boolean {
  return game.world.ports.some((p) => dist(p.x, p.y, x, y) < HARBOUR_R);
}

/** The sea keeps still for a captain in the First Watch, with a party ashore, at a boss or at an expedition's site —
 *  and down the Descent's stair (a bosun's quiz came up over its first tier's fight). */
function busyElsewhere(game: Game, s: PlayerSession): boolean {
  const ship = s.ship!;
  if (onboardingProtected(s) || ship.landing || ship.hasEffect('submerged') || openMinigame(game, s) || inDescent(game, s.accountId)) return true;
  let deep = false;
  game.forShipsNear(ship.state.x, ship.state.y, 6000, (o) => {
    if ((o.cls.monster && !isBeast(o)) || o.bossOf || o.npcRole === 'boss') deep = true; // whales passing are no boss
  });
  if (deep) return true;
  return siteViews(game).some((site) => dist(site.x, site.y, ship.state.x, ship.state.y) < 3000);
}

/** Whether a captain sails quiet water the sea may stir: under way, out of a fight, a harbour and a boarding. */
export function quietSea(game: Game, s: PlayerSession): boolean {
  const ship = s.ship!;
  return !(ship.inCombat(game.now) || ship.state.speed < 1.5 || nearPort(game, ship.state.x, ship.state.y) || !!ship.boarding || busyElsewhere(game, s));
}

/** Stolen or contraband goods aboard (for the Crown's patrols). */
function hotGoods(s: PlayerSession): GoodId[] {
  const ship = s.ship!;
  const p = s.profile!;
  return (Object.keys(ship.cargo) as GoodId[]).filter((g) => (ship.cargo[g] ?? 0) > 0 && (GOODS[g].contraband || (p.stolen[g] ?? 0) > 0));
}

/** Whether an encounter may happen to this captain here and now. */
export function fits(game: Game, s: PlayerSession, def: EncounterDef): boolean {
  const ship = s.ship!;
  const w = def.where;
  const reg = REGIONS[ship.region];
  if (w.safety && !w.safety.includes(reg.safety)) return false;
  if (w.regions && !w.regions.includes(ship.region)) return false;
  const night = isNight(game.now);
  if (w.night && !night && !(def.group === 'mystic' && eclipseOn(game))) return false;
  if (w.day && night) return false;
  // In an eclipse the dark is as good as night and fog to the uncanny; a lost fleet's hulls drift in the open.
  const eclipse = def.group === 'mystic' && eclipseOn(game);
  if (w.fog && game.weatherAt(ship.state.x, ship.state.y) !== 'fog' && !eclipse && !(def.id === 'derelict' && lostFleetIn(game, ship.region))) return false;
  if (w.coast || w.open || w.biomes) {
    const n = nearestIsland(game, ship.state.x, ship.state.y);
    if (w.coast && n.d > 2500) return false;
    if (w.open && n.d < 3000) return false;
    if (w.biomes && (!n.is || n.d > 4000 || !w.biomes.includes(n.is.biome))) return false;
  }
  if (w.hot && !hotGoods(s).length) return false;
  if (w.lowMorale && ship.morale >= 25) return false;
  if (w.longVoyage && (!ship.voyageStart || game.now - ship.voyageStart < 1200)) return false;
  // The ambush only where no pirate already sails near.
  if (def.id === 'ambush') {
    let near = false;
    game.forShipsNear(ship.state.x, ship.state.y, 5000, (o) => {
      if (o.npcRole === 'pirate') near = true;
    });
    if (near) return false;
  }
  return true;
}

/** The weight of an encounter here: danger grows in wilder waters. */
function weightOf(game: Game, s: PlayerSession, def: EncounterDef): number {
  const safety = REGIONS[s.ship!.region].safety;
  // An eclipse: the uncanny five times as often. A lost fleet: its hulls and wreckage everywhere.
  if (def.group === 'mystic' && eclipseOn(game)) return def.weight * 5;
  if ((def.id === 'derelict' || def.id === 'flotsam') && lostFleetIn(game, s.ship!.region)) return def.weight * 4;
  // A red tide: the sharks and the thing with the arms come for the dead fish.
  if ((def.id === 'sharks' || def.id === 'tentacle') && redTideAt(game, s.ship!.region)) return def.weight * 4;
  if (def.id === 'ambush') return safety === 'lawless' ? 30 : 20;
  if (def.group === 'danger' && safety === 'lawless') return def.weight * 1.5;
  return def.weight;
}

/** The next encounter for this captain, or null if nothing fits. */
export function pickEncounter(game: Game, s: PlayerSession, pace: Pace): EncounterId | null {
  const now = game.now;
  const pool: [EncounterId, number][] = [];
  for (const id of ENCOUNTER_IDS) {
    const def = ENCOUNTERS[id];
    if ((pace.last[id] ?? -1e9) > now - REPEAT_SEC) continue;
    if (!fits(game, s, def)) continue;
    pool.push([id, weightOf(game, s, def)]);
  }
  if (!pool.length) return null;
  return game.rng.weighted(pool);
}

/** Where a sign shows: a mile off, to one side of her course, on open water. */
function sightSpot(game: Game, ship: ShipEntity): { x: number; y: number } | null {
  for (let k = 0; k < 12; k++) {
    const side = game.rng.chance(0.5) ? 1 : -1;
    const a = ship.state.heading + side * game.rng.range(0.45, 1.2);
    const r = game.rng.range(900, 1600);
    const v = headingVec(a);
    const x = ship.state.x + v.x * r, y = ship.state.y + v.y * r;
    if (!isLand(game.world, x, y) && !isLand(game.world, x + 60, y) && !isLand(game.world, x, y + 60) && game.inZone(x, y)) return { x, y };
  }
  return null;
}

/** Makes an encounter happen: a sign put on the water, or a thing aboard opened at once. */
export function startEncounter(game: Game, s: PlayerSession, def: EncounterId): Live | null {
  const ship = s.ship!;
  const d = ENCOUNTERS[def];
  const S = st(game);
  let at = { x: ship.state.x, y: ship.state.y };
  if (d.sight) {
    const spot = sightSpot(game, ship);
    if (!spot) return null;
    at = spot;
  }
  const live: Live = { id: S.seq++, def, account: s.accountId, x: at.x, y: at.y, until: game.now + LIFE_SEC, opened: false, resolved: false };
  S.live.set(live.id, live);
  const pace = paceOf(game, s);
  pace.last[def] = game.now;
  if (!d.sight) openCard(game, s, live);
  return live;
}

function paceOf(game: Game, s: PlayerSession): Pace {
  const S = st(game);
  let p = S.pace.get(s.accountId);
  if (!p) S.pace.set(s.accountId, (p = { tension: 0, threshold: newThreshold(game, REGIONS[s.ship?.region ?? 'black_coast'].safety), last: {}, sightsKey: '' }));
  return p;
}

/** The captains who see a sign or a card: its owner and their group within a mile. */
function watchers(game: Game, live: Live): PlayerSession[] {
  const owner = game.sessionByAccount(live.account);
  if (!owner?.ship) return [];
  const out = [owner];
  const g = groupOfAccount(game, live.account);
  for (const acc of g?.members ?? []) {
    if (acc === live.account) continue;
    const m = game.sessionByAccount(acc);
    if (m?.ship && !m.ship.docked && dist(m.ship.state.x, m.ship.state.y, live.x, live.y) < 2500) out.push(m);
  }
  return out;
}

function openCard(game: Game, s: PlayerSession, live: Live): void {
  live.opened = true;
  const def = ENCOUNTERS[live.def];
  const view: EncounterView = { id: live.id, def: live.def };
  // A thing that simply happens is settled at once; its card shows what came of it.
  if (!def.choices.length) {
    settle(game, s, live, '');
    return;
  }
  for (const w of watchers(game, live)) game.sendTo(w, { t: 'encounter', view });
}

/** Every second: tension, new encounters, cards opening, signs fading. */
export function stepDirector(game: Game): void {
  if (!game.directorOn) return;
  const S = st(game);
  const now = game.now;
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || ship.docked || !ship.alive || ship.ghost) continue;
    const pace = paceOf(game, s);
    const safety = REGIONS[ship.region].safety;
    const mine = [...S.live.values()].some((l) => l.account === s.accountId && !l.resolved);
    const still = !quietSea(game, s);
    if (!still && !mine) pace.tension += Math.min(2, 0.6 + ship.state.speed / 12);
    // A chain's next link comes in its own time, before the next of the sea's own.
    if (pace.chain && game.now >= pace.chain.at && !mine && !still) {
      const next = pace.chain.def;
      pace.chain = null;
      if (fits(game, s, ENCOUNTERS[next]) && startEncounter(game, s, next)) {
        pace.tension = 0;
        continue;
      }
    }
    // (a chain's link waits its own time: the sea's own does not come before it, docs/19 D3)
    if (pace.tension >= pace.threshold && !mine && !still && !pace.chain) {
      pace.tension = 0;
      pace.threshold = newThreshold(game, safety);
      // Now and then a passing boat offers one of the games of the islands (a riddle, dice, a hoist, the stars).
      if (game.rng.chance(SEA_MINI_CHANCE) && seaMinigame(game, s)) continue;
      const def = pickEncounter(game, s, pace);
      if (def) startEncounter(game, s, def);
    }
  }
  for (const live of [...S.live.values()]) {
    const owner = game.sessionByAccount(live.account);
    const ship = owner?.ship;
    if (live.resolved || !ship || ship.docked || now > live.until || dist(ship.state.x, ship.state.y, live.x, live.y) > LOSE_R) {
      if (!live.resolved && live.opened && owner && ENCOUNTERS[live.def].choices.length) for (const w of watchers(game, live)) game.sendTo(w, { t: 'encounter', view: null });
      S.live.delete(live.id);
      continue;
    }
    if (!live.opened && dist(ship.state.x, ship.state.y, live.x, live.y) < OPEN_R) openCard(game, owner!, live);
  }
  for (const s of game.sessions) sendSights(game, s);
}

/** The signs a captain can see (their own and their group's), sent when they change. */
function sendSights(game: Game, s: PlayerSession): void {
  if (!s.ship) return;
  const pace = paceOf(game, s);
  const list: SightView[] = [];
  for (const live of st(game).live.values()) {
    const def = ENCOUNTERS[live.def];
    if (live.resolved || live.opened || !def.sight) continue;
    if (!watchers(game, live).includes(s)) continue;
    list.push({ id: live.id, kind: def.sight as SightKind, x: Math.round(live.x), y: Math.round(live.y) });
  }
  const key = list.map((x) => x.id).join(',');
  if (key === pace.sightsKey) return;
  pace.sightsKey = key;
  game.sendTo(s, { t: 'sights', list });
}

/** A captain's choice on an open card. */
export function chooseEncounter(game: Game, s: PlayerSession, id: number, choice: string): string | null {
  const live = st(game).live.get(id);
  if (!live || live.resolved || !live.opened) return 'That moment has passed';
  if (!watchers(game, live).includes(s)) return 'That moment has passed';
  const def = ENCOUNTERS[live.def];
  if (!def.choices.some((c) => c.id === choice)) return 'No such choice';
  settle(game, s, live, choice);
  return null;
}

// ------------------------------------------------------------------------------------------------ outcomes

interface Vars {
  n?: number;
  silver?: number;
  good?: GoodId;
  item?: Item;
}

function settle(game: Game, s: PlayerSession, live: Live, choice: string): void {
  live.resolved = true;
  const r = resolve(game, s, live, choice);
  const pace = paceOf(game, s);
  for (const f of FOLLOW[live.def] ?? []) {
    if (f.choice !== choice && !(f.choice === '' && !ENCOUNTERS[live.def].choices.length)) continue;
    if (!game.rng.chance(f.chance)) continue;
    pace.chain = { def: f.next, at: game.now + f.after };
    break;
  }
  for (const w of watchers(game, live)) game.sendTo(w, { t: 'encounter_result', id: live.id, def: live.def, outcome: r.outcome, vars: r.vars });
  game.pushSelf(s, true);
}

/** Silver scaled to her level: more at sea for bigger ships. */
export function purse(s: PlayerSession, base: number): number {
  return Math.round(base * (1 + 0.5 * (s.ship!.shipLevel - 1)));
}

function giveSilver(game: Game, s: PlayerSession, n: number, why: string): number {
  s.profile!.gold += n;
  game.db.ledger(s.accountId, 'encounter', n, why);
  return n;
}

/** Goods into the hold, as many as fit. */
export function giveGoods(ship: ShipEntity, good: GoodId, n: number): number {
  const st2 = ship.stats;
  const free = st2.holdVolume - cargoVolume(ship.cargo, st2.contrabandVolumeMul, st2.materialVolumeMul, st2.provisionVolumeMul, st2.cursedVolumeMul);
  const per = Math.max(0.01, GOODS[good].volume * (GOODS[good].contraband ? st2.contrabandVolumeMul : 1));
  const k = Math.max(0, Math.min(n, Math.floor((free + 1e-6) / per)));
  if (k > 0) ship.cargo[good] = (ship.cargo[good] ?? 0) + k;
  return k;
}

/** Hands into the crew (as far as her berths go), of a trade. */
export function giveHands(s: PlayerSession, n: number, prof: 'sailor' | 'gunner' | 'marine' = 'sailor'): number {
  const ship = s.ship!;
  const k = Math.max(0, Math.min(n, ship.stats.crewMax - ship.crew));
  ship.crew += k;
  const pools = s.profile!.company.pools as Record<string, number>;
  pools[prof] = (pools[prof] ?? 0) + k;
  return k;
}

export function loseHands(s: PlayerSession, n: number): number {
  const ship = s.ship!;
  const k = Math.min(n, Math.max(0, ship.crew - 1));
  ship.crew -= k;
  return k;
}

function buff(game: Game, ship: ShipEntity, id: string, sec: number, mods: Record<string, number>): void {
  ship.addEffect({ id, until: game.now + sec, mods }, game.now);
}

/** The captain's characteristic (from their gear) as a chance. */
function check(s: PlayerSession, stat: 'trade' | 'leadership' | 'fencing' | 'navigation', base: number): number {
  const worn = [...Object.values(s.profile!.captainGear)].filter((x): x is Item => !!x);
  const pts = gearSource(worn).cap[stat] ?? 0;
  return Math.min(0.95, base + pts * 0.02);
}

function provisions(ship: ShipEntity, n: number): number {
  if (n >= 0) return giveGoods(ship, 'provisions', n);
  const k = Math.min(-n, Math.floor(ship.cargo.provisions ?? 0));
  ship.cargo.provisions = (ship.cargo.provisions ?? 0) - k;
  if (!ship.cargo.provisions) delete ship.cargo.provisions;
  return k;
}

/** Sea's own ships put out against the captain (pirates, a ghost). */
function sendPirates(game: Game, s: PlayerSession, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = spawnPirate(game, s.ship!);
    if (p) {
      const b = game.npcs.get(p.id);
      if (b) b.chase = { id: s.ship!.id, until: game.now + 300 };
      pirateSworn(game, b, s.ship!); // the encounter's own pirates: they come, neutral colours or not (docs/24 D1)
    }
  }
}

function sendGhost(game: Game, s: PlayerSession, live: Live): void {
  const ship = s.ship!;
  const lv = levelNear(game, ship, ship.region);
  const g = game.spawnNpcShip('ghost', lv >= 7 ? 'ghost_ship' : lv >= 5 ? 'brig' : 'sloop', 'choir', live.x, live.y, 0, { ship: 'The Drowned Bargain', captain: 'the Drowned Captain' });
  game.setNpcLevel(g, lv);
  const b = game.npcs.get(g.id) ?? newBrain(g.id, 'ghost', game.now);
  b.active = true;
  b.chase = { id: ship.id, until: game.now + 300 };
  game.npcs.set(g.id, b);
  game.grid.upsert(g.id, g.state.x, g.state.y);
}

function item(game: Game, s: PlayerSession, source: 'common' | 'elite' | 'quest', slots?: Parameters<typeof makeItem>[2]['slots']): Item | undefined {
  const it = makeItem(game.rng, 0, { ilvl: s.ship!.shipLevel, source, ...(slots ? { slots } : {}) });
  return takeItem(game, s, it) ? it : undefined;
}

function resolve(game: Game, s: PlayerSession, live: Live, choice: string): { outcome: string; vars: Vars } {
  const ship = s.ship!;
  const p = s.profile!;
  const rng = game.rng;
  const O = (outcome: string, vars: Vars = {}) => ({ outcome, vars });
  switch (live.def) {
    // -------------------------------------------------------------- people
    case 'raft': {
      if (choice === 'pass') {
        ship.morale = Math.max(0, ship.morale - 5);
        return O('passed');
      }
      const vet = rng.chance(0.25);
      const n = giveHands(s, rng.int(2, 6)) ;
      if (vet) giveHands(s, 1, 'gunner');
      p.rescued = (p.rescued ?? 0) + n + (vet ? 1 : 0);
      questEvent(game, s, { k: 'rescue', n: n + (vet ? 1 : 0) });
      p.refugees = (p.refugees ?? 0) + 1; // one of them will want a home ashore (docs/12 P7)
      return O(vet ? 'taken_vet' : 'taken', { n: n + (vet ? 1 : 0) });
    }
    case 'convict':
      if (choice === 'hide') {
        giveHands(s, 1, 'marine');
        if (rng.chance(0.3)) game.addInfamy(ship, 8, 'harboured a convict');
        return O('hidden');
      }
      game.adjustRep(ship, 'crown', 2);
      return O('handed', { silver: giveSilver(game, s, purse(s, rng.int(150, 300)), 'convict') });
    case 'sinking_merchant': {
      if (choice === 'leave') return O('left');
      if (rng.chance(0.25)) {
        sendPirates(game, s, 2);
        return O('trap');
      }
      const good = rng.pick(['sugar', 'cloth', 'spices', 'tobacco', 'rum'] as GoodId[]);
      const n = giveGoods(ship, good, rng.int(4, 10) + ship.shipLevel);
      game.adjustRep(ship, 'league', 2);
      return O('saved', { n, good });
    }
    case 'peddler': {
      if (choice === 'pass') return O('passed');
      const it = makeItem(rng, 0, { ilvl: ship.shipLevel, rarity: rng.chance(0.25) ? 3 : 2 });
      const full = Math.round(120 * (1 + 0.06 * (it.ilvl - 1)) * it.ilvl * [1, 2.5, 6, 15, 40][it.rarity] * 0.8);
      let price = full;
      if (choice === 'haggle') {
        if (!rng.chance(check(s, 'trade', 0.45))) return O('offended');
        price = Math.round(full * 0.6);
      }
      if (p.gold < price) return O('poor');
      p.gold -= price;
      game.db.ledger(s.accountId, 'encounter', -price, 'peddler');
      takeItem(game, s, it);
      return O(choice === 'haggle' ? 'haggled' : 'bought', { item: it, silver: price });
    }
    case 'fishermen': {
      if (choice === 'pass') return O('passed');
      game.adjustRep(ship, 'free', 2);
      if (rng.chance(0.2)) {
        const net = makeItem(rng, 0, { ilvl: ship.shipLevel, base: 'drift_net', rarity: 1 });
        if (takeItem(game, s, net)) return O('helped_gift', { item: net });
      }
      return O('helped', { n: provisions(ship, 10) });
    }
    case 'pilot':
      if (choice === 'refuse') return O('refused');
      if (p.gold < 200) return O('poor');
      p.gold -= 200;
      game.db.ledger(s.accountId, 'encounter', -200, 'pilot');
      buff(game, ship, 'enc_pilot', 600, { reefDamage: -1, maxSpeed: 0.05 });
      return O('hired');
    case 'deserters': {
      if (choice === 'refuse') return O('refused');
      const n = giveHands(s, 3, 'gunner');
      game.adjustRep(ship, 'crown', -2);
      return O('taken', { n });
    }
    case 'pilgrims':
      if (choice === 'refuse') return O('refused');
      if ((ship.cargo.provisions ?? 0) < 5) return O('none');
      provisions(ship, -5);
      ship.sanity = Math.min(100, ship.sanity + 20);
      game.adjustRep(ship, 'choir', 3);
      buff(game, ship, 'enc_blessing', 1800, { treasureHunter: 0.05 });
      return O('given');
    case 'smuggler': {
      if (choice === 'pass') return O('passed');
      if (choice === 'report') {
        game.adjustRep(ship, 'crown', 2);
        return O('reported', { silver: giveSilver(game, s, purse(s, 200), 'informer') });
      }
      const n = Math.min(10, 4 + ship.shipLevel);
      const price = n * Math.round(GOODS.dreamleaf.basePrice * 0.5);
      if (p.gold < price) return O('poor');
      p.gold -= price;
      game.db.ledger(s.accountId, 'encounter', -price, 'smuggler');
      const got = giveGoods(ship, 'dreamleaf', n);
      p.stolen.dreamleaf = (p.stolen.dreamleaf ?? 0) + got;
      return O('bought', { n: got, silver: price });
    }
    case 'mapmaker':
      if (choice === 'pass') return O('passed');
      giveHands(s, 1);
      p.rescued = (p.rescued ?? 0) + 1;
      questEvent(game, s, { k: 'rescue', n: 1 });
      p.refugees = (p.refugees ?? 0) + 1;
      if (rng.chance(0.6)) {
        mapChance(game, s, 1, 1, 'The mapmaker’s boy');
        return O('map');
      }
      return O('boy');
    // -------------------------------------------------------------- finds
    case 'bottle': {
      if (choice === 'pass') return O('passed');
      questEvent(game, s, { k: 'letter' }); // every bottle opened is a letter for the quests (docs/12 P9)
      const r = rng.float();
      if (r < 0.6) {
        p.seaLetters ??= [];
        const missing = SEA_LETTERS.map((_, i) => i).filter((i) => !p.seaLetters!.includes(i));
        if (missing.length) {
          p.seaLetters.push(rng.pick(missing));
          return O('letter', { n: p.seaLetters.length });
        }
      }
      if (r < 0.85) {
        mapChance(game, s, 1, 1, 'A bottle in the sea');
        return O('map');
      }
      return O('empty');
    }
    case 'barrel': {
      if (choice === 'pass') return O('passed');
      const good: GoodId = rng.chance(0.5) ? 'rum' : 'gunpowder';
      const n = giveGoods(ship, good, rng.int(6, 12));
      return n ? O('got', { n, good }) : O('full');
    }
    case 'derelict': {
      if (choice === 'leave') return O('left');
      const r = rng.float();
      if (r < 0.1 && !sanitizePets(p).owned.includes('cat')) {
        givePet(game, s, 'cat');
        ship.morale = Math.min(100, ship.morale + 5);
        return O('cat');
      }
      if (r < 0.35) {
        ship.curse = Math.min(100, ship.curse + 15);
        ship.morale = Math.max(0, ship.morale - 5);
        return O('curse');
      }
      const good = rng.pick(['spices', 'cloth', 'medicine', 'tobacco'] as GoodId[]);
      return O('riches', { silver: giveSilver(game, s, purse(s, rng.int(200, 500)), 'derelict'), n: giveGoods(ship, good, rng.int(3, 8)), good });
    }
    case 'burning_ship': {
      if (choice === 'leave') return O('left');
      if (rng.chance(0.3)) {
        applyDamage(game, ship, { hull: ship.stats.hullMax * 0.08, crew: 1 }, null);
        igniteShip(game, ship, 8, null);
        return O('blast');
      }
      const good = rng.pick(['rum', 'sugar', 'weapons', 'cloth'] as GoodId[]);
      return O('grabbed', { n: giveGoods(ship, good, rng.int(4, 10)), good });
    }
    case 'flotsam': {
      if (choice === 'pass') return O('passed');
      const good = rng.pick(['planks', 'sailcloth', 'timber', 'iron'] as GoodId[]);
      const n = giveGoods(ship, good, rng.int(5, 12));
      return n ? O('gathered', { n, good }) : O('full');
    }
    case 'mine':
      if (choice === 'avoid') return O('avoided');
      if (choice === 'shoot') {
        ship.morale = Math.min(100, ship.morale + 3);
        return O('shot');
      }
      if (rng.chance(0.3)) {
        applyDamage(game, ship, { hull: ship.stats.hullMax * 0.1, crew: 2 }, null);
        ship.leaks = Math.min(ship.leaks + 1, 6);
        return O('blast');
      }
      return O('powder', { n: giveGoods(ship, 'gunpowder', rng.int(6, 10)) });
    case 'skeleton_raft':
      if (choice === 'leave') return O('left');
      if (rng.chance(0.4)) {
        applyDamage(game, ship, { hull: ship.stats.hullMax * 0.06 }, null);
        igniteShip(game, ship, 6, null);
        return O('trap');
      }
      return O('silver', { silver: giveSilver(game, s, purse(s, rng.int(150, 400)), 'skeleton') });
    case 'sunken_bell':
      if (choice === 'leave') return O('left');
      if (rng.chance(0.5)) return O('relic', { n: giveGoods(ship, 'cursed_relics', rng.int(1, 2)), good: 'cursed_relics' });
      ship.sanity = Math.max(0, ship.sanity - 10);
      return O('mad');
    case 'signal_fire': {
      if (choice === 'pass') return O('passed');
      const r = rng.float();
      if (r < 0.4) {
        mapChance(game, s, 1, 1, 'The hermit’s tale');
        return O('hermit');
      }
      if (r < 0.8) {
        giveHands(s, 1);
        p.rescued = (p.rescued ?? 0) + 1;
        return O('survivor');
      }
      sendPirates(game, s, 2);
      return O('ambush');
    }
    // -------------------------------------------------------------- nature
    case 'dolphins':
      buff(game, ship, 'enc_dolphins', 120, { maxSpeed: 0.08 });
      ship.morale = Math.min(100, ship.morale + 3);
      return O('blessed');
    case 'orcas_whale': {
      if (choice === 'leave') return O('left');
      if (choice === 'save') {
        game.adjustRep(ship, 'choir', 3);
        buff(game, ship, 'enc_whale', 300, { maxSpeed: 0.05 });
        return O('saved');
      }
      game.adjustRep(ship, 'choir', -3);
      return O('hunted', { n: giveGoods(ship, 'whale_oil', rng.int(4, 8)), good: 'whale_oil' });
    }
    case 'squall':
      if (choice === 'reef') return O('reefed');
      if (rng.chance(0.5)) {
        buff(game, ship, 'enc_squall', 60, { maxSpeed: 0.15 });
        return O('rode');
      }
      ship.sails = Math.max(0, ship.sails - ship.stats.sailHpMax * 0.2);
      return O('torn');
    case 'waterspout': {
      if (choice === 'around') return O('around');
      applyDamage(game, ship, { hull: ship.stats.hullMax * 0.1 }, null);
      if (rng.chance(0.6)) {
        const it = item(game, s, 'common');
        if (it) return O('through', { item: it });
      }
      return O('through_empty');
    }
    case 'glowing_sea':
      ship.morale = Math.min(100, ship.morale + 10);
      buff(game, ship, 'enc_glow', 600, { treasureHunter: 0.1, moraleRegen: 0.1 });
      return O('glow');
    case 'iceberg':
      if (choice === 'clear') return O('clear');
      if (rng.chance(0.5)) return O('chest', { silver: giveSilver(game, s, purse(s, rng.int(150, 350)), 'iceberg') });
      return O('seals', { n: provisions(ship, 10) });
    case 'giant_turtle':
      if (choice === 'watch') {
        ship.morale = Math.min(100, ship.morale + 5);
        return O('watched');
      }
      if (rng.chance(0.3)) return O('dived', { n: loseHands(s, 2) });
      return O('treasure', { n: giveGoods(ship, 'pearls', rng.int(2, 5)), silver: giveSilver(game, s, purse(s, rng.int(100, 250)), 'turtle') });
    case 'sharks':
      if (choice === 'ignore') return O('ignored');
      if (rng.chance(0.3)) {
        loseHands(s, 1);
        return O('bitten', { n: provisions(ship, 6) });
      }
      return O('caught', { n: provisions(ship, 6) });
    case 'tentacle':
      if (choice === 'cut') {
        ship.sails = Math.max(0, ship.sails - ship.stats.sailHpMax * 0.1);
        return O('cut');
      }
      if (choice === 'guns') {
        applyDamage(game, ship, { hull: ship.stats.hullMax * 0.08 }, null);
        return O('shot');
      }
      if (rng.chance(check(s, 'fencing', 0.6))) {
        ship.morale = Math.min(100, ship.morale + 5);
        return O('hacked', { n: giveGoods(ship, 'kraken_ink', 1), good: 'kraken_ink' });
      }
      return O('dragged', { n: loseHands(s, 3) });
    case 'calm':
      if (choice === 'tow') {
        ship.morale = Math.max(0, ship.morale - 3);
        return O('towed');
      }
      buff(game, ship, 'enc_calm', 90, { maxSpeed: -0.5 });
      ship.morale = Math.min(100, ship.morale + 8);
      return O('yarns');
    case 'albatross':
      if (choice === 'let') {
        buff(game, ship, 'enc_albatross', 3600, { treasureHunter: 0.1 });
        ship.morale = Math.min(100, ship.morale + 3);
        return O('blessed');
      }
      ship.curse = Math.min(100, ship.curse + 20);
      ship.morale = Math.max(0, ship.morale - 10);
      buff(game, ship, 'enc_sailors_curse', 3600, { moraleRegen: -0.1 });
      return O('cursed');
    case 'bird_shoal':
      if (choice === 'pass') return O('passed');
      return O('fished', { n: provisions(ship, 8) });
    // -------------------------------------------------------------- danger
    case 'ambush':
      sendPirates(game, s, 1);
      return O('come');
    case 'patrol_search': {
      const hot = hotGoods(s);
      const seize = () => {
        let n = 0;
        for (const g of hot) {
          n += Math.floor(ship.cargo[g] ?? 0);
          delete ship.cargo[g];
          delete p.stolen[g];
        }
        return n;
      };
      if (choice === 'submit') return O('seized', { n: seize() });
      if (choice === 'bribe') {
        const value = hot.reduce((a, g) => a + (ship.cargo[g] ?? 0) * GOODS[g].basePrice, 0);
        const bribe = Math.max(100, Math.round(value * 0.15));
        if (p.gold >= bribe && rng.chance(check(s, 'trade', 0.55))) {
          p.gold -= bribe;
          game.db.ledger(s.accountId, 'encounter', -bribe, 'bribe');
          return O('bribed', { silver: bribe });
        }
        game.addInfamy(ship, 10, 'offered a bribe to the Crown');
        return O('refused', { n: seize() });
      }
      game.addInfamy(ship, 20, 'ran from a Crown patrol');
      return O('run');
    }
    case 'mutiny_brewing':
      if (choice === 'pay') {
        const pay = Math.max(50, ship.crew * 5);
        const paid = Math.min(pay, p.gold);
        p.gold -= paid;
        game.db.ledger(s.accountId, 'encounter', -paid, 'share');
        ship.morale = Math.min(100, ship.morale + 20);
        return O('paid', { silver: paid });
      }
      if (choice === 'face') {
        if (rng.chance(check(s, 'leadership', 0.5))) {
          ship.morale = Math.min(100, ship.morale + 10);
          return O('faced');
        }
        ship.morale = Math.max(0, ship.morale - 10);
        return O('failed');
      }
      ship.morale = Math.min(100, ship.morale + 15);
      return O('marooned', { n: loseHands(s, 3) });
    case 'rats':
      if (catAboard(p) || ship.hasFlag('tattoo_cat')) return O('cat');
      return O('eaten', { n: provisions(ship, -Math.ceil((ship.cargo.provisions ?? 0) * 0.2)) });
    case 'galley_fire':
      if (choice === 'flood') return O('flooded', { n: provisions(ship, -Math.ceil((ship.cargo.provisions ?? 0) * 0.25)) });
      if (rng.chance(0.2)) return O('burned', { n: loseHands(s, 2) });
      return O('out');
    // -------------------------------------------------------------- the uncanny
    case 'ghost_bargain': {
      if (choice === 'refuse') return O('refused');
      if (choice === 'fight') {
        sendGhost(game, s, live);
        return O('fight');
      }
      const it = makeItem(rng, 0, { ilvl: ship.shipLevel, rarity: 3 });
      ship.curse = Math.min(100, ship.curse + 25);
      takeItem(game, s, it);
      return O('accepted', { item: it });
    }
    case 'sirens':
      tattooCount(game, s, 'sirens');
      if (ship.hasFlag('tattoo_mermaid')) return O('waxed'); // the Mermaid: the song does not reach them
      if (choice === 'wax') {
        ship.morale = Math.max(0, ship.morale - 3);
        return O('waxed');
      }
      if (choice === 'hold') {
        if (rng.chance(check(s, 'navigation', 0.55))) return O('held');
        applyDamage(game, ship, { hull: ship.stats.hullMax * 0.08 }, null);
        return O('aground');
      }
      ship.sanity = Math.max(0, ship.sanity - 20);
      return O('listened', { n: rng.chance(0.3) ? giveGoods(ship, 'pearls', rng.int(1, 3)) : 0 });
    case 'wisps':
      if (choice === 'ignore') return O('ignored');
      if (rng.chance(0.5)) {
        mapChance(game, s, 1, 1, 'The lights among the roots');
        return O('treasure');
      }
      applyDamage(game, ship, { hull: ship.stats.hullMax * 0.06 }, null);
      return O('aground');
    case 'voice_in_fog':
      if (choice === 'silent') return O('silent');
      if (rng.chance(0.5)) {
        mapChance(game, s, 1, 1, 'A voice in the fog');
        return O('rumor');
      }
      ship.sanity = Math.max(0, ship.sanity - 10);
      return O('fear');
  }
  return O('');
}
