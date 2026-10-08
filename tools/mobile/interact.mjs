// The owner, 2026-10-07, two more from his game (a desk window 1500×600 with a mouse):
//   land — «я должен со всем взаимодействовать, ошибок типа "не под огнём" быть не должно абсолютно»: a shark marked
//          with «Атаковать» close by, her guns at it, and the land key off a creature lair (his «Штурм»); every toast
//          logged, and whether the boats went (the battle ashore opened);
//   repair — «нажимая на ремонт ничего не происходит вообще абсолютно, появляется только "хватит чинить" и всё»: her
//          hull at 40%, «Чинить» clicked on the bar, the hull read every second for 30 s.
//
//   APORT=58871 OUT=assets/raw/beast/web node tools/mobile/interact.mjs land|repair [--tag x]
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from './m0/lib.mjs';
import { Phone, StepError, signIn } from './e2e/pages.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MODE = process.argv.slice(2).find((x) => ['land', 'repair'].includes(x)) ?? 'land';
const APORT = Number(process.env.APORT ?? 58871);
const OUT = process.env.OUT ?? 'assets/raw/beast/web';
const TAG = arg('tag', MODE);
mkdirSync(OUT, { recursive: true });

async function instrument(p) {
  await p.evaluate(() => {
    const g = globalThis.gravetide;
    const W = (globalThis.__it = { toasts: [], sent: [], t0: performance.now() });
    const now = () => Math.round(performance.now() - W.t0) / 1000;
    const send = g.net.send.bind(g.net);
    g.net.send = (m) => { if (m.t !== 'input' && m.t !== 'ping' && m.t !== 'appraise') W.sent.push({ t: now(), m: JSON.stringify(m).slice(0, 120) }); return send(m); };
    g.net.on((m) => { if (m.t === 'toast' || m.t === 'err') W.toasts.push({ t: now(), kind: m.kind ?? 'err', msg: m.msg }); });
  });
}

async function castOff(ph) {
  for (let i = 0; i < 30; i++) {
    const s = await ph.state();
    if (!s.docked) break;
    if (!(await ph.tapIf('[data-dp="sail"]', '«Всё равно выйти»')) && !(await ph.tapIf('#modal-panel [data-ptab="sea"]', '«В море»'))) await L.send(ph.p, { t: 'undock' });
    await L.sleep(1000);
  }
  await L.sleep(1500);
  await ph.skipFilm();
  await L.closeAll(ph.p, 2);
}

const me = (p) => p.evaluate(() => { const s = globalThis.gravetide.state; return { hull: s.you?.hull, hullMax: s.you?.hullMax, sails: s.you?.sails, flags: s.you?.flags, planks: s.self?.cargo?.planks ?? 0, tac: !!s.boardTac, pursuit: s.pursuit ?? null }; });

async function land(ph) {
  const p = ph.p;
  await castOff(ph);
  await ph.admin('/level 30', 800);
  for (const x of ['/weather clear', '/heal', '/ammo']) await ph.admin(x, 600);
  await ph.admin('/lair go', 2500);
  await L.closeAll(p, 2);
  await instrument(p);
  await ph.admin('/beast shark 1 1', 1500);
  const shark = await p.evaluate(() => { const s = globalThis.gravetide.state; for (const x of s.ships.values()) if ((x.info?.npcRole ?? x.info?.role) === 'beast') return x.id; return null; });
  await ph.step('shark', { shark });
  await p.evaluate((id) => globalThis.gravetide.target(id), shark);
  await L.sleep(400);
  await L.closeAll(p, 1);
  await ph.tap('#hud-prompt .act-attack', '«Атаковать»', 8000);
  await L.sleep(6000);
  const fight = await me(p);
  await ph.step('fighting', fight);
  // The land key (the bar's «Высадка» / «Штурм» when it shows; the key itself either way, as he would press it).
  const t0 = Date.now();
  if (!(await ph.tapIf('#hud-prompt .act-land', '«Высадка»'))) await p.keyboard.press('l');
  let tac = false;
  for (let i = 0; i < 40 && !tac; i++) { await L.sleep(500); tac = (await me(p)).tac; }
  await ph.step('after', { tac, sec: (Date.now() - t0) / 1000 });
  const W = await p.evaluate(() => globalThis.__it);
  return { mode: MODE, battleAshore: tac, toasts: W.toasts, refusals: W.toasts.filter((x) => x.kind === 'bad' || x.kind === 'err'), sent: W.sent.slice(-20), errors: p.errors };
}

async function repair(ph) {
  const p = ph.p;
  await castOff(ph);
  for (const x of ['/weather clear', '/hurt 40']) await ph.admin(x, 800);
  await instrument(p);
  const before = await me(p);
  await ph.step('hurt', before);
  await ph.tap('#hud-prompt .act-repair', '«Чинить»', 8000);
  const samples = [];
  for (let i = 0; i <= 30; i++) {
    const m = await me(p);
    samples.push({ t: i, hull: Math.round((m.hull / m.hullMax) * 1000) / 10, planks: Math.round(m.planks * 10) / 10, repairing: !!(m.flags & 128) });
    if (i % 10 === 0) await ph.shot(`r${i}`);
    await L.sleep(1000);
  }
  const W = await p.evaluate(() => globalThis.__it);
  return { mode: MODE, samples, gained: +(samples.at(-1).hull - samples[0].hull).toFixed(1), toasts: W.toasts, errors: p.errors };
}

const b = await L.browser();
const pg = await L.page(b, [1500, 600], { touch: false, lang: 'ru' });
const ph = new Phone(pg, { out: OUT, tag: TAG, port: APORT, touch: false });
let res;
try {
  await signIn(ph, { name: `IT${Math.random().toString(36).slice(2, 6)}`, know: true });
  res = MODE === 'repair' ? await repair(ph) : await land(ph);
} catch (e) {
  res = { error: e instanceof StepError ? e.message : String(e?.stack ?? e).slice(0, 800) };
  await ph.shot('error');
}
res.steps = ph.steps;
writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 1));
const brief = { ...res };
delete brief.steps; delete brief.sent;
console.log(JSON.stringify(brief, null, 1).slice(0, 3500));
await b.close();
