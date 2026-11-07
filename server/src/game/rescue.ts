// The rescued aboard and the floating waystations' help (forum, Эдуард, post 93; the rules and numbers:
// shared/src/data/rescue.ts). Hooks, each on the old road:
//   castaways.ts haulCastaway — the men past her hammocks come aboard as the rescued (takeRescued), their risks rolled;
//   waystations.ts wayView    — the window's lines (aidRows); wayMessage 'aid' — one of them done (doAid); 'nearest' —
//                               the helmsman takes her to the nearest waystation (moor → approach.ts → autosail.ts);
//   Game.ts pushSelf          — her rescued for the effects' row by her portrait (rescueView).

import { GOODS, isStore } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { holdFill, overloadAt } from '../../../shared/src/data/overload.ts';
import {
  AID_CASKS, AID_COOLDOWN_MS, CARGO_MUL, CHEST_CURSE, FEVER_LOSS, MED_CURSE, MUTINY_LOSS, RESCUE_CAP, RESCUE_CURSE, RESCUE_FEVER, RESCUE_MUTINY,
  RESCUE_SWAP, RUM_FEAR, SWAP_WORD, WAY_AIDS, isSwap, rescueHead,
} from '../../../shared/src/data/rescue.ts';
import type { AidRow, RescueView, WayAid } from '../../../shared/src/data/rescue.ts';
import type { Waystation } from '../../../shared/src/world/waystations.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { reconcile } from './crew.ts';
import { stepCurse } from './curse.ts';
import type { Game } from './Game.ts';
import { gainSanity } from './mind.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** Her rescued in her save (p.rescue): how many, and when each of the hold's services was last done (wall ms). */
export interface RescueRec {
  aboard: number;
  used: Partial<Record<WayAid, number>>;
}

type WithRescue = { rescue?: RescueRec };

export function rescueOf(p: Profile): RescueRec {
  const r = ((p as unknown as WithRescue).rescue ??= { aboard: 0, used: {} });
  r.aboard = Math.max(0, Math.min(RESCUE_CAP, Math.floor(Number(r.aboard) || 0)));
  r.used ??= {};
  return r;
}

/** The dice of the rescued (their own: the tests run the game's). */
const dice = new WeakMap<Game, Rng>();
function R(game: Game): Rng {
  let r = dice.get(game);
  if (!r) dice.set(game, (r = new Rng(0x5a17ed)));
  return r;
}
/** Tests: the dice. */
export function setRescueRng(game: Game, rng: Rng): void {
  dice.set(game, rng);
}

/** The chances a batch taken aboard now brings each trouble (0 when her crew answers it). */
export function rescueRisks(ship: ShipEntity, p: Profile): { fever: number; mutiny: number; curse: number } {
  const pools = p.company.pools;
  return {
    fever: pools.surgeon > 0 || (ship.cargo.medicine ?? 0) > 0 ? 0 : RESCUE_FEVER,
    mutiny: pools.marine > 0 ? 0 : RESCUE_MUTINY,
    curse: RESCUE_CURSE * (ship.hasFlag('copper_sheathing') ? 0.5 : 1),
  };
}

/** Room for more of the rescued. */
export function rescueRoom(p: Profile): number {
  return RESCUE_CAP - rescueOf(p).aboard;
}

/** `n` men of a castaway's spar taken aboard as the rescued (no hammocks for them): the batch's risks rolled once. The
 *  number that stay aboard (a mutiny takes the batch away with the deserters). */
export function takeRescued(game: Game, s: PlayerSession, n: number): number {
  const p = s.profile!, ship = s.ship!;
  const k = Math.max(0, Math.min(n, rescueRoom(p)));
  if (k <= 0) return 0;
  const r = rescueOf(p);
  const risk = rescueRisks(ship, p);
  const rng = R(game);
  let stay = k;
  if (rng.float() < risk.fever) {
    const lost = Math.min(ship.crew - 1, Math.max(1, Math.round(ship.crew * FEVER_LOSS)));
    if (lost > 0) ship.crew = ship.crew - lost;
    ship.morale = Math.max(0, ship.morale - 3);
    game.toastShip(ship, `The castaways brought a fever aboard: ${lost} men down in their hammocks. A surgeon or a chest of medicine keeps it out.`, 'bad');
  }
  if (rng.float() < risk.mutiny) {
    const lost = Math.min(ship.crew - 1, Math.max(1, Math.round(ship.crew * MUTINY_LOSS)));
    if (lost > 0) ship.crew = ship.crew - lost;
    stay = 0;
    game.toastShip(ship, `The castaways stirred up trouble: ${lost} of your men went off with them in their boat. Marines keep the deck.`, 'bad');
  }
  if (rng.float() < risk.curse) {
    ship.curse = Math.min(100, ship.curse + CHEST_CURSE * (ship.hasFlag('copper_sheathing') ? 0.5 : 1));
    stepCurse(game, ship, false);
    game.toastShip(ship, 'A castaway’s sea-chest was cursed: the hull darkens. Medicine at a floating chapel takes it off.', 'bad');
  }
  if (stay > 0) {
    r.aboard += stay;
    game.toastShip(ship, `No hammocks: ${stay} rescued ride as passengers (${r.aboard} aboard). Set them down at a floating tavern, market or chapel for a reward.`, 'info');
  }
  game.pushSelf(s, true);
  return stay;
}

