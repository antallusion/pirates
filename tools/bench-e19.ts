// docs/19 E19: the server's tick in the endgame — forty captains of the cap (⚓60, a man-o'-war, the army of ⚓10) in the
// endgame waters (the Drowned Crown and the Abyss) with the doubled sea of tools/bench-19d.ts about them (the world's
// ships booted, the director, the sea's life and traffic, the adventure map), and the endgame's systems live:
//   - a citadel's siege (the siege field, its catapult and towers), on auto;
//   - a raid of the Abyss boarding its tier's legend, on auto;
//   - a seal's mythic depth at its lair, on auto;
//   - an Admiralty contract's legend boarded, on auto;
//   - two practice bouts of the Colosseum (the draft made by the bench, then the bout on auto);
//   - a Choir invasion in the waters with them, its waves hunting the captains.
// The same forty in the same waters with all of it off is the scene to compare against. The two scenes run in turn in
// blocks (each its own game, warmed), so a machine busy with other work weighs on both alike. Each block's ticks are
// timed (game.step alone, the messages a captain would send handled between ticks as the socket would); every byte
// the server sends the captains is counted (the snapshots' binary and the JSON, before any compression).
//   node tools/bench-e19.ts [blocks] [ticks a block] [captains]

import { armyForLevel } from '../shared/src/data/army.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { ClientMsg } from '../shared/src/protocol.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { arenaView } from '../server/src/game/arena.ts';
import { admView } from '../server/src/game/admiralty.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { makeGame } from '../tests/helpers.ts';

const BLOCKS = Math.max(1, Number(process.argv[2] ?? 3));
const TICKS = Math.max(100, Number(process.argv[3] ?? 600));
const N = Math.max(8, Number(process.argv[4] ?? 40));

/** A captain's socket that only counts what it is sent (no parsing: the real socket only writes). */
class CountConn {
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  remote = 'bench';
  buffered = 0;
  bytes = 0;
  /** The last word the server toasted her (why a battle did not begin). */
  said = '';
  /** On a battle's screen (a boarding, a fight ashore): the server's last word of it. */
  tac = false;
  send(text: string): void {
    this.bytes += Buffer.byteLength(text);
    if (text.startsWith('{"t":"toast"')) this.said = (JSON.parse(text) as { msg: string }).msg;
    else if (text.startsWith('{"t":"board_tac"')) this.tac = !text.startsWith('{"t":"board_tac","view":null');
  }
  sendBinary(b: Uint8Array): void { this.bytes += b.byteLength; }
  close(): void { this.closed = true; this.onClose(); }
  push(m: ClientMsg): void { this.onMessage(JSON.stringify(m)); }
}

interface Scene { game: Game; caps: { s: PlayerSession; conn: CountConn; role: string }[]; live: boolean }

const WATERS = ['drowned_crown', 'the_abyss'];
const ROLES = ['siege', 'raid', 'seal', 'legend', 'arena', 'arena', 'invasion'];

function build(live: boolean): Scene {
  const { game } = makeGame();
  quietAdv(game, false);
  game.bootPopulation();
  game.directorOn = true;
  game.zoneBosses.on = true;
  game.invasions.on = live;
  const caps: Scene['caps'] = [];
  for (let i = 0; i < N; i++) {
    const conn = new CountConn();
    game.attach(conn as unknown as WsConnection);
    const name = `Endgame ${i}`;
    conn.push({ t: 'hello', v: PROTOCOL_VERSION, name });
    conn.push({ t: 'create_captain', captain: (['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral'] as const)[i % 6], shipName: `Wake ${i}` });
    const s = game.sessionByName(name)!;
    if (s.profile?.tutorial) s.profile.tutorial.on = false;
    runAdmin(game, s, '/level 60');
    runAdmin(game, s, '/ship man_o_war');
    s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
    runAdmin(game, s, '/give provisions 400');
    runAdmin(game, s, `/tp ${WATERS[i % WATERS.length]}`);
    s.ship!.state.x += ((i >> 1) % 5) * 2200;
    s.ship!.state.y += Math.floor(i / 10) * 1800;
    s.ship!.input = { rudder: 0.04, sailTarget: 0.7 };
    conns.set(s, conn);
    roleOf.set(s, live && i < ROLES.length ? ROLES[i] : 'sail');
    caps.push({ s, conn, role: live && i < ROLES.length ? ROLES[i] : 'sail' });
  }
  return { game, caps, live };
}

