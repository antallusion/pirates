// The hero's path in the boarding battle on the server (docs/18 I): the named captains of the sea who walk a path
// (pirates by their trick, barons by their sea, hunters by their hull), the scrolls of pages found in lairs, on
// bosses and in guards' chests, another path's page taught at a guild for twice the price, her stamina at rest, and
// the tester's console (/path, /stam, /scroll, /pathfoe). Every roll here is on the path book's own dice.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { ORDERS, isOrder, guildOf, guildPrice, orderLevelCap, rankOf } from '../../../shared/src/data/hero.ts';
import type { OrderId } from '../../../shared/src/data/hero.ts';
import {
  BARON_PATH, FOREIGN_PRICE, INNATE, PAGE_UNLOCK, PATH_IDS, PATH_PAGES, PATH_PAGE_IDS, SCROLL_CHANCE, SCROLL_MAX, ULTIMATE, ULT_LEVEL, hunterPath, isPathPage, pathOfTrick,
  pathPagesAt, scrollPool, stamMaxOf, talentBook,
} from '../../../shared/src/data/paths.ts';
import type { PathPageId } from '../../../shared/src/data/paths.ts';
import { pirateById } from '../../../shared/src/data/pirates.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { headingVec } from '../../../shared/src/math.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { heroOf, heroPrims } from './hero.ts';
import type { HeroRec } from './hero.ts';

/** The path book's own dice (like the auction house's: server/src/game/auction.ts). */
const rngs = new WeakMap<Game, Rng>();
function pr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x9a7b00c5)));
  return r;
}

// ------------------------------------------------------------------ 8. the named captains of the sea

/** A captain the tester set on a ship of the sea (/pathfoe). */
const forced = new WeakMap<ShipEntity, CaptainId>();

/** The path a ship of the sea's captain walks: a named pirate's by her trick (her lieutenants hers), a baron's by
 *  his sea, a hunter's by her hull's number; the rest of the sea none. */
export function npcPathOf(ship: ShipEntity): CaptainId | null {
  const f = forced.get(ship);
  if (f) return f;
  const id = ship.named ?? ship.namedMate?.split('#')[0];
  if (id) {
    const np = pirateById(id);
    if (np) return np.baron ? BARON_PATH[np.region] ?? 'reaver' : pathOfTrick(np.trick);
  }
  if (ship.npcRole === 'hunter') return hunterPath(ship.id);
  return null;
}

/** The face a named captain shows on the side panel: her own portrait (a baron's his sea's). */
export function npcFaceOf(ship: ShipEntity): string | undefined {
  const id = ship.named ?? ship.namedMate?.split('#')[0];
  const np = id ? pirateById(id) : undefined;
  if (np && ship.named) return np.art;
  const path = npcPathOf(ship);
  return path ? CAPTAINS[path].portrait.replace(/^portrait\./, '') : undefined;
}

// ------------------------------------------------------------------ 4. stamina

/** Her stamina at most: her Attack and Defense (artifacts' too) and her talents. */
export function stamMax(p: Profile, h = heroOf(p)): number {
  const t = heroPrims(p, h);
  return stamMaxOf(t.atk, t.def) + talentBook(p.talents).stam;
}
/** Her stamina now (whole when never spent). */
export function stamOf(p: Profile, h = heroOf(p)): number {
  const max = stamMax(p, h);
  return Math.max(0, Math.min(max, h.stam ?? max));
}

// ------------------------------------------------------------------ 10. scrolls

/** A scroll of a page into her bag (a source's strength draws the page's level). */
export function giveScroll(game: Game, s: PlayerSession, id?: PathPageId, quiet = false): PathPageId | null {
  const p = s.profile;
  if (!p) return null;
  const h = heroOf(p);
  const top = Math.max(1, Math.min(5, Math.ceil((s.ship?.shipLevel ?? 1) / 2)));
  const page = id ?? pr(game).pick(scrollPool(top));
  const bag = (h.scrolls ??= {});
  if ((bag[page] ?? 0) >= SCROLL_MAX) return null;
  bag[page] = (bag[page] ?? 0) + 1;
  if (!quiet) game.sendTo(s, { t: 'toast', msg: `A scroll: ${PATH_PAGES[page].name[0]}!`, kind: 'gold' });
  return page;
}

/** A chance at a scroll: a boss, a stormed lair, a guard's chest (docs/18 item 10). */
export function maybeScroll(game: Game, s: PlayerSession, source: keyof typeof SCROLL_CHANCE): void {
  if (pr(game).chance(SCROLL_CHANCE[source])) giveScroll(game, s);
}

/** The scrolls read in a battle come out of her bag. */
export function spendScrolls(h: HeroRec, used: readonly string[]): void {
  if (!used.length || !h.scrolls) return;
  for (const id of used) {
    const n = (h.scrolls[id as OrderId] ?? 0) - 1;
    if (n > 0) h.scrolls[id as OrderId] = n;
    else delete h.scrolls[id as OrderId];
  }
}

// ------------------------------------------------------------------ 10. another path's page at a guild

/** The other paths' pages a port's guild of orders teaches (two paths a guild, by the port), at twice the price. */
export function foreignAt(port: Port, own: CaptainId): { id: OrderId; price: number }[] | null {
  if (!guildOf(port.id, port.size)) return null;
  let h = 0x51ab1e;
  for (let i = 0; i < port.id.length; i++) h = Math.imul(h ^ port.id.charCodeAt(i), 16777619);
  const rng = new Rng(h >>> 0);
  const others = PATH_IDS.filter((c) => c !== own);
  const a = rng.pick(others);
  const b = rng.pick(others.filter((c) => c !== a));
  const top = Math.min(5, 2 + Math.max(0, port.size));
  return PATH_PAGE_IDS.filter((id) => (PATH_PAGES[id].path === a || PATH_PAGES[id].path === b) && PATH_PAGES[id].level <= top)
    .sort((x, y) => PATH_PAGES[x].level - PATH_PAGES[y].level || x.localeCompare(y))
    .map((id) => ({ id, price: guildPrice(id) * FOREIGN_PRICE }));
}

