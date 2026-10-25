// Real-device telemetry (docs/33 §Телеметрия; the server's side is server/src/http/telemetry.ts). What the game felt
// like on this device, batched: frames per second sampled once a second into a histogram per scene, the loading
// screens' times (ui/loader.ts loadLog) and the start's, the JS errors with their stacks, the device's class and
// memory. Sent once a minute when there is something new, and as the page goes away (sendBeacon). No personal data:
// the only id is a random one this page made for itself (to count devices).

import { loadLog } from './ui/loader.ts';
import { inTelegram } from './tg.ts';

export type TelScene = 'sea' | 'port' | 'battle' | 'isle' | 'menu' | 'other';

/** Share of the sessions that send frames and loads (errors are always sent). */
const SAMPLE = 1;
const FLUSH_MS = 60_000;
const FIRST_FLUSH_MS = 20_000;
const BINS = 13; // fps in fives: [0,5) … [55,60), 60+

let scene: () => TelScene = () => 'other';
let fps: Record<string, number[]> = {};
let loads: { k: string; ms: number; to?: boolean }[] = [];
let errs = new Map<string, { m: string; s: string; n: number }>();
const loadSent = new WeakSet<object>();
let started = false;
let perf = false;

function installId(): string {
  try {
    let id = localStorage.getItem('gravetide.tid');
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('gravetide.tid', id);
    }
    return id;
  } catch {
    return '';
  }
}

function device(): Record<string, unknown> {
  const n = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean } };
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return {
    v: 1, id: installId(), tg: inTelegram(), mob: n.userAgentData?.mobile ?? matchMedia('(pointer: coarse)').matches,
    plat: n.userAgentData?.platform ?? navigator.platform, dpr: Math.round(devicePixelRatio * 100) / 100,
    cores: navigator.hardwareConcurrency, mem: n.deviceMemory, heap: mem ? Math.round(mem.usedJSHeapSize / 1048576) : undefined,
  };
}

function onError(m: string, s: string): void {
  const key = `${m}\n${s.split('\n').slice(0, 2).join('\n')}`;
  const e = errs.get(key);
  if (e) e.n++;
  else if (errs.size < 20) errs.set(key, { m: m.slice(0, 300), s: s.slice(0, 1500), n: 1 });
}

function flush(beacon = false): void {
  if (perf) {
    for (const l of loadLog) {
      if (loadSent.has(l)) continue; // (the log keeps its last forty: told apart by the entry, not its place)
      loadSent.add(l);
      loads.push({ k: l.kind, ms: l.ms, ...(l.timedOut ? { to: true } : {}) });
    }
  }
  const hasFps = Object.keys(fps).length > 0;
  if (!hasFps && !loads.length && !errs.size) return;
  const body = JSON.stringify({ ...device(), ...(hasFps ? { fps } : {}), ...(loads.length ? { loads } : {}), ...(errs.size ? { errs: [...errs.values()] } : {}) });
  fps = {};
  loads = [];
  errs = new Map();
  try {
    if (beacon && navigator.sendBeacon?.('/telemetry', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/telemetry', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch {
    /* no network: the numbers are lost, the game goes on */
  }
}

/** A step of the newcomers' funnel this page reached (the captain's screen), told at once — a page left on it never
 *  sends its minute's report (retention, 2026-10-25; server/src/http/telemetry.ts tel_funnel). */
export function telemetryFunnel(kind: 'cap_screen'): void {
  try {
    const body = JSON.stringify({ ...device(), funnel: [kind] });
    if (navigator.sendBeacon?.('/telemetry', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/telemetry', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch {
    /* no network: not counted */
  }
}

/** The start's own time, from the page's first byte to the sea drawn (main.ts, at «start loaded»). */
export function telemetryBoot(): void {
  if (perf) loads.push({ k: 'boot', ms: Math.round(performance.now()) });
}

/** Begin: `sceneOf` tells what the player looks at. Once per page. */
export function startTelemetry(sceneOf: () => TelScene): void {
  if (started) return;
  started = true;
  scene = sceneOf;
  perf = Math.random() < SAMPLE;
  addEventListener('error', (ev) => onError(String(ev.message || 'error'), String((ev.error as Error | undefined)?.stack ?? `${ev.filename}:${ev.lineno}:${ev.colno}`)));
  addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason as Error | undefined;
    onError(`unhandled: ${String(r?.message ?? r)}`, String(r?.stack ?? ''));
  });
  if (perf) {
    // Frames counted on their own rAF; a second's count is one sample in its scene's histogram (not while hidden).
    let frames = 0, t0 = performance.now();
    const tick = (t: number) => {
      requestAnimationFrame(tick);
      frames++;
      if (t - t0 < 1000) return;
      const v = (frames * 1000) / (t - t0);
      frames = 0;
      const gap = t - t0;
      t0 = t;
      if (document.hidden || gap > 3000) return; // (a tab come back from the background is no frame rate)
      const s = scene();
      const b = (fps[s] ??= new Array<number>(BINS).fill(0));
      b[Math.min(BINS - 1, Math.floor(v / 5))]++;
    };
    requestAnimationFrame(tick);
  }
  setTimeout(() => {
    flush();
    setInterval(() => flush(), FLUSH_MS);
  }, FIRST_FLUSH_MS);
  addEventListener('pagehide', () => flush(true));
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}
