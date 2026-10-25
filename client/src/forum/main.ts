// The forum page (docs/32_FORUM.md): routes under /site/forum/ (and /site/en/forum/) without reloading, the member's
// button in the site's header (the avatar, its menu: notifications, messages, reports, profile, sign-out), the reveal on scroll, YouTube on a click.

import '../compat.ts'; // first of all: the calls Safari 15 lacks (iOS 15 is the floor)
import { BASE, errText, esc, href, ico, K, loadMe, state, t, toast, token } from './core.ts';
import * as P from './pages.ts';
import type { Ctx } from './pages.ts';

const mount = document.getElementById('forum') as HTMLElement;
let seq = 0;

/** The member's corner in the site's header (owner, 2026-10-25: «надо фиксить залогиненного юзера»): one avatar
 *  button with the unread count, its menu holding search, notifications, messages, reports (staff), the profile and
 *  signing out — the row's links keep their room. Signed out: the search alone. */
let cornerOff: AbortController | null = null;
function userCorner(): void {
  const end = document.querySelector('.hdr-end');
  if (!end) return;
  const wasOpen = !!end.querySelector('.f-me.open');
  end.querySelector('.f-me')?.remove();
  cornerOff?.abort();
  cornerOff = new AbortController();
  const signal = cornerOff.signal;
  const box = document.createElement('div');
  box.className = 'f-me';
  const u = state.me.user;
  const n = state.me.unread ?? { notifications: 0, messages: 0, reports: 0 };
  const badge = (x: number) => (x ? `<i class="f-count">${x > 99 ? '99+' : x}</i>` : '');
  const item = (to: string, icon: string, label: string, count = 0) =>
    `<a role="menuitem" href="${href(to)}"><img src="${K(`ico/${icon}`)}" alt="" width="22" height="22">${esc(label)}${badge(count)}</a>`;
  if (!u) {
    box.innerHTML = `<a class="f-hico" href="${href('search')}" aria-label="${esc(t('search'))}" title="${esc(t('search'))}"><img src="${K('ico/search')}" alt="" width="22" height="22"></a>`;
  } else {
    const total = n.notifications + n.messages + (state.staff ? n.reports : 0);
    box.innerHTML = `<button type="button" class="f-hme" aria-haspopup="menu" aria-expanded="false" aria-controls="f-um" aria-label="${esc(`${t('me_menu')}: ${u.name}`)}" title="${esc(u.name)}"><img src="${esc(u.avatar)}" alt="" width="40" height="40">${badge(total)}</button>
<div class="f-um" id="f-um" role="menu" hidden><div class="f-um-who"><img src="${esc(u.avatar)}" alt="" width="40" height="40"><b>${esc(u.name)}</b></div>
${item(`u/${u.id}`, 'captains', t('profile'))}${item('n', 'bell', t('notifications'), n.notifications)}${item('m', 'messages', t('messages'), n.messages)}${state.staff ? item('mod', 'report', t('moderation'), n.reports) : ''}${item('search', 'search', t('search'))}
<button type="button" role="menuitem" class="f-um-out"><img src="${K('ico/anchor')}" alt="" width="22" height="22">${esc(t('sign_out'))}</button></div>`;
    const btn = box.querySelector('.f-hme') as HTMLButtonElement;
    const menu = box.querySelector('.f-um') as HTMLElement;
    const setOpen = (open: boolean) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      box.classList.toggle('open', open);
      if (open) document.dispatchEvent(new CustomEvent('hdr:close'));
    };
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setOpen(menu.hidden);
      if (!menu.hidden) (menu.querySelector('[role=menuitem]') as HTMLElement | null)?.focus();
    });
    menu.addEventListener('click', () => setOpen(false));
    document.addEventListener('click', (ev) => { if (!menu.hidden && !box.contains(ev.target as Node)) setOpen(false); }, { signal });
    document.addEventListener('hdr:open', () => setOpen(false), { signal });
    if (wasOpen) setOpen(true);
    box.addEventListener('keydown', (ev) => {
      if (menu.hidden) return;
      const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (ev.key === 'Escape') { setOpen(false); btn.focus(); }
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        items[(i + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    });
    box.querySelector('.f-um-out')!.addEventListener('click', () => {
      try { localStorage.removeItem('gravetide.token'); } catch { /* no storage */ }
      lastToken = token();
      toast(t('signed_out'));
      void loadMe().then(() => { userCorner(); void route(); });
    });
  }
  end.insertBefore(box, end.firstChild);
}

/** Blocks rise into view as they are scrolled to (still under reduced motion: the stylesheet). */
let io: IntersectionObserver | null = null;
function reveal(root: HTMLElement): void {
  const items = root.querySelectorAll('.reveal:not(.in)');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  io ??= new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      e.target.classList.add('in');
      io!.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
  items.forEach((el) => io!.observe(el));
}

