// The Telegram notices (owner, 2026-10-16, «да» to the retention batch): the bot writes to a captain who is away — only
// one signed in through Telegram (or with Telegram linked), and only once she has said yes (the settings' switch, the
// bot's /start or /notify, or the Mini App's write access). Six kinds, each with its own switch
// (Настройки → Уведомления в Телеграме): the island's work finished, the daily gift ready, a personal offer's last hour
// (once a day at most), the island raided or robbed, a zone boss rising in her sea (off unless she turns it on), and
// «давно не заходили» once after three days away.
// Respectful by rule (`judge`, pure and tested):
//  - never while she is aboard: she sees it in the game;
//  - three a Moscow day at most, all kinds together;
//  - never in the quiet hours, 23:00–09:00 Moscow time: the island's news waits for the morning (the latest of each
//    kind), the rest is not sent at all;
//  - each kind no oftener than its gap (the gift, the offer: once a Moscow day; the idle word: once until she is back);
//  - the bot blocked (the Bot API's 403) turns her notices off until she turns them on again in the game.
// Every notice carries the «Играть» button (a deep link into the Mini App, its kind in the start parameter, so a tap is
// counted) and «Отключить уведомления». The token is never logged: the Bot API's errors come by their code only
// (telegram.ts BotApi). Kept in the kv table (`tgn:<account>`, and `tgn:index`: the accounts the bot may write to).

import { TGN_CATS, TGN_DEFAULT, tgText } from '../../../shared/src/data/telegram.ts';
import type { TgLang, TgTextKey, TgnCat, TgnView } from '../../../shared/src/data/telegram.ts';
import { dayOf } from '../../../shared/src/data/dailies.ts';
import { giftSlot, giftStreak } from '../../../shared/src/data/dailygift.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { giftState } from './dailygift.ts';
import { promoEnding } from './promo.ts';
import { trackEvent } from './liveops.ts';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Notices a Moscow day, all kinds together. */
export const TGN_CAP = 3;
/** The quiet hours, Moscow time: from 23:00 to 09:00. */
export const TGN_QUIET: [number, number] = [23, 9];
/** Moscow is UTC+3 all year. */
const MSK = 3 * HOUR;
/** The least time between two notices of a kind (the gift and the offer: also once a Moscow day). */
export const TGN_GAP: Record<TgnCat, number> = { build: 2 * HOUR, daily: 12 * HOUR, offer: 12 * HOUR, raid: HOUR, boss: 6 * HOUR, idle: 0 };
/** Kinds that wait out the quiet hours (the latest of each, sent in the morning); the rest are not sent then. */
export const TGN_DEFER: ReadonlySet<TgnCat> = new Set<TgnCat>(['build', 'raid']);
/** Days away before «давно не заходили»; the daily gift and the offers are not told after that. */
export const TGN_IDLE_DAYS = 3;

export const moscowHour = (ms: number): number => Math.floor((ms + MSK) / HOUR) % 24;
export const moscowDay = (ms: number): number => Math.floor((ms + MSK) / DAY);
export function quietHours(ms: number): boolean {
  const h = moscowHour(ms);
  return h >= TGN_QUIET[0] || h < TGN_QUIET[1];
}

export interface TgnState {
  /** Her yes (null: never asked — nothing is sent). */
  on: boolean | null;
  cats: Partial<Record<TgnCat, boolean>>;
  /** The bot was blocked (a 403): nothing is sent until she turns the notices on again. */
  blocked: boolean;
  /** Her Telegram user id (the private chat). */
  chat: number;
  lang: TgLang;
  /** The Moscow day of `n`, and the notices sent that day. */
  day: number;
  n: number;
  /** When each kind was last sent (wall ms). */
  last: Partial<Record<TgnCat, number>>;
  /** When she last came aboard or went away (wall ms; 0: never seen). */
  seen: number;
  /** Away now (no session). */
  away: boolean;
  /** Her sea when she went away (the zone boss's notice). */
  sea: string;
  /** «давно не заходили» sent since she was last aboard. */
  idle: boolean;
  /** Notices waiting out the quiet hours (one a kind). */
  pending: { cat: TgnCat; key: TgTextKey; vars: Record<string, string | number> }[];
  /** Her VK user id (docs/36: the VK Mini App's notices — notifications.sendMessage), 0: none. */
  vk?: number;
  /** VK's notices refused (she did not allow them, or VK said «disabled»): none by VK until she allows them again. */
  vkOff?: boolean;
}

