// The sea's controls at a size, out of port (docs/28): node tools/mobile/chat/sea.mjs 812x375 tag
import * as L from '../m0/lib.mjs';
const PORT = Number(process.env.PORT ?? 58999);
const sizes = (process.argv[2] ?? '812x375').split(',');
const tag = process.argv[3] ?? 'sea';
const b = await L.browser();
try {
  const [w, h] = sizes[0].split('x').map(Number);
  const p = await L.page(b, [w, h], { lang: 'ru' });
  await L.login(p, { port: PORT, know: true, name: 'Море' + Math.random().toString(36).slice(2, 5) });
  await L.closeAll(p);
  await L.send(p, { t: 'undock' });
  await L.sleep(4000);
  await L.closeAll(p);
  for (const s of sizes) {
    const [W, H] = s.split('x').map(Number);
    await p.setViewportSize({ width: W, height: H });
    await L.sleep(1200);
    await p.screenshot({ path: `assets/raw/audit/${tag}_${s}.png` });
    const r = await p.evaluate(() => [...document.querySelectorAll('#hud-captain, #hud-map, #hud-stack, #touch > *, #chat-toggle')].map((e) => { const r = e.getBoundingClientRect(); return r.width ? `${e.id || e.className} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}` : null; }).filter(Boolean));
    console.log(s, '\n ' + r.join('\n '));
  }
  if (p.errors.length) console.log('errors', p.errors);
} finally { await b.close(); }
