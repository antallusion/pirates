// docs/19 E19: the endgame's screen check, measured in the page (loaded by tools/mobile/e19/run.mjs after the QA kit
// of assets/raw/qa.js). window.__e19({ ru, touch }) returns, for what is on screen now:
//   clip   — text cut by its own box (scrollWidth > clientWidth with the overflow hidden or an ellipsis);
//   words  — Latin words on a Russian screen, Cyrillic on an English one (names of players, ships and keys apart);
//   small  — touch targets under 44 px (and under 40) counting the hit area a ::after reaches past the frame;
//   fold   — a window's actions below its fold (scrolled to) and anything a finger can never reach;
//   pop    — the popup budget (assets/raw/qa.js __popAudit): its share of the screen and what covers the centre;
//   feed   — the battle feed: shown, its type size, its lines and the cut ones.
(() => {
  const shown = (e) => {
    if (!e || !e.getClientRects().length) return false;
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  // Scrolled out of a clipping box: not on screen now.
  const clippedOut = (e) => {
    const r = e.getBoundingClientRect();
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (!/(auto|scroll|hidden|clip)/.test(c.overflowX + c.overflowY)) continue;
      const pr = p.getBoundingClientRect();
      if (r.bottom <= pr.top + 2 || r.top >= pr.bottom - 2 || r.right <= pr.left + 2 || r.left >= pr.right - 2) return true;
    }
    return false;
  };
  const label = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''} «${(e.textContent || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 26)}»`;
  const SKIP = 'script, style, #chat, .chat-log, #hud-chat, .no-tr, [data-name], canvas';

  window.__e19 = (o = {}) => {
    const ru = o.ru ?? true, touch = o.touch ?? false;
    const out = { clip: [], words: [], small: { n: 0, n40: 0, of: 0, list: [] }, fold: { scroll: [], off: [] }, pop: null, feed: null };
    // ---- clipped text
    for (const e of document.querySelectorAll('body *')) {
      if (e.matches(SKIP) || e.closest(SKIP)) continue;
      if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!shown(e) || clippedOut(e)) continue;
      const c = getComputedStyle(e);
      const cut = c.textOverflow === 'ellipsis' || /(hidden|clip)/.test(c.overflowX);
      if (!cut || c.display === 'inline') continue;
      if (e.scrollWidth > e.clientWidth + 1) out.clip.push(`${label(e)} ${e.scrollWidth}>${e.clientWidth}`);
      else if (c.webkitLineClamp && c.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2) out.clip.push(`${label(e)} lines ${e.scrollHeight}>${e.clientHeight}`);
    }
    // ---- foreign words
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(SKIP + ', kbd, .kbd')) continue;
      if (!shown(el) || clippedOut(el)) continue;
      const m = ru ? n.textContent.match(/[A-Za-z][A-Za-z'’-]{2,}/g) : n.textContent.match(/[А-Яа-яЁё]{2,}/g);
      if (m) for (const x of m) { const k = `${x} @${label(el).slice(0, 40)}`; if (!seen.has(k)) { seen.add(k); out.words.push(k); } }
    }
    // ---- touch targets (with the ::after hit area the house uses on touch)
    if (touch) {
      const px = (v) => (v && v.endsWith('px') ? parseFloat(v) : 0);
      for (const e of document.querySelectorAll('button, .btn, .tab, a[href], [role="button"], select, input:not([type="hidden"]), .slot, .doll-slot, [data-arlot], .tc-btn')) {
        if (!shown(e) || clippedOut(e) || e.closest('#chat, #hud-chat')) continue;
        if (e.parentElement?.closest('button, .btn, .tab')) continue; // a part of a bigger control
        const r = e.getBoundingClientRect();
        let ww = r.width, hh = r.height;
        const a = getComputedStyle(e, '::after');
        if (a.content !== 'none' && a.position === 'absolute' && getComputedStyle(e).position !== 'static') {
          hh += Math.max(0, -px(a.top)) + Math.max(0, -px(a.bottom));
          ww += Math.max(0, -px(a.left)) + Math.max(0, -px(a.right));
        }
        out.small.of++;
        if (Math.min(ww, hh) < 44) {
          out.small.n++;
          if (Math.min(ww, hh) < 40) out.small.n40++;
          if (out.small.list.length < 24) out.small.list.push(`${Math.round(ww)}×${Math.round(hh)} ${label(e)}`);
        }
      }
    }
    // ---- below the fold: a window's actions it must be scrolled to, and anything out of reach
    const panel = document.querySelector('#modal:not(.hidden) #modal-panel');
    if (panel) {
      const body = [...panel.querySelectorAll('.modal-body')].find((b) => shown(b));
      if (body) {
        const br = body.getBoundingClientRect();
        for (const b of body.querySelectorAll('.btn-primary, button.btn-primary')) {
          const c = getComputedStyle(b);
          if (c.display === 'none' || c.visibility === 'hidden') continue;
          const r = b.getBoundingClientRect();
          if (r.height > 0 && r.top - body.scrollTop >= br.bottom - 4) out.fold.scroll.push(`${label(b)} +${Math.round(r.top - br.bottom)}px`);
        }
      }
      const pr = panel.getBoundingClientRect();
      if (pr.bottom > innerHeight + 1 || pr.right > innerWidth + 1 || pr.top < -1 || pr.left < -1) out.fold.off.push(`panel ${[pr.left, pr.top, pr.right, pr.bottom].map(Math.round)}`);
    }
    for (const b of document.querySelectorAll('button, .btn')) {
      const c = getComputedStyle(b);
      if (c.display === 'none' || c.visibility === 'hidden' || !b.getClientRects().length) continue;
      let hid = false;
      for (let p = b; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') { hid = true; break; } }
      if (hid) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.top < innerHeight - 2 && r.left < innerWidth - 2 && r.bottom > 2 && r.right > 2) continue;
      let sc = false;
      for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) { sc = true; break; } }
      if (!sc) out.fold.off.push(`${label(b)} at ${Math.round(r.left)},${Math.round(r.top)}`);
    }
    // ---- a control cut by a box that hides its overflow (half a button under a band's edge)
    out.cut = [];
    for (const b of document.querySelectorAll('button, .btn, .k-btn')) {
      if (!shown(b) || b.closest('#chat, #hud-chat')) continue;
      const r = b.getBoundingClientRect();
      for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (/(auto|scroll)/.test(c.overflowX + c.overflowY)) break; // scrolled half out of a list: the list's business
        if (!/(hidden|clip)/.test(c.overflowX + c.overflowY)) continue;
        const pr = p.getBoundingClientRect();
        const over = Math.max(r.bottom - pr.bottom, pr.top - r.top, r.right - pr.right, pr.left - r.left);
        if (over > 2 && over < Math.min(r.height, r.width) + 1) { out.cut.push(`${label(b)} ${Math.round(over)}px past ${label(p).slice(0, 40)}`); break; }
      }
    }
    // ---- popups
    if (typeof window.__popAudit === 'function') out.pop = window.__popAudit();
    // ---- the battle feed
    const feed = document.querySelector('.tb-feed');
    if (feed) {
      const lines = [...feed.querySelectorAll('.tb-lines > *')];
      const fs = parseFloat(getComputedStyle(feed).fontSize);
      const r = feed.getBoundingClientRect();
      out.feed = { shown: shown(feed), font: fs, lines: lines.filter(shown).length, cut: lines.filter((l) => shown(l) && l.scrollWidth > l.clientWidth + 1).length, rect: [r.left, r.top, r.width, r.height].map(Math.round), text: lines.map((l) => l.textContent.trim()).filter(Boolean).slice(-3) };
    }
    return out;
  };
  return 'e19 ready';
})();
