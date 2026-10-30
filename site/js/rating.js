// GRAVETIDE website: the captains' rating (/site/rating/). The boards come from GET /api/site/rating?board=… (a minute's
// snapshot of the game server); a name is looked up with GET /api/site/rating/find?name=…. The portraits, the plates
// and the frames are the game's own (the page's #rt-data, written by tools/site/build.ts). No libraries.
(() => {
  const d = document;
  const root = d.getElementById('rating');
  const data = JSON.parse(d.getElementById('rt-data')?.textContent || 'null');
  if (!root || !data) return;
  const t = data.t, cos = data.cos;
  const list = root.querySelector('.rt-list');
  const empty = root.querySelector('.rt-empty');
  const unitEl = root.querySelector('.rt-unit');
  const atEl = root.querySelector('.rt-at');
  const found = root.querySelector('.rt-found');
  const tabs = [...root.querySelectorAll('[data-board]')];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nf = new Intl.NumberFormat(data.lang === 'ru' ? 'ru-RU' : 'en-GB');
  const cache = new Map();
  // «В сети» (owner, 2026-10-29): who is in the game now (GET /api/site/online, a dozen seconds' snapshot) — the switch's
  // count, the green dots by the names, and with the switch on (?online=1) each board only them, at their real places.
  const onBtn = root.querySelector('.rt-onl');
  const onN = root.querySelector('.rt-onn');
  let onlineOnly = new URLSearchParams(location.search).get('online') === '1';
  let live = new Set();
  const ONLINE_MS = 12_000;

  /** A face in its frame, or in the site's brass ring when none is worn (site.js gtAvatar: the face in the hole's
   *  middle, the ring and the portrait one box that never shrinks). `size` the box's side. */
  const face = (captain, frame, size) => {
    const f = frame && cos.frames[frame] && cos.frames[frame].url ? cos.frames[frame] : null;
    return window.gtAvatar({ src: cos.portraits[captain], fit: cos.fits[captain], ring: f || cos.ring, size: `${size}px`, cls: `rt-av${f ? ' framed' : ''}` });
  };
  /** Her title on its plate, as other captains see it over her ship. */
  const plate = (title, plateId) => {
    const words = title && cos.titles[title];
    if (!words) return '';
    const p = cos.plates[plateId || 'driftwood'] || cos.plates.driftwood;
    // (the words keep to the plate's calm middle, as the game draws it: its ends as wide as span[0] of the whole)
    const k = p ? p.span[0] / (p.span[1] - p.span[0]) : 0.3;
    const pad = Math.max(1.2, k * words.length * 0.56).toFixed(2);
    return `<span class="rt-plate" style="${p && p.url ? `background-image:url(${esc(p.url)});` : ''}color:${esc(p ? p.ink : '#f3e6c8')};--halo:${esc(p ? p.halo : '#000')};padding:1px ${pad}em 0">${esc(words)}</span>`;
  };
  const board = () => tabs.find((b) => b.classList.contains('on'))?.dataset.board || 'level';
  const meta = (b) => data.boards.find((x) => x.id === b) || data.boards[0];

  const value = (b, r) => {
    if (b === 'campaign' && r.sub === 1) return `<b>${esc(t.done)}</b>`;
    return `<b>${nf.format(r.value)}</b>`;
  };
  const sub = (b, r) => {
    if (b === 'level' && r.sub) return `<i>${esc(t.glory)} ${nf.format(r.sub)}</i>`;
    if (b === 'arena' && r.sub !== undefined) return `<i>${nf.format(r.sub)} ${esc(t.wins)}</i>`;
    if (b === 'pvp') return `<i>${nf.format(r.kills || 0)} ${esc(t.kills)} · ${nf.format(r.deaths || 0)} ${esc(t.deaths)}</i>`;
    if (b !== 'level') return `<i>${esc(t.lvl)} ${r.level}</i>`;
    return '';
  };
  const dot = (name) => (live.has(name) ? `<i class="rt-live" title="${esc(t.live)}"></i>` : '');
  const rowHtml = (b, r) => `<li class="rt-row cp-go${r.rank <= 3 ? ` top top${r.rank}` : ''}" data-cap="${esc(r.name)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(`${r.name}${live.has(r.name) ? ` (${t.live})` : ''} — ${data.cp.t.open}`)}"><span class="rt-rank">${r.rank}</span>${face(r.captain, r.frame, 60)}
<span class="rt-who"><b class="rt-name">${dot(r.name)}${esc(r.name)}${r.guild ? ` <span class="rt-tag">[${esc(r.guild)}]</span>` : ''}</b>${plate(r.title, r.plate)}<span class="rt-cap">${esc(cos.names[r.captain] || '')}</span></span>
<span class="rt-val">${value(b, r)}${sub(b, r)}</span></li>`;
  const guildHtml = (r) => `<li class="rt-row guild${r.rank <= 3 ? ` top top${r.rank}` : ''}"><span class="rt-rank">${r.rank}</span><span class="rt-gtag">${esc(r.tag)}</span>
<span class="rt-who"><b class="rt-name">${esc(r.name)}</b><span class="rt-cap">${nf.format(r.members)} ${esc(t.members)} · ${esc(t.best)} ${esc(t.lvl)} ${r.top}</span></span>
<span class="rt-val"><b>${nf.format(r.value)}</b></span></li>`;

  const show = (b, v) => {
    unitEl.textContent = meta(b).unit;
    root.querySelector('.rt-col').textContent = b === 'guilds' ? t.colGuild : t.colCap;
    const rows = v.rows || [];
    list.innerHTML = rows.map((r) => (b === 'guilds' ? guildHtml(r) : rowHtml(b, r))).join('');
    empty.hidden = rows.length > 0;
    empty.textContent = onlineOnly ? t.onEmpty : t.empty;
    atEl.textContent = v.at ? `${t.at}: ${new Date(v.at).toLocaleTimeString(data.lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';
  };
  // ---- the PvP board (owner, 2026-10-30): its rules under the tabs, and «Прошлые сезоны» — each closed month's top ten
  const onRow = root.querySelector('.rt-onrow');
  const pastBtn = d.createElement('button');
  pastBtn.type = 'button';
  pastBtn.className = 'chip rt-past';
  pastBtn.setAttribute('role', 'switch');
  pastBtn.title = t.pvpPastTip;
  pastBtn.innerHTML = `<span>${esc(t.pvpPast)}</span>`;
  onRow.appendChild(pastBtn);
  const note = d.createElement('p');
  note.className = 'rt-note muted';
  note.textContent = t.pvpRules;
  onRow.after(note);
  let pastOn = new URLSearchParams(location.search).get('past') === '1';
  const MONTHS = String(t.months).split(',');
  const monthName = (m) => `${MONTHS[m % 12] || ''} ${Math.floor(m / 12)}`;
  const pvpDress = (b) => {
    const pvp = b === 'pvp';
    pastBtn.hidden = !pvp;
    note.hidden = !pvp;
    pastBtn.classList.toggle('on', pastOn);
    pastBtn.setAttribute('aria-checked', String(pastOn));
    onBtn.hidden = pvp && pastOn;
  };
  const showPast = async () => {
    unitEl.textContent = meta('pvp').unit;
    root.querySelector('.rt-col').textContent = t.colCap;
    root.querySelector('.rt-board').setAttribute('aria-busy', 'true');
    try {
      const hit = cache.get('pvp|past');
      let v = hit && Date.now() - hit.got < 60_000 ? hit.v : null;
      if (!v) {
        const r = await fetch(`${data.api}/pvp-seasons`, { headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(String(r.status));
        v = await r.json();
        cache.set('pvp|past', { v, got: Date.now() });
      }
      if (board() !== 'pvp' || !pastOn) return;
      const seasons = v.seasons || [];
      list.innerHTML = seasons.map((se) => `<li class="rt-season"><h3>${esc(monthName(se.month))}</h3></li>${se.top.map((r) => rowHtml('pvp', { ...r, value: r.pts })).join('')}`).join('');
      empty.hidden = seasons.length > 0;
      empty.textContent = t.pvpNone;
      atEl.textContent = '';
    } catch {
      list.innerHTML = '';
      empty.hidden = false;
      empty.textContent = t.err;
    } finally {
      root.querySelector('.rt-board').removeAttribute('aria-busy');
    }
  };
  const load = async (b) => {
    pvpDress(b);
    if (b === 'pvp' && pastOn) return void showPast();
    const on = onlineOnly, key = `${b}|${on ? 1 : 0}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.got < (on ? ONLINE_MS : 60_000)) return show(b, hit.v);
    root.querySelector('.rt-board').setAttribute('aria-busy', 'true');
    try {
      const r = await fetch(`${data.api}?board=${encodeURIComponent(b)}${on ? '&online=1' : ''}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(String(r.status));
      const v = await r.json();
      cache.set(key, { v, got: Date.now() });
      if (board() === b && onlineOnly === on) show(b, v);
    } catch {
      list.innerHTML = '';
      empty.hidden = false;
      empty.textContent = t.err;
    } finally {
      root.querySelector('.rt-board').removeAttribute('aria-busy');
    }
  };
  const pick = (b) => {
    tabs.forEach((x) => { const on = x.dataset.board === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
    // (on a phone the tabs scroll sideways: the chosen one brought into sight, the page itself not moved)
    const on = tabs.find((x) => x.dataset.board === b), bar = on?.parentElement;
    if (on && bar && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - bar.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    const u = new URL(location.href);
    u.searchParams.set('board', b);
    if (onlineOnly) u.searchParams.set('online', '1');
    else u.searchParams.delete('online');
    if (b === 'pvp' && pastOn) u.searchParams.set('past', '1');
    else u.searchParams.delete('past');
    history.replaceState(null, '', u);
    void load(b);
  };
  tabs.forEach((x) => x.addEventListener('click', () => pick(x.dataset.board)));

  const setSwitch = () => {
    onBtn.classList.toggle('on', onlineOnly);
    onBtn.setAttribute('aria-checked', String(onlineOnly));
  };
  onBtn.addEventListener('click', () => {
    onlineOnly = !onlineOnly;
    setSwitch();
    pick(board());
  });
  setSwitch();
  pastBtn.addEventListener('click', () => {
    pastOn = !pastOn;
    pick(board());
  });
  /** Who is in the game now: the count on the switch, the dots in the list (redrawn when the set has changed). */
  const pollOnline = async () => {
    try {
      const r = await fetch(data.onlineApi, { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const v = await r.json();
      const next = new Set(v.names || []);
      onN.textContent = nf.format(v.count || 0);
      const changed = next.size !== live.size || [...next].some((n) => !live.has(n));
      live = next;
      if (changed) {
        if (onlineOnly) cache.delete(`${board()}|1`);
        void load(board());
      }
    } catch { /* the count waits for the next try */ }
  };
  void pollOnline();
  setInterval(() => { if (!d.hidden) void pollOnline(); }, 15_000);

  // ---- a captain by name: her card and her places
  const form = root.querySelector('.rt-find');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const name = input.value.trim();
    found.hidden = false;
    if (name.length < 2) { found.innerHTML = `<p class="rt-msg">${esc(t.short)}</p>`; return; }
    try {
      const r = await fetch(`${data.api}/find?name=${encodeURIComponent(name)}`, { headers: { Accept: 'application/json' } });
      if (r.status === 404) { found.innerHTML = `<p class="rt-msg">${esc(t.notFound)}</p>`; return; }
      if (r.status === 429) { found.innerHTML = `<p class="rt-msg">${esc(t.rate)}</p>`; return; }
      if (!r.ok) throw new Error(String(r.status));
      const v = await r.json();
      const c = v.captain;
      const places = data.boards.filter((b) => b.id !== 'guilds').map((b) => {
        const n = v.ranks[b.id];
        return `<li><button type="button" data-go="${b.id}"><span>${esc(b.name)}</span><b>${n ? `#${nf.format(n)}` : esc(t.out)}</b></button></li>`;
      }).join('');
      found.innerHTML = `<div class="rt-card panel">${face(c.captain, c.frame, 108)}<div class="rt-card-txt"><p class="kicker">${esc(t.you)}</p><h3>${esc(c.name)}${c.guild ? ` <span class="rt-tag">[${esc(c.guild)}]</span>` : ''}</h3>${plate(c.title, c.plate)}
<p class="muted">${esc(cos.names[c.captain] || '')} · ${esc(t.lvl)} ${c.level}</p><button type="button" class="btn-gold sm rt-open" data-cap="${esc(c.name)}" aria-haspopup="dialog">${esc(data.cp.t.open)}</button></div><button type="button" class="rt-x" aria-label="${esc(t.close)}">×</button>
<div class="rt-places"><p class="kicker">${esc(t.ranks)}</p><ul>${places}</ul></div></div>`;
      found.querySelector('.rt-x').addEventListener('click', () => { found.hidden = true; found.innerHTML = ''; });
      found.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.go)));
    } catch {
      found.innerHTML = `<p class="rt-msg">${esc(t.err)}</p>`;
    }
  });

  const q = new URLSearchParams(location.search);
  const first = data.boards.some((b) => b.id === q.get('board')) ? q.get('board') : 'level';
  pick(first);
  if (q.get('name')) { form.querySelector('input').value = q.get('name'); form.requestSubmit(); }
  // ================================================================================================ the captain's card
  // Owner, 2026-10-28: «нажимая на капитана я хочу видеть его армию, корабль и все что вообще только есть, кроме
  // количества валюты … модалкой … с разными переключателями». A row (or the found card's button) opens it; the address
  // keeps ?captain=<name> (a link opens it, Back closes it); Esc, the cross and the shade close it; a phone gets a
  // full-screen sheet. The card is GET /api/site/captain/<name> (server/src/game/siteprofile.ts): no coin in it.
  const cp = data.cp, ct = cp.t, CI = cp.ico, LI = data.lang === 'ru' ? 1 : 0;
  const tr = (x) => (Array.isArray(x) ? x[LI] || x[0] : x || '');
  const fmt = (n) => nf.format(Math.round(n));
  const nf1 = new Intl.NumberFormat(data.lang === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 });
  const short = (n) => (n < 10000 ? fmt(n) : `${nf1.format(n / 1000)}k`);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const im = (src, alt = '', cls = '', w = 0) => (src ? `<img src="${esc(src)}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ''}${w ? ` width="${w}" height="${w}"` : ''} loading="lazy" decoding="async">` : '');
  const cards = new Map();
  /** The hover cards of the card on show (owner, 2026-10-28: «при наведении на снаряжение … вся инфа выпрыгивала как в
   *  игре»): each thing's `tip` (shared/src/data/sitetips.ts — the game's own words) kept here, its element marked
   *  data-tip="<index>". */
  let tips = [];
  const tp = (x) => (x && x.tip ? ` data-tip="${tips.push(x.tip) - 1}" tabindex="0"` : '');
  let cur = null, tab = 'overview', lastFocus = null, pushed = false, seq = 0;

  const box = d.createElement('div');
  box.className = 'cp';
  box.hidden = true;
  box.innerHTML = `<div class="cp-back" data-x></div><div class="cp-box" role="dialog" aria-modal="true" aria-labelledby="cp-name" tabindex="-1"><span class="cp-grab" aria-hidden="true"></span>
<button type="button" class="cp-x" data-x aria-label="${esc(ct.close)}"><span aria-hidden="true">×</span></button><div class="cp-scroll"></div></div>`;
  d.body.appendChild(box);
  const dlg = box.querySelector('.cp-box'), scroll = box.querySelector('.cp-scroll');

  // ---- the parts
  const tile = (icon, name, val, sub = '') => `<div class="cp-tile">${icon ? `<span class="cp-tico">${im(icon, '', '', 28)}</span>` : ''}<span class="cp-tx"><b${/^[\d\s.,/k+−-]+$/.test(String(val).replace(/&nbsp;| /g, ' ')) ? '' : ' class="w"'}>${val}</b><i>${esc(name)}</i>${sub ? `<em>${sub}</em>` : ''}</span></div>`;
  const h3 = (s, extra = '') => `<h3 class="cp-h">${esc(s)}${extra ? ` <span class="cp-h-x">${extra}</span>` : ''}</h3>`;
  const chip = (x, extra = '', cls = '', sub = '') => `<li class="cp-chip${cls ? ` ${cls}` : ''}"${tp(x)}>${x.icon ? im(x.icon, '', '', 32) : ''}<span>${esc(tr(x.name))}${extra ? ` <b>${extra}</b>` : ''}${sub ? `<i>${esc(sub)}</i>` : ''}</span></li>`;
  const chips = (title, xs, f = (x) => chip(x)) => (xs && xs.length ? `${h3(title, String(xs.length))}<ul class="cp-chips">${xs.map(f).join('')}</ul>` : '');
  const tierCls = (s) => `t${Math.min(7, Math.max(1, s.tier))}${s.up ? ' up' : ''}`;
  const unitCard = (s) => {
    return `<li class="cp-unit ${tierCls(s)}${s.rank ? ` r-${s.rank}` : ''}"${tp(s)}><span class="cp-uart">${im(s.art, tr(s.name))}</span>
<i class="cp-utier">${ROMAN[s.tier] || s.tier}${s.up ? '<s aria-hidden="true"></s>' : ''}</i><b class="cp-upow">${im(CI.power, '', '', 12)}${short(s.power)}</b><b class="cp-un">${fmt(s.n)}</b><span class="cp-uname">${esc(tr(s.name))}</span></li>`;
  };
  const itemTile = (it) => `<li class="cp-item${it.art ? ' art' : ''}" style="--rc:${esc(it.color)}"${tp(it)}><span class="cp-isq">${im(it.icon, '', '', 44)}</span><span class="cp-itx"><b>${esc(tr(it.name))}</b><i>${esc(tr(it.slotName))} · ${esc(tr(it.rarityName))}</i></span></li>`;
  const slotSq = (it) => (it ? `<span class="cp-slot" style="--rc:${esc(it.color)}"${tp(it)}>${im(it.icon, tr(it.name))}</span>` : '<span class="cp-slot void" aria-hidden="true"></span>');
  const shipPic = (art, name, cls = '') => `<span class="cp-hull${cls ? ` ${cls}` : ''}">${im(art, name)}</span>`;
  const ago = (ms) => {
    const s = Math.max(1, (Date.now() - ms) / 1000);
    const rtf = new Intl.RelativeTimeFormat(data.lang === 'ru' ? 'ru' : 'en', { numeric: 'auto' });
    if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    if (s < 86400 * 45) return rtf.format(-Math.round(s / 86400), 'day');
    return rtf.format(-Math.round(s / (86400 * 30)), 'month');
  };
  const date = (ms) => new Date(ms).toLocaleDateString(data.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // ---- the hover card: a dark panel in a gold border, the name in its rarity's colour, its numbers and words (as the
  // game's own); a mouse on hover, a finger on tap (a tap outside closes it), the keyboard on focus; kept on screen.
  const tipEl = d.createElement('div');
  tipEl.className = 'gt-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.id = 'gt-tip';
  tipEl.hidden = true;
  d.body.appendChild(tipEl);
  let tipFor = null;
  const tipHtml = (x) => {
    const rows = (x.rows || []).map((r) => `<div class="gt-r${r.tone ? ` ${r.tone}` : ''}"><span>${esc(tr(r.k))}</span><b>${esc(tr(r.v))}</b></div>`).join('');
    const notes = (x.notes || []).map((n) => `<p class="gt-p${n.tone ? ` ${n.tone}` : ''}">${esc(tr(n.t))}</p>`).join('');
    return `<b class="gt-n"${x.color ? ` style="color:${esc(x.color)}"` : ''}>${esc(tr(x.name))}</b>${x.sub ? `<i class="gt-s">${esc(tr(x.sub))}</i>` : ''}${rows ? `<div class="gt-rows">${rows}</div>` : ''}${notes}`;
  };
  function hideTip() {
    if (tipFor) tipFor.removeAttribute('aria-describedby');
    tipFor = null;
    tipEl.hidden = true;
    tipEl.classList.remove('on');
  }
  const showTip = (el) => {
    const x = tips[Number(el.dataset.tip)];
    if (!x) return;
    if (tipFor === el && !tipEl.hidden) return;
    hideTip();
    tipFor = el;
    el.setAttribute('aria-describedby', 'gt-tip');
    tipEl.style.setProperty('--tc', x.color || '#f5c451');
    tipEl.innerHTML = tipHtml(x);
    tipEl.style.left = '0px';
    tipEl.style.top = '0px';
    tipEl.hidden = false;
    const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect(), W = innerWidth, H = innerHeight, m = 8;
    // beside the thing (right, else left); where neither fits (a phone), under it, else over it
    let left, top;
    if (r.right + m + t.width <= W - m) { left = r.right + m; top = r.top; }
    else if (r.left - m - t.width >= m) { left = r.left - m - t.width; top = r.top; }
    else { left = r.left + r.width / 2 - t.width / 2; top = r.bottom + m + t.height <= H - m ? r.bottom + m : r.top - m - t.height; }
    left = Math.max(m, Math.min(W - m - t.width, left));
    top = Math.max(m, Math.min(H - m - t.height, top));
    tipEl.style.left = `${Math.round(left)}px`;
    tipEl.style.top = `${Math.round(top)}px`;
    tipEl.classList.add('on');
  };
  const tipTarget = (e) => (e.target && e.target.closest ? e.target.closest('[data-tip]') : null);
  box.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const el = tipTarget(e); if (el && box.contains(el)) showTip(el); });
  box.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || !tipFor) return;
    const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('[data-tip]') : null;
    if (to !== tipFor) hideTip();
  });
  box.addEventListener('focusin', (e) => { const el = tipTarget(e); if (el && el.matches(':focus-visible')) showTip(el); else if (!el) hideTip(); });
  box.addEventListener('focusout', (e) => { if (tipTarget(e) === tipFor && !box.contains(e.relatedTarget)) hideTip(); });
  // a finger: a tap shows it (a second tap on the same thing, or a tap anywhere else, closes it)
  d.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    const el = tipTarget(e);
    if (el && box.contains(el)) { if (tipFor === el && !tipEl.hidden) hideTip(); else showTip(el); return; }
    if (!tipEl.contains(e.target)) hideTip();
  });
  scroll.addEventListener('scroll', () => { if (tipFor) hideTip(); }, { passive: true });
  addEventListener('resize', hideTip);

  // ---- the tabs (a tab with nothing in it is not shown)
  const TABS = [
    ['overview', ct.tOverview, () => true],
    ['army', ct.tArmy, (v) => v.army.stacks.length > 0],
    ['ship', ct.tShip, (v) => !!v.ship],
    ['hero', ct.tHero, (v) => v.hero.prim.length > 0 || v.hero.gear.length > 0 || v.hero.skills.length > 0 || v.hero.talents.length > 0],
    ['island', ct.tIsland, (v) => !!v.island],
    ['feats', ct.tFeats, (v) => { const f = v.feats; return !!(f.campaign || f.deeds.length || f.feats.length || f.trophies.length || f.bosses.length || f.wonders.length || f.regions.length || f.tattoos.length || f.pets.length || f.companion || f.beasts.length || f.saga.length); }],
  ];

  const overview = (v) => {
    const st = v.stats, p = v.pvp;
    const tiles = [
      tile(CI.level, ct.lvl, fmt(v.level), v.glory ? `${esc(ct.glory)} ${fmt(v.glory)}` : ''),
      v.army.stacks.length ? tile(CI.power, ct.power, short(v.army.power), `${fmt(v.army.men)} ${esc(ct.men)}`) : '',
      v.ship ? tile(CI.ship, ct.tShip, esc(tr(v.ship.clsName)), `⚓${v.ship.level}`) : '',
      p.season && (p.season.pts > 0 || p.all.pts > 0) ? tile(CI.pvpPts, ct.pvpPts, fmt(p.season.pts), p.season.rank ? esc(ct.place.replace('{n}', fmt(p.season.rank))) : '') : '',
      p.all && p.all.pts > 0 ? tile(CI.pvpPts, ct.pvpAll, fmt(p.all.pts), `${esc(ct.pvpKd)} ${fmt(p.all.kills)}/${fmt(p.all.deaths)}`) : '',
      p.all && p.all.kills > 0 ? tile(CI.sunk, ct.pvpKills, fmt(p.all.kills), p.all.best > 1 ? `${esc(ct.pvpBest)} ${fmt(p.all.best)}` : '') : '',
      tile(CI.pvp, ct.pvp, fmt(p.rating), p.duels ? `${fmt(p.wins)}/${fmt(p.duels)}` : ''),
      p.arena !== null ? tile(CI.arena, ct.arena, fmt(p.arena), `${fmt(p.arenaWins)} ${esc(ct.wins)}`) : '',
      p.wanted > 0 ? tile(CI.wanted, ct.wanted, esc(tr(p.wantedName))) : '',
      ...['boarded', 'sunk', 'distance', 'recruited', 'quests', 'roamWins', 'mentored', 'season', 'fish'].filter((k) => st[k] > 0).map((k) => tile(CI[k], ct[k], fmt(st[k]))),
    ].join('');
    const places = data.boards.filter((b) => b.id !== 'guilds' && v.ranks[b.id]).map((b) => `<li><button type="button" data-go="${b.id}">${im(b.icon, '', '', 18)}<span>${esc(b.name)}</span><b>#${fmt(v.ranks[b.id])}</b></button></li>`).join('');
    const rep = v.rep.map((r) => {
      const w = Math.min(100, Math.abs(r.v));
      return `<li class="cp-rep${r.v < 0 ? ' neg' : ''}">${im(r.icon, '', '', 26)}<span class="cp-rep-n">${esc(tr(r.name))}</span><span class="cp-bar"><i style="${r.v < 0 ? 'right:50%' : 'left:50%'};width:${w / 2}%"></i></span><b>${r.v > 0 ? '+' : ''}${fmt(r.v)}</b></li>`;
    }).join('');
    const careers = v.careers.length ? `${h3(ct.careers)}<ul class="cp-chips">${v.careers.map((c) => `<li class="cp-chip gold"><span>${esc(tr(c.name))}: <b>${esc(tr(c.rankName))}</b></span></li>`).join('')}</ul>` : '';
    const titles = v.titles.length ? `${h3(ct.titles, String(v.titles.length))}<ul class="cp-chips">${v.titles.map((x) => `<li class="cp-chip${v.title && tr(v.title) === tr(x) ? ' gold' : ''}"><span>${esc(tr(x))}</span></li>`).join('')}</ul>` : '';
    return `<div class="cp-tiles">${tiles}</div>${places ? `${h3(ct.places)}<ul class="cp-places">${places}</ul>` : ''}${careers}${titles}${h3(ct.rep)}<ul class="cp-reps">${rep}</ul>`;
  };

  const army = (v) => {
    const a = v.army, slots = Math.max(a.slots, a.stacks.length);
    const row = a.stacks.map(unitCard).join('') + '<li class="cp-unit void" aria-hidden="true"></li>'.repeat(Math.max(0, slots - a.stacks.length));
    const list = a.stacks.map((s) => `<li class="cp-uline"${tp(s)}><span class="cp-uthumb ${tierCls(s)}">${im(s.art, '')}</span><span class="cp-ul-tx"><b>${esc(tr(s.name))} <i>×${fmt(s.n)}</i></b>
<span>${esc(ct.tier)} ${ROMAN[s.tier] || s.tier}${s.up ? ` · ${esc(ct.up)}` : ''} · ${esc(ct.atk)} ${s.atk} · ${esc(ct.def)} ${s.def} · ${esc(ct.dmg)} ${s.dmin}–${s.dmax} · ${esc(ct.hp)} ${s.hp}</span></span><b class="cp-ul-pow">${im(CI.power, '', '', 14)}${short(s.power)}</b></li>`).join('');
    return `<div class="cp-tiles three">${tile(CI.power, ct.power, short(a.power))}${tile(CI.men, ct.count, fmt(a.men))}${tile(CI.anchor, ct.stacks, `${a.stacks.length}/${a.slots}`)}</div>
<ul class="cp-army" style="--n:${Math.min(7, slots)};--m:${Math.min(5, slots)}">${row}</ul><ul class="cp-ulist">${list}</ul>`;
  };

  const fleetList = (title, xs, nm) => (xs.length ? `${h3(title, String(xs.length))}<ul class="cp-fleet">${xs.map((e) => `<li>${shipPic(e.art, tr(e.clsName), 'sm')}<span><b>${esc(nm(e))}</b><i>${esc(tr(e.clsName))} · ⚓${e.level}</i></span></li>`).join('')}</ul>` : '');
  const ship = (v) => {
    const s = v.ship;
    const stats = [tile(CI.hull, ct.hull, fmt(s.hullMax)), tile(CI.sails, ct.sails, fmt(s.sails)), tile(CI.speed, ct.speed, nf1.format(s.speed)), tile(CI.guns, ct.gunsSide, fmt(s.gunsPerSide)), tile(CI.crew, ct.crew, fmt(s.crewMax)), s.armor ? tile(CI.armor, ct.armor, fmt(s.armor)) : ''].join('');
    const flags = `${s.legendary ? `<li class="cp-chip gold"><span>${esc(ct.legendary)}</span></li>` : ''}${s.keel ? `<li class="cp-chip gold"><span>${esc(ct.keel)}</span></li>` : ''}`;
    const fit = [...s.guns.map((g) => chip(g, '', '', ct.guns)), s.figurehead ? chip(s.figurehead, '', 'ice', ct.figurehead) : '', s.mount ? chip(s.mount, '', 'ice', ct.mount) : ''].join('');
    const mods = s.modules.length ? `${h3(ct.modules, String(s.modules.length))}<ul class="cp-chips">${s.modules.map((m) => chip(m, m.lv > 1 ? `${m.lv}` : '')).join('')}</ul>` : '';
    return `<div class="cp-ship">${shipPic(s.art, tr(s.clsName))}<div class="cp-ship-tx"><p class="kicker">${esc(tr(s.clsName))} · ${esc(ct.shipLv)} ⚓${s.level}</p><h3 class="cp-big">«${esc(s.name || tr(s.clsName))}»</h3>
${flags ? `<ul class="cp-chips">${flags}</ul>` : ''}${fit ? `<ul class="cp-chips">${fit}</ul>` : ''}</div></div>
<div class="cp-tiles">${stats}</div>${mods}${s.gear.length ? `${h3(ct.shipGear, String(s.gear.length))}<ul class="cp-items">${s.gear.map(itemTile).join('')}</ul>` : ''}${fleetList(ct.escorts, v.escorts, (e) => e.name || tr(e.clsName))}${fleetList(ct.berths, v.berths, (e) => e.name || tr(e.clsName))}`;
  };

  const LEFT = ['hat', 'coat', 'sash', 'boots', 'blade'], RIGHT = ['pistols', 'spyglass', 'compass', 'charm', 'ring'];
  const hero = (v) => {
    const h = v.hero;
    const by = Object.fromEntries(h.gear.map((it) => [it.slot, it]));
    const prim = h.prim.length ? `${h3(ct.prim)}<div class="cp-tiles four">${h.prim.map((x) => tile(x.icon, tr(x.name), fmt(x.base + x.art), x.art ? `+${fmt(x.art)}` : '')).join('')}</div>` : '';
    const skills = h.skills.length ? `${h3(ct.skills, String(h.skills.length))}<ul class="cp-chips big">${h.skills.map((x) => chip(x, '', `rk${x.rank}`, tr(x.rankName))).join('')}</ul>` : '';
    const doll = h.gear.length ? `${h3(ct.gear, `${h.gear.length}/10`)}<div class="cp-doll"><div class="cp-dcol">${LEFT.map((sl) => slotSq(by[sl])).join('')}</div>
<div class="cp-dmid">${v.figure ? im(v.figure, '', 'cp-dfig') : face(v.captain, v.frame, 150)}</div><div class="cp-dcol">${RIGHT.map((sl) => slotSq(by[sl])).join('')}</div></div><ul class="cp-items">${h.gear.map(itemTile).join('')}</ul>` : '';
    const relics = h.relics.length ? `${h3(ct.relics)}<ul class="cp-chips">${h.relics.map((r) => chip(r, r.on ? esc(ct.made) : `${r.worn}/${r.of}`, r.on ? 'gold' : '')).join('')}</ul>` : '';
    const sets = h.sets.length ? `${h3(ct.sets)}<ul class="cp-chips">${h.sets.map((x) => `<li class="cp-chip gold"${tp(x)}><span>${esc(tr(x.name))}</span></li>`).join('')}</ul>` : '';
    const orders = h.orders.length ? `${h3(ct.orders, h.willMax ? `${esc(ct.will)} ${fmt(h.willMax)}` : String(h.orders.length))}<ul class="cp-chips">${h.orders.map((o) => chip(o, ROMAN[o.level] || '', '', tr(o.school))).join('')}</ul>` : '';
    const talents = h.talents.length ? `${h3(ct.talents, String(h.talents.reduce((n, x) => n + x.rank, 0)))}<ul class="cp-chips">${h.talents.map((x) => chip(x, `${x.rank}/${x.max}`, x.rank >= x.max ? 'gold' : '', tr(x.tree))).join('')}</ul>` : '';
    return `${prim}${skills}${doll}${relics}${sets}${orders}${talents}`;
  };

  const island = (v) => {
    const i = v.island;
    const grid = (title, xs) => (xs.length ? `${h3(title, String(xs.length))}<ul class="cp-builds">${xs.map((b) => `<li${tp(b)}><span class="cp-bimg">${im(b.icon, tr(b.name))}</span><b>${esc(tr(b.name))}</b><i>${esc(ct.lvl)} ${b.level}</i></li>`).join('')}</ul>` : '');
    return `<div class="cp-isle"><span class="cp-isle-ico">${im(CI.island, '', '', 56)}</span><div><p class="kicker">${i.sea ? esc(tr(i.sea)) : ''}</p><h3 class="cp-big">${esc(tr(i.name))}</h3><p class="muted">${esc(ct.isleLv)}: <b>${i.level}</b></p></div></div>
${grid(ct.town, i.town)}${grid(ct.producers, i.producers)}${grid(ct.buildings, i.buildings)}${fleetList(ct.isleShips, i.ships, (e) => tr(e.name))}`;
  };

  const feats = (v) => {
    const f = v.feats;
    const c = f.campaign;
    const camp = c ? `<div class="cp-camp">${c.card ? `<span class="cp-camp-art">${im(c.card, '')}</span>` : ''}<div class="cp-camp-tx"><p class="kicker">${esc(ct.campaign)}</p><h3 class="cp-big">${esc(ct.chapter.replace('{n}', c.ch))}: ${esc(tr(c.title))}</h3>
<span class="cp-xp"><i style="width:${Math.max(1, Math.round((c.at / c.of) * 100))}%"></i></span><p class="muted">${c.done ? esc(ct.done) : `${fmt(c.at)} / ${fmt(c.of)}`}</p></div></div>` : '';
    const comp = f.companion ? `${h3(ct.companion)}<ul class="cp-chips">${chip({ name: f.companion.name, icon: f.companion.icon }, `${esc(ct.lvl)} ${f.companion.level}`, '', f.companion.harness ? tr(f.companion.harness) : '')}</ul>` : '';
    const saga = f.saga.length ? `${h3(ct.saga, String(f.sagaN))}<ol class="cp-saga">${f.saga.map((e) => `<li>${im(e.icon, '', '', 28)}<span>${esc(tr(e.text))}</span></li>`).join('')}</ol>${f.sagaN > f.saga.length ? `<p class="muted cp-note">${esc(ct.sagaMore.replace('{n}', fmt(f.sagaN)))}</p>` : ''}` : '';
    const regions = f.regions.length ? `${h3(ct.regions, String(f.regions.length))}<ul class="cp-chips">${f.regions.map((r) => `<li class="cp-chip ice"><span>${esc(tr(r))}</span></li>`).join('')}</ul>` : '';
    return `${camp}${chips(ct.deeds, f.deeds)}${chips(ct.feats, f.feats, (x) => chip(x, '', 'gold'))}${chips(ct.trophies, f.trophies, (x) => chip(x, '', 'gold'))}${chips(ct.bosses, f.bosses, (x) => chip(x, x.n > 1 ? `×${x.n}` : '', 'red'))}`
      + `${chips(ct.wonders, f.wonders)}${regions}${chips(ct.tattoos, f.tattoos, (x) => chip(x, '', x.on ? 'gold' : '', x.on ? ct.worn : ''))}${chips(ct.pets, f.pets, (x) => chip(x, '', x.deck ? 'gold' : '', x.deck ? ct.onDeck : ''))}${comp}${chips(ct.beasts, f.beasts, (x) => chip(x, `×${fmt(x.n)}`))}${saga}`;
  };
  const PANEL = { overview, army, ship, hero, island, feats };

  const head = (v) => {
    const xpPct = v.xpNext ? Math.max(0, Math.min(100, (v.xp / v.xpNext) * 100)) : 100;
    const state = v.online ? `<span class="cp-on"><i></i>${esc(ct.online)}${v.sea ? ` · ${esc(tr(v.sea))}` : ''}</span>` : v.seen ? `<span class="cp-off">${esc(ct.seen.replace('{t}', ago(v.seen)))}</span>` : '';
    return `<header class="cp-head">${face(v.captain, v.frame, 132)}<div class="cp-who"><p class="kicker">${esc(tr(v.capName))} · ${esc(tr(v.archetype))}</p>
<h2 id="cp-name">${esc(v.name)}${v.guild ? ` <span class="rt-tag" title="${esc(v.guild.name)}">[${esc(v.guild.tag)}]</span>` : ''}</h2>${plate(v.cosTitle, v.plate)}${!v.cosTitle && v.title ? `<p class="cp-title">${esc(tr(v.title))}</p>` : ''}
<div class="cp-lv"><b>${esc(ct.lvl)} ${v.level}</b>${v.glory ? `<span class="cp-glory">${im(CI.glory, '', '', 16)}${esc(ct.glory)} ${fmt(v.glory)}</span>` : ''}${state}</div>
<div class="cp-xpw" title="${esc(ct.xp)}"><span class="cp-xp"><i style="width:${xpPct.toFixed(1)}%"></i></span><em>${v.xpNext ? `${fmt(v.xp)} / ${fmt(v.xpNext)}` : esc(ct.maxed)}</em></div>
${v.created ? `<p class="cp-since">${esc(ct.since.replace('{d}', date(v.created)))}</p>` : ''}</div></header>`;
  };

  const drawCard = (v) => {
    tips = [];
    hideTip();
    const tabs = TABS.filter(([, , ok]) => ok(v));
    if (!tabs.some(([id]) => id === tab)) tab = 'overview';
    scroll.innerHTML = `${head(v)}<div class="cp-tabs" role="tablist">${tabs.map(([id, name]) => `<button type="button" role="tab" id="cpt-${id}" aria-controls="cpp-${id}" aria-selected="${id === tab}" tabindex="${id === tab ? 0 : -1}" data-tab="${id}">${esc(name)}</button>`).join('')}</div>
${tabs.map(([id]) => `<section class="cp-panel" role="tabpanel" id="cpp-${id}" aria-labelledby="cpt-${id}"${id === tab ? '' : ' hidden'}>${id === tab ? PANEL[id](v) : ''}</section>`).join('')}`;
  };
  const showTab = (id) => {
    if (!cur) return;
    tab = id;
    hideTip();
    scroll.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    scroll.querySelectorAll('.cp-panel').forEach((p) => { const on = p.id === `cpp-${id}`; p.hidden = !on; if (on && !p.innerHTML) p.innerHTML = PANEL[id](cur); });
    const bar = scroll.querySelector('.cp-tabs'), b = bar && bar.querySelector(`[data-tab="${id}"]`);
    if (bar && b && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2);
    // (the tabs kept in sight: the panel's top brought under them when the reader had scrolled past)
    if (bar && scroll.scrollTop > bar.offsetTop) scroll.scrollTop = bar.offsetTop;
  };
  const skeleton = () => `<div class="cp-skel" aria-busy="true" aria-label="${esc(ct.loading)}"><div class="cp-head"><span class="sk sk-av"></span><div class="cp-who"><span class="sk sk-l1"></span><span class="sk sk-l2"></span><span class="sk sk-l3"></span></div></div>
<span class="sk sk-tabs"></span><div class="cp-tiles">${'<span class="sk sk-tile"></span>'.repeat(6)}</div></div>`;
  const fail = (msg, name) => { scroll.innerHTML = `<div class="cp-fail"><p>${esc(msg)}</p>${name ? `<button type="button" class="btn-gold sm" data-retry="${esc(name)}">${esc(ct.retry)}</button>` : ''}</div>`; };

  const loadCard = async (name) => {
    const my = ++seq;
    const key = name.toLowerCase(), hit = cards.get(key);
    if (hit && Date.now() - hit.got < 30_000) { cur = hit.v; drawCard(hit.v); return; }
    cur = null;
    scroll.innerHTML = skeleton();
    try {
      const r = await fetch(`${cp.api}${encodeURIComponent(name)}`, { headers: { Accept: 'application/json' } });
      if (my !== seq) return;
      if (r.status === 404 || r.status === 400) return fail(ct.gone);
      if (r.status === 429) return fail(ct.rate, name);
      if (!r.ok) throw new Error(String(r.status));
      const v = await r.json();
      if (my !== seq) return;
      cards.set(key, { v, got: Date.now() });
      cur = v;
      drawCard(v);
    } catch {
      if (my === seq) fail(ct.err, name);
    }
  };

  const focusables = () => [...dlg.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter((x) => x.offsetParent !== null);
  const isOpen = () => !box.hidden;
  const showCard = (name) => {
    if (!isOpen()) {
      lastFocus = d.activeElement;
      box.hidden = false;
      d.documentElement.classList.add('cp-lock');
      void box.offsetWidth; // (mounted first, so its rise runs)
      box.classList.add('on');
      dlg.focus({ preventScroll: true });
    }
    tab = 'overview';
    scroll.scrollTop = 0;
    void loadCard(name);
  };
  const hide = () => {
    if (!isOpen()) return;
    seq++;
    box.classList.remove('on');
    d.documentElement.classList.remove('cp-lock');
    box.hidden = true;
    hideTip();
    scroll.innerHTML = '';
    cur = null;
    if (lastFocus && lastFocus.focus && d.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  };
  /** Opens a captain's card and writes ?captain= into the address (Back closes it). */
  const openCard = (name) => {
    const u = new URL(location.href);
    if (u.searchParams.get('captain') !== name) {
      u.searchParams.set('captain', name);
      history.pushState({ cp: name }, '', u);
      pushed = true;
    }
    showCard(name);
  };
  const close = () => {
    if (pushed && history.state && history.state.cp) { pushed = false; history.back(); return; }
    const u = new URL(location.href);
    u.searchParams.delete('captain');
    history.replaceState(null, '', u);
    hide();
  };
  addEventListener('popstate', () => {
    const name = new URLSearchParams(location.search).get('captain');
    if (name) showCard(name.slice(0, 40));
    else { pushed = false; hide(); }
  });

  // ---- what opens and closes it
  d.addEventListener('click', (e) => {
    const go = e.target.closest('[data-cap]');
    if (go && !box.contains(go)) { e.preventDefault(); openCard(go.dataset.cap); }
  });
  list.addEventListener('keydown', (e) => {
    const go = e.target.closest('[data-cap]');
    if (go && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCard(go.dataset.cap); }
  });
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { close(); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) { showTab(tb.dataset.tab); return; }
    const r = e.target.closest('[data-retry]');
    if (r) { cards.delete(r.dataset.retry.toLowerCase()); void loadCard(r.dataset.retry); return; }
    const b = e.target.closest('[data-go]');
    if (b) { const board = b.dataset.go; close(); pick(board); }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (tipFor) { const f = tipFor; hideTip(); f.blur(); return; } close(); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const all = [...scroll.querySelectorAll('[data-tab]')], i = all.indexOf(tb), n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      e.preventDefault();
      showTab(n.dataset.tab);
      n.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && (d.activeElement === a || d.activeElement === dlg)) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
  });
  // a phone's sheet: pulled down by its handle (or from the top of its scroll) it closes
  const sheet = () => matchMedia('(max-width: 700px)').matches;
  let sy = null, dy = 0;
  dlg.addEventListener('touchstart', (e) => { sy = sheet() && (scroll.scrollTop <= 0 || e.target.closest('.cp-grab')) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  dlg.addEventListener('touchmove', (e) => {
    if (sy === null) return;
    dy = Math.max(0, e.touches[0].clientY - sy);
    if (dy > 4) { dlg.style.transition = 'none'; dlg.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  dlg.addEventListener('touchend', () => {
    if (sy === null) return;
    dlg.style.transition = '';
    dlg.style.transform = '';
    if (dy > 110) close();
    sy = null;
  });

  const deep = q.get('captain');
  if (deep) showCard(deep.slice(0, 40));
})();

