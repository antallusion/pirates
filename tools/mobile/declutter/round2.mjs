// The owner's second round on the decluttered HUD (2026-10-29):
//   the tray's buttons apart («чуть больше расстояние иконкам… а то они налезают друг на друга»), the quests out and the
//   chat in («иконка квеста должна быть вместо иконки чата»), «Огонь» with four round it and room between («4 вокруг
//   иконки… расстояние небольшое»), the dash chip off the wheel («чтобы не налазело на штурвал»), and no mark by itself
//   («если я никого не атакую не показывай мне наверху плашки акула… автофокусов быть не должно»).
//   SIZE=844x390,740x360,1093x481,1366x768 node tools/mobile/declutter/round2.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'assets/raw/audit/declutter/round2';
mkdirSync(OUT, { recursive: true });
const sizes = (process.env.SIZE ?? '844x390,740x360,1093x481,1366x768').split(',').map((s) => s.split('x').map(Number));
const b = await L.browser();
const rows = [];
const box = (p, sel) => p.evaluate((q) => {
  const e = document.querySelector(q);
  if (!e || e.classList.contains('hidden')) return null;
  const r = e.getBoundingClientRect();
  return r.width ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) } : null;
}, sel);
async function dismiss(p) {
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => {
      globalThis.gravetide.open(null);
      const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut], [data-gflater], #promo-over [data-polater], .lu-sheet [data-lulater]')].filter((b) => b.getBoundingClientRect().width);
      x.forEach((b) => b.click());
      if (document.body.classList.contains('chat-open')) document.getElementById('chat-close')?.click();
      // (a first-time card over the whole screen: «Вы покидаете безопасные воды» and its «Вперёд»)
      for (const b of document.querySelectorAll('button')) if (/^\s*Вперёд\s*$/.test(b.textContent) && b.getBoundingClientRect().width) { b.click(); x.push(b); }
      return x.length;
    });
    if (!n) break;
    await L.sleep(400);
  }
  await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
}
const plate = (p) => p.evaluate(() => { const e = document.getElementById('tc-target'); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().height > 2; });

