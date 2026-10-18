// The forum's pages (docs/32_FORUM.md §3): each fetches its JSON, sets the hero and draws into #forum.

import { api, BASE, count, errText, esc, fmtNum, fullDate, href, ico, K, LANG, loadMe, state, t, toast, tx, ago } from './core.ts';
import { mountEditor } from './editor.ts';
import type { Editor } from './editor.ts';
import {
  avatar, badges, charLine, crumbs, empty, freshAside, guildTag, loginCta, medalName, medals, memberCard, nick, pager, postCard,
  rankBadge, rankLine, rankName, roleBadge, sectionRow, tint, topicHref, topicRow, userHref, when,
} from './parts.ts';

export type Go = (path: string, replace?: boolean) => void;
export interface Ctx { root: HTMLElement; path: string; q: URLSearchParams; go: Go }

// ------------------------------------------------------------------------------------------------ the hero

export function hero(o: { kicker: string; kickerIcon?: string; title: string; lead?: string; mini?: boolean; cta?: string; doc?: string }): void {
  const h = document.querySelector('.hero') as HTMLElement | null;
  if (!h) return;
  h.classList.toggle('mini', o.mini !== false);
  h.classList.toggle('f-hero-home', o.mini === false);
  const k = h.querySelector('.kicker') as HTMLElement;
  k.innerHTML = `${o.kickerIcon ? `<img src="${K(`ico/${o.kickerIcon}`)}" alt="" width="18" height="18">` : ''}${esc(o.kicker)}`;
  const h1 = h.querySelector('h1') as HTMLElement;
  h1.textContent = o.title;
  const len = o.title.length;
  h1.classList.toggle('f-h1-m', len > 28 && len <= 56);
  h1.classList.toggle('f-h1-s', len > 56);
  let lead = h.querySelector('.lead') as HTMLElement | null;
  if (!lead) {
    lead = document.createElement('p');
    lead.className = 'lead';
    h1.after(lead);
  }
  lead.hidden = !o.lead;
  lead.innerHTML = o.lead ? tx(o.lead) : '';
  let cta = h.querySelector('.hero-cta') as HTMLElement | null;
  if (!cta) {
    cta = document.createElement('div');
    cta.className = 'hero-cta';
    lead.after(cta);
  }
  cta.hidden = !o.cta;
  cta.innerHTML = o.cta ?? '';
  document.title = `${o.doc ?? o.title} · ${t('forum')} GRAVETIDE`;
}

const layout = (main: string, aside: string) => `<div class="f-layout${aside ? '' : ' solo'}"><div class="f-main">${main}</div>${aside}</div>`;
const newTopicBtn = (slug = '') => (state.me.user && state.me.user.role !== 'banned' ? `<a class="btn-gold sm" href="${href(slug ? `new/${slug}` : 'new')}">${ico('new', 'f-ico')}${esc(t('new_topic'))}</a>` : '');

function searchBar(q = '', where = 'posts'): string {
  return `<form class="f-search search" role="search" action="${href('search')}"><img src="${K('ico/search')}" alt="" width="22" height="22"><input name="q" value="${esc(q)}" placeholder="${esc(t('s_placeholder'))}" aria-label="${esc(t('search'))}" minlength="2" maxlength="200"><input type="hidden" name="in" value="${esc(where)}"><button class="btn-gold sm" type="submit">${esc(t('s_go'))}</button></form>`;
}

// ------------------------------------------------------------------------------------------------ home

export async function home(c: Ctx): Promise<void> {
  const d = await api('home');
  hero({ kicker: t('home_kicker'), kickerIcon: 'forum', title: t('home_title'), lead: t('home_lead'), mini: false, cta: `${newTopicBtn()}${state.me.user ? '' : `<a class="btn-gold" href="/" target="_blank" rel="opener" data-login>${esc(t('login_btn'))}</a>`}`, doc: t('home_title') });
  const s = d.stats;
  const tiles = ([['topics', 'st_topics', 'scroll', s.topics], ['posts', 'st_posts', 'quote', s.posts], ['members', 'st_members', 'captains', s.members], ['today', 'st_today', 'hourglass', s.today], ['online', 'st_online', 'spyglass', s.online]] as const)
    .map(([k, label, icon, n]) => `<a class="f-tile" href="${href(`l/${k}`)}"><img src="${K(`ico/${icon}`)}" alt="" width="40" height="40"><b>${fmtNum(n)}</b><span>${esc(t(label))}</span></a>`).join('');
  const cats = d.categories.map((cat: any) => `<section class="f-cat"><h2 class="f-cat-h reveal"><span>${esc(cat.title)}</span></h2><div class="f-secs">${cat.sections.map(sectionRow).join('')}</div></section>`).join('');
  c.root.innerHTML = `<div class="f-tiles reveal">${tiles}</div>${layout(`${searchBar()}${cats}`, freshAside(d.fresh))}`;
}

