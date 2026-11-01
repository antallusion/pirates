// Proof shots (forum post 45): the journal's quests grouped by where they were taken, with their distances and
// «Плыть»; «Хроника» → «Остров» with the week's supply lines (no letters); «Расчёт за время отсутствия» on return;
// the ship's stats with hands short on the sails. 844×390 and 1366×768, RU.
//   PORT=58820 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f45.db node server/src/main.ts
//   GPORT=58820 node tools/mobile/ux/forum45.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum45';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58820);
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
const fit = (p, sel) => p.evaluate((q) => {
  const out = [];
  const W = innerWidth;
  for (const el of document.querySelectorAll(q)) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (r.left < -1 || r.right > W + 1) out.push(`${el.className}: x ${Math.round(r.left)}..${Math.round(r.right)}`);
    if (el.scrollWidth > el.clientWidth + 2) out.push(`${el.className}: text wider ${el.scrollWidth}>${el.clientWidth}`);
  }
  return out;
}, sel);
/** Takes the first few quests and contracts on the board of the port she lies in. */
async function dockHere(p) {
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'dock' }));
  await L.sleep(2500);
  await L.closeAll(p);
  await dismiss(p);
  await L.open(p, 'port');
  await L.sleep(1500);
}
const takeWork = (p, n) => p.evaluate((k) => {
  const g = globalThis.gravetide;
  const v = g.state.portView;
  const qs = (v?.questOffers ?? []).filter((q) => !q.locked).slice(0, k);
  for (const q of qs) g.net.send({ t: 'quest', action: 'accept', id: q.id });
  const cs = (v?.contracts ?? []).slice(0, 1);
  for (const c of cs) g.net.send({ t: 'contract', action: 'accept', id: c.id });
  return { quests: qs.map((q) => q.id), contracts: cs.map((c) => c.id) };
}, n);

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await dismiss(p);
    for (const c of ['/level 14', '/god on', '/weather calm', '/silver 40000']) {
      await L.say(p, c);
      await L.sleep(600);
    }
    // Work from two ports: the board of the first, then of another.
    await L.say(p, '/tp saltmarrow');
    await L.sleep(2500);
    await dockHere(p);
    L.log(tag, 'took', JSON.stringify(await takeWork(p, 6)));
    await L.sleep(1500);
    const other = await p.evaluate(() => {
      const s = globalThis.gravetide.state, h = s.ports.find((x) => x.id === 'saltmarrow');
      return s.ports.filter((x) => x.id !== 'saltmarrow' && !x.raft).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]?.id;
    });
    await L.say(p, `/tp ${other}`);
    await L.sleep(2500);
    await dockHere(p);
    L.log(tag, 'took', JSON.stringify(await takeWork(p, 6)));
    await L.sleep(1500);
    // Out to sea a little way.
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
    await L.sleep(3000);
    await L.closeAll(p);
    await dismiss(p);
    // 1. «Журнал» → the quests, grouped
    await L.open(p, 'journal');
    await L.sleep(1500);
    await p.mouse.move(2, H - 2);
    await p.evaluate(() => document.querySelectorAll('#srctip').forEach((x) => (x.style.display = 'none')));
    const groups = await p.evaluate(() => [...document.querySelectorAll('.jr-grp')].map((g) => g.querySelector('.jr-grp-h')?.innerText.replace(/\s+/g, ' ').trim() + ' — ' + g.querySelectorAll('.jr-item, .map-daily').length));
    L.log(tag, 'groups', JSON.stringify(groups));
    L.log(tag, 'fit', JSON.stringify(await fit(p, '.jr-grp-h, .jr-row, .jr-go')));
    L.log(tag, 'latin', JSON.stringify(await L.latin(p, '.jr-list')));
    await snap(p, `${OUT}/1-quests-grouped-${tag}.png`);
    await p.evaluate(() => document.querySelector('.jr-list')?.lastElementChild?.scrollIntoView({ block: 'end' }));
    await L.sleep(500);
    await snap(p, `${OUT}/1b-quests-grouped-end-${tag}.png`);
    await L.closeAll(p);
    // 2. The island and its supply routes: the week's supply into «Хроника», no letter.
    for (const c of ['/isle 3', '/supply link', '/supply link', '/supply week']) {
      await L.say(p, c);
      await L.sleep(1200);
    }
    const mail = await p.evaluate(() => (globalThis.gravetide.state.mail ?? globalThis.gravetide.state.letters ?? []).length ?? null);
    L.log(tag, 'letters after the week', JSON.stringify(mail));
    await L.closeAll(p);
    await L.open(p, 'journal');
    await L.sleep(1200);
    await p.evaluate(() => document.querySelector('[data-jtab="chronicle"]')?.click());
    await L.sleep(1500);
    await p.evaluate(() => document.querySelector('[data-chf="isle"]')?.click());
    await L.sleep(800);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.ch-row')].slice(0, 8).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
    L.log(tag, 'chronicle «Остров»', JSON.stringify(rows));
    await snap(p, `${OUT}/2-chronicle-isle-supply-${tag}.png`);
    await L.closeAll(p);
    // 3. Hands short: half her crew wounded below — the ship's stats.
    const crew = await p.evaluate(() => globalThis.gravetide.state.self.crew);
    await L.say(p, `/wounded ${Math.floor(crew / 2)}`);
    await L.sleep(1200);
    await L.open(p, 'ship');
    await L.sleep(1200);
    const tiles = await p.evaluate(() => [...document.querySelectorAll('.stat-tile')].slice(0, 7).map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
    L.log(tag, 'ship tiles', JSON.stringify(tiles));
    await snap(p, `${OUT}/3-ship-hands-short-${tag}.png`);
    await L.closeAll(p);
    await L.say(p, '/heal');
    await L.sleep(800);
    // 4. Back after 20 h at sea with little food: «Расчёт за время отсутствия».
    await p.evaluate(() => {
      const g = globalThis.gravetide;
      const prov = Math.floor(g.state.self.cargo.provisions ?? 0);
      if (prov > 3) g.net.send({ t: 'jettison', good: 'provisions', qty: prov - 3 });
    });
    await L.sleep(800);
    await L.say(p, '/away 20');
    await L.sleep(2500);
    const away = await p.evaluate(() => document.querySelector('.aw-upkeep')?.innerText.replace(/\s+/g, ' ').trim() ?? null);
    L.log(tag, 'away reckoning', away);
    L.log(tag, 'fit', JSON.stringify(await fit(p, '.aw-upkeep, .aw-line')));
    await snap(p, `${OUT}/4-away-reckoning-sea-${tag}.png`);
    await L.closeAll(p);
    // ...and in port: the silver ashore.
    await L.say(p, '/tp saltmarrow');
    await L.sleep(2500);
    await dockHere(p);
    await L.closeAll(p);
    await L.say(p, '/away 6');
    await L.sleep(2500);
    L.log(tag, 'away reckoning (port)', await p.evaluate(() => document.querySelector('.aw-upkeep')?.innerText.replace(/\s+/g, ' ').trim() ?? null));
    await snap(p, `${OUT}/4b-away-reckoning-port-${tag}.png`);
    L.log(tag, 'errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.ctx.close();
  }
} finally {
  await b.close();
}
