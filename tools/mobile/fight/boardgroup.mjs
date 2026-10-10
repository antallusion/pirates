// docs/25 block Е (2026-10-10, batch-boardgroup): a group's boarding in three browsers at once — three captains of one
// group (or two against one between captains), each page its own size and language: 812×375 and 640×360 touch, 1500×600
// mouse. The card on the sea that asks a mate aboard, her joining (at once, or as the next round opens), each captain's
// turns on her own stacks, her own clock, her once-a-round order, the colours and faces on the field and in the round's
// order, and the end screen's shares — each measured (inside the screen, not on the captains' faces, the card in the
// top band and under 15%, its words whole) and shot.
//
//   GPORT=58990 MODE=npc|pvp LANGS=ru,en,ru LEVEL=30 OUT=docs/img/boardgroup node tools/mobile/fight/boardgroup.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.GPORT ?? 58990);
const MODE = process.env.MODE ?? 'npc';
const LANGS = (process.env.LANGS ?? 'ru,en,ru').split(',');
const LEVEL = Number(process.env.LEVEL ?? 30);
const OUT = process.env.OUT ?? 'docs/img/boardgroup';
mkdirSync(OUT, { recursive: true });
// SIZES="812x375t,640x360t,1500x600m": each page's screen, touch (t) or mouse (m). A machine that cannot draw three
// fields at once runs two passes, the third page small (it plays its stacks; its shots are not the pass's).
const SIZES = (process.env.SIZES ?? '812x375t,640x360t,1500x600m').split(',').map((s) => { const m = /^(\d+)x(\d+)([tm])$/.exec(s); return [Number(m[1]), Number(m[2]), m[3] === 't']; });
const PATHS = (process.env.PATHS ?? 'corsair,drowned,admiral').split(',');
const sleep = L.sleep;
const tagOf = (i) => `${MODE}_${SIZES[i][0]}x${SIZES[i][1]}_${LANGS[i]}_${PATHS[i]}`;

// A browser each (swiftshader draws one sea at a time well; three pages of one browser starved the second).
const B = [];
const P = [];
for (let i = 0; i < 3; i++) {
  B.push(await L.browser());
  const pg = await L.page(B[i], [SIZES[i][0], SIZES[i][1]], { lang: LANGS[i], touch: SIZES[i][2] });
  // Three seas in swiftshader at once starve each other: the sea under the field drawn without WebGL and the effects
  // low (the field's own drawing is the same Canvas2D; the looks were shot on their own, docs/img/boardvfx).
  if (process.env.GL !== '1') await pg.ctx.addInitScript(() => { try { localStorage.setItem('gravetide.settings', JSON.stringify({ webgl: false, effects: 'low' })); } catch {} });
  // What the server says to her (the admin's answers come as toasts), kept for the log.
  await pg.ctx.addInitScript(() => {
    const O = WebSocket;
    globalThis.__toasts = [];
    globalThis.WebSocket = class extends O {
      constructor(...a) {
        super(...a);
        this.addEventListener('message', (e) => { try { const m = JSON.parse(e.data); if (m.t === 'toast') globalThis.__toasts.push(m.msg); } catch {} });
      }
    };
  });
  P.push(pg);
}
const b = { close: async () => { for (const x of B) await x.close(); } };
const skip = (p) => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (p, line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const view = (p) => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; if (!t) return null; const me = t.heroes[t.you]; return { round: t.round, over: t.over, mine: !!t.mine, slot: t.slot ?? 0, you: t.you, allies: (t.allies ?? []).map((a) => [a.side, a.slot, a.name, a.bank ?? null, a.men]), cast: me.cast, spells: me.spells.map((s) => [s.id, s.ready, s.cost ?? 0]), mana: me.mana, stam: me.stam, coming: t.coming ?? null, active: t.active, own: t.stacks.find((s) => s.id === t.active)?.own ?? 0, side: t.stacks.find((s) => s.id === t.active)?.side ?? null, shares: t.result?.shares ?? null, name: me.name }; });
async function waitFor(f, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }
const R = 'const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), text: (e.textContent || "").trim().slice(0, 40), cut: e.scrollWidth > e.clientWidth + 1 }; };';
const measure = (p) => p.evaluate(new Function(`${R}
  const W = innerWidth, H = innerHeight;
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const all = (q) => [...document.querySelectorAll(q)].filter(vis).map(R);
  const inside = (r) => r.l >= 0 && r.t >= 0 && r.r <= W && r.b <= H;
  const hit = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
  const out = { screen: [W, H], caps: all('.tb-capr .tb-cap'), capsDesk: all('.tb-caps .tb-capn'), chips: all('.tb-chip'), clocks: all('.tb-clock'), top: all('.tb-top'), q: all('.tb-q.cap'), offer: all('#board-offer:not(.hidden) .bo-card'), offerCut: all('#board-offer .bo-h b, #board-offer .bo-go').filter((r) => r.cut).map((r) => r.text), hint: all('.tb-hint').map((r) => r.text), turn: all('.tb-turn').map((r) => r.text), shares: all('.tb-share').map((r) => r.text) };
  out.outside = [...out.caps, ...out.capsDesk, ...out.clocks, ...out.offer].filter((r) => !inside(r)).length;
  out.capsOnFaces = out.caps.filter((r) => out.chips.some((c) => hit(r, c))).length;
  out.capsOnTop = out.caps.filter((r) => [...out.clocks].some((c) => hit(r, c))).length;
  const o = out.offer[0];
  out.offerShare = o ? Math.round(((o.r - o.l) * (o.b - o.t)) / (W * H) * 1000) / 10 : 0;
  out.offerCentre = o ? o.l < W / 2 && o.r > W / 2 && o.t < H / 2 && o.b > H / 2 : false;
  out.cut = [...out.capsDesk, ...out.clocks, ...out.shares].filter((r) => r.cut).map((r) => r.text);
  return out;`));

