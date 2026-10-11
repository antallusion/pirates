// Where the chat's button stands among the controls (docs/28): the desk at sea, the boarding battle on a phone.
//   PORT=58999 node tools/mobile/chat/places.mjs
import * as L from '../m0/lib.mjs';
const PORT = Number(process.env.PORT ?? 58999);
const sleep = L.sleep;
const boxes = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).visibility !== 'hidden' ? `${e.id || e.className.toString().slice(0, 30)} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}` : null; }).filter(Boolean), sel);
const b = await L.browser();
try {
  const D = process.env.SKIPDESK ? null : await L.page(b, [1500, 600], { lang: 'ru', touch: false });
  if (D) {
  await L.login(D, { port: PORT, know: true, name: 'Стол' + Math.random().toString(36).slice(2, 5) });
  await L.closeAll(D);
  await L.send(D, { t: 'undock' });
  await sleep(4000);
  await L.closeAll(D);
  await D.screenshot({ path: 'assets/raw/audit/chat_desk_sea.png' });
  console.log('desk sea', await boxes(D, '#chat-toggle, #touch > *, #hud-captain, #hud-map'));
  await D.evaluate(() => globalThis.gravetide.hud.chatPanel.open(false));
  await sleep(600);
  await D.screenshot({ path: 'assets/raw/audit/chat_desk_sea_open.png' });
  console.log('desk open', await boxes(D, '#chat, #chat-toggle, #touch > *'));
  await D.ctx.close();
  }
  const P = await L.page(b, [812, 375], { lang: 'ru' });
  await L.login(P, { port: PORT, know: true, name: 'Бой' + Math.random().toString(36).slice(2, 5) });
  await L.closeAll(P);
  await P.goto(`http://localhost:${PORT}/?battle`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 60 && !(await P.evaluate(() => !!document.querySelector('#hud:not(.hidden)')).catch(() => false)); i++) { await P.mouse.click(10, 10).catch(() => {}); await sleep(1000); }
  for (let i = 0; i < 120 && !(await P.evaluate(() => document.body.classList.contains('tac'))); i++) await sleep(1000);
  console.log('toasts', await L.toasts(P));
  await sleep(3000);
  await L.closeAll(P);
  await sleep(2000);
  console.log('tac?', await P.evaluate(() => [document.body.classList.contains('tac'), document.body.classList.contains('tac-ph'), !!globalThis.gravetide.state.boardTac]));
  await P.screenshot({ path: 'assets/raw/audit/chat_tac.png' });
  console.log('tac boxes', await boxes(P, '#chat-toggle, body.tac button'));
  await P.evaluate(() => globalThis.gravetide.hud.chatPanel.open(false));
  await sleep(600);
  await P.screenshot({ path: 'assets/raw/audit/chat_tac_open.png' });
} finally { await b.close(); }