export function newTgnState(chat = 0, lang: TgLang = 'ru'): TgnState {
  return { on: null, cats: {}, blocked: false, chat, lang, day: -1, n: 0, last: {}, seen: 0, away: false, sea: '', idle: false, pending: [] };
}

export const catOn = (st: TgnState, cat: TgnCat): boolean => st.cats[cat] ?? TGN_DEFAULT[cat];
export const sentToday = (st: TgnState, now: number): number => (st.day === moscowDay(now) ? st.n : 0);

export type Verdict = 'send' | 'defer' | 'drop';

/** Whether a notice of `cat` goes now: sent, kept for the morning, or not sent (and why). Pure. */
export function judge(st: TgnState, cat: TgnCat, now: number, aboard: boolean): { v: Verdict; why: string } {
  // (two channels, one notice: Telegram's chat and VK's user — docs/36; the cap and the gaps count the notice once)
  if (!st.chat && !st.vk) return { v: 'drop', why: 'nochat' };
  if ((!st.chat || st.blocked) && (!st.vk || st.vkOff)) return { v: 'drop', why: 'blocked' };
  if (st.on !== true) return { v: 'drop', why: 'unasked' };
  if (!catOn(st, cat)) return { v: 'drop', why: 'kindoff' };
  if (aboard) return { v: 'drop', why: 'aboard' };
  if (cat === 'idle' && st.idle) return { v: 'drop', why: 'once' };
  const last = st.last[cat];
  if (last !== undefined && (now - last < TGN_GAP[cat] || ((cat === 'daily' || cat === 'offer') && moscowDay(last) === moscowDay(now)))) return { v: 'drop', why: 'gap' };
  if (quietHours(now)) return TGN_DEFER.has(cat) ? { v: 'defer', why: 'quiet' } : { v: 'drop', why: 'quiet' };
  if (sentToday(st, now) >= TGN_CAP) return { v: 'drop', why: 'cap' };
  return { v: 'send', why: '' };
}

// ------------------------------------------------------------------------------------------------ the desk

/** The bot's side (telegram.ts sets it): a notice to a chat — sent, the bot blocked (403), or another failure. */
export interface NoticeDesk {
  send(chat: number, cat: TgnCat, text: string, lang: TgLang): Promise<'ok' | 'blocked' | 'error'>;
}
const desks = new WeakMap<Game, NoticeDesk>();
export function setNoticeDesk(game: Game, desk: NoticeDesk | null): void {
  if (desk) desks.set(game, desk);
  else desks.delete(game);
}
/** VK's side (server/src/vk.ts: notifications.sendMessage), `chat` being her VK user id; 'blocked': VK says disabled. */
const vkDesks = new WeakMap<Game, NoticeDesk>();
export function setVkNoticeDesk(game: Game, desk: NoticeDesk | null): void {
  if (desk) vkDesks.set(game, desk);
  else vkDesks.delete(game);
}
const anyDesk = (game: Game): boolean => desks.has(game) || vkDesks.has(game);

// ------------------------------------------------------------------------------------------------ her state

const skey = (acc: number) => `tgn:${acc}`;
const IKEY = 'tgn:index';

export function tgnState(game: Game, acc: number): TgnState | null {
  const raw = game.db.getKv<TgnState>(skey(acc));
  return raw ? { ...newTgnState(), ...raw, cats: { ...(raw.cats ?? {}) }, last: { ...(raw.last ?? {}) }, pending: [...(raw.pending ?? [])] } : null;
}
function save(game: Game, acc: number, st: TgnState): void {
  game.db.setKv(skey(acc), st);
}
function index(game: Game): number[] {
  return game.db.getKv<number[]>(IKEY) ?? [];
}
function indexAdd(game: Game, acc: number): void {
  const ix = index(game);
  if (!ix.includes(acc)) game.db.setKv(IKEY, [...ix, acc]);
}

/** A Telegram user tied to her account (telegram.ts: a sign-in, a link, the bot's /start): the chat to write to, her
 *  language, and her yes when Telegram says she let the bot write (the Mini App's allows_write_to_pm, or she wrote to it). */
export function noticeLink(game: Game, acc: number, chat: number, lang: TgLang, consent: boolean): TgnState {
  const st = tgnState(game, acc) ?? newTgnState(chat, lang);
  st.chat = chat;
  st.lang = lang;
  if (consent && st.on === null) st.on = true;
  save(game, acc, st);
  indexAdd(game, acc);
  return st;
}

/** Her VK user tied to her account (vk.ts: the launch's sign-in, the game's «allow» or «deny»): `consent` true — VK's
 *  notices allowed (her yes for the notices, if never asked); false — refused; null — as it was. */
