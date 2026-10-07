// Any island for one's own, its waters' terms, and the pirates who come for a fat store (docs/15_PERSONAL_ISLAND.md,
// items 6–7; the numbers in shared/src/data/baseclaim.ts). The claim itself is estate.ts's buyIsland (any wild island
// now, priced by its size and waters); here are the rest: the week's tax to the waters' ruling faction (unpaid, the
// buildings weather), moving house (half back, a wait before the next), robbers in lawless water (the outposts'
// rules: the black flag, five minutes ashore, the owner warned, the island's guns on them), and raids — rolled by
// the hour on a fat island outside safe water, ten minutes' warning (toast and letter) while their ships lie off the
// island for the owner to fight, then reckoned against the island's batteries, fort and her own ships lying there.
// A raid lost takes a share of the yard and store (capped a day) and weathers a building; one beaten pays.

import {
  ABANDON_COOLDOWN_H, ABANDON_REFUND, AWAY_H, AWAY_MUL, ISLE_RAID_MIN, LOSS_DAY_CAP, RAID_COOLDOWN_H, RAID_LOSS, RAID_WEATHER, ROB_ISLE_COOLDOWN_H, ROB_ISLE_SEC,
  ROB_ISLE_SHARE, TAX_DAYS, TAX_WEATHER, WATERS, claimPrice, fatMark, isleDefence, isleTax, raidOdds, raidPrize, raidStrength,
} from '../../../shared/src/data/baseclaim.ts';
import type { Waters } from '../../../shared/src/data/baseclaim.ts';
import { nextOwnLevel, ownXpNext } from '../../../shared/src/data/baseships.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { RENT, islandSize } from '../../../shared/src/data/holdings.ts';
import { clampLevel, watersBand } from '../../../shared/src/data/shiplevel.ts';
import type { ClaimTermsView, IsleClaimView, PrivateState } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { capOf } from './base.ts';
import { caravans } from './caravans.ts';
import { outposts, ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { has, island, islandNear, mayUse } from './holdings.ts';
import type { Holding } from './holdings.ts';
import { spawnPirate } from './npc.ts';
import { changeRep } from './player.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import { flying, hasPennant, neutral } from './pvp.ts';
import { lairIsland } from './wanted.ts';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface IsleRaid {
  /** Wall ms: when they land. */
  until: number;
  start: number;
  /** Their ships lying off the island (none when the owner was away: then it is reckoned on the clock). */
  ships: number[];
  x: number;
  y: number;
  strength: number;
}

export interface IsleClaim {
  /** What was paid for it (half comes back when it is abandoned). */
  paid: number;
  /** The next week's tax falls due (wall ms); weeks unpaid in a row. */
  taxAt: number;
  unpaid: number;
  raid: IsleRaid | null;
  lastRoll: number;
  /** No raid before (wall ms). */
  calmUntil: number;
  /** The share of the island lost on this UTC day (raids and robbers together). */
  lossDay: number;
  lossShare: number;
  /** The owner last seen at sea (wall ms). */
  seen: number;
  robbedAt: number;
}

interface ClaimState {
  rng: Rng;
  robbing: Map<number, { island: number; until: number }>;
}

const states = new WeakMap<Game, ClaimState>();

function cs(game: Game): ClaimState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { rng: new Rng(game.world.seed ^ 0x15c1a1), robbing: new Map() }));
  return s;
}

export function watersOf(isl: Island): Waters {
  return REGIONS[isl.region].safety as Waters;
}

/** A fresh claim (a new island, or one bought before claims were kept). */
export function newClaim(game: Game, paid: number): IsleClaim {
  const wall = game.wallNow();
  return { paid, taxAt: wall + TAX_DAYS * DAY, unpaid: 0, raid: null, lastRoll: wall, calmUntil: wall + RAID_COOLDOWN_H * HOUR, lossDay: Math.floor(wall / DAY), lossShare: 0, seen: wall, robbedAt: 0 };
}

