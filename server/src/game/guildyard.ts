// The guild's shipyard on its leader's island (docs/16 #34). The admiral's own island (docs/15) with a shipyard on it
// takes one guild project at a time — a ship for the guild fleet, or the yard itself raised a level — and every
// member brings to it: goods from the hold while lying off the admiral's island, silver from anywhere, and the
// admiral also from the island's yard and store. The contributions are listed by captain with the bar; a member who
// brought 2% or more is named among its builders. Done, the ship joins the guild fleet at the nearest port (any
// captain of the guild may borrow her, guilds.ts), or the shipyard rises a level.

import { GUILD_PROJECTS, GUILD_PROJECT_DEFS, GUILD_PROJECT_SHARE, guildShipClass, projectUnits } from '../../../shared/src/data/social.ts';
import type { GuildProject } from '../../../shared/src/data/social.ts';
import { SHIPYARD_MAX, YARD_SHIP_LEVEL } from '../../../shared/src/data/baseships.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { clampLevel } from '../../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { GuildYardView } from '../../../shared/src/protocol.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { lyingOff, takeGoods, yardOf } from './base.ts';
import { shipyardLevel } from './baseships.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { log, member } from './guilds.ts';
import type { Guild } from './guilds.ts';
import { has, island } from './holdings.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession } from './player.ts';

export interface GuildYard {
  kind: GuildProject;
  goods: Partial<Record<GoodId, number>>;
  silver: number;
  /** Account → the captain's name and the units brought (a unit of goods, or 100 silver). */
  hands: Record<string, { name: string; units: number }>;
  started: number;
}

function admiralOf(g: Guild): { account: number; name: string } | null {
  const m = g.members.find((x) => x.rank === 'admiral');
  return m ? { account: m.account, name: m.name } : null;
}

/** The admiral's island and why the guild's yard cannot work there now (null: it can). */
function yardPlace(game: Game, g: Guild): { h: Holding | null; isl: Island | null; why: string | null } {
  const adm = admiralOf(g);
  if (!adm) return { h: null, isl: null, why: 'The guild has no admiral' };
  const h = ownIsland(game, adm.account) ?? null;
  const isl = h ? island(game, h.island) ?? null : null;
  if (!h || !isl) return { h: null, isl: null, why: 'The admiral has no island of their own' };
  if (!shipyardLevel(h)) return { h, isl, why: 'Build a shipyard on the admiral’s island first' };
  return { h, isl, why: null };
}

function need(p: GuildYard): { goods: Partial<Record<GoodId, number>>; silver: number } {
  const d = GUILD_PROJECT_DEFS[p.kind];
  return { goods: d.goods, silver: d.silver };
}

function unitsIn(p: GuildYard): number {
  return Object.values(p.goods).reduce((a, n) => a + (n ?? 0), 0) + Math.floor(p.silver / 100);
}

function complete(p: GuildYard): boolean {
  const n = need(p);
  return p.silver >= n.silver && (Object.entries(n.goods) as [GoodId, number][]).every(([g, k]) => (p.goods[g] ?? 0) >= k);
}

function tellMembers(game: Game, g: Guild, msg: string, kind: 'info' | 'good' | 'gold' = 'info'): void {
  for (const m of g.members) {
    const ms = game.sessionByAccount(m.account);
    if (ms) game.sendTo(ms, { t: 'toast', msg, kind });
  }
}

/** The admiral lays down a project on the slipway. */
export function gyardStart(game: Game, s: PlayerSession, kind: GuildProject): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You belong to no guild';
  if (member(g, s.accountId)?.rank !== 'admiral') return 'The admiral lays down the guild’s projects';
  if (!GUILD_PROJECTS.includes(kind)) return 'Unknown project';
  if (g.yardProject) return 'A project is already on the guild’s slipway';
  const { h, why } = yardPlace(game, g);
  if (why || !h) return why;
  if (kind === 'yard' && shipyardLevel(h) >= SHIPYARD_MAX) return 'The shipyard is at its greatest';
  g.yardProject = { kind, goods: {}, silver: 0, hands: {}, started: game.wallNow() };
  log(game, g, `${s.name} lays down ${GUILD_PROJECT_DEFS[kind].name[0].toLowerCase()} at the admiral’s island.`);
  tellMembers(game, g, `The guild’s shipyard takes a new project: ${GUILD_PROJECT_DEFS[kind].name[0]}.`);
  game.guilds.touch();
  return null;
}

