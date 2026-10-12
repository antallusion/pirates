// Macros of the headless player (proto.mjs): reloaded on every /run, so they can be mended while she sails.
import { hexDist } from '../../../shared/src/data/tactical.ts';
import { angleDiff, headingOf } from '../../../shared/src/math.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const ping = async () => 'pong';

/** Talents and the hero's skills of a level-up she has not chosen yet: the order given, then the first offered. */
export async function picks(G, a) {
  const out = [];
  const want = (a.talents ?? '').split(',').filter(Boolean);
  for (const id of want) {
    if ((G.self.talentPoints ?? 0) <= 0) break;
    G.send({ t: 'learn_talent', id });
    await sleep(400);
    out.push(id);
  }
  // hero: prefer the offer whose id is in a.prefer, else the first
  const prefer = (a.prefer ?? 'artillery,offense,tactics,leadership,logistics').split(',');
  for (let i = 0; i < 20 && (G.self.hero?.pending ?? 0) > 0; i++) {
    const off = G.self.hero.offer ?? [];
    if (!off.length) break;
    let k = off.findIndex((o) => prefer.includes(o.id));
    if (k < 0) k = 0;
    G.send({ t: 'hero', action: 'skill', pick: k });
    out.push(`skill ${off[k].id}`);
    await sleep(500);
  }
  return { out, tp: G.self.talentPoints, pending: G.self.hero?.pending, skills: G.self.hero?.skills };
}

const R = (globalThis.__reflex ??= { tacSeq: -1, tacAt: 0, lootAt: 0, surrAt: 0, battles: 0, tacStart: 0 });

/** One look at the sea a few times a second: what a player answers at once. */
export async function reflex(G) {
  const now = Date.now();
  // The odds of a risky boarding: a fair chance is taken, a poor one left to the guns.
  if (G.risk) {
    const r = G.risk;
    G.risk = null;
    const go = r.chance >= (G.riskMin ?? 0.55);
    if (go) G.send({ t: 'board', target: r.target, aggression: 'standard', risk: true });
    else G.send({ t: 'attack', target: r.target, mode: 'guns' });
    G.note('bot', `risk ${Math.round(r.chance * 100)}% → ${go ? 'board' : 'guns'}`);
  }
  // A deck fight, turn by turn.
  const v = G.tac;
  if (v) {
    if (!R.tacStart) { R.tacStart = now; R.battles++; }
    if (v.over) {
      if (!R.tacOverAt) {
        R.tacOverAt = now;
        G.note('tac', `over: ${v.over.winner === v.you ? 'WON' : 'lost'} (${v.over.why}) round ${v.round}, ${Math.round((now - R.tacStart) / 1000)} s real; result ${JSON.stringify(v.result ?? {}).slice(0, 300)}`);
      }
    } else if (v.mine && v.active != null && (v.seq !== R.tacSeq || now - R.tacAt > 4000)) {
      R.tacSeq = v.seq;
      R.tacAt = now;
      G.send({ t: 'tac', act: tacMove(v) });
    }
  } else if (R.tacStart) { R.tacStart = 0; R.tacOverAt = 0; }
  // The spoils: what fits of the most precious, the men who would sign on, then she is sunk.
  if (G.boarding && now - R.lootAt > 3000) {
    R.lootAt = now;
    const b = G.boarding;
    const take = {};
    let room = b.holdFree ?? 0;
    for (const [g, n] of Object.entries(b.cargo ?? {}).sort((a, c) => c[1] - a[1])) {
      const k = Math.min(n, room);
      if (k > 0) { take[g] = k; room -= k; }
    }
    const y = G.snap?.you;
    const recruit = Math.max(0, Math.min(b.recruits ?? 0, y ? y.crewMax - y.crew : 0));
    G.send({ t: 'loot_take', take, fate: b.captive ? 'ransom' : 'sink', recruit });
    G.note('bot', `spoils: ${JSON.stringify(take)} silver ${b.gold} recruit ${recruit}`);
    G.boarding = null;
  }
  // A ship strikes to her: the cargo.
  if (G.views.surrender && now - R.surrAt > 3000) {
    R.surrAt = now;
    G.send({ t: 'surrender', id: G.views.surrender.id, fate: 'cargo' });
    G.views.surrender = null;
  }
  // A level's skill: the first offered of the schools she follows.
  if ((G.self.hero?.pending ?? 0) > 0 && G.self.hero.offer?.length && now - (R.heroAt ?? 0) > 3000 && !G.tac) {
    R.heroAt = now;
    const prefer = ['artillery', 'offense', 'tactics', 'leadership', 'logistics', 'navigation', 'armorer'];
    let k = G.self.hero.offer.findIndex((o) => prefer.includes(o.id));
    if (k < 0) k = 0;
    G.send({ t: 'hero', action: 'skill', pick: k });
  }
  // The clock: quick on an empty sea, slow with a fight about (a player's eye at ×30 sees a quarter-hour pass in 30 s).
  if (G.snap?.you && now - (R.speedAt ?? 0) > 2000 && !G.fixedSpeed) {
    const busy = !!G.tac || G.snap.you.combat || hostiles(G, { ships: (r) => shipsOf(G, r) }, 2500).length > 0;
    const want = busy ? (G.slow ?? 4) : (G.fast ?? 30);
    if (want !== R.speed) { R.speed = want; R.speedAt = now; G.send({ t: 'chat', text: `/speed ${want}` }); }
  }
  // Her hull, as she would watch it: every fall of a tenth, and who is about.
  const y = G.snap?.you;
  if (y) {
    const f = Math.floor((y.hull / y.hullMax) * 10);
    if (R.hullTenth !== undefined && f < R.hullTenth) G.note('hull', `${Math.round(y.hull)}/${y.hullMax} crew ${y.crew} — near: ${shipsOf(G, 1500).filter((o) => o.hostile).map((o) => `${o.name}⚓${o.lvl}@${o.d}`).join(', ')}`);
    R.hullTenth = f;
  }
  // A mutiny: pay them.
  if (G.self.company?.mutiny && now - (R.mutAt ?? 0) > 5000) { R.mutAt = now; G.send({ t: 'mutiny', choice: 'pay' }); }
}

