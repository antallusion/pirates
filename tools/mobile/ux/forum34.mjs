// Proof shots (forum, Нефигугум 2026-10-31, post 34): the three flags. At 844×390 (a phone, touch) and 1366×768, RU:
//   the flag card (clean, and with skulls: locked, the wash); the city flag's refusal at a merchant; a pirate attacking a
//   merchant; the hue and cry (a patrol out of the harbour after a skulled pirate); a lawful harbour refusing her; the
//   ring on the Drowned's wreck — «Атаковать» alone.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-forum34.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/forum34.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/forum34';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=f34${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=f34${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
const toasts = (p) => p.evaluate(() => {
  // every toast that came up since the last ask (a watcher on the page: the short ones are gone by the time we look)
  if (!globalThis.__seen) {
    globalThis.__seen = [];
    globalThis.__raw = [];
    globalThis.gravetide.net.on((m) => { if (m.t === 'toast') globalThis.__raw.push(m.msg); });
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) globalThis.__seen.push(n.innerText.replace(/\s+/g, ' ').trim()); }).observe(document.body, { childList: true, subtree: true });
  }
  return globalThis.__seen.splice(0);
});
/** The nearest ship of a role (or a guard's), her id. */
const nearest = (p, pred) => p.evaluate((src) => {
  const f = new Function('s', `return (${src})(s)`);
  const st = globalThis.gravetide.state, o = st.ownDisplay;
  let best = null, bd = Infinity;
  for (const s of st.ships.values()) {
    if (!s.info || s.id === st.entityId || !f(s)) continue;
    const d = Math.hypot(s.cur.x - o.x, s.cur.y - o.y);
    if (d < bd) [best, bd] = [s.id, d];
  }
  return best;
}, pred.toString());
/** The ring of choices about a ship, opened as a tap would. */
const ring = (p, id) => p.evaluate((i) => {
  const g = globalThis.gravetide;
  const t = g.aim.choices(`ship:${i}`);
  if (!t) return null;
  g.aim.menu.show(`ship:${i}`, t.choices, t.name, !!t.info);
  g.aim.menu.place(t.x, t.y, t.r, []);
  const it = document.querySelector("#tmenu .tm-item")?.getBoundingClientRect();
  return { name: t.name, x: Math.round(t.x), y: Math.round(t.y), r: Math.round(t.r), item: it ? [Math.round(it.left), Math.round(it.top)] : null, choices: t.choices.map((c) => c.label), single: document.getElementById("tmenu")?.classList.contains("tm-single") };
}, id);
const portTab = (p, word) => p.evaluate((w) => {
  const b = [...document.querySelectorAll('#modal-panel button, #modal button')].find((x) => x.offsetParent && x.textContent.trim().startsWith(w));
  b?.click();
  return !!b;
}, word);
const want = (k) => !only || only.includes(k);

