// Sailing together (docs/01 §7 convoys, docs/02 §9 loot rules): groups of up to eight captains, the convoy
// formation, and barter between two captains — in port across the quay, or at sea hove-to alongside, where
// the goods cross on boats and take time (Dockhands shortens it).
//  - A group shares a map (members' positions every two seconds), a chat channel, the first 30 s on the
//    loot of a ship one of them sank, auras and orders meant for allies; members cannot hurt each other.
//  - Convoy: while the leader flies it, members within 1 500 m of the leader sail at the slowest ship's
//    speed ×1.05, see 30% farther, and pay 30% less for League insurance.

import { GROUP_MAX } from '../../../shared/src/protocol.ts';
import type { BarterSide, BarterView, PartyMember, PartyView } from '../../../shared/src/protocol.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { cargoVolume, computeShipStats, tx } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Game } from './Game.ts';
import { hasPennant, tie } from './pvp.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export const CONVOY_RANGE = 1500;
export const BARTER_RANGE = 120;
const INVITE_SEC = 60;

export interface Group {
  id: number;
  leader: number; // account id
  members: number[];
  convoy: boolean;
}

interface Invite {
  id: number;
  from: number;
  fromName: string;
  to: number;
  until: number;
}

interface Offer {
  gold: number;
  cargo: Cargo;
  ready: boolean;
}

export interface Barter {
  a: number;
  b: number;
  open: boolean; // both have agreed to trade
  offers: Map<number, Offer>;
  port: string | null;
  transferAt: number; // world time the boats finish (at sea), 0 = not under way
  since: number;
}

export class Social {
  groups = new Map<number, Group>();
  groupOf = new Map<number, number>();
  invites = new Map<number, Invite>();
  barters = new Map<number, Barter>(); // either side's account id → the barter
  private nextId = 1;

  id(): number {
    return this.nextId++;
  }
}

// ------------------------------------------------------------------------------------------ groups

export function groupOfAccount(game: Game, accountId: number | null): Group | null {
  if (accountId === null) return null;
  const id = game.social.groupOf.get(accountId);
  return id === undefined ? null : game.social.groups.get(id) ?? null;
}

/** The captain behind a ship: its own account, or its owner's for escorts and prizes. */
function accountBehind(game: Game, ship: ShipEntity): number | null {
  if (ship.accountId !== null) return ship.accountId;
  if (ship.ownerId !== null) return game.ships.get(ship.ownerId)?.accountId ?? null;
  return null;
}

export function sameGroupAccounts(game: Game, a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  const g = game.social.groupOf.get(a);
  return g !== undefined && g === game.social.groupOf.get(b);
}

export function sameGroup(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  return sameGroupAccounts(game, accountBehind(game, a), accountBehind(game, b));
}

export function groupInvite(game: Game, s: PlayerSession, name: string): string | null {
  const t = game.sessionByName(String(name ?? ''));
  if (!t || !t.profile) return 'No captain of that name is at sea';
  if (t === s) return 'You are already in your own company';
  const g = groupOfAccount(game, s.accountId);
  if (g && g.leader !== s.accountId) return 'Only the leader invites';
  if (g && g.members.length >= GROUP_MAX) return `A group sails at most ${GROUP_MAX} ships`;
  if (groupOfAccount(game, t.accountId)) return `${t.name} already sails with a group`;
  for (const i of game.social.invites.values()) if (i.from === s.accountId && i.to === t.accountId) return 'The invitation is already on its way';
  const inv: Invite = { id: game.social.id(), from: s.accountId, fromName: s.name, to: t.accountId, until: game.now + INVITE_SEC };
  game.social.invites.set(inv.id, inv);
  game.sendTo(t, { t: 'toast', msg: `${s.name} asks you to sail with them. Answer in the Company screen [Y].`, kind: 'info' });
  pushParty(game, t);
  game.sendTo(s, { t: 'toast', msg: `Invitation sent to ${t.name}.`, kind: 'info' });
  return null;
}

