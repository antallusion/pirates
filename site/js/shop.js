// GRAVETIDE website: the shop (/site/shop/) — a store page of everything the game's premium shop sells (owner,
// 2026-10-20: «в магазин на сайте не все товары выложил, нужно все выкладывать» and «магазин сделай с фильтрами слева,
// как полноценная такая страница магазина … на мобилке … справа язычок … который бы фильтр открывал сайдбаром»).
//   1. GET  /api/site/shop            the whole catalogue now (prices are the server's) and the shop's mode;
//   2. GET  /api/site/captain?name=…  her captain, level and what she cannot buy now, and why;
//   3. POST /api/site/order           an order → the payment page (YooKassa, or the test mode's own page).
//   4. GET  /api/site/shop/item?id=…  a thing's whole card for its window (a tap on a card; ?item=… opens it, Back shuts it).
// The filters (a category, a price range, «available to me», the sort) live in the address (?cat=ship&sort=cheap), so a
// link is shareable and Back works. Back from paying, ?order=… is polled until the payment is through. No libraries.
(() => {
  const d = document;
  const root = d.getElementById('shop');
  const data = JSON.parse(d.getElementById('shop-data')?.textContent || 'null');
  if (!root || !data) return;
  const t = data.t;
  const NICK = 'gravetide.shop.nick', MAIL = 'gravetide.shop.mail';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nf = new Intl.NumberFormat('ru-RU');
  const rub = (n) => `${nf.format(n)} ${t.rub}`;
  const L = (tr) => (tr ? (data.lang === 'ru' ? tr[1] : tr[0]) : '');
  const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (s) => root.querySelector(s);
  const form = $('.shop-find');
  const input = form.querySelector('input');
  const findBtn = form.querySelector('button');
  const who = $('.shop-who');
  const mail = $('.shop-mail');
  const mailIn = mail.querySelector('input');
  const err = $('.shop-err');
  const grid = $('.st-grid');
  const empty = $('.st-empty');
  const modeEl = $('.shop-mode');
  const orderEl = $('.shop-order');
  const side = $('.st-side');
  const tab = $('.st-tab');
  const badge = tab.querySelector('.st-badge');
  const backdrop = $('.st-backdrop');
  const title = $('.st-title');
  const sortSel = $('.st-sort select');
  const minIn = side.querySelector('input[name=min]');
  const maxIn = side.querySelector('input[name=max]');
  const mineIn = side.querySelector('input[name=mine]');
  const showBtn = side.querySelector('[data-show]');
  const confirmEl = $('.st-confirm');

  let shop = null; // { mode, email, testOpen, items }
  let captain = null; // { name, captain, level, online, port, unavailable }
  let busy = null;
  /** The cards as they stand on the page now, in order (the window's ‹ › walk them). */
  let shown = [];
  const TABS = data.tabs.map((x) => x.id);
  const SUBS = Object.keys(data.subs);
  const tabName = Object.fromEntries(data.tabs.map((x) => [x.id, x.name]));

  const say = (msg) => {
    err.textContent = msg || '';
    err.hidden = !msg;
    if (pdOn()) { pdErr.textContent = msg || ''; pdErr.hidden = !msg; }
  };
  const api = async (path, init) => {
    const r = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init && init.body ? { 'Content-Type': 'application/json' } : {}) } });
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, ok: r.ok, body: body || {} };
  };

  // ---- the filters, kept in the address
  const F = { cat: 'all', min: 0, max: 0, mine: false, sort: 'pop' };
  const readUrl = () => {
    const q = new URLSearchParams(location.search);
    const c = q.get('cat') || 'all';
    F.cat = c === 'all' || TABS.includes(c) || SUBS.includes(c) ? c : 'all';
    F.min = Math.max(0, Number(q.get('min')) || 0);
    F.max = Math.max(0, Number(q.get('max')) || 0);
    F.mine = q.get('mine') === '1';
    F.sort = ['pop', 'cheap', 'dear', 'new'].includes(q.get('sort')) ? q.get('sort') : 'pop';
  };
  const writeUrl = (push) => {
    const q = new URLSearchParams(location.search);
    const set = (k, v) => (v ? q.set(k, String(v)) : q.delete(k));
    set('cat', F.cat !== 'all' && F.cat);
    set('min', F.min);
    set('max', F.max);
    set('mine', F.mine && '1');
    set('sort', F.sort !== 'pop' && F.sort);
    const url = `${location.pathname}${q.toString() ? `?${q}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history[push ? 'pushState' : 'replaceState'](null, '', url);
  };
  const activeCount = () => (F.cat !== 'all' ? 1 : 0) + (F.min || F.max ? 1 : 0) + (F.mine ? 1 : 0);

  // ---- the catalogue as cards: a family's offers and a creature's packs on one card
  const whyOf = (x) => (captain && captain.unavailable[x.id]) || (x.off === 'season' ? 'season' : null);
  const inCat = (x, c) => c === 'all' || x.tab === c || (SUBS.includes(c) && x.sec === c);
  const priceOk = (x) => (!F.min || x.rub >= F.min) && (!F.max || x.rub <= F.max);
  /** The cards with their visible items under the price and «mine» filters (the category apart). */
  const cards = () => {
    if (!shop) return [];
    const by = new Map();
    shop.items.forEach((x, i) => {
      if (!priceOk(x) || (F.mine && whyOf(x))) return;
      let c = by.get(x.card);
      if (!c) by.set(x.card, (c = { id: x.card, first: x, items: [], i }));
      c.items.push(x);
    });
    return [...by.values()];
  };
  const minRub = (c) => Math.min(...c.items.map((x) => x.rub));
  const sorted = (cs) => {
    const a = [...cs];
    if (F.sort === 'cheap') a.sort((p, q) => minRub(p) - minRub(q) || p.i - q.i);
    else if (F.sort === 'dear') a.sort((p, q) => minRub(q) - minRub(p) || p.i - q.i);
    else if (F.sort === 'new') a.sort((p, q) => (q.first.from || 0) - (p.first.from || 0) || q.i - p.i);
    else a.sort((p, q) => p.i - q.i); // (the shop's own order: the ladders as the game lays them out)
    return a;
  };

  const ribbon = (x) => (x.tag ? `<span class="shop-tag ${x.tag}">${esc(t[x.tag])}</span>` : '');
  const date = (ms) => new Date(ms).toLocaleDateString(data.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' });
  const artOf = (x) => {
    const src = x.art && data.art[x.art];
    const cls = x.kind === 'captain' ? ' face' : x.kind === 'ship' ? ' hull' : (x.art || '').startsWith('unit.') ? ' fig' : x.kind === 'pack' ? ' coin' : (x.art || '').startsWith('cos.plate_') ? ' plate' : '';
    const label = x.label ? `<span class="sc-label" style="color:${esc(x.ink || '#f2e6c8')};text-shadow:0 0 6px ${esc(x.halo || '#000')},0 1px 2px ${esc(x.halo || '#000')}">${esc(L(x.label))}</span>` : '';
    return `<div class="shop-art${cls}${x.swatch ? ' sw' : ''}"${x.swatch ? ` style="--sw:${esc(x.swatch)}"` : ''}>${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ''}${label}${ribbon(x)}</div>`;
  };
  const btnLabel = (x, why, single) => {
    if (busy === x.id) return esc(t.paying);
    if (why) return `${x.qty ? `<span class="q">${esc(L(x.qty))}</span>` : ''}<span class="p">${esc(t[`w_${why}`] || t.w_gone)}</span>`;
    if (single) return `<span class="w">${esc(t.buy)} · </span><span class="p">${esc(rub(x.rub))}</span>`;
    return `<span class="q">${esc(L(x.qty) || t.buy)}</span><span class="p">${esc(rub(x.rub))}</span>`;
  };
  const card = (c) => {
    const x = c.first;
    const single = c.items.length === 1 && !x.qty;
    const whys = c.items.map(whyOf);
    const all = whys.every(Boolean);
    const chips = [];
    if (x.kind === 'pack' && x.bonus) chips.push(`<span class="shop-bonus">${esc(t.bonus.replace('{n}', nf.format(x.bonus)))}</span>`);
    if (x.until && x.off !== 'season') chips.push(`<span class="shop-until">${esc(t.until.replace('{d}', date(x.until - 1)))}</span>`);
    if (x.off === 'season' && x.from > Date.now()) chips.push(`<span class="shop-until">${esc(t.since.replace('{d}', date(x.from)))}</span>`);
    if (x.once) chips.push(`<span class="shop-once">${esc(t.once)}</span>`);
    else if (x.per) chips.push(`<span class="shop-once">${esc(x.per === 'day' ? t.perDay : t.perWeek)}</span>`);
    if (x.aboard && x.kind !== 'ship' && x.kind !== 'unit') chips.push(`<span class="shop-once">${esc(t.aboard)}</span>`);
    const n = x.kind === 'pack' ? `<b class="shop-n"><img src="${esc(data.coin)}" alt="" width="26" height="26">${nf.format(x.doubloons)}</b>` : '';
    const btns = c.items.map((y, i) => {
      const why = whys[i];
      return `<button type="button" class="${single ? 'btn-gold sm shop-buy' : 'sc-opt'}${why ? ' off' : ''}${y.tag && !single ? ` ${y.tag}` : ''}" data-buy="${esc(y.id)}"${why || busy ? ' disabled' : ''}>${btnLabel(y, why, single)}</button>`;
    }).join('');
    const section = SUBS.includes(x.sec) ? data.subs[x.sec] : tabName[x.tab];
    return `<article class="shop-card${all ? ' owned' : ''}${x.tag ? ` tag-${x.tag}` : ''}" data-kind="${x.kind}" data-card="${esc(c.id)}">
${artOf(x)}<div class="shop-body"><span class="sc-cat">${esc(section)}</span>${n}<h3><button type="button" class="sc-more" data-open="${esc(x.id)}" aria-haspopup="dialog">${esc(L(x.title))}</button></h3><p>${esc(L(x.text))}</p>${x.meta ? `<p class="sc-meta">${esc(L(x.meta))}</p>` : ''}${chips.length ? `<div class="sc-chips">${chips.join('')}</div>` : ''}</div>
<div class="${single ? 'sc-one' : `sc-opts n${Math.min(c.items.length, 6)}`}">${btns}</div>${all && !single && whys[0] ? `<small class="sc-why">${esc(t[`w_${whys[0]}`] || '')}</small>` : ''}</article>`;
  };

  /** The counts by category (the price and «mine» filters applied). */
  const drawCounts = (cs) => {
    side.querySelectorAll('[data-cat]').forEach((b) => {
      const c = b.dataset.cat;
      const n = cs.filter((k) => k.items.some((x) => inCat(x, c))).length;
      b.querySelector('.st-n').textContent = String(n);
      b.setAttribute('aria-pressed', String(F.cat === c));
      b.classList.toggle('on', F.cat === c);
      b.classList.toggle('none', !n);
    });
    side.querySelector('.st-subs').classList.toggle('open', F.cat === 'cos' || SUBS.includes(F.cat));
  };

  const draw = () => {
    if (!shop) return;
    grid.removeAttribute('aria-busy');
    const cs = cards();
    drawCounts(cs);
    const list = sorted(cs.filter((c) => c.items.some((x) => inCat(x, F.cat))).map((c) => ({ ...c, items: c.items.filter((x) => inCat(x, F.cat)) })));
    const name = F.cat === 'all' ? t.all : SUBS.includes(F.cat) ? `${tabName.cos}: ${data.subs[F.cat]}` : tabName[F.cat];
    title.innerHTML = `${esc(name)} <i class="st-total">${list.length}</i>`;
    showBtn.textContent = t.show.replace('{n}', `${list.length}`);
    // grouped under headings when sorted as the shop shows it; one flat grid when sorted by price or by novelty
    let html = '';
    shown = [];
    if (F.sort === 'pop') {
      const key = (c) => (F.cat === 'all' ? c.first.tab : c.first.sec || c.first.tab);
      const head = (k) => (F.cat === 'all' ? tabName[k] : data.secs[k] || data.subs[k] || tabName[k] || '');
      const groups = new Map();
      for (const c of list) {
        const k = key(c);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      }
      const many = groups.size > 1;
      for (const cs2 of groups.values()) shown.push(...cs2);
      for (const [k, cs2] of groups) html += `${many && head(k) ? `<h3 class="st-gh">${esc(head(k))} <i>${cs2.length}</i></h3>` : ''}<div class="st-cards">${cs2.map(card).join('')}</div>`;
    } else {
      shown = list;
      html = `<div class="st-cards">${list.map(card).join('')}</div>`;
    }
    grid.innerHTML = html;
    empty.hidden = list.length > 0;
    const n = activeCount();
    badge.textContent = String(n);
    badge.hidden = !n;
    minIn.value = F.min || '';
    maxIn.value = F.max || '';
    mineIn.checked = F.mine;
    mineIn.disabled = !captain;
    mineIn.closest('.st-mine').classList.toggle('dis', !captain);
    sortSel.value = F.sort;
    side.querySelectorAll('.st-step').forEach((b) => b.classList.toggle('on', Number(b.dataset.min || 0) === F.min && Number(b.dataset.max || 0) === F.max && !!(F.min || F.max)));
  };
  const change = (patch) => {
    Object.assign(F, patch);
    writeUrl(true);
    draw();
  };

  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (b) {
      change({ cat: b.dataset.cat });
      if (!drawerMode() && grid.getBoundingClientRect().top < 0) grid.closest('.st-main').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const s = e.target.closest('.st-step');
    if (s) {
      const on = s.classList.contains('on');
      change(on ? { min: 0, max: 0 } : { min: Number(s.dataset.min || 0), max: Number(s.dataset.max || 0) });
      return;
    }
    if (e.target.closest('[data-reset]')) change({ cat: 'all', min: 0, max: 0, mine: false });
  });
  const num = (v) => Math.max(0, Math.round(Number(String(v).replace(/\s/g, '')) || 0));
  minIn.addEventListener('change', () => change({ min: num(minIn.value) }));
  maxIn.addEventListener('change', () => change({ max: num(maxIn.value) }));
  mineIn.addEventListener('change', () => change({ mine: mineIn.checked }));
  sortSel.addEventListener('change', () => change({ sort: sortSel.value }));
  addEventListener('popstate', () => { readUrl(); draw(); pdSync(); });

  // ---- the drawer of filters on a phone: the tab on the right edge opens it
  const drawerMode = () => matchMedia('(max-width: 959px)').matches;
  let lastFocus = null;
  const focusables = (el) => [...el.querySelectorAll('button:not([disabled]), input:not([disabled]), select, a[href], [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  const openDrawer = () => {
    lastFocus = d.activeElement;
    side.classList.add('on');
    void side.offsetWidth; // (mounted first, so its slide-in runs)
    side.classList.add('open');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('on'));
    d.documentElement.classList.add('st-lock');
    tab.setAttribute('aria-expanded', 'true');
    side.setAttribute('role', 'dialog');
    side.setAttribute('aria-modal', 'true');
    (side.querySelector('.st-cat.on') || side.querySelector('[data-close]')).focus({ preventScroll: true });
  };
  const closeDrawer = () => {
    if (!side.classList.contains('open')) return;
    side.classList.remove('open');
    side.style.transform = '';
    backdrop.classList.remove('on');
    setTimeout(() => { if (!side.classList.contains('open')) { backdrop.hidden = true; side.classList.remove('on'); } }, reduced.matches ? 0 : 280);
    d.documentElement.classList.remove('st-lock');
    tab.setAttribute('aria-expanded', 'false');
    side.removeAttribute('role');
    side.removeAttribute('aria-modal');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };
  tab.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);
  side.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (drawerMode()) closeDrawer(); }));
  addEventListener('resize', () => { if (!drawerMode()) closeDrawer(); });
  const trap = (el, e, onEsc) => {
    if (e.key === 'Escape') { e.preventDefault(); onEsc(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(el);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  side.addEventListener('keydown', (e) => { if (side.classList.contains('open')) trap(side, e, closeDrawer); });
  // a swipe to the right closes it (the drawer follows the finger)
  let sx = null, sy = null, dx = 0, horiz = null;
  side.addEventListener('touchstart', (e) => { if (!side.classList.contains('open')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; horiz = null; }, { passive: true });
  side.addEventListener('touchmove', (e) => {
    if (sx === null) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) horiz = Math.abs(mx) > Math.abs(my);
    if (!horiz) return;
    dx = Math.max(0, mx);
    side.style.transition = 'none';
    side.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  side.addEventListener('touchend', () => {
    if (sx === null) return;
    side.style.transition = '';
    side.style.transform = '';
    if (horiz && dx > 70) closeDrawer();
    sx = null;
  });

  // ---- step 1: whom for
  const drawWho = () => {
    if (!captain) {
      who.hidden = true;
      form.hidden = false;
      return;
    }
    const src = captain.captain && data.cos.portraits[captain.captain];
    const where = captain.online ? `${t.atSea}${captain.port ? `, ${t.inPort}` : ''}` : t.offline;
    who.innerHTML = `<span class="shop-face">${src ? `<img src="${esc(src)}" alt="">` : ''}</span><span class="shop-who-txt"><span class="kicker">${esc(t.to)}</span><b>${esc(captain.name)}</b>
<span class="muted">${captain.captain ? `${esc(data.cos.names[captain.captain] || '')} · ${esc(t.level)} ${captain.level} · ${esc(where)}` : esc(t.noCap)}</span></span><button type="button" class="btn-oak sm">${esc(t.change)}</button>`;
    who.querySelector('button').addEventListener('click', () => { captain = null; F.mine = false; writeUrl(false); drawWho(); draw(); pdFoot(); input.focus(); });
    who.hidden = false;
    form.hidden = true;
  };
  const find = async (name) => {
    say('');
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (n.length < 2 || n.length > 24) return say(t.badName);
    findBtn.disabled = true;
    findBtn.textContent = t.finding;
    try {
      const r = await api(`/api/site/captain?name=${encodeURIComponent(n)}`);
      if (r.status === 404) return say(t.notFound);
      if (r.status === 429) return say(t.rate);
      if (r.status === 400) return say(t.badName);
      if (!r.ok) return say(t.net);
      captain = r.body;
      store.set(NICK, captain.name);
      drawWho();
      draw();
      pdFoot();
    } catch {
      say(t.net);
    } finally {
      findBtn.disabled = false;
      findBtn.textContent = t.find;
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); void find(input.value); });

  // ---- «Оплатить»: the order confirmed, then away to pay
  let pending = null;
  const closeConfirm = () => {
    confirmEl.hidden = true;
    d.documentElement.classList.remove('st-lock2');
    if (pending && pending.btn && pending.btn.isConnected) pending.btn.focus({ preventScroll: true });
    pending = null;
  };
  const ask = (x, btn) => {
    pending = { x, btn };
    const src = x.art && data.art[x.art];
    confirmEl.querySelector('.st-confirm-what').innerHTML = `<div class="st-cw"><span class="st-cw-art${x.kind === 'ship' ? ' hull' : ''}"${x.swatch ? ` style="--sw:${esc(x.swatch)}"` : ''}>${src ? `<img src="${esc(src)}" alt="">` : ''}</span><div><b>${esc(L(x.name))}</b><span class="muted">${esc(t.forWho)} «${esc(captain.name)}»</span></div><strong>${esc(rub(x.rub))}</strong></div>`;
    confirmEl.querySelector('[data-pay]').textContent = t.payBtn.replace('{p}', rub(x.rub));
    confirmEl.hidden = false;
    d.documentElement.classList.add('st-lock2');
    confirmEl.querySelector('[data-pay]').focus();
  };
  confirmEl.addEventListener('keydown', (e) => trap(confirmEl, e, closeConfirm));
  confirmEl.addEventListener('click', (e) => { if (e.target === confirmEl || e.target.closest('[data-cancel]')) closeConfirm(); });
  confirmEl.querySelector('[data-pay]').addEventListener('click', () => { const p = pending; closeConfirm(); if (p) void buy(p.x); });

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b) {
      const c = e.target.closest('.shop-card');
      const o = c && (e.target.closest('[data-open]') || c.querySelector('[data-open]'));
      if (o && shop && !e.target.closest('a')) pdOpen(o.dataset.open, true, o);
      return;
    }
    if (b.disabled || !shop) return;
    const x = shop.items.find((y) => y.id === b.dataset.buy);
    if (!x) return;
    const toStep1 = (el) => {
      root.querySelector('#step1').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    };
    if (!captain) { say(t.needNick); toStep1(input); return; }
    if (shop.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailIn.value.trim())) { say(t.needEmail); toStep1(mailIn); return; }
    ask(x, b);
  });

  const buy = async (x) => {
    const email = shop.email ? mailIn.value.trim() : '';
    if (email) store.set(MAIL, email);
    say('');
    busy = x.id;
    draw();
    try {
      const r = await api('/api/site/order', { method: 'POST', body: JSON.stringify({ name: captain.name, item: x.id, lang: data.lang, ...(email ? { email } : {}) }) });
      if (r.ok && r.body.url) {
        location.href = r.body.url;
        return;
      }
      const e = r.body.error || 'unknown';
      say(e === 'not_found' ? t.notFound : e === 'rate' ? t.rate : e === 'email' ? t.needEmail : e === 'bad_name' ? t.badName : t[`e_${e}`] || (t[`w_${e}`] ? `${t[`w_${e}`]}.` : t.e_unknown));
      if (!pdOn()) root.querySelector('#step1').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
      void find(captain.name);
    } catch {
      say(t.net);
    }
    busy = null;
    draw();
    pdFoot();
  };

  // ---- a thing's window (owner, 2026-10-21: «на тапу или нажатию я хочу видеть модалку красивую с иконками и описанием
  // всех существ, кораблей, пекеджей … удобно и на мобиле и везде»): a tap on a card opens its whole card, ?item=<id> in
  // the address (a link to share; Back shuts it), ‹ › and the arrow keys walk the cards as the page shows them, Esc shuts
  // it. A desk's window in the middle; on a phone a sheet from the bottom, drawn down by its handle to shut. The buy bar
  // stays at its foot and buys as the card does (the same captain, the same receipt's e-mail, the same «Ваш заказ»).
  const pd = root.querySelector('.pd');
  const pdBox = pd.querySelector('.pd-box');
  const pdScroll = pd.querySelector('.pd-scroll');
  const pdErr = pd.querySelector('.pd-err');
  const pdWho = pd.querySelector('.pd-who');
  const pdBuyEl = pd.querySelector('.pd-buy');
  const pdPos = pd.querySelector('.pd-pos');
  const pdOn = () => !pd.hidden;
  const pdCache = new Map();
  let pdId = null, pdPushed = false, pdLast = null, pdTab = null, pdTimer = 0, pdTok = 0, pdNeed = null, pdData = null;
  const sheet = () => matchMedia('(max-width: 700px), (max-height: 500px)').matches;
  const itemOf = (id) => (shop && shop.items.find((x) => x.id === id)) || null;
  const fetchItem = (id) => {
    if (!pdCache.has(id)) {
      const p = api(`/api/site/shop/item?id=${encodeURIComponent(id)}`).then((r) => {
        if (!r.ok || !r.body.detail) throw new Error(String(r.status));
        return r.body;
      });
      p.catch(() => pdCache.delete(id));
      pdCache.set(id, p);
    }
    return pdCache.get(id);
  };
  const im = (src, cls = '', w = 48, h = 48, alt = '') => (src ? `<img src="${esc(src)}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ''} width="${w}" height="${h}" loading="lazy" decoding="async">` : '');
  const pdUrl = (id) => {
    const q = new URLSearchParams(location.search);
    if (id) q.set('item', id); else q.delete('item');
    return `${location.pathname}${q.toString() ? `?${q}` : ''}${location.hash}`;
  };
  const left = (ms) => {
    const m = Math.max(1, Math.floor(ms / 60000)), dd = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
    return dd ? `${dd} ${t.dd} ${hh} ${t.hh}` : hh ? `${hh} ${t.hh} ${mm} ${t.mm}` : `${mm} ${t.mm}`;
  };

  // the blocks of a card
  const chipsOf = (rows) => rows.map((c) => `<span class="pd-chip${c.tone ? ` ${c.tone}` : ''}"${c.hint ? ` title="${esc(L(c.hint))}"` : ''}>${im(c.icon, '', 18, 18)}${esc(L(c.name))}</span>`).join('');
  const numsOf = (nums) => (nums && nums.length ? `<span class="pd-nums">${nums.map((x) => `<span><i>${esc(L(x.name))}</i><b>${esc(L(x.v))}</b></span>`).join('')}</span>` : '');
  const bar = (r) => {
    const k = r.hi > r.lo ? (r.n - r.lo) / (r.hi - r.lo) : 1;
    const w = Math.round(Math.max(0.04, Math.min(1, k)) * 100);
    return `<li class="pd-bar"><span class="pd-ico">${im(r.icon, '', 30, 30)}</span><span class="pd-bn">${esc(L(r.name))}</span><b class="pd-bv">${esc(L(r.v))}</b>
<span class="pd-track" title="${esc(t.range.replace('{a}', nf.format(r.lo)).replace('{b}', nf.format(r.hi)))}"><span style="width:${w}%"></span></span></li>`;
  };
  const tiles = (rows) => `<ul class="pd-tiles">${rows.map((r) => `<li><span class="pd-ico">${im(r.icon, '', 30, 30)}</span><span><i>${esc(L(r.name))}</i><b>${esc(L(r.v))}</b></span></li>`).join('')}</ul>`;
  const abil = (a) => `<li class="pd-ab"><span class="abil-ico">${im(a.icon, '', 52, 52)}</span><span class="pd-abt"><b>${esc(L(a.name))}</b>${a.tag ? `<em>${esc(L(a.tag))}</em>` : ''}<span>${esc(L(a.text))}</span>${numsOf(a.nums)}</span></li>`;
  const mini = (r) => (r.n !== undefined && r.lo !== undefined ? `<span title="${esc(L(r.name))}">${im(r.icon, '', 18, 18)}${esc(L(r.v))}</span>` : `<span title="${esc(L(r.name))}">${im(r.icon, '', 18, 18)}${esc(L(r.v))}</span>`);
  const unitRow = (u) => `<li class="pd-unit"><span class="pd-ufig">${im(u.art, '', 96, 96)}<span class="tier-coin">${u.tier}</span></span><span class="pd-ut"><b>${esc(L(u.name))}${u.n !== undefined ? ` <i>×${u.n}</i>` : ''}</b>
<span class="pd-ustats">${u.stats.map(mini).join('')}</span><span class="pd-chips">${chipsOf(u.chips)}</span>${u.skill ? `<span class="pd-usk">${im(u.skill.icon, '', 26, 26)}<span><b>${esc(L(u.skill.name))}</b> · ${esc(L(u.skill.text))}</span></span>` : ''}</span></li>`;
  const line = (l) => `<li><span class="pd-li${l.swatch ? ' sw' : ''}"${l.swatch ? ` style="--sw:${esc(l.swatch)}"` : ''}>${im(l.icon, '', 40, 40)}</span><span class="pd-lt"><b>${esc(L(l.name))}</b>${l.hint ? `<i>${esc(L(l.hint))}</i>` : ''}</span><span class="pd-lq">${esc(L(l.qty))}</span></li>`;
  const cosRow = (c) => {
    const tag = c.only ? `<em class="pd-only">${esc(t.onlyHere)}</em>` : c.alone ? `<em>${esc(t.alone.replace('{p}', rub(c.alone)))}</em>` : '';
    const name = `<figcaption><b>${esc(L(c.name))}</b>${tag}</figcaption>`;
    const words = (w) => `<span class="pd-words" style="color:${esc(c.ink || '#f2e6c8')};text-shadow:0 0 6px ${esc(c.halo || '#000')},0 1px 2px ${esc(c.halo || '#000')}">${esc(L(w))}</span>`;
    if (c.k === 'title' || c.k === 'plate') return `<figure class="pd-cos plate">${c.k === 'plate' ? `<small class="muted">${esc(t.sample)}</small>` : ''}<span class="pd-plate">${im(c.plate, '', 512, 144)}${words(c.words)}</span>${name}</figure>`;
    if (c.k === 'frame') return `<figure class="pd-cos frame"><span class="pd-frame" style="--k:${Number(c.scale) || 1.4}">${im(c.face, 'face', 120, 120)}${im(c.art, 'ring', 256, 256)}</span>${name}</figure>`;
    if (c.k === 'emblem' || c.k === 'cloth') return `<figure class="pd-cos flag"><span class="pd-sea"><span class="pd-flag big" style="--rgb:${esc(c.rgb || '#333')}">${im(c.emblem, '', 64, 64)}</span><span class="pd-mship">${im(c.ship, '', 120, 240)}<span class="pd-flag" style="--rgb:${esc(c.rgb || '#333')}">${im(c.emblem, '', 64, 64)}</span></span></span>${name}</figure>`;
    if (c.k === 'trail') return `<figure class="pd-cos trail"><span class="pd-sea"><span class="pd-wake${c.glow ? ' glow' : ''}" style="--c1:${esc(c.c[0])};--c2:${esc(c.c[1])}">${'<i></i>'.repeat(9)}</span><span class="pd-mship run">${im(c.ship, '', 120, 240)}</span></span>${name}</figure>`;
    return `<figure class="pd-cos emotes"><span class="pd-emotes">${(c.emotes || []).map((e) => `<span>${im(e.art, '', 72, 72)}<i>${esc(L(e.name))}</i></span>`).join('')}</span><small class="muted">${esc(t.emoteSay)}</small>${name}</figure>`;
  };
  const block = (b) => {
    const h = b.h ? `<h3 class="pd-h">${esc(L(b.h))}</h3>` : '';
    switch (b.t) {
      case 'bars': return `${h}${b.note ? `<p class="pd-note muted">${esc(L(b.note))}</p>` : ''}<ul class="pd-bars">${b.rows.map(bar).join('')}</ul>`;
      case 'tiles': return `${h}${tiles(b.rows)}`;
      case 'abil': return `${h}<ul class="pd-abil">${b.rows.map(abil).join('')}</ul>`;
      case 'chips': return `${h}<ul class="pd-specs">${b.rows.map((c) => `<li>${im(c.icon, '', 34, 34)}<span><b>${esc(L(c.name))}</b>${c.hint && L(c.hint) ? `<i>${esc(L(c.hint))}</i>` : ''}</span></li>`).join('')}</ul>`;
      case 'units': return `${h}<ul class="pd-units">${b.rows.map(unitRow).join('')}</ul>`;
      case 'lines': return `${h}<ul class="pd-lines">${b.rows.map(line).join('')}</ul>${b.save ? `<div class="pd-value"><b>${esc(t.save.replace('{n}', nf.format(b.save)))}</b><span>${esc(t.worth.replace('{w}', rub(b.worth)))}</span><span class="pd-vbar"><span style="width:${Math.max(4, Math.round((b.price / b.worth) * 100))}%"></span></span></div>` : ''}`;
      case 'cos': return `${h}<div class="pd-cosl">${b.rows.map(cosRow).join('')}</div>`;
      default: return `${h}<p class="pd-text">${b.icon ? im(b.icon, '', 26, 26) : ''}<span>${esc(L(b.body))}</span></p>`;
    }
  };
  const heroArt = (x, det) => {
    const hz = det ? det.hero : { cls: x.kind === 'ship' ? 'hull' : x.kind === 'captain' ? 'face' : (x.art || '').startsWith('unit.') ? 'fig' : x.kind === 'pack' ? 'coin' : x.tab === 'cos' ? 'cos' : 'icon', art: x.art && data.art[x.art] };
    const label = x.label ? `<span class="sc-label" style="color:${esc(x.ink || '#f2e6c8')};text-shadow:0 0 6px ${esc(x.halo || '#000')},0 1px 2px ${esc(x.halo || '#000')}">${esc(L(x.label))}</span>` : '';
    const two = hz.alt && hz.cls === 'fig' ? `${im(hz.art, 'p0', 240, 300, L(x.title))}${im(hz.alt, 'p1', 240, 300)}` : hz.cls === 'face' ? `<span class="cap-ring">${im(hz.art, '', 300, 300, L(x.title))}</span>${hz.alt ? im(hz.alt, 'pd-hfig', 160, 300) : ''}` : im(hz.art, '', 300, 300, L(x.title));
    return `<div class="pd-art ${hz.cls}${x.swatch ? ' sw' : ''}${hz.alt && hz.cls === 'fig' ? ' anim' : ''}"${x.swatch ? ` style="--sw:${esc(x.swatch)}"` : ''}>${two}${label}${ribbon(x)}</div>`;
  };
  const opts = (x) => {
    const its = shop.items.filter((y) => y.card === x.card);
    if (its.length < 2) return '';
    return `<div class="pd-opts" role="radiogroup" aria-label="${esc(t.choose)}">${its.map((y) => {
      const why = whyOf(y);
      return `<button type="button" role="radio" class="sc-opt${why ? ' off' : ''}${y.id === x.id ? ' on' : ''}" aria-checked="${y.id === x.id}" data-pd-opt="${esc(y.id)}"><span class="q">${esc(L(y.qty) || t.buy)}</span><span class="p">${esc(rub(y.rub))}</span></button>`;
    }).join('')}</div>`;
  };
  const season = (x) => {
    if (x.until === undefined) return '';
    const now = Date.now();
    if (x.from !== undefined && now < x.from) return `<p class="pd-count">${im(data.coin && '/site/img/ico/clock.webp', '', 20, 20)}<span data-cd="${x.from}" data-cdk="starts">${esc(t.starts.replace('{t}', left(x.from - now)))}</span></p>`;
    if (now < x.until) return `<p class="pd-count">${im('/site/img/ico/clock.webp', '', 20, 20)}<span data-cd="${x.until}" data-cdk="ends">${esc(t.ends.replace('{t}', left(x.until - now)))}</span></p>`;
    return '';
  };

  /** The whole card: the hero (art, kicker, name, lead, chips, the packs), the tabs, their blocks. */
  const pdRender = (x, res) => {
    const det = res && res.detail;
    const tabs = det ? det.tabs.filter((tb) => tb.blocks.length) : [];
    if (!tabs.find((tb) => tb.id === pdTab)) pdTab = tabs[0] ? tabs[0].id : null;
    const head = `<div class="pd-hero">${heroArt(x, det)}<div class="pd-info"><p class="kicker">${esc(det ? L(det.hero.kicker) : SUBS.includes(x.sec) ? data.subs[x.sec] : tabName[x.tab])}</p>
<h2 id="pd-title">${esc(det ? L(det.hero.title) : L(x.title))}</h2><p class="pd-lead">${esc(det ? L(det.hero.lead) : L(x.text))}</p>${det ? `<div class="pd-chips">${chipsOf(det.hero.chips)}</div>` : ''}${season(x)}${opts(x)}</div></div>`;
    let body;
    if (!res) body = `<div class="pd-wait" aria-busy="true"><span></span><span></span><span></span><p class="muted">${esc(t.loading)}</p></div>`;
    else if (res === 'err') body = `<div class="pd-wait"><p>${esc(t.loadErr)}</p><button type="button" class="btn-oak sm" data-pd-retry>${esc(t.retry)}</button></div>`;
    else body = `${tabs.length > 1 ? `<div class="pd-tabs" role="tablist">${tabs.map((tb) => `<button type="button" role="tab" id="pdt-${tb.id}" aria-controls="pdp-${tb.id}" aria-selected="${tb.id === pdTab}" tabindex="${tb.id === pdTab ? 0 : -1}" data-pd-tab="${tb.id}">${esc(L(tb.name))}</button>`).join('')}</div>` : ''}
${tabs.map((tb) => `<section class="pd-panel" role="tabpanel" id="pdp-${tb.id}" aria-labelledby="pdt-${tb.id}"${tb.id === pdTab ? '' : ' hidden'}>${tb.blocks.map(block).join('')}</section>`).join('')}`;
    pdScroll.innerHTML = `${head}<div class="pd-body">${body}</div>`;
  };

  /** The buy bar: whom for, the price, and «Купить · N ₽» (or why not). */
  const pdFoot = () => {
    if (!pdOn() || !pdId) return;
    const x = itemOf(pdId);
    if (!x) return;
    const why = whyOf(x);
    const det = pdData && pdData.item && pdData.item.id === x.id ? pdData.detail : null;
    const save = det && det.facts && det.facts.save;
    const worth = det && det.facts && det.facts.worth;
    const sub = x.kind === 'unit' && x.n ? t.perHead.replace('{p}', rub(Math.round(x.rub / x.n))) : x.kind === 'deal' && worth ? t.usual.replace('{p}', rub(worth)) : save && worth ? t.worth.replace('{w}', rub(worth)) : '';
    pdBuyEl.innerHTML = `<div class="pd-price"><b>${esc(rub(x.rub))}</b>${sub ? `<span class="muted">${esc(sub)}</span>` : ''}</div>
<button type="button" class="btn-gold pd-go${why ? ' off' : ''}" data-pd-buy${why || busy ? ' disabled' : ''}>${busy === x.id ? esc(t.paying) : why ? esc(t[`w_${why}`] || t.w_gone) : `${esc(t.buy)} · ${esc(rub(x.rub))}`}</button>`;
    if (captain) {
      pdWho.innerHTML = `<span class="pd-for">${captain.captain && data.cos.portraits[captain.captain] ? im(data.cos.portraits[captain.captain], '', 28, 28) : ''}<span>${esc(t.forCap)} <b>«${esc(captain.name)}»</b>${captain.captain ? ` · ${esc(t.lv)} ${captain.level}` : ''}</span></span>${pdNeed === 'mail' ? `<label class="search pd-mail"><input type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="${esc(t.email)}" aria-label="${esc(t.email)}" value="${esc(mailIn.value)}"></label>` : ''}`;
    } else if (pdNeed === 'nick') {
      pdWho.innerHTML = `<form class="pd-nick"><label class="search"><input name="nick" maxlength="24" autocomplete="nickname" autocapitalize="off" spellcheck="false" placeholder="${esc(t.step1)}" aria-label="${esc(t.step1)}" value="${esc(input.value)}"></label><button class="btn-oak sm" type="submit">${esc(t.find)}</button></form>`;
    } else pdWho.innerHTML = '';
    pdWho.hidden = !pdWho.innerHTML;
  };

  const pdIndex = () => {
    const x = itemOf(pdId);
    return x ? shown.findIndex((c) => c.id === x.card) : -1;
  };
  const pdNavDraw = () => {
    const i = pdIndex();
    pd.querySelectorAll('[data-pd-nav]').forEach((b) => { b.disabled = i < 0 || shown.length < 2; });
    pdPos.textContent = i >= 0 ? `${i + 1} ${t.of} ${shown.length}` : '';
  };
  const tick = () => {
    pd.querySelectorAll('[data-cd]').forEach((el) => {
      const ms = Number(el.dataset.cd) - Date.now();
      el.textContent = ms > 0 ? t[el.dataset.cdk].replace('{t}', left(ms)) : '';
    });
  };

  /** Shows a thing in the open window (its card at once from the catalogue, its whole card when it comes). */
  const pdShow = async (id) => {
    const x = itemOf(id);
    if (!x) return pdClose();
    pdId = id;
    pdErr.hidden = true;
    const tok = ++pdTok;
    const sameCard = pdData && pdData.item && itemOf(pdData.item.id) && itemOf(pdData.item.id).card === x.card;
    if (!sameCard) { pdTab = null; pdScroll.scrollTop = 0; }
    pdData = null;
    pdRender(x, null);
    pdFoot();
    pdNavDraw();
    try {
      const res = await fetchItem(id);
      if (tok !== pdTok) return;
      pdData = res;
      const keep = pdScroll.scrollTop;
      pdRender(x, res);
      if (sameCard) pdScroll.scrollTop = keep;
      pdFoot();
      // the neighbours' cards, ahead of a tap on ‹ ›
      const i = pdIndex();
      [shown[i + 1], shown[i - 1]].forEach((c) => { if (c) void fetchItem(c.items[0].id).catch(() => {}); });
    } catch {
      if (tok === pdTok) pdRender(x, 'err');
    }
  };

  /** Opens the window on a thing (`push`: a new entry in the history, so Back shuts it). */
  const pdOpen = (id, push, from) => {
    if (!itemOf(id)) return;
    if (!pdOn()) {
      pdLast = from || d.activeElement;
      pd.hidden = false;
      pd.classList.toggle('sheet', sheet());
      void pd.offsetWidth;
      pd.classList.add('on');
      d.documentElement.classList.add('pd-lock');
      pdTimer = setInterval(tick, 30000);
      if (push) { history.pushState({ pd: id }, '', pdUrl(id)); pdPushed = true; }
      else history.replaceState(history.state, '', pdUrl(id));
      void pdShow(id);
      pdBox.focus({ preventScroll: true });
      return;
    }
    history.replaceState(history.state, '', pdUrl(id));
    void pdShow(id);
  };
  /** Shuts it (by Back when it put an entry in the history; the address loses ?item= either way). */
  const pdShut = () => {
    if (!pdOn()) return;
    if (pdPushed) { pdPushed = false; history.back(); return; }
    history.replaceState(history.state, '', pdUrl(null));
    pdClose();
  };
  const pdClose = () => {
    if (!pdOn()) return;
    pd.classList.remove('on');
    clearInterval(pdTimer);
    pdTok++;
    pdNeed = null;
    pdId = null;
    pdData = null;
    pdPushed = false;
    pdBox.style.transform = '';
    const done = () => { if (!pd.classList.contains('on')) pd.hidden = true; };
    if (reduced.matches) done(); else setTimeout(done, 240);
    d.documentElement.classList.remove('pd-lock');
    // (back to what opened it; the page drawn anew meanwhile: the same card's button)
    const key = pdLast && pdLast.dataset ? pdLast.dataset.open : null;
    const back = pdLast && pdLast.isConnected ? pdLast : key ? grid.querySelector(`[data-open="${CSS.escape(key)}"]`) : null;
    if (back) back.focus({ preventScroll: true });
    pdLast = null;
  };
  /** The address says what is open (Back, Forward, a link). */
  function pdSync() {
    if (!shop) return;
    const id = new URLSearchParams(location.search).get('item');
    if (id && itemOf(id)) { if (!pdOn()) pdOpen(id, false); else if (id !== pdId) void pdShow(id); }
    else if (pdOn()) pdClose();
  }
  const pdNav = (dir) => {
    const i = pdIndex();
    if (i < 0 || shown.length < 2) return;
    const c = shown[(i + dir + shown.length) % shown.length];
    pdOpen(c.items[0].id, false);
  };

  // the window's own buy: the card's flow, its questions asked in the bar
  const pdBuy = (btn) => {
    const x = itemOf(pdId);
    if (!x || btn.disabled) return;
    if (!captain) {
      pdNeed = 'nick';
      pdFoot();
      say(t.needNick);
      const i = pdWho.querySelector('input');
      if (i) i.focus();
      return;
    }
    if (shop.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailIn.value.trim())) {
      pdNeed = 'mail';
      pdFoot();
      say(t.needEmail);
      const i = pdWho.querySelector('input');
      if (i) i.focus();
      return;
    }
    pdNeed = null;
    say('');
    ask(x, pd.querySelector('[data-pd-buy]'));
  };
  pd.addEventListener('click', (e) => {
    const el = e.target;
    if (el.closest('[data-pd-close]')) return pdShut();
    const nav = el.closest('[data-pd-nav]');
    if (nav) return pdNav(Number(nav.dataset.pdNav));
    const tb = el.closest('[data-pd-tab]');
    if (tb) return pdTabTo(tb.dataset.pdTab, false);
    const o = el.closest('[data-pd-opt]');
    if (o) return pdOpen(o.dataset.pdOpt, false);
    if (el.closest('[data-pd-retry]')) { pdCache.delete(pdId); return void pdShow(pdId); }
    if (el.closest('[data-pd-copy]')) {
      const url = `${location.origin}${pdUrl(pdId)}`;
      const ok = () => { pdPos.textContent = t.copied; setTimeout(pdNavDraw, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => {}); else ok();
      return;
    }
    const b = el.closest('[data-pd-buy]');
    if (b) pdBuy(b);
  });
  pd.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.querySelector('input');
    if (v) { input.value = v.value; void find(v.value).then(() => { if (captain) { pdNeed = null; pdFoot(); const b = pd.querySelector('[data-pd-buy]'); if (b && !b.disabled) pdBuy(b); } }); }
  });
  pd.addEventListener('input', (e) => {
    if (e.target.closest('.pd-mail')) { mailIn.value = e.target.value; }
  });
  pd.addEventListener('keydown', (e) => {
    if (e.target.closest('.pd-mail') && e.key === 'Enter') { e.preventDefault(); const b = pd.querySelector('[data-pd-buy]'); if (b) pdBuy(b); return; }
  });
  const pdTabTo = (id, focus) => {
    pdTab = id;
    pd.querySelectorAll('[data-pd-tab]').forEach((b) => { const on = b.dataset.pdTab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    pd.querySelectorAll('.pd-panel').forEach((p) => { p.hidden = p.id !== `pdp-${id}`; });
  };
  d.addEventListener('keydown', (e) => {
    if (!pdOn() || !confirmEl.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); pdShut(); return; }
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    const tb = e.target.closest && e.target.closest('[data-pd-tab]');
    if (tb && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const all = [...pd.querySelectorAll('[data-pd-tab]')];
      const i = all.indexOf(tb) + (e.key === 'ArrowRight' ? 1 : -1);
      e.preventDefault();
      pdTabTo(all[(i + all.length) % all.length].dataset.pdTab, true);
      return;
    }
    if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); pdNav(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key === 'Tab') {
      const f = focusables(pdBox);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!pdBox.contains(d.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (d.activeElement === first || d.activeElement === pdBox)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  addEventListener('resize', () => { if (pdOn()) pd.classList.toggle('sheet', sheet()); });

  // the sheet drawn down by its handle (or by the card itself when it is scrolled to its top) shuts it
  let gy = null, gdy = 0, gt = 0, gOk = false;
  pdBox.addEventListener('touchstart', (e) => {
    if (!pd.classList.contains('sheet') || e.touches.length !== 1) return;
    const onHandle = !!e.target.closest('.pd-grab, .pd-top');
    gOk = onHandle || (pdScroll.contains(e.target) && pdScroll.scrollTop <= 0 && !e.target.closest('.pd-tabs, .pd-opts'));
    gy = e.touches[0].clientY;
    gdy = 0;
    gt = performance.now();
  }, { passive: true });
  pdBox.addEventListener('touchmove', (e) => {
    if (gy === null || !gOk) return;
    gdy = e.touches[0].clientY - gy;
    if (gdy <= 0) { pdBox.style.transform = ''; return; }
    if (e.cancelable) e.preventDefault();
    pdBox.style.transition = 'none';
    pdBox.style.transform = `translateY(${gdy}px)`;
  }, { passive: false });
  const gEnd = () => {
    if (gy === null) return;
    const v = gdy / Math.max(1, performance.now() - gt);
    pdBox.style.transition = '';
    if (gOk && (gdy > 120 || (gdy > 40 && v > 0.6))) pdShut();
    else pdBox.style.transform = '';
    gy = null;
  };
  pdBox.addEventListener('touchend', gEnd);
  pdBox.addEventListener('touchcancel', gEnd);

  // ---- back from paying: how the order stands
  const order = new URLSearchParams(location.search).get('order');
  const watchOrder = () => {
    if (!order || !/^[0-9a-f]{24}$/.test(order)) return;
    orderEl.hidden = false;
    const started = Date.now();
    const poll = async () => {
      let st = 'pending', v = null;
      try {
        const r = await api(`/api/site/order?id=${order}`);
        if (r.status === 404) st = 'missing';
        else if (r.ok) { v = r.body; st = v.status; }
      } catch { /* the network: try again */ }
      const item = v && shop && shop.items.find((x) => x.id === v.item);
      const key = st === 'paid' && v.wait ? `wait_${v.wait}` : st === 'done' && v.kept ? 'kept' : st;
      const good = st === 'done' || st === 'paid', bad = st === 'canceled' || st === 'failed' || st === 'missing';
      const slow = st === 'pending' && Date.now() - started > 60_000;
      orderEl.className = `shop-order panel ${good ? 'ok' : bad ? 'bad' : 'wait'}`;
      orderEl.innerHTML = `<span class="shop-order-ico" aria-hidden="true"></span><div><b>${esc(t[`o_${key}`] || t.o_pending)}</b>${v ? `<span>${item && item.kind !== 'deal' ? `${esc(L(item.name))} · ` : ''}${esc(t.forWho)} «${esc(v.name)}» · ${esc(rub(v.rub))}</span>` : ''}${slow ? `<span class="muted">${esc(t.o_slow)}</span>` : ''}<small class="muted">${esc(t.orderNum)} ${order.slice(0, 8)}</small></div>`;
      const waiting = st === 'pending' || (st === 'paid' && !v.wait);
      if (waiting && Date.now() - started < 10 * 60_000) setTimeout(poll, Date.now() - started < 60_000 ? 2500 : 8000);
      else if (st === 'paid' && v.wait && Date.now() - started < 30 * 60_000) setTimeout(poll, 15_000);
      else if (good && captain) void find(captain.name);
    };
    void poll();
  };

  // ---- off we go
  readUrl();
  writeUrl(false);
  (async () => {
    try {
      const r = await api('/api/site/shop');
      if (!r.ok) throw new Error(String(r.status));
      shop = r.body;
      if (shop.mode === 'test') { modeEl.textContent = shop.testOpen ? t.testOpen : t.test; modeEl.hidden = false; }
      mail.hidden = !shop.email;
      mailIn.value = store.get(MAIL);
      draw();
      pdSync();
    } catch {
      grid.innerHTML = `<p class="shop-err">${esc(t.net)}</p>`;
    }
    watchOrder();
    const q = new URLSearchParams(location.search).get('nick') || store.get(NICK);
    if (q) { input.value = q; void find(q); }
  })();
})();
