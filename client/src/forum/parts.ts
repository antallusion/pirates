// The forum's pieces (docs/32_FORUM.md): avatars in their brass rings, names, ranks, the captain's line, the paginator of
// coins, the rows of sections and topics, the fresh-topic cards and the post card — HTML strings, every word escaped.

import { REACTION_EMOJI, REACTIONS } from '../../../shared/src/forum/meta.ts';
import { avatarHtml, faceBgStyle } from '../../../shared/src/data/portraitfit.ts';
import { ago, count, esc, noun, fmtNum, fullDate, href, ico, isoDate, K, LANG, state, t, tx } from './core.ts';

export interface UserLite { id: number; name: string; role: string; avatar: string; rank: number; captain: string | null; level: number | null; online: boolean }
export interface Author extends UserLite { posts: number; rep: number; joined: number; ship: string | null; guild: { tag: string; name: string; rank: string } | null; medals: Medal[]; medalsMore: number }
export interface Medal { icon: string; id?: string; en?: string; ru?: string }

/** The colour of a member: her captain's class, or the administration's and the moderators'. */
export function tint(u: { role: string; captain: string | null } | null): string {
  if (!u) return 'var(--muted)';
  if (u.role === 'admin') return 'var(--c-admin)';
  if (u.role === 'moderator') return 'var(--c-mod)';
  return u.captain ? `var(--c-${u.captain})` : 'var(--c-none)';
}

export const userHref = (u: { id: number }): string => href(`u/${u.id}`);

/** A portrait in a bare circle or square (its class sets the size): the face in the middle (shared/src/data/portraitfit.ts;
 *  owner, 2026-10-26: «все лица должны находиться четко во фрейме»), never an <img> cut from its top by cover. */
export const faceSpan = (url: string, cls: string, style = ''): string =>
  `<span class="${cls} f-face" role="img" aria-hidden="true" style="${style}background-image:url('${esc(url)}');${faceBgStyle(url, 1, 0.6)}"></span>`;

/** A member's avatar: the site's brass porthole round her portrait (m, l), a thin ring of her colour (xs, s), or the
 *  author's square frame on a post (l, square) — the round ones the game's avatar (portraitfit.ts avatarHtml: one box,
 *  the ring and the portrait its shares, the face in the hole's middle). */
export function avatar(u: UserLite | null, size: 'xs' | 's' | 'm' | 'l' = 's', ring: 'round' | 'square' = 'round'): string {
  const url = u?.avatar ?? '/assets/portraits/pirate_00.webp';
  const dot = u?.online ? `<i class="f-dot" title="${esc(t('online_now'))}"></i>` : '';
  if (ring === 'square' && u) return `<span class="f-ava f-ava-${size} f-ring-square" style="--tint:${tint(u)}">${faceSpan(url, 'f-sq')}${dot}</span>`;
  const ringed = size === 'm' || size === 'l';
  return avatarHtml({ face: url, url, ring: ringed ? 'site' : null, ringUrl: ringed ? '/site/img/ui/ring_round.webp' : null, stock: 'site', cls: `f-ava f-ava-${size} f-ring-round`, attrs: u ? `style="--tint:${tint(u)}"` : '', inner: dot });
}

export const nick = (u: UserLite | null, cls = ''): string =>
  u ? `<a class="f-nick ${cls}" href="${userHref(u)}">${esc(u.name)}</a>` : '<span class="f-nick">?</span>';

