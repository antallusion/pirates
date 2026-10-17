// docs/29 §8–9 browser QA: the advice on the island screen (the ribbon, the pulsing marker, the sheet, «Строить», the
// speed-up hint and «Ускорить») and a lair fight ashore whose spoils carry an island drop, at each size and language.
//   GPORT=58981 OUT=docs/img/isleplan SIZE=844x390,480x270,1440x900 LANG2=ru,en node tools/mobile/isleplan.mjs
import { browser, page, login, say, send, open, closeAll, sleep } from './m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const port = Number(process.env.GPORT ?? 58981);
const OUT = process.env.OUT ?? 'docs/img/isleplan';
const sizes = (process.env.SIZE ?? '844x390').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru').split(',');
mkdirSync(OUT, { recursive: true });
const RUN = Math.random().toString(36).slice(2, 5);
const report = [];
const note = (...a) => { console.log(...a); report.push(a.join(' ')); };

async function waitFor(p, sel, ms = 15000) {
  for (let t = 0; t < ms; t += 200) {
    if (await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }, sel)) return true;
    await sleep(200);
  }
  return false;
}

/** The numbers: the ribbon and the card against the bars; buttons' words and pictures inside their frames. */
const audit = (p) => p.evaluate(() => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const R = (e) => e.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const out = { overlaps: [], frames: [], offscreen: [] };
  const els = [...['.is-rec', '.is-top .is-sea', '.is-top .is-store', '.is-side', '.is-queue', '.is-card', '.is-hint'].map((s) => [s, document.querySelector(`#isle ${s}`)]), ...[...document.querySelectorAll('.po-chip')].map((e) => ['.po-chip', e])].filter(([, e]) => vis(e));
  // the queue's own box spans its row: its chips are what stand
  const q = document.querySelector('#isle .is-queue');
  if (q && vis(q)) { const last = [...q.children].filter(vis).pop(); if (last) els.splice(els.findIndex(([s]) => s === '.is-queue'), 1, ['.is-queue (last chip)', last]); }
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) if (hit(R(els[i][1]), R(els[j][1]))) out.overlaps.push(`${els[i][0]} × ${els[j][0]}`);
  for (const e of document.querySelectorAll('#isle .is-rec, #isle .is-card .btn, #isle .is-card .pr-shop, #advcard .ac-il, .tb-isle')) {
    if (!vis(e)) continue;
    const r = R(e);
    if (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5) out.offscreen.push(e.className + ' ' + e.textContent.trim().slice(0, 20));
    const c = getComputedStyle(e);
    const bw = parseFloat(c.borderLeftWidth) || 0;
    const inner = { l: r.left + bw, t: r.top + bw, r: r.right - bw, b: r.bottom - bw };
    for (const k of e.querySelectorAll('img, b, span')) {
      if (!vis(k)) continue;
      const q = R(k);
      if (q.left < inner.l - 0.5 || q.right > inner.r + 0.5 || q.top < inner.t - 1 || q.bottom > inner.b + 1) { out.frames.push(`${e.className}: ${k.tagName} ${k.className}`); break; }
    }
    // the words themselves
    const rg = document.createRange();
    rg.selectNodeContents(e);
    for (const lr of rg.getClientRects()) if (lr.width > 1 && (lr.right > inner.r + 1 || lr.left < inner.l - 1)) { out.frames.push(`${e.className}: text «${e.textContent.trim().slice(0, 20)}»`); break; }
  }
  return out;
});

/** The level's choice of skills and such sheets that wait: «Позже». */
const later = (p) => p.evaluate(() => { for (const b of document.querySelectorAll('button')) { const t = b.textContent.trim(); const r = b.getBoundingClientRect(); if ((t === 'Позже' || t === 'Later') && r.width > 0 && !b.closest('#promo-over')) b.click(); } });