const conns = new Map<PlayerSession, CountConn>();
/** In a battle: a boarding at sea, or (a seal's depth) a fight ashore whose screen the server keeps open. */
const busy = (s: PlayerSession): boolean => !!(s.ship?.boarding || (roleOf.get(s) === 'seal' && conns.get(s)?.tac));
const roleOf = new Map<PlayerSession, string>();
const adrift = (s: PlayerSession): void => {
  s.ship!.input = { rudder: 0, sailTarget: 0 };
  s.ship!.state.speed = 0;
  s.ship!.state.sail = 0;
};
const auto = (c: Scene['caps'][number]): void => c.conn.push({ t: 'tac', act: { a: 'auto', on: true } });

/** Each endgame role at its work again if its last battle is over (between blocks, as a captain would). */
function engage(sc: Scene): string[] {
  const { game } = sc;
  const said: string[] = [];
  for (const c of sc.caps) {
    const { s } = c;
    if (!s.ship?.alive) { runAdmin(game, s, '/heal'); continue; }
    if (c.role === 'sail' || busy(s)) { if (busy(s)) auto(c); continue; }
    runAdmin(game, s, '/heal');
    runAdmin(game, s, '/morale 100');
    if (s.profile!.company.mutiny) c.conn.push({ t: 'mutiny', choice: 'pay' });
    switch (c.role) {
      case 'siege':
        runAdmin(game, s, '/cit guild');
        runAdmin(game, s, '/cit free 1');
        said.push(`siege: ${runAdmin(game, s, '/cit siege 1')}`);
        break;
      case 'raid':
        runAdmin(game, s, '/maw reset');
        runAdmin(game, s, '/maw tier 3');
        runAdmin(game, s, '/maw go');
        adrift(s);
        c.conn.push({ t: 'throne', action: 'raid' });
        break;
      case 'seal':
        runAdmin(game, s, '/lair info'); // (the last depth's screen closed)
        runAdmin(game, s, '/seal lv 4');
        runAdmin(game, s, '/seal go');
        adrift(s);
        c.conn.push({ t: 'throne', action: 'seal' });
        break;
      case 'legend': {
        const v = admView(game, s);
        const k = v?.rows.findIndex((r) => r.kind === 'legend') ?? -1;
        if (k < 0) { said.push('legend: none this week'); break; }
        if (s.profile!.quests.done.includes(v!.rows[k].id)) runAdmin(game, s, '/contract reset');
        runAdmin(game, s, `/contract take ${k + 1}`);
        runAdmin(game, s, `/contract go ${k + 1}`);
        adrift(s);
        c.conn.push({ t: 'throne', action: 'contract', op: 'board', id: v!.rows[k].id });
        break;
      }
      case 'arena':
        said.push(`arena: ${runAdmin(game, s, '/arena bot')}`);
        break;
      case 'invasion': {
        const inv = runAdmin(game, s, '/invasion') ?? '';
        if (/^No invasion/.test(inv)) said.push(`invasion: ${runAdmin(game, s, '/invasion start')}`);
        break;
      }
    }
    if (busy(s)) auto(c);
    else if (c.role !== 'invasion' && c.role !== 'arena') said.push(`${c.role}: not begun — ${c.conn.said}`);
  }
  return said;
}

/** The Colosseum's drafts made at once by the bench (a ban, a pick, a pass), so the bouts come to the sand. */
function draft(sc: Scene): void {
  for (const c of sc.caps) {
    if (c.role !== 'arena') continue;
    const d = arenaView(sc.game, c.s)?.draft;
    if (!d || d.turn !== d.you || (d.stage !== 'ban' && d.stage !== 'pick')) continue;
    const taken = new Set([...d.bans[0], ...d.bans[1], ...d.picks[0], ...d.picks[1]]);
    const free = d.pool.filter((x) => !taken.has(x.u));
    if (d.stage === 'ban') c.conn.push({ t: 'throne', action: 'arena', op: 'ban', u: free[free.length - 1].u });
    else {
      const lot = free.filter((x) => x.price <= d.left[d.you]).sort((a, b) => b.price - a.price)[0];
      if (!lot || d.picks[d.you].length >= 7) c.conn.push({ t: 'throne', action: 'arena', op: 'pass' });
      else c.conn.push({ t: 'throne', action: 'arena', op: 'pick', u: lot.u });
    }
  }
}

