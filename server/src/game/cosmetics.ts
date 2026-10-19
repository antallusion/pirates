// Cosmetics on the server (owner, 2026-10-19; shared/src/data/cosmetics.ts, docs/32 §12). The server is the only
// judge of what she owns and wears:
//  - bought: through the shop's own path (shop.ts: the offer `cos_*`, its ledger row `doubloons_buy`, its purchase id
//    bought once) — this module only hands the keys over (`grantCos`) and says when there is nothing left to buy;
//  - free: every captain has them (FREE_KEYS);
//  - earned: her stats checked every few seconds (level, the campaign, boardings won, the Colosseum's rating); once
//    earned, a thing is hers for good (written into her keys, a toast), so a new season's table takes nothing back.
// What she wears goes on her ship's name card (ShipEntity.cos → ShipInfo.cos, re-sent to everyone in sight with
// refreshInfo), her chat lines and her card (the frame). Emotes go over her ship (a GameEvent in sight) and into the
// local chat, at their own pace (EMOTE_GAP, EMOTE_BURST in EMOTE_WINDOW).
//
// Kept on her account (kv `cos:<account>`), like the shop's stores: they outlive a captain and a zone's move.

import {
  COS_EMOTES, EMOTE_BURST, EMOTE_GAP, EMOTE_WINDOW, EQUIP_SLOTS, FREE_KEYS, NO_EQUIP, COS_KINDS, COS_TABLES, cosItem, cosKey, encodeCos, expandKeys, wearsAny,
} from '../../../shared/src/data/cosmetics.ts';
import type { CosEarn, CosEquip, CosItem } from '../../../shared/src/data/cosmetics.ts';
import { CAMPAIGN_SIZE } from '../../../shared/src/data/campaign/plan.ts';
import type { CosView } from '../../../shared/src/cosproto.ts';
import { arenaBest } from './arena.ts';
import { emoteSay } from './chat.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

export interface CosState {
  /** Her keys (`kind:id`): bought and earned (the free ones are not written). */
  own: string[];
  eq: CosEquip;
}

const fresh = (): CosState => ({ own: [], eq: { ...NO_EQUIP } });
const cache = new WeakMap<Game, Map<number, CosState>>();
const key = (acc: number) => `cos:${acc}`;

/** Her account's wardrobe (made on first sight; kept in the kv table). */
export function cosState(game: Game, acc: number): CosState {
  let m = cache.get(game);
  if (!m) cache.set(game, (m = new Map()));
  let st = m.get(acc);
  if (!st) {
    const raw = game.db.getKv<Partial<CosState>>(key(acc)) ?? {};
    st = fresh();
    st.own = Array.isArray(raw.own) ? raw.own.filter((k) => typeof k === 'string' && !!cosItem(k)) : [];
    for (const s of EQUIP_SLOTS) {
      const v = raw.eq?.[s];
      if (typeof v === 'string' && cosItem(`${s}:${v}`)) st.eq[s] = v;
    }
    m.set(acc, st);
  }
  return st;
}

function save(game: Game, acc: number, st: CosState): void {
  game.db.setKv(key(acc), st);
}

/** For the tests: her wardrobe forgotten (the next look reads the kv table again). */
export function forgetCos(game: Game, acc?: number): void {
  if (acc === undefined) cache.delete(game);
  else cache.get(game)?.delete(acc);
}

/** Everything she may wear: the free things and her own. */
export function ownedSet(game: Game, acc: number): Set<string> {
  return new Set([...FREE_KEYS, ...cosState(game, acc).own]);
}

export function ownsCos(game: Game, acc: number, k: string): boolean {
  return FREE_KEYS.includes(k) || cosState(game, acc).own.includes(k);
}

// ------------------------------------------------------------------------------------------------ the shop's grant

/** Why a bundle or a thing cannot be bought: she has all of it already ('max'). */
export function cosWhy(game: Game, acc: number, keys: readonly string[]): 'max' | null {
  const own = ownedSet(game, acc);
  return expandKeys(keys).every((k) => own.has(k)) ? 'max' : null;
}

/** The keys handed over (inside the shop's transaction). */
export function grantCos(game: Game, s: PlayerSession, keys: readonly string[]): void {
  const st = cosState(game, s.accountId);
  for (const k of expandKeys(keys)) if (cosItem(k) && !st.own.includes(k) && !FREE_KEYS.includes(k)) st.own.push(k);
  save(game, s.accountId, st);
}

/** After a purchase (shop.ts afterBuy): her wardrobe's view. */
export function afterCosBuy(game: Game, s: PlayerSession): void {
  sendCos(game, s);
}

