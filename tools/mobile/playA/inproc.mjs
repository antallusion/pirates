// docs/30 (playthrough A, levels 9–20): the world in this process, one captain driven through the client's own
// messages — no sockets, no snapshots decoded, no browser. The world steps only while she has something to do (a fight,
// a short run in, a boarding); a passage is a jump to the far end (its route logged, its days of provisions and
// wages paid), and a wait is the clock moved on. Driven over HTTP from the shell, step by step or by the macros of
// inproc-macros.mjs (reloaded on every call).
//
//   start /BELOWNORMAL node --disable-warning=ExperimentalWarning tools/mobile/playA/inproc.mjs
//   curl -s localhost:58995/s                      her summary
//   curl -s localhost:58995/say --data '/level 9'  an admin line (the setup only)
//   curl -s localhost:58995/send --data '{"t":"undock"}'
//   curl -s localhost:58995/run?m=questRound       a macro
//   curl -s localhost:58995/log?n=40               what she heard
import { createServer } from 'node:http';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PROTOCOL_VERSION, xpForLevel } from '../../../shared/src/constants.ts';
import { AuthService } from '../../../server/src/auth.ts';
import { Game } from '../../../server/src/game/Game.ts';
import { Database } from '../../../server/src/persistence/db.ts';
import { runAdmin } from '../../../server/src/game/admin.ts';

const CPORT = Number(process.env.CPORT ?? 58995);
const DBP = process.env.DB ?? 'data/inproc-band2.db';
const TOK = process.env.TOKFILE ?? 'data/inproc-band2-token.json';
const LOG = process.env.LOGFILE ?? 'data/inproc-band2-heard.log';
const BOOK = process.env.BOOK ?? 'data/inproc-band2-book.jsonl';
const NAME = process.env.NAME ?? 'Anna Shtil';
// (band C: its own macros on top of these — MACROS=../playC/macros.mjs)
const MACROS = new URL(process.env.MACROS ?? './inproc-macros.mjs', import.meta.url).href;
process.env.GRAVETIDE_ADMIN = '1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new Database(DBP);
const auth = new AuthService(db);
const game = new Game({ db, auth, log: (m) => appendFileSync(LOG, `[game] ${m}\n`) });
game.bootPopulation();

/** Everything she hears, and the book of the run: silver and experience by source, per level. */
export const B = {
  game, db, log: [], views: {}, port: null, self: null, tac: null, boarding: null, risk: null, sunk: null, autosail: null, pursuit: null, done: [],
  book: { level: 0, xp: {}, silver: {}, worldSec: 0, realMs: 0, deaths: 0, fights: 0, travelKm: 0, tpLegs: 0 },
  note(kind, msg) {
    const line = { t: game.now, kind, msg };
    B.log.push(line);
    if (B.log.length > 3000) B.log.splice(0, 1000);
    try { appendFileSync(LOG, `${fmtT(game.now)} ${kind} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`); } catch {}
  },
};
globalThis.B = B;
const fmtT = (t) => { const s = Math.floor(t); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

// ---------------------------------------------------------------- the client end of the wire
const conn = {
  closed: false, remote: 'inproc', bytesOut: 0, buffered: 0,
  onMessage: () => {}, onClose: () => {},
  send(text) { onMsg(JSON.parse(text)); },
  sendBinary(bytes) { this.bytesOut += bytes.byteLength; },
  close() { this.closed = true; this.onClose(); },
};
const s = game.attach(conn);
B.s = s;
B.send = (m) => conn.onMessage(JSON.stringify(m));

function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      writeFileSync(TOK, JSON.stringify({ token: m.token, name: m.name }));
      if (!m.hasCaptain) setImmediate(() => B.send({ t: 'create_captain', captain: process.env.CAPTAIN ?? 'corsair', shipName: 'Штиль', tutorial: false }));
      break;
    case 'init': B.self = m.self; break;
    case 'self': B.self = m.self; break;
    case 'self_patch': B.self = { ...(B.self ?? {}), ...m.patch }; break;
    case 'port': B.port = m.view; break;
    case 'toast': B.note('toast', m.msg); break;
    case 'err': B.note('err', m.msg); break;
    case 'quest_done': B.note('QUEST', { name: m.name, silver: m.silver, xp: m.xp }); B.done.push(m); break;
    case 'boarding': B.boarding = m.result; if (m.result) B.note('boarding', { name: m.result.targetName, gold: m.result.gold, cargo: m.result.cargo, lost: m.result.crewLost }); break;
    case 'board_tac': B.tac = m.view; break;
    case 'board_risk': B.risk = m.risk; break;
    case 'autosail': B.autosail = m; if (!m.on) B.note('autosail', m.why ?? 'off'); break;
    case 'pursuit': B.pursuit = m; if (!m.on) B.note('pursuit', m.why ?? 'off'); break;
    case 'sunk_self': B.sunk = m; B.book.deaths++; B.note('SUNK', m); break;
    case 'surrender_offer': B.views.surrender = m.offer; break;
    case 'quest_offer': B.views.quest_offer = m; B.note('quest_offer', m.offer?.name); break;
    case 'mutiny': B.note('MUTINY', m); break;
    case 'crew_say': case 'chat': case 'ev': case 'pong': case 'snap': case 'chunk': case 'info': break;
    default: B.views[m.t] = m;
  }
}

