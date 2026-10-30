// Proof shots (owner 2026-10-30): «На абордаж» offered at 100 m of her hull, «Подойдите ближе» past it, and the approach
// (the grapples haul the two alongside, 2–4 s) before the battle. RU, 844×390.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-1030.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/board100.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/board100';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const say = (...a) => { const t = a.join(' '); log.push(t); L.log(t); };
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((b) => b.click());
  document.querySelectorAll('button').forEach((b) => { if (/^(Позже|Later)$/.test(b.textContent.trim()) && b.offsetParent) b.click(); });
}).catch(() => {});
const bar = (p) => p.evaluate(() => ({
  acts: [...document.querySelectorAll('.act-btn')].filter((x) => x.offsetParent).map((x) => x.innerText.replace(/\s+/g, ' ').trim()).slice(0, 6),
  info: [...document.querySelectorAll('.act-info')].filter((x) => x.offsetParent).map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
}));
const gap = (p, id) => p.evaluate((x) => {
  const s = globalThis.gravetide.state, o = s.ownDisplay, t = s.ships.get(x);
  return t && o ? Math.round(Math.hypot(t.cur.x - o.x, t.cur.y - o.y)) : -1;
}, id);
try {
  const p = await L.page(b, [844, 390], { lang: 'ru' });
  await L.login(p, { port, know: true });
  await L.closeAll(p);
  for (const c of ['/level 12', '/god']) { await L.say(p, c); await L.sleep(400); }
  await L.send(p, { t: 'undock' });
  for (let t = 0; t < 20000 && (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)); t += 400) await L.sleep(400);
  await L.say(p, '/tp 30000 70000');
  await L.sleep(2500);
  await L.closeAll(p);
  await dismiss(p);
  // 1. a merchant 105 m off her beam (centre to centre): about 95 m of water between the hulls — «На абордаж» is offered
  const before = new Set((await L.ships(p, 3000)).map((s) => s.id));
  await L.say(p, '/foe merchant brig 105');
  await L.sleep(2000);
  const foe = (await L.ships(p, 600)).find((s) => !before.has(s.id));
  say('foe', JSON.stringify(foe));
  await dismiss(p);
  await L.sleep(800);
  say('1 at', await gap(p, foe.id), 'm centre to centre', JSON.stringify(await bar(p)));
  await p.screenshot({ path: `${OUT}/1-board-at-100m.png` });
  // 2. pressed: the grapples fly, the two hauled together — mid-approach
  await L.send(p, { t: 'board', target: foe.id, aggression: 'standard', risk: true });
  await L.sleep(1300);
  say('2 mid-approach', await gap(p, foe.id), 'm', JSON.stringify(await bar(p)));
  await p.screenshot({ path: `${OUT}/2-mid-approach.png` });
  await L.sleep(3500);
  say('3 after', await gap(p, foe.id), 'm', 'battle', await p.evaluate(() => !!(globalThis.gravetide.state.boardTac || globalThis.gravetide.state.boarding)));
  await p.screenshot({ path: `${OUT}/3-battle.png` });
  say('errors', JSON.stringify(p.errors));
  await p.ctx.close();
} finally {
  writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  await b.close();
}
