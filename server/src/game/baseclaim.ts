// Any island for one's own, its waters' terms, and the pirates who come for a fat store (docs/15_PERSONAL_ISLAND.md,
// items 6–7; the numbers in shared/src/data/baseclaim.ts). The claim itself is estate.ts's buyIsland (any wild island
// now, priced by its size and waters); here are the rest: the week's tax to the waters' ruling faction (unpaid, the
// buildings weather), moving house (half back, a wait before the next), robbers in lawless water (the outposts'
// rules: the black flag, five minutes ashore, the owner warned, the island's guns on them), and raids — rolled by
// the hour on a fat island outside safe water, ten minutes' warning (toast and letter) while their ships lie off the
// island for the owner to fight, then reckoned against the island's batteries, fort and her own ships lying there.
// A raid lost takes a share of the yard and store (capped a day) and weathers a building; one beaten pays.

import { lackMore } from '../../../shared/src/data/buyfail.ts';
import { notifyAway } from './tgnotify.ts'; // the Telegram notices (owner, 2026-10-16)
import { hasMoveCharter, shielded, spendMoveCharter } from './shop.ts'; // the premium shop (owner, 2026-10-15)
import {
  ABANDON_COOLDOWN_H, ABANDON_REFUND, AWAY_H, AWAY_MUL, ISLE_RAID_MIN, LOSS_DAY_CAP, RAID_COOLDOWN_H, RAID_LOSS, RAID_WEATHER, ROB_ISLE_COOLDOWN_H, ROB_ISLE_SEC,
  ROB_ISLE_SHARE, TAX_DAYS, TAX_WEATHER, WATERS, claimPrice, fatMark, isleDefence, isleTax, raidOdds, raidPrize, raidStrength,
} from '../../../shared/src/data/baseclaim.ts';
import type { Waters } from '../../../shared/src/data/baseclaim.ts';
import { nextOwnLevel, ownXpNext } from '../../../shared/src/data/baseships.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { islandSize } from '../../../shared/src/data/holdings.ts';
import { FREE_MOVES, MOVE_DOUBLOONS, MOVE_SILVER } from '../../../shared/src/data/isletree.ts';
import { clampLevel, watersBand } from '../../../shared/src/data/shiplevel.ts';
import type { ClaimTermsView, IsleClaimView, IsleMoveView, PrivateState } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { capOf } from './base.ts';
import { caravans } from './caravans.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { caravanExtra, coveHide, forgeReach, residentRooms, signalMins, signalRisk, trophyCap } from '../../../shared/src/data/baselevels.ts';
import { has, island, islandNear, levelOf, newOwnHolding, ownKey } from './holdings.ts';
import type { Holding } from './holdings.ts';
import { spawnPirate } from './npc.ts';
import { changeRep } from './player.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import { flying, hasPennant, neutral } from './pvp.ts';
import { sendBalance } from './premium.ts';
import { sagaNote } from './saga.ts';
import { lairOnIsland } from './wanted.ts';

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
  robbing: Map<number, { island: number; owner: number; until: number }>;
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

// docs/29 (owner, 2026-10-11): «Занять остров можно сразу и без ограничений и разных цен … Один остров могут занимать
// разные капитаны … у капитана может быть только 1 активный остров, если он меняет его то все постройки с предыдущего
// сносятся, но 1 раз это можно сделать бесплатно … далее только за дублоны и очень много». Any island that is not a
// port's may be claimed at once, free, by any number of captains — each her own base on it. A captain holds one island:
// claiming another is a move, which pulls down every building on the old one (the first move free, then a million
// silver or 2 600 doubloons: isletree.ts MOVE_*). Her treasury, her yard's and store's goods, her residents and her own
// ships go with her; the buildings, the producers, the town and the work under way stay behind as rubble.

/** Why this island may not be claimed by anyone (null: it may). */
export function claimBlock(game: Game, isl: Island, _account?: number): string | null {
  // (a step-9 harbour town stands on its island's coast and leaves the island free: shared/src/world/towns.ts)
  if (isl.portId) return 'Port islands are not for claiming.';
  // a named pirate's fortress holds it: its garrison and battery would sink her at every cast-off (QA 2026-10-22)
  if (lairOnIsland(game, isl.id)) return 'A pirate fortress holds this island: choose another.';
  return null;
}