const names = [];
const abc = 'абвгдежзиклмнопрстуфхэюя';
for (let i = 0; i < 3; i++) {
  const al = LANGS[i] === 'ru' ? abc : 'abcdefghiklmnoprstuvwxyz';
  const nm = (LANGS[i] === 'ru' ? 'Группа' : 'Crew') + Array.from({ length: 4 }, () => al[Math.floor(Math.random() * al.length)]).join('');
  console.log('login', i, nm);
  // A loaded machine now and then misses a click of the login: once more, the captain picked if she was made.
  for (let k = 0; ; k++) {
    try {
      if (k === 0) await L.login(P[i], { port: PORT, name: nm, know: true, captain: PATHS[i] });
      else {
        const pick = await P[i].evaluate(() => !document.querySelector('#screen-captain')?.classList.contains('hidden'));
        if (pick) {
          await P[i].click(`.captain-card[data-id="${PATHS[i]}"]`);
          await P[i].check('#know-sea').catch(() => {});
          await P[i].click('#pick-captain');
        }
        await P[i].waitForSelector('#hud:not(.hidden)', { timeout: 90000 });
        await sleep(2000);
      }
      break;
    } catch (e) {
      console.log('login retry', i, k, await P[i].evaluate(() => [...document.querySelectorAll('.screen')].map((s) => s.id + ':' + s.className)).catch(() => 'eval failed'));
      if (k >= 2) throw e;
    }
  }
  names.push(nm);
  await skip(P[i]);
}
for (const p of P) {
  await p.evaluate(() => document.body.classList.add('reduce-motion'));
  await say(p, `/level ${LEVEL}`);
  await say(p, `/ship frigate ${Math.min(10, Math.ceil(LEVEL / 6))}`, 1500);
  await say(p, `/army level ${Math.min(10, Math.ceil(LEVEL / 6))}`);
  // Fed and steady: a mutiny's card over the end screen is another helper's.
  await say(p, '/give provisions 60', 600);
  await say(p, '/morale 100', 600);
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('Escape').catch(() => {});
    await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later)$/.test(x.textContent.trim())).forEach((x) => x.click()));
    await sleep(300);
  }
  await L.closeAll(p, 2);
  if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(p); }
  await say(p, '/tp gravewater', 2500);
  await L.closeAll(p, 2);
}
await sleep(3000);
const rec = { mode: MODE, names, steps: [] };
const log = (k, v) => { rec.steps.push({ k, ...v }); console.log(k, JSON.stringify(v).slice(0, k === 'board' ? 4000 : 400)); };

