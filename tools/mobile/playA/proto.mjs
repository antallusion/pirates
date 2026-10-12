// docs/30 (playthrough A, levels 9–20): one captain over the game's own socket, no browser — a headless player that
// stays up and is driven over HTTP from the shell, step by step or by the macros in proto-macros.mjs (reloaded on
// every call, so a macro can be fixed while she sails).
//
//   GPORT=58981 CPORT=58990 NAME="Anna Band" node tools/mobile/playA/proto.mjs
//   curl -s localhost:58990/s                         her summary (level, silver, hull, quests, where)
//   curl -s localhost:58990/say --data '/speed 30'    an admin line, the server's answer back
//   curl -s localhost:58990/send --data '{"t":"undock"}'
//   curl -s localhost:58990/log?n=30                  toasts and events heard
//   curl -s localhost:58990/run?m=questLoop\&n=3      a macro of proto-macros.mjs
import { PROTOCOL_VERSION } from '../../../shared/src/constants.ts';
import { decodeSnap } from '../../../shared/src/codec.ts';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const GPORT = Number(process.env.GPORT ?? 58981);
const CPORT = Number(process.env.CPORT ?? 58990);
const TOK = process.env.TOKFILE ?? 'data/playA-band2-token.json';
const LOG = process.env.LOGFILE ?? 'data/playA-band2-heard.log';
const NAME = process.env.NAME ?? 'Anna Band';

export const G = {
  self: null, port: null, snap: null, info: new Map(), log: [], seq: 0, ws: null, sent: [], views: {},
  boarding: null, tac: null, risk: null, autosail: null, pursuit: null, sunk: null, offer: null, done: [],
  send(m) {
    // the flood guard is 90 a second: keep well under it
    const now = Date.now();
    G.sent = G.sent.filter((t) => now - t < 1000);
    if (G.sent.length > 40) return false;
    G.sent.push(now);
    G.ws?.readyState === 1 && G.ws.send(JSON.stringify(m));
    return true;
  },
  note(kind, msg) {
    const line = { t: Date.now(), kind, msg };
    G.log.push(line);
    if (G.log.length > 2000) G.log.splice(0, 500);
    try { appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${kind} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`); } catch {}
  },
};
globalThis.G = G;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  const ws = new WebSocket(`ws://localhost:${GPORT}/ws`);
  ws.binaryType = 'arraybuffer';
  G.ws = ws;
  ws.onopen = () => {
    const tok = existsSync(TOK) ? JSON.parse(readFileSync(TOK, 'utf8')).token : undefined;
    ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, ...(tok ? { token: tok } : { name: NAME }) }));
  };
  ws.onclose = (e) => { G.note('net', `closed ${e.code} ${e.reason}`); setTimeout(connect, 3000); };
  ws.onmessage = (ev) => {
    let m;
    try { m = ev.data instanceof ArrayBuffer ? decodeSnap(ev.data) : JSON.parse(String(ev.data)); } catch { return; }
    onMsg(m);
  };
}

function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      writeFileSync(TOK, JSON.stringify({ token: m.token, name: m.name }));
      G.note('net', `welcome ${m.name} captain=${m.hasCaptain}`);
      if (!m.hasCaptain) G.send({ t: 'create_captain', captain: process.env.CAPTAIN ?? 'corsair', shipName: 'Штиль', tutorial: false });
      break;
    case 'init': G.self = m.self; G.ports = m.ports; G.sectors = m.sectors ?? G.sectors; G.entityId = m.entityId; break;
    case 'self': G.self = m.self; break;
    case 'self_patch': G.self = { ...(G.self ?? {}), ...m.patch }; break;
    case 'snap': G.snap = m; break;
    case 'info': for (const i of m.list) G.info.set(i.id, i); break;
    case 'port': G.port = m.view; break;
    case 'toast': G.note('toast', m.msg); break;
    case 'err': G.note('err', m.msg); break;
    case 'quest_done': G.note('quest_done', { silver: m.silver, xp: m.xp, name: m.name }); G.done.push(m); break;
    case 'boarding': G.boarding = m.result; if (m.result) G.note('boarding', { name: m.result.targetName, gold: m.result.gold, cargo: m.result.cargo, lost: m.result.crewLost, report: m.result.report }); break;
    case 'board_tac': G.tac = m.view; break;
    case 'board_fight': G.views.board_fight = m.view; break;
    case 'board_risk': G.risk = m.risk; G.note('risk', m.risk); break;
    case 'autosail': G.autosail = m; if (!m.on) G.note('autosail', m.why ?? 'off'); break;
    case 'pursuit': G.pursuit = m; if (!m.on) G.note('pursuit', m.why ?? 'off'); break;
    case 'sunk_self': G.sunk = m; G.note('SUNK', m); break;
    case 'surrender_offer': G.views.surrender = m.offer; if (m.offer) G.note('surrender', m.offer); break;
    case 'quest_offer': G.offer = m; G.note('quest_offer', m.offer?.name); break;
    case 'mutiny': G.note('MUTINY', m); break;
    case 'crew_say': break;
    case 'chat': break;
    case 'ev': break;
    case 'pong': break;
    default:
      G.views[m.t] = m;
  }
}