export function groupAnswer(game: Game, s: PlayerSession, id: number, accept: boolean): string | null {
  const inv = game.social.invites.get(id);
  if (!inv || inv.to !== s.accountId) return 'That invitation has lapsed';
  game.social.invites.delete(id);
  const from = game.sessionByAccount(inv.from);
  if (!accept) {
    if (from) game.sendTo(from, { t: 'toast', msg: `${s.name} declines.`, kind: 'info' });
    pushParty(game, s);
    return null;
  }
  if (!from || !from.profile) return `${inv.fromName} is no longer at sea`;
  if (groupOfAccount(game, s.accountId)) return 'Leave your group first';
  let g = groupOfAccount(game, inv.from);
  if (g && g.leader !== inv.from) return 'They no longer lead their group';
  if (g && g.members.length >= GROUP_MAX) return 'Their group is full';
  if (!g) {
    g = { id: game.social.id(), leader: inv.from, members: [inv.from], convoy: false };
    game.social.groups.set(g.id, g);
    game.social.groupOf.set(inv.from, g.id);
  }
  g.members.push(s.accountId);
  game.social.groupOf.set(s.accountId, g.id);
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (ms && ms !== s) tie(game, s, ms); // sailing together: no bounties between them for a day
  }
  // Other invitations to this captain lapse.
  for (const [k, v] of game.social.invites) if (v.to === s.accountId) game.social.invites.delete(k);
  groupNotice(game, g, `${s.name} joins the group.`);
  pushGroup(game, g);
  return null;
}

export function groupLeave(game: Game, s: PlayerSession, why = 'leaves the group'): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (!g) return 'You sail alone';
  removeMember(game, g, s.accountId, `${s.name} ${why}.`);
  pushParty(game, s);
  return null;
}

function removeMember(game: Game, g: Group, accountId: number, notice: string): void {
  g.members = g.members.filter((m) => m !== accountId);
  game.social.groupOf.delete(accountId);
  const gone = game.sessionByAccount(accountId);
  if (gone?.ship) gone.ship.addEffect({ id: 'convoy', until: 0 }, game.now);
  if (g.members.length < 2) {
    for (const m of g.members) {
      game.social.groupOf.delete(m);
      const ms = game.sessionByAccount(m);
      if (ms?.ship) ms.ship.addEffect({ id: 'convoy', until: 0 }, game.now);
      if (ms) {
        game.sendTo(ms, { t: 'toast', msg: `${notice} The group disbands.`, kind: 'info' });
        pushParty(game, ms);
      }
    }
    game.social.groups.delete(g.id);
    return;
  }
  if (g.leader === accountId) g.leader = g.members[0];
  groupNotice(game, g, notice);
  pushGroup(game, g);
}

export function groupKick(game: Game, s: PlayerSession, name: string): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (!g || g.leader !== s.accountId) return 'Only the leader puts captains ashore';
  const t = g.members.map((m) => game.sessionByAccount(m)).find((x) => x && x.name.toLowerCase() === String(name).toLowerCase());
  if (!t || t === s) return 'No such captain in your group';
  removeMember(game, g, t.accountId, `${t.name} is sent on their way.`);
  pushParty(game, t);
  return null;
}

export function groupLead(game: Game, s: PlayerSession, name: string): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (!g || g.leader !== s.accountId) return 'Only the leader hands over the lead';
  const t = g.members.map((m) => game.sessionByAccount(m)).find((x) => x && x.name.toLowerCase() === String(name).toLowerCase());
  if (!t || t === s) return 'No such captain in your group';
  g.leader = t.accountId;
  groupNotice(game, g, `${t.name} now leads the group.`);
  pushGroup(game, g);
  return null;
}

export function groupConvoy(game: Game, s: PlayerSession, on: boolean): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (!g || g.leader !== s.accountId) return 'Only the leader signals the convoy';
  g.convoy = !!on;
  if (!g.convoy) for (const m of g.members) game.sessionByAccount(m)?.ship?.addEffect({ id: 'convoy', until: 0 }, game.now);
  groupNotice(game, g, g.convoy ? `${s.name} hoists the convoy signal: keep station within ${CONVOY_RANGE} m.` : 'The convoy signal comes down.');
  pushGroup(game, g);
  return null;
}

export function groupSay(game: Game, s: PlayerSession, text: string): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (!g) return 'You sail alone';
  const t = String(text ?? '').slice(0, 200).trim();
  if (!t) return null;
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (ms) game.sendTo(ms, { t: 'chat', from: s.name, text: t, ch: 'group' });
  }
  return null;
}

