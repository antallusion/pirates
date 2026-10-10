// Owner, 2026-10-10 («9 матросов убили 20 моих матросов с одного удара … чини атаку всем»): a captain of a level
// boards a pirate of the sea; her stack's attack preview (harm, fallen, Attack − Defense) beside the blow that lands,
// the stack cards (count, hit points, damage with her side's lift, Attack and Defense with her captain's), and the sea's
// blows that follow against what the cards say. Shots to OUT, the numbers to OUT/<tag>.json.
//
//   GPORT=58996 LEVEL=1 SIZE=1280x720 LANG2=ru FOE="pirate sloop 16" OUT=docs/img/fairhit node tools/mobile/fight/fairhit.mjs
//   SHIP="frigate 7" …: her hull of a level first, her hammocks filled (then her army by the ladder of her ⚓).
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '1280x720').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'docs/img/fairhit';
const LEVEL = Number(process.env.LEVEL ?? 1);
mkdirSync(OUT, { recursive: true });
const tag = `L${LEVEL}_${W}x${H}_${lang}`;

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const sleep = L.sleep;
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const tac = () => p.evaluate(() => globalThis.gravetide.state.boardTac ?? null);
async function waitFor(f, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }

const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
await L.login(p, { port: Number(process.env.GPORT ?? 58996), name: (lang === 'ru' ? 'Честь' : 'Fair') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true, captain: process.env.PATH_ID ?? 'corsair' });
await skip();
await p.evaluate(() => document.body.classList.add('reduce-motion'));
if (LEVEL > 1) await say(`/level ${LEVEL}`);
if (process.env.SHIP) {
  await say(`/ship ${process.env.SHIP}`);
  await say('/army deckhand 9999');
}
await say(`/army level ${process.env.ARMY ?? Math.min(10, Math.max(1, Math.ceil(LEVEL / 6)))}`);
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
await say('/tp gravewater', 2500);
for (let i = 0; i < 4; i++) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later)$/.test(x.textContent.trim())).forEach((x) => x.click()));
  await sleep(300);
}
await L.closeAll(p, 2);
await sleep(4000);
await say(`/board ${process.env.FOE ?? 'pirate sloop 16'}`, 1500);
if (!(await waitFor(async () => { await skip(); return tac(); }))) { console.log('no battle'); await b.close(); process.exit(1); }

/** What the two cards say a blow of `s` on `t` is: men × mean roll × Attack − Defense × her lift × the other's guard. */
const cards = (s, t, shot) => {
  const ad = s.atk >= t.def ? 1 + Math.min(1, 0.05 * (s.atk - t.def)) : Math.max(0.5, 1 - 0.025 * (t.def - s.atk));
  const lift = 1 + ((shot ? s.bonus?.shot : s.bonus?.melee) ?? 0) / 100, guard = 1 + (t.bonus?.taken ?? 0) / 100;
  return { lo: s.count * s.dmg[0] * ad * lift * guard, hi: s.count * s.dmg[1] * ad * lift * guard, ad: Math.round((ad - 1) * 100) };
};