export function claimOf(game: Game, h: Holding): IsleClaim {
  if (!h.claim) {
    const isl = island(game, h.island);
    h.claim = newClaim(game, isl ? claimPrice(islandSize(isl.radius), watersOf(isl)) : 0);
    game.holdings.touch();
  }
  const c = h.claim;
  const day = Math.floor(game.wallNow() / DAY);
  if (c.lossDay !== day) {
    c.lossDay = day;
    c.lossShare = 0;
  }
  return c;
}

// ------------------------------------------------------------------------------------------------ claiming

/** Why this island may not be claimed as anyone's own (null: it may) — apart from the captain's own affairs. */
export function claimBlock(game: Game, isl: Island, account: number): string | null {
  if (isl.portId) return 'Port islands are not for rent';
  if (isl.region === 'the_abyss') return 'Nobody claims land in the Abyss.';
  const cur = game.holdings.get(game, isl.id);
  if (cur && !mayUse(game, cur, account)) return `${isl.name} is held by ${cur.owner.name}.`;
  if (cur?.owned) return 'Your island is at its greatest.';
  if (Object.values(outposts(game)).some((o) => o.island === isl.id)) return 'Someone already works this island.';
  if (lairIsland(game, isl.id)) return 'A pirate captain keeps his lair on that island.';
  return null;
}

/** Why this captain may not claim it now (null: she may): the island, then her own island and her wait. */
export function claimWhy(game: Game, s: PlayerSession, isl: Island): string | null {
  const block = claimBlock(game, isl, s.accountId);
  if (block) return block;
  const mine = Object.values(game.holdings.map(game)).find((h) => h.owner.kind === 'player' && h.owner.id === s.accountId);
  if (mine && mine.island !== isl.id) return 'A captain may hold one island of their own';
  const wait = (s.profile!.isleLeftAt ?? -1e15) + ABANDON_COOLDOWN_H * HOUR - game.wallNow();
  if (wait > 0) return `You may claim another island in ${Math.ceil(wait / HOUR)} h.`;
  return null;
}

/** A lease of her own still to run, counted off the price (a lease bought out). */
export function leaseCredit(game: Game, s: PlayerSession, isl: Island, price: number): number {
  const cur = game.holdings.get(game, isl.id);
  if (!cur || cur.owned || !mayUse(game, cur, s.accountId)) return 0;
  const left = Math.round(Math.max(0, cur.until - game.wallNow()) / DAY / 30 * RENT[islandSize(isl.radius)][30]);
  return Math.min(Math.round(price * 0.6), left);
}

export function claimTerms(game: Game, s: PlayerSession, isl: Island): ClaimTermsView {
  const w = watersOf(isl);
  const t = WATERS[w];
  const price = claimPrice(islandSize(isl.radius), w);
  const credit = leaseCredit(game, s, isl, price);
  return {
    island: isl.id, name: isl.name, region: isl.region, waters: w, size: islandSize(isl.radius), price: price - credit, credit, tax: t.tax, faction: game.holdings.factionOf(game, isl.region),
    raidDay: t.raidDay, raidMul: t.raidMul, raiders: t.raiders, robbable: t.robbable, refund: ABANDON_REFUND, cooldownH: ABANDON_COOLDOWN_H, why: claimWhy(game, s, isl),
  };
}

/** The wild island off her bow she could claim (for the prompt), if she has none of her own. */
export function claimPrompt(game: Game, s: PlayerSession): PrivateState['claimIsle'] {
  const ship = s.ship;
  if (!ship || ship.docked || ownIsland(game, s.accountId)) return null;
  const isl = islandNear(game, ship);
  if (!isl || claimWhy(game, s, isl)) return null;
  const t = claimTerms(game, s, isl);
  return { island: isl.id, name: isl.name, price: t.price, waters: t.waters };
}