/** Her rescued for the effects' row (shown while any are aboard) and the castaway's card (the risks of the next). */
export function rescueView(_game: Game, s: PlayerSession): RescueView | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return null;
  const aboard = (p as unknown as WithRescue).rescue?.aboard ?? 0;
  return { aboard, cap: RESCUE_CAP, head: rescueHead(p.level), ...rescueRisks(ship, p) };
}

// ------------------------------------------------------------------------------------------------ the waystation

/** Her crew's fear (0–100): the other side of her sanity. */
const fearOf = (ship: ShipEntity): number => Math.max(0, Math.round(100 - ship.sanity));
const curseFloor = (ship: ShipEntity): number => (ship.captain === 'drowned' ? 30 : 0);

/** The trade cargo past her hull's overload line: what a market takes (cheapest by room first), the silver, the share
 *  of the line let off. */
export function cargoRelief(ship: ShipEntity): { take: Partial<Record<GoodId, number>>; units: number; silver: number } {
  const st = ship.stats;
  const line = overloadAt(ship.loadout.classId);
  const cargo = { ...ship.cargo };
  const take: Partial<Record<GoodId, number>> = {};
  let units = 0, silver = 0;
  if (holdFill(cargo, st) < line) return { take, units, silver };
  const goods = (Object.keys(cargo) as GoodId[])
    .filter((g) => (cargo[g] ?? 0) > 0 && !isStore(g) && GOODS[g] && !GOODS[g].contraband)
    .sort((a, b) => GOODS[a].basePrice / GOODS[a].volume - GOODS[b].basePrice / GOODS[b].volume);
  for (const g of goods) {
    while ((cargo[g] ?? 0) > 0 && holdFill(cargo, st) >= line) {
      // (by the unit's room, the excess in one step, then one at a time across the line)
      const excess = (holdFill(cargo, st) - line) * st.holdVolume;
      const per = Math.max(1e-6, GOODS[g].volume);
      const n = Math.max(1, Math.min(cargo[g]!, Math.floor(excess / per)));
      cargo[g] = cargo[g]! - n;
      take[g] = (take[g] ?? 0) + n;
      units += n;
      silver += n * GOODS[g].basePrice * CARGO_MUL;
    }
    if (holdFill(cargo, st) < line) break;
  }
  return { take, units, silver: Math.floor(silver) };
}

