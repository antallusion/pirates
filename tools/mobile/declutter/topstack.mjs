// The owner's top-centre pile (2026-10-29, a phone in Telegram ~1128×554: «одно на другое накладывается, текст не
// видно»): autopilot on, a mark chosen, the island's step up, a toast firing, the carpenters at work. Shots at the
// phone sizes and a desk, and every HUD box measured: no two may intersect (exit code 1 if any do).
//   SIZE=844x390,740x360,1093x481,1128x554,1366x768 GPORT=58810 node tools/mobile/declutter/topstack.mjs
import * as L from '../m0/lib.mjs';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.SHOTS ?? 'assets/raw/audit/declutter/topstack';
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.GPORT ?? 58810);
const sizes = (process.env.SIZE ?? '844x390,740x360,1093x481,1128x554,1366x768').split(',').map((s) => s.split('x').map(Number));
const b = await L.browser();
// (one headless Chrome, at BelowNormal: the owner's CPU)
try {
  const pid = b.process?.()?.pid;
  if (pid) execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq ${pid} -or $_.ParentProcessId -eq ${pid} } | ForEach-Object { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch { /* not on Windows, or gone */ }

async function dismiss(p) {
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => {
      globalThis.gravetide.open(null);
      const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut], [data-gflater], #promo-over [data-polater], .lu-sheet [data-lulater]')].filter((b) => b.getBoundingClientRect().width);
      x.forEach((b) => b.click());
      for (const b of document.querySelectorAll('button')) if (/^\s*Вперёд\s*$/.test(b.textContent) && b.getBoundingClientRect().width) { b.click(); x.push(b); }
      return x.length;
    });
    if (!n) break;
    await L.sleep(400);
  }
}

/** Every HUD box on screen that holds words or a control, and every pair of them that intersects. */
export const measure = (p) => p.evaluate(() => {
  const seen = (e) => {
    if (!e || e.classList.contains('hidden')) return false;
    for (let q = e; q && q !== document.body; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return false; }
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight;
  };
  const sel = [
    ['top', '#hud-stack > :not(#hud-fold)'], ['top', '#hud-fold'], ['toast', '#toasts > .toast'], ['top', '#hud-isle1'],
    ['fixed', '#hud-captain .cs'], ['fixed', '#hud-map'], ['fixed', '#mm-tab'], ['touch', '#touch > *'], ['touch', '#hud-chat > .chat-toggle'],
    ['bottom', '#hud-bottom > #hud-prompt'], ['bottom', '#hud-combat .act-btn'], ['bottom', '#hud-combat .ab-mode'], ['top', '#advcard'],
  ];
  const out = [], got = new Set();
  for (const [g, s] of sel) for (const e of document.querySelectorAll(s)) {
    if (got.has(e) || !seen(e)) continue;
    got.add(e);
    if (g === 'bottom' && e.id === 'hud-prompt' && !e.textContent.trim()) continue;
    const r = e.getBoundingClientRect();
    out.push({ g, id: e.id ? `#${e.id}` : `${s.split(' ').pop()}${e.dataset.act ? `[${e.dataset.act}]` : ''}:${(e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 28)}`, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
  }
  // (the touch cluster's own pieces are drawn round one another — the wheel's rose, the fire's ring: the pairs that
  // matter are any with words in them — the top stack, a toast, the bottom line, an action button)
  const words = new Set(['top', 'toast', 'bottom']);
  const over = [];
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], c = out[j];
    if (!words.has(a.g) && !words.has(c.g)) continue;
    const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (ox > 0 && oy > 0) over.push(`${a.id} × ${c.id}: ${ox}×${oy}`);
  }
  const topEnd = Math.max(0, ...out.filter((x) => x.g === 'top' || x.g === 'toast').map((x) => x.b));
  return { W: innerWidth, H: innerHeight, boxes: out, over, topEnd, topPct: Math.round((topEnd / innerHeight) * 100) };
});

