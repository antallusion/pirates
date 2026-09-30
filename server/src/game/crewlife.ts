// The crew as people at sea (docs/16 #16–19): the named officers speak on the sea's events (a storm, a victory, hunger,
// a new sea, low spirits, a great beast sighted, a rich merchant) — one short line in the role's voice, never too often;
// the men grumble when morale is low and sing a shanty when it is high, which lifts the work a little for a while; the
// trades grow in practice by doing the work (gunners firing and hitting, helmsmen and sailors by the leagues, carpenters
// mending, marines boarding, surgeons healing, cooks feeding); and a share of the men struck down in a fight are only
// wounded — the surgeon and the medicine chest bring them back over time, and without them some die below.
// All of it draws on its own dice, not the sea's stream.

import {
  GRUMBLES, GRUMBLE_BELOW, GRUMBLE_EVERY, HEAL_AFTER, HEALED_PER_MEDICINE, PRACTICE_GAIN, SHANTIES, SHANTY_AT, SHANTY_EVERY, SHANTY_MODS, SHANTY_TIME,
  TALK, TALK_EVENT_GAP, TALK_GAP, TALK_PREFERS, WOUNDED_BASE, WOUNDED_MAX, practiceLevel, woundRates,
} from '../../../shared/src/data/crewtalk.ts';
import type { TalkEvent } from '../../../shared/src/data/crewtalk.ts';
import type { Officer, Profession } from '../../../shared/src/data/crew.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { logNote } from './captainlog.ts';
import { officerFactor } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** A merchant whose hold is worth this much (at base prices) is worth a word from the officers. */
export const RICH_HOLD = 1500;
const SIGHT_BOSS = 2600;
const SIGHT_MERCHANT = 1500;

interface LifeState {
  lastAt: number;
  evAt: Partial<Record<TalkEvent, number>>;
  lastLine: Map<string, number>;
  weather: string;
  region: RegionId | '';
  hungry: boolean;
  hungerAt: number;
  low: boolean;
  bosses: Set<number>;
  merchants: Set<number>;
  lastHull: number;
  grumbleAt: number;
  shantyAt: number;
  highSince: number;
  fighting: boolean;
  fightDead: number;
  fightWounded: number;
  woundBase: number;
  woundAt: number;
  healedToast: number;
  healedAt: number;
  restored: boolean;
}

const lives = new WeakMap<PlayerSession, LifeState>();
const rngs = new WeakMap<Game, Rng>();

/** The crew's own dice. */
function cr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x0c7e3a11)));
  return r;
}

function life(s: PlayerSession): LifeState {
  let st = lives.get(s);
  if (!st) {
    st = {
      lastAt: -Infinity, evAt: {}, lastLine: new Map(), weather: '', region: '', hungry: false, hungerAt: 0, low: false, bosses: new Set(), merchants: new Set(),
      lastHull: -1, grumbleAt: 0, shantyAt: 0, highSince: -1, fighting: false, fightDead: 0, fightWounded: 0, woundBase: 0, woundAt: -Infinity, healedToast: 0, healedAt: 0, restored: false,
    };
    lives.set(s, st);
  }
  return st;
}

// ------------------------------------------------------------------ 16. officers speak

/** The officers who can speak now: aboard, not wounded out of their wits, not a sailor standing in. */
function speakers(game: Game, s: PlayerSession): Officer[] {
  return (s.profile?.company.officers ?? []).filter((o) => !o.acting && officerFactor(o, game.now) > 0);
}

/** A named officer says his line on an event — unless one spoke a moment ago, or this event was spoken of lately.
 *  `force` (the admin's console) passes the gaps. Returns whether a line was said. */
export function officerSays(game: Game, s: PlayerSession, ev: TalkEvent, x?: string, force = false): boolean {
  const st = life(s);
  const now = game.now;
  if (!force && (now - st.lastAt < TALK_GAP || now - (st.evAt[ev] ?? -Infinity) < TALK_EVENT_GAP)) return false;
  const who = speakers(game, s);
  if (!who.length) return false;
  const rng = cr(game);
  const pref = TALK_PREFERS[ev];
  const o = rng.weighted(who.map((w) => [w, pref.includes(w.role) ? 3 : 1] as const));
  const lines = TALK[o.role][ev];
  const key = `${o.role}:${ev}`;
  let i = rng.int(0, lines.length - 1);
  if (lines.length > 1 && i === st.lastLine.get(key)) i = (i + 1) % lines.length; // never the same line twice running
  st.lastLine.set(key, i);
  st.lastAt = now;
  st.evAt[ev] = now;
  game.sendTo(s, { t: 'crew_say', who: { name: o.name, role: o.role, ...(o.unique ? { unique: o.unique } : {}) }, ev, i, ...(x ? { x } : {}) });
  return true;
}