function settle(sc: Scene, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sc.game.step();
    if (sc.live && i % 10 === 0) draft(sc);
  }
  if (sc.live) for (const c of sc.caps) if (c.role !== 'sail' && busy(c.s)) auto(c);
}

interface Block { ms: number[]; bytes: number; cpu: number; fights: number; invaders: number }
function block(sc: Scene): Block {
  const ms: number[] = [];
  const b0 = sc.caps.reduce((a, c) => a + c.conn.bytes, 0);
  const cpu0 = process.cpuUsage();
  let fights = 0;
  for (let i = 0; i < TICKS; i++) {
    const a = performance.now();
    sc.game.step();
    ms.push(performance.now() - a);
    if (sc.live && i % 10 === 0) draft(sc);
    if (i === TICKS >> 1) fights = sc.caps.filter((c) => busy(c.s)).length;
  }
  const cpu = process.cpuUsage(cpu0);
  return { ms, bytes: sc.caps.reduce((a, c) => a + c.conn.bytes, 0) - b0, cpu: (cpu.user + cpu.system) / 1000 / TICKS, fights, invaders: sc.game.invasions.live.size };
}

const q = (x: number[], p: number) => { const s = [...x].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

const t0 = performance.now();
const scenes = { off: build(false), on: build(true) };
for (const sc of [scenes.off, scenes.on]) settle(sc, 600); // a minute of the sea: the traffic about them filled
const said = engage(scenes.on);
settle(scenes.on, 200);
console.log(`built and warmed in ${((performance.now() - t0) / 1000).toFixed(1)} s; ${said.join(' · ')}`);
const res: Record<'off' | 'on', Block[]> = { off: [], on: [] };
for (let k = 0; k < BLOCKS; k++) {
  for (const key of (k % 2 ? ['on', 'off'] : ['off', 'on']) as ('off' | 'on')[]) {
    const sc = scenes[key];
    if (sc.live) { engage(sc); settle(sc, 60); }
    const b = block(sc);
    res[key].push(b);
    console.log(`block ${k + 1} ${key.padEnd(3)}: mean ${mean(b.ms).toFixed(2)} ms, p95 ${q(b.ms, 0.95).toFixed(2)}, max ${Math.max(...b.ms).toFixed(1)} · cpu ${b.cpu.toFixed(2)} ms/tick · ${(b.bytes / N / (TICKS / 20) / 1024).toFixed(2)} KB/s a captain · in battle ${b.fights}, Choir ${b.invaders}`);
  }
}
for (const key of ['off', 'on'] as const) {
  const all = res[key].flatMap((b) => b.ms);
  const bytes = res[key].reduce((a, b) => a + b.bytes, 0);
  const secs = (TICKS * res[key].length) / 20;
  console.log(`${key === 'on' ? 'endgame live' : 'endgame off '}: mean ${mean(all).toFixed(2)} ms, median ${q(all, 0.5).toFixed(2)}, p95 ${q(all, 0.95).toFixed(2)}, max ${Math.max(...all).toFixed(1)} · cpu ${mean(res[key].map((b) => b.cpu)).toFixed(2)} ms/tick · ${(bytes / N / secs / 1024).toFixed(2)} KB/s a captain · ships ${scenes[key].game.ships.size}`);
}
const rep = scenes.on.game.prof.report();
console.log('on, by phase (mean/max ms, the last 30 s):', Object.entries(rep).slice(0, 10).map(([k, v]) => `${k} ${v.avgMs.toFixed(2)}/${v.maxMs.toFixed(1)}`).join(' · '));
const rep0 = scenes.off.game.prof.report();
console.log('off, by phase (mean/max ms, the last 30 s):', Object.entries(rep0).slice(0, 10).map(([k, v]) => `${k} ${v.avgMs.toFixed(2)}/${v.maxMs.toFixed(1)}`).join(' · '));
if (process.env.BENCH_JSON) console.log(JSON.stringify(Object.fromEntries((['off', 'on'] as const).map((k) => { const all = res[k].flatMap((b) => b.ms); return [k, { mean: mean(all), p95: q(all, 0.95), max: Math.max(...all), kbs: res[k].reduce((a, b) => a + b.bytes, 0) / N / ((TICKS * res[k].length) / 20) / 1024 }]; }))));
