// Legendary ships (docs/02 §14.A.5). One of each on the server. The first victory over a great monster lays the
// keel at a yard; the whole sea may bring the materials; the captain who brought the most sails her. She never
// disappears: sunk, she lies as "Sunken Glory" — her wreck marked for all for 48 hours, relics for everyone who
// fought over her — until her captain raises her; if her captain is gone 30 days, she returns to the Legendary
// Reserve and the contest begins again.

import { bossXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { LEGENDARY, LEGENDARY_IDS } from '../../../shared/src/data/legendary.ts';
import type { LegendaryId } from '../../../shared/src/data/legendary.ts';
import type { BossId } from '../../../shared/src/data/bosses.ts';
import { defaultGunFor, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { dist } from '../../../shared/src/math.ts';
import type { LegendaryView } from '../../../shared/src/protocol.ts';
import type { Cargo, ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { sendEvents } from './events.ts';

const DAY = 24 * 3600_000;
const GLORY_MS = 48 * 3600_000;
const RESERVE_MS = 30 * DAY;
const RAISE_RANGE = 300;

export interface LegendRecord {
  status: 'locked' | 'commission' | 'owned' | 'sunk';
  delivered: Cargo;
  contrib: Record<string, { name: string; value: number }>;
  owner?: number;
  ownerName?: string;
  lastActive?: number; // wall ms the owner was last seen
  wreck?: { x: number; y: number; at: number; fought: number[] };
  keelAt?: number;
}

function store(game: Game): Record<LegendaryId, LegendRecord> {
  const st = game.db.getKv<Record<LegendaryId, LegendRecord>>('legendary_ships') ?? ({} as Record<LegendaryId, LegendRecord>);
  for (const id of LEGENDARY_IDS) st[id] ??= { status: 'locked', delivered: {}, contrib: {} };
  return st;
}

function save(game: Game, st: Record<LegendaryId, LegendRecord>): void {
  game.db.setKv('legendary_ships', st);
}

/** A great monster falls for the first time on the server: the yard lays the keel of its legendary ship. */
export function onFirstKill(game: Game, boss: BossId): void {
  const st = store(game);
  for (const id of LEGENDARY_IDS) {
    const def = LEGENDARY[id];
    if (def.boss !== boss || st[id].status !== 'locked') continue;
    st[id].status = 'commission';
    st[id].keelAt = game.wallNow();
    const port = game.portById(def.port);
    const text = `The yard at ${port?.name ?? def.port} lays the keel of the ${def.name}, from the bones of the first ${boss.replace('_', ' ')} slain. Whoever brings the most of what she needs will sail her.`;
    for (const p of game.world.ports) game.addRumor(p.x, p.y, text);
    for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'gold' });
  }
  save(game, st);
}

/** Materials for a legendary commission, taken from the hold at her yard. */
export function deliver(game: Game, s: PlayerSession, port: Port, id: LegendaryId): string | null {
  const def = LEGENDARY[id];
  if (!def) return 'No such ship';
  const st = store(game);
  const rec = st[id];
  if (rec.status !== 'commission') return rec.status === 'locked' ? 'Her keel is not laid yet' : 'She is already built';
  if (port.id !== def.port) return `Her yard is at ${game.portById(def.port)?.name ?? def.port}`;
  const ship = s.ship!;
  let value = 0;
  const brought: string[] = [];
  for (const [g, need] of Object.entries(def.need) as [GoodId, number][]) {
    const want = need - (rec.delivered[g] ?? 0);
    const have = Math.floor(ship.cargo[g] ?? 0);
    const n = Math.min(want, have);
    if (n <= 0) continue;
    ship.cargo[g] = have - n;
    if (!ship.cargo[g]) delete ship.cargo[g];
    rec.delivered[g] = (rec.delivered[g] ?? 0) + n;
    value += n * GOODS[g].basePrice;
    brought.push(`${n} ${GOODS[g].name.toLowerCase()}`);
  }
  if (!value) return 'You carry nothing she still needs';
  const c = (rec.contrib[s.accountId] ??= { name: s.name, value: 0 });
  c.value += value;
  game.sendTo(s, { t: 'toast', msg: `The shipwrights take ${brought.join(', ')} for the ${def.name}.`, kind: 'good' });
  const done = (Object.entries(def.need) as [GoodId, number][]).every(([g, n]) => (rec.delivered[g] ?? 0) >= n);
  save(game, st);
  if (done) complete(game, id);
  return null;
}

function complete(game: Game, id: LegendaryId): void {
  const def = LEGENDARY[id];
  const st = store(game);
  const rec = st[id];
  const [account, top] = Object.entries(rec.contrib).sort((a, b) => b[1].value - a[1].value)[0];
  rec.status = 'owned';
  rec.owner = Number(account);
  rec.ownerName = top.name;
  rec.lastActive = game.wallNow();
  save(game, st);
  const text = `The ${def.name} is launched at ${game.portById(def.port)?.name ?? def.port}. She sails for ${top.name}, who brought the most to build her.`;
  for (const p of game.world.ports) game.addRumor(p.x, p.y, text);
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'gold' });
  const owner = game.sessionByAccount(rec.owner);
  if (owner) ensureLegendary(game, owner);
}

