// The players' chat, what both sides agree on (docs/28; owner, 2026-10-11: «реализация реалтайм чата, он должен быть
// суперудобный даже на мобиле … можно отправлять специфические "смайлики" игровые из наших ассетов»):
//  - the limits (a line's length, how fast a captain may speak, how many lines are kept);
//  - the emotes: `:rum:` codes and the game's own icons they stand for, in four groups, with their Russian names for the
//    picker and the autocomplete (no emoji fonts, no outside pictures, nothing painted anew);
//  - the coarse words of both languages, masked (never refused);
//  - which links may be followed (our own domain only; every other one stays words).

import { matchAllAfter } from './lookbehind.ts';

/** The longest line, in characters. */
export const CHAT_MAX = 300;
/** At least this long between two lines of one captain (seconds)… */
export const CHAT_GAP = 1.5;
/** …and no more than CHAT_BURST lines in any CHAT_WINDOW seconds. */
export const CHAT_BURST = 8;
export const CHAT_WINDOW = 20;
/** Breaking the window (or the gap three times in it) silences her for this long (seconds). */
export const CHAT_BREACH_MUTE = 30;
/** The same words again within this long are refused (seconds). */
export const CHAT_DUP_WINDOW = 30;
/** Lines kept of each channel (and of each private conversation), on the server and on the screen (owner, 2026-10-29:
 *  «показывай только переписку, которая хранится 8 часов и потом удаляется. (или сделай ограничение в 50 сообщений и
 *  стирай)»: both, the stricter wins). */
export const CHAT_HISTORY = 50;
/** How long a line is kept (ms): eight hours. */
export const CHAT_KEEP_MS = 8 * 3600_000;
/** Lines kept of each private conversation (in the database): the same fifty. */
export const CHAT_DM_KEEP = CHAT_HISTORY;

/** The chat's window: the lines of the last CHAT_KEEP_MS, at most `max` of them (the newest), in their order. A line
 *  without a time is taken as new. Returns the same array when nothing goes (so callers can tell). */
export function chatWindow<T>(list: T[], now: number, at: (x: T) => number | undefined, max = CHAT_HISTORY): T[] {
  const cut = now - CHAT_KEEP_MS;
  let from = 0;
  while (from < list.length && (at(list[from]) ?? now) < cut) from++;
  from = Math.max(from, list.length - max);
  if (from <= 0) return list;
  // (a line out of order — older than one after it — still goes when it is too old)
  return list.slice(from).filter((x) => (at(x) ?? now) >= cut);
}

/** The chat button's badge: nothing, the count, or «99+». */
export function chatBadgeText(n: number): string {
  return n <= 0 ? '' : n > 99 ? '99+' : String(n);
}

/** A line the chat button counts: someone else's words (never her own, never the sea's news, never one she hid), newer
 *  than her last look. */
export function chatLineFresh(line: { from?: string; ch?: string | null; at?: number; to?: string }, seenAt: number, self: string | null, hidden = false): boolean {
  if (!line.from || line.ch === 'sys' || line.to || hidden) return false;
  if (self && line.from.replace(/^\[[^\]]*\]\s*/, '') === self) return false;
  // (a line with no stamp is never counted: it could never be marked seen)
  return typeof line.at === 'number' && line.at > seenAt;
}

/** Where the fresh lines are: the key of the channel list (`world`, `local`, `group`, `guild`, `dm:<name>`) holding
 *  the newest line counted, or null — the chat opens there, so what the badge counted is what she sees. */
export function chatFreshKey(lists: Iterable<readonly [string, readonly { from?: string; ch?: string | null; at?: number; to?: string }[]]>, seenAt: number, self: string | null, hidden: (l: { from?: string }) => boolean = () => false): string | null {
  let best: string | null = null, bestAt = -Infinity;
  for (const [k, list] of lists) {
    for (const l of list) {
      if (chatLineFresh(l, seenAt, self, hidden(l)) && l.at! > bestAt) {
        bestAt = l.at!;
        best = k;
      }
    }
  }
  return best;
}

