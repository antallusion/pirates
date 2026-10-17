// Quests near their port (owner, 2026-10-18: «у меня квест начальный выловить косяк рыб — я нажал автоплавание и мне
// показало 12км, это бред. все что берется в портах, должно делаться недалеко от них, в районе 1,5км максимум. добавь
// косяки рыб побольше и все завяжи рядышком, за исключением каких-то элитных квестов где надо побольше поплавать»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { routeFor } from '../server/src/game/goalroute.ts';
import { PORT_SHOAL_R, shoalsOf, stepFishing } from '../server/src/game/fishing.ts';
import { acceptQuest } from '../server/src/game/quests.ts';
import { buildPortView } from '../server/src/game/ports.ts';
import { LOCAL_R, anywhereStep, callLeaderIn, farVoyage, localQuarry, localTick, questHome, questOrigin, stepFar } from '../server/src/game/questlocal.ts';
import { spawnPackLeader } from '../server/src/game/npc.ts';
import { join, makeGame, onHull } from './helpers.ts';

function captain(game: Game, name: string, port: string, level = 6): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  p.gold = 1000;
  p.level = level;
  if (p.tutorial) p.tutorial.on = false;
  onHull(game, s.ship!, 'brig', 2);
  runAdmin(game, s, `/tp ${port}`);
  s.ship!.protectedUntil = 0;
  return s;
}

/** Docked at a port (as when she takes a quest there). */
function dock(game: Game, s: PlayerSession, port: string): void {
  const pt = game.portById(port)!;
  s.ship!.docked = pt.id;
  s.ship!.state = { ...s.ship!.state, x: pt.x, y: pt.y, speed: 0 };
  game.grid.upsert(s.ship!.id, pt.x, pt.y);
}

const view = (r: ReturnType<typeof routeFor>) => {
  assert.ok(!('done' in r) && !('none' in r), `a place: ${JSON.stringify(r)}`);
  return r as Exclude<typeof r, { done: true } | { none: string }>;
};

function give(game: Game, s: PlayerSession, id: string, port: string, step: QuestDef['steps'][number]): void {
  QUESTS_BY_ID[id] = { id, kind: 'job', name: `Test ${id}`, mentor: 'Tester', port, summary: '', requires: { level: 1 }, steps: [step], reward: { xp: 1, silver: 1 } };
  s.profile!.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now });
}

test('the starter fishing quest («Сети Мики»): «Плыть» goes to a harbour shoal within 1.5 km — not 12 km off', () => {
  const { game } = makeGame();
  const s = captain(game, 'Mika Friend', 'saltmarrow', 2);
  dock(game, s, 'saltmarrow');
  const port = game.portById('saltmarrow')!;
  assert.equal(acceptQuest(game, s, port, 'side_mika_1'), null);
  const v = view(routeFor(game, s, 'q:side_mika_1'));
  assert.equal(v.kind, 'shoal');
  assert.ok(Math.hypot(v.x - port.x, v.y - port.y) <= LOCAL_R, `the shoal ${Math.round(Math.hypot(v.x - port.x, v.y - port.y))} m off the port`);
  assert.ok(v.dist < 2000, `«Плыть» shows ${v.dist} m`);
  // a shoal with fish a plain net takes, and enough of it for the quest's thirty
  const sh = shoalsOf(game).find((x) => Math.hypot(x.x - v.x, x.y - v.y) < 300);
  assert.ok(sh && sh.stock >= 30, `a full shoal there (${v.name} at ${v.x}, ${v.y}; ${shoalsOf(game).filter((x) => Math.hypot(x.x - port.x, x.y - port.y) < 2000).map((x) => `${Math.round(x.x)},${Math.round(x.y)}`).join(' ')})`);
});