function loadoutOf(id: LegendaryId): ShipLoadout {
  const def = LEGENDARY[id];
  const gun = defaultGunFor(SHIP_CLASSES[def.base]);
  return { classId: def.base, name: def.name, guns: { port: gun, starboard: gun }, modules: {}, legendary: id };
}

/** On login (and at launch): a legendary ship is where she belongs — with her captain, or taken back. */
export function ensureLegendary(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p) return;
  const st = store(game);
  let dirty = false;
  for (const id of LEGENDARY_IDS) {
    const rec = st[id];
    const mine = rec.owner === s.accountId && (rec.status === 'owned' || rec.status === 'sunk');
    const holds = p.loadout.legendary === id || p.berths.some((b) => b.loadout.legendary === id);
    if (mine) {
      rec.lastActive = game.wallNow();
      dirty = true;
      if (rec.status === 'owned' && !holds) {
        p.berths.push({ port: LEGENDARY[id].port, loadout: loadoutOf(id), hull: 1 });
        game.sendTo(s, { t: 'toast', msg: `The ${LEGENDARY[id].name} waits for you in her berth at ${game.portById(LEGENDARY[id].port)?.name}.`, kind: 'gold' });
      }
    } else if (holds) {
      // She went back to the Legendary Reserve (or was never yours to keep).
      p.berths = p.berths.filter((b) => b.loadout.legendary !== id);
      if (p.loadout.legendary === id && s.ship) {
        const sloop = { classId: 'sloop' as const, name: 'Hired Sloop', guns: { port: 'light_6' as const, starboard: 'light_6' as const }, modules: {} };
        s.ship.loadout = sloop;
        p.loadout = sloop;
        s.ship.recompute(game.now);
        s.ship.hull = Math.min(s.ship.hull, s.ship.stats.hullMax);
      }
      game.sendTo(s, { t: 'toast', msg: `The ${LEGENDARY[id].name} has returned to the Legendary Reserve.`, kind: 'bad' });
    }
  }
  if (dirty) save(game, st);
}

/** Once a minute on the lead zone: owners gone thirty days lose their ship to the Reserve. */
export function legendaryCalendar(game: Game): void {
  if (!game.zoneLead) return;
  const st = store(game);
  let dirty = false;
  for (const id of LEGENDARY_IDS) {
    const rec = st[id];
    if ((rec.status !== 'owned' && rec.status !== 'sunk') || !rec.lastActive) continue;
    const online = rec.owner !== undefined && game.sessionByAccount(rec.owner);
    if (online) {
      rec.lastActive = game.wallNow();
      dirty = true;
      continue;
    }
    if (game.wallNow() - rec.lastActive < RESERVE_MS) continue;
    st[id] = { status: 'commission', delivered: {}, contrib: {}, keelAt: game.wallNow() };
    dirty = true;
    const text = `The ${LEGENDARY[id].name} has returned to the Legendary Reserve: her captain has not been seen in thirty days. The contest for her begins again at ${game.portById(LEGENDARY[id].port)?.name}.`;
    for (const p of game.world.ports) game.addRumor(p.x, p.y, text);
    for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'gold' });
  }
  if (dirty) save(game, st);
}

