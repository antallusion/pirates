// Proof shots (forum, Нефигугум 2026-10-30, post 26): the trade-in's two ways, «Причал», the escorts' repair in port and
// their bars at sea, the boarding intercept. RU, 844×390 and 1366×768.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-forum26.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/forum26.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/forum26';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const sizes = (process.env.SIZES ?? '844x390,1366x768').split(',').map((s) => s.split('x').map(Number));
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const say = (...a) => { const t = a.join(' '); log.push(t); L.log(t); };
// (the one-time cards put away as they come; the level-up's skill choice «Позже»)
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((b) => b.click());
  document.querySelectorAll('button').forEach((b) => { if (/^(Позже|Later)$/.test(b.textContent.trim()) && b.offsetParent) b.click(); });
}).catch(() => {});
const wait = async (p, f, ms = 30000, arg) => { for (let t = 0; t < ms; t += 400) { await dismiss(p); if (await p.evaluate(f, arg)) return true; await L.sleep(400); } return false; };
const dock = async (p, id) => {
  await L.say(p, `/tp ${id}`);
  await L.sleep(1500);
  await L.send(p, { t: 'dock' });
  return wait(p, (x) => globalThis.gravetide.state.self?.dockedAt === x, 30000, id);
};
const tab = async (p, id) => { await p.evaluate((x) => document.querySelector(`[data-ptab="${x}"]`)?.click(), id); await L.sleep(1200); };
try {
  for (const [W, H] of sizes) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    for (const c of ['/level 30', '/silver 60000', '/doubloons 2000', '/god']) { await L.say(p, c); await L.sleep(400); }
    // ten points in Command and «Escort Captain»: two escorts' berths
    for (const [id, n] of [['cmd_steady_voice', 3], ['cmd_fair_share', 2], ['cmd_officers_mess', 2], ['cmd_press_gang', 2], ['cmd_signal_flags', 1], ['cmd_escort_captain', 1]]) for (let i = 0; i < n; i++) { await L.send(p, { t: 'learn_talent', id }); await L.sleep(150); }
    if (!(await dock(p, 'gravesend'))) say(tag, 'FAIL not docked at gravesend');
    await L.sleep(1500);
    await dismiss(p);
    await L.send(p, { t: 'escort', action: 'hire', classId: 'cutter' });
    await L.sleep(500);
    await L.send(p, { t: 'escort', action: 'hire', classId: 'brig' });
    await L.sleep(800);
    say(tag, 'escorts', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.self.fleet?.escorts.map((e) => `${e.name}:${e.hull}`))));
    // 1. the trade-in's two ways
    await L.open(p, 'port');
    await L.sleep(1200);
    await dismiss(p);
    await tab(p, 'shipyard');
    await p.evaluate(() => document.querySelectorAll('.yd-ships, details').forEach((d) => { if (d.tagName === 'DETAILS') d.open = true; }));
    await L.sleep(600);
    const btn = await p.evaluate(() => { const b = document.querySelector('[data-act="ship"][data-cls="schooner"]') ?? document.querySelector('[data-act="ship"]'); b?.click(); return b?.dataset.cls ?? null; });
    say(tag, 'trade on', btn);
    await wait(p, () => !!document.querySelector('.bth-sheet'), 8000);
    await L.sleep(900);
    await p.screenshot({ path: `${OUT}/${tag}-1-trade-choice.png` });
    say(tag, 'choice', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.bth-sheet [data-pick]')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()))));
    await p.evaluate(() => document.querySelector('.bth-sheet [data-pick="keep"]')?.click());
    await L.sleep(1200);
    // her men over the new hull's hammocks: the question, then yes
    if (await p.evaluate(() => !!document.querySelector('#confirm [data-yes]'))) {
      await p.screenshot({ path: `${OUT}/${tag}-1b-men-ask.png` });
      await p.evaluate(() => document.querySelector('#confirm [data-yes]')?.click());
      await L.sleep(1200);
    }
    say(tag, 'sails', await p.evaluate(() => globalThis.gravetide.state.self.loadout.classId), 'berths', await p.evaluate(() => globalThis.gravetide.state.self.berths.length));
    // 2. «Причал»
    await dismiss(p);
    await tab(p, 'berths');
    await L.sleep(800);
    await p.screenshot({ path: `${OUT}/${tag}-2-berths.png` });
    say(tag, 'berths page', JSON.stringify(await p.evaluate(() => document.querySelector('.bth')?.innerText.replace(/\s+/g, ' ').slice(0, 400))));
    // 3. the escorts at sea, hurt, their bars
    await L.closeAll(p);
    await L.send(p, { t: 'undock' });
    await wait(p, () => !globalThis.gravetide.state.self?.dockedAt, 20000);
    await L.sleep(2500);
    await L.say(p, '/foe pirate brig 300 hunt');
    await L.sleep(22000);
    await dismiss(p);
    await p.screenshot({ path: `${OUT}/${tag}-3a-escort-bars-fight.png` });
    say(tag, 'bars', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.esc-chip, [class*="esc"]')].slice(0, 6).map((e) => e.className + ':' + e.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40)))));
    if (!(await dock(p, 'gravesend'))) say(tag, 'FAIL not docked again');
    await L.sleep(1500);
    await L.open(p, 'port');
    await L.sleep(1000);
    await dismiss(p);
    await tab(p, 'shipyard');
    await L.sleep(800);
    await p.evaluate(() => document.querySelector('.yd-esc')?.scrollIntoView({ block: 'center' }));
    await L.sleep(500);
    await p.screenshot({ path: `${OUT}/${tag}-3b-escort-repair-port.png` });
    say(tag, 'escort line', JSON.stringify(await p.evaluate(() => document.querySelector('.yd-esc')?.innerText.replace(/\s+/g, ' '))));
    await p.evaluate(() => document.querySelector('[data-act="repair_escorts"]')?.click());
    await L.sleep(1500);
    say(tag, 'after repair', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.self.fleet?.escorts.map((e) => `${e.name}:${e.hull}`))));
    // 4. the intercept
    await L.closeAll(p);
    await L.send(p, { t: 'undock' });
    await wait(p, () => !globalThis.gravetide.state.self?.dockedAt, 20000);
    await L.say(p, '/tp 30000 70000');
    await L.sleep(2500);
    const before = new Set((await L.ships(p, 3000)).map((s) => s.id));
    await L.say(p, '/foe pirate cutter 500');
    await L.sleep(1500);
    const foe = (await L.ships(p, 900)).find((s) => s.role === 'pirate' && !before.has(s.id));
    say(tag, 'foe', JSON.stringify(foe));
    if (foe) {
      await L.send(p, { t: 'attack', target: foe.id, mode: 'board' });
      await L.sleep(4000);
      await dismiss(p);
      await p.screenshot({ path: `${OUT}/${tag}-4a-intercept.png` });
      say(tag, 'pursuit', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.pursuit ?? null)));
      const t0 = Date.now();
      const ok = await wait(p, () => !!(globalThis.gravetide.state.boardTac || globalThis.gravetide.state.boarding || document.querySelector('#tactical:not(.hidden), .tac-root, #board-risk')), 60000);
      say(tag, 'boarded', ok, 'in', ((Date.now() - t0) / 1000 + 4.5).toFixed(1), 's');
      await L.sleep(2500);
      await p.screenshot({ path: `${OUT}/${tag}-4b-boarding.png` });
    }
    say(tag, 'errors', JSON.stringify(p.errors));
    await p.ctx.close();
  }
} finally {
  writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  await b.close();
}
