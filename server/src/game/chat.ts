// The players' chat (docs/28; owner, 2026-09-30: "a chat for players, show player icons"; 2026-10-11: «реализация
// реалтайм чата, он должен быть суперудобный даже на мобиле, все должны кто в мире общаться, у капитанов ники и иконки
// должны быть … и приватные сообщения тоже»). Everything a line goes through on the server:
//  - the channels: the world (every captain online, in every zone), the ships in sight, the group, the guild (in every
//    zone), and private words to any captain by name, at sea or ashore;
//  - who speaks (the captain's portrait, level, flag and guild tag) and the server's stamp (an id for dedupe, the time);
//  - the gate: a line at least CHAT_GAP s after the last, CHAT_BURST in CHAT_WINDOW s, a short silence for breaking it,
//    the same words twice refused, the harbour master's /mute;
//  - coarse words masked (shared/src/chat.ts), control characters out, CHAT_MAX characters at most;
//  - the history: the channels' last CHAT_HISTORY lines kept in memory, private conversations in the database (the last
//    CHAT_DM_KEEP of each), sent on coming aboard;
//  - other zones: lines go over the zone mesh (zones/zone.ts) and the Redis bus (persistence/redis.ts) when there is
//    one; a line arriving twice (both ways) is taken once, by its id.

import { randomBytes } from 'node:crypto';
import { CHAT_BREACH_MUTE, CHAT_BURST, CHAT_DM_KEEP, CHAT_DM_THREADS, CHAT_DUP_WINDOW, CHAT_GAP, CHAT_HISTORY, CHAT_MAX, CHAT_WINDOW, chatKey, maskBadWords } from '../../../shared/src/chat.ts';
import { INTEREST_RADIUS } from '../../../shared/src/constants.ts';
import type { ChatLineView, ChatThreadView, SagaCard } from '../../../shared/src/protocol.ts';
import { ignoreAdd, ignoreCommand, ignores, whisperCommand } from './friends.ts';
import { groupOfAccount } from './party.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

export { CHAT_MAX };

export const CHAT_TOO_FAST = 'You speak too fast: wait a moment';

/** One line cleaned: control characters and text-direction tricks out, runs of spaces made one, cut to the longest line. */
export function cleanChat(raw: unknown): string {
  return String(raw ?? '').replace(/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX).trim();
}

/** Who speaks: the captain's portrait id, her level, her flag when sworn (the Code's free men or the Crown's marque),
 *  her guild's tag. */
export function chatFace(s: PlayerSession, game?: Game): { face?: string; fac?: 'free' | 'crown'; lv?: number; g?: string } {
  const p = s.profile;
  if (!p) return {};
  const tag = game?.guilds.of(game, s.accountId)?.tag;
  return { face: p.captain, lv: p.level, ...(p.oath === 'code' ? { fac: 'free' as const } : p.oath === 'marque' ? { fac: 'crown' as const } : {}), ...(tag ? { g: tag } : {}) };
}

// ------------------------------------------------------------------------------------------ the hub

/** What travels between zones: a line and where it goes. */
export interface ChatWire {
  kind: 'world' | 'guild' | 'dm';
  line: ChatLineView;
  /** the speaker's account */
  from: number;
  /** the guild (kind guild) */
  gid?: number;
  /** the addressee's account (kind dm) */
  to?: number;
}

interface Rate {
  /** world time of each line in the window */
  times: number[];
  /** the last lines' keys and times (the duplicate check) */
  recent: { k: string; at: number }[];
  /** world time of each refusal for speaking too fast */
  strikes: number[];
  /** silenced until (world time) */
  until: number;
}

interface LocalLine {
  line: ChatLineView;
  x: number;
  y: number;
  port: string | null;
}

interface Hub {
  proc: string;
  seq: number;
  seen: Set<string>;
  seenQ: string[];
  world: ChatLineView[];
  local: LocalLine[];
  groups: Map<number, ChatLineView[]>;
  guilds: Map<number, ChatLineView[]>;
  rate: Map<number, Rate>;
}

