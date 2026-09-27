// Friends and whispers (docs/11 P6): a list of up to fifty captains kept with the profile — who is at sea, at what
// level, in which waters or port; a word when one of them comes aboard or goes ashore; whispers to any captain at
// sea by name ("/w Name words", names may have spaces), and a reply to the last who whispered ("/r words").

import { FRIENDS_MAX } from '../../../shared/src/protocol.ts';
import type { FriendView } from '../../../shared/src/protocol.ts';
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
  if (s.profile) game.sendTo(s, { t: 'friends', list: friendsView(game, s) });
}

/** Put a captain on the list: one at sea by name (any case), else one ashore by their exact name. */
export function friendAdd(game: Game, s: PlayerSession, name: string): string | null {
  const p = s.profile;
  if (!p) return null;
  const want = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!want) return 'Name a captain';
  const o = game.sessionByName(want);
  // Ashore, by the exact name — or as names are mostly written, each word capitalised ("анна тестова").
  const titled = want.replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase());
  const row = o ? null : game.db.accountByName(want) ?? game.db.accountByName(titled);
  const acc = o ? { id: o.accountId, name: o.name } : row ? { id: row.id, name: row.name } : null;
  if (!acc) return 'No captain goes by that name';
  if (acc.id === s.accountId) return 'You cannot befriend yourself';
  const list = (p.friends ??= []);
  if (list.some((f) => f.id === acc.id)) return `${acc.name} is already on your list of friends`;
  if (list.length >= FRIENDS_MAX) return `Your list of friends is full (${FRIENDS_MAX})`;
  list.push(acc);
  game.sendTo(s, { t: 'toast', msg: `${acc.name} is now on your list of friends.`, kind: 'good' });
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
  game.sendTo(to, { t: 'chat', from: s.name, text: words, ch: 'whisper' });
  game.sendTo(s, { t: 'chat', from: s.name, to: to.name, text: words, ch: 'whisper' });
  game.social.lastWhisper.set(to.accountId, s.name);
  return null;
}
