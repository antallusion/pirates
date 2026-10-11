// Sends one snippet to the playthrough daemon (daemon.mjs) and prints what came back.
//   node tools/mobile/playA/run.mjs "return await L.me(p)"      or      node tools/mobile/playA/run.mjs -f snippet.js
import { readFileSync } from 'node:fs';
const CTL = Number(process.env.CTL ?? 58997);
const a = process.argv.slice(2);
const code = a[0] === '-f' ? readFileSync(a[1], 'utf8') : a.join(' ');
const r = await fetch(`http://127.0.0.1:${CTL}/`, { method: 'POST', body: code });
const j = await r.json();
console.log(j.ok ? (typeof j.v === 'string' ? j.v : JSON.stringify(j.v, null, 1)) : 'ERROR ' + j.err);
