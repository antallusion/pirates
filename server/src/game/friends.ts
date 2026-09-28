// Friends and whispers (docs/11 P6): a list of up to fifty captains kept with the profile — who is at sea, at what
// level, in which waters or port; a word when one of them comes aboard or goes ashore; whispers to any captain at
// sea by name ("/w Name words", names may have spaces), and a reply to the last who whispered ("/r words").
// And its other side, the unheard: a captain one will not hear — their chat lines, whispers, invitations to a
// group, a barter or a duel do not reach one (letters still do: the packet boat reads no lists).

import { FRESH_LEVEL, FRIENDS_MAX, WHO_MAX } from '../../../shared/src/protocol.ts';
import type { FriendView, InspectView, WhoView } from '../../../shared/src/protocol.ts';
import { wantedLevel } from '../../../shared/src/data/factions.ts';
import { groupOfAccount } from './party.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** A captain aboard in this world (come aboard and not yet gone ashore). */
function aboard(game: Game, id: number): PlayerSession | null {
  if (!game.social.aboard.has(id)) return null;
  const s = game.sessionByAccount(id);
  return s?.profile ? s : null;
}

/** The list as its keeper sees it: those at sea first, then by name. */
export function friendsView(game: Game, s: PlayerSession): FriendView[] {
  const out: FriendView[] = (s.profile?.friends ?? []).map((f) => {
    const o = aboard(game, f.id);
    if (!o) return { name: f.name, online: false };
    f.name = o.name; // a new name (name rights): the list follows it
    return { name: o.name, online: true, level: o.profile!.level, captain: o.profile!.captain, region: o.ship?.region, docked: o.ship?.docked ?? null };
  });
  return out.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
}

export function pushFriends(game: Game, s: PlayerSession): void {
  if (s.profile) game.sendTo(s, { t: 'friends', list: friendsView(game, s), ignored: (s.profile.ignored ?? []).map((f) => f.name) });
}

/** A captain by name: one at sea (any case), else one ashore by the exact name — or as names are mostly written,
 *  each word capitalised ("анна тестова"). */
function findCaptain(game: Game, name: string): { id: number; name: string } | null {
  const want = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!want) return null;
  const o = game.sessionByName(want);
  if (o) return { id: o.accountId, name: o.name };
  const titled = want.replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase());
  const row = game.db.accountByName(want) ?? game.db.accountByName(titled);
  return row ? { id: row.id, name: row.name } : null;
}

/** Put a captain on the list (and off the unheard, if they were there). */
export function friendAdd(game: Game, s: PlayerSession, name: string): string | null {
  const p = s.profile;
  if (!p) return null;
  if (!String(name ?? '').trim()) return 'Name a captain';
  const acc = findCaptain(game, name);
  if (!acc) return 'No captain goes by that name';
  if (acc.id === s.accountId) return 'You cannot befriend yourself';
  const list = (p.friends ??= []);
  if (list.some((f) => f.id === acc.id)) return `${acc.name} is already on your list of friends`;
  if (list.length >= FRIENDS_MAX) return `Your list of friends is full (${FRIENDS_MAX})`;
  p.ignored = (p.ignored ?? []).filter((f) => f.id !== acc.id);
  list.push(acc);
  game.sendTo(s, { t: 'toast', msg: `${acc.name} is now on your list of friends.`, kind: 'good' });
  pushFriends(game, s);
  return null;
}

/** Does this captain turn a deaf ear to that one (by account, or by name for words from another process)? */
export function ignores(s: PlayerSession | null | undefined, from: number | string): boolean {
  const list = s?.profile?.ignored;
  if (!list?.length) return false;
  return typeof from === 'number' ? list.some((f) => f.id === from) : list.some((f) => f.name.toLowerCase() === from.toLowerCase());
}

/** Stop hearing a captain (off the friends too). */
export function ignoreAdd(game: Game, s: PlayerSession, name: string): string | null {
  const p = s.profile;
  if (!p) return null;
  if (!String(name ?? '').trim()) return 'Name a captain';
  const acc = findCaptain(game, name);
  if (!acc) return 'No captain goes by that name';
  if (acc.id === s.accountId) return 'You cannot stop hearing yourself';
  const list = (p.ignored ??= []);
  if (list.some((f) => f.id === acc.id)) return `You already do not hear ${acc.name}`;
  if (list.length >= FRIENDS_MAX) return `The list of the unheard is full (${FRIENDS_MAX})`;
  p.friends = (p.friends ?? []).filter((f) => f.id !== acc.id);
  list.push(acc);
  game.sendTo(s, { t: 'toast', msg: `You no longer hear ${acc.name}: not their words, whispers or invitations.`, kind: 'info' });
  pushFriends(game, s);
  return null;
}

export function ignoreRemove(game: Game, s: PlayerSession, name: string): string | null {
  const list = s.profile?.ignored ?? [];
  const n = String(name ?? '').trim().toLowerCase();
  const i = list.findIndex((f) => f.name.toLowerCase() === n);
  if (i < 0) return 'Not on your list of the unheard';
  const [f] = list.splice(i, 1);
  game.sendTo(s, { t: 'toast', msg: `You hear ${f.name} again.`, kind: 'info' });
  pushFriends(game, s);
  return null;
}

export function friendRemove(game: Game, s: PlayerSession, name: string): string | null {
  const list = s.profile?.friends ?? [];
  const n = String(name ?? '').trim().toLowerCase();
  const i = list.findIndex((f) => f.name.toLowerCase() === n);
  if (i < 0) return 'Not on your list of friends';
  const [f] = list.splice(i, 1);
  game.sendTo(s, { t: 'toast', msg: `${f.name} is off your list of friends.`, kind: 'info' });
  pushFriends(game, s);
  return null;
}