/** Moving house: the island given up, half its price back, and a wait before the next. */
export function abandonIsland(game: Game, s: PlayerSession): string | null {
  const h = ownIsland(game, s.accountId);
  if (!h) return 'You have no island of your own.';
  const c = claimOf(game, h);
  if (c.raid) return 'Not while raiders lie off the island.';
  if ((h.yard?.ships ?? []).some((x) => x.state === 'sea')) return 'Bring your own ships home to the island first.';
  if (Object.values(caravans(game)).some((k) => k.owner === s.accountId)) return 'Bring your caravans home and pay them off first.';
  const p = s.profile!;
  if (p.berths.some((b) => b.port === `isle:${h.island}`)) return 'Take the ships berthed at the island away first.';
  const isl = island(game, h.island)!;
  const refund = Math.round(c.paid * ABANDON_REFUND);
  p.gold += refund;
  game.db.ledger(s.accountId, 'island_abandon', refund, String(h.island));
  delete game.holdings.map(game)[h.island];
  game.holdings.touch();
  p.isleLeftAt = game.wallNow();
  game.sendTo(s, { t: 'toast', msg: `${isl.name} is given up: ${refund} silver comes back to you. Another island may be claimed in ${ABANDON_COOLDOWN_H} h.`, kind: 'info' });
  return null;
}

// ------------------------------------------------------------------------------------------------ worth and defence

/** What the island's yard and store are worth (the raiders' reckoning). */
export function isleWorth(h: Holding): number {
  let v = 0;
  for (const bag of [h.yard?.res ?? {}, h.store]) for (const [g, n] of Object.entries(bag) as [GoodId, number][]) v += (n ?? 0) * (GOODS[g]?.basePrice ?? 0);
  return Math.round(v);
}

/** Her own ships lying at the island, whole enough to fight (not at sea with her, not laid up or on the slipway). */
function shipsAtHome(h: Holding): { level: number; hull: number }[] {
  return (h.yard?.ships ?? []).filter((x) => x.state === 'home' && x.hull > 0.2).map((x) => ({ level: x.level, hull: x.hull }));
}

export function defenceOf(h: Holding): { rating: number; batteries: number; forts: number; ships: number } {
  const guns = (id: 'battery' | 'fort') => h.buildings.filter((b) => b.id === id).map((b) => ({ level: Math.max(1, b.level ?? 1), condition: b.condition * (b.unpaid ? 0.5 : 1) }));
  const batteries = guns('battery'), forts = guns('fort'), ships = shipsAtHome(h);
  return { rating: isleDefence({ batteries, forts, ships }), batteries: batteries.length, forts: forts.length, ships: ships.length };
}

// ------------------------------------------------------------------------------------------------ the calendar

function mail(game: Game, h: Holding, subject: string, body: string, kind: 'bad' | 'good' | 'info' = 'bad'): void {
  if (h.owner.kind !== 'player') return;
  const s = game.sessionByAccount(h.owner.id);
  if (s) game.sendTo(s, { t: 'toast', msg: subject, kind });
  deliver(game, h.owner.id, { from: 'The island watch', subject, body, gold: 0, goods: null });
}

/** Every ten seconds for one's own island: the owner seen, the week's tax, a raid rolled, landed or beaten. */
export function stepIsleClaim(game: Game, h: Holding): void {
  if (!h.owned || h.owner.kind !== 'player') return;
  const isl = island(game, h.island);
  if (!isl) return;
  const c = claimOf(game, h);
  const wall = game.wallNow();
  if (game.sessionByAccount(h.owner.id)) c.seen = wall;
  stepTax(game, h, isl, c, wall);
  stepRaid(game, h, isl, c, wall);
}

function stepTax(game: Game, h: Holding, isl: Island, c: IsleClaim, wall: number): void {
  for (let k = 0; k < 8 && wall >= c.taxAt; k++) {
    c.taxAt += TAX_DAYS * DAY;
    game.holdings.touch();
    const tax = isleTax(watersOf(isl), h.level ?? 1);
    if (tax <= 0) continue;
    const faction = game.holdings.factionOf(game, isl.region);
    if (h.treasury >= tax) {
      h.treasury -= tax;
      c.unpaid = 0;
      const s = game.sessionByAccount(h.owner.id);
      if (s?.profile) changeRep(s.profile, faction, 1);
      continue;
    }
    c.unpaid++;
    for (const b of h.buildings) b.condition = Math.max(0.05, b.condition - TAX_WEATHER);
    mail(game, h, `${isl.name}: the week’s tax is unpaid`, `The harbour office asked ${tax} silver of the island’s treasury and found ${h.treasury}. Its buildings weather for want of the harbour’s goodwill; put silver in the treasury.`);
  }
}

