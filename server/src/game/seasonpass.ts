// «Сезонная карта» on the server (owner, 2026-10-30; the table and the numbers: shared/src/data/seasonpass.ts, the window:
// client/src/ui/seasonpass.ts). Her card is her account's, kept in the kv table (`spass:<account>`):
//  - season experience comes in by one door, seasonXp(game, s, source, amount?) — called from the game's own moments
//    (a contract, a daily order, a quest, a captain beaten, a boarding won, a lair, a boss, a world event's ship, a
//    building of her island, a treasure): each source at most PASS_CAP a UTC day, a captain beaten once in PVP_SAME_H;
//    the same call moves her challenges (three a day, four a week) and pays one done at once;
//  - a tier's reward is taken by her hand (a tier and a track; «Забрать всё»), checked first and written before it is
//    handed over: taken once. Silver into her purse, the island's goods into its yard (silver at their worth with no
//    island), the stores of the shop (speed-ups, scrolls, kits, charms, elixirs) through shop.ts grantGoods, an
//    artifact into her locker, men by letter as a gift's stack (they wait in it for room), the hull into a berth;
//  - the premium track opens with a pass bought for real money (PASS_PRICES): every payment desk (the website's and the
//    web game's YooKassa, Telegram's Stars, VK's votes) credits its roubles as doubloons (premium.ts payIn, the
//    payment's reference) and buys the pass with them at once (passBuy, the same reference): a payment is a pass once,
//    and if the pass can no longer be had (she has it already), the doubloons stay on her account — nothing is lost;
//  - a new season: the rewards she earned and did not take are delivered (silver by letter, men by letter, the
//    account's stores at once, the rest — a map, an artifact, the hull — the next time she is aboard), a letter tells
//    her, and the card starts again. It happens the first time her card is read in the new season, aboard or not.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { GIFT_RES_SILVER } from '../../../shared/src/data/dailygift.ts';
import type { BaseRes } from '../../../shared/src/data/base.ts';
import { dayOf, weekOf } from '../../../shared/src/data/shop.ts';
import type { ShopGrant } from '../../../shared/src/data/shop.ts';
import { STASH_SIZE } from '../../../shared/src/data/items.ts';
import { SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { captainLevelFor, levelRange, shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { premiumFrom } from '../../../shared/src/data/premiumbeasts.ts';
import { hourSilver } from '../../../shared/src/data/xpcurve.ts';
import {
  CHALLENGES, PASS_CAP, PASS_SHIP_DUP, PASS_SOURCES, PASS_TIERS, PASS_XP, PVP_LEVEL_GAP, PVP_SAME_H, SUPER_FRAME, SUPER_TIERS,
  challengeOf, passBounds, passProduct, passProductOpen, passSeason, passSeasonAt, passTier, rollChallenges, tierOf, tierXp, xpToTier,
} from '../../../shared/src/data/seasonpass.ts';
import type { PassKind, PassProductId, PassReward, PassSource } from '../../../shared/src/data/seasonpass.ts';
import type { PassClientMsg, PassView } from '../../../shared/src/spassproto.ts';
import { ownIsland } from './estate.ts';
import { MAX_MAPS, chestCount } from './explorefx.ts';
import type { Game } from './Game.ts';
import { artifactFind } from './hero.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import { creditPremium, move, paymentsOpen, payIn, sendBalance, webPayOpen } from './premium.ts';
import { reckonBase, yardOf } from './base.ts';
import { MAX_BERTHS } from './shipbuilding.ts';
import { accountStandIn, grantGoods } from './shop.ts';
import { cosWhy, grantCos, sendCos } from './cosmetics.ts';
import { trackEvent } from './liveops.ts';

const H = 3_600_000;

// ------------------------------------------------------------------------------------------------ her card

interface Challenges {
  /** The day (UTC) or the week (the shop's) they were drawn for. */
  at: number;
  ids: string[];
  prog: number[];
  done: boolean[];
}

export interface PassState {
  season: number;
  xp: number;
  has: PassKind | null;
  /** The tiers taken, by track. */
  free: number[];
  prem: number[];
  /** The UTC day the counts are of, and the counts of each source today (the caps). */
  day: number;
  count: Partial<Record<PassSource, number>>;
  /** A captain beaten: her account → the wall time she last counted. */
  pvp: Record<string, number>;
  dch: Challenges | null;
  wch: Challenges | null;
  /** Last season's rewards that wait for her aboard (a map, an artifact, the hull). */
  carry: PassReward[];
  /** The tier she was last told of (the toast of a tier up comes once). */
  told: number;
}

const key = (acc: number) => `spass:${acc}`;
const fresh = (season: number): PassState => ({ season, xp: 0, has: null, free: [], prem: [], day: -1, count: {}, pvp: {}, dch: null, wch: null, carry: [], told: 0 });

/** The admin's shift of the seasons (`/pass season next`, a QA server's): kv `spass:shift`. */
const shiftOf = (game: Game): number => Math.max(0, Math.floor(game.db.getKv<number>('spass:shift') ?? 0));

/** The season now on this server. */
export function seasonNow(game: Game): number {
  return passSeasonAt(game.wallNow()) + shiftOf(game);
}

/** The bounds of the season now (an admin's shift moves them by whole seasons past the real one: its end a season on). */
function boundsNow(game: Game): { from: number; until: number } {
  const n = seasonNow(game);
  const real = passSeasonAt(game.wallNow());
  return n === real ? passBounds(n) : { from: game.wallNow(), until: passBounds(real).until + (n - real) * 61 * 24 * H };
}

function read(game: Game, acc: number): PassState | null {
  const raw = game.db.getKv<Partial<PassState>>(key(acc));
  if (!raw || typeof raw.season !== 'number') return null;
  const st = { ...fresh(raw.season), ...raw } as PassState;
  st.free = Array.isArray(st.free) ? st.free.filter((t) => Number.isInteger(t)) : [];
  st.prem = Array.isArray(st.prem) ? st.prem.filter((t) => Number.isInteger(t)) : [];
  st.count ??= {};
  st.pvp ??= {};
  st.carry = Array.isArray(st.carry) ? st.carry : [];
  st.xp = Math.max(0, Math.floor(Number(st.xp) || 0));
  st.has = st.has === 'premium' || st.has === 'super' ? st.has : null;
  return st;
}

function save(game: Game, acc: number, st: PassState): void {
  game.db.setKv(key(acc), st);
}

/** Her card now: made on first sight; a card of a season gone is closed first (its rewards delivered: rollover). */
export function passState(game: Game, acc: number): PassState {
  const now = seasonNow(game);
  const st = read(game, acc);
  if (!st) {
    const f = fresh(now);
    save(game, acc, f);
    return f;
  }
  if (st.season === now) return st;
  return rollover(game, acc, st, now);
}

// ------------------------------------------------------------------------------------------------ the experience

const sessionOf = (game: Game, acc: number): PlayerSession | null => {
  const s = game.sessionByAccount(acc);
  return s?.authed && s.profile ? s : null;
};

/** The day's and the week's challenges brought to today (drawn anew on a new day or week). */
function rollCh(game: Game, acc: number, st: PassState): void {
  const wall = game.wallNow();
  const day = dayOf(wall), week = weekOf(wall);
  const isle = !!ownIsland(game, acc);
  if (!st.dch || st.dch.at !== day) {
    const ids = rollChallenges(acc, 'day', day, isle);
    st.dch = { at: day, ids, prog: ids.map(() => 0), done: ids.map(() => false) };
  }
  if (!st.wch || st.wch.at !== week) {
    const ids = rollChallenges(acc, 'week', week, isle);
    st.wch = { at: week, ids, prog: ids.map(() => 0), done: ids.map(() => false) };
  }
}

/**
 * The hook (owner, 2026-10-30): a substantial thing done by a captain aboard — season experience from `source` (its
 * table's amount, or `amount`), within the day's cap, and her challenges moved. Called from the game's own moments
 * (Game.ts creditKill and completeContract, dailies.ts, quests.ts, campaign.ts, beastlairs.ts, bosses.ts,
 * zonebosses.ts, shorebosses.ts, explorefx.ts, base.ts). Never throws.
 */
export function seasonXp(game: Game, s: PlayerSession | null | undefined, source: PassSource, amount?: number): void {
  if (!s?.authed || !s.accountId) return;
  addPassXp(game, s.accountId, source, amount, s);
}

/** The same for an account (her island's builders finish while she is away). The experience added. */
export function addPassXp(game: Game, acc: number, source: PassSource, amount?: number, s: PlayerSession | null = sessionOf(game, acc)): number {
  if (!PASS_SOURCES.includes(source) || !(acc > 0)) return 0;
  try {
    const st = passState(game, acc);
    const day = dayOf(game.wallNow());
    if (st.day !== day) {
      st.day = day;
      st.count = {};
    }
    const before = tierOf(st.xp).tier;
    let gained = 0;
    const had = st.count[source] ?? 0;
    st.count[source] = had + 1;
    if (had < PASS_CAP[source]) {
      const n = Math.max(0, Math.round(amount ?? PASS_XP[source]));
      st.xp += n;
      gained += n;
    }
    // the challenges count every one, capped or not (each needs a handful; the cap is the experience's)
    rollCh(game, acc, st);
    const done: { id: string; xp: number }[] = [];
    for (const c of [st.dch!, st.wch!]) {
      c.ids.forEach((id, i) => {
        const d = challengeOf(id);
        if (!d || c.done[i] || !d.src.includes(source)) return;
        c.prog[i] = Math.min(d.need, c.prog[i] + 1);
        if (c.prog[i] < d.need) return;
        c.done[i] = true;
        st.xp += d.xp;
        gained += d.xp;
        done.push({ id, xp: d.xp });
      });
    }
    st.xp = Math.min(st.xp, xpToTier(PASS_TIERS) + 1_000_000);
    const after = tierOf(st.xp).tier;
    save(game, acc, st);
    if (s) {
      for (const d of done) game.sendTo(s, { t: 'toast', msg: `Season challenge done: ${challengeOf(d.id)!.text[0].replace('{n}', String(challengeOf(d.id)!.need))} (+${d.xp} season XP).`, kind: 'gold' });
      if (after > before && after > st.told) tierUp(game, s, st, after);
      sendPass(game, s);
    }
    return gained;
  } catch (e) {
    game.log(`[spass] ${(e as Error).message}`);
    return 0;
  }
}

function tierUp(game: Game, s: PlayerSession, st: PassState, tier: number): void {
  st.told = tier;
  save(game, s.accountId, st);
  const waiting = claimable(st) > 0;
  game.sendTo(s, { t: 'toast', msg: waiting ? `Season card: tier ${tier}! Rewards are waiting.` : `Season card: tier ${tier}!`, kind: 'gold' });
}

/** A captain beaten (sunk or boarded): her level not much below the victor's, and not the same one again within
 *  PVP_SAME_H. Whether it counted. */
export function passPvp(game: Game, s: PlayerSession, victimAcc: number | null, victimLevel: number): boolean {
  if (!s.authed || !s.profile || !victimAcc || victimAcc === s.accountId) return false;
  if (victimLevel < s.profile.level - PVP_LEVEL_GAP) return false;
  const st = passState(game, s.accountId);
  const wall = game.wallNow();
  const last = st.pvp[String(victimAcc)] ?? -Infinity;
  if (wall - last < PVP_SAME_H * H) return false;
  // (the old ones forgotten: the list stays small)
  for (const [k, t] of Object.entries(st.pvp)) if (wall - t >= PVP_SAME_H * H) delete st.pvp[k];
  st.pvp[String(victimAcc)] = wall;
  save(game, s.accountId, st);
  seasonXp(game, s, 'pvp');
  return true;
}

// ------------------------------------------------------------------------------------------------ the rewards

/** Silver of `min` minutes of the sea at a ship level (at least 100, in tens). */
export const silverOf = (min: number, shipLevel: number): number => Math.max(100, Math.round((hourSilver(shipLevel) * min) / 60 / 10) * 10);

/** The island's goods' worth in silver for a captain with no island (the daily gift's table; provisions as timber). */
const RES_SILVER: Record<BaseRes, number> = { ...GIFT_RES_SILVER, provisions: 4 };

/** The shop's goods a reward is (null: not one of them). */
function shopGrantOf(r: PassReward): ShopGrant | null {
  switch (r.k) {
    case 'speed': return { k: 'speed', min: r.min };
    case 'map': return { k: 'map', n: r.n };
    case 'scrolls': return { k: 'scrolls', n: r.n };
    case 'kit': return { k: 'kit', n: r.n };
    case 'charm': return { k: 'charm', n: r.n };
    case 'xp': return { k: 'xp', hours: r.hours };
    case 'wind': return { k: 'wind', hours: r.hours };
    case 'prod': return { k: 'prod', hours: r.hours };
    case 'rscroll': return { k: 'rscroll', n: r.n };
    default: return null;
  }
}

/** Whether she owns a hull of this class (sailing her or berthed). */
function ownsHull(s: PlayerSession, c: ShipClassId): boolean {
  return s.ship?.loadout.classId === c || !!s.profile?.berths.some((b) => b.loadout.classId === c);
}

/** Why these rewards cannot be handed over to her aboard now (null: they can) — what she can mend: room in her
 *  locker or her chest of maps, a berth, her level for the hull. Things she has already (a cosmetic, the most of a
 *  store) are passed over, not refused. */
function rewardsWhy(game: Game, s: PlayerSession, rs: readonly PassReward[]): string | null {
  const p = s.profile!;
  let arts = 0, maps = 0;
  for (const r of rs) {
    if (r.k === 'art') arts++;
    else if (r.k === 'map') maps += r.n;
    // men of a tier serve a ship of its level and up, as the shop sells them (premium.ts unitWhy): the Super Pass's
    // twenty tiers never put tier 4–5 men on a newcomer's sloop
    else if (r.k === 'units' && UNITS[r.u] && (s.ship?.shipLevel ?? 1) < premiumFrom(UNITS[r.u].tier)) return `Creatures of tier ${UNITS[r.u].tier} serve a ship of level ${premiumFrom(UNITS[r.u].tier)} and up.`;
    else if (r.k === 'ship' && !ownsHull(s, r.c)) {
      const lv = captainLevelFor(levelRange(r.c)[0]);
      if (p.level < lv) return `Captain level ${lv} is needed to command her.`;
      if (p.berths.length >= MAX_BERTHS) return `You already berth ${MAX_BERTHS} ships — sell or take one out first.`;
    }
  }
  if (arts && p.stash.length + arts > STASH_SIZE) return 'Your locker is full: make room for the artifact first.';
  if (maps && chestCount(p.explore.maps) + maps > MAX_MAPS) return 'Your chest of maps is full: dig one up first.';
  return null;
}

/** The goods of the shop's kinds handed over one by one (one at its most is passed over, not the rest). */
function giveGoods(game: Game, s: PlayerSession, grants: ShopGrant[], tag: string): void {
  for (const g of grants) grantGoods(game, s, [g], tag);
}

/** Rewards handed over to her aboard (every check made: rewardsWhy). */
function giveAboard(game: Game, s: PlayerSession, rs: readonly PassReward[], tag: string): void {
  const p = s.profile!;
  const shipLv = s.ship?.shipLevel ?? 1;
  const goods: ShopGrant[] = [];
  let silver = 0;
  const isle = ownIsland(game, s.accountId);
  for (const r of rs) {
    switch (r.k) {
      case 'silver':
        silver += silverOf(r.min, shipLv);
        break;
      case 'res':
        if (isle) {
          reckonBase(game, isle);
          const y = yardOf(game, isle);
          y.res[r.good] = (y.res[r.good] ?? 0) + r.n;
          game.holdings.touch();
        } else silver += r.n * RES_SILVER[r.good];
        break;
      case 'cos':
        if (!cosWhy(game, s.accountId, [r.key])) {
          grantCos(game, s, [r.key]);
          sendCos(game, s);
        }
        break;
      case 'units':
        sendMen(game, s.accountId, r.u, r.n);
        break;
      case 'art':
        artifactFind(game, s, 'chest', r.id);
        break;
      case 'ship':
        if (ownsHull(s, r.c)) giveAboard(game, s, PASS_SHIP_DUP, `${tag}:dup`);
        else berthHull(game, s, r.c);
        break;
      default: {
        const g = shopGrantOf(r);
        if (g) goods.push(g);
      }
    }
  }
  if (silver > 0) {
    p.gold += silver;
    game.db.ledger(s.accountId, 'season_pass', silver, tag);
  }
  giveGoods(game, s, goods, tag);
  game.saveSession(s);
  game.pushSelf(s, true);
}

/** The men of a reward by letter: a gift's stack of their own, waiting in the letter for a slot and the hammocks. */
function sendMen(game: Game, acc: number, u: UnitId, n: number): void {
  if (!UNITS[u]) return;
  deliver(game, acc, {
    from: 'The season card', subject: 'Season card reward',
    body: 'Men of the season card: a stack of their own. Collect this letter in any port; if there is no room aboard, make room in the Crew window.',
    gold: 0, goods: null, units: { u, n, gift: 1 },
  });
}

/** The hull of the 100th tier into a berth of the port she lies in (or her last): she takes her out at the yard. */
function berthHull(game: Game, s: PlayerSession, c: ShipClassId): void {
  const p = s.profile!;
  const cls = SHIP_CLASSES[c];
  const port = s.ship?.docked ?? p.lastPort;
  const gun = defaultGunFor(cls);
  p.berths.push({ port, loadout: { classId: c, name: cls.name, guns: { port: gun, starboard: gun }, modules: {}, mount: cls.fixedMount }, hull: 1 });
  game.db.ledger(s.accountId, 'season_pass_ship', 0, c);
  game.sendTo(s, { t: 'toast', msg: `The ${cls.name} waits for you in her berth at ${game.portById(port)?.name ?? port}: take her out at the yard.`, kind: 'gold' });
  if (s.ship?.docked) game.pushPort(s);
}

/** The rewards of a tier and a track. */
const rewardsOf = (season: number, t: number, track: 'free' | 'premium'): PassReward[] => passTier(season, t)?.[track] ?? [];

/** How many tier-and-track rewards wait for her (her badge). */
export function claimable(st: PassState): number {
  const tier = tierOf(st.xp).tier;
  let n = 0;
  for (let t = 1; t <= tier; t++) {
    if (rewardsOf(st.season, t, 'free').length && !st.free.includes(t)) n++;
    if (st.has && rewardsOf(st.season, t, 'premium').length && !st.prem.includes(t)) n++;
  }
  return n;
}

/** A tier's reward of a track taken by her hand. Null: taken; else why not (nothing moved). */
export function claimTier(game: Game, s: PlayerSession, t: number, track: 'free' | 'premium', quiet = false): string | null {
  if (!s.authed || !s.profile) return 'Not in the middle of a fight.';
  const st = passState(game, s.accountId);
  const tier = Math.floor(Number(t));
  if (!(tier >= 1 && tier <= PASS_TIERS)) return 'That tier is not reached yet.';
  if (tier > tierOf(st.xp).tier) return 'That tier is not reached yet.';
  if (track === 'premium' && !st.has) return 'The premium track needs the Premium Pass.';
  const list = track === 'free' ? st.free : st.prem;
  if (list.includes(tier)) return 'That reward is taken already.';
  const rs = rewardsOf(st.season, tier, track);
  if (!rs.length) return 'Nothing to take yet.';
  const why = rewardsWhy(game, s, rs);
  if (why) return why;
  // written before it is handed over: a second message, a second tab take nothing more
  list.push(tier);
  save(game, s.accountId, st);
  giveAboard(game, s, rs, `spass:${st.season}:${tier}:${track}`);
  trackEvent(game, s.accountId, 'spass_claim', { amount: tier, product: track });
  if (!quiet) game.sendTo(s, { t: 'toast', msg: `Season card rewards taken: tier ${tier}.`, kind: 'gold' });
  return null;
}

/** Every reward that waits, taken (those that cannot be now — a full locker, the hull's berth — stay). How many, and
 *  the first refusal. */
export function claimAll(game: Game, s: PlayerSession): { n: number; why: string | null } {
  const st = passState(game, s.accountId);
  const tier = tierOf(st.xp).tier;
  let n = 0;
  let first: string | null = null;
  for (let t = 1; t <= tier; t++) {
    for (const track of ['free', 'premium'] as const) {
      if (track === 'premium' && !st.has) continue;
      const fresh = passState(game, s.accountId);
      if ((track === 'free' ? fresh.free : fresh.prem).includes(t) || !rewardsOf(st.season, t, track).length) continue;
      const why = claimTier(game, s, t, track, true);
      if (why) first ??= why;
      else n++;
    }
  }
  return { n, why: first };
}

// ------------------------------------------------------------------------------------------------ the pass bought

/** The pass this season bought with doubloons already on her account (the payment desks credit a payment's roubles as
 *  doubloons first — premium.ts payIn — then this buys it with them under the payment's own reference): the doubloons
 *  and the ledger's row together, once by the reference. Null: hers (or hers already by this very reference); else why
 *  not (the doubloons stay on her account). */
export function passBuy(game: Game, acc: number, productId: PassProductId, ref: string): string | null {
  const p = passProduct(productId);
  if (!p) return 'Not for sale';
  const st = passState(game, acc);
  const detail = `spass:${st.season}:${p.id}:${String(ref).slice(0, 80)}`;
  if (game.db.doubloonRef(acc, 'doubloons_buy', detail)) return null;
  if (!passProductOpen(p, st.has)) return `You hold this pass already: its ${p.rub} doubloons are on your account.`;
  let ok = false;
  const bal = move(game, acc, -p.rub, 'doubloons_buy', detail, () => {
    grantPass(game, acc, st, p.grants);
    ok = true;
  });
  if (bal === null || !ok) return 'Not enough doubloons: top up your account first.';
  trackEvent(game, acc, 'buy', { amount: p.rub, product: p.id });
  afterPass(game, acc, p.grants);
  return null;
}

/** The pass laid on her card (inside the purchase's transaction): the premium track; the super pass's tiers and frame. */
function grantPass(game: Game, acc: number, st: PassState, kind: PassKind): void {
  const was = st.has;
  st.has = kind === 'super' || was === 'super' ? 'super' : 'premium';
  if (kind === 'super' && was !== 'super') {
    const cur = tierOf(st.xp);
    const to = Math.min(PASS_TIERS, cur.tier + SUPER_TIERS);
    st.xp = to >= PASS_TIERS ? Math.max(st.xp, xpToTier(PASS_TIERS)) : xpToTier(to) + Math.min(cur.into, tierXp(to + 1) - 1);
    const s = game.sessionByAccount(acc);
    grantCos(game, s?.authed ? s : accountStandIn(acc), [SUPER_FRAME]);
  }
  save(game, acc, st);
}

function afterPass(game: Game, acc: number, kind: PassKind): void {
  const s = sessionOf(game, acc);
  if (!s) return;
  const st = passState(game, acc);
  sendBalance(game, s);
  if (kind === 'super') sendCos(game, s);
  game.sendTo(s, { t: 'toast', msg: st.has === 'super' ? `Super Pass is yours for this season: +${SUPER_TIERS} tiers and the Abyssal frame!` : 'Premium Pass is yours for this season!', kind: 'gold' });
  st.told = Math.max(st.told, tierOf(st.xp).tier);
  save(game, acc, st);
  sendPass(game, s);
}

/** A payment of real money for a pass (every desk: `web:<order>`, `tg:<charge>`, `vk:<order>`): its roubles in as
 *  doubloons, then the pass bought with them, once by the reference. Null: the pass is hers; a refusal: the doubloons
 *  are on her account instead (she is told). `rub`: the revenue the live ops count (0 for a test payment). */
export function passPaid(game: Game, acc: number, productId: PassProductId, ref: string, rub: number): string | null {
  const p = passProduct(productId);
  if (!p) return 'Not for sale';
  if (payIn(game, acc, p.rub, rub, p.id, ref, true) === null) return 'No such account';
  const why = passBuy(game, acc, p.id, ref);
  if (why) {
    const s = sessionOf(game, acc);
    if (s) {
      sendBalance(game, s);
      game.sendTo(s, { t: 'toast', msg: why, kind: 'info' });
    }
  }
  return why;
}

/** A pass's payment refunded (Telegram's /refund): the pass taken back as it was before it (the super's tiers stay —
 *  experience is never taken), and its doubloons put back for the chargeback to take. The doubloons put back. */
export function passRefund(game: Game, acc: number, productId: PassProductId, ref: string): number {
  const p = passProduct(productId);
  if (!p) return 0;
  const st = passState(game, acc);
  if (!game.db.doubloonRef(acc, 'doubloons_buy', `spass:${st.season}:${p.id}:${String(ref).slice(0, 80)}`)) return 0;
  st.has = p.id === 'pass_upgrade' ? 'premium' : null;
  save(game, acc, st);
  return creditPremium(game, acc, p.rub, 'refund', `spass-refund:${ref}`) === null ? 0 : p.rub;
}

/** What she holds this season (the payment desks' and the site's checks). */
export const passHas = (game: Game, acc: number): PassKind | null => passState(game, acc).has;

// ------------------------------------------------------------------------------------------------ the season's end

/** Her ship's level as her save has it (for last season's silver, when she is away). */
function savedShipLevel(game: Game, acc: number): number {
  const s = sessionOf(game, acc);
  if (s?.ship) return s.ship.shipLevel;
  try {
    const row = game.db.loadCaptain(acc);
    const p = row ? (JSON.parse(row.data) as { loadout?: { classId: ShipClassId; level?: number } }) : null;
    return p?.loadout && SHIP_CLASSES[p.loadout.classId] ? shipLevelOf(p.loadout) : 1;
  } catch {
    return 1;
  }
}

/** A season gone: the rewards she earned and did not take handed over — silver by letter, the account's stores at once,
 *  a map, an artifact, the men (by letter, once her ship serves their tier) and the hull the next time she is aboard
 *  (`carry`) — a letter tells her, and her card starts the new season (the carry with it). */
function rollover(game: Game, acc: number, old: PassState, now: number): PassState {
  const tier = tierOf(old.xp).tier;
  const owed: PassReward[] = [];
  for (let t = 1; t <= tier; t++) {
    if (!old.free.includes(t)) owed.push(...rewardsOf(old.season, t, 'free'));
    if (old.has && !old.prem.includes(t)) owed.push(...rewardsOf(old.season, t, 'premium'));
  }
  const next: PassState = { ...fresh(now), carry: [...old.carry] };
  // (written first: a second read of the card in the new season delivers nothing twice)
  save(game, acc, next);
  if (!owed.length && !old.carry.length) return next;
  const shipLv = savedShipLevel(game, acc);
  const isle = ownIsland(game, acc);
  const who = accountStandIn(acc);
  let silver = 0;
  const goods: ShopGrant[] = [];
  for (const r of owed) {
    switch (r.k) {
      case 'silver': silver += silverOf(r.min, shipLv); break;
      case 'res':
        if (isle) {
          reckonBase(game, isle);
          const y = yardOf(game, isle);
          y.res[r.good] = (y.res[r.good] ?? 0) + r.n;
          game.holdings.touch();
        } else silver += r.n * RES_SILVER[r.good];
        break;
      case 'cos': if (!cosWhy(game, acc, [r.key])) grantCos(game, who, [r.key]); break;
      case 'map': case 'art': case 'ship': case 'units': next.carry.push(r); break;
      default: {
        const g = shopGrantOf(r);
        if (g) goods.push(g);
      }
    }
  }
  for (const g of goods) grantGoods(game, who, [g], `spass:${old.season}:end`);
  save(game, acc, next);
  const name = passSeason(old.season).name[0];
  deliver(game, acc, {
    from: 'The season card', subject: `Season ${old.season} is over: your rewards`,
    body: `The season «${name}» is over. The rewards you earned and did not take are sent to you: ${owed.length}. Silver is in this letter; the rest is already on your account.`,
    gold: silver, goods: null,
  });
  game.log(`[spass] season ${old.season} closed for account ${acc}: tier ${tier}, ${owed.length} rewards delivered (${silver} silver, ${next.carry.length} waiting aboard)`);
  return next;
}

/** Last season's rewards that waited for her aboard: handed over now as far as they may be (the rest wait on). */
function giveCarry(game: Game, s: PlayerSession): void {
  const st = passState(game, s.accountId);
  if (!st.carry.length || !s.profile) return;
  const keep: PassReward[] = [];
  const give: PassReward[] = [];
  for (const r of st.carry) {
    if (rewardsWhy(game, s, [...give, r])) keep.push(r);
    else give.push(r);
  }
  if (!give.length) return;
  st.carry = keep;
  save(game, s.accountId, st);
  giveAboard(game, s, give, `spass:${st.season}:carry`);
}

// ------------------------------------------------------------------------------------------------ her window

function chView(c: Challenges | null): PassView['daily'] {
  if (!c) return [];
  return c.ids.map((id, i) => {
    const d = challengeOf(id)!;
    return { id, need: d.need, prog: c.prog[i], done: c.done[i], xp: d.xp };
  });
}

export function passView(game: Game, s: PlayerSession): PassView {
  const st = passState(game, s.accountId);
  rollCh(game, s.accountId, st);
  save(game, s.accountId, st);
  const t = tierOf(st.xp);
  const b = boundsNow(game);
  const wall = game.wallNow();
  const day = dayOf(wall), week = weekOf(wall);
  return {
    season: st.season, from: b.from, until: b.until, now: wall,
    xp: st.xp, tier: t.tier, into: t.into, need: t.need,
    has: st.has, free: [...st.free].sort((a, z) => a - z), prem: [...st.prem].sort((a, z) => a - z),
    daily: chView(st.dch), weekly: chView(st.wch),
    dayEnds: (day + 1) * 86_400_000, weekEnds: ((week + 1) * 7 - 3) * 86_400_000,
    silverMin: hourSilver(s.ship?.shipLevel ?? 1) / 60,
    claim: claimable(st),
    pay: paymentsOpen(game), web: webPayOpen(game, s.accountId),
  };
}

export function sendPass(game: Game, s: PlayerSession): void {
  if (!s.authed || !s.profile) return;
  game.sendTo(s, { t: 'spass', view: passView(game, s) });
}

/** On coming aboard: her card (a new season closed and its letter sent first), last season's rewards that waited. */
export function passOnLogin(game: Game, s: PlayerSession): void {
  if (!s.authed || !s.profile) return;
  const before = read(game, s.accountId)?.season;
  const st = passState(game, s.accountId);
  if (before !== undefined && before !== st.season) game.sendTo(s, { t: 'toast', msg: `A new season begins: «${passSeason(st.season).name[0]}». The season card starts again.`, kind: 'gold' });
  giveCarry(game, s);
  sendPass(game, s);
}

const seenSeason = new WeakMap<PlayerSession, string>();
/** Every second aboard: a new day (its challenges) or a new season sends her card again. */
export function stepPass(game: Game, s: PlayerSession): void {
  if (!s.authed || !s.profile) return;
  const k = `${seasonNow(game)}:${dayOf(game.wallNow())}`;
  const was = seenSeason.get(s);
  seenSeason.set(s, k);
  if (was !== undefined && was !== k) passOnLogin(game, s);
}

/** Her client's word. */
export function passMessage(game: Game, s: PlayerSession, msg: PassClientMsg): void {
  if (msg.action === 'claim') {
    const why = claimTier(game, s, Number(msg.tier), msg.track === 'premium' ? 'premium' : 'free');
    if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  } else if (msg.action === 'claim_all') {
    const r = claimAll(game, s);
    if (r.n > 0) game.sendTo(s, { t: 'toast', msg: `Season card rewards taken: ${r.n} tiers.`, kind: 'gold' });
    if (r.why) game.sendTo(s, { t: 'toast', msg: r.why, kind: r.n ? 'info' : 'bad' });
    else if (!r.n) game.sendTo(s, { t: 'toast', msg: 'Nothing to take yet.', kind: 'info' });
  }
  sendPass(game, s);
}

// ------------------------------------------------------------------------------------------------ the admin

/** `/pass [grant premium|super name|xp N|tier N|season next|reset]` (admin servers only). */
export function adminPass(game: Game, s: PlayerSession, args: string[]): string {
  const usage = 'Usage: /pass [grant premium|super name|xp N|tier N|season next|reset]';
  const acc = s.accountId;
  const sub = (args[0] ?? '').toLowerCase();
  if (sub === 'grant') {
    const kind = args[1] === 'super' ? 'super' : args[1] === 'premium' ? 'premium' : null;
    if (!kind) return usage;
    const name = args.slice(2).join(' ').trim();
    const row = name ? game.db.accountByName(name) : game.db.accountById(acc);
    if (!row) return 'No such captain.';
    const st = passState(game, row.id);
    game.db.transaction(() => grantPass(game, row.id, st, kind));
    game.db.ledger(row.id, 'season_pass_admin', 0, kind);
    afterPass(game, row.id, kind);
    return `Season card: ${kind === 'super' ? 'Super Pass' : 'Premium Pass'} granted to ${row.name}.`;
  }
  if (sub === 'xp') {
    const n = Math.floor(Number(args[1]));
    if (!Number.isFinite(n)) return usage;
    const st = passState(game, acc);
    const before = tierOf(st.xp).tier;
    st.xp = Math.max(0, st.xp + n);
    save(game, acc, st);
    const after = tierOf(st.xp).tier;
    if (after > before) tierUp(game, s, st, after);
    sendPass(game, s);
    return `Season card: +${n} season XP.`;
  }
  if (sub === 'tier') {
    const n = Math.max(0, Math.min(PASS_TIERS, Math.floor(Number(args[1]))));
    if (!Number.isFinite(n)) return usage;
    const st = passState(game, acc);
    st.xp = xpToTier(n);
    st.told = n;
    save(game, acc, st);
    sendPass(game, s);
    return `Season card: tier ${n}.`;
  }
  if (sub === 'season') {
    if (args[1] !== 'next') return usage;
    game.db.setKv('spass:shift', shiftOf(game) + 1);
    passOnLogin(game, s);
    return `Season card: season ${seasonNow(game)} begins.`;
  }
  if (sub === 'reset') {
    save(game, acc, fresh(seasonNow(game)));
    sendPass(game, s);
  } else if (sub) return usage;
  const st = passState(game, acc);
  return `Season card: season ${st.season}, tier ${tierOf(st.xp).tier}, ${st.xp} season XP, ${st.has === 'super' ? 'Super Pass' : st.has === 'premium' ? 'Premium Pass' : 'free track'}.`;
}

/** For the site's web shop: why a pass product cannot be bought for this account now (null: it can). */
export function passProductWhy(game: Game, acc: number, id: string): 'owned' | null {
  const p = passProduct(id);
  if (!p) return 'owned';
  return passProductOpen(p, passState(game, acc).has) ? null : 'owned';
}

/** Every challenge of the pools (the tests). */
export const ALL_CHALLENGES = CHALLENGES;