/** Minutes until one of the hold's services may be done again. */
function waitOf(game: Game, r: RescueRec, id: WayAid): number {
  const at = r.used[id] ?? 0;
  const left = at + AID_COOLDOWN_MS - game.wallNow();
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

/** One line of the window: what it does here now, and whether it may. */
export function aidRow(game: Game, s: PlayerSession, id: WayAid): AidRow {
  const p = s.profile!, ship = s.ship!;
  const r = rescueOf(p);
  if (id === 'land') {
    const n = r.aboard;
    return { id, on: n > 0, n, gain: n * rescueHead(p.level), wait: 0, ...(n > 0 ? {} : { why: 'No rescued aboard.' }) };
  }
  if (isSwap(id)) {
    const why = r.aboard < RESCUE_SWAP ? `Needs ${RESCUE_SWAP} rescued aboard.` : p.company.pools.sailor < 1 ? 'No sailor of yours to stand down.' : undefined;
    return { id, on: !why, n: RESCUE_SWAP, gain: 1, wait: 0, ...(why ? { why } : {}) };
  }
  const wait = waitOf(game, r, id);
  if (id === 'rum') {
    const have = Math.floor(ship.cargo.rum ?? 0), fear = fearOf(ship);
    const n = Math.min(have, AID_CASKS, Math.ceil(fear / RUM_FEAR));
    const why = wait > 0 ? `Again in ${wait} min.` : fear < 1 ? 'Your crew is not afraid.' : have < 1 ? 'No rum in the hold.' : undefined;
    return { id, on: !why, n: Math.max(0, n), gain: Math.min(fear, n * RUM_FEAR), wait, ...(why ? { why } : {}) };
  }
  if (id === 'medicine') {
    const have = Math.floor(ship.cargo.medicine ?? 0), curse = Math.max(0, Math.floor(ship.curse - curseFloor(ship)));
    const n = Math.min(have, AID_CASKS, Math.ceil(curse / MED_CURSE));
    const why = wait > 0 ? `Again in ${wait} min.` : curse < 1 ? 'The hull is not cursed.' : have < 1 ? 'No medicine in the hold.' : undefined;
    return { id, on: !why, n: Math.max(0, n), gain: Math.min(curse, n * MED_CURSE), wait, ...(why ? { why } : {}) };
  }
  // cargo
  const c = cargoRelief(ship);
  const why = wait > 0 ? `Again in ${wait} min.` : c.units < 1 ? 'Your hold is not overloaded.' : undefined;
  return { id, on: !why, n: c.units, gain: c.silver, wait, ...(why ? { why } : {}) };
}

export function aidRows(game: Game, s: PlayerSession, w: Waystation): AidRow[] {
  return WAY_AIDS[w.kind].map((id) => aidRow(game, s, id));
}

/** One of the window's lines done at the waystation she is moored at. */
export function doAid(game: Game, s: PlayerSession, w: Waystation, id: WayAid): string | null {
  if (!WAY_AIDS[w.kind].includes(id)) return 'Not here.';
  const p = s.profile!, ship = s.ship!;
  const row = aidRow(game, s, id);
  if (!row.on) return row.why ?? 'Not now';
  const r = rescueOf(p);
  if (id === 'land') {
    r.aboard = 0;
    p.gold += row.gain;
    ship.morale = Math.min(100, ship.morale + Math.min(5, row.n));
    game.db.ledger(s.accountId, 'rescue', row.gain, `way:${w.id}:${row.n}`);
    game.toastShip(ship, `${row.n} rescued set down at the waystation: they pay you ${row.gain} silver.`, 'gold');
  } else if (isSwap(id)) {
    reconcile(game, p.company, ship.crew);
    r.aboard -= RESCUE_SWAP;
    p.company.pools.sailor -= 1;
    p.company.pools[id] += 1;
    ship.companyKey = '';
    game.toastShip(ship, `${RESCUE_SWAP} rescued stay at the waystation; in the place of one of your sailors ${SWAP_WORD[id]} comes aboard.`, 'good');
  } else if (id === 'rum') {
    ship.cargo.rum = (ship.cargo.rum ?? 0) - row.n;
    if (!ship.cargo.rum) delete ship.cargo.rum;
    gainSanity(ship, row.n * RUM_FEAR);
    r.used.rum = game.wallNow();
    game.toastShip(ship, `${row.n} casks of rum go round the tavern: the crew’s fear down by ${row.gain} %.`, 'good');
  } else if (id === 'medicine') {
    ship.cargo.medicine = (ship.cargo.medicine ?? 0) - row.n;
    if (!ship.cargo.medicine) delete ship.cargo.medicine;
    ship.curse = Math.max(curseFloor(ship), ship.curse - row.n * MED_CURSE);
    stepCurse(game, ship, false);
    r.used.medicine = game.wallNow();
    game.toastShip(ship, `The chapel’s brothers burn ${row.n} chests of medicine over the hull: the curse down by ${row.gain} %.`, 'good');
  } else {
    const c = cargoRelief(ship);
    for (const [g, n] of Object.entries(c.take) as [GoodId, number][]) {
      ship.cargo[g] = (ship.cargo[g] ?? 0) - n;
      if ((ship.cargo[g] ?? 0) <= 0) delete ship.cargo[g];
    }
    p.gold += c.silver;
    r.used.cargo = game.wallNow();
    ship.recompute(game.now);
    game.db.ledger(s.accountId, 'sell', c.silver, `way:${w.id}:${c.units}`);
    game.toastShip(ship, `The market takes ${c.units} of your goods for ${c.silver} silver: the hold is under the overload line.`, 'gold');
  }
  game.pushSelf(s, true);
  return null;
}
