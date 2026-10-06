// docs/23 phase 0, item 3 (and phase 9's «after»): what a screen is made of, measured in the page.
//   __targets() — every tap target a finger can reach now: the controls (button, link, field, tab, [role=button],
//                 a [tabindex]) and every region that takes a tap without being one (cursor: pointer at its root,
//                 an onclick); counted once, only on screen and not covered. Also how many are under 44 px.
//   __sea()     — the share of the screen where the sea (the world's canvas) is seen: a 64×30 grid of points, a point
//                 is covered when any painted element of the interface lies over it (a background, a border, a
//                 picture, a canvas other than the world, text).
// Load: await (0,eval)(await (await fetch('/assets/raw/audit/m0/measure.js?'+Date.now())).text())
(() => {
  const WORLD = new Set(['world', 'world-sea', 'world-sky']);
  const shown = (e) => {
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    return true;
  };
  const SEM = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=menuitem], [role=slider], [role=checkbox], [role=switch], [tabindex]:not([tabindex="-1"]), canvas#minimap';
  const onScreen = (r) => r.width >= 4 && r.height >= 4 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  const reachable = (e, r) => {
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const t = document.elementFromPoint(x, y);
    return !!t && (t === e || e.contains(t) || t.contains(e));
  };
  window.__targets = () => {
    const out = [];
    const seen = new Set();
    const add = (e, why) => {
      if (seen.has(e) || WORLD.has(e.id)) return;
      if (e.disabled) return;
      const r = e.getBoundingClientRect();
      if (!onScreen(r) || !shown(e) || !reachable(e, r)) return;
      seen.add(e);
      out.push({ e, why, w: Math.round(r.width), h: Math.round(r.height), name: (e.id ? '#' + e.id : (e.className?.baseVal ?? e.className ?? e.tagName).toString().split(' ')[0]) + (e.innerText ? ' ' + e.innerText.trim().replace(/\s+/g, ' ').slice(0, 18) : '') });
    };
    const sem = [...document.querySelectorAll(SEM)];
    for (const e of sem) add(e, 'control');
    // Tap regions that are not controls: the root of a pointer cursor (the cursor is inherited), or an onclick.
    for (const e of document.body.querySelectorAll('*')) {
      if (seen.has(e) || WORLD.has(e.id)) continue;
      const own = typeof e.onclick === 'function' || typeof e.onpointerdown === 'function' || typeof e.ontouchstart === 'function';
      const cur = getComputedStyle(e).cursor === 'pointer' && getComputedStyle(e.parentElement ?? document.body).cursor !== 'pointer';
      if (!own && !cur) continue;
      if (e.closest(SEM) || e.querySelector(SEM)) continue; // inside a control, or a frame round controls
      add(e, own ? 'onclick' : 'pointer');
    }
    // The helm stick and other pointer-driven pads (they listen with addEventListener).
    for (const id of ['tc-stick', 'tc-sail']) { const e = document.getElementById(id); if (e && !seen.has(e) && !e.querySelector(SEM)) add(e, 'pad'); }
    const small = out.filter((t) => Math.min(t.w, t.h) < 44);
    return { n: out.length, small: small.length, list: out.map((t) => `${t.name} ${t.w}×${t.h}`), smallList: small.map((t) => `${t.name} ${t.w}×${t.h}`) };
  };
  window.__sea = (cols = 64, rows = 30) => {
    const rects = [];
    for (const e of document.body.querySelectorAll('*')) {
      if (WORLD.has(e.id) || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
      const r = e.getBoundingClientRect();
      if (!onScreen(r)) continue;
      const c = getComputedStyle(e);
      const bg = c.backgroundColor.match(/[\d.]+/g);
      const painted = (bg && (bg.length < 4 || +bg[3] > 0.1)) && c.backgroundColor !== 'rgba(0, 0, 0, 0)'
        || c.backgroundImage !== 'none' || /^(IMG|CANVAS|SVG|VIDEO|svg)$/.test(e.tagName)
        || parseFloat(c.borderTopWidth) + parseFloat(c.borderLeftWidth) > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(c.borderTopColor)
        || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!painted || !shown(e)) continue;
      rects.push(r);
    }
    let covered = 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = (i + 0.5) * innerWidth / cols, y = (j + 0.5) * innerHeight / rows;
      if (rects.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) covered++;
    }
    return +(100 * (1 - covered / (cols * rows))).toFixed(1);
  };
  return 'measure ready';
})();