const hubs = new WeakMap<Game, Hub>();

function hub(game: Game): Hub {
  let h = hubs.get(game);
  if (!h) {
    h = { proc: randomBytes(3).toString('hex'), seq: 0, seen: new Set(), seenQ: [], world: [], local: [], groups: new Map(), guilds: new Map(), rate: new Map() };
    hubs.set(game, h);
  }
  return h;
}

/** Seen this id before? (and remember it: the last thousand) */
function seenBefore(h: Hub, id: string): boolean {
  if (h.seen.has(id)) return true;
  h.seen.add(id);
  h.seenQ.push(id);
  if (h.seenQ.length > 1000) h.seen.delete(h.seenQ.shift()!);
  return false;
}

function keep<T>(list: T[], item: T, max = CHAT_HISTORY): void {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

/** A line stamped by the server: its id and its time. */
function stamp(game: Game, line: ChatLineView): ChatLineView {
  const h = hub(game);
  line.id = `${h.proc}${(++h.seq).toString(36)}`;
  line.at = game.wallNow();
  seenBefore(h, line.id);
  return line;
}

/** To the other zones (and the other processes on the Redis bus). */
function relay(game: Game, w: ChatWire): void {
  game.zone?.relayChat(w);
  game.shared?.publishChatWire(w);
}

// ------------------------------------------------------------------------------------------ the gate

/** The harbour master's silences (account → until, wall ms), kept in the database so every zone reads them. */
function adminMutes(game: Game): Record<string, number> {
  return game.db.getKv<Record<string, number>>('chat_mutes') ?? {};
}

function rateOf(game: Game, acct: number): Rate {
  const h = hub(game);
  let r = h.rate.get(acct);
  if (!r) h.rate.set(acct, (r = { times: [], recent: [], strikes: [], until: 0 }));
  return r;
}

/** May she say this now? A refusal's words, or null (and the line is counted). Commands never come here. */
function gate(game: Game, s: PlayerSession, text: string): string | null {
  const now = game.now;
  const wall = adminMutes(game)[String(s.accountId)] ?? 0;
  if (wall > game.wallNow()) return `You are silenced for ${Math.ceil((wall - game.wallNow()) / 60_000)} min`;
  const r = rateOf(game, s.accountId);
  if (r.until > now) return `You are silenced for ${Math.ceil(r.until - now)} s`;
  r.times = r.times.filter((t) => now - t < CHAT_WINDOW);
  r.strikes = r.strikes.filter((t) => now - t < CHAT_WINDOW);
  r.recent = r.recent.filter((x) => now - x.at < CHAT_DUP_WINDOW);
  const silence = () => {
    r.until = now + CHAT_BREACH_MUTE;
    r.strikes = [];
    return `Too many lines: you are silenced for ${CHAT_BREACH_MUTE} s`;
  };
  if (r.times.length >= CHAT_BURST) return silence();
  const last = r.times[r.times.length - 1];
  if (last !== undefined && now - last < CHAT_GAP) {
    r.strikes.push(now);
    return r.strikes.length >= 3 ? silence() : CHAT_TOO_FAST;
  }
  const k = chatKey(text);
  if (k && r.recent.some((x) => x.k === k)) return 'You have said that already';
  r.times.push(now);
  r.recent.push({ k, at: now });
  if (r.recent.length > 3) r.recent.shift();
  return null;
}

/** The words as everyone sees them: coarse ones masked. */
function words(text: string): string {
  return maskBadWords(text);
}

// ------------------------------------------------------------------------------------------ the channels

/** The world: every captain online, in every zone (a saga's chapter shared goes here too, past the gate). */
export function worldSay(game: Game, s: PlayerSession, text: string, card?: SagaCard): string | null {
  if (!card) {
    const no = gate(game, s, text);
    if (no) return no;
  }
  const line = stamp(game, { from: s.name, text: card ? '' : words(text), ...(card ? { card } : {}), ...chatFace(s, game) });
  deliverWorld(game, line, s.accountId);
  relay(game, { kind: 'world', line, from: s.accountId });
  return null;
}

function deliverWorld(game: Game, line: ChatLineView, from: number): void {
  keep(hub(game).world, line);
  for (const o of game.sessions) if (o.profile && !ignores(o, from)) game.sendTo(o, { t: 'chat', ...line });
}

/** Where a captain is for the local channel: her ship's place and the port she lies in. */
function placeOf(s: PlayerSession): { x: number; y: number; port: string | null } | null {
  const sh = s.ship;
  return sh ? { x: sh.state.x, y: sh.state.y, port: sh.docked ?? null } : null;
}

function inSight(a: { x: number; y: number; port: string | null }, b: { x: number; y: number; port: string | null }): boolean {
  if (a.port || b.port) return a.port === b.port;
  return Math.hypot(a.x - b.x, a.y - b.y) <= INTEREST_RADIUS;
}

/** The ships in sight (the same port when lying in one). */
export function localSay(game: Game, s: PlayerSession, text: string): string | null {
  const at = placeOf(s);
  if (!at) return 'You have no ship';
  const no = gate(game, s, text);
  if (no) return no;
  const line = stamp(game, { from: s.name, text: words(text), ch: 'local', ...chatFace(s, game) });
  keep(hub(game).local, { line, ...at });
  for (const o of game.sessions) {
    const p = placeOf(o);
    if (o.profile && p && inSight(at, p) && !ignores(o, s.accountId)) game.sendTo(o, { t: 'chat', ...line });
  }
  return null;
}

/** The group (party.ts): its members, here (a group does not cross zones: prepareHandoff). */
export function groupSay(game: Game, s: PlayerSession, text: string): string | null {
  const g = groupOfAccount(game, s.accountId);
  if (!g) return 'You sail alone';
  const t = cleanChat(text);
  if (!t) return null;
  const no = gate(game, s, t);
  if (no) return no;
  const line = stamp(game, { from: s.name, text: words(t), ch: 'group', ...chatFace(s, game) });
  const h = hub(game);
  let list = h.groups.get(g.id);
  if (!list) h.groups.set(g.id, (list = []));
  keep(list, line);
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (ms && !ignores(ms, s.accountId)) game.sendTo(ms, { t: 'chat', ...line });
  }
  return null;
}

