// Proof shots (forum post 48): the offer card's buttons in one row (the «‹ ›» on the dots' line), the arc round the helm
// under the helmsman's chase (the auto-battle's hand), the jury sail's state with its line and arc. RU.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f48.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/forum48.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum48';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const out = {};
const clean = (p) => p.evaluate(() => {
  globalThis.gravetide.open(null);
  document.getElementById('promo-over')?.querySelector('[data-polater]')?.click();
  for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
}).catch(() => {});
/** The offer card's row: every button on one line, nothing past the row, the arrows on the dots' line. */
const rowCheck = (p) => p.evaluate(() => {
  const o = document.getElementById('promo-over');
  const row = o?.querySelector('.po-acts');
  if (!row) return { err: 'no card' };
  const bs = [...row.querySelectorAll('button')];
  const R = row.getBoundingClientRect();
  const tops = new Set(bs.map((x) => Math.round(x.getBoundingClientRect().top)));
  // (a label cut: its text wider than the button's box less its padding)
  const cut = bs.filter((x) => {
    const r = document.createRange();
    r.selectNodeContents(x);
    const cs = getComputedStyle(x);
    return r.getBoundingClientRect().width > x.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1;
  }).map((x) => x.textContent.trim());
  const past = bs.filter((x) => { const r = x.getBoundingClientRect(); return r.right > R.right + 1 || r.left < R.left - 1; }).length;
  const dots = o.querySelector('.po-dots');
  const nav = dots ? [...dots.querySelectorAll('.po-nav')].map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) : [];
  return { buttons: bs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()), lines: tops.size, rowW: Math.round(R.width), scroll: row.scrollWidth, client: row.clientWidth, past, cut, nav, card: Math.round(o.querySelector('.po-box').getBoundingClientRect().width) };
});
const arc = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, st = document.getElementById('tc-stick'), y = g.state.you;
  return { a: st?.style.getPropertyValue('--a'), o: st?.style.getPropertyValue('--o'), torn: st?.classList.contains('torn'), lit: st?.dataset.lit, speed: document.getElementById('tc-speed')?.textContent, aria: document.getElementById('tc-speed')?.getAttribute('aria-label'), you: y ? { sail: +y.sail.toFixed(2), sailT: +y.sailT.toFixed(2), sails: Math.round(y.sails), sailsMax: y.sailsMax } : null, step: g.state.input.sail, pursuit: !!g.state.pursuit, info: document.querySelector('#hud-actinfo, .act-info, #tc-actinfo')?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
});
async function snap(p, path) {
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) L.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}

try {
  for (const [W, H] of [[1366, 768], [844, 390]]) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1000 });
    await L.login(p, { port, know: true });
    await L.say(p, '/level 12');
    await L.sleep(800);
    await L.send(p, { t: 'undock' });
    await L.sleep(4000);
    for (let i = 0; i < 3; i++) { await clean(p); await L.sleep(400); }
    // 1. the offer card with several offers (arrows and dots), measured at each size of the post
    await L.say(p, '/offers roll');
    await L.sleep(1500);
    await p.evaluate(() => { const pr = globalThis.gravetide.promos; const cs = pr.view?.cards ?? []; pr.open(cs.length ? cs : pr.cardsFor('sea'), 'entry'); });
    await L.sleep(900);
    const sizes = W === 1366 ? [[1366, 768], [1366, 710], [1093, 481]] : [[844, 390]];
    for (const [w, h] of sizes) {
      await p.setViewportSize({ width: w, height: h });
      await L.sleep(700);
      out[`offer_${w}x${h}`] = await rowCheck(p);
      if (w === W && h === H) await snap(p, `${OUT}/offer_${tag}.png`);
    }
    await p.setViewportSize({ width: W, height: H });
    await clean(p);
    await L.sleep(600);
    // 3. the jury sail: her sails shot away, no sailcloth, full sail ordered
    await p.evaluate(() => { const g = globalThis.gravetide; g.state.input.sail = 4; });
    await L.say(p, '/adrift 0');
    await L.sleep(6000);
    out[`jury_${tag}`] = await arc(p);
    out[`jury_${tag}`].bar = await p.evaluate(() => [...document.querySelectorAll('[data-act="jury"], #tc-actrow .k-btn, #hud-acts button')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /Аварийн/.test(t)));
    out[`jury_${tag}`].line = await p.evaluate(() => { const t = [...document.querySelectorAll('body *')].find((e) => e.children.length === 0 && /Корабль без парусов/.test(e.textContent)); return t?.textContent.replace(/\s+/g, ' ').trim() ?? null; });
    await snap(p, `${OUT}/jury_${tag}.png`);
    await L.say(p, '/heal');
    await L.sleep(1500);
    // 2. the arc under the helmsman's chase (the auto-battle's hand): a pirate a mile off, «Атаковать»
    const foe = await p.evaluate(async () => {
      const g = globalThis.gravetide;
      g.net.send({ t: 'chat', text: '/foe pirate brig 900' });
      await new Promise((r) => setTimeout(r, 1500));
      const me = g.state.ownDisplay;
      let best = null, bd = Infinity;
      for (const [id, s] of g.state.ships) { const d = Math.hypot(s.cur.x - me.x, s.cur.y - me.y); if (d < bd && d > 10) { bd = d; best = id; } }
      g.state.input.sail = 0; // (the captain's own step at nothing: the helmsman's sail is what shows)
      if (best !== null) g.net.send({ t: 'attack', target: best, mode: 'guns' });
      await new Promise((r) => setTimeout(r, 1500));
      return { id: best, d: Math.round(bd), pursuit: g.state.pursuit, toasts: [...document.querySelectorAll('#toasts > .toast')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()) };
    });
    // (the shot when the helmsman has her under way on the chase: up to 10 s)
    let seen = await arc(p);
    for (let i = 0; i < 20 && !(seen.pursuit && seen.you && seen.you.sail > 0.4); i++) { await L.sleep(500); seen = await arc(p); }
    out[`chase_${tag}`] = { foe, ...seen };
    await snap(p, `${OUT}/arc_chase_${tag}.png`);
    await L.send(p, { t: 'attack', stop: true });
    out[`errors_${tag}`] = p.errors.slice(0, 5);
    await p.ctx.close();
  }
} finally {
  console.log(JSON.stringify(out, null, 1));
  await b.close();
}
