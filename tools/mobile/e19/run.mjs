// docs/19 E19: the endgame's screens and flows at one size and language — the Throne's nine tabs, a seal's depth, a
// titan at the Grail, the Abyss, a citadel's siege, the relics and the anvil, a Choir invasion and the black tide,
// the Admiralty's board and a legend, the Colosseum's draft and a bout — each measured with tools/mobile/e19/kit.js
// (clipped text, foreign words, touch targets, actions below the fold, the popup budget, the battle feed) and the
// window audit of assets/raw/qa.js; the page's errors; a screenshot each.
//
//   GPORT=58911 SIZE=812x375 LANG2=ru FLOWS=throne,hero OUT=assets/raw/audit/e19 node tools/mobile/e19/run.mjs
import * as L from '../m0/lib.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/audit/e19';
const FLOWS = (process.env.FLOWS ?? 'throne,hero,isle,port,invasion,seal,raid,siege,contract,arena').split(',');
const SHOTS = process.env.SHOTS !== '0';
const tag = `${W}x${H}_${lang}`;
mkdirSync(OUT, { recursive: true });
const KIT = readFileSync(new URL('./kit.js', import.meta.url), 'utf8');

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const rows = [];
const replies = [];
// The server's toasts as they come (an admin command's answer among them), whatever the client's queue shows.
const heard = [];
p.on('websocket', (ws) => ws.on('framereceived', (f) => { if (typeof f.payload === 'string' && f.payload.startsWith('{"t":"toast"')) { try { heard.push(JSON.parse(f.payload).msg); } catch {} } }));