function groupNotice(game: Game, g: Group, msg: string): void {
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (ms) game.sendTo(ms, { t: 'toast', msg, kind: 'info' });
  }
}

/** Whether a captain's convoy is formed (for insurance and the like). */
export function inConvoy(game: Game, s: PlayerSession): boolean {
  const g = groupOfAccount(game, s.accountId);
  return !!g && g.convoy && g.members.length >= 2;
}

function memberView(game: Game, g: Group, accountId: number): PartyMember | null {
  const ms = game.sessionByAccount(accountId);
  if (!ms || !ms.profile) return null;
  const ship = ms.ship;
  return {
    accountId,
    name: ms.name,
    level: ms.profile.level,
    captain: ms.profile.captain,
    online: ms.disconnectedAt === null,
    docked: ship?.docked ?? null,
    x: Math.round(ship?.state.x ?? 0),
    y: Math.round(ship?.state.y ?? 0),
    hull: ship ? Math.round((ship.hull / ship.stats.hullMax) * 100) / 100 : 0,
    inConvoy: !!ship?.hasEffect('convoy'),
  };
}

export function partyView(game: Game, g: Group): PartyView {
  return { id: g.id, leader: g.leader, convoy: g.convoy, members: g.members.map((m) => memberView(game, g, m)).filter((x): x is PartyMember => !!x) };
}

export function pushParty(game: Game, s: PlayerSession): void {
  const g = groupOfAccount(game, s.accountId);
  const invites = [...game.social.invites.values()].filter((i) => i.to === s.accountId).map((i) => ({ id: i.id, from: i.fromName }));
  game.sendTo(s, { t: 'party', group: g ? partyView(game, g) : null, invites });
}

function pushGroup(game: Game, g: Group): void {
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (ms) pushParty(game, ms);
  }
}

/** Convoy speed: every ship in station sails at the slowest one's speed ×1.05. */
function stepConvoy(game: Game, g: Group): void {
  const leader = game.sessionByAccount(g.leader)?.ship;
  const ships: ShipEntity[] = [];
  for (const m of g.members) {
    const ship = game.sessionByAccount(m)?.ship;
    if (!ship) continue;
    const ok = g.convoy && leader && leader.alive && !leader.docked && ship.alive && !ship.docked && dist(ship.state.x, ship.state.y, leader.state.x, leader.state.y) <= CONVOY_RANGE;
    if (ok) ships.push(ship);
    else if (ship.hasEffect('convoy')) ship.addEffect({ id: 'convoy', until: 0 }, game.now);
  }
  if (ships.length < 2) {
    for (const ship of ships) if (ship.hasEffect('convoy')) ship.addEffect({ id: 'convoy', until: 0 }, game.now);
    return;
  }
  const bare = (ship: ShipEntity, extra?: number) =>
    computeShipStats(ship.loadout, ship.captain, ship.talents, [
      ...ship.effects.filter((e) => e.id !== 'convoy'),
      ...(extra !== undefined ? [{ id: 'convoy', until: Infinity, mods: { maxSpeed: extra, detection: 0.3 } }] : []),
    ]).maxSpeed;
  const base = new Map(ships.map((sh) => [sh, bare(sh)]));
  const pace = Math.min(...base.values()) * 1.05;
  for (const sh of ships) {
    // Speed is linear in the modifier: solve for the one that lands on the convoy's pace.
    const s0 = base.get(sh)!;
    const s1 = bare(sh, 0.1);
    const k = (s1 - s0) / 0.1;
    const m = k > 1e-6 ? Math.max(-0.9, Math.min(0.5, (pace - s0) / k)) : 0;
    const cur = sh.effects.find((e) => e.id === 'convoy');
    if (!cur || Math.abs((cur.mods?.maxSpeed ?? 0) - m) > 0.002) sh.addEffect({ id: 'convoy', until: Infinity, mods: { maxSpeed: m, detection: 0.3 } }, game.now);
  }
}

// ------------------------------------------------------------------------------------------ barter