/** Her summary: what a player sees on the HUD at a glance. */
export function summary() {
  const s = G.self, y = G.snap?.you;
  if (!s) return { connected: false };
  return {
    lvl: s.level, xp: `${s.xp}/${s.xpNext}`, rested: s.rested, silver: s.gold, tp: s.talentPoints, docked: s.dockedAt, last: s.lastPort,
    hull: y ? `${Math.round(y.hull)}/${y.hullMax}` : s.hull, sails: y ? `${Math.round(y.sails)}/${y.sailsMax}` : s.sails, crew: y ? `${y.crew}/${y.crewMax}` : s.crew, morale: Math.round(s.morale),
    at: y ? [Math.round(y.x), Math.round(y.y)] : null, spd: y ? Math.round(y.spd * 10) / 10 : 0, region: G.snap?.region, combat: y?.combat,
    ship: s.loadout?.classId, shipLevel: s.loadout?.level ?? s.shipLevel, ammo: s.ammo, cargo: s.cargo,
    quests: (s.quests ?? []).map((q) => ({ id: q.id, name: q.name, step: `${q.step + 1}/${q.steps}`, text: q.text, prog: `${q.progress}/${q.need}`, ship: q.ship, target: q.target })),
    contracts: (s.contracts ?? []).map((c) => ({ id: c.id, kind: c.kind, desc: c.description, prog: c.progress, reward: c.reward, xp: c.xp })),
    autosail: G.autosail?.on ?? false, pursuit: G.pursuit?.on ? G.pursuit.target : null, boarding: !!G.boarding, tac: !!G.tac, hero: s.hero ? { pending: s.hero.pending, offer: s.hero.offer } : null,
    company: s.company ? { loyalty: s.company.loyalty, owed: s.company.owed, wages: s.company.wagesPerHour, army: s.company.army?.map((a) => `${a.unit ?? a.u}×${a.n}`).join(' ') } : null,
  };
}

/** The ships about her, nearest first, with what the server told of each. */
export function ships(r = 6000) {
  const y = G.snap?.you;
  if (!y) return [];
  return G.snap.ships.map(([id, x, yy, h, spd, sail, hull, sails, flags, crew]) => {
    const i = G.info.get(id) ?? {};
    return { id, d: Math.round(Math.hypot(x - y.x, yy - y.y)), x: Math.round(x), y: Math.round(yy), hull: Math.round(hull * 100), crew: Math.round(crew * 100), hostile: !!(flags & 64), sinking: !!(flags & 1), docked: !!(flags & 32), surrendered: !!(flags & 16), name: i.name, cls: i.classId, lvl: i.shipLevel, role: i.npcRole, fac: i.faction, player: i.isPlayer };
  }).filter((s) => s.id !== G.entityId && s.d <= r).sort((a, b) => a.d - b.d);
}

const body = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });
let logMark = 0;
createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const q = Object.fromEntries(u.searchParams);
  let out;
  try {
    switch (u.pathname) {
      case '/s': out = summary(); break;
      case '/self': out = q.k ? q.k.split('.').reduce((o, k) => o?.[k], G.self) : G.self; break;
      case '/port': out = q.k ? q.k.split('.').reduce((o, k) => o?.[k], G.port) : G.port; break;
      case '/view': out = G.views[q.k]; break;
      case '/ships': out = ships(Number(q.r ?? 6000)); break;
      case '/send': { const m = JSON.parse(await body(req)); const at = G.log.length; G.send(m); await sleep(Number(q.wait ?? 700)); out = G.log.slice(at).map((l) => `${l.kind}: ${typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}`); break; }
      case '/say': { const t = (await body(req)) || q.t; const at = G.log.length; G.send({ t: 'chat', text: t }); await sleep(Number(q.wait ?? 800)); out = G.log.slice(at).map((l) => `${l.kind}: ${typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}`); break; }
      case '/log': {
        const n = Number(q.n ?? 0);
        const from = n ? Math.max(0, G.log.length - n) : logMark;
        out = G.log.slice(from).map((l) => `${new Date(l.t).toISOString().slice(11, 19)} ${l.kind}: ${typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}`);
        logMark = G.log.length;
        break;
      }
      case '/run': {
        const mod = await import(new URL('./proto-macros.mjs', import.meta.url).href + '?' + Date.now());
        const fn = mod[q.m];
        if (!fn) { out = `no macro ${q.m}`; break; }
        const arg = { ...q };
        delete arg.m;
        if (q.bg) { G.running = q.m; G.stop = false; fn(G, arg, { summary, ships, sleep }).then((r) => { G.note('macro', `${q.m} done: ${JSON.stringify(r)?.slice(0, 400)}`); G.running = null; }, (e) => { G.note('macro', `${q.m} failed: ${e.stack?.slice(0, 600)}`); G.running = null; }); out = 'started'; }
        else out = await fn(G, arg, { summary, ships, sleep });
        break;
      }
      case '/stop': G.stop = true; out = `stopping ${G.running}`; break;
      case '/eval': out = await (0, eval)(`(async () => (${await body(req)}))()`); break;
      default: out = 'unknown';
    }
  } catch (e) { out = { error: String(e?.stack ?? e).slice(0, 800) }; }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out, null, 1));
}).listen(CPORT, () => console.log(`proto on :${CPORT}`));

writeFileSync(process.env.PIDFILE ?? 'data/playA-proto.pid', String(process.pid));
connect();
// The reflexes (proto-macros.mjs reflex): what a player answers at once — a boarding's turns, the spoils, a ship that
// strikes, a level's skill. Reloaded every 15 s.
let reflexMod = null, reflexAt = 0, reflexBusy = false;
setInterval(async () => {
  if (reflexBusy || !G.self || G.noReflex) return;
  reflexBusy = true;
  try {
    if (!reflexMod || Date.now() - reflexAt > 15000) { reflexMod = await import(new URL('./proto-macros.mjs', import.meta.url).href + '?' + Date.now()); reflexAt = Date.now(); }
    await reflexMod.reflex?.(G, { summary, ships, sleep });
  } catch (e) { G.note('reflex', String(e?.stack ?? e).slice(0, 300)); }
  reflexBusy = false;
}, 400);
// a ping now and then keeps the socket warm, as the client's does
setInterval(() => G.send({ t: 'ping', c: Date.now() }), 5000);