/** The guild: its members in every zone. */
export function guildSay(game: Game, s: PlayerSession, text: string): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You are in no guild';
  const t = cleanChat(text);
  if (!t) return null;
  const no = gate(game, s, t);
  if (no) return no;
  const line = stamp(game, { from: s.name, text: words(t), ch: 'guild', ...chatFace(s, game), g: g.tag });
  deliverGuild(game, g.id, line, s.accountId);
  relay(game, { kind: 'guild', line, from: s.accountId, gid: g.id });
  return null;
}

function deliverGuild(game: Game, gid: number, line: ChatLineView, from: number): void {
  const h = hub(game);
  let list = h.guilds.get(gid);
  if (!list) h.guilds.set(gid, (list = []));
  keep(list, line);
  for (const o of game.sessions) {
    if (!o.profile || game.guilds.of(game, o.accountId)?.id !== gid) continue;
    if (!ignores(o, from)) game.sendTo(o, { t: 'chat', ...line });
  }
}

// ------------------------------------------------------------------------------------------ private words

interface DmRec {
  id: string;
  /** from (account) */
  f: number;
  /** from (name, as it was) */
  n: string;
  t: string;
  at: number;
  face?: string;
  lv?: number;
}

interface BoxRow {
  peer: number;
  name: string;
  at: number;
  unread: number;
  face?: string;
  lv?: number;
}

const dmKey = (a: number, b: number) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;
const boxKey = (a: number) => `dmbox:${a}`;

