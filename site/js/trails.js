// GRAVETIDE website: the shop's trails as the sea shows them (owner, 2026-10-21: «следы в магазине прям покажи как
// визуально выглядят, то есть должен быть кусочек моря и какой-то рандомный корабль и как плывет»). Every
// `canvas.tr-sea[data-trail]` on the page is a patch of the game's painted sea (tex.ocean, two layers drifting, a
// moving sheen, wave glints) with a hull picked at random sailing left to right in a slow arc and looping, her trail
// behind her drawn as the game draws it: the pool of motes of client/src/render/cosdraw.ts (TrailPool) ported — the
// same emission astern, drift, rise, damping, life, the same radial mote, size curve, alpha and additive glow.
// One requestAnimationFrame for them all; only the canvases in sight are drawn (IntersectionObserver), nothing while
// the tab is hidden, at most MAX motes a sea; reduced motion: one still frame with the trail already laid.
// Loaded by site/js/shop.js on the first trail it shows; its data: the page's shop-data `sea` (tools/site/build.ts).

const MAX = 160; // motes a sea (the game's 15 a second live at most ~4 s)
const RATE = 15; // a ship's motes a second at full speed (cosdraw.ts RATE)
const DOT = 0.5; // the motes' size against the sea's (the game's own shop preview draws 0.32; a card is smaller still)