/** A raid's chance by the hour (0: none can come now). */
export function raidChance(game: Game, h: Holding, hours = 1): number {
  const isl = island(game, h.island);
  if (!isl || !h.owned) return 0;
  const w = watersOf(isl);
  const c = claimOf(game, h);
  const wall = game.wallNow();
  if (!WATERS[w].raidDay || c.raid || wall < c.calmUntil || c.lossShare >= LOSS_DAY_CAP) return 0;
  const worth = isleWorth(h), mark = fatMark(h.level ?? 1);
  if (worth < mark) return 0;
  const away = wall - c.seen > AWAY_H * HOUR ? AWAY_MUL : 1;
  return (WATERS[w].raidDay / 24) * hours * Math.min(2, worth / mark) * away;
}

function stepRaid(game: Game, h: Holding, isl: Island, c: IsleClaim, wall: number): void {
  if (c.raid) return settleRaid(game, h, isl, c, wall);
  const hours = (wall - c.lastRoll) / HOUR;
  if (hours < 1) return;
  c.lastRoll = wall;
  game.holdings.touch();
  if (!game.directorOn) return;
  const chance = raidChance(game, h, hours);
  if (chance > 0 && cs(game).rng.chance(Math.min(0.9, chance))) startIsleRaid(game, h);
}

/** Pirates for the island: ten minutes' warning (fifteen with a signal tower); their ships off the island when the
 *  owner is at sea in these waters to come and fight them. */
export function startIsleRaid(game: Game, h: Holding): string | null {
  const isl = island(game, h.island);
  if (!isl || !h.owned || h.owner.kind !== 'player') return 'You have no island of your own.';
  const w = watersOf(isl);
  if (!WATERS[w].raidDay) return 'Safe water: the Crown’s patrols keep raiders off the island.';
  const c = claimOf(game, h);
  if (c.raid) return 'Raiders already lie off the island.';
  const S = cs(game);
  const mins = ISLE_RAID_MIN + (has(h, 'signal_tower') ? 5 : 0);
  let x = isl.x, y = isl.y - isl.radius - 400;
  const a0 = S.rng.float() * Math.PI * 2;
  for (let k = 0; k < 24; k++) {
    const a = a0 + (k / 24) * Math.PI * 2;
    const px = isl.x + Math.sin(a) * (isl.radius + 400), py = isl.y - Math.cos(a) * (isl.radius + 400);
    if (!isLand(game.world, px, py)) {
      x = px;
      y = py;
      break;
    }
  }
  const ships: number[] = [];
  const owner = game.sessionByAccount(h.owner.id);
  if (owner && game.inZone(x, y) && !isLand(game.world, x, y)) {
    const band = watersBand(w);
    const level = Math.min(band[1], band[0] + Math.floor((h.level ?? 1) / 3));
    for (let i = 0; i < WATERS[w].raiders; i++) {
      let sp = null;
      for (let k = 0; k < 8 && !sp; k++) sp = spawnPirate(game);
      if (!sp) break;
      game.setNpcLevel(sp, clampLevel(sp.loadout.classId, level));
      sp.state.x = x + (i - 1) * 90;
      sp.state.y = y + (i % 2) * 70;
      sp.region = isl.region;
      game.grid.upsert(sp.id, sp.state.x, sp.state.y);
      const b = game.npcs.get(sp.id);
      if (b) {
        b.area = { x: isl.x, y: isl.y, r: isl.radius + 1500 };
        b.expiresAt = game.now + mins * 60 + 120;
      }
      ships.push(sp.id);
    }
  }
  const wall = game.wallNow();
  c.raid = { until: wall + mins * 60_000, start: wall, ships, x: Math.round(x), y: Math.round(y), strength: raidStrength(w, h.level ?? 1) };
  game.holdings.touch();
  mail(game, h, `Pirates are making for ${isl.name} — ${mins} minutes before they land!`, `The watch has sighted raiders standing in for ${isl.name}: its yard and store are worth their while. Sail and fight them within ${mins} minutes, or the island’s batteries, fort and your own ships lying there must hold them off.`);
  if (owner) game.pushSelf(owner, true);
  return null;
}

