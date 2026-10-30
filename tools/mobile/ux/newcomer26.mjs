// Proof shots (forum topic «Я - НОВИЧЕК(НУБ)», post 26, Нефигугум): the treasure map's spot and «Плыть к кладу», the
// barge in «Завезти», the yard's «Снять» with its fee and confirm, the hubs under the fog, the «Верфи» filter and the
// port card's yard line, the trade-in wording. RU, 844×390 and 1366×768.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-pc26.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/newcomer26.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/newcomer26';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const sizes = (process.env.SIZES ?? '844x390,1366x768').split(',').map((s) => s.split('x').map(Number));
const only = (process.env.ONLY ?? '1,2,3,4,5,6').split(',');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const say = (...a) => { const t = a.join(' '); log.push(t); L.log(t); };
const wait = async (p, f, ms = 30000, arg) => { for (let t = 0; t < ms; t += 400) { if (await p.evaluate(f, arg)) return true; await L.sleep(400); } return false; };
const later = (p) => p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent)?.click());
const shot = async (p, name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); say('shot', name); };
const dockAt = async (p, id) => {
  await L.say(p, `/tp ${id}`);
  await L.sleep(1500);
  await L.send(p, { t: 'dock' });
  return wait(p, (x) => globalThis.gravetide.state.self?.dockedAt === x, 20000, id);
};
const portTab = async (p, tab) => {
  await L.open(p, 'port');
  await wait(p, (t) => !!document.querySelector(`[data-ptab="${t}"]`), 15000, tab);
  await p.evaluate((t) => document.querySelector(`[data-ptab="${t}"]`)?.click(), tab);
  await L.sleep(900);
};
const chartAt = async (p, x, y, zoom) => {
  await p.evaluate(([x, y, z]) => { const c = globalThis.gravetide.chart; c.cx = x; c.cy = y; if (z) c.zoom = z; c.draw(globalThis.gravetide.state); }, [x, y, zoom]);
  await L.sleep(700);
};
try {
  for (const [W, H] of sizes) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    p.on('pageerror', (e) => say(tag, 'pageerror', e.message));
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/silver 200000');
    await L.say(p, '/level 12');
    await L.say(p, '/noboard on');
    await L.say(p, '/god');
    await L.sleep(800);
    await later(p);
    await L.closeAll(p);
    // ---- 1. a treasure map: bought in the tavern, its spot on the chart, «Плыть к кладу», the dig on arrival
    if (only.includes('1')) {
      if (!(await dockAt(p, 'gravesend'))) say(tag, 'FAIL not docked');
      await L.sleep(800);
      await L.closeAll(p);
      await L.send(p, { t: 'treasure', action: 'buy' });
      await wait(p, () => (globalThis.gravetide.state.self?.maps ?? []).length > 0, 10000);
      await L.closeAll(p);
      await L.sleep(300);
      say(tag, 'toast', JSON.stringify(await L.toasts(p)));
      await shot(p, `${tag}-1a-toast`);
      const m = await p.evaluate(() => globalThis.gravetide.state.self.maps[0]);
      say(tag, 'map', JSON.stringify({ name: m.name, kind: m.kind, spot: m.spot }));
      await L.closeAll(p);
      await L.open(p, 'map');
      await L.sleep(1500);
      await chartAt(p, m.spot[0], m.spot[1], 3);
      await shot(p, `${tag}-1b-chart-spot`);
      // the minimap's ✕ (out to sea a moment, near the spot)
      // the map's card in the chart's log, with its line and its button
      await p.evaluate(() => document.querySelector('.tmap')?.scrollIntoView({ block: 'center' }));
      await L.sleep(500);
      await shot(p, `${tag}-1c-card`);
      // close by the spot, then «Плыть к кладу» from the card
      await L.closeAll(p);
      await L.send(p, { t: 'undock' });
      await L.sleep(2000);
      const off = await p.evaluate((mm) => {
        const s = globalThis.gravetide.state;
        let best = null, bd = Infinity;
        for (const is of s.islands.values()) { const d = Math.hypot(is.x - mm.spot[0], is.y - mm.spot[1]); if (d < bd) { bd = d; best = is; } }
        const dx = mm.spot[0] - best.x, dy = mm.spot[1] - best.y, l = Math.hypot(dx, dy) || 1;
        return [Math.round(mm.spot[0] + (dx / l) * 700), Math.round(mm.spot[1] + (dy / l) * 700)];
      }, m);
      await L.say(p, `/tp ${off[0]} ${off[1]}`);
      await L.sleep(2500);
      await L.open(p, 'map');
      await L.sleep(1200);
      const hasBtn = await p.evaluate(() => !!document.querySelector('[data-tmsail]'));
      say(tag, 'sail button', hasBtn);
      await p.evaluate(() => document.querySelector('[data-tmsail]')?.click());
      await L.sleep(4000);
      await shot(p, `${tag}-1d-sailing`);
      const dug = await wait(p, () => !!globalThis.gravetide.state.self?.landing, 90000);
      say(tag, 'auto-dig', dug, JSON.stringify(await L.toasts(p)));
      await L.sleep(2500);
      await shot(p, `${tag}-1e-digging`);
      await L.closeAll(p);
    }
    // ---- 2. the barge in the island's «Завезти»
    if (only.includes('2')) {
      await L.say(p, '/isle 3');
      await L.sleep(1500);
      await L.closeAll(p);
      await L.open(p, 'base');
      await wait(p, () => globalThis.gravetide.isle?.isOpen, 20000);
      await L.sleep(2500);
      await later(p);
      await p.evaluate(() => globalThis.gravetide.isle.openPanel('haul'));
      await L.sleep(1200);
      await p.evaluate(() => document.querySelector('.ih-barge')?.scrollIntoView({ block: 'center' }));
      await L.sleep(400);
      await shot(p, `${tag}-2a-barge`);
      const before = await p.evaluate(() => globalThis.gravetide.state.self.gold);
      await p.evaluate(() => document.querySelector('[data-ihbarge]')?.click());
      await L.sleep(1500);
      say(tag, 'barge: silver', before, '→', await p.evaluate(() => globalThis.gravetide.state.self.gold), JSON.stringify(await L.toasts(p)));
      await shot(p, `${tag}-2b-barge-ordered`);
      await p.evaluate(() => globalThis.gravetide.isle.exit?.());
      await L.closeAll(p);
    }
    // ---- 3. the yard's «Снять»: its fee on the button, the confirm
    if (only.includes('3')) {
      if (!(await dockAt(p, 'gravesend'))) say(tag, 'FAIL not docked (yard)');
      await L.sleep(800);
      await L.closeAll(p);
      await L.send(p, { t: 'shipyard', action: 'module', module: 'hull_plating' });
      await L.sleep(800);
      await portTab(p, 'shipyard');
      await p.evaluate(() => { const f = document.querySelector('[data-more="yd-guns"] [data-fold]'); if (f && f.getAttribute('aria-expanded') !== 'true') f.click(); });
      await L.sleep(700);
      await p.evaluate(() => document.querySelector('[data-act="unfit"]')?.scrollIntoView({ block: 'center' }));
      await L.sleep(500);
      say(tag, 'unfit button', await p.evaluate(() => document.querySelector('[data-act="unfit"]')?.textContent?.trim()));
      await shot(p, `${tag}-3a-unfit-button`);
      await p.evaluate(() => document.querySelector('[data-act="unfit"]')?.click());
      await L.sleep(900);
      await shot(p, `${tag}-3b-unfit-confirm`);
      await p.evaluate(() => document.querySelector('.confirm-panel [data-no]')?.click());
      await L.sleep(500);
      // ---- 6. the trade-in wording: the «Все корабли» note and a hull's confirm
      if (only.includes('6')) {
        await p.evaluate(() => { const f = document.querySelector('[data-more="yd-ships"] [data-fold]'); if (f && f.getAttribute('aria-expanded') !== 'true') f.click(); });
        await L.sleep(700);
        await p.evaluate(() => document.querySelector('.hulls-head')?.scrollIntoView({ block: 'start' }));
        await L.sleep(400);
        await shot(p, `${tag}-6a-hulls-note`);
        const ok = await p.evaluate(() => { const bt = [...document.querySelectorAll('[data-act="ship"]')].find((x) => !x.disabled); bt?.click(); return !!bt; });
        await L.sleep(900);
        say(tag, 'trade confirm', ok, await p.evaluate(() => document.querySelector('.confirm-panel')?.textContent?.replace(/\s+/g, ' ').trim()));
        await shot(p, `${tag}-6b-trade-confirm`);
        await p.evaluate(() => document.querySelector('.confirm-panel [data-no]')?.click());
        await L.sleep(400);
      }
      await L.closeAll(p);
    }
    // ---- 4. the hubs under the fog (chart and minimap); 5. the «Верфи» filter and the port card
    if (only.includes('4') || only.includes('5')) {
      await L.send(p, { t: 'undock' });
      await L.sleep(2500);
      await L.closeAll(p);
      await shot(p, `${tag}-4a-minimap`);
      await L.open(p, 'map');
      await L.sleep(1500);
      const own = await p.evaluate(() => globalThis.gravetide.state.ownDisplay);
      await chartAt(p, own.x, own.y, 0.9);
      await shot(p, `${tag}-4b-chart-hubs`);
      // the minimap by an undiscovered hub (Tidewrack, 3.5 km off): its dim ⇄ over the fog, close up
      await L.closeAll(p);
      const tw = await p.evaluate(() => globalThis.gravetide.state.ports.find((q) => q.id === 'tidewrack'));
      await L.say(p, `/tp ${Math.round(tw.x - 3200)} ${Math.round(tw.y - 1500)}`);
      await L.sleep(3500);
      await L.closeAll(p);
      const fogged = await p.evaluate((t) => { const s = globalThis.gravetide.state; return !!s.seen && !s.seen.length ? null : true; }, tw);
      const r = await p.evaluate(() => { const e = document.getElementById('minimap').getBoundingClientRect(); return { x: e.x, y: e.y, width: e.width, height: e.height }; });
      const url = await p.evaluate(() => document.getElementById('minimap').toDataURL('image/png'));
      writeFileSync(`${OUT}/${tag}-4c-minimap-hub.png`, Buffer.from(url.split(',')[1], 'base64')); // the dial's own pixels (220 px)
      say(tag, 'shot 4c minimap', JSON.stringify(r), fogged);
      await shot(p, `${tag}-4d-sea-by-hub`);
      await L.open(p, 'map');
      await L.sleep(1500);
      await chartAt(p, tw.x - 1600, tw.y - 700, 2.5);
      await shot(p, `${tag}-4e-chart-by-hub`);
      if (only.includes('5')) {
        await p.evaluate(() => document.querySelector('[data-mlayer="yards"]')?.click());
        await L.sleep(900);
        await shot(p, `${tag}-5a-chart-yards`);
        await chartAt(p, own.x, own.y, 1.2);
        await shot(p, `${tag}-5b-chart-yards-near`);
        await p.evaluate(() => document.querySelector('[data-mlayer="yards"]')?.click());
        await L.closeAll(p);
        await p.evaluate(() => globalThis.gravetide.portCard('blackwater'));
        await L.sleep(2500);
        await p.evaluate(() => document.querySelector('.pcd-svc')?.scrollIntoView({ block: 'center' }));
        await L.sleep(300);
        say(tag, 'port card yard', await p.evaluate(() => document.querySelector('.pcd-svc')?.textContent?.replace(/\s+/g, ' ').trim()));
        await shot(p, `${tag}-5c-portcard`);
      }
      await L.closeAll(p);
    }
    say(tag, 'latin', JSON.stringify(await L.latin(p)).slice(0, 300));
    if (p.errors.length) say(tag, 'errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.close();
  }
} finally {
  writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  await b.close();
}
