// A live browser for interactive play: POST a snippet of async JS to http://127.0.0.1:58793/ and get its result.
// In the snippet: L (the kit from lib.mjs), P (named pages), B (the browser), and `return` a value.
//   curl -s --data-binary @snippet.js http://127.0.0.1:58793/
import http from 'node:http';
import * as L from './lib.mjs';
const B = await L.browser();
const P = {};
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  let out;
  try {
    const fn = new AsyncFunction('L', 'P', 'B', body);
    out = await fn(L, P, B);
  } catch (e) {
    out = { error: String(e?.stack ?? e).slice(0, 1500) };
  }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out ?? null, null, 1));
}).listen(Number(process.env.DPORT ?? 58793), '127.0.0.1', () => console.log('driver on ' + (process.env.DPORT ?? 58793)));