// ------------------------------------------------------------------------------------------------ a section

export async function section(c: Ctx, slug: string): Promise<void> {
  const page = Number(c.q.get('p') ?? 1);
  const d = await api(`section/${encodeURIComponent(slug)}?p=${page}`);
  const s = d.section;
  hero({ kicker: t('forum'), kickerIcon: s.icon, title: s.title, lead: s.desc, cta: d.canPost ? newTopicBtn(s.slug) : '' });
  const link = (p: number) => href(`s/${s.slug}${p > 1 ? `?p=${p}` : ''}`);
  const list = d.topics.length ? `<div class="f-topics">${d.topics.map((x: any) => topicRow(x)).join('')}</div>` : empty(t('no_topics'), 'scroll');
  const head = `<div class="f-bar">${crumbs([[t('home'), href()], [s.title, null]])}${pager(d.page, d.pages, link)}</div>`;
  const foot = `<div class="f-bar end">${pager(d.page, d.pages, link)}</div>`;
  c.root.innerHTML = layout(`${head}${list}${foot}${state.me.user ? '' : loginCta()}`, freshAside(d.fresh));
}

// ------------------------------------------------------------------------------------------------ a topic

export async function topic(c: Ctx, id: number): Promise<void> {
  const page = Number(c.q.get('p') ?? 1);
  const d = await api(`topic/${id}?p=${page}`);
  const tp = d.topic;
  hero({ kicker: d.section.title, kickerIcon: d.section.icon, title: tp.title, lead: '', doc: tp.title });
  const link = (p: number) => href(`t/${tp.id}${p > 1 ? `?p=${p}` : ''}`);
  const modBar = d.can.mod
    ? `<div class="f-modbar reveal"><span class="f-modbar-l">${ico('tools', 'f-ico')}${esc(t('mod_tools'))}</span>
<button type="button" class="f-chip" data-tm="pinned" data-v="${tp.pinned ? 0 : 1}">${ico('pinned', 'f-ico f-ico-s')}${esc(tp.pinned ? t('unpin') : t('pin'))}</button>
<button type="button" class="f-chip" data-tm="locked" data-v="${tp.locked ? 0 : 1}">${ico('locked', 'f-ico f-ico-s')}${esc(tp.locked ? t('unlock') : t('lock'))}</button>
<button type="button" class="f-chip" data-tm="hidden" data-v="${tp.hidden ? 0 : 1}">${ico('hide', 'f-ico f-ico-s')}${esc(tp.hidden ? t('unhide_topic') : t('hide_topic'))}</button>
${d.can.admin ? `<button type="button" class="f-chip" data-tm="official" data-v="${tp.official ? 0 : 1}">${ico('official', 'f-ico f-ico-s')}${esc(tp.official ? t('official_unmark') : t('official'))}</button>` : ''}
<button type="button" class="f-chip" data-tm="title">${ico('edit', 'f-ico f-ico-s')}${esc(t('rename'))}</button>
<label class="f-chip f-move">${ico('ships', 'f-ico f-ico-s')}<span>${esc(t('move'))}</span><select data-tm="section" aria-label="${esc(t('move'))}"><option value="">—</option></select></label></div>`
    : '';
  const head = `<div class="f-bar">${crumbs([[t('home'), href()], [d.section.title, href(`s/${d.section.slug}`)], [`#${tp.id}`, null]])}<span class="f-topic-badges">${badges(tp)}</span>${pager(d.page, d.pages, link)}</div>`;
  const foot = `<div class="f-bar end">${pager(d.page, d.pages, link)}</div>`;
  const posts = d.posts.map((p: any) => postCard(p, tp)).join('');
  let after = '';
  if (!state.me.user) after = loginCta();
  else if (state.me.user.role === 'banned') after = `<p class="f-note">${ico('locked', 'f-ico')}${esc(t('banned_text'))}</p>`;
  else if (!d.can.reply) after = `<p class="f-note">${ico('locked', 'f-ico')}${esc(t('locked_text'))}</p>`;
  else after = `<section class="f-reply panel" id="f-reply"><h3>${ico('reply', 'f-ico')}${esc(t('reply'))}</h3><div class="f-reply-ed"></div></section>`;
  c.root.innerHTML = `${head}${modBar}<div class="f-posts">${posts}</div>${foot}${after}`;

  let ed: Editor | null = null;
  const host = c.root.querySelector('.f-reply-ed') as HTMLElement | null;
  if (host) {
    ed = mountEditor(host, {
      draftKey: `t${tp.id}`, compact: true,
      async onSubmit(v) {
        const r = await api('post', { topic: tp.id, body: v.body, replyTo: ed?.replying() ?? null, website: v.website, t: v.t });
        c.go(`t/${tp.id}${r.page > 1 ? `?p=${r.page}` : ''}#p${r.postId}`);
      },
    });
  }
  if (d.can.mod) wireTopicMod(c, tp);
  c.root.addEventListener('click', (ev) => void postAction(ev, c, tp, d, ed));
}