/** The admiral takes a project off the slipway (what was brought stays with the island's store). */
export function gyardCancel(game: Game, s: PlayerSession): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You belong to no guild';
  if (member(g, s.accountId)?.rank !== 'admiral') return 'The admiral lays down the guild’s projects';
  const p = g.yardProject;
  if (!p) return 'Nothing is on the guild’s slipway';
  const { h } = yardPlace(game, g);
  if (h) for (const [good, n] of Object.entries(p.goods) as [GoodId, number][]) h.store[good] = (h.store[good] ?? 0) + n;
  if (h) h.treasury = (h.treasury ?? 0) + p.silver;
  g.yardProject = null;
  log(game, g, `${s.name} takes the project off the slipway.`);
  game.guilds.touch();
  game.holdings.touch();
  return null;
}

/** A member brings goods (from the hold, lying off the admiral's island; the admiral also from the island) or silver. */
export function gyardGive(game: Game, s: PlayerSession, good: GoodId | undefined, qty: number, silver: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You belong to no guild';
  const p = g.yardProject;
  if (!p) return 'Nothing is on the guild’s slipway';
  const { h, isl, why } = yardPlace(game, g);
  if (why || !h || !isl) return why;
  const n = need(p);
  let units = 0;
  const pr = s.profile!;
  if (silver > 0) {
    const want = Math.max(0, n.silver - p.silver);
    const k = Math.min(Math.floor(silver), want);
    if (k <= 0) return 'The project needs no more silver';
    if (pr.gold < k) return 'Not enough silver';
    pr.gold -= k;
    p.silver += k;
    game.db.ledger(s.accountId, 'guild_yard', -k, g.tag);
    units += k / 100;
  }
  if (good !== undefined && qty > 0) {
    if (!GOODS[good] || n.goods[good] === undefined) return 'The project does not need that';
    const want = Math.max(0, (n.goods[good] ?? 0) - (p.goods[good] ?? 0));
    let k = Math.min(Math.floor(qty), want);
    if (k <= 0) return `The project needs no more ${GOODS[good].name.toLowerCase()}`;
    const near = lyingOff(game, s, h);
    const isAdmiral = admiralOf(g)?.account === s.accountId;
    if (!near && !isAdmiral) return `Bring it to ${isl.name}: lie off the admiral’s island`;
    const y = yardOf(game, h);
    const have = (near ? s.ship?.cargo[good] ?? 0 : 0) + (isAdmiral ? (y.res[good] ?? 0) + (h.store[good] ?? 0) : 0);
    k = Math.min(k, have);
    if (k <= 0) return `You have no ${GOODS[good].name.toLowerCase()} to bring`;
    if (isAdmiral) takeGoods(h, y, s, near, { [good]: k });
    else {
      s.ship!.cargo[good] = (s.ship!.cargo[good] ?? 0) - k;
      if (!s.ship!.cargo[good]) delete s.ship!.cargo[good];
    }
    p.goods[good] = (p.goods[good] ?? 0) + k;
    units += k;
    game.holdings.touch();
  }
  if (units <= 0) return 'Bring goods or silver';
  const acc = String(s.accountId);
  const hand = (p.hands[acc] ??= { name: s.name, units: 0 });
  hand.name = s.name;
  hand.units = Math.round((hand.units + units) * 100) / 100;
  game.guilds.touch();
  game.pushSelf(s, true);
  if (complete(p)) finish(game, g, h, isl);
  return null;
}