for (const [W, H] of sizes) {
  const touch = W < 1100;
  const p = await L.page(b, [W, H], { lang: 'ru', touch });
  await L.login(p, { port: 58780, know: true });
  await dismiss(p);
  for (const c of ['/god', '/level 8', '/silver 900']) { await L.say(p, c); await L.sleep(300); }
  await L.say(p, '/tp black_coast');
  await L.sleep(2500);
  await dismiss(p);
  const tag = `${W}x${H}`;
  const r = { size: tag };
  // 1. the tray closed and open
  await p.screenshot({ path: `${OUT}/${tag}_closed.png` });
  r.out = { news: await box(p, '#tc-news'), chat: await box(p, '#chat-toggle'), more: await box(p, '#tc-more') };
  await p.evaluate(() => document.getElementById('tc-more')?.click());
  await L.sleep(Number(process.env.SLIDE ?? 1500));
  await p.screenshot({ path: `${OUT}/${tag}_open.png` });
  r.tray = await p.evaluate(() => {
    const items = [document.getElementById('tc-more'), ...document.querySelectorAll('.more-fold')]
      .filter((e) => e && !e.classList.contains('hidden') && e.id !== 'hud-advice' && e.getBoundingClientRect().width > 0)
      .sort((a, c) => a.getBoundingClientRect().left - c.getBoundingClientRect().left);
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const e = items[i], q = e.getBoundingClientRect();
      const badge = [...e.querySelectorAll('.k-badge, .chat-unread')].filter((x) => !x.classList.contains('hidden') && x.getBoundingClientRect().width > 0).map((x) => x.getBoundingClientRect());
      const next = items[i + 1]?.getBoundingClientRect();
      const bRight = Math.max(q.right, ...badge.map((x) => x.right));
      out.push({ id: e.id, l: Math.round(q.left), badgeR: Math.round(bRight), toNext: next ? Math.round(next.left - bRight) : null });
    }
    const tray = document.getElementById('tc-more-tray')?.getBoundingClientRect();
    return { items: out, trayR: tray ? Math.round(tray.right) : null, W: innerWidth };
  });
  await p.evaluate(() => document.getElementById('tc-more')?.click());
  await L.sleep(500);
  // 2. a shark at hand on a calm sea: no plate; tapped: the plate
  await L.say(p, '/beast shark 3 1');
  await L.sleep(3000);
  await dismiss(p);
  const shark = await p.evaluate(() => {
    const s = globalThis.gravetide.state;
    let best = null, bd = 1e9;
    for (const x of s.ships.values()) {
      if (!x.info || x.id === s.entityId || !/shark/i.test(x.info.classId ?? '')) continue;
      const d = Math.hypot(x.cur.x - s.ownDisplay.x, x.cur.y - s.ownDisplay.y);
      if (d < bd) { bd = d; best = x.id; }
    }
    return best === null ? null : { id: best, d: Math.round(bd) };
  });
  r.shark = shark;
  r.calmPlate = await plate(p);
  await p.screenshot({ path: `${OUT}/${tag}_shark_calm.png` });
  if (shark) {
    // a tap on it, at its place on the screen (as a finger's: markAt)
    const at = await p.evaluate((id) => { const g = globalThis.gravetide, s = g.state.ships.get(id), rd = g.renderer; return { x: rd.sx(s.cur.x), y: rd.sy(s.cur.y) }; }, shark.id);
    r.sharkAt = { x: Math.round(at.x), y: Math.round(at.y) };
    if (at.x > 0 && at.y > 0 && at.x < W && at.y < H) {
      if (touch) await p.touchscreen.tap(at.x, at.y); else await p.mouse.click(at.x, at.y);
    }
    await L.sleep(1500);
    r.tappedPlate = await plate(p);
    if (!r.tappedPlate) { await p.evaluate((id) => globalThis.gravetide.target(id), shark.id); await L.sleep(1200); r.tappedPlate = await plate(p); r.tapVia = 'target()'; }
    await p.screenshot({ path: `${OUT}/${tag}_shark_marked.png` });
  }
  // 3. attacked with nothing marked: no plate; then the cluster round «Огонь», «Умения» open
  await L.say(p, '/tp gravewater');
  await L.sleep(1500);
  // (a shot into the empty sea first: a new captain's shelter keeps the pirates off her till she fires)
  await p.evaluate(() => { const g = globalThis.gravetide, o = g.state.ownDisplay; g.net.send({ t: 'fire', side: 'port', dist: 120, x: Math.round(o.x - 300), y: Math.round(o.y) }); });
  await L.sleep(1000);
  await L.say(p, '/foe pirate brig 250 hunt');
  for (let i = 0; i < 20 && !(await p.evaluate(() => !!globalThis.gravetide.state.you?.combat)); i++) await L.sleep(1000);
  await L.sleep(800);
  await dismiss(p);
  r.attacked = await p.evaluate(() => ({ fight: document.body.classList.contains('sea-fight'), combat: !!globalThis.gravetide.state.you?.combat, plate: !!document.querySelector('#tc-target:not(.hidden)') }));
  await p.screenshot({ path: `${OUT}/${tag}_attacked_nomark.png` });
  await p.evaluate(() => {
    const g = globalThis.gravetide, s = g.state;
    let best = null, bd = 1e9;
    for (const x of s.ships.values()) {
      if (x.id === s.entityId || !x.cur || !x.info || /shark/i.test(x.info.classId)) continue;
      const d = Math.hypot(x.cur.x - s.ownDisplay.x, x.cur.y - s.ownDisplay.y);
      if (d < bd) { bd = d; best = x.id; }
    }
    if (best !== null) g.target(best);
  });
  await L.sleep(2500);
  await dismiss(p);
  await p.screenshot({ path: `${OUT}/${tag}_fight.png` });
  if (touch) {
    r.cluster = await p.evaluate(() => {
      const c = (id) => {
        const e = document.getElementById(id);
        if (!e || e.classList.contains('hidden')) return null;
        const q = e.getBoundingClientRect();
        return q.width ? { id, x: q.left + q.width / 2, y: q.top + q.height / 2, rv: (q.width / 2) * 1.22, q } : null;
      };
      const f = c('tc-fire'), sats = ['tc-skill', 'tc-abil', 'tc-ammo', 'tc-lock'].map(c).filter(Boolean);
      const gap = (a, d) => Math.round((Math.hypot(a.x - d.x, a.y - d.y) - a.rv - d.rv) * 10) / 10;
      const lab = document.querySelector('#tc-ammo .tc-ammo-n')?.getBoundingClientRect();
      const inScreen = sats.every((s) => s.q.left >= 0 && s.q.top >= 0 && s.q.right <= innerWidth && s.q.bottom <= innerHeight);
      const stick = document.getElementById('tc-stick').getBoundingClientRect(), dc = document.getElementById('tc-dashchip').getBoundingClientRect();
      const sc = { x: stick.left + stick.width / 2, y: stick.top + stick.height / 2 }, dcc = { x: dc.left + dc.width / 2, y: dc.top + dc.height / 2 };
      const plus = [...document.querySelectorAll('#tc-sail button, #touch > .k-btn')].map((x) => x.getBoundingClientRect()).filter((x) => x.width && x.left < innerWidth / 2 && x.top > innerHeight / 2);
      const actrow = document.querySelector('#tc-actrow:not(.hidden)')?.getBoundingClientRect();
      return {
        n: sats.length,
        fireGap: f ? sats.map((s) => [s.id, gap(f, s)]) : null,
        between: sats.slice(1).map((s, i) => [sats[i].id + '|' + s.id, gap(sats[i], s)]),
        ammoLabel: lab ? { b: Math.round(lab.bottom), l: Math.round(lab.left), r: Math.round(lab.right) } : null,
        actRowR: actrow && actrow.width ? Math.round(actrow.right) : null,
        leftmostSat: Math.round(Math.min(...sats.map((s) => s.x - s.rv))),
        inScreen,
        dash: { fromArc: Math.round(Math.hypot(dcc.x - sc.x, dcc.y - sc.y) - stick.width / 2 - 9 - (dc.width / 2) * 1.22), toPlus: plus.map((q) => Math.round(Math.max(q.left - dc.right, q.top - dc.bottom))) },
      };
    });
    await p.evaluate(() => document.getElementById('tc-skill')?.click());
    await L.sleep(800);
    await p.screenshot({ path: `${OUT}/${tag}_skills_open.png` });
    r.skillsFan = await p.evaluate(() => { const f = document.getElementById('tc-skillfan'); return f && !f.classList.contains('hidden') ? [...f.querySelectorAll('[data-ab]')].map((x) => x.dataset.ab) : null; });
    await p.evaluate(() => { const x = document.querySelector('#tc-skillfan [data-ab]'); x?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); });
    await L.sleep(500);
    await p.screenshot({ path: `${OUT}/${tag}_skills_card.png` });
  }
  rows.push(r);
  L.log(JSON.stringify(r), p.errors.slice(-2).join(' | '));
  await p.ctx.close();
}
await b.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