export const rankName = (r: number): string => t(`rank${Math.max(0, Math.min(7, r))}`);
export const rankBadge = (r: number, size = 22): string =>
  `<img class="f-rank-img" src="${K(`rank/r${Math.max(0, Math.min(7, r)) + 1}`)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
export const rankLine = (r: number): string => `<span class="f-rank">${rankBadge(r)}<span class="f-star" aria-hidden="true">★</span>${esc(rankName(r))}</span>`;

export const roleBadge = (role: string): string =>
  role === 'admin' || role === 'moderator' || role === 'banned' ? `<span class="f-role f-role-${role}">${esc(t(`role_${role}`))}</span>` : '';

export const className = (c: string | null): string => (c ? t(`cls_${c}`) : '');
/** A class's mark: its captain's portrait in a ring of its colour. */
export const classIcon = (c: string | null): string =>
  c ? faceSpan(`/assets/portraits/${c}.webp`, 'f-clsico', `--tint:var(--c-${esc(c)});`) : '';

/** The captain of a member: her ship's name in her class colour, level and class. */
export function charLine(a: { captain: string | null; level: number | null; ship?: string | null }): string {
  if (!a.captain) return '';
  return `<span class="f-char" style="--tint:var(--c-${esc(a.captain)})">${classIcon(a.captain)}<span class="f-char-t">${a.ship ? `<b>${esc(a.ship)}</b>` : ''}<span>${a.level ? `${a.level} ${esc(t('p_level'))} · ` : ''}${esc(className(a.captain))}</span></span></span>`;
}

export const medalName = (m: Medal): string => (m.id ? t(`medal_${m.id}`) : (LANG === 'ru' ? m.ru : m.en) ?? '');
export function medals(list: Medal[], more = 0, size = 30): string {
  if (!list.length) return '';
  return `<div class="f-medals">${list.map((m) => `<img src="${K(`medal/${m.icon}`)}" alt="${esc(medalName(m))}" title="${esc(medalName(m))}" width="${size}" height="${size}" loading="lazy" decoding="async">`).join('')}${more ? `<span class="f-more" title="${esc(t('more_medals'))}">+${more}</span>` : ''}</div>`;
}

export const guildTag = (g: { tag: string; name: string } | null): string =>
  g ? `<a class="f-gtag" href="${href(`g/${encodeURIComponent(g.tag)}`)}" title="${esc(g.name)}">[${esc(g.tag)}]</a>` : '';

export const when = (ts: number): string => `<time class="f-when" datetime="${isoDate(ts)}" title="${esc(fullDate(ts))}">${ico('clock', 'f-ico f-ico-s')}${esc(ago(ts))}</time>`;

// ------------------------------------------------------------------------------------------------ the paginator

/** Round coins: arrows, the first, the last and the pages around the current; the current in a gold ring. */
export function pager(page: number, pages: number, link: (p: number) => string, extraCls = ''): string {
  if (pages <= 1) return '';
  const nums = new Set<number>([1, pages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= pages) nums.add(p);
  const list = [...nums].sort((a, b) => a - b);
  let out = '';
  let prev = 0;
  for (const p of list) {
    if (p - prev > 1) out += '<span class="f-pg-gap" aria-hidden="true">…</span>';
    const far = Math.abs(p - page) === 2 && p !== 1 && p !== pages ? ' f-pg-far' : '';
    out += p === page
      ? `<span class="coinbtn f-pg on" aria-current="page">${p}</span>`
      : `<a class="coinbtn f-pg${far}" href="${link(p)}" aria-label="${esc(t('page'))} ${p}">${p}</a>`;
    prev = p;
  }
  const arrow = (to: number, dir: 'prev' | 'next') =>
    to >= 1 && to <= pages
      ? `<a class="coinbtn f-pg f-pg-arr" href="${link(to)}" aria-label="${esc(t(dir))}" rel="${dir}">${dir === 'prev' ? '‹' : '›'}</a>`
      : `<span class="coinbtn f-pg f-pg-arr off" aria-hidden="true">${dir === 'prev' ? '‹' : '›'}</span>`;
  return `<nav class="f-pager ${extraCls}" aria-label="${esc(t('page'))}">${arrow(page - 1, 'prev')}${out}${arrow(page + 1, 'next')}</nav>`;
}

// ------------------------------------------------------------------------------------------------ sections and topics

export function badges(tp: { pinned: boolean; official: boolean; hot: boolean; locked: boolean; hidden: boolean }): string {
  const b: string[] = [];
  if (tp.official) b.push(`<span class="f-badge f-b-official">${ico('official', 'f-ico f-ico-s')}${esc(t('official'))}</span>`);
  if (tp.pinned) b.push(`<span class="f-badge f-b-pinned">${ico('pinned', 'f-ico f-ico-s')}${esc(t('pinned'))}</span>`);
  if (tp.hot) b.push(`<span class="f-badge f-b-hot">${ico('hot', 'f-ico f-ico-s')}${esc(t('hot'))}</span>`);
  if (tp.locked) b.push(`<span class="f-badge f-b-locked">${ico('locked', 'f-ico f-ico-s')}${esc(t('locked'))}</span>`);
  if (tp.hidden) b.push(`<span class="f-badge f-b-hidden">${ico('hide', 'f-ico f-ico-s')}${esc(t('hidden_badge'))}</span>`);
  return b.join('');
}

export const topicHref = (id: number, page = 1, post?: number | null): string => href(`t/${id}${page > 1 ? `?p=${page}` : ''}${post ? `#p${post}` : ''}`);

export function sectionRow(s: any): string {
  const last = s.last;
  return `<article class="f-sec reveal">
