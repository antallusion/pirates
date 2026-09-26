// Headless test client: registers, creates a captain, undocks and sails, firing at anything hostile.
// Usage: node tools/bot.ts [url] [seconds] [captain]
// Useful for load tests (run many) and for verifying the server loop without a browser.

import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap } from '../shared/src/codec.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';

const url = process.argv[2] ?? 'ws://localhost:8080/ws';
const seconds = Number(process.argv[3] ?? 20);
const captain = (process.argv[4] ?? 'corsair') as 'corsair';
const name = 'Bot ' + Math.random().toString(36).slice(2, 8);

const ws = new WebSocket(url);
const send = (m: ClientMsg) => ws.send(JSON.stringify(m));
const counts: Record<string, number> = {};
let entityId = 0;
let seq = 0;
let lastSnap: Extract<ServerMsg, { t: 'snap' }> | null = null;
const toasts: string[] = [];

ws.onopen = () => send({ t: 'hello', v: PROTOCOL_VERSION, name });
ws.binaryType = 'arraybuffer';
let bytesIn = 0;
ws.onmessage = (ev) => {
  bytesIn += ev.data instanceof ArrayBuffer ? ev.data.byteLength : String(ev.data).length;
  const m = (ev.data instanceof ArrayBuffer ? decodeSnap(ev.data) : JSON.parse(String(ev.data))) as ServerMsg;
  counts[m.t] = (counts[m.t] ?? 0) + 1;
  switch (m.t) {
    case 'welcome':
      if (!m.hasCaptain) send({ t: 'create_captain', captain, shipName: 'Test Wake' });
      break;
    case 'init':
      entityId = m.entityId;
      if (m.self.dockedAt) {
        send({ t: 'trade', good: 'rum', qty: 2 });
        send({ t: 'undock' });
      }
      break;
    case 'snap':
      lastSnap = m;
      break;
    case 'toast':
      toasts.push(m.msg);
      break;
    case 'err':
      console.log('ERR', m.msg);
      break;
  }
};

const iv = setInterval(() => {
  if (!lastSnap?.you) return;
  send({ t: 'input', seq: ++seq, rudder: Math.sin(seq / 30), sail: 4 });
  if (seq % 40 === 0) send({ t: 'fire', side: seq % 80 === 0 ? 'port' : 'starboard', dist: 250 });
}, 100);

setTimeout(() => {
  clearInterval(iv);
  const y = lastSnap?.you;
  console.log(JSON.stringify({
    name, entityId, messages: counts, kbPerSec: Math.round(bytesIn / seconds / 10.24) / 100,
    position: y ? { x: Math.round(y.x), y: Math.round(y.y), speed: Math.round(y.spd * 10) / 10, hull: y.hull, crew: y.crew } : null,
    nearbyShips: lastSnap?.ships.length ?? 0, region: lastSnap?.region, weather: lastSnap?.weather, toasts: toasts.slice(-6),
  }, null, 2));
  ws.close();
  process.exit(0);
}, seconds * 1000);