/** How many islands of her own she has claimed (the saves before docs/29: one, if she held or gave one up). */
export function claimsMade(game: Game, s: PlayerSession): number {
  const p = s.profile!;
  return p.isleClaims ?? (ownIsland(game, s.accountId) || p.isleLeftAt ? 1 : 0);
}

/** What this claim costs her: nothing for her first island and her first move, then the fortune (null: free). */
export function claimFee(game: Game, s: PlayerSession): { silver: number; doubloons: number } | null {
  const made = claimsMade(game, s);
  // A charter of removal bought in the shop (owner, 2026-10-15) makes the move free; claimIsland spends it.
  return made <= FREE_MOVES || hasMoveCharter(game, s.accountId) ? null : { silver: MOVE_SILVER, doubloons: MOVE_DOUBLOONS };
}

/** Why this captain may not claim it now (null: she may) — the island, her ship's place, her own island there. */
export function claimWhy(game: Game, s: PlayerSession, isl: Island): string | null {
  const block = claimBlock(game, isl, s.accountId);
  if (block) return block;
  const own = ownIsland(game, s.accountId);
  if (own && own.island === isl.id) return 'That is your island already.';
  if (own) return moveWhy(game, s, own);
  return null;
}

/** What keeps her from moving off her island now (null: nothing). */
export function moveWhy(game: Game, s: PlayerSession, h: Holding): string | null {
  if (h.claim?.raid) return 'Not while raiders lie off your island.';
  if (Object.values(caravans(game)).some((k) => k.owner === s.accountId)) return 'Bring your caravans home and pay them off first.';
  if (s.profile!.berths.some((b) => b.port === `isle:${h.island}`)) return 'Take the ships berthed at the island away first.';
  return null;
}

/** The ship lies off the island (or in a port of its sea, at the harbour office). */
function atIsland(game: Game, s: PlayerSession, isl: Island): boolean {
  const ship = s.ship;
  if (!ship) return false;
  return ship.docked ? game.portById(ship.docked)?.region === isl.region : islandNear(game, ship)?.id === isl.id;
}

/** What a move pulls down and what goes with her (for the confirm). */
export function moveTerms(game: Game, s: PlayerSession, isl: Island): IsleMoveView | null {
  const h = ownIsland(game, s.accountId);
  if (!h) return null;
  const from = island(game, h.island);
  const town = h.yard?.town?.b ?? {};
  const fee = claimFee(game, s);
  return {
    island: isl.id, name: isl.name, from: h.island, fromName: from?.name ?? '', free: !fee, silver: MOVE_SILVER, doubloons: MOVE_DOUBLOONS,
    gold: Math.floor(s.profile!.gold), balance: game.db.doubloons(s.accountId), moves: Math.max(0, claimsMade(game, s) - 1), freeMoves: FREE_MOVES,
    lose: {
      buildings: h.buildings.length, levels: h.buildings.reduce((a, b) => a + (b.level ?? 1), 0) + Object.values(town).reduce((a, n) => a + (n ?? 0), 0),
      town: Object.values(town).filter((n) => (n ?? 0) > 0).length, producers: h.yard?.producers.length ?? 0, jobs: h.yard?.jobs.length ?? 0,
      hall: town.hall ?? 1,
    },
    keep: { treasury: Math.floor(h.treasury), goods: Math.floor(Object.values(h.yard?.res ?? {}).reduce((a, n) => a + (n ?? 0), 0) + Object.values(h.store).reduce((a, n) => a + (n ?? 0), 0)), residents: h.residents?.length ?? 0, ships: (h.yard?.ships ?? []).filter((x) => x.state !== 'building').length },
    why: claimWhy(game, s, isl),
  };
}

/** Claim an island of her own (docs/29): free and at once — or move to it, when she holds one already: the move asks
 *  her leave first (`pay` unset: the confirm with what is lost goes to her), then pulls the old island's buildings
 *  down; the first move is free, every one after it a million silver or 2 600 doubloons. */
