// The forum's Markdown (docs/32_FORUM.md §6): a small renderer with a strict whitelist, shared by the server (the posts)
// and the page (the editor's preview). The source is never passed through: every character of it is escaped, and the
// only tags in the output are the ones written here, with attributes written here.
//
//   **bold**  *italic* _italic_  ~~strike~~  ||spoiler||  `code`  ```fenced code```
//   [text](https://… or /…)   https://… (an autolink)   @Name  @[Name with spaces]
//   ![caption](/api/forum/file/x.webp)   ![caption](/api/forum/file/x.mp4 /api/forum/file/poster.webp)   a YouTube link alone on a line
//   - list   1. list   > quote   [quote=Name#123] … [/quote]   [spoiler=Title] … [/spoiler]   ## heading   ---

import { maskBadWords, OWN_HOSTS } from '../chat.ts';
import { typo } from '../typo.ts';
import { execAfter, matchAllAfter } from '../lookbehind.ts';

export interface MdOptions {
  /** The reader's language: «… wrote:», «Spoiler», «Play». */
  lang?: 'ru' | 'en';
  /** A profile's address by name: `${userBase}@${name}`. */
  userBase?: string;
  /** A post's address: `${postBase}${id}`. */
  postBase?: string;
}

const MAX_SRC = 40_000;
const MAX_DEPTH = 4;

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const WORDS = {
  ru: { wrote: 'писал', spoiler: 'Спойлер', play: 'Смотреть видео' },
  en: { wrote: 'wrote', spoiler: 'Spoiler', play: 'Play the video' },
};

/** The language of a text by its letters (for the typography). */
export function textLang(s: string): 'ru' | 'en' {
  const cyr = (s.match(/[а-яё]/gi) ?? []).length;
  const lat = (s.match(/[a-z]/gi) ?? []).length;
  return cyr >= lat ? 'ru' : 'en';
}

// ------------------------------------------------------------------------------------------------ addresses