function wireTopicMod(c: Ctx, tp: any): void {
  const bar = c.root.querySelector('.f-modbar') as HTMLElement;
  const sel = bar.querySelector('select') as HTMLSelectElement;
  void api('home').then((h) => {
    sel.innerHTML = `<option value="">—</option>${h.categories.flatMap((cat: any) => cat.sections.map((s: any) => `<option value="${esc(s.slug)}">${esc(cat.title)} · ${esc(s.title)}</option>`)).join('')}`;
  }).catch(() => undefined);
  const send = async (body: Record<string, unknown>) => {
    try {
      await api(`topic/${tp.id}/mod`, body);
      c.go(location.pathname.slice(BASE.length) + location.search, true);
    } catch (e) {
      toast(errText(e), 'err');
    }
  };
  sel.addEventListener('change', () => sel.value && void send({ section: sel.value }));
  bar.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button[data-tm]') as HTMLElement | null;
    if (!b) return;
    const k = b.dataset.tm!;
    if (k === 'title') {
      const v = prompt(t('mod_rename_prompt'), tp.title);
      if (v && v.trim()) void send({ title: v.trim() });
      return;
    }
    void send({ [k]: b.dataset.v === '1' });
  });
}

async function postAction(ev: Event, c: Ctx, tp: any, d: any, ed: Editor | null): Promise<void> {
  const b = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!b) return;
  const id = Number(b.dataset.id);
  const post = d.posts.find((p: any) => p.id === id);
  const card = c.root.querySelector(`#p${id}`) as HTMLElement | null;
  const act = b.dataset.act;
  if (act === 'anchor') {
    ev.preventDefault();
    history.replaceState(null, '', `#p${id}`);
    card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  try {
    switch (act) {
      case 'reply':
        if (!ed) return;
        ed.replyTo(id, card?.dataset.name);
        document.getElementById('f-reply')?.scrollIntoView({ block: 'center' });
        ed.focus();
        return;
      case 'quote': {
        if (!ed) return;
        const sel = getSelection();
        const md = card?.querySelector('.f-md') as HTMLElement | null;
        let text = sel && !sel.isCollapsed && md && md.contains(sel.anchorNode) ? sel.toString() : '';
        if (!text) text = post?.md ?? md?.innerText ?? '';
        ed.quote(card?.dataset.name ?? '', id, text);
        ed.replyTo(id, card?.dataset.name);
        document.getElementById('f-reply')?.scrollIntoView({ block: 'center' });
        return;
      }
      case 'edit':
        c.go(`edit/${id}`);
        return;
      case 'link': {
        const url = `${location.origin}${BASE}p/${id}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          prompt(t('link'), url);
          return;
        }
        toast(t('copied'));
        return;
      }
      case 'report': {
        const r = prompt(t('mod_reason_prompt'));
        if (!r || r.trim().length < 3) return;
        await api(`post/${id}/report`, { reason: r.trim() });
        toast(t('reported'));
        return;
      }
      case 'hide':
        if (b.dataset.on !== '1' && !confirm(t('confirm_hide'))) return;
        await api(`post/${id}/mod`, { hidden: b.dataset.on !== '1' });
        c.go(location.pathname.slice(BASE.length) + location.search + `#p${id}`, true);
        return;
      case 'official':
        await api(`post/${id}/mod`, { official: b.dataset.on !== '1' });
        c.go(location.pathname.slice(BASE.length) + location.search + `#p${id}`, true);
        return;
      case 'react': {
        const r = await api(`post/${id}/react`, { emoji: b.dataset.emoji });
        card?.querySelectorAll('.f-react').forEach((x) => {
          const e = (x as HTMLElement).dataset.emoji!;
          const n = r.reactions[e] ?? 0;
          const on = r.mine.includes(e);
          x.classList.toggle('on', on);
          x.classList.toggle('zero', !n);
          x.setAttribute('aria-pressed', String(on));
          (x.querySelector('b') as HTMLElement).textContent = n ? String(n) : '';
        });
        return;
      }
      case 'rep': {
        const v = Number(b.dataset.v);
        const r = await api(`post/${id}/rep`, { v });
        const btns = card?.querySelectorAll('.f-rep-b') ?? [];
        btns.forEach((x, i) => {
          const up = i === 0;
          const on = up ? r.myRep > 0 : r.myRep < 0;
          x.classList.toggle('on', on);
          (x as HTMLElement).dataset.v = String(on ? 0 : up ? 1 : -1);
        });
        const dd = card?.querySelectorAll('.f-author-st dd')[1];
        if (dd) dd.textContent = fmtNum(r.rep);
        return;
      }
    }
  } catch (e) {
    toast(errText(e), 'err');
  }
}

/** p/<id>: the post's topic page and anchor. */
export async function postWhere(c: Ctx, id: number): Promise<void> {
  const w = await api(`post/${id}/where`);
  c.go(`t/${w.topicId}${w.page > 1 ? `?p=${w.page}` : ''}#p${w.postId}`, true);
}

// ------------------------------------------------------------------------------------------------ writing

export async function newTopic(c: Ctx, slug: string): Promise<void> {
  const h = await api('home');
  const all = h.categories.flatMap((cat: any) => cat.sections.map((s: any) => ({ ...s, cat: cat.title })));
  const s = all.find((x: any) => x.slug === slug);
  hero({ kicker: s ? t('ed_new_topic_in') : t('forum'), kickerIcon: s?.icon ?? 'new', title: s ? s.title : t('new_topic'), doc: t('new_topic') });
  if (!state.me.user) {
    c.root.innerHTML = loginCta();
    return;
  }
  const choices = all.filter((x: any) => !x.staffOnly || state.staff);
  c.root.innerHTML = `${crumbs([[t('home'), href()], ...(s ? [[s.title, href(`s/${s.slug}`)] as [string, string]] : []), [t('new_topic'), null]])}
<section class="panel f-compose reveal"><label class="f-ed-title f-ed-sec"><span>${esc(t('ed_section'))}</span><select name="section">${choices.map((x: any) => `<option value="${esc(x.slug)}"${x.slug === slug ? ' selected' : ''}>${esc(x.cat)} · ${esc(x.title)}</option>`).join('')}</select></label><div class="f-compose-ed"></div></section>`;
  const sel = c.root.querySelector('select[name=section]') as HTMLSelectElement;
  mountEditor(c.root.querySelector('.f-compose-ed') as HTMLElement, {
    draftKey: 'new', title: null, sendLabel: t('new_topic'),
    onCancel: () => history.back(),
    async onSubmit(v) {
      const r = await api('topic', { section: sel.value, title: v.title, body: v.body, website: v.website, t: v.t });
      c.go(`t/${r.topicId}`);
    },
  });
}

export async function editPost(c: Ctx, id: number): Promise<void> {
  const w = await api(`post/${id}/where`);
  const d = await api(`topic/${w.topicId}?p=${w.page}`);
  const p = d.posts.find((x: any) => x.id === id);
  hero({ kicker: t('ed_edit_post'), kickerIcon: 'edit', title: d.topic.title, doc: t('ed_edit_post') });
  if (!p?.canEdit) {
    c.root.innerHTML = empty(t('err_forbidden'), 'locked');
    return;
  }
  const first = p.num === 1;
  c.root.innerHTML = `${crumbs([[t('home'), href()], [d.section.title, href(`s/${d.section.slug}`)], [d.topic.title, topicHref(d.topic.id, w.page, id)], [t('edit'), null]])}<section class="panel f-compose reveal"><div class="f-compose-ed"></div></section>`;
  mountEditor(c.root.querySelector('.f-compose-ed') as HTMLElement, {
    draftKey: `e${id}`, initial: p.md, title: first ? d.topic.title : undefined, sendLabel: t('ed_save'),
    onCancel: () => history.back(),
    async onSubmit(v) {
      const r = await api(`post/${id}/edit`, { body: v.body, title: first ? v.title : undefined, website: v.website, t: v.t });
      c.go(`t/${r.topicId}${r.page > 1 ? `?p=${r.page}` : ''}#p${id}`);
    },
  });
}

// ------------------------------------------------------------------------------------------------ people

export async function profile(c: Ctx, ref: string): Promise<void> {
  const d = await api(`user/${encodeURIComponent(ref)}`);
  const u = d.user;
  hero({ kicker: t('profile'), kickerIcon: 'captains', title: u.name, doc: u.name });
  const mine = state.me.user?.id === u.id;
  const stats = [[t('p_posts'), u.posts], [t('p_rep'), u.rep], [t('p_topics'), d.topics], [t('p_official'), d.official]] as const;
  const recent = d.recent.length
    ? d.recent.map((r: any) => `<a class="f-recent reveal" href="${href(`p/${r.id}`)}"><b>${esc(r.topic?.title ?? '')}</b><span>${tx(r.excerpt)}</span>${when(r.at)}</a>`).join('')
    : empty(t('p_none'), 'quote');
  const allMedals = u.medals as any[];
  const card = `<section class="f-prof panel reveal" style="--tint:${tint(u)}">
<div class="f-prof-ava">${avatar(u, 'l', 'round')}</div>
<div class="f-prof-id"><h2 class="f-nick">${esc(u.name)}</h2>${roleBadge(u.role)}${rankLine(u.rank)}
<div class="f-prof-char">${u.captain ? charLine(u) : `<span class="muted">${esc(t('p_no_char'))}</span>`}</div>
${u.guild ? `<div class="f-prof-g">${ico('anchor', 'f-ico')}<span>${esc(t('p_guild'))}:</span> ${guildTag(u.guild)} <span>${esc(u.guild.name)} · ${esc(t(`g_${u.guild.rank}`))}</span></div>` : ''}
<div class="f-prof-dates"><span>${esc(t('p_joined'))} ${esc(fullDate(u.joined))}</span>${d.lastSeen ? `<span>${esc(t('p_seen'))} ${esc(ago(d.lastSeen))}</span>` : ''}</div></div>
<div class="f-prof-cta">${d.canMessage ? `<a class="btn-gold" href="${href(`m/${u.id}`)}">${ico('messages', 'f-ico')}${esc(t('write'))}</a>` : ''}${mine ? `<a class="btn-oak sm" href="${href('me')}">${esc(t('p_settings'))}</a>` : ''}</div>
</section>`;
  const statRow = `<div class="f-prof-stats reveal">${stats.map(([k, v]) => `<div><b>${fmtNum(v)}</b><span>${esc(k)}</span></div>`).join('')}<div><span class="f-prof-rankbig">${rankBadge(u.rank, 44)}</span><span>${esc(rankName(u.rank))}</span></div></div>`;
  const ach = allMedals.length
    ? `<section class="f-block reveal"><h3>${ico('achievements', 'f-ico')}${esc(t('p_achievements'))}</h3><div class="f-ach">${allMedals.map((m) => `<div class="f-ach-i"><img src="${K(`medal/${m.icon}`)}" alt="" width="64" height="64" loading="lazy"><span>${esc(medalName(m))}</span></div>`).join('')}</div></section>`
    : '';
  const role = d.canRole
    ? `<section class="f-block reveal"><h3>${ico('tools', 'f-ico')}${esc(t('p_set_role'))}</h3><div class="f-roles">${['user', 'moderator', 'admin', 'banned'].map((r) => `<button type="button" class="f-chip${u.role === r ? ' on' : ''}" data-role="${r}">${esc(t(`role_${r}`))}</button>`).join('')}</div></section>`
    : '';
  c.root.innerHTML = `${card}${statRow}${ach}<section class="f-block reveal"><h3>${ico('quote', 'f-ico')}${esc(t('p_recent'))}</h3><div class="f-recents">${recent}</div></section>${role}`;
  c.root.querySelector('.f-roles')?.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-role]') as HTMLElement | null;
    if (!b) return;
    try {
      await api('role', { user: u.id, role: b.dataset.role });
      toast(t('saved'));
      c.go(location.pathname.slice(BASE.length), true);
    } catch (e) {
      toast(errText(e), 'err');
    }
  });
}

