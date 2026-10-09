// The owner's five of 2026-10-09 on screen (docs/23 journal «Мини-карта, выход из порта, беззаконные воды»): the phone's
// minimap with a mark, the window before sailing, lawless waters, a ship sunk by guns, and two endgame leftovers at
// 640×360 (the recruit window's «Нанять», the Throne's nine tabs). Each measured with tools/mobile/e19/kit.js (clipped
// text, foreign words, touch targets, below the fold, the popup budget) and assets/raw/qa.js; a screenshot each.
//
//   GPORT=58921 SIZE=812x375 LANG2=ru FLOWS=minimap,depart,lawless,sunk,recruit,throne OUT=assets/raw/seaui node tools/mobile/seaui/run.mjs
import * as L from '../m0/lib.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/seaui';
const PHASE = process.env.PHASE ?? 'after';
const FLOWS = (process.env.FLOWS ?? 'minimap,depart,lawless,sunk,recruit,throne').split(',');
const tag = `${PHASE}_${W}x${H}_${lang}`;
mkdirSync(OUT, { recursive: true });
const KIT = readFileSync(new URL('../e19/kit.js', import.meta.url), 'utf8');
const M0 = readFileSync(new URL('../m0/measure.js', import.meta.url), 'utf8');

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch, films: true });
const rows = [];
const heard = [];
p.on('websocket', (ws) => ws.on('framereceived', (f) => { if (typeof f.payload === 'string' && f.payload.startsWith('{"t":"toast"')) { try { heard.push(JSON.parse(f.payload).msg); } catch {} } }));
const sleep = L.sleep;
const state = (f, a) => p.evaluate(f, a);
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const clearToasts = () => p.evaluate(() => document.querySelectorAll('#toasts > .toast, #modal-toasts .toast').forEach((t) => t.remove()));
async function admin(line, ms = 1200) {
  const k = heard.length;
  await L.say(p, line);
  await sleep(ms);
  return heard.slice(k).join(' | ');
}
async function kit() {
  await L.qa(p);
  await p.evaluate((k) => { if (typeof globalThis.__e19 !== 'function') (0, eval)(k); }, KIT);
}
/** Measure what is on screen as `name`: the kit, the window audit, a screenshot; `extra` rides along in the row. */
async function measure(name, { keepToasts = true, extra = {} } = {}) {
  await kit();
  if (!keepToasts) await clearToasts();
  await sleep(250);
  const r = await p.evaluate(([ru, touch]) => {
    const k = globalThis.__e19({ ru, touch });
    return { ...k, audit: globalThis.audit(), hud: globalThis.hudOverlap() };
  }, [lang === 'ru', touch]);
  const errs = p.errors.splice(0);
  const row = { name, ...r, errors: errs, ...extra };
  rows.push(row);
  await p.screenshot({ path: `${OUT}/${tag}_${name}.png` });
  const bad = [r.cut?.length && `CUT ${r.cut.length}`, r.clip.length && `clip ${r.clip.length}`, r.words.length && `words ${r.words.length}`, r.audit.length && `audit ${r.audit.length}`, touch && r.small.n && `small ${r.small.n}/${r.small.of}`, r.fold.scroll.length && `fold ${r.fold.scroll.join(';')}`, r.fold.off.length && `off ${r.fold.off.length}`, r.pop && `pop ${r.pop.pct}%`, r.pop?.centre?.length && `centre ${r.pop.centre.length}`, r.hud.length && `hud ${r.hud.length}`, errs.length && `errors ${errs.join(';').slice(0, 200)}`].filter(Boolean);
  L.log(tag, name.padEnd(20), bad.join(' · ') || 'clean', Object.keys(extra).length ? JSON.stringify(extra) : '');
  return row;
}
async function press(sel) {
  const r = await p.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + Math.min(b.width / 2, 20), y: b.top + b.height / 2, dis: e.disabled, w: b.width }; }, sel);
  if (!r || !r.w) return 'none';
  if (r.dis) return 'disabled';
  if (touch) await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y);
  return 'ok';
}
const rect = (sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom), vis: c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.05 }; }, sel);
/** On-screen part of a rect: how much of it the screen shows. */
const onScreen = (r) => (r ? Math.max(0, Math.min(r.r, W) - Math.max(r.x, 0)) * Math.max(0, Math.min(r.b, H) - Math.max(r.y, 0)) : 0);
async function waitFor(f, ms = 15000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }
const close = () => L.closeAll(p, 2);
/** Every tap target a finger can reach now (tools/mobile/m0/measure.js __targets, the house's count). */
const targets = async () => { await p.evaluate((k) => { if (typeof globalThis.__targets !== 'function') (0, eval)(k); }, M0); return p.evaluate(() => { const t = globalThis.__targets(); return { n: t.n, list: t.list }; }); };
/** The sea HUD's things to touch, as a finger finds them: visible, on screen, taking the pointer. */
const touchables = () => p.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('#tc-stick, #tc-fire, #tc-ammo, #tc-lock, #tc-act, #tc-special, #tc-menu, #tc-news, #tc-cast, #hud-map, #mm-tab, #tc-target .k-target')) {
    if (!e.getClientRects().length) continue;
    let hid = false;
    for (let q = e; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) { hid = true; break; } }
    if (hid) continue;
    const r = e.getBoundingClientRect();
    const vw = Math.min(r.right, innerWidth) - Math.max(r.left, 0), vh = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (vw < 4 || vh < 4) continue;
    if (getComputedStyle(e).pointerEvents === 'none') continue;
    out.push(`${e.id || e.className.split(' ')[0]} ${Math.round(vw)}×${Math.round(vh)}`);
  }
  return out;
});
/** Into a harbour (her last, else the first of the chart) and docked. */
async function toPort() {
  if (await state(() => !!globalThis.gravetide.state.self?.dockedAt)) return;
  const id = await state(() => globalThis.gravetide.state.self?.lastPort ?? globalThis.gravetide.state.ports[0].id);
  await admin(`/tp ${id}`, 2500);
  await L.send(p, { t: 'dock' });
  await sleep(3000);
  await skip();
}
async function atSea(where = 'gravewater') {
  if (await state(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
  if (where) await admin(`/tp ${where}`, 2500);
  await skip();
  await close();
  // (the one-time «Вы покидаете безопасные воды» comes a moment later)
  await sleep(1500);
  await close();
}

// ------------------------------------------------------------------ the captain
const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
const name = (lang === 'ru' ? 'Проверка' : 'Check') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
await L.login(p, { port: Number(process.env.GPORT ?? 58921), name, know: true });
await skip();
await p.addStyleTag({ content: '*, html { scroll-behavior: auto !important; }' });
// The films she has seen, as the page keeps them (a film shown at a sinking is one more).
const filmsSeen = () => state(() => JSON.parse(localStorage.getItem('gravetide.filmsSeen') ?? '[]'));
L.log(tag, 'captain', name, JSON.stringify(await L.me(p)));

const flows = {
  async depart() {
    // In port, short of everything: a bigger hull (more guns and berths than her shot and hands), hurt at sea, the
    // provisions gone — and silver for some of it (SILVER).
    if (await state(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
    await close();
    if (process.env.SHIP !== '-') await admin(`/ship ${process.env.SHIP ?? 'brig'}`, 1500);
    await admin('/hurt 55');
    await toPort();
    await admin(`/silver ${process.env.SILVER ?? 5000}`);
    const prov = await state(() => Math.floor(globalThis.gravetide.state.self?.cargo?.provisions ?? 0));
    if (prov > 0) await admin(`/give provisions -${prov}`);
    await close();
    await sleep(800);
    const before = await state(() => { const s = globalThis.gravetide.state; return { gold: s.self.gold, prov: Math.floor(s.self.cargo.provisions ?? 0), hull: Math.round((s.you?.hull ?? 0) / (s.you?.hullMax ?? 1) * 100), shot: s.self.ammo.round ?? 0, crew: s.self.crew, planks: Math.floor(s.self.cargo.planks ?? 0) }; });
    // «В море»: the big round button on touch, the harbour's tab with a mouse.
    let how;
    if (touch) how = await press('#tc-cast');
    else { await L.open(p, 'port'); await sleep(1000); how = await press('#modal-panel [data-ptab="sea"]'); }
    await sleep(1500);
    const sheet = await rect('.depart-panel');
    const atSeaNow = await state(() => !globalThis.gravetide.state.self?.dockedAt);
    const after = await state(() => { const s = globalThis.gravetide.state; return { gold: s.self.gold, prov: Math.floor(s.self.cargo.provisions ?? 0), shot: s.self.ammo.round ?? 0, crew: s.self.crew, planks: Math.floor(s.self.cargo.planks ?? 0) }; });
    const dp = await p.evaluate(() => {
      const panel = document.querySelector('.depart-panel');
      if (!panel) return null;
      const body = panel.querySelector('.k-sheet-body') ?? panel;
      const btns = [...panel.querySelectorAll('[data-dp]')].map((b) => { const r = b.getBoundingClientRect(); return `${b.dataset.dp} «${b.textContent.trim().replace(/\s+/g, ' ')}» ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.top)}-${Math.round(r.bottom)}${b.disabled ? ' off' : ''}`; });
      const rows = [...panel.querySelectorAll('.dp-row')].map((r) => r.textContent.trim().replace(/\s+/g, ' '));
      return { scroll: body.scrollHeight - body.clientHeight, btns, rows };
    });
    await measure('depart_window', { extra: { how, before, after, atSea: atSeaNow, sheet, dp, toasts: await L.toasts(p) } });
    if (!dp) return;
    // «Докупить всё»: what is bought, and the window as it fills.
    const b2 = await state(() => globalThis.gravetide.state.self.gold);
    await press('[data-dp="all"]');
    await sleep(2500);
    const dp2 = await p.evaluate(() => [...document.querySelectorAll('.depart-panel .dp-row, .depart-panel .dp-lead')].map((r) => r.textContent.trim().replace(/\s+/g, ' ')));
    const a2 = await state(() => { const s = globalThis.gravetide.state; return { gold: s.self.gold, prov: Math.floor(s.self.cargo.provisions ?? 0), shot: s.self.ammo.round ?? 0, crew: s.self.crew, hull: Math.round((s.you?.hull ?? 0) / (s.you?.hullMax ?? 1) * 100), planks: Math.floor(s.self.cargo.planks ?? 0) }; });
    await measure('depart_bought', { extra: { spent: b2 - a2.gold, after: a2, dp2 } });
    await press('[data-dp="sail"]');
    await sleep(2500);
    await skip();
    L.log(tag, 'sailed', JSON.stringify(await L.me(p)));
  },
  async minimap() {
    await atSea('gravewater');
    await admin('/heal');
    await admin(`/foe ${process.env.FOE ?? 'merchant'} brig 420`);
    await sleep(1500);
    const id = await state(() => { const g = globalThis.gravetide; const own = g.state.ownDisplay; let best = null, bd = 1e9; for (const s of g.state.ships.values()) { if (!s.info || s.info.isPlayer) continue; const d = Math.hypot(s.cur.x - own.x, s.cur.y - own.y); if (d < bd) { bd = d; best = s.id; } } return best; });
    if (id !== null) await p.evaluate((x) => globalThis.gravetide.target(x), id);
    await sleep(1200);
    const mm = await rect('#hud-map'), tab = await rect('#mm-tab');
    await measure('minimap_target', { extra: { mm, mmShown: onScreen(mm), tab, touch: await touchables(), targets: await targets() } });
    // A tap on what is left of it: the chart comes back (and stays) — or, before, nothing there to tap.
    const got = tab?.vis ? await press('#mm-tab') : 'none';
    await sleep(900);
    const mm2 = await rect('#hud-map');
    await measure('minimap_back', { extra: { got, mm: mm2, mmShown: onScreen(mm2), touch: await touchables(), targets: await targets() } });
    // A tap again on the chart: back up behind its tab (not the world map).
    const tuck = await press('#hud-map');
    await sleep(900);
    const mmT = await rect('#hud-map');
    L.log(tag, 'a tap again', JSON.stringify({ tuck, mm: mmT, shown: onScreen(mmT), tab: await rect('#mm-tab'), map: await state(() => !!document.querySelector('#modal:not(.hidden) .worldmap, #modal:not(.hidden) #map-canvas')) }));
    await press('#mm-tab');
    await sleep(700);
    // A new mark: hidden again.
    await admin(`/foe ${process.env.FOE ?? 'merchant'} sloop 380`);
    await sleep(1200);
    const id2 = await state((was) => { const g = globalThis.gravetide; const own = g.state.ownDisplay; let best = null, bd = 1e9; for (const s of g.state.ships.values()) { if (!s.info || s.info.isPlayer || s.id === was) continue; const d = Math.hypot(s.cur.x - own.x, s.cur.y - own.y); if (d < bd) { bd = d; best = s.id; } } return best; }, id);
    if (id2 !== null) await p.evaluate((x) => globalThis.gravetide.target(x), id2);
    await sleep(1200);
    const mm3 = await rect('#hud-map');
    L.log(tag, 'a new mark', JSON.stringify({ mm3, shown: onScreen(mm3) }));
    // The setting «всегда показывать»: the chart and the menu stay with a mark, no tab.
    await p.evaluate(() => { const k = 'gravetide.settings'; const v = JSON.parse(localStorage.getItem(k) ?? '{}'); v.mmTarget = 'show'; localStorage.setItem(k, JSON.stringify(v)); });
    await L.open(p, 'options');
    await sleep(800);
    await measure('options_main', { extra: { row: await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-omm]')].map((b) => `${b.textContent} ${b.getAttribute('aria-pressed')} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`)), scroll: await p.evaluate(() => { const b = document.querySelector('#modal-panel .modal-body'); return b ? b.scrollHeight - b.clientHeight : null; }) } });
    await press('#modal-panel [data-omm="show"]');
    await sleep(500);
    await close();
    await sleep(900);
    const mm4 = await rect('#hud-map');
    await measure('minimap_show', { extra: { mm: mm4, mmShown: onScreen(mm4), tab: await rect('#mm-tab'), targets: await targets() } });
    await L.open(p, 'options');
    await sleep(600);
    await press('#modal-panel [data-omm="hide"]');
    await sleep(400);
    await close();
  },
  async lawless() {
    await atSea('gravewater');
    await clearToasts();
    await admin('/tp dead_mans_expanse', 900);
    await sleep(600);
    const n1 = await p.evaluate(() => { const e = document.querySelector('#lawless-note, .lawless-note'); return e && e.getClientRects().length ? e.textContent.trim() : null; });
    await measure('lawless_enter', { extra: { note: n1, herald: await p.evaluate(() => document.querySelector('#sea-herald')?.textContent?.trim() ?? null) } });
    await sleep(3500);
    const n2 = await p.evaluate(() => { const e = document.querySelector('#lawless-note, .lawless-note'); return e && e.getClientRects().length && getComputedStyle(e).opacity > 0.1 ? e.textContent.trim() : null; });
    L.log(tag, 'lawless after 4 s', JSON.stringify(n2));
    // The colours card at sea (the ship window): what it says here.
    await L.open(p, 'ship');
    await sleep(1000);
    await p.evaluate(() => document.querySelector('#modal-panel .fl-card')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await sleep(300);
    const fl = await p.evaluate(() => document.querySelector('#modal-panel .fl-line')?.textContent?.trim() ?? null);
    await measure('lawless_colours', { extra: { fl } });
    await close();
    // Logging in inside them: the page reloaded.
    await p.reload({ waitUntil: 'domcontentloaded' });
    const seen = await waitFor(() => p.evaluate(() => { const e = document.querySelector('#lawless-note, .lawless-note'); return e && e.getClientRects().length ? e.textContent.trim() : null; }), 30000, 250);
    await measure('lawless_login', { extra: { note: seen } });
    await atSea('gravewater');
  },
  async sunk() {
    await atSea('gravewater');
    const f0 = await filmsSeen();
    const films = [];
    await p.exposeFunction('__filmSeen', (x) => films.push(x)).catch(() => {});
    await p.evaluate(() => new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('film')) globalThis.__filmSeen(n.querySelector('video')?.getAttribute('src') ?? '?'); }).observe(document.body, { childList: true }));
    await admin('/sink', 1000);
    const modal = await waitFor(() => state(() => globalThis.gravetide.state && document.querySelector('#modal:not(.hidden) #modal-panel')?.textContent?.trim().slice(0, 60)), 40000, 300);
    await sleep(1500);
    const f1 = await filmsSeen();
    await measure('sunk', { extra: { modal, films, newSeen: f1.filter((x) => !f0.includes(x)) } });
    await skip();
    await close();
    await waitFor(() => state(() => !!globalThis.gravetide.state.self && !document.querySelector('#modal:not(.hidden)')), 20000);
  },
  async recruit() {
    await toPort();
    await admin('/silver 50000');
    await admin('/dwell fill');
    await close();
    await p.evaluate(() => globalThis.gravetide.open('port'));
    await sleep(900);
    await p.evaluate(() => document.querySelector('#modal-panel [data-ptab="army"]')?.click());
    await sleep(900);
    await p.evaluate(() => document.querySelector('#modal-panel [data-dwell]')?.click());
    await sleep(1500);
    const go = await rect('#modal-panel [data-rcgo]'), body = await rect('#modal-panel .modal-body');
    await measure('recruit', { extra: { go, body, below: go && body ? go.b - body.b : null } });
    await close();
  },
  async throne() {
    await admin('/level 60');
    await admin('/glory 12');
    for (const t of ['glory', 'arena']) {
      await p.evaluate((x) => { globalThis.gravetide.open(null); globalThis.gravetide.throne(x); }, t);
      await sleep(1000);
      const tabs = await p.evaluate(() => {
        const list = [...document.querySelectorAll('#modal-panel .w-tab:not(.w-tab--go), #modal-panel .tab')].filter((e) => e.getClientRects().length);
        const tops = new Set(list.map((e) => Math.round(e.getBoundingClientRect().top)));
        return { n: list.length, rows: tops.size, words: list.map((e) => `${e.textContent.trim()}:${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}${e.scrollWidth > e.clientWidth + 1 ? ' CUT' : ''}`) };
      });
      await measure(`throne_${t}`, { extra: { tabs } });
    }
    await close();
  },
};

for (const f of FLOWS) {
  try { await flows[f](); } catch (e) { L.log(tag, f, 'FAILED', e.message.slice(0, 300)); rows.push({ name: `${f}:FAILED`, error: e.message }); await close().catch(() => {}); }
}
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rows, null, 1));
await b.close();
