// Load test: a swarm of headless captains in one process, each speaking the real protocol over a real
// WebSocket — sign in, make a captain, sail out, steer, fire now and then, ping, the odd word in chat.
// Samples the server's /health (tick times, snapshot cost, bandwidth) while it runs, then reports and checks
// the budgets (see `checks` at the end).
//
//   node tools/loadtest.ts --bots 500 --seconds 90 --ramp 50 --url ws://localhost:8080/ws --http http://localhost:8080
// Two scenarios:
//   harbour (default): every bot is a new captain at the starting quay — the worst crowd there is;
//   zone (--tokens file from tools/seed-bots.ts): an established population already spread over one region.

import { readFileSync } from 'node:fs';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap } from '../shared/src/codec.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? '1' : process.argv[++i]);
}
const BOTS = Number(args.get('bots') ?? 500);
const SECONDS = Number(args.get('seconds') ?? 90);
const RAMP = Number(args.get('ramp') ?? 50); // new bots per second
const URL_WS = args.get('url') ?? 'ws://localhost:8080/ws';
const URL_HTTP = args.get('http') ?? URL_WS.replace(/^ws/, 'http').replace(/\/ws$/, '');
const CAPTAINS = ['corsair', 'reaver', 'smuggler', 'navigator'] as const;
const TOKENS: string[] | null = args.has('tokens') ? JSON.parse(readFileSync(args.get('tokens')!, 'utf8')) : null;
if (TOKENS && TOKENS.length < BOTS) throw new Error(`only ${TOKENS.length} tokens for ${BOTS} bots`);
const tag = Math.random().toString(36).slice(2, 5);

interface Bot {
  i: number;
  ws: WebSocket;
  open: boolean;
  inGame: boolean;
  bytes: number;
  snaps: number;
  rtts: number[];
  closed: boolean;
  errors: number;
  seq: number;
  rudder: number;
}

const bots: Bot[] = [];
const health: Record<string, number>[] = [];
let failed = 0;
const errs = new Map<string, number>();

function spawn(i: number): void {
  const ws = new WebSocket(URL_WS);
  ws.binaryType = 'arraybuffer';
  const b: Bot = { i, ws, open: false, inGame: false, bytes: 0, snaps: 0, rtts: [], closed: false, errors: 0, seq: 0, rudder: 0 };
  bots.push(b);
  const send = (m: ClientMsg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
  ws.onopen = () => {
    b.open = true;
    send(TOKENS ? { t: 'hello', v: PROTOCOL_VERSION, token: TOKENS[i] } : { t: 'hello', v: PROTOCOL_VERSION, name: `Load ${tag} ${i}` });
  };
  ws.onerror = () => {
    if (!b.open) failed++;
  };
  ws.onclose = () => (b.closed = true);
  ws.onmessage = (ev) => {
    const bin = ev.data instanceof ArrayBuffer;
    b.bytes += bin ? (ev.data as ArrayBuffer).byteLength : String(ev.data).length;
    if (bin) {
      b.snaps++;
      decodeSnap(ev.data as ArrayBuffer); // the client's own cost: every bot decodes like a browser would
      return;
    }
    const m = JSON.parse(String(ev.data)) as ServerMsg;
    switch (m.t) {
      case 'welcome':
        if (!m.hasCaptain) send({ t: 'create_captain', captain: CAPTAINS[i % CAPTAINS.length], shipName: `Wake ${i}` });
        break;
      case 'init':
        b.inGame = true;
        if (m.self.dockedAt) send({ t: 'undock' });
        break;
      case 'pong':
        b.rtts.push(performance.now() - m.c);
        break;
      case 'err':
        b.errors++;
        errs.set(m.msg, (errs.get(m.msg) ?? 0) + 1);
        break;
    }
  };
  // A captain's hands on the wheel: inputs at 10 Hz, a broadside every ~6 s, a ping every 2 s, rare chat.
  const iv = setInterval(() => {
    if (b.closed) return clearInterval(iv);
    if (!b.inGame) return;
    b.seq++;
    b.rudder = Math.max(-1, Math.min(1, b.rudder + (Math.random() - 0.5) * 0.3));
    send({ t: 'input', seq: b.seq, rudder: Math.round(b.rudder * 100) / 100, sail: b.seq % 600 < 500 ? 4 : 2 });
    if (b.seq % 60 === i % 60) send({ t: 'fire', side: Math.random() < 0.5 ? 'port' : 'starboard', dist: 200 + Math.random() * 200 });
    if (b.seq % 20 === i % 20) send({ t: 'ping', c: performance.now() });
    if (b.seq % 3000 === (i * 7) % 3000) send({ t: 'chat', text: 'Fair winds' });
  }, 100);
}

async function sampleHealth(): Promise<void> {
  try {
    const h = (await (await fetch(`${URL_HTTP}/health`)).json()) as Record<string, number>;
    health.push(h);
  } catch {
    /* the server may be too busy to answer: that shows in the report */
  }
}

const pctl = (a: number[], p: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]);
};

