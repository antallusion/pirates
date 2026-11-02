// Proof shots (owner, 2026-11-02): «Шлюпы с острова» — her island's hire window from afar loading the boats (the fill
// bar, the men in them, «Отправить шлюпы»), the boats under way with their pill and the dashed line on the dial, the
// boats near her, the toast as they come alongside. 844×390 and 1366×768, RU.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-boats.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/isleboats.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/isleboats';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
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
/** The window's strip and the pill as measured: inside the screen, nothing cut, the share of the screen. */
const measure = (p) => p.evaluate(() => {
  const box = (el) => { const r = el?.getBoundingClientRect(); return r && r.width ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; };
  const strip = document.querySelector('.rc-boats');
  const send = document.querySelector('[data-rbsend]');
  const pill = document.getElementById('hud-boats');
  const sr = send?.getBoundingClientRect();
  const s = globalThis.gravetide.state;
  return {
    strip: strip ? strip.querySelector('.rb-load')?.textContent : null, stripBox: box(strip),
    send: sr ? { box: box(send), inside: sr.bottom <= innerHeight && sr.right <= innerWidth, disabled: send.disabled } : null,
    why: document.querySelector('.rb-why')?.textContent ?? null,
    pill: pill && !pill.classList.contains('hidden') ? pill.innerText.replace(/\s+/g, ' ').trim() : null, pillBox: box(pill),
    pillShare: pill && !pill.classList.contains('hidden') ? Math.round((pill.getBoundingClientRect().width * pill.getBoundingClientRect().height) / (innerWidth * innerHeight) * 1000) / 10 : null,
    clipped: pill ? [...pill.querySelectorAll('.sp-k, .sp-ph')].some((x) => x.scrollWidth > x.clientWidth + 1) : null,
    fx: document.querySelector('#hud-fx .fx-i')?.getAttribute('aria-label') ?? null,
    boats: s.self?.boats ? { left: s.self.boats.left, eta: s.self.boats.eta, men: s.self.boats.men } : null,
  };
});

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true, captain: 'navigator' });
    await L.closeAll(p);
    await dismiss(p);
    for (const c of ['/level 20', '/god on', '/weather calm', '/time 12', '/silver 200000', '/ship frigate 8', '/isle 6', '/town 3', '/dwell fill']) {
      await L.say(p, c);
      await L.sleep(600);
    }
    // to sea, some kilometres off her island
    const isl = await p.evaluate(() => { const s = globalThis.gravetide.state; const i = s.islands.get(s.self.homeIsle); return i ? { x: i.x, y: i.y, r: i.radius, name: i.name } : null; });
    L.log(tag, 'island', JSON.stringify(isl));
    await L.say(p, `/tp ${Math.round(isl.x + 4200)} ${Math.round(isl.y + 2600)}`);
    await L.sleep(3000);
    await L.closeAll(p);
    await dismiss(p);
    L.log(tag, 'me', JSON.stringify(await L.me(p)));
    // 1. the hire window in its boats' mode, two kinds in the boats
    await p.evaluate(() => document.getElementById('tc-boats')?.click());
    await L.sleep(2500);
    const kinds = await p.evaluate(() => [...document.querySelectorAll('.rc-unit')].map((x) => x.dataset.rcu));
    L.log(tag, 'kinds', kinds.join(','));
    for (const [u, frac] of [['marine', 0.5], ['musketeer', 1]]) {
      await p.evaluate((k) => document.querySelector(`.rc-unit[data-rcu="${k}"]`)?.click(), u);
      await L.sleep(400);
      await p.evaluate((f) => {
        const sl = document.querySelector('[data-rcn]');
        if (!sl) return;
        sl.value = String(Math.max(1, Math.floor(Number(sl.max) * f)));
        sl.dispatchEvent(new Event('input', { bubbles: true }));
      }, frac);
      await L.sleep(300);
      await p.evaluate(() => document.querySelector('[data-rcboat]')?.click());
      await L.sleep(500);
    }
    L.log(tag, 'dialog', JSON.stringify(await measure(p)));
    await snap(p, `${OUT}/dialog-${tag}.png`);
    // 2. sent: the window closed, the pill and the dashed line on the dial
    await p.evaluate(() => document.querySelector('[data-rbsend]')?.click());
    await L.sleep(1200);
    L.log(tag, 'toasts', JSON.stringify(await L.toasts(p)));
    await L.closeAll(p);
    await L.sleep(1500);
    L.log(tag, 'en route', JSON.stringify(await measure(p)));
    await snap(p, `${OUT}/enroute-${tag}.png`);
    // 3. near her: the boats on the screen
    for (let i = 0; i < 120; i++) {
      const left = await p.evaluate(() => { const v = globalThis.gravetide.state.self?.boats; return v ? Math.max(0, v.left - Math.max(0, globalThis.gravetide.state.estServerTime() - v.at) * v.v) : -1; });
      if (left >= 0 && left < 200) break;
      if (left < 0) break;
      await L.sleep(left > 1500 ? 300 : 20);
    }
    L.log(tag, 'near', JSON.stringify(await measure(p)));
    await snap(p, `${OUT}/near-${tag}.png`);
    // 4. alongside: the toast
    for (let i = 0; i < 100; i++) {
      if (!(await p.evaluate(() => !!globalThis.gravetide.state.self?.boats))) break;
      await L.sleep(100);
    }
    await L.sleep(300);
    L.log(tag, 'arrived', JSON.stringify(await L.toasts(p)), JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.self?.army ?? null)));
    await snap(p, `${OUT}/arrived-${tag}.png`);
    await p.close();
  }
} finally {
  await b.close();
}