try {
  for (const [W, H] of [[844, 390], [1366, 768]]) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/level 30');
    await L.say(p, '/silver 200000');
    await L.sleep(800);
    await dismiss(p);
    await L.closeAll(p);
    await toasts(p);
    // 1. The flag card in port: the three modes; then with skulls under the pirate flag (locked, the wash, the pardon).
    if (want('card')) {
      await L.open(p, 'port');
      await L.sleep(1200);
      L.log(tag, 'flag tab', await portTab(p, 'Флаг'));
      await L.sleep(800);
      await p.screenshot({ path: `${OUT}/flag-card-city-${tag}.png` });
      await L.say(p, '/flag pirate');
      await L.say(p, '/skulls 2');
      await L.sleep(900);
      await L.closeAll(p);
      await L.open(p, 'port');
      await L.sleep(1000);
      await portTab(p, 'Флаг');
      await L.sleep(800);
      await p.screenshot({ path: `${OUT}/flag-card-skulls-${tag}.png` });
      L.log(tag, 'card', await p.evaluate(() => document.querySelector('.fl-card')?.innerText.replace(/\s+/g, ' ').slice(0, 400)));
      await L.say(p, '/skulls 0');
      await L.say(p, '/flag faction');
      await L.sleep(600);
      await L.closeAll(p);
    }
    // To sea, off Saltmarrow.
    await L.send(p, { t: 'undock' });
    await L.sleep(4000);
    await dismiss(p);
    await L.closeAll(p);
    // 2. The city flag: a merchant marked, «Огонь» (Space) — refused, and why; no hunt sent off after a shark.
    await L.say(p, '/spawn merchant fluyt league 3');
    await L.sleep(1500);
    const m = await nearest(p, (s) => s.info.npcRole === 'merchant');
    L.log(tag, 'merchant', m);
    if (want('refuse') && m !== null) {
      await p.evaluate((i) => globalThis.gravetide.target(i), m);
      await L.sleep(300);
      const r = await ring(p, m);
      L.log(tag, 'ring on a merchant (city flag)', JSON.stringify(r));
      await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
      await p.keyboard.press('Space');
      await L.sleep(900);
      L.log(tag, 'toasts', JSON.stringify(await toasts(p)), 'pursuit', JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.pursuit ?? null)));
      await p.screenshot({ path: `${OUT}/refusal-city-${tag}.png` });
    }
    // 3. The pirate flag: «Атаковать» on the merchant — the guns on her, a skull at the first blow, she runs.
    if (want('pirate') && m !== null) {
      await L.say(p, '/flag pirate');
      await L.sleep(700);
      const r = await ring(p, m);
      L.log(tag, 'ring on a merchant (pirate flag)', JSON.stringify(r));
      await p.screenshot({ path: `${OUT}/ring-merchant-pirate-${tag}.png` });
      await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
      await p.evaluate((i) => globalThis.gravetide.target(i), m);
      await L.send(p, { t: 'attack', target: m, mode: 'guns' });
      for (let i = 0; i < 24; i++) {
        await L.sleep(500);
        if (await p.evaluate(() => (globalThis.gravetide.state.self?.pvp?.skulls ?? 0) > 0)) break;
      }
      await L.sleep(1500);
      L.log(tag, 'skulls', await p.evaluate(() => globalThis.gravetide.state.self?.pvp?.skulls), 'toasts', JSON.stringify(await toasts(p)));
      await p.screenshot({ path: `${OUT}/pirate-attacks-merchant-${tag}.png` });
      await L.send(p, { t: 'attack', stop: true });
    }
    // 4. The hue and cry: two skulls under the pirate flag off a Crown harbour — a patrol out after her.
    if (want('hue')) {
      await L.say(p, '/flag pirate');
      await L.say(p, '/skulls 2');
      await L.say(p, '/heal');
      let seen = false;
      for (let i = 0; i < 40 && !seen; i++) {
        await L.sleep(250);
        seen = (await toasts(p)).some((t) => /Закон идёт/.test(t));
      }
      await p.screenshot({ path: `${OUT}/patrol-sally-${tag}.png` });
      // (the chart's eye pulled back a little: the patrols after her in the frame)
      await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.userZoomed = true; r.targetZoom = r.seenZoom = Math.max(0.9, r.targetZoom * 0.55); });
      await L.sleep(6000);
      const pats = await p.evaluate(() => { const st = globalThis.gravetide.state, o = st.ownDisplay; return [...st.ships.values()].filter((s) => s.info?.npcRole === 'patrol').map((s) => ({ d: Math.round(Math.hypot(s.cur.x - o.x, s.cur.y - o.y)), hostile: !!(s.cur.flags & 64) })).sort((a, b) => a.d - b.d).slice(0, 4); });
      L.log(tag, 'sally toast', seen, 'patrols', JSON.stringify(pats));
      await p.screenshot({ path: `${OUT}/patrol-chase-${tag}.png` });
      await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.userZoomed = false; });
    }
    // 5. A lawful harbour refuses two skulls: where to go, how to wash them.
    if (want('port')) {
      await L.say(p, '/skulls 2');
      await L.say(p, '/heal');
      const pt = await p.evaluate(() => { const st = globalThis.gravetide.state, o = st.ownDisplay; return st.ports.map((x) => ({ x: x.x, y: x.y, f: x.faction, d: Math.hypot(x.x - o.x, x.y - o.y) })).sort((a, b) => a.d - b.d)[0]; });
      L.log(tag, 'sail in', await L.sailUntil(p, pt.x, pt.y, 380, 60000));
      await toasts(p);
      let got = null;
      for (let i = 0; i < 6 && !got; i++) {
        await L.send(p, { t: 'dock' });
        for (let k = 0; k < 8 && !got; k++) {
          await L.sleep(250);
          got = (await toasts(p)).find((t) => /не принимают корабль/.test(t)) ?? null;
        }
      }
      L.log(tag, 'port refusal', got, 'raw', JSON.stringify(await p.evaluate(() => globalThis.__raw.splice(0).slice(-3))));
      await p.screenshot({ path: `${OUT}/port-refusal-${tag}.png` });
    }
    // 6. The Drowned's wreck: «Атаковать» alone, one big button.
    if (want('wreck')) {
      await L.say(p, '/skulls 0');
      await L.say(p, '/flag faction');
      await L.say(p, '/heal');
      await L.say(p, '/guard go wreck');
      await L.sleep(9000);
      await L.send(p, { t: 'input', seq: 1, rudder: 0, sail: 0 });
      await L.sleep(3000);
      await dismiss(p);
      await L.closeAll(p);
      const g = await p.evaluate(() => globalThis.gravetide.state.adv?.guards?.filter((x) => x.e).map((x) => ({ e: x.e, kind: x.kind })) ?? []);
      L.log(tag, 'guards', JSON.stringify(g.slice(0, 5)));
      const w = await p.evaluate((ids) => { const st = globalThis.gravetide.state, o = st.ownDisplay; let best = null, bd = Infinity; for (const i of ids) { const s = st.ships.get(i); if (!s) continue; const d = Math.hypot(s.cur.x - o.x, s.cur.y - o.y); if (d < bd) [best, bd] = [i, d]; } return best; }, g.filter((x) => x.kind === 'wreck').map((x) => x.e));
      if (w !== null) {
        const wp = await p.evaluate((i) => { const s = globalThis.gravetide.state.ships.get(i); return { x: s.cur.x, y: s.cur.y }; }, w);
        L.log(tag, 'to the wreck', await L.sailUntil(p, wp.x, wp.y, 110, 45000));
        await L.send(p, { t: 'input', seq: 2, rudder: 0, sail: 0 });
        await p.evaluate(() => globalThis.gravetide.chart.onStop?.());
        await L.sleep(2500);
        let r = null;
        for (let i = 0; i < 8; i++) {
          r = await ring(p, w);
          await L.sleep(120);
        }
        r = await ring(p, w);
        L.log(tag, 'ring on the wreck', JSON.stringify(r));
        await p.screenshot({ path: `${OUT}/ring-drowned-${tag}.png` });
      }
    }
    if (p.errors.length) L.log(tag, 'page errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.ctx.close();
  }
} finally {
  await b.close();
}