/** A captain by name, at sea here or anywhere (the database knows every name): her account and her name as written. */
function captainNamed(game: Game, raw: string): { id: number; name: string } | null {
  const want = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!want) return null;
  const o = game.sessionByName(want);
  if (o) return { id: o.accountId, name: o.name };
  const titled = want.replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase());
  const row = game.db.accountByName(want) ?? game.db.accountByName(titled);
  return row ? { id: row.id, name: row.name } : null;
}

/** Does the captain with this account keep that one among the unheard? (her saved list when she is not here) */
function deafTo(game: Game, acct: number, from: number): boolean {
  const here = game.sessionByAccount(acct);
  if (here?.profile) return ignores(here, from);
  try {
    const row = game.db.loadCaptain(acct);
    const saved = row ? (JSON.parse(row.data) as { ignored?: { id: number }[] }) : null;
    return !!saved?.ignored?.some((f) => f.id === from);
  } catch {
    return false;
  }
}

function boxUpsert(game: Game, owner: number, row: Omit<BoxRow, 'unread'>, unread: (n: number) => number): void {
  const box = game.db.getKv<BoxRow[]>(boxKey(owner)) ?? [];
  const old = box.find((b) => b.peer === row.peer);
  const next: BoxRow = { ...row, unread: unread(old?.unread ?? 0) };
  if (!row.face && old?.face) next.face = old.face;
  if (!row.lv && old?.lv) next.lv = old.lv;
  const rest = box.filter((b) => b.peer !== row.peer);
  game.db.setKv(boxKey(owner), [next, ...rest].slice(0, CHAT_DM_THREADS));
}

function recLine(r: DmRec, viewer: number, peerName: string): ChatLineView {
  return { from: r.n, text: r.t, ch: 'whisper', ...(r.f === viewer ? { to: peerName } : {}), id: r.id, at: r.at, ...(r.face ? { face: r.face } : {}), ...(r.lv ? { lv: r.lv } : {}) };
}

/** Private words to a captain by name, at sea or ashore: kept (the last CHAT_DM_KEEP of the conversation), handed to
 *  her wherever she sails, echoed to the sender. */
export function dmSay(game: Game, s: PlayerSession, toName: string, text: string): string | null {
  if (!String(toName ?? '').trim()) return 'Name a captain';
  const to = captainNamed(game, toName);
  if (!to) return 'No captain goes by that name';
  if (to.id === s.accountId) return 'You mutter to yourself';
  const t = cleanChat(text);
  if (!t) return 'Whisper to whom? /w Name words';
  if (deafTo(game, to.id, s.accountId)) return `${to.name} is not listening to you`;
  const no = gate(game, s, t);
  if (no) return no;
  const who = chatFace(s, game);
  const line = stamp(game, { from: s.name, text: words(t), ch: 'whisper', ...who });
  // kept
  const key = dmKey(s.accountId, to.id);
  const recs = game.db.getKv<DmRec[]>(key) ?? [];
  recs.push({ id: line.id!, f: s.accountId, n: s.name, t: line.text, at: line.at!, ...(who.face ? { face: who.face } : {}), ...(who.lv ? { lv: who.lv } : {}) });
  game.db.setKv(key, recs.slice(-CHAT_DM_KEEP));
  boxUpsert(game, s.accountId, { peer: to.id, name: to.name, at: line.at! }, (n) => n);
  boxUpsert(game, to.id, { peer: s.accountId, name: s.name, at: line.at!, face: who.face, lv: who.lv }, (n) => n + 1);
  // handed over: here, or in whichever zone she sails
  game.social.lastWhisper.set(to.id, s.name);
  if (!deliverDm(game, to.id, line, s.accountId)) relay(game, { kind: 'dm', line, from: s.accountId, to: to.id });
  game.sendTo(s, { t: 'chat', ...line, to: to.name });
  return null;
}