// ---------------------------------------------------------------- the book: experience and silver by source
const totalXp = (p) => { let t = p.xp; for (let l = 1; l < p.level; l++) t += xpForLevel(l); return t; };
const grant = game.grantXp.bind(game);
game.grantXp = (ss, amount, reason, battle) => {
  if (ss !== s || !ss.profile) return grant(ss, amount, reason, battle);
  const before = totalXp(ss.profile), lv = ss.profile.level;
  grant(ss, amount, reason, battle);
  const got = totalXp(ss.profile) - before;
  // (a quest's and a contract's experience come without a reason: the caller tells which)
  const guess = reason ?? (/at (\w+)/.exec((new Error().stack ?? '').split('\n')[2] ?? '')?.[1] ?? 'other');
  const key = String(guess).replace(/\d+/g, '#').replace(/ to .*| — .*| of .*/, '').slice(0, 40);
  B.book.xp[key] = (B.book.xp[key] ?? 0) + got;
  if (ss.profile.level !== lv) levelUp(lv, ss.profile.level);
};
const ledger = db.ledger.bind(db);
let ledgered = 0;
db.ledger = (acc, kind, amount, detail) => {
  if (acc === s.accountId && kind !== 'doubloons') { B.book.silver[kind] = (B.book.silver[kind] ?? 0) + Math.round(amount); ledgered += Math.round(amount); }
  return ledger(acc, kind, amount, detail);
};
let goldSeen = null;
/** Silver moved without a ledger row: put down under the last thing she heard of. */
function goldCheck() {
  const p = s.profile;
  if (!p) return;
  if (goldSeen === null) { goldSeen = p.gold; ledgered = 0; return; }
  const d = p.gold - goldSeen - ledgered;
  if (Math.abs(d) >= 1) {
    const last = [...B.log].reverse().find((l) => l.kind === 'toast' || l.kind === 'QUEST' || l.kind === 'bot');
    const why = 'other: ' + String(typeof last?.msg === 'string' ? last.msg : last?.kind ?? '').replace(/\d+/g, '#').slice(0, 36);
    B.book.silver[why] = (B.book.silver[why] ?? 0) + Math.round(d);
  }
  goldSeen = p.gold;
  ledgered = 0;
}
B.goldCheck = goldCheck;
let bookStart = { now: game.now, real: Date.now() };
const CUR = BOOK.replace(/\.jsonl$/, '-cur.json');
// the level's book so far, kept across a restart
if (existsSync(CUR)) { const c = JSON.parse(readFileSync(CUR, 'utf8')); B.book = c.book; bookStart = { now: game.now - c.worldSec, real: Date.now() - c.realMs }; }
function saveBook() { writeFileSync(CUR, JSON.stringify({ book: B.book, worldSec: game.now - bookStart.now, realMs: Date.now() - bookStart.real })); }
B.saveBook = saveBook;
function levelUp(from, to) {
  goldCheck();
  B.book.worldSec = Math.round(game.now - bookStart.now);
  B.book.realMs = Date.now() - bookStart.real;
  const row = { level: from, to, at: fmtT(game.now), silverNow: s.profile.gold, ...B.book };
  appendFileSync(BOOK, JSON.stringify(row) + '\n');
  B.note('LEVEL', `${from} → ${to}: ${Math.round(row.worldSec / 60)} min of play, ${Math.round(row.realMs / 1000)} s real`);
  B.book = { level: to, xp: {}, silver: {}, worldSec: 0, realMs: 0, deaths: 0, fights: 0, travelKm: 0, tpLegs: 0 };
  bookStart = { now: game.now, real: Date.now() };
  saveBook();
}

