// The orca companion (docs/12 P10 #2): a White Orca's calf in its captain's wake. It finds shoals and whales and
// tells her where (by the compass), strikes an enemy's rudder in a fight, grows with time at sea and in battle, and
// wears a harness made at a forge. Everyone near sees it swim beside her ship.

import { sendPetsOwn } from './pets.ts';
import { BEASTS } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { CALF_MAX_LEVEL, CALF_NAME, HARNESSES, HARNESS_IDS, calfFindEvery, calfFindRange, calfStrike, calfXpNext, compassPoint } from '../../../shared/src/data/companions.ts';
import type { HarnessId } from '../../../shared/src/data/companions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { CompanionView, PetView } from '../../../shared/src/protocol.ts';
import { beastBrain, beastsAlive } from './beasts.ts';
import { applyDamage } from './combat.ts';
import { isleForge } from './estate.ts';
import { shoalsOf } from './fishing.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { podOfShip } from './omenpod.ts';

export interface CompanionRec {
  kind: 'orca';
  name: string;
  level: number;
  xp: number;
  harness: HarnessId | null;
  made: HarnessId[];
  findAt: number;
  strikeAt: number;
}

const PETS_R = 3000;

/** A calf comes to her: orphaned by the White Orca's end, or entrusted by Ingrid. */
export function giveCalf(game: Game, s: PlayerSession, how: 'orphan' | 'ingrid'): boolean {
  const p = s.profile;
  if (!p || p.companion) return false;
  p.companion = { kind: 'orca', name: CALF_NAME[0], level: 1, xp: 0, harness: null, made: [], findAt: game.now + 30, strikeAt: 0 };
  game.sendTo(s, { t: 'toast', msg: how === 'orphan' ? 'An orphaned White Orca calf follows your wake. Name it in the ship window.' : 'Ingrid entrusts you with a White Orca calf. Name it in the ship window.', kind: 'gold' });
  sendCompanion(game, s);
  return true;
}

function grow(game: Game, s: PlayerSession, c: CompanionRec, xp: number): void {
  if (c.level >= CALF_MAX_LEVEL) return;
  c.xp += xp;
  while (c.level < CALF_MAX_LEVEL && c.xp >= calfXpNext(c.level)) {
    c.xp -= calfXpNext(c.level);
    c.level++;
    game.sendTo(s, { t: 'toast', msg: `${c.name} grows: level ${c.level}.`, kind: 'good' });
    sendCompanion(game, s);
  }
}