test('2–4 harbour shoals within 1.5 km of every port a captain lies near, kept up as they go', () => {
  const { game } = makeGame();
  const ports = game.world.ports.filter((p) => !p.raft).slice(0, 6);
  ports.forEach((p, i) => captain(game, `Shoal Watcher ${i}`, p.id));
  game.now = Math.ceil(game.now / 10) * 10; // the tick that keeps them
  stepFishing(game);
  for (const p of ports) {
    const near = shoalsOf(game).filter((x) => Math.hypot(x.x - p.x, x.y - p.y) <= PORT_SHOAL_R);
    assert.ok(near.length >= 2 && near.length <= 6, `${p.id}: ${near.length}`);
  }
  // fished out: another rises at the next keeping
  const p0 = ports[0];
  for (const x of shoalsOf(game)) if (Math.hypot(x.x - p0.x, x.y - p0.y) <= PORT_SHOAL_R) x.stock = 0;
  game.now += 10;
  stepFishing(game);
  assert.ok(shoalsOf(game).filter((x) => x.stock > 0 && Math.hypot(x.x - p0.x, x.y - p0.y) <= PORT_SHOAL_R).length >= 2);
});

test('a port job done anywhere — sink pirates, board, tribute, beasts — sends her within 1.5 km of the port: the quarry is put out there', () => {
  const { game } = makeGame();
  const s = captain(game, 'Near Nora', 'gravesend', 8);
  dock(game, s, 'gravesend');
  const port = game.portById('gravesend')!;
  const steps: QuestDef['steps'] = [
    { type: 'sink', count: 3, role: 'pirate', region: port.region, text: 'Sink pirates.' },
    { type: 'board', count: 1, text: 'Board one.' },
    { type: 'tribute', count: 1, text: 'Tribute.' },
    { type: 'beast', count: 2, group: 'shark', text: 'Sharks.' },
    { type: 'sink', count: 1, role: 'ghost', text: 'A ghost.' },
  ];
  steps.forEach((st, i) => {
    const id = `ql_${i}`;
    give(game, s, id, port.id, st);
    const v = view(routeFor(game, s, `q:${id}`));
    assert.equal(v.kind, 'ships', `${st.type}: a ship to make for`);
    const o = game.ships.get(v.ship!)!;
    assert.ok(Math.hypot(o.state.x - port.x, o.state.y - port.y) <= LOCAL_R, `${st.type}: ${Math.round(Math.hypot(o.state.x - port.x, o.state.y - port.y))} m off the port`);
    assert.ok(v.dist <= 2000, `${st.type}: «Плыть» ${v.dist} m`);
    if (st.type === 'sink' && st.role === 'pirate') assert.equal(o.npcRole, 'pirate');
    if (st.type === 'tribute') assert.equal(o.npcRole, 'merchant');
    if (st.type === 'beast') assert.equal(o.npcRole, 'beast');
    if (st.type === 'sink' && st.role === 'ghost') assert.equal(o.npcRole, 'ghost');
  });
  // the quarry stays on the sea about the port (no leg to be had off a harbour does not strike her off it)
  const ids = steps.map((_, i) => localQuarry(game, s, `ql_${i}`).map((o) => o.id)).flat();
  const roles = new Map(ids.map((id) => [id, game.ships.get(id)!.npcRole]));
  s.ship!.docked = null; // (a captain in port does not see the sea: the beasts about her harbour go)
  for (let k = 0; k < 100; k++) game.step();
  const still = ids.filter((id) => game.ships.get(id)?.alive);
  assert.equal(still.length, ids.length, `${still.length} of ${ids.length} still at sea: gone ${ids.filter((id) => !game.ships.get(id)?.alive).map((id) => roles.get(id)).join(',')} of ${ids.map((id) => game.ships.get(id)?.npcRole ?? '?').join(',')}`);
  // at sea about the port, the quarry keeps coming (two at a time at most)
  for (let k = 0; k < 400; k++) {
    game.tick++;
    game.now += 0.05;
    localTick(game, s);
  }
  const pirates = [...game.ships.values()].filter((o) => o.alive && o.npcRole === 'pirate' && Math.hypot(o.state.x - port.x, o.state.y - port.y) <= LOCAL_R);
  assert.ok(pirates.length >= 2, `pirates about the port: ${pirates.length}`);
});