/** The men themselves: a grumble or a shanty verse. */
function crewSays(game: Game, s: PlayerSession, ev: 'grumble' | 'shanty'): void {
  const st = life(s);
  const table = ev === 'grumble' ? GRUMBLES : SHANTIES;
  const key = `crew:${ev}`;
  let i = cr(game).int(0, table.length - 1);
  if (i === st.lastLine.get(key)) i = (i + 1) % table.length;
  st.lastLine.set(key, i);
  game.sendTo(s, { t: 'crew_say', who: null, ev, i });
}

/** A fight won: the officers remark on it (not every time), the log notes it, the marines learn from a boarding. */
export function crewOnKill(game: Game, s: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  if (cr(game).chance(0.6)) officerSays(game, s, 'victory', victim.name);
  logNote(game, s, how === 'sunk' ? 'sank' : 'prize', [victim.name, game.nearestIslandName(victim.state.x, victim.state.y)]);
  if (how === 'boarded') practise(game, s, 'marine', PRACTICE_GAIN.boarding);
}

// ------------------------------------------------------------------ 18. the trades' practice

const PRACTICE_TOAST: Record<Profession, (n: number) => string> = {
  sailor: (n) => `Your sailors handle the canvas better now (practice ${n}).`,
  gunner: (n) => `Your gunners know their guns better now (practice ${n}).`,
  helmsman: (n) => `Your helmsmen feel the ship better now (practice ${n}).`,
  carpenter: (n) => `Your carpenters mend faster now (practice ${n}).`,
  surgeon: (n) => `Your surgeons have seen enough wounds to heal faster (practice ${n}).`,
  marine: (n) => `Your marines fight better together now (practice ${n}).`,
  cook: (n) => `Your cooks feed the men better now (practice ${n}).`,
};

/** A trade does its work: its practice grows (only with any of that trade aboard); a new level is told. */
export function practise(game: Game, s: PlayerSession, prof: Profession, points: number): void {
  const c = s.profile?.company;
  if (!c || points <= 0 || (c.pools[prof] ?? 0) <= 0) return;
  const before = practiceLevel(c.practice[prof] ?? 0);
  c.practice[prof] = (c.practice[prof] ?? 0) + points;
  const after = practiceLevel(c.practice[prof]);
  if (after > before) {
    if (s.ship) s.ship.companyKey = '';
    game.sendTo(s, { t: 'toast', msg: PRACTICE_TOAST[prof](after), kind: 'good' });
  }
}

/** The hook for the guns (combat.ts): shots fired and hits scored by a captain's ship train her gunners. */
export function gunPractice(game: Game, ship: ShipEntity, shots: number, hits: number): void {
  if (!ship.isPlayer) return;
  const s = game.sessionOf(ship);
  if (s) practise(game, s, 'gunner', shots * PRACTICE_GAIN.shot + hits * PRACTICE_GAIN.hit);
}

// ------------------------------------------------------------------ 19. the wounded

/** Of the men struck down aboard a captain's ship, those only wounded: a quarter without a surgeon, more with one
 *  (to three in four). Counted by its fraction, not by the dice. Other ships keep the old rule (survivalfx.ts). */
export function playerWounded(target: ShipEntity, killed: number): number {
  if (killed <= 0 || target.hasFlag('crew_of_drowned')) return 0;
  const share = Math.min(WOUNDED_MAX, WOUNDED_BASE + tx(target.stats, 'surgeon'));
  target.woundCarry += killed * share;
  const n = Math.floor(target.woundCarry);
  target.woundCarry -= n;
  return n;
}

/** The surgeons aboard: the trade's men, and the captain's own Ship's Surgeon (a surgeon a rank). */
export function surgeonsOf(s: PlayerSession): number {
  return (s.profile?.company.pools.surgeon ?? 0) + (s.ship?.rank('srv_ships_surgeon') ?? 0);
}

