// The in-process player's hands (inproc.mjs): reflexes, passages, fights, ports. Reloaded on every /run.
import { hexDist } from '../../../shared/src/data/tactical.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';
import { provisionsPerMinute } from '../../../shared/src/data/voyage.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { depthAt, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { wagesPerHour, wageMul } from '../../../server/src/game/crew.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';

const R = (globalThis.__inR ??= { tacSeq: -1, tacAt: 0, tacStart: 0, battles: 0 });

// ---------------------------------------------------------------- what she sees
export function summary(B) {
  const s = B.s, p = s.profile, ship = s.ship;
  if (!p || !ship) return { captain: false };
  return {
    lvl: p.level, xp: `${p.xp}/${B.self?.xpNext}`, silver: p.gold, tp: B.self?.talentPoints, wanted: B.self?.wanted, docked: ship.docked, t: B.fmtT(B.game.now),
    hull: `${Math.round(ship.hull)}/${ship.stats.hullMax}`, crew: `${ship.crew}/${ship.stats.crewMax}`, morale: Math.round(ship.morale), loyalty: Math.round(p.company?.loyalty ?? 0),
    at: [Math.round(ship.state.x), Math.round(ship.state.y)], sq: sectorAt(B.game.world, ship.state.x, ship.state.y).level, region: ship.region,
    ship: `${ship.loadout.classId} ⚓${ship.shipLevel}`, round: ship.ammo.round, cargo: Object.fromEntries(Object.entries(ship.cargo).filter(([, n]) => n > 0).map(([g, n]) => [g, Math.round(n * 10) / 10])),
    quests: (B.self?.quests ?? []).map((q) => `${q.id} | ${q.name} | ${q.text} ${q.progress}/${q.need}${q.target ? ` @${Math.round(q.target.x)},${Math.round(q.target.y)}${q.target.port ? ' port ' + q.target.port : ''}${q.target.island !== undefined ? ' isl ' + q.target.island : ''}` : ''}`),
    contracts: (B.self?.contracts ?? []).map((c) => `${c.id} ${c.kind} ${c.title ?? ''} ${c.progress ?? ''} → ${c.toPort ?? ''} ${c.reward}s ${c.xp}xp`),
    army: ship.army.map((a) => `${a.u}×${a.n}`).join(' '),
  };
}

/** Ships about her: distance, level, role, and whether she is at war with them (the snapshot's hostile bit). */
export function near(B, r = 3000) {
  const me = B.s.ship;
  const out = [];
  B.game.forShipsNear(me.state.x, me.state.y, r, (o) => {
    if (o.id === me.id || !o.alive || o.docked) return;
    const d = Math.hypot(o.state.x - me.state.x, o.state.y - me.state.y);
    if (d > r) return;
    out.push({ id: o.id, d: Math.round(d), name: o.name, cls: o.loadout.classId, lvl: o.shipLevel, role: o.npcRole, fac: o.faction, hostile: B.game.isHostile(o, me), hull: Math.round((o.hull / o.stats.hullMax) * 100), player: o.isPlayer, sinking: !!o.sinkingUntil, struck: o.surrendered, guard: !!o.guardOf });
  });
  return out.sort((a, b) => (/^Reach /.test(b.text) ? 1 : 0) - (/^Reach /.test(a.text) ? 1 : 0) || a.d - b.d);
}

