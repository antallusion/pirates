// Owner, 2026-10-16: the battle's order bar, threat zones, deployment, log, why and replay in a real browser — the test
// battle (/?battle) at a size and a language; screenshots and the boxes of what stands where, checked by numbers.
//   PORT=58987 W=844 H=390 LANG=ru node tools/mobile/fight/tac16.mjs
import * as L from '../m0/lib.mjs';
const PORT = Number(process.env.PORT ?? 58987);
const W = Number(process.env.W ?? 844), H = Number(process.env.H ?? 390), LANG = process.env.LANG2 ?? process.env.LANG_ ?? process.env.TLANG ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/tac16';
const tag = `${W}x${H}_${LANG}`;
const sleep = L.sleep;
const b = await L.browser();
const problems = [];
const shot = async (p, name) => {
  const cdp = await p.context().newCDPSession(p);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${name}_${tag}.png`, Buffer.from(data, 'base64'));
};
/** Visible boxes of a selector: [left, top, right, bottom]. */
const boxes = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => {
  const r = e.getBoundingClientRect();
  const cs = getComputedStyle(e);
  return r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none' ? { k: (e.className || e.tagName).toString().slice(0, 40), b: [r.left, r.top, r.right, r.bottom].map(Math.round) } : null;
}).filter(Boolean), sel);
const overlap = (a, c) => !(a[2] <= c[0] || a[0] >= c[2] || a[3] <= c[1] || a[1] >= c[3]);
/** The hexes of the field as the canvas draws them (screen px). */
const hexXY = (p, i) => p.evaluate((i) => { const t = globalThis.gravetide.tactical; const c = t.canvas.getBoundingClientRect(); const q = t.center(i); return { x: c.left + q.x, y: c.top + q.y }; }, i);
const view = (p) => p.evaluate(() => { const v = globalThis.gravetide.tactical.view; return v ? JSON.parse(JSON.stringify(v)) : null; });
try {
  const touch = W < 1000;
  const P = await L.page(b, [W, H], { lang: LANG, touch });
  await L.login(P, { port: PORT, know: true, name: (LANG === 'ru' ? 'Бой' : 'Fight') + Math.random().toString(36).slice(2, 5) });
  await L.closeAll(P);
  // The test battle's army, and a pirate brig lashed alongside at once (the link's patrol strikes before the grapples).
  const say = (text) => P.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t }), text);
  await P.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
  await sleep(4000);
  await L.closeAll(P);
  for (const c of ['/level 30', '/heal', '/army clear', '/army marine 30', '/army musketeer 16', '/army mermaid 14', '/army lantern_maw 6', '/scrolls 5', '/board pirate brig']) { await say(c); await sleep(800); }
  for (let i = 0; i < 120 && !(await P.evaluate(() => document.body.classList.contains('tac'))); i++) await sleep(1000);
  await sleep(2500);
  await L.closeAll(P);
  let v = await view(P);
  console.log(tag, 'deploy?', !!v?.deploy, 'round', v?.round);
  // ---- deployment
  if (v?.deploy) {
    await sleep(1500);
    await shot(P, '1_deploy');
    const line = await boxes(P, touch ? '.tb-dline' : '.tb-hint');
    const ready = await boxes(P, touch ? '[data-ready]' : '.tb-acts [data-a="ready"]');
    console.log('deploy line', JSON.stringify(line), 'ready', JSON.stringify(ready));
    if (!line.length) problems.push('no deployment line');
    if (!ready.length) problems.push('no «Готово»');
    // Drag her first stack to a free hex of her columns.
    const mine = v.stacks.filter((s) => s.side === v.you);
    const free = v.deploy.zone.find((h) => !v.stacks.some((s) => s.hex === h));
    const a = await hexXY(P, mine[0].hex), c = await hexXY(P, free);
    await P.mouse.move(a.x, a.y);
    await P.mouse.down();
    for (let k = 1; k <= 6; k++) { await P.mouse.move(a.x + ((c.x - a.x) * k) / 6, a.y + ((c.y - a.y) * k) / 6); await sleep(40); }
    await P.mouse.up();
    await sleep(1200);
    v = await view(P);
    const moved = v.stacks.find((s) => s.id === mine[0].id)?.hex === free;
    console.log('dragged', moved);
    if (!moved) problems.push('drag in deployment did not set the stack');
    await shot(P, '2_deployed');
    await P.click(touch ? '[data-ready]' : '.tb-acts [data-a="ready"]');
    for (let i = 0; i < 20 && (await view(P))?.deploy; i++) await sleep(500);
  }
  await sleep(3500);
  v = await view(P);
  console.log('round', v?.round, 'order', v?.order?.length, 'next', v?.next?.length);
  // ---- the order bar
  const q = await boxes(P, touch ? '.tb-qbar .tb-q' : '.tb-queue .tb-q');
  console.log('order faces', q.length, JSON.stringify(q.slice(0, 3)));
  if (q.length < 3) problems.push(`order bar shows ${q.length} faces`);
  if (touch) {
    const bar = (await boxes(P, '.tb-qrow'))[0];
    const others = await boxes(P, '.tb-chip, .tb-pl, .tb-pr, .tb-fast');
    for (const o of others) if (bar && overlap(bar.b, o.b)) problems.push(`order bar overlaps ${o.k}`);
    const band = await P.evaluate(() => globalThis.gravetide.tactical.band);
    const top = await P.evaluate(() => { const t = globalThis.gravetide.tactical; const c = t.canvas.getBoundingClientRect(); let m = 1e9; for (let i = 0; i < 99; i++) if (t.view.cells[i] !== '#') m = Math.min(m, c.top + t.center(i).y - t.size.w * 0.5); return m; });
    console.log('bar', bar?.b, 'band', JSON.stringify(band), 'field top', Math.round(top));
    if (bar && top < bar.b[3] - 1) problems.push(`the field's top row (${Math.round(top)}) under the bar (${bar.b[3]})`);
  }
  await shot(P, '3_order');
  // ---- a foe's threat: tap its face in the order bar
  const foeId = v.stacks.find((s) => s.side !== v.you)?.id;
  await P.evaluate((id) => { const t = globalThis.gravetide.tactical; t.qTap(id); }, foeId);
  await sleep(600);
  const tz = await P.evaluate(() => { const t = globalThis.gravetide.tactical; const z = t.threatZone(t.view); return z ? [z.hit.size, z.range.size] : null; });
  console.log('threat of', foeId, tz);
  if (!tz || !tz[0]) problems.push('no threat zone for the foe picked');
  await shot(P, '4_threat');
  await P.evaluate((id) => globalThis.gravetide.tactical.qTap(id), foeId); // its card
  await sleep(700);
  await shot(P, '5_card');
  const thr = await boxes(P, '.tb-thr');
  console.log('card threat line', thr.length);
  await L.closeAll(P);
  await P.keyboard.press('Escape');
  await P.evaluate(() => { const t = globalThis.gravetide.tactical; t.showInfo(null); t.qFocus = null; t.key = ''; });
  // ---- danger hexes and the log
  await P.evaluate(() => globalThis.gravetide.tactical.button('danger'));
  await sleep(500);
  await shot(P, '6_danger');
  await P.evaluate(() => globalThis.gravetide.tactical.button('danger'));
  await P.evaluate(() => globalThis.gravetide.tactical.order({ a: 'auto', on: true }));
  for (let i = 0; i < 30 && (await P.evaluate(() => globalThis.gravetide.tactical.journal.size)) < 6; i++) await sleep(1000);
  await P.evaluate(() => globalThis.gravetide.tactical.openLog());
  await sleep(700);
  const lines = await P.evaluate(() => document.querySelectorAll('.tb-log li').length);
  console.log('log lines', lines);
  if (lines < 3) problems.push(`log has ${lines} lines`);
  await shot(P, '7_log');
  if (LANG === 'ru') {
    const latin = await P.evaluate(() => [...document.querySelectorAll('.tb-log li')].map((x) => x.textContent).filter((t) => /[A-Za-z]/.test(t)));
    if (latin.length) problems.push(`latin in the RU log: ${latin.slice(0, 2).join(' | ')}`);
  }
  await P.evaluate(() => globalThis.gravetide.tactical.openLog());
  // ---- the end, the why, the replay
  for (let i = 0; i < 150 && !(await P.evaluate(() => !!globalThis.gravetide.tactical.view?.over)); i++) await sleep(1000);
  await sleep(1500);
  await shot(P, '8_end');
  const end = await boxes(P, '.tb-banner [data-why], .tb-banner [data-replay], .tb-banner [data-endbtn]');
  console.log('end buttons', JSON.stringify(end));
  const why = await P.evaluate(() => globalThis.gravetide.tactical.view?.result?.why ? true : false);
  if (!why) problems.push('no why in the result');
  await P.evaluate(() => globalThis.gravetide.tactical.openWhy(globalThis.gravetide.tactical.view));
  await sleep(800);
  await shot(P, '9_why');
  const rid = await P.evaluate(() => globalThis.gravetide.tactical.view?.result?.replay ?? null);
  console.log('replay id', rid);
  const id = rid ?? (await P.evaluate(() => new Promise((res) => { const n = globalThis.gravetide.net; const off = n.on((m) => { if (m.t === 'tac_replay' && m.list) { res(m.list[0]?.id ?? null); } }); n.send({ t: 'tac_replay' }); setTimeout(() => res(null), 3000); void off; })));
  if (id) {
    await P.evaluate((x) => globalThis.gravetide.tactical.askReplay(x), id);
    await sleep(6000);
    await shot(P, '10_replay');
    const rp = await P.evaluate(() => { const t = globalThis.gravetide.tactical; return { on: t.replaying(), k: t.rp?.k, n: t.rp?.frames.length, round: t.view?.round }; });
    console.log('replay', JSON.stringify(rp));
    if (!rp.on) problems.push('replay did not start');
  } else console.log('no replay kept (a fight against the sea that does not matter)');
  console.log('errors', P.errors.slice(0, 5));
  if (P.errors.length) problems.push(`${P.errors.length} page errors`);
} finally {
  await b.close();
}
console.log(tag, problems.length ? `PROBLEMS:\n- ${problems.join('\n- ')}` : 'OK');
