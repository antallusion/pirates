// The game asleep while it is not seen (owner, 2026-10-20 — VK moderation: «Если свернуть вашу игру, звук продолжает
// играть, а приложение работает в фоновом режиме»; docs/36_VK.md). pauseApp(reason) / resumeApp(reason): the first
// reason puts the game to sleep, the last one gone wakes it. Reasons: VK's VKWebAppViewHide (vk.ts), the page hidden
// (visibilitychange, every platform), the page put away (pagehide), and inside VK the window's blur.
// Asleep: every hook's pause (main.ts: the sound's context suspended, the films and any <audio>/<video> paused, the helm
// let go and a neutral input sent once), every requestAnimationFrame callback held — the render loop and every other
// animation's — and CSS animations paused (html.app-paused). Awake: the hooks' resume (the sound as her settings have
// it, the films that were playing) and the held frames run. The socket stays: the session lives on, quietly.
// No imports: the node tests drive it with a fake window (tests/vkbridge.test.ts).

export interface LifeHook {
  pause(): void;
  resume(): void;
}

type RafWin = {
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
  document?: { documentElement?: { classList?: { toggle(c: string, on?: boolean): unknown } } };
};

const hooks: LifeHook[] = [];
const reasons = new Set<string>();
let gate: { held: Map<number, FrameRequestCallback>; seq: number; raf: (cb: FrameRequestCallback) => number; caf: (id: number) => void; win: RafWin } | null = null;
/** How many times the game went to sleep and woke (the QA's and the tests' count). */
export const lifeStats = { paused: 0, resumed: 0, held: 0 };

/** A part of the game that sleeps with it (its pause and its resume, each called once per sleep). */
export function onLifecycle(h: LifeHook): void {
  hooks.push(h);
}

export function appPaused(): boolean {
  return reasons.size > 0;
}

/** The window whose animation frames are held while asleep (main.ts: globalThis; the tests: a fake one). */
export function gateFrames(win: RafWin): void {
  const raf = win.requestAnimationFrame?.bind(win);
  const caf = win.cancelAnimationFrame?.bind(win);
  if (!raf || !caf) return;
  const g = { held: new Map<number, FrameRequestCallback>(), seq: 0, raf, caf, win };
  gate = g;
  // (an id of a held frame is negative: cancelled before the wake, it is dropped from the held ones)
  win.requestAnimationFrame = (cb: FrameRequestCallback) => {
    if (!appPaused()) return g.raf(cb);
    const id = -++g.seq;
    g.held.set(id, cb);
    lifeStats.held++;
    return id;
  };
  win.cancelAnimationFrame = (id: number) => {
    if (id < 0) g.held.delete(id);
    else g.caf(id);
  };
}

function each(f: (h: LifeHook) => void): void {
  for (const h of hooks) {
    try {
      f(h);
    } catch {
      /* one part's fault stops none of the others */
    }
  }
}

/** Asleep for this reason (the first reason puts the game to sleep). */
export function pauseApp(reason: string): void {
  const was = reasons.size > 0;
  reasons.add(reason);
  if (was) return;
  lifeStats.paused++;
  gate?.win.document?.documentElement?.classList?.toggle('app-paused', true);
  each((h) => h.pause());
}

/** This reason gone (the last one wakes the game). */
export function resumeApp(reason: string): void {
  if (!reasons.delete(reason) || reasons.size > 0) return;
  lifeStats.resumed++;
  gate?.win.document?.documentElement?.classList?.toggle('app-paused', false);
  each((h) => h.resume());
  if (gate && gate.held.size) {
    const list = [...gate.held.values()];
    gate.held.clear();
    for (const cb of list) gate.raf(cb);
  }
}

/** The sound asleep with the game: the engine's context suspended (audio.ts setHidden), resumed on the wake — the
 *  volume and the mute stay the player's (they are the engine's own gains). */
export function soundSleeps(audio: { setHidden(hidden: boolean): void }): LifeHook {
  return { pause: () => audio.setHidden(true), resume: () => audio.setHidden(false) };
}

/** Every <audio> and <video> of the page paused (a film among them), and those that were playing played on the wake. */
export function mediaSleeps(doc: { querySelectorAll(q: string): ArrayLike<unknown> }): LifeHook {
  let playing: { play(): Promise<void> | void; pause(): void }[] = [];
  return {
    pause: () => {
      playing = [];
      for (const m of Array.from(doc.querySelectorAll('audio, video')) as { paused: boolean; ended?: boolean; play(): Promise<void> | void; pause(): void }[]) {
        if (m.paused || m.ended) continue;
        playing.push(m);
        m.pause();
      }
    },
    resume: () => {
      for (const m of playing) {
        try {
          void Promise.resolve(m.play()).catch(() => {});
        } catch {
          /* it stays paused: its own tap plays it */
        }
      }
      playing = [];
    },
  };
}

/** Every reason dropped (tests). */
export function resetLifecycle(): void {
  for (const r of [...reasons]) resumeApp(r);
  hooks.length = 0;
}
