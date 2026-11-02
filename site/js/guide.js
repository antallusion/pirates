// «Лоцманская книга» on the website (tools/site/guide.ts): the book's search over guide/search.json, and the
// reference's filters (facet chips: OR within a facet, AND across), its search, ?q= and ?open=<detail key>, and the
// detail card's dialog. No libraries.
(() => {
  const d = document;
  const low = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const qs = new URLSearchParams(location.search);

  // The book: the articles and the reference by every word typed.
  const gq = d.getElementById('gq');
  if (gq) {
    const res = d.getElementById('gres'), none = d.getElementById('gnone');
    let ix = null, wait = null;
    const load = () => (wait ||= fetch(gq.dataset.index).then((r) => r.json()).then((j) => (ix = j)).catch(() => null));
    const run = async () => {
      const words = low(gq.value).split(/\s+/).filter(Boolean);
      if (!words.length) { res.hidden = true; none.hidden = true; return; }
      await load();
      if (!ix) return;
      const hit = (s) => words.every((w) => s.includes(w));
      const a = ix.a.filter((x) => hit(x.k)).slice(0, 20).map((x) => `<li><a href="${x.u}"><b>${esc(x.t)}</b><span>${esc(x.s)}</span><i>${esc(x.sec)}</i></a></li>`);
      const r = ix.r.filter((x) => hit(x.w)).slice(0, 30 - a.length).map((x) => `<li><a href="${x.u}"><b>${esc(x.n)}</b><span>${esc(x.d)}</span><i>${esc(x.k)}</i></a></li>`);
      res.innerHTML = a.concat(r).join('');
      res.hidden = !a.length && !r.length;
      none.hidden = !res.hidden;
    };
    gq.addEventListener('focus', load, { once: true });
    gq.addEventListener('input', run);
    if (qs.get('q')) { gq.value = qs.get('q'); run(); }
  }

  // The reference.
  const grid = d.getElementById('rgrid');
  if (grid) {
    const tiles = [...grid.children];
    const input = d.getElementById('rq'), count = d.getElementById('rcount'), none = d.getElementById('rnone');
    const chips = [...d.querySelectorAll('.rf')];
    // a phone: the kinds' row scrolls sideways — this page's kind in sight
    const nav = d.querySelector('.rnav'), on = nav && nav.querySelector('.on');
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
    const apply = () => {
      const words = low(input.value).split(/\s+/).filter(Boolean);
      const by = new Map();
      for (const c of chips) if (c.getAttribute('aria-pressed') === 'true') {
        const v = c.dataset.f, f = v.slice(0, v.indexOf(':'));
        if (!by.has(f)) by.set(f, []);
        by.get(f).push(v);
      }
      let n = 0;
      for (const t of tiles) {
        const tags = t.dataset.t.split(' '), s = t.dataset.s;
        let ok = words.every((w) => s.includes(w));
        for (const vs of by.values()) if (ok && !vs.some((v) => tags.includes(v))) ok = false;
        t.hidden = !ok;
        if (ok) n++;
      }
      count.textContent = n === tiles.length ? String(n) : `${n} / ${tiles.length}`;
      none.hidden = n > 0;
    };
    chips.forEach((c) => c.addEventListener('click', () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); apply(); }));
    input.addEventListener('input', apply);
    d.getElementById('rreset').addEventListener('click', () => { chips.forEach((c) => c.setAttribute('aria-pressed', 'false')); input.value = ''; apply(); });
    if (qs.get('q')) { input.value = qs.get('q'); apply(); }

    // The detail card: the tile's own card (written by the build) in a dialog; ✕, Esc or a tap beside it closes it.
    const dlg = d.getElementById('rdlg'), box = dlg.querySelector('.rdlg-in');
    const open = (t) => {
      const tpl = t.querySelector('template');
      if (!tpl) return false;
      box.replaceChildren(tpl.content.cloneNode(true));
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      return true;
    };
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('button.rt-in');
      if (b) open(b.parentElement);
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    const want = qs.get('open');
    if (want) {
      const t = tiles.find((x) => x.dataset.d === want);
      if (t) { t.scrollIntoView({ block: 'center' }); open(t); }
    }
  }
})();