// ------------------------------------------------------------------------------------------------ earned

/** Her stats the earn conditions read. */
function statsOf(game: Game, s: PlayerSession): CosView['stats'] {
  const p = s.profile!;
  return { level: p.level, boarded: p.stats?.boarded ?? 0, campaign: Math.min(CAMPAIGN_SIZE, p.campaign?.at ?? 0), campaignSize: CAMPAIGN_SIZE, arena: arenaBest(game, s.accountId) };
}

export function earnMet(e: CosEarn, st: CosView['stats']): boolean {
  switch (e.k) {
    case 'level': return st.level >= e.n;
    case 'campaign': return st.campaign >= st.campaignSize;
    case 'boarded': return st.boarded >= e.n;
    case 'arena': return st.arena >= e.rating;
  }
}

const EARNED: CosItem[] = COS_KINDS.flatMap((k) => COS_TABLES[k].filter((x) => !!x.earn));

/** Her newly earned things written into her keys, a toast for each (true: something new). */
export function checkEarned(game: Game, s: PlayerSession, say = true): boolean {
  if (!s.profile) return false;
  const st = cosState(game, s.accountId);
  const stats = statsOf(game, s);
  let any = false;
  for (const x of EARNED) {
    const k = cosKey(x);
    if (st.own.includes(k) || !earnMet(x.earn!, stats)) continue;
    st.own.push(k);
    any = true;
    if (say) game.sendTo(s, { t: 'toast', msg: `Earned: ${x.name[0]}!`, kind: 'gold' });
  }
  if (any) save(game, s.accountId, st);
  return any;
}

const lastCheck = new WeakMap<PlayerSession, number>();

/** Every few seconds of her time aboard: the earned things (Game's per-session step). */
export function stepCosmetics(game: Game, s: PlayerSession): void {
  if (!s.profile) return;
  const now = game.now;
  if (now - (lastCheck.get(s) ?? -1e9) < 5) return;
  lastCheck.set(s, now);
  if (checkEarned(game, s)) sendCos(game, s);
}

// ------------------------------------------------------------------------------------------------ wearing

/** What her ship flies for the others (null: nothing). */
export function cosWire(game: Game, acc: number): string | null {
  const st = cosState(game, acc);
  return wearsAny(st.eq) ? encodeCos(st.eq) : null;
}

/** Her ship's card made to show what she wears now (a putting to sea, a change). */
export function dressShip(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship) return;
  const w = cosWire(game, s.accountId);
  if (ship.cos === w) return;
  ship.cos = w;
  game.refreshInfo(ship);
}

const equipTimes = new WeakMap<PlayerSession, number[]>();

/** Whether a change of dress is within her pace (each one re-sends her ship's card to everyone in sight): EQUIP_BURST
 *  in ten seconds. */
function equipPace(game: Game, s: PlayerSession): boolean {
  const now = game.now;
  const list = (equipTimes.get(s) ?? []).filter((t) => now - t < 10);
  if (list.length >= EQUIP_BURST) {
    equipTimes.set(s, list);
    return false;
  }
  list.push(now);
  equipTimes.set(s, list);
  return true;
}
const EQUIP_BURST = 12;

/** Wear a thing in its slot, or take it off (id null). Null: done; else the refusal. */
export function equipCos(game: Game, s: PlayerSession, slot: string, id: string | null): string | null {
  if (!s.profile) return 'Not now';
  if (!equipPace(game, s)) return 'Not so fast: one change at a time.';
  if (!(EQUIP_SLOTS as string[]).includes(slot)) return 'Not now';
  const sl = slot as keyof CosEquip;
  const st = cosState(game, s.accountId);
  if (id !== null) {
    const k = `${sl}:${String(id)}`;
    if (!cosItem(k)) return 'Not now';
    if (!ownsCos(game, s.accountId, k)) return 'You do not own this yet.';
    st.eq[sl] = String(id);
    // (a title needs a plate to float on, and a plate a title: the free driftwood and the free words step in)
    if (sl === 'title' && !st.eq.plate) st.eq.plate = 'driftwood';
    if (sl === 'plate' && !st.eq.title) st.eq.title = 'seawolf';
    if (sl === 'emblem' && !st.eq.cloth) st.eq.cloth = 'black';
    if (sl === 'cloth' && !st.eq.emblem) st.eq.emblem = 'anchor';
  } else {
    st.eq[sl] = null;
    if (sl === 'title' || sl === 'plate') st.eq.title = st.eq.plate = null;
    if (sl === 'emblem' || sl === 'cloth') st.eq.emblem = st.eq.cloth = null;
  }
  save(game, s.accountId, st);
  dressShip(game, s);
  return null;
}

