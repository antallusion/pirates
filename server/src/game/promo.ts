// Personal offers (owner, 2026-10-15: «нужно везде продвигать свои пакеты с обратным отсчетом. если на острове какой-то
// пакет предлагать который для острова, в море - на море и абордажные пакеты, всегда рандомно типа со скидками
// небольшими и успей купить … с возможностью закрыть офферы. и при входе в игру разворачивать офферы»). Every captain
// keeps one offer for each of three contexts — the island, the sea, the boarding: a pack of the shop's own shelves
// (shared/src/data/shop.ts) at 10–30 % off, its price on the shop's ×90 grid and never under 290 nor over 9 900, for
// 2 to 24 hours, once. Bought or run out, the context rests 20–60 minutes, and a new one rolls in. The dice are the
// captain's own (her account and the offer's number), so the server alone decides; a purchase goes through the shop's
// own checks and its purchase ids (shop.ts buyOffer). The shop's specials — the starter, a level's gift, the first
// top-up's double, the week's chest, the subscription — join the cards while they are hers to take. Each card may be
// closed where it shows; the entry carousel comes once a day. What is shown, closed and bought is counted (`/offers
// stats`), the account's number the only thing about her kept.

import { OFFERS, PRICE_MAX, PRICE_MIN, SHOP } from '../../../shared/src/data/shop.ts';
import type { PromoCard, PromoCtx, PromoPlace, PromoView } from '../../../shared/src/premiumproto.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { dayOf } from '../../../shared/src/data/shop.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { buyOffer, offerShut, shopView } from './shop.ts';
import { ownIsland } from './estate.ts';
import { liveGlobals, opsOf, opsPrice, opsShut, promoTune } from './liveops.ts'; // docs/34: the live ops' panel

const H = 3_600_000;
const MIN = 60_000;
export const PROMO_CTXS: PromoCtx[] = ['isle', 'sea', 'board'];
/** The discounts a personal offer is drawn from, and the hours it runs. */
export const PROMO_OFFS = [10, 15, 20, 25, 30];
export const PROMO_HOURS: [number, number] = [2, 24];
/** The rest of a context after its offer is bought or has run out (minutes). */
export const PROMO_REST: [number, number] = [20, 60];
/** How often the entry carousel comes: 'day' (once a UTC day), 'session' (every coming aboard) or 'off'. */
export let PROMO_CAROUSEL: 'day' | 'session' | 'off' = 'day';
export function setPromoCarousel(v: 'day' | 'session' | 'off'): void {
  PROMO_CAROUSEL = v;
}
/** The offers' dials now: the live ops' panel's (docs/34), or the game's own above. */
export function promoDials(game: Game): { offs: number[]; maxOff: number; hours: [number, number]; rest: [number, number]; carousel: 'day' | 'session' | 'off' } {
  const t = promoTune(game);
  if (!t) return { offs: PROMO_OFFS, maxOff: 30, hours: PROMO_HOURS, rest: PROMO_REST, carousel: PROMO_CAROUSEL };
  const offs: number[] = [];
  for (let x = t.offMin; x < t.offMax; x += 5) offs.push(x);
  offs.push(t.offMax);
  return { offs, maxOff: t.offMax, hours: [t.hoursMin, t.hoursMax], rest: [t.restMin, t.restMax], carousel: t.carousel };
}

/** Places the cards show in. */
const PLACES: PromoPlace[] = ['entry', 'isle', 'sea', 'port', 'board'];

/** The shop's offers a context's personal offer is drawn from: the context's own shelves (the sea's and the boarding's
 *  by their tab; the island's), single packs with no limit of their own, dear enough that 30 % off stays at 290 or
 *  more — never a bundle, a brigade for good, the charter of removal, the infirmary, a pardon, a map or a find. */
export const PROMO_POOL: Record<PromoCtx, string[]> = (() => {
  const out: Record<PromoCtx, string[]> = { isle: [], sea: [], board: [] };
  const skip = new Set(['bperm', 'move', 'refill', 'pardon', 'map', 'art', 'looks', 'crew']);
  for (const f of SHOP) {
    if (f.sec === 'deals' || skip.has(f.id)) continue;
    const ctx: PromoCtx = f.tabs[0] === 'isle' ? 'isle' : f.tabs[0] === 'board' ? 'board' : 'sea';
    for (const o of f.offers) if (!o.limit && o.price * 0.7 >= PRICE_MIN) out[ctx].push(o.id);
  }
  return out;
})();