/** An address a link may lead to: http(s) with a host, a same-site path (never `//` or a backslash), or an anchor. */
export function safeHref(u: string): string | null {
  if (/[\u0000-\u001f\u007f\\\s"'<>`]/.test(u) || u.length > 2000) return null;
  if (/^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(u)) return u;
  if (/^\/(?!\/)[^\s]*$/.test(u)) return u;
  if (/^#[\w-]{1,64}$/.test(u)) return u;
  return null;
}

/** A picture or a film may only come from the forum's uploads or the game's own art. */
export function safeMedia(u: string): string | null {
  return /^\/(?:api\/forum\/file|assets|site\/img)\/[\w-]+(?:\/[\w-]+)*\.(?:webp|png|jpe?g|avif|mp4)$/i.test(u) ? u : null;
}

export function hostOf(u: string): string | null {
  const m = /^https?:\/\/([a-z0-9.-]+)/i.exec(u);
  return m ? m[1].toLowerCase() : null;
}
export const isOwnHost = (h: string): boolean => OWN_HOSTS.some((o) => h === o || h.endsWith(`.${o}`)) || h === 'localhost' || h === '127.0.0.1';

/** A YouTube video's id from its usual addresses, or null. */
export function youtubeId(u: string): string | null {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#][^\s]*)?$/i.exec(u);
  return m ? m[1] : null;
}

// ------------------------------------------------------------------------------------------------ blocks

export function renderMd(src: string, o: MdOptions = {}): string {
  const lines = normalize(String(src ?? '').slice(0, MAX_SRC));
  return blocks(lines, o, 0);
}

/** Lines, with every [quote]/[spoiler] tag on a line of its own (outside fenced code). */
function normalize(s: string): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of s.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence || /^\s*```/.test(line)) {
      out.push(line);
      continue;
    }
    out.push(...line.replace(/(\[(?:quote|spoiler)(?:=[^\]\n]{0,80})?\]|\[\/(?:quote|spoiler)\])/gi, '\n$1\n').split('\n'));
  }
  return out;
}

function blocks(lines: string[], o: MdOptions, depth: number): string {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(paragraph(para, o));
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('```')) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && lines[i].trim() !== '```'; i++) body.push(lines[i]);
      out.push(`<pre class="md-code"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const open = /^\[(quote|spoiler)(?:=([^\]\n]{0,80}))?\]$/i.exec(t);
    if (open && depth < MAX_DEPTH) {
      const kind = open[1].toLowerCase();
      const openRe = new RegExp(`^\\[${kind}(?:=[^\\]\\n]{0,80})?\\]$`, 'i');
      const closeRe = new RegExp(`^\\[/${kind}\\]$`, 'i');
      let lvl = 1, j = i + 1;
      for (; j < lines.length; j++) {
        const tj = lines[j].trim();
        if (openRe.test(tj)) lvl++;
        else if (closeRe.test(tj) && --lvl === 0) break;
      }
      if (j < lines.length) {
        flush();
        const inner = blocks(lines.slice(i + 1, j), o, depth + 1);
        out.push(kind === 'quote' ? quoteBlock(open[2] ?? '', inner, o) : spoilerBlock(open[2] ?? '', inner, o));
        i = j;
        continue;
      }
    }
    if (/^\[\/?(?:quote|spoiler)(?:=[^\]\n]{0,80})?\]$/i.test(t)) continue; // a tag without its pair
    if (t.startsWith('>') && depth < MAX_DEPTH) {
      flush();
      const inner: string[] = [];
      for (; i < lines.length && lines[i].trim().startsWith('>'); i++) inner.push(lines[i].trim().replace(/^>\s?/, ''));
      i--;
      out.push(`<blockquote class="md-bq">${blocks(inner, o, depth + 1)}</blockquote>`);
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flush();
      out.push('<hr>');
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(t);
    if (h) {
      flush();
      const tag = h[1].length === 3 ? 'h4' : 'h3';
      out.push(`<${tag} class="md-h">${inline(text(h[2]), o, 0)}</${tag}>`);
      continue;
    }
    if (/^[-*+]\s+\S/.test(t) || /^\d{1,3}[.)]\s+\S/.test(t)) {
      flush();
      const ordered = /^\d/.test(t);
      const re = ordered ? /^\d{1,3}[.)]\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const m = re.exec(lines[i].trim());
        if (m) items.push(m[1]);
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += `\n${lines[i].trim()}`;
        else break;
      }
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag} class="md-list">${items.map((x) => `<li>${x.split('\n').map((l) => inline(text(l), o, 0)).join('<br>')}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (!t) {
      flush();
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join('');
}

/** The typography for a line of text (its language by its letters). */
const text = (s: string): string => typo(s.trim(), textLang(s));

function paragraph(lines: string[], o: MdOptions): string {
  if (lines.length === 1) {
    const one = lines[0].trim();
    const yt = youtubeId(one);
    if (yt) return youtubeBlock(yt, o);
  }
  return `<p>${lines.map((l) => inline(text(l), o, 0)).join('<br>')}</p>`;
}

function youtubeBlock(id: string, o: MdOptions): string {
  const w = WORDS[o.lang ?? 'ru'];
  return `<span class="md-yt" data-yt="${id}"><button type="button" class="md-yt-play" aria-label="${esc(w.play)}"></button></span>`;
}

function quoteBlock(arg: string, inner: string, o: MdOptions): string {
  const w = WORDS[o.lang ?? 'ru'];
  const m = /^\s*"?([^"#\]\n]{1,40}?)"?\s*(?:#(\d{1,10}))?\s*$/.exec(arg.replace(/ /g, ' '));
  let by = '';
  if (m) {
    const name = m[1].trim();
    const who = o.userBase ? `<a class="md-at" href="${esc(o.userBase)}@${esc(encodeURIComponent(name))}">${esc(name)}</a>` : `<b>${esc(name)}</b>`;
    const link = m[2] && o.postBase ? ` <a class="md-quote-to" href="${esc(o.postBase)}${m[2]}" aria-label="#${m[2]}">#</a>` : '';
    by = `<span class="md-quote-by">${who} ${w.wrote}:${link}</span>`;
  }
  return `<blockquote class="md-quote">${by}${inner}</blockquote>`;
}