/** Another path's page learnt at a guild for twice the price. */
export function learnForeign(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const p = s.profile!;
  const h = heroOf(p);
  if (!isPathPage(id)) return 'No such order';
  if (PATH_PAGES[id].path === p.captain) return 'That page is in your own book: it opens with your level';
  const list = foreignAt(port, p.captain);
  const offer = list?.find((x) => x.id === id);
  if (!offer) return 'This guild does not teach that order';
  if (h.orders.includes(id)) return 'You know that order already';
  const cap = orderLevelCap(p.level, rankOf(h.skills, 'mysticism'));
  if (ORDERS[id].level > cap) return `Orders of level ${ORDERS[id].level} are beyond you yet (Deep Mysticism or more levels open them)`;
  if (p.gold < offer.price) return `Needs ${offer.price} silver`;
  p.gold -= offer.price;
  game.db.ledger(s.accountId, 'guild_order', -offer.price, id);
  h.orders.push(id);
  game.sendTo(s, { t: 'toast', msg: `Learnt: ${ORDERS[id].name[0]}.`, kind: 'gold' });
  return null;
}

// ------------------------------------------------------------------ the tester's console

/** `/path`, `/stam`, `/scroll`, `/pathfoe` (admin.ts). */
export function pathAdmin(game: Game, s: PlayerSession, cmd: string, args: string[]): string {
  const p = s.profile!;
  const h = heroOf(p);
  const ship = s.ship!;
  switch (cmd) {
    case 'path': {
      if (args[0] === 'learn') {
        const id = args[1];
        if (!id || !isPathPage(id)) return `Usage: /path learn page · ${PATH_PAGE_IDS.join(' ')}`;
        if (!h.orders.includes(id)) h.orders.push(id);
        return `Learnt: ${ORDERS[id].name[0]}.`;
      }
      if (args[0] === 'forget') {
        h.orders = h.orders.filter((x) => !isPathPage(x));
        return 'Foreign pages forgotten.';
      }
      if (args.length) return 'Usage: /path [learn page | forget]';
      const open = pathPagesAt(p.captain, p.level).map((id) => PATH_PAGES[id].name[0]).join(', ');
      const shut = PATH_PAGE_IDS.filter((id) => PATH_PAGES[id].path === p.captain && !pathPagesAt(p.captain, p.level).includes(id)).map((id) => `${PATH_PAGES[id].name[0]} (${PAGE_UNLOCK[PATH_PAGES[id].level]})`).join(', ');
      return `Path: ${INNATE[p.captain].name[0]} · ultimate ${ULTIMATE[p.captain].name[0]} (${p.level >= ULT_LEVEL ? 'open' : `level ${ULT_LEVEL}`}) · pages: ${open}${shut ? ` · later: ${shut}` : ''}.`;
    }
    case 'stam': {
      const max = stamMax(p, h);
      h.stam = args[0] === undefined || args[0] === 'full' ? max : Math.max(0, Math.min(max, Number(args[0]) || 0));
      return `Stamina ${Math.floor(h.stam)}/${max}.`;
    }
    case 'scroll': {
      if (args[0] === 'clear') {
        h.scrolls = {};
        return 'Scrolls: none.';
      }
      const id = args[0] && args[0] !== 'random' ? args[0] : undefined;
      if (id && !isPathPage(id)) return `Usage: /scroll [page|random|clear] [n] · ${PATH_PAGE_IDS.join(' ')}`;
      const n = Math.max(1, Math.min(SCROLL_MAX, Math.round(Number(args[1]) || 1)));
      for (let i = 0; i < n; i++) giveScroll(game, s, id as PathPageId | undefined, true);
      return `Scrolls: ${Object.entries(h.scrolls ?? {}).map(([k, v]) => `${ORDERS[k as OrderId].name[0]} ×${v}`).join(', ') || 'none'}.`;
    }
    case 'pathfoe': {
      // A named captain of the sea alongside, walking a path (/pathfoe [path] [class]): to see her book in a boarding.
      if (ship.docked) return 'Put to sea first.';
      const path = (PATH_IDS.includes(args[0] as CaptainId) ? args[0] : PATH_IDS[Math.floor(game.now) % PATH_IDS.length]) as CaptainId;
      const cls = (args[1] ?? 'brig') as ShipClassId;
      if (!SHIP_CLASSES[cls]) return `Classes: ${Object.keys(SHIP_CLASSES).join(', ')}`;
      const v = headingVec(ship.state.heading + Math.PI / 2);
      const o = game.spawnNpcShip('hunter', cls, 'free', ship.state.x + v.x * 60, ship.state.y + v.y * 60, ship.state.heading);
      game.setNpcLevel(o, ship.shipLevel);
      const brain = game.npcs.get(o.id);
      if (brain) brain.active = true;
      o.input = { rudder: 0, sailTarget: 0 };
      o.state.speed = ship.state.speed = 0;
      game.grid.upsert(o.id, o.state.x, o.state.y);
      forced.set(o, path);
      return `${o.name} lies off your beam: her captain walks the path of ${CAPTAINS[path].archetype}. /board to grapple her.`;
    }
  }
  return 'Unknown command.';
}