/** A plain captain's turn: shoot the stack it kills most of, else strike it, else close on the nearest foe. */
export function tacMove(v) {
  const me = v.stacks.find((s) => s.id === v.active);
  const foes = v.stacks.filter((s) => s.side !== v.you && s.count > 0);
  const pv = v.pv ?? [];
  const best = (list) => list.sort((a, b) => (b.kills[0] + b.kills[1]) - (a.kills[0] + a.kills[1]) || (b.dmg[0] + b.dmg[1]) - (a.dmg[0] + a.dmg[1]))[0];
  const shots = pv.filter((p) => p.shot);
  if (v.shoot?.length && shots.length) return { a: 'shoot', target: best(shots).t };
  if (v.shoot?.length) return { a: 'shoot', target: v.shoot[0] };
  const blows = pv.filter((p) => !p.shot);
  if (v.melee?.length && blows.length) {
    const b = best(blows);
    return { a: 'attack', target: b.t, ...(b.from !== undefined ? { from: b.from } : {}) };
  }
  if (v.melee?.length) return { a: 'attack', target: v.melee[0] };
  if (!me || !foes.length || !v.reach?.length) return { a: 'defend' };
  // a shooter with shots stays put and lets them come
  if (me.shotsMax > 0 && me.shots > 0) return { a: 'defend' };
  const near = (h) => Math.min(...foes.map((f) => hexDist(h, f.hex)));
  const step = v.reach.slice().sort((a, b) => near(a) - near(b))[0];
  return near(step) < near(me.hex) ? { a: 'move', to: step } : { a: 'defend' };
}

const hostiles = (G, tools, r) => tools.ships(r).filter((s) => s.hostile && !s.sinking && !s.docked && !s.surrendered);
/** The ships about her (as proto.mjs ships()). */
function shipsOf(G, r) {
  const y = G.snap?.you;
  if (!y) return [];
  return G.snap.ships.map(([id, x, yy, h, spd, sail, hull, sails, flags]) => {
    const i = G.info.get(id) ?? {};
    return { id, d: Math.round(Math.hypot(x - y.x, yy - y.y)), hostile: !!(flags & 64), sinking: !!(flags & 1), docked: !!(flags & 32), surrendered: !!(flags & 16), name: i.name, lvl: i.shipLevel };
  }).filter((o) => o.id !== G.entityId && o.d <= r);
}