/** To the addressee if she is aboard here: whether she was. */
function deliverDm(game: Game, to: number, line: ChatLineView, from: number): boolean {
  const o = game.sessionByAccount(to);
  if (!o?.profile || o.disconnectedAt !== null || !game.sessions.has(o)) return false;
  if (!ignores(o, from)) game.sendTo(o, { t: 'chat', ...line });
  game.social.lastWhisper.set(to, line.from);
  return true;
}

/** "/w Name words" (names may have spaces: the longest name that is a captain wins) or "/r words" to the last who
 *  whispered. */
export function whisperLine(game: Game, s: PlayerSession, rest: string, reply: boolean): string | null {
  const raw = String(rest ?? '').replace(/\s+/g, ' ').trim();
  if (reply) {
    const last = game.social.lastWhisper.get(s.accountId);
    if (!last) return 'No one has whispered to you yet';
    return dmSay(game, s, last, raw);
  }
  const parts = raw ? raw.split(' ') : [];
  for (let k = parts.length - 1; k >= 1; k--) {
    const name = parts.slice(0, k).join(' ');
    if (captainNamed(game, name)) return dmSay(game, s, name, parts.slice(k).join(' '));
  }
  // only a name (and no words), or nothing at all: how it is done
  if (!parts.length || captainNamed(game, raw)) return 'Whisper to whom? /w Name words';
  return 'No captain goes by that name';
}

// ------------------------------------------------------------------------------------------ in and out

/** Is this line a chat command (a whisper or the unheard), not an admin's? */
export function chatCommand(text: string): boolean {
  return !!whisperCommand(text) || !!ignoreCommand(text);
}

/** A 'chat' message: the commands, then the channel asked for (the world when none). A refusal's words, or null. */
export function chatIn(game: Game, s: PlayerSession, msg: { text: string; ch?: string; to?: string }): string | null {
  const text = cleanChat(msg.text);
  if (!text) return null;
  const ch = msg.ch ?? 'world';
  if (ch === 'world' || ch === 'dm') {
    const w = whisperCommand(text);
    if (w) return whisperLine(game, s, w.rest, w.reply);
    const deaf = ignoreCommand(text);
    if (deaf) return ignoreAdd(game, s, deaf);
  }
  switch (ch) {
    case 'dm':
      return dmSay(game, s, msg.to ?? '', text);
    case 'local':
      return localSay(game, s, text);
    case 'group':
      return groupSay(game, s, text);
    case 'guild':
      return guildSay(game, s, text);
    default:
      return worldSay(game, s, text);
  }
}

/** A line from another zone or process. */
export function chatFromAfar(game: Game, w: ChatWire): void {
  if (!w?.line?.id || seenBefore(hub(game), w.line.id)) return;
  if (w.kind === 'world') deliverWorld(game, w.line, w.from);
  else if (w.kind === 'guild' && typeof w.gid === 'number') deliverGuild(game, w.gid, w.line, w.from);
  else if (w.kind === 'dm' && typeof w.to === 'number') deliverDm(game, w.to, w.line, w.from);
}

/** The conversations a captain keeps, the newest first (the last `per` lines of each). */
function threads(game: Game, s: PlayerSession, per: number, only?: number): ChatThreadView[] {
  const box = game.db.getKv<BoxRow[]>(boxKey(s.accountId)) ?? [];
  const out: ChatThreadView[] = [];
  for (const b of box) {
    if (only !== undefined && b.peer !== only) continue;
    if (deafTo(game, s.accountId, b.peer)) continue;
    const recs = (game.db.getKv<DmRec[]>(dmKey(s.accountId, b.peer)) ?? []).slice(-per);
    const live = game.sessionByAccount(b.peer);
    const name = live?.name ?? b.name;
    out.push({ peer: name, ...(b.face ? { face: b.face } : {}), ...(b.lv ? { lv: b.lv } : {}), unread: b.unread, lines: recs.map((r) => recLine(r, s.accountId, name)) });
  }
  return out;
}

/** The history: on coming aboard the channels' last lines she may see and her conversations; with `peer` that one
 *  conversation whole. */
