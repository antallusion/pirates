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
    if (b !== 'level') return `<i>${esc(t.lvl)} ${r.level}</i>`;
    return '';
  };
  const rowHtml = (b, r) => `<li class="rt-row${r.rank <= 3 ? ` top top${r.rank}` : ''}"><span class="rt-rank">${r.rank}</span>${face(r.captain, r.frame, 60)}
<span class="rt-who"><b class="rt-name">${esc(r.name)}${r.guild ? ` <span class="rt-tag">[${esc(r.guild)}]</span>` : ''}</b>${plate(r.title, r.plate)}<span class="rt-cap">${esc(cos.names[r.captain] || '')}</span></span>
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
    empty.textContent = t.empty;
    atEl.textContent = v.at ? `${t.at}: ${new Date(v.at).toLocaleTimeString(data.lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';
  };
  const load = async (b) => {
    const hit = cache.get(b);
    if (hit && Date.now() - hit.got < 60_000) return show(b, hit.v);
    root.querySelector('.rt-board').setAttribute('aria-busy', 'true');
    try {
      const r = await fetch(`${data.api}?board=${encodeURIComponent(b)}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(String(r.status));
      const v = await r.json();
      cache.set(b, { v, got: Date.now() });
      if (board() === b) show(b, v);
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
    history.replaceState(null, '', u);
    void load(b);
  };
  tabs.forEach((x) => x.addEventListener('click', () => pick(x.dataset.board)));

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
<p class="muted">${esc(cos.names[c.captain] || '')} · ${esc(t.lvl)} ${c.level}</p></div><button type="button" class="rt-x" aria-label="${esc(t.close)}">×</button>
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
})();
