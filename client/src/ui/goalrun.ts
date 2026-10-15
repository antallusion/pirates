// The course to a quest (ux2, owner 2026-10-11: «после взятия квеста должна быть метка куда плыть, нажатие на эту метку
// корабль начинает плавание до места. вообще нужно максимум автоматизировать все»).
//
// A goal is a place the captain was sent to by something she took — a quest's step (`q:<id>`), a contract of the port's
// board with a port to reach (`c:<id>`), a task of the sea (`t:<id>`). A tap on its beacon on the sea, on its arrow on
// the screen's edge or on «Плыть» in the journal starts a run: the helmsman takes her there (the server steers,
// autosail.ts), and the run then does what the place asks for where that is safe — puts in at a port for a delivery,
// a visit, a cargo to take aboard; lands the party on an island for a landing step — and, the step done, follows the
// quest's next step: after she casts off from that port the course to the next place is set by itself. A fight on the
// way breaks the course off and the server takes it up again once the sea is quiet (autosail.ts stepResume); her own
// hand on the wheel, another course, a stop on the pill end the run. Pure: main.ts asks `step()` what to do and does it.

import type { QuestTarget } from '../../../shared/src/protocol.ts';
import type { AutosailStop } from '../../../shared/src/data/autosail.ts';

/** A goal's place and what is done there. */
export interface GoalTarget extends QuestTarget {
  key: string;
  /** Server words (a quest's or a contract's name, a task's) for the toasts. */
  title: string;
  r: number;
}

interface GoalQuest { id: string; name: string; target?: QuestTarget }
interface GoalContract { id: string; title: string; toPort?: string }
interface GoalTask { id: number; kind: string; island: string; x: number; y: number; r: number; done: boolean }
/** What the goals are read from (the client's state, or a test's). */
export interface GoalState {
  self: { quests: GoalQuest[]; contracts?: GoalContract[] } | null;
  ports: { id: string; x: number; y: number }[];
  tasks: GoalTask[];
}

/** The place a goal's key names now, or null (done, set aside, or nowhere on the chart). */
export function goalTarget(state: GoalState, key: string): GoalTarget | null {
  const [kind, ...rest] = key.split(':');
  const id = rest.join(':');
  if (kind === 'q') {
    const q = state.self?.quests.find((x) => x.id === id);
    const t = q?.target;
    if (!q || !t) return null;
    return { ...t, key, title: q.name, r: t.r ?? 400 };
  }
  if (kind === 'c') {
    const c = state.self?.contracts?.find((x) => x.id === id);
    const p = c?.toPort ? state.ports.find((x) => x.id === c.toPort) : undefined;
    if (!c || !p) return null;
    return { key, title: c.title, x: p.x, y: p.y, r: 400, port: p.id, act: 'dock' };
  }
  if (kind === 't') {
    const t = state.tasks.find((x) => x.id === Number(id));
    if (!t || t.done) return null;
    return { key, title: t.kind, x: t.x, y: t.y, r: Math.max(120, t.r) };
  }
  return null;
}

/** Every goal with a place now, nearest first (the journal's default and the chart's list). */
export function goalsNear(state: GoalState, at: { x: number; y: number } | null): GoalTarget[] {
  const keys = [
    ...(state.self?.quests ?? []).map((q) => `q:${q.id}`),
    ...(state.self?.contracts ?? []).map((c) => `c:${c.id}`),
    ...state.tasks.map((t) => `t:${t.id}`),
  ];
  const out = keys.map((k) => goalTarget(state, k)).filter((g): g is GoalTarget => !!g);
  if (at) out.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
  return out;
}

/** What the run asks main.ts to do this moment. */
export type GoalStep =
  | { do: 'none' }
  | { do: 'sail'; x: number; y: number; near?: number }
  | { do: 'dock' }
  | { do: 'land' }
  | { do: 'arrived'; title: string }
  | { do: 'end'; why: 'done' | 'helm' | 'gone' };