export function claimIsland(game: Game, s: PlayerSession, islandId: number, pay?: string): string | null {
  const isl = island(game, Math.trunc(islandId));
  if (!isl) return 'No such island';
  const block = claimBlock(game, isl);
  if (block) return block;
  if (!atIsland(game, s, isl)) return `Sail to ${isl.name} to claim it.`;
  const why = claimWhy(game, s, isl);
  if (why) return why;
  const p = s.profile!;
  const old = ownIsland(game, s.accountId);
  const made = claimsMade(game, s);
  const fee = claimFee(game, s);
  if (old) {
    // A move: her leave first, with what it pulls down.
    if (pay !== 'free' && pay !== 'silver' && pay !== 'doubloons') {
      const view = moveTerms(game, s, isl);
      if (view) game.sendTo(s, { t: 'isleMove', view });
      return null;
    }
    if (fee && pay === 'free') return `Moving costs ${fee.silver} silver.`;
    if (fee && pay === 'silver' && p.gold < fee.silver) return lackMore(`Moving costs ${fee.silver} silver.`, fee.silver, p.gold);
    if (fee && pay === 'doubloons' && game.db.doubloons(s.accountId) < fee.doubloons) return lackMore(`Moving costs ${fee.doubloons} doubloons.`, fee.doubloons, game.db.doubloons(s.accountId));
  }
  // (a first island after one given up is a move too: the fee, if any, without a confirm of losses)
  if (!old && fee && pay !== 'silver' && pay !== 'doubloons') {
    const view = moveTerms(game, s, isl) ?? freshTerms(game, s, isl, fee);
    game.sendTo(s, { t: 'isleMove', view });
    return null;
  }
  if (fee && pay === 'silver') {
    if (p.gold < fee.silver) return lackMore(`Moving costs ${fee.silver} silver.`, fee.silver, p.gold);
    p.gold -= fee.silver;
    game.db.ledger(s.accountId, 'island_move', -fee.silver, String(isl.id));
  } else if (fee && pay === 'doubloons') {
    let ok = false;
    game.db.transaction(() => {
      const bal = game.db.addDoubloons(s.accountId, -fee.doubloons);
      if (bal === null) return;
      game.db.ledger(s.accountId, 'doubloons_buy', -fee.doubloons, `isle_move:${isl.id}`);
      ok = true;
    });
    if (!ok) return `Moving costs ${fee.doubloons} doubloons.`;
    sendBalance(game, s);
  }
  const wall = game.wallNow();
  const h = newOwnHolding(isl, { id: s.accountId, name: s.name }, wall);
  h.claim = newClaim(game, 0);
  if (old) {
    // What goes with her: the treasury, the goods, the residents (idle on the new island), her own ships afloat.
    h.treasury = old.treasury;
    h.store = { ...old.store };
    h.residents = (old.residents ?? []).map((r) => ({ ...r, at: null }));
    h.visitors = old.visitors;
    const y = h.yard!;
    y.res = { ...(old.yard?.res ?? {}) };
    y.ships = (old.yard?.ships ?? []).filter((x) => x.state !== 'building').map((x) => ({ ...x, state: x.state === 'refit' ? 'home' : x.state }));
    delete game.holdings.map(game)[game.holdings.keyOf(game, old)];
    const was = island(game, old.island);
    game.sendTo(s, { t: 'toast', msg: `Your island moves to ${isl.name}: everything on ${was?.name ?? ''} is pulled down.`, kind: 'info' });
  }
  game.holdings.map(game)[ownKey(s.accountId)] = h;
  game.holdings.touch();
  if (!fee && made > FREE_MOVES) spendMoveCharter(game, s.accountId); // the shop's charter of removal paid the move
  p.isleClaims = made + 1;
  changeRep(p, game.holdings.factionOf(game, isl.region), old ? 0 : 5);
  game.sendTo(s, { t: 'toast', msg: `${isl.name} is yours: the town hall stands on it.`, kind: 'gold' });
  const others = game.holdings.onIsland(game, isl.id).filter((x) => x.owner.id !== s.accountId).length;
  if (others > 0) game.sendTo(s, { t: 'toast', msg: `${others + 1} captains hold their own island here.`, kind: 'info' });
  if (!old) sagaNote(game, s, 'island', [isl.name]); // the saga (docs/12 P10 #20)
  return null;
}