async function route(): Promise<void> {
  const my = ++seq;
  const rel = location.pathname.startsWith(BASE) ? decodeURIComponent(location.pathname.slice(BASE.length)) : '';
  const parts = rel.split('/').filter(Boolean);
  const root = document.createElement('div');
  root.className = 'f-page';
  root.innerHTML = `<div class="f-loading" aria-busy="true">${ico('compass', 'f-ico f-spin')}${esc(t('loading'))}</div>`;
  const old = mount.firstElementChild;
  if (old) old.replaceWith(root);
  else mount.appendChild(root);
  const c: Ctx = { root, path: rel, q: new URLSearchParams(location.search), go };
  try {
    const [a, b] = parts;
    if (!a) await P.home(c);
    else if (a === 's' && b) await P.section(c, b);
    else if (a === 't' && /^\d+$/.test(b ?? '')) await P.topic(c, Number(b));
    else if (a === 'p' && /^\d+$/.test(b ?? '')) await P.postWhere(c, Number(b));
    else if (a === 'new') await P.newTopic(c, b ?? '');
    else if (a === 'edit' && /^\d+$/.test(b ?? '')) await P.editPost(c, Number(b));
    else if (a === 'u' && b) await P.profile(c, b);
    else if (a === 'g' && b) await P.guild(c, b);
    else if (a === 'm' && !b) await P.dialogs(c);
    else if (a === 'm' && /^\d+$/.test(b ?? '')) await P.dialog(c, Number(b));
    else if (a === 'n') await P.notifications(c);
    else if (a === 'l' && b) await P.list(c, b);
    else if (a === 'search') await P.search(c);
    else if (a === 'mod') await P.reports(c);
    else if (a === 'me') await P.settings(c);
    else P.notFound(c);
  } catch (e) {
    if (my !== seq) return;
    P.notFound(c, errText(e));
  }
  if (my !== seq) return;
  reveal(root);
  // an anchored post is brought into view under the header
  const id = location.hash.slice(1);
  const target = id ? document.getElementById(id) : null;
  if (target) {
    target.scrollIntoView({ block: 'start' });
    target.classList.add('f-flash');
  }
}

function go(path: string, replace = false): void {
  const url = path.startsWith('/') ? path : `${BASE}${path}`;
  const same = url.split('#')[0] === location.pathname + location.search;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  if (!url.includes('#') && !same) scrollTo({ top: 0, behavior: 'auto' });
  void route();
}

// links inside the forum stay in the page; YouTube and spoilers on a click
document.addEventListener('click', (ev) => {
  const el = ev.target as HTMLElement;
  const yt = el.closest('.md-yt') as HTMLElement | null;
  if (yt && !yt.querySelector('iframe')) {
    const id = yt.dataset.yt ?? '';
    if (/^[\w-]{11}$/.test(id)) {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.title = 'YouTube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      yt.replaceChildren(f);
      yt.classList.add('on');
    }
    return;
  }
  const sp = el.closest('.md-sp') as HTMLElement | null;
  if (sp) {
    sp.classList.toggle('open');
    return;
  }
  const a = el.closest('a') as HTMLAnchorElement | null;
  if (!a || a.target || a.hasAttribute('download') || ev.defaultPrevented) return;
  const me = ev as MouseEvent;
  if (me.button !== 0 || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;
  ev.preventDefault();
  if (u.pathname === location.pathname && u.search === location.search && u.hash) {
    history.replaceState(null, '', u.hash);
    document.getElementById(u.hash.slice(1))?.scrollIntoView({ block: 'start' });
    return;
  }
  document.querySelector('.hdr')?.classList.remove('open');
  go(u.pathname + u.search + u.hash);
});
document.addEventListener('keydown', (ev) => {
  const sp = (ev.target as HTMLElement).closest?.('.md-sp');
  if (sp && (ev.key === 'Enter' || ev.key === ' ')) {
    ev.preventDefault();
    sp.classList.toggle('open');
  }
});
// the search form stays in the page
document.addEventListener('submit', (ev) => {
  const f = ev.target as HTMLFormElement;
  if (!f.classList.contains('f-search')) return;
  ev.preventDefault();
  const q = (f.elements.namedItem('q') as HTMLInputElement).value.trim();
  const w = (f.elements.namedItem('in') as HTMLInputElement).value;
  go(`search?q=${encodeURIComponent(q)}&in=${w}`);
});
addEventListener('popstate', () => void route());
// signed in in the game's tab: the forum knows it at once
let lastToken = token();
addEventListener('storage', (ev) => {
  if (ev.key !== 'gravetide.token' || token() === lastToken) return;
  lastToken = token();
  void loadMe().then(() => {
    userCorner();
    void route();
  });
});
document.addEventListener('forum:me', userCorner);
// the unread counts every minute while the page is open
setInterval(() => {
  if (document.visibilityState === 'visible' && state.me.user) void loadMe().then(userCorner);
}, 60_000);

void loadMe().then(() => {
  userCorner();
  void route();
});
