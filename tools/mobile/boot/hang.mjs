// Where the page hangs: pause it after the captain is picked and print the stack.
import { browser, page, sleep } from '../m0/lib.mjs';
const b = await browser();
const p = await page(b, [812, 375], { touch: true });
const cdp = await p.context().newCDPSession(p);
await cdp.send('Debugger.enable');
const t0 = Date.now();
await p.goto('http://localhost:58990/' + (process.env.Q ?? ''), { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => globalThis.__gtReady, null, { timeout: 60000 });
await p.fill('#login-name', 'Hang ' + Math.random().toString(36).slice(2, 5));
await p.evaluate(() => document.querySelector('#login-form button[type=submit]').click());
await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 30000 });
p.on('console', (m) => { if (m.text().startsWith('MUT')) console.log(m.text().slice(0, 300)); });
await p.evaluate(() => { let n = 0; new MutationObserver((rs) => { if (n++ > 25) return; for (const r of rs.slice(0, 4)) console.log('MUT', n, r.target.className || r.target.id || r.target.nodeName, '+', [...r.addedNodes].map((x) => x.nodeName + '.' + (x.className || '') + ':' + (x.textContent || '').slice(0, 30)).join(','), '-', [...r.removedNodes].map((x) => x.nodeName + '.' + (x.className || '') + ':' + (x.textContent || '').slice(0, 30)).join(',')); }).observe(document.getElementById('modal-panel'), { childList: true, subtree: true, characterData: true }); });
await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
await p.evaluate(() => document.getElementById('pick-captain')?.click());
await sleep(Number(process.env.W ?? 8000));
for (let k = 0; k < 3; k++) {
  const paused = new Promise((r) => cdp.once('Debugger.paused', r));
  await cdp.send('Debugger.pause');
  const ev = await Promise.race([paused, sleep(15000).then(() => null)]);
  if (!ev) { console.log('no pause'); break; }
  console.log('--- pause', k);
  for (const f of ev.callFrames.slice(0, 14)) console.log(`${f.functionName || '(anon)'} ${f.url.replace(/^.*\/src\//, '').replace(/\?.*$/, '')}:${f.location.lineNumber + 1}`);
  await cdp.send('Debugger.resume');
  await sleep(1500);
}
await b.close();