/** A price on the shop's grid (…90), not above `x`, kept within the shop's range. */
export function grid90(x: number): number {
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.floor((x - 90) / 100) * 100 + 90));
}

/** The promo's price for an offer at a discount: on the grid, and the discount it really gives within 10–30 %. */
export function promoPrice(was: number, off: number, maxOff = 30): { price: number; off: number } {
  let price = grid90(was * (1 - off / 100));
  while (price >= was) price -= 100;
  while (1 - price / was > maxOff / 100 + 1e-9 && price + 100 < was) price += 100;
  price = Math.max(PRICE_MIN, price);
  return { price, off: Math.round((1 - price / was) * 100) };
}

export interface PromoOffer {
  id: string;
  offer: string;
  ctx: PromoCtx;
  price: number;
  was: number;
  off: number;
  at: number;
  until: number;
  closed: PromoPlace[];
}

interface PromoState {
  seq: number;
  slots: Record<PromoCtx, { o: PromoOffer | null; next: number }>;
  /** The day the entry carousel was last seen. */
  carousel: number;
}

const states = new WeakMap<Game, Map<number, PromoState>>();
const key = (acc: number) => `promo:${acc}`;

function stateOf(game: Game, acc: number): PromoState {
  let m = states.get(game);
  if (!m) states.set(game, (m = new Map()));
  let st = m.get(acc);
  if (!st) {
    const raw = game.db.getKv<PromoState>(key(acc));
    st = { seq: raw?.seq ?? 0, slots: { isle: { o: null, next: 0 }, sea: { o: null, next: 0 }, board: { o: null, next: 0 }, ...(raw?.slots ?? {}) }, carousel: raw?.carousel ?? -1 };
    m.set(acc, st);
  }
  return st;
}

const save = (game: Game, acc: number, st: PromoState) => game.db.setKv(key(acc), st);

/** For the tests: her offers forgotten (read again from the kv table). */
export function forgetPromo(game: Game): void {
  states.delete(game);
}

/** The dice of a captain's offer: her account and its number. */
function dice(acc: number, seq: number): Rng {
  return new Rng(((acc * 2_654_435_761) ^ (seq * 40_503) ^ 0x9e3779b9) >>> 0);
}

/** A new offer for a context, drawn among those she can have now (the purse and a fight aside); null: none fits. */
function roll(game: Game, s: PlayerSession, st: PromoState, ctx: PromoCtx): PromoOffer | null {
  // the island's goods only for a captain with an island (her brigades and speed-ups wait for one otherwise)
  if (ctx === 'isle' && !ownIsland(game, s.accountId)) return null;
  const pool = PROMO_POOL[ctx].filter((id) => {
    const why = offerShut(game, s, OFFERS.get(id)!.offer);
    return why === null || why === 'fight';
  });
  if (!pool.length) return null;
  const r = dice(s.accountId, ++st.seq);
  const base = OFFERS.get(r.pick(pool))!.offer;
  const d = promoDials(game);
  const was = opsPrice(game, base); // (the shop's price now: the catalog's, or the panel's own and its sale)
  const { price, off } = promoPrice(was, r.pick(d.offs), d.maxOff);
  const now = game.wallNow();
  return { id: `po${st.seq}`, offer: base.id, ctx, price, was, off, at: now, until: now + r.int(d.hours[0], d.hours[1]) * H, closed: [] };
}

