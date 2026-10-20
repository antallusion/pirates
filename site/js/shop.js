// GRAVETIDE website: the shop (/site/shop/) — a store page of everything the game's premium shop sells (owner,
// 2026-10-20: «в магазин на сайте не все товары выложил, нужно все выкладывать» and «магазин сделай с фильтрами слева,
// как полноценная такая страница магазина … на мобилке … справа язычок … который бы фильтр открывал сайдбаром»).
//   1. GET  /api/site/shop            the whole catalogue now (prices are the server's) and the shop's mode;
//   2. GET  /api/site/captain?name=…  her captain, level and what she cannot buy now, and why;
//   3. POST /api/site/order           an order → the payment page (YooKassa, or the test mode's own page).
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
  const TABS = data.tabs.map((x) => x.id);
  const SUBS = Object.keys(data.subs);
  const tabName = Object.fromEntries(data.tabs.map((x) => [x.id, x.name]));

  const say = (msg) => { err.textContent = msg || ''; err.hidden = !msg; };
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
${artOf(x)}<div class="shop-body"><span class="sc-cat">${esc(section)}</span>${n}<h3>${esc(L(x.title))}</h3><p>${esc(L(x.text))}</p>${x.meta ? `<p class="sc-meta">${esc(L(x.meta))}</p>` : ''}${chips.length ? `<div class="sc-chips">${chips.join('')}</div>` : ''}</div>
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
      for (const [k, cs2] of groups) html += `${many && head(k) ? `<h3 class="st-gh">${esc(head(k))} <i>${cs2.length}</i></h3>` : ''}<div class="st-cards">${cs2.map(card).join('')}</div>`;
    } else html = `<div class="st-cards">${list.map(card).join('')}</div>`;
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
  addEventListener('popstate', () => { readUrl(); draw(); });

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
    who.querySelector('button').addEventListener('click', () => { captain = null; F.mine = false; writeUrl(false); drawWho(); draw(); input.focus(); });
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
    if (!b || b.disabled || !shop) return;
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
      root.querySelector('#step1').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
      void find(captain.name);
    } catch {
      say(t.net);
    }
    busy = null;
    draw();
  };

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
    } catch {
      grid.innerHTML = `<p class="shop-err">${esc(t.net)}</p>`;
    }
    watchOrder();
    const q = new URLSearchParams(location.search).get('nick') || store.get(NICK);
    if (q) { input.value = q; void find(q); }
  })();
})();
