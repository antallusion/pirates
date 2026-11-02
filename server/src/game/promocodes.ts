// Promo codes on the server (owner, 2026-11-02; the codes and their rewards: shared/src/data/promocodes.ts). A captain
// types a code in «Настройки → Промокод»; it is checked here — known, not yet hers, not run out, her level, the cap on
// its uses — and its rewards handed over the way the game's other rewards go. Each code once an account: her mark
// (`promocode:acc:<account>`) and the code's count (`promocode:code:<CODE>`) are written before anything is handed over,
// and the doubloons carry 'promo:<CODE>' in their ledger, so nothing is paid twice. Ten tries in ten minutes an account
// at most (`promocode:try:<account>`), so codes are not guessed by brute force. `/promo list|stats|grant CODE name`.

import { PROMO_CODES, PROMO_LETTER, PROMO_MAP_SILVER, PROMO_TRIES, PROMO_TRY_WINDOW, normCode, promoByCode } from '../../../shared/src/data/promocodes.ts';
import type { PromoCode, PromoGot, PromoResult, PromoWhy } from '../../../shared/src/data/promocodes.ts';
import { GIFT_RES_SILVER } from '../../../shared/src/data/dailygift.ts';
import type { GiftRes } from '../../../shared/src/data/dailygift.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import { GIFT28_FROM } from '../../../shared/src/data/gift.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { reckonBase, yardOf, baseView } from './base.ts';
import { ownIsland } from './estate.ts';
import { creditPremium, sendBalance } from './premium.ts';
import { grantGoods, inFight } from './shop.ts';
import { deliver } from './post.ts';
import { MAX_MAPS, chestCount, grantMap, makeMap } from './explorefx.ts';
import { trackEvent } from './liveops.ts';

const accKey = (acc: number) => `promocode:acc:${acc}`;
const codeKey = (code: string) => `promocode:code:${code}`;
const tryKey = (acc: number) => `promocode:try:${acc}`;

interface CodeStat {
  n: number;
  last: number;
}

/** The codes she has taken: code → when. */
export function usedCodes(game: Game, acc: number): Record<string, number> {
  const v = game.db.getKv<Record<string, number>>(accKey(acc));
  return v && typeof v === 'object' ? v : {};
}

export function codeStat(game: Game, code: string): CodeStat {
  const v = game.db.getKv<CodeStat>(codeKey(code));
  return { n: Math.max(0, Math.floor(v?.n ?? 0)), last: Number(v?.last ?? 0) };
}

/** One try counted against her ten in ten minutes; null: allowed, else the seconds to wait. */
function countTry(game: Game, acc: number, now: number): number | null {
  const raw = game.db.getKv<number[]>(tryKey(acc));
  const tries = (Array.isArray(raw) ? raw : []).filter((t) => typeof t === 'number' && now - t < PROMO_TRY_WINDOW);
  if (tries.length >= PROMO_TRIES) return Math.max(1, Math.ceil((tries[0] + PROMO_TRY_WINDOW - now) / 1000));
  tries.push(now);
  game.db.setKv(tryKey(acc), tries);
  return null;
}

/** Why the code may not be hers now (null: it may). `admin`: the tester's grant — only once an account still holds. */
function whyNot(game: Game, s: PlayerSession, pc: PromoCode, now: number, admin: boolean): PromoWhy | null {
  if (usedCodes(game, s.accountId)[pc.code] !== undefined) return 'used';
  if (admin) return null;
  if (pc.until !== undefined && now >= pc.until) return 'expired';
  if (pc.maxLevel !== undefined && (s.profile?.level ?? 1) > pc.maxLevel) return 'level';
  if (pc.cap !== undefined && codeStat(game, pc.code).n >= pc.cap) return 'cap';
  if (inFight(game, s)) return 'fight';
  return null;
}

/** A code typed by a captain: checked, and its rewards handed over once. */
export function redeemCode(game: Game, s: PlayerSession, raw: unknown, admin = false): PromoResult {
  const code = normCode(raw);
  if (!s.authed || !s.profile || !s.ship) return { ok: false, code, why: 'signin' };
  if (!code) return { ok: false, code, why: 'empty' };
  const now = game.wallNow();
  if (!admin) {
    const wait = countTry(game, s.accountId, now);
    if (wait !== null) return { ok: false, code, why: 'rate', wait };
  }
  const pc = promoByCode(code);
  if (!pc) return { ok: false, code, why: 'unknown' };
  const why = whyNot(game, s, pc, now, admin);
  if (why) return { ok: false, code, why, ...(why === 'level' ? { maxLevel: pc.maxLevel } : {}) };
  // hers now: the marks first (a second message, a second tab, a crash half-way — never paid twice)
  game.db.transaction(() => {
    game.db.setKv(accKey(s.accountId), { ...usedCodes(game, s.accountId), [pc.code]: now });
    const st = codeStat(game, pc.code);
    game.db.setKv(codeKey(pc.code), { n: st.n + 1, last: now } satisfies CodeStat);
  });
  const got = grant(game, s, pc);
  trackEvent(game, s.accountId, 'promo_code', { product: pc.code });
  return { ok: true, code: pc.code, got };
}

