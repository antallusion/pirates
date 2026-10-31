// Proof shots (owner, 2026-11-01: «в кружочке есть только нанять, мне нужно нападение, то есть атаковать или
// поговорить, применяется ко всем кораблям»). At 844×390 (a phone, touch) and 1366×768, RU:
//   the ring on a merchant under the city flag («Атаковать» dimmed + «Поговорить» + ⓘ); the hail («Нанять в охрану»,
//   «Пропустить»); the attack refused («Нападение на мирное судно…», «Как сменить флаг»); the ring under the pirate flag.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-hail.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/hail.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/hail';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=hail${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=hail${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
const nearest = (p, role) => p.evaluate((r) => {
  const st = globalThis.gravetide.state, o = st.ownDisplay;
  let best = null, bd = Infinity;
  for (const s of st.ships.values()) {
    if (!s.info || s.id === st.entityId || s.info.npcRole !== r) continue;
    const d = Math.hypot(s.cur.x - o.x, s.cur.y - o.y);
    if (d < bd) [best, bd] = [s.id, d];
  }
  return best;
}, role);
/** The ring about a ship, opened as a tap would; what it offers. */
const ring = (p, id) => p.evaluate((i) => {
  const g = globalThis.gravetide;
  const t = g.aim.choices(`ship:${i}`);
  if (!t) return null;
  g.aim.menu.show(`ship:${i}`, t.choices, t.name, !!t.info);
  g.aim.menu.place(t.x, t.y, t.r, []);
  return { name: t.name, choices: t.choices.map((c) => `${c.label}${c.off ? ' (dim)' : ''}`), info: !!t.info };
}, id);
/** A tap (a phone) or a click (a desk) on the ship where she is on the screen. */
async function tapOn(p, id, touch) {
  const t = await p.evaluate((i) => { const c = globalThis.gravetide.aim.choices(`ship:${i}`); return c ? { x: c.x, y: c.y } : null; }, id);
  if (!t) return;
  if (touch) await p.touchscreen.tap(t.x, t.y);
  else {
    await p.mouse.move(t.x, t.y);
    await L.sleep(300);
    await p.mouse.click(t.x, t.y);
  }
}
const bar = (p) => p.evaluate(() => [...document.querySelectorAll('[data-act], .act-btn')].filter((x) => x.offsetParent).map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
const sheet = (p, sel) => p.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, ' ').trim() ?? null, sel);
/** Hold her still near a ship (the merchant keeps her course; the camera and the ring follow her). */
const halt = (p) => L.send(p, { t: 'input', seq: Date.now() % 100000, rudder: 0, sail: 0 });

try {
  for (const [W, H] of [[844, 390], [1366, 768]]) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/level 30');
    await L.say(p, '/silver 200000');
    await L.say(p, '/flag faction');
    await L.sleep(800);
    await dismiss(p);
    await L.closeAll(p);
    await L.send(p, { t: 'undock' });
    await L.sleep(4000);
    await dismiss(p);
    await L.closeAll(p);
    await halt(p);
    await L.say(p, '/heading ' + (process.env.HEAD ?? '0'));
    await L.sleep(400);
    await L.say(p, '/spawn merchant fluyt league 5');
    await L.sleep(1500);
    const m = await nearest(p, 'merchant');
    L.log(tag, 'merchant', m);
    if (m === null) continue;
    // (she lies 300 m off the beam and sails on: the chart's eye pulled back so she is on a phone's screen too)
    await p.evaluate((ph) => { const r = globalThis.gravetide.renderer; r.userZoomed = true; r.targetZoom = r.seenZoom = r.targetZoom * (ph ? 0.5 : 0.6); }, W < 1000);
    await L.sleep(1200);
    // 1. The ring on a merchant under the city flag: a real tap (a click on a desk) on her.
    await tapOn(p, m, W < 1000);
    await L.sleep(700);
    L.log(tag, 'ring (city flag)', JSON.stringify(await ring(p, m)));
    await L.sleep(400);
    L.log(tag, 'bar', JSON.stringify(await bar(p)));
    await p.screenshot({ path: `${OUT}/ring-merchant-city-${tag}.png` });
    // 2. «Поговорить»: the hail.
    await p.evaluate((i) => globalThis.gravetide.aim.pick('talk', `ship:${i}`), m);
    await L.sleep(700);
    L.log(tag, 'hail', await sheet(p, '#hail'));
    await p.screenshot({ path: `${OUT}/hail-merchant-${tag}.png` });
    await p.evaluate(() => document.querySelector('#hail [data-hail="pass"]')?.click());
    await L.sleep(500);
    // 3. «Атаковать» refused: why, «Как сменить флаг»; nothing sent (no pursuit, no mark of the grapples).
    await p.evaluate((i) => globalThis.gravetide.aim.pick('fight', `ship:${i}`), m);
    await L.sleep(700);
    L.log(tag, 'refusal', await sheet(p, '#confirm'), 'pursuit', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.pursuit ?? null)));
    await p.screenshot({ path: `${OUT}/attack-refused-${tag}.png` });
    await p.evaluate(() => document.querySelector('#confirm [data-no]')?.click());
    await L.sleep(400);
    // 4. The pirate flag: the ring lit — «Атаковать», «Поговорить» (and «На абордаж» within 100 m).
    await L.say(p, '/flag pirate');
    await L.sleep(900);
    await halt(p);
    L.log(tag, 'ring (pirate flag)', JSON.stringify(await ring(p, m)));
    await L.sleep(300);
    await p.screenshot({ path: `${OUT}/ring-merchant-pirate-${tag}.png` });
    await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
    // «Атаковать» under the pirate flag: the guns (a pursuit in 'guns')
    await p.evaluate((i) => globalThis.gravetide.aim.pick('fight', `ship:${i}`), m);
    await L.sleep(1200);
    L.log(tag, 'attack (pirate flag) pursuit', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.pursuit ?? null)));
    await L.send(p, { t: 'attack', stop: true });
    if (p.errors.length) L.log(tag, 'page errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.ctx.close();
  }
} finally {
  await b.close();
}