const rec = { tag, blows: [], sea: [], cards: [], errors: [] };
for (let k = 0; k < 2; k++) {
  // Her turn.
  const v = await waitFor(async () => { await skip(); const t = await tac(); return t && (t.over || (t.mine && t.pv?.length)) ? t : null; }, 45000);
  if (!v || v.over) break;
  await sleep(1200);
  const act = v.stacks.find((s) => s.id === v.active);
  // The preview with the biggest harm (a melee blow from the hex she would strike from, or a shot).
  const pv = [...v.pv].sort((a, b) => b.dmg[1] - a.dmg[1])[0];
  const t = v.stacks.find((s) => s.id === pv.t);
  await p.evaluate((a) => { const ui = globalThis.gravetide.tactical; ui.aimFoe = { t: a.t, ...(a.from !== undefined ? { from: a.from } : {}) }; }, pv);
  await sleep(700);
  const tip = await p.evaluate(() => { const e = document.querySelector('.tb-pv'); return e && !e.classList.contains('hidden') ? e.innerText.replace(/\s+/g, ' ').trim() : null; });
  await p.screenshot({ path: `${OUT}/${tag}_${k}_preview.png` });
  // The target's card and her own.
  for (const id of [t.id, act.id]) {
    await p.evaluate((i) => globalThis.gravetide.tactical.showInfo(i), id);
    await sleep(600);
    const card = await p.evaluate(() => { const e = document.querySelector('.tb-card:not(.hidden), .tb-cardk'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; });
    rec.cards.push({ id, card });
    if (id === t.id) await p.screenshot({ path: `${OUT}/${tag}_${k}_card.png` });
  }
  await p.evaluate(() => globalThis.gravetide.tactical.showInfo(null));
  const want = cards(act, t, !!pv.shot);
  const n0 = v.log.length ? v.log[v.log.length - 1].i : 0;
  await L.send(p, { t: 'tac', act: pv.shot ? { a: 'shoot', target: t.id } : { a: 'attack', target: t.id, from: pv.from } });
  const after = await waitFor(async () => { const x = await tac(); const e = x?.log.find((e2) => e2.i > n0 && (e2.k === 'hit' || e2.k === 'shot') && e2.s === act.id && e2.t === t.id && !e2.id); return e ? { x, e } : null; }, 15000);
  if (!after) break;
  const lucky = after.x.log.some((e2) => e2.i > n0 && e2.k === 'luck' && e2.s === act.id);
  const k2 = lucky ? 2 : 1;
  rec.blows.push({ unit: act.unit, men: act.count, foe: t.unit, foeMen: t.count, preview: { dmg: pv.dmg, kills: pv.kills, ad: pv.ad, fl: pv.fl, shot: !!pv.shot }, blow: { dmg: after.e.dmg, kills: after.e.kills, lucky }, cards: { lo: Math.round(want.lo), hi: Math.round(want.hi), ad: want.ad }, tip,
    inPreview: after.e.dmg >= pv.dmg[0] * k2 - 1 && after.e.dmg <= pv.dmg[1] * k2 + 1 && after.e.kills >= pv.kills[0] && after.e.kills <= pv.kills[1] * k2 + 1 });
  await sleep(2500);
  // The sea's blows that follow (till her next turn): each against what the cards say.
  const v2 = await waitFor(async () => { await skip(); const x = await tac(); return x && (x.over || x.mine) ? x : null; }, 45000);
  if (!v2) break;
  for (const e of v2.log.filter((e2) => e2.i > after.e.i && (e2.k === 'hit' || e2.k === 'shot' || e2.k === 'ret') && e2.side !== v2.you && !e2.id)) {
    const s = v.stacks.find((x) => x.id === e.s) ?? v2.stacks.find((x) => x.id === e.s), tt = v2.stacks.find((x) => x.id === e.t) ?? v.stacks.find((x) => x.id === e.t);
    if (!s || !tt) continue;
    const c = cards(s, tt, e.k === 'shot');
    rec.sea.push({ k: e.k, unit: s.unit, men: s.count, foe: tt.unit, foeMen: tt.count, dmg: e.dmg, kills: e.kills, cards: [Math.round(c.lo), Math.round(c.hi)], fl: e.fl ?? 0 });
  }
  await p.screenshot({ path: `${OUT}/${tag}_${k}_after.png` });
}
rec.errors = p.errors;
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rec, null, 1));
console.log(JSON.stringify({ tag, blows: rec.blows.map((x) => `${x.men} ${x.unit} → ${x.foeMen} ${x.foe}: preview ${x.preview.dmg.join('–')} (${x.preview.kills.join('–')} fall, A−D ${x.preview.ad}%), blow ${x.blow.dmg} (${x.blow.kills} fall)${x.blow.lucky ? ' lucky' : ''}, cards ${x.cards.lo}–${x.cards.hi}, in preview: ${x.inPreview}`), sea: rec.sea.map((x) => `${x.k} ${x.men} ${x.unit} → ${x.foeMen} ${x.foe}: ${x.dmg} (${x.kills} fall), cards ${x.cards.join('–')}${x.fl ? ` flank ${x.fl}` : ''}`), errors: rec.errors.length }, null, 1));
await b.close();
