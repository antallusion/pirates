// VK 4.2.4 proof: at sea, the gun deck at level 1, 3 (the tricks), 2 (the shot types) — what shows.
import { browser, page, login, sleep, say, closeAll } from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/onb';
const [W, H] = (process.env.SIZE ?? '1280x720').split('x').map(Number);
const b = await browser();
const p = await page(b, [W, H]);
await login(p, { port: Number(process.env.GPORT) });
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'onboarding', action: 'skip_all' }));
await sleep(2000);
await closeAll(p, 2);
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
await sleep(6000);
console.log('state keys', await p.evaluate(() => Object.keys(globalThis.gravetide.state).filter((k) => /quest|camp/i.test(k)).join(',')));
console.log('campaign', await p.evaluate(() => JSON.stringify(globalThis.gravetide.state.campaign ?? null).slice(0, 200)));
const vis = () => p.evaluate(() => [...document.querySelectorAll('.dk-slot, #tc-abil, #tc-special, #tc-skill, #tc-ammo, #tc-daily, #tc-offer, .cs-dbl, #hud-chat')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && s.display !== 'none' && s.visibility !== 'hidden'; }).map((e) => e.dataset.shot || e.dataset.ab || e.id || e.className.toString().split(' ')[0]).join(','));
for (const L of [1, 2, 3, 5]) {
  if (L > 1) await say(p, `/level ${L}`);
  await sleep(4000);
  await closeAll(p, 2);
  await p.screenshot({ path: `${OUT}/S-${W}x${H}-${L}.png` });
  console.log(`L${L}`, await vis());
}
console.log('errors', p.errors.slice(0, 5));
await b.close();