function removeRaiders(game: Game, r: IsleRaid): void {
  for (const id of r.ships) if (game.ships.get(id)) game.removeShip(id);
}

function settleRaid(game: Game, h: Holding, isl: Island, c: IsleClaim, wall: number): void {
  const r = c.raid!;
  const alive = r.ships.filter((id) => {
    const o = game.ships.get(id);
    return !!o && o.alive && !o.sinkingUntil;
  });
  const owner = game.sessionByAccount(h.owner.id);
  if (r.ships.length && !alive.length) {
    // Driven off: every raider sunk or taken before they landed.
    c.raid = null;
    c.calmUntil = wall + RAID_COOLDOWN_H * HOUR;
    win(game, h, isl, true);
    if (owner) game.pushSelf(owner, true);
    return;
  }
  if (wall < r.until) return;
  removeRaiders(game, r);
  c.raid = null;
  c.calmUntil = wall + RAID_COOLDOWN_H * HOUR;
  game.holdings.touch();
  const odds = raidOdds(defenceOf(h).rating, r.strength, r.ships.length ? alive.length / r.ships.length : 1);
  if (cs(game).rng.chance(odds)) win(game, h, isl, false);
  else lose(game, h, isl, c);
  if (owner) game.pushSelf(owner, true);
}

function win(game: Game, h: Holding, isl: Island, fought: boolean): void {
  const lvl = h.level ?? 1;
  const prize = raidPrize(watersOf(isl), lvl);
  const owner = game.sessionByAccount(h.owner.id);
  // She fought them (or her guns did while she lay by): the plunder to her purse; else to the island's treasury.
  const by = owner?.ship && !owner.ship.docked && Math.hypot(owner.ship.state.x - isl.x, owner.ship.state.y - isl.y) - isl.radius < 4000;
  fought = fought && !!by;
  if (fought && owner?.profile) owner.profile.gold += prize.silver;
  else h.treasury += prize.silver;
  const y = h.yard;
  if (y) {
    const cap = capOf(h);
    y.res.iron = Math.min(Math.max(cap, y.res.iron ?? 0), (y.res.iron ?? 0) + prize.iron);
    y.res.tar = Math.min(Math.max(cap, y.res.tar ?? 0), (y.res.tar ?? 0) + prize.tar);
    for (const x of y.ships ?? []) {
      if (x.state !== 'home' || nextOwnLevel(x.role, x.level) === null) continue;
      x.xp = Math.min(ownXpNext(x.level), x.xp + prize.xp);
    }
  }
  game.holdings.touch();
  const where = fought ? 'your purse' : 'the island’s treasury';
  mail(game, h, fought ? `The raiders off ${isl.name} are beaten! ${prize.silver} silver of their plunder is yours.` : `${isl.name} held: the island’s guns and ships beat the raiders off.`,
    `The raiders are beaten off ${isl.name}. Their plunder — ${prize.silver} silver to ${where}, ${prize.iron} iron and ${prize.tar} tar from their wrecks to the yard — is the island’s, and your own ships lying there are the more seasoned for it.`, 'good');
}

function lose(game: Game, h: Holding, isl: Island, c: IsleClaim): void {
  const S = cs(game);
  const share = Math.max(0, Math.min(S.rng.range(RAID_LOSS[0], RAID_LOSS[1]), LOSS_DAY_CAP - c.lossShare));
  let lost = 0;
  for (const bag of [h.yard?.res, h.store]) {
    if (!bag) continue;
    for (const g of Object.keys(bag) as GoodId[]) {
      const n = bag[g] ?? 0;
      const k = Math.floor(n * share);
      if (k <= 0) continue;
      bag[g] = n - k;
      if (!bag[g]) delete bag[g];
      lost += k;
    }
  }
  c.lossShare += share;
  const standing = h.buildings.filter((b) => b.condition > 0.1);
  const hit = standing.length ? standing[S.rng.int(0, standing.length - 1)] : null;
  if (hit) hit.condition = Math.max(0.05, hit.condition - RAID_WEATHER);
  game.holdings.touch();
  const body = hit
    ? `Nobody came in time and the island could not hold them. The raiders carried off ${lost} units from ${isl.name} and set a building afire. Batteries, a fort and your own ships lying at the island make the next raid a harder landing.`
    : `Nobody came in time and the island could not hold them. The raiders carried off ${lost} units from ${isl.name}. Batteries, a fort and your own ships lying at the island make the next raid a harder landing.`;
  mail(game, h, `Raiders landed on ${isl.name}: ${Math.round(share * 100)}% of its yard and store is gone.`, body);
}