<a class="f-sec-ico" href="${href(`s/${s.slug}`)}" tabindex="-1" aria-hidden="true"><img src="${K(`ico/${s.icon}`)}" alt="" width="56" height="56" loading="lazy" decoding="async"></a>
<div class="f-sec-main"><h3><a href="${href(`s/${s.slug}`)}">${esc(s.title)}</a>${s.staffOnly ? `<span class="f-badge f-b-staff">${esc(t('staff_only'))}</span>` : ''}</h3><p>${tx(s.desc)}</p></div>
<div class="f-sec-nums"><span><b>${fmtNum(s.topics)}</b>${esc(noun(s.topics, 'topics'))}</span><span><b>${fmtNum(s.posts)}</b>${esc(noun(s.posts, 'posts'))}</span></div>
<div class="f-sec-last">${last ? `${avatar(last.author, 's')}<div><a class="f-sec-lt" href="${topicHref(last.topicId, 1)}">${esc(last.title)}</a><span class="f-meta">${nick(last.author)} · ${when(last.at)}</span></div>` : `<span class="f-meta">${esc(t('no_topics'))}</span>`}</div>
</article>`;
}

export function topicRow(tp: any, showSection = false): string {
  const lastPage = tp.pages;
  const icon = tp.official ? 'official' : tp.pinned ? 'pinned' : tp.locked ? 'locked' : tp.hot ? 'hot' : 'scroll';
  return `<article class="f-topic reveal${tp.pinned ? ' is-pinned' : ''}${tp.official ? ' is-official' : ''}${tp.hidden ? ' is-hidden' : ''}">
<span class="f-topic-ico"><img src="${K(`ico/${icon}`)}" alt="" width="34" height="34" loading="lazy" decoding="async"></span>
<div class="f-topic-main"><h3><a href="${topicHref(tp.id)}">${esc(tp.title)}</a></h3>
<div class="f-meta">${badges(tp)}${showSection && tp.section ? `<a class="f-chip" href="${href(`s/${tp.section.slug}`)}">${esc(tp.section.title)}</a>` : ''}<span>${esc(t('by'))} ${nick(tp.author)}</span>${when(tp.createdAt)}</div></div>
<div class="f-topic-nums"><span><b>${fmtNum(tp.replies)}</b>${esc(noun(tp.replies, 'replies'))}</span><span><b>${fmtNum(tp.views)}</b>${esc(noun(tp.views, 'views'))}</span></div>
<div class="f-topic-last">${avatar(tp.lastAuthor, 'xs')}<div>${nick(tp.lastAuthor)}<a class="f-when-link" href="${topicHref(tp.id, lastPage, tp.lastPostId)}">${when(tp.lastAt)}</a></div></div>
</article>`;
}

export function freshCard(tp: any): string {
  return `<a class="f-fresh-card" href="${topicHref(tp.id, tp.pages, tp.lastPostId)}" style="--tint:${tint(tp.lastAuthor)}">