/** Her offers brought up to now: the run-out ones gone (the context resting), the rested ones rolled. Whether any changed. */
export function rotatePromos(game: Game, s: PlayerSession): boolean {
  if (!s.authed || !s.profile) return false;
  const st = stateOf(game, s.accountId);
  const now = game.wallNow();
  let changed = false;
  for (const ctx of PROMO_CTXS) {
    const slot = st.slots[ctx];
    if (slot.o && slot.o.until <= now) {
      slot.o = null;
      const rest = promoDials(game).rest;
      slot.next = now + dice(s.accountId, st.seq + 7).int(rest[0], rest[1]) * MIN;
      changed = true;
    }
    if (!slot.o && now >= slot.next) {
      slot.o = roll(game, s, st, ctx);
      if (!slot.o && ctx === 'isle' && !ownIsland(game, s.accountId)) continue; // (no island yet: one rolls when she has one)
      if (!slot.o) slot.next = now + 10 * MIN; // nothing fits her now: look again later
      changed = true;
    }
  }
  if (changed) save(game, s.accountId, st);
  return changed;
}

/** Specials closed this session (they come back with the next session). */
const closedSpecial = new WeakMap<PlayerSession, Map<string, Set<PromoPlace>>>();
/** Cards seen this session in a place (counted once). */
const seenNow = new WeakMap<PlayerSession, Set<string>>();

/** Her cards: the personal offers, then the shop's specials while they are hers to take. */
export function promoView(game: Game, s: PlayerSession): PromoView {
  rotatePromos(game, s);
  const st = stateOf(game, s.accountId);
  const now = game.wallNow();
  const cards: PromoCard[] = [];
  for (const ctx of PROMO_CTXS) {
    const o = st.slots[ctx].o;
    if (o) cards.push({ id: o.id, offer: o.offer, ctx, price: o.price, was: o.was, off: o.off, until: o.until, why: offerShut(game, s, OFFERS.get(o.offer)!.offer), closed: [...o.closed] });
  }
  const sv = shopView(game, s);
  const cl = (id: string) => [...(closedSpecial.get(s)?.get(id) ?? [])];
  const special = (offer: string, kind: PromoCard['special'], until = 0) => {
    const o = OFFERS.get(offer)!.offer;
    if (opsShut(game, offer)) return; // (off the shelves by the live ops' panel: docs/34)
    cards.push({ id: `sp:${offer}`, offer, ctx: 'all', price: opsPrice(game, o), was: o.worth ?? o.price, off: o.worth ? Math.round((1 - o.price / o.worth) * 100) : 0, until, why: sv.why[offer] === 'poor' ? null : sv.why[offer] ?? null, closed: cl(`sp:${offer}`), special: kind });
  };
  if (sv.firstPay) cards.push({ id: 'sp:first', offer: '', ctx: 'all', price: 0, was: 0, off: 0, until: 0, why: null, closed: cl('sp:first'), special: 'first' });
  if (sv.why.starter !== 'limit') special('starter', 'starter');
  for (const g of sv.gifts) special(g.id, 'level', g.until);
  if (sv.why.weekly !== 'limit') special('weekly', 'weekly', ((Math.floor((dayOf(now) + 3) / 7) + 1) * 7 - 3) * 86_400_000); // (to the week's end, Monday 00:00 UTC)
  if (!sv.boosts.sub) special('sub30', 'sub');
  // The live ops' global offers (docs/34): one offer for every captain at its own price, so many times a player.
  const ops = opsOf(game);
  for (const g of ops ? liveGlobals(game) : []) {
    if (ops!.globalBuys(g.id, s.accountId) >= g.limit) continue;
    const o = OFFERS.get(g.offer)!.offer;
    const was = Math.max(opsPrice(game, o), g.price);
    const why = offerShut(game, s, o);
    if (why === 'gone') continue;
    cards.push({ id: `gl:${g.id}`, offer: g.offer, ctx: 'all', price: g.price, was, off: Math.round((1 - g.price / was) * 100), until: g.to, why, closed: cl(`gl:${g.id}`), special: 'global' });
  }
  const today = dayOf(now);
  const car = promoDials(game).carousel;
  return { now, cards, carousel: car === 'session' ? !seenNow.get(s)?.has('carousel') : car === 'day' && st.carousel < today };
}

export function sendPromo(game: Game, s: PlayerSession): void {
  if (s.authed && s.profile) game.sendTo(s, { t: 'promo', view: promoView(game, s) });
}

const lastStep = new WeakMap<PlayerSession, number>();

