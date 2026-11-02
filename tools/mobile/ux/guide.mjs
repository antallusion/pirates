// Proof shots (2026-11-02): «Лоцманская книга» — the book's home, the search with the words lit, an article's picture,
// the «?» in the harbour's head, the first-time tip at the top edge, «Показать в игре» with the finger on the tavern.
// 844×390 and 1366×768, RU. Measured: the book inside the screen, no text cut, the tap targets on a phone ≥ 40 px, the
// tip's share of the screen and its distance from the middle.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-guide.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/guide.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/guide';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
async function snap(p, path) {
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) L.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
/** The book as measured: its box, text cut, targets under 40 px, the finger. */
const measure = (p, touch) => p.evaluate((t) => {
  const box = (el) => { const r = el?.getBoundingClientRect(); return r && r.width ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; };
  const gb = document.querySelector('#guide-over .gb');
  const r = gb?.getBoundingClientRect();
  const cut = [...document.querySelectorAll('#guide-over .gb-sec-n, #guide-over .gb-row-t b, #guide-over .gb-title, #guide-over .gb-cap, #guide-over .gb-at, #guide-over .gb-show, #guide-over .gb-prog b')]
    .filter((x) => x.offsetParent && (x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 2)).map((x) => x.className + ':' + x.textContent.slice(0, 30));
  const small = t ? [...document.querySelectorAll('#guide-over button, #guide-over input, #guide-tip button, .g-help')].filter((x) => x.offsetParent).map((x) => {
    const q = x.getBoundingClientRect();
    // (the «?» answers in a 42 px ring round its mark: ::after inset −8 px)
    const ring = x.classList.contains('g-help') ? 16 : 0;
    return { c: x.className.split(' ')[0], w: Math.round(q.width + ring), h: Math.round(q.height + ring) };
  }).filter((q) => q.w < 40 || q.h < 40) : [];
  const tip = document.getElementById('guide-tip');
  const tr = tip && !tip.classList.contains('hidden') ? tip.getBoundingClientRect() : null;
  const finger = document.getElementById('tut-finger');
  const ring = document.querySelector('.tut-target');
  return {
    book: r ? { box: box(gb), inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight } : null,
    cut, small,
    tip: tr ? { box: box(tip), share: Math.round((tr.width * tr.height) / (innerWidth * innerHeight) * 1000) / 10, centre: tr.top < innerHeight / 2 && tr.bottom > innerHeight / 2 && tr.left < innerWidth / 2 && tr.right > innerWidth / 2, text: tip.innerText.replace(/\s+/g, ' ') } : null,
    finger: finger && !finger.classList.contains('hidden') ? { box: box(finger), on: ring ? (ring.dataset.ptab ?? ring.className) : null } : null,
    help: [...document.querySelectorAll('.g-help')].filter((x) => x.offsetParent).map((x) => x.dataset.ghelp),
  };
}, touch);

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const touch = W < 1000;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true, captain: 'navigator' });
    await L.closeAll(p);
    await dismiss(p);
    for (const c of ['/god on', '/weather calm', '/time 12']) {
      await L.say(p, c);
      await L.sleep(500);
    }
    await L.closeAll(p);
    // 0. the first-time tip at the top edge (the first harbour's: she comes aboard in one); none waiting — the first
    //    sight of the sea is given an article of its own here, the engine's demo. (A shot of this slow software GPU
    //    takes longer than the tip's 8 s: it is held for the shot.)
    await L.sleep(4000);
    if (!(await p.evaluate(() => globalThis.gravetide.guideTips.isShown()))) {
      await p.evaluate(() => {
        const g = globalThis.gravetide.guide;
        g.list = [...g.list, { id: 'demo-sea', section: 'sea', title: ['The open sea', 'Открытое море'], tags: ['sea'], summary: ['x', 'Море вокруг.'], firstTime: 'first-sea', slides: [{ text: ['x', 'Море вокруг.'] }] }];
        globalThis.gravetide.guideTips.offer('first-sea');
      });
      for (let i = 0; i < 20 && !(await p.evaluate(() => globalThis.gravetide.guideTips.isShown())); i++) await L.sleep(500);
    }
    await p.evaluate(() => { const t = globalThis.gravetide.guideTips; if (t.showing) t.showing.until = performance.now() + 120000; });
    L.log(tag, 'tip', JSON.stringify(await measure(p, touch)));
    await snap(p, `${OUT}/tip-${tag}.png`);
    await p.evaluate(() => { const g = globalThis.gravetide.guide; g.list = g.list.filter((a) => !a.id.startsWith('demo-')); document.querySelector('#guide-tip [data-gtx]')?.click(); });
    // 1. the book's home (from «⋯» → «Книга»)
    await p.evaluate(() => { document.getElementById('tc-more')?.click(); });
    await L.sleep(500);
    await p.evaluate(() => document.getElementById('tc-book')?.click());
    await L.sleep(900);
    L.log(tag, 'home', JSON.stringify(await measure(p, touch)));
    await snap(p, `${OUT}/home-${tag}.png`);
    // 2. the search, the words lit
    await p.click('#guide-over .gb-q');
    await p.keyboard.type('порту', { delay: 40 });
    await L.sleep(600);
    L.log(tag, 'search', JSON.stringify(await measure(p, touch)), await p.evaluate(() => [...document.querySelectorAll('#guide-over .gb-row')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
    await snap(p, `${OUT}/search-${tag}.png`);
    // 3. an article's second picture
    await p.evaluate(() => document.querySelector('#guide-over .gb-row')?.click());
    await L.sleep(500);
    await p.evaluate(() => document.querySelector('#guide-over [data-gnext]')?.click());
    await L.sleep(700);
    L.log(tag, 'article', JSON.stringify(await measure(p, touch)));
    await snap(p, `${OUT}/article-${tag}.png`);
    await p.evaluate(() => globalThis.gravetide.guide.close());
    // 4. into her harbour: the port window's «?»
    const home = await p.evaluate(() => globalThis.gravetide.state.self.lastPort);
    await L.say(p, `/tp ${home}`);
    await L.sleep(2500);
    for (let i = 0; i < 8 && !(await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)); i++) {
      await L.send(p, { t: 'dock' });
      await L.sleep(2500);
    }
    await dismiss(p);
    if (!(await p.evaluate(() => globalThis.gravetide.modal() === 'port'))) await L.open(p, 'port');
    await L.sleep(1200);
    L.log(tag, 'port', JSON.stringify(await measure(p, touch)), JSON.stringify(await L.me(p)));
    await snap(p, `${OUT}/help-${tag}.png`);
    await L.closeAll(p, 1);
    // 6. «?» of the harbour opens its article
    await L.open(p, 'port');
    await L.sleep(1000);
    await p.evaluate(() => document.querySelector('#modal-panel .g-help')?.click());
    await L.sleep(800);
    L.log(tag, 'help→', await p.evaluate(() => document.querySelector('#guide-over .gb-at')?.textContent ?? null));
    await snap(p, `${OUT}/help-open-${tag}.png`);
    await p.evaluate(() => globalThis.gravetide.guide.close());
    await L.closeAll(p, 1);
    // 6b. the «?» of the other windows (each window's head, its key)
    const heads = {};
    for (const m of ['journal', 'map', 'options', 'crew', 'ship', 'hero', 'base', 'talents']) {
      await L.open(p, m);
      await L.sleep(900);
      await L.sleep(m === 'crew' ? 1500 : 0);
      heads[m] = (await measure(p, touch)).help.join(',') || '—';
      if (m === 'journal') await snap(p, `${OUT}/help-journal-${tag}.png`);
    }
    await L.closeAll(p, 2);
    await p.evaluate(() => globalThis.gravetide.seasonPass.open());
    await L.sleep(900);
    heads.pass = (await measure(p, touch)).help.join(',') || '—';
    await p.evaluate(() => globalThis.gravetide.seasonPass.close());
    L.log(tag, 'heads', JSON.stringify(heads));
    await L.closeAll(p, 2);
    // 7. «Показать в игре»: a slide that opens the harbour and points at its tavern (the engine's demo slide)
    await p.evaluate(() => {
      const g = globalThis.gravetide.guide;
      g.list = [...g.list, { id: 'demo-tavern', section: 'army', title: ['The tavern', 'Таверна'], tags: ['tavern', 'таверна'], summary: ['Crews are hired there.', 'Там нанимают команду.'],
        slides: [{ text: ['The tavern is a tab of the harbour window. Tap «Show in the game».', 'Таверна — вкладка окна порта. Нажмите «Показать в игре».'], show: { open: 'port', point: '#modal-panel [data-ptab="tavern"]' } }] }];
      g.openArticle('demo-tavern');
    });
    await L.sleep(700);
    await snap(p, `${OUT}/show-before-${tag}.png`);
    await p.evaluate(() => document.querySelector('#guide-over [data-gshow]')?.click());
    await L.sleep(900);
    // (held for the slow shot: the same finger, longer)
    await p.evaluate(() => globalThis.gravetide.guide.d.point('#modal-panel [data-ptab="tavern"]', 120000));
    L.log(tag, 'show', JSON.stringify(await measure(p, touch)));
    await snap(p, `${OUT}/show-${tag}.png`);
    L.log(tag, 'errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.close();
  }
} finally {
  await b.close();
}