/** What the chat button counts (owner, 2026-10-29: «в чате если кто-то написал сделай в значке чата вверху справа
 *  циферку типа новое сообщение до 99»): the lines of other captains since the chat was last seen, counted over the
 *  lines the chat HOLDS (so the badge never promises a line the window has already let go — the 2026-10-29 bug: «в чате
 *  показано два сообщения, я открываю - а там пусто»). The last look is in the server's clock and kept by the caller
 *  (localStorage), so a reload counts only what is new. */
export class ChatUnread {
  count = 0;
  seenAt: number;
  constructor(seenAt = 0) {
    this.seenAt = seenAt;
  }
  /** Counted again over every line held (the channels' lists, each already cut to the window). */
  recount(lists: Iterable<readonly { from?: string; ch?: string | null; at?: number; to?: string }[]>, self: string | null, hidden: (l: { from?: string }) => boolean = () => false): number {
    let n = 0;
    for (const list of lists) for (const l of list) if (chatLineFresh(l, this.seenAt, self, hidden(l))) n++;
    return (this.count = n);
  }
  /** The chat looked at (`now`: the server's clock as the reader knows it): nothing new, from now on. */
  seen(now: number): void {
    this.count = 0;
    this.seenAt = Math.max(this.seenAt, now);
  }
  get text(): string {
    return chatBadgeText(this.count);
  }
}
/** Conversations a captain keeps. */
export const CHAT_DM_THREADS = 40;

/** The channels: everyone online, the ships in sight, the group, the guild, private words, and the sea's own news. */
export type ChatChannel = 'world' | 'local' | 'group' | 'guild' | 'dm' | 'sys';

export type EmoteGroup = 'mood' | 'sea' | 'battle' | 'loot';
export const EMOTE_GROUPS: readonly EmoteGroup[] = ['mood', 'sea', 'battle', 'loot'];

export interface Emote {
  /** typed as `:code:` */
  code: string;
  /** the game's icon it shows */
  art: string;
  group: EmoteGroup;
  /** its Russian name (the picker's title and the autocomplete after «:») */
  ru: string;
}

const E = (code: string, art: string, group: EmoteGroup, ru: string): Emote => ({ code, art, group, ru });

/** Forty-seven emotes, every one a cut-out icon of the game that reads at 20 px (a contact sheet was looked at): no
 *  skulls, bones or blood (the owner's rule — the «wanted» poster and the black flag carry a skull and are left out). */