// ------------------------------------------------------------------------------------------------ robbers

/** A captain flying the black flag in lawless water lands on someone's island: five minutes ashore, the owner
 *  warned, the island's guns on him. */
export function robIsland(game: Game, s: PlayerSession, islandId: number): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !h.owned || h.owner.kind !== 'player') return 'No such island';
  const why = robWhy(game, s, h, isl);
  if (why) return why;
  const ship = s.ship!;
  cs(game).robbing.set(s.accountId, { island: isl.id, until: game.now + ROB_ISLE_SEC });
  let m = game.holdings.aggressors.get(isl.id);
  if (!m) game.holdings.aggressors.set(isl.id, (m = new Map()));
  m.set(ship.id, game.now + 600);
  mail(game, h, `${s.name} has landed on ${isl.name} to rob it!`, `${s.name} flies the black flag and has landed on ${isl.name}. Five minutes and a quarter of the yard is theirs — the island’s guns are on them; come and drive them off.`);
  return null;
}

function robWhy(game: Game, s: PlayerSession, h: Holding, isl: Island): string | null {
  if (h.owner.id === s.accountId) return 'That island is your own.';
  if (!WATERS[watersOf(isl)].robbable) return 'An island is robbed only in lawless waters.';
  const p = s.profile!;
  if (!flying(p)) return 'Hoist the black flag to rob a captain’s island.';
  const owner = game.sessionByAccount(h.owner.id);
  if (owner?.profile && hasPennant(game, owner.profile)) return 'Its captain sails under the Green Pennant.';
  if (owner?.profile && neutral(owner.profile)) return 'Its captain sails under neutral colours.'; // docs/24 D1
  const ship = s.ship!;
  if (islandNear(game, ship)?.id !== isl.id || ship.state.speed > 1.5) return 'Heave to off the island first.';
  const c = claimOf(game, h);
  if (game.wallNow() - c.robbedAt < ROB_ISLE_COOLDOWN_H * HOUR || c.lossShare >= LOSS_DAY_CAP) return 'The island was stripped lately: nothing worth the landing.';
  if (cs(game).robbing.has(s.accountId)) return 'Your landing party is already ashore.';
  return null;
}

/** Robbers ashore (every ten seconds): still off the island and stopped, and their five minutes done. */
export function stepIsleRobbers(game: Game): void {
  const S = cs(game);
  for (const [acc, r] of [...S.robbing]) {
    const s = game.sessionByAccount(acc);
    const h = game.holdings.get(game, r.island);
    const ship = s?.ship;
    if (!s || !ship || !h || !h.owned || !ship.alive || islandNear(game, ship)?.id !== r.island || ship.state.speed > 1.5) {
      S.robbing.delete(acc);
      continue;
    }
    if (game.now < r.until) continue;
    S.robbing.delete(acc);
    const c = claimOf(game, h);
    const share = Math.min(ROB_ISLE_SHARE, Math.max(0, LOSS_DAY_CAP - c.lossShare));
    let n = 0;
    for (const [g, k] of Object.entries(h.yard?.res ?? {}) as [GoodId, number][]) {
      const room = Math.floor((ship.stats.holdVolume - cargoVolume(ship.cargo)) / GOODS[g].volume);
      const take = Math.max(0, Math.min(Math.floor(k * share), room));
      if (take <= 0) continue;
      ship.cargo[g] = (ship.cargo[g] ?? 0) + take;
      h.yard!.res[g] = k - take;
      n += take;
    }
    c.lossShare += share;
    c.robbedAt = game.wallNow();
    s.profile!.infamy += 10;
    game.holdings.touch();
    const isl = island(game, r.island)!;
    game.sendTo(s, { t: 'toast', msg: `The yard of ${h.owner.name}’s island is yours: ${n} units.`, kind: 'gold' });
    mail(game, h, `${s.name} robbed ${isl.name}: ${n} units of the yard are gone.`, `${s.name} stayed ashore their five minutes and carried off ${n} units of the yard of ${isl.name}.`);
  }
}