/** Every second for a captain aboard (from stepShop's call): every ten seconds, her offers rotated, and sent if changed. */
export function stepPromo(game: Game, s: PlayerSession): void {
  const now = game.wallNow();
  if (now - (lastStep.get(s) ?? 0) < 10_000) return;
  lastStep.set(s, now);
  if (rotatePromos(game, s)) sendPromo(game, s);
}

// ------------------------------------------------------------------------------------------------ the owner's figures

interface Figures {
  seen: number;
  closed: number;
  bought: number;
  doubloons: number;
}
const figs = new WeakMap<Game, Record<string, Figures>>();

function figures(game: Game): Record<string, Figures> {
  let f = figs.get(game);
  if (!f) figs.set(game, (f = game.db.getKv<Record<string, Figures>>('promo:stats') ?? {}));
  return f;
}

/** A card's figure counted (by the shop's offer it sells, or the special's), and its row in the ledger. */
function tally(game: Game, s: PlayerSession, card: string, what: keyof Figures, n = 1, where = ''): void {
  const f = figures(game);
  const r = (f[card] ??= { seen: 0, closed: 0, bought: 0, doubloons: 0 });
  r[what] += n;
  game.db.setKv('promo:stats', f);
  if (what === 'seen' || what === 'closed') game.db.ledger(s.accountId, `doubloons_promo_${what}`, 0, `${card}:${where}`.slice(0, 120));
}

/** The figures by card (`po:<offer>`, `sp:<offer>`, `gl:<id>`), for the live ops' panel (docs/34). */
export function promoFigures(game: Game): Record<string, Figures> {
  return figures(game);
}

/** `/offers stats`: what is shown, closed and bought, by the offer. */
export function promoStats(game: Game): string {
  const f = figures(game);
  const rows = Object.entries(f).sort((a, b) => b[1].doubloons - a[1].doubloons || b[1].seen - a[1].seen);
  if (!rows.length) return 'Offers: nothing shown yet.';
  return `Offers (shown / closed / bought / doubloons): ${rows.slice(0, 20).map(([k, v]) => `${k} ${v.seen}/${v.closed}/${v.bought}/${v.doubloons}`).join(' · ')}`;
}

/** The card a personal offer id or a special names. */
const cardKey = (st: PromoState, id: string): string | null => {
  if (id.startsWith('sp:') || id.startsWith('gl:')) return id;
  for (const ctx of PROMO_CTXS) if (st.slots[ctx].o?.id === id) return `po:${st.slots[ctx].o!.offer}`;
  return null;
};

// ------------------------------------------------------------------------------------------------ her word

/** A personal offer bought at its own price, once: the shop's checks and purchase id; the context then rests. */
export function buyPromo(game: Game, s: PlayerSession, id: string, pid: string): string | null {
  if (!s.authed || !s.profile) return 'Not for sale';
  if (id.startsWith('gl:')) return buyGlobal(game, s, id, pid);
  rotatePromos(game, s);
  const st = stateOf(game, s.accountId);
  const ctx = PROMO_CTXS.find((c) => st.slots[c].o?.id === id);
  if (!ctx) return 'This offer is gone.';
  const o = st.slots[ctx].o!;
  const now = game.wallNow();
  const why = buyOffer(game, s, o.offer, pid, {
    price: o.price,
    tag: `promo:${o.id}`,
    done: () => {
      const rest = promoDials(game).rest;
      st.slots[ctx] = { o: null, next: now + dice(s.accountId, st.seq + 3).int(rest[0], rest[1]) * MIN };
      save(game, s.accountId, st);
    },
  });
  if (!why && !st.slots[ctx].o) {
    const f = figures(game);
    const r = (f[`po:${o.offer}`] ??= { seen: 0, closed: 0, bought: 0, doubloons: 0 });
    r.bought++;
    r.doubloons += o.price;
    game.db.setKv('promo:stats', f);
  }
  return why;
}

/** A global offer of the live ops' panel bought at its price (docs/34): within its limit a player, the shop's checks
 *  and purchase id (the ledger's `shop:global:<id>:<pid>`). */