<span class="f-fresh-sec">${tp.section ? `<img src="${K(`ico/${tp.section.icon}`)}" alt="" width="18" height="18" loading="lazy" decoding="async">${esc(tp.section.title)}` : ''}</span>
<b class="f-fresh-t">${esc(tp.title)}</b>
<span class="f-fresh-by">${avatar(tp.lastAuthor, 'xs')}<span><span class="f-nick">${esc(tp.lastAuthor?.name ?? '')}</span><span class="f-when">${esc(ago(tp.lastAt))}</span></span><span class="f-fresh-n">${ico('reply', 'f-ico f-ico-s')}${fmtNum(tp.replies)}</span></span>
</a>`;
}

export function freshAside(list: any[]): string {
  if (!list?.length) return '';
  return `<aside class="f-fresh" aria-label="${esc(t('fresh'))}"><div class="f-fresh-head"><p class="kicker">${ico('new', 'f-ico')}${esc(t('fresh'))}</p><a href="${href('l/topics')}">${esc(t('fresh_all'))}</a></div><div class="f-fresh-list">${list.map(freshCard).join('')}</div></aside>`;
}

// ------------------------------------------------------------------------------------------------ the post card

export function authorCol(a: Author | null): string {
  if (!a) return '<aside class="f-author"></aside>';
  const msg = state.me.user && state.me.user.id !== a.id && a.id !== 0 ? `<a class="f-write" href="${href(`m/${a.id}`)}">${ico('messages', 'f-ico f-ico-s')}${esc(t('write'))}</a>` : '';
  return `<aside class="f-author">
<a class="f-author-ava" href="${userHref(a)}" tabindex="-1" aria-hidden="true">${avatar(a, 'l', 'square')}</a>
<div class="f-author-id">${nick(a)}${roleBadge(a.role)}${rankLine(a.rank)}${charLine(a)}</div>
<div class="f-author-more">${a.guild ? `<div class="f-author-g">${guildTag(a.guild)}<span>${esc(a.guild.name)}</span></div>` : ''}
<dl class="f-author-st"><div><dt>${esc(t('p_posts'))}</dt><dd>${fmtNum(a.posts)}</dd></div><div><dt>${esc(t('p_rep'))}</dt><dd>${fmtNum(a.rep)}</dd></div></dl>
${medals(a.medals, a.medalsMore, 28)}${msg}</div>
</aside>`;
}

function reactBar(p: any): string {
  return `<div class="f-reacts" role="group" aria-label="${esc(t('reactions'))}">${REACTIONS.map((r) => {
    const n = p.reactions?.[r] ?? 0;
    const on = p.mine?.includes(r);
    return `<button type="button" class="f-react${on ? ' on' : ''}${n ? '' : ' zero'}" data-act="react" data-id="${p.id}" data-emoji="${r}" aria-pressed="${on ? 'true' : 'false'}"><span class="f-emo">${REACTION_EMOJI[r]}</span><b>${n || ''}</b></button>`;
  }).join('')}</div>`;
}

function act(name: string, icon: string, label: string, id: number, extra = ''): string {
  return `<button type="button" class="f-act" data-act="${name}" data-id="${id}"${extra}>${ico(icon, 'f-ico f-ico-s')}<span>${esc(label)}</span></button>`;
}

export function postCard(p: any, topic: any): string {
  const a: Author | null = p.author;
  const role = p.official ? 'var(--c-official)' : tint(a);
  const me = state.me.user;
  const actions: string[] = [];
  if (me && topic && (!topic.locked || state.staff)) {
    actions.push(act('reply', 'reply', t('reply'), p.id));
    actions.push(act('quote', 'quote', t('quote'), p.id));
  }
  if (p.canEdit) actions.push(act('edit', 'edit', t('edit'), p.id));
  actions.push(act('link', 'link', t('link'), p.id));
  if (me && a && me.id !== a.id) actions.push(act('report', 'report', t('report'), p.id));
  if (p.canMod) actions.push(act('hide', 'hide', p.hidden ? t('unhide') : t('hide'), p.id, ` data-on="${p.hidden ? 1 : 0}"`));
  if (p.canOfficial) actions.push(act('official', 'official', p.official ? t('official_unmark') : t('official_mark'), p.id, ` data-on="${p.official ? 1 : 0}"`));
  const rep = me && a && me.id !== a.id && a.id !== 0
    ? `<span class="f-rep" role="group" aria-label="${esc(t('p_rep'))}"><button type="button" class="f-rep-b${p.myRep > 0 ? ' on' : ''}" data-act="rep" data-id="${p.id}" data-v="${p.myRep > 0 ? 0 : 1}" aria-label="${esc(t('rep_up'))}">▲</button><img src="${K('ico/rep')}" alt="" width="20" height="20" loading="lazy"><button type="button" class="f-rep-b${p.myRep < 0 ? ' on' : ''}" data-act="rep" data-id="${p.id}" data-v="${p.myRep < 0 ? 0 : -1}" aria-label="${esc(t('rep_down'))}">▼</button></span>`
    : '';
  const body = p.hidden && !p.html
    ? `<p class="f-hidden-note">${ico('hide', 'f-ico')}${esc(t('post_hidden'))}</p>`
    : `${p.hidden ? `<p class="f-hidden-note">${ico('hide', 'f-ico')}${esc(t('post_hidden'))}</p>` : ''}<div class="f-md">${p.html}</div>`;
  return `<article class="f-post reveal${p.official ? ' is-official' : ''}${p.hidden ? ' is-hidden' : ''}" id="p${p.id}" style="--role:${role}" data-id="${p.id}" data-name="${esc(a?.name ?? '')}">
