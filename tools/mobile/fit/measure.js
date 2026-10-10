// In-page fit meter (tools/mobile/fit/audit.mjs injects it): does a screen fit a phone held sideways?
//   globalThis.__fit(rootSelector?) → { scroll, out, cut, small, tiny, share, page }
// - scroll: every visible scroll container (overflow auto/scroll) whose content is taller/wider than its box, and
//   the page itself;
// - out: visible elements with text or a tap that reach past the viewport (not ones a scroll box hides);
// - cut: text clipped by its own box (ellipsis, line clamp, overflow hidden) or by an ancestor that hides overflow;
// - small: tap targets (buttons, links, inputs, anything with a pointer cursor) under 40 px on their short side;
// - tiny: visible text set under 11 px;
// - share: the root's area ÷ the screen's.
(() => {
  const vis = (e) => {
    if (!e.getClientRects().length) return false;
    if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false;
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return false;
    }
    return true;
  };
  const name = (e) => {
    if (e.id) return '#' + e.id;
    const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const up = e.parentElement ? (e.parentElement.id ? '#' + e.parentElement.id : (typeof e.parentElement.className === 'string' ? '.' + e.parentElement.className.trim().split(/\s+/)[0] : '')) : '';
    return `${up} > ${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}`.replace(/^ > /, '');
  };
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  const clickable = (e) => {
    if (getComputedStyle(e).pointerEvents === 'none') return false;
    if (e.matches('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], label.check')) return true;
    const c = getComputedStyle(e).cursor;
    if (c !== 'pointer') return false;
    // the outermost of a pointer run is the target; its children inherit the cursor
    return !e.parentElement || getComputedStyle(e.parentElement).cursor !== 'pointer';
  };
  // How far an element's own words run past its border box (a range over its text nodes), 0 when they do not.
  const spill = (e, r) => {
    let worst = 0;
    for (const n of e.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) worst = Math.max(worst, q.right - r.right, r.left - q.left);
    }
    return worst > 2 ? Math.round(worst) : 0;
  };
  // Is this element hidden away by a scroll box above it (then it is the box's overflow, counted once there)?
  const inScroller = (e) => {
    for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (/(auto|scroll)/.test(c.overflowY + c.overflowX) && (q.scrollHeight > q.clientHeight + 2 || q.scrollWidth > q.clientWidth + 2)) return q;
    }
    return null;
  };
  globalThis.__fit = (rootSel) => {
    const W = innerWidth, H = innerHeight;
    // the limits (owner, 2026-10-10): taps 36 px and words 11 px from a 360 px short side, 32 and 10 px below it (270)
    const short = Math.min(W, H), minTap = short >= 360 ? 36 : 32, minText = short >= 360 ? 11 : 10;
    const roots = rootSel ? [...document.querySelectorAll(rootSel)].filter(vis) : [document.body];
    const res = { scroll: [], out: [], cut: [], small: [], under36: 0, underMin: 0, minTap: 0, minText: 0, tiny: [], share: 0, page: null, root: rootSel ?? 'body' };
    const se = document.scrollingElement;
    if (se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1) res.page = `${se.scrollWidth}×${se.scrollHeight} > ${se.clientWidth}×${se.clientHeight}`;
    let area = 0;
    const seen = new Set();
    for (const root of roots) {
      // a scroll box around the window (the title screen scrolls as a whole when its panel is taller than the screen)
      for (let q = root.parentElement; q && q !== document.body && q !== document.documentElement; q = q.parentElement) {
        const qc = getComputedStyle(q);
        if (/(auto|scroll)/.test(qc.overflowY) && q.scrollHeight > q.clientHeight + 2) res.scroll.push(`${name(q)} ↕${q.scrollHeight}/${q.clientHeight} (around)`);
      }
      const rr = root.getBoundingClientRect();
      const ix = Math.max(0, Math.min(rr.right, W) - Math.max(rr.left, 0)), iy = Math.max(0, Math.min(rr.bottom, H) - Math.max(rr.top, 0));
      area += ix * iy;
      const all = [root, ...root.querySelectorAll('*')];
      for (const e of all) {
        if (seen.has(e)) continue; seen.add(e);
        if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
        if (/^(script|style|canvas|option|br)$/i.test(e.tagName)) continue;
        if (!vis(e)) continue;
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        // (a word kept for a screen reader only — 1 px, clipped — is not on the screen)
        if (r.width < 3 || r.height < 3) continue;
        // another page of a paged pane (kit/fit.ts) is that pane's, not this screen's: it is turned to, not scrolled
        const pg = e.closest('.fit-paged');
        let flowed = false;
        if (pg && pg !== e) {
          const pr = pg.getBoundingClientRect();
          if (r.right <= pr.left + 1 || r.left >= pr.right - 1) continue;
          // a paragraph that runs on to the next page (its pieces each whole on a page) is turned to, not cut
          const rs = [...e.getClientRects()];
          flowed = rs.length > 1 && rs.every((q) => q.top >= pr.top - 1 && q.bottom <= pr.bottom + 1);
        }
        if (flowed) continue;
        // 1. scroll boxes that overflow
        if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 0) res.scroll.push(`${name(e)} ↕${e.scrollHeight}/${e.clientHeight}`);
        else if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) res.scroll.push(`${name(e)} ↔${e.scrollWidth}/${e.clientWidth}`);
        const txt = ownText(e);
        const tap = clickable(e);
        // 2. past the screen (what a scroll box hides is that box's finding)
        if ((txt || tap) && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) && !inScroller(e)) res.out.push(`${name(e)} [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`);
        // 3. cut text
        if (txt) {
          const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim().slice(0, 24);
          if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) res.cut.push(`${name(e)} «${t}» …${e.scrollWidth}/${e.clientWidth}`);
          else if (cs.overflow !== 'visible' && !/(auto|scroll)/.test(cs.overflowY) && (e.scrollHeight > e.clientHeight + 3 || e.scrollWidth > e.clientWidth + 3) && e.clientHeight > 0) res.cut.push(`${name(e)} «${t}» ${e.scrollWidth}×${e.scrollHeight}/${e.clientWidth}×${e.clientHeight}`);
          // words wider than their own box spill over what lies beside it (a button's word under the next button)
          else if (cs.overflow === 'visible' && cs.display !== 'inline' && spill(e, r)) res.cut.push(`${name(e)} «${t}» spills ${spill(e, r)} px`);
          else {
            // clipped by an ancestor that hides overflow (not a scroll box: that is counted as a scroll)
            // (an absolutely placed box is clipped only by the boxes from its containing block up)
            let need = getComputedStyle(e).position === 'absolute' ? e.offsetParent : null;
            if (getComputedStyle(e).position === 'fixed') need = document.body;
            for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
              // skipping up to the containing block of an absolutely placed box below
              if (need && q !== need) continue;
              if (need === q) need = null;
              const qc = getComputedStyle(q);
              // q itself absolutely placed: what lies between it and its containing block does not clip
              if (qc.position === 'absolute') need = q.offsetParent;
              else if (qc.position === 'fixed') need = document.body;
              if (qc.overflow === 'visible' && qc.overflowX === 'visible' && qc.overflowY === 'visible') continue;
              if (/(auto|scroll)/.test(qc.overflowY + qc.overflowX)) break;
              const qr = q.getBoundingClientRect();
              if (r.bottom > qr.bottom + 3 || r.right > qr.right + 3 || r.top < qr.top - 3 || r.left < qr.left - 3) { res.cut.push(`${name(e)} «${t}» clipped by ${name(q)}`); }
              break;
            }
          }
          const fs = parseFloat(cs.fontSize);
          if (fs < minText - 0.5 && fs > 0) res.tiny.push(`${name(e)} ${fs}px «${t.slice(0, 14)}»`);
        }
        // 4. small taps
        if (tap && Math.min(r.width, r.height) < 39.5 && !e.matches('input[type=checkbox], input[type=radio], input[type=range]') && !e.disabled) { if (Math.min(r.width, r.height) < 35.5) res.under36++; if (Math.min(r.width, r.height) < minTap - 0.5) res.underMin++; res.small.push(`${name(e)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
      }
    }
    res.minTap = minTap; res.minText = minText;
    res.share = Math.round((area / (W * H)) * 100);
    res.pages = Math.max(0, ...[...document.querySelectorAll('.fit-pager')].filter((b) => vis(b) && roots.some((r) => r.contains(b))).map((b) => Number((/\/(\d+)/.exec(b.textContent) ?? [])[1] ?? 0)));
    const rl = document.getElementById('rotate-lock');
    res.rotate = !!rl && vis(rl) && rl.getBoundingClientRect().width > W * 0.8;
    return res;
  };
  return 'fit ready';
})();