function buyGlobal(game: Game, s: PlayerSession, id: string, pid: string): string | null {
  const ops = opsOf(game);
  const g = liveGlobals(game).find((x) => `gl:${x.id}` === id);
  if (!ops || !g) return 'This offer is gone.';
  if (ops.globalBuys(g.id, s.accountId) >= g.limit) return 'Bought as often as it may be for now.';
  let ok = false;
  const why = buyOffer(game, s, g.offer, pid, { price: g.price, tag: `global:${g.id}`, done: () => (ok = true) });
  if (ok) {
    ops.globalBought(g.id, s.accountId);
    const f = figures(game);
    const r = (f[id] ??= { seen: 0, closed: 0, bought: 0, doubloons: 0 });
    r.bought++;
    r.doubloons += g.price;
    game.db.setKv('promo:stats', f);
  }
  return why;
}

/** A card closed in a place: it hides there (a personal offer until it is gone, a special for this session). */
export function closePromo(game: Game, s: PlayerSession, id: string, where: PromoPlace): void {
  if (!PLACES.includes(where)) return;
  const st = stateOf(game, s.accountId);
  const k = cardKey(st, String(id));
  if (!k) return;
  if (id.startsWith('sp:') || id.startsWith('gl:')) {
    let m = closedSpecial.get(s);
    if (!m) closedSpecial.set(s, (m = new Map()));
    const set = m.get(id) ?? new Set<PromoPlace>();
    if (set.has(where)) return;
    set.add(where);
    m.set(id, set);
  } else {
    const o = PROMO_CTXS.map((c) => st.slots[c].o).find((x) => x?.id === id)!;
    if (o.closed.includes(where)) return;
    o.closed.push(where);
    save(game, s.accountId, st);
  }
  tally(game, s, k, 'closed', 1, where);
}

/** A card seen in a place: counted once a session. */
export function seenPromo(game: Game, s: PlayerSession, id: string, where: PromoPlace): void {
  if (!PLACES.includes(where)) return;
  const st = stateOf(game, s.accountId);
  const k = cardKey(st, String(id));
  if (!k) return;
  let set = seenNow.get(s);
  if (!set) seenNow.set(s, (set = new Set()));
  if (set.has(`${id}:${where}`) || set.size > 200) return;
  set.add(`${id}:${where}`);
  tally(game, s, k, 'seen', 1, where);
}

/** Her client's word on the offers (the view comes back after it). */
export function promoMessage(game: Game, s: PlayerSession, msg: { action: string; id?: string; pid?: string; where?: string }): void {
  if (msg.action === 'promo_buy') {
    const why = buyPromo(game, s, String(msg.id ?? ''), String(msg.pid ?? ''));
    if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  } else if (msg.action === 'promo_close') closePromo(game, s, String(msg.id ?? ''), msg.where as PromoPlace);
  else if (msg.action === 'promo_seen') return seenPromo(game, s, String(msg.id ?? ''), msg.where as PromoPlace);
  else if (msg.action === 'promo_carousel') {
    const st = stateOf(game, s.accountId);
    st.carousel = dayOf(game.wallNow());
    save(game, s.accountId, st);
    let set = seenNow.get(s);
    if (!set) seenNow.set(s, (set = new Set()));
    set.add('carousel');
  }
  sendPromo(game, s);
}

/** `/offers [stats|roll|carousel]`: the owner's figures; her offers rolled anew now; the entry carousel due again. */
export function adminOffers(game: Game, s: PlayerSession, args: string[]): string {
  if (args[0] === 'stats') return promoStats(game);
  const st = stateOf(game, s.accountId);
  if (args[0] === 'roll') {
    for (const ctx of PROMO_CTXS) st.slots[ctx] = { o: null, next: 0 };
    save(game, s.accountId, st);
  } else if (args[0] === 'carousel') {
    st.carousel = -1;
    seenNow.get(s)?.delete('carousel');
    save(game, s.accountId, st);
  }
  sendPromo(game, s);
  const v = promoView(game, s);
  return `Offers: ${v.cards.filter((c) => !c.special).map((c) => `${c.ctx} ${c.offer} ${c.price} (−${c.off}%)`).join(', ') || 'none'}. Usage: /offers [stats|roll|carousel]`;
}