const toasts = (p) => p.evaluate(() => globalThis.__toasts.slice(-4));
// The windows the sea opens by itself (leaving safe waters, a region's first sight): put away before the fight.
const tidy = async () => { for (const p of P) { await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later|В путь|Sail on|Понятно|Got it)$/.test(x.textContent.trim())).forEach((x) => x.click())).catch(() => {}); await L.closeAll(p, 1); } };
// ASK: the page whose captain is asked (the card on the sea); the other mate comes at once.
const ASK = Number(process.env.ASK ?? 2), AUTO = ASK === 2 ? 1 : 2;
// The mate who comes at once says so first (a busy page's message may lag the boarder's command).
await L.send(P[AUTO], { t: 'board_assist', auto: true });
await sleep(2500);
if (MODE === 'npc') {
  await say(P[0], `/mates ${names[1]} ${names[2]}`, 1500);
  log('mates', { said: (await P[0].evaluate(() => globalThis.__toasts)).filter((x) => /group|within reach/.test(x)), at: await Promise.all(P.map((p) => L.me(p))) });
  await tidy();
  await say(P[0], `/board ${process.env.FOE ?? 'pirate brig'}`, 1500);
} else {
  // Between captains: the pirate flag on all three in contested waters; the boarded captain (P2) alone, the boarder
  // (P0) with her mate (P1), who comes within reach after the grapples bite and joins as the next round opens.
  for (const p of P) await say(p, '/flag pirate');
  await tidy();
  // The boarded captain lies 150 m off the boarder's beam (/near), the boarder closes to 25 m of her; both fire a gun
  // into the sea (a new captain's protection ends with her first shot).
  await say(P[2], `/near ${names[0]}`, 2500);
  for (let k = 0; k < 4; k++) {
    for (const p of [P[0], P[2]]) for (const side of ['port', 'starboard']) await L.send(p, { t: 'fire', side, dist: 300 });
    await sleep(2500);
  }
  const at = await L.me(P[0]);
  await say(P[0], `/tp ${Math.round(at.x + 125)} ${Math.round(at.y)}`, 2500);
  // (a loaded page's burst of orders may be over the server's flood line: once more until the grapples bite)
  for (let k = 0; k < 4 && !(await view(P[0])); k++) await say(P[0], '/board', 2500);
  log('board', { said: (await P[0].evaluate(() => globalThis.__toasts)).filter((x) => !/Pirates attack|Lookout|storm front|breeze|Fog|XP —|pack closes|dips her|cargo over/.test(x)), said2: (await P[2].evaluate(() => globalThis.__toasts)).filter((x) => !/Pirates attack|Lookout|storm front|breeze|Fog|XP —|pack closes|dips her|cargo over/.test(x)), at: [await L.me(P[0]), await L.me(P[2])] });
  await say(P[0], `/mates ${names[1]}`, 1500);
}
const v0 = await waitFor(async () => { for (const p of P) await skip(p); return view(P[0]); }, 30000);
if (!v0) { console.log('no battle', await toasts(P[0])); await P[0].screenshot({ path: `${OUT}/_nobattle.png` }); await b.close(); process.exit(1); }
await sleep(2500);
for (const p of P) await skip(p);
// The card on the sea (the mate who is asked) — P2 in the fight against the sea.
if (MODE === 'npc') {
  const card = await waitFor(() => P[ASK].evaluate(() => !!document.querySelector('#board-offer:not(.hidden) .bo-card')), 15000);
  const m = await measure(P[ASK]);
  await P[ASK].screenshot({ path: `${OUT}/${tagOf(ASK)}_offer.png` });
  log('offer', { shown: !!card, share: m.offerShare, centre: m.offerCentre, outside: m.outside, cut: m.offerCut });
  await P[ASK].evaluate(() => document.querySelector('#board-offer [data-go]')?.click());
  await sleep(1500);
  log('asked', { said: await toasts(P[ASK]) });
}
await tidy();
for (let i = 0; i < 3; i++) {
  const v = await view(P[i]);
  const m = await measure(P[i]);
  // The captains' faces the field draws on the plates: loaded?
  m.faces = await P[i].evaluate(() => [...(globalThis.gravetide.tactical?.capImgs?.entries?.() ?? [])].map(([k, im]) => `${k}:${im.complete ? im.naturalWidth : 'loading'}`));
  await P[i].screenshot({ path: `${OUT}/${tagOf(i)}_r1.png` });
  log(`r1_${i}`, { faces: m.faces, v, caps: m.caps.length, capsDesk: m.capsDesk.length, clocks: m.clocks.map((c) => c.text), outside: m.outside, onFaces: m.capsOnFaces, onClocks: m.capsOnTop, q: m.q.length, cut: m.cut, hint: m.hint, turn: m.turn });
}
// The turns: each captain plays her own stacks — her first turn shot and measured; an ally gives an order (and a second
// in the same round is refused); then everyone on auto to the end.
// The end screens: a watcher on each page snaps the reckoning the moment it shows (the battle closes itself a few
// seconds after; the film of a boarding won or lost is skipped as it comes).
const ends = P.map((p, i) => (async () => {
  const t1 = Date.now();
  while (Date.now() - t1 < 760000) {
    await skip(p).catch(() => {});
    const on = await p.evaluate(() => !!document.querySelector('.tb-banner.tb-end:not(.hidden)')).catch(() => false);
    if (on) {
      await skip(p).catch(() => {});
      await sleep(250);
      const v = await view(p);
      const m = await measure(p);
      await p.screenshot({ path: `${OUT}/${tagOf(i)}_end.png` });
      log(`end_${i}`, { over: v?.over ?? null, shares: v?.shares ?? null, shareChips: m.shares, outside: m.outside, cut: m.cut, said: await toasts(p) });
      return true;
    }
    await sleep(250);
  }
  return false;
})());
const firsts = [false, false, false];
const orders = [false, false, false];
const t0 = Date.now();
while (Date.now() - t0 < (MODE === 'pvp' ? 720000 : 300000)) {
  let over = false;
  for (let i = 0; i < 3; i++) {
    await skip(P[i]);
    const v = await view(P[i]);
    if (!v) continue;
    if (v.over) over = true;
    if (!v.mine || v.over) continue;
    if (!firsts[i]) {
      firsts[i] = true;
      await sleep(900);
      const m = await measure(P[i]);
      await P[i].screenshot({ path: `${OUT}/${tagOf(i)}_turn.png` });
      log(`turn_${i}`, { round: v.round, slot: v.slot, own: v.own, clocks: m.clocks.map((c) => c.text), turn: m.turn, hint: m.hint, outside: m.outside, onFaces: m.capsOnFaces, cut: m.cut });
    }
    if (!orders[i] && !v.cast) {
      const sp = v.spells.find((s) => s[1] <= v.round);
      if (sp) {
        const foe = await P[i].evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t.stacks.find((s) => s.side !== t.you)?.id; });
        const own = await P[i].evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t.stacks.find((s) => s.side === t.you && (s.own ?? 0) === (t.slot ?? 0))?.id; });
        const before = { mana: v.mana, stam: v.stam };
        for (const target of [undefined, foe, own]) {
          await L.send(P[i], { t: 'tac', act: { a: 'spell', id: sp[0], ...(target !== undefined ? { target } : {}) } });
          await sleep(700);
          const w = await view(P[i]);
          if (w?.cast) {
            // A second order in the same round: refused.
            const sp2 = w.spells.find((s) => s[0] !== sp[0] && s[1] <= w.round);
            if (sp2) await L.send(P[i], { t: 'tac', act: { a: 'spell', id: sp2[0], target: foe } });
            await sleep(600);
            const toast = await P[i].evaluate(() => [...document.querySelectorAll('.toast, #toasts *')].map((e) => e.textContent.trim()).filter(Boolean).slice(-2));
            const w2 = await view(P[i]);
            await P[i].screenshot({ path: `${OUT}/${tagOf(i)}_order.png` });
            log(`order_${i}`, { id: sp[0], slot: w.slot, before, after: { mana: w.mana, stam: w.stam }, second: sp2?.[0] ?? null, stillCast: w2?.cast, toast });
            orders[i] = true;
            break;
          }
        }
      }
    }
    // Defend this turn; from round 3 the auto-battle plays the rest.
    if (v.round >= 3) await L.send(P[i], { t: 'tac', act: { a: 'auto', on: true } });
    else await L.send(P[i], { t: 'tac', act: { a: 'defend' } });
    await sleep(400);
  }
  if (over) break;
  await sleep(300);
}
await Promise.race([Promise.all(ends), sleep(20000)]);
rec.errors = P.map((p) => p.errors);
writeFileSync(`${OUT}/${MODE}_${LANGS.join('-')}.json`, JSON.stringify(rec, null, 1));
console.log('errors', JSON.stringify(rec.errors));
await b.close();