const report = [];
let bad = 0;
for (const [W, H] of sizes) {
  const tag = `${W}x${H}`;
  const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1200 });
  await L.login(p, { port: PORT, know: true });
  await dismiss(p);
  for (const c of ['/level 8', '/isle']) { await L.say(p, c); await L.sleep(700); }
  // the island's first step comes with the next check (Game: every five seconds)
  for (let i = 0; i < 20 && !(await p.evaluate(() => !!globalThis.gravetide.state.self?.isleFirst)); i++) await L.sleep(500);
  await L.say(p, '/tp saltmarrow');
  await L.sleep(2500);
  await dismiss(p);
  // the autopilot to a far port
  const m = await L.me(p);
  await L.sailTo(p, m.x + 4200, m.y + 1800);
  await L.sleep(2500);
  // the carpenters: her hull hurt, the repair on
  for (const c of ['/give planks 40', '/give sailcloth 20', '/hurt 40']) { await L.say(p, c); await L.sleep(500); }
  await L.send(p, { t: 'repair', on: true });
  await L.sleep(800);
  // a patrol cutter alongside, her mark
  await L.say(p, '/foe patrol cutter 260');
  await L.sleep(1500);
  const mark = () => p.evaluate(() => {
    const g = globalThis.gravetide, o = g.state.ownDisplay;
    let best = null, bd = Infinity;
    for (const s of g.state.ships.values()) { if (s.id === g.state.you?.id) continue; const d = Math.hypot(s.cur.x - o.x, s.cur.y - o.y); if (d < bd) { bd = d; best = s.id; } }
    if (best !== null) g.target(best);
  });
  await mark();
  await dismiss(p);
  // (the server's own words on the commands above gone first)
  for (let i = 0; i < 30 && (await p.evaluate(() => document.querySelectorAll('#toasts > .toast').length)); i++) await L.sleep(500);
  await L.sleep(500);
  await mark();
  await L.sleep(300);
  // a toast firing (the owner's words), then a second straight after: one at a time
  await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
  await L.sleep(300);
  await p.evaluate(() => globalThis.gravetide.hud.toast('В 150 м нет ничего, что могла бы схватить глубина', 'bad'));
  await L.sleep(150);
  await p.evaluate(() => globalThis.gravetide.hud.toast('Плотники нашли течь у ватерлинии', 'info'));
  await L.sleep(450);
  const state = await p.evaluate(() => {
    const s = globalThis.gravetide.state;
    return { autosail: !!s.autosail, isleFirst: s.self?.isleFirst?.id ?? null, target: document.body.classList.contains('sea-target'), prompt: (document.querySelector('#hud-prompt')?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 60), toasts: [...document.querySelectorAll('#toasts > .toast')].map((t) => { const r = t.getBoundingClientRect(); const c = getComputedStyle(t); return `${t.className} ${Math.round(r.top)}+${Math.round(r.height)} ${c.display}/${c.visibility}/${c.opacity}`; }), i1: document.getElementById('hud-isle1')?.className ?? null, modal: globalThis.gravetide.modal() };
  });
  // one toast at a time: the second waits its turn
  const shown = state.toasts.filter((t) => / flex\/visible\//.test(t)).length;
  const check = async (name, extra = {}) => {
    await p.screenshot({ path: `${OUT}/${name}.png` });
    const r = await measure(p);
    report.push({ shot: name, state, ...extra, ...r, errors: p.errors.slice(0, 5) });
    console.log(name, JSON.stringify(extra), `top ends at ${r.topEnd}px (${r.topPct}%)`, r.over.length ? `OVERLAPS: ${r.over.join(' | ')}` : 'no overlaps');
    for (const x of r.boxes) if (x.g !== 'touch' && x.g !== 'fixed') console.log(`   ${x.g.padEnd(6)} ${x.id.padEnd(40)} ${x.l},${x.t} → ${x.r},${x.b}`);
    if (r.over.length) bad++;
    return r;
  };
  console.log(tag, JSON.stringify(state));
  if (shown > 1) { console.log(`   ${shown} toasts up at once`); bad++; }
  await check(tag, { toastsUp: shown });
  // the «⋯» tray open
  await p.evaluate(() => document.getElementById('tc-more')?.click());
  await L.sleep(900);
  // (a toast up beside it)
  await p.evaluate(() => globalThis.gravetide.hud.toast('В 150 м нет ничего, что могла бы схватить глубина ', 'bad'));
  await L.sleep(400);
  if (process.env.DEBUG) console.log(await p.evaluate(() => JSON.stringify({ cls: document.body.className, st: getComputedStyle(document.body).getPropertyValue('--st-left'), tray: [...document.querySelectorAll('#tc-more-tray, #touch > .more-fold')].map((e) => { const r = e.getBoundingClientRect(); return `${e.id} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)} ${getComputedStyle(e).visibility}`; }) })));
  await check(`${tag}-tray`);
  await p.evaluate(() => document.getElementById('tc-more')?.click());
  // the toasts gone: the island's step back in the column
  for (let i = 0; i < 30 && (await p.evaluate(() => document.querySelectorAll('#toasts > .toast').length)); i++) await L.sleep(500);
  await L.sleep(400);
  const i1 = await p.evaluate(() => { const e = document.getElementById('hud-isle1'); return e ? { cls: e.className, vis: getComputedStyle(e).visibility, b: Math.round(e.getBoundingClientRect().bottom) } : null; });
  const calm = await check(`${tag}-calm`, { isle: i1 });
  if (i1 && i1.vis !== 'visible' && i1.b <= calm.H * 0.3) { console.log('   the island step stayed hidden with no toast up'); bad++; }
  await p.ctx.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
await b.close();
process.exit(bad ? 1 : 0);