function alongside(game: Game, a: PlayerSession, b: PlayerSession): { ok: boolean; atSea: boolean; port: string | null; why?: string } {
  const sa = a.ship, sb = b.ship;
  if (!sa || !sb || !sa.alive || !sb.alive) return { ok: false, atSea: false, port: null, why: 'Both ships must be afloat' };
  if (sa.docked || sb.docked) {
    if (sa.docked && sa.docked === sb.docked) return { ok: true, atSea: false, port: sa.docked };
    return { ok: false, atSea: false, port: null, why: 'Trade across the quay in the same port, or heave to alongside at sea' };
  }
  if (dist(sa.state.x, sa.state.y, sb.state.x, sb.state.y) > BARTER_RANGE) return { ok: false, atSea: true, port: null, why: `Come within ${BARTER_RANGE} m to pass goods across` };
  if (Math.abs(sa.state.speed) > 2 || Math.abs(sb.state.speed) > 2) return { ok: false, atSea: true, port: null, why: 'Both ships must heave to (under 2 m/s) to pass goods across' };
  if (sa.inCombat(game.now) || sb.inCombat(game.now)) return { ok: false, atSea: true, port: null, why: 'Not in the middle of a fight' };
  return { ok: true, atSea: true, port: null };
}

export function barterPropose(game: Game, s: PlayerSession, name: string): string | null {
  const t = game.sessionByName(String(name ?? ''));
  if (!t || !t.profile || t === s) return 'No captain of that name is at sea';
  const mine = game.social.barters.get(s.accountId);
  if (mine && mine.open) return 'Finish the trade you have open first';
  const theirs = game.social.barters.get(t.accountId);
  const where = alongside(game, s, t);
  if (!where.ok) return where.why!;
  // They asked us first: this is the handshake.
  if (theirs && !theirs.open && theirs.a === t.accountId && theirs.b === s.accountId) {
    if (mine && mine !== theirs) game.social.barters.delete(s.accountId);
    theirs.open = true;
    theirs.port = where.port;
    theirs.since = game.now;
    game.social.barters.set(s.accountId, theirs);
    pushBarter(game, theirs);
    return null;
  }
  if (theirs) return `${t.name} is busy trading`;
  if (mine) cancelBarter(game, mine, null);
  const b: Barter = {
    a: s.accountId,
    b: t.accountId,
    open: false,
    offers: new Map([[s.accountId, { gold: 0, cargo: {}, ready: false }], [t.accountId, { gold: 0, cargo: {}, ready: false }]]),
    port: where.port,
    transferAt: 0,
    since: game.now,
  };
  game.social.barters.set(s.accountId, b);
  game.sendTo(t, { t: 'toast', msg: `${s.name} wants to trade. Open the Company screen [Y] to accept.`, kind: 'info' });
  game.sendTo(s, { t: 'toast', msg: `You hail ${t.name} to trade.`, kind: 'info' });
  pushParty(game, t);
  return null;
}

/** Pending barter proposals addressed to this captain (for the Company screen). */
export function barterHails(game: Game, accountId: number): string[] {
  const out: string[] = [];
  for (const [k, b] of game.social.barters) if (k === b.a && !b.open && b.b === accountId) out.push(game.sessionByAccount(b.a)?.name ?? '');
  return out.filter(Boolean);
}

export function barterOffer(game: Game, s: PlayerSession, gold: number, cargo: Cargo): string | null {
  const b = game.social.barters.get(s.accountId);
  if (!b || !b.open) return 'No trade is open';
  const ship = s.ship!;
  const g = Math.floor(Number(gold));
  if (!Number.isFinite(g) || g < 0) return 'Bad offer';
  if (g > s.profile!.gold) return 'You do not have that much silver aboard';
  const clean: Cargo = {};
  let lines = 0;
  for (const [k, v] of Object.entries(cargo ?? {})) {
    const n = Math.floor(Number(v));
    if (!GOODS[k as GoodId] || !Number.isFinite(n) || n <= 0) continue;
    if (n > (ship.cargo[k as GoodId] ?? 0)) return `You carry only ${ship.cargo[k as GoodId] ?? 0} ${GOODS[k as GoodId].name}`;
    clean[k as GoodId] = n;
    if (++lines > 12) return 'Twelve kinds of goods at most';
  }
  b.offers.set(s.accountId, { gold: g, cargo: clean, ready: false });
  // Any change calls both captains back to the table.
  for (const o of b.offers.values()) o.ready = false;
  b.transferAt = 0;
  pushBarter(game, b);
  return null;
}

