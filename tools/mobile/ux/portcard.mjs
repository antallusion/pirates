// The port card and the price periods in the browser (owner, 2026-10-30), on a QA server with admin commands:
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-prices.db node server/src/main.ts
//   GPORT=58810 SIZES=844x390,1093x481,1366x768 OUT=assets/raw/audit/portcard node tools/mobile/ux/portcard.mjs
// Per size: in port, the card of her harbour (live prices) → `/prices next` → the card again (the new period); at sea,
// a tap on a harbour's name opens its card (seen prices); a far port never seen. Each card measured: inside the
// screen, nothing cut, the buttons ≥ 44 px, the share of the screen.
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const sizes = (process.env.SIZES ?? '844x390,1093x481,1366x768').split(',').map((s) => s.split('x').map(Number));
const lang = process.env.LANG2 ?? 'ru';
const port = Number(process.env.GPORT ?? 58810);
const OUT = process.env.OUT ?? 'assets/raw/audit/portcard';
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let bad = 0;
const fail = (m) => { bad++; L.log('FAIL ' + m); };
const card = (p) => p.evaluate(() => {
  const r = document.querySelector('#port-card');
  if (!r) return null;
  const box = r.querySelector('.k-sheet').getBoundingClientRect();
  const over = [...r.querySelectorAll('.pcd-row > *, .pcd-svc, h3, h4, .pcd-meta span, .k-sheet-foot button, .pcd-src')].filter((e) => {
    const q = e.getBoundingClientRect();
    return q.width && (q.right > box.right + 1 || q.left < box.left - 1 || (e.scrollWidth > e.clientWidth + 1 && !e.classList.contains('pcd-gn')));
  }).map((e) => `${e.className}:${e.textContent.trim().slice(0, 24)}`);
  const cut = [...r.querySelectorAll('.pcd-gn')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
  const btn = r.querySelector('.k-sheet-foot button')?.getBoundingClientRect();
  return {
    title: r.querySelector('.k-sheet-title')?.textContent,
    src: r.querySelector('.pcd-src')?.textContent,
    clock: r.querySelector('.pcd-clock')?.textContent ?? '',
    rows: r.querySelectorAll('.pcd-row:not(.pcd-th)').length,
    groups: [...r.querySelectorAll('.pcd-grp > h4')].map((h) => h.textContent),
    first: [...r.querySelectorAll('.pcd-row:not(.pcd-th)')].slice(0, 4).map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
    box: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
    inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
    btnH: Math.round(btn?.height ?? 0), btn: r.querySelector('.k-sheet-foot button')?.textContent.trim(),
    over, cut,
  };
});
/** The card in place (its slide in done: a busy software GPU draws a frame a second). */
const settled = (p) => wait(p, () => { const k = document.querySelector('#port-card .k-sheet'); if (!k) return false; const r = k.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && getComputedStyle(k).transform === 'none'; }, 12000);
const wait = async (p, f, ms = 8000) => { for (let t = 0; t < ms; t += 250) { if (await p.evaluate(f)) return true; await L.sleep(250); } return false; };
try {
  for (const [W, H] of sizes) {
    const p = await L.page(b, [W, H], { lang });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/silver 200000');
    await L.sleep(600);
    const home = await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt);
    L.log(`${W}x${H} docked at ${home}`);
    // 1. her harbour's card, in port: live prices, the countdown
    await p.evaluate((id) => globalThis.gravetide.portCard(id), home);
    await wait(p, () => !!document.querySelector('#port-card .pcd-row'));
    await settled(p);
    let c = await card(p);
    L.log(`${W}x${H} before: ${JSON.stringify(c)}`);
    if (!c || !c.rows) fail(`${W}x${H}: no card`);
    if (c && !c.inside) fail(`${W}x${H}: the card off the screen ${c.box}`);
    if (c?.over.length) fail(`${W}x${H}: overflow ${c.over}`);
    if (c && c.btnH < 44) fail(`${W}x${H}: button ${c.btnH}px`);
    if (c && !/(Еда|Food)/.test(c.groups[0] ?? '')) fail(`${W}x${H}: food not first ${c.groups}`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_1_before.png` });
    // 2. the next period at once: the card asks again
    const toasts = () => p.evaluate(() => [...new Set(globalThis.__toasts ?? [])]);
    // (every toast the HUD is asked for: a queued one counts though the budget shows it later)
    await p.evaluate(() => { globalThis.__toasts = []; const h = globalThis.gravetide.hud, t = h.toast.bind(h); h.toast = (m, k) => { globalThis.__toasts.push(String(m)); return t(m, k); }; });
    await L.say(p, '/prices next');
    await L.sleep(1500);
    await p.evaluate((id) => globalThis.gravetide.portCard(id), home);
    await L.sleep(1500);
    const c2 = await card(p);
    const ts = await toasts();
    L.log(`${W}x${H} after: ${JSON.stringify(c2)} toasts ${JSON.stringify(ts)}`);
    if (c2 && c && JSON.stringify(c2.first) === JSON.stringify(c.first)) fail(`${W}x${H}: prices did not change`);
    if (!ts.some((t) => /(Цены\sв\sпортах\sобновились|Port\sprices\shave\schanged)/.test(t))) fail(`${W}x${H}: no announcement`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_2_after.png` });
    // the port window's market: the countdown
    await p.evaluate(() => document.querySelector('#port-card .k-sheet-x')?.click());
    await L.sleep(500);
    await L.open(p, 'port');
    await L.sleep(1500);
    const mk = await p.evaluate(() => document.querySelector('.mk-clock')?.textContent ?? '');
    L.log(`${W}x${H} market clock: ${mk}`);
    if (!/(Новые цены через|New prices in)/.test(mk)) fail(`${W}x${H}: no countdown in the market`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_3_market.png` });
    await L.closeAll(p);
    // 3. a tap on a harbour's name on the sea opens its card
    await L.closeAll(p);
    await L.sleep(800);
    const at = await p.evaluate(() => {
      // any harbour's name on the screen, its middle (the HUD's bands left out)
      const g = globalThis.gravetide;
      for (let y = 70; y < innerHeight - 90; y += 6) for (let x = 120; x < innerWidth - 120; x += 8) {
        const id = g.portLabelAt(x, y);
        if (id && document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y, id };
      }
      return null;
    });
    L.log(`${W}x${H} label at ${JSON.stringify(at)}`);
    if (at) {
      // (a finger's tap as the sea takes it — pointer down and up on the canvas: CDP's touch tap does not reach the
      // pointer handlers in headless Chrome, tools/mobile/ux/midgame.mjs)
      if (W < 1000) await p.evaluate(async ({ x, y }) => {
        const c = document.getElementById('world'), o = { bubbles: true, cancelable: true, pointerId: 43, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true };
        c.dispatchEvent(new PointerEvent('pointerdown', o));
        await new Promise((z) => setTimeout(z, 70));
        c.dispatchEvent(new PointerEvent('pointerup', o));
      }, at);
      else await p.mouse.click(at.x, at.y);
      await wait(p, () => !!document.querySelector('#port-card .pcd-row'));
      await L.sleep(800);
      c = await card(p);
      L.log(`${W}x${H} label tap: ${JSON.stringify(c)}`);
      if (!c || c.title === undefined) fail(`${W}x${H}: the name's tap opened no card`);
      await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_4_nametap.png` });
      await p.evaluate(() => document.querySelector('#port-card .k-sheet-x')?.click());
      await L.sleep(500);
    } else fail(`${W}x${H}: no label found`);
    // her harbour left: the card from what she saw there
    await L.send(p, { t: 'undock' });
    await L.sleep(2500);
    await L.closeAll(p);
    await p.evaluate((id) => globalThis.gravetide.portCard(id), home);
    await wait(p, () => !!document.querySelector('#port-card .pcd-row'));
    await L.sleep(1500);
    c = await card(p);
    L.log(`${W}x${H} seen: ${JSON.stringify(c)}`);
    if (c?.over.length) fail(`${W}x${H}: seen overflow ${c.over}`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_4b_seen.png` });
    await p.evaluate(() => document.querySelector('#port-card .k-sheet-x')?.click());
    await L.sleep(500);
    // 4. a far port never seen: its goods, no prices
    const far = await p.evaluate((id) => { const s = globalThis.gravetide.state; const o = s.ownDisplay; return s.ports.filter((x) => x.id !== id).sort((a, b) => Math.hypot(b.x - o.x, b.y - o.y) - Math.hypot(a.x - o.x, a.y - o.y))[0].id; }, home);
    await p.evaluate((id) => globalThis.gravetide.portCard(id), far);
    await wait(p, () => !!document.querySelector('#port-card .pcd-row'));
    await L.sleep(800);
    c = await card(p);
    L.log(`${W}x${H} far ${far}: ${JSON.stringify(c)}`);
    if (c?.over.length) fail(`${W}x${H}: far overflow ${c.over}`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_5_far.png` });
    // «Плыть сюда»: the run starts, the card goes
    await p.evaluate(() => document.querySelector('#port-card [data-pcd-sail]')?.click());
    await L.sleep(1500);
    const run = await p.evaluate(() => ({ run: globalThis.gravetide.goalRun(), card: !!document.querySelector('#port-card') }));
    L.log(`${W}x${H} sail: ${JSON.stringify(run)}`);
    if (run.run !== `p:${far}` || run.card) fail(`${W}x${H}: «Плыть сюда» ${JSON.stringify(run)}`);
    const errs = p.errors.filter((e) => !/429/.test(e));
    if (errs.length) fail(`${W}x${H}: errors ${errs.slice(0, 3)}`);
    await p.ctx.close();
  }
} finally {
  await b.close();
}
L.log(bad ? `${bad} FAIL` : 'ALL OK');
