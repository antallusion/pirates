// The roaming stacks' new kinds and a captain's 30-minute rest, on a phone held sideways: screenshots.
import { browser, page, login, say, sleep, shot, log, closeAll } from '../m0/lib.mjs';
const b = await browser();
const p = await page(b, [812, 375], { touch: true });
await login(p, { port: 58990, know: true });
await say(p, '/level 40'); await sleep(500);
await say(p, '/ship frigate'); await sleep(800);
await say(p, '/army level 8'); await sleep(500);
await say(p, '/noboard on'); await sleep(300);
await say(p, '/god'); await sleep(300);
const calm = () => p.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^(Позже|Later)$/.test((b.textContent ?? '').trim()) && b.getClientRects().length) b.click(); });
const kinds = (process.env.KINDS ?? 'storm_roc,banshee,cliff_harpy,plumed_serpent,crab_queen,wreck_titan').split(',');
for (const k of kinds) {
  await say(p, `/stack ${k} go`); await sleep(2500);
  await closeAll(p); await calm(); await sleep(400);
  await p.evaluate(() => globalThis.gravetide.renderer.targetZoom = 1.4); await sleep(1200);
  await shot(p, `rest-kind-${k}`);
  log(k, await p.evaluate(() => document.getElementById('hud-prompt')?.innerText.replace(/\s+/g, ' ').slice(0, 160)));
}
// fight the last one out, then let the world bring it back (×40 for a few seconds), and look at it
await say(p, '/stack gull go'); await sleep(2000);
const here = await p.evaluate(() => { const o = globalThis.gravetide.state.ownDisplay; return { x: Math.round(o.x), y: Math.round(o.y) }; });
await say(p, '/stack fight'); await sleep(2500);
await p.evaluate(() => { document.querySelectorAll('#board-tac .tb-end button, #board-tac [data-close], #board-tac .btn').forEach((x) => /Вернуться|Закрыть|В море|Далее|OK|Продолжить/.test(x.textContent ?? '') && x.click()); });
await sleep(1500);
await say(p, '/speed 60'); await sleep(8000); await say(p, '/speed 1'); await sleep(2500);
await say(p, `/tp ${here.x} ${here.y}`); await sleep(3500);
const v = await p.evaluate(() => globalThis.gravetide.state.roams.filter((x) => x.back).map((x) => ({ id: x.id, kind: x.kind, back: x.back })));
log('resting', JSON.stringify(v));
if (v[0]) {
  const at = await p.evaluate((id) => globalThis.gravetide.roamNow(id), v[0].id);
  await say(p, `/tp ${Math.round(at.x + 140)} ${Math.round(at.y + 60)}`); await sleep(3000);
  await closeAll(p); await calm();
  await p.evaluate((id) => { globalThis.gravetide.state.roamMark = id; }, v[0].id);
  await sleep(1500);
  await p.evaluate(() => globalThis.gravetide.renderer.targetZoom = 1.6); await sleep(1000);
  await shot(p, 'rest-sea');
  log('prompt', await p.evaluate(() => document.getElementById('hud-prompt')?.innerText.replace(/\s+/g, ' ').slice(0, 200)));
  await p.evaluate((id) => document.querySelector('[data-act]') && [...document.querySelectorAll('#hud-prompt [data-act]')].find((b) => /Осмотреть/.test(b.textContent))?.click(), v[0].id);
  await sleep(1200);
  await shot(p, 'rest-card');
  log('card', await p.evaluate(() => document.querySelector('#confirm')?.innerText.replace(/\s+/g, ' ').slice(0, 300)));
}
log('errors', p.errors.slice(0, 5));
await b.close();
