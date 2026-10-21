// In the page (owner, 2026-10-19: «Иконка "к кораблю" не отцентрована по вертикали» — measured by its box it was within a
// hundredth of a pixel, and still sat low): a round button's picture as the eye sees it in its ring — the picture's
// own ink (its alpha-weighted middle, the image's pixels read, laid by object-fit: contain) against the middle of the
// ring's painted hole (the ring art's pixels read along its two middle lines, laid as the ring is drawn: the ::after's
// box, background contain). RING_SEL by default «К кораблю»; RING_ALL=1 every .sea-round (reported, the rule the same).
export async function RING({ tol, all }) {
  // (the round buttons whose pictures are held to the ring's hole, not to the box: seahud.css, 2026-10-19)
  // («В море», #tc-cast: its sail and its word together, owner 2026-10-21: «отцентруй по вертикали иконку и текст „В море“»)
  const RING_HELD = '#tc-home, #tc-isle, #tc-menu, #tc-daily, #tc-special, #tc-lock, #tc-ammo, #tc-offer, #tc-cast, #tc-fire';
  const SEL = all ? 'body.simple .sea-round, body.simple #touch > .tc-big' : RING_HELD;
  const px = async (url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  };
  const list = [], bad = [];
  let n = 0;
  for (const e of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || e.classList.contains('hidden')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    const ico = e.querySelector('img.k-btn-ico, img.tc-big-ico');
    const ring = getComputedStyle(e, '::after');
    const m = /url\("?([^")]+)"?\)/.exec(ring.backgroundImage);
    if (!ico || !m) continue;
    // the ring's hole: along its vertical and horizontal middle lines, the first clear pixel inside the art each way
    const R = await px(m[1]);
    const a = (x, y) => R.d[(y * R.w + x) * 4 + 3];
    const mx = R.w >> 1, my = R.h >> 1;
    let t = 0; while (t < R.h && a(mx, t) <= 128) t++; while (t < R.h && a(mx, t) > 128) t++;
    let b = R.h - 1; while (b > 0 && a(mx, b) <= 128) b--; while (b > 0 && a(mx, b) > 128) b--;
    let l = 0; while (l < R.w && a(l, my) <= 128) l++; while (l < R.w && a(l, my) > 128) l++;
    let rr = R.w - 1; while (rr > 0 && a(rr, my) <= 128) rr--; while (rr > 0 && a(rr, my) > 128) rr--;
    // the ::after's own box (its inset on the button) and the art contained in it
    const bw = parseFloat(ring.width) || r.width, bh = parseFloat(ring.height) || r.height;
    const bl = r.left + (parseFloat(ring.left) || 0), bt = r.top + (parseFloat(ring.top) || 0);
    const k = Math.min(bw / R.w, bh / R.h);
    const ox = bl + (bw - R.w * k) / 2, oy = bt + (bh - R.h * k) / 2;
    const hole = { x: ox + ((l + rr + 1) / 2) * k, y: oy + ((t + b + 1) / 2) * k };
    // the picture's ink: alpha-weighted middle
    const I = await px(ico.currentSrc || ico.src);
    let sw = 0, sx = 0, sy = 0;
    for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) { const w = I.d[(y * I.w + x) * 4 + 3] / 255; if (w > 0.1) { sw += w; sx += w * (x + 0.5); sy += w * (y + 0.5); } }
    if (!sw) continue;
    const ir = ico.getBoundingClientRect();
    const ki = Math.min(ir.width / I.w, ir.height / I.h);
    let ix = ir.left + (ir.width - I.w * ki) / 2 + (sx / sw) * ki, iy = ir.top + (ir.height - I.h * ki) / 2 + (sy / sw) * ki;
    // a picture with its word under it (the big round «В море», «Огонь»): the two together as the eye sees them — the
    // picture's ink box and the word's ink (its capitals, measured on a canvas on the word's own baseline) — their middle
    const lab = e.querySelector('.tc-big-l');
    if (lab && getComputedStyle(lab).display !== 'none' && lab.textContent.trim()) {
      let x0 = I.w, y0 = I.h, x1 = -1, y1 = -1;
      for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) if (I.d[(y * I.w + x) * 4 + 3] > 26) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const pl = ir.left + (ir.width - I.w * ki) / 2, pt = ir.top + (ir.height - I.h * ki) / 2;
      const ls = getComputedStyle(lab);
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      lab.appendChild(probe);
      const base = probe.getBoundingClientRect().bottom;
      probe.remove();
      const g = document.createElement('canvas').getContext('2d');
      g.font = `${ls.fontStyle} ${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`;
      if (ls.letterSpacing !== 'normal') g.letterSpacing = ls.letterSpacing; // (its ink, not the spacing after its last letter)
      const word = ls.textTransform === 'uppercase' ? lab.textContent.trim().toUpperCase() : lab.textContent.trim();
      const mt = g.measureText(word);
      const lr = lab.getBoundingClientRect();
      const top = Math.min(pt + y0 * ki, base - mt.actualBoundingBoxAscent), bot = Math.max(pt + (y1 + 1) * ki, base + mt.actualBoundingBoxDescent);
      const lft = Math.min(pl + x0 * ki, lr.left - mt.actualBoundingBoxLeft), rgt = Math.max(pl + (x1 + 1) * ki, lr.left + mt.actualBoundingBoxRight);
      iy = (top + bot) / 2;
      ix = (lft + rgt) / 2;
    }
    n++;
    const dy = iy - hole.y, dx = ix - hole.x;
    const line = `ring ${e.id ? '#' + e.id : e.className.split(' ').slice(0, 2).join('.')} ${Math.round(r.width)}×${Math.round(r.height)} dy ${dy.toFixed(1)} dx ${dx.toFixed(1)} (the picture's ink against the ring's hole)`;
    list.push(line);
    if (Math.abs(dy) > tol || Math.abs(dx) > tol) bad.push(line);
  }
  return { n, bad, list };
}
