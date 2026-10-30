// Proof shots (forum topic 7, post 24, Нефигугум): «Переход» only to discovered hubs (an undiscovered one greyed), and
// her own course on the big chart (the dashed gold line, the ring and the pill with where to and how far) and on the
// minimap. RU, 844×390 and 1366×768.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-ferry30.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/ferryfog30.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/ferryfog30';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const sizes = (process.env.SIZES ?? '844x390,1366x768').split(',').map((s) => s.split('x').map(Number));
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const say = (...a) => { const t = a.join(' '); log.push(t); L.log(t); };
const wait = async (p, f, ms = 30000) => { for (let t = 0; t < ms; t += 400) { if (await p.evaluate(f)) return true; await L.sleep(400); } return false; };
try {
  for (const [W, H] of sizes) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    p.on('pageerror', (e) => say(tag, 'pageerror', e.message));
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/silver 60000');
    // Hollowmere visited once (open in her list); the rest of the hubs far under her fog (locked)
    await L.say(p, '/tp hollowmere');
    await L.sleep(1500);
    await L.send(p, { t: 'dock' });
    await wait(p, () => globalThis.gravetide.state.self?.dockedAt === 'hollowmere', 15000);
    await L.sleep(800);
    await L.closeAll(p);
    await L.say(p, '/tp gravesend');
    await L.sleep(1500);
    await L.send(p, { t: 'dock' });
    if (!(await wait(p, () => !!globalThis.gravetide.state.self?.dockedAt))) say(tag, 'FAIL not docked');
    await L.sleep(1500);
    // the port window, its «Переход» tab
    if (!(await wait(p, () => !!document.querySelector('[data-ptab="ferry"]'), 15000))) {
      await L.open(p, 'port');
      await wait(p, () => !!document.querySelector('[data-ptab="ferry"]'), 15000);
    }
    await p.evaluate(() => document.querySelector('[data-ptab="ferry"]')?.click());
    await L.sleep(1000);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.fy-card .fy-row')].map((r) => `${r.classList.contains('fy-row--locked') ? 'LOCKED' : 'open'} ${r.textContent.replace(/\s+/g, ' ').trim()}`));
    say(tag, 'ferry rows', JSON.stringify(rows));
    // a locked row in view
    // (a level's choice that came up meanwhile: «Позже»)
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent)?.click());
    await L.sleep(500);
    await p.evaluate(() => document.querySelector('.fy-row--locked')?.scrollIntoView({ block: 'center' }));
    await L.sleep(400);
    await p.screenshot({ path: `${OUT}/${tag}-1-ferry.png` });
    // a locked hub by hand: the server refuses
    const locked = await p.evaluate(() => document.querySelector('.fy-row--locked b')?.textContent ?? null);
    const lockedId = await p.evaluate((n) => globalThis.gravetide.state.ports.find((q) => q.name === n || n?.includes(q.name))?.id ?? null, locked);
    if (lockedId) {
      await L.send(p, { t: 'ferry', to: lockedId });
      await L.sleep(1200);
      say(tag, 'forced ferry to', lockedId, 'docked still:', await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt), 'toasts:', await p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ')));
    }
    await L.closeAll(p);
    // out to sea, a course to Hollowmere
    await L.send(p, { t: 'undock' });
    await L.sleep(2500);
    const hm = await p.evaluate(() => globalThis.gravetide.state.ports.find((q) => q.id === 'hollowmere'));
    await L.send(p, { t: 'autosail', x: hm.x, y: hm.y, sail: 4, near: 300 });
    if (!(await wait(p, () => !!globalThis.gravetide.state.autosail?.path, 20000))) say(tag, 'FAIL no course');
    await L.sleep(6000);
    await L.closeAll(p);
    await p.screenshot({ path: `${OUT}/${tag}-3-minimap.png` });
    await L.open(p, 'map');
    await L.sleep(2500);
    await p.screenshot({ path: `${OUT}/${tag}-2-chart.png` });
    await L.sleep(4000);
    await p.screenshot({ path: `${OUT}/${tag}-2b-chart-later.png` });
    await L.closeAll(p);
    await L.send(p, { t: 'autosail', stop: true });
    await p.close();
  }
} finally {
  writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  await b.close();
}