test('every generated port job: its places within 1.5 km of the port, or its card says «Дальний рейс · N км»', () => {
  const { game } = makeGame();
  let near = 0, far = 0;
  for (const q of JOBS) {
    const at = questOrigin(game, q)!;
    const worst = Math.max(0, ...q.steps.map((st) => stepFar(game, at, st)));
    if (worst > LOCAL_R) {
      far++;
      assert.ok(farVoyage(game, q)! > LOCAL_R, `${q.id}: flagged far`);
    } else {
      near++;
      assert.equal(farVoyage(game, q), null, q.id);
    }
    // a step done anywhere is bound to the port (no far kind among the board's jobs but the elite)
    if (q.steps.some(anywhereStep) && q.category !== 'elite') assert.ok(questHome(game, q), q.id);
  }
  assert.ok(near > 4000, `near ${near}, far ${far}`);
  // the islands: the nearest that serve, within 1.5 km where the port has one (the old harbours of the first map have
  // none so near: the nearest then, and the card says how far) — the median landing of a home-sea job was 17 km
  const ds: number[] = [];
  for (const q of JOBS) {
    if (q.steps.some((st) => st.type === 'reach' || ((st.type === 'visit' || st.type === 'deliver' || st.type === 'pickup') && st.port !== q.port))) continue;
    const at = questOrigin(game, q)!;
    for (const st of q.steps) if (st.type === 'land') ds.push(stepFar(game, at, st));
  }
  ds.sort((a, b) => a - b);
  const med = ds[ds.length >> 1], p80 = ds[Math.floor(ds.length * 0.8)];
  assert.ok(med <= 3000 && p80 <= 6000, `landings: median ${Math.round(med)} m, 80% within ${Math.round(p80)} m`);
  // the card: the port's view carries «far» for a voyage, none for a near job
  const s = captain(game, 'Card Clara', 'gravesend', 10);
  dock(game, s, 'gravesend');
  const pv = buildPortView(game, s, game.portById('gravesend')!);
  assert.ok(pv.questOffers.length, 'the port view');
  for (const o of pv.questOffers) {
    const q = QUESTS_BY_ID[o.id];
    assert.equal(o.far ?? null, farVoyage(game, q), o.id);
  }
});

test('the board shows the jobs near the port first; the elite, the Admiralty and the campaign may sail far', () => {
  const { game } = makeGame();
  const elite = { id: 'el', kind: 'job', category: 'elite', port: 'gravesend', steps: [] } as unknown as QuestDef;
  assert.equal(questHome(game, elite), null);
  assert.equal(questHome(game, { ...elite, id: 'adm_x', category: undefined } as QuestDef), null);
  assert.equal(questHome(game, { ...elite, kind: 'campaign', category: undefined } as QuestDef), null);
  assert.ok(questHome(game, { ...elite, category: 'hunt' } as QuestDef));
});

test('migration: a hunt’s leader put out far off (a save from before) is called in about the port', () => {
  const { game } = makeGame();
  const s = captain(game, 'Leader Lena', 'gravesend', 10);
  const port = game.portById('gravesend')!;
  give(game, s, 'ql_lead', port.id, { type: 'sink', count: 3, role: 'pirate', region: port.region, text: 'Sink pirates.' });
  const qs = s.profile!.quests.active.at(-1)!;
  const old = spawnPackLeader(game, port.region, 10)!; // about the sea's heart, as before
  qs.leader = old.id;
  const far0 = Math.hypot(old.state.x - port.x, old.state.y - port.y);
  assert.ok(far0 > LOCAL_R, `put out ${Math.round(far0)} m off`);
  callLeaderIn(game, qs, questHome(game, QUESTS_BY_ID['ql_lead'])!);
  const d = Math.hypot(old.state.x - port.x, old.state.y - port.y);
  assert.ok(d <= LOCAL_R, `called in: ${Math.round(d)} m`);
  // and a new hunt's leader puts out about the port
  const lead = spawnPackLeader(game, port.region, 10, { x: port.x, y: port.y, r: LOCAL_R });
  if (lead) assert.ok(Math.hypot(lead.state.x - port.x, lead.state.y - port.y) <= LOCAL_R);
});