export function vkNoticeLink(game: Game, acc: number, user: number, lang: TgLang, consent: boolean | null): TgnState {
  const st = tgnState(game, acc) ?? newTgnState(0, lang);
  st.vk = user;
  if (!st.chat) st.lang = lang;
  if (consent === true) {
    st.vkOff = false;
    if (st.on === null || !st.chat) st.on = true;
  } else if (consent === false) st.vkOff = true;
  else if (st.vkOff === undefined) st.vkOff = true;
  save(game, acc, st);
  indexAdd(game, acc);
  return st;
}

export function tgnView(game: Game, acc: number): TgnView | null {
  const st = tgnState(game, acc);
  if (!st || !st.chat) return null;
  const cats = Object.fromEntries(TGN_CATS.map((c) => [c, catOn(st, c)])) as Record<TgnCat, boolean>;
  return { on: st.on === true && !st.blocked, cats, blocked: st.blocked, sent: sentToday(st, game.wallNow()), cap: TGN_CAP };
}

/** Her switches: all of them (`all`) or one kind; turning them on again after a block clears it. */
export function setNotices(game: Game, acc: number, cat: TgnCat | 'all', on: boolean, lang?: TgLang): TgnView | null {
  const st = tgnState(game, acc);
  if (!st || !st.chat) return null;
  if (cat === 'all') {
    st.on = on;
    if (on) st.blocked = false;
  } else if (TGN_CATS.includes(cat)) st.cats[cat] = on;
  if (lang) st.lang = lang;
  save(game, acc, st);
  return tgnView(game, acc);
}

// ------------------------------------------------------------------------------------------------ sending

const nameOf = (game: Game, acc: number): string => game.db.accountById(acc)?.name ?? '';

/** The owner's own figures of the notices (kv `tgn:stats`): sent, tapped, the bot blocked — by kind; the funnel
 *  (trackEvent) has them by account too. */
export function tally(game: Game, cat: TgnCat, what: 'sent' | 'click' | 'blocked'): void {
  const f = game.db.getKv<Record<string, Record<string, number>>>('tgn:stats') ?? {};
  const r = (f[cat] ??= {});
  r[what] = (r[what] ?? 0) + 1;
  game.db.setKv('tgn:stats', f);
}

/** She is in the game now (a session that is connected: a dropped line's ship lingering at sea does not count). */
export function aboard(game: Game, acc: number): boolean {
  const s = game.sessionByAccount(acc);
  return !!s && game.sessions.has(s);
}

/** A notice of `cat` to her (its words by `key`, holes filled by `vars`): judged, then sent, kept for the morning, or
 *  dropped. The day's count and the kind's time are written before the send, so two at once cannot pass the cap. */
export async function notify(game: Game, acc: number, cat: TgnCat, vars: Record<string, string | number> = {}, key: TgTextKey = `n.${cat}` as TgTextKey): Promise<Verdict> {
  const desk = desks.get(game);
  const vkDesk = vkDesks.get(game);
  const st = tgnState(game, acc);
  if ((!desk && !vkDesk) || !st) return 'drop';
  const now = game.wallNow();
  const { v } = judge(st, cat, now, aboard(game, acc));
  if (v === 'defer') {
    st.pending = [...st.pending.filter((p) => p.cat !== cat), { cat, key, vars }].slice(-TGN_CATS.length);
    save(game, acc, st);
  }
  if (v !== 'send') return v;
  const day = moscowDay(now);
  st.n = st.day === day ? st.n + 1 : 1;
  st.day = day;
  st.last[cat] = now;
  if (cat === 'idle') st.idle = true;
  save(game, acc, st);
  const text = tgText(key, st.lang, { name: nameOf(game, acc), ...vars });
  // VK's notice first (no buttons: its own link back is the notice's fragment, n_<kind>), then Telegram's
  if (vkDesk && st.vk && !st.vkOff) {
    let rv: 'ok' | 'blocked' | 'error' = 'error';
    try {
      rv = await vkDesk.send(st.vk, cat, text, st.lang);
    } catch {
      rv = 'error';
    }
    if (rv === 'blocked') {
      const now2 = tgnState(game, acc) ?? st;
      now2.vkOff = true;
      save(game, acc, now2);
      tally(game, cat, 'blocked');
    } else if (rv === 'ok') {
      trackEvent(game, acc, 'vk_notice_sent', { product: cat });
      tally(game, cat, 'sent');
    }
  }
  if (!desk || !st.chat || st.blocked) return 'send';
  let r: 'ok' | 'blocked' | 'error' = 'error';
  try {
    r = await desk.send(st.chat, cat, text, st.lang);
  } catch {
    r = 'error';
  }
  if (r === 'blocked') {
    const now2 = tgnState(game, acc) ?? st;
    now2.blocked = true;
    now2.pending = [];
    save(game, acc, now2);
    trackEvent(game, acc, 'tg_notice_blocked', { product: cat });
    tally(game, cat, 'blocked');
    return 'drop';
  }
  if (r === 'ok') {
    trackEvent(game, acc, 'tg_notice_sent', { product: cat });
    tally(game, cat, 'sent');
  }
  return 'send';
}