/** Sunken Glory: a legendary ship goes down. Her wreck is marked for the whole sea; her captain sails on in a sloop. */
export function legendarySunk(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const id = ship.loadout.legendary;
  if (!id) return;
  const st = store(game);
  const rec = st[id];
  const fought = [...ship.attackers.entries()].filter(([, t]) => t > game.now - 120).map(([sid]) => game.ships.get(sid)?.accountId).filter((a): a is number => a !== null && a !== undefined);
  rec.status = 'sunk';
  rec.wreck = { x: Math.round(ship.state.x), y: Math.round(ship.state.y), at: game.wallNow(), fought: [...new Set([s.accountId, ...fought])] };
  save(game, st);
  // Everyone who fought over her takes a relic of her.
  for (const a of rec.wreck.fought) {
    const o = game.sessionByAccount(a);
    const relic = `Relic of the ${LEGENDARY[id].name}`;
    if (o?.profile && !o.profile.trophies.includes(relic)) {
      o.profile.trophies.push(relic);
      game.sendTo(o, { t: 'toast', msg: `A relic of the ${LEGENDARY[id].name} — you were there when she went down.`, kind: 'gold' });
    }
  }
  const text = `SUNKEN GLORY: the ${LEGENDARY[id].name} has gone down at ${Math.round(ship.state.x / 1000)} km E, ${Math.round(ship.state.y / 1000)} km S. Her captain must raise her.`;
  for (const p of game.world.ports) game.addRumor(p.x, p.y, text);
  for (const o of game.sessions) {
    game.sendTo(o, { t: 'toast', msg: `WORLD: ${text}`, kind: 'bad' });
    sendEvents(game, o);
  }
  // She is not lost; she is on the bottom. Her captain goes on in a hired sloop until they raise her.
  const p = s.profile!;
  const sloop = { classId: 'sloop' as const, name: 'Hired Sloop', guns: { port: 'light_6' as const, starboard: 'light_6' as const }, modules: {} };
  ship.loadout = sloop;
  p.loadout = sloop;
  ship.recompute(game.now);
}

/** At the wreck: her captain raises her (boats and chains; L). She goes to Wrecktide to be made whole. */
export function raiseLegend(game: Game, s: PlayerSession): string | null | undefined {
  const ship = s.ship!;
  const st = store(game);
  for (const id of LEGENDARY_IDS) {
    const rec = st[id];
    if (rec.status !== 'sunk' || !rec.wreck || dist(rec.wreck.x, rec.wreck.y, ship.state.x, ship.state.y) > RAISE_RANGE) continue;
    if (rec.owner !== s.accountId) return `Only ${rec.ownerName ?? 'her captain'} can raise the ${LEGENDARY[id].name}`;
    if (ship.state.speed > 2) return 'Heave to over the wreck first';
    rec.status = 'owned';
    rec.wreck = undefined;
    rec.lastActive = game.wallNow();
    save(game, st);
    s.profile!.berths = s.profile!.berths.filter((b) => b.loadout.legendary !== id);
    s.profile!.berths.push({ port: 'wrecktide', loadout: loadoutOf(id), hull: 0.3 });
    game.grantXp(s, bossXp(s.profile!.level, 1500), `Raised the ${LEGENDARY[id].name}`);
    game.sendTo(s, { t: 'toast', msg: `Chains and prayers: the ${LEGENDARY[id].name} comes up. She is towed to Wrecktide, where she waits in a berth.`, kind: 'gold' });
    for (const p of game.world.ports) game.addRumor(p.x, p.y, `The ${LEGENDARY[id].name} has been raised by ${s.name}.`);
    for (const o of game.sessions) sendEvents(game, o);
    return null;
  }
  return undefined;
}

