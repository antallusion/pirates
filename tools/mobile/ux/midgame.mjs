// Mid-game QA (2026-10-22): the campaign's chapters played on a phone on its side in Telegram (844×390, RU) by the real
// screens — «Цели и вести» → «Плыть» on the campaign's row, «Причалить», the landing, «Атаковать», the harbour's «В море»
// — a step at a time; a step the driver cannot do by the screens within its time is logged (a screenshot, the state)
// and passed with /camp step. Each leg's time, the distance sailed, the toasts, the page's errors, Latin on the screen.
//   GPORT=58611 CH=2 TO=3 OUT=assets/raw/audit/midqa node tools/mobile/ux/midgame.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const port = Number(process.env.GPORT ?? 58611);
const TG = Number(process.env.TG ?? 46);
const CH = Number(process.env.CH ?? 2), TO = Number(process.env.TO ?? CH);
const SPEED = Number(process.env.SPEED ?? 4);
const OUT = process.env.OUT ?? 'assets/raw/audit/midqa';
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/ch${CH}-${TO}.log`;
// the steps' kinds (the server's campaign as built for the same world: assets/raw/audit/midqa/types.ts)
const TYPES = existsSync('assets/raw/audit/midqa/types.json') ? JSON.parse(readFileSync('assets/raw/audit/midqa/types.json', 'utf8')) : {};
writeFileSync(LOG, '');
const log = (...a) => { const s = `${new Date().toISOString().slice(11, 19)} ${a.join(' ')}`; console.log(s); appendFileSync(LOG, s + '\n'); };
let shotN = 0;
const shot = async (p, n) => {
  await p.evaluate(() => document.querySelectorAll('#promo-over [data-polater]').forEach((b) => b.click())).catch(() => {});
  const f = `${OUT}/c${CH}_${String(++shotN).padStart(3, '0')}_${n.replace(/[^\w.-]+/g, '_').slice(0, 60)}.png`;
  await p.screenshot({ path: f }).catch(() => {});
  return f;
};
const issues = [];
const issue = async (p, kind, msg) => { issues.push(`${kind}: ${msg}`); log(`ISSUE ${kind}: ${msg}`); await shot(p, `issue_${kind}`); };

/** Her campaign as the screens have it. */
const cur = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, s = g.state, self = s.self, c = self?.campaign;
  const q = self?.quests?.find((x) => x.kind === 'campaign');
  const o = s.ownDisplay;
  return {
    at: c?.at, ch: c?.ch, k: c?.k, blocked: c?.blocked ?? null, ways: c?.ways?.length ?? 0, active: c?.active ?? null,
    q: q ? { id: q.id, name: q.name, step: q.step, steps: q.steps, text: q.text, progress: q.progress, need: q.need, target: q.target ?? null } : null,
    level: self?.level, xp: self?.xp, silver: self?.silver ?? self?.gold, docked: self?.dockedAt ?? null, x: Math.round(o?.x ?? 0), y: Math.round(o?.y ?? 0),
    route: s.route ? { key: s.route.key, x: Math.round(s.route.view.x), y: Math.round(s.route.view.y), kind: s.route.view.kind, name: s.route.view.name, act: s.route.view.act ?? null } : null,
    auto: !!s.autosail, tac: document.body.classList.contains('tac'), spd: Math.round((s.you?.spd ?? 0) * 100) / 100,
    hull: s.you?.hull, crew: s.you?.crew, region: s.region, landable: self?.landable ? { action: self.landable.action, blocked: !!self.landable.blocked, island: self.landable.island } : null,
    modal: document.querySelector('#modal-panel')?.dataset.modal ?? null,
  };
});
// the bar's buttons: a phone's gold #tc-act and its .tc-act2 pills (data-act = the id), a desk's .act-btn.act-<id>
const acts = (p) => p.evaluate(() => [...document.querySelectorAll('#tc-act[data-act], .tc-act2[data-act], .act-btn')].filter((b) => b.getBoundingClientRect().width).map((b) => b.dataset.act && !/^\d+$/.test(b.dataset.act) ? b.dataset.act : [...b.classList].find((c) => c.startsWith('act-') && c !== 'act-btn')?.slice(4)));
/** A finger's tap as the bar's buttons take it (radial.ts: pointer down, up within the hold): CDP's touch tap did not
 *  reach their pointer handlers in headless Chrome. */
const finger = (p, sel) => p.evaluate(async (q) => {
  const e = document.querySelector(q); if (!e) return 'none';
  const r = e.getBoundingClientRect(); if (!r.width) return 'hidden';
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  if (top && top !== e && !e.contains(top)) return 'covered by ' + (top.id || top.className);
  if (e.id !== 'tc-act') { e.click(); return 'ok'; } // (the pills take a click; the gold one its press — radial.ts)
  const o = { bubbles: true, cancelable: true, pointerId: 41, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true };
  e.dispatchEvent(new PointerEvent('pointerdown', o));
  await new Promise((z) => setTimeout(z, 60));
  e.dispatchEvent(new PointerEvent('pointerup', o));
  return 'ok';
}, sel);
async function tapAct(p, id) {
  for (const sel of [`#tc-act[data-act="${id}"]`, `.tc-act2[data-act="${id}"]`, `.act-btn.act-${id}`]) {
    const r = await finger(p, sel);
    if (r === 'ok') return r;
    if (r !== 'none' && r !== 'hidden') log(`  tap ${sel}: ${r}`);
  }
  return 'none';
}
/** The battle on the hexes, if one is open: won at once, its card closed. */
async function battle(p, tag) {
  if (!(await p.evaluate(() => document.body.classList.contains('tac')))) return false;
  await L.sleep(1500);
  await L.send(p, { t: 'tac', act: { a: 'quick' } });
  let ok = false;
  for (let i = 0; i < 60 && !(ok = await p.evaluate(() => !!document.querySelector('#board-tac [data-endbtn]')?.getBoundingClientRect().width)); i++) await L.sleep(500);
  await shot(p, `${tag}_battle_end`);
  const won = await p.evaluate(() => document.querySelector('#board-tac .tb-bsc b')?.textContent ?? '');
  log(`  battle: ${won}`);
  await p.evaluate(() => document.querySelector('#board-tac [data-endbtn]')?.click());
  await L.sleep(1500);
  for (let i = 0; i < 10 && (await p.evaluate(() => document.body.classList.contains('tac'))); i++) {
    await p.evaluate(() => document.querySelector('#board-tac [data-endbtn]')?.click());
    await L.sleep(800);
  }
  if (!ok) await issue(p, 'battle', `${tag}: no reckoning card`);
  return true;
}
/** Answer whatever card is up after a fight (the prize's, a struck ship's): its first plain choice. */
async function cards(p) {
  return p.evaluate(() => {
    const out = [];
    // a struck ship's two choices (surrender.ts): «Потопить» for a sinking step, else «Отпустить»
    const sur = document.querySelector('#surrender:not(.hidden) .sur-card');
    if (sur) {
      const want = globalThis.__wantSink ? 'sink' : 'release';
      const b = sur.querySelector(`[data-sur="${want}"]`);
      out.push(`struck: ${sur.querySelector('.sur-dist')?.textContent ?? ''} ${b?.disabled ? 'DISABLED' : 'press ' + want}`);
      if (b && !b.disabled) b.click();
    }
    for (const b of document.querySelectorAll(`[data-fate="${globalThis.__wantSink ? 'sink' : 'release'}"]`)) { if (!b.getBoundingClientRect().width || b.disabled) continue; out.push('fate ' + b.dataset.fate); b.click(); break; }
    return out;
  });
}
/** «Цели и вести» by its button (or by hand when hidden), «Плыть» on the campaign's row. */
async function sailCampaign(p, tag) {
  await L.closeAll(p, 1);
  const vis = await p.evaluate(() => { const e = document.querySelector('#tc-news'); return !!e && !e.classList.contains('hidden') && !!e.getBoundingClientRect().width; });
  if (vis) await L.tapEl(p, '#tc-news');
  else await p.evaluate(() => globalThis.gravetide.seaHud.openNews());
  await L.sleep(900);
  const row = await p.evaluate(() => {
    const b = document.querySelector('.gs-top [data-gsail]');
    return { has: !!b, key: b?.dataset.gsail ?? null, text: document.querySelector('.gs-top')?.innerText.replace(/\s+/g, ' ').slice(0, 220) ?? '', take: !!document.querySelector('.gs-top [data-gtake]') };
  });
  if (!vis) log('  (the news button hidden: the sheet opened by hand)');
  await shot(p, `${tag}_goals`);
  const lat = (await L.latin(p, '.gs-sheet')).filter((w) => !/Play |gs-mine/.test(w));
  if (lat.length) await issue(p, 'latin', `goals sheet: ${lat.slice(0, 6).join(', ')}`);
  if (row.take) {
    log(`  fork: ${row.text}`);
    await p.evaluate(() => document.querySelector('.gs-top [data-gtake]')?.click());
    await L.sleep(1500);
    await L.closeAll(p, 1);
    return 'fork';
  }
  if (!row.has) { await L.closeAll(p, 1); return `no sail (${row.text})`; }
  await L.tapEl(p, '.gs-top [data-gsail]');
  await L.sleep(1200);
  return 'sail';
}
async function undock(p) {
  await L.open(p, 'port');
  await L.sleep(800);
  await p.evaluate(() => document.querySelector('[data-ptab="sea"]')?.click());
  await L.sleep(1000);
  for (const sel of ['[data-dp="all"]', '[data-dp="sail"]']) {
    if (await p.evaluate((q) => { const b = document.querySelector(q); if (b && b.getBoundingClientRect().width) { b.click(); return true; } return false; }, sel)) await L.sleep(800);
  }
  for (let i = 0; i < 20 && (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)); i++) await L.sleep(500);
  await L.sleep(1500);
  await L.closeAll(p, 2);
}
/** Buy n of a good at the port she lies in (the market's screen). */
async function buy(p, good, n) {
  await L.send(p, { t: 'trade', good, qty: n });
  await L.sleep(1200);
}