export function seaLoop(sea) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const seas = new Map(); // canvas → its state
  const imgs = new Map(); // src → { img, box }
  const dots = new Map();
  let tex = null, texPat = null, raf = 0, last = 0;

  const load = (src) => {
    let e = imgs.get(src);
    if (e) return e;
    e = { img: new Image(), box: null };
    e.img.decoding = 'async';
    e.img.onload = () => { e.box = boxOf(e.img); paintStill(); };
    e.img.src = src;
    imgs.set(src, e);
    return e;
  };
  /** The hull's own extent in her picture (the game measures it by the alpha the same way: client/src/assets.ts). */
  function boxOf(img) {
    try {
      const w = 96, h = Math.max(8, Math.round((96 * img.naturalHeight) / img.naturalWidth));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      const a = g.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) throw new Error('empty');
      return { ey: (y1 - y0 + 1) / h, cx: (x0 + x1 + 1) / 2 / w, cy: (y0 + y1 + 1) / 2 / h };
    } catch {
      return { ey: 0.9, cx: 0.5, cy: 0.5 };
    }
  }
  const dotOf = (id, t) => {
    let c = dots.get(id);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, t.c[0]);
    gr.addColorStop(0.35, t.c[1]);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    dots.set(id, c);
    return c;
  };
  if (sea.tex) {
    tex = new Image();
    tex.decoding = 'async';
    tex.onload = () => paintStill();
    tex.src = sea.tex;
  }

  const io = new IntersectionObserver((es) => {
    for (const e of es) { const s = seas.get(e.target); if (s) s.vis = e.isIntersecting; }
    kick();
  }, { rootMargin: '80px' });

  function make(c) {
    const t = sea.trails[c.dataset.trail];
    if (!t) return null;
    const hull = sea.hulls[Math.floor(Math.random() * sea.hulls.length)];
    const s = {
      c, t, id: c.dataset.trail, hull, ship: load(hull.src), vis: false, time: Math.random() * 20, still: false,
      px: new Float32Array(MAX), py: new Float32Array(MAX), vx: new Float32Array(MAX), vy: new Float32Array(MAX),
      age: new Float32Array(MAX), life: new Float32Array(MAX), size: new Float32Array(MAX), on: new Uint8Array(MAX),
      next: 0, debt: 0, x: 0, lap: 0, glints: Array.from({ length: 14 }, () => [Math.random(), Math.random(), Math.random() * 6]),
    };
    return s;
  }

  /** The canvas's CSS size and its pixels (a phone's dpr kept to 2). */
  function fit(s) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = s.c.clientWidth, h = s.c.clientHeight;
    if (!w || !h) return null;
    if (s.c.width !== Math.round(w * dpr) || s.c.height !== Math.round(h * dpr)) { s.c.width = Math.round(w * dpr); s.c.height = Math.round(h * dpr); }
    return { w, h, dpr };
  }

  /** The ship's place: across the patch left to right in a slow arc, `x` metres along her lap. */
  function shipAt(s, w, h, k) {
    const len = s.hull.len * k;
    const span = w + len * 2.2;
    const along = ((s.x * k) % span + span) % span; // px from the left edge's start
    const sx = along - len * 1.1;
    const ph = (sx / Math.max(1, w)) * Math.PI;
    const sy = h * 0.54 + Math.sin(ph + s.lap) * h * 0.1;
    const dy = Math.cos(ph + s.lap) * h * 0.1 * (Math.PI / Math.max(1, w));
    return { sx, sy, head: Math.PI / 2 + Math.atan(dy), len };
  }

  function step(s, w, h, dt) {
    const k = scale(s, w, h);
    const sp = s.hull.v * 1.35; // m/s across the patch (a preview's pace: the game's preview runs 0.8 of top speed)
    const prev = shipAt(s, w, h, k);
    // out of sight past an edge: the lap's dead stretch run fast, so the patch is never long without her
    const out = prev.sx < -prev.len * 0.45 || prev.sx > w + prev.len * 0.45;
    s.x += sp * dt * (out ? 6 : 1);
    s.time += dt;
    const at = shipAt(s, w, h, k);
    if (at.sx < prev.sx) s.lap = Math.random() * Math.PI * 2; // a new lap: a new arc
    // the game's emission (cosdraw.ts TrailPool.emit), in the patch's own metres
    const t = s.t;
    let d = s.debt + RATE * Math.min(1.2, 0.35 + 0.85) * dt;
    const bx = -Math.sin(at.head), by = Math.cos(at.head);
    const X = at.sx / k, Y = at.sy / k, L = s.hull.len, B = s.hull.beam;
    while (d >= 1) {
      d -= 1;
      const i = s.next;
      s.next = (s.next + 1) % MAX;
      const side = (Math.random() - 0.5) * B * 0.7;
      const back = L * (0.42 + Math.random() * 0.1);
      s.px[i] = X + bx * back + by * side;
      s.py[i] = Y + by * back - bx * side;
      const drift = 2 + Math.random() * 3;
      s.vx[i] = bx * drift + (Math.random() - 0.5) * 3;
      s.vy[i] = by * drift + (Math.random() - 0.5) * 3 - t.rise * 4;
      s.age[i] = 0;
      s.life[i] = t.life * (0.7 + Math.random() * 0.6);
      s.size[i] = t.size * (0.7 + Math.random() * 0.6);
      s.on[i] = 1;
    }
    s.debt = d;
    for (let i = 0; i < MAX; i++) {
      if (!s.on[i]) continue;
      s.age[i] += dt;
      if (s.age[i] >= s.life[i]) { s.on[i] = 0; continue; }
      s.px[i] += s.vx[i] * dt;
      s.py[i] += s.vy[i] * dt;
      s.vx[i] *= 0.97;
      s.vy[i] *= 0.97;
    }
  }
  /** px a metre: the hull a good share of the patch, as the game's preview sizes her. */
  const scale = (s, w, h) => Math.min(w * 0.4, h * 1.2) / s.hull.len;

  function paint(s) {
    const f = fit(s);
    if (!f) return;
    const { w, h, dpr } = f;
    const g = s.c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const k = scale(s, w, h);
    // the sea: the game's 2D sea (renderer.ts) — a deep tint, the painted texture twice, drifting, a moving sheen
    g.fillStyle = '#103542';
    g.fillRect(0, 0, w, h);
    if (tex && tex.complete && tex.naturalWidth) {
      texPat ??= g.createPattern(tex, 'repeat');
      if (texPat) {
        const tk = (240 * k) / tex.naturalWidth;
        const drift = s.time * 1.6 * k;
        for (const [a, sc, dx, dy] of [[0.55, 1, -drift * 0.4, drift * 0.2], [0.22, 0.63, drift * 0.3 + 90, -drift * 0.25 + 40]]) {
          texPat.setTransform(new DOMMatrix().translate(dx, dy).scale(tk * sc));
          g.globalAlpha = a;
          g.fillStyle = texPat;
          g.fillRect(0, 0, w, h);
        }
        g.globalAlpha = 1;
      }
    }
    const sh = (Math.sin(s.time * 0.25) + 1) / 2;
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(Math.max(0, sh - 0.3), 'rgba(120,170,190,0)');
    grd.addColorStop(sh, 'rgba(120,170,190,0.09)');
    grd.addColorStop(Math.min(1, sh + 0.3), 'rgba(120,170,190,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // gentle swells: faint crests drifting, and glints of light that come and go
    g.strokeStyle = 'rgba(170,215,225,0.07)';
    g.lineWidth = 1;
    for (let r = 0; r < 5; r++) {
      const y0 = ((r + 0.5) / 5) * h;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x * 0.045 + s.time * 0.9 + r * 1.7) * 2.4;
        if (x) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    for (const gl of s.glints) {
      const a = Math.max(0, Math.sin(s.time * 1.3 + gl[2]));
      if (a < 0.05) continue;
      const x = ((gl[0] * w - s.time * 6) % w + w) % w, y = gl[1] * h;
      g.globalAlpha = a * 0.5;
      g.fillStyle = '#cfeef2';
      g.fillRect(x - 3 * a, y, 6 * a, 1);
      g.fillRect(x - 0.5, y - 1.5 * a, 1, 3 * a);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // the trail (cosdraw.ts TrailPool.draw): the same mote, size curve and alpha
    const t = s.t;
    g.globalCompositeOperation = t.glow ? 'lighter' : 'source-over';
    const dot = dotOf(s.id, t);
    for (let i = 0; i < MAX; i++) {
      if (!s.on[i]) continue;
      const a = s.age[i] / s.life[i];
      const r = Math.max(2.4, s.size[i] * k * 1.4 * DOT) * (s.id === 'mist' || s.id === 'ink' ? 0.7 + a * 1.4 : s.id === 'fire' ? 1.15 - a * 0.6 : 1);
      const px = s.px[i] * k, py = s.py[i] * k;
      if (px < -r || py < -r || px > w + r || py > h + r) continue;
      g.globalAlpha = (1 - a) * (a < 0.12 ? a / 0.12 : 1) * (t.glow ? 0.85 : 0.55) * 0.95;
      g.drawImage(dot, px - r, py - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // the ship, top-down as at sea, bow along her way
    const at = shipAt(s, w, h, k);
    const sp = s.ship;
    if (sp.box) {
      const ih = at.len / sp.box.ey;
      const iw = ih * (sp.img.naturalWidth / Math.max(1, sp.img.naturalHeight));
      g.save();
      g.translate(at.sx, at.sy);
      g.rotate(at.head);
      g.fillStyle = 'rgba(0,10,16,0.35)';
      g.beginPath();
      g.ellipse(2, 3, (s.hull.beam * k) * 0.55, at.len * 0.48, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(sp.img, -iw * sp.box.cx, -ih * sp.box.cy, iw, ih);
      g.restore();
    }
    // a vignette: the patch's edges into the card's dark
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(4,8,14,0)');
    v.addColorStop(1, 'rgba(4,8,14,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }

  /** A card opens on a ship under way, part across, her trail already behind her (two seconds run at once). */
  function warm(s, w, h) {
    const k = scale(s, w, h);
    s.x = ((0.3 + Math.random() * 0.3) * (w + s.hull.len * k * 2.2)) / k;
    s.lap = Math.random() * Math.PI * 2;
    for (let i = 0; i < 40; i++) step(s, w, h, 0.05);
    s.warm = true;
  }

  /** Reduced motion: one frame with the trail already laid (a few seconds of her way run at once). */
  function still(s) {
    const f = fit(s);
    if (!f) return;
    if (!s.still) {
      s.x = 0;
      s.lap = 0.6;
      const k = scale(s, f.w, f.h);
      const want = (f.w * 0.62 + s.hull.len * k * 1.1) / k;
      while (s.x < want) step(s, f.w, f.h, 1 / 20);
      s.still = true;
    }
    paint(s);
  }
  function paintStill() {
    if (!reduced.matches) return;
    for (const s of seas.values()) if (s.c.isConnected) { s.still = false; still(s); }
  }

  function frame(now) {
    raf = 0;
    if (document.hidden || reduced.matches) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    let any = false;
    for (const s of seas.values()) {
      if (!s.vis || !s.c.isConnected) continue;
      const f = fit(s);
      if (!f) continue;
      if (!s.warm) warm(s, f.w, f.h);
      step(s, f.w, f.h, dt);
      paint(s);
      any = true;
    }
    if (any) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (reduced.matches) { paintStill(); return; }
    if (!raf && !document.hidden && [...seas.values()].some((s) => s.vis)) { last = 0; raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', kick);
  reduced.addEventListener?.('change', () => { for (const s of seas.values()) s.still = false; kick(); });
  addEventListener('resize', () => { if (reduced.matches) paintStill(); });

  return {
    /** Takes up the page's new seas and lets go of the gone (after every redraw of the grid or the window). */
    scan() {
      for (const [c] of seas) if (!c.isConnected) { io.unobserve(c); seas.delete(c); }
      document.querySelectorAll('canvas.tr-sea[data-trail]').forEach((c) => {
        if (seas.has(c)) return;
        const s = make(c);
        if (!s) return;
        seas.set(c, s);
        io.observe(c);
        if (reduced.matches) still(s);
      });
      kick();
    },
  };
}