/** What the run reads of the sea each moment. */
export interface GoalView {
  /** The client's clock, ms. */
  now: number;
  docked: string | null;
  own: { x: number; y: number } | null;
  region: string;
  /** The helmsman's mark while he has the wheel. */
  autosail: { x: number; y: number } | null;
  /** Why he last gave the wheel back, and when (the client's clock), if since the run began. */
  stop: { why: AutosailStop; at: number } | null;
  /** A landing in reach (the action bar's «Высадка»). */
  landable: boolean;
  target: GoalTarget | null;
}

/** An order to the helmsman is not given again sooner than this (ms). */
export const RESEND_MS = 4000;
/** A course broken off by a fight is left to the server this long before the run lets go. */
export const BROKEN_MS = 330_000;

/** The run to one goal, kept between frames. */
export class GoalRun {
  readonly key: string;
  private started: number;
  private sentAt = -1e9;
  private sentTo: { x: number; y: number } | null = null;
  /** Whether the last order was seen taken (the helmsman's course on) or refused. */
  private judged = true;
  private refused = 0;
  private dockAt = -1e9;
  private landedFor = '';
  private arrivedFor = '';
  private dockR: number;

  constructor(key: string, now: number, dockR = 420) {
    this.key = key;
    this.started = now;
    this.dockR = dockR;
  }

  /** Where the run last sent the helmsman (to tell its own course from another). */
  get course(): { x: number; y: number } | null {
    return this.sentTo;
  }

  step(v: GoalView): GoalStep {
    const t = v.target;
    if (!t) return { do: 'end', why: 'done' };
    const spot = `${t.x},${t.y}`;
    // In port: a step done by putting in here is the server's (the next one shows); she sails on when she casts off.
    if (v.docked) {
      this.sentTo = null;
      this.judged = true;
      return { do: 'none' };
    }
    if (!v.own) return { do: 'none' };
    const d = Math.hypot(t.x - v.own.x, t.y - v.own.y);
    const s = v.stop && v.stop.at >= this.started ? v.stop : null;
    // the last order was for this very place (not the step before)
    const mine = !!this.sentTo && Math.hypot(this.sentTo.x - t.x, this.sentTo.y - t.y) <= 60;
    // the helmsman brought her in (his route ends on the water nearest the place: a quay, a shore)
    const cameIn = !v.autosail && !!s && s.why === 'arrived' && s.at >= this.sentAt && mine;
    // Arrived: what the place asks for.
    if (t.act === 'dock' && t.port && (d < this.dockR || (cameIn && d < this.dockR * 2.5))) {
      if (v.now - this.dockAt < 2500) return { do: 'none' };
      this.dockAt = v.now;
      return { do: 'dock' };
    }
    if (t.act === 'land' && v.landable && (d <= t.r || cameIn) && this.landedFor !== spot) {
      this.landedFor = spot;
      return { do: 'land' };
    }
    const inRegion = !!t.region && v.region === t.region;
    const near = !t.region && t.act !== 'dock' && (d <= Math.max(150, t.r * 0.6) || cameIn);
    if (inRegion || near) {
      if (this.arrivedFor === spot) return { do: 'none' };
      this.arrivedFor = spot;
      this.sentTo = null;
      return { do: 'arrived', title: t.title };
    }
    // There already, and only drifted off a little (the way she carried after the sails came in): no new course — it drove
    // her back at the lair's island and onto the rocks (docs/30).
    if (this.arrivedFor === spot && !t.region && t.act !== 'dock' && d <= Math.max(400, t.r * 2)) return { do: 'none' };
    // On the way.
    if (v.autosail) {
      this.judged = true;
      this.refused = 0;
      if (this.sentTo && Math.hypot(v.autosail.x - this.sentTo.x, v.autosail.y - this.sentTo.y) > 60) return { do: 'end', why: 'helm' }; // another course
      if (mine) return { do: 'none' };
      // (the course is still for the step before: set the new one below)
    } else if (this.sentTo && s && s.at >= this.sentAt) {
      // He gave the wheel back since the run sent him: a fight is the server's to take up again; her own hand, a stop on
      // the pill, a reef end the run.
      this.judged = true;
      if (s.why === 'hostile' || s.why === 'attack' || s.why === 'storm') return v.now - s.at > BROKEN_MS ? { do: 'end', why: 'helm' } : { do: 'none' };
      if (s.why !== 'arrived') return { do: 'end', why: 'helm' };
    } else if (this.sentTo && !this.judged && v.now - this.sentAt > 2500) {
      // sent, and the helmsman never took the wheel: refused (the server said why) — once more, then the run lets go
      this.judged = true;
      if (++this.refused >= 2) return { do: 'end', why: 'helm' };
    }
    if (v.now - this.sentAt < RESEND_MS) return { do: 'none' };
    this.sentAt = v.now;
    this.sentTo = { x: t.x, y: t.y };
    this.judged = false;
    this.arrivedFor = '';
    return { do: 'sail', x: t.x, y: t.y, ...(t.act === 'dock' ? {} : { near: Math.max(30, Math.min(150, Math.round(t.r * 0.4))) }) };
  }
}

