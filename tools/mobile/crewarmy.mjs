// QA (owner, 2026-10-27): the crew window's army — every kind's own figure, its tier's ground, its might — at the
// desk, the phone and the Telegram sizes. GPORT=58780 node tools/mobile/crewarmy.mjs
import { execSync } from 'node:child_process';
import * as L from './m0/lib.mjs';

const OUT = process.env.OUT ?? 'assets/raw/audit/crewarmy';
const ARMY = [
  { u: 'crown_dreadnought', n: 6 }, { u: 'abyss_herald', n: 5 }, { u: 'deep_spawn', n: 4 },
  { u: 'jade_dragon', n: 2 }, { u: 'sharpshooter', n: 24 }, { u: 'deckhand', n: 61 }, { u: 'white_whale', n: 1 },
];
const SIZES = [['desk', 1366, 768, 1], ['phone', 844, 390, 2], ['tg', 1093, 481, 1]];
const b = await L.browser();
try { execSync(`powershell -NoProfile -Command "Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*ms-playwright*' } | ForEach-Object { $_.PriorityClass = 'BelowNormal' }"`); } catch {}
for (const [tag, W, H, dsf] of SIZES) {
  process.env.DSF = String(dsf);
  const p = await L.page(b, [W, H]);
  await L.login(p, { know: true });
  await L.closeAll(p);
  await p.evaluate((army) => {
    const g = globalThis.gravetide;
    const put = () => { const c = g.state.self?.company; if (c) { c.army = army; c.armySlots = 7; } };
    put(); setInterval(put, 50);
    g.open('crew');
  }, ARMY);
  await L.sleep(600);
  await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.open('crew'); });
  await p.waitForSelector('.army-card .army-slot img', { timeout: 10000 });
  await p.evaluate(() => Promise.all([...document.querySelectorAll('#modal-panel img')].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await L.sleep(500);
  await p.evaluate(() => document.querySelector('.army-card')?.scrollIntoView({ block: 'start' }));
  await L.sleep(300);
  await p.screenshot({ path: `${OUT}/${tag}-${W}x${H}.png` });
  const r = await p.evaluate(() => { const b = document.querySelector('.army-card').getBoundingClientRect(); return { x: b.left, y: Math.max(0, b.top), width: b.width, height: Math.min(b.height, innerHeight - Math.max(0, b.top)) }; });
  await p.screenshot({ path: `${OUT}/${tag}-${W}x${H}-army.png`, clip: r });
  await p.evaluate(() => document.querySelector('#modal-panel .modal-body')?.scrollTo(0, 0));
  await L.sleep(200);
  await p.screenshot({ path: `${OUT}/${tag}-${W}x${H}-top.png` });
  const srcs = await p.evaluate(() => [...document.querySelectorAll('.army-card img.army-face, .army-card img.army-face-sm')].map((i) => `${i.className} ${i.naturalWidth}x${i.naturalHeight} -> ${i.getBoundingClientRect().width.toFixed(0)}x${i.getBoundingClientRect().height.toFixed(0)} ${i.src.split('/assets/')[1]}`));
  console.log(tag, p.errors, '\n' + srcs.join('\n'));
  await p.ctx.close();
}
await b.close();
