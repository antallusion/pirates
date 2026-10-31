// Proof shots (forum post 40): «Пересесть» — the ship on her way with her countdown (the berth card and the port's head);
// the harbour's ring at sea («Войти в порт», «Приблизиться», «Карточка порта»); the hull's toast after a bump on the
// rocks. 844×390 (touch) and 1366×768, RU.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa40.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/forum40.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/forum40';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: [...(process.env.SWIFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']), `--qa-tag=pc${port}`] });
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
/** The men's question (the new hull's hammocks): «Рассчитать». */
const payOff = (p) => p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^(Рассчитать|Pay them off)$/.test(x.textContent.trim()) && x.offsetParent)?.click()).catch(() => {});
const self = (p) => p.evaluate(() => { const s = globalThis.gravetide.state.self; return { docked: s?.dockedAt ?? null, berths: s?.berths?.length ?? 0, call: s?.berthCall ?? null, cls: s?.loadout?.classId }; });

async function shoreBump(p, tag) {
  // ---- 3. a bump on the rocks: off the nearest coast, bow on into it at full sail
  const run = await p.evaluate(() => {
    const st = globalThis.gravetide.state, o = st.ownDisplay;
    let best = null, bd = Infinity;
    for (const is of st.islands.values()) {
      if (!is.poly || is.poly.length < 6) continue;
      for (let i = 0; i < is.poly.length; i += 2) {
        const d = Math.hypot(is.poly[i] - o.x, is.poly[i + 1] - o.y);
        if (d > 600 && d < bd) { bd = d; best = { x: is.poly[i], y: is.poly[i + 1], cx: is.x, cy: is.y }; }
      }
    }
    const dx = best.x - best.cx, dy = best.y - best.cy, l = Math.hypot(dx, dy) || 1;
    return { x: Math.round(best.x + (dx / l) * 170), y: Math.round(best.y + (dy / l) * 170), tx: best.x, ty: best.y };
  });
  await L.send(p, { t: 'autosail', stop: true });
  await L.say(p, `/tp ${run.x} ${run.y}`);
  await L.sleep(2500);
  await dismiss(p);
  let hit = null;
  for (let i = 0; i < 300 && !hit; i++) {
    await p.evaluate(([tx, ty, k]) => {
      const g = globalThis.gravetide, o = g.state.ownDisplay;
      const want = Math.atan2(tx - o.x, -(ty - o.y));
      let d = want - o.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // (the client's own input carries her helm and canvas: set there, as a finger on the stick would)
      g.state.input.sail = 1;
      g.state.input.rudder = Math.max(-1, Math.min(1, d * 2));
      g.net.send({ t: 'input', seq: ++g.state.input.seq, rudder: g.state.input.rudder, sail: 1 });
    }, [run.tx, run.ty, i]);
    await L.sleep(150);
    hit = (await L.toasts(p)).find((t) => /Удар о|Struck/.test(t)) ?? null;
  }
  L.log(tag, 'bump toast', hit);
  if (!hit) return false;
  await snap(p, `${OUT}/3-shore-bump-${tag}.png`);
  return true;
}

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await dismiss(p);
    await L.say(p, '/level 12');
    await L.say(p, '/silver 50000');
    await L.say(p, '/fog all');
    await L.say(p, '/weather calm');
    await L.sleep(800);
    for (let k = 0; k < 4 && !(await shoreBump(p, tag)); k++); // (first: a light hull at full sail — the bought cutter with the hold across runs overladen)
    // ---- 1. «Причал»: a hull bought and the old one kept, then «Пересесть» — she is on her way
    let s = await self(p);
    if (!s.docked) {
      const home = await p.evaluate(() => { const st = globalThis.gravetide.state, o = st.ownDisplay; return [...st.ports].sort((a, c) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(c.x - o.x, c.y - o.y))[0].id; });
      await L.say(p, `/tp ${home}`);
      await L.sleep(2000);
      await L.send(p, { t: 'dock' });
      await L.sleep(2500);
    }
    await dismiss(p);
    await L.send(p, { t: 'shipyard', action: 'buy_ship', classId: 'cutter', keep: true });
    await L.sleep(1500);
    await payOff(p);
    await L.sleep(1000);
    s = await self(p);
    L.log(tag, 'after buy', JSON.stringify(s), JSON.stringify(await L.toasts(p)));
    await L.open(p, null);
    await L.open(p, 'port');
    await L.sleep(1200);
    await p.evaluate(() => document.querySelector('[data-ptab="berths"]')?.click());
    await L.sleep(800);
    await p.evaluate(() => document.querySelector('[data-act="berth_swap"]')?.click());
    await L.sleep(1500);
    await payOff(p);
    await L.sleep(3500);
    s = await self(p);
    L.log(tag, 'called', JSON.stringify(s.call), JSON.stringify(await L.toasts(p)));
    const card = await p.evaluate(() => [document.querySelector('.bth-coming')?.textContent, document.querySelector('.bth-fig')?.textContent]);
    L.log(tag, 'card/head', JSON.stringify(card));
    await snap(p, `${OUT}/1-berth-coming-${tag}.png`);
    // ---- 2. the harbour's ring: out to sea, the harbour's name tapped (clicked)
    await L.open(p, null);
    await L.send(p, { t: 'undock' });
    await L.sleep(3500);
    await dismiss(p);
    await L.closeAll(p);
    // off the harbour's mouth, the harbour up and to one side of her on the screen
    const off = await p.evaluate((phone) => {
      const g = globalThis.gravetide, st = g.state, o = st.ownDisplay, z = g.renderer.zoom;
      const pt = [...st.ports].sort((a, c) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(c.x - o.x, c.y - o.y))[0];
      const is = [...st.islands.values()].find((i) => i.portId === pt.id || i.town === pt.id);
      const dx = pt.x - (is?.x ?? pt.x - 1), dy = pt.y - (is?.y ?? pt.y), l = Math.hypot(dx, dy) || 1;
      const k = Math.min(380, (phone ? 45 : 110) / z);
      return { x: Math.round(pt.x + (dx / l) * k), y: Math.round(pt.y + (dy / l) * k) };
    }, W < 1000);
    await L.send(p, { t: 'autosail', stop: true });
    await L.say(p, `/tp ${off.x} ${off.y}`);
    await L.sleep(1000);
    await p.evaluate(() => { const st = globalThis.gravetide.state; st.input.sail = 0; st.input.rudder = 0; globalThis.gravetide.net.send({ t: 'input', seq: ++st.input.seq, rudder: 0, sail: 0 }); }); // (hove to: the harbour stays in sight)
    await L.sleep(4000);
    await dismiss(p);
    const lab = await p.evaluate(() => {
      const g = globalThis.gravetide, st = g.state, r = g.renderer, o = st.ownDisplay;
      const pt = [...st.ports].sort((a, c) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(c.x - o.x, c.y - o.y))[0];
      const z = r.zoom, fs = Math.round(Math.max(12, Math.min(22, 14 * z)));
      return { id: pt.id, x: r.sx(pt.x), y: r.sy(pt.y) - 40 * z - fs * 0.35 };
    });
    L.log(tag, 'label', JSON.stringify(lab), 'at it', await p.evaluate(([x, y]) => globalThis.gravetide.portLabelAt(x, y), [lab.x, lab.y]), 'fogged', await p.evaluate((id) => { const st = globalThis.gravetide.state; const pt = st.ports.find((x) => x.id === id); return JSON.stringify({ seen: !!st.seen, own: st.ownDisplay && [Math.round(st.ownDisplay.x), Math.round(st.ownDisplay.y)], pt: [pt.x, pt.y] }); }, lab.id));
    if (W < 1000) await p.touchscreen.tap(lab.x, lab.y);
    else await p.mouse.click(lab.x, lab.y);
    await L.sleep(900);
    L.log(tag, 'ring state', JSON.stringify(await p.evaluate(() => ({ about: globalThis.gravetidePortRing.about(), closed: globalThis.gravetidePortRing.closed(), modal: globalThis.gravetide.modal(), cls: document.querySelector('#pmenu')?.className }))));
    const ring = await p.evaluate(() => [...document.querySelectorAll('#pmenu:not(.hidden) .tm-item')].map((e) => { const r = e.getBoundingClientRect(); return `${e.textContent.trim()}@${Math.round(r.left)},${Math.round(r.top)}`; }));
    L.log(tag, 'ring', JSON.stringify(ring));
    await snap(p, `${OUT}/2-port-ring-${tag}.png`);
    // «Приблизиться» picked: the helmsman to the roads
    await L.sleep(400);
    await p.evaluate(() => document.querySelector('#pmenu [data-tm="near"]')?.click());
    await L.sleep(1500);
    L.log(tag, 'after near: autosail', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.autosail ?? null)), JSON.stringify(await L.toasts(p)));
    L.log(tag, 'errors', JSON.stringify(p.errors?.slice(0, 5) ?? []));
    await p.context().close();
  }
} finally {
  await b.close();
}