/** Whether a free-worded notice (the advice mailer, advice.ts) may go to her now by VK or Telegram: her yes, a channel
 *  not blocked, not aboard, not in the quiet hours, under the day's cap. */
export function pushable(game: Game, acc: number, now = game.wallNow()): { ok: boolean; vk: boolean; tg: boolean; why: string } {
  const st = tgnState(game, acc);
  const vk = !!(st?.vk && !st.vkOff && vkDesks.has(game));
  const tg = !!(st?.chat && !st.blocked && desks.has(game));
  const why = !st ? 'nolink' : st.on !== true ? 'unasked' : !vk && !tg ? 'nochannel' : aboard(game, acc) ? 'aboard' : quietHours(now) ? 'quiet' : sentToday(st, now) >= TGN_CAP ? 'cap' : '';
  return { ok: !why, vk, tg, why };
}

/** A free-worded notice by VK and Telegram (the advice mailer): counted in the day's cap as one notice, under the kind
 *  `cat` for VK's fragment and the bot's button. VK's «not allowed» (15, 901, 903) turns her VK notices off silently;
 *  the bot blocked turns Telegram's off. Which channels took it. */
export async function pushText(game: Game, acc: number, text: string, cat: TgnCat = 'idle'): Promise<{ vk: boolean; tg: boolean }> {
  const out = { vk: false, tg: false };
  const now = game.wallNow();
  const p = pushable(game, acc, now);
  const st = tgnState(game, acc);
  if (!p.ok || !st) return out;
  const day = moscowDay(now);
  st.n = st.day === day ? st.n + 1 : 1;
  st.day = day;
  save(game, acc, st);
  const vkDesk = vkDesks.get(game), desk = desks.get(game);
  if (p.vk && vkDesk && st.vk) {
    const r = await vkDesk.send(st.vk, cat, text, st.lang).catch(() => 'error' as const);
    if (r === 'blocked') {
      const st2 = tgnState(game, acc) ?? st;
      st2.vkOff = true;
      save(game, acc, st2);
    } else if (r === 'ok') out.vk = true;
  }
  if (p.tg && desk && st.chat) {
    const r = await desk.send(st.chat, cat, text, st.lang).catch(() => 'error' as const);
    if (r === 'blocked') {
      const st2 = tgnState(game, acc) ?? st;
      st2.blocked = true;
      st2.pending = [];
      save(game, acc, st2);
    } else if (r === 'ok') out.tg = true;
  }
  return out;
}

/** A notice for the island's owner when she is away (base.ts, baseclaim.ts call it; a no-op without the bot). */
export function notifyAway(game: Game, acc: number, cat: TgnCat, vars: Record<string, string | number> = {}, key?: TgTextKey): void {
  if (!anyDesk(game) || aboard(game, acc)) return;
  void notify(game, acc, cat, vars, key);
}

/** A zone boss rising in a sea: a notice to every captain away whose sea it was (the kind is off unless she turns it on). */
export function notifySea(game: Game, region: string): void {
  if (!anyDesk(game)) return;
  for (const acc of index(game)) {
    const st = tgnState(game, acc);
    if (st && st.sea === region && st.on === true && catOn(st, 'boss') && !aboard(game, acc)) void notify(game, acc, 'boss');
  }
}

const lastStep = new WeakMap<Game, number>();

/** Once a minute (from the game's second, only with the bot): the morning's notices kept over the quiet hours, the daily
 *  gift ready, a personal offer's last hour, and «давно не заходили» once — to the captains away. */