${authorCol(a)}
<div class="f-pbody">
<header class="f-phead">${p.official ? `<span class="f-badge f-b-official">${ico('official', 'f-ico f-ico-s')}${esc(t('official_answer'))}</span>` : ''}${when(p.at)}${p.editedAt ? `<span class="f-edited" title="${esc(fullDate(p.editedAt))}">${esc(t('edited'))} ${esc(ago(p.editedAt))}${p.editedBy ? ` ${esc(t('edited_by'))} ${esc(p.editedBy)}` : ''}</span>` : ''}<a class="f-num" href="#p${p.id}" data-act="anchor" data-id="${p.id}">#${p.num}</a></header>
${p.replyTo ? `<div class="f-replyto">${ico('reply', 'f-ico f-ico-s')}${esc(t('reply_to'))} <a href="${href(`p/${p.replyTo.id}`)}">${esc(p.replyTo.name)}</a></div>` : ''}
${body}
<footer class="f-pfoot">${reactBar(p)}<div class="f-actions">${rep}${actions.join('')}</div></footer>
</div></article>`;
}

// ------------------------------------------------------------------------------------------------ small things

export const empty = (text: string, icon = 'spyglass'): string =>
  `<div class="f-empty reveal"><img src="${K(`ico/${icon}`)}" alt="" width="72" height="72" loading="lazy" decoding="async"><p>${tx(text)}</p></div>`;

export function loginCta(): string {
  const back = encodeURIComponent(location.pathname + location.search);
  return `<div class="f-login panel reveal"><img class="f-login-ico" src="${K('ui/seal')}" alt="" width="72" height="78" loading="lazy" decoding="async"><div><h3>${esc(t('login_title'))}</h3><p>${tx(t('login_text'))}</p></div><a class="btn-gold" href="/?forum=${back}" target="_blank" rel="opener">${esc(t('login_btn'))}</a></div>`;
}

export const crumbs = (items: [string, string | null][]): string =>
  `<nav class="f-crumbs" aria-label="breadcrumbs">${items.map(([label, h]) => (h ? `<a href="${h}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join('<i aria-hidden="true">›</i>')}</nav>`;

export const memberCard = (a: Author): string => `<a class="f-member reveal" href="${userHref(a)}" style="--tint:${tint(a)}">${avatar(a, 'm')}<span class="f-member-t"><span class="f-nick">${esc(a.name)}</span>${roleBadge(a.role)}<span class="f-rank">${rankBadge(a.rank, 18)}${esc(rankName(a.rank))}</span>${charLine(a)}</span><span class="f-member-n"><b>${fmtNum(a.posts)}</b>${esc(noun(a.posts, 'posts'))}</span></a>`;
