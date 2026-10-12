// docs/30 (playthrough C, levels 40–60 and the endgame): one captain in a browser that stays up, driven over HTTP so
// a tester can play step by step from the shell.
//
//   GPORT=58983 CPORT=58984 NAME="Playc Late" node tools/mobile/playC/drive.mjs
//   curl -s localhost:58984/say --data '/level 40'          an admin line (the server's toasts back)
//   curl -s localhost:58984/eval --data 'gravetide.state.self.level'   an expression in the page
//   curl -s localhost:58984/shot?name=x                      docs/img/playC/x.png
//   curl -s localhost:58984/size?w=480\&h=270                the viewport
//   curl -s localhost:58984/tap?sel=%23hud-board              a tap on an element (or ?x=&y=)
//   curl -s localhost:58984/errors                           the page's errors since the last call
import * as L from '../m0/lib.mjs';
import { createServer } from 'node:http';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const GPORT = Number(process.env.GPORT ?? 58983);
const CPORT = Number(process.env.CPORT ?? 58984);
const OUT = process.env.SHOTS ?? 'docs/img/playC';
mkdirSync(OUT, { recursive: true });
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);

const b = await L.browser();
let p = await L.page(b, [W, H], { lang: process.env.LANG2 ?? 'ru', touch: true });
const heard = [];
const hook = (pg) => pg.on('websocket', (ws) => ws.on('framereceived', (f) => {
  if (typeof f.payload !== 'string') return;
  if (f.payload.startsWith('{"t":"toast"')) { try { heard.push(JSON.parse(f.payload).msg); } catch {} }
}));
hook(p);
// The captain's token kept between runs (a restart of the driver comes back to the same captain, wherever she is).
const TOK = process.env.TOKFILE ?? 'data/playC-token.json';
if (existsSync(TOK)) {
  const t = JSON.parse(readFileSync(TOK, 'utf8'));
  await p.ctx.addInitScript((t) => { for (const [k, v] of Object.entries(t)) localStorage.setItem(k, v); }, t);
  await p.goto(`http://localhost:${GPORT}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) {
    await p.evaluate(() => { const b = document.getElementById('login-continue'); if (b && !b.classList.contains('hidden')) b.click(); });
    await L.sleep(1000);
  }
  console.log('back as', t['gravetide.captain'] ?? '?');
} else {
  await L.login(p, { port: GPORT, name: process.env.NAME ?? 'Playc Late', captain: process.env.CAPTAIN ?? 'corsair', know: true });
  const t = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('gravetide.')).map((k) => [k, localStorage.getItem(k)])));
  writeFileSync(TOK, JSON.stringify(t));
  console.log('logged in as', p.name);
}

const body = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });
createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const q = Object.fromEntries(u.searchParams);
  let out;
  try {
    switch (u.pathname) {
      case '/say': {
        // the answer is the toast(s) that came after the line (the client shows the server's toast)
        const line = (await body(req)) || q.t;
        out = await p.evaluate(async ([line, ms]) => {
          // the server's toasts off the socket (the client may hold them back while a window is open)
          const got = [], ws = globalThis.gravetide.net.ws;
          const f = (e) => { if (typeof e.data === 'string' && e.data.startsWith('{"t":"toast"')) try { got.push(JSON.parse(e.data).msg); } catch {} };
          ws.addEventListener('message', f);
          globalThis.gravetide.net.send({ t: 'chat', text: line });
          await new Promise((r) => setTimeout(r, ms));
          ws.removeEventListener('message', f);
          return got.join('\n');
        }, [line, Number(q.ms ?? 1200)]);
        break;
      }
      case '/eval': {
        const src = await body(req);
        // an expression, or statements with a `return` (run as an async function's body)
        out = await p.evaluate(async (s) => {
          const g = globalThis.gravetide, st = g?.state, S = st?.self;
          const v = /\breturn\b/.test(s) ? await new Function('g', 'st', 'S', `return (async () => { ${s} })()`)(g, st, S) : await (0, eval)(s);
          return typeof v === 'string' ? v : JSON.stringify(v, null, 1);
        }, src);
        break;
      }
      case '/shot': await p.screenshot({ path: `${OUT}/${q.name ?? 'shot'}.png` }); out = `${OUT}/${q.name ?? 'shot'}.png`; break;
      case '/size': await p.setViewportSize({ width: Number(q.w), height: Number(q.h) }); out = 'ok'; break;
      case '/tap':
        if (q.sel) out = await L.tapEl(p, q.sel);
        else { await p.touchscreen.tap(Number(q.x), Number(q.y)); out = 'ok'; }
        break;
      case '/click':
        if (q.sel) { await p.click(q.sel, { timeout: 3000 }); out = 'ok'; }
        else { await p.mouse.click(Number(q.x), Number(q.y)); out = 'ok'; }
        break;
      case '/key': await p.keyboard.press(q.k); out = 'ok'; break;
      case '/errors': out = p.errors.splice(0).join('\n') || 'none'; break;
      case '/heard': out = heard.slice(-Number(q.n ?? 20)).join('\n'); break;
      case '/reload': await p.reload({ waitUntil: 'domcontentloaded' }); await L.sleep(8000); out = 'ok'; break;
      case '/quit': res.end('bye'); await b.close(); process.exit(0);
      default: out = 'say eval shot size tap click key errors heard reload quit';
    }
  } catch (e) { out = 'ERR ' + (e?.message ?? e); }
  res.end(String(out ?? ''));
}).listen(CPORT, '127.0.0.1', () => console.log('control on', CPORT));