export async function settings(c: Ctx): Promise<void> {
  hero({ kicker: t('profile'), kickerIcon: 'edit', title: t('p_settings') });
  const me = await loadMe();
  if (!me.user) {
    c.root.innerHTML = loginCta();
    return;
  }
  const cur = me.user.avatar as string;
  c.root.innerHTML = `<section class="panel f-settings reveal"><h3>${esc(t('p_main_char'))}</h3>
<div class="f-chars">${(me.chars ?? []).length ? me.chars!.map((ch) => `<label class="f-charpick"><input type="radio" name="main" value="${esc(ch.id)}" checked>${charLine(ch)}</label>`).join('') : `<span class="muted">${esc(t('p_no_char'))}</span>`}</div>
<h3>${esc(t('p_avatar'))}</h3><div class="f-avatars" role="radiogroup" aria-label="${esc(t('p_avatar'))}">${(me.avatars ?? []).map((a) => `<button type="button" class="f-avpick${cur.endsWith(`/${a}.webp`) ? ' on' : ''}" data-av="${esc(a)}" role="radio" aria-checked="${cur.endsWith(`/${a}.webp`)}"><img src="/assets/portraits/${esc(a)}.webp" alt="" width="64" height="64" loading="lazy" decoding="async"></button>`).join('')}</div>
<div class="f-ed-foot"><a class="btn-oak sm" href="${userHref(me.user)}">${esc(t('back'))}</a><button type="button" class="btn-gold sm f-save">${esc(t('p_save'))}</button></div></section>`;
  let pick: string | null = null;
  c.root.querySelector('.f-avatars')!.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-av]') as HTMLElement | null;
    if (!b) return;
    pick = b.dataset.av!;
    c.root.querySelectorAll('.f-avpick').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
  });
  c.root.querySelector('.f-save')!.addEventListener('click', async () => {
    try {
      const main = (c.root.querySelector('input[name=main]:checked') as HTMLInputElement | null)?.value ?? null;
      await api('me', { avatar: pick ?? undefined, mainChar: main });
      toast(t('p_saved'));
      await loadMe();
      c.go(`u/${state.me.user.id}`);
    } catch (e) {
      toast(errText(e), 'err');
    }
  });
}