/** A legendary wreck within reach, for the landing prompt. */
export function legendWreckHere(game: Game, ship: ShipEntity): { id: LegendaryId; owner?: string } | null {
  const st = game.db.getKv<Record<LegendaryId, LegendRecord>>('legendary_ships');
  if (!st) return null;
  for (const id of LEGENDARY_IDS) {
    const rec = st[id];
    if (rec?.status === 'sunk' && rec.wreck && dist(rec.wreck.x, rec.wreck.y, ship.state.x, ship.state.y) < RAISE_RANGE) return { id, owner: rec.ownerName };
  }
  return null;
}

/** The gifts and prices that act at sea (the rest are stat modifiers). */
export function legendarySecond(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  const p = s.profile;
  if (!ship || !p || ship.docked || !ship.loadout.legendary) return;
  const now = game.now;
  switch (ship.loadout.legendary) {
    case 'saint_maws_bell':
      if (ship.region === 'black_coast' && (ship.talentReady.bellHate ?? 0) <= now) {
        ship.talentReady.bellHate = now + 360;
        game.adjustRep(ship, 'crown', -1);
      }
      break;
    case 'crowns_sorrow':
      if ((ship.talentReady.sorrow ?? 0) <= now) {
        ship.talentReady.sorrow = now + 600;
        ship.morale = Math.max(0, ship.morale - 1);
      }
      // The ships in her line reload faster.
      game.forShipsNear(ship.state.x, ship.state.y, 400, (o) => {
        if (o.id === ship.id || !o.alive || !(o.ownerId === ship.id || game.areAllies(o, ship))) return;
        o.addEffect({ id: 'sorrow_line', until: now + 2, mods: { reloadMul: -0.05 } }, now);
      });
      break;
    case 'widows_lament': {
      const w = game.weatherOf(ship);
      if (w === 'storm' || w === 'black_storm') ship.addEffect({ id: 'lament_gale', until: now + 2, mods: { maxSpeed: 0.1 } }, now);
      break;
    }
  }
}

/** Legendary wrecks still marked for the sea (48 hours of Sunken Glory). */
export function glories(game: Game): { name: string; x: number; y: number; endsIn: number }[] {
  const st = game.db.getKv<Record<LegendaryId, LegendRecord>>('legendary_ships');
  if (!st) return [];
  const out: { name: string; x: number; y: number; endsIn: number }[] = [];
  for (const id of LEGENDARY_IDS) {
    const w = st[id]?.status === 'sunk' ? st[id].wreck : undefined;
    const left = w ? w.at + GLORY_MS - game.wallNow() : 0;
    if (w && left > 0) out.push({ name: LEGENDARY[id].name, x: w.x, y: w.y, endsIn: Math.round(left / 1000) });
  }
  return out;
}

export function legendaryViews(game: Game, s: PlayerSession): LegendaryView[] {
  const st = store(game);
  const docked = s.ship?.docked ?? null;
  return LEGENDARY_IDS.map((id) => {
    const def = LEGENDARY[id];
    const rec = st[id];
    const top = Object.values(rec.contrib).sort((a, b) => b.value - a.value).slice(0, 3);
    return {
      id, name: def.name, base: SHIP_CLASSES[def.base].name, boss: def.boss, port: game.portById(def.port)?.name ?? def.port, status: rec.status,
      owner: rec.ownerName, gift: def.gift, price: def.price,
      need: (Object.entries(def.need) as [GoodId, number][]).map(([g, n]) => ({ good: GOODS[g].name, have: rec.delivered[g] ?? 0, need: n })),
      leaders: top.map((c) => ({ name: c.name, value: Math.round(c.value) })), mine: Math.round(rec.contrib[s.accountId]?.value ?? 0),
      canDeliver: rec.status === 'commission' && docked === def.port,
      wreck: rec.status === 'sunk' && rec.wreck && game.wallNow() - rec.wreck.at < GLORY_MS ? { x: rec.wreck.x, y: rec.wreck.y } : undefined,
    };
  });
}