/** The nearest enemy she is fighting within the calf's reach. */
function foeOf(game: Game, ship: ShipEntity): ShipEntity | null {
  let best: ShipEntity | null = null, bd = 500;
  game.grid.query(ship.state.x, ship.state.y, 500, (id) => {
    const o = game.ships.get(id);
    if (!o || o === ship || !o.alive || o.docked || o.npcRole === 'beast') return;
    const fighting = (o.attackers.get(ship.id) ?? -999) > game.now - 20 || (ship.attackers.get(o.id) ?? -999) > game.now - 20;
    if (!fighting) return;
    const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

/** Every second: the calf grows, dives for shoals and whales, and strikes in a fight. */
export function stepCompanions(game: Game): void {
  for (const s of game.sessions) {
    const p = s.profile, ship = s.ship;
    // Her papers carry the calf from the first second of a visit.
    if (p && !greeted.has(s)) {
      greeted.add(s);
      if (p.companion) sendCompanion(game, s);
      if (p.pets?.owned.length || p.shipCat) sendPetsOwn(game, s);
    }
    const c = p?.companion;
    if (!c || !ship || !ship.alive || ship.docked) continue;
    const fight = ship.inCombat(game.now);
    if (fight) grow(game, s, c, 1);
    else if (Math.floor(game.now) % 10 === 0) grow(game, s, c, 1);
    // A strike at a foe's rudder.
    if (fight && game.now >= c.strikeAt) {
      const foe = foeOf(game, ship);
      if (foe) {
        const st = calfStrike(c.level, c.harness);
        c.strikeAt = game.now + st.every;
        applyDamage(game, foe, { hull: foe.stats.hullMax * st.hull, rudder: st.rudder, morale: 2 }, ship);
        game.emit({ k: 'fx', fx: 'spout', x: Math.round(foe.state.x), y: Math.round(foe.state.y) }, foe.state.x, foe.state.y);
        game.sendTo(s, { t: 'toast', msg: `${c.name} strikes the rudder of ${foe.name}!`, kind: 'good' });
      }
    }
    // A dive: the nearest shoal or whale within its hearing.
    if (!fight && game.now >= c.findAt) {
      c.findAt = game.now + calfFindEvery(c.harness);
      const range = calfFindRange(c.level, c.harness);
      let best: { x: number; y: number; what: 'shoal' | 'whales' } | null = null, bd = range;
      for (const sh of shoalsOf(game)) {
        const d = Math.hypot(sh.x - ship.state.x, sh.y - ship.state.y);
        if (d < bd && d > 700) {
          bd = d;
          best = { x: sh.x, y: sh.y, what: 'shoal' };
        }
      }
      for (const b of beastsAlive(game)) {
        const id = beastBrain(game, b.id)?.beast as BeastId | undefined;
        if (!id || BEASTS[id].group !== 'whale') continue;
        const d = Math.hypot(b.state.x - ship.state.x, b.state.y - ship.state.y);
        if (d < bd && d > 700) {
          bd = d;
          best = { x: b.state.x, y: b.state.y, what: 'whales' };
        }
      }
      if (best) {
        const pt = compassPoint(best.x - ship.state.x, best.y - ship.state.y);
        game.sendTo(s, { t: 'toast', msg: `${c.name} dives and comes up to the ${pt[0]}: ${best.what === 'shoal' ? 'a shoal' : 'whales'}.`, kind: 'info' });
      }
    }
  }
  if (Math.floor(game.now) % 3 === 0) sendPets(game);
}

/** The companions near each captain, to draw beside their ships. */
function sendPets(game: Game): void {
  const withPets: { ship: ShipEntity; view: PetView }[] = [];
  for (const s of game.sessions) {
    const c = s.profile?.companion, ship = s.ship;
    const deck = s.profile?.pets?.deck ?? null;
    const pod = ship ? podOfShip(game, ship.id) : undefined; // a good omen alongside (docs/16 #9)
    if (!ship || !ship.alive || ship.docked || (!c && !deck && !pod)) continue;
    withPets.push({ ship, view: { ship: ship.id, ...(c ? { orca: c.level } : {}), ...(deck ? { deck } : {}), ...(pod ? { pod } : {}) } });
  }
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship) continue;
    const list = withPets.filter((w) => Math.abs(w.ship.state.x - ship.state.x) < PETS_R && Math.abs(w.ship.state.y - ship.state.y) < PETS_R).map((w) => w.view);
    const key = JSON.stringify(list);
    if (sentPets.get(s) === key) continue;
    sentPets.set(s, key);
    game.sendTo(s, { t: 'pets', list });
  }
}
const sentPets = new WeakMap<PlayerSession, string>();
const greeted = new WeakSet<PlayerSession>();

export function companionView(p: Profile): CompanionView | null {
  const c = p.companion;
  if (!c) return null;
  return { kind: c.kind, name: c.name, level: c.level, xp: c.xp, next: c.level >= CALF_MAX_LEVEL ? 0 : calfXpNext(c.level), harness: c.harness, made: [...c.made] };
}

export function sendCompanion(game: Game, s: PlayerSession): void {
  if (s.profile) game.sendTo(s, { t: 'companion', view: companionView(s.profile) });
}

/** Name it, have a harness made at a forge, or put one on. */
export function companionAction(game: Game, s: PlayerSession, action: string, arg: string | null): string | null {
  const p = s.profile!;
  const c = p.companion;
  if (!c) return 'You have no companion.';
  switch (action) {
    case 'name': {
      const name = (arg ?? '').replace(/[<>{}"`]/g, '').trim().slice(0, 20);
      if (!name) return 'A name of one to twenty letters.';
      c.name = name;
      break;
    }
    case 'craft': {
      const h = arg as HarnessId;
      if (!HARNESS_IDS.includes(h)) return 'Unknown harness';
      if (c.made.includes(h)) break;
      const ship = s.ship!;
      const port = ship.docked ? game.portById(ship.docked) : isleForge(game, s);
      if (!port || port.shipyardTier < 2) return 'A harness is made at a forge: a shipyard of the second rank or your island’s.';
      const def = HARNESSES[h];
      const short = Object.entries(def.cost).filter(([g, n]) => (ship.cargo[g as GoodId] ?? 0) < (n ?? 0)).map(([g, n]) => `${g.replace('_', ' ')} ×${n}`);
      if (p.gold < def.silver) short.push(`${def.silver} silver`);
      if (short.length) return `Not enough for the harness: ${short.join(', ')}.`;
      for (const [g, n] of Object.entries(def.cost)) {
        ship.cargo[g as GoodId] = (ship.cargo[g as GoodId] ?? 0) - (n ?? 0);
        if (!ship.cargo[g as GoodId]) delete ship.cargo[g as GoodId];
      }
      p.gold -= def.silver;
      c.made.push(h);
      c.harness = h;
      game.sendTo(s, { t: 'toast', msg: `The forge makes the ${def.name[0]}.`, kind: 'good' });
      game.pushSelf(s, true);
      break;
    }
    case 'wear': {
      const h = arg === null || arg === '' ? null : (arg as HarnessId);
      if (h !== null && !c.made.includes(h)) return 'That harness is not made yet.';
      c.harness = h;
      if (h) game.sendTo(s, { t: 'toast', msg: `${c.name} wears the ${HARNESSES[h].name[0]}.`, kind: 'good' });
      break;
    }
    default:
      return 'Unknown order';
  }
  sendCompanion(game, s);
  return null;
}