// ---------------------------------------------------------------- reflexes: what a player answers at once
export function reflex(B) {
  const now = B.game.now;
  if (B.risk) {
    const r = B.risk;
    B.risk = null;
    const go = r.chance >= (B.riskMin ?? 0.6);
    B.send(go ? { t: 'board', target: r.target, aggression: 'standard', risk: true } : { t: 'attack', target: r.target, mode: 'guns' });
    B.note('bot', `risk ${Math.round(r.chance * 100)}% → ${go ? 'board' : 'guns'}`);
  }
  const v = B.tac;
  if (v) {
    if (!R.tacStart) { R.tacStart = now; R.battles++; B.book.fights++; }
    if (v.over) {
      if (!R.tacOverAt) {
        R.tacOverAt = now;
        B.note('tac', `${v.land ? 'ashore' : 'boarding'} ${v.over.winner === v.you ? 'WON' : 'LOST'} (${v.over.why}) round ${v.round}, ${Math.round(now - R.tacStart)} s; lost ${JSON.stringify(v.result?.lost ?? [])} xp ${v.result?.xp ?? 0}`);
      }
      if (v.land && now - R.tacOverAt > 2) { B.send({ t: 'lair', action: 'close' }); B.tac = null; }
    } else if (!v.land && boardBattle(B)) {
      // a boarding: her side is played by the battle's own mind, as a captain gone from the helm has it played for
      // free (a competent captain's hand — the bot's own rules lost fights the engine wins nine in ten)
    } else if (v.mine && v.active != null && (v.seq !== R.tacSeq || now - R.tacAt > 3)) {
      R.tacSeq = v.seq;
      R.tacAt = now;
      B.send({ t: 'tac', act: tacMove(v) });
    }
  } else if (R.tacStart) { R.tacStart = 0; R.tacOverAt = 0; }
  if (B.boarding && now - (R.lootAt ?? -99) > 2) {
    R.lootAt = now;
    const b = B.boarding, ship = B.s.ship;
    const take = {};
    let room = b.holdFree ?? 0;
    for (const [g, n] of Object.entries(b.cargo ?? {}).sort((a, c) => c[1] - a[1])) {
      const k = Math.floor(Math.min(n, room));
      if (k > 0) { take[g] = k; room -= k; }
    }
    const recruit = Math.max(0, Math.min(b.recruits ?? 0, ship.stats.crewMax - ship.crew));
    B.send({ t: 'loot_take', take, fate: b.captive ? 'ransom' : 'sink', recruit });
    B.note('bot', `spoils ${JSON.stringify(take)} silver ${b.gold} +${recruit} men`);
    B.boarding = null;
  }
  if (B.views.surrender && now - (R.surrAt ?? -99) > 2) {
    R.surrAt = now;
    B.send({ t: 'surrender', id: B.views.surrender.id, fate: 'cargo' });
    B.views.surrender = null;
  }
  const h = B.self?.hero;
  if (h && h.pending > 0 && h.offer?.length && !B.tac && now - (R.heroAt ?? -99) > 2) {
    R.heroAt = now;
    const prefer = ['artillery', 'offense', 'tactics', 'leadership', 'logistics', 'navigation', 'armorer', 'luck'];
    let k = h.offer.findIndex((o) => prefer.includes(o.id));
    B.send({ t: 'hero', action: 'skill', pick: k < 0 ? 0 : k });
  }
  if (B.s.profile?.company?.mutiny && now - (R.mutAt ?? -99) > 5) { R.mutAt = now; B.send({ t: 'mutiny', choice: 'pay' }); }
  // her hull, as she would watch it
  const ship = B.s.ship;
  if (ship) {
    const f = Math.floor((ship.hull / ship.stats.hullMax) * 10);
    if (R.hullTenth !== undefined && f < R.hullTenth && f <= 6) B.note('hull', `${Math.round(ship.hull)}/${ship.stats.hullMax} crew ${ship.crew} — ${near(B, 1500).filter((o) => o.hostile).map((o) => `${o.name}⚓${o.lvl}${o.role ? '/' + o.role : ''}@${o.d}`).join(', ')}`);
    R.hullTenth = f;
  }
}

/** A plain captain's turn: shoot what it kills most of, else strike it, else close on the nearest foe. */
export function tacMove(v) {
  const me = v.stacks.find((x) => x.id === v.active);
  const foes = v.stacks.filter((x) => x.side !== v.you && x.count > 0);
  const pv = v.pv ?? [];
  const best = (list) => list.sort((a, b) => (b.kills[0] + b.kills[1]) - (a.kills[0] + a.kills[1]) || (b.dmg[0] + b.dmg[1]) - (a.dmg[0] + a.dmg[1]))[0];
  const shots = pv.filter((p) => p.shot);
  if (v.shoot?.length) return { a: 'shoot', target: shots.length ? best(shots).t : v.shoot[0] };
  const blows = pv.filter((p) => !p.shot);
  if (v.melee?.length && blows.length) { const b = best(blows); return { a: 'attack', target: b.t, ...(b.from !== undefined ? { from: b.from } : {}) }; }
  if (v.melee?.length) return { a: 'attack', target: v.melee[0] };
  if (!me || !foes.length || !v.reach?.length) return { a: 'defend' };
  if (me.shotsMax > 0 && me.shots > 0) return { a: 'defend' };
  const dist = (hx) => Math.min(...foes.map((f) => hexDist(hx, f.hex)));
  const step = v.reach.slice().sort((a, b) => dist(a) - dist(b))[0];
  return dist(step) < dist(me.hex) ? { a: 'move', to: step } : { a: 'defend' };
}

// ---------------------------------------------------------------- passages
/** The water nearest a point: out along a widening ring until deep enough and clear of land by `margin`. */
export function waterNear(B, x, y, margin = 120) {
  const w = B.game.world;
  for (let r = 0; r <= 3000; r += 60) {
    const n = Math.max(1, Math.round((2 * Math.PI * r) / 60));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.sin(a) * r, py = y - Math.cos(a) * r;
      if (depthAt(w, px, py) < 5 || isLand(w, px, py)) continue;
      let clear = true;
      for (let j = 0; j < 8 && clear; j++) {
        const b = (j / 8) * Math.PI * 2;
        if (isLand(w, px + Math.sin(b) * margin, py - Math.cos(b) * margin)) clear = false;
      }
      if (clear) return [px, py];
    }
  }
  return [x, y];
}

/** A passage jumped: she is set down near (x, y); the time it would have taken (straight line × 1.3 for the beats and
 *  headlands, at 0.55 of her best way) is paid in provisions and wages and moved on the clock; the route is logged.
 *  Every 8 km of it the sea is sampled for 20 s where she passes (what lies in wait on a passage). */