/** Sail to a point with the helmsman; a hostile in the way is fought (board when she can, else guns) or run from. */
export async function go(G, a, tools) {
  const x = Number(a.x), y = Number(a.y), near = a.near ? Number(a.near) : undefined;
  const t0 = Date.now();
  const limit = Number(a.max ?? 900) * 1000;
  const fights = [];
  let last = 0;
  G.sunk = null;
  G.send({ t: 'autosail', x, y, ...(near ? { near } : {}) });
  await sleep(1500);
  while (!G.stop && Date.now() - t0 < limit) {
    const me = G.snap?.you;
    if (!me) { await sleep(1000); continue; }
    if (G.sunk) return { sunk: G.sunk, fights };
    const d = Math.hypot(me.x - x, me.y - y);
    if (d < (near ?? 400) + 150 || (G.autosail && !G.autosail.on && G.autosail.why === 'arrived')) return { arrived: true, d: Math.round(d), fights, sec: Math.round((Date.now() - t0) / 1000) };
    if (G.tac || G.boarding) { await sleep(1000); continue; }
    if (me.hull < me.hullMax * Number(a.flee ?? 0.4) && !a.noFlee) return { fled: true, hull: Math.round(me.hull), fights, at: [Math.round(me.x), Math.round(me.y)] };
    // ships in her way; a beast only when it is at her side (it bites) — she is no hunter on a passage
    // (a merchant is no foe on a passage — she is a prize, and a crime under a lawful flag; the sea's raiders are)
    const raider = (o) => ['pirate', 'hunter', 'raider', 'ambusher', 'privateer', 'rival', 'nemesis'].includes(o.role) || o.player;
    const foes = hostiles(G, tools, Number(a.engage ?? 1500)).filter((o) => o.role !== 'beast' ? !a.noShips && (raider(o) || o.d < 200) : o.d < 250);
    if (foes.length && !G.pursuit?.on) {
      const f = foes[0];
      const mine = G.self.loadout?.level ?? 2;
      const grey = f.lvl && f.lvl < mine - 1 && f.role !== 'beast';
      if (a.noFight || grey || (f.lvl && f.lvl > mine + (a.brave ? 1 : 0))) {
        // too strong (or no time): on with the course and let the helmsman run
        if (Date.now() - last > 20000) { last = Date.now(); G.note('bot', `running from ${f.name} ⚓${f.lvl}`); G.send({ t: 'autosail', x, y }); }
      } else {
        fights.push(`${f.name}⚓${f.lvl}`);
        G.note('bot', `engage ${f.name} ⚓${f.lvl} ${f.cls} d${f.d}`);
        G.send({ t: 'attack', target: f.id, mode: a.guns ? 'guns' : 'board' });
        fights.push(await fightOut(G, f.id, tools));
        G.send({ t: 'autosail', x, y, ...(near ? { near } : {}) });
      }
    }
    if (!G.autosail?.on && !G.pursuit?.on && !foes.length && Date.now() - last > 8000) {
      last = Date.now();
      G.send({ t: 'autosail', x, y, ...(near ? { near } : {}) });
    }
    // the helmsman will not have her (a fight about, her hull): her own hand on the wheel, as a player's thumb
    if (!G.autosail?.on && !G.pursuit?.on && Date.now() - last > 2500) steer(G, x, y);
    await sleep(1500);
  }
  return { arrived: false, fights, at: [Math.round(G.snap?.you?.x), Math.round(G.snap?.you?.y)] };
}

/** Until the mark is gone, sunk, struck or boarded and settled. */
export async function fightOut(G, id, tools, maxSec = 240) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxSec * 1000 && !G.stop) {
    await sleep(1000);
    if (G.sunk) return 'sunk';
    if (G.tac || G.boarding) continue;
    const me = G.snap?.you;
    if (me && me.hull < me.hullMax * 0.35) { G.send({ t: 'attack', stop: true }); return 'broke off (hull)'; }
    const s = tools.ships(4000).find((o) => o.id === id);
    if (!s || s.sinking || s.surrendered) { await sleep(1500); return 'done'; }
    if (!G.pursuit?.on) G.send({ t: 'attack', target: id, mode: 'guns' });
  }
  G.send({ t: 'attack', stop: true });
  return 'timeout';
}

/** Hunt: the nearest hostile ships within r of her level band, one after another, n of them. */
export async function hunt(G, a, tools) {
  const n = Number(a.n ?? 3), r = Number(a.r ?? 5000);
  const out = [];
  for (let i = 0; i < n && !G.stop; i++) {
    const mine = G.self.loadout?.level ?? 2;
    const f = hostiles(G, tools, r).find((s) => !s.lvl || s.lvl <= mine + 1);
    if (!f) { out.push('none near'); break; }
    G.note('bot', `hunt ${f.name} ⚓${f.lvl} ${f.cls} d${f.d}`);
    const xp0 = G.self.xp, s0 = G.self.gold;
    G.send({ t: 'attack', target: f.id, mode: a.guns ? 'guns' : 'board' });
    const r1 = await fightOut(G, f.id, tools, 300);
    await sleep(2000);
    out.push(`${f.name}⚓${f.lvl}: ${r1} xp+${G.self.xp - xp0} silver${G.self.gold - s0 >= 0 ? '+' : ''}${G.self.gold - s0}`);
    if (G.sunk) break;
  }
  return out;
}