/** A code's rewards handed over: what she really got. */
function grant(game: Game, s: PlayerSession, pc: PromoCode): PromoGot {
  const p = s.profile!;
  const ship = s.ship!;
  const r = pc.rewards;
  const got: PromoGot = {};
  const ref = `promo:${pc.code}`;
  let silver = r.silver ?? 0;
  // the island's goods into its yard; no island yet: their worth in silver (as the daily gift pays)
  if (r.res) {
    const h = ownIsland(game, s.accountId);
    if (h) {
      reckonBase(game, h);
      const y = yardOf(game, h);
      for (const [g, n] of Object.entries(r.res) as [GiftRes, number][]) y.res[g] = (y.res[g] ?? 0) + n;
      game.holdings.touch();
      got.res = { ...r.res };
      const v = baseView(game, s);
      if (v) game.sendTo(s, { t: 'base', view: v });
    } else for (const [g, n] of Object.entries(r.res) as [GiftRes, number][]) silver += n * GIFT_RES_SILVER[g];
  }
  // goods into the hold as far as it holds them; the rest in silver at their base price
  if (r.cargo?.length) {
    const st = ship.stats;
    const used = () => cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    const cargo: NonNullable<PromoGot['cargo']> = {};
    for (const c of r.cargo) {
      const per = cargoVolume({ [c.good]: 1 }, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) || GOODS[c.good].volume;
      const fit = Math.max(0, Math.min(c.n, Math.floor((st.holdVolume - used() + 1e-6) / per)));
      if (fit > 0) {
        ship.cargo[c.good] = (ship.cargo[c.good] ?? 0) + fit;
        cargo[c.good] = fit;
      }
      silver += (c.n - fit) * GOODS[c.good].basePrice;
    }
    ship.recompute(game.now);
    if (Object.keys(cargo).length) got.cargo = cargo;
  }
  // the shop's goods, each into its store (one over its cap is passed over, the rest still go)
  for (const g of r.grants ?? []) {
    if (g.k === 'map') {
      let n = 0;
      for (let i = 0; i < g.n; i++) {
        if (chestCount(p.explore.maps) >= MAX_MAPS) {
          silver += PROMO_MAP_SILVER;
          continue;
        }
        if (grantMap(game, s, makeMap(game, Math.max(1, Math.min(3, Math.ceil(ship.shipLevel / 3)))), 'Promo code')) n++;
      }
      if (n) got.map = (got.map ?? 0) + n;
      continue;
    }
    if (grantGoods(game, s, [g], ref) !== null) continue;
    if (g.k === 'speed') got.speed = (got.speed ?? 0) + g.min;
    else if (g.k === 'kit') got.kit = (got.kit ?? 0) + g.n;
    else if (g.k === 'xp') got.xp = (got.xp ?? 0) + g.hours;
    else if (g.k === 'charm') got.charm = (got.charm ?? 0) + g.n;
    else if (g.k === 'scrolls') got.scrolls = (got.scrolls ?? 0) + g.n;
  }
  if (silver > 0) {
    p.gold += silver;
    game.db.ledger(s.accountId, 'promo', silver, ref);
    got.silver = silver;
  }
  // men by a letter: a gift's stack of their own, taken in any port when there is room
  if (r.unit && UNITS[r.unit.u]) {
    deliver(game, s.accountId, { from: GIFT28_FROM, subject: PROMO_LETTER.subject, body: PROMO_LETTER.body, gold: 0, goods: null, units: { u: r.unit.u, n: r.unit.n, gift: 1 } });
    got.unit = { ...r.unit };
  }
  if (r.doubloons && creditPremium(game, s.accountId, r.doubloons, 'gift', ref, true) !== null) got.doubloons = r.doubloons;
  sendBalance(game, s);
  game.saveSession(s);
  game.pushSelf(s, true);
  return got;
}

/** Her client's word: the code typed. The answer comes back as `promocode`. */
export function promoCodeMessage(game: Game, s: PlayerSession, code: unknown): void {
  game.sendTo(s, { t: 'promocode', res: redeemCode(game, s, code) });
}

const codeLine = (game: Game, pc: PromoCode): string =>
  `${pc.code}${pc.maxLevel ? ` ≤${pc.maxLevel}` : ''}${pc.until ? ` ⌛${new Date(pc.until).toISOString().slice(0, 10)}` : ''}${pc.cap ? ` /${pc.cap}` : ''} ×${codeStat(game, pc.code).n}`;

/** `/promo list|stats|grant CODE name`. */
export function adminPromo(game: Game, args: string[]): string {
  const cmd = (args[0] ?? 'list').toLowerCase();
  if (cmd === 'stats') return `Promo codes taken: ${PROMO_CODES.map((pc) => `${pc.code} ${codeStat(game, pc.code).n}`).join(' · ')}.`;
  if (cmd === 'grant') {
    const pc = promoByCode(args[1] ?? '');
    const name = args.slice(2).join(' ').trim();
    if (!pc || !name) return 'Usage: /promo list|stats|grant CODE name';
    const who = game.sessionByName(name);
    if (!who) return `No captain aboard by that name: ${name}.`;
    const r = redeemCode(game, who, pc.code, true);
    if (!r.ok) return `The code is refused for ${who.name}: ${r.why}.`;
    game.sendTo(who, { t: 'promocode', res: r });
    return `Code ${pc.code} granted to ${who.name}.`;
  }
  return `Promo codes (≤ top level, ⌛ until, × taken): ${PROMO_CODES.map((pc) => codeLine(game, pc)).join(' · ')}.`;
}
