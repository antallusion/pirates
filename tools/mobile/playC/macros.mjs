// Band C (levels 40–60 and the endgame, docs/30_PLAYTHROUGH_C.md): playA's in-process hands, and the endgame's on top.
//   sh data/c-start.sh — CPORT=58996 DB=data/inproc-c.db … MACROS=../playC/macros.mjs node tools/mobile/playA/inproc.mjs
export * from '../playA/inproc-macros.mjs';
import { refit as refitA, auto as autoA, reflex as reflexA } from '../playA/inproc-macros.mjs';
import { TALENTS, canLearn } from '../../../shared/src/data/talents.ts';
import { learnContext } from '../../../server/src/game/progression.ts';

const R = (globalThis.__inC ??= { tAt: -99 });

/** Her reflexes, and a talent point spent as it comes (the gunnery tree first, then the hull's, then the rest by tier). */
export function reflex(B) {
  B.restockEnRoute = true;
  reflexA(B);
  matesAuto(B);
  if (!B.noFlee) flee(B);
  const p = B.s.profile, ship = B.s.ship;
  if (!p || !ship || B.game.now - R.tAt < 3 || ship.underFire?.(B.game.now)) return;
  const pts = B.game.talentPoints(p);
  if (pts <= 0) return;
  R.tAt = B.game.now;
  const ctx = learnContext(p);
  const order = [...TALENTS].sort((a, b) => pref(a.id) - pref(b.id) || (a.tier ?? 0) - (b.tier ?? 0));
  const t = order.find((x) => !canLearn(p.talents, x.id, pts, ctx));
  if (t) B.send({ t: 'learn_talent', id: t.id });
}
/** A captain does not wait for a ship two levels over her to grapple: she runs for the nearest harbour. */
function flee(B) {
  const ship = B.s.ship, now = B.game.now;
  if (!ship || ship.docked || B.tac || ship.boarding || now - (R.fleeAt ?? -99) < 10) return;
  let worst = null;
  B.game.forShipsNear(ship.state.x, ship.state.y, 1500, (o) => {
    if (o.id === ship.id || !o.alive || o.docked || o.isPlayer || o.surrendered || o.sinkingUntil) return;
    if (!B.game.isHostile(o, ship) || (o.shipLevel ?? 0) < ship.shipLevel + 2 || o.npcRole === 'boss') return;
    if (!worst || o.shipLevel > worst.shipLevel) worst = o;
  });
  if (!worst) return;
  R.fleeAt = now;
  const pt = B.game.nearestPort(ship.state.x, ship.state.y, (q) => !q.raft);
  if (!pt) return;
  B.send({ t: 'attack', stop: true });
  B.send({ t: 'autosail', x: pt.x, y: pt.y });
  B.note('bot', `fleeing ${worst.name} ⚓${worst.shipLevel} for ${pt.name}`);
}
const pref = (id) => (/^gun_/.test(id) ? 0 : /^srv_|^shp_/.test(id) ? 1 : /^brd_|^cmd_/.test(id) ? 2 : 3);

/** A late captain's stores: round shot for 16 broadsides of her battery (a fight of her ⚓ takes 8–14), food for 25 min
 *  of her crew (a third of the hold at most). */
export async function refitC(B, a = {}) {
  const ship = B.s.ship;
  const gps = ship.stats.gunsPerSide ?? 10;
  const food = Math.min(Math.round(ship.stats.holdVolume / 3), Math.ceil((ship.stats.crewMax / 40) * 25));
  return refitA(B, { round: gps * 16, food, ...a });
}

/** playA's working rounds with a late captain's stores; in port her recruiting window first (her hammocks to the
 *  dwellings' men before the tavern's deckhands), and her own island's dwellings every `isleEvery` rounds. */
export async function autoC(B, a = {}) {
  const ship = B.s.ship, rounds = Number(a.rounds ?? 10), log = [];
  const lv0 = B.s.profile.level;
  for (let i = 0; i < rounds && !B.stop; i++) {
    if (ship.docked) { const m = await muster(B, { reserve: 800 }); if (m.out?.length) log.push(`muster: ${m.out.join(', ')}`); }
    // short of men and of silver to sign them on: what a captain does — letters and quiet water until the chest is full
    // again (no hunting with a third of her crew)
    if (ship.crew < ship.stats.crewMax * 0.55) {
      const r = await recover(B);
      log.push(`recover: ${JSON.stringify(r).slice(0, 200)}`);
      if (ship.crew < ship.stats.crewMax * 0.55) continue;
    }
    const gps = ship.stats.gunsPerSide ?? 10;
    const food = Math.min(Math.round(ship.stats.holdVolume / 2), Math.ceil((ship.stats.crewMax / 40) * 25));
    const r = await autoA(B, { round: gps * 16, food, rounds: 1 });
    log.push(...r.log);
    if (Number(a.toLevel) && B.s.profile.level >= Number(a.toLevel)) break;
  }
  return { from: lv0, to: B.s.profile.level, xp: B.s.profile.xp, silver: B.s.profile.gold, log: log.slice(-40) };
}

