// Sailing together (docs/01 §7 convoys, docs/02 §9 loot rules): groups of up to eight captains, the convoy
// formation, and barter between two captains — in port across the quay, or at sea hove-to alongside, where
// the goods cross on boats and take time (Dockhands shortens it).
//  - A group shares a map (members' positions every two seconds), a chat channel, the first 30 s on the
//    loot of a ship one of them sank, auras and orders meant for allies; members cannot hurt each other.
//  - Convoy: while the leader flies it, members within 1 500 m of the leader sail at the slowest ship's
//    speed ×1.05, see 30% farther, and pay 30% less for League insurance.

// (a group's words: chat.ts — docs/28)
export { groupSay } from './chat.ts';
import { GROUP_MAX } from '../../../shared/src/protocol.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { BarterSide, BarterView, LfgEntry, PartyMember, PartyView } from '../../../shared/src/protocol.ts';
import { LFG_GOALS, LFG_SEC, TRADE_GOODS_MAX, TRADE_ITEMS_MAX, TRADE_RANGE, lfgRange, lfgTag } from '../../../shared/src/data/social.ts';
import type { LfgGoal } from '../../../shared/src/data/social.ts';
import { STASH_SIZE, itemName } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { cargoVolume, computeShipStats, tx } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Game } from './Game.ts';
import { ignores } from './friends.ts';
import { hasPennant, neutral, tie } from './pvp.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { BEAST_PLURAL } from '../../../shared/src/data/bestiary.ts';
import { joinCreatures, tameOf } from './tame.ts';
import { reconcile } from './crew.ts';

export const CONVOY_RANGE = 1500;
/** docs/16 #33: two ships trade at sea within 300 m of each other (no heaving to). */
export const BARTER_RANGE = TRADE_RANGE;
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
  /** docs/16 #31: a captain asking to join a posting (from: the asker, to: the group's leader). */
  ask?: boolean;
}

interface Offer {
  gold: number;
  cargo: Cargo;
  /** docs/16 #33: gear from the locker, by uid. */
  items: number[];
  /** docs/18 #42: tamed creatures from her army, by kind (they go across on the boats with the goods). */
  beasts: { u: UnitId; n: number }[];
  /** The offer is locked: it stands as it is until unlocked. */
  locked: boolean;
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
  /** Any change to the table raises it; a confirmation names the revision it saw (docs/16 #33). */
  rev: number;
}

export class Social {
  groups = new Map<number, Group>();
  groupOf = new Map<number, number>();
  invites = new Map<number, Invite>();
  barters = new Map<number, Barter>(); // either side's account id → the barter
  /** Captains looking for a group (docs/11 P6): account → their note and when they posted it (wall ms). */
  lfg = new Map<number, { note: string; since: number; goal?: LfgGoal; lo?: number; hi?: number }>();
  /** docs/16 #35: each captain's recent signal flags (world seconds). */
  signals = new Map<number, number[]>();
  /** Captains come aboard (friends.ts): whose friends have heard of it. */
  aboard = new Set<number>();
  /** Account → the name of the last captain who whispered to them (for "/r"). */
  lastWhisper = new Map<number, string>();
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
  if (ignores(t, s.accountId)) return `${t.name} is not listening to you`;
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
  // A captain who asked to join (docs/16 #31): the leader takes them aboard.
  if (inv.ask) {
    if (groupOfAccount(game, from.accountId)) return `${from.name} already sails with a group`;
    const mine = groupOfAccount(game, s.accountId);
    if (mine && mine.leader !== s.accountId) return 'Only the leader takes captains aboard';
    return joinGroup(game, s, from);
  }
  if (groupOfAccount(game, s.accountId)) return 'Leave your group first';
  const g = groupOfAccount(game, inv.from);
  if (g && g.leader !== inv.from) return 'They no longer lead their group';
  return joinGroup(game, from, s);
}