function stepWounded(game: Game, s: PlayerSession, st: LifeState): void {
  const ship = s.ship!;
  const c = s.profile!.company;
  const now = game.now;
  if (!st.restored) {
    st.restored = true;
    if (c.wounded > ship.wounded) ship.wounded = c.wounded;
  }
  if (ship.wounded <= 0 || st.woundAt === -Infinity) st.woundAt = now - 1;
  if (ship.wounded <= 0) {
    c.wounded = 0;
    return;
  }
  const room = Math.max(0, ship.stats.crewMax - ship.crew);
  // In harbour the port's surgeons take them all at once.
  if (ship.docked) {
    const back = Math.min(ship.wounded, room);
    ship.crew += back;
    ship.wounded = 0;
    c.wounded = 0;
    c.woundAcc = { heal: 0, die: 0, med: 0 };
    if (back > 0) game.toastShip(ship, `The harbour's surgeons send ${back} wounded back to duty.`, 'good');
    return;
  }
  // The surgeon's time since the last round (the second's step, or longer if the world clock jumped), after the fight.
  const dt = Math.max(0, Math.min(600, now - st.woundAt, now - ship.lastCombat - HEAL_AFTER));
  st.woundAt = now;
  if (dt <= 0) {
    c.wounded = ship.wounded;
    return;
  }
  const surgeons = surgeonsOf(s);
  const med = (ship.cargo.medicine ?? 0) >= 1;
  const r = woundRates(ship.wounded, surgeons, med, practiceLevel(c.practice.surgeon ?? 0));
  const acc = c.woundAcc;
  acc.heal += (r.healPerMin * dt) / 60;
  let healed = Math.min(Math.floor(acc.heal), ship.wounded, room);
  acc.heal -= Math.floor(acc.heal);
  if (healed > 0) {
    ship.crew += healed;
    ship.wounded -= healed;
    if (surgeons > 0) practise(game, s, 'surgeon', healed * PRACTICE_GAIN.healed);
    if (med) {
      acc.med += healed / HEALED_PER_MEDICINE;
      const used = Math.floor(acc.med);
      if (used > 0) {
        acc.med -= used;
        ship.cargo.medicine = Math.max(0, (ship.cargo.medicine ?? 0) - used);
        if (!ship.cargo.medicine) delete ship.cargo.medicine;
      }
    }
    st.healedToast += healed;
  } else healed = 0;
  acc.die += (r.diePerMin * dt) / 60;
  const died = Math.min(Math.floor(acc.die), ship.wounded);
  acc.die -= Math.floor(acc.die);
  if (died > 0) {
    ship.wounded -= died;
    ship.crewDeaths += died; // the dead weigh on the living (crew.ts)
    logNote(game, s, 'wounded_died', [], died);
    game.toastShip(ship, surgeons > 0
      ? `${died} of the wounded died below decks. Medicine in the hold would have saved them.`
      : `${died} of the wounded died below decks. A surgeon would have saved them.`, 'bad');
  }
  // The surgeon's round, told once a minute (and when the last is back on his feet).
  if (st.healedToast > 0 && (now - st.healedAt >= 60 || ship.wounded === 0)) {
    game.toastShip(ship, `The surgeon returns ${st.healedToast} wounded to duty.`, 'good');
    st.healedToast = 0;
    st.healedAt = now;
  }
  if (ship.wounded === 0) c.woundAcc = { heal: 0, die: 0, med: 0 };
  c.wounded = ship.wounded;
}

// ------------------------------------------------------------------ the second of a captain's crew

function holdValue(ship: ShipEntity): number {
  let v = 0;
  for (const g in ship.cargo) v += (ship.cargo[g as GoodId] ?? 0) * (GOODS[g as GoodId]?.basePrice ?? 0);
  return v;
}