export async function guild(c: Ctx, tag: string): Promise<void> {
  const d = await api(`guild/${encodeURIComponent(tag)}`);
  hero({ kicker: t('g_title'), kickerIcon: 'anchor', title: `[${d.guild.tag}] ${d.guild.name}`, doc: d.guild.name });
  const order = ['admiral', 'vice', 'commodore', 'captain', 'bosun', 'sailor', 'cabin_boy'];
  const ms = [...d.members].sort((a: any, b: any) => order.indexOf(a.rank) - order.indexOf(b.rank) || (b.level ?? 0) - (a.level ?? 0));
  c.root.innerHTML = `<section class="f-block reveal"><h3>${ico('captains', 'f-ico')}${esc(t('g_members'))} · ${esc(count(ms.length, 'captains'))}</h3><div class="f-gm">${ms.map((m: any) => {
    const inner = `<span class="f-ava f-ava-m f-ring-round" style="--tint:${m.captain ? `var(--c-${m.captain})` : 'var(--c-none)'}"><img src="${esc(m.avatar)}" alt="" width="56" height="56" loading="lazy">${m.online ? '<i class="f-dot"></i>' : ''}</span>
<span class="f-gm-t"><span class="f-nick">${esc(m.name)}</span><span class="f-gm-rank">${esc(t(`g_${m.rank}`))}</span>${charLine({ captain: m.captain, level: m.level })}${medals(m.medals, 0, 24)}</span>`;
    return m.forum ? `<a class="f-gm-i reveal" href="${href(`u/${m.account}`)}">${inner}</a>` : `<div class="f-gm-i reveal">${inner}</div>`;
  }).join('')}</div></section>`;
}

