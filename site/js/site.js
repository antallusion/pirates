// GRAVETIDE website: the reveal on scroll, the phone menu and the bestiary's filters. No libraries.
(() => {
  const d = document;
  d.documentElement.classList.add('js');

  // Blocks rise into view as they are scrolled to (the stylesheet keeps them still under reduced motion).
  const items = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach((el) => io.observe(el));
  } else items.forEach((el) => el.classList.add('in'));

  // The phone menu.
  const hdr = d.querySelector('.hdr');
  const burger = d.querySelector('.hdr-burger');
  burger?.addEventListener('click', () => {
    const open = hdr.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });

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