import { UNITS } from '../../../shared/src/data/army.ts';

/** The recruiting window as a captain works it (docs/17 H3): her deckhands trained up, then the dwellings' best men
 *  into the free hammocks, the strongest first, keeping `reserve` silver; at her own island (`src=isle`) or a port. */
export async function muster(B, a = {}) {
  const src = a.src ?? 'port', reserve = Number(a.reserve ?? 1500), out = [];
  const p = B.s.profile, ship = B.s.ship;
  const get = async () => { B.views.dwell = null; B.send({ t: 'h3', action: 'dwell', src }); await B.run(0.2); return B.views.dwell?.view ?? null; };
  let v = await get();
  if (!v || v.why) return { why: v?.why ?? 'no view' };
  const can = (per, goods, n) => {
    let k = Math.min(n, Math.floor((p.gold - reserve) / Math.max(0.01, per)));
    for (const [g, q] of Object.entries(goods ?? {})) if (q > 0) k = Math.min(k, Math.floor((v.have?.[g] ?? 0) / q));
    return Math.max(0, k);
  };
  // trained up, the best step first
  for (const up of [...v.ups].sort((x, y) => UNITS[y.to].tier - UNITS[x.to].tier)) {
    const n = can(up.per, up.goods, Math.min(up.n, up.room ?? up.n));
    if (n > 0) { B.send({ t: 'h3', action: 'train', src, u: up.u, n }); await B.run(0.1); out.push(`${up.u}→${up.to} ×${n}`); v = (await get()) ?? v; }
  }
  // the dwellings into the free hammocks, the strongest first
  for (const row of [...v.rows].filter((r) => !r.why && r.pool > 0).sort((x, y) => y.tier - x.tier)) {
    for (const u of row.units) {
      const free = ship.stats.crewMax - ship.crew;
      if (free <= 0) break;
      if (u.u === 'deckhand') continue;
      const n = can(u.per, u.goods, Math.min(row.pool, free, u.room === undefined || u.room < 0 ? 1e9 : u.room));
      if (n > 0) { B.send({ t: 'h3', action: 'recruit', src, u: u.u, n }); await B.run(0.1); out.push(`${u.u} ×${n}`); v = (await get()) ?? v; }
    }
  }
  return { out, crew: `${ship.crew}/${ship.stats.crewMax}`, silver: p.gold, army: ship.army.map((x) => `${x.u}×${x.n}`).join(' ') };
}

/** Back on her feet after a ruinous fight: into the nearest big harbour of quieter water (a yard, a tavern of veterans),
 *  her hold sold, her crew signed on and trained as far as her silver goes; the courier's letters the board offers. */
export async function recover(B) {
  const ship = B.s.ship, p = B.s.profile, me = ship.state;
  const { sectorAt } = await import('../../../shared/src/world/sectors.ts');
  const pt = B.game.world.ports.filter((q) => q.size >= 2 && !q.raft && sectorAt(B.game.world, q.x, q.y).level <= ship.shipLevel - 1 && !B.game.isHostilePort?.(q, B.s))
    .sort((u, v) => Math.hypot(u.x - me.x, u.y - me.y) - Math.hypot(v.x - me.x, v.y - me.y))[0];
  if (!pt) return 'no harbour';
  const r = await (await import('../playA/inproc-macros.mjs')).dock(B, { port: pt.id, why: 'recover: a big harbour of quieter water' });
  if (!ship.docked) return { to: pt.id, r };
  await (await import('../playA/inproc-macros.mjs')).sellLoot(B);
  await refitC(B);
  const m = await muster(B, { reserve: 300 });
  return { at: pt.id, crew: `${ship.crew}/${ship.stats.crewMax}`, silver: p.gold, muster: m.out };
}

// ---------------------------------------------------------------- the endgame (docs/19 E): the Throne's windows as she works them