// ------------------------------------------------------------------------------------------------ lists and search

const LISTS: Record<string, [string, string]> = { topics: ['l_topics', 'scroll'], posts: ['l_posts', 'quote'], members: ['l_members', 'captains'], today: ['l_today', 'hourglass'], online: ['l_online', 'spyglass'] };

export async function list(c: Ctx, kind: string): Promise<void> {
  const page = Number(c.q.get('p') ?? 1);
  const d = await api(`list/${kind}?p=${page}`);
  const [label, icon] = LISTS[kind] ?? ['l_topics', 'scroll'];
  hero({ kicker: t('l_kicker'), kickerIcon: icon, title: t(label), lead: kind === 'online' ? `${fmtNum(d.total)} ${t('online_now')} · ${fmtNum(d.inGame ?? 0)} ${t('l_ingame')}` : '' });
  const link = (p: number) => href(`l/${kind}${p > 1 ? `?p=${p}` : ''}`);
  const tabs = `<nav class="f-tabs" aria-label="${esc(t('l_kicker'))}">${Object.entries(LISTS).map(([k, [l, ic]]) => `<a href="${href(`l/${k}`)}"${k === kind ? ' class="on" aria-current="page"' : ''}>${ico(ic, 'f-ico f-ico-s')}${esc(t(l))}</a>`).join('')}</nav>`;
  let body = '';
  if (d.topics) body = d.topics.length ? `<div class="f-topics">${d.topics.map((x: any) => topicRow(x, true)).join('')}</div>` : empty(t('no_topics'), 'scroll');
  else if (d.posts) body = d.posts.length ? `<div class="f-recents">${d.posts.map(postBrief).join('')}</div>` : empty(t('no_posts'), 'quote');
  else body = d.members.length ? `<div class="f-members">${d.members.map(memberCard).join('')}</div>` : empty(t('n_empty'), 'spyglass');
  c.root.innerHTML = `${tabs}<div class="f-bar">${crumbs([[t('home'), href()], [t(label), null]])}${pager(d.page, d.pages, link)}</div>${body}<div class="f-bar end">${pager(d.page, d.pages, link)}</div>`;
}