function finish(game: Game, g: Guild, h: Holding, isl: Island): void {
  const p = g.yardProject!;
  const builders = Object.values(p.hands).filter((x) => x.units >= projectUnits(p.kind) * GUILD_PROJECT_SHARE).map((x) => x.name);
  if (p.kind === 'ship') {
    const yl = shipyardLevel(h);
    const cls = guildShipClass(yl);
    const port = game.nearestPort(isl.x, isl.y) ?? game.world.ports[0];
    const name = `${g.name} ${SHIP_CLASSES[cls].name}`;
    const gun = cls === 'frigate' ? 'medium_12' : 'light_6';
    g.fleet.push({ id: g.nextId++, loadout: { classId: cls, name, guns: { port: gun, starboard: gun }, modules: {}, level: clampLevel(cls, YARD_SHIP_LEVEL[yl] ?? 3) }, hull: 1, port: port.id, lentTo: null, deposit: 0, giver: `${isl.name}` });
    log(game, g, `The guild’s shipyard launches the ${name}; she lies at ${port.name}. Built by ${builders.join(', ') || 'the guild'}.`);
    tellMembers(game, g, `The guild’s shipyard launches the ${name}: she lies at ${port.name} for any captain of the guild.`, 'gold');
  } else {
    const b = has(h, 'shipyard');
    if (b) b.level = Math.min(SHIPYARD_MAX, (b.level ?? 1) + 1);
    game.holdings.touch();
    log(game, g, `The shipyard on ${isl.name} rises to level ${b?.level ?? 1}. Built by ${builders.join(', ') || 'the guild'}.`);
    tellMembers(game, g, `The guild’s shipyard on ${isl.name} rises to level ${b?.level ?? 1}.`, 'gold');
  }
  (g.yardDone ??= []).push({ kind: p.kind, at: game.wallNow() });
  if (g.yardDone.length > 10) g.yardDone.splice(0, g.yardDone.length - 10);
  g.yardProject = null;
  game.guilds.touch();
}

/** What a member sees of the guild's yard (null: no guild). */
export function gyardView(game: Game, s: PlayerSession): GuildYardView | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return null;
  const adm = admiralOf(g);
  const { h, isl, why } = yardPlace(game, g);
  const p = g.yardProject ?? null;
  const near = !!h && lyingOff(game, s, h);
  const n = p ? need(p) : null;
  const total = p ? projectUnits(p.kind) : 1;
  const pct = p ? Math.min(1, unitsIn(p) / total) : 0;
  const isAdmiral = adm?.account === s.accountId;
  const hold = p && n && s.ship ? (Object.keys(n.goods) as GoodId[]).map((good) => {
    let k = near ? s.ship!.cargo[good] ?? 0 : 0;
    if (isAdmiral && h) k += (h.yard?.res[good] ?? 0) + (h.store[good] ?? 0);
    return { good, n: Math.floor(k) };
  }).filter((x) => x.n > 0) : [];
  return {
    island: isl?.name ?? null, x: Math.round(isl?.x ?? 0), y: Math.round(isl?.y ?? 0), leader: adm?.name ?? '', yardLevel: h ? shipyardLevel(h) : 0, why,
    project: p && n ? {
      kind: p.kind,
      goods: (Object.entries(n.goods) as [GoodId, number][]).map(([good, k]) => ({ good, need: k, have: p.goods[good] ?? 0 })),
      silver: { need: n.silver, have: p.silver },
      pct: Math.round(pct * 1000) / 1000,
      hands: Object.values(p.hands).sort((a, b) => b.units - a.units).map((x) => ({ name: x.name, units: Math.round(x.units), builder: x.units >= total * GUILD_PROJECT_SHARE })),
      mine: Math.round(p.hands[String(s.accountId)]?.units ?? 0),
    } : null,
    done: (g.yardDone ?? []).slice(-5).reverse(),
    canStart: isAdmiral && !p && !why,
    near,
    hold,
  };
}

/** For tests and the admin: the project brought to a share of its whole. */
export function gyardFill(game: Game, s: PlayerSession, share: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const p = g?.yardProject;
  if (!g || !p) return 'Nothing is on the guild’s slipway';
  const n = need(p);
  for (const [good, k] of Object.entries(n.goods) as [GoodId, number][]) p.goods[good] = Math.max(p.goods[good] ?? 0, Math.floor(k * share));
  p.silver = Math.max(p.silver, Math.floor(n.silver * share));
  const acc = String(s.accountId);
  p.hands[acc] = { name: s.name, units: Math.max(p.hands[acc]?.units ?? 0, Math.round(unitsIn(p) * 0.6)) };
  p.hands['900001'] ??= { name: 'Anne Vey', units: Math.round(unitsIn(p) * 0.3) };
  p.hands['900002'] ??= { name: 'Morrow Kett', units: Math.round(unitsIn(p) * 0.01) };
  game.guilds.touch();
  const place = yardPlace(game, g);
  if (complete(p) && place.h && place.isl) finish(game, g, place.h, place.isl);
  return null;
}
