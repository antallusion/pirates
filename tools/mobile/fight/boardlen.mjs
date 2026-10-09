// docs/25 block Г (2026-10-09, batch-boardlen): a boarding at a level on a size and language — the chess clocks, the
// quarterdeck's flag, the hint line and the quick fight offered at once, each measured where it stands (inside the
// screen, off the captains' faces, out of the field's middle, its words whole) and shot.
//
//   GPORT=58950 SIZE=812x375 LANG2=ru LEVEL=50 ARMY=8 FOE="pirate frigate 400" OUT=docs/img/boardlen TAG=after node tools/mobile/fight/boardlen.mjs
//   QUICK=1 …: also take the quick fight (when it is offered) and shoot the end.
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/boardlen';
const TAG = process.env.TAG ?? 'now';
const LEVEL = Number(process.env.LEVEL ?? 50);
mkdirSync(OUT, { recursive: true });
const tag = `${TAG}_L${LEVEL}_${W}x${H}_${lang}`;

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const sleep = L.sleep;
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const view = () => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t ? { round: t.round, over: t.over, mine: !!t.mine, level: t.level, turn: t.turn, bank: t.bank, flag: t.flag, quickNow: !!t.quickNow, noQuick: !!t.noQuick } : null; });
async function waitFor(f, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }

const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
await L.login(p, { port: Number(process.env.GPORT ?? 58950), name: (lang === 'ru' ? 'Флаг' : 'Flag') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true, captain: process.env.PATH_ID ?? 'corsair' });
await skip();
await p.evaluate(() => document.body.classList.add('reduce-motion'));
await say(`/level ${LEVEL}`);
await say(`/army level ${process.env.ARMY ?? Math.min(10, Math.ceil(LEVEL / 6))}`);
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
await say('/tp gravewater', 2500);
// The level's skill offer and the sea's news put away before the grapples (they are another screen's).
for (let i = 0; i < 4; i++) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later)$/.test(x.textContent.trim())).forEach((x) => x.click()));
  await sleep(300);
}
await L.closeAll(p, 2);
await sleep(5000);
await say(`/board ${process.env.FOE ?? 'pirate frigate 400'}`, 1500);
const v0 = await waitFor(async () => { await skip(); return view(); });
if (!v0) { console.log('no battle'); await b.close(); process.exit(1); }
// Her turn, or the sea's first turns played.
await waitFor(async () => { await skip(); const v = await view(); return v && (v.mine || v.over); }, 25000);
await sleep(1200);
await skip();

const measure = () => p.evaluate(() => {
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const all = (sel) => [...document.querySelectorAll(sel)].filter(shown);
  const box = (e) => ({ ...R(e), text: e.textContent.trim(), cut: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 });
  const out = { screen: [innerWidth, innerHeight], clocks: all('.tb-clock').map(box), flag: all('.tb-flagp').map(box), quick: all('.tb-qn, .tb-acts [data-a="quick"]').map(box), tline: all('.tb-tline').map(box), hint: all('.tb-hint').map(box), chips: all('.tb-chip').map(R), top: all('.tb-top').map(R), mid: all('.tb-mid').map(R) };
  // What runs past the screen; what lies on a captain's face; the top band's share of the screen and the middle.
  const inside = (r) => r.l >= 0 && r.t >= 0 && r.r <= innerWidth && r.b <= innerHeight;
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  out.outside = [...out.clocks, ...out.flag, ...out.quick, ...out.tline].filter((r) => !inside(r)).length;
  out.onFaces = [...out.clocks, ...out.flag, ...out.quick, ...out.tline].filter((r) => out.chips.some((c) => hit(r, c))).length;
  const mid = { l: innerWidth * 0.3, r: innerWidth * 0.7, t: innerHeight * 0.3, b: innerHeight * 0.7 };
  out.inMiddle = out.top.filter((r) => hit(r, mid)).length;
  out.topShare = Math.round((out.top.reduce((n, r) => n + r.w * r.h, 0) / (innerWidth * innerHeight)) * 1000) / 10;
  out.cut = [...out.clocks, ...out.flag, ...out.quick].filter((r) => r.cut).map((r) => r.text);
  return out;
});
const m = await measure();
const v1 = await view();
await L.shot(p, `${tag}`).catch(() => {});
await p.screenshot({ path: `${OUT}/${tag}.png` });
const flagAt = await p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t?.flag ? t.flag.hex : null; });
if (process.env.CLIP) await p.screenshot({ path: `${OUT}/${tag}_clip.png`, clip: { x: 0, y: Math.round(H * 0.55), width: W, height: Math.round(H * 0.45) } });
let end = null;
if (process.env.QUICK && v1?.quickNow) {
  await p.evaluate(() => (document.querySelector('.tb-qn') ?? document.querySelector('.tb-acts [data-a="quick"]'))?.click());
  end = await waitFor(async () => { await skip(); const v = await view(); return v?.over ? v : null; }, 20000);
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/${tag}_quick.png` });
}
const rec = { tag, view: v1, measure: m, quickEnd: end?.over ?? null, errors: p.errors };
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rec, null, 1));
console.log(JSON.stringify({ tag, level: v1?.level, turn: v1?.turn, bank: v1?.bank, flag: v1?.flag, quickNow: v1?.quickNow, clocks: m.clocks.map((c) => c.text), flagp: m.flag.map((c) => c.text), quick: m.quick.map((c) => c.text), tline: m.tline.map((c) => c.text), hint: m.hint.map((c) => c.text), outside: m.outside, onFaces: m.onFaces, inMiddle: m.inMiddle, topShare: m.topShare, cut: m.cut, quickEnd: rec.quickEnd, errors: p.errors.length }));
await b.close();