const t0 = performance.now();
let spawned = 0;
const ramp = setInterval(() => {
  for (let k = 0; k < RAMP && spawned < BOTS; k++) spawn(spawned++);
  if (spawned >= BOTS) clearInterval(ramp);
}, 1000);
const hs = setInterval(() => void sampleHealth(), 5000);
let progress = 0;
const prog = setInterval(() => {
  const h = health[health.length - 1];
  const inGame = bots.filter((b) => b.inGame && !b.closed).length;
  console.error(`[${Math.round((performance.now() - t0) / 1000)} s] bots ${inGame}/${spawned}${h ? ` · tick avg ${h.tickAvgMs} ms p99 ${h.tickP99Ms} ms · out ${h.kbOutPerSec} KB/s` : ''}`);
  progress++;
}, 10_000);

await new Promise((r) => setTimeout(r, SECONDS * 1000));
clearInterval(ramp);
clearInterval(hs);
clearInterval(prog);
await sampleHealth();
void progress;

// Only the steady state counts: samples after the ramp finished.
const rampEnd = Math.ceil(BOTS / RAMP) + 10;
const steady = health.filter((_, k) => (k + 1) * 5 > rampEnd);
const inGame = bots.filter((b) => b.inGame && !b.closed);
const rtts = inGame.flatMap((b) => b.rtts.slice(-10));
const secs = SECONDS - Math.ceil(BOTS / RAMP) / 2;
const kbps = inGame.map((b) => b.bytes / 1024 / Math.max(1, secs));
const worst = (k: string) => Math.max(0, ...steady.map((h) => Number(h[k] ?? 0)));
const mean = (k: string) => Math.round((steady.reduce((a, h) => a + Number(h[k] ?? 0), 0) / Math.max(1, steady.length)) * 100) / 100;
const report = {
  scenario: TOKENS ? 'zone' : 'harbour',
  bots: BOTS,
  connected: bots.filter((b) => b.open).length,
  inGame: inGame.length,
  failedToConnect: failed,
  closedEarly: bots.filter((b) => b.closed).length,
  serverErrors: Object.fromEntries(errs),
  server: {
    samples: steady.length,
    players: worst('players'),
    ships: worst('ships'),
    tickAvgMs: mean('tickAvgMs'),
    tickP99Ms: worst('tickP99Ms'),
    tickMaxMs: worst('tickMaxMs'),
    snapAvgMs: mean('snapAvgMs'),
    secondPassMaxMs: worst('secondPassMaxMs'),
    overruns: worst('overruns') - Number(steady[0]?.overruns ?? 0),
    kbOutPerSec: mean('kbOutPerSec'),
  },
  client: {
    kbPerSecPerBot: { avg: Math.round((kbps.reduce((a, b) => a + b, 0) / Math.max(1, kbps.length)) * 100) / 100, p95: pctl(kbps, 0.95) },
    snapsPerSecPerBot: Math.round((inGame.reduce((a, b) => a + b.snaps, 0) / Math.max(1, inGame.length) / Math.max(1, secs)) * 10) / 10,
    rttMs: { p50: pctl(rtts, 0.5), p95: pctl(rtts, 0.95), max: pctl(rtts, 1) },
  },
};
// A zone must hold its budget; the harbour (hundreds of ships within 700 m of each other) must degrade gracefully:
// crowded captains drop to 5 Hz, nobody is thrown out, orders still land within half a second.
const checks = TOKENS
  ? {
      'tick p99 < 50 ms': report.server.tickP99Ms < 50,
      'no dropped ticks': report.server.overruns === 0,
      'round trip p95 < 250 ms': report.client.rttMs.p95 < 250,
      '≥ 99% of bots in the game': report.inGame >= BOTS * 0.99,
    }
  : {
      'tick average < 100 ms': report.server.tickAvgMs < 100,
      'round trip p95 < 500 ms': report.client.rttMs.p95 < 500,
      'nobody thrown out': report.closedEarly === 0,
      '≥ 99% of bots in the game': report.inGame >= BOTS * 0.99,
    };
console.log(JSON.stringify({ ...report, checks }, null, 2));
for (const b of bots) b.ws.close();
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
