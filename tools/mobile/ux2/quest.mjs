// ux2 · a quest's mark and the course to it (owner, 2026-10-11: «после взятия квеста должна быть метка куда плыть,
// нажатие на эту метку корабль начинает плавание до места. вообще нужно максимум автоматизировать все»).
// At a phone held sideways, touch: a job taken on the notice board is followed at once; «Плыть» in the journal; off the
// quay the helmsman sets the course by himself («Курс к заданию»); the gold beacon / edge arrow on the sea; the pill's
// stop ends the run; a tap on the arrow starts it again; brought near the port she puts in by herself and the step is done.
//   PORT=58992 node tools/mobile/ux2/quest.mjs [--size 844x390] [--shots docs/img/ux2]
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(process.env.PORT ?? arg('port', 58992));
const [W, H] = arg('size', '844x390').split('x').map(Number);
const SHOTS = arg('shots', 'docs/img/ux2');
mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what) => { L.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };
const until = async (p, fn, a, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, a).catch(() => false)) return true; await L.sleep(200); } return false; };
const film = (p) => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = (p, line, ms = 1200) => L.say(p, line).then(() => L.sleep(ms));
const docked = (p) => p.evaluate(() => globalThis.gravetide.state.self?.dockedAt ?? null);

const b = await L.browser();
const p = await L.page(b, [W, H], { lang: 'ru', touch: true });
const cdp = await p.ctx.newCDPSession(p);
const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await L.sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
try {
  await L.login(p, { port: PORT, know: true, name: 'Метка' + Math.random().toString(36).slice(2, 6) });
  await say(p, '/level 12');
  await say(p, '/silver 5000');
  await p.evaluate(() => document.querySelectorAll('[data-lulater]').forEach((x) => x.click()));
  // in port: take jobs until one asks for another port
  await say(p, '/tp saltmarrow', 2500); await film(p);
  for (let i = 0; i < 6 && !(await docked(p)); i++) { await L.send(p, { t: 'dock', bribe: false }); await L.sleep(1500); await film(p); }
  check(!!(await docked(p)), 'docked at Saltmarrow');
  await L.closeAll(p);
  const here = await docked(p);
  let quest = null;
  const offers = await p.evaluate(() => (globalThis.gravetide.state.portView?.questOffers ?? []).map((q) => q.id));
  for (const id of offers) {
    await L.send(p, { t: 'quest', action: 'accept', id });
    await L.sleep(900);
    quest = await p.evaluate(([qid, at]) => { const q = globalThis.gravetide.state.self.quests.find((x) => x.id === qid); return q?.target?.act === 'dock' && q.target.port !== at ? { id: q.id, name: q.name, target: q.target } : null; }, [id, here]);
    if (quest) break;
    await L.send(p, { t: 'quest', action: 'abandon', id });
    await L.sleep(400);
  }
  check(!!quest, `a job to another port taken: ${quest ? `${quest.name} → ${quest.target.port}` : 'none on the board'}`);
  if (!quest) throw new Error('no job with a port');
  check(await p.evaluate((id) => localStorage.getItem('gravetide.track') === id, quest.id), 'the job just taken is followed');
  // the journal: «Плыть» with the distance
  await L.open(p, 'journal');
  await until(p, () => !!document.querySelector('#modal-panel [data-jsail]'));
  const btn = await p.evaluate(() => document.querySelector('#modal-panel [data-jsail]')?.textContent?.trim());
  check(/Плыть после выхода|Плыть/.test(btn ?? ''), `the journal's button: «${btn}»`);
  await p.screenshot({ path: `${SHOTS}/quest-journal__${W}x${H}.png` });
  await L.closeAll(p);
  // off the quay: the course to the job by itself
  await p.evaluate(() => globalThis.gravetide.state.self && (globalThis.gravetide.state.self.dockedAt, 0));
  await L.send(p, { t: 'undock' });
  await L.sleep(2500); await film(p);
  check(await until(p, () => !!globalThis.gravetide.state.autosail, null, 20000), 'off the quay: the helmsman has the course («Курс к заданию»)');
  check(await p.evaluate((id) => globalThis.gravetide.goalRun() === `q:${id}`, quest.id), 'the run is the job’s');
  await L.sleep(1500);
  await p.screenshot({ path: `${SHOTS}/quest-course__${W}x${H}.png` });
  // the pill's stop ends the run; the beacon or edge arrow is tapped: the course again
  await p.evaluate(() => document.querySelector('#hud-autosail .as-stop')?.click());
  check(await until(p, () => !globalThis.gravetide.state.autosail && !globalThis.gravetide.goalRun(), null, 8000), 'the pill’s stop: the run ended');
  await L.closeAll(p);
  await L.sleep(800);
  const mark = await p.evaluate(() => globalThis.gravetide.renderer.goalMark);
  check(!!mark, `the gold mark drawn on the sea or its edge ${JSON.stringify(mark)}`);
  if (mark) {
    await p.screenshot({ path: `${SHOTS}/quest-mark__${W}x${H}.png` });
    await tap(Math.round(mark.x), Math.round(mark.y));
    check(await until(p, () => !!globalThis.gravetide.state.autosail, null, 8000), 'a tap on the gold mark: the course is set');
    check(await p.evaluate((id) => globalThis.gravetide.goalRun() === `q:${id}`, quest.id), 'and the run follows the job');
  }
  // brought near the port: she puts in by herself and the step is done
  await say(p, `/tp ${quest.target.port}`, 3000); await film(p);
  check(await until(p, (port) => globalThis.gravetide.state.self?.dockedAt === port, quest.target.port, 30000), `near ${quest.target.port}: she put in by herself`);
  const left = await p.evaluate((id) => globalThis.gravetide.state.self.quests.find((q) => q.id === id), quest.id);
  // (a visit is done by putting in; a delivery wants its cargo in the hold — the server says so in a toast)
  const toast = await p.evaluate(() => [...document.querySelectorAll('#toasts .toast, #modal-toasts .toast')].map((t) => t.textContent).join(' | '));
  check(!left || left.step > 1 || /ждут|waiting/i.test(toast), `the step done there, or its cargo asked for (${left ? `step ${left.step}/${left.steps}: ${left.text}` : 'the job done'}) ${toast.slice(0, 160)}`);
  await p.screenshot({ path: `${SHOTS}/quest-arrived__${W}x${H}.png` });
  if (p.errors.length) L.log('page errors', p.errors.slice(-5));
} catch (e) {
  fails++;
  L.log('FAIL', e.message);
} finally {
  await b.close();
}
L.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