/** A captain comes aboard or goes ashore: a word to every captain aboard who keeps them as a friend. */
export function friendsPresence(game: Game, s: PlayerSession, isAboard: boolean): void {
  const seen = game.social.aboard;
  if (!s.profile || isAboard === seen.has(s.accountId)) return;
  if (isAboard) seen.add(s.accountId);
  else seen.delete(s.accountId);
  for (const o of game.sessions) {
    if (o === s || !o.profile?.friends?.some((f) => f.id === s.accountId)) continue;
    game.sendTo(o, { t: 'toast', msg: isAboard ? `Friend at sea: ${s.name}.` : `Friend ashore: ${s.name}.`, kind: 'info' });
    pushFriends(game, o);
  }
}

/** "/ignore Name" in chat (or "/игнор"): the name, else null. */
export function ignoreCommand(text: string): string | null {
  const m = /^\/(ignore|игнор)\s+(.+)$/is.exec(text);
  return m ? m[2] : null;
}

/** Who is at sea (docs/11 P6), as WoW's /who: every captain aboard but oneself, by a part of the name or the
 *  guild's tag, in all waters or only one's own; one's own waters first, then the most seasoned, thirty at most. */
export function whoList(game: Game, s: PlayerSession, q: string, here: boolean, fresh = false): { list: WhoView[]; total: number } {
  const want = String(q ?? '').trim().toLowerCase().slice(0, 24);
  const mine = s.ship?.region;
  const out: WhoView[] = [];
  for (const acc of game.social.aboard) {
    const o = acc === s.accountId ? null : game.sessionByAccount(acc);
    if (!o?.profile || !o.ship) continue;
    if (here && o.ship.region !== mine) continue;
    if (fresh && o.profile.level > FRESH_LEVEL) continue;
    const tag = game.guilds.of(game, acc)?.tag;
    if (want && !o.name.toLowerCase().includes(want) && !(tag && tag.toLowerCase() === want.replace(/^\[|\]$/g, ''))) continue;
    out.push({ name: o.name, level: o.profile.level, captain: o.profile.captain, region: o.ship.region, docked: o.ship.docked ?? null, ...(tag ? { guild: tag } : {}), grouped: !!groupOfAccount(game, acc) });
  }
  out.sort((a, b) => Number(b.region === mine) - Number(a.region === mine) || b.level - a.level || a.name.localeCompare(b.name));
  return { list: out.slice(0, WHO_MAX), total: out.length };
}

/** Inspect a captain aboard (docs/11 P6): what anyone on the quay could learn of them — never the purse or hold. */
export function inspectView(game: Game, s: PlayerSession, name: string): InspectView | string {
  const o = game.sessionByName(String(name ?? ''));
  if (!o?.profile || !o.ship || !game.social.aboard.has(o.accountId)) return 'No captain of that name is at sea';
  const p = o.profile;
  const g = game.guilds.of(game, o.accountId);
  void s;
  return {
    name: o.name, level: p.level, captain: p.captain, title: p.title, guild: g ? { name: g.name, tag: g.tag } : null,
    ship: { name: o.ship.name, classId: o.ship.cls.id, level: o.ship.shipLevel }, region: o.ship.region, deeds: p.deeds.length, seasonLevel: p.season.level,
    questsDone: p.quests.done.length, contracts: p.quests.done.filter((id) => id.startsWith('elite_')).length, mentored: p.stats.mentored ?? 0,
    rating: Math.round(p.pvp.rating ?? 0), wanted: wantedLevel(p.infamy),
  };
}

/** A chat line that is a whisper ("/w", "/r" and their Russian twins): the words after it, and whether a reply. */
export function whisperCommand(text: string): { rest: string; reply: boolean } | null {
  const m = /^\/(w|t|whisper|tell|ш|шепнуть|r|reply|о|ответ)(?:\s+|$)(.*)$/is.exec(text);
  if (!m) return null;
  return { rest: m[2], reply: /^(r|reply|о|ответ)$/i.test(m[1]) };
}

/** Whisper to a captain at sea ("Name words" — the longest name that sails wins), or reply to the last who did. */
export function whisper(game: Game, s: PlayerSession, text: string, reply = false): string | null {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  let to: PlayerSession | undefined;
  let words = '';
  if (reply) {
    const last = game.social.lastWhisper.get(s.accountId);
    if (!last) return 'No one has whispered to you yet';
    to = game.sessionByName(last);
    if (!to) return `${last} is not at sea`;
    words = raw;
  } else {
    const parts = raw ? raw.split(' ') : [];
    for (let k = parts.length - 1; k >= 1 && !to; k--) {
      to = game.sessionByName(parts.slice(0, k).join(' '));
      if (to) words = parts.slice(k).join(' ');
    }
    // Only a name (and no words), or nothing at all: how it is done.
    if (!to) return parts.length < 2 || game.sessionByName(raw) ? 'Whisper to whom? /w Name words' : 'No captain of that name is at sea';
  }
  if (!words) return 'Whisper to whom? /w Name words';
  if (to === s) return 'You mutter to yourself';
  if (ignores(to, s.accountId)) return `${to.name} is not listening to you`;
  game.sendTo(to, { t: 'chat', from: s.name, text: words, ch: 'whisper' });
  game.sendTo(s, { t: 'chat', from: s.name, to: to.name, text: words, ch: 'whisper' });
  game.social.lastWhisper.set(to.accountId, s.name);
  return null;
}
