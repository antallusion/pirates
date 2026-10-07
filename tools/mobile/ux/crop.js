// The crop check (owner, 2026-10-07: «иконки обрезаются… аватарки обрезаются у всех»): every picture shown in a round
// frame — a HUD button, a menu tile, the captain's portrait, a battle face, a pin, a card's medallion — is measured
// against the frame's inner circle, the part of the circle a painted ring (a ::before/::after over it) leaves open.
//   window.__crop()  → { checked, fails: [{ el, kind, why, … }], list }
// For each picture: its own image is read (a same-origin asset, 48×48 samples of its alpha), mapped onto the screen as
// the browser paints it (object-fit / object-position, background-size / -position), clipped by its own rounded box
// and by a frame that clips; then
//   «crop»   more than 2.5 % of the art's opaque pixels lie outside the inner circle (cut by the frame or covered by
//            its ring) — a sprite on a clear ground and a painted scene alike;
//   «badge»  a badge of the same control (a count, a level, a shot's number: small, absolutely placed, with words or
//            a ground) lies over more than 2 % of the art seen in the circle;
//   face crops (data-crop="face": a captain's head and shoulders cut from a whole-figure painting on purpose) are not
//   held to the first rule: their ring must leave the whole picture open (no ring over the face) and no badge may
//   touch the middle of the face (0.55 of the radius).
// The pictures checked are listed too (`list`), so a run shows what it looked at.
(() => {
  const N = 48;
  const imgs = new Map();
  const loadArt = (url, n = N) => {
    const k = `${n}|${url}`;
    if (!imgs.has(k)) imgs.set(k, new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = n;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(im, 0, 0, n, n);
          const d = g.getImageData(0, 0, n, n).data;
          const a = new Uint8Array(n * n);
          let op = 0;
          for (let i = 0; i < n * n; i++) { a[i] = d[i * 4 + 3]; if (a[i] > 200) op++; }
          res({ w: im.naturalWidth, h: im.naturalHeight, a, n, op: op / (n * n) });
        } catch { res(null); }
      };
      im.onerror = () => res(null);
      im.src = url;
    }));
    return imgs.get(k);
  };
  /** The share of a ring picture's half-size that its clear middle opens (the 10th percentile of 72 rays). */
  const holes = new Map();
  const ringHole = async (url) => {
    if (holes.has(url)) return holes.get(url);
    const art = await loadArt(url, 128);
    let f = 1;
    if (art) {
      const n = art.n, rs = [];
      for (let k = 0; k < 72; k++) {
        const t = (k * Math.PI * 2) / 72;
        let r = 0;
        for (; r < n / 2; r += 0.5) {
          const x = Math.floor(n / 2 + Math.cos(t) * r), y = Math.floor(n / 2 + Math.sin(t) * r);
          if (art.a[y * n + x] > 128) break;
        }
        rs.push(r / (n / 2));
      }
      rs.sort((p, q) => p - q);
      f = rs[7];
    }
    holes.set(url, f);
    return f;
  };
  const urlOf = (bg) => { const m = /url\(["']?([^"')]+)["']?\)/.exec(bg || ''); return m ? m[1] : null; };
  const shown = (e) => {
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    return true;
  };
  const px = (v, ref) => (/%$/.test(v) ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0);
  const radiusOf = (e, r) => { const v = getComputedStyle(e).borderTopLeftRadius.split(' ')[0]; return Math.min(px(v, Math.min(r.width, r.height)), Math.min(r.width, r.height) / 2); };
  const round = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) return false;
    const ratio = r.width / r.height;
    return ratio > 0.85 && ratio < 1.18 && radiusOf(e, r) >= Math.min(r.width, r.height) * 0.4;
  };
  const inRound = (x, y, r, rad) => {
    // a point inside a rounded rectangle
    const cx = Math.min(Math.max(x, r.left + rad), r.right - rad), cy = Math.min(Math.max(y, r.top + rad), r.bottom - rad);
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && Math.hypot(x - cx, y - cy) <= rad + 0.01;
  };
  const name = (e) => {
    const bits = [];
    for (let q = e, i = 0; q && i < 3 && q !== document.body; q = q.parentElement, i++) bits.unshift(q.id ? `#${q.id}` : `${q.tagName.toLowerCase()}${typeof q.className === 'string' && q.className ? '.' + q.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`);
    return bits.join(' > ');
  };
  /** Where the browser paints a picture: [left, top, width, height] of the whole image, and the box it is clipped to. */
  const placeImg = (e, art) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const bl = parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), bt = parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
    const br = parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight), bb = parseFloat(cs.borderBottomWidth) + parseFloat(cs.paddingBottom);
    const x = r.left + bl, y = r.top + bt, w = r.width - bl - br, h = r.height - bt - bb;
    const fit = cs.objectFit;
    let sx = w / art.w, sy = h / art.h;
    if (fit === 'contain' || fit === 'scale-down') sx = sy = Math.min(w / art.w, h / art.h) * (fit === 'scale-down' ? Math.min(1, 1 / Math.min(w / art.w, h / art.h)) : 1);
    else if (fit === 'cover') sx = sy = Math.max(w / art.w, h / art.h);
    else if (fit === 'none') sx = sy = 1;
    const iw = art.w * sx, ih = art.h * sy;
    const [px0, py0] = (cs.objectPosition || '50% 50%').split(' ');
    const ox = /%$/.test(px0) ? (parseFloat(px0) / 100) * (w - iw) : parseFloat(px0) || 0;
    const oy = /%$/.test(py0 ?? '50%') ? (parseFloat(py0 ?? '50%') / 100) * (h - ih) : parseFloat(py0) || 0;
    return { img: [x + ox, y + oy, iw, ih], clip: new DOMRect(x, y, w, h) };
  };
  const placeBg = (e, art) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const bl = parseFloat(cs.borderLeftWidth), bt = parseFloat(cs.borderTopWidth);
    const x = r.left + bl, y = r.top + bt, w = r.width - bl - parseFloat(cs.borderRightWidth), h = r.height - bt - parseFloat(cs.borderBottomWidth);
    const size = cs.backgroundSize.split(',')[0].trim();
    let iw = art.w, ih = art.h;
    if (size === 'cover' || size === 'contain') {
      const s = size === 'cover' ? Math.max(w / art.w, h / art.h) : Math.min(w / art.w, h / art.h);
      iw = art.w * s; ih = art.h * s;
    } else {
      const [a, b = 'auto'] = size.split(' ');
      iw = a === 'auto' ? null : px(a, w);
      ih = b === 'auto' ? null : px(b, h);
      if (iw === null && ih === null) { iw = art.w; ih = art.h; }
      else if (iw === null) iw = (ih * art.w) / art.h;
      else if (ih === null) ih = (iw * art.h) / art.w;
    }
    const [p0, p1 = '50%'] = cs.backgroundPosition.split(',')[0].trim().split(' ');
    const ox = /%$/.test(p0) ? (parseFloat(p0) / 100) * (w - iw) : parseFloat(p0) || 0;
    const oy = /%$/.test(p1) ? (parseFloat(p1) / 100) * (h - ih) : parseFloat(p1) || 0;
    return { img: [x + ox, y + oy, iw, ih], clip: new DOMRect(x, y, w, h) };
  };
  /** The control a picture belongs to (its badges are found in it). */
  const CONTROL = 'button, a, [role=button], [role=tab], .tb-q, .tb-turnb, .uf-portrait, .cs-face, .k-tile, .tb-face, .k-wheel-item, .tc-big, .slot';

  window.__crop = async () => {
    const out = [], list = [];
    const W = innerWidth, H = innerHeight;
    const cands = [];
    // What lies on top covers the rest: the hex battle covers the sea, a window or a sheet the screen under it.
    const sheet = [...document.querySelectorAll('.k-sheet-root.k-open')].pop();
    const modal = document.querySelector('#modal:not(.hidden) #modal-panel');
    const top = sheet ?? (document.body.classList.contains('tac') ? document.getElementById('board-tac') : null) ?? modal ?? document.body;
    for (const e of top.querySelectorAll('*')) {
      if (e.id === 'world' || e.tagName === 'CANVAS' || e.tagName === 'VIDEO') continue;
      const r = e.getBoundingClientRect();
      if (r.width < 10 || r.height < 10 || r.width > 320 || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) continue;
      let url = null, how = null;
      if (e.tagName === 'IMG' && e.currentSrc) { url = e.currentSrc; how = 'img'; }
      else {
        const bg = getComputedStyle(e).backgroundImage;
        const u = urlOf(bg);
        if (u && !/gradient\(/.test(bg.split('url(')[0])) { url = u; how = 'bg'; }
      }
      if (!url || !shown(e)) continue;
      // its round frame: itself or one of three ancestors
      let f = null;
      for (let q = e, i = 0; q && i < 4; q = q.parentElement, i++) if (round(q)) { f = q; break; }
      if (!f) continue;
      // a frame much larger than the picture is not its frame (a panel round a chip)
      const fr = f.getBoundingClientRect();
      if (fr.width > r.width * 2.6 && f !== e) continue;
      cands.push({ e, f, url, how });
    }
    for (const { e, f, url, how } of cands) {
      const art = await loadArt(url);
      if (!art) continue;
      const fr = f.getBoundingClientRect(), fcs = getComputedStyle(f);
      const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
      let R = Math.min(fr.width, fr.height) / 2 - parseFloat(fcs.borderTopWidth || '0');
      // painted rings over it (a ::before/::after with a picture, the frame's or the picture's own)
      let ringR = Infinity;
      for (const host of new Set([f, e, e.parentElement])) {
        if (!host) continue;
        const hr = host.getBoundingClientRect();
        for (const pseudo of ['::before', '::after']) {
          const ps = getComputedStyle(host, pseudo);
          if (!ps.content || ps.content === 'none' || ps.display === 'none') continue;
          const ru = urlOf(ps.backgroundImage);
          if (!ru) continue;
          const t = px(ps.top, hr.height), l = px(ps.left, hr.width), rr = px(ps.right, hr.width), b = px(ps.bottom, hr.height);
          const box = { w: hr.width - l - rr, h: hr.height - t - b, cx: hr.left + l + (hr.width - l - rr) / 2, cy: hr.top + t + (hr.height - t - b) / 2 };
          if (box.w < 8 || Math.hypot(box.cx - cx, box.cy - cy) > fr.width * 0.15) continue;
          const hole = await ringHole(ru);
          if (hole < 0.05) continue; // a solid disc under the art (a dial), not a ring over it
          ringR = Math.min(ringR, (hole * Math.min(box.w, box.h)) / 2);
        }
      }
      const er = e.getBoundingClientRect();
      const place = how === 'img' ? placeImg(e, art) : placeBg(e, art);
      const ownRad = radiusOf(e, er);
      const fClips = fcs.overflow !== 'visible' || f === e;
      const fRad = radiusOf(f, fr);
      const face = !!(e.closest('[data-crop="face"]') || f.closest('[data-crop="face"]'));
      const [ix, iy, iw, ih] = place.img;
      // samples of the art: seen at all (inside its own box and the frame's clip), and inside the open circle
      let opq = 0, seen = 0, fits = 0;
      const pts = [];
      for (let j = 0; j < art.n; j++) for (let i = 0; i < art.n; i++) {
        if (art.a[j * art.n + i] <= 64) continue;
        opq++;
        const x = ix + ((i + 0.5) / art.n) * iw, y = iy + ((j + 0.5) / art.n) * ih;
        const vis = inRound(x, y, place.clip, Math.max(0, ownRad - (er.width - place.clip.width) / 2)) && inRound(x, y, er, ownRad) && (!fClips || inRound(x, y, fr, fRad));
        if (!vis) continue;
        seen++;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= Math.min(R, ringR) + 0.75) { fits++; pts.push([x, y, d]); }
      }
      if (!opq) continue;
      const kind = face ? 'face' : art.op >= 0.9 ? 'scene' : 'sprite';
      const open = Math.min(R, ringR);
      const entry = { el: name(e), kind, frame: Math.round(fr.width), open: +(open * 2).toFixed(1), loss: +(100 * (1 - fits / opq)).toFixed(1) };
      list.push(entry);
      if (face) {
        // the painted ring must not lie over the picture's own circle
        const own = Math.min(er.width, er.height) / 2;
        if (ringR < Infinity && ringR + 0.75 < Math.min(own, R)) out.push({ ...entry, why: `ring over the face (open ${(ringR * 2).toFixed(0)} px of ${(Math.min(own, R) * 2).toFixed(0)})` });
        // the head (data-face="x y r": its middle as shares of the picture's width and height, its radius of the width) whole in the open circle
        const fc = ((e.closest('[data-face]') ?? f.closest('[data-face]'))?.dataset.face ?? '').split(' ').map(Number);
        if (fc.length === 3 && fc.every((v) => Number.isFinite(v))) {
          const hx = ix + fc[0] * iw, hy = iy + fc[1] * ih, hr = fc[2] * iw;
          const d = Math.hypot(hx - cx, hy - cy) + hr;
          entry.head = +(d / open).toFixed(2);
          if (d > open + 0.75) out.push({ ...entry, why: `the head outside the circle (${Math.round(d)} px of ${Math.round(open)})` });
        }
      } else if (fits / opq < 0.975) out.push({ ...entry, why: `crop ${entry.loss}% of the art outside the inner circle` });
      // badges of the same control over the art
      const ctl = e.closest(CONTROL) ?? f.closest(CONTROL) ?? f.parentElement;
      if (!ctl) continue;
      for (const b of ctl.querySelectorAll('*')) {
        if (b === e || b === f || b.contains(e) || e.contains(b) || !shown(b)) continue;
        const bcs = getComputedStyle(b);
        if (bcs.position !== 'absolute' && bcs.position !== 'fixed') continue;
        const br = b.getBoundingClientRect();
        if (br.width < 4 || br.height < 4 || br.width > fr.width * 0.75 || br.height > fr.height * 0.75) continue;
        const words = (b.innerText || '').trim();
        const ground = bcs.backgroundColor !== 'rgba(0, 0, 0, 0)' || bcs.backgroundImage !== 'none';
        if (!words && !ground) continue;
        if (b.tagName === 'IMG' || (bcs.backgroundImage !== 'none' && !words && urlOf(bcs.backgroundImage))) continue; // another picture, judged on its own
        const under = pts.filter(([x, y]) => x >= br.left && x <= br.right && y >= br.top && y <= br.bottom);
        if (face) {
          const near = Math.hypot(Math.max(br.left - cx, 0, cx - br.right), Math.max(br.top - cy, 0, cy - br.bottom));
          if (near < open * 0.55) out.push({ ...entry, why: `badge «${words.slice(0, 8)}» over the face (${Math.round(near)} px from its middle)` });
        } else if (pts.length && under.length / pts.length > 0.02) out.push({ ...entry, why: `badge «${words.slice(0, 8)}» over ${(100 * under.length / pts.length).toFixed(1)}% of the art` });
      }
    }
    return { checked: list.length, fails: out, list };
  };
  return 'crop ready';
})();
