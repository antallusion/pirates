// Proof shots (owner, 2026-11-02): the work at a spot's countdown — the divers on a wreck and a landing party ashore —
// its pill at the head of the top stack and its icon first in the effects' row; the ship at anchor. 844×390 and
// 1366×768, RU.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-spot.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/spotwork.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/spotwork';
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
/** The pill and the row as measured: its box, its words, inside the screen, and the share of the screen it takes. */
const measure = (p) => p.evaluate(() => {
  const el = document.getElementById('hud-spot');
  const fx = document.querySelector('#hud-fx .fx-i');
  const s = globalThis.gravetide.state;
  const r = el?.getBoundingClientRect();
  return {
    shown: !!el && !el.classList.contains('hidden') && !!r?.width,
    text: el?.innerText.replace(/\s+/g, ' ').trim(),
    box: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
    inside: r ? r.left >= 0 && r.right <= innerWidth && r.top >= 0 : null,
    clipped: el ? [...el.querySelectorAll('.sp-k, .sp-ph')].some((x) => x.scrollWidth > x.clientWidth + 1) : null,
    share: r ? Math.round(((r.width * r.height) / (innerWidth * innerHeight)) * 1000) / 10 : null,
    fx: fx ? `${fx.getAttribute('aria-label')} [${fx.querySelector('.fx-t')?.textContent}]` : null,
    spot: s.self?.spot ?? null, speed: s.you?.spd, sail: s.ownDisplay?.sail,
  };
});

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true, captain: 'navigator' });
    await L.closeAll(p);
    await dismiss(p);
    for (const c of ['/level 20', '/god on', '/weather calm', '/time 12']) {
      await L.say(p, c);
      await L.sleep(500);
    }
    // 1. The divers on the wreck of the Saint Brendan (4 m): there at way, «Нырять» pressed.
    await L.say(p, '/tp 11147 87366');
    await L.sleep(2500);
    await L.closeAll(p);
    await dismiss(p);
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
    await L.sleep(9000);
    await p.mouse.move(2, H - 2);
    L.log(tag, 'dive', JSON.stringify(await measure(p)));
    await snap(p, `${OUT}/dive-${tag}.png`);
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'spot', action: 'abort' }));
    await L.sleep(1500);
    L.log(tag, 'after abort', JSON.stringify(await L.toasts(p)));
    // 2. A landing party at the ruins of Widowcliff (40 s).
    await L.say(p, '/tp 39436 84868');
    await L.sleep(2500);
    await L.closeAll(p);
    await dismiss(p);
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
    await L.sleep(14000);
    await L.closeAll(p);
    await dismiss(p);
    await p.mouse.move(2, H - 2);
    L.log(tag, 'land', JSON.stringify(await measure(p)));
    await snap(p, `${OUT}/land-${tag}.png`);
    await p.close();
  }
} finally {
  await b.close();
}