/** A captain joins the leader's group (formed now if the leader sailed alone). */
function joinGroup(game: Game, leader: PlayerSession, s: PlayerSession): string | null {
  let g = groupOfAccount(game, leader.accountId);
  if (g && g.members.length >= GROUP_MAX) return 'Their group is full';
  if (!g) {
    g = { id: game.social.id(), leader: leader.accountId, members: [leader.accountId], convoy: false };
    game.social.groups.set(g.id, g);
    game.social.groupOf.set(leader.accountId, g.id);
  }
  g.members.push(s.accountId);
  game.social.groupOf.set(s.accountId, g.id);
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (ms && ms !== s) tie(game, s, ms); // sailing together: no bounties between them for a day
  }
  // Other invitations to this captain, and their own asks, lapse.
  for (const [k, v] of game.social.invites) if (v.to === s.accountId || (v.ask && v.from === s.accountId)) game.social.invites.delete(k);
  groupNotice(game, g, `${s.name} joins the group.`);
  // Found one: off the board — the leader's too, unless the leader posted for more hands and there is room.
  let found = dropLfg(game, s.accountId);
  if (g.members.length >= GROUP_MAX || !game.social.lfg.get(leader.accountId)?.goal) found = dropLfg(game, leader.accountId) || found;
  pushGroup(game, g);
  if (found) lfgChanged(game);
  return null;
}

/** Ask to join a captain's posting (docs/16 #31): one tap on the board or the chart. */
export function groupAsk(game: Game, s: PlayerSession, name: string): string | null {
  const t = game.sessionByName(String(name ?? ''));
  if (!t || !t.profile || t === s) return 'No captain of that name is at sea';
  if (ignores(t, s.accountId)) return `${t.name} is not listening to you`;
  if (groupOfAccount(game, s.accountId)) return 'Leave your group first';
  const post = game.social.lfg.get(t.accountId);
  if (!post) return `${t.name} is not looking for company`;
  const lvl = s.profile!.level;
  if (post.lo !== undefined && post.hi !== undefined && (lvl < post.lo || lvl > post.hi)) return `${t.name} asks for captains of levels ${post.lo}–${post.hi}`;
  const g = groupOfAccount(game, t.accountId);
  if (g && g.members.length >= GROUP_MAX) return 'Their group is full';
  const to = g ? g.leader : t.accountId;
  for (const i of game.social.invites.values()) if (i.ask && i.from === s.accountId && i.to === to) return 'You have already asked';
  const inv: Invite = { id: game.social.id(), from: s.accountId, fromName: s.name, to, until: game.now + INVITE_SEC, ask: true };
  game.social.invites.set(inv.id, inv);
  const lead = game.sessionByAccount(to);
  if (lead) {
    game.sendTo(lead, { t: 'toast', msg: `${s.name} (level ${lvl}) asks to join your company. Answer in the Company screen [Y].`, kind: 'info' });
    pushParty(game, lead);
  }
  game.sendTo(s, { t: 'toast', msg: `You ask ${t.name} to take you aboard.`, kind: 'info' });
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
  const invites = [...game.social.invites.values()].filter((i) => i.to === s.accountId).map((i) => (i.ask ? { id: i.id, from: i.fromName, ask: true } : { id: i.id, from: i.fromName }));
  const mine = game.social.lfg.get(s.accountId);
  game.sendTo(s, { t: 'party', group: g ? partyView(game, g) : null, invites, lfg: lfgList(game, s.accountId), lfgMine: mine?.note ?? null, lfgGoal: mine?.goal ? { goal: mine.goal, lo: mine.lo ?? 1, hi: mine.hi ?? 1 } : null });
}

// ------------------------------------------------------------------------------------------ looking for a group

export { LFG_SEC };

/** The captains looking for a group, as one captain sees them: not themselves, only the ones at sea, freshest first;
 *  each with the goal, the levels asked, where she is (to 250 m) and how many sail with her (docs/16 #31). */