export async function tp(B, x, y, why = '') {
  const s = B.s, ship = s.ship, p = s.profile;
  if (ship.docked) { B.send({ t: 'undock' }); await B.run(1); }
  const [x0, y0] = [ship.state.x, ship.state.y];
  const D = Math.hypot(x - x0, y - y0);
  // (her way is carried across the world SPEED_SCALE times as fast as the knots of her stats)
  const v = Math.max(6, ship.stats.maxSpeed * SPEED_SCALE * 0.55);
  const T = (D * 1.3) / v;
  const legs = Math.floor(D / 8000);
  const from = `${Math.round(x0)},${Math.round(y0)} sq⚓${sectorAt(B.game.world, x0, y0).level}`;
  // the sea along the way
  for (let i = 1; i <= legs; i++) {
    const [wx, wy] = waterNear(B, x0 + ((x - x0) * i) / (legs + 1), y0 + ((y - y0) * i) / (legs + 1), 300);
    place(B, wx, wy);
    const hit = await B.run(20, () => B.tac || B.boarding || ship.hull < ship.stats.hullMax * 0.98 || B.sunk);
    if (hit) {
      B.note('bot', `waylaid on the passage at ${Math.round(wx)},${Math.round(wy)} (sq⚓${sectorAt(B.game.world, wx, wy).level})`);
      const r = await defend(B);
      if (B.sunk) return { sunk: true };
      if (r === 'run') break;
    }
  }
  const [tx, ty] = waterNear(B, x, y, 150);
  place(B, tx, ty);
  // the days of it: provisions eaten, wages owed, the clock
  const eat = provisionsPerMinute(ship.crew, ship.stats.provisionUse) * (T / 60);
  const had = ship.cargo.provisions ?? 0;
  ship.cargo.provisions = Math.max(0, had - eat);
  if (!ship.cargo.provisions) delete ship.cargo.provisions;
  const c = p.company;
  if (c) c.owed += ((wagesPerHour(c) * wageMul(ship)) * T) / 3600;
  B.skip(T);
  B.book.travelKm += D / 1000;
  B.book.tpLegs++;
  B.note('route', `${why}: ${from} → ${Math.round(tx)},${Math.round(ty)} sq⚓${sectorAt(B.game.world, tx, ty).level} (${regionAt(B.game.world, tx, ty)}) ${(D / 1000).toFixed(1)} km straight, ~${Math.round(T / 60)} min at ${v.toFixed(1)} m/s; provisions ${had.toFixed(1)} → ${(ship.cargo.provisions ?? 0).toFixed(1)}${had < eat ? ' — RAN OUT' : ''}`);
  await B.run(2);
  return { km: Math.round(D / 100) / 10, min: Math.round(T / 60) };
}

