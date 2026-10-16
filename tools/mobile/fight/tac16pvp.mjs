// Owner, 2026-10-16: the deployment between two captains — both set their stacks at once, each unseen by the other.
// Two browsers (the second without WebGL), the second brought alongside the first, the first grapples her.
//   PORT=58987 node tools/mobile/fight/tac16pvp.mjs
import * as L from '../m0/lib.mjs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT ?? 58987);
const sleep = L.sleep;
const OUT = 'assets/raw/audit/tac16';
const shot = async (p, name) => {
  const cdp = await p.context().newCDPSession(p);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  (await import('node:fs')).writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
};
const say = (p, text) => p.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t }), text);
const view = (p) => p.evaluate(() => { const v = globalThis.gravetide.tactical.view; return v ? { you: v.you, round: v.round, deploy: v.deploy ?? null, sides: [...new Set(v.stacks.map((s) => s.side))], n: v.stacks.length } : null; });
const b1 = await L.browser();
const b2 = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--disable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
try {
  const A = await L.page(b1, [844, 390], { lang: 'ru' });
  const B = await L.page(b2, [844, 390], { lang: 'en' });
  for (const [p, n] of [[A, 'Альфа'], [B, 'Bravo']]) {
    await L.login(p, { port: PORT, know: true, name: n + Math.random().toString(36).slice(2, 5) });
    await L.closeAll(p);
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
    await sleep(3000);
    for (const c of ['/level 30', '/heal', '/army clear', '/army marine 30', '/army musketeer 16', '/flag pirate', '/tp gravewater']) { await say(p, c); await sleep(500); }
  }
  await sleep(2000);
  const at = await A.evaluate(() => { const s = globalThis.gravetide.state.you; return [Math.round(s.x), Math.round(s.y)]; });
  await say(B, `/tp ${at[0] + 5} ${at[1] + 3}`);
  await sleep(4000);
  const bt = await B.evaluate(() => { const s = globalThis.gravetide.state.you; return [Math.round(s.x), Math.round(s.y)]; });
  console.log('A at', at, 'B at', bt);
  await sleep(1000); // (a ship just moved is protected a while: below)
  const at2 = await A.evaluate(() => { const s = globalThis.gravetide.state.you; return [Math.round(s.x), Math.round(s.y)]; });
  await say(B, `/tp ${at2[0] + 5} ${at2[1] + 3}`);
  await sleep(16500);
  const at3 = await A.evaluate(() => { const s = globalThis.gravetide.state.you; return [Math.round(s.x), Math.round(s.y)]; });
  await A.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
  await sleep(1500);
  const at4 = await A.evaluate(() => { const s = globalThis.gravetide.state.you; return [Math.round(s.x), Math.round(s.y)]; });
  await say(B, `/tp ${at4[0] + 3} ${at4[1]}`);
  void at3;
  await sleep(1200);
  await A.evaluate(() => { globalThis.__msgs = []; globalThis.gravetide.net.on((m) => { if (m.t !== 'snap' && m.t !== 'info') globalThis.__msgs.push(JSON.stringify(m).slice(0, 160)); }); });
  await say(A, '/board');
  for (let i = 0; i < 12 && !(await view(A)); i++) await sleep(1000);
  await sleep(1500);
  console.log('A msgs', await A.evaluate(() => globalThis.__msgs.filter((x) => !/board_tac/.test(x)).slice(0, 8).join(' || ')));
  const va = await view(A), vb = await view(B);
  console.log('A', JSON.stringify(va), 'B', JSON.stringify(vb));
  if (!va || !vb) problems.push('no boarding between the two');
  else {
    if (!va.deploy || !vb.deploy) problems.push('no deployment for both');
    if (va.sides.length !== 1 || vb.sides.length !== 1) problems.push('a side sees the other\'s stacks while setting');
    if (!va.deploy?.hidden) problems.push('not marked hidden');
    await L.closeAll(A);
    await L.closeAll(B);
    await sleep(800);
    await shot(A, 'pvp_deploy_A_844x390_ru');
    await shot(B, 'pvp_deploy_B_844x390_en');
    await L.closeAll(A);
    await A.evaluate(() => globalThis.gravetide.tactical.order({ a: 'ready' }));
    await sleep(1000);
    const a2 = await view(A);
    console.log('A after ready', JSON.stringify(a2));
    if (!a2?.deploy?.ready) problems.push('A not set after «Готово»');
    await B.evaluate(() => globalThis.gravetide.tactical.order({ a: 'ready' }));
    await sleep(2500);
    const a3 = await view(A), b3 = await view(B);
    console.log('after both', JSON.stringify(a3), JSON.stringify(b3));
    if (a3?.deploy || a3?.round !== 1 || a3?.sides.length !== 2) problems.push('round one did not open with both sides seen');
    await shot(A, 'pvp_round1_A_844x390_ru');
  }
  console.log('errors', A.errors.slice(0, 3), B.errors.slice(0, 3));
} finally {
  await b1.close();
  await b2.close();
}
console.log(problems.length ? `PROBLEMS:\n- ${problems.join('\n- ')}` : 'PVP OK');