const b = await L.browser();
const t0 = Date.now();
try {
  const p = await L.page(b, [W, H], { lang: 'ru', touch: true });
  if (TG) await p.ctx.addInitScript((t) => {
    addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('tg-app');
      const r = document.documentElement.style;
      r.setProperty('--sa-t', `${t}px`);
      r.setProperty('--tg-top', `${t}px`);
    });
  }, TG);
  const toasts = [];
  await p.exposeFunction('__toast', (t) => toasts.push(t));
  await L.login(p, { port, know: true, name: `Mid${CH} ${Math.random().toString(36).slice(2, 5)}` });
  await p.evaluate(() => {
    const seen = new WeakSet();
    new MutationObserver(() => document.querySelectorAll('#toasts > .toast').forEach((t) => { if (!seen.has(t)) { seen.add(t); globalThis.__toast(t.innerText.replace(/\s+/g, ' ').trim()); } })).observe(document.body, { childList: true, subtree: true });
  });
  await L.closeAll(p);
  for (const c of [process.env.SLOT ? `/camp slot ${process.env.SLOT}` : `/camp ch ${CH}`, '/god', '/heal', '/silver 20000', `/speed ${SPEED}`, '/army marine 30', '/scrolls 80', ...(process.env.TP ? [`/tp ${process.env.TP}`] : [])]) { log('>', c, await L.say(p, c)); await L.sleep(600); }
  await L.sleep(1500);
  await L.closeAll(p);
  let s = await cur(p);
  log('start', JSON.stringify(s));
  await shot(p, 'start');
  const popSeen = new Set(); const pestAt = new Map(); let lastProg = '';
  let lastKey = '', stepT = Date.now(), stuckAt = 0, legFrom = null, passes = 0, sailedOnce = '';
  const end = (await import('../../../shared/src/data/campaign/progress.ts').catch(() => null))?.FIRST_SLOT?.[TO] ?? 1e9;
  while (Date.now() - t0 < Number(process.env.MINUTES ?? 110) * 60000) {
    s = await cur(p);
    if (s.at >= end) { log('chapter(s) done at', s.at); break; }
    // toasts since last
    while (toasts.length) { const t = toasts.shift(); log('  toast:', t); if (/[A-Za-z]{4,}/.test(t.replace(/Mid\d \w+/g, ''))) issues.push(`latin toast: ${t}`); }
    if (s.tac) { await battle(p, `s${s.at}`); continue; }
    // a level's pick (the hero's skills) and a passing boat's game: answered as a finger would
    const pop = await p.evaluate(() => {
      const lu = document.querySelector('[data-lupick="0"]');
      if (lu && lu.getBoundingClientRect().width) { const t = lu.closest('.lu-picks')?.innerText.replace(/\s+/g, ' ').slice(0, 120); lu.click(); return 'level pick: ' + t; }
      const cf = document.querySelector('.confirm-panel [data-yes]');
      if (cf && cf.getBoundingClientRect().width) { const t = cf.closest('.confirm-panel')?.innerText.replace(/\s+/g, ' ').slice(0, 160); cf.click(); return 'confirm yes: ' + t; }
      const tk = document.querySelector('#trek:not(.hidden) [data-trek]:not([disabled])');
      if (tk && tk.getBoundingClientRect().width) { const t = document.querySelector('#trek .mg-h')?.textContent + ' · ' + tk.textContent.trim(); tk.click(); return 'trek: ' + t; }
      const mg = document.querySelector('#minigame:not(.hidden) .mg-card [data-mg="walk"]');
      if (mg && mg.getBoundingClientRect().width) { const t = document.querySelector('.mg-h')?.textContent; mg.click(); return 'minigame walked: ' + t; }
      return null;
    });
    if (pop) { log('  ' + pop); if (!popSeen.has(pop.slice(0, 12))) { popSeen.add(pop.slice(0, 12)); await shot(p, pop.slice(0, 12)); } await L.sleep(800); continue; }
    // a beast or a ship at her (the helmsman pauses while she is under fire): her guns on it, as a captain would
    if (!s.docked) {
      const pest = await p.evaluate(() => {
        const s = globalThis.gravetide.state, o = s.ownDisplay; if (!o || s.pursuit) return null;
        let best = null;
        for (const sh of s.ships.values()) {
          if (sh.id === s.entityId || !sh.cur || !(sh.cur.flags & 64) || sh.cur.flags & 17) continue;
          const d = Math.hypot(sh.cur.x - o.x, sh.cur.y - o.y);
          if (d < 260 && (!best || d < best.d)) best = { id: sh.id, d: Math.round(d), name: sh.info?.name, role: sh.info?.npcRole ?? '' };
        }
        return best;
      });
      if (pest && Date.now() - (pestAt.get(pest.id) ?? 0) > 30000) {
        pestAt.set(pest.id, Date.now());
        log(`  pest: ${pest.name} (${pest.role}) ${pest.d} m — guns on it`);
        await L.send(p, { t: 'attack', target: pest.id, mode: pest.role === 'beast' ? 'guns' : 'board' });
        await L.sleep(1500);
        continue;
      }
    }
    if (s.q && `${s.q.id}:${s.q.step}:${s.q.progress}` !== lastProg) { lastProg = `${s.q.id}:${s.q.step}:${s.q.progress}`; if (s.q.progress) log(`  progress ${s.q.progress}/${s.q.need}`); }
    { const st0 = s.q ? TYPES[s.q.id]?.[s.q.step - 1] ?? {} : {}; await p.evaluate((v) => (globalThis.__wantSink = v), st0.type === 'sink'); const c0 = await cards(p); if (c0.length) { log('  card:', c0.join(' | ')); await shot(p, `s${s.at}_card`); } }
    const key = s.q ? `${s.q.id}:${s.q.step}` : `none:${s.at}`;
    if (key !== lastKey) {
      if (lastKey) log(`  done in ${Math.round((Date.now() - stepT) / 1000)} s${legFrom ? `, ${Math.round(Math.hypot(s.x - legFrom.x, s.y - legFrom.y))} m from where it began` : ''}`);
      lastKey = key; stepT = Date.now(); legFrom = { x: s.x, y: s.y }; stuckAt = 0; sailedOnce = '';
      log(`STEP [${(TYPES[s.q?.id]?.[(s.q?.step ?? 1) - 1] ?? {}).type ?? '?'}] slot ${s.at} ch${s.ch}.${(s.k ?? 0) + 1} L${s.level} ${s.q ? `${s.q.id} «${s.q.name}» ${s.q.step}/${s.q.steps}: ${s.q.text} [${s.q.progress}/${s.q.need}] target=${JSON.stringify(s.q.target)}` : `no quest (blocked=${s.blocked}, ways=${s.ways})`}`);
      if (s.q?.target) log(`  distance to the mark ${Math.round(Math.hypot(s.q.target.x - s.x, s.q.target.y - s.y))} m`);
    }
    if (!s.q) {
      if (s.blocked) { log('  gate', s.blocked, 'at level', s.level); await issue(p, 'gate', `slot ${s.at}: ${s.blocked} at level ${s.level} after the chapter's own quests`); await L.say(p, `/level ${Number(/\d+/.exec(s.blocked)?.[0] ?? s.level + 1)}`); await L.sleep(1500); continue; }
      const r = await sailCampaign(p, `s${s.at}_fork`);
      log('  no quest:', r);
      await L.sleep(1500);
      if (Date.now() - stepT > 30000) { await issue(p, 'noquest', `slot ${s.at}: no campaign quest under way for 30 s`); await L.say(p, `/camp slot ${s.at}`); await L.sleep(1500); }
      continue;
    }
    const age = Date.now() - stepT;
    const text = s.q.text;
    // in port: what the step wants here, then out to sea
    const st = TYPES[s.q.id]?.[s.q.step - 1] ?? {};
    if (s.docked) {
      const tgt = s.q.target;
      if (st.type === 'deliver' && tgt?.port !== s.docked && !(await p.evaluate((g) => (globalThis.gravetide.state.you?.cargo?.[g] ?? globalThis.gravetide.state.self?.cargo?.[g] ?? 0), st.good))) {
        log(`  buying ${st.qty} ${st.good} here for the delivery`);
        await L.open(p, 'port'); await L.sleep(600);
        await p.evaluate(() => document.querySelector('[data-ptab="market"]')?.click()); await L.sleep(800);
        await shot(p, `s${s.at}_market`);
        await buy(p, st.good, st.qty);
      }
      if (st.type === 'recruit') {
        await L.open(p, 'port'); await L.sleep(600);
        await p.evaluate(() => document.querySelector('[data-ptab="tavern"]')?.click()); await L.sleep(800);
        await shot(p, `s${s.at}_tavern`);
        await L.send(p, { t: 'hire', qty: st.count ?? 10 }); await L.sleep(1200);
      }
      if (age > 4000) { log('  casting off'); await undock(p); }
      else await L.sleep(1000);
      continue;
    }
    // at sea: a fight's foes about her
    const fight = ['sink', 'board', 'beast', 'prize'].includes(st.type);
    if (fight) {
      const want = st.type === 'beast' ? 'beast' : st.role ?? null;
      const foes = await p.evaluate((want) => {
        const s = globalThis.gravetide.state, o = s.ownDisplay; const out = [];
        for (const sh of s.ships.values()) {
          if (sh.id === s.entityId || !sh.cur || sh.cur.flags & 1 || sh.cur.flags & 16) continue;
          const role = sh.info?.npcRole ?? sh.info?.role ?? '';
          if (want === 'beast' ? role !== 'beast' : want ? role !== want : !(sh.cur.flags & 64) || role === 'beast' || role === 'merchant' || role === 'ghost') continue;
          out.push({ id: sh.id, d: Math.round(Math.hypot(sh.cur.x - o.x, sh.cur.y - o.y)), name: sh.info?.name, role, lv: sh.info?.level });
        }
        return { foes: out.sort((a, b) => a.d - b.d), on: s.pursuit?.target ?? null };
      }, want);
      const f0 = foes.foes[0];
      if (f0 && f0.d < 3500) {
        const sink = st.type === 'beast';
        if (foes.on !== f0.id && (foes.on === null || !foes.foes.some((x) => x.id === foes.on))) {
          log(`  attack ${f0.name} (${f0.role} ⚓${f0.lv ?? '?'}) ${f0.d} m ${sink ? 'guns' : 'board'}`);
          await L.send(p, { t: 'attack', target: f0.id, mode: sink ? 'guns' : 'board' });
        }
        await L.sleep(1500);
        await p.evaluate((v) => (globalThis.__wantSink = v), st.type === 'sink');
        const c = await cards(p); if (c.length) log('  card:', c.join(' | '));
        if (age > 360000) { await issue(p, 'fight', `${key}: ${Math.round(age / 1000)} s on «${text}»`); await L.say(p, '/camp step'); await L.sleep(1500); }
        continue;
      }
    }
    // the landing / the dive / the lair: the bar's button when it is there
    const a = await acts(p);
    if (a.includes('land') && (s.q.target?.act === 'land' || ['land', 'dive', 'lair', 'neutral'].includes(st.type))) {
      log('  land:', s.landable ? JSON.stringify(s.landable) : '?');
      await tapAct(p, 'land'); await L.sleep(2500);
      if (await battle(p, `s${s.at}_land`)) continue;
      await shot(p, `s${s.at}_landed`); await L.closeAll(p, 1);
      continue;
    }
    if (a.includes('dock') && s.q.target?.act === 'dock' && Math.hypot((s.q.target.x ?? 0) - s.x, (s.q.target.y ?? 0) - s.y) < 2500) {
      log('  «Причалить»');
      await tapAct(p, 'dock'); await L.sleep(2500);
      await shot(p, `s${s.at}_docked`);
      const lat = await L.latin(p, '#modal-panel'); if (lat.length) await issue(p, 'latin', `port: ${lat.slice(0, 6).join(', ')}`);
      continue;
    }
    // under way already?
    if (s.auto) {
      if (Math.abs(s.spd) < 0.05) { if (!stuckAt) stuckAt = Date.now(); else if (Date.now() - stuckAt > 25000) { await issue(p, 'stuck', `${key}: the run to ${s.route?.name ?? "an approach"} lies still ${Math.round((Date.now() - stuckAt) / 1000)} s at ${s.x},${s.y}`); stuckAt = 0; await sailCampaign(p, `s${s.at}_again`); } }
      else stuckAt = 0;
      await L.sleep(2000);
      if (age > 600000) { await issue(p, 'leg', `${key}: ${Math.round(age / 1000)} s under way («${text}»)`); await L.say(p, '/camp step'); }
      continue;
    }
    // no course: «Плыть»
    if (sailedOnce !== `${key}:${s.x >> 6}:${s.y >> 6}`) {
      const r = await sailCampaign(p, `s${s.at}`);
      sailedOnce = `${key}:${s.x >> 6}:${s.y >> 6}`;
      const after = await cur(p);
      log(`  «Плыть»: ${r} → route ${JSON.stringify(after.route)} auto=${after.auto}`);
      if (r === 'sail' && !after.route) await issue(p, 'route', `${key}: «Плыть» set no course («${text}»)`);
      await L.sleep(2000);
      continue;
    }
    // arrived (or nothing more to sail for) and the step not done
    await L.sleep(2000);
    if (age > (st.type === 'time_in' ? (st.seconds ?? 120) * 1000 / SPEED + 120000 : 90000)) {
      const a2 = await acts(p);
      await issue(p, 'arrived', `${key}: at the place ${Math.round(age / 1000)} s, not done («${text}», ${s.q.progress}/${s.q.need}, acts ${a2.join(',')}, route ${JSON.stringify(s.route)}, mark ${JSON.stringify(s.q.target)}, at ${s.x},${s.y})`);
      passes++;
      await L.say(p, '/camp step');
      await L.sleep(1500);
    }
  }
  s = await cur(p);
  log('end', JSON.stringify(s));
  await shot(p, 'end');
  log('page errors:', p.errors.length, p.errors.slice(0, 10).join(' | '));
  log('passes by admin:', passes);
  writeFileSync(`${OUT}/ch${CH}-${TO}.issues.json`, JSON.stringify({ issues, errors: p.errors }, null, 1));
  await p.ctx.close();
} finally {
  await b.close();
}
log('issues:', issues.length);
for (const x of issues) log(' -', x);