/** Once a second for a captain at sea (before the company's own second, which counts the dead). */
export function stepCrewLife(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  const p = s.profile;
  if (!ship || !p || !ship.alive) return;
  const st = life(s);
  const c = p.company;
  const now = game.now;
  stepWounded(game, s, st);
  // The fight's toll, into the log when the guns fall silent.
  const fighting = ship.inCombat(now);
  if (fighting) {
    if (!st.fighting) st.woundBase = ship.wounded;
    st.fightDead += ship.crewDeaths;
    st.fightWounded = Math.max(st.fightWounded, ship.wounded - st.woundBase);
    st.fighting = true;
  } else if (st.fighting) {
    st.fighting = false;
    const dead = Math.max(0, st.fightDead - st.fightWounded);
    if (dead > 0 || st.fightWounded > 0) logNote(game, s, 'crew_lost', [game.nearestIslandName(ship.state.x, ship.state.y), String(st.fightWounded)], dead);
    st.fightDead = 0;
    st.fightWounded = 0;
  }
  if (ship.docked) {
    st.hungry = false;
    st.low = false;
    st.highSince = -1;
    st.lastHull = -1;
    return;
  }
  // The sea's events: a storm breaking, a new sea, hunger, low spirits.
  const w = game.weatherOf(ship);
  const storm = w === 'storm' || w === 'black_storm';
  if (storm && st.weather !== 'storm' && st.weather !== 'black_storm' && st.weather !== '') {
    officerSays(game, s, 'storm');
    logNote(game, s, 'storm', [REGIONS[ship.region].name]);
  }
  st.weather = w;
  if (st.region && ship.region !== st.region) {
    const fresh = !p.regionsSeen.includes(ship.region);
    officerSays(game, s, 'new_sea', REGIONS[ship.region].name);
    if (fresh) logNote(game, s, 'sea', [REGIONS[ship.region].name]);
  }
  st.region = ship.region;
  const hungry = (ship.cargo.provisions ?? 0) <= 0;
  if (hungry && (!st.hungry || now >= st.hungerAt)) {
    if (officerSays(game, s, 'hunger') || !st.hungry) st.hungerAt = now + 600;
  }
  st.hungry = hungry;
  const low = ship.morale < GRUMBLE_BELOW;
  if (low && !st.low) {
    officerSays(game, s, 'low_morale');
    st.grumbleAt = now + 20;
  }
  st.low = low;
  // 17. The men on deck: grumbling below the mark, a shanty (and its small lift) when spirits run high out of a fight.
  if (low && now >= st.grumbleAt) {
    crewSays(game, s, 'grumble');
    st.grumbleAt = now + GRUMBLE_EVERY;
  }
  const high = ship.morale >= SHANTY_AT && !fighting && now - ship.lastCombat > 90;
  if (!high) st.highSince = -1;
  else if (st.highSince < 0) st.highSince = now;
  if (high && now - st.highSince >= 30 && now >= st.shantyAt && !ship.hasEffect('shanty')) {
    ship.addEffect({ id: 'shanty', until: now + SHANTY_TIME, mods: { ...SHANTY_MODS } }, now);
    st.shantyAt = now + SHANTY_EVERY;
    crewSays(game, s, 'shanty');
  }
  // Every few seconds: what the lookout sees — a great beast, a rich merchant.
  if (Math.floor(now) % 3 === 0) {
    for (const f of game.bosses.fights.values()) {
      if (st.bosses.has(f.id)) continue;
      const b = game.ships.get(f.id);
      if (!b || !b.alive || dist(b.state.x, b.state.y, ship.state.x, ship.state.y) > SIGHT_BOSS) continue;
      st.bosses.add(f.id);
      officerSays(game, s, 'boss', f.def.name, true);
      logNote(game, s, 'boss_seen', [f.def.name]);
    }
    let rich: ShipEntity | null = null;
    game.forShipsNear(ship.state.x, ship.state.y, SIGHT_MERCHANT, (o) => {
      if (rich || o.npcRole !== 'merchant' || !o.alive || st.merchants.has(o.id)) return;
      if (holdValue(o) >= RICH_HOLD) rich = o;
    });
    if (rich) {
      const m = rich as ShipEntity;
      if (officerSays(game, s, 'merchant', m.name)) st.merchants.add(m.id);
      if (st.merchants.size > 200) st.merchants.clear();
    }
  }
  // 18. Practice by doing: the leagues for the helm and the sails, the mending for the carpenters, meals for the cooks.
  if (ship.distanceLog > 0) {
    const km = ship.distanceLog / 1000;
    practise(game, s, 'helmsman', km * PRACTICE_GAIN.km);
    practise(game, s, 'sailor', km * PRACTICE_GAIN.kmSailor * (storm ? 2 : 1));
  }
  if (ship.repairing && st.lastHull >= 0 && ship.hull > st.lastHull) practise(game, s, 'carpenter', ((ship.hull - st.lastHull) / ship.stats.hullMax) * 100 * PRACTICE_GAIN.repairPct);
  st.lastHull = ship.hull;
  if ((ship.cargo.provisions ?? 0) > 0) practise(game, s, 'cook', PRACTICE_GAIN.cookHour / 3600);
  void c;
}

/** The men's mood as the screens show it. */
export function moodOf(ship: ShipEntity | null): 'grumble' | 'shanty' | null {
  if (!ship || ship.docked) return null;
  if (ship.hasEffect('shanty')) return 'shanty';
  return ship.morale < GRUMBLE_BELOW ? 'grumble' : null;
}

/** For the tests and the console: forget the gaps. */
export function resetTalk(s: PlayerSession): void {
  lives.delete(s);
}