/** Her seal's mythic depth: to the lair it names, the depth opened, fought out by her reflexes (tacMove), the result. */
export async function sealRun(B, a = {}) {
  const { tp } = await import('../playA/inproc-macros.mjs');
  const out = [];
  for (let i = 0; i < Number(a.n ?? 1) && !B.stop; i++) {
    const g0 = B.s.profile.gold, s0 = B.self.glory?.seal;
    if (!s0) return 'no seal';
    if (!s0.reach) await tp(B, s0.near.x, s0.near.y, `seal ${s0.lv}: ${s0.kind} at ${s0.near.island}`);
    await B.run(2);
    if (B.s.ship.docked) { B.send({ t: 'undock' }); await B.run(2); }
    const t0 = B.game.now;
    B.send({ t: 'throne', action: 'seal' });
    await B.run(2);
    if (!B.tac) { out.push({ lv: s0.lv, why: B.log.slice(-3).map((l) => l.msg) }); break; }
    await B.run(900, () => !B.tac || !!B.tac?.over);
    const v = B.tac;
    await B.run(4);
    const s1 = B.self.glory.seal;
    out.push({ lv: s0.lv, kind: s0.kind, affixes: s0.affixes.join('+'), won: v?.over ? v.over.winner === v.you : null, rounds: v?.round, secs: Math.round(B.game.now - t0), lost: v?.result?.lost, silver: B.s.profile.gold - g0, next: s1.lv });
  }
  return out;
}

/** Her hammocks filled the way a captain does it: harbour after harbour (big ones first, nearest first), the recruiting
 *  window and the tavern in each, until she is full or `max` harbours are behind her. The ports and the minutes. */
export async function refillTour(B, a = {}) {
  const { dock } = await import('../playA/inproc-macros.mjs');
  const ship = B.s.ship, t0 = B.game.now, seen = new Set(), out = [];
  for (let i = 0; i < Number(a.max ?? 12) && ship.crew < ship.stats.crewMax * 0.98 && !B.stop; i++) {
    const me = ship.state;
    const pt = B.game.world.ports.filter((q) => !q.raft && !seen.has(q.id) && q.size >= Number(a.size ?? 2)).sort((u, v) => Math.hypot(u.x - me.x, u.y - me.y) - Math.hypot(v.x - me.x, v.y - me.y))[0];
    if (!pt) break;
    seen.add(pt.id);
    const c0 = ship.crew;
    await dock(B, { port: pt.id, why: 'to fill the hammocks' });
    if (ship.docked !== pt.id) { out.push(`${pt.id}: no berth`); continue; }
    await muster(B, { reserve: Number(a.reserve ?? 5000) });
    await refitC(B, { round: 0, food: 0 });
    out.push(`${pt.id} +${ship.crew - c0}`);
  }
  return { crew: `${ship.crew}/${ship.stats.crewMax}`, ports: out, minutes: Math.round((B.game.now - t0) / 60), silver: B.s.profile.gold };
}

// ---------------------------------------------------------------- mates: other captains in this world (group content)

const M = (globalThis.__mates ??= new Map());

/** A captain more in this world, set up as one of her level (the admin lines, only to set her up), her own fake wire;
 *  her battles are fought by the battle's own mind (the auto a captain gone from the helm gets). */
export async function mate(B, a = {}) {
  const { runAdmin } = await import('../../../server/src/game/admin.ts');
  const { PROTOCOL_VERSION } = await import('../../../shared/src/constants.ts');
  const name = a.name ?? `Mate ${M.size + 1}`;
  if (M.has(name)) return `${name} is here already`;
  const inbox = [];
  const conn = { closed: false, remote: 'mate', bytesOut: 0, buffered: 0, onMessage: () => {}, onClose: () => {}, send(t) { const m = JSON.parse(t); if (m.t === 'toast' || m.t === 'err') inbox.push(m.msg); if (inbox.length > 200) inbox.shift(); }, sendBinary() {}, close() { this.closed = true; this.onClose(); } };
  const s = B.game.attach(conn);
  const send = (m) => conn.onMessage(JSON.stringify(m));
  send({ t: 'hello', v: PROTOCOL_VERSION, name });
  send({ t: 'create_captain', captain: a.captain ?? 'reaver', shipName: name, tutorial: false });
  await B.run(0.5);
  const L = Number(a.level ?? B.s.profile.level);
  for (const line of [`/level ${L}`, '/kit build', `/army level ${Math.min(10, Math.ceil(L / 6))}`, '/art set regalia', '/art set hook', '/art set storm', '/art mercy_medal', '/silver 50000']) runAdmin(B.game, s, line);
  // her artifacts on, her skills picked as they come (the first offered)
  for (const it of s.profile.stash.filter((i) => i.art)) send({ t: 'gear', action: 'equip', uid: it.uid });
  for (let k = 0; k < 60; k++) send({ t: 'hero', action: 'skill', pick: 0 });
  M.set(name, { s, send, inbox });
  return { name, level: s.profile.level, ship: `${s.ship.loadout.classId} ⚓${s.ship.shipLevel}`, crew: s.ship.crew };
}