const postBrief = (r: any) =>
  `<a class="f-recent reveal" href="${href(`p/${r.id}`)}">${avatar(r.author, 'xs')}<span class="f-recent-t"><b>${esc(r.topic?.title ?? '')}</b><span>${r.snippet !== undefined ? snippet(r.snippet) : tx(r.excerpt)}</span><span class="f-meta">${esc(r.author?.name ?? '')} · ${esc(ago(r.at))}</span></span></a>`;
/** A search snippet: escaped, the hits between \u0001 and \u0002 marked. */
const snippet = (s: string) => esc(s).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');

export async function search(c: Ctx): Promise<void> {
  const q = c.q.get('q') ?? '';
  const where = c.q.get('in') === 'topics' ? 'topics' : 'posts';
  const page = Number(c.q.get('p') ?? 1);
  hero({ kicker: t('forum'), kickerIcon: 'search', title: q ? `«${q}»` : t('s_title'), doc: t('s_title') });
  const tabs = `<nav class="f-tabs">${(['posts', 'topics'] as const).map((w) => `<a href="${href(`search?q=${encodeURIComponent(q)}&in=${w}`)}"${w === where ? ' class="on" aria-current="page"' : ''}>${esc(t(w === 'posts' ? 's_in_posts' : 's_in_topics'))}</a>`).join('')}</nav>`;
  if (q.trim().length < 2) {
    c.root.innerHTML = `${searchBar(q, where)}${empty(t('s_hint'), 'spyglass')}`;
    return;
  }
  const d = await api(`search?q=${encodeURIComponent(q)}&in=${where}&p=${page}`);
  const rows = where === 'topics' ? d.topics ?? [] : d.posts ?? [];
  const body = rows.length ? (where === 'topics' ? `<div class="f-topics">${rows.map((x: any) => topicRow(x, true)).join('')}</div>` : `<div class="f-recents">${rows.map(postBrief).join('')}</div>`) : empty(t('s_empty'), 'spyglass');
  const more = d.more ? `<div class="f-bar end"><a class="btn-oak sm" href="${href(`search?q=${encodeURIComponent(q)}&in=${where}&p=${d.page + 1}`)}">${esc(t('s_more'))}</a></div>` : '';
  c.root.innerHTML = `${searchBar(q, where)}${tabs}${body}${more}`;
}

// ------------------------------------------------------------------------------------------------ messages and notifications

export async function dialogs(c: Ctx): Promise<void> {
  hero({ kicker: t('forum'), kickerIcon: 'messages', title: t('m_title') });
  if (!state.me.user) {
    c.root.innerHTML = loginCta();
    return;
  }
  const d = await api('dialogs');
  c.root.innerHTML = d.dialogs.length
    ? `<div class="f-dialogs">${d.dialogs.map((x: any) => `<a class="f-dlg reveal${x.unread ? ' unread' : ''}" href="${href(`m/${x.with?.id}`)}">${avatar(x.with, 'm')}<span class="f-dlg-t"><span class="f-nick">${esc(x.with?.name ?? '')}</span><span class="f-dlg-last">${x.last.mine ? `<b>${esc(t('m_you'))}:</b> ` : ''}${esc(x.last.text)}</span></span><span class="f-dlg-r">${esc(ago(x.last.at))}${x.unread ? `<i class="f-count">${x.unread}</i>` : ''}</span></a>`).join('')}</div>`
    : empty(t('m_empty'), 'messages');
}

export async function dialog(c: Ctx, other: number): Promise<void> {
  if (!state.me.user) {
    hero({ kicker: t('forum'), kickerIcon: 'messages', title: t('m_title') });
    c.root.innerHTML = loginCta();
    return;
  }
  const d = await api(`dialog/${other}`);
  hero({ kicker: t('m_with'), kickerIcon: 'messages', title: d.with.name });
  const msgs = d.messages.length
    ? d.messages.map((m: any) => `<div class="f-msg${m.mine ? ' mine' : ''}"><div class="f-msg-b f-md">${m.html}</div><span class="f-msg-at">${esc(ago(m.at))}</span></div>`).join('')
    : empty(t('m_none'), 'messages');
  c.root.innerHTML = `${crumbs([[t('m_title'), href('m')], [d.with.name, null]])}<section class="f-chat panel"><header class="f-chat-h">${avatar(d.with, 'm')}<div>${nick(d.with)}${charLine(d.with)}</div></header><div class="f-msgs">${msgs}</div>${d.canWrite ? '<div class="f-chat-ed"></div>' : ''}</section>`;
  const box = c.root.querySelector('.f-msgs') as HTMLElement;
  box.scrollTop = box.scrollHeight;
  const host = c.root.querySelector('.f-chat-ed') as HTMLElement | null;
  if (host) {
    mountEditor(host, {
      draftKey: `m${other}`, compact: true, sendLabel: t('m_send'),
      async onSubmit(v) {
        await api(`dialog/${other}`, { body: v.body, website: v.website, t: v.t });
        c.go(`m/${other}`, true);
      },
    });
  }
}