export const EMOTES: readonly Emote[] = [
  // mood
  E('heart', 'icon.tattoo_heart', 'mood', 'сердце'), E('rose', 'icon.tattoo_rose', 'mood', 'роза'), E('star', 'icon.tattoo_star', 'mood', 'звезда'),
  E('swallow', 'icon.tattoo_swallow', 'mood', 'ласточка'), E('eye', 'icon.tattoo_eye', 'mood', 'глаз'), E('mermaid', 'icon.tattoo_mermaid', 'mood', 'русалка'),
  E('cat', 'icon.pet_cat', 'mood', 'кот'), E('dog', 'icon.pet_dog', 'mood', 'пёс'), E('parrot', 'icon.pet_parrot', 'mood', 'попугай'),
  E('monkey', 'icon.pet_monkey', 'mood', 'обезьянка'), E('rum', 'icon.good_rum', 'mood', 'ром'), E('pipe', 'icon.good_tobacco', 'mood', 'трубка'),
  // the sea
  E('anchor', 'icon.anchor', 'sea', 'якорь'), E('compass', 'icon.item_brass_compass', 'sea', 'компас'), E('wheel', 'icon.item_ship_wheel', 'sea', 'штурвал'),
  E('ship', 'icon.map_ship', 'sea', 'корабль'), E('storm', 'icon.weather_storm', 'sea', 'шторм'), E('fog', 'icon.weather_fog', 'sea', 'туман'),
  E('moon', 'icon.weather_clear', 'sea', 'луна'), E('wind', 'icon.wind', 'sea', 'ветер'), E('kraken', 'icon.map_monster', 'sea', 'кракен'),
  E('octopus', 'icon.tattoo_octopus', 'sea', 'осьминог'), E('fish', 'icon.good_fish', 'sea', 'рыба'), E('crab', 'icon.fish_crab', 'sea', 'краб'),
  E('whirl', 'icon.map_whirlpool', 'sea', 'водоворот'), E('turtle', 'icon.tattoo_turtle', 'sea', 'черепаха'), E('orca', 'icon.tattoo_orca', 'sea', 'косатка'),
  // battle
  E('cannon', 'icon.gun_long_9', 'battle', 'пушка'), E('fire', 'icon.fire', 'battle', 'огонь'), E('sabres', 'icon.tattoo_sabres', 'battle', 'сабли'),
  E('pistols', 'icon.item_duelling_pistols', 'battle', 'пистоли'), E('keg', 'icon.mount_powder_kegs', 'battle', 'порох'), E('shield', 'icon.bt_defend', 'battle', 'щит'),
  E('drums', 'icon.mount_war_drums', 'battle', 'барабаны'), E('hook', 'icon.tattoo_hook', 'battle', 'крюк'), E('shark', 'icon.tattoo_shark_tooth', 'battle', 'акула'),
  E('crown', 'icon.faction_crown', 'battle', 'корона'),
  // loot
  E('coin', 'icon.coin', 'loot', 'монета'), E('doubloon', 'icon.doubloon', 'loot', 'дублон'), E('chest', 'icon.map_treasure', 'loot', 'сундук'),
  E('pearl', 'icon.good_pearls', 'loot', 'жемчуг'), E('ring', 'icon.item_signet', 'loot', 'перстень'), E('xp', 'icon.xp', 'loot', 'опыт'),
  E('bell', 'icon.tattoo_bell', 'loot', 'колокол'), E('hat', 'icon.item_tricorne', 'loot', 'треуголка'), E('bottle', 'icon.tattoo_bottle', 'loot', 'бутылка'),
  E('lantern', 'icon.tattoo_lantern', 'loot', 'фонарь'),
];

/** Other words for the same pictures, typed by hand (the older chat's tokens among them). */
export const EMOTE_ALIASES: Readonly<Record<string, string>> = { gold: 'doubloon', map: 'chest', monster: 'kraken', treasure: 'chest', grog: 'rum', sword: 'sabres' };

const BY_CODE = new Map<string, Emote>(EMOTES.map((e) => [e.code, e]));

/** The emote a code stands for (an alias too), or undefined for any word we do not know. */
export function emoteOf(code: string): Emote | undefined {
  const k = code.toLowerCase();
  return BY_CODE.get(k) ?? (EMOTE_ALIASES[k] ? BY_CODE.get(EMOTE_ALIASES[k]) : undefined);
}

/** A line cut into words and emotes: only known codes become emotes; `:anything:` else stays words. */
export type ChatPart = { k: 'text'; s: string } | { k: 'emote'; e: Emote; code: string };
export const EMOTE_RE = /:([a-z0-9_]{2,12}):/gi;

export function chatParts(text: string): ChatPart[] {
  const out: ChatPart[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOTE_RE)) {
    const e = emoteOf(m[1]);
    if (!e) continue;
    if (m.index! > last) out.push({ k: 'text', s: text.slice(last, m.index) });
    out.push({ k: 'emote', e, code: m[1].toLowerCase() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ k: 'text', s: text.slice(last) });
  return out;
}