/** The terms of a paid claim with no island to leave (she gave hers up and has used her free move). */
function freshTerms(game: Game, s: PlayerSession, isl: Island, fee: { silver: number; doubloons: number }): IsleMoveView {
  return {
    island: isl.id, name: isl.name, from: -1, fromName: '', free: false, silver: fee.silver, doubloons: fee.doubloons, gold: Math.floor(s.profile!.gold), balance: game.db.doubloons(s.accountId),
    moves: Math.max(0, claimsMade(game, s) - 1), freeMoves: FREE_MOVES, lose: { buildings: 0, levels: 0, town: 0, producers: 0, jobs: 0, hall: 0 }, keep: { treasury: 0, goods: 0, residents: 0, ships: 0 }, why: claimWhy(game, s, isl),
  };
}

export function claimTerms(game: Game, s: PlayerSession, isl: Island): ClaimTermsView {
  const w = watersOf(isl);
  const t = WATERS[w];
  const fee = ownIsland(game, s.accountId) || claimsMade(game, s) > 0 ? claimFee(game, s) : null;
  return {
    island: isl.id, name: isl.name, region: isl.region, waters: w, size: islandSize(isl.radius), price: fee?.silver ?? 0, credit: 0, tax: 0, faction: game.holdings.factionOf(game, isl.region),
    raidDay: t.raidDay, raidMul: t.raidMul, raiders: t.raiders, robbable: t.robbable, refund: 0, cooldownH: 0, why: claimWhy(game, s, isl),
    move: !!ownIsland(game, s.accountId), doubloons: fee?.doubloons ?? 0, others: game.holdings.onIsland(game, isl.id).filter((x) => x.owner.id !== s.accountId).length,
  };
}

/** The island off her bow she could claim (for the prompt), if she has none of her own. */
export function claimPrompt(game: Game, s: PlayerSession): PrivateState['claimIsle'] {
  const ship = s.ship;
  if (!ship || ship.docked || ownIsland(game, s.accountId)) return null;
  const isl = islandNear(game, ship);
  if (!isl || claimWhy(game, s, isl)) return null;
  const t = claimTerms(game, s, isl);
  return { island: isl.id, name: isl.name, price: t.price, waters: t.waters };
}

/** Giving the island up: everything on it is pulled down (her goods and residents are lost with it); the next island
 *  she claims counts as a move. */
export function abandonIsland(game: Game, s: PlayerSession): string | null {
  const h = ownIsland(game, s.accountId);
  if (!h) return 'You have no island of your own.';
  const why = moveWhy(game, s, h);
  if (why) return why;
  if ((h.yard?.ships ?? []).some((x) => x.state === 'sea')) return 'Bring your own ships home to the island first.';
  const p = s.profile!;
  const isl = island(game, h.island)!;
  p.isleClaims = claimsMade(game, s);
  delete game.holdings.map(game)[game.holdings.keyOf(game, h)];
  game.holdings.touch();
  p.isleLeftAt = game.wallNow();
  game.sendTo(s, { t: 'toast', msg: `The island’s free: ${isl.name}.`, kind: 'info' });
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
  // docs/29: no weekly tax any more (the claim is free and so is keeping it); the week's date only runs on.
  if (wall >= c.taxAt) c.taxAt = wall + TAX_DAYS * DAY;
  stepRaid(game, h, isl, c, wall);
}

/** The week's tax before docs/29 (kept for the record: nothing calls it now). */
export function stepTax(game: Game, h: Holding, isl: Island, c: IsleClaim, wall: number): void {
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
  if (h.owner.kind === 'player' && shielded(game, h.owner.id)) return 0; // the shop's charter of protection (owner, 2026-10-15)
  const worth = isleWorth(h), mark = fatMark(h.level ?? 1);
  if (worth < mark) return 0;
  const away = wall - c.seen > AWAY_H * HOUR ? AWAY_MUL : 1;
  // docs/29: a hidden cove's levels keep the raiders' eyes off the island
  const cove = has(h, 'hidden_cove') ? 1 - coveHide(levelOf(h, 'hidden_cove')) : 1;
  return (WATERS[w].raidDay / 24) * hours * Math.min(2, worth / mark) * away * cove;
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
  const mins = ISLE_RAID_MIN + (has(h, 'signal_tower') ? signalMins(levelOf(h, 'signal_tower')) : 0);
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
  if (!owner) notifyAway(game, h.owner.id, 'raid', { mins }); // the bot tells her (owner, 2026-10-16)
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
  const h = robTarget(game, s, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !h.owned || h.owner.kind !== 'player') return 'No such island';
  const why = robWhy(game, s, h, isl);
  if (why) return why;
  const ship = s.ship!;
  cs(game).robbing.set(s.accountId, { island: isl.id, owner: h.owner.id, until: game.now + ROB_ISLE_SEC });
  let m = game.holdings.aggressors.get(isl.id);
  if (!m) game.holdings.aggressors.set(isl.id, (m = new Map()));
  m.set(ship.id, game.now + 600);
  mail(game, h, `${s.name} has landed on ${isl.name} to rob it!`, `${s.name} flies the black flag and has landed on ${isl.name}. Five minutes and a quarter of the yard is theirs — the island’s guns are on them; come and drive them off.`);
  return null;
}