const sleep = L.sleep;
const toastsNow = () => p.evaluate(() => [...document.querySelectorAll('#toasts > .toast')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
const clearToasts = () => p.evaluate(() => document.querySelectorAll('#toasts > .toast, #modal-toasts .toast').forEach((t) => t.remove()));
async function admin(line, ms = 1200) {
  const k = heard.length;
  const before = new Set(await toastsNow());
  await L.say(p, line);
  await sleep(ms);
  const shown = (await toastsNow()).filter((t) => !before.has(t));
  replies.push({ line, raw: heard.slice(k), shown });
  return heard.slice(k).join(' | ');
}
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const state = (f) => p.evaluate(f);
async function kit() {
  await L.qa(p);
  await p.evaluate((k) => { if (typeof globalThis.__e19 !== 'function') (0, eval)(k); }, KIT);
}

/** Measure what is on screen as `name`: the kit, the window audit (every screenful of a window), a screenshot. */
async function measure(name, { win = true, keepToasts = false, extra = {} } = {}) {
  await kit();
  if (!keepToasts) await clearToasts();
  await sleep(350);
  const r = await p.evaluate(async ([ru, touch, win]) => {
    const k = globalThis.__e19({ ru, touch });
    const open = !!document.querySelector('#modal:not(.hidden) #modal-panel');
    const a = [], c = [];
    if (win && open) {
      const body = [...document.querySelectorAll('#modal-panel .modal-body')].find((b) => b.scrollHeight > b.clientHeight + 4) ?? null;
      const steps = body ? Math.min(12, Math.ceil(body.scrollHeight / (body.clientHeight * 0.8))) : 1;
      for (let i = 0; i < steps; i++) {
        if (body) { body.scrollTop = i * body.clientHeight * 0.8; await new Promise((r) => setTimeout(r, 120)); }
        for (const x of globalThis.audit()) if (!a.includes(x)) a.push(x);
        for (const x of globalThis.center()) if (!/hud-|uf-|tc-|ab-/.test(x) && !c.includes(x)) c.push(x);
        if (body && i > 0) {
          // what scrolls into sight is measured too: clipped text and foreign words further down
          const more = globalThis.__e19({ ru, touch });
          for (const x of more.clip) if (!k.clip.includes(x)) k.clip.push(x);
          for (const x of more.words) if (!k.words.includes(x)) k.words.push(x);
        }
      }
      if (body) body.scrollTop = 0;
    }
    if (win && open) for (const b of document.querySelectorAll('#modal-panel .modal-body')) b.scrollTop = 0;
    return { ...k, audit: a, center: c, head: open ? globalThis.headAlign() : null, hud: globalThis.hudOverlap(), open };
  }, [lang === 'ru', touch, win]);
  if (win) { await sleep(250); await p.evaluate(() => { for (const b of document.querySelectorAll('#modal-panel .modal-body')) b.scrollTop = 0; }); await sleep(150); }
  const errs = p.errors.splice(0);
  const row = { name, ...r, errors: errs, ...extra };
  rows.push(row);
  if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_${name}.png` });
  const bad = [r.cut?.length && `CUT ${r.cut.length}`, r.clip.length && `clip ${r.clip.length}`, r.words.length && `words ${r.words.length}`, r.audit.length && `audit ${r.audit.length}`, r.center.length && `center ${r.center.length}`, touch && r.small.n && `small ${r.small.n}/${r.small.of} (<40: ${r.small.n40})`, r.fold.scroll.length && `fold ${r.fold.scroll.length}`, r.fold.off.length && `off ${r.fold.off.length}`, r.pop && r.pop.pct > 15 && `pop ${r.pop.pct}%`, r.pop?.centre.length && `centre ${r.pop.centre.length}`, r.hud.length && `hud ${r.hud.length}`, errs.length && `errors ${errs.length}`, r.feed?.shown && `feed ${r.feed.font}px ${r.feed.lines}l cut ${r.feed.cut}`].filter(Boolean);
  L.log(tag, name.padEnd(22), bad.join(' · ') || 'clean');
  return row;
}
const open = async (m, ms = 900) => { await p.evaluate((x) => { globalThis.gravetide.open(null); globalThis.gravetide.open(x); }, m); await sleep(ms); };
const throne = async (t, ms = 900) => { await p.evaluate((x) => { globalThis.gravetide.open(null); globalThis.gravetide.throne(x); }, t); await sleep(ms); };
const close = () => L.closeAll(p, 2);
const click = (sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return 'none'; if (e.disabled) return 'disabled ' + (e.title || ''); e.click(); return 'ok'; }, sel);
/** A press as the device makes it: a tap on touch, a mouse click on a desk. */
async function press(sel) {
  const r = await p.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, dis: e.disabled }; }, sel);
  if (!r) return 'none';
  if (r.dis) return 'disabled';
  if (touch) await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y);
  return 'ok';
}
const tac = () => state(() => { const t = globalThis.gravetide.state.boardTac; return t ? { round: t.round, over: t.over ?? null, siege: !!t.siege, mine: t.mine } : null; });
async function waitFor(f, ms = 20000, step = 400) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }
/** A battle from its first sight to its end: the field, the book opened, the field after a few rounds of the auto, the
 *  quick end and its result, then away. */
async function battle(tagName, { rounds = 2 } = {}) {
  const t = await waitFor(async () => { await skip(); return tac(); }, 25000);
  if (!t) { L.log(tag, tagName, 'no battle'); rows.push({ name: `${tagName}:NO-BATTLE` }); return false; }
  await sleep(2500);
  await skip();
  await measure(`${tagName}_field`, { win: false });
  if (await p.$('[data-book]')) {
    await press('[data-book]');
    await sleep(700);
    await measure(`${tagName}_book`, { win: false });
    await p.keyboard.press('Escape');
    await p.evaluate(() => document.querySelector('[data-book].on, .tb-book [data-close], .bk-x')?.click());
    await sleep(500);
  }
  if (rounds > 0) {
    await L.send(p, { t: 'tac', act: { a: 'auto', on: true } });
    await waitFor(async () => ((await tac())?.round ?? 0) > rounds || (await tac())?.over, 30000, 600);
    await L.send(p, { t: 'tac', act: { a: 'auto', on: false } });
    await sleep(1500);
    await measure(`${tagName}_feed`, { win: false });
  }
  await L.send(p, { t: 'tac', act: { a: 'quick' } });
  await waitFor(async () => (await p.$('[data-endbtn]')) || !(await tac()), 30000);
  await sleep(2000);
  await measure(`${tagName}_result`, { win: false, keepToasts: true });
  for (let i = 0; i < 8 && (await tac()); i++) { await press('[data-endbtn]'); await sleep(1200); await skip(); }
  await sleep(1000);
  await skip();
  await close();
  return true;
}
/** Between flows: a mutiny paid off, the men mended and cheered, her sails struck (a lair's boats go down only adrift). */
async function calm() {
  // (a lost battle's dead are reckoned a moment after it: a mutiny may rise then — paid off before the next flow)
  await sleep(2500);
  for (let i = 0; i < 2; i++) if (await state(() => !!globalThis.gravetide.state.self?.company?.mutiny)) { await L.send(p, { t: 'mutiny', choice: 'pay' }); await sleep(1500); }
  await admin('/heal', 600);
  await admin('/morale 100', 600);
  await close();
}
async function adrift() {
  await L.send(p, { t: 'autosail', stop: true });
  await p.evaluate(() => { const s = globalThis.gravetide.state; if (s.input) { s.input.sail = 0; s.input.rudder = 0; } globalThis.gravetide.net.send({ t: 'input', seq: ++s.input.seq, rudder: 0, sail: 0 }); });
  await waitFor(async () => (await state(() => Math.abs(globalThis.gravetide.state.ownDisplay?.speed ?? 0))) < 0.2, 20000, 500);
  await sleep(800);
}
/** Her ship at sea in open water of a region, the windows shut. */
async function atSea(where = 'gravewater') {
  if (await state(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
  await admin(`/tp ${where}`, 2500);
  await skip();
  await close();
}

// ------------------------------------------------------------------ the captain
// (a name in the screen's own letters: a Latin tail on a Russian screen would read as a foreign word)
const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
const name = (lang === 'ru' ? 'Проверка' : 'Check') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
await L.login(p, { name, know: true });
await skip();
await p.evaluate(() => document.body.classList.add('reduce-motion'));
// a window's sweep scrolls in steps: at once, not smoothly (or the screenshot catches it half way)
await p.addStyleTag({ content: '*, html { scroll-behavior: auto !important; }' });
await admin('/level 60');
await admin('/glory 12');
await admin('/silver 900000');
await admin('/ship man_o_war', 1800);
await admin('/army level 10');
await admin('/heal');
await admin('/give provisions 400');
await admin('/give rum 200');
await close();
L.log(tag, 'captain', name, JSON.stringify(await L.me(p)));

// ------------------------------------------------------------------ flows
const flows = {
  async throne() {
    await admin('/cit guild');
    for (const t of ['glory', 'mastery', 'trials', 'seals', 'raid', 'citadels', 'war', 'contracts', 'arena']) {
      await throne(t);
      await measure(`throne_${t}`);
    }
    await close();
  },
  async hero() {
    await admin('/relic all');
    await admin('/relic boarding_union');
    await p.evaluate(() => globalThis.gravetide.hero('hero'));
    await sleep(900);
    await measure('hero');
    // the relics section of the hero tab, scrolled to (measured in place: the window's own sweep would scroll it away)
    const at = await p.evaluate(() => { const e = document.querySelector('#modal-panel .hx-relics'); if (!e) return null; e.previousElementSibling?.previousElementSibling?.scrollIntoView({ block: 'start', behavior: 'instant' }); return e.className; });
    await sleep(400);
    await measure('hero_relics', { win: false, extra: { at } });
    await p.evaluate(() => globalThis.gravetide.hero('gear'));
    await sleep(900);
    await measure('gear_doll');
    await close();
  },
  async isle() {
    // her own island, its town whole, the Grail over it, the land's goods and pearls for the anvil and the titan
    await admin('/isle 5');
    await admin('/town 3');
    await admin('/titan grail');
    await admin('/landres 300');
    await admin('/give pearls 60');
    await admin('/relic drop 2');
    // a slot and hammocks for the titan: the army's last stack let go
    const last = await state(() => globalThis.gravetide.state.self?.company?.army?.at(-1)?.u ?? null);
    if (last) await admin(`/army ${last} 0`);
    await admin('/town go', 3000);
    await skip(); await close();
    await open('base', 1500);
    await click('[data-btab="town"]');
    await sleep(900);
    await measure('isle_town');
    // the anvil: an item chosen, a stroke asked, its new work beside the old
    const fg = await p.evaluate(() => { const e = document.querySelector('#modal-panel .tw-forge'); if (!e) return null; e.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; });
    await sleep(400);
    if (fg) {
      await measure('anvil', { win: false });
      await press('#modal-panel [data-fgdo="line"], #modal-panel [data-fgdo]');
      await sleep(900);
      await p.evaluate(() => document.querySelector('#modal-panel .tw-forge')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await measure('anvil_ask', { win: false });
      await press('#modal-panel [data-fgyes]');
      await sleep(1500);
      await p.evaluate(() => document.querySelector('#modal-panel .tw-forge')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await measure('anvil_choice', { win: false });
      await press('#modal-panel [data-fgkeep="new"]');
      await sleep(800);
    } else rows.push({ name: 'anvil:NONE' });
    // the Grail's titan in the hiring window
    await p.evaluate(() => document.querySelector('#modal-panel [data-trecruit]')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await press('#modal-panel [data-trecruit]');
    await sleep(1200);
    await measure('grail_recruit');
    const ti = await p.evaluate(() => { const e = [...document.querySelectorAll('#modal-panel [data-rcu]')].find((x) => /kraken|leviathan|white_whale|elder_turtle|wreck_mother|titan/.test(x.dataset.rcu)); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.click(); return e.dataset.rcu; });
    await sleep(900);
    await measure('grail_titan', { win: false, extra: { titan: ti } });
    await close();
  },
  async port() {
    // the Admiralty's board in a great harbour
    const ports = await state(() => globalThis.gravetide.state.self?.adm?.ports ?? []);
    if (!ports.length) { rows.push({ name: 'port:NO-ADM-PORTS' }); return; }
    if (await state(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
    await admin(`/tp ${ports[0]}`, 2000);
    await L.send(p, { t: 'dock' });
    await sleep(3000); await skip(); await close();
    await open('port', 1200);
    await click('#modal-panel [data-ptab="quests"]');
    await sleep(1000);
    await measure('port_admiralty');
    await close();
  },
  async invasion() {
    await atSea('gravewater');
    await admin('/invasion clear');
    await admin('/invasion start', 4000);
    await measure('invasion_sea', { win: false, keepToasts: true });
    await clearToasts();
    await sleep(1500);
    await measure('invasion_sea_calm', { win: false });
    await open('map', 1500);
    await measure('invasion_map');
    await close();
    await admin('/invasion fail', 3000);
    await measure('black_tide_sea', { win: false, keepToasts: true });
    await open('map', 1500);
    await measure('black_tide_map');
    await close();
    await admin('/invasion clear');
  },
  async seal() {
    await calm();
    await admin('/seal lv 2');
    await admin('/seal go', 2500);
    await skip(); await close();
    await adrift();
    await measure('seal_key', { win: false });
    await throne('seals');
    await measure('seal_tab_ready');
    await press('#modal-panel [data-thseal]');
    await battle('seal');
  },
  async raid() {
    await calm();
    await admin('/maw reset');
    await admin('/maw tier 2');
    await admin('/maw go', 2500);
    await skip(); await close();
    await throne('raid');
    await measure('raid_tab_ready');
    await press('#modal-panel [data-thraid]');
    await battle('raid');
  },
  async siege() {
    await calm();
    await admin('/cit guild');
    await admin('/cit free 1');
    await admin('/cit siege 1', 3000);
    await battle('siege', { rounds: 3 });
    await admin('/cit free 1');
  },
  async contract() {
    const rowsAdm = await state(() => (globalThis.gravetide.state.self?.adm?.rows ?? []).map((r) => ({ id: r.id, kind: r.kind, state: r.state })));
    const k = rowsAdm.findIndex((r) => r.kind === 'legend');
    if (k < 0) { rows.push({ name: `contract:NO-LEGEND ${JSON.stringify(rowsAdm)}` }); return; }
    await admin(`/contract take ${k + 1}`);
    await calm();
    await admin(`/contract go ${k + 1}`, 2500);
    await skip(); await close();
    await adrift();
    await measure('legend_mark', { win: false });
    await throne('contracts');
    await measure('contract_legend_tab');
    await press('#modal-panel [data-admboard]');
    await battle('legend');
  },
  async arena() {
    await atSea('gravewater');
    await calm();
    await throne('arena');
    await measure('arena_lobby');
    L.log(tag, 'practice', await press('#modal-panel [data-arop="practice"]'), await state(() => document.querySelector('#modal-panel [data-arop="practice"]')?.title ?? '-'));
    await sleep(2000);
    L.log(tag, 'draft', JSON.stringify(await state(() => globalThis.gravetide.state.self?.glory?.arena?.draft?.stage ?? null)), heard.slice(-3).join(' | '));
    let shotBan = false, shotPick = false;
    for (let i = 0; i < 80; i++) {
      const d = await state(() => { const a = globalThis.gravetide.state.self?.glory?.arena?.draft; return a ? { stage: a.stage, turn: a.turn, you: a.you, left: a.left, picks: a.picks, bans: a.bans, done: a.done, pool: a.pool.map((x) => ({ u: x.u, price: x.price })) } : null; });
      if (!d || d.stage === 'fight' || d.stage === 'done') break;
      if (await state(() => !document.querySelector('#modal:not(.hidden) .ar-draft'))) { await throne('arena'); continue; }
      if (d.turn !== d.you) { await sleep(800); continue; }
      const taken = new Set([...d.bans[0], ...d.bans[1], ...d.picks[0], ...d.picks[1]]);
      const free = d.pool.filter((x) => !taken.has(x.u));
      if (d.stage === 'ban') {
        const u = free[free.length - 1 - d.bans[d.you].length]?.u ?? free[0].u;
        await press(`#modal-panel [data-arlot="${u}"]`);
        await sleep(500);
        if (!shotBan) { await measure('arena_draft_ban'); shotBan = true; }
        // by touch the second tap bans; by mouse the button
        if (touch) await press(`#modal-panel [data-arlot="${u}"]`); else await press('#modal-panel [data-arop="ban"]');
      } else {
        const lot = free.filter((x) => x.price <= d.left[d.you]).sort((a, b) => b.price - a.price)[0];
        if (!lot || d.picks[d.you].length >= 7) { await press('#modal-panel [data-arop="pass"]'); await sleep(900); continue; }
        await press(`#modal-panel [data-arlot="${lot.u}"]`);
        await sleep(500);
        if (!shotPick && d.picks[d.you].length >= 1) { await measure('arena_draft_pick'); shotPick = true; }
        if (touch) await press(`#modal-panel [data-arlot="${lot.u}"]`); else await press('#modal-panel [data-arop="pick"]');
      }
      await sleep(1000);
    }
    await battle('arena');
  },
};

for (const f of FLOWS) {
  if (!flows[f]) { L.log('no flow', f); continue; }
  try { await flows[f](); } catch (e) { L.log(tag, 'FLOW FAILED', f, e.message.split('\n')[0]); rows.push({ name: `${f}:FAILED`, error: e.message.slice(0, 300) }); await close().catch(() => {}); }
}

writeFileSync(`${OUT}/${tag}.json`, JSON.stringify({ at: new Date().toISOString(), size: [W, H], lang, touch, rows, replies }, null, 1));
await b.close();