/** Emotes whose code or Russian name begins with what was typed after «:» (the autocomplete), the closest first. */
export function emoteSuggest(prefix: string, max = 8): Emote[] {
  const p = prefix.toLowerCase().replace(/ё/g, 'е');
  if (!p) return EMOTES.slice(0, max);
  const ru = (e: Emote) => e.ru.replace(/ё/g, 'е');
  const starts = EMOTES.filter((e) => e.code.startsWith(p) || ru(e).startsWith(p));
  const inside = EMOTES.filter((e) => !starts.includes(e) && (e.code.includes(p) || ru(e).includes(p)));
  return [...starts, ...inside].slice(0, max);
}

// ------------------------------------------------------------------------------------------ the coarse words

/** Latin letters that look Cyrillic (and the other way round), so «xуй» and «сукa» are caught: one letter for one,
 *  so a match in the folded line masks the same letters of the real one. */
const FOLD: Record<string, string> = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', ё: 'е', '0': 'о', '3': 'з', '6': 'б' };
/** The same line lowered and folded to Cyrillic look-alikes, one UTF-16 unit for one (so the indices of a match in it
 *  are the indices in the real line). */
function folded(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const lo = s[i].toLowerCase();
    const ch = lo.length === 1 ? lo : s[i];
    out += FOLD[ch] ?? ch;
  }
  return out;
}

/** Russian stems, matched at the start of a word (so «корабля», «страхуй», «небо» and «хлеб» stay as they are): the
 *  start of a word is checked in code (ruCoarse), not by a lookbehind — Safari before 16.4 cannot parse one. */
export const RU_BAD = new RegExp(
  `(?:(?:на|за|вы|по|от|до|при|раз|об|у|въ|съ)?(?:хуй|хуя|хую|хуе|хуи|хуё)[а-я]*|(?:[а-я]*пизд[а-я]*)|(?:на|за|вы|по|от|до|при|раз|об|у|въ|съ)?(?:еб|ёб)(?:а|у|л|н|ё|и|о)[а-я]*|бля[а-я]*|сук(?:а|и|у|е|ой|ам|ами)(?![а-я])|муда[кч][а-я]*|мудил[а-я]*|пид[оа]р[а-я]*|залуп[а-я]*|гандон[а-я]*|шлюх[а-я]*)`,
  'g',
);
/** The Russian coarse words of a folded line: RU_BAD's matches that start a word (no letter а–я or a–z before). */
export const ruCoarse = (line: string): RegExpExecArray[] => matchAllAfter(RU_BAD, line, (before) => !/[а-яa-z]/.test(before));
/** English, whole words (so «Dickens», «cockpit», «Scunthorpe» and «shell» stay). */
const EN_BAD = /\b(?:fuck\w*|motherfuck\w*|shit(?:s|ty|head|hole)?|bitch(?:es|y)?|cunts?|assholes?|dick(?:s|head)?|whores?|nigg(?:er|a)s?|faggots?|fags?)\b/gi;

/** The line with every coarse word masked: its first letter kept, the rest stars (nothing is refused). */
export function maskBadWords(text: string): string {
  // UTF-16 units one for one with the folded line (a coarse word is letters only: never half a surrogate pair)
  const chars = text.split('');
  const hit = (start: number, len: number) => {
    for (let i = start + 1; i < start + len && i < chars.length; i++) if (/\S/.test(chars[i])) chars[i] = '*';
  };
  for (const m of ruCoarse(folded(text))) hit(m.index, m[0].length);
  for (const m of text.matchAll(EN_BAD)) hit(m.index!, m[0].length);
  return chars.join('');
}

// ------------------------------------------------------------------------------------------ links

/** Our own domain: its links may be followed; every other one is shown as words. */
export const OWN_HOSTS = ['gravetidegame.com'];
export const LINK_RE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;

/** A link of our own domain as an address to open (https), or null for any other. */
export function ownLink(s: string): string | null {
  const m = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,})(\/[^\s<]*)?$/i.exec(s);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (!OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return `https://${host}${m[2] ?? '/'}`;
}

/** What makes two lines the same for the duplicate check: lowered, folded, no spaces or stops. */
export function chatKey(text: string): string {
  return folded(text).replace(/[\s.,!?…\-—_*'"«»]+/g, '');
}