export function stepNotices(game: Game, force = false): Promise<void>[] {
  if (!anyDesk(game)) return [];
  const now = game.wallNow();
  if (!force && now - (lastStep.get(game) ?? 0) < MIN) return [];
  lastStep.set(game, now);
  if (quietHours(now)) return [];
  const out: Promise<void>[] = [];
  const go = (p: Promise<Verdict>) => out.push(p.then(() => undefined));
  for (const acc of index(game)) {
    if (aboard(game, acc)) continue;
    const st = tgnState(game, acc);
    if (!st || st.on !== true || ((!st.chat || st.blocked) && (!st.vk || st.vkOff)) || !st.seen) continue;
    if (st.pending.length) {
      const list = st.pending;
      st.pending = [];
      save(game, acc, st);
      for (const p of list) go(notify(game, acc, p.cat, p.vars, p.key));
    }
    const awayFor = now - st.seen;
    if (awayFor >= TGN_IDLE_DAYS * DAY) {
      if (!st.idle) go(notify(game, acc, 'idle'));
      continue;
    }
    const g = giftState(game, acc);
    const today = dayOf(now);
    if (g.last !== today && awayFor >= HOUR) go(notify(game, acc, 'daily', { day: giftSlot(giftStreak(g.last, g.streak, today)).day }));
    const offer = promoEnding(game, acc, now, HOUR);
    if (offer) go(notify(game, acc, 'offer', { off: offer.off }));
  }
  return out;
}

/** She came aboard: seen now, the idle word may come again one day; her switches sent (a captain with Telegram only). */
export function noticesAboard(game: Game, s: PlayerSession): void {
  if (!s.authed) return;
  const st = tgnState(game, s.accountId);
  if (!st) return;
  st.seen = game.wallNow();
  st.away = false;
  st.idle = false;
  save(game, s.accountId, st);
  const view = tgnView(game, s.accountId);
  if (view) game.sendTo(s, { t: 'tgn', view });
}

/** She went away: from now the notices may come; her sea kept for the zone boss's. */
export function noticesAway(game: Game, s: PlayerSession): void {
  if (!s.authed) return;
  const st = tgnState(game, s.accountId);
  if (!st) return;
  st.seen = game.wallNow();
  st.away = true;
  st.sea = s.lastRegion || st.sea;
  save(game, s.accountId, st);
}

const clicked = new WeakSet<PlayerSession>();

/** Her client's word on the notices: the switches, the view, a notice's button that opened the Mini App (counted once). */
export function tgnMessage(game: Game, s: PlayerSession, msg: { action: string; cat?: string; on?: boolean; lang?: string }): void {
  if (!s.authed) return;
  if (msg.action === 'tgn_click') {
    const cat = String(msg.cat ?? '') as TgnCat;
    if (TGN_CATS.includes(cat) && !clicked.has(s)) {
      clicked.add(s);
      trackEvent(game, s.accountId, 'tg_notice_click', { product: cat });
      tally(game, cat, 'click');
    }
    return;
  }
  if (msg.action === 'tgn_set') setNotices(game, s.accountId, (msg.cat === 'all' ? 'all' : String(msg.cat)) as TgnCat | 'all', msg.on === true, msg.lang === 'en' || msg.lang === 'ru' ? msg.lang : undefined);
  const view = tgnView(game, s.accountId);
  if (view) game.sendTo(s, { t: 'tgn', view });
}

/** `/tgn [link|stats]`: a test chat linked to her (QA: no message is sent without the bot), the owner's figures, her count. */
export function adminTgn(game: Game, s: PlayerSession, args: string[]): string {
  if (args[0] === 'stats') {
    const f = game.db.getKv<Record<string, Record<string, number>>>('tgn:stats') ?? {};
    return `Telegram notices (sent / tapped / blocked): ${TGN_CATS.map((c) => `${c} ${f[c]?.sent ?? 0}/${f[c]?.click ?? 0}/${f[c]?.blocked ?? 0}`).join(' · ')}`;
  }
  if (args[0] === 'link') {
    noticeLink(game, s.accountId, 1, 'ru', true);
    const view = tgnView(game, s.accountId);
    if (view) game.sendTo(s, { t: 'tgn', view });
    return 'A test Telegram chat is linked to this captain: the switches are in the settings.';
  }
  return `Telegram notices for this captain: sent today ${tgnView(game, s.accountId)?.sent ?? 0} of ${TGN_CAP}. Usage: /tgn [link|stats]`;
}

/** The bot's /notify: her notices on or off from the chat (the reply's words). */
export function notifyCommand(game: Game, acc: number, lang: TgLang): string {
  const st = tgnState(game, acc);
  if (!st) return tgText('n.off', lang);
  const on = !(st.on === true && !st.blocked);
  setNotices(game, acc, 'all', on);
  return tgText(on ? 'n.on' : 'n.off', lang);
}

