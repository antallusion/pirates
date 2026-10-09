// docs/19 E10 on the server: the titans hired at the Grail raised over her island's town — their rows in the island's
// recruit window (next to the pen's: dwell.ts dwellHooks.isleRows), the hire itself (one a week, two aboard at the
// most, never two of a kind, a ship of ⚓9 and up, the price in silver and pearls — the pearls from her island's store
// and her hold, as the window pays its goods), and the tester's
// `/titan`. The citadels of docs/19 E4 will keep them too.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { TITAN_IDS, TITAN_MAX, TITAN_NAMES, TITAN_PRICE, TITAN_SHIP_LEVEL, TITAN_WEEKLY, isTitan, titansIn } from '../../../shared/src/data/titans.ts';
import type { TitanId } from '../../../shared/src/data/titans.ts';
import type { DwellRow } from '../../../shared/src/h3proto.ts';
import { lyingOff, mine as ownBase } from './base.ts';
import { dwellHooks, islePay } from './dwell.ts';
import { weekOf } from './empires.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { townLevel, townState } from './town.ts';

const name = (u: TitanId) => TITAN_NAMES[u].name[0];

/** Titans she has hired this week. */
function hiredThisWeek(game: Game, s: PlayerSession): number {
  const t = s.profile!.titans;
  return t && t.week === weekOf(game.wallNow()) ? t.n : 0;
}

/** Why she may not hire this titan now (null: she may). Her island, its Grail and her ship lying off it are the
 *  window's own; these are the titan's. */
export function titanWhy(game: Game, s: PlayerSession, u: TitanId): string | null {
  const ship = s.ship!;
  if (ship.shipLevel < TITAN_SHIP_LEVEL) return `A titan serves a ship of level ${TITAN_SHIP_LEVEL} and up.`;
  if (hiredThisWeek(game, s) >= TITAN_WEEKLY) return 'The Grail gives one titan a week: come again next week.';
  if (ship.army.some((x) => x.u === u)) return `The ${name(u)} serves you already: never two of a kind.`;
  if (titansIn(ship.army) >= TITAN_MAX) return 'Two titans aboard at the most.';
  if (ship.army.length >= ship.armySlots) return 'No free slot in the army for a new kind of man.';
  if (ship.crew >= ship.stats.crewMax) return 'No hammocks left aboard';
  if (s.profile!.gold < TITAN_PRICE.silver) return `Needs ${TITAN_PRICE.silver} silver`;
  return islePay(game, s, { pearls: TITAN_PRICE.pearls }, false);
}

/** The Grail's rows in her island's recruit window (none without a Grail). */
export function titanRows(game: Game, s: PlayerSession): DwellRow[] {
  const m = ownBase(game, s);
  if (typeof m === 'string' || townLevel(m.y, 'grail') <= 0 || !s.ship) return [];
  const left = Math.max(0, TITAN_WEEKLY - hiredThisWeek(game, s));
  return TITAN_IDS.map((u) => ({
    tier: 8, name: 'grail' as const, up: false, pool: left, growth: TITAN_WEEKLY, label: TITAN_NAMES[u].name, art: UNITS[u].art,
    units: [{ u, per: TITAN_PRICE.silver, goods: { pearls: TITAN_PRICE.pearls }, room: 1 }],
    why: titanWhy(game, s, u),
  }));
}

/** A titan signed on at the Grail. */
export function titanRecruit(game: Game, s: PlayerSession, u: UnitId): string | null {
  if (!isTitan(u)) return 'No dwelling of theirs here.';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  if (townLevel(m.y, 'grail') <= 0) return 'Raise the Grail over your town first.';
  if (!lyingOff(game, s, m.h)) return 'Bring your ship to the island to take the men aboard.';
  const ship = s.ship!;
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  const why = titanWhy(game, s, u);
  if (why) return why;
  const p = s.profile!;
  p.gold -= TITAN_PRICE.silver;
  islePay(game, s, { pearls: TITAN_PRICE.pearls }, true);
  game.db.ledger(s.accountId, 'recruit', -TITAN_PRICE.silver, `titan:${u}`);
  p.titans = { week: weekOf(game.wallNow()), n: hiredThisWeek(game, s) + 1 };
  ship.addMen(u, 1);
  p.company.pools.sailor += 1;
  ship.companyKey = '';
  game.toastShip(ship, `The ${name(u)} rises at the Grail and follows your ship.`, 'gold');
  return null;
}

/** The Grail's rows beside the pen's in the island's window (installed by Game, after the lairs' own). */
export function installTitanHooks(): void {
  const before = dwellHooks.isleRows;
  dwellHooks.isleRows = (game, s) => [...(before?.(game, s) ?? []), ...titanRows(game, s)];
}

/** `/titan [kind|grail|reset]` (admin.ts): a titan aboard at once (the price and the Grail passed over), the Grail raised
 *  over her town, or the week's hire forgotten. */
export function adminTitan(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  const k = args[0];
  if (k === 'reset') {
    s.profile!.titans = undefined;
    return 'The Grail’s week is fresh.';
  }
  if (k === 'grail') {
    // The Grail raised over her town by the tester's word (the season's dig passed over).
    const m = ownBase(game, s);
    if (typeof m === 'string') return m;
    townState(m.y).b.grail = 1;
    return 'The Grail stands over your town.';
  }
  if (!k || !isTitan(k)) return `Titans: ${TITAN_IDS.join(', ')}`;
  if (ship.army.some((x) => x.u === k)) return `The ${name(k)} serves you already: never two of a kind.`;
  if (ship.army.length >= ship.armySlots) return 'No free slot in the army for a new kind of man.';
  ship.addMen(k, 1);
  ship.companyKey = '';
  game.pushSelf(s, true);
  return `The ${name(k)} joins your army.`;
}