function spoilerBlock(title: string, inner: string, o: MdOptions): string {
  const w = WORDS[o.lang ?? 'ru'];
  const t = title.trim() ? inline(text(title), o, 2) : esc(w.spoiler);
  return `<details class="md-spoiler"><summary>${t}</summary><div class="md-spoiler-in">${inner}</div></details>`;
}

// ------------------------------------------------------------------------------------------------ inline

// 1-2 code · 3-5 picture or film · 6-7 link · 8 bold · 9 strike · 10 spoiler · 11 italic * · 12 italic _ · 13 autolink · 14-15 mention
// No lookbehind (Safari before 16.4 cannot parse one, and the whole game failed to start there): an italic's closing mark
// after a non-space is the content's own last `\S`, and what may not stand before an italic or a mention is checked in
// code (inlineOk) — those three start with `*`, `_` and `@`, which only bold (`**`, tried first) also starts with.
const INLINE =
  /(`+)([^`\n]+?)\1|!\[([^\]\n]{0,200})\]\(\s*([^\s)]+)(?:\s+([^\s)]+))?\s*\)|\[([^\]\n]{1,300})\]\(\s*([^\s)]+)\s*\)|\*\*(?=\S)(.+?)\*\*|~~(?=\S)(.+?)~~|\|\|(?=\S)(.+?)\|\||\*(?=\S)(.*?\S)\*(?![\p{L}\p{N}*])|_(?=\S)(.*?\S)_(?![\p{L}\p{N}_])|(https?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]])|@(?:\[([^\]\n]{3,20})\]|([\p{L}\p{N}_'-]{3,20}))/gu;

/** What may not stand just before an italic `*`, an italic `_` and a mention `@` (a letter, a digit or the mark itself). */
const NOT_AFTER_STAR = /[\p{L}\p{N}*]/u;
const NOT_AFTER_UNDER = /[\p{L}\p{N}_]/u;
const NOT_AFTER_AT = /[\p{L}\p{N}_@/]/u;

/** Whether an INLINE match may start where it stands (the lookbehinds of old, done in code). */
function inlineOk(before: string, m: RegExpExecArray): boolean {
  if (m[11] !== undefined) return !NOT_AFTER_STAR.test(before);
  if (m[12] !== undefined) return !NOT_AFTER_UNDER.test(before);
  if (m[14] !== undefined || m[15] !== undefined) return !NOT_AFTER_AT.test(before);
  return true;
}

/** The inline marks of a line, in order — exactly the matches the old lookbehind regex gave (tests/compat-regex.test.ts). */
export function inlineMatches(s: string): RegExpExecArray[] {
  return matchAllAfter(INLINE, s, inlineOk);
}

/** Plain words: escaped, the coarse ones masked. */
const words = (s: string): string => esc(maskBadWords(s));

/** `depth` 0: anything; 1: inside a link's words (no links); 2: words only and the plain marks. */
function inline(s: string, o: MdOptions, depth: number): string {
  if (depth > 3) return words(s);
  let out = '';
  let last = 0;
  INLINE.lastIndex = 0;
  const re = new RegExp(INLINE.source, INLINE.flags);
  for (let m = execAfter(re, s, inlineOk); m; m = execAfter(re, s, inlineOk)) {
    const piece = piece_(m, o, depth);
    if (piece === null) continue; // not ours here: left to the words (the next match starts after this one's first char)
    out += words(s.slice(last, m.index)) + piece;
    last = m.index + m[0].length;
  }
  return out + words(s.slice(last));
}

function piece_(m: RegExpExecArray, o: MdOptions, depth: number): string | null {
  const w = WORDS[o.lang ?? 'ru'];
  if (m[2] !== undefined) return `<code>${esc(m[2])}</code>`;
  if (m[4] !== undefined) {
    if (depth > 0) return null;
    const cap = (m[3] ?? '').trim();
    const yt = youtubeId(m[4]);
    if (yt) return youtubeBlock(yt, o);
    const src = safeMedia(m[4]);
    if (!src) {
      const href = safeHref(m[4]);
      return href ? link(href, cap || m[4], o, depth) : null;
    }
    if (/\.mp4$/i.test(src)) {
      const poster = m[5] ? safeMedia(m[5]) : null;
      const p = poster && !/\.mp4$/i.test(poster) ? ` poster="${esc(poster)}"` : '';
      return `<span class="md-video"><video controls preload="none" playsinline${p} src="${esc(src)}"></video>${cap ? `<span class="md-cap">${words(cap)}</span>` : ''}</span>`;
    }
    return `<img class="md-img" src="${esc(src)}" alt="${esc(cap)}" loading="lazy" decoding="async">`;
  }
  if (m[7] !== undefined) {
    if (depth > 0) return null;
    const href = safeHref(m[7]);
    if (!href) return null;
    return link(href, m[6], o, depth);
  }
  if (m[8] !== undefined) return `<strong>${inline(m[8], o, depth + 1)}</strong>`;
  if (m[9] !== undefined) return `<del>${inline(m[9], o, depth + 1)}</del>`;
  if (m[10] !== undefined) return `<span class="md-sp" tabindex="0" title="${esc(w.spoiler)}">${inline(m[10], o, depth + 1)}</span>`;
  if (m[11] !== undefined) return `<em>${inline(m[11], o, depth + 1)}</em>`;
  if (m[12] !== undefined) return `<em>${inline(m[12], o, depth + 1)}</em>`;
  if (m[13] !== undefined) {
    if (depth > 0) return null;
    const href = safeHref(m[13]);
    return href ? link(href, m[13], o, 3) : null;
  }
  const name = (m[14] ?? m[15] ?? '').replace(/ /g, ' ').trim();
  if (name) {
    if (depth > 0 || !o.userBase) return `<b class="md-at">@${esc(name)}</b>`;
    return `<a class="md-at" href="${esc(o.userBase)}@${esc(encodeURIComponent(name))}">@${esc(name)}</a>`;
  }
  return null;
}

function link(href: string, label: string, o: MdOptions, depth: number): string {
  const host = hostOf(href);
  const ext = host !== null && !isOwnHost(host);
  const inner = depth >= 3 ? words(label) : inline(label, o, Math.max(depth, 1));
  return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="nofollow ugc noopener noreferrer" class="md-ext"' : ''}>${inner}</a>`;
}

// ------------------------------------------------------------------------------------------------ scans (the server's)

/** The source without its code (mentions and links in code are not meant). */
function withoutCode(src: string): string {
  return String(src ?? '').replace(/```[\s\S]*?(?:```|$)/g, ' ').replace(/`[^`\n]+`/g, ' ');
}

/** A mention: @Name or @[Two words] (not after a letter, a digit, `_`, `@` or `/` — checked in code, see inlineOk). */
const MENTION = /@(?:\[([^\]\n]{3,20})\]|([\p{L}\p{N}_'-]{3,20}))/gu;

/** The names @mentioned (at most ten, each once). */
export function mentionsOf(src: string): string[] {
  const out = new Set<string>();
  for (const m of matchAllAfter(MENTION, withoutCode(src), (before) => !NOT_AFTER_AT.test(before))) {
    out.add((m[1] ?? m[2]).replace(/ /g, ' ').trim());
    if (out.size >= 10) break;
  }
  return [...out];
}

/** The posts quoted ([quote=Name#id]). */
export function quotesOf(src: string): number[] {
  const out = new Set<number>();
  for (const m of withoutCode(src).matchAll(/\[quote=[^\]#\n]{1,40}#(\d{1,10})\]/gi)) out.add(Number(m[1]));
  return [...out].slice(0, 10);
}

/** The hosts of other sites linked (a new member may not post them). */
export function foreignHosts(src: string): string[] {
  const out = new Set<string>();
  for (const m of withoutCode(src).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const h = m[1].toLowerCase();
    if (!isOwnHost(h)) out.add(h);
  }
  return [...out];
}

/** The words of a post for the search and the previews (the marks taken out). */
export function plainText(src: string): string {
  return String(src ?? '')
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/\[\/?(?:quote|spoiler)(?:=[^\]\n]*)?\]/gi, ' ')
    .replace(/!\[([^\]\n]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]\n]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~|`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