/** The captain's island a robber lands on (docs/29: many may stand on one island): the fattest of the others'. */
function robTarget(game: Game, s: PlayerSession, islandId: number): Holding | undefined {
  return game.holdings.onIsland(game, islandId).filter((h) => h.owner.id !== s.accountId).sort((a, b) => isleWorth(b) - isleWorth(a))[0];
}

function robWhy(game: Game, s: PlayerSession, h: Holding, isl: Island): string | null {
  if (h.owner.id === s.accountId) return 'That island is your own.';
  if (!WATERS[watersOf(isl)].robbable) return 'An island is robbed only in lawless waters.';
  const p = s.profile!;
  if (!flying(p)) return 'Hoist the black flag to rob a captain’s island.';
  const owner = game.sessionByAccount(h.owner.id);
  if (owner?.profile && hasPennant(game, owner.profile)) return 'Its captain sails under the Green Pennant.';
  if (owner?.profile && neutral(owner.profile)) return 'Its captain sails under neutral colours.'; // docs/24 D1
  if (shielded(game, h.owner.id)) return 'Its captain holds a charter of protection: no landing on that island.';
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
    const h = game.holdings.own(game, r.owner);
    const ship = s?.ship;
    if (!s || !ship || !h || !h.owned || h.island !== r.island || !ship.alive || islandNear(game, ship)?.id !== r.island || ship.state.speed > 1.5) {
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
    notifyAway(game, h.owner.id, 'raid', {}, 'n.rob'); // the bot tells her (owner, 2026-10-16)
    mail(game, h, `${s.name} robbed ${isl.name}: ${n} units of the yard are gone.`, `${s.name} stayed ashore their five minutes and carried off ${n} units of the yard of ${isl.name}.`);
  }
}

/** Another captain's island off the bow (for the Company's card). */
export function robView(game: Game, s: PlayerSession): { island: number; name: string; owner: string; why: string | null; robbing: number | null } | null {
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  const isl = islandNear(game, ship);
  const h = isl ? robTarget(game, s, isl.id) : undefined;
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
  const abandonWhy = moveWhy(game, s, h) ?? ((h.yard?.ships ?? []).some((x) => x.state === 'sea') ? 'Bring your own ships home to the island first.' : null);
  return {
    waters: w, region: isl.region, faction: game.holdings.factionOf(game, isl.region), tax: 0, taxAt: c.taxAt, unpaid: 0, treasury: h.treasury,
    defence: d.rating, batteries: d.batteries, forts: d.forts, ships: d.ships, strength, odds: strength > 0 ? Math.round(raidOdds(d.rating, strength, r && r.ships.length ? alive / r.ships.length : 1) * 100) / 100 : 1,
    worth: isleWorth(h), fat: fatMark(lvl), calmUntil: c.calmUntil, lost: Math.round(c.lossShare * 100) / 100, lossCap: LOSS_DAY_CAP,
    raid: r ? { until: r.until, x: r.x, y: r.y, ships: r.ships.length, alive, strength: r.strength } : null,
    refund: 0, abandonWhy, others: game.holdings.onIsland(game, h.island).filter((x) => x.owner.id !== h.owner.id).map((x) => x.owner.name).slice(0, 8),
    fee: claimFee(game, s), moves: Math.max(0, claimsMade(game, s) - 1), freeMoves: FREE_MOVES,
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