export async function notifications(c: Ctx): Promise<void> {
  hero({ kicker: t('forum'), kickerIcon: 'bell', title: t('n_title') });
  if (!state.me.user) {
    c.root.innerHTML = loginCta();
    return;
  }
  const d = await api('notifications');
  const items = d.items.map((n: any) => {
    const icon = { reply: 'reply', quote: 'quote', mention: 'mention', reaction: 'star', rep: 'rep' }[n.kind as string] ?? 'bell';
    const emo = n.kind === 'reaction' && n.extra ? ` <span class="f-emo">${esc(({ like: '👍', heart: '❤️', laugh: '😂', fire: '🔥', think: '🤔', dislike: '👎' } as Record<string, string>)[n.extra] ?? '')}</span>` : '';
    return `<a class="f-notif reveal${n.read ? '' : ' unread'}" href="${n.postId ? href(`p/${n.postId}`) : href()}"><img src="${K(`ico/${icon}`)}" alt="" width="32" height="32" loading="lazy">${avatar(n.actor, 's')}<span class="f-notif-t"><span>${n.actor ? `<b class="f-nick">${esc(n.actor.name)}</b> ` : ''}${esc(t(`n_${n.kind}`))} <b>${esc(n.topic?.title ?? '')}</b>${emo}</span><span class="f-meta">${esc(ago(n.at))}</span></span></a>`;
  }).join('');
  c.root.innerHTML = d.items.length ? `<div class="f-bar end"><button type="button" class="btn-oak sm f-readall">${esc(t('n_read_all'))}</button></div><div class="f-notifs">${items}</div>` : empty(t('n_empty'), 'bell');
  if (d.items.some((n: any) => !n.read)) {
    await api('notifications/read', { upTo: d.items[0].id }).catch(() => undefined);
    void loadMe().then(() => document.dispatchEvent(new Event('forum:me')));
  }
  c.root.querySelector('.f-readall')?.addEventListener('click', () => c.root.querySelectorAll('.f-notif').forEach((x) => x.classList.remove('unread')));
}

export async function reports(c: Ctx): Promise<void> {
  hero({ kicker: t('mod_tools'), kickerIcon: 'report', title: t('mod_title') });
  const d = await api('reports');
  c.root.innerHTML = d.reports.length
    ? `<div class="f-reports">${d.reports.map((r: any) => `<article class="f-report panel reveal"><header>${ico('report', 'f-ico')}<b>${esc(r.reason)}</b><span class="f-meta">${esc(t('mod_by'))} ${nick(r.by)} · ${esc(ago(r.at))}</span></header>
<a class="f-recent" href="${href(`p/${r.postId}`)}">${avatar(r.author, 'xs')}<span class="f-recent-t"><b>${esc(r.topic?.title ?? '')}</b><span>${tx(r.excerpt)}</span></span></a>
<div class="f-ed-foot"><button type="button" class="btn-oak sm" data-hide="${r.postId}" data-on="${r.hidden ? 1 : 0}">${esc(r.hidden ? t('unhide') : t('hide'))}</button><button type="button" class="btn-gold sm" data-resolve="${r.id}">${esc(t('mod_resolve'))}</button></div></article>`).join('')}</div>`
    : empty(t('mod_empty'), 'report');
  c.root.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-resolve],[data-hide]') as HTMLElement | null;
    if (!b) return;
    try {
      if (b.dataset.resolve) await api(`report/${b.dataset.resolve}/resolve`, {});
      else await api(`post/${b.dataset.hide}/mod`, { hidden: b.dataset.on !== '1' });
      c.go('mod', true);
    } catch (e) {
      toast(errText(e), 'err');
    }
  });
}

export function notFound(c: Ctx, msg = t('err_not_found')): void {
  hero({ kicker: t('forum'), kickerIcon: 'spyglass', title: '404' });
  c.root.innerHTML = `${empty(msg, 'spyglass')}<div class="f-bar end center"><a class="btn-gold" href="${href()}">${esc(t('home'))}</a></div>`;
}

export { LANG };