export function lfgList(game: Game, viewer: number): LfgEntry[] {
  const wall = game.wallNow();
  const me = game.sessionByAccount(viewer)?.profile?.level ?? 1;
  const out: (LfgEntry & { since: number })[] = [];
  for (const [acc, e] of game.social.lfg) {
    if (wall - e.since > LFG_SEC * 1000) {
      dropLfg(game, acc);
      continue;
    }
    const s = game.sessionByAccount(acc);
    if (acc === viewer || !s?.profile || !s.ship) continue;
    const row: LfgEntry & { since: number } = { name: s.name, level: s.profile.level, captain: s.profile.captain, region: s.ship.region, note: e.note, mins: Math.floor((wall - e.since) / 60000), since: e.since };
    if (e.goal) {
      row.goal = e.goal;
      row.lo = e.lo;
      row.hi = e.hi;
      row.fits = me >= (e.lo ?? 1) && me <= (e.hi ?? 99);
      row.size = groupOfAccount(game, acc)?.members.length ?? 1;
      if (!s.ship.docked) {
        row.x = Math.round(s.ship.state.x / 250) * 250;
        row.y = Math.round(s.ship.state.y / 250) * 250;
      }
    }
    out.push(row);
  }
  return out.sort((a, b) => b.since - a.since).slice(0, 20).map(({ since, ...x }) => (void since, x));
}

/** Post (or refresh) «looking for company» with a short note, a goal and the levels asked; every captain at sea
 *  sees the board change, and the flag flies over her ship. A group's leader may post for more hands. */
export function lfgPost(game: Game, s: PlayerSession, note: string, goal?: string, lo?: number, hi?: number): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (g && g.leader !== s.accountId) return 'You already sail in a group';
  if (g && g.members.length >= GROUP_MAX) return 'Your group is full';
  const clean = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const aim = LFG_GOALS.includes(goal as LfgGoal) ? (goal as LfgGoal) : 'hunt';
  const [a, b] = lfgRange(s.profile!.level, lo === undefined || lo === null ? undefined : Number(lo), hi === undefined || hi === null ? undefined : Number(hi));
  game.social.lfg.set(s.accountId, { note: clean, since: game.wallNow(), goal: aim, lo: a, hi: b });
  if (s.ship) {
    s.ship.lfg = lfgTag(aim, a, b);
    game.refreshInfo(s.ship);
  }
  lfgChanged(game);
  return null;
}

export function lfgClear(game: Game, s: PlayerSession): void {
  if (dropLfg(game, s.accountId)) lfgChanged(game);
}

/** A posting off the board, and its flag off the ship. */
function dropLfg(game: Game, account: number): boolean {
  const had = game.social.lfg.delete(account);
  const ship = game.sessionByAccount(account)?.ship;
  if (ship?.lfg) {
    ship.lfg = null;
    game.refreshInfo(ship);
  }
  return had;
}