function place(B, x, y) {
  const ship = B.s.ship;
  ship.state = { ...ship.state, x, y, speed: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  B.game.grid.upsert(ship.id, x, y);
  ship.region = regionAt(B.game.world, x, y);
}

/** Something on her: fight what fights her (her level or one above, a raider), else run to the nearest harbour. */
export async function defend(B) {
  const ship = B.s.ship;
  for (let k = 0; k < 6 && !B.sunk; k++) {
    if (B.tac || B.boarding) { await B.run(30, () => !B.tac && !B.boarding); continue; }
    const foes = near(B, 1500).filter((o) => o.hostile && !o.sinking && !o.struck);
    if (!foes.length) return 'clear';
    const f = foes[0];
    if (ship.hull < ship.stats.hullMax * 0.4 || (f.lvl ?? 0) > ship.shipLevel + 1) {
      B.note('bot', `running from ${f.name} ⚓${f.lvl}/${f.role} at ${f.d} m, hull ${Math.round(ship.hull)}`);
      return 'run';
    }
    await fight(B, f.id, f.role === 'beast' ? 'guns' : 'board');
  }
  return 'done';
}

/** At a mark: attack, the helmsman runs her in, the guns or the grapples; until she is gone or struck or settled. */
export async function fight(B, id, mode = 'board', maxSec = 300) {
  const xp0 = B.s.profile.level * 1e7 + B.s.profile.xp, s0 = B.s.profile.gold;
  B.send({ t: 'attack', target: id, mode });
  const t0 = B.game.now;
  let out = 'timeout', slips = 0, lastSlip = null;
  while (B.game.now - t0 < maxSec && !B.stop) {
    await B.run(1);
    if (B.sunk) { out = 'SUNK'; break; }
    if (B.tac || B.boarding) continue;
    const o = B.game.ships.get(id);
    if (!o || !o.alive || o.sinkingUntil) { out = 'sunk her'; break; }
    if (o.surrendered) { await B.run(3); out = 'struck'; break; }
    const ship = B.s.ship;
    if (ship.hull < ship.stats.hullMax * 0.3 || ship.crew < ship.stats.crewMax * 0.4) { B.send({ t: 'attack', stop: true }); out = 'broke off'; break; }
    if (B.pursuit && !B.pursuit.on && B.pursuit.why === 'slipped' && B.pursuit !== lastSlip) { lastSlip = B.pursuit; if (++slips >= 3) { out = 'she slipped away'; break; } }
    if (!B.pursuit?.on && B.game.now - t0 > 5) B.send({ t: 'attack', target: id, mode: 'guns' });
  }
  if (out === 'timeout') B.send({ t: 'attack', stop: true });
  await B.run(2, () => !B.tac && !B.boarding);
  const p = B.s.profile;
  B.note('fight', `${out} in ${Math.round(B.game.now - t0)} s; xp ${p.level * 1e7 + p.xp - xp0 > 1e6 ? 'level!' : p.level * 1e7 + p.xp - xp0}, silver ${p.gold - s0}, hull ${Math.round(B.s.ship.hull)}/${B.s.ship.stats.hullMax}, crew ${B.s.ship.crew}`);
  return out;
}

/** Into a harbour: set down off it, run in, and make fast. */
export async function dock(B, a) {
  const pt = B.game.world.ports.find((q) => q.id === a.port || q.name === a.port);
  if (!pt) return 'no such port';
  if (B.s.ship.docked === pt.id) return 'here';
  const is = B.game.world.islands[pt.islandId];
  const dd = Math.hypot(pt.x - is.x, pt.y - is.y) || 1;
  const r = await tp(B, pt.x + ((pt.x - is.x) / dd) * 200, pt.y + ((pt.y - is.y) / dd) * 200, a.why ?? `to ${pt.name}`);
  if (r.sunk) return r;
  for (let i = 0; i < 10 && B.s.ship.docked !== pt.id; i++) {
    B.send({ t: 'dock' });
    await B.run(2);
    if (B.s.ship.docked) break;
    B.send({ t: 'autosail', x: pt.x, y: pt.y });
    await B.run(10);
  }
  return { ...r, docked: B.s.ship.docked };
}

/** In port: the yard, the tavern to her hammocks, round shot and stores. */
export async function refit(B, a = {}) {
  const ship = B.s.ship, out = [];
  if (!ship.docked) return 'not in port';
  if (ship.hull < ship.stats.hullMax) { B.send({ t: 'repair', on: true }); out.push('repair'); }
  // hands: a third of the room for marines and a fifth for gunners (the boarding and the landing parties), the rest sailors
  if (ship.crew < ship.stats.crewMax && a.hire !== '0') {
    const room = Math.min(Number(a.hire ?? 99), ship.stats.crewMax - ship.crew);
    const want = [['marine', Math.floor(room / 3)], ['gunner', Math.floor(room / 5)]];
    for (const [prof, n] of want) if (n > 0 && B.s.profile.gold > 1500) { B.send({ t: 'hire_crew', qty: n, prof }); await B.run(0.1); }
    // as many as six tenths of her silver buys (the tavern refuses a whole lot she cannot pay; with an empty chest the
    // volunteers for a share come anyway)
    const per = B.port?.crewHireCost ?? 45;
    const left = Math.min(ship.stats.crewMax - ship.crew, Math.max(B.s.profile.gold < per ? 99 : 0, Math.floor((B.s.profile.gold * 0.6) / per)));
    if (left > 0) B.send({ t: 'hire_crew', qty: left });
    out.push(`hire to ${ship.crew}`);
  }
  const round = Number(a.round ?? 60) - (ship.ammo.round ?? 0);
  if (round > 0) { B.send({ t: 'buy_ammo', ammo: 'round', qty: round }); out.push(`round ${round}`); }
  const food = Number(a.food ?? 15) - (ship.cargo.provisions ?? 0);
  // (what fits: the market refuses the whole lot when it does not)
  for (let k = Math.ceil(food); k > 0; k = k > 4 ? Math.ceil(k * 0.7) - 1 : k - 1) {
    const had = ship.cargo.provisions ?? 0;
    B.send({ t: 'trade', good: 'provisions', qty: k });
    await B.run(0.1);
    if ((ship.cargo.provisions ?? 0) > had) { out.push(`food ${k}`); break; }
  }
  await B.run(1);
  return { out, silver: B.s.profile.gold, hull: Math.round(ship.hull), crew: ship.crew, round: ship.ammo.round, food: ship.cargo.provisions };
}

/** Speed check: the helmsman on a mark for `sec` world seconds; the way made good. */
export async function speedTest(B, a) {
  const ship = B.s.ship;
  if (ship.docked) { B.send({ t: 'undock' }); await B.run(2); }
  const [x0, y0] = [ship.state.x, ship.state.y];
  B.send({ t: 'autosail', x: Number(a.x), y: Number(a.y) });
  await B.run(Number(a.sec ?? 120));
  const d = Math.hypot(ship.state.x - x0, ship.state.y - y0);
  return { made: Math.round(d), perSec: Math.round((d / Number(a.sec ?? 120)) * 100) / 100, maxSpeed: ship.stats.maxSpeed };
}

/** The port's board as she reads it: jobs (with what bars her), contracts. */
export function board(B) {
  const v = B.port;
  if (!v) return 'no port';
  return {
    port: v.portId, sq: (() => { const pt = B.game.portById(v.portId); return sectorAt(B.game.world, pt.x, pt.y).level; })(),
    jobs: v.questOffers.map((q) => `${q.blocked ? '✗ ' + q.blocked + ' ' : ''}${q.id} | ${q.name} | ${q.category ?? q.kind}${q.ship ? ' ⚓' + q.ship : ''} | ${q.silver}s ${q.xp}xp | ${q.steps.join(' / ')}`),
    contracts: v.contracts.map((c) => `${c.id} ${c.kind} | ${c.title ?? c.description.slice(0, 50)} | ${c.reward}s ${c.xp}xp${c.toPort ? ' → ' + c.toPort : ''}`),
    yard: v.shipyard ? { repair: v.shipyard.repairCost, refit: v.shipyard.refit?.next ? `⚓${v.shipyard.refit.next.to} ${v.shipyard.refit.next.silver}s ${JSON.stringify(v.shipyard.refit.next.goods)} ${v.shipyard.refit.blocked ?? ''}` : null, ships: v.shipyard.ships.map((x) => `${x.classId} ${x.price}`) } : null,
    hire: v.crewHireCost,
  };
}

/** A party ashore where she lies (a quest's island): heave to, the boats away, until they are back. */
export async function land(B) {
  const ship = B.s.ship;
  ship.input = { rudder: 0, sailTarget: 0 };
  await B.run(4, () => ship.state.speed < 1);
  const at = B.log.length;
  B.send({ t: 'land' });
  await B.run(1);
  if (!ship.landing) return { landed: false, said: B.log.slice(at).map((l) => l.msg) };
  await B.run(240, () => !ship.landing || B.tac || B.views.trek?.view);
  if (B.views.trek?.view) { B.note('bot', 'a trek opened'); }
  return { landed: true, said: B.log.slice(at).filter((l) => l.kind !== 'route').map((l) => (typeof l.msg === 'string' ? l.msg : JSON.stringify(l.msg))).slice(0, 8) };
}

/** A lair ashore by id or by island: set down off it, the party lands, fought out turn by turn (the reflexes). */
export async function lair(B, a) {
  const list = B.views.lairs?.view?.list ?? [];
  const me = B.s.ship;
  const l = a.id ? list.find((x) => x.id === a.id) : list.filter((x) => (a.island === undefined || x.island === Number(a.island)) && !x.down && (a.island !== undefined || x.level <= me.shipLevel + 1)).sort((u, v) => Math.hypot(u.x - me.state.x, u.y - me.state.y) - Math.hypot(v.x - me.state.x, v.y - me.state.y))[0];
  if (!l) return 'no lair';
  B.note('bot', `lair ${l.id} ${l.kind} ⚓${l.level} men ${l.men}`);
  const r = Math.hypot(l.x - me.state.x, l.y - me.state.y) > 400 ? await tp(B, l.x, l.y, `to the ${l.kind} lair`) : {};
  if (r.sunk) return r;
  const xp0 = B.s.profile.xp, g0 = B.s.profile.gold, crew0 = me.crew;
  // the lair's card, as she reads it before the boats go: her party's might against theirs
  await B.run(2);
  const card = B.views.lair_card?.card;
  if (me.crew < me.stats.crewMax * 0.5) return { lair: l.id, skipped: 'too few hands' };
  if (!card || card.id !== l.id || card.ratio < Number(a.ratio ?? 1.3)) {
    B.note('bot', `lair ${l.id}: the odds are poor (${card ? card.ratio.toFixed(2) : 'no card'}): left alone`);
    return { lair: l.id, skipped: `ratio ${card?.ratio?.toFixed(2) ?? '?'}` };
  }
  for (let i = 0; i < 5 && !B.tac; i++) {
    B.send({ t: 'lair', action: 'fight', id: l.id });
    await B.run(i === 0 ? 2 : 15, () => !!B.tac);
  }
  if (!B.tac) return { ...r, fight: 'did not start', heard: B.log.slice(-5).map((x) => x.msg) };
  const t0 = B.game.now;
  await B.run(900, () => !B.tac || B.tac.over);
  const over = B.tac?.over;
  await B.run(4, () => !B.tac);
  return { lair: l.id, won: over ? over.winner === 0 : null, why: over?.why, sec: Math.round(B.game.now - t0), xp: B.s.profile.xp - xp0, silver: B.s.profile.gold - g0, men: me.crew - crew0 };
}

/** One step of a quest as its journal reads: the place it points to and what is done there. */
export async function qstep(B, a) {
  const q = (B.self?.quests ?? []).find((x) => x.id === a.id);
  if (!q) return 'no such quest';
  const t = q.target;
  B.note('bot', `quest ${q.name}: ${q.text}`);
  if (/^Beat the /.test(q.text) && t?.island !== undefined) {
    const r = await tp(B, t.x, t.y, `${q.name}: ${q.text}`);
    if (r.sunk) return r;
    await B.run(3);
    return lair(B, { island: t.island });
  }
  if (t?.port) return dock(B, { port: t.port, why: `${q.name}: ${q.text}` });
  if (t?.act === 'land') {
    const r = await tp(B, t.x, t.y, `${q.name}: ${q.text}`);
    if (r.sunk) return r;
    return land(B);
  }
  if (t) {
    const r = await tp(B, t.x, t.y, `${q.name}: ${q.text}`);
    await B.run(20);
    return r;
  }
  return `no mark: ${q.text}`;
}

// ---------------------------------------------------------------- the round of a working captain
const SIGHT = 2200;
const isRaider = (o) => o.role === 'pirate' || o.role === 'hunter' || o.role === 'raider' || o.role === 'nemesis';

/** Sell what is not hers to keep: the spoils of the sea (not the yard's materials, not a quest's goods, not stores). */
export async function sellLoot(B, a = {}) {
  const ship = B.s.ship;
  if (!ship.docked) return 'not in port';
  const keep = new Set(['provisions', 'planks', 'iron', 'sailcloth', ...(a.keep ?? '').split(',')]);
  for (const q of B.self?.quests ?? []) for (const t of q.stepTexts ?? []) for (const m of t.matchAll(/(\w[\w ]*?) × \d+/g)) keep.add(m[1].toLowerCase().replace(/ /g, '_'));
  const sold = [];
  for (const [g, n] of Object.entries(ship.cargo)) {
    if (keep.has(g) || n < 1) continue;
    const g0 = B.s.profile.gold;
    B.send({ t: 'trade', good: g, qty: -Math.floor(n) });
    await B.run(0.1);
    if (B.s.profile.gold > g0) sold.push(`${g}×${Math.floor(n)} +${B.s.profile.gold - g0}`);
  }
  return sold;
}

/** Sharks or pirates for a quest or a bounty: about her first, then a few legs through the waters it names. */
export async function hunt(B, a) {
  const want = a.what ?? 'pirate'; // 'pirate' | 'shark' | 'beast'
  const n = Number(a.n ?? 1);
  const ship = B.s.ship;
  let got = 0, legs = 0;
  const out = [], skipIds = new Set();
  while (got < n && legs <= Number(a.legs ?? 4) && !B.stop && !B.sunk) {
    if (ship.crew < ship.stats.crewMax * 0.5 || ship.hull < ship.stats.hullMax * 0.6) { out.push('unfit: home'); break; }
    // the sea about her for a minute, under way: what shows within sight
    if (ship.docked) { B.send({ t: 'undock' }); await B.run(1); }
    if (ship.state.speed < 1.5 && !B.autosail?.on) {
      const h = ship.state.heading + (Math.random() - 0.5);
      B.send({ t: 'autosail', x: Math.round(ship.state.x + Math.sin(h) * 4000), y: Math.round(ship.state.y - Math.cos(h) * 4000) });
    }
    let mark = null;
    await B.run(Number(a.wait ?? 40), () => {
      mark = near(B, SIGHT).find((o) => !o.sinking && !o.struck && !o.guard && !skipIds.has(o.id) && (want === 'pirate' ? isRaider(o) && o.lvl <= ship.shipLevel + (a.brave ? 1 : 0) && o.lvl >= ship.shipLevel - 1 : o.role === 'beast' && (want === 'beast' || /shark/i.test(o.cls))));
      return !!mark || !!B.tac;
    });
    if (B.tac) { await B.run(600, () => !B.tac); continue; }
    if (mark) {
      B.note('bot', `hunt: ${mark.name} ⚓${mark.lvl} ${mark.cls} at ${mark.d} m`);
      // her guns sink her; the grapples only with a full crew in good heart (a half-manned deck is thrown back)
      const fullCrew = ship.crew >= ship.stats.crewMax * 0.9 && ship.morale >= 50;
      const r = await fight(B, mark.id, want === 'pirate' && fullCrew && a.board ? 'board' : 'guns');
      out.push(`${mark.name}⚓${mark.lvl}: ${r}`);
      if (r === 'timeout' || r === 'she slipped away') skipIds.add(mark.id);
      if (r === 'sunk her' || r === 'struck') got++;
      if (ship.hull < ship.stats.hullMax * 0.45) { out.push('hurt: home'); break; }
      continue;
    }
    // nothing in sight: a leg on through the waters — into a square no more than a level above her ship (she sees the
    // squares' levels on her chart)
    legs++;
    const d = Number(a.leg ?? 5000);
    const cx = a.x ? Number(a.x) : ship.state.x, cy = a.y ? Number(a.y) : ship.state.y;
    let to = null;
    for (let k = 0; k < 16 && !to; k++) {
      const ang = Math.random() * Math.PI * 2;
      const px = cx + Math.sin(ang) * d, py = cy - Math.cos(ang) * d;
      if (px < 2000 || py < 2000 || px > 94000 || py > 94000) continue;
      if (sectorAt(B.game.world, px, py).level <= ship.shipLevel + 1 && depthAt(B.game.world, px, py) > 5) to = [px, py];
    }
    if (!to) break;
    const r = await tp(B, to[0], to[1], `hunting ${want}`);
    if (r.sunk) break;
    // under way while she looks (the sea's small life shows to a ship that sails, not to one lying to)
    const ang2 = Math.random() * Math.PI * 2;
    B.send({ t: 'autosail', x: Math.round(ship.state.x + Math.sin(ang2) * 4000), y: Math.round(ship.state.y - Math.cos(ang2) * 4000) });
  }
  return { got, legs, out };
}

/** The jobs on this board she can do now (no goods to buy, nothing above her), the best paid first. */
function doable(B, q) {
  if (q.blocked || q.category === 'elite' || q.group) return false;
  const st = q.steps.join(' / ');
  if (/Deliver|Bring|Take on|Take whales|Take fish|customs|Send divers|contraband|Chart islands|Sail into|Fish letters|tribute|Land a fish|Keep the sea|wanted captains|named pirate/i.test(st)) return false;
  if (q.ship && q.ship > B.s.ship.shipLevel + 1) return false;
  return /Land a party|Beat the|Beat lairs|Kill sharks|Sink pirate ships|Take ships by boarding|Reach |Return to/i.test(st);
}

/** In port: take what is worth taking (jobs she can do, letters, bounties), up to the limits. */
export async function takeWork(B) {
  const v = B.port, took = [];
  if (!v) return took;
  const active = () => (B.self?.quests ?? []).length;
  for (const q of v.questOffers.filter((x) => doable(B, x)).sort((a, b) => b.xp - a.xp)) {
    if (active() >= 5) break;
    B.send({ t: 'quest', action: 'accept', id: q.id });
    await B.run(0.1);
    took.push(`${q.name} (${q.xp}xp ${q.silver}s)`);
  }
  for (const c of v.contracts.filter((x) => x.kind === 'courier' || x.kind === 'bounty').sort((a, b) => b.xp - a.xp)) {
    if ((B.s.profile.contracts ?? []).length >= 3) break;
    B.send({ t: 'contract', action: 'accept', id: c.id });
    await B.run(0.1);
    took.push(`contract ${c.title ?? c.kind} (${c.xp}xp ${c.reward}s)`);
  }
  return took;
}

/** What is to be done next, nearest first: each quest's step and each letter's port. */
function nextJobs(B) {
  const me = B.s.ship.state, out = [];
  for (const q of B.self?.quests ?? []) {
    const t = q.target;
    const d = t ? Math.hypot(t.x - me.x, t.y - me.y) : 0;
    let how = null;
    if (/^Return to|^Reach /.test(q.text) && t?.port) how = 'dock';
    else if (t?.port) how = 'dock';
    else if (/^Beat lairs/.test(q.text)) how = 'cull';
    else if (/^Beat the |^Land a party|^Then land a party/.test(q.text) && t) how = 'step';
    else if (/^Kill sharks/.test(q.text)) how = 'sharks';
    else if (/^Sink pirate ships/.test(q.text)) how = 'pirates';
    else if (/^Take ships by boarding/.test(q.text)) how = 'prize';
    else if (/^Keep the sea/.test(q.text)) how = 'keep';
    if (how) out.push({ id: q.id, name: q.name, text: q.text, how, d, need: q.need - q.progress, t });
  }
  for (const c of B.self?.contracts ?? []) {
    if (c.kind !== 'courier' || !c.toPort) continue;
    const pt = B.game.portById(c.toPort);
    if (pt) out.push({ id: c.id, name: c.title, text: c.title, how: 'letters', d: Math.hypot(pt.x - me.x, pt.y - me.y), port: c.toPort });
  }
  return out.sort((a, b) => (/^Reach /.test(b.text) ? 1 : 0) - (/^Reach /.test(a.text) ? 1 : 0) || a.d - b.d);
}

/** Rounds of a working captain: take work in port, do the nearest thing, come in for her pay and her stores. */
export async function auto(B, a = {}) {
  const ship = B.s.ship, log = [], skip = new Map();
  const boards = (globalThis.__boards ??= []);
  const noDock = (globalThis.__noDock ??= new Set());
  const rounds = Number(a.rounds ?? 10);
  const lv0 = B.s.profile.level;
  for (let i = 0; i < rounds && !B.stop; i++) {
    if (B.sunk) { log.push('SUNK'); B.sunk = null; await B.run(5); }
    if (ship.docked) {
      // shaken nerves mend ashore (a tavern, a chapel, solid ground): a while in port before she sails again
      if (ship.sanity < 60) { const s0 = ship.sanity; await B.run(1800, () => ship.sanity >= 85); log.push(`ashore: sanity ${Math.round(s0)} → ${Math.round(ship.sanity)}`); }
      await sellLoot(B);
      const up = await upgrade(B);
      if (up?.to) log.push(`new hull: ${JSON.stringify(up)}`);
      await refit(B, { food: a.food ?? 18 });
      const took = await takeWork(B);
      if (took.length) log.push(`took: ${took.join('; ')}`);
    }
    const jobs = nextJobs(B).filter((x) => (skip.get(x.id) ?? 0) < 2);
    if (!jobs.length) {
      // nothing to do here: the next harbour's board (the nearest she has not just left, in waters she can sail)
      const me = ship.state;
      const pt = B.game.world.ports.filter((q) => q.id !== ship.docked && !boards.includes(q.id) && !q.raft && sectorAt(B.game.world, q.x, q.y).level <= ship.shipLevel + 1)
        .sort((u, v) => Math.hypot(u.x - me.x, u.y - me.y) - Math.hypot(v.x - me.x, v.y - me.y))[0];
      if (!pt) { log.push('no work anywhere'); break; }
      if (ship.docked) boards.push(ship.docked);
      if (boards.length > 12) boards.shift();
      const r = await dock(B, { port: pt.id, why: 'for work' });
      log.push(`to ${pt.name} for work: ${JSON.stringify(r).slice(0, 60)}`);
      continue;
    }
    const j = jobs[0];
    let r;
    if ((ship.hull < ship.stats.hullMax * 0.5 || (ship.crew < ship.stats.crewMax * 0.7 && B.s.profile.gold >= 400) || ship.crew < ship.stats.crewMax * 0.4) && !ship.docked) {
      // the nearest yard with hands in its tavern when she is short of men (an empty tavern sends her on)
      const short = ship.crew < ship.stats.crewMax * 0.6;
      const pt = B.game.world.ports.filter((q) => !q.raft && !noDock.has(q.id) && (!short || (B.game.tavernCrew.get(q.id) ?? 0) >= 10)).sort((u, v) => Math.hypot(u.x - ship.state.x, u.y - ship.state.y) - Math.hypot(v.x - ship.state.x, v.y - ship.state.y))[0];
      r = await dock(B, { port: pt.id, why: 'hurt: the nearest yard' });
      if (!ship.docked) { noDock.add(pt.id); log.push(`${pt.name} would not have her: ${B.log.slice(-4).map((l) => l.msg).join(' | ').slice(0, 160)}`); }
      log.push(`hurt → ${pt.name}`);
      continue;
    }
    switch (j.how) {
      case 'dock': r = await dock(B, { port: j.t.port, why: `${j.name}: ${j.text}` }); break;
      case 'letters': r = await dock(B, { port: j.port, why: j.text }); break;
      case 'step': r = await qstep(B, { id: j.id }); if (B.tac) await B.run(900, () => !B.tac); break;
      case 'cull': if (j.t) await tp(B, j.t.x, j.t.y, `${j.name}: a lair`); r = await lair(B, {}); break;
      case 'sharks': r = await hunt(B, { what: 'shark', n: j.need, ...(j.t ? { x: j.t.x, y: j.t.y } : {}) }); break;
      case 'pirates':
        if (ship.crew < ship.stats.crewMax * 0.55 || ship.hull < ship.stats.hullMax * 0.8) { r = 'not fit for a hunt'; break; }
        r = await hunt(B, { what: 'pirate', n: j.need, ...(j.t ? { x: j.t.x, y: j.t.y } : {}) }); break;
      case 'keep': r = await hunt(B, { what: 'pirate', n: 99, legs: 2, wait: 120, ...(j.t ? { x: j.t.x, y: j.t.y } : {}) }); break;
      case 'prize':
        if (ship.crew < ship.stats.crewMax * 0.85 || ship.morale < 50) { r = 'not fit to board'; break; }
        r = await hunt(B, { what: 'pirate', n: j.need, board: 1 }); break;
    }
    log.push(`${j.how} «${j.name}»: ${JSON.stringify(r)?.slice(0, 160)}`);
    // a job that came to nothing twice is left for later (poor odds ashore, no sharks in sight)
    if (!r || typeof r === 'string' || r.skipped || r.fight || r.landed === false || (r.got === 0 && r.legs !== undefined)) {
      skip.set(j.id, (skip.get(j.id) ?? 0) + 1);
      // twice for nothing: set aside, its slot for work she can do (a player drops what she cannot finish)
      if (skip.get(j.id) >= 2 && j.how !== 'letters') { B.send({ t: 'quest', action: 'abandon', id: j.id }); await B.run(0.1); log.push(`set aside «${j.name}»`); }
    }
    if (Number(a.toLevel) && B.s.profile.level >= Number(a.toLevel)) break;
  }
  return { from: lv0, to: B.s.profile.level, xp: B.s.profile.xp, silver: B.s.profile.gold, log };
}

/** A better hull at this yard when hers is below her own ⚓ and the price (less her trade-in) leaves a reserve. */
export async function upgrade(B, a = {}) {
  const v = B.port, ship = B.s.ship, p = B.s.profile;
  if (!v?.shipyard) return 'no yard';
  const { levelRange, captainLevelFor } = await import('../../../shared/src/data/shiplevel.ts');
  let own = 1;
  for (let l = 1; l <= 10; l++) if (captainLevelFor(l) <= p.level) own = l;
  if (ship.shipLevel >= own) return `her ⚓${ship.shipLevel} is her own`;
  const reserve = Number(a.reserve ?? 1200);
  const opts = v.shipyard.ships.map((x) => ({ ...x, lo: levelRange(x.classId)[0], net: x.price - (x.tradeIn ?? 0) }))
    .filter((x) => x.lo > ship.shipLevel && x.lo <= own && x.net <= p.gold - reserve).sort((u, w) => w.lo - u.lo || u.net - w.net);
  if (!opts.length) return { own, cur: ship.shipLevel, gold: p.gold, cheapest: v.shipyard.ships.map((x) => ({ c: x.classId, lo: levelRange(x.classId)[0], net: x.price - (x.tradeIn ?? 0) })).filter((x) => x.lo > ship.shipLevel && x.lo <= own).sort((u, w) => u.net - w.net)[0] };
  const pick = opts[0];
  const g0 = p.gold, c0 = ship.loadout.classId;
  B.send({ t: 'shipyard', action: 'buy_ship', classId: pick.classId });
  await B.run(1);
  return { from: c0, to: ship.loadout.classId, level: ship.shipLevel, paid: g0 - p.gold, heard: B.log.slice(-3).map((l) => l.msg) };
}

/** Her boarding battle (hers as the grappler, or the one who grappled her), her side handed to the battle's mind. */
function boardBattle(B) {
  const b = B.s.ship.boarding;
  if (!b) return false;
  const att = b.attacker ? B.s.ship : B.game.ships.get(b.with);
  const bt = att?.boarding?.fight?.tac;
  if (!bt) return false;
  for (const h of bt.heroes) if (h.input.human && h.input.name === B.s.name) h.auto = true;
  return true;
}
