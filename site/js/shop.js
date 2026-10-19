// GRAVETIDE website: the shop (/site/shop/), as on fovgame.com — the captain's name, the item, the payment.
//   1. GET  /api/site/captain?name=…  her captain, level and what she has already (owned things can't be bought twice);
//   2. GET  /api/site/shop            the catalogue on sale now (prices are the server's) and the shop's mode;
//   3. POST /api/site/order           an order → the payment page (YooKassa, or the test mode's own page).
// Back from paying, the page is opened with ?order=… and asks GET /api/site/order?id=… every few seconds until the
// payment is through or refused. The name is remembered on this device. No libraries.
(() => {
  const d = document;
  const root = d.getElementById('shop');
  const data = JSON.parse(d.getElementById('shop-data')?.textContent || 'null');
  if (!root || !data) return;
  const t = data.t;
  const NICK = 'gravetide.shop.nick', MAIL = 'gravetide.shop.mail';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nf = new Intl.NumberFormat('ru-RU');
  const L = (tr) => (data.lang === 'ru' ? tr[1] : tr[0]);
  const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

  const form = root.querySelector('.shop-find');
  const input = form.querySelector('input');
  const findBtn = form.querySelector('button');
  const who = root.querySelector('.shop-who');
  const mail = root.querySelector('.shop-mail');
  const mailIn = mail.querySelector('input');
  const err = root.querySelector('.shop-err');
  const cat = root.querySelector('.shop-cat');
  const modeEl = root.querySelector('.shop-mode');
  const orderEl = root.querySelector('.shop-order');

  let shop = null; // { mode, email, testOpen, items }
  let captain = null; // { name, captain, level, unavailable }
  let busy = null;

  const say = (msg) => { err.textContent = msg || ''; err.hidden = !msg; };
  const api = async (path, init) => {
    const r = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init && init.body ? { 'Content-Type': 'application/json' } : {}) } });
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, ok: r.ok, body: body || {} };
  };

  // ---- step 2: the catalogue
  const GROUPS = ['pack', 'captain', 'bundle', 'offer'];
  const card = (x) => {
    const why = captain && captain.unavailable[x.id];
    const label = why ? esc(t[why] || t.owned) : busy === x.id ? esc(t.paying) : `<span class="w">${esc(t.buy)} · </span>${esc(nf.format(x.rub))}&nbsp;${esc(t.rub)}`;
    const art = data.art[x.art];
    const isFace = x.kind === 'captain';
    const ribbon = x.tag ? `<span class="shop-tag ${x.tag}">${esc(t[x.tag])}</span>` : '';
    const until = x.until ? `<span class="shop-until">${esc(t.until.replace('{d}', new Date(x.until - 1).toLocaleDateString(data.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' })))}</span>` : '';
    const bonus = x.kind === 'pack' && x.bonus ? `<span class="shop-bonus">${esc(t.bonus.replace('{n}', nf.format(x.bonus)))}</span>` : '';
    const n = x.kind === 'pack' ? `<b class="shop-n"><img src="${esc(data.coin)}" alt="" width="26" height="26">${nf.format(x.doubloons)}</b>` : '';
    return `<article class="shop-card${why ? ' owned' : ''}${x.tag ? ` tag-${x.tag}` : ''}" data-kind="${x.kind}">
<div class="shop-art${isFace ? ' face' : ''}">${art ? `<img src="${esc(art)}" alt="" loading="lazy" decoding="async">` : ''}${ribbon}</div>
<div class="shop-body">${n}<h3>${esc(L(x.name))}</h3><p>${esc(L(x.text))}</p>${bonus}${until}${x.once && !why ? `<span class="shop-once">${esc(t.once)}</span>` : ''}</div>
<button type="button" class="btn-gold sm shop-buy" data-buy="${esc(x.id)}"${why || busy ? ' disabled' : ''}>${label}</button></article>`;
  };
  const drawCatalog = () => {
    if (!shop) return;
    cat.removeAttribute('aria-busy');
    cat.innerHTML = GROUPS.map((g) => {
      const xs = shop.items.filter((x) => x.kind === g);
      return xs.length ? `<section class="shop-group" data-group="${g}"><h3 class="shop-gh">${esc(t[`g_${g}`])}</h3><div class="shop-grid${g === 'pack' ? ' packs' : ''}">${xs.map(card).join('')}</div></section>` : '';
    }).join('');
    cat.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => void buy(b.dataset.buy)));
  };

  // ---- step 1: whom for
  const drawWho = () => {
    if (!captain) {
      who.hidden = true;
      form.hidden = false;
      return;
    }
    const src = captain.captain && data.cos.portraits[captain.captain];
    who.innerHTML = `<span class="shop-face">${src ? `<img src="${esc(src)}" alt="">` : ''}</span><span class="shop-who-txt"><span class="kicker">${esc(t.to)}</span><b>${esc(captain.name)}</b>
<span class="muted">${captain.captain ? `${esc(data.cos.names[captain.captain] || '')} · ${esc(t.level)} ${captain.level}` : esc(t.noCap)}</span></span><button type="button" class="btn-oak sm">${esc(t.change)}</button>`;
    who.querySelector('button').addEventListener('click', () => { captain = null; drawWho(); drawCatalog(); input.focus(); });
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
      drawCatalog();
    } catch {
      say(t.net);
    } finally {
      findBtn.disabled = false;
      findBtn.textContent = t.find;
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); void find(input.value); });

  // ---- step 3: the order and away to pay
  const buy = async (id) => {
    if (!captain) {
      say(t.needNick);
      input.focus();
      root.querySelector('#step1').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let email;
    if (shop && shop.email) {
      email = mailIn.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say(t.needEmail);
        mailIn.focus();
        root.querySelector('#step1').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      store.set(MAIL, email);
    }
    say('');
    busy = id;
    drawCatalog();
    try {
      const r = await api('/api/site/order', { method: 'POST', body: JSON.stringify({ name: captain.name, item: id, lang: data.lang, ...(email ? { email } : {}) }) });
      if (r.ok && r.body.url) {
        location.href = r.body.url;
        return;
      }
      const e = r.body.error || 'unknown';
      say(e === 'not_found' ? t.notFound : e === 'rate' ? t.rate : e === 'email' ? t.needEmail : e === 'bad_name' ? t.badName : t[`e_${e}`] || t.e_unknown);
      if (e === 'owned' || e === 'limit' || e === 'max') void find(captain.name);
    } catch {
      say(t.net);
    }
    busy = null;
    drawCatalog();
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
      const good = st === 'done' || st === 'paid', bad = st === 'canceled' || st === 'failed' || st === 'missing';
      const slow = st === 'pending' && Date.now() - started > 60_000;
      orderEl.className = `shop-order panel ${good ? 'ok' : bad ? 'bad' : 'wait'}`;
      orderEl.innerHTML = `<span class="shop-order-ico" aria-hidden="true"></span><div><b>${esc(t[`o_${st}`] || t.o_pending)}</b>${v ? `<span>${item ? `${esc(L(item.name))} · ` : ''}${esc(t.forWho)} «${esc(v.name)}» · ${nf.format(v.rub)} ${t.rub}</span>` : ''}${slow ? `<span class="muted">${esc(t.o_slow)}</span>` : ''}<small class="muted">${esc(t.orderNum)} ${order.slice(0, 8)}</small></div>`;
      if ((st === 'pending' || st === 'paid') && Date.now() - started < 10 * 60_000) setTimeout(poll, Date.now() - started < 60_000 ? 2500 : 8000);
      else if (good && captain) void find(captain.name);
    };
    void poll();
  };

  // ---- off we go
  (async () => {
    try {
      const r = await api('/api/site/shop');
      if (!r.ok) throw new Error(String(r.status));
      shop = r.body;
      if (shop.mode === 'test') { modeEl.textContent = shop.testOpen ? t.testOpen : t.test; modeEl.hidden = false; }
      mail.hidden = !shop.email;
      mailIn.value = store.get(MAIL);
      drawCatalog();
    } catch {
      cat.innerHTML = `<p class="shop-err">${esc(t.net)}</p>`;
    }
    watchOrder();
    const q = new URLSearchParams(location.search).get('nick') || store.get(NICK);
    if (q) { input.value = q; void find(q); }
  })();
})();