/** Another captain's island off the bow (for the Company's card). */
export function robView(game: Game, s: PlayerSession): { island: number; name: string; owner: string; why: string | null; robbing: number | null } | null {
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  const isl = islandNear(game, ship);
  const h = isl ? game.holdings.get(game, isl.id) : undefined;
  if (!isl || !h || !h.owned || h.owner.kind !== 'player' || h.owner.id === s.accountId || !WATERS[watersOf(isl)].robbable) return null;
  const r = cs(game).robbing.get(s.accountId);
  return { island: isl.id, name: isl.name, owner: h.owner.name, why: r ? null : robWhy(game, s, h, isl), robbing: r && r.island === isl.id ? Math.max(0, Math.ceil(r.until - game.now)) : null };
}

// ------------------------------------------------------------------------------------------------ what she sees

export function claimView(game: Game, s: PlayerSession, h: Holding): IsleClaimView {
  const isl = island(game, h.island)!;
  const w = watersOf(isl);
  const c = claimOf(game, h);
  const d = defenceOf(h);
  const lvl = h.level ?? 1;
  const r = c.raid;
  const strength = r ? r.strength : raidStrength(w, lvl);
  const alive = r ? r.ships.filter((id) => game.ships.get(id)?.alive).length : 0;
  let abandonWhy: string | null = null;
  if (r) abandonWhy = 'Not while raiders lie off the island.';
  else if ((h.yard?.ships ?? []).some((x) => x.state === 'sea')) abandonWhy = 'Bring your own ships home to the island first.';
  else if (Object.values(caravans(game)).some((k) => k.owner === s.accountId)) abandonWhy = 'Bring your caravans home and pay them off first.';
  else if (s.profile!.berths.some((b) => b.port === `isle:${h.island}`)) abandonWhy = 'Take the ships berthed at the island away first.';
  return {
    waters: w, region: isl.region, faction: game.holdings.factionOf(game, isl.region), tax: isleTax(w, lvl), taxAt: c.taxAt, unpaid: c.unpaid, treasury: h.treasury,
    defence: d.rating, batteries: d.batteries, forts: d.forts, ships: d.ships, strength, odds: strength > 0 ? Math.round(raidOdds(d.rating, strength, r && r.ships.length ? alive / r.ships.length : 1) * 100) / 100 : 1,
    worth: isleWorth(h), fat: fatMark(lvl), calmUntil: c.calmUntil, lost: Math.round(c.lossShare * 100) / 100, lossCap: LOSS_DAY_CAP,
    raid: r ? { until: r.until, x: r.x, y: r.y, ships: r.ships.length, alive, strength: r.strength } : null,
    refund: Math.round(c.paid * ABANDON_REFUND), abandonWhy,
  };
}

/** Raiders at her island, for the HUD's «Now:» (world seconds). */
export function raidPointer(game: Game, s: PlayerSession): PrivateState['isleRaid'] {
  const h = ownIsland(game, s.accountId);
  const r = h?.claim?.raid;
  if (!h || !r) return null;
  const left = Math.max(0, (r.until - game.wallNow()) / 1000);
  return { x: r.x, y: r.y, until: Math.round(game.now + left), name: island(game, h.island)?.name ?? '' };
}

/** For the tests and the admin: the raid's clock run out now. */
export function raidNow(game: Game, h: Holding): void {
  if (h.claim?.raid) h.claim.raid.until = Math.min(h.claim.raid.until, game.wallNow());
}

export function clearClaims(game: Game): void {
  cs(game).robbing.clear();
}
