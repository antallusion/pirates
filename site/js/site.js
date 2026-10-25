// GRAVETIDE website: the reveal on scroll, the phone menu and the bestiary's filters. No libraries.
(() => {
  const d = document;
  // An old link into the game at the root (a reset, a verified address, a login token, Telegram's data) goes on to /play.
  if ((location.pathname === '/' || location.pathname === '/site/') && location.hash.length > 1) { location.replace('/play' + location.search + location.hash); return; }
  d.documentElement.classList.add('js');

  // Blocks rise into view as they are scrolled to (the stylesheet keeps them still under reduced motion).
  const items = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach((el) => io.observe(el));
  } else items.forEach((el) => el.classList.add('in'));

  // The home page's trailer over its poster (tools/site/trailer.mjs): never for reduced motion, Save-Data or a slow line
  // (the poster stays); the cut that fits the screen (upright phones: the tall crop; small screens: the lighter one);
  // shown once it plays, held still while off-screen or in a hidden tab.
  const film = d.querySelector('.hero-vid');
  const net = navigator.connection;
  if (film && !matchMedia('(prefers-reduced-motion: reduce)').matches && !(net && (net.saveData || /(^|-)2g$|^3g$/.test(net.effectiveType || '')))) {
    const cut = matchMedia(film.dataset.tall).matches ? 'v' : matchMedia('(max-width: 1000px)').matches ? '960' : '1280';
    for (const [ext, type] of [['webm', 'video/webm; codecs="vp9"'], ['mp4', 'video/mp4']]) {
      const s = d.createElement('source');
      s.src = `${film.dataset.film}-${cut}.${ext}`;
      s.type = type;
      film.append(s);
    }
    film.muted = true;
    film.addEventListener('playing', () => film.classList.add('on'), { once: true });
    let seen = true;
    const go = () => { if (seen && !d.hidden) film.play().catch(() => {}); else film.pause(); };
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; go(); }).observe(film);
    d.addEventListener('visibilitychange', go);
    film.load();
    go();
  }

  // «Play with VK»: on the web VK ID signs in and opens the game; inside VK's own webview the Mini App opens instead.
  if (/VKApp|VKAndroidApp|vkclient/i.test(navigator.userAgent) || /(^|[?&])vk_[a-z_]+=/.test(location.search))
    d.querySelectorAll('a[data-vk]').forEach((a) => { a.href = 'https://vk.com/app54838627'; });

  // The phone menu.
  const hdr = d.querySelector('.hdr');
  const burger = d.querySelector('.hdr-burger');
  burger?.addEventListener('click', () => {
    const open = hdr.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });

  // The features' banners: each one sticks to the top and the next slides over it; the one beneath sinks back
  // (--p: how far the next has come over it) and a banner's art settles as it rises into view (--e).
  const bnrs = [...d.querySelectorAll('.bnr')];
  if (bnrs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cards = bnrs.map((b) => b.querySelector('.bnr-card'));
    let queued = false;
    const frame = () => {
      queued = false;
      const h = innerHeight;
      bnrs.forEach((b, i) => {
        const top = b.getBoundingClientRect().top;
        const e = Math.min(1, Math.max(0, 1 - top / h));
        const next = bnrs[i + 1];
        const p = next ? Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / h)) : 0;
        cards[i].style.setProperty('--p', p.toFixed(3));
        cards[i].style.setProperty('--e', e.toFixed(3));
      });
    };
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    frame();
  }

  // The creature strips turn by themselves, a card every few seconds, back to the first after the last; a hand on
  // them (a hover, a touch, a scroll of their own) holds them a while. Swiping stays the browser's own.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const s of d.querySelectorAll('.strip[data-auto]')) {
      let holdUntil = 0;
      const hold = (ms) => { holdUntil = Date.now() + ms; };
      s.addEventListener('pointerenter', () => hold(1e9));
      s.addEventListener('pointerleave', () => hold(2500));
      s.addEventListener('touchstart', () => hold(6000), { passive: true });
      s.addEventListener('wheel', () => hold(6000), { passive: true });
      s.addEventListener('focusin', () => hold(1e9));
      s.addEventListener('focusout', () => hold(2500));
      setInterval(() => {
        if (Date.now() < holdUntil || d.hidden) return;
        const r = s.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const card = s.firstElementChild;
        const step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(s).columnGap || '0') : s.clientWidth;
        const atEnd = s.scrollLeft + s.clientWidth >= s.scrollWidth - 4;
        s.scrollTo({ left: atEnd ? 0 : s.scrollLeft + step, behavior: 'smooth' });
      }, 3200);
    }
  }

  // The bestiary: a group chip, a name and any tiers pressed.
  const grid = d.getElementById('cgrid');
  if (grid) {
    const cards = [...grid.children];
    const chips = [...d.querySelectorAll('.chip')];
    const coins = [...d.querySelectorAll('.coinbtn')];
    const input = d.querySelector('.search input');
    const empty = d.querySelector('.empty');
    let group = new URLSearchParams(location.search).get('g') || '';
    const apply = () => {
      const q = (input.value || '').trim().toLowerCase();
      const tiers = coins.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.t);
      let shown = 0;
      for (const c of cards) {
        const ok = (!group || c.dataset.group === group) && (!q || c.dataset.name.includes(q)) && (!tiers.length || tiers.includes(c.dataset.tier));
        c.hidden = !ok;
        if (ok) { shown++; c.classList.add('in'); }
      }
      empty.hidden = shown > 0;
      chips.forEach((ch) => ch.classList.toggle('on', ch.dataset.g === group));
    };
    chips.forEach((ch) => ch.addEventListener('click', () => { group = ch.dataset.g; apply(); }));
    coins.forEach((c) => c.addEventListener('click', () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); apply(); }));
    input.addEventListener('input', apply);
    if (group) apply();
  }
})();