/** In port: the yard, the tavern to her hammocks, round shot and stores — what a player sees to before sailing. */
export async function refit(G, a) {
  const out = [];
  const say = async (m, w = 700) => { G.send(m); await sleep(w); };
  if (!G.self.dockedAt) return 'not in port';
  const y = G.snap?.you;
  if (y && y.hull < y.hullMax) { await say({ t: 'repair', on: true }); out.push('repair'); }
  if (y && y.crew < y.crewMax) { await say({ t: 'hire_crew', qty: y.crewMax - y.crew }); out.push(`hire ${y.crewMax - y.crew}`); }
  const round = Number(a.round ?? 60) - (G.self.ammo?.round ?? 0);
  if (round > 0) { await say({ t: 'buy_ammo', ammo: 'round', qty: round }); out.push(`round ${round}`); }
  const food = Number(a.food ?? 8) - (G.self.cargo?.provisions ?? 0);
  if (food > 0) { await say({ t: 'trade', good: 'provisions', qty: food }); out.push(`food ${food}`); }
  await sleep(500);
  return { out, silver: G.self.gold, hull: G.snap?.you?.hull, crew: G.snap?.you?.crew, ammo: G.self.ammo?.round, food: G.self.cargo?.provisions };
}

/** To a port and in. */
export async function dock(G, a, tools) {
  const p = G.ports.find((q) => q.id === a.port || q.name === a.port);
  if (!p) return 'no such port';
  let r = await go(G, { ...a, x: p.x, y: p.y, near: 300 }, tools);
  if (r.sunk) return r;
  if (r.fled) {
    // hurt: the nearest harbour, and no more fighting on the way
    const me = G.snap.you;
    const q = G.ports.slice().sort((u, v) => Math.hypot(u.x - me.x, u.y - me.y) - Math.hypot(v.x - me.x, v.y - me.y))[0];
    G.note('bot', `hurt (${Math.round(me.hull)}): running for ${q.name}`);
    r = { ...(await go(G, { x: q.x, y: q.y, near: 300, noFight: 1, noFlee: 1 }, tools)), fledTo: q.id };
    if (r.sunk) return r;
  }
  for (let i = 0; i < 8 && !G.self.dockedAt; i++) { G.send({ t: 'dock' }); await sleep(2500); }
  return { ...r, docked: G.self.dockedAt };
}

/** Her own hand on the wheel toward a point (the joystick a player holds when the helmsman will not). */
let seq = 1e6;
export function steer(G, x, y, sail = 4) {
  const me = G.snap?.you;
  if (!me) return;
  const want = headingOf(x - me.x, y - me.y);
  const d = angleDiff(me.h, want);
  G.send({ t: 'input', seq: ++seq, rudder: Math.max(-1, Math.min(1, d / 0.6)), sail });
}

/** A lair ashore: sail in to it, land the party, fight it out turn by turn (the reflexes), close the card. */
export async function lair(G, a, tools) {
  const list = G.views.lairs?.view?.list ?? [];
  const l = a.id ? list.find((x) => x.id === a.id) : list.filter((x) => a.island === undefined || x.island === Number(a.island)).sort((u, v) => Math.hypot(u.x - G.snap.you.x, u.y - G.snap.you.y) - Math.hypot(v.x - G.snap.you.x, v.y - G.snap.you.y))[0];
  if (!l) return 'no lair';
  G.note('bot', `lair ${l.id} ${l.kind} ⚓${l.level} men ${l.men}`);
  const r = await go(G, { x: l.x, y: l.y, near: Number(a.near ?? 350), noShips: a.noShips }, tools);
  if (r.sunk || r.fled) return r;
  const xp0 = G.self.xp, s0 = G.self.gold;
  for (let i = 0; i < 6 && !G.tac; i++) { G.send({ t: 'lair', action: 'fight', id: l.id }); await sleep(3000); }
  if (!G.tac) return { ...r, fight: 'did not start' };
  const t0 = Date.now();
  while (G.tac && !G.tac.over && Date.now() - t0 < 600000) await sleep(1000);
  const over = G.tac?.over;
  await sleep(2500);
  G.send({ t: 'lair', action: 'close' });
  await sleep(1500);
  return { ...r, lair: l.id, over, won: over ? over.winner === 0 : null, sec: Math.round((Date.now() - t0) / 1000), xp: G.self.xp - xp0, silver: G.self.gold - s0, crew: G.snap?.you?.crew };
}
