// The premium shop on the server (owner, 2026-10-03; docs/01 P7): doubloons — bought with money only, never earned at
// sea — kept per account in the accounts table, every change a row of the ledger. They come in by one door,
// creditPremium (the payment provider's webhook will call it; the admin's console does for testing), and go out only
// for a hull or a kind of creature, every check made before a coin moves: a refusal costs nothing. A hull is delivered
// in port and the ship she sailed is berthed there, as a hull built to order is; creatures join the army as a tamer's
// do (a slot, the hammocks). The pay, the goods and her save go in one transaction.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { PremiumUnit, UnitId } from '../../../shared/src/data/army.ts';
import { peopleOf } from '../../../shared/src/data/drifts.ts';
import { CREDIT_MAX, PAYMENTS_OPEN, PREMIUM_SAMPLE, premiumShips, premiumUnits } from '../../../shared/src/data/premium.ts';
import { SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { PremiumShip, ShipClassId } from '../../../shared/src/data/ships.ts';
import { captainLevelFor, levelRange } from '../../../shared/src/data/shiplevel.ts';
import type { PremiumClientMsg, PremiumView, PremiumWhy } from '../../../shared/src/premiumproto.ts';
import { landFighting } from './beastlairs.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { refitHolds } from './refit.ts';
import type { ShipEntity } from './ship.ts';
import { MAX_BERTHS, setShip } from './shipbuilding.ts';
import { beastsName, creatureRoom, joinCreatures } from './tame.ts';
import { keepsDeep } from './town.ts';

/** Where doubloons come from: a payment (its webhook), the admin's console, a refund. Their ledger rows are of the kind
 *  `doubloons_<source>`; a purchase's is `doubloons_buy` (the silver report leaves every `doubloons_` row out). */
export type PremiumSource = 'pay' | 'admin' | 'refund';

// ------------------------------------------------------------------------------------------------ the balance

/** Her account's doubloons, to her client. */
export function sendBalance(game: Game, s: PlayerSession): void {
  if (s.authed) game.sendTo(s, { t: 'doubloons', n: game.db.doubloons(s.accountId) });
}

/** The one way doubloons come into an account — the payment provider's webhook will call it with the payment's id as
 *  `ref`: a whole number up to CREDIT_MAX, the balance and its ledger row in one transaction, the captain told if she
 *  is aboard. A payment already credited is not credited again (its balance is answered). Null: refused — no such
 *  account, or a bad amount. */
export function creditPremium(game: Game, accountId: number, amount: number, source: PremiumSource, ref: string): number | null {
  const n = Math.floor(Number(amount));
  if (!(n > 0) || n > CREDIT_MAX || !game.db.accountById(accountId)) return null;
  const kind = `doubloons_${source}`;
  const detail = String(ref ?? '').slice(0, 120);
  if (source === 'pay' && game.db.doubloonRef(accountId, kind, detail)) return game.db.doubloons(accountId);
  const bal = move(game, accountId, n, kind, detail);
  const s = game.sessionByAccount(accountId);
  if (bal !== null && s) {
    sendBalance(game, s);
    game.sendTo(s, { t: 'toast', msg: `Doubloons credited to your account: ${n}.`, kind: 'gold' });
  }
  return bal;
}

/** The balance moved and its ledger row written together, and whatever the purchase hands over with them (null: it
 *  would go below nought — nothing written, nothing handed over). */
function move(game: Game, accountId: number, delta: number, kind: string, detail: string, then?: () => void): number | null {
  let bal = null as number | null;
  game.db.transaction(() => {
    bal = game.db.addDoubloons(accountId, delta);
    if (bal === null) return;
    game.db.ledger(accountId, kind, delta, detail);
    then?.();
  });
  return bal;
}

// ------------------------------------------------------------------------------------------------ the catalogue

/** The tester's sample catalogue is in the shop (`/doubloons sample`, admin servers only). */
const samples = new WeakSet<Game>();

function shipOffer(game: Game, c: ShipClassId): PremiumShip | undefined {
  if (!Object.hasOwn(SHIP_CLASSES, c)) return undefined;
  return SHIP_CLASSES[c].premium ?? (samples.has(game) ? PREMIUM_SAMPLE.ships[c] : undefined);
}

function unitOffer(game: Game, u: UnitId): PremiumUnit | undefined {
  if (!Object.hasOwn(UNITS, u)) return undefined;
  return UNITS[u].premium ?? (samples.has(game) ? PREMIUM_SAMPLE.units[u] : undefined);
}

function shipList(game: Game): ShipClassId[] {
  const out = premiumShips();
  if (samples.has(game)) for (const c of Object.keys(PREMIUM_SAMPLE.ships) as ShipClassId[]) if (!out.includes(c)) out.push(c);
  return out;
}

function unitList(game: Game): UnitId[] {
  const out = premiumUnits();
  if (samples.has(game)) for (const u of Object.keys(PREMIUM_SAMPLE.units) as UnitId[]) if (!out.includes(u)) out.push(u);
  return out;
}

// ------------------------------------------------------------------------------------------------ what stands in the way

/** Why a hull cannot be hers now (null: she can be): as at a yard — in port, not the class she sails, the yard not
 *  busy with her, her level up to the hull's — and a berth free for the ship she leaves. */
function shipWhy(game: Game, s: PlayerSession, c: ShipClassId, price: number, balance: number): PremiumWhy | null {
  const ship = s.ship!, p = s.profile!;
  if (!ship.docked) return 'port';
  if (ship.loadout.classId === c) return 'yours';
  if (refitHolds(game, p)) return 'refit';
  if (p.level < captainLevelFor(levelRange(c)[0])) return 'level';
  if (p.berths.length >= MAX_BERTHS) return 'berths';
  return balance < price ? 'poor' : null;
}

/** Why a stack of a kind cannot come aboard now (null: it can): as a tamer's, a slot of its own (or its stack aboard)
 *  and hammocks for every one of them; never in a fight; the deep's own only for a captain who keeps the deep. */
function unitWhy(game: Game, s: PlayerSession, u: UnitId, o: PremiumUnit, balance: number): PremiumWhy | null {
  const ship = s.ship!;
  if (!ship.alive || ship.boarding || ship.inCombat(game.now) || landFighting(game, s)) return 'fight';
  if (peopleOf(u) === 'deep' && !keepsDeep(s) && s.profile!.captain !== 'drowned') return 'deep';
  if (!ship.army.some((x) => x.u === u) && ship.army.length >= ship.armySlots) return 'slot';
  if (creatureRoom(ship, u) < o.n) return 'room';
  return balance < o.price ? 'poor' : null;
}

/** A refusal in words (her window says the same in her language). */
function whyText(game: Game, s: PlayerSession, why: PremiumWhy, c?: ShipClassId, n = 0): string {
  switch (why) {
    case 'poor': return 'Not enough doubloons: top up your account first.';
    case 'port': return 'A hull is delivered in port: make port first.';
    case 'yours': return 'You already sail one';
    case 'refit': return refitHolds(game, s.profile!) ?? 'The yard has her on the ways.';
    case 'level': return `Captain level ${captainLevelFor(levelRange(c!)[0])} is needed to command a ${SHIP_CLASSES[c!].name}`;
    case 'berths': return `You already berth ${MAX_BERTHS} ships — sell or take one out first`;
    case 'slot': return 'No free slot in the army for a new kind of man.';
    case 'room': return `No hammocks aboard for ${n} more.`;
    case 'fight': return 'Not in the middle of a fight.';
    case 'deep': return 'The deep’s own serve only a captain who keeps the deep: the Choir’s favour, a cursed hull or a drowned crew.';
  }
}

/** Room in her for every creature of these stacks at once: a slot for each new kind, hammocks for them all. */
function roomFor(ship: ShipEntity, beasts: readonly { u: UnitId; n: number }[]): boolean {
  const aboard = new Set(ship.army.map((x) => x.u));
  const fresh = new Set(beasts.filter((b) => !aboard.has(b.u)).map((b) => b.u)).size;
  const men = beasts.reduce((a, b) => a + b.n, 0);
  return ship.army.length + fresh <= ship.armySlots && ship.crew + men <= ship.stats.crewMax;
}

// ------------------------------------------------------------------------------------------------ buying

/** A hull for doubloons, in port: she comes alongside before a coin moves — the ship she sailed to a berth here, her
 *  own creatures into her — and if they find no room in her, all is put back as it was. */
export function buyShip(game: Game, s: PlayerSession, c: ShipClassId): string | null {
  const o = shipOffer(game, c);
  if (!o) return 'Not for sale';
  const why = shipWhy(game, s, c, o.price, game.db.doubloons(s.accountId));
  if (why) return whyText(game, s, why, c);
  const ship = s.ship!, p = s.profile!;
  const port = game.portById(ship.docked!)!;
  const cls = SHIP_CLASSES[c];
  const was = { loadout: ship.loadout, hull: ship.hull / ship.stats.hullMax, sails: ship.sails, rudder: ship.rudderHp, guns: { ...ship.gunsDisabled }, army: ship.army.map((x) => ({ ...x })) };
  const undo = () => {
    p.berths.pop();
    setShip(game, s, was.loadout, was.hull);
    ship.setArmy(was.army);
    ship.sails = was.sails;
    ship.rudderHp = was.rudder;
    ship.gunsDisabled = was.guns;
  };
  p.berths.push({ port: port.id, loadout: ship.loadout, hull: was.hull });
  // She takes the name the captain's ship bears, as a hull bought at a yard does; her class's first level (canon D12).
  const gun = defaultGunFor(cls);
  setShip(game, s, { classId: c, name: ship.loadout.name, guns: { port: gun, starboard: gun }, modules: {}, mount: cls.fixedMount }, 1);
  const beasts = o.beasts ?? [];
  if (!roomFor(ship, beasts)) {
    undo();
    return 'No room aboard her for the creatures that come with her.';
  }
  const bal = move(game, s.accountId, -o.price, 'doubloons_buy', `ship:${c}`, () => {
    for (const b of beasts) joinCreatures(game, s, b.u, b.n);
    game.saveSession(s);
  });
  if (bal === null) {
    undo();
    return whyText(game, s, 'poor');
  }
  sendBalance(game, s);
  game.toastShip(ship, `The ${cls.name} is yours for ${o.price} doubloons. Your old ship is berthed here.`, 'gold');
  game.pushSelf(s, true);
  game.pushPort(s);
  return null;
}

/** A stack of a kind for doubloons: into her army as a tamer's creatures come, every one of them or none. */
export function buyUnit(game: Game, s: PlayerSession, u: UnitId): string | null {
  const o = unitOffer(game, u);
  if (!o) return 'Not for sale';
  const why = unitWhy(game, s, u, o, game.db.doubloons(s.accountId));
  if (why) return whyText(game, s, why, undefined, o.n);
  const bal = move(game, s.accountId, -o.price, 'doubloons_buy', `unit:${u}:${o.n}`, () => {
    joinCreatures(game, s, u, o.n);
    game.saveSession(s);
  });
  if (bal === null) return whyText(game, s, 'poor');
  sendBalance(game, s);
  game.toastShip(s.ship, `${o.n} ${beastsName(u)} join your army for ${o.price} doubloons.`, 'good');
  game.pushSelf(s, true);
  return null;
}

// ------------------------------------------------------------------------------------------------ the window

export function premiumView(game: Game, s: PlayerSession): PremiumView {
  const balance = game.db.doubloons(s.accountId);
  const ship = s.ship!;
  return {
    balance,
    ships: shipList(game).map((c) => {
      const o = shipOffer(game, c)!;
      return { id: c, price: o.price, note: o.note, beasts: o.beasts ?? [], lv: captainLevelFor(levelRange(c)[0]), why: shipWhy(game, s, c, o.price, balance) };
    }),
    units: unitList(game).map((u) => {
      const o = unitOffer(game, u)!;
      return { id: u, price: o.price, n: o.n, note: o.note, why: unitWhy(game, s, u, o, balance) };
    }),
    port: ship.docked ? game.portById(ship.docked)?.name ?? null : null,
    pay: PAYMENTS_OPEN,
  };
}

export function sendPremium(game: Game, s: PlayerSession): void {
  if (s.ship && s.profile) game.sendTo(s, { t: 'premium', view: premiumView(game, s) });
}

/** Her client's word to the shop: the view, a hull or a kind bought (the view comes back either way). */
export function premiumMessage(game: Game, s: PlayerSession, msg: PremiumClientMsg): void {
  const why = msg.action === 'buy_ship' ? buyShip(game, s, msg.id) : msg.action === 'buy_unit' ? buyUnit(game, s, msg.id) : null;
  if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  if (msg.action === 'view') sendBalance(game, s);
  sendPremium(game, s);
}

// ------------------------------------------------------------------------------------------------ the tester's console

/** `/doubloons [N|-N|sample [on|off]]`: doubloons credited to her account as a payment will be (or taken off it, never
 *  below nought); `sample` puts the tester's sample catalogue into the shop, or takes it out (on its own: the other). */
export function adminDoubloons(game: Game, s: PlayerSession, args: string[]): string {
  if (args[0] === 'sample') {
    const on = args[1] === 'on' ? true : args[1] === 'off' ? false : !samples.has(game);
    if (on) samples.add(game);
    else samples.delete(game);
    sendPremium(game, s);
    return samples.has(game) ? 'The sample catalogue is in the shop: two hulls and two kinds of creature.' : 'The sample catalogue is out of the shop.';
  }
  const n = Math.trunc(Number(args[0]));
  if (!Number.isFinite(n) || n === 0) return `Doubloons: ${game.db.doubloons(s.accountId)}. Usage: /doubloons N|-N|sample [on|off]`;
  const bal = n > 0 ? creditPremium(game, s.accountId, n, 'admin', `console:${s.name}`) : move(game, s.accountId, n, 'doubloons_admin', `console:${s.name}`);
  if (bal === null) return n > 0 ? `No more than ${CREDIT_MAX} at once.` : `Not that many: ${game.db.doubloons(s.accountId)} on the account.`;
  sendBalance(game, s);
  sendPremium(game, s);
  return `Doubloons: ${bal}.`;
}