function lfgChanged(game: Game): void {
  for (const s of game.sessions) if (s.profile) pushParty(game, s);
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
//
// docs/16 #33: two captains trade across the quay in one port, or at sea within 300 m of each other. Each puts
// silver, goods and gear from the locker on the table; each locks the offer; once both are locked, each confirms
// the table as they saw it (its revision). Any change unlocks the one who made it and calls both confirmations
// back. At sea the goods cross on boats; the table is called off when the ships part beyond reach, either is in a
// fight, sinks, puts in or leaves the sea. Everything is checked again at the moment it changes hands, and it
// changes hands all at once or not at all.

function alongside(game: Game, a: PlayerSession, b: PlayerSession): { ok: boolean; atSea: boolean; port: string | null; why?: string } {
  const sa = a.ship, sb = b.ship;
  if (!sa || !sb || !sa.alive || !sb.alive) return { ok: false, atSea: false, port: null, why: 'Both ships must be afloat' };
  if (a.disconnectedAt !== null || b.disconnectedAt !== null) return { ok: false, atSea: false, port: null, why: 'a captain has gone' };
  if (sa.docked || sb.docked) {
    if (sa.docked && sa.docked === sb.docked) return { ok: true, atSea: false, port: sa.docked };
    return { ok: false, atSea: false, port: null, why: 'Trade across the quay in the same port, or come alongside at sea' };
  }
  if (dist(sa.state.x, sa.state.y, sb.state.x, sb.state.y) > BARTER_RANGE) return { ok: false, atSea: true, port: null, why: `Come within ${BARTER_RANGE} m to pass goods across` };
  if (sa.underFire(game.now) || sb.underFire(game.now)) return { ok: false, atSea: true, port: null, why: 'Not in the middle of a fight' };
  return { ok: true, atSea: true, port: null };
}

const emptyOffer = (): Offer => ({ gold: 0, cargo: {}, items: [], beasts: [], locked: false, ready: false });

export function barterPropose(game: Game, s: PlayerSession, name: string): string | null {
  const t = game.sessionByName(String(name ?? ''));
  if (!t || !t.profile || t === s) return 'No captain of that name is at sea';
  if (ignores(t, s.accountId)) return `${t.name} is not listening to you`;
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
    theirs.rev++;
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
    offers: new Map([[s.accountId, emptyOffer()], [t.accountId, emptyOffer()]]),
    port: where.port,
    transferAt: 0,
    since: game.now,
    rev: 1,
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

/** Everything on the table changed: both confirmations called back, the boats stopped, the revision raised. */
function changed(b: Barter): void {
  for (const o of b.offers.values()) o.ready = false;
  b.transferAt = 0;
  b.rev++;
}

/** Gear a captain may put on the table: in her locker (not worn), not bound, each once. */
function tradeItems(s: PlayerSession, uids: unknown): number[] | string {
  if (uids === undefined || uids === null) return [];
  if (!Array.isArray(uids)) return 'Bad offer';
  const out: number[] = [];
  for (const v of uids) {
    const uid = Math.trunc(Number(v));
    if (!Number.isFinite(uid)) return 'Bad offer';
    if (out.includes(uid)) continue;
    const it = s.profile!.stash.find((x) => x.uid === uid);
    if (!it) return 'That piece is not in your locker';
    if (it.bound) return 'Bound gear does not change hands';
    out.push(uid);
    if (out.length > TRADE_ITEMS_MAX) return `${TRADE_ITEMS_MAX} pieces of gear at most`;
  }
  return out;
}

/** docs/18 #42: creatures she may put on the table — tamed kinds of her army (no legend, and nothing of the premium
 *  shop's: bought with an account's money, they stay with it), at most what she has, and a stack of something left
 *  aboard. */
function tradeBeasts(s: PlayerSession, raw: unknown): { u: UnitId; n: number }[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return 'Bad offer';
  const ship = s.ship!;
  const out: { u: UnitId; n: number }[] = [];
  for (const v of raw) {
    const u = String((v as { u?: unknown })?.u ?? '') as UnitId;
    const n = Math.floor(Number((v as { n?: unknown })?.n));
    if (!UNITS[u]?.beast || !Number.isFinite(n) || n <= 0 || out.some((x) => x.u === u)) continue;
    if (UNITS[u].legend) return 'A legend does not change hands';
    if (UNITS[u].premium) return 'The shop’s creatures do not change hands';
    const have = ship.army.find((x) => x.u === u)?.n ?? 0;
    if (n > have) return `You have only ${have} ${BEAST_PLURAL[u as keyof typeof BEAST_PLURAL][0]}`;
    out.push({ u, n });
  }
  const left = ship.army.reduce((a, x) => a + x.n, 0) - out.reduce((a, x) => a + x.n, 0);
  if (out.length && left <= 0) return 'Keep at least one stack aboard';
  return out;
}

export function barterOffer(game: Game, s: PlayerSession, gold: number, cargo: Cargo, items?: unknown, beasts?: unknown): string | null {
  const b = game.social.barters.get(s.accountId);
  if (!b || !b.open) return 'No trade is open';
  const mine = b.offers.get(s.accountId)!;
  if (mine.locked) return 'Unlock your offer to change it';
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
    if (++lines > TRADE_GOODS_MAX) return 'Twelve kinds of goods at most';
  }
  const gear = tradeItems(s, items);
  if (typeof gear === 'string') return gear;
  const kin = tradeBeasts(s, beasts);
  if (typeof kin === 'string') return kin;
  b.offers.set(s.accountId, { gold: g, cargo: clean, items: gear, beasts: kin, locked: false, ready: false });
  // Any change calls both captains back to the table.
  changed(b);
  pushBarter(game, b);
  return null;
}

/** Lock one's offer as it stands (it is checked again now), or unlock it to change it. */
export function barterLock(game: Game, s: PlayerSession, lock: boolean): string | null {
  const b = game.social.barters.get(s.accountId);
  if (!b || !b.open) return 'No trade is open';
  const o = b.offers.get(s.accountId)!;
  if (lock) {
    const why = offerWhy(s, o);
    if (why) return why;
  }
  o.locked = lock;
  changed(b);
  pushBarter(game, b);
  return null;
}

export function barterReady(game: Game, s: PlayerSession, rev?: number): string | null {
  const b = game.social.barters.get(s.accountId);
  if (!b || !b.open) return 'No trade is open';
  const other = game.sessionByAccount(b.a === s.accountId ? b.b : b.a);
  if (!other) return cancelBarter(game, b, 'They have gone');
  const where = alongside(game, s, other);
  if (!where.ok) return where.why!;
  if (![...b.offers.values()].every((o) => o.locked)) return 'Both captains must lock their offers first';
  if (rev !== undefined && rev !== null && Number(rev) !== b.rev) {
    pushBarter(game, b);
    return 'The table has changed: look again before you confirm';
  }
  b.offers.get(s.accountId)!.ready = true;
  if ([...b.offers.values()].every((o) => o.ready)) {
    if (!where.atSea) return settleBarter(game, b);
    // At sea the goods go across on boats.
    const vol = [...b.offers.values()].reduce((a, o) => a + cargoVolume(o.cargo) + o.items.length, 0);
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

/** Why an offer can no longer be kept (null: it can): silver, goods and gear all still hers. */
function offerWhy(s: PlayerSession, o: Offer): string | null {
  const p = s.profile!;
  if (p.gold < o.gold) return `${s.name} no longer has the silver`;
  for (const [g, n] of Object.entries(o.cargo)) if ((s.ship!.cargo[g as GoodId] ?? 0) < (n ?? 0)) return `${s.name} no longer carries the goods`;
  for (const uid of o.items) {
    const it = p.stash.find((x) => x.uid === uid);
    if (!it) return `${s.name} no longer has that gear`;
    if (it.bound) return 'Bound gear does not change hands';
  }
  for (const x of o.beasts ?? []) if ((s.ship!.army.find((y) => y.u === x.u)?.n ?? 0) < x.n) return `${s.name} no longer has those creatures`;
  return null;
}

function settleBarter(game: Game, b: Barter): string | null {
  const A = game.sessionByAccount(b.a), B = game.sessionByAccount(b.b);
  if (!A?.ship || !B?.ship || !A.profile || !B.profile) return cancelBarter(game, b, 'a captain has gone');
  const where = alongside(game, A, B);
  if (!where.ok || (b.port ?? null) !== where.port) return cancelBarter(game, b, where.why ?? 'the ships have parted');
  const oa = b.offers.get(b.a)!, ob = b.offers.get(b.b)!;
  if (!oa.locked || !ob.locked || !oa.ready || !ob.ready) return 'Both captains must lock and confirm';
  // Check everything first: silver, goods and gear still aboard, room in each hold and locker after its own go out.
  for (const [s, o] of [[A, oa], [B, ob]] as const) {
    const why = offerWhy(s, o);
    if (why) return cancelBarter(game, b, why);
  }
  for (const [s, give, take] of [[A, oa, ob], [B, ob, oa]] as const) {
    // Shielded captains are no mules: no captain may fire on them, so they take nothing from another captain — under the
    // Green Pennant anywhere, under neutral colours (docs/24 D1) at sea (across a quay she may: no hiding place there).
    if ((Object.keys(take.cargo).length || take.items.length) && hasPennant(game, s.profile!)) return cancelBarter(game, b, `${s.name} sails under the Green Pennant and may take no goods from other captains`);
    if ((Object.keys(take.cargo).length || take.items.length) && neutral(s.profile) && !s.ship?.docked) return cancelBarter(game, b, `${s.name} sails under neutral colours and may take no goods from other captains`);
    const st = s.ship!.stats;
    const after: Cargo = { ...s.ship!.cargo };
    for (const [g, n] of Object.entries(give.cargo)) after[g as GoodId] = (after[g as GoodId] ?? 0) - (n ?? 0);
    for (const [g, n] of Object.entries(take.cargo)) after[g as GoodId] = (after[g as GoodId] ?? 0) + (n ?? 0);
    const vol = (c: Cargo) => cargoVolume(c, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    // A hold already over its room (a storm's salvage) is no bar to a trade that does not add to it.
    const noRoom = vol(after) > st.holdVolume + 1e-6 && vol(after) > vol(s.ship!.cargo) + 1e-6 ? `${s.name}'s hold has no room for it`
      : s.profile!.stash.length - give.items.length + take.items.length > STASH_SIZE ? `${s.name}'s locker has no room for the gear` : null;
    // docs/18 #42: the creatures she takes need their slots and hammocks, after her own go across.
    const beastRoom = beastsFit(s, give, take);
    const blocked = noRoom ?? beastRoom;
    if (blocked) {
      for (const o of b.offers.values()) o.ready = false;
      b.transferAt = 0;
      b.rev++;
      pushBarter(game, b);
      return blocked;
    }
  }
  // All at once.
  const gearA = take(A, oa.items), gearB = take(B, ob.items);
  move(A, B, oa);
  move(B, A, ob);
  moveBeasts(game, A, B, oa);
  moveBeasts(game, B, A, ob);
  for (const it of gearA) B.profile.stash.push({ ...it, uid: B.profile.itemSeq++ });
  for (const it of gearB) A.profile.stash.push({ ...it, uid: A.profile.itemSeq++ });
  if (oa.gold) game.db.ledger(A.accountId, 'barter', -oa.gold, B.name);
  if (ob.gold) game.db.ledger(B.accountId, 'barter', -ob.gold, A.name);
  if (oa.gold) game.db.ledger(B.accountId, 'barter', oa.gold, A.name);
  if (ob.gold) game.db.ledger(A.accountId, 'barter', ob.gold, B.name);
  tie(game, A, B);
  A.ship.recompute(game.now);
  B.ship.recompute(game.now);
  const line = (o: Offer, gear: Item[]) => [o.gold ? `${o.gold} silver` : '', ...Object.entries(o.cargo).map(([g, n]) => `${n} ${GOODS[g as GoodId].name}`), ...(o.beasts ?? []).map((x) => `${x.n} ${BEAST_PLURAL[x.u as keyof typeof BEAST_PLURAL][0]}`)].filter(Boolean).join(', ') || (gear.length ? 'gear' : 'nothing');
  game.sendTo(A, { t: 'toast', msg: `Trade done with ${B.name}: gave ${line(oa, gearA)}, got ${line(ob, gearB)}.`, kind: 'good' });
  game.sendTo(B, { t: 'toast', msg: `Trade done with ${A.name}: gave ${line(ob, gearB)}, got ${line(oa, gearA)}.`, kind: 'good' });
  for (const it of gearB) game.sendTo(A, { t: 'toast', msg: `Into your locker: ${itemName(it)}.`, kind: 'good' });
  for (const it of gearA) game.sendTo(B, { t: 'toast', msg: `Into your locker: ${itemName(it)}.`, kind: 'good' });
  cancelBarter(game, b, null);
  game.pushSelf(A, true);
  game.pushSelf(B, true);
  return null;
}

/** docs/18 #42: whether the creatures she takes have their hammocks and slots, after hers go across (null: they do). */
function beastsFit(s: PlayerSession, give: Offer, take: Offer): string | null {
  const comes = (take.beasts ?? []).reduce((a, x) => a + x.n, 0);
  if (!comes) return null;
  const gone = (give.beasts ?? []).reduce((a, x) => a + x.n, 0);
  const ship = s.ship!;
  if (ship.crew - gone + comes > ship.stats.crewMax) return `${s.name} has no hammocks for the creatures`;
  const kinds = new Set(ship.army.filter((x) => x.n - ((give.beasts ?? []).find((y) => y.u === x.u)?.n ?? 0) > 0).map((x) => x.u));
  for (const x of take.beasts ?? []) kinds.add(x.u);
  return kinds.size > ship.armySlots ? `${s.name} has no free slot for the creatures` : null;
}

/** docs/18 #42: the creatures across, their wins with them into an empty slot (a rank is the stack's). */
function moveBeasts(game: Game, from: PlayerSession, to: PlayerSession, o: Offer): void {
  for (const x of o.beasts ?? []) {
    const fs = from.ship!;
    const rec = tameOf(from.profile!).k[x.u];
    const k = fs.loseFrom(x.u, x.n);
    if (!fs.army.some((y) => y.u === x.u)) delete tameOf(from.profile!).k[x.u];
    reconcile(game, from.profile!.company, fs.crew);
    fs.companyKey = '';
    const had = to.ship!.army.find((y) => y.u === x.u)?.n ?? 0;
    const got = joinCreatures(game, to, x.u, k);
    if (rec && got > 0 && had === 0) tameOf(to.profile!).k[x.u] = { w: rec.w, h: 0 };
  }
}

/** The pieces out of a captain's locker (checked to be there just before). */
function take(s: PlayerSession, uids: number[]): Item[] {
  const p = s.profile!;
  const out: Item[] = [];
  for (const uid of uids) {
    const i = p.stash.findIndex((x) => x.uid === uid);
    if (i >= 0) out.push(...p.stash.splice(i, 1));
  }
  return out;
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
  const s = game.sessionByAccount(id);
  const items = o.items.map((uid) => s?.profile?.stash.find((x) => x.uid === uid)).filter((x): x is Item => !!x);
  return { name: s?.name ?? '?', gold: o.gold, cargo: o.cargo, ready: o.ready, items, locked: o.locked, ...(o.beasts?.length ? { beasts: o.beasts.map((x) => ({ ...x })) } : {}) };
}

function pushBarter(game: Game, b: Barter): void {
  const A = game.sessionByAccount(b.a)?.ship, B = game.sessionByAccount(b.b)?.ship;
  const d = A && B && b.port === null ? Math.round(dist(A.state.x, A.state.y, B.state.x, B.state.y)) : 0;
  for (const id of [b.a, b.b]) {
    const ms = game.sessionByAccount(id);
    if (!ms) continue;
    const other = id === b.a ? b.b : b.a;
    const view: BarterView = {
      me: side(game, id, b.offers.get(id)!),
      them: side(game, other, b.offers.get(other)!),
      atSea: b.port === null,
      transfer: b.transferAt ? Math.max(0, Math.ceil(b.transferAt - game.now)) : 0,
      rev: b.rev,
      dist: d,
      range: BARTER_RANGE,
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
    } else if (b.transferAt || (b.port === null && Math.floor(game.now) % 2 === 0)) pushBarter(game, b); // the boats, the distance
  }
  // The board of those looking for company: where they sail now, every ten seconds (docs/16 #31).
  if (soc.lfg.size && Math.floor(game.now) % 10 === 0) lfgChanged(game);
}

/** A captain leaves the world for good (logged out and the ship gone). */
export function socialRetire(game: Game, s: PlayerSession): void {
  if (dropLfg(game, s.accountId)) lfgChanged(game);
  game.social.signals.delete(s.accountId);
  const b = game.social.barters.get(s.accountId);
  if (b) cancelBarter(game, b, `${s.name} has gone`);
  for (const [k, i] of game.social.invites) if (i.to === s.accountId || i.from === s.accountId) game.social.invites.delete(k);
  const g = groupOfAccount(game, s.accountId);
  if (g) removeMember(game, g, s.accountId, `${s.name} has left these waters.`);
}
