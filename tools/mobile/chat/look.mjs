// A quick look at the HUD with the chat open and closed at a size (docs/28): node tools/mobile/chat/look.mjs 812x375 out-prefix
import * as L from '../m0/lib.mjs';
const PORT = Number(process.env.PORT ?? 58999);
const [w, h] = (process.argv[2] ?? '812x375').split('x').map(Number);
const tag = process.argv[3] ?? 'look';
const b = await L.browser();
try {
  const p = await L.page(b, [w, h], { lang: 'ru' });
  await L.login(p, { port: PORT, know: true, name: 'Взгляд' + Math.random().toString(36).slice(2, 5) });
  await L.closeAll(p);
  await L.sleep(1500);
  await p.screenshot({ path: `assets/raw/audit/${tag}_closed.png` });
  await p.evaluate(() => globalThis.gravetide.hud.chatPanel.open(false));
  await L.sleep(800);
  await p.screenshot({ path: `assets/raw/audit/${tag}_open.png` });
  const r = await p.evaluate(() => [...document.querySelectorAll('#chat, #chat-toggle, #tc-stick, #hud-map, #touch > *')].map((e) => { const r = e.getBoundingClientRect(); return `${e.id || e.className} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`; }));
  console.log(r.join('\n'));
  if (p.errors.length) console.log('errors', p.errors);
} finally { await b.close(); }