export function chatHist(game: Game, s: PlayerSession, peer?: string): void {
  if (!s.profile) return;
  if (peer) {
    const p = captainNamed(game, peer);
    if (p) game.sendTo(s, { t: 'chat_hist', lines: [], dms: threads(game, s, CHAT_DM_KEEP, p.id), peer: p.name });
    return;
  }
  const h = hub(game);
  const deaf = (l: ChatLineView) => (s.profile?.ignored ?? []).some((f) => f.name === l.from);
  const lines: ChatLineView[] = h.world.filter((l) => !deaf(l));
  const at = placeOf(s);
  if (at) for (const l of h.local) if (inSight(at, l) && !deaf(l.line)) lines.push(l.line);
  const g = groupOfAccount(game, s.accountId);
  if (g) lines.push(...(h.groups.get(g.id) ?? []).filter((l) => !deaf(l)));
  const gu = game.guilds.of(game, s.accountId);
  if (gu) lines.push(...(h.guilds.get(gu.id) ?? []).filter((l) => !deaf(l)));
  lines.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  game.sendTo(s, { t: 'chat_hist', lines, dms: threads(game, s, CHAT_HISTORY) });
}

/** On coming aboard (sendInit): the history, the private words kept while she was away among it. */
export function chatOnLogin(game: Game, s: PlayerSession): void {
  chatHist(game, s);
}

/** A conversation read: its count of unread goes to nought. */
export function chatRead(game: Game, s: PlayerSession, peer: string): void {
  const p = captainNamed(game, peer);
  if (!p) return;
  const box = game.db.getKv<BoxRow[]>(boxKey(s.accountId)) ?? [];
  const row = box.find((b) => b.peer === p.id);
  if (!row || !row.unread) return;
  row.unread = 0;
  game.db.setKv(boxKey(s.accountId), box);
}

/** A report on a captain's line: kept for the harbour master (the last three hundred) and written to the log. */
export function chatReport(game: Game, s: PlayerSession, name: string, text?: string): string | null {
  const who = captainNamed(game, name);
  if (!who) return 'No captain goes by that name';
  if (who.id === s.accountId) return 'You mutter to yourself';
  const said = cleanChat(text);
  const list = game.db.getKv<{ by: number; byName: string; on: number; onName: string; text: string; at: number }[]>('chat_reports') ?? [];
  list.push({ by: s.accountId, byName: s.name, on: who.id, onName: who.name, text: said, at: game.wallNow() });
  game.db.setKv('chat_reports', list.slice(-300));
  game.log(`[chat] report by ${s.name} on ${who.name}: ${said.slice(0, 120)}`);
  game.sendTo(s, { t: 'toast', msg: 'Report sent: the harbour master will look into it.', kind: 'info' });
  return null;
}

/** The harbour master's "/mute name minutes" (0 lets her speak again): kept in the database for every zone. */
export function adminMute(game: Game, args: string[]): string {
  const mins = Number(args[args.length - 1]);
  const name = args.slice(0, -1).join(' ');
  if (!name || !Number.isFinite(mins) || mins < 0) return 'Usage: /mute name minutes';
  const who = captainNamed(game, name);
  if (!who) return 'No captain goes by that name';
  const mutes = adminMutes(game);
  const now = game.wallNow();
  for (const [k, until] of Object.entries(mutes)) if (until <= now) delete mutes[k];
  const m = Math.min(60 * 24 * 30, Math.round(mins));
  if (m === 0) delete mutes[String(who.id)];
  else mutes[String(who.id)] = now + m * 60_000;
  game.db.setKv('chat_mutes', mutes);
  const o = game.sessionByAccount(who.id);
  if (o && m > 0) game.sendTo(o, { t: 'toast', msg: `The harbour master silences you for ${m} min.`, kind: 'bad' });
  return m === 0 ? `${who.name} may speak again.` : `${who.name} is silenced for ${m} min.`;
}