export function barterReady(game: Game, s: PlayerSession): string | null {
  const b = game.social.barters.get(s.accountId);
  if (!b || !b.open) return 'No trade is open';
  const other = game.sessionByAccount(b.a === s.accountId ? b.b : b.a);
  if (!other) return cancelBarter(game, b, 'They have gone');
  const where = alongside(game, s, other);
  if (!where.ok) return where.why!;
  b.offers.get(s.accountId)!.ready = true;
  if ([...b.offers.values()].every((o) => o.ready)) {
    if (!where.atSea) return settleBarter(game, b);
    // At sea the goods go across on boats.
    const vol = [...b.offers.values()].reduce((a, o) => a + cargoVolume(o.cargo), 0);
    // Dockhands on either ship speed the boats.
    const hands = Math.max(...[b.a, b.b].map((id) => { const sh = game.sessionByAccount(id)?.ship; return sh ? tx(sh.stats, 'transferSpeed') : 0; }));
    b.transferAt = game.now + Math.max(4, Math.min(30, 5 + vol / 8)) / (1 + hands);
  }
  pushBarter(game, b);
  return null;
}

export function cancelBarter(game: Game, b: Barter, why: string | null): string | null {
  for (const id of [b.a, b.b]) {
    if (game.social.barters.get(id) === b) game.social.barters.delete(id);
    const ms = game.sessionByAccount(id);
    if (ms) {
      if (why && b.open) game.sendTo(ms, { t: 'toast', msg: `Trade called off: ${why}.`, kind: 'bad' });
      game.sendTo(ms, { t: 'barter', view: null });
    }
  }
  return null;
}

function settleBarter(game: Game, b: Barter): string | null {
  const A = game.sessionByAccount(b.a), B = game.sessionByAccount(b.b);
  if (!A?.ship || !B?.ship || !A.profile || !B.profile) return cancelBarter(game, b, 'a captain has gone');
  const oa = b.offers.get(b.a)!, ob = b.offers.get(b.b)!;
  // Check everything first: silver, goods still aboard, room in each hold after its own goods go out.
  for (const [s, o] of [[A, oa], [B, ob]] as const) {
    if (s.profile!.gold < o.gold) return cancelBarter(game, b, `${s.name} no longer has the silver`);
    for (const [g, n] of Object.entries(o.cargo)) if ((s.ship!.cargo[g as GoodId] ?? 0) < (n ?? 0)) return cancelBarter(game, b, `${s.name} no longer carries the goods`);
  }
  for (const [s, give, take] of [[A, oa, ob], [B, ob, oa]] as const) {
    if (Object.keys(take.cargo).length && hasPennant(game, s.profile!)) return cancelBarter(game, b, `${s.name} sails under the Green Pennant and may take no goods from other captains`);
    const st = s.ship!.stats;
    const after: Cargo = { ...s.ship!.cargo };
    for (const [g, n] of Object.entries(give.cargo)) after[g as GoodId] = (after[g as GoodId] ?? 0) - (n ?? 0);
    for (const [g, n] of Object.entries(take.cargo)) after[g as GoodId] = (after[g as GoodId] ?? 0) + (n ?? 0);
    if (cargoVolume(after, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) > st.holdVolume + 1e-6) {
      for (const o of b.offers.values()) o.ready = false;
      b.transferAt = 0;
      pushBarter(game, b);
      return `${s.name}'s hold has no room for it`;
    }
  }
  move(A, B, oa);
  move(B, A, ob);
  tie(game, A, B);
  A.ship.recompute(game.now);
  B.ship.recompute(game.now);
  const line = (o: Offer) => [o.gold ? `${o.gold} silver` : '', ...Object.entries(o.cargo).map(([g, n]) => `${n} ${GOODS[g as GoodId].name}`)].filter(Boolean).join(', ') || 'nothing';
  game.sendTo(A, { t: 'toast', msg: `Trade done with ${B.name}: gave ${line(oa)}, got ${line(ob)}.`, kind: 'good' });
  game.sendTo(B, { t: 'toast', msg: `Trade done with ${A.name}: gave ${line(ob)}, got ${line(oa)}.`, kind: 'good' });
  cancelBarter(game, b, null);
  game.pushSelf(A, true);
  game.pushSelf(B, true);
  return null;
}