// ---- route (owner, 2026-10-15: «нажимая на цель из журнала я должен плыть к ближайшей точке выполнения … вообще все
// должно меня вести автоматом к ближайшей подходящей точке»). The server chooses the place (it alone knows where the
// sea's ships are) and steers there, re-targeted as the sea moves (server/src/game/goalroute.ts); what is left to the
// client is what the place asks for on arrival — putting in at a port, landing the party — and the word that she is
// there (the trade's hint: «slow down, cast the net»).

/** The place the server chose (protocol RouteView, the fields the run reads). */
export interface RoutePlace {
  x: number;
  y: number;
  r: number;
  act?: 'dock' | 'land';
  port?: string;
  region?: string;
  ship?: number;
  hint?: string;
}

/** What the run asks main.ts to do this moment (the course itself is the server's). */
export type RouteStep = { do: 'none' } | { do: 'dock' } | { do: 'land' } | { do: 'arrived'; hint?: string };

/** The run to a goal's nearest place, kept between frames: its arrival's deeds. */
export class RouteRun {
  readonly key: string;
  private started: number;
  private dockAt = -1e9;
  private landedFor = '';
  private arrivedFor = '';
  private dockR: number;

  constructor(key: string, now: number, dockR = 420) {
    this.key = key;
    this.started = now;
    this.dockR = dockR;
  }

  step(v: Omit<GoalView, 'target'> & { place: RoutePlace | null }): RouteStep {
    const t = v.place;
    if (!t || v.docked || !v.own) return { do: 'none' };
    const d = Math.hypot(t.x - v.own.x, t.y - v.own.y);
    const s = v.stop && v.stop.at >= this.started ? v.stop : null;
    const cameIn = !v.autosail && !!s && s.why === 'arrived';
    // a ship it follows moves: its spot is the ship, not the metres
    const spot = t.ship !== undefined ? `s${t.ship}` : `${Math.round(t.x / 100)},${Math.round(t.y / 100)}`;
    if (t.act === 'dock' && t.port && (d < this.dockR || (cameIn && d < this.dockR * 2.5))) {
      if (v.now - this.dockAt < 2500) return { do: 'none' };
      this.dockAt = v.now;
      return { do: 'dock' };
    }
    if (t.act === 'land' && v.landable && (d <= t.r || cameIn) && this.landedFor !== spot) {
      this.landedFor = spot;
      return { do: 'land' };
    }
    const there = t.region ? v.region === t.region : t.act !== 'dock' && d <= Math.max(150, t.r);
    if (there && this.arrivedFor !== spot) {
      this.arrivedFor = spot;
      return { do: 'arrived', ...(t.hint ? { hint: t.hint } : {}) };
    }
    return { do: 'none' };
  }
}