/** Every mate's battle (and hers, by playA's reflex) fought by the battle's own mind. */
export function matesAuto(B) {
  for (const { s } of M.values()) {
    const b = s.ship?.boarding;
    if (!b) continue;
    const att = b.attacker ? s.ship : B.game.ships.get(b.with);
    const bt = att?.boarding?.fight?.tac;
    if (bt) for (const h of bt.heroes) if (h.input.name === s.name) h.auto = true;
  }
}
export const mates = () => [...M.keys()];
export function mateSend(B, a) { const m = M.get(a.name); if (!m) return 'no such mate'; m.send(JSON.parse(a.msg)); return m.inbox.slice(-5); }

/** Her mates alongside her (150 m apart off her beam), whole and stored (the setup's admin lines), out of any port. */
export async function bring(B) {
  const { runAdmin } = await import('../../../server/src/game/admin.ts');
  const me = B.s.ship, out = [];
  let k = 1;
  for (const [name, { s, send }] of M) {
    const sh = s.ship;
    if (sh.docked) { send({ t: 'undock' }); await B.run(1); }
    sh.docked = null;
    s.profile.docked = null;
    sh.state.x = me.state.x + 150 * k;
    sh.state.y = me.state.y + 40 * k;
    sh.state.speed = 0;
    sh.input = { rudder: 0, sailTarget: 0 };
    sh.region = me.region;
    B.game.grid.upsert(sh.id, sh.state.x, sh.state.y);
    runAdmin(B.game, s, '/heal');
    runAdmin(B.game, s, '/ammo');
    out.push(`${name} ${sh.crew} hull ${Math.round(sh.hull)}`);
    k++;
  }
  return out;
}

/** The zone boss of her sea fought by her and her mates with the guns: the minutes, each hull lost, who sank. */
export async function zboss(B, a = {}) {
  const { runAdmin } = await import('../../../server/src/game/admin.ts');
  const region = B.s.ship.region;
  if (a.raise) B.log.push({ t: B.game.now, kind: 'admin', msg: runAdmin(B.game, B.s, `/zboss ${region} here`) });
  await B.run(1);
  let boss = null, bd = 1e9;
  const me = B.s.ship.state;
  for (const sh of B.game.ships.values()) {
    const d = Math.hypot(sh.state.x - me.x, sh.state.y - me.y);
    if (sh.zoneBoss && sh.alive && d < bd) { boss = sh; bd = d; }
  }
  if (!boss) return 'no boss here';
  const t0 = B.game.now, h0 = boss.hull, ours = [B.s, ...[...M.values()].map((m) => m.s)];
  const start = new Map(ours.map((s) => [s.accountId, { hull: s.ship.hull, max: s.ship.stats.hullMax }]));
  B.send({ t: 'attack', target: boss.id, mode: 'guns' });
  for (const { send } of M.values()) send({ t: 'attack', target: boss.id, mode: 'guns' });
  let sunk = [];
  while (B.game.now - t0 < Number(a.max ?? 3600) && boss.alive && !boss.sinkingUntil && !B.stop) {
    await B.run(5);
    if (Math.floor(B.game.now - t0) % 30 < 5) {
      B.send({ t: 'attack', target: boss.id, mode: 'guns' });
      for (const { send, s } of M.values()) if (s.ship?.alive) send({ t: 'attack', target: boss.id, mode: 'guns' });
    }
    sunk = ours.filter((s) => !s.ship?.alive || s.ship.sinkingUntil).map((s) => s.name);
    if (sunk.length === ours.length) break;
  }
  return {
    minutes: Math.round((B.game.now - t0) / 6) / 10, bossHull: `${Math.round(boss.hull)}/${Math.round(h0)}`, bossDown: !boss.alive || !!boss.sinkingUntil,
    ours: ours.map((s) => `${s.name}: ${Math.round((s.ship.hull / s.ship.stats.hullMax) * 100)}% (from ${Math.round((start.get(s.accountId).hull / start.get(s.accountId).max) * 100)}%)`), sunk,
  };
}