/** Goods keep their taint (stolen) and their price paid as they change hands. */
function move(from: PlayerSession, to: PlayerSession, o: Offer): void {
  const fp = from.profile!, tp = to.profile!;
  fp.gold -= o.gold;
  tp.gold += o.gold;
  for (const [k, v] of Object.entries(o.cargo)) {
    const g = k as GoodId;
    const n = v ?? 0;
    const had = to.ship!.cargo[g] ?? 0;
    const basis = fp.costBasis[g] ?? GOODS[g].basePrice;
    tp.costBasis[g] = Math.round(((tp.costBasis[g] ?? basis) * had + basis * n) / Math.max(1, had + n));
    from.ship!.cargo[g] = (from.ship!.cargo[g] ?? 0) - n;
    if (!from.ship!.cargo[g]) delete from.ship!.cargo[g];
    to.ship!.cargo[g] = had + n;
    const hot = Math.min(fp.stolen[g] ?? 0, n);
    if (hot > 0) {
      fp.stolen[g] = (fp.stolen[g] ?? 0) - hot;
      tp.stolen[g] = (tp.stolen[g] ?? 0) + hot;
    }
  }
}

function side(game: Game, id: number, o: Offer): BarterSide {
  return { name: game.sessionByAccount(id)?.name ?? '?', gold: o.gold, cargo: o.cargo, ready: o.ready };
}

function pushBarter(game: Game, b: Barter): void {
  for (const id of [b.a, b.b]) {
    const ms = game.sessionByAccount(id);
    if (!ms) continue;
    const other = id === b.a ? b.b : b.a;
    const view: BarterView = {
      me: side(game, id, b.offers.get(id)!),
      them: side(game, other, b.offers.get(other)!),
      atSea: b.port === null,
      transfer: b.transferAt ? Math.max(0, Math.ceil(b.transferAt - game.now)) : 0,
    };
    game.sendTo(ms, { t: 'barter', view: b.open ? view : null });
  }
}

// ------------------------------------------------------------------------------------------ upkeep

/** Called every second. */
export function stepSocial(game: Game): void {
  const soc = game.social;
  for (const [k, i] of soc.invites) {
    if (i.until > game.now) continue;
    soc.invites.delete(k);
    const t = game.sessionByAccount(i.to);
    if (t) pushParty(game, t);
  }
  for (const g of soc.groups.values()) {
    stepConvoy(game, g);
    if (Math.floor(game.now) % 2 === 0) pushGroup(game, g);
  }
  for (const [k, b] of soc.barters) {
    if (k !== b.a) continue;
    const A = game.sessionByAccount(b.a), B = game.sessionByAccount(b.b);
    if (!A || !B || A.disconnectedAt !== null || B.disconnectedAt !== null) {
      cancelBarter(game, b, 'a captain has gone');
      continue;
    }
    if (!b.open) {
      if (game.now - b.since > INVITE_SEC) cancelBarter(game, b, null);
      continue;
    }
    const where = alongside(game, A, B);
    if (!where.ok || (b.port ?? null) !== where.port) {
      cancelBarter(game, b, where.why ?? 'the ships have parted');
      continue;
    }
    if (b.transferAt && game.now >= b.transferAt) {
      const e = settleBarter(game, b);
      if (e) for (const s of [A, B]) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
    } else if (b.transferAt) pushBarter(game, b);
  }
}

/** A captain leaves the world for good (logged out and the ship gone). */
export function socialRetire(game: Game, s: PlayerSession): void {
  const b = game.social.barters.get(s.accountId);
  if (b) cancelBarter(game, b, `${s.name} has gone`);
  for (const [k, i] of game.social.invites) if (i.to === s.accountId || i.from === s.accountId) game.social.invites.delete(k);
  const g = groupOfAccount(game, s.accountId);
  if (g) removeMember(game, g, s.accountId, `${s.name} has left these waters.`);
}
