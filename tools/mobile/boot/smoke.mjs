import { browser, page, sleep } from '../m0/lib.mjs';
const b = await browser();
const p = await page(b, [812, 375], { touch: true });
p.on('crash', () => console.log('CRASH at', Date.now() - t0));
p.on('console', (m) => { if (/boot|gl|error/i.test(m.text())) console.log('C', m.text().slice(0, 150)); });
const t0 = Date.now();
await p.goto((process.env.U ?? 'http://localhost:58990/') + (process.env.Q ?? ''), { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => globalThis.__gtReady, null, { timeout: 60000 });
await p.fill('#login-name', 'Проба ' + Math.random().toString(36).slice(2, 5));
await p.evaluate(() => document.querySelector('#login-form button[type=submit]').click());
await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 30000 });
console.log('captain at', Date.now() - t0);
await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
await p.evaluate(() => document.getElementById('pick-captain')?.click());
for (let i = 0; i < 40; i++) { try { if (await p.$('#hud:not(.hidden)')) break; } catch (e) { console.log('ERR', e.message.slice(0, 60)); break; } await sleep(500); }
console.log('hud at', Date.now() - t0);
for (let i = 0; i < 10; i++) { await sleep(1000); try { console.log(i, await p.evaluate(() => ({ t: globalThis.gravetide.renderer.time.toFixed(1), mem: performance.memory?.usedJSHeapSize >> 20 }))); } catch (e) { console.log('ERR', e.message.slice(0, 60)); break; } }
await b.close();
