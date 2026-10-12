// Sends one snippet to the playthrough daemon (daemon.mjs) and prints what came back (no time limit: a voyage runs long).
//   node tools/mobile/playA/run.mjs "return await L.me(p)"      or      node tools/mobile/playA/run.mjs -f snippet.js
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
const CTL = Number(process.env.CTL ?? 58997);
const a = process.argv.slice(2);
const code = a[0] === '-f' ? readFileSync(a[1], 'utf8') : a.join(' ');
const body = await new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port: CTL, method: 'POST', path: '/', timeout: 0 }, (res) => {
    let s = '';
    res.on('data', (c) => (s += c));
    res.on('end', () => resolve(s));
  });
  req.on('error', reject);
  req.end(code);
});
const j = JSON.parse(body);
console.log(j.ok ? (typeof j.v === 'string' ? j.v : JSON.stringify(j.v, null, 1)) : 'ERROR ' + j.err);