/** Her frame for the cards and the chat lines (absent: none worn). */
export function frameOf(game: Game, acc: number): string | undefined {
  return cosState(game, acc).eq.frame ?? undefined;
}

// ------------------------------------------------------------------------------------------------ emotes

const emoteTimes = new WeakMap<PlayerSession, number[]>();

/** Whether an emote is within her pace (counted if it is): one every EMOTE_GAP s, EMOTE_BURST in EMOTE_WINDOW s. */
export function emotePace(game: Game, s: PlayerSession): boolean {
  const now = game.now;
  const list = (emoteTimes.get(s) ?? []).filter((t) => now - t < EMOTE_WINDOW);
  const last = list[list.length - 1];
  if ((last !== undefined && now - last < EMOTE_GAP) || list.length >= EMOTE_BURST) {
    emoteTimes.set(s, list);
    return false;
  }
  list.push(now);
  emoteTimes.set(s, list);
  return true;
}

/** An emote over her ship (the captains in sight see it EMOTE_SHOW_S seconds) and into the local chat. */
export function sendEmote(game: Game, s: PlayerSession, id: string): string | null {
  const ship = s.ship;
  if (!s.profile || !ship || !ship.alive) return 'You have no ship';
  const e = COS_EMOTES.find((x) => x.id === String(id));
  if (!e) return 'Not now';
  if (!ownsCos(game, s.accountId, cosKey(e))) return 'You do not own this yet.';
  if (!emotePace(game, s)) return 'Not so fast: one emote at a time.';
  game.emit({ k: 'emote', ship: ship.id, e: e.id }, ship.state.x, ship.state.y);
  emoteSay(game, s, e.id);
  return null;
}

// ------------------------------------------------------------------------------------------------ the view

export function cosView(game: Game, s: PlayerSession): CosView {
  const st = cosState(game, s.accountId);
  return { own: [...ownedSet(game, s.accountId)], eq: { ...st.eq }, stats: statsOf(game, s) };
}

export function sendCos(game: Game, s: PlayerSession): void {
  if (s.profile) game.sendTo(s, { t: 'cos', view: cosView(game, s) });
}

/** Her client's word to the wardrobe. */
export function cosMessage(game: Game, s: PlayerSession, msg: { action?: string; slot?: unknown; id?: unknown }): void {
  if (!s.profile) return;
  let why: string | null = null;
  if (msg.action === 'equip') why = equipCos(game, s, String(msg.slot ?? ''), msg.id === null || msg.id === undefined ? null : String(msg.id));
  else if (msg.action === 'emote') {
    why = sendEmote(game, s, String(msg.id ?? ''));
    if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
    return;
  } else checkEarned(game, s);
  if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  sendCos(game, s);
}

// ------------------------------------------------------------------------------------------------ the admin

/** `/cos`: what she has and wears; `all`: every thing hers; `wear slot id`; `reset`: all forgotten. */
export function adminCos(game: Game, s: PlayerSession, args: string[]): string {
  const st = cosState(game, s.accountId);
  switch (args[0]) {
    case undefined: {
      const worn = EQUIP_SLOTS.filter((k) => st.eq[k]).map((k) => `${k} ${st.eq[k]}`).join(', ') || '—';
      return `Cosmetics: ${ownedSet(game, s.accountId).size} yours; worn: ${worn}.`;
    }
    case 'all':
      st.own = COS_KINDS.flatMap((k) => COS_TABLES[k].map(cosKey)).filter((k) => !FREE_KEYS.includes(k));
      save(game, s.accountId, st);
      sendCos(game, s);
      return 'Every cosmetic is yours.';
    case 'wear': {
      const why = equipCos(game, s, String(args[1] ?? ''), args[2] && args[2] !== 'off' ? String(args[2]) : null);
      sendCos(game, s);
      return why ?? `Cosmetics: ${ownedSet(game, s.accountId).size} yours; worn: ${EQUIP_SLOTS.filter((k) => st.eq[k]).map((k) => `${k} ${st.eq[k]}`).join(', ') || '—'}.`;
    }
    case 'reset':
      st.own = [];
      st.eq = { ...NO_EQUIP };
      save(game, s.accountId, st);
      dressShip(game, s);
      sendCos(game, s);
      return 'Your cosmetics are forgotten.';
    default:
      return 'Usage: /cos [all|wear slot id|reset]';
  }
}