const b = await browser();
try {
  for (const lang of langs) {
    for (const [W, H] of sizes) {
      const tag = `${W}x${H}-${lang}`;
      const p = await page(b, [W, H], { lang });
      // the handbook and the shop's offers are other screens: kept out of these shots
      await p.ctx.addInitScript(() => { try { localStorage.setItem('gravetide.helpSeen', '1'); } catch {} document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#promo-over{display:none!important}'; document.head.append(st); }); });
      await login(p, { port, know: true, name: `Plan ${RUN}${lang}${W}`.slice(0, 15) });
      await say(p, '/isle 1');
      await say(p, '/silver 60000');
      await say(p, '/god');
      await sleep(800);
      await sleep(1500);
      await later(p);
      await say(p, '/army level 20');
      await say(p, '/scrolls 200');
      await sleep(1500);
      // ---- a lair fight ashore: until its spoils carry an island drop (a speed-up best)
      let shotLoot = false;
      for (let i = 0; i < 30 && !shotLoot; i++) {
        await say(p, '/lair reset');
        await sleep(300);
        await say(p, '/lair crab_beach go');
        await sleep(2500);
        if (i === 0) {
          // the card waits on «Осмотреть» on a phone (the action bar's look)
          await p.evaluate(() => { if (!document.querySelector('.act-btn.act-look')) document.querySelector('[data-act-more]')?.click(); });
          await sleep(300);
          await p.evaluate(() => document.querySelector('.act-btn.act-look')?.click());
          await sleep(800);
        }
        if (i === 0 && !(await waitFor(p, '#advcard .ac-isle', 6000))) {
          note(tag, 'lair card folded:', await p.evaluate(() => { const e = document.querySelector('#advcard .ac-isle'); const r = e?.getBoundingClientRect(); return e ? `${Math.round(r.top)},${Math.round(r.height)} ${e.textContent.replace(/\s+/g, ' ').trim()}` : 'no .ac-isle'; }));
          // unfolded by a tap on its head (the phone's fold), then shot
          await p.evaluate(() => document.querySelector('#advcard .ac-lcard:not(.open) .ac-head')?.click());
          await sleep(500);
          note(tag, 'lair card open:', JSON.stringify(await audit(p)));
          await p.screenshot({ path: `${OUT}/${tag}-lair-card.png` });
        }
        else if (i === 0) {
          await p.screenshot({ path: `${OUT}/${tag}-lair-card.png` });
          note(tag, 'lair card «possible loot»:', await p.evaluate(() => document.querySelector('#advcard .ac-isle')?.textContent.replace(/\s+/g, ' ').trim()));
        }
        await say(p, '/lair crab_beach weak');
        await sleep(300);
        await say(p, '/lair crab_beach fight');
        await sleep(2500);
        await send(p, { t: 'tac', act: { a: 'quick' } });
        await sleep(3500);
        if (i === 0) note(tag, 'battle end:', await p.evaluate(() => { const v = globalThis.gravetide.state.boardTac; return JSON.stringify({ over: v?.over, loot: v?.result?.loot }).slice(0, 300); }));
        const has = await p.evaluate(() => [...document.querySelectorAll('.tb-isle')].map((e) => e.getAttribute('title') ?? '').join(' | '));
        if (has) {
          await later(p);
          await sleep(600);
          await p.screenshot({ path: `${OUT}/${tag}-lair-loot.png` });
          note(tag, `lair won (try ${i + 1}): island drops —`, has);
          const a = await audit(p);
          if (a.frames.length || a.offscreen.length) note(tag, 'loot audit:', JSON.stringify(a));
          shotLoot = true;
        }
        await p.evaluate(() => document.querySelector('[data-endbtn]')?.click());
        await sleep(1200);
        if (W < 1000 && lang === 'en' && i >= 0 && !shotLoot && i >= 5) break; // (the small screens: a few tries)
      }
      if (!shotLoot) note(tag, 'no island drop in the tries (chances ~20–35 % a lair)');
      await say(p, '/gift day 4');
      await sleep(300);
      await say(p, '/gift claim');
      await sleep(800);
      // ---- the island screen
      await later(p);
      await closeAll(p);
      await open(p, 'base');
      if (!(await waitFor(p, '#isle .is-rec:not(.hidden)', 30000))) { note(tag, 'NO ribbon'); await p.ctx.close(); continue; }
      await sleep(2500);
      await p.screenshot({ path: `${OUT}/${tag}-1-ribbon.png` });
      const marker = await p.evaluate(() => ({ ring: document.querySelectorAll('#isle .is-g.rec, #isle .is-pl.t.rec').length, star: document.querySelectorAll('#isle .is-trec').length, rib: document.querySelector('#isle .is-rec')?.textContent.replace(/\s+/g, ' ').trim() }));
      note(tag, 'ribbon:', marker.rib, '· marker rings', marker.ring, 'stars', marker.star);
      let a = await audit(p);
      note(tag, 'overview audit:', JSON.stringify(a));
      await p.evaluate(() => document.querySelector('#isle .is-rec')?.click());
      await waitFor(p, '#isle .is-card .pr-row');
      await sleep(800);
      await p.screenshot({ path: `${OUT}/${tag}-2-advice.png` });
      note(tag, 'advice:', await p.evaluate(() => [...document.querySelectorAll('#isle .pr-row')].map((r) => `${r.querySelector('.pr-m b')?.textContent} [${r.querySelector('.pr-st')?.textContent ?? ''}]`).join(' / ')));
      a = await audit(p);
      note(tag, 'advice audit:', JSON.stringify(a));
      // «Строить»
      const built = await p.evaluate(() => { const b = document.querySelector('#isle [data-prbuild]'); b?.click(); return !!b; });
      await sleep(2500);
      await p.evaluate(() => { if (!document.querySelector('#isle .is-card:not(.hidden) .pr-row')) document.querySelector('#isle .is-rec')?.click(); });
      await sleep(1200);
      const q = await p.evaluate(() => document.querySelectorAll('#isle .is-q:not(.free)').length);
      note(tag, `«Строить» pressed: ${built}; works under way: ${q}`);
      await p.evaluate(() => document.querySelector('#isle .is-card .pr-sp')?.scrollIntoView({ block: 'nearest' }));
      await sleep(400);
      await p.screenshot({ path: `${OUT}/${tag}-3-speedup.png` });
      const sp = await p.evaluate(() => ({ text: document.querySelector('#isle .pr-sp')?.textContent.replace(/\s+/g, ' ').trim(), btn: !!document.querySelector('#isle [data-prspeed]:not([disabled])') }));
      note(tag, 'speed-ups:', sp.text, '· button live:', sp.btn);
      if (sp.btn) {
        const before = await p.evaluate(() => globalThis.gravetide.state.base?.plan?.speed);
        await p.evaluate(() => document.querySelector('#isle [data-prspeed]')?.click());
        await sleep(2500);
        const after = await p.evaluate(() => ({ speed: globalThis.gravetide.state.base?.plan?.speed, q: document.querySelectorAll('#isle .is-q:not(.free)').length }));
        note(tag, '«Ускорить»:', JSON.stringify(before), '→', JSON.stringify(after));
        await p.evaluate(() => { if (!document.querySelector('#isle .is-card:not(.hidden) .pr-row')) document.querySelector('#isle .is-rec')?.click(); });
        await sleep(1000);
        await p.screenshot({ path: `${OUT}/${tag}-4-after.png` });
      }
      a = await audit(p);
      note(tag, 'after audit:', JSON.stringify(a));
      if (p.errors.length) note(tag, 'page errors:', p.errors.slice(0, 5).join(' || '));
      await p.ctx.close();
    }
  }
} finally {
  await b.close();
  writeFileSync(`${OUT}/report.txt`, report.join('\n'));
}