// ---------------------------------------------------------------- the clock
let reflexMod = null, reflexAt = 0;
async function reflexes() {
  if (!reflexMod || Date.now() - reflexAt > 10000) { reflexMod = await import(MACROS + '?' + Date.now()); reflexAt = Date.now(); }
  return reflexMod;
}
/** The world on for `sec` seconds of its own time; her reflexes every half second; `until` ends it early. */
B.run = async (sec, until) => {
  const mod = await reflexes();
  const n = Math.round(sec * 20);
  for (let i = 0; i < n; i++) {
    game.step();
    if (i % 10 === 0) {
      mod.reflex?.(B);
      goldCheck();
      if (until && until()) return true;
    }
    if (i % 400 === 399) await sleep(0); // the HTTP side still answers
  }
  if (game.now >= (B.nextSave ?? 0)) { saveBook(); game.saveAll(); B.nextSave = game.now + 300; }
  return false;
};
/** The clock moved on by `sec` without the world stepping (a wait in port: a build, the yard). */
B.skip = (sec) => {
  game.now += sec;
  game.wallSkew += sec * 1000;
};
B.admin = (line) => runAdmin(game, s, line);
B.fmtT = fmtT;

// ---------------------------------------------------------------- her login
B.send({ t: 'hello', v: PROTOCOL_VERSION, ...(existsSync(TOK) ? { token: JSON.parse(readFileSync(TOK, 'utf8')).token } : { name: NAME }) });
if (!s.profile) B.send({ t: 'hello', v: PROTOCOL_VERSION, name: NAME });
B.book.level = s.profile?.level ?? 0;

// ---------------------------------------------------------------- the shell's end
const body = (req) => new Promise((r) => { let t = ''; req.on('data', (c) => (t += c)); req.on('end', () => r(t)); });
let logMark = 0, busy = null;
createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const q = Object.fromEntries(u.searchParams);
  let out;
  try {
    const mod = await reflexes();
    switch (u.pathname) {
      case '/s': out = mod.summary(B); break;
      case '/self': out = q.k ? q.k.split('.').reduce((o, k) => o?.[k], B.self) : B.self; break;
      case '/port': out = q.k ? q.k.split('.').reduce((o, k) => o?.[k], B.port) : B.port; break;
      case '/send': { const at = B.log.length; B.send(JSON.parse(await body(req))); await B.run(Number(q.sec ?? 0.5)); out = B.log.slice(at).map((l) => `${l.kind}: ${typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}`); break; }
      case '/say': { const t = (await body(req)) || q.t; out = B.admin(t); await B.run(0.2); break; }
      case '/step': { const at = B.log.length; await B.run(Number(q.sec ?? 10)); out = B.log.slice(at).map((l) => `${fmtT(l.t)} ${l.kind}: ${typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}`); break; }
      case '/log': {
        const n = Number(q.n ?? 0);
        const from = n ? Math.max(0, B.log.length - n) : logMark;
        out = B.log.slice(from).filter((l) => !q.grep || new RegExp(q.grep, 'i').test(JSON.stringify(l.msg))).map((l) => `${fmtT(l.t)} ${l.kind}: ${typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg)}`);
        logMark = B.log.length;
        break;
      }
      case '/book': out = B.book; break;
      case '/run': {
        const m = await import(MACROS + '?' + Date.now());
        reflexMod = m;
        const fn = m[q.m];
        if (!fn) { out = `no macro ${q.m}`; break; }
        if (busy) { out = `busy with ${busy}`; break; }
        const arg = { ...q };
        delete arg.m;
        busy = q.m;
        B.stop = false;
        const p = Promise.resolve().then(() => fn(B, arg)).then((r) => { B.note('macro', `${q.m}: ${JSON.stringify(r)?.slice(0, 600)}`); return r; }, (e) => { B.note('macro', `${q.m} failed: ${e.stack?.slice(0, 800)}`); return { error: String(e.stack ?? e).slice(0, 800) }; }).finally(() => { busy = null; });
        out = q.bg ? 'started' : await p;
        break;
      }
      case '/stop': B.stop = true; out = `stopping ${busy}`; break;
      case '/eval': out = await (0, eval)(`(async () => (${await body(req)}))()`); break;
      case '/save': game.saveAll(); out = 'saved'; break;
      case '/quit': saveBook(); game.saveAll(); out = 'bye'; setTimeout(() => process.exit(0), 200); break;
      default: out = 'unknown';
    }
  } catch (e) { out = { error: String(e?.stack ?? e).slice(0, 1000) }; }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out, null, 1));
}).listen(CPORT, () => console.log(`inproc on :${CPORT}, pid ${process.pid}`));
writeFileSync(process.env.PIDFILE ?? 'data/inproc-band2.pid', String(process.pid));
