// VK 4.2.4 proof (2026-11-05): the newcomer's quay, then the ladder rung by rung (admin /level), the port's places and
// the pill «Открыто: …» at each; the offers the server sends at each level.
import { browser, page, login, sleep, say, closeAll } from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/onb';
const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const tag = `${W}x${H}`;
const b = await browser();
const p = await page(b, [W, H]);
await login(p, { port: Number(process.env.GPORT) });
await sleep(3000);
const vis = (sel) => p.evaluate((q) => [...document.querySelectorAll(q)].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && s.display !== 'none' && s.visibility !== 'hidden'; }).map((e) => e.dataset.ptab || e.dataset.tile || e.dataset.menu || e.id || e.className.toString().split(' ')[0]), sel);
await p.screenshot({ path: `${OUT}/L-${tag}-0-quay.png` });
console.log('quay modal', await p.evaluate(() => globalThis.gravetide.modal()), 'watch', await p.evaluate(() => globalThis.gravetide.state.onboarding?.stage), 'locked', await p.evaluate(() => globalThis.gravetide.state.onboarding?.locked?.join(',')));
console.log('quay buttons', JSON.stringify(await vis('#hud button, #touch > button, #touch button.sea-round, .cs-dbl, .hud-exch, .cs-glory')));
// the watch skipped as a whole (the lessons are the e2e's)
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'onboarding', action: 'skip_all' }));
await sleep(3000);
console.log('after watch: campaign', await p.evaluate(() => globalThis.gravetide.state.self?.quests?.active?.map((q) => q.id).join(',')));
const promos = () => p.evaluate(() => (globalThis.gravetide.promos?.view?.cards ?? globalThis.gravetide.promos?.v?.cards ?? []).map((c) => c.special ?? c.ctx).join(','));
for (const L of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
  if (L > 1) await say(p, `/level ${L}`);
  await sleep(3500);
  await closeAll(p, 2);
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/L-${tag}-${L}-sea.png` });
  const pill = await p.evaluate(() => document.querySelector('#guide-tip:not(.hidden)')?.innerText.replace(/\s+/g, ' ') ?? '');
  await p.evaluate(() => globalThis.gravetide.open('port'));
  await sleep(1500);
  const tabs = await vis('#modal-panel [data-ptab]');
  if (L === 1 || L === 5 || L === 12) await p.screenshot({ path: `${OUT}/L-${tag}-${L}-port.png` });
  console.log(`L${L}`, 'pill:', pill, '| tabs:', tabs.join(','), '| hud:', (await vis('.cs-dbl, .hud-exch, #tc-offer, #tc-daily, #hud-chat, .dk-abil, #tc-abil, #tc-special, .dk-shot')).join(','), '| promo:', await promos());
}
console.log('errors', p.errors.slice(0, 5));
await b.close();
