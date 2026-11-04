// Proof shots (forum, Эдуард, posts 70–72): the patent's warning before a patent of the service's enemy, the ferry
// list with a hub closed to her, «Причал» with a ship lying in another port and «Перегнать сюда», the swap dialog
// that says where the extra men go. RU, 844×390 (touch) and 1366×768.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa70.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/forum70.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/forum70';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
const wait = async (p, f, ms = 30000, arg) => { for (let t = 0; t < ms; t += 400) { if (await p.evaluate(f, arg).catch(() => false)) return true; await L.sleep(400); } return false; };
async function snap(p, name) {
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000 }); } catch (e) { if (i === 2) L.log('shot failed', name, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
async function dockAt(p, id) {
  await L.open(p, null);
  await L.say(p, `/tp ${id}`);
  await L.sleep(1500);
  await L.send(p, { t: 'dock' });
  if (!(await wait(p, (x) => globalThis.gravetide.state.self?.dockedAt === x, 30000, id))) L.log('FAIL not docked', id);
  await wait(p, () => !!globalThis.gravetide.state.portView);
  await L.sleep(800);
  await dismiss(p);
}
async function tab(p, id) {
  await L.open(p, null);
  await L.open(p, 'port');
  await L.sleep(1000);
  await p.evaluate((t) => document.querySelector(`[data-ptab="${t}"]`)?.click(), id);
  await L.sleep(1200);
}
const clickText = (p, re) => p.evaluate((src) => { const r = new RegExp(src); const x = [...document.querySelectorAll('button')].find((e) => r.test(e.textContent.trim()) && e.offsetParent); x?.click(); return !!x; }, re.source);

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await dismiss(p);
    const name = p.name;
    for (const c of ['/level 40', '/silver 900000', '/fog all', '/weather calm']) { await L.say(p, c); await L.sleep(500); }
    await dockAt(p, 'gravesend');

    // ---- 4. the swap dialog: a brig full of men changing into the small ship at the berth
    // (the sloop kept at the berth here; the hull under her made a frigate, her army filled — the admin's shortcuts)
    await L.send(p, { t: 'shipyard', action: 'buy_ship', classId: 'cutter', keep: true });
    await L.sleep(1500);
    await clickText(p, /^(Продолжить|Go ahead)$/);
    await L.sleep(800);
    await L.say(p, '/ship frigate');
    await L.sleep(800);
    await L.say(p, '/army deckhand 200');
    await L.sleep(1200);
    const crew = await p.evaluate(() => ({ crew: globalThis.gravetide.state.self?.crew, cls: globalThis.gravetide.state.self?.loadout?.classId, berths: globalThis.gravetide.state.self?.berths?.map((x) => x.classId) }));
    L.log(tag, 'aboard', JSON.stringify(crew));
    await tab(p, 'berths');
    await p.evaluate(() => document.querySelector('[data-act="berth_swap"]')?.click());
    await wait(p, () => !!document.querySelector('.confirm-panel'), 15000);
    await L.sleep(800);
    L.log(tag, 'dialog', await p.evaluate(() => document.querySelector('.confirm-panel')?.innerText.replace(/\s+/g, ' ')));
    await snap(p, `4-crew-dialog-${tag}`);
    await clickText(p, /^(Нет|No|Не сейчас|Отмена)$/);
    await L.sleep(600);
    await L.closeAll(p);

    // ---- 3. «Причал» far from her port: «Стоит в … · км» and «Перегнать сюда»
    await dockAt(p, 'frostgate');
    await tab(p, 'berths');
    L.log(tag, 'berth card', await p.evaluate(() => document.querySelector('.bth-card')?.innerText.replace(/\s+/g, ' ')));
    await p.evaluate(() => document.querySelector('.bth-card')?.scrollIntoView({ block: 'center' }));
    await L.sleep(500);
    await snap(p, `3-berth-elsewhere-${tag}`);
    await L.closeAll(p);

    // ---- 2. the ferry: a League privateer (a Commodore of the Crown) in Gravesend — Fogmouth closed
    await L.say(p, `/service ${name} crown 4`);
    await L.sleep(600);
    await dockAt(p, 'hollowmere');
    await L.say(p, '/flag faction league');
    await L.sleep(800);
    await tab(p, 'colours');
    L.log(tag, 'patent card (ally)', await p.evaluate(() => document.querySelector('.fl-pat-sv')?.innerText));
    await p.evaluate(() => document.querySelector('.fl-pat')?.scrollIntoView({ block: 'center' }));
    await L.sleep(400);
    await snap(p, `1b-patent-ally-keeps-${tag}`);
    await L.send(p, { t: 'pvp', action: 'patent' });
    await L.sleep(1000);
    L.log(tag, 'service after the League patent', JSON.stringify(await p.evaluate(() => ({ sv: globalThis.gravetide.state.self?.service, patent: globalThis.gravetide.state.self?.pvp?.patent?.by }))));
    await dockAt(p, 'gravesend');
    await tab(p, 'ferry');
    await wait(p, () => !!document.querySelector('.fy-row--closed'), 10000);
    await p.evaluate(() => document.querySelector('.fy-row--closed')?.scrollIntoView({ block: 'center' }));
    await L.sleep(500);
    L.log(tag, 'ferry', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.fy-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()))));
    await snap(p, `2-ferry-closed-${tag}`);
    await L.closeAll(p);

    // ---- 1. the patent's warning: a lieutenant of the Brethren under the Crown's colours at Gravesend
    await L.say(p, `/service ${name} confederacy 1`);
    await L.say(p, '/flag faction crown');
    await L.sleep(800);
    // (the League's patent first struck: other colours are up)
    await tab(p, 'colours');
    await p.evaluate(() => document.querySelector('.fl-pat')?.scrollIntoView({ block: 'center' }));
    await L.sleep(400);
    L.log(tag, 'patent card (enemy)', await p.evaluate(() => document.querySelector('.fl-pat-sv')?.innerText));
    await snap(p, `1a-patent-card-warning-${tag}`);
    await p.evaluate(() => document.querySelector('[data-patent]')?.click());
    await wait(p, () => !!document.querySelector('.confirm-panel'), 10000);
    await L.sleep(700);
    L.log(tag, 'patent dialog', await p.evaluate(() => document.querySelector('.confirm-panel')?.innerText.replace(/\s+/g, ' ')));
    await snap(p, `1-patent-warning-${tag}`);
    await clickText(p, /^(Остаться на службе|Keep my service)$/);
    L.log(tag, 'errors', JSON.stringify(p.errors?.slice(0, 5) ?? []));
    await p.context().close();
  }
} finally {
  await b.close();
}
