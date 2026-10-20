// The VK QA's measurements in the page (tools/vk/qa.mjs injects this; docs/36_VK.md). window.__vkMeasure({root, shop})
// answers, for what is on screen now (every list of the selectors' short names, with the numbers):
//   offscreen — a visible piece (after its clipping ancestors) past the viewport's edge;
//   cut       — a text or a button cut by an ancestor that hides overflow and does not scroll that way (unreachable);
//   outside   — a text or a button whose right or bottom edge passes its frame's inner edge (a parent with a border or
//               a background, overflow visible): it spills out of its plate;
//   text      — a button's text wider than the button's inner width (its width less border and padding), or out of it;
//   overlap   — absolutely / fixed positioned pieces (badges, plates, ribbons) lying on each other or on a text;
//   scroll    — the page scrolls (it must never), a window's panel scrolls as a whole, or a block scrolls sideways;
//   ellipsis  — a text cut with «…» (text-overflow: ellipsis that cuts), and in the shop any line-clamp or ellipsis rule
//               on the goods' texts at all;
//   links     — <a href> that leads off the game's page (another origin, or another path of ours), visible ones.
(() => {
  const SKIP = '#world, #boot, #boot-log, #pad-cursor, #atk-mark, script, style, link, meta, br, wbr';
  const BTN = 'button, a.btn, [role="button"], .btn, .k-btn, .sh-off, .w-chip, .w-tab, .tab, .menu-tile';
  window.__vkMeasure = (o = {}) => {
    const W = innerWidth, H = innerHeight;
    const root = (o.root && document.querySelector(o.root)) || document.body;
    const out = { offscreen: [], cut: [], outside: [], text: [], overlap: [], scroll: [], ellipsis: [], links: [], hiddenLinks: 0, n: 0 };
    const csm = new Map();
    const cs = (e) => { let c = csm.get(e); if (!c) csm.set(e, (c = getComputedStyle(e))); return c; };
    const short = (e) => {
      let s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      const c = [...e.classList].filter((x) => !/^(on|hidden|open|shut)$/.test(x)).slice(0, 2).join('.');
      if (c) s += '.' + c;
      const t = (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26);
      return t ? `${s} «${t}»` : s;
    };
    const visible = (e) => {
      for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
        const c = cs(p);
        if (c.display === 'none' || c.visibility === 'hidden' || c.visibility === 'collapse' || Number(c.opacity) < 0.05) return false;
      }
      return e.getClientRects().length > 0;
    };
    const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isBtn = (e) => e.matches(BTN);
    const inter = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
    const empty = (r) => r.right - r.left < 1 || r.bottom - r.top < 1;
    const R = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round).join(',');
    const pad = (e) => { const c = cs(e), r = e.getBoundingClientRect(); return { left: r.left + parseFloat(c.borderLeftWidth), top: r.top + parseFloat(c.borderTopWidth), right: r.right - parseFloat(c.borderRightWidth), bottom: r.bottom - parseFloat(c.borderBottomWidth) }; };
    /** The clipping ancestors: their inner boxes, and whether each scrolls along x / y. */
    const clips = (e) => {
      const list = [];
      for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const c = cs(p);
        const ox = c.overflowX, oy = c.overflowY;
        if (ox === 'visible' && oy === 'visible') { if (c.position === 'fixed') break; continue; }
        list.push({ el: p, box: pad(p), sx: ox === 'auto' || ox === 'scroll', sy: oy === 'auto' || oy === 'scroll', cx: ox !== 'visible', cy: oy !== 'visible' });
        if (c.position === 'fixed') break;
      }
      return list;
    };
    /** A text's own box: the union of its text nodes' rects (pieces placed absolutely inside left out). */
    const textBox = (e) => {
      let box = null;
      const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim()) continue;
        let abs = false;
        for (let p = n.parentElement; p && p !== e; p = p.parentElement) { const c = cs(p); if (c.position === 'absolute' || c.position === 'fixed' || c.display === 'none' || c.visibility === 'hidden') { abs = true; break; } }
        if (abs) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) {
          if (r.width < 0.5 || r.height < 0.5) continue;
          box = box ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }
      }
      return box;
    };
    const els = [...root.querySelectorAll('*')].filter((e) => !e.closest(SKIP) && visible(e));
    out.n = els.length;
    const placed = [];
    const texts = [];
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const c = cs(e);
      const content = ownText(e) || isBtn(e) || /^(IMG|SVG|INPUT|SELECT|TEXTAREA|CANVAS)$/i.test(e.tagName);
      const cl = clips(e);
      let vr = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (const k of cl) vr = inter(vr, k.box);
      if (empty(vr)) continue; // scrolled away or hidden by its plate on purpose
      if (content && (vr.left < -1 || vr.top < -1 || vr.right > W + 1 || vr.bottom > H + 1)) out.offscreen.push(`${short(e)} [${R(vr)}] of ${W}x${H}`);
      // cut: a text or button past a clipping ancestor that does not scroll that way (the text's own box for a text)
      if (content && (ownText(e) || isBtn(e))) {
        const tb = ownText(e) && !isBtn(e) ? textBox(e) ?? r : r;
        for (const k of cl) {
          const b = k.box;
          const px = !k.sx && k.cx && (tb.right > b.right + 1.5 || tb.left < b.left - 1.5);
          const py = !k.sy && k.cy && (tb.bottom > b.bottom + 1.5 || tb.top < b.top - 1.5);
          if (px || py) { out.cut.push(`${short(e)} [${R(tb)}] by ${short(k.el).split(' «')[0]} [${R(b)}]`); break; }
        }
      }
      // outside: in-flow text / button past its frame's inner edge (right, bottom)
      if (content && c.position !== 'absolute' && c.position !== 'fixed') {
        let p = e.parentElement;
        while (p && cs(p).display.startsWith('inline') ) p = p.parentElement;
        if (p && p !== document.body) {
          const pc = cs(p);
          const framed = parseFloat(pc.borderRightWidth) > 0 || parseFloat(pc.borderBottomWidth) > 0 || (pc.backgroundColor !== 'rgba(0, 0, 0, 0)' && pc.backgroundColor !== 'transparent') || pc.backgroundImage !== 'none';
          if (framed && pc.overflowX === 'visible' && pc.overflowY === 'visible') {
            const b = pad(p);
            const tb = ownText(e) && !isBtn(e) ? textBox(e) ?? r : r;
            if (tb.right > b.right + 1.5 || tb.bottom > b.bottom + 1.5) out.outside.push(`${short(e)} [${R(tb)}] out of ${short(p).split(' «')[0]} [${R(b)}]`);
          }
        }
      }
      // a button's text: wider than the inner width, or out of the button
      if (isBtn(e)) {
        const tb = textBox(e);
        if (tb) {
          const inner = e.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight);
          const wide = tb.right - tb.left > inner + 1.5;
          const outb = tb.left < r.left - 1 || tb.right > r.right + 1 || tb.top < r.top - 1 || tb.bottom > r.bottom + 1;
          if (wide || outb) out.text.push(`${short(e)} text ${Math.round(tb.right - tb.left)}x${Math.round(tb.bottom - tb.top)} in ${Math.round(inner)}x${e.clientHeight}${outb ? ' (out)' : ''}`);
        }
      }
      // ellipsis that cuts (everywhere); in the shop any clamp rule on the goods' texts
      if (c.textOverflow === 'ellipsis' && c.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) out.ellipsis.push(`${short(e)} «…» ${e.scrollWidth}>${e.clientWidth}`);
      else if (o.shop && (c.textOverflow === 'ellipsis' || (c.webkitLineClamp && c.webkitLineClamp !== 'none')) && ownText(e)) out.ellipsis.push(`${short(e)} rule ${c.textOverflow === 'ellipsis' ? 'text-overflow' : 'line-clamp ' + c.webkitLineClamp}`);
      if (c.position === 'absolute' || c.position === 'fixed' || c.position === 'sticky') {
        const big = (vr.right - vr.left) * (vr.bottom - vr.top) > W * H * 0.35;
        const decor = !content && c.backgroundImage === 'none' && (c.backgroundColor === 'rgba(0, 0, 0, 0)' || c.backgroundColor === 'transparent') && !e.querySelector('img,svg,button');
        if (!big && !decor && vr.right - vr.left >= 6 && vr.bottom - vr.top >= 6 && c.pointerEvents !== 'none' || (!big && ownText(e))) placed.push({ e, r: vr });
      } else if (ownText(e)) {
        const tb = textBox(e);
        if (tb) texts.push({ e, r: inter(tb, vr) });
      }
    }
    // overlap: placed pieces on each other, or on a text (not their own ancestors / descendants)
    const hit = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
    const kin = (a, b) => a.contains(b) || b.contains(a);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) if (!kin(placed[i].e, placed[j].e) && hit(placed[i].r, placed[j].r)) out.overlap.push(`${short(placed[i].e)} × ${short(placed[j].e)}`);
      for (const t of texts) if (!kin(placed[i].e, t.e) && !empty(t.r) && hit(placed[i].r, t.r)) {
        // (the piece must be drawn over the text: the topmost element at the overlap's middle)
        const x = (Math.max(placed[i].r.left, t.r.left) + Math.min(placed[i].r.right, t.r.right)) / 2, y = (Math.max(placed[i].r.top, t.r.top) + Math.min(placed[i].r.bottom, t.r.bottom)) / 2;
        const top = document.elementFromPoint(x, y);
        if (top && (placed[i].e === top || placed[i].e.contains(top)) && !t.e.contains(top)) out.overlap.push(`${short(placed[i].e)} over text ${short(t.e)}`);
      }
    }
    // scroll: the page never; a window's panel as a whole; a block sideways
    const se = document.scrollingElement;
    if (se.scrollWidth > W + 1 || se.scrollHeight > H + 1) out.scroll.push(`page ${se.scrollWidth}x${se.scrollHeight} of ${W}x${H}`);
    if (document.body.scrollWidth > W + 1) out.scroll.push(`body ${document.body.scrollWidth} wide`);
    const panel = document.querySelector('#modal:not(.hidden) #modal-panel');
    if (panel && panel.scrollHeight > panel.clientHeight + 2 && /auto|scroll/.test(cs(panel).overflowY)) out.scroll.push(`panel scrolls ${panel.scrollHeight}>${panel.clientHeight}`);
    for (const e of els) {
      const c = cs(e);
      if (/auto|scroll/.test(c.overflowX) && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) out.scroll.push(`sideways ${short(e).split(' «')[0]} ${e.scrollWidth}>${e.clientWidth}`);
    }
    // links off the page
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
      if (u.protocol === 'javascript:') continue;
      const off = u.origin !== location.origin || u.pathname !== location.pathname;
      if (!off) continue;
      if (visible(a)) out.links.push(`${short(a)} → ${u.href.slice(0, 80)}`);
      else out.hiddenLinks++;
    }
    for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = [...new Set(out[k])];
    return out;
  };
  return 'vk measure ready';
})();
