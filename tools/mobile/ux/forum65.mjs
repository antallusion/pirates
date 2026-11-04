// Proof shots (Эдуард, forum posts 65, 67, 68): the chart's «Найти» (typing, the hits, the island turned to with
// «Проложить курс»), the ring on a wreck of the drowned without and with the Drowned Shrine, the «Верфи» layer before
// and after a sea's chart is bought. RU, 844×390 (touch) and 1366×768.
//   PORT=58820 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f65.db node server/src/main.ts
//   GPORT=58820 node tools/mobile/ux/forum65.mjs
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum65';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58820);
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=f65${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=f65${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const out = {};
const clean = (p) => p.evaluate(() => {
  globalThis.gravetide.open(null);
  document.getElementById('promo-over')?.querySelector('[data-polater]')?.click();
  for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
}).catch(() => {});
async function snap(p, path) {
  await p.evaluate(() => document.querySelectorAll('.k-hint, #toasts > .toast').forEach((x) => x.remove())).catch(() => {});
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) console.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
/** The find bar measured: on the screen, inside the chart, its hits' rows inside it. */
const findBox = (p) => p.evaluate(() => {
  const bar = document.querySelector('.map-find'), wrap = document.querySelector('.map-wrap');
  if (!bar || !wrap) return null;
  const B = bar.getBoundingClientRect(), W = wrap.getBoundingClientRect();
  const rows = [...bar.querySelectorAll('.mf-hit')].map((r) => ({ t: r.innerText.replace(/\s+/g, ' ').trim(), over: r.scrollWidth > r.clientWidth + 1 }));
  const sail = bar.querySelector('[data-mfsail]')?.getBoundingClientRect();
  return { inChart: B.left >= W.left - 1 && B.top >= W.top - 1 && B.right <= W.right + 1 && B.bottom <= W.bottom + 1, box: [Math.round(B.left), Math.round(B.top), Math.round(B.width), Math.round(B.height)], rows, pick: bar.querySelector('.mf-pick')?.innerText.replace(/\s+/g, ' ').trim() ?? null, sail: sail ? [Math.round(sail.left), Math.round(sail.top), Math.round(sail.width), Math.round(sail.height)] : null, sailIn: sail ? sail.right <= B.right + 1 && sail.bottom <= B.bottom + 1 : null };
});
const ringText = (p) => p.evaluate(() => {
  const m = document.getElementById('tmenu');
  if (!m || m.classList.contains('hidden')) return null;
  return [...m.querySelectorAll('.tm-item')].map((b) => ({ id: b.dataset.tm, label: b.querySelector('.tm-l')?.innerText.replace(/\s+/g, ' ').trim(), r: (() => { const r = b.querySelector('.tm-l').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })() }));
});

try {
  for (const [W, H] of [[844, 390], [1366, 768]]) {
    const tag = `${W}x${H}`;
    const touch = W < 1000;
    const p = await L.page(b, [W, H], { lang: 'ru', touch });
    await L.login(p, { port, know: true });
    await L.say(p, '/level 20');
    await L.say(p, '/silver 500000');
    await L.sleep(800);
    for (let i = 0; i < 3; i++) { await clean(p); await L.sleep(400); }

    // ---------------------------------------------------------------- 68. the yards: before
    await L.say(p, '/tp gravesend');
    await L.sleep(1500);
    await L.send(p, { t: 'dock' });
    await L.sleep(2500);
    for (let i = 0; i < 2; i++) { await clean(p); await L.sleep(400); }
    const yardsView = async (name) => {
      await p.evaluate(() => {
        const c = globalThis.gravetide.chart;
        c.layers = new Set(['ports', 'yards']);
        c.centred = true;
        c.cx = 60000; c.cy = 72000; c.zoom = 4; // Gravewater: Hollowmere (yard 3), Tidewrack (yard 2)
      });
      await L.open(p, 'map');
      await L.sleep(1500);
      await snap(p, `${OUT}/${name}_${tag}.png`);
      out[`${name}_${tag}`] = await p.evaluate(() => {
        const s = globalThis.gravetide.state;
        const found = new Set([...s.discovered].map((id) => s.islands.get(id)?.portId));
        return s.ports.filter((x) => x.region === 'gravewater' && x.shipyardTier > 0).map((x) => ({ id: x.id, tier: x.shipyardTier, charted: found.has(x.id) }));
      });
      await L.open(p, null);
      await L.sleep(400);
    };
    await yardsView('yards_before');
    // the sea's chart bought at the cartographer's
    const offers = await p.evaluate(() => globalThis.gravetide.state.portView?.charts?.offers ?? []);
    out[`offers_${tag}`] = offers;
    const gw = offers.find((o) => o.region === 'gravewater') ?? offers[0];
    if (gw) {
      await L.send(p, { t: 'chart', action: 'buy', region: gw.region });
      await L.sleep(3000);
    }
    await yardsView('yards_after');

    // ---------------------------------------------------------------- 65. «Найти»
    await L.send(p, { t: 'undock' });
    await L.sleep(3000);
    for (let i = 0; i < 2; i++) { await clean(p); await L.sleep(400); }
    const q = await p.evaluate(() => {
      // two letters that more than one place she knows begins (or a word of it)
      const s = globalThis.gravetide.state;
      const names = [...s.discovered].map((id) => s.islands.get(id)?.name).filter(Boolean);
      const count = {};
      for (const n of names) for (const w of n.toLowerCase().replace(/ё/g, 'е').split(/[\s-]+/)) { const k = w.slice(0, 2); if (k.length === 2) count[k] = (count[k] ?? 0) + 1; }
      return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'по';
    });
    await p.evaluate(() => { const c = globalThis.gravetide.chart; c.layers = new Set(['ports', 'goals', 'lairs', 'treasure']); });
    await L.open(p, 'map');
    await L.sleep(1200);
    await p.click('[data-mfind]');
    await L.sleep(500);
    await p.keyboard.type(q, { delay: 120 });
    await L.sleep(800);
    out[`find_typing_${tag}`] = { q, ...(await findBox(p)) };
    await snap(p, `${OUT}/find_typing_${tag}.png`);
    // a few more letters: the first hit's name to four
    const first = await p.evaluate(() => document.querySelector('.mf-hit .mf-n')?.textContent ?? '');
    const q2 = first.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(q.length + 1, 4));
    await p.fill('#map-find-q', '');
    await p.keyboard.type(q2, { delay: 90 });
    await L.sleep(700);
    out[`find_results_${tag}`] = { q: q2, ...(await findBox(p)) };
    await snap(p, `${OUT}/find_results_${tag}.png`);
    if (touch) await p.tap('.mf-hit');
    else await p.click('.mf-hit');
    await L.sleep(1200);
    out[`find_pick_${tag}`] = await findBox(p);
    out[`find_wp_${tag}`] = await p.evaluate(() => JSON.parse(localStorage.getItem('gravetide.waypoint') ?? 'null'));
    await snap(p, `${OUT}/find_pick_${tag}.png`);
    // «Проложить курс»: the chart shuts onto the course
    await p.click('[data-mfsail]');
    await L.sleep(1500);
    out[`find_sail_${tag}`] = await p.evaluate(() => ({ modal: globalThis.gravetide.modal(), course: !!globalThis.gravetide.state.autosail || !!globalThis.gravetide.goalRun() }));
    await snap(p, `${OUT}/find_sailing_${tag}.png`);
    await L.send(p, { t: 'autosail', stop: true }).catch(() => {});

    // ---------------------------------------------------------------- 67. the drowned's ring
    await L.say(p, '/god');
    const ringOn = async (name) => {
      await L.say(p, '/guard go wreck');
      await L.sleep(3000);
      // her ship a little west of the guard: the guard right of the screen's middle, clear of the HUD's controls
      const gxy = await p.evaluate(() => { const s = globalThis.gravetide.state, o = s.ownDisplay; const m = (s.adv?.guards ?? []).filter((x) => x.kind === 'wreck').sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0]; return m ? [m.x, m.y] : null; });
      if (gxy) await L.say(p, `/tp ${Math.round(gxy[0] - 120)} ${Math.round(gxy[1] - 20)}`);
      await L.sleep(4000);
      for (let i = 0; i < 2; i++) { await clean(p); await L.sleep(300); }
      await p.evaluate(() => { const s = globalThis.gravetide.state; if (s.input) { s.input.sailTarget = 0; s.input.sail = 0; } globalThis.gravetide.renderer.recentre?.(); });
      let at = null;
      for (let i = 0; i < 12; i++) {
        at = await p.evaluate(() => {
          const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
          const m = (s.adv?.guards ?? []).filter((x) => x.kind === 'wreck' && x.e !== undefined && s.ships.get(x.e)).sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0];
          if (!m) return null;
          const sh = s.ships.get(m.e);
          return { e: m.e, x: g.renderer.sx(sh.cur.x), y: g.renderer.sy(sh.cur.y), shrine: !!s.adv.shrine };
        });
        if (at && at.x > W * 0.15 && at.x < W * 0.85 && at.y > H * 0.2 && at.y < H * 0.72) break;
        if (i === 5 && gxy) await L.say(p, `/tp ${Math.round(gxy[0] - 120)} ${Math.round(gxy[1] - 20)}`); // (once more: she had way on)
        await L.sleep(1000);
      }
      out[`${name}_at_${tag}`] = at;
      if (!at) return;
      if (touch) await p.touchscreen.tap(Math.round(at.x), Math.round(at.y));
      else { await p.mouse.move(Math.round(at.x), Math.round(at.y), { steps: 4 }); await p.mouse.click(Math.round(at.x), Math.round(at.y)); } // (a desk: the ring is a click's, forum 45)
      await L.sleep(1200);
      let rt = await ringText(p);
      for (let i = 0; i < 3 && !rt; i++) {
        // (an end of the helmsman's run put it away: once more)
        if (touch) await p.touchscreen.tap(Math.round(at.x), Math.round(at.y));
        else await p.mouse.click(Math.round(at.x), Math.round(at.y));
        await L.sleep(900);
        rt = await ringText(p);
      }
      out[`${name}_${tag}`] = rt;
      for (let i = 0; i < 3; i++) { try { await p.screenshot({ path: `${OUT}/${name}_${tag}.png`, timeout: 90000 }); break; } catch { await L.sleep(1000); } }
    };
    await ringOn('ring_noshrine');
    // her island and its whole town: the Drowned Shrine with it
    await L.say(p, '/isle 3');
    await L.sleep(600);
    await L.say(p, '/town');
    await L.sleep(3000);
    await ringOn('ring_shrine');
    // «Переговоры»: the weak guard heard out — the card over the sea
    await L.say(p, '/ship frigate 10');
    await L.say(p, '/army level 10');
    await L.say(p, '/morale 100');
    await L.say(p, '/guard weak wreck');
    await L.sleep(2500);
    const e = out[`ring_shrine_at_${tag}`]?.e;
    if (e !== undefined) {
      await p.evaluate((id) => globalThis.gravetide.aim.pick('talk', `ship:${id}`), e);
      const seen = [];
      let shot = false;
      for (let i = 0; i < 16; i++) {
        await L.sleep(1000);
        for (const t of await L.toasts(p)) if (!seen.includes(t)) seen.push(t);
        const card = await p.evaluate(() => { const c = document.querySelector('.ac-gcard'); return c && c.getClientRects().length ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
        out[`talk_${tag}`] = { toasts: seen, card, advCard: await p.evaluate(() => JSON.stringify(globalThis.gravetide.state.advCard)?.slice(0, 400) ?? null) };
        // the guard's card folds into «Осмотреть…» at the foot: opened, it shows their answer
        if (!card && seen.some((t) => /выслушали/.test(t))) await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Осмотреть/.test(b.innerText.trim()) && b.getClientRects().length)?.click());
        if (card && /Отпустить|Взять/.test(card) && !shot) {
          await p.screenshot({ path: `${OUT}/talk_${tag}.png`, timeout: 90000 }).catch(() => {});
          shot = true;
          break;
        }
      }
      if (!shot) await p.screenshot({ path: `${OUT}/talk_${tag}.png`, timeout: 90000 }).catch(() => {});
    }
    out[`errors_${tag}`] = p.errors;
    await p.ctx.close();
  }
} finally {
  writeFileSync(`${OUT}/out.json`, JSON.stringify(out, null, 1));
  await b.close();
}
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
